// Lane rails-uncover (2026-11-10): ride frames at the user's rail feedback poses (0664edc9, 3ddc4cbf, bd03c59a), chase
// view, the rider frozen, plus a forward sequence (the rider stepped along its heading) for the "uncovering" note.
//   PW_PORT=4488 node scripts/own-ground/rail-feedback-shots.mjs <outdir> <tag> [--mobile] [--only a,b] [--qs 'x=0']
//     [--bundles dir]   (serve *.bundle.js from dir: the branch's ground bundles against the committed ones) [--travel car]
// Writes <outdir>/<device>-<pose>-<step>-<tag>.jpg. A pose's `at` is the note's mapCenter (lng, lat: the chase camera's
// centre, which leads the rider by CHASE_LOOKAHEAD) and `angle` the note's context.player.angle (game radians, 0 = east,
// y down: 15.69 is 3.12 mod 2 pi, so the rider faces west).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [outDir, tag] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const mobile = process.argv.includes('--mobile'), only = opt('only', null), qs = opt('qs', ''), bundles = opt('bundles', null);
const settle = Number(opt('settle', '4')) * 1000;
// --zoom z: the chase camera's zoom (default 1.5; a feedback note's context.camera.zoom, e.g. 0.78, frames as the user saw it).
const zoom = Number(opt('zoom', '1.5'));
const POSES = {
  // 0664edc9 "weird uncovering effect on rails": Kimpoweg / Zaanstraat yard, heading 15.69.
  uncover: { at: [4.841442, 52.386195], angle: 15.69, steps: Number(opt('steps', '6')), stepM: Number(opt('step', '15')) },
  // 3ddc4cbf "minor surface issues in rail bridge": Sloterdijkerweg, heading 15.64.
  bridge: { at: [4.850116, 52.388745], angle: 15.64, steps: 1, stepM: 0 },
  // bd03c59a "this all looks very broken height / rails": Radarweg, heading 23.59.
  radarweg: { at: [4.836204, 52.388638], angle: 23.59, steps: 1, stepM: 0 },
};
// --pose name:lng,lat,angle[,steps,stepM]: an extra pose (same conventions), e.g. kranenberg:4.8532,52.3384,-1.5708
for (const spec of process.argv.flatMap((a, i) => (a === '--pose' ? [process.argv[i + 1]] : []))) {
  const [n, rest] = spec.split(':'), [lng, lat, angle, steps = 1, stepM = 0] = rest.split(',').map(Number);
  POSES[n] = { at: [lng, lat], angle, steps, stepM };
}
const ctxOpts = mobile ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext(ctxOpts);
await context.route(/ingest\.(us\.)?sentry\.io/, r => r.fulfill({ status: 200, body: '{}' }));
if (bundles) await context.route(/\/canal-drive\/.*\.bundle\.js/, route => {
  const file = path.join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
// --travel car|boat|transit: the stored travel mode (lane R2-A: the default is boat, and a boat rider is put back on the
// nearest water, ~150 m from a pose on the Zaanstraat; the player notes record car).
if (opt('travel', null)) await context.addInitScript(mode => { try { const k = 'canalRecall.preferences.v1', p = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...p, travelMode: mode })); } catch { /* storage off */ } }, opt('travel', null));
await context.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const page = await context.newPage();
page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
await page.goto(`http://127.0.0.1:${process.env.PW_PORT || 4488}/canal-drive/?engine=own&ride=free${qs ? `&${qs}` : ''}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 240_000 });
await page.evaluate(() => { const g = canalRecallGame; g.camera.viewMode = 'chase'; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
// --js 'code': run in the page after the ride starts (a diagnostic A/B, e.g. a material flag).
if (opt('js', null)) await page.evaluate(opt('js', null));
fs.mkdirSync(outDir, { recursive: true });
const device = mobile ? 'phone' : 'desktop';
for (const [name, p] of Object.entries(POSES)) {
  if (only && !only.split(',').includes(name)) continue;
  for (let k = 0; k < p.steps; k++) {
    // Placed, then placed again until the loader's frame stops moving (lane R2-A: a pose kilometres from the start
    // recentres the loader after the first placement, which moved the Zaanstraat pose ~150 m).
    const place = () => page.evaluate(({ at, angle, d, zoom }) => {
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera;
      // The loader's own projection (lane R2-A: the flat 111320 m/degree estimate drifted ~250 m at the Zaanstraat, 3 km
      // from the loader's centre); the estimate only where the loader has none.
      const w = l.latLngToWorld?.(at[1], at[0]);
      const cx = w ? w.x : l._lastOffsetX + (at[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      const cy = w ? w.y : l._lastOffsetY - (at[1] - l._lastCenterLat) * 111320 * ppm;
      g.player.angle = angle; g.player.x = cx; g.player.y = cy;
      const lead = cam.followPosition(g.player);
      g.player.x = cx - (lead.x - cx) + Math.cos(angle) * d * ppm; g.player.y = cy - (lead.y - cy) + Math.sin(angle) * d * ppm;
      cam.zoom = zoom; cam.resetForRide(g.player);
      const lng = l._lastCenterLng + (g.player.x - l._lastOffsetX) / (111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm), lat = l._lastCenterLat - (g.player.y - l._lastOffsetY) / (111320 * ppm);
      return { rider: [+lng.toFixed(6), +lat.toFixed(6)], leadM: +(Math.hypot(lead.x - cx, lead.y - cy) / ppm).toFixed(1), frame: [l._lastCenterLng, l._lastCenterLat, l._lastOffsetX, l._lastOffsetY] };
    }, { at: p.at, angle: p.angle, d: k * p.stepM, zoom });
    let info = await place();
    for (let r = 0; r < 4; r++) {
      await page.waitForTimeout(3000);
      const frame = await page.evaluate(() => { const l = canalRecallGame.osmLoader; return [l._lastCenterLng, l._lastCenterLat, l._lastOffsetX, l._lastOffsetY]; });
      if (frame.every((v, i) => v === info.frame[i])) break;
      info = await place();
    }
    delete info.frame;
    await page.waitForFunction(() => !canalRecallGame.vectorMap._ownGround?.status().basemapHidden, null, { timeout: 1500, polling: 16 }).catch(() => {});
    await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && s.basemapHidden && !s.queued && !Object.keys(s.pending).length; }, null, { timeout: 90_000, polling: 100 }).catch(() => {});
    await page.waitForTimeout(k === 0 ? settle * 2 : settle);
    await page.evaluate(z => { canalRecallGame.camera.zoom = z; }, zoom);
    await page.waitForTimeout(500);
    // --hide layer,layer: hide the own-ground meshes of those layers (diagnostic: which layer draws a defect).
    if (opt('hide', null)) { await page.evaluate(names => { const set = new Set(names.split(',')); canalRecallGame.vectorMap._ownGround.root.traverse(o => { if (o.isMesh && set.has(o.name)) o.visible = false; }); }, opt('hide', null)); await page.waitForTimeout(500); }
    const file = path.join(outDir, `${device}-${name}-${k}-${tag}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    const ground = await page.evaluate(() => { const s = canalRecallGame.vectorMap._ownGround?.status(); return s ? { cells: s.cells, details: s.details, far: s.far?.partsShown } : null; });
    console.log(file, JSON.stringify(info), process.argv.includes('--status') ? JSON.stringify(ground) : '');
  }
}
await browser.close();
