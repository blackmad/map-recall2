import {chromium, devices} from 'playwright';
// One-session A/B of the facade chunk level (CANAL-RECALL-7, facade touch LOD lane).
//
// Same camera, same resident tiles, same worker: measures `detail = 'touch'`, rebuilds every chunk
// at `detail = 'full'`, measures again, and puts the touch build back. Run-to-run residency variance
// (~15 %) makes two separate page loads a poor comparison; this holds everything but the level fixed.
//
// Usage: PORT=4437 PLACES=4.88385,52.37450,180 node scripts/facade-ab-ipad.mjs
const places = (process.env.PLACES || '4.88385,52.37450,180').split(';').map(s => s.split(',').map(Number));
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport: {width: 1180, height: 734}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPad Pro 11'].userAgent});
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4471}/canal-drive/`);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, {timeout: 60000});
await page.locator('#travel-mode').selectOption('car', {force: true}); await page.locator('#view-mode').selectOption('chase', {force: true});
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, {timeout: 180000});
const settle = () => page.waitForFunction(() => {
  const tb = canalRecallGame.vectorMap._threeBuildings;
  return !tb.pending.length && !tb.inflight.size && !tb.workerBusy && !tb.staged.length;
}, null, {timeout: 180000});
const measure = () => page.evaluate(() => {
  const f = canalRecallGame.vectorMap._sharedFrame, tb = canalRecallGame.vectorMap._threeBuildings;
  const stats = f.drawStats(), parts = {};
  for (const [id, s] of Object.entries(stats)) parts[id] = s.triangles;
  // Resident triangles per chunk family (not frustum-culled; the participant total above is).
  const byPrefix = {};
  for (const [key, entry] of tb.chunks) {
    const index = entry.mesh?.geometry?.index;
    if (!index) continue;
    const prefix = key.startsWith('__') ? 'kit' : key.split(':')[0];
    byPrefix[prefix] = (byPrefix[prefix] ?? 0) + Math.floor(index.count / 3);
  }
  return { detail: tb.detail, facades: parts.facades ?? 0, main: f.stats.main.triangles, calls: f.stats.main.calls, byPrefix };
});
const rebuild = async (detail) => {
  await page.evaluate((detail) => {
    const tb = canalRecallGame.vectorMap._threeBuildings;
    tb.detail = detail;
    for (const key of [...tb.chunks.keys()]) tb.dropChunk(key);
    tb.setFeatures(tb.lastFeatures);
  }, detail);
  await settle();
};
for (const [lng, lat, bearing] of places) {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)("PIXELS_PER_METER"), b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
  }, { lng, lat, bearing });
  await page.waitForTimeout(20000);
  await settle();
  const touch = await measure();
  await rebuild('full'); await page.waitForTimeout(1500); await settle();
  const full = await measure();
  await rebuild('touch'); await page.waitForTimeout(1500); await settle();
  const back = await measure();
  const show = r => `facades ${(r.facades / 1e3).toFixed(0)}k  main ${(r.main / 1e6).toFixed(2)}M  ${r.calls} calls`;
  console.log(`\n${lng},${lat} bearing ${bearing}`);
  console.log(`  touch (rider's block full, shells cheap): ${show(touch)}   chunks ${JSON.stringify(touch.byPrefix)}`);
  console.log(`  full  (desktop build, every chunk)      : ${show(full)}   chunks ${JSON.stringify(full.byPrefix)}`);
  console.log(`  touch again (same session, rebuilt)     : ${show(back)}`);
}
await browser.close();
