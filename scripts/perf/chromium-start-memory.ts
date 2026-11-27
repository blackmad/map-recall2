// iPhone start memory, the Chromium side (lane iphone-start-memory-20261127): who owns the bytes the iOS Simulator
// probe (iphone-sim-start-memory.ts) only sees as one WebContent footprint. Chromium with the iPhone 15 emulation
// (touch, `pointer: coarse`, dpr 3, so the page takes its touch caps) opens the same default ride, holds ArrowUp once
// racing, and at --at-s seconds after racing records:
//   - every response's decoded size, grouped by file (what the page downloaded and so had to parse);
//   - the JS heap (Runtime.getHeapUsage) and, with --snapshot, V8's sampling heap profile of the live objects
//     (from navigation on), aggregated by the allocating function and by its script (a full snapshot of a
//     500 MB heap does not fit in one JS string);
//   - the page's own counters: `__canalPerf.snapshot()`, `__canalPerf.gl.counters.resident.report()` (with
//     ?glCounters=1), the MapLibre source caches.
//
//   node_modules/.bin/tsx scripts/perf/chromium-start-memory.ts [--engine own|maplibre] [--origin http://localhost:4631]
//     [--qs 'a=1'] [--at-s 20] [--snapshot | --alloc] [--out artifacts/perf/chromium-start-memory]
//
// Chromium is not WebKit: the heap is V8's and GPU memory lives in another process, so read it for owners and
// ratios, not for the jetsam figure. Run it in a browser slot (/tmp/canal-pw.sh).
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const engine = opt('engine', 'own')!;
const origin = opt('origin', 'http://localhost:4631')!;
const extraQs = opt('qs', '');
const atS = Number(opt('at-s', '20'));
const outDir = opt('out', 'artifacts/perf/chromium-start-memory')!;
const wantSnapshot = argv.includes('--snapshot') || argv.includes('--alloc');
// `--alloc`: count every sampled allocation, also the ones a GC has since collected (who churns the start, not who holds it).
const wantAlloc = argv.includes('--alloc');

const START = [52.37665, 4.90115], FINISH = [52.37265, 4.90035];
const hash = `#race=${START[0]},${START[1]},${START[0]},${START[1]},${FINISH[0]},${FINISH[1]}`;
const qs = ['travel=car', `engine=${engine}`, extraQs].filter(Boolean).join('&');
const gameUrl = `${origin}/canal-drive/?${qs}${hash}`;

type SampleNode = { callFrame: { functionName: string; url: string; lineNumber: number }; selfSize: number; children: SampleNode[] };
/** Sampling heap profile → live bytes by allocating frame (`fn @ file:line`) and by script file, largest first. */
export function aggregateSampling(head: SampleNode, top = 40) {
  const byFrame = new Map<string, number>(), byFile = new Map<string, number>();
  let total = 0;
  const walk = (n: SampleNode) => {
    if (n.selfSize) {
      const f = n.callFrame, file = f.url ? f.url.replace(/^.*\/canal-drive\//, '').replace(/\?.*$/, '') : '(native)';
      const key = `${f.functionName || '(anon)'} @ ${file}:${f.lineNumber + 1}`;
      byFrame.set(key, (byFrame.get(key) ?? 0) + n.selfSize); byFile.set(file, (byFile.get(file) ?? 0) + n.selfSize); total += n.selfSize;
    }
    for (const c of n.children) walk(c);
  };
  walk(head);
  const list = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([what, b]) => ({ what, MB: +(b / 1048576).toFixed(1) }));
  return { totalMB: +(total / 1048576).toFixed(1), byFile: list(byFile), byFrame: list(byFrame) };
}

const PROBE = `(() => { const g = window.canalRecallGame, vm = g && g.vectorMap, perf = window.__canalPerf;
  if (g && g.state === 4 && !g._intro && g.input) g.input.keys.ArrowUp = true;
  let snap = null; try { snap = perf && perf.snapshot ? perf.snapshot() : null; } catch (e) {}
  let glr = null; try { glr = perf && perf.gl && perf.gl.counters ? perf.gl.counters.resident.report() : null; } catch (e) {}
  let ml = null; try { const m = vm && vm.map; if (m && m.style) { ml = {}; const caches = m.style.tileManagers || m.style.sourceCaches || {}; for (const [id, sc] of Object.entries(caches)) { ml[id] = { tiles: sc._tiles ? Object.keys(sc._tiles).length : null, cached: sc._cache && sc._cache.order ? sc._cache.order.length : null }; } } } catch (e) {}
  return { state: g ? g.state : null, intro: !!(g && g._intro), engine: vm ? vm.engine : null, snap, glr, ml,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, workers: window.__canalRecallWorkerPool ? window.__canalRecallWorkerPool.live : null }; })()`;

const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ ...devices['iPhone 15'] });
await context.addInitScript(() => { try { localStorage.setItem('canalRecall.onboarding.v1', 'done'); } catch { /* storage off */ } });
const page = await context.newPage();
const responses = new Map<string, { bytes: number; n: number }>();
page.on('response', async res => {
  try {
    const u = new URL(res.url()); if (u.protocol === 'data:') return;
    const body = await res.body().catch(() => null); if (!body) return;
    const key = u.origin === origin ? u.pathname : `${u.host}${u.pathname.replace(/\/\d+\/\d+\/\d+.*$/, '/{z}/{x}/{y}')}`;
    const o = responses.get(key) ?? { bytes: 0, n: 0 }; o.bytes += body.length; o.n++; responses.set(key, o);
  } catch { /* closed */ }
});
const cdp = await context.newCDPSession(page);
if (wantSnapshot) { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, ...(wantAlloc ? { includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true } : {}) }); }
const t0 = Date.now();
await page.goto(gameUrl, { waitUntil: 'commit', timeout: 120_000 });
const samples: unknown[] = [];
let racingAt: number | null = null;
while (Date.now() - t0 < 180_000) {
  const probe = await page.evaluate(PROBE).catch(() => null) as any;
  const heap = await cdp.send('Runtime.getHeapUsage').catch(() => null) as any;
  const t = (Date.now() - t0) / 1000;
  samples.push({ t, heapMB: heap ? Math.round(heap.usedSize / 1048576) : null, probe });
  console.log(`t=${t.toFixed(1)} state=${probe?.state} heap ${heap ? Math.round(heap.usedSize / 1048576) : '?'} MB ${probe?.snap ? JSON.stringify(probe.snap) : ''}`);
  if (probe?.state === 4 && !probe.intro && racingAt == null) racingAt = Date.now();
  if (racingAt != null && Date.now() - racingAt > atS * 1000) break;
  await page.waitForTimeout(1000);
}
const final = await page.evaluate(PROBE).catch(() => null);
let heapTop: unknown = null;
if (wantSnapshot) {
  await cdp.send('HeapProfiler.collectGarbage');
  const { profile } = await cdp.send('HeapProfiler.getSamplingProfile') as unknown as { profile: { head: SampleNode } };
  heapTop = aggregateSampling(profile.head);
}
// Dedicated workers' own heaps (each is a separate V8 isolate in the same renderer, as in WebKit's WebContent).
const workerHeaps: { url: string; usedMB: number }[] = [];
try {
  const bs = await browser.newBrowserCDPSession();
  const { targetInfos } = await bs.send('Target.getTargets') as { targetInfos: { targetId: string; type: string; url: string }[] };
  const pending = new Map<number, (v: any) => void>();
  bs.on('Target.receivedMessageFromTarget', (e: any) => { const m = JSON.parse(e.message); pending.get(m.id)?.(m.result); });
  let id = 1;
  for (const t of targetInfos.filter(t => t.type === 'worker')) {
    const { sessionId } = await bs.send('Target.attachToTarget', { targetId: t.targetId, flatten: false }) as { sessionId: string };
    const mid = id++;
    const res = await new Promise<any>(resolve => { pending.set(mid, resolve); void bs.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id: mid, method: 'Runtime.getHeapUsage' }) }); setTimeout(() => resolve(null), 5000); });
    workerHeaps.push({ url: t.url.replace(/^.*\/canal-drive\//, '').replace(/\?.*$/, ''), usedMB: res ? Math.round(res.usedSize / 1048576) : -1 });
  }
} catch (e) { console.warn('worker heaps:', String(e).slice(0, 200)); }
console.log('worker heaps:', JSON.stringify(workerHeaps));
const net = [...responses].map(([k, o]) => ({ file: k, MB: +(o.bytes / 1048576).toFixed(2), n: o.n })).sort((a, b) => b.MB - a.MB);
const netTotalMB = +(net.reduce((s, r) => s + r.MB, 0)).toFixed(1);
mkdirSync(outDir, { recursive: true });
const file = `${outDir}/chromium-${engine}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify({ engine, gameUrl, atS, workerHeaps, netTotalMB, net: net.slice(0, 60), heapTop, final, samples }, null, 1));
console.log(`network decoded ${netTotalMB} MB; top:`); for (const r of net.slice(0, 25)) console.log(`  ${String(r.MB).padStart(7)} MB x${r.n}  ${r.file}`);
if (heapTop) { console.log('heap by constructor:', JSON.stringify(heapTop, null, 1)); }
console.log(`wrote ${file}`);
await browser.close();
