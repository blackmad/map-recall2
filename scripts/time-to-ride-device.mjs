// Time to ride by phase on a phone (P3 gate: navigation -> racing <= 4 s; real iPhone 2026-11-01: 5.7 s).
//   PORT=4543 node scripts/time-to-ride-device.mjs <out.json> [--target emulated|safari] [--runs 3] [--qs '?engine=own']
//     [--base http://host:port/canal-drive/] [--cpu 4] [--profile] [--dwell ms] [--device iphone|desktop]
// --dwell: wait on the briefing this long after the route card is up before submitting (the player who reads it);
//   0 (default) submits at once, the P3 gate's worst case. --device desktop: 1280x800 Chromium, --cpu 1 by default.
// emulated: Playwright iPhone 13 against the local dev server (BUNDLES_DIR=<dir> serves *.bundle.js from a scratch
//   build), CPU throttled --cpu x (default 4, the iPhone method of docs/perf).
// safari: the connected iPhone through safaridriver (W3C WebDriver on SAFARIDRIVER, default http://127.0.0.1:4471;
//   device IPHONE_UDID). --base is the page it opens (default the deployed /ride).
// Same flow as the integrator's real-device probe: wait for the route card, car + chase, submit at once. The phases
// come from wrapping the load steps game-route.js awaits and from a per-frame poll (loading progress steps, first
// own-ground cell, first resident building tile, the settle hold's outcome); `introStart` is when racing begins
// (the start flight, #150) and `racing` when the flight has landed.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/time-to-ride-device.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const profile = argv.includes('--profile');
const device = opt('device', 'iphone'), dwell = Number(opt('dwell', '0'));
const target = opt('target', 'emulated'), runs = Number(opt('runs', '3')), qs = opt('qs', '?engine=own'), cpu = Number(opt('cpu', device === 'desktop' ? '1' : '4'));
const base = opt('base', target === 'safari' ? 'https://canalrecall-blackmad.web.app/ride' : `http://127.0.0.1:${process.env.PORT || 4543}/canal-drive/`);

// Installed once the route card is up, before submit. Everything is page-clock ms; the runner subtracts submit.
const INSTRUMENT = `(() => {
  const T = window.__ttr = { spans: [], firsts: {}, progress: [] };
  const g = window.canalRecallGame;
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
  wrap(g.osmLoader, 'fetchRoads', 'fetchRoads');
  wrap(g.osmLoader, 'buildRoadSegmentsAsync', 'buildRoadSegments');
  wrap(g, '_loadLandmarks', 'loadLandmarks');
  // RoadNetwork is a classic-script class: a global binding, not a window property.
  const RN = typeof RoadNetwork !== 'undefined' ? RoadNetwork : window.RoadNetwork;
  wrap(RN, 'prepareRoutingGraph', 'routingGraph');
  wrap(RN, 'prepareSurfaceIndex', 'surfaceIndex');
  wrap(RN && RN.prototype, 'planRoute', 'planRoute');
  wrap(g.renderer, 'preRenderTrack', 'preRenderTrack');
  wrap(g, '_setupRace', 'setupRace');
  wrap(g, '_waitForMapSettle', 'settleHold');
  wrap(g, '_prepareIntro', 'prepareIntro');
  const first = (k, ok) => { if (T.firsts[k] == null && ok) T.firsts[k] = performance.now(); };
  let frame = 0;
  const poll = () => {
    const vm = g.vectorMap;
    if (T.lastProgress !== g.loadingProgress) { T.lastProgress = g.loadingProgress; T.progress.push([g.loadingProgress, performance.now()]); }
    if (T.firsts.groundCell == null && ++frame % 10 === 0) first('groundCell', (() => { try { const gr = vm && vm._ownGround; if (!gr) return false; const st = gr.status && gr.status(); return !!(gr.ready && ((st && (st.built > 0 || Object.keys(st.cells || {}).length > 0)) || (gr.resident && gr.resident.size > 0))); } catch (_) { return false; } })());
    try { first('buildingTile', [...((vm && vm._completeCity && vm._completeCity.tileTimes && vm._completeCity.tileTimes.values()) || [])].some(t => t.resident != null)); } catch (_) {}
    try { first('facadeChunk', !!(vm && vm._threeBuildings && [...vm._threeBuildings.chunks.values()].some(c => c.mesh))); } catch (_) {}
    first('introStart', g.state === 4); if (g.state === 4 && !T.mode) T.mode = g.travelMode;
    first('racing', g.state === 4 && ((g.camera && g.camera.introOverview) || 0) === 0);
    if (g._lastMapSettle) (T.settles = T.settles || []).includes(g._lastMapSettle) || T.settles.push(g._lastMapSettle);
    if (T.firsts.racing == null) requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
  // The briefing's city-world build (game-route.js _prepareCityWorld): which one, and when it finished (negative:
  // before submit). The ride joins it at submit if it has not.
  const watchPrep = () => { const p = g._cityWorldPrep; if (p && !T.prepKey) { T.prepKey = p.key; p.promise.then(() => { T.prepDone = performance.now(); }, () => { T.prepFailed = true; }); } };
  watchPrep();
  window.__ttrSubmit = () => { T.submit = performance.now(); document.querySelector('#route-card').requestSubmit(); setTimeout(watchPrep, 0); };
})();`;

function summarise(T) {
  const rel = v => (v == null ? null : Math.round(v - T.submit));
  return {
    mode: T.mode || null, prep: T.prepKey ? { key: T.prepKey, doneMs: rel(T.prepDone), failed: !!T.prepFailed } : null,
    firsts: Object.fromEntries(Object.entries(T.firsts).map(([k, v]) => [k, rel(v)])),
    progress: T.progress.map(([p, t]) => [p, rel(t)]),
    spans: T.spans.map(s => ({ k: s.k, startMs: rel(s.t0), ms: s.t1 != null ? Math.round(s.t1 - s.t0) : null })),
    settles: (T.settles || []).map(s => ({ ms: s.ms, timedOut: s.timedOut, pending: s.pending })),
  };
}

async function emulated() {
  const { chromium, devices } = await import('playwright');
  const browser = await chromium.launch();
  const results = [];
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext(device === 'desktop' ? { viewport: { width: 1280, height: 800 } } : { ...devices['iPhone 13'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' || /City world build failed/.test(m.text())) errors.push(m.text().slice(0, 200)); });
    if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
      return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
    await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
    const cdp = await context.newCDPSession(page);
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const t0 = Date.now();
    await page.goto(base + qs);
    await page.waitForFunction(() => window.canalRecallGame && document.querySelector('#route-card') && window.canalRecallGame.osmLoader, null, { timeout: 180_000 });
    const readyMs = Date.now() - t0;
    // Bike ride, chase view, picked as the player picks them: through the briefing's preferences store (the legacy
    // selects remain for older builds; the runtime applies the store's picks at submit).
    await page.evaluate(() => {
      const g = window.canalRecallGame, store = g._overlay && g._overlay.store;
      if (store && store.patchPrefs) store.patchPrefs({ travelMode: 'car', viewMode: 'chase' }, g._overlayZoom ? g._overlayZoom() : undefined);
      for (const [id, v] of [['travel-mode', 'car'], ['view-mode', 'chase']]) { const s = document.getElementById(id); if (s) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); } }
    });
    if (dwell) await page.waitForTimeout(dwell);
    await page.evaluate(INSTRUMENT);
    // --profile: self time by function from submit to the start of racing (the CDP profiler's start stall lands
    // before submit: it starts 2 s earlier).
    if (profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); await page.waitForTimeout(2000); }
    await page.evaluate(() => window.__ttrSubmit());
    await page.waitForFunction(() => window.__ttr.firsts.racing != null, null, { timeout: 180_000, polling: 200 });
    const T = await page.evaluate(() => window.__ttr);
    const r = { readyMs, errors, ...summarise(T) };
    if (profile) {
      const { profile: prof } = await cdp.send('Profiler.stop');
      const now = await page.evaluate(() => performance.now());
      const offset = now - prof.endTime / 1000, byId = new Map(prof.nodes.map(n => [n.id, n]));
      const windows = { ride: [T.submit, T.firsts.introStart], roads: [(T.progress.find(([p]) => p === 0.8) || [])[1], (T.progress.find(([p]) => p === 0.92) || [])[1]] };
      r.profile = {};
      for (const [name, [from, to]] of Object.entries(windows)) {
        if (from == null || to == null) continue;
        const self = new Map(); let t = prof.startTime / 1000 + offset;
        prof.samples.forEach((id, i) => {
          t += (prof.timeDeltas[i] || 0) / 1000; if (t < from || t > to) return;
          const f = byId.get(id).callFrame, key = `${f.functionName || '(anon)'} ${f.url ? f.url.split('/').pop().split('?')[0] : ''}:${f.lineNumber + 1}`;
          self.set(key, (self.get(key) || 0) + (prof.timeDeltas[i + 1] || 0) / 1000);
        });
        r.profile[name] = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, ms]) => ({ k, ms: Math.round(ms) }));
      }
    }
    results.push(r);
    await context.close();
  }
  await browser.close();
  return results;
}

async function safari() {
  const driver = process.env.SAFARIDRIVER || 'http://127.0.0.1:4471';
  const call = async (method, p, body) => {
    const r = await fetch(driver + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json(); if (j.value && j.value.error) throw new Error(`${p}: ${j.value.error} ${j.value.message}`); return j.value;
  };
  const results = [];
  for (let i = 0; i < runs; i++) {
    const sess = await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'Safari', platformName: 'iOS', 'safari:deviceUDID': process.env.IPHONE_UDID || '00008140-001E0DA934E2801C' } } });
    const S = `/session/${sess.sessionId}`;
    try {
      await call('POST', `${S}/timeouts`, { script: 180000, pageLoad: 180000 });
      const exec = (script, args = []) => call('POST', `${S}/execute/sync`, { script, args });
      const execAsync = (script, args = []) => call('POST', `${S}/execute/async`, { script, args });
      const sep = qs.startsWith('?') ? '&' : '?';
      const t0 = Date.now();
      await call('POST', `${S}/url`, { url: `${base}${qs}${sep}probe=${Date.now()}` });
      await execAsync(`const done = arguments[0]; const t = setInterval(() => { if (window.canalRecallGame && document.querySelector('#route-card') && window.canalRecallGame.osmLoader) { clearInterval(t); done(true); } }, 100);`);
      const readyMs = Date.now() - t0;
      await exec(`for (const [id, v] of [['travel-mode','car'],['view-mode','chase']]) { const s = document.getElementById(id); if (s) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); } }`);
      if (dwell) await new Promise(r => setTimeout(r, dwell));
      await exec(INSTRUMENT);
      await exec('window.__ttrSubmit();');
      await execAsync(`const done = arguments[0]; const t = setInterval(() => { if (window.__ttr.firsts.racing != null) { clearInterval(t); done(true); } }, 200); setTimeout(() => { clearInterval(t); done(false); }, 170000);`);
      const T = await exec('return JSON.parse(JSON.stringify(window.__ttr));');
      const ua = await exec('return navigator.userAgent.slice(0, 60) + " dpr " + devicePixelRatio;');
      results.push({ readyMs, ua, ...summarise(T) });
    } finally { await call('DELETE', S).catch(() => {}); }
  }
  return results;
}

const results = target === 'safari' ? await safari() : await emulated();
for (const [i, r] of results.entries()) {
  const f = r.firsts, span = k => r.spans.filter(s => s.k === k);
  const s1 = k => { const s = span(k)[0]; return s ? `${s.startMs}+${s.ms}` : '-'; };
  if (r.errors?.length) console.log(`run ${i + 1} errors: ${r.errors.slice(0, 5).join(' | ')}`);
  console.log(`run ${i + 1}: ready ${r.readyMs} ms; submit -> introStart ${f.introStart} ms, racing (landed) ${f.racing} ms; mode ${r.mode}, briefing build ${r.prep ? `${r.prep.key} done ${r.prep.doneMs} ms${r.prep.failed ? ' FAILED' : ''}` : 'none'}`);
  console.log(`  fetchRoads ${s1('fetchRoads')}  buildRoadSegments ${s1('buildRoadSegments')}  loadLandmarks ${s1('loadLandmarks')}  routingGraph ${s1('routingGraph')}  surfaceIndex ${s1('surfaceIndex')}  planRoute ${s1('planRoute')}  preRenderTrack ${s1('preRenderTrack')}  setupRace ${s1('setupRace')}`);
  console.log(`  settle holds ${span('settleHold').map(s => `${s.startMs}+${s.ms}`).join(', ')} (${r.settles.map(s => `${s.ms}${s.timedOut ? ' timed out' : ''} [${(s.pending || []).join(',')}]`).join('; ')}); prepareIntro ${s1('prepareIntro')}`);
  console.log(`  first ground cell ${f.groundCell}, building tile ${f.buildingTile}, facade chunk ${f.facadeChunk}; progress ${r.progress.map(([p, t]) => `${p}@${t}`).join(' ')}`);
}
for (const [i, r] of results.entries()) if (r.profile?.roads) console.log(`run ${i + 1} roads window (progress 0.8 -> 0.92) self ms: ${r.profile.roads.slice(0, 10).map(x => `${x.k} ${x.ms}`).join('; ')}`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), target, device, dwell, base, qs, cpu: target === 'emulated' ? cpu : null, results }, null, 2));
console.log(`wrote ${out}`);
