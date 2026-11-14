// Feedback triage: ride frames at a note's view (the view centre, the bearing read off the note's minimap, the note's
// chase zoom), plus the building under the note's anchor, picked the way a tap picks it (vectorMap.inspectBuilding).
// Lane blank-walls-20261114 (notes 21dc1e32, 174d2455, 9aa8d03b).
//   PW_PORT=4441 node scripts/feedback/pose-pick-shots.mjs <outdir> <tag> --pose name:lng,lat,bearingDeg,zoom[,ax,ay]
//     [--pose ...] [--qs 'x=0'] [--mobile] [--settle s] [--pick x,y]   (extra picks, viewport fractions)
// A pose's lng,lat is the note's context.mapCenter (the chase camera's centre); bearing is degrees clockwise from north
// (game angle = (bearing - 90)°); ax,ay the note's target.anchor (viewport fractions). Writes
// <outdir>/<device>-<pose>-<tag>.jpg and prints the pick as JSON.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [outDir, tag] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const mobile = process.argv.includes('--mobile'), qs = opt('qs', '');
const settle = Number(opt('settle', '5')) * 1000;
const poses = process.argv.flatMap((a, i) => (a === '--pose' ? [process.argv[i + 1]] : [])).map(spec => {
  const [name, rest] = spec.split(':'); const [lng, lat, bearing, zoom, ax = 0.5, ay = 0.5, rdx, rdy] = rest.split(',').map(Number);
  // rdx,rdy (game px, the note's context.player minus context.camera): a detached camera, the rider that far away.
  return { name, at: [lng, lat], bearing, angle: (bearing - 90) * Math.PI / 180, zoom, anchor: [ax, ay], rider: Number.isFinite(rdx) ? [rdx, rdy] : null };
});
const extraPicks = (opt('pick', '') || '').split(';').filter(Boolean).map(s => s.split(',').map(Number));
const ctxOpts = mobile ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1326, height: 761 }, deviceScaleFactor: 1 };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext(ctxOpts);
await context.route(/ingest\.(us\.)?sentry\.io/, r => r.fulfill({ status: 200, body: '{}' }));
// --model <published file name>=<local glb> (repeatable): serve a staged GLB in place of the installed one (an after frame
// before the integrator installs it), e.g. recipe-large-x.glb=artifacts/building-recipes/x/model.glb.
for (const spec of process.argv.flatMap((a, i) => (a === '--model' ? [process.argv[i + 1]] : []))) {
  const [name, file] = spec.split('=');
  await context.route(new RegExp(`/models/(?:.*/)?${name.replace(/[.]/g, '\\.')}(\\?|$)`), r => r.fulfill({ path: file, contentType: 'model/gltf-binary' }));
}
await context.addInitScript(() => { try { const k = 'canalRecall.preferences.v1', p = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...p, travelMode: 'car' })); } catch { /* storage off */ } });
await context.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const page = await context.newPage();
page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
await page.goto(`http://127.0.0.1:${process.env.PW_PORT || 4441}/canal-drive/?engine=own&ride=free${qs ? `&${qs}` : ''}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 240_000 });
await page.evaluate(() => { const g = canalRecallGame; g.camera.viewMode = 'chase'; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
fs.mkdirSync(outDir, { recursive: true });
const device = mobile ? 'phone' : 'desktop';
for (const p of poses) {
  const place = () => page.evaluate(({ at, angle, zoom, rider, bearing }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera;
    const w = l.latLngToWorld?.(at[1], at[0]);
    const cx = w ? w.x : l._lastOffsetX + (at[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    const cy = w ? w.y : l._lastOffsetY - (at[1] - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = angle; g.player.x = cx; g.player.y = cy;
    const lead = cam.followPosition(g.player);
    g.player.x = cx - (lead.x - cx); g.player.y = cy - (lead.y - cy);
    cam.zoom = zoom; cam.resetForRide(g.player);
    if (rider) { g.player.x = cx + rider[0]; g.player.y = cy + rider[1]; cam.detached = true; cam.x = cam.anchorX = cx; cam.y = cam.anchorY = cy; cam.rotation = bearing * Math.PI / 180; }
    return [l._lastCenterLng, l._lastCenterLat, l._lastOffsetX, l._lastOffsetY];
  }, p);
  let frame = await place();
  for (let r = 0; r < 4; r++) {
    await page.waitForTimeout(3000);
    const now = await page.evaluate(() => { const l = canalRecallGame.osmLoader; return [l._lastCenterLng, l._lastCenterLat, l._lastOffsetX, l._lastOffsetY]; });
    if (now.every((v, i) => v === frame[i])) break;
    frame = await place();
  }
  await page.waitForFunction(() => { const v = canalRecallGame.vectorMap; const s = v.worldSettled?.(); return !s || (s.settled !== false); }, null, { timeout: 90_000, polling: 250 }).catch(() => {});
  await page.waitForTimeout(settle);
  await page.evaluate(({ z, b, d }) => { const c = canalRecallGame.camera; c.zoom = z; if (d) c.rotation = b * Math.PI / 180; }, { z: p.zoom, b: p.bearing, d: !!p.rider });
  await page.waitForTimeout(1500);
  const file = path.join(outDir, `${device}-${p.name}-${tag}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
  const picks = await page.evaluate(anchors => {
    const v = canalRecallGame.vectorMap, canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect();
    return anchors.map(([ax, ay]) => {
      const hit = v.inspectBuilding?.(ax * rect.width, ay * rect.height, rect);
      return { at: [ax, ay], hit: hit ? JSON.parse(JSON.stringify(hit, (k, val) => (typeof val === 'object' && val && val.isObject3D ? undefined : val))) : null };
    });
  }, [p.anchor, ...extraPicks]);
  const view = await page.evaluate(ids => {
    const v = canalRecallGame.vectorMap, cam = v.camera, sig = v._signatureLandmarks;
    const c = cam?.center?.();
    return { zoom: cam?.zoom?.(), pitch: cam?.pitch?.(), bearing: cam?.bearing?.(), centre: c && [c.lng, c.lat],
      levels: Object.fromEntries((sig?._entries || []).filter(e => ids.includes(e.spec.id)).map(e => [e.spec.id, e.level])) };
  }, (opt('levels', '') || '').split(','));
  const short = picks.map(p => ({ at: p.at, id: p.hit?.id, landmarkId: p.hit?.landmarkId, name: (p.hit?.name || '').slice(0, 80), source: p.hit?.featureTarget?.source, height: p.hit?.height }));
  console.log(file, JSON.stringify(short), JSON.stringify(view));
}
await browser.close();
