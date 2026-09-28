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

/** Mid-ride the settings/help buttons are tucked away; a tap on the map
 *  (clear of the stick) brings them up, as a player would. */
async function openSettings(page: Page): Promise<void> {
  const utility = page.locator('#utility-buttons');
  // The route can still be settling right after spawn, so reveal and tap as
  // one retried step rather than trusting a single reveal.
  await expect(async () => {
    if (await utility.evaluate(el => el.classList.contains('tucked'))) await page.touchscreen.tap(195, 260);
    await page.locator('#open-settings').click({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
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
  await openSettings(page);
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

// Named regression (2026-09-26): in-ride settings were a column of native
// selects and bare checkboxes, unlike the tile buttons of route setup. Both now
// render the same RideOptions, so the panel has tiles and no dropdowns.
test('ride settings use the same tile buttons as route setup', async ({ page }) => {
  await drive(page);
  await openSettings(page);
  const panel = page.locator('#settings-panel');
  await expect(panel.locator('select')).toHaveCount(0);
  const point = panel.locator('[data-choice="live-controls:absolute"]');
  await point.click();
  await expect(point).toHaveClass(/active/);
  await expect(page.locator('#route-setup [data-choice="controls:absolute"]')).toHaveClass(/active/);
  const minimap = panel.locator('label.toggle-tile', { has: page.locator('#live-minimap') });
  const wasOn = await page.locator('#live-minimap').isChecked();
  await minimap.click();
  await expect(page.locator('#live-minimap')).toBeChecked({ checked: !wasOn });
  await expect(minimap).toHaveClass(wasOn ? /^(?!.*active)/ : /active/);
});

// Named regression (2026-09-26): on a phone the setup rail clipped Difficulty
// exactly at its label, so nothing said the list went on — and the backdrop
// photo spent a sixth of the screen below Start.
test('phone setup shows every main choice above Start, and says when it scrolls', async ({ page }) => {
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  const fits = await page.evaluate(() => {
    const scroll = document.querySelector('#route-setup .enamel-setup-scroll')!.getBoundingClientRect();
    const hard = document.querySelector('[data-choice="difficulty:hard"]')!.getBoundingClientRect();
    return { hardBottom: hard.bottom, scrollBottom: scroll.bottom };
  });
  expect(fits.hardBottom, 'Difficulty is fully visible above the Start footer').toBeLessThanOrEqual(fits.scrollBottom);
  await expect(page.locator('.enamel-setup-vista')).toBeHidden();

  // A shorter phone overflows: the cue appears and goes away at the end.
  await page.setViewportSize({ width: 360, height: 560 });
  const cue = page.locator('#route-setup .setup-scroll-cue');
  await expect(cue).toBeVisible();
  await page.locator('#route-setup .enamel-setup-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
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

// Named regression (UI review 2026-09-26): a wrong answer was one amber line
// (~1.7:1 on paper) below the choices — under the fold in landscape — and the
// buttons never showed which was right. The miss is the lesson.
test('a wrong answer marks the right choice and puts readable feedback under the question', async ({ page }) => {
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
  await page.locator('#canal-choices button', { hasText: 'Keizersgracht' }).click();
  await expect(page.locator('#canal-card')).toHaveClass(/answered/);
  await expect(page.locator('#canal-choices button.is-correct')).toHaveText(/Prinsengracht/);
  await expect(page.locator('#canal-choices button.is-wrong')).toHaveText(/Keizersgracht/);
  const layout = await page.evaluate(() => {
    const feedback = document.querySelector('#canal-feedback')!;
    const heading = document.querySelector('#canal-card h2')!;
    const choices = document.querySelector('#canal-choices')!;
    const colour = getComputedStyle(feedback).color;
    return {
      text: feedback.textContent,
      colour,
      afterHeading: heading.getBoundingClientRect().bottom <= feedback.getBoundingClientRect().top,
      beforeChoices: feedback.getBoundingClientRect().bottom <= choices.getBoundingClientRect().top,
    };
  });
  expect(layout.text).toContain('Prinsengracht');
  expect(layout.afterHeading && layout.beforeChoices, 'feedback sits between the question and the choices').toBe(true);
  expect(layout.colour, 'feedback is the dark copper ink, not the old amber').toBe('rgb(138, 74, 24)');
});

// Named regression (UI review 2026-09-26): the phone HUD could latch the
// pre-settle 980 px layout and draw everything at ~47% (5 px text), and the
// pause card was 78% black with an invisible "New route" caption.
test('the phone HUD lays out for the real screen, and pause is a paper card', async ({ page }) => {
  await drive(page);
  const sizes = await page.evaluate(() => ({
    viewportCss: (window.canalRecallGame.viewport as unknown as { cssWidth: number }).cssWidth,
    inner: window.innerWidth,
  }));
  expect(sizes.viewportCss, 'the HUD is laid out for the settled window width').toBe(sizes.inner);

  const centre = await page.evaluate(() => {
    const game = window.canalRecallGame as unknown as { state: number; canvas: HTMLCanvasElement; _render(): void };
    game.state = (window as unknown as { GameState?: { PAUSED: number } }).GameState?.PAUSED
      ?? (0, eval)('GameState.PAUSED');
    game._render();
    const ctx = game.canvas.getContext('2d')!;
    const [r, g, b] = ctx.getImageData(Math.round(game.canvas.width / 2), Math.round(game.canvas.height / 2) - 20, 1, 1).data;
    return (r + g + b) / 3;
  });
  expect(centre, 'the pause card is light paper, not a black plate').toBeGreaterThan(200);
});

// Named regressions (UI review leftovers, 2026-09-26).
test('the city field is one 44px tap target', async ({ page }) => {
  await page.goto('/canal-drive/');
  const field = page.locator('.setup-city-select');
  await expect(field).toBeVisible();
  const fieldBox = (await field.boundingBox())!;
  const selectBox = (await page.locator('#city-id').boundingBox())!;
  expect(fieldBox.height).toBeGreaterThanOrEqual(44);
  expect(selectBox.height, 'the select covers the whole field').toBeGreaterThanOrEqual(fieldBox.height - 2);
  expect(selectBox.width).toBeGreaterThanOrEqual(fieldBox.width - 2);
});

test('the knowledge review opens mid-ride and returns to the ride', async ({ page }) => {
  await drive(page);
  await openSettings(page);
  await page.locator('#live-knowledge-button').click();
  const review = page.locator('#knowledge-review');
  await expect(review).toBeVisible();
  await expect(review.locator('.knowledge-back')).toHaveText(/Back to ride/);
  await page.keyboard.press('Escape');
  await expect(review).toHaveCount(0);
  // Its Escape belongs to it: the settings under it stay open.
  await expect(page.locator('#settings-panel')).toBeVisible();
  await expect(page.locator('#live-knowledge-button')).toBeFocused();
});

test('a landscape phone docks the question beside the vehicle, not under it', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await drive(page);
  await page.evaluate(() => {
    const game = window.canalRecallGame;
    game.routeOptions.answerMode = 'multiple';
    game._openQuizPrompt({
      kind: 'route', name: 'Prinsengracht', subject: 'water',
      question: 'Which canal are you on?', context: '',
      choices: ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Brouwersgracht'],
    });
  });
  const card = (await page.locator('#canal-card').boundingBox())!;
  expect(card.width, 'a side card, not a full-width sheet').toBeLessThanOrEqual(844 * 0.5);
  const centreX = 844 / 2;
  expect(card.x >= centreX || card.x + card.width <= centreX, 'the card clears the vehicle at the centre').toBe(true);
  expect(card.y + card.height).toBeLessThanOrEqual(391);
});

// Named regression (2026-09-27): on a phone the next question's choices came up
// with one already tinted. Touch leaves `:hover` latched at the last tap point,
// so the fresh button under the finger read as a highlighted answer before any
// pick. Every choice must look alike until you answer.
test('a new question shows every choice alike, with no hover left over from the last tap', async ({ page }) => {
  await drive(page);
  const ask = (name: string, choices: string[]) => page.evaluate(({ name, choices }) => {
    const game = window.canalRecallGame;
    game.routeOptions.answerMode = 'multiple';
    game._openQuizPrompt({
      kind: 'route', name, subject: 'water',
      question: 'Which canal are you on?', context: 'Following it.',
      choices,
    });
  }, { name, choices });
  const names = ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Brouwersgracht'];
  await ask('Prinsengracht', names);
  const tapped = page.locator('#canal-choices button', { hasText: 'Keizersgracht' });
  const box = (await tapped.boundingBox())!;
  await tapped.tap();
  await expect(page.locator('#canal-card')).toHaveClass(/answered/);
  // iOS Safari keeps `:hover` at the lifted finger; emulated Chromium does
  // not, so park the pointer there to stand in for it.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // Ask again: a fresh button always lands under the last tap point.
  for (let round = 0; round < 4; round++) {
    await ask('Herengracht', names);
    const looks = await page.locator('#canal-choices button').evaluateAll(buttons => buttons.map(button => {
      const style = getComputedStyle(button);
      return `${style.backgroundColor}|${style.borderColor}|${style.color}`;
    }));
    expect(new Set(looks).size, `round ${round}: ${looks.join(', ')}`).toBe(1);
  }
});

// Named regression (user request 2026-09-28, "hide these controls by
// default"): the settings/help buttons sat over the corridor for the whole
// ride. They are tucked while riding and come back on a tap on the map.
test('settings and help stay tucked while riding until the map is tapped', async ({ page }) => {
  await drive(page);
  const utility = page.locator('#utility-buttons');
  await expect(utility).toHaveClass(/tucked/);
  expect(await utility.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  await page.touchscreen.tap(195, 260);
  await expect(utility).not.toHaveClass(/tucked/);
  await expect(utility).toHaveClass(/tucked/, { timeout: 6000 });
});

// Named regression (user report 2026-09-28, "can't really turn around").
// Measured before: full left for 3 s turned 12° and locked off the street;
// pulling back reversed in circles. Now full lock turns right round within
// the street, and straight back stops and swings the bike 180° without
// ever rolling backwards.
test('relative stick: full lock turns right round, and pulling back turns about without reversing', async ({ page }) => {
  await drive(page);
  // A question opening mid-turn freezes the bike; this is about steering.
  await page.evaluate(() => {
    const game = window.canalRecallGame as unknown as Record<string, unknown>;
    game._updateCanalQuiz = () => {};
    game._updateBridgeQuiz = () => {};
  });
  const cdp = await page.context().newCDPSession(page);
  const origin = await page.evaluate(() => {
    const game = window.canalRecallGame;
    const pad = game.input.dpad!;
    const rect = game.canvas.getBoundingClientRect();
    const scale = rect.width / CANVAS_W;
    const ui = (window as unknown as { CanalRecallUi: { stickRadius: (p: unknown) => number } }).CanalRecallUi;
    return { x: rect.left + pad.cx * scale, y: rect.top + pad.cy * scale, r: ui.stickRadius(pad) * scale };
  });
  const heading = () => page.evaluate(() => (window.canalRecallGame.player as unknown as { angle: number }).angle);
  const speed = () => page.evaluate(() => (window.canalRecallGame.player as unknown as { speed: number }).speed);
  const hold = async (dx: number, dy: number, ms: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: origin.x, y: origin.y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: origin.x + dx * origin.r, y: origin.y + dy * origin.r, id: 1 }] });
    let turned = 0, last = await heading(), slowest = Infinity;
    for (let t = 0; t < ms; t += 100) {
      await page.waitForTimeout(100);
      const now = await heading();
      turned += Math.atan2(Math.sin(now - last), Math.cos(now - last));
      last = now;
      slowest = Math.min(slowest, await speed());
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return { turned: Math.abs(turned) * 180 / Math.PI, slowest };
  };
  await hold(0, -0.6, 1500); // get moving
  const lock = await hold(-1, 0, 3500);
  expect(lock.turned, 'full lock keeps turning instead of locking to the street').toBeGreaterThan(150);
  const about = await hold(0, 1, 2500);
  expect(about.turned, 'straight back swings the bike round').toBeGreaterThan(120);
  expect(about.slowest, 'and never rolls it backwards').toBeGreaterThanOrEqual(0);
});
