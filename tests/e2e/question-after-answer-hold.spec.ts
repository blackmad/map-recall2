import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user reports 2026-10-01, "I just got stuck on a bridge
// again", Sint Antoniessluis; "just got stuck on here" by the Koepelkerk). A
// question freezes the bike until it is answered. Answering starts a hold
// whose timer hides the card; crossing a bridge during the hold opened the
// bridge question, and the stale timer then hid its card. The bike stood on
// the bridge behind a question nobody could see. Pure simulations stubbed the
// quiz, so they never saw it.
test('a question opened during the last answer hold stays on screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'quiz timing; one project is enough');
  test.setTimeout(120000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  const ask = (name: string) => page.evaluate((name) => {
    const game = (window as any).canalRecallGame;
    game._openQuizPrompt({ kind: 'bridge', name, subject: 'bridge', question: 'Which bridge is this?', context: 'Crossing a bridge', choices: [name, 'Magere Brug', 'Blauwbrug'] });
  }, name);
  await ask('Sint Antoniessluis');
  // A wrong answer holds longest (ANSWER_HOLD_WRONG, 3.2 s).
  await page.evaluate(() => (window as any).canalRecallGame._submitCanalAnswer('Magere Brug'));
  await page.waitForTimeout(500);
  await ask('Hoogesluis');
  await page.waitForTimeout(4000);
  const state = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    return { pending: game.quizPromptName, display: getComputedStyle(document.getElementById('canal-prompt')!).display };
  });
  expect(state.pending).toBe('Hoogesluis');
  expect(state.display, 'the pending question is visible, not hidden by the old hold').not.toBe('none');

  // And if anything else hides it, the game loop shows it again.
  await page.evaluate(() => { document.getElementById('canal-prompt')!.style.display = 'none'; });
  await page.waitForTimeout(300);
  const reshown = await page.evaluate(() => getComputedStyle(document.getElementById('canal-prompt')!).display);
  expect(reshown).not.toBe('none');
});
