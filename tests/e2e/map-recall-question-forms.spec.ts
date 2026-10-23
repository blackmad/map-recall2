import { expect, Page, test } from '@playwright/test';

// Question forms (wave-2 review, 2026-10-13): relation questions for obscure places in Guess Name.

async function quietExternalRequests(page: Page) {
  await page.route(/(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|googleapis\.com|gstatic\.com|wikimedia\.org)/, (route) => route.abort());
}

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

