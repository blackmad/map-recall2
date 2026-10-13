import { expect, Page, test } from '@playwright/test';

// Question forms (wave-2 review, 2026-10-13): relation questions for obscure places in Guess Name,
// the bonus pin after the reveal, and the daily five with its streak.

async function quietExternalRequests(page: Page) {
  await page.route(/(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|googleapis\.com|gstatic\.com|wikimedia\.org)/, (route) => route.abort());
}

const amsterdamDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

test('an obscure street asks which of two highlighted places, named only after the answer', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=guess_name&category=streets&radius=4500&map=light_nolabels&labels=off&rounds=20');
  const relation = page.getByTestId('relation-question');
  for (let round = 0; round < 20; round++) {
    await expect(page.locator('#guess-bottom-card')).toBeVisible({ timeout: 30_000 });
    if (await relation.isVisible()) break;
    await page.getByRole('button', { name: /No idea/ }).click();
    await page.locator('#guess-next-round-btn').click();
  }
  await expect(relation).toBeVisible();
  const prompt = (await relation.locator('h1').textContent())!;
  expect(prompt).toMatch(/^Which (is further (north|south|east|west)|of these is in .+)/);
  const choices = await page.locator('[id^="relation-option-"]').allTextContents();
  expect(choices).toHaveLength(2);
  // Both candidates are drawn; neither is named on the map before the answer.
  await expect(page.locator('path.qf-relation-other').first()).toBeAttached();
  await expect(page.locator('.qf-relation-label')).toHaveCount(0);
  for (const choice of choices) await expect(page.locator('.leaflet-marker-pane')).not.toContainText(choice.replace(/^\d/, '').trim());
  await page.screenshot({ path: test.info().outputPath('relation-question.png') });
  await page.keyboard.press('1');
  await expect(page.getByTestId('relation-result')).toBeVisible();
  await expect(page.getByTestId('relation-explanation')).toContainText(/further|is in/);
  await expect(page.locator('.qf-relation-label')).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('relation-reveal.png') });
});

test('the bonus pin is offered after the reveal and adds to the score', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=pinpoint&category=streets&radius=4500&map=light_nolabels&labels=off&rounds=10');
  const offer = page.locator('[data-testid="bonus-pin"][data-phase="offer"]');
  for (let round = 0; round < 10; round++) {
    await expect(page.locator('#target-feature-name')).toBeVisible({ timeout: 30_000 });
    // Never offered before the answer.
    await expect(page.getByTestId('bonus-pin')).toHaveCount(0);
    await page.getByRole('button', { name: 'No idea' }).click();
    if (await offer.waitFor({ timeout: 5_000 }).then(() => true, () => false)) break;
    await page.locator('#next-round-btn').click();
  }
  await expect(offer).toContainText(/^Bonus · where is .+\?/);
  await offer.getByRole('button').first().click();
  await expect(page.locator('[data-testid="bonus-pin"][data-phase="active"]')).toBeVisible();
  // The bonus landmark is not on the map until the tap, and the reveal's place-name tiles step aside.
  await expect(page.locator('.qf-bonus-label')).toHaveCount(0);
  const labels = page.locator('.reveal-labels');
  if (await labels.count()) expect(await labels.first().evaluate((element) => getComputedStyle(element).visibility)).toBe('hidden');
  const map = (await page.locator('#map-viewport-container').boundingBox())!;
  await page.mouse.click(map.x + map.width / 2, map.y + map.height * 0.3);
  await expect(page.locator('[data-testid="bonus-pin"][data-phase="done"]')).toContainText(/off by/);
  await expect(page.locator('.qf-bonus-label')).toHaveCount(1);
  const bonus = Number((await page.getByTestId('bonus-points').textContent())!.replace(/[^\d]/g, ''));
  expect(bonus).toBeGreaterThanOrEqual(0);
  expect(bonus).toBeLessThanOrEqual(500);
});

test('the daily five: five rounds, then done for today with a streak', async ({ page }) => {
  await quietExternalRequests(page);
  const today = amsterdamDay();
  const [year, month, day] = today.split('-').map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  await page.addInitScript((record) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('mapRecall.daily.v1', record);
      sessionStorage.setItem('seeded', '1');
    }
  }, JSON.stringify({ lastDay: yesterday, streak: 3, best: 3 }));
  await page.goto('/?city=amsterdam&mode=pinpoint');
  const tile = page.getByTestId('daily-five');
  await expect(tile).toHaveAttribute('data-done', 'no');
  await expect(tile).toContainText('Daily five');
  await expect(page.getByTestId('daily-streak')).toHaveText('Streak 3');
  await tile.click();
  await expect(page.locator('#target-feature-name')).toBeVisible({ timeout: 30_000 });
  for (let round = 1; round <= 5; round++) {
    await expect(page.getByText(`${round}/5`).first()).toBeVisible();
    await page.getByRole('button', { name: 'No idea' }).click();
    await page.locator('#next-round-btn').click();
  }
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mapRecall.daily.v1')!));
  expect(stored).toEqual({ lastDay: today, streak: 4, best: 4 });
  await page.goto('/?city=amsterdam&mode=pinpoint');
  await expect(page.getByTestId('daily-five')).toHaveAttribute('data-done', 'yes');
  await expect(page.getByTestId('daily-five')).toContainText('Done today · streak 4');
});
