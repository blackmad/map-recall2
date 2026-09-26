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
import { openRoute } from './helpers';

type OverlayGame = {
  state: number;
  player: { x: number; y: number } | null;
  viewport: { width: number; height: number; mode: string };
  routeOptions: { answerMode: string };
  hud: { drawStick: (...args: unknown[]) => void };
  input: { dpad: { cx: number; cy: number } | null };
  canvas: HTMLCanvasElement;
  camera: { rotation: number };
  _finishButtonBounds?: Array<{ x: number; y: number; w: number; h: number; id: string }>;
  _overlayOpen: () => boolean;
  _openQuizPrompt: (options: Record<string, unknown>) => void;
  _render: () => void;
  _shareUrl: string | null;
};

declare global {
  interface Window { canalRecallGame: OverlayGame }
  /** Logical canvas width: a top-level `let` in constants.js, not a window property. */
  const CANVAS_W: number;
}

// Only the phone project cares: the desktop layout has no d-pad and keeps its
// keyboard actions.
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'phone-only overlay behaviour');
});

async function drive(page: Page): Promise<void> {
  await openRoute(page, { travelMode: 'car' });
}

/** Did this frame draw the thumbstick? */
async function padDrawn(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const game = window.canalRecallGame;
    let drawn = false;
    const original = game.hud.drawStick.bind(game.hud);
    game.hud.drawStick = ((...args: unknown[]) => { drawn = true; return original(...args); }) as typeof game.hud.drawStick;
    try { game._render(); } finally { game.hud.drawStick = original; }
    return drawn;
  });
}

test('the phone gets a compact layout and a thumbstick while driving', async ({ page }) => {
  await drive(page);
  expect(await page.evaluate(() => window.canalRecallGame.viewport.mode)).toBe('compact');
  expect(await padDrawn(page), 'the stick is the only way to steer').toBe(true);
});

test('a recall question hides the stick and leaves the vehicle visible', async ({ page }) => {
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
  expect(await padDrawn(page), 'no stick is drawn under the question card').toBe(false);

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

// Named regression (2026-09-26): on a phone the setup rail clipped Difficulty
// exactly at its label, so nothing said the list went on — and the backdrop
// photo spent a sixth of the screen below Start.
test('phone setup shows every main choice above Start, and says when it scrolls', async ({ page }) => {
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  const fits = await page.evaluate(() => {
    const scroll = document.querySelector('.enamel-setup-scroll')!.getBoundingClientRect();
    const hard = document.querySelector('[data-choice="difficulty:hard"]')!.getBoundingClientRect();
    return { hardBottom: hard.bottom, scrollBottom: scroll.bottom };
  });
  expect(fits.hardBottom, 'Difficulty is fully visible above the Start footer').toBeLessThanOrEqual(fits.scrollBottom);
  await expect(page.locator('.enamel-setup-vista')).toBeHidden();

  // A shorter phone overflows: the cue appears and goes away at the end.
  await page.setViewportSize({ width: 360, height: 560 });
  const cue = page.locator('.setup-scroll-cue');
  await expect(cue).toBeVisible();
  await page.locator('.enamel-setup-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(cue).toBeHidden();
});

// Named regression (2026-09-26): "even in absolute mode I can't reliably go
// east". Touch auto-throttle turned a rightward press into north-east.
test('absolute mode: holding the stick right drives due east', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({ controlMode: 'absolute' }));
  });
  await drive(page);
  const origin = await page.evaluate(() => {
    const game = window.canalRecallGame;
    const pad = game.input.dpad!;
    const rect = game.canvas.getBoundingClientRect();
    // Stick coordinates are logical canvas units (CANVAS_W), not backing pixels.
    const scale = rect.width / CANVAS_W;
    return { x: rect.left + pad.cx * scale, y: rect.top + pad.cy * scale, rotation: game.camera.rotation };
  });
  expect(Math.abs(origin.rotation), 'absolute mode holds the map north-up').toBeLessThan(0.01);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: origin.x, y: origin.y, id: 1 }] });
  for (let step = 1; step <= 4; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: origin.x + step * 25, y: origin.y, id: 1 }] });
  }
  await page.waitForTimeout(1500);
  const heading = await page.evaluate(() => {
    const player = window.canalRecallGame.player as unknown as { angle: number };
    return Math.atan2(Math.sin(player.angle), Math.cos(player.angle));
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // Road assist may bend it along a street within 55° of east; never north-east
  // by construction, and never a quarter-turn off.
  expect(Math.abs(heading), `heading ${heading.toFixed(2)} rad is eastward`).toBeLessThan((55 * Math.PI) / 180);
});
