/**
 * Cold first-load measurement of the assembled Canal Recall site (desktop).
 *
 *   npm run build && node scripts/assemble-canalrecall-site.mjs
 *   npx firebase-tools@15 serve --only hosting:canalrecall --port 4471
 *   node --import tsx scripts/preview/first-load.ts --base http://localhost:4471 --runs 3 --out /tmp/first-load.json
 *
 * Each run is a fresh browser context (empty HTTP cache, no storage) on the
 * Playwright "Desktop Chrome" profile at 1440×900. Bytes are CDP
 * `encodedDataLength` (what crossed the wire, br/gzip as served, headers
 * included). Request time is requestWillBeSent → loadingFinished. Render
 * blocking is Chrome's own `renderBlockingStatus` from Resource Timing.
 *
 * /ride: "setup visible" is the first frame where #route-card has a laid-out
 * box; the default route (seeded Math.random) is then submitted at once and
 * "route started" is the first frame with the game in RACING (state 4).
 * `--throttle 20,40` adds CDP network emulation (20 Mbit/s down, 40 ms RTT).
 * / and /explore: FCP, LCP and load, with bytes up to network quiet.
 */
import { chromium, devices, type CDPSession, type Page } from '@playwright/test';
import { existsSync, writeFileSync } from 'node:fs';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://localhost:4471');
const RUNS = Number(arg('runs', '3'));
const OUT = arg('out', '');
const PAGES = arg('pages', '/ride,/,/explore').split(',');
// `--throttle 20,40` emulates a 20 Mbit/s, 40 ms RTT desktop connection; localhost alone has neither.
const THROTTLE = arg('throttle', '').split(',').filter(Boolean).map(Number);
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

interface Req {
  id: string; url: string; type: string; start: number; end?: number; bytes: number;
  status?: number; encoding?: string; failed?: boolean; fromCache?: boolean;
}

function track(cdp: CDPSession) {
  const reqs = new Map<string, Req>();
  cdp.on('Network.requestWillBeSent', e => {
    // Redirects reuse the id: keep the first start, count the hop as its own row.
    const prior = reqs.get(e.requestId);
    if (prior && e.redirectResponse) reqs.set(`${e.requestId}:r${prior.start}`, { ...prior, end: e.timestamp, status: e.redirectResponse.status });
    reqs.set(e.requestId, { id: e.requestId, url: e.request.url, type: e.type ?? '', start: prior?.start ?? e.timestamp, bytes: 0 });
  });
  cdp.on('Network.responseReceived', e => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.status = e.response.status;
    const h = e.response.headers as Record<string, string>;
    r.encoding = h['content-encoding'] ?? h['Content-Encoding'] ?? '';
    r.fromCache = e.response.fromDiskCache || e.response.fromServiceWorker;
  });
  cdp.on('Network.loadingFinished', e => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.end = e.timestamp;
    r.bytes = e.encodedDataLength;
  });
  cdp.on('Network.loadingFailed', e => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.end = e.timestamp;
    r.failed = true;
  });
  return reqs;
}

// A string, not a function: tsx's keepNames would inject `__name` helpers the page lacks.
const INIT = `(() => {
  const w = window;
  w.__fl = {};
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') w.__fl.fcp = e.startTime;
  }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) w.__fl.lcp = e.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  const poll = () => {
    const card = document.getElementById('route-card');
    if (w.__fl.setup == null && card) {
      const box = card.getBoundingClientRect();
      if (box.width > 0 && box.height > 0 && getComputedStyle(card).visibility !== 'hidden') w.__fl.setup = performance.now();
    }
    const game = w.canalRecallGame;
    if (w.__fl.racing == null && game && game.state === 4) w.__fl.racing = performance.now();
    if (w.__fl.racing == null) requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
  let seed = 0x5eed1234;
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
})();`;

async function quiet(page: Page, reqs: Map<string, Req>, quietMs = 2000, capMs = 30_000) {
  const t0 = Date.now();
  let last = -1, stableSince = Date.now();
  while (Date.now() - t0 < capMs) {
    const open = [...reqs.values()].filter(r => r.end == null).length;
    const n = reqs.size;
    if (open === 0 && n === last) { if (Date.now() - stableSince > quietMs) return; } else { stableSince = Date.now(); last = n; }
    await page.waitForTimeout(200);
  }
}

const summarise = (reqs: Req[], navStart: number, until?: number) => {
  const rows = reqs.filter(r => r.start <= (until ?? Infinity));
  return {
    requests: rows.length,
    bytes: rows.reduce((s, r) => s + r.bytes, 0),
    rows: rows.map(r => ({ url: r.url, type: r.type, bytes: r.bytes, ms: r.end ? Math.round((r.end - r.start) * 1000) : null,
      startMs: Math.round((r.start - navStart) * 1000), status: r.status, encoding: r.encoding, failed: !!r.failed })),
  };
};

async function measure(path: string) {
  const browser = await chromium.launch({ executablePath: existsSync(localChrome) ? localChrome : undefined });
  const context = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript({ content: INIT });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  if (THROTTLE.length === 2) {
    const [mbit, rtt] = THROTTLE;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rtt, downloadThroughput: mbit * 125_000, uploadThroughput: 5 * 125_000 });
  }
  const reqs = track(cdp);
  const wallStart = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: 'commit' });
  const navStart = Math.min(...[...reqs.values()].map(r => r.start));
  const result: Record<string, unknown> = { path };
  if (path === '/ride') {
    await page.waitForFunction(() => (window as unknown as { __fl: { setup?: number } }).__fl.setup != null, null, { timeout: 120_000 });
    const setupMs = await page.evaluate(() => (window as unknown as { __fl: { setup: number } }).__fl.setup);
    const atSetup = summarise([...reqs.values()], navStart, navStart + setupMs / 1000);
    await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.waitForFunction(() => (window as unknown as { __fl: { racing?: number } }).__fl.racing != null, null, { timeout: 240_000 });
    const fl = await page.evaluate(() => (window as unknown as { __fl: Record<string, number> }).__fl);
    const atStart = summarise([...reqs.values()], navStart, navStart + fl.racing / 1000);
    // Everything the first ride pulls in before the network goes quiet (2 s), capped at 30 s.
    await quiet(page, reqs);
    const total = summarise([...reqs.values()], navStart);
    Object.assign(result, { fcp: fl.fcp, lcp: fl.lcp, setupMs: fl.setup, racingMs: fl.racing,
      setupRequests: atSetup.requests, setupBytes: atSetup.bytes, startRequests: atStart.requests, startBytes: atStart.bytes,
      requests: total.requests, bytes: total.bytes, rows: total.rows });
  } else {
    await page.waitForLoadState('load');
    await quiet(page, reqs);
    const fl = await page.evaluate(() => ({ ...(window as unknown as { __fl: Record<string, number> }).__fl,
      load: performance.getEntriesByType('navigation')[0] ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventEnd : 0 }));
    const all = summarise([...reqs.values()], navStart);
    Object.assign(result, { fcp: fl.fcp, lcp: fl.lcp, load: fl.load, requests: all.requests, bytes: all.bytes, rows: all.rows });
  }
  const blocking = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(e => (e as PerformanceResourceTiming & { renderBlockingStatus?: string }).renderBlockingStatus === 'blocking')
    .map(e => ({ url: e.name, ms: Math.round(e.duration), transfer: (e as PerformanceResourceTiming).transferSize })));
  result.renderBlocking = blocking;
  result.wallMs = Date.now() - wallStart;
  await browser.close();
  return result;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const all: Record<string, Record<string, unknown>[]> = {};
for (const path of PAGES) {
  all[path] = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await measure(path);
    all[path].push(r);
    const { rows: _rows, renderBlocking: _rb, ...head } = r as Record<string, unknown>;
    console.log(JSON.stringify(head));
  }
}
const keys = ['fcp', 'lcp', 'load', 'setupMs', 'racingMs', 'setupRequests', 'setupBytes', 'startRequests', 'startBytes', 'requests', 'bytes'];
const medians: Record<string, Record<string, number>> = {};
for (const [path, runs] of Object.entries(all)) {
  medians[path] = {};
  for (const k of keys) {
    const xs = runs.map(r => r[k]).filter((x): x is number => typeof x === 'number');
    if (xs.length) medians[path][k] = Math.round(median(xs));
  }
}
console.log('MEDIANS', JSON.stringify(medians, null, 1));
// Top 15 by bytes and by time, from the median-bytes run of each page.
for (const [path, runs] of Object.entries(all)) {
  const by = 'bytes';
  const mid = [...runs].sort((a, b) => (a[by] as number) - (b[by] as number))[Math.floor(runs.length / 2)];
  const rows = mid.rows as Array<{ url: string; bytes: number; ms: number | null; encoding?: string; startMs: number }>;
  const short = (u: string) => u.replace(BASE, '').slice(0, 110);
  console.log(`\nTOP BYTES ${path}`);
  for (const r of [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, 15)) console.log(`${(r.bytes / 1024).toFixed(1)} KB\t${r.ms ?? '-'} ms\t@${r.startMs}\t${r.encoding || '-'}\t${short(r.url)}`);
  console.log(`TOP TIME ${path}`);
  for (const r of [...rows].sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0)).slice(0, 15)) console.log(`${r.ms ?? '-'} ms\t${(r.bytes / 1024).toFixed(1)} KB\t@${r.startMs}\t${short(r.url)}`);
  console.log(`RENDER-BLOCKING ${path}`);
  for (const b of mid.renderBlocking as Array<{ url: string; ms: number; transfer: number }>) console.log(`${b.ms} ms\t${(b.transfer / 1024).toFixed(1)} KB\t${short(b.url)}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify({ base: BASE, runs: RUNS, medians, all }, null, 1));
