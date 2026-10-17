// Fresh ride frames for the landing page (public/canal-drive/assets/landing/).
//   PORT=4402 [CANAL_BELT=1] node scripts/landing/capture-landing-shots.mjs <label> [travel=boat] [view=chase] [device=desktop|phone] [seconds=30] [every=3] [seed]
// Boots a seeded route, holds ArrowUp, answers whatever card opens, and writes
// artifacts/landing-shots/<label>/NN.png. Pick frames by eye, then
//   cwebp -q 72 -resize W 0 NN.png -o public/canal-drive/assets/landing/<name>.webp
import { chromium } from 'playwright';
import fs from 'node:fs';
const [label = 'ride', travel = 'boat', view = 'chase', device = 'desktop', secs = '30', every = '3', seedArg] = process.argv.slice(2);
const out = `artifacts/landing-shots/${label}`;
fs.mkdirSync(out, { recursive: true });
const phone = device === 'phone';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext(phone
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const seed = Number(seedArg || 0x5eed1234);
await page.addInitScript((initial) => { let s = initial; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }, seed);
await page.goto(`http://127.0.0.1:${process.env.PORT || 4402}/canal-drive/`);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 90000 });
await page.screenshot({ path: `${out}/setup.png` });
await page.locator('#travel-mode').selectOption(travel, { force: true });
await page.locator('#view-mode').selectOption(view, { force: true });
if (process.env.CANAL_BELT) {
  // The fixed Anne Frank Huis -> Rijksmuseum route of scripts/ground-ride-shots.mjs: the canal belt.
  await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
  await page.locator('#poi-destination').selectOption('rijksmuseum');
  await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
}
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, { timeout: 180000 });
await page.waitForTimeout(6000);
await page.keyboard.down('ArrowUp');
let i = 0;
for (let t = 0; t < Number(secs); t += Number(every), i++) {
  await page.waitForTimeout(Number(every) * 1000);
  await page.screenshot({ path: `${out}/${String(i).padStart(2, '0')}.png` });
  // A card freezes the ride: keep the frame with the card, then answer and move on.
  const card = await page.evaluate(() => Boolean(document.querySelector('#canal-question-card, .canal-choice, #canal-submit')?.offsetParent));
  if (card) { await page.keyboard.press('1').catch(() => {}); await page.waitForTimeout(400); await page.keyboard.press('Enter').catch(() => {}); }
}
await page.keyboard.up('ArrowUp');
// Settings (with the site switch) and the knowledge screen this ride just filled.
await page.evaluate(() => canalRecallGame._toggleUtilityPanel('settings'));
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/settings.png` });
await page.locator('#live-knowledge-button').click().catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/knowledge.png` });
fs.writeFileSync(`${out}/errors.json`, JSON.stringify(errors, null, 1));
console.log(label, 'shots', i, 'errors', errors.length);
await browser.close();
