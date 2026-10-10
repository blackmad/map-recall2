// Usage: PORT=4441 node scripts/landmarks/rework-g-game.mjs <id> <landmarkId> <lon> <lat> <out.png> <bearing,bearing,...> [zoom] [pitch]
// In-game screenshots of an installed landmark: starts a bike route to it, then jumps the map to each bearing.
import {chromium} from '@playwright/test';
const [id, landmarkId, lon, lat, out, bearings = '75', zoom = '18.4', pitch = '55'] = process.argv.slice(2);
const origin = `http://127.0.0.1:${process.env.PORT || 4441}`;
const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const page = await br.newPage({viewport: {width: 1500, height: 1000}});
await page.goto(origin + '/canal-drive/');
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, {timeout: 180000});
await page.getByRole('radiogroup', {name: 'Travel', exact: true}).getByRole('button', {name: /Bike/}).click();
await page.getByRole('radiogroup', {name: 'View', exact: true}).getByRole('button', {name: /Chase/}).click();
await page.waitForFunction(l => canalRecallGame.routePois.some(p => p.id === 'lm-' + l), landmarkId);
await page.locator('#poi-destination').selectOption('lm-' + landmarkId);
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, {timeout: 180000});
let first = true;
for (const b of bearings.split(',')) {
  await page.evaluate(a => { const g = canalRecallGame, v = g.vectorMap; v.sync = () => {}; v.map.jumpTo({center: [a.lon, a.lat], zoom: a.zoom, pitch: a.pitch, bearing: a.bearing}); v._completeCity.setSuspended(false); v._completeCity.followCamera(); }, {lon: +lon, lat: +lat, zoom: +zoom, pitch: +pitch, bearing: +b});
  if (first) await page.waitForFunction(id => canalRecallGame.vectorMap._signatureLandmarks.shown.has(id), id, {timeout: 180000});
  first = false;
  await page.waitForTimeout(8500);
  await page.waitForFunction(() => { const b = canalRecallGame.vectorMap._threeBuildings; return b?.ready && b.chunks.size && !b.pending.length && !b.inflight.size; }, null, {timeout: 180000});
  await page.screenshot({path: out.replace('.png', `-b${b}.png`)});
}
await br.close();
