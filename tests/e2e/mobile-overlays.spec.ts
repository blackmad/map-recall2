// The phone overlays: the recall question, the arrival card, and the utility
// panels. None of these were reachable by the `iphone` project until the page
// stopped overflowing horizontally (see HISTORY.md, item 14b), so none of them
// had ever been exercised at a phone's size.
//
// These assert the two properties the driving screen's layout suite cannot,
// because they are DOM overlays over a canvas: that an overlay never covers the
// controls or the answer, and that every action on a phone is reachable by
// touch rather than by a key a phone does not have.

import { expect, Page, test } from '@playwright/test';

type OverlayGame = {
  state: number;
  player: { x: number; y: number } | null;
  viewport: { width: number; height: number; mode: string };
  routeOptions: { answerMode: string };
  hud: { drawDpad: (...args: unknown[]) => void };
  _finishButtonBounds?: Array<{ x: number; y: number; w: number; h: number; id: string }>;
  _overlayOpen: () => boolean;
  _openQuizPrompt: (options: Record<string, unknown>) => void;
  _render: () => void;
  _shareUrl: string | null;
};

declare global {
  interface Window { canalRecallGame: OverlayGame }
}

// Only the phone project cares: the desktop layout has no d-pad and keeps its
// keyboard actions.
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'phone-only overlay behaviour');
});

async function drive(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let seed = 0x5eed1234;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  await page.locator('#travel-mode').selectOption('car');
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.player?.x)),
    { timeout: 90_000 }).toBe(true);
  await page.evaluate(() => { window.canalRecallGame.state = 4; });
}

/** Did this frame draw the d-pad? */
async function padDrawn(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const game = window.canalRecallGame;
    let drawn = false;
    const original = game.hud.drawDpad.bind(game.hud);
    game.hud.drawDpad = ((...args: unknown[]) => { drawn = true; return original(...args); }) as typeof game.hud.drawDpad;
    try { game._render(); } finally { game.hud.drawDpad = original; }
    return drawn;
  });
}

test('the phone gets a compact layout and a d-pad while driving', async ({ page }) => {
  await drive(page);
  expect(await page.evaluate(() => window.canalRecallGame.viewport.mode)).toBe('compact');
  expect(await padDrawn(page), 'the d-pad is the only way to steer').toBe(true);
});

test('a recall question hides the d-pad and leaves the vehicle visible', async ({ page }) => {
  await drive(page);
  await page.evaluate(() => {
    const game = window.canalRecallGame;
    game.routeOptions.answerMode = 'multiple';
    game._openQuizPrompt({
      kind: 'route', name: 'Prinsengracht', subject: 'water',
      question: 'Which canal are you on?', context: 'Following it since the Westerkerk.',
      choices: ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Brouwersgracht'],
    });
  });
  await expect(page.locator('#canal-card')).toBeVisible();

  // The vehicle is stopped behind the card, so a pad under it is dead controls.
  expect(await page.evaluate(() => window.canalRecallGame._overlayOpen())).toBe(true);
  expect(await padDrawn(page), 'no d-pad is drawn under the question card').toBe(false);

  // Being asked which canal you are on while the card covers the canal you are
  // on is the one thing this screen must not do. The vehicle sits at the centre
  // of the screen, so the card has to start below it.
  const { cardTop, centreY } = await page.evaluate(() => ({
    cardTop: document.querySelector('#canal-card')!.getBoundingClientRect().top,
    centreY: window.innerHeight / 2,
  }));
  expect(cardTop, 'the question card starts below the vehicle').toBeGreaterThan(centreY);

  // All four answers are reachable, at a real touch size.
  const choices = page.locator('#canal-choices button');
  await expect(choices).toHaveCount(4);
  for (let index = 0; index < 4; index++) {
    const box = (await choices.nth(index).boundingBox())!;
    expect(box.height, `choice ${index + 1} is a real touch target`).toBeGreaterThanOrEqual(40);
    expect(box.y + box.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight) + 1);
  }
});

test('the arrival card offers tappable actions, not keys a phone does not have', async ({ page }) => {
  await drive(page);
  const buttons = await page.evaluate(() => {
    const game = window.canalRecallGame;
    game._shareUrl = 'https://example.test/route';
    game.state = 5; // FINISHED
    game._render();
    return game._finishButtonBounds ?? [];
  });
  expect(buttons.map(button => button.id)).toEqual(['again', 'route', 'copy']);
  const viewport = await page.evaluate(() => window.canalRecallGame.viewport);
  for (const button of buttons) {
    expect(button.h, `${button.id} is a real touch target`).toBeGreaterThanOrEqual(44);
    expect(button.x, `${button.id} starts on screen`).toBeGreaterThanOrEqual(0);
    expect(button.x + button.w, `${button.id} ends on screen`).toBeLessThanOrEqual(viewport.width);
    expect(button.y + button.h, `${button.id} is above the bottom edge`).toBeLessThanOrEqual(viewport.height);
  }
});

test('the settings panel keeps its Done button on screen', async ({ page }) => {
  await drive(page);
  await page.locator('#open-settings').click();
  const done = page.locator('#settings-panel .utility-close');
  await expect(done).toBeVisible();
  const box = (await done.boundingBox())!;
  const height = await page.evaluate(() => window.innerHeight);
  // It used to be clipped off the bottom of an over-tall centred card.
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await done.click();
  await expect(page.locator('#settings-panel')).toBeHidden();
});
