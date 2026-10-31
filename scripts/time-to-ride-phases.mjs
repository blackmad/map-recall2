// Time to ride by phase (issue #136): navigation -> route submitted -> rider in control, desktop, cold cache.
//   PORT=4543 node scripts/time-to-ride-phases.mjs <out.json> [--runs 3] [--qs '?x=1']
// Same route as motion-stutter.mjs (Anne Frank Huis -> Rijksmuseum, car, chase, seeded Math.random), submitted as
// soon as the route card is ready. Phases are timed by wrapping the load steps the game awaits (osmLoader.fetchRoads,
// buildRoadSegmentsAsync, _loadLandmarks, RoadNetwork.prepareRoutingGraph / prepareSurfaceIndex, planRoute) and by
// polling each frame for the first own-ground cell, the first resident building tile, the rider and racing.
// A CPU profile (started on a blank page, so its ~1.7 s start stall is outside the window) gives self time by script
// and by function between submit and racing. BUNDLES_DIR=<dir> serves *.bundle.js from a local build.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/time-to-ride-phases.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const runs = Number(opt('runs', '3'));
const qs = opt('qs', '');
const origin = `http://127.0.0.1:${process.env.PORT || 4543}`;
const startPoi = 'anne-frank', destPoi = 'rijksmuseum';

async function run(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await page.addInitScript(() => {
    let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    if (!/^\/canal-drive\/?(index\.html)?$/.test(location.pathname)) return;
    const T = window.__ttr = { spans: [], firsts: {} };
    const first = (k, ok) => { if (T.firsts[k] == null && ok) T.firsts[k] = performance.now(); };
    const poll = () => {
      const g = window.canalRecallGame;
      if (g) {
        const vm = g.vectorMap;
        first('loading', g.state === 1 || g.loadingProgress > 0);
        first('track', !!g.track);
        first('player', !!g.player?.x);
        // status() walks every resident cell: poll it every 10th frame until the first cell is in.
        if (T.firsts.groundCell == null && (T.frame = (T.frame || 0) + 1) % 10 === 0) first('groundCell', (() => { try { const st = vm?._ownGround?.status?.(); return !!st && (st.built > 0 || Object.keys(st.cells || {}).length > 0); } catch (_) { return false; } })());
        first('buildingTile', [...(vm?._completeCity?.tileTimes?.values() ?? [])].some(t => t.resident != null));
        first('buildingTiles4', [...(vm?._completeCity?.tileTimes?.values() ?? [])].filter(t => t.resident != null).length >= 4);
        first('racing', g.state === 4 && g.camera?.introOverview === 0);
        if (g.loadingProgress != null && T.lastProgress !== g.loadingProgress) { T.lastProgress = g.loadingProgress; T.spans.push({ k: `progress ${g.loadingProgress}`, t0: performance.now() }); }
      }
      if (T.firsts.racing == null) requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
  await page.goto(`${origin}/canal-drive/js/build-stamp.js`).catch(() => {});
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  await page.waitForTimeout(2500);
  await page.goto(`${origin}/canal-drive/${qs}`);
  await page.waitForFunction(([a, b]) => window.canalRecallGame?.routePois?.some(p => p.id === a) && window.canalRecallGame.routePois.some(p => p.id === b), [startPoi, destPoi], { timeout: 120_000 });
  // Wrap the awaited load steps (instance and class methods; RoadNetwork is a classic-script global).
  await page.evaluate(() => {
    const T = window.__ttr, g = window.canalRecallGame;
    const wrap = (obj, name, label) => {
      const fn = obj && obj[name]; if (typeof fn !== 'function') return;
      obj[name] = function (...args) {
        const span = { k: label, t0: performance.now() }; T.spans.push(span);
        const done = () => { span.t1 = performance.now(); };
        let r; try { r = fn.apply(this, args); } catch (e) { done(); throw e; }
        if (r && typeof r.then === 'function') r.then(done, done); else done();
        return r;
      };
    };
    for (const name of ['_startConfiguredRoute', '_loadRoutePoiCatalog', '_loadRoutePoiCatalogNow', '_loadTransitRoutePois', '_launchPoiRoute', '_onLocationSelected']) wrap(g, name, `game.${name}`);
    wrap(g.osmLoader, 'fetchRoads', 'osmLoader.fetchRoads');
    wrap(g.osmLoader, 'buildRoadSegmentsAsync', 'osmLoader.buildRoadSegmentsAsync');
    wrap(g, '_loadLandmarks', 'game._loadLandmarks');
    /* global RoadNetwork */
    wrap(RoadNetwork, 'prepareRoutingGraph', 'RoadNetwork.prepareRoutingGraph');
    wrap(RoadNetwork, 'prepareSurfaceIndex', 'RoadNetwork.prepareSurfaceIndex');
    wrap(RoadNetwork.prototype, 'planRoute', 'RoadNetwork.planRoute');
    wrap(RoadNetwork.prototype, 'findRouteToFirstReachable', 'RoadNetwork.findRouteToFirstReachable');
  });
  await page.locator('#travel-mode').selectOption('car', { force: true });
  await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.evaluate(([a, b]) => {
    const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === a);
    try { g._overlay.store.setState({ destinationId: b }); } catch (_) {}
    const sel = document.querySelector('#poi-destination');
    if (sel && ![...sel.options].some(o => o.value === b)) { const o = document.createElement('option'); o.value = b; o.textContent = b; sel.appendChild(o); }
    if (sel) sel.value = b;
  }, [startPoi, destPoi]);
  const submitted = await page.evaluate(() => performance.now());
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  await page.waitForFunction(() => window.__ttr.firsts.racing != null, null, { timeout: 120_000, polling: 100 });
  await page.waitForFunction(() => window.__ttr.firsts.buildingTiles4 != null && window.__ttr.firsts.groundCell != null, null, { timeout: 30_000, polling: 100 }).catch(() => {});
  const { profile } = await cdp.send('Profiler.stop');
  const ttr = await page.evaluate(() => window.__ttr);
  const marks = await page.evaluate(() => ({ now: performance.now(), timeOrigin: performance.timeOrigin }));
  await context.close();

  // Profile window: submit -> racing, aligned by the profile's own clock (profile times are µs since an arbitrary epoch;
  // the last sample is "now" at Profiler.stop, close enough to align at sampling-interval precision).
  const ends = profile.endTime / 1000, offset = marks.now - ends;
  const from = submitted, to = ttr.firsts.racing;
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const selfByScript = new Map(), selfByFn = new Map();
  let t = profile.startTime / 1000 + offset;
  profile.samples.forEach((id, i) => {
    t += (profile.timeDeltas[i] || 0) / 1000;
    if (t < from || t > to) return;
    const dt = (profile.timeDeltas[i + 1] || 0) / 1000;
    const f = byId.get(id).callFrame, script = f.url ? f.url.split('/').pop().split('?')[0] : f.functionName || '(native)';
    selfByScript.set(script, (selfByScript.get(script) || 0) + dt);
    const key = `${f.functionName || '(anon)'} ${script}:${f.lineNumber + 1}`;
    selfByFn.set(key, (selfByFn.get(key) || 0) + dt);
  });
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, ms]) => ({ k, ms: Math.round(ms) }));
  const rel = v => (v == null ? null : Math.round(v - submitted));
  return {
    submittedAtMs: Math.round(submitted),
    firsts: Object.fromEntries(Object.entries(ttr.firsts).map(([k, v]) => [k, rel(v)])),
    spans: ttr.spans.map(s => ({ k: s.k, startMs: rel(s.t0), ms: s.t1 != null ? Math.round(s.t1 - s.t0) : null })),
    selfByScript: top(selfByScript, 20), selfByFn: top(selfByFn, 40), errors,
  };
}

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
for (let i = 0; i < runs; i++) {
  const r = await run(browser);
  results.push(r);
  console.log(`run ${i + 1}: submit@${r.submittedAtMs} ms; after submit: ${Object.entries(r.firsts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const s of r.spans.filter(s => s.ms != null)) console.log(`  ${s.k} @${s.startMs} ${s.ms} ms`);
}
await browser.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), qs, results }, null, 2));
console.log(`wrote ${out}`);
