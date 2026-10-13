// Screenshots of the 15 "hidden bug" covers pands, in the game, with and without ?bagTiles=1 (deliverable 2 of
// docs/handoffs/lane-ground-default-20261013.md). Rider is put 35 m short of each pand, facing it, frozen.
//   PORT=4447 node scripts/review-covers-shots.mjs "" | "?bagTiles=1"     -> artifacts/covers-review/<tag>/<id>.png
import { chromium } from 'playwright';
import fs from 'node:fs';
const qs = process.argv[2] ?? '';
const tag = qs.includes('bagTiles') ? 'bag' : 'flat';
const SPOTS = [
  ['the-movies', 4.884637, 52.383929], ['delamar-a', 4.8799, 52.364345], ['delamar-b', 4.880372, 52.364687],
  ['kleine-komedie', 4.895957, 52.366638], ['he-hua-temple', 4.900088, 52.373553], ['oude-kerk', 4.898636, 52.374311],
  ['hortus-greenhouses', 4.908412, 52.36646], ['walloon-church', 4.897327, 52.370916], ['rijksmuseum', 4.8845, 52.359914],
  ['westerkerk', 4.883892, 52.374378], ['sexmuseum', 4.897043, 52.376591],
];
const only = process.env.ONLY?.split(',');
fs.mkdirSync(`artifacts/covers-review/${tag}`, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4447}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 60000 });
await page.locator('#travel-mode').selectOption('car', { force: true }); await page.locator('#view-mode').selectOption('chase', { force: true });
await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
await page.locator('#poi-destination').selectOption('rijksmuseum');
await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
for (const [id, lng, lat] of SPOTS) {
  if (only && !only.includes(id)) continue;
  for (const bearing of [0, 180]) {
    await page.evaluate(({ lng, lat, bearing }) => {
      const g = canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
      const back = 35, dLng = -Math.sin(b) * back / (111320 * Math.cos(lat * Math.PI / 180)), dLat = -Math.cos(b) * back / 110540;
      const L = lng + dLng, A = lat + dLat;
      g.player.x = l._lastOffsetX + (L - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      g.player.y = l._lastOffsetY - (A - l._lastCenterLat) * 111320 * ppm;
      g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b)); Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
      g.player.handleInput = () => {};
    }, { lng, lat, bearing });
    await page.waitForTimeout(500);
    await page.waitForFunction(() => { const t = canalRecallGame.vectorMap._threeBuildings; return t?.ready && !t.pending.length && !t.inflight.size; }, null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `artifacts/covers-review/${tag}/${id}-${bearing}.png` });
  }
}
await browser.close();
