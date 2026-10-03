import { expect, Page, test } from '@playwright/test';

// Map Recall answers teach more than position (user request 2026-10-01):
// neighbourhoods are a "Start with" category played in either mode, every
// kind of answer can carry its name origin, and the blind map shows place
// names after a guess so the player can get their bearings.

async function quietExternalRequests(page: Page) {
  await page.route(/(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|googleapis\.com|gstatic\.com|wikimedia\.org)/, (route) => route.abort());
}

/** Open the folded answer card ("More"), when the answer has details to open. */
async function openAnswerDetails(page: Page) {
  const folded = page.locator('[data-testid="answer-details"][data-expanded="no"]');
  if (await folded.isVisible().catch(() => false)) await folded.click();
}

/** Skip rounds until the answer card, opened, shows `selector`; returns how many rounds it took. */
async function skipUntil(page: Page, selector: string, maxRounds = 10): Promise<number> {
  for (let round = 1; round <= maxRounds; round++) {
    await page.getByRole('button', { name: 'No idea' }).click();
    if (await page.locator(selector).first().isVisible().catch(() => false)) return round;
    await openAnswerDetails(page);
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
  await expect(page.locator('[data-testid="answer-name-origin"]')).toContainText(/Wikipedia|street-name register/);
});

test('pinpoint neighbourhoods show their places only after the guess', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=pinpoint&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=10');
  await expect(page.locator('#target-feature-name')).toBeVisible();
  await expect(page.locator('.notable-place-label')).toHaveCount(0);
  const rounds = await skipUntil(page, '.notable-place-label');
  expect(rounds, 'a neighbourhood with places within ten rounds').toBeGreaterThan(0);
  await page.locator('#next-round-btn').click();
  await expect(page.locator('#target-feature-name')).toBeVisible();
  await expect(page.locator('.notable-place-label')).toHaveCount(0);
});

test('guess-name neighborhoods offer nearby areas as choices', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=guess_name&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=5');
  const choices = page.locator('[id^="guess-option-"]');
  await expect(choices).toHaveCount(4, { timeout: 30_000 });
  await expect(page.getByText('Which neighborhood is this?')).toBeVisible();
  // Its best-known places are clues, and none names an offered answer.
  const labels = page.locator('.notable-place-label');
  await expect(labels.first()).toBeVisible({ timeout: 30_000 });
  const placeNames = (await labels.allTextContents()).map((name) => name.toLowerCase());
  await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
  await page.waitForTimeout(400);
  // Visible labels never overlap: a lower-ranked one hides until zoomed in.
  const boxes = await page.locator('.notable-place-label').evaluateAll((elements) => elements
    .filter((element) => getComputedStyle(element).visibility !== 'hidden')
    .map((element) => element.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number }));
  for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    expect(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top, 'visible place labels overlap').toBe(false);
  }
  for (const choice of await choices.allTextContents()) {
    const core = choice.trim().toLowerCase().replace(/\s+e\.o\.$/, '').replace(/(buurt|eiland|kwartier|park|wijk)$/, '');
    if (core.length >= 4) expect(placeNames.some((name) => name.replace(/[^a-z0-9]/g, '').includes(core.replace(/[^a-z0-9]/g, '')))).toBe(false);
  }
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

test('hard difficulty hides the place clues; easy and medium keep them', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=guess_name&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=5&difficulty=hard');
  const choices = page.locator('[id^="guess-option-"]');
  await expect(choices).toHaveCount(4, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.notable-place-label')).toHaveCount(0);
  // Same game on medium shows them.
  await page.goto('/?city=amsterdam&mode=guess_name&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=5&difficulty=medium');
  await expect(page.locator('.notable-place-label').first()).toBeVisible({ timeout: 30_000 });
});

test('a neighbourhood answer lists the places in it', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=pinpoint&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=10');
  await expect(page.locator('#target-feature-name')).toBeVisible();
  const rounds = await skipUntil(page, '[data-testid="answer-places"]');
  expect(rounds, 'a neighbourhood answer with places within ten rounds').toBeGreaterThan(0);
});

test('a neighbourhood with photos opens its card with a painted postcard', async ({ page }) => {
  // One real JPEG stands in for every Commons thumbnail.
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z', 'base64');
  await page.route(/(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|googleapis\.com|gstatic\.com)/, (route) => route.abort());
  await page.route(/(thumb|upload)\.wikimedia\.org/, (route) => route.fulfill({ body: jpeg, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/?city=amsterdam&mode=pinpoint&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=10');
  await expect(page.locator('#target-feature-name')).toBeVisible();
  const rounds = await skipUntil(page, '[data-testid="answer-postcard"]');
  expect(rounds, 'a neighbourhood with a postcard within ten rounds').toBeGreaterThan(0);
  await expect(page.locator('[data-testid="answer-postcard"]')).toHaveAttribute('data-painted', 'yes', { timeout: 15_000 });
  // Every letter's photograph arrives and fills its window.
  await expect(page.locator('[data-testid="answer-postcard"]')).toHaveAttribute('data-photos', /^([1-9]\d*)\/\1$/);
});

// User report 2026-10-02: the postcard popped in seconds after the answer (it was composed at reveal
// after all eight photographs loaded), and the answer card covered the neighbourhood it named.
test('a neighbourhood answer opens folded, its postcard ready, above the outline it reveals', async ({ page }) => {
  // Photographs never arrive: the postcard's frame must not wait for them.
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=pinpoint&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=10');
  await expect(page.locator('#target-feature-name')).toBeVisible();
  const rounds = await skipUntil(page, '[data-testid="answer-postcard-thumbnail"]');
  expect(rounds, 'a neighbourhood with a postcard within ten rounds').toBeGreaterThan(0);
  const viewport = page.viewportSize()!;
  const card = (await page.locator('[data-result-card]').boundingBox())!;
  expect(card.height, 'the folded answer card leaves most of the map visible').toBeLessThan(viewport.height * 0.4);
  // The revealed area is fitted above the card, not under it.
  await expect.poll(async () => {
    const label = (await page.locator('.custom-true-target-icon').boundingBox())!;
    return label.y + label.height < card.y;
  }, { timeout: 5_000 }).toBe(true);
  await page.getByTestId('answer-details').click();
  const postcard = page.locator('[data-testid="answer-postcard"]');
  await expect(postcard).toHaveAttribute('data-painted', 'yes');
  // One photo window per letter, each a plain image the browser loads on its own.
  expect(await postcard.locator('img').count()).toBeGreaterThan(3);
  await expect(postcard).toHaveAttribute('data-photos', /^0\//);
  await page.getByRole('button', { name: /Less/ }).click();
  await expect(page.locator('[data-testid="answer-details"]')).toHaveAttribute('data-expanded', 'no');
});

test('neighbourhood map hints name places, not only compass bearings', async ({ page }) => {
  // User report 2026-10-02: Weesperbuurt's hints were "eastern half", "southeast quadrant", "1.09 km".
  await quietExternalRequests(page);
  await page.goto('/?city=amsterdam&mode=pinpoint&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=10');
  const name = (await page.locator('#target-feature-name').textContent())!.trim();
  await page.locator('#hint-toggle-btn').click();
  const reveal = page.getByText(/Reveal a more precise hint/);
  while (await reveal.isVisible().catch(() => false)) await reveal.click();
  const hints = await page.getByTestId('locate-hint').allTextContents();
  expect(hints.length).toBeGreaterThanOrEqual(3);
  expect(hints.join(' ')).toMatch(/district|along|runs through|borders|inside|just \w+ of/);
  for (const hint of hints) expect(hint.toLowerCase()).not.toContain(name.toLowerCase().replace(/buurt$/, ''));
  await page.screenshot({ path: test.info().outputPath('neighbourhood-hints.png') });
});
