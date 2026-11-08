// G7 (#277): on a 414×896 phone the utility cluster (Report a problem,
// settings, help) must never sit on the question card's choices or on the
// arrival card's actions, and a long destination must not be cut to "…" in the
// arrival title.
//
// Run: PW_PORT=4693 /tmp/canal-pw.sh npx playwright test tests/e2e/g7-phone-layout.spec.ts --project=iphone

import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

const PHONE = { width: 414, height: 896 };
const LONG_NAME = 'Vondelpark Open Air Theater';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'phone layout');
});

type Box = { left: number; top: number; right: number; bottom: number };

/** Visible utility buttons as screen rects (an opacity-0 tucked button is not there to tap). */
async function visibleUtilities(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const cluster = document.getElementById('utility-buttons');
    if (!cluster || getComputedStyle(cluster).display === 'none') return [];
    return [...cluster.children].flatMap(child => {
      const el = child as HTMLElement;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.05 || !r.width) return [];
      return [{ left: r.left, top: r.top, right: r.right, bottom: r.bottom }];
    });
  });
}

const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test('the utility cluster stays off the question card, even when revealed', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await openRoute(page, { travelMode: 'car' });
  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    game.routeOptions.answerMode = 'multiple';
    game._openQuizPrompt({
      kind: 'route', name: 'Prinsengracht', subject: 'water',
      question: 'Which canal are you on?',
      context: 'You have been following it since the Westerkerk.',
      choices: ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Brouwersgracht'],
    });
    // A tap on the map: the reveal that put the cluster over the card.
    game._utilityRevealUntil = performance.now() + 60_000;
  });
  await page.waitForTimeout(800);
  const card = await page.locator('#canal-card').boundingBox();
  expect(card, 'the question card is up').toBeTruthy();
  const cardBox = { left: card!.x, top: card!.y, right: card!.x + card!.width, bottom: card!.y + card!.height };
  for (const button of await visibleUtilities(page)) expect(overlaps(button, cardBox), `utility button ${JSON.stringify(button)} on the question card`).toBe(false);
  await page.screenshot({ path: `artifacts/g7/phone-prompt.png` });
});

test('the arrival card keeps the whole destination name and nothing covers its actions', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await openRoute(page, { travelMode: 'car' });
  const result = await page.evaluate(name => {
    const game = (window as any).canalRecallGame;
    game.routeTo = { ...game.routeTo, name };
    Object.assign(game, { _shareUrl: 'https://example.test/route', quizCorrect: 2, quizAttempts: 4, quizPoints: 158 });
    game.state = 5; // FINISHED
    game._render();
    return { card: game._finishCardBounds, title: game._finishTitleLayout ?? null };
  }, LONG_NAME);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).canalRecallGame.state), 'still on the arrival card').toBe(5);
  expect(result.card, 'the arrival card was drawn').toBeTruthy();
  expect(result.title, 'the title layout is reported').toBeTruthy();
  expect(result.title.lines.join(' ')).toBe(LONG_NAME);
  const card = result.card as { x: number; y: number; w: number; h: number };
  const cardBox = { left: card.x, top: card.y, right: card.x + card.w, bottom: card.y + card.h };
  for (const button of await visibleUtilities(page)) expect(overlaps(button, cardBox), `utility button ${JSON.stringify(button)} on the arrival card`).toBe(false);
  await page.screenshot({ path: `artifacts/g7/phone-finish.png` });
});
