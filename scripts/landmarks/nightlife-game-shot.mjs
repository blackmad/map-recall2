// Usage: PORT=4397 node scripts/landmarks/worship-game-shot.mjs <out.png> <lng> <lat> <bearing> [zoom] [pitch] [mobile]
// Boots the game, freezes the rider, jumps the map camera to the landmark and screenshots the map.
import {chromium} from '@playwright/test';
const [out, lng, lat, bearing = '0', zoom = '18.6', pitch = '58', mobile] = process.argv.slice(2);
const base = `http://localhost:${process.env.PORT || 4397}`;
const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const page = await br.newPage({viewport: mobile ? {width: 430, height: 850} : {width: 1100, height: 760}});
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(`${base}/canal-drive/`, {waitUntil: 'load'});
await page.waitForFunction(() => window.canalRecallGame?.ctx, null, {timeout: 480000});
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => window.canalRecallGame?.vectorMap?._threeBuildings?.ready, null, {timeout: 480000});
await page.evaluate(() => {
  const g = window.canalRecallGame;
  if (g._intro) g._updateIntro(60);
  g.camera.introOverview = 0;
  g.vectorMap.sync(g.camera, g.osmLoader, g.canvas);
  g.vectorMap.setMeasuredColoursOnly(false);
  g.vectorMap._completeCity.setSuspended(false);
  g.vectorMap.sync = () => {};
  g.player.speed = 0; g.player.vx = 0; g.player.vy = 0; g.player.update = () => {};
});
const cam = {center: [+lng, +lat], zoom: +zoom, pitch: +pitch, bearing: +bearing};
await page.evaluate(async camera => {
  const v = canalRecallGame.vectorMap;
  v.map.jumpTo(camera);
  v._facadesOutOfZoom = false; v._applyFacadeState(); v._syncFacadeZoom(camera.zoom);
  v._completeCity.setSuspended(false); v._threeBuildings.setDetailCentre(...camera.center); v._completeCity.followCamera();
  v.map.triggerRepaint();
}, cam);
await page.waitForFunction(() => {
  const v = window.canalRecallGame.vectorMap, t = v._threeBuildings, c = v._completeCity.status();
  return t.chunks.size > 0 && !t.pending.length && !t.inflight.size && !t.pumping && !c.queued && !c.inFlight;
}, null, {timeout: 480000});
await page.waitForTimeout(3000);
await page.locator('#vector-map').screenshot({path: out, timeout: 480000});
await br.close();
