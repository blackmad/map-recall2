import { expect, Page, test } from '@playwright/test';

// Map Recall answers teach more than position (user request 2026-10-01):
// neighbourhoods are a "Start with" category played in either mode, every
// kind of answer can carry its name origin, and the blind map shows place
// names after a guess so the player can get their bearings.

async function quietExternalRequests(page: Page) {
  await page.route(/(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|googleapis\.com|gstatic\.com|wikimedia\.org)/, (route) => route.abort());
}

/** Skip rounds until the answer card shows `selector`; returns how many rounds it took. */
async function skipUntil(page: Page, selector: string, maxRounds = 10): Promise<number> {
  for (let round = 1; round <= maxRounds; round++) {
    await page.getByRole('button', { name: 'No idea' }).click();
    if (await page.locator(selector).first().isVisible().catch(() => false)) return round;
    const next = page.locator('#next-round-btn, #guess-next-round-btn').first();
    if (!(await next.isVisible())) break;
    await next.click();
  }
  return -1;
}

test('neighborhoods start from the setup rail and answers explain the name', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=pinpoint&radius=4500&map=light_nolabels&labels=off&rounds=10');
  await page.getByRole('button', { name: /Neighborhoods/ }).first().click();
  await expect(page.locator('#target-feature-name')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('category')).toBe('neighborhoods');
  // There is no neighbourhood mode any more: two modes only.
  await expect(page.locator('#game-mode-switcher button')).toHaveCount(2);
  const rounds = await skipUntil(page, '[data-testid="answer-name-origin"]');
  expect(rounds, 'a neighbourhood answer with a name origin within ten rounds').toBeGreaterThan(0);
  await expect(page.locator('[data-testid="answer-name-origin"]')).toContainText(/Wikipedia/);
});

test('guess-name neighborhoods offer nearby areas as choices', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=guess_name&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=5');
  const choices = page.locator('[id^="guess-option-"]');
  await expect(choices).toHaveCount(4, { timeout: 30_000 });
  await expect(page.getByText('Which neighborhood is this?')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('guess-neighborhood.png') });
});

test('street answers carry the register name origin', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=pinpoint&category=streets&radius=4500&map=light_nolabels&labels=off&rounds=10');
  await expect(page.locator('#target-feature-name')).toBeVisible();
  const rounds = await skipUntil(page, '[data-testid="answer-name-origin"]');
  expect(rounds, 'a street with a register origin within ten rounds').toBeGreaterThan(0);
  await expect(page.locator('[data-testid="answer-name-origin"]')).toContainText('Gemeente Amsterdam street-name register');
});

test('place names appear on the blind map after a guess and go with the next question', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=pinpoint&category=water&radius=4500&map=light_nolabels&labels=off&rounds=5');
  await expect(page.locator('#target-feature-name')).toBeVisible();
  await expect(page.locator('.reveal-labels')).toHaveCount(0);
  await page.getByRole('button', { name: 'No idea' }).click();
  await expect(page.locator('.reveal-labels')).toHaveCount(1);
  await page.locator('#next-round-btn').click();
  await expect(page.locator('#target-feature-name')).toBeVisible();
  await expect(page.locator('.reveal-labels')).toHaveCount(0);
});
