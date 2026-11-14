// The feedback notes' own view (09e7bce0 / 6070a7e5): chase view, rider at its recorded world position, the camera
// panned away from it (detached, the RE-CENTER state) to the note's mapCenter at camera zoom 0.5016, rotation held
// at the rider's heading. World positions come from the note's camera-minus-player offset (PIXELS_PER_METER 3).
//   PW_PORT=4443 node scripts/roof-glazing/user-pose.mjs <outdir> <tag> [--qs 'x=0'] [--mobile] [--bearing deg] [--centre lng,lat]
//     [--zoom z] [--bundles dir] [--js 'expr']
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [outDir, tag] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const mobile = process.argv.includes('--mobile'), qs = opt('qs', '');
let NOTE = { player: { x: -3876.627, y: -13171.942, angle: -0.62106 }, camera: { x: 169.578, y: -12855.686, zoom: 0.5015862 }, centre: [4.9003327, 52.3943556] };
const ctxOpts = mobile ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1326, height: 761 }, deviceScaleFactor: 2 };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext(ctxOpts);
await context.route(/ingest\.(us\.)?sentry\.io/, r => r.fulfill({ status: 200, body: '{}' }));
// --bundles dir: serve *.bundle.js from dir (the committed bundles for a before frame).
const bundles = opt('bundles', null);
if (bundles) await context.route(/\/canal-drive\/.*\.bundle\.js/, route => {
  const file = path.join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
  return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
});
await context.addInitScript(() => { try { const k = 'canalRecall.preferences.v1', p = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...p, travelMode: 'car' })); } catch { /* storage off */ } });
await context.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const page = await context.newPage();
page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
await page.goto(`http://127.0.0.1:${process.env.PW_PORT || 4443}/canal-drive/?engine=own&ride=free&buildings3d=storybook${qs ? `&${qs}` : ''}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 240_000 });
await page.evaluate(() => { const g = canalRecallGame; g.camera.viewMode = 'chase'; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
const bearing = opt('bearing', null);
// --centre lng,lat / --zoom z: frame the same scene a little differently (the note's own centre and zoom by default).
if (opt('centre', null)) NOTE.centre = opt('centre', null).split(',').map(Number);
if (opt('zoom', null)) NOTE.camera.zoom = Number(opt('zoom', null));
const place = () => page.evaluate(({ n, bearing }) => {
  const g = canalRecallGame, l = g.osmLoader, cam = g.camera;
  const c = l.latLngToWorld(n.centre[1], n.centre[0]);
  g.player.x = c.x + (n.player.x - n.camera.x); g.player.y = c.y + (n.player.y - n.camera.y); g.player.angle = n.player.angle;
  cam.zoom = n.camera.zoom; cam.resetForRide(g.player);
  cam.detached = true; cam.anchorX = c.x; cam.anchorY = c.y; cam.x = c.x; cam.y = c.y;
  if (bearing !== null) cam.rotation = Number(bearing) * Math.PI / 180;
  return [l._lastCenterLng, l._lastCenterLat, l._lastOffsetX, l._lastOffsetY];
}, { n: NOTE, bearing });
let frame = await place();
for (let r = 0; r < 5; r++) {
  await page.waitForTimeout(4000);
  const now = await page.evaluate(() => { const l = canalRecallGame.osmLoader; return [l._lastCenterLng, l._lastCenterLat, l._lastOffsetX, l._lastOffsetY]; });
  if (now.every((v, i) => v === frame[i])) break;
  frame = await place();
}
await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && !s.queued && !Object.keys(s.pending).length; }, null, { timeout: 90_000, polling: 250 }).catch(() => {});
await page.waitForTimeout(15000);
await place(); await page.waitForTimeout(3000);
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${mobile ? 'phone' : 'desktop'}-user-pose-${tag}.jpg`);
await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
const js = opt('js', null);
if (js) console.log(await page.evaluate(js));
console.log(file);
await browser.close();
