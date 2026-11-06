// Rail beds at the user's pose (lane R3-C #232): frames of a crisp spot (scripts/look/crispSpots.ts) reached the way
// the user reached S4, the rider at the Amstel by the Weesperbuurt and the camera panned off it to the spot (RE-CENTER
// showing), per variant (a query and a bundles dir), desktop at the user's 1288x715 CSS px and DPR 2, or iPhone 13.
//   PORT=4647 node scripts/own-ground/rail-beds-strip.mjs <outdir> <spot[,spot]> <desktop|iphone> \
//     'main=groundView=0&railRetry=0&groundRequeue=0&overviewRail=0&farRailDrape=0@<bundlesDir>;after=@<bundlesDir>'
// Writes <outdir>/<device>-<spot>-<variant>.png (the page, HUD included, as the user's screenshot) and
// <outdir>/<device>-frames.json (GPU and wall ms of forced frames once settled, and the ground's status).
// Browser runs go through /tmp/canal-pw.sh.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { CRISP_SPOTS } from '../look/crispSpots.ts';

const [out = 'artifacts/rail-beds-strip', spotArg = 's4-zuidas-user', device = 'desktop', variantArg = 'after=@'] = process.argv.slice(2);
const USER_RIDER = [4.9040, 52.3605];
const MODE = process.env.STRIP_MODE ?? 'panned';
// POSE='lng,lat,zoom,bearing,pitch' overrides the (single) spot's pose: matching a pose to the user's shot.
const pose = process.env.POSE?.split(',').map(Number);
// The rail-shots.mjs spots crispSpots.ts does not carry (chase pose, for the frame-time table).
const RAIL_SHOT_SPOTS = [
  { name: 'centraal-approach', center: [4.9075, 52.3782], zoom: 17.5, bearing: 260, pitch: null },
  { name: 'muiderpoort', center: [4.9300, 52.3598], zoom: 17.5, bearing: 20, pitch: null },
  { name: 'amstel', center: [4.9185, 52.3455], zoom: 17.5, bearing: 330, pitch: null },
];
const spots = spotArg.split(',').map(n => [...CRISP_SPOTS, ...RAIL_SHOT_SPOTS].find(s => s.name === n) ?? (() => { throw new Error(`unknown spot ${n}`); })())
  .map(s => pose ? { ...s, center: [pose[0], pose[1]], zoom: pose[2], bearing: pose[3], pitch: pose[4] } : s);
const variants = variantArg.split(';').filter(Boolean).map(v => { const [name, rest] = v.split('='); const at = (rest ?? '').lastIndexOf('@'); return { name, query: at >= 0 ? rest.slice(0, at) : rest, bundles: at >= 0 ? rest.slice(at + 1) : '' }; });
const ctxOpts = device === 'iphone' ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1288, height: 715 }, deviceScaleFactor: 2 };
fs.mkdirSync(out, { recursive: true });
const framesFile = `${out}/${device}-frames.json`;
const frames = fs.existsSync(framesFile) ? JSON.parse(fs.readFileSync(framesFile, 'utf8')) : {};
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });

async function settle(page, ms = 60000) {
  const start = Date.now(); let stable = 0, previous = '';
  while (Date.now() - start < ms) {
    const now = await page.evaluate(() => {
      const vm = window.canalRecallGame.vectorMap, g = vm._ownGround; vm.host?.triggerRepaint?.();
      if (!g) return 'none';
      const s = g.status(), fading = [...(g.resident?.values?.() ?? [])].filter(r => r.fade).length;
      const tb = vm._threeBuildings, city = vm._completeCity?.status?.();
      const busy = !s.ready || !s.workerReady || Object.keys(s.pending).length || s.queued || fading || s.far.pending || city?.inFlight || city?.queued || tb?.pending?.length;
      return busy ? 'busy' : JSON.stringify(s.cells);
    });
    stable = now !== 'busy' && now === previous ? stable + 1 : 0; previous = now;
    if (stable >= 3) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

for (const v of variants) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__canalRecallEngine = 'own'; let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  if (v.bundles) await ctx.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(v.bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : route.continue();
  });
  await ctx.route(/3dbag|cesium3dtiles/i, route => route.abort());
  for (const spot of spots) {
    const q = ['governor=0', `chasePitch=${spot.pitch ?? 60}`, v.query].filter(Boolean).join('&');
    await page.goto(`http://127.0.0.1:${process.env.PORT || 4647}/canal-drive/?${q}`);
    await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 120000 });
    await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
    await page.locator('#route-card').evaluate(f => f.requestSubmit());
    await page.waitForFunction(() => window.canalRecallGame.player?.x && window.canalRecallGame.camera.introOverview === 0 && window.canalRecallGame.vectorMap?._ownGround?.ready, null, { timeout: 180000 });
    await page.evaluate(() => { const g = window.canalRecallGame; g.state = 4; });
    const place = (lngLat, bearing) => page.evaluate(({ lngLat, bearing }) => {
      const g = window.canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
      g.player.x = l._lastOffsetX + (lngLat[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      g.player.y = l._lastOffsetY - (lngLat[1] - l._lastCenterLat) * 111320 * ppm;
      g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 }); g.player.handleInput = () => {};
      g.camera.resetPan?.();
    }, { lngLat, bearing });
    const zoomTo = async zoom => { for (let i = 0; i < 5; i++) { const now = await page.evaluate(() => window.canalRecallGame.vectorMap._ownGround?.zoom ?? null); if (now == null || Math.abs(now - zoom) < 0.03) return; await page.evaluate(d => { const c = window.canalRecallGame.camera; c.zoom = Math.max(c.minZoom, Math.min(c.maxZoom, c.zoom * 2 ** d)); }, zoom - now); await page.waitForTimeout(600); } };
    if (MODE === 'rider') { await place(spot.center, spot.bearing); await page.waitForTimeout(800); await zoomTo(spot.zoom); }
    else {
      await place(USER_RIDER, spot.bearing); await page.waitForTimeout(800); await settle(page, 30000); await zoomTo(spot.zoom);
      await page.evaluate(({ lngLat, bearing }) => {
        const g = window.canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), c = g.camera;
        c.pan(0, 0);
        c.anchorX = l._lastOffsetX + (lngLat[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
        c.anchorY = l._lastOffsetY - (lngLat[1] - l._lastCenterLat) * 111320 * ppm;
        c.rotation = bearing * Math.PI / 180;
      }, { lngLat: spot.center, bearing: spot.bearing });
    }
    await page.waitForTimeout(1500);
    const settled = await settle(page);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/${device}-${spot.name}-${v.name}.png` });
    // Forced frames (the host draws only when dirty): GPU ms by EXT_disjoint_timer_query_webgl2, wall ms with a finish
    // (crisp-textures.spec.ts frameMs), medians after 4 warm-up frames.
    const f = await page.evaluate(async n => {
      const host = window.canalRecallGame.vectorMap.host, gl = host.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const gpu = [], wall = [], pending = [], px = new Uint8Array(4), render = host._render.bind(host);
      for (let i = 0; i < n; i++) {
        host.dirty = true; const q = ext ? gl.createQuery() : null, t0 = performance.now();
        if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        render();
        if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); }
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); wall.push(performance.now() - t0);
        await new Promise(r => requestAnimationFrame(r));
      }
      for (let k = 0; k < 60 && pending.length; k++) {
        while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) { const q = pending.shift(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); }
        await new Promise(r => requestAnimationFrame(r));
      }
      const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
      return { n, gpuMs: gpu.length ? med(gpu.slice(4)) : null, wallMs: med(wall.slice(4)) };
    }, Number(process.env.FRAMES ?? 30));
    const state = await page.evaluate(() => { const g = window.canalRecallGame.vectorMap._ownGround, s = g.status(); return { zoom: s.zoom, radiusM: s.radiusM, cells: Object.keys(s.cells).length, far: s.far, rail: s.rail, errors: s.errors, detached: window.canalRecallGame.camera.detached }; });
    frames[`${spot.name}:${v.name}`] = { settled, ...Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x == null ? null : Math.round(x * 100) / 100])), ...state };
    console.log(device, spot.name, v.name, JSON.stringify(frames[`${spot.name}:${v.name}`]).slice(0, 400));
  }
  await ctx.close();
}
fs.writeFileSync(framesFile, JSON.stringify(frames, null, 1));
await browser.close();
