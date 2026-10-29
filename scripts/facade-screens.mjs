import {chromium, devices} from 'playwright';
import fs from 'node:fs';
// Before/after strips for the facade touch LOD (CANAL-RECALL-7): the same three views at
// 1180x734 @2x with `?facadeDetail=full` (before, the desktop build) and `touch` (after).
//
// Usage: PORT=4437 DIST=artifacts/facade-touch-lod node scripts/facade-screens.mjs
const out = process.env.DIST || 'artifacts/facade-touch-lod';
fs.mkdirSync(out, {recursive: true});
// name, lng, lat, bearing (degrees; 0 = north, 90 = east, 180 = south)
const views = [
  ['near', 4.88385, 52.37450, 90],
  ['bearing180', 4.88385, 52.37450, 180],
  ['downcanal', 4.88230, 52.36900, 180],
];
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for (const detail of ['full', 'touch']) {
  const page = await browser.newPage({viewport: {width: 1180, height: 734}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPad Pro 11'].userAgent});
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  await page.goto(`http://127.0.0.1:${process.env.PORT || 4471}/canal-drive/?facadeDetail=${detail}`);
  await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, {timeout: 60000});
  await page.locator('#travel-mode').selectOption('car', {force: true}); await page.locator('#view-mode').selectOption('chase', {force: true});
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, {timeout: 180000});
  // Collapse the HUD so the streets, not the panels, are in the strip.
  await page.evaluate(() => { for (const id of ['canal-overlay-root', 'utility-buttons', 'map-attribution']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } });
  for (const [name, lng, lat, bearing] of views) {
    await page.evaluate(({ lng, lat, bearing }) => {
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)("PIXELS_PER_METER"), b = bearing * Math.PI / 180;
      g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
      g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
      // The chase camera otherwise follows the rider's steering; hold the asked bearing instead.
      g.camera.holdHeading = true; g.camera.heldRotation = g.player.angle + Math.PI / 2;
    }, { lng, lat, bearing });
    await page.waitForTimeout(18000);
    const file = `${out}/${detail === 'full' ? 'before' : 'after'}-${name}.png`;
    await page.screenshot({path: file});
    const r = await page.evaluate(() => {
      const f = canalRecallGame.vectorMap._sharedFrame;
      return { tris: f.stats.main.triangles, calls: f.stats.main.calls, facades: f.drawStats().facades?.triangles ?? 0, detail: canalRecallGame.vectorMap._threeBuildings?.detail ?? '?', bearing: Math.round((canalRecallGame.vectorMap.map.getBearing() + 360) % 360) };
    });
    console.log(`${file}  facades ${(r.facades / 1e3).toFixed(0)}k  main ${(r.tris / 1e6).toFixed(2)}M  ${r.calls} calls  detail ${r.detail}  bearing ${r.bearing}`);
  }
  await page.close();
}
await browser.close();
