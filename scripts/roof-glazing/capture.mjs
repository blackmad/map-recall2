// Frames for the roof-glazing lane (feedback 09e7bce0, 6070a7e5): the own engine, storybook look, free ride, the camera
// jumped to a look-at point / zoom / pitch / bearing, the rider frozen.
//   PW_PORT=4443 node scripts/roof-glazing/capture.mjs <outdir> <tag> [--qs 'x=0'] [--mobile]
//     [--view name:lng:lat:zoom:pitch:bearing ...]   (default: the two notes' view of Grasweg 116-124)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [outDir, tag] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const mobile = process.argv.includes('--mobile'), qs = opt('qs', '');
const views = process.argv.flatMap((a, i) => (a === '--view' ? [process.argv[i + 1]] : []));
if (!views.length) views.push('grasweg:4.8995:52.3941:16.6:62:50');
const ctxOpts = mobile ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1326, height: 761 }, deviceScaleFactor: 1 };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext(ctxOpts);
await context.route(/ingest\.(us\.)?sentry\.io/, r => r.fulfill({ status: 200, body: '{}' }));
await context.addInitScript(() => { try { const k = 'canalRecall.preferences.v1', p = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...p, travelMode: 'car' })); } catch { /* storage off */ } });
await context.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
const page = await context.newPage();
page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
await page.goto(`http://127.0.0.1:${process.env.PW_PORT || 4443}/canal-drive/?engine=own&ride=free&buildings3d=storybook${qs ? `&${qs}` : ''}`);
await page.waitForFunction(() => window.canalRecallGame?.state === 4 && window.canalRecallGame.camera?.introOverview === 0 && window.canalRecallGame.freeRide, null, { timeout: 240_000 });
await page.evaluate(() => { const g = canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };});
fs.mkdirSync(outDir, { recursive: true });
for (const v of views) {
  const [name, lng, lat, zoom, pitch, bearing] = v.split(':');
  // The rider stands at the look-at point first, so the detail tiles (which follow the rider) load there.
  await page.evaluate(at => { const g = canalRecallGame, l = g.osmLoader, w = l.latLngToWorld?.(at[1], at[0]); if (w) { g.player.x = w.x; g.player.y = w.y; g.camera.resetForRide?.(g.player); } }, [Number(lng), Number(lat)]);
  await page.waitForTimeout(3000);
  const jump = () => page.evaluate(c => { const vm = canalRecallGame.vectorMap; (vm.map ?? vm.cameraMap).jumpTo(c); }, { center: [Number(lng), Number(lat)], zoom: Number(zoom), pitch: Number(pitch), bearing: Number(bearing) });
  for (let k = 0; k < 6; k++) { await jump(); await page.waitForTimeout(5000); }
  await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && !s.queued && !Object.keys(s.pending).length; }, null, { timeout: 90_000, polling: 250 }).catch(() => {});
  await jump(); await page.waitForTimeout(4000);
  const file = path.join(outDir, `${mobile ? 'phone' : 'desktop'}-${name}-${tag}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
  console.log(file);
}
await browser.close();
