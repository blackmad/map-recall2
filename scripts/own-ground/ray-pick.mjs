// What mesh draws a pixel (lane fb-ground2-20261120, 3b8ca68b "slight breaks in the bridge road"): a ride frame at a
// note's pose, then a three.js ray through each asked pixel into the shared frame's scene, listing the first hits
// (object name, ground layer, material colour, distance) with the land/street mask's verdict where the hit is ground.
//   PW_PORT=4770 node scripts/own-ground/ray-pick.mjs <out.jpg> --pose lng,lat,bearingDeg,zoom [--qs 'x=0']
//     --ray fx,fy[;fx,fy...]   (viewport fractions)   [--zoomshot fx,fy,wpx]  (a crop around a pixel, 4x)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [out] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const [lng, lat, bearing, zoom] = opt('pose').split(',').map(Number);
const rays = (opt('ray', '') || '').split(';').filter(Boolean).map(s => s.split(',').map(Number));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1326, height: 761 }, deviceScaleFactor: Number(opt('dpr', '2')) });
await context.route(/ingest\.(us\.)?sentry\.io/, r => r.fulfill({ status: 200, body: '{}' }));
await context.addInitScript(() => { try { const k = 'canalRecall.preferences.v1', p = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...p, travelMode: 'car', buildingLook: 'storybook' })); } catch { /* storage off */ } });
await context.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const page = await context.newPage();
page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
const qs = opt('qs', '');
await page.goto(`http://127.0.0.1:${process.env.PW_PORT || 4770}/canal-drive/?engine=own&ride=free${qs ? `&${qs}` : ''}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 240_000 });
await page.evaluate(() => { const g = canalRecallGame; g.camera.viewMode = 'chase'; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
const place = () => page.evaluate(({ at, angle, zoom }) => {
  const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera;
  const w = l.latLngToWorld?.(at[1], at[0]);
  const cx = w ? w.x : l._lastOffsetX + (at[0] - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
  const cy = w ? w.y : l._lastOffsetY - (at[1] - l._lastCenterLat) * 111320 * ppm;
  g.player.angle = angle; g.player.x = cx; g.player.y = cy;
  const lead = cam.followPosition(g.player);
  g.player.x = cx - (lead.x - cx); g.player.y = cy - (lead.y - cy);
  cam.zoom = zoom; cam.resetForRide(g.player);
  return [l._lastCenterLng, l._lastCenterLat, l._lastOffsetX, l._lastOffsetY];
}, { at: [lng, lat], angle: (bearing - 90) * Math.PI / 180, zoom });
let frame = await place();
for (let r = 0; r < 4; r++) {
  await page.waitForTimeout(3000);
  const now = await page.evaluate(() => { const l = canalRecallGame.osmLoader; return [l._lastCenterLng, l._lastCenterLat, l._lastOffsetX, l._lastOffsetY]; });
  if (now.every((v, i) => v === frame[i])) break;
  frame = await place();
}
await page.waitForFunction(() => { const v = canalRecallGame.vectorMap; const s = v.worldSettled?.(); return !s || (s.settled !== false); }, null, { timeout: 90_000, polling: 250 }).catch(() => {});
await page.waitForTimeout(Number(opt('settle', '6')) * 1000);
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
const zs = opt('zoomshot');
if (zs) { const [fx, fy, w] = zs.split(',').map(Number); await page.screenshot({ path: out.replace(/\.jpg$/, '-zoom.png'), clip: { x: fx * 1326 - w / 2, y: fy * 761 - w / 2 * 0.6, width: w, height: w * 0.6 } }); }
const hits = await page.evaluate(rays => {
  const T = window.CanalRecallThree?.THREE, v = canalRecallGame.vectorMap, f = v._sharedFrame;
  if (!T || !f) return { error: `THREE ${!!T} frame ${!!f}` };
  const cam = f.camera, scene = f.scene, rc = new T.Raycaster();
  return rays.map(([fx, fy]) => {
    // The shared frame's camera is a bare THREE.Camera whose projectionMatrix is the whole view-projection (the map's
    // matrix): unproject the pixel's near and far points through its inverse.
    // The own ground draws in its local metres under its clip ← local matrix (gameGround clipFromLocal): unproject with that.
    const og = v._ownGround, inv = new T.Matrix4().fromArray(Array.from(og.clipFromLocal)).invert(), nx = fx * 2 - 1, ny = -(fy * 2 - 1);
    const a = new T.Vector3(nx, ny, -1).applyMatrix4(inv), b = new T.Vector3(nx, ny, 1).applyMatrix4(inv);
    // The ray in the ground's local metres (GroundStore toLocal x/y, scene z): scripts/own-ground/ray-hits.ts walks the
    // same cells built in Node (the page's full-detail meshes keep no CPU arrays to raycast).
    const local = { o: [a.x, a.y, a.z], d: b.clone().sub(a).normalize().toArray() };
    og.root.updateMatrixWorld(true);
    a.applyMatrix4(og.root.matrixWorld); b.applyMatrix4(og.root.matrixWorld);
    rc.ray.set(a, b.clone().sub(a).normalize()); rc.near = 0; rc.far = Infinity;
    // Per object, guarded: meshes whose CPU arrays were released after upload throw inside raycast.
    const all = [];
    let skipped = 0;
    og.root.traverse(o => { if (!o.isMesh || o.visible === false) return; let vis = true; for (let p = o; p && p !== og.root.parent; p = p.parent) if (p.visible === false) vis = false; if (!vis) return; try { o.raycast(rc, all); } catch { skipped++; } });
    const list = all.sort((a, b) => a.distance - b.distance).slice(0, 8);
    return { at: [fx, fy], local, skipped, hits: list.map(h => {
      const o = h.object, names = []; for (let p = o; p && names.length < 4; p = p.parent) names.push(p.name || p.type);
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      return { d: +h.distance.toFixed(2), obj: names.join('<'), layer: o.userData?.layer ?? o.userData?.groundLayer ?? null, ud: JSON.stringify(o.userData).slice(0, 120), mat: m ? `${m.type}${m.name ? ':' + m.name : ''}${m.color ? ' #' + m.color.getHexString() : ''}` : null, p: [h.point.x, h.point.y, h.point.z].map(n => +n.toFixed(2)), face: h.faceIndex };
    }) };
  });
}, rays);
console.log(JSON.stringify(hits, null, 1));
await browser.close();
