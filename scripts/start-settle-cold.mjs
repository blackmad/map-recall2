// Cold start of the Free Ride: when the rider is racing (the loading screen has gone), and when each world tier
// reports settled (vectorMap.worldSettled(), engine/ownWorldView.ts), round 5 lane R5-B (issue #261).
//   PORT=4681 node scripts/start-settle-cold.mjs <out.json> [--device desktop|iphone] [--runs 5] [--qs '?engine=own&ride=free']
//     [--chrome] [--headed] [--throttle 4] [--watch 8000]
// Each run is a fresh browser context (cold HTTP cache). A page-side sampler runs every 50 ms from navigation: the
// game state, loadingProgress, the game's own settle hold (_lastMapSettle: ms, timedOut, pending), and worldSettled()'s
// flags. Node derives, per run: navigation -> racing, the hold, and for each tier the time from racing until it first
// reads settled (0 when it already did at racing; null when it never did inside the watch window).
// Desktop: 1512x982 at DPR 2 (budgets.json _desktopPerfViewport). iPhone: devices['iPhone 13'] with CPU throttle 4x.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/start-settle-cold.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const device = opt('device', 'desktop');
const runs = Number(opt('runs', '5'));
const qs = opt('qs', '?engine=own&ride=free');
const throttle = Number(opt('throttle', device === 'iphone' ? '4' : '1'));
const watchMs = Number(opt('watch', '8000'));
const headed = argv.includes('--headed');
const useChrome = argv.includes('--chrome');
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4681}`;
const pagePath = process.env.PAGE || '/canal-drive/';
const TIERS = ['ground', 'city', 'buildings', 'far', 'baked', 'settled'];

const browser = await chromium.launch({
  headless: !headed,
  args: ['--enable-precise-memory-info', ...(useChrome ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : [])],
  ...(useChrome ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}),
});

async function run() {
  const [vw, vh] = (process.env.VIEWPORT || '1512x982').split('x').map(Number);
  const context = await browser.newContext(device === 'iphone'
    ? { ...devices['iPhone 13'] }
    : { viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  await page.addInitScript(() => {
    const S = window.__coldStart = { samples: [] };
    const sample = () => {
      const t = Math.round(performance.now()), g = window.canalRecallGame, vm = g?.vectorMap;
      let w = null;
      try { w = vm && typeof vm.worldSettled === 'function' ? vm.worldSettled() : null; } catch (_) { w = null; }
      S.samples.push({
        t, state: g ? g.state : null, progress: g ? g.loadingProgress ?? null : null,
        hold: g && g._lastMapSettle ? { ...g._lastMapSettle } : null,
        ground: w ? w.ground : null, city: w ? w.city : null, buildings: w ? w.buildings : null,
        far: w ? w.far : null, baked: w ? w.baked : null, settled: w ? w.settled : null,
        detail: w ? w.detail : null, aerialZoom: vm?.camera?.zoom ?? null,
      });
      if (S.samples.length > 3000) S.samples.splice(0, S.samples.length - 3000);
    };
    setInterval(sample, 50);
  });
  await page.goto(`${origin}${pagePath}${qs}`, { waitUntil: 'load' });
  const cdp = await context.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  // Racing is the end of the loading screen (game leaves GameState.LOADING, state 4 = RACING).
  await page.waitForFunction(() => window.canalRecallGame?.state === 4, null, { timeout: 180_000 });
  const racedAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(watchMs);
  const data = await page.evaluate(() => window.__coldStart.samples);
  const navSettle = await page.evaluate(() => window.canalRecallGame?._lastMapSettle ?? null);
  await context.close();
  // Racing time on the page clock: the first sample with state 4.
  const race = data.find(s => s.state === 4);
  const tRace = race ? race.t : Math.round(racedAt);
  const tiers = {};
  for (const k of TIERS) {
    const first = data.find(s => s.t >= tRace && s[k] === true);
    tiers[k] = first ? Math.max(0, first.t - tRace) : null;
  }
  const atRace = race ? Object.fromEntries(TIERS.map(k => [k, race[k]])) : null;
  return {
    device, throttle, navToRaceMs: tRace, hold: navSettle, holdTimedOut: navSettle ? navSettle.timedOut : null,
    atRacing: atRace, racingToTierMs: tiers, pendingAtRace: race?.hold?.pending ?? null,
    errors: errors.slice(0, 3), sampleCount: data.length, cameraZoomAtRace: race?.aerialZoom ?? null,
  };
}

const results = [];
for (let i = 0; i < runs; i++) {
  const r = await run();
  results.push(r);
  console.log(`${device} run ${i + 1}: nav->racing ${r.navToRaceMs} ms, hold timedOut ${r.holdTimedOut}, ` +
    `racing->settled ${r.racingToTierMs.settled ?? 'never'} ms (ground ${r.racingToTierMs.ground ?? 'never'}, buildings ${r.racingToTierMs.buildings ?? 'never'}, far ${r.racingToTierMs.far ?? 'never'}, baked ${r.racingToTierMs.baked ?? 'never'})`);
}
await browser.close();

const med = xs => { const v = xs.filter(x => x != null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
const summary = {
  nav_to_racing_ms: med(results.map(r => r.navToRaceMs)),
  hold_ms: med(results.map(r => r.hold?.ms ?? null)),
  hold_timed_out_runs: results.filter(r => r.holdTimedOut).length,
  racing_to_settled_ms: med(results.map(r => r.racingToTierMs.settled)),
  racing_to_ground_ms: med(results.map(r => r.racingToTierMs.ground)),
  racing_to_city_ms: med(results.map(r => r.racingToTierMs.city)),
  racing_to_buildings_ms: med(results.map(r => r.racingToTierMs.buildings)),
  racing_to_far_ms: med(results.map(r => r.racingToTierMs.far)),
  racing_to_baked_ms: med(results.map(r => r.racingToTierMs.baked)),
  never_settled_runs: results.filter(r => r.racingToTierMs.settled == null).length,
};
fs.mkdirSync(out.replace(/\/[^/]*$/, ''), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ qs, device, throttle, watchMs, summary, results }, null, 2));
console.log('summary', JSON.stringify(summary));
