import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// Gameplay clarity review 2026-10-17, findings 10-15
// (docs/preview/gameplay-clarity-review.md). One check per finding.

type Box = { left: number; top: number; right: number; bottom: number };
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

async function bootSetup(page: Page) {
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();
}

async function ride(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('canalRecall.onboarding.v1', 'done'); } catch { /* */ } });
  await openRoute(page, { travelMode: 'boat', viewMode: 'chase', enterRacing: false });
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.state === 4 && !g._intro; }, null, { timeout: 120_000 });
}

test('11: the More cue has its own row and covers no field', async ({ page }) => {
  await bootSetup(page);
  const cue = page.locator('#route-setup .setup-scroll-cue');
  // Short enough that the rail scrolls on both layouts.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: Math.min(size.height, 640) });
  await expect(cue).toBeVisible();
  const layout = await page.evaluate(() => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
    const scroll = document.querySelector('#route-setup .enamel-setup-scroll')!;
    const cueNode = document.querySelector('#route-setup .setup-scroll-cue')!;
    const fields = Array.from(scroll.querySelectorAll('.setup-field, [data-choice], summary'))
      .map(rect)
      // What the rail clips is not on screen; only its visible part counts.
      .map(r => ({ ...r, top: Math.max(r.top, rect(scroll).top), bottom: Math.min(r.bottom, rect(scroll).bottom) }))
      .filter(r => r.bottom > r.top);
    return { scroll: rect(scroll), cue: rect(cueNode), fields };
  });
  expect(layout.cue.top, 'the cue sits below the rail, not on it').toBeGreaterThanOrEqual(layout.scroll.bottom - 1);
  for (const field of layout.fields) expect(overlaps(layout.cue, field)).toBe(false);
  await page.locator('#route-setup .enamel-setup-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(cue).toBeHidden();
});

test('12: opening More options brings its controls into view', async ({ page }) => {
  await bootSetup(page);
  await page.locator('#route-setup .advanced-options summary').click();
  // The first new control is inside the rail's visible box once it settles.
  await expect.poll(() => page.evaluate(() => {
    const scroll = document.querySelector('#route-setup .enamel-setup-scroll')!.getBoundingClientRect();
    const tile = document.querySelector('[data-choice="difficulty-extra:expert"]')!.getBoundingClientRect();
    return tile.top >= scroll.top - 1 && tile.bottom <= scroll.bottom + 1;
  }), { timeout: 3000 }).toBe(true);
});

test('10, 13: no zoom flash after the start; the answered card has no blank band', async ({ page }, info) => {
  await ride(page);
  // The camera settles after the start flight; none of that is the player's zoom.
  const flashed = await page.evaluate(() => new Promise<boolean>(resolve => {
    const game = (window as any).canalRecallGame;
    let seen = false;
    const end = performance.now() + 3000;
    const tick = () => {
      if (game._zoomBadgeTimer > 0) seen = true;
      if (performance.now() < end) requestAnimationFrame(tick); else resolve(seen);
    };
    tick();
  }));
  expect(flashed, 'the zoom badge stays down without a player zoom').toBe(false);
  if (info.project.name === 'desktop') {
    await page.locator('canvas').first().focus().catch(() => {});
    await page.keyboard.down('Equal');
    await page.waitForTimeout(200);
    await page.keyboard.up('Equal');
    await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._zoomBadgeTimer > 0)).toBe(true);
  }

  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    game.routeOptions.answerMode = 'multiple';
    game._openQuizPrompt({
      kind: 'route', name: 'Prinsengracht', subject: 'water', question: 'Which canal are you on?',
      context: 'You made a turn', choices: ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Brouwersgracht'],
    });
  });
  await expect(page.locator('#canal-no-idea')).toBeVisible();
  await page.evaluate(() => (window as any).canalRecallGame._submitCanalAnswer('Keizersgracht'));
  await expect(page.locator('#canal-no-idea')).toBeHidden();
  await expect(page.locator('#canal-riding-on')).toBeVisible();
  const gap = await page.evaluate(() => {
    const card = document.getElementById('canal-card')!.getBoundingClientRect();
    const line = document.getElementById('canal-riding-on')!.getBoundingClientRect();
    return card.bottom - line.bottom;
  });
  expect(gap, 'the card ends just under the riding-on line').toBeLessThan(40);
});

test('14: the arrival card offers Route setup on desktop too', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the phone already had the button');
  await ride(page);
  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    game.quizAttempts = 2; game.quizCorrect = 1;
    game.state = 5;
    game._render();
  });
  const ids = await page.evaluate(() => ((window as any).canalRecallGame._finishButtonBounds || []).map((b: { id: string }) => b.id));
  expect(ids).toContain('route');
  await page.keyboard.press('KeyM');
  await expect(page.locator('#route-card')).toBeVisible();
});

test('15: the help keys are grouped and the debug keys are tucked away', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'touch readers get no key table');
  await bootSetup(page);
  await page.locator('#open-help').click();
  const keys = page.locator('#help-panel .help-keys');
  await expect(keys.locator('h4')).toHaveText(['Ride', 'Answer', 'View']);
  await expect(keys.getByText('Debug overlay')).toBeHidden();
  await keys.locator('.help-dev-keys summary').click();
  await expect(keys.getByText('Debug overlay')).toBeVisible();
});
