// Map Quest and the landmark gallery, for the landing page.
//   PORT=4402 node scripts/landing/capture-landing-pages.mjs
// Writes artifacts/landing-shots/pages/{quiz,quiz-menu,gallery,knowledge}.png.
// The knowledge screen is shown for an example learner a few weeks in (seeded
// review states), since a fresh browser has nothing to show there.
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = 'artifacts/landing-shots/pages';
fs.mkdirSync(out, { recursive: true });
const base = `http://127.0.0.1:${process.env.PORT || 4402}`;
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/?city=amsterdam`);
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/quiz-start.png` });
const start = page.getByRole('button', { name: /start|play/i }).first();
await start.click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/quiz.png` });
await page.locator('#header-menu-btn').click().catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/quiz-menu.png` });
await page.goto(`${base}/canal-drive/landmark-gallery.html`);
// Cards build their 3D previews one at a time as they scroll into view.
await page.waitForTimeout(45000);
await page.screenshot({ path: `${out}/gallery.png` });
const day = 86400000, now = Date.now();
const example = [
  ['Prinsengracht', 'water', [4.8838, 52.3700], 21, 5, 0], ['Keizersgracht', 'water', [4.8853, 52.3690], 9, 3, 1],
  ['Herengracht', 'water', [4.8890, 52.3700], 4, 2, 1], ['Singel', 'water', [4.8905, 52.3710], -1, 2, 2],
  ['Leidsegracht', 'water', [4.8830, 52.3650], 2, 1, 0], ['Reguliersgracht', 'water', [4.8960, 52.3620], -2, 1, 1],
  ['Bloemgracht', 'water', [4.8800, 52.3740], 34, 6, 0], ['Brouwersgracht', 'water', [4.8870, 52.3800], 13, 4, 0],
  ['Amstel', 'water', [4.9010, 52.3600], 55, 7, 0], ['Elandsgracht', 'street', [4.8800, 52.3680], 1, 1, 2],
  ['Utrechtsestraat', 'street', [4.8970, 52.3620], 6, 2, 0], ['Leliegracht', 'water', [4.8850, 52.3760], 0.4, 1, 1],
].map(([name, type, center, dueInDays, repetitions, lapses], i) => ({
  featureKey: `v1_amsterdam_${name.toLowerCase()}_example${i}`, mode: 'guess_name', dueAt: now + dueInDays * day,
  intervalDays: Math.max(1, Math.abs(dueInDays)), ease: 2.5, repetitions, lapses, lastReviewedAt: now - (i % 6 + 1) * day,
  lastEventId: `example-${i}`, schedulerVersion: 1, featureSnapshot: { name, type, cityId: 'amsterdam', center },
}));
await page.goto(`${base}/canal-drive/`);
await page.evaluate((states) => {
  localStorage.setItem('mapRecall_reviewStates_v1', JSON.stringify(Object.fromEntries(states.map(s => [`${s.featureKey}_${s.mode}`, s]))));
}, example);
await page.reload();
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, { timeout: 90000 });
await page.locator('#knowledge-button').click();
await page.waitForTimeout(1500);
await page.getByRole('tab', { name: /^All/ }).click().catch(() => page.getByText(/^All$/).first().click().catch(() => {}));
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/knowledge.png` });
await browser.close();
console.log('pages done');
