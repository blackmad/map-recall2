// Usage: PORT=4447 node scripts/landmarks/big-game.mjs <id> <lng> <lat> <bearing,bearing,..> <outPrefix> [zoom=18] [pitch=57]
// In-game street-level shots of an installed manual model (any route; the camera is jumped to the building).
import {chromium} from '@playwright/test';
const [id, lng, lat, bearings, out, zoom = '18', pitch = '57'] = process.argv.slice(2);
const origin = `http://127.0.0.1:${process.env.PORT || 4447}`;
const browser = await chromium.launch({headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
try {
  const page = await browser.newPage({viewport: {width: 1100, height: 760}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/canal-drive/');
  await page.waitForFunction(() => window.canalRecallGame?.vectorMap?._signatureLandmarks, null, {timeout: 90000});
  const route = await page.evaluate(() => canalRecallGame.routePois[0]?.id);
  if (route) await page.selectOption('#poi-destination', route);
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera?.introOverview === 0, null, {timeout: 90000});
  await page.evaluate(() => { canalRecallGame.vectorMap.sync = () => {}; });
  for (const b of bearings.split(',')) {
    await page.evaluate(({c, z, p, b}) => canalRecallGame.vectorMap.map.jumpTo({center: c, zoom: z, pitch: p, bearing: b}), {c: [+lng, +lat], z: +zoom, p: +pitch, b: +b});
    await page.waitForFunction(id => canalRecallGame.vectorMap._signatureLandmarks.shown.has(id) && canalRecallGame.vectorMap._completeCityHasBuildings, id, {timeout: 90000});
    await page.waitForTimeout(7000);
    await page.screenshot({path: `${out}-${b}.png`});
    console.log('shot', b);
  }
  console.log(JSON.stringify({errors}));
} finally { await browser.close(); }
