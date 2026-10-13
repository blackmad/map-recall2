// Ride with screenshots, for the ground defect review (docs/handoffs/lane-ground-default-20261013.md, deliverable 4).
//   PORT=4447 [PLACE=lng,lat,bearing] node scripts/ground-ride-shots.mjs <label> "<query>" [seconds=40] [every=2.5]
// Boots the fixed Anne Frank -> Rijksmuseum route (canal belt), optionally teleports to PLACE, holds ArrowUp and writes
// artifacts/ground-ride/<label>/NN.png plus positions.json (lng/lat/bearing/speed per shot).
import { chromium } from 'playwright';
import fs from 'node:fs';
const [label = 'ride', qs = '?ownGround=1&sharedFrame=1', secs = '40', every = '2.5'] = process.argv.slice(2);
const out = `artifacts/ground-ride/${label}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4447}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 60000 });
await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
await page.locator('#poi-destination').selectOption('rijksmuseum');
await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
const [lng, lat, bearing] = (process.env.PLACE || '').split(',').map(Number);
if (Number.isFinite(lat)) await page.evaluate(({ lng, lat, bearing }) => {
  const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
  g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
  g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
  g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
}, { lng, lat, bearing });
await page.waitForFunction(() => { const g = canalRecallGame.vectorMap._ownGround; if (!g) return true; const s = g.status(); return s.ready && !s.queued && !Object.keys(s.pending).length && Object.values(s.cells).includes(0); }, null, { timeout: 180000 });
await page.waitForTimeout(5000);
await page.keyboard.down('ArrowUp');
const positions = [];
for (let i = 0, t = 0; t < Number(secs); i++, t += Number(every)) {
  // Quiz cards freeze the ride: answer (key 1) and dismiss (Enter) whatever is open, keep ArrowUp held.
  for (let k = 0; k < Number(every) * 2; k++) { await page.keyboard.press('1').catch(() => {}); await page.waitForTimeout(250); await page.keyboard.press('Enter').catch(() => {}); await page.waitForTimeout(250); }
  const pos = await page.evaluate(() => { const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
    return { lng: l._lastCenterLng + (g.player.x - l._lastOffsetX) / (111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm), lat: l._lastCenterLat - (g.player.y - l._lastOffsetY) / (111320 * ppm), speed: g.player.speed, street: g.currentStreetName ?? null }; });
  positions.push(pos);
  await page.screenshot({ path: `${out}/${String(i).padStart(2, '0')}.png` });
}
await page.keyboard.up('ArrowUp');
fs.writeFileSync(`${out}/positions.json`, JSON.stringify({ qs, errors, positions }, null, 1));
console.log(label, 'shots', positions.length, 'errors', errors.length);
await browser.close();
