// Menu memory owners, Chromium side (lane street-network-memory-20261127). The iPhone Simulator sees the menu page as
// one WebContent footprint (iphone-sim-start-memory.ts --menu); this says which city-world structure holds it.
//
// Chromium with the iPhone 15 emulation opens the briefing (no ride), waits for the city-world build the briefing
// starts (game-route.js _prepareCityWorld) to settle, then, after a forced GC each time, records the live JS heap and
// drops one structure after another. Each step's drop in the heap is what that structure alone kept alive, given the
// ones already dropped. It also counts the structures (ways, points, segments, graph and index sizes).
//
//   node_modules/.bin/tsx scripts/perf/chromium-menu-memory.ts [--origin http://localhost:4631] [--qs 'a=1']
//     [--settle-s 3] [--runs 1] [--out artifacts/perf/chromium-menu-memory]
//
// V8, not JSC: read it for owners and ratios. Run it in a browser slot (/tmp/canal-pw.sh).
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const origin = opt('origin', 'http://localhost:4631')!;
const extraQs = opt('qs', '');
const settleS = Number(opt('settle-s', '3'));
const runs = Number(opt('runs', '1'));
const outDir = opt('out', 'artifacts/perf/chromium-menu-memory')!;
const desktop = argv.includes('--desktop');
// `--car`: a returning street rider (stored preference travelMode=car), so the briefing builds the street world. A
// fresh visitor's briefing builds the boat world (preferences.ts defaultPreferences).
const car = argv.includes('--car');
// `--sample`: V8's sampling heap profile from navigation on, live objects at the menu, by allocating script/function.
const sample = argv.includes('--sample');
const qs = ['travel=car', 'engine=own', extraQs].filter(Boolean).join('&');
const url = `${origin}/canal-drive/?${qs}`;

/** In-page: the settled city world and the census of its structures. */
const CENSUS = `(async () => {
  const g = window.canalRecallGame; const prep = g && g._cityWorldPrep;
  if (!prep || !prep.promise) return { ready: false };
  const w = await prep.promise; window.__menuWorld = w;
  const L = g.osmLoader;
  let wayNodes = 0, segPoints = 0, segNames = new Set(), segCount = (w.segments || []).length;
  for (const way of (w.ways || [])) wayNodes += way.nodes ? way.nodes.length : 0;
  for (const s of (w.segments || [])) { segPoints += s.points ? s.points.length : 0; segNames.add(s.name); }
  const st = w.routingGraph && w.routingGraph.storage;
  const si = w.surfaceIndex;
  const siKeys = si ? Object.keys(si) : [];
  const sizeOf = v => v == null ? null : (v instanceof Map || v instanceof Set) ? v.size : Array.isArray(v) ? v.length : ArrayBuffer.isView(v) ? v.byteLength : typeof v;
  const siSummary = {}; for (const k of siKeys) siSummary[k] = sizeOf(si[k]);
  return { ready: true, key: w.key, cached: !!w.cached, ways: (w.ways || []).length, wayNodes, segCount, segPoints, segNames: segNames.size,
    graph: st ? { nodes: st.nodeCount, directed: st.targets.length, links: st.linkDistance.length, views: st.views.size, connectors: w.routingGraph.connectors.length } : null,
    surfaceIndex: siSummary, snapIndex: L && L._roadSnapIndex ? Object.keys(L._roadSnapIndex).map(k => k + ':' + sizeOf(L._roadSnapIndex[k])) : null,
    featureMeta: L && L.featureMeta ? L.featureMeta.size : null, plaza: L && L.plazaFeatures ? L.plazaFeatures.length : null };
})()`;

// Each step drops what it names from every holder we know; the heap after GC says what it freed.
const STEPS: [string, string][] = [
  ['ways (raw {lat,lon} way nodes)', `{ const w = window.__menuWorld; w.ways = null; }`],
  ['surface index', `{ const w = window.__menuWorld; w.surfaceIndex = null; }`],
  ['routing graph', `{ const w = window.__menuWorld; w.routingGraph = null; }`],
  ['road snap index', `{ const w = window.__menuWorld, L = window.canalRecallGame.osmLoader; L._roadSnapIndex = null; if (w.loaded && w.loaded.projection) w.loaded.projection._roadSnapIndex = null; }`],
  ['segments ({x,y} points)', `{ const w = window.__menuWorld, L = window.canalRecallGame.osmLoader; w.segments = null; L._roadSnapSegments = null; if (w.loaded && w.loaded.projection) w.loaded.projection._roadSnapSegments = null; }`],
  ['plazas + ferry network', `{ const w = window.__menuWorld, L = window.canalRecallGame.osmLoader; L.plazaFeatures = null; L.ferryNetwork = null; if (w.loaded) { w.loaded.plazaFeatures = null; w.loaded.ferryNetwork = null; } }`],
  ['featureMeta', `{ const L = window.canalRecallGame.osmLoader; L.featureMeta = null; }`],
];

// Same aggregation as chromium-start-memory.ts (that file runs on import).
type SampleNode = { callFrame: { functionName: string; url: string; lineNumber: number }; selfSize: number; children: SampleNode[] };
/** Sampling heap profile → live bytes by allocating frame (`fn @ file:line`) and by script file, largest first. */
function aggregateSampling(head: SampleNode, top = 40) {
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

const all: unknown[] = [];
for (let run = 0; run < runs; run++) {
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc'] });
  const context = await browser.newContext(desktop ? { viewport: { width: 1440, height: 900 } } : { ...devices['iPhone 15'] });
  await context.addInitScript((asCar: boolean) => { try {
    localStorage.setItem('canalRecall.onboarding.v1', 'done');
    if (asCar) localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({ cityId: 'amsterdam', travelMode: 'car' }));
  } catch { /* storage off */ } }, car);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage') as { usedSize: number }; return +(h.usedSize / 1048576).toFixed(1); };
  if (sample) { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384 }); }
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  let census: any = null;
  while (Date.now() - t0 < 180_000) {
    census = await page.evaluate(CENSUS).catch(e => ({ ready: false, error: String(e) }));
    if (census?.ready) break;
    await page.waitForTimeout(500);
  }
  const readyS = (Date.now() - t0) / 1000;
  await page.waitForTimeout(settleS * 1000);
  let heapTop: unknown = null;
  if (sample) {
    await cdp.send('HeapProfiler.collectGarbage');
    const { profile } = await cdp.send('HeapProfiler.getSamplingProfile') as unknown as { profile: { head: SampleNode } };
    heapTop = aggregateSampling(profile.head, 30);
    console.log('live heap by allocator:', JSON.stringify(heapTop, null, 1));
  }
  const steps: { step: string; heapMB: number; freedMB: number }[] = [];
  let last = await heap();
  steps.push({ step: 'menu, city world built', heapMB: last, freedMB: 0 });
  for (const [name, code] of STEPS) {
    await page.evaluate(code).catch(e => console.warn(name, String(e).slice(0, 200)));
    const h = await heap();
    steps.push({ step: name, heapMB: h, freedMB: +(last - h).toFixed(1) });
    last = h;
  }
  console.log(`run ${run + 1}: world ready at ${readyS.toFixed(1)} s`, JSON.stringify(census));
  for (const s of steps) console.log(`  ${String(s.heapMB).padStart(7)} MB  freed ${String(s.freedMB).padStart(6)} MB  ${s.step}`);
  all.push({ readyS, census, steps, heapTop });
  await browser.close();
}
mkdirSync(outDir, { recursive: true });
const file = `${outDir}/menu-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify({ url, runs: all }, null, 1));
console.log(`wrote ${file}`);
