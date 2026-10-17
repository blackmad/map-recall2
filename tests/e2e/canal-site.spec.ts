import { expect, test } from '@playwright/test';

// The assembled public site (dist-canalrecall/) behind Firebase Hosting's
// rewrites: landing at /, the ride at /ride, Map Quest at /quiz/, one origin.
// Serve it first, then point this spec at it:
//   npm run build && npm run build:canalrecall-site
//   npx firebase-tools@15 serve --only hosting:canalrecall --port 4403   # listens on 4404
//   CANAL_SITE_URL=http://localhost:4404 PW_PORT=4402 npx playwright test tests/e2e/canal-site.spec.ts
const site = process.env.CANAL_SITE_URL;
const shots = process.env.CANAL_SITE_SHOTS || 'artifacts/landing-shots/site';

test.skip(!site, 'CANAL_SITE_URL is not set: needs the assembled site behind the Hosting rewrites');

test('landing page leads to the ride and the quiz on the same origin', async ({ page }, info) => {
  const origin = new URL(site!).origin;
  await page.goto(`${site}/`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn Amsterdam');
  await page.screenshot({ path: `${shots}/landing-top-${info.project.name}.png` });
  // Screenshots below the fold are lazy: scroll them in, then wait for every image to decode.
  for (let y = 0; y < 20; y += 1) { await page.mouse.wheel(0, 600); await page.waitForTimeout(100); }
  await expect.poll(() => page.evaluate(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: `${shots}/landing-${info.project.name}.png`, fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const name of ['Credits', 'Privacy']) {
    await expect(page.locator('footer').getByRole('link', { name })).toHaveAttribute('href', `${name.toLowerCase()}.html`);
  }

  await page.getByRole('link', { name: 'Start a ride' }).first().click();
  await expect(page).toHaveURL(`${origin}/ride`);
  await expect.poll(() => page.evaluate(() => Boolean((window as { canalRecallGame?: unknown }).canalRecallGame)), { timeout: 60_000 }).toBe(true);
  await expect(page.locator('#setup-site-switch a[data-site="quiz"]')).toHaveAttribute('href', '/quiz/');
  await page.screenshot({ path: `${shots}/ride-setup-${info.project.name}.png` });

  // Having opened the ride, the bare root forwards a returning player back to it…
  await page.goto(`${site}/`);
  await expect(page).toHaveURL(`${origin}/ride`);
  // …while Home always shows the landing page.
  await page.goto(`${site}/?home`);
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.locator('.ctas').getByRole('link', { name: 'Map quiz' }).click();
  await expect(page).toHaveURL(`${origin}/quiz/`);
  await expect(page.locator('#app-game-header')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${shots}/quiz-${info.project.name}.png` });
  await page.locator('#header-menu-btn').click();
  await expect(page.locator('#header-site-switch a[data-site="ride"]')).toHaveAttribute('href', '/ride');
  await expect(page.locator('#header-site-switch a[data-site="quiz"]')).toHaveAttribute('aria-current', 'page');
  await page.waitForTimeout(500); // the drawer fades in
  await page.screenshot({ path: `${shots}/quiz-menu-${info.project.name}.png` });
});

test('old deep links to the root keep reaching the ride', async ({ page }) => {
  const origin = new URL(site!).origin;
  await page.goto(`${site}/?travel=boat#x`);
  await expect(page).toHaveURL(`${origin}/ride?travel=boat#x`);
});

test('Map Quest reads extracts from the site root, not /quiz/data', async ({ page }) => {
  const extractRequests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/extracts/')) extractRequests.push(new URL(request.url()).pathname); });
  await page.goto(`${site}/quiz/?city=amsterdam`);
  await expect(page.locator('#app-game-header')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => extractRequests.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(extractRequests.every((path) => path.startsWith('/data/extracts/'))).toBe(true);
});
