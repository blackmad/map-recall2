// Aerial power (lane R5-F, #266): "my computer's fan is going wild" while panning from the air. GPU time per frame and
// per second at the user's aerial poses, still and panning, from EXT_disjoint_timer_query_webgl2 around the frame host's
// draw (`_render`), split at the sun's shadow-map pass (three's WebGLShadowMap.render). Per pose and per lever config:
//   pan   — the detached camera swept back and forth along a 700 m line through the pose at --speed m/s (the first
//           --warm s are not recorded, so the line's content is resident), then --panS s recorded;
//   still — the camera stopped: --stillS s of natural frames (render-on-change: few), then --forced redraws one per
//           animation frame (the still frame's cost) and a screenshot (the still frame at 1×).
// A screenshot mid-pan is the moving frame at 1×. Levers are switched at runtime through `vm._aerialPower.levers`
// (engine/aerialPower.ts) when the build has them; on a build without them only `base` runs.
//
//   PORT=4686 node scripts/aerial-power.mjs <out.json> [--configs base,fps,scale,shadows,mapsize,shadowall,all]
//     [--poses fan,nieuwmarkt,singelgracht,sciencepark] [--speed 150] [--panS 8] [--warm 5] [--qs '...'] [--device desktop|iphone]
// SHOTS=<dir> saves the still and moving frames per pose and config. BUNDLES_DIR as aerial-pan.mjs.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/aerial-power.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const device = opt('device', 'desktop');
const speed = Number(opt('speed', '150'));
const panS = Number(opt('panS', '8'));
const warmS = Number(opt('warm', '5'));
const stillS = Number(opt('stillS', '3'));
const forced = Number(opt('forced', '24'));
const configs = opt('configs', 'base').split(',');
const extraQs = opt('qs', '');
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4686}`;
const shotsDir = process.env.SHOTS || '';

// The user's aerial poses of 2026-11-08 (R5-A's AERIAL_USER_SPOTS, scripts/world/abSpots.ts on its branch; the fan
// pose U5 fitted by eye here: Frederik Hendrikbuurt, Eerste Hugo de Grootstraat, looking ESE to the Singelgracht).
const POSES = {
  fan: { centre: [4.8770, 52.3800], zoom: 17.3, pitch: 55, bearing: 110 },
  nieuwmarkt: { centre: [4.9024, 52.3705], zoom: 17.4, pitch: 55, bearing: 280 },
  singelgracht: { centre: [4.8840, 52.3606], zoom: 17.3, pitch: 55, bearing: 300 },
  sciencepark: { centre: [4.9580, 52.3570], zoom: 15.9, pitch: 60, bearing: 20 },
};
const poseNames = opt('poses', Object.keys(POSES).join(',')).split(',');
// Lever sets (engine/aerialPower.ts AerialLevers); `base` is every lever off (today's main).
const OFF = { fps: false, scale: false, shadows: false, mapSize: false };
const CONFIGS = {
  base: OFF,
  fps: { ...OFF, fps: true },
  scale: { ...OFF, scale: true },
  shadows: { ...OFF, shadows: true },
  mapsize: { ...OFF, mapSize: true },
  shadowall: { ...OFF, shadows: true, mapSize: true },
  all: { fps: true, scale: true, shadows: true, mapSize: true },
};

const browser = await chromium.launch({
  headless: false,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl-draft-extensions'],
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const [vw, vh] = (process.env.VIEWPORT || '1512x982').split('x').map(Number);
const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
if (process.env.BUNDLES_DIR) await context.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
  const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : route.continue();
});
await context.route(/ingest\.(us\.)?sentry\.io/, route => route.fulfill({ status: 200, body: '{}' }));
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const qs = `?ride=free&engine=own${extraQs ? `&${extraQs.replace(/^\?/, '')}` : ''}`;
await page.goto(`${origin}/canal-drive/${qs}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 180_000 });
await page.evaluate(() => {
  const g = canalRecallGame;
  g.camera.viewMode = 'chase';
  g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };
});
await page.evaluate(async () => { const cam = canalRecallGame.vectorMap.camera; await Promise.race([cam?.whenIdle?.() ?? Promise.resolve(), new Promise(r => setTimeout(r, 60_000))]); });

// The GPU timer: TIME_ELAPSED queries in sequence (they cannot nest): [frame start .. shadow pass), [shadow pass],
// (shadow pass .. frame end]. Results are read a few frames later; a disjoint frame is dropped.
const timer = await page.evaluate(() => {
  const vm = canalRecallGame.vectorMap, host = vm.host, renderer = host.renderer, gl = renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const T = window.__gpu = { ext: !!ext, frames: [], pending: [], cur: null, recording: false };
  if (!ext) return { ext: false, renderer: gl.getParameter(gl.RENDERER) };
  let active = null;
  const begin = (kind) => { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); active = q; T.cur.q.push([kind, q]); };
  const end = () => { if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); active = null; } };
  const sf = vm._sharedFrame;
  const baseRender = host._render;
  host._render = function () {
    if (!T.recording) return baseRender.call(this);
    const redraws0 = sf?.shadowRedraws ?? 0;
    T.cur = { t: performance.now(), q: [], pr: host.getPixelRatio(), w: host.canvas.width, h: host.canvas.height };
    begin('main');
    const cpu0 = performance.now();
    try { return baseRender.call(this); } finally {
      end();
      T.cur.cpuMs = performance.now() - cpu0;
      T.cur.shadowRedraw = (sf?.shadowRedraws ?? 0) - redraws0;
      T.cur.mapSize = sf?.rig?.sun?.shadow?.mapSize?.x ?? null;
      T.pending.push(T.cur); T.cur = null;
    }
  };
  const sm = renderer.shadowMap, smRender = sm.render.bind(sm);
  // Who draws into the shadow map: draws and triangles per owner (building chunk kind by key prefix, else the first
  // named ancestor), summed over the recorded shadow passes.
  T.casters = {}; T.casterPasses = 0;
  let inShadow = false, kindOf = null;
  const ownerOf = o => {
    for (let p = o; p; p = p.parent) { const k = kindOf.get(p); if (k) return k; }
    for (let p = o; p; p = p.parent) if (p.name) return p.name.replace(/[-_:]?\d[\w.-]*$/, '#');
    return o.type;
  };
  const rbd = renderer.renderBufferDirect.bind(renderer);
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    if (inShadow) {
      const k = ownerOf(object), c = T.casters[k] ??= { draws: 0, tris: 0 };
      const n = geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0;
      c.draws++; c.tris += Math.min(n, geometry.drawRange.count) / 3 * (object.isInstancedMesh ? object.count : 1);
    }
    return rbd(camera, scene, geometry, material, object, group);
  };
  sm.render = function (...a) {
    if (!T.cur || !sm.needsUpdate && !sm.autoUpdate) return smRender(...a);
    kindOf = new Map();
    for (const [key, entry] of vm._threeBuildings?.chunks ?? []) if (entry?.mesh) kindOf.set(entry.mesh, `buildings ${key.includes(':') ? key.slice(0, key.indexOf(':')) : 'walls'}`);
    end(); begin('shadow'); inShadow = true; T.casterPasses++;
    try { return smRender(...a); } finally { inShadow = false; end(); begin('main'); }
  };
  const poll = () => {
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (T.pending.length) {
      const f = T.pending[0];
      if (!f.q.every(([, q]) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) break;
      T.pending.shift();
      let main = 0, shadow = 0;
      for (const [kind, q] of f.q) { const ns = gl.getQueryParameter(q, gl.QUERY_RESULT); if (kind === 'shadow') shadow += ns; else main += ns; gl.deleteQuery(q); }
      if (!disjoint) T.frames.push({ t: f.t, gpuMs: (main + shadow) / 1e6, shadowMs: shadow / 1e6, cpuMs: f.cpuMs, pr: f.pr, w: f.w, h: f.h, shadowRedraw: f.shadowRedraw, mapSize: f.mapSize });
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
  return { ext: true, renderer: (() => { const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); })(), msaa: gl.getContextAttributes().antialias, samples: gl.getParameter(gl.SAMPLES) };
});
console.log('timer', JSON.stringify(timer));
if (!timer.ext) { console.error('no EXT_disjoint_timer_query_webgl2'); }
const hasLevers = await page.evaluate(() => !!canalRecallGame.vectorMap._aerialPower?.levers);
console.log('levers in build:', hasLevers);

// Put the detached camera at a pose: centre (lng, lat), map zoom and pitch, bearing. The game camera's zoom is a scale
// (calibrated against the view's map zoom); the chase pitch comes from the tilt (CanalRecallPreferences.chasePitch).
async function goPose(p) {
  await page.evaluate(async sp => {
    window.__panStop = true;
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, vm = g.vectorMap;
    const x = l._lastOffsetX + (sp.centre[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y = l._lastOffsetY - (sp.centre[1] - l._lastCenterLat) * 111320 * ppm;
    const prefs = window.CanalRecallPreferences;
    let tilt = 0, best = Infinity;
    for (let t = -36; t <= 36; t += 0.5) { const d = Math.abs(prefs.chasePitch(t) - sp.pitch); if (d < best) { best = d; tilt = t; } }
    cam.pan(1, 0); cam.detached = true; cam.anchorX = cam.x = x; cam.anchorY = cam.y = y; cam.rotation = sp.bearing * Math.PI / 180;
    vm.setCameraTilt(tilt); vm._cameraTilt = tilt;
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let i = 0; i < 4; i++) { await frame(); await frame(); const z = vm.camera.zoom(); cam.zoom *= 2 ** (sp.zoom - z); }
    window.__pose = { x, y, tilt };
  }, p);
  await page.waitForTimeout(1500);
  await page.evaluate(async () => { const cam = canalRecallGame.vectorMap.camera; await Promise.race([cam?.whenIdle?.() ?? Promise.resolve(), new Promise(r => setTimeout(r, 45_000))]); });
  return page.evaluate(() => { const vm = canalRecallGame.vectorMap, c = vm.camera.center(); return { zoom: +vm.camera.zoom().toFixed(2), pitch: +vm.camera.pitch().toFixed(1), bearing: +vm.camera.bearing().toFixed(0), centre: [+c.lng.toFixed(4), +c.lat.toFixed(4)] }; });
}
// Back and forth along a 700 m line through the pose, across the view direction.
async function startPan(bearingDeg) {
  await page.evaluate(([v, b]) => {
    const g = canalRecallGame, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, P = window.__pose;
    window.__panStop = false;
    const r = (b + 90) * Math.PI / 180, ux = Math.sin(r), uy = -Math.cos(r), half = 350 * ppm;
    let s = 0, dir = 1, last = performance.now();
    const step = now => {
      if (window.__panStop) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      s += dir * v * ppm * dt; if (s > half) { s = half; dir = -1; } if (s < -half) { s = -half; dir = 1; }
      cam.detached = true; cam.anchorX = P.x + ux * s; cam.anchorY = P.y + uy * s;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [speed, bearingDeg]);
}
const setLevers = levers => page.evaluate(lv => { const ap = canalRecallGame.vectorMap._aerialPower; if (ap?.levers) Object.assign(ap.levers, lv); }, levers);
const record = on => page.evaluate(v => { window.__gpu.recording = v; if (v) { window.__gpu.frames = []; window.__gpu.casters = {}; window.__gpu.casterPasses = 0; } }, on);
const drain = async () => { await page.waitForTimeout(300); return page.evaluate(() => { const f = window.__gpu.frames; window.__gpu.frames = []; return f; }); };
const casters = () => page.evaluate(() => {
  const T = window.__gpu, n = Math.max(1, T.casterPasses);
  return { passes: T.casterPasses, perPass: Object.fromEntries(Object.entries(T.casters).sort((a, b) => b[1].tris - a[1].tris).slice(0, 12).map(([k, c]) => [k, { draws: Math.round(c.draws / n), ktris: Math.round(c.tris / n / 1000) }])) };
});
const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : null; };
const sum = v => v.reduce((a, b) => a + b, 0);
function summarise(frames, seconds) {
  const gpu = frames.map(f => f.gpuMs), sh = frames.map(f => f.shadowMs);
  return {
    frames: frames.length, fps: +(frames.length / seconds).toFixed(1),
    gpuMsPerFrame: { p50: q(gpu, 0.5), p90: q(gpu, 0.9), mean: frames.length ? +(sum(gpu) / frames.length).toFixed(2) : null },
    gpuMsPerSecond: +(sum(gpu) / seconds).toFixed(1),
    shadowMsPerSecond: +(sum(sh) / seconds).toFixed(1),
    shadowShare: sum(gpu) ? +(sum(sh) / sum(gpu)).toFixed(3) : null,
    shadowRedraws: frames.filter(f => f.shadowRedraw > 0).length,
    cpuRenderMsP50: q(frames.map(f => f.cpuMs), 0.5),
    pixelRatio: [...new Set(frames.map(f => f.pr))], buffer: [...new Set(frames.map(f => `${f.w}x${f.h}`))], mapSize: [...new Set(frames.map(f => f.mapSize))],
  };
}

const rows = [];
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
for (const name of poseNames) {
  const pose = POSES[name];
  const at = await goPose(pose);
  console.log(`pose ${name}`, JSON.stringify(at));
  for (const cfg of hasLevers ? configs : ['base']) {
    await setLevers(CONFIGS[cfg]);
    await startPan(pose.bearing);
    await page.waitForTimeout(warmS * 1000);
    await record(true);
    const t0 = Date.now();
    await page.waitForTimeout(panS * 1000 / 2);
    const movingShot = shotsDir ? path.join(shotsDir, `${device}-${name}-${cfg}-moving.png`) : null;
    if (movingShot) await page.screenshot({ path: movingShot });
    await page.waitForTimeout(panS * 1000 / 2);
    const panSec = (Date.now() - t0) / 1000;
    await record(false);
    const panCasters = await casters();
    const panFrames = await drain();
    const gov = await page.evaluate(() => { const vm = canalRecallGame.vectorMap, gv = vm._renderGovernor; return { governorPixelRatio: gv?.pixelRatio ?? null, governorShadows: gv?.shadows ?? null, steps: gv?.steps?.length ?? 0, hostPixelRatio: vm.host.getPixelRatio(), aerial: vm._aerialPower?.state ?? null }; });
    // Still: stop, return to the pose, let it settle, then natural frames, then forced redraws.
    await page.evaluate(() => { window.__panStop = true; const P = window.__pose, cam = canalRecallGame.camera; cam.anchorX = P.x; cam.anchorY = P.y; });
    await page.waitForTimeout(1500);
    await record(true);
    await page.waitForTimeout(stillS * 1000);
    await record(false);
    const stillFrames = await drain();
    // Late still: 8 s after the stop, when arrivals and fades have finished; a still frame should not redraw at all.
    await page.waitForTimeout(3500);
    await record(true);
    await page.waitForTimeout(stillS * 1000);
    await record(false);
    const lateFrames = await drain();
    const hostStats = await page.evaluate(() => ({ ...canalRecallGame.vectorMap.host.stats }));
    await record(true);
    const forcedMs = await page.evaluate(async n => { const host = canalRecallGame.vectorMap.host, t = performance.now(); for (let i = 0; i < n; i++) { await new Promise(r => requestAnimationFrame(r)); host.redraw(); } return performance.now() - t; }, forced);
    await record(false);
    const forcedFrames = await drain();
    const stillShot = shotsDir ? path.join(shotsDir, `${device}-${name}-${cfg}-still.png`) : null;
    if (stillShot) await page.screenshot({ path: stillShot });
    const row = { pose: name, cfg, at, pan: summarise(panFrames, panSec), stillNatural: summarise(stillFrames, stillS), stillLate: summarise(lateFrames, stillS), hostStats, stillForced: summarise(forcedFrames, forcedMs / 1000), panCasters, gov, movingShot, stillShot };
    rows.push(row);
    console.log(`${name} ${cfg}: pan ${row.pan.fps} fps, GPU ${row.pan.gpuMsPerFrame.p50} ms/f p50 (p90 ${row.pan.gpuMsPerFrame.p90}), ${row.pan.gpuMsPerSecond} ms/s, shadow ${row.pan.shadowMsPerSecond} ms/s (${row.pan.shadowShare}), redraws ${row.pan.shadowRedraws}/${row.pan.frames}, pr ${row.pan.pixelRatio} | still natural ${row.stillNatural.frames} f ${row.stillNatural.gpuMsPerSecond} ms/s, late ${row.stillLate.frames} f ${row.stillLate.gpuMsPerSecond} ms/s | forced ${row.stillForced.gpuMsPerFrame.p50} ms/f shadow ${row.stillForced.shadowShare} | gov ${JSON.stringify(gov)}`);
    console.log(`  shadow casters per pass: ${JSON.stringify(panCasters)}`);
  }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ device, qs, speed, panS, warmS, timer, configs, rows, errors }, null, 1));
await browser.close();
process.exit(0);
