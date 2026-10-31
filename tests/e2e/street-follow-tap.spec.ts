import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { openRoute } from './helpers';

// A phone player taps. Street following stops where there is no straight on
// and waits for a side (streetFollow.ts); L1's iPhone profile found that a tap
// of a turn button there only queued the turn and the rider stood still — only
// holding the button went (a pivot after 0.6 s). The seeded route of
// engine-own.spec's ride() spawns the iPhone rider across Polonceaukade facing
// north, so it waits from the first frame. One real touch tap on the pad's
// right button must now commit the turn and ride, also when the tap starts and
// ends between two frames (input.js latches it for one frame).

type View = { x: number; y: number; speed: number; waiting: boolean; queued: number; parked: boolean; mode: string; pad: string };
const view = (page: Page) => page.evaluate((): View => {
  const g = (window as any).canalRecallGame;
  const v = g.player.streetFollowView;
  return { x: g.player.x, y: g.player.y, speed: g.player.speed, waiting: !!v?.awaitingChoice, queued: v?.queuedTurn ?? 0, parked: !!v?.parked, mode: g.player.controlMode, pad: g.input.padMode };
});

/** The centre of a street-pad button, in client px, for a real touch. */
const padButton = (page: Page, button: 'left' | 'right' | 'back') => page.evaluate((name) => {
  const g = (window as any).canalRecallGame;
  const rect = (window as any).CanalRecallUi.streetPadRects(g.input.dpad)[name];
  const canvas = document.getElementById('gameCanvas')!.getBoundingClientRect();
  const w = (window as any).CANVAS_W ?? canvas.width, h = (window as any).CANVAS_H ?? canvas.height;
  return { x: canvas.left + (rect.x + rect.width / 2) * canvas.width / w, y: canvas.top + (rect.y + rect.height / 2) * canvas.height / h };
}, button);

/** A touch that starts and ends in one task: shorter than a frame. */
const quickTap = (page: Page, at: { x: number; y: number }) => page.touchscreen.tap(at.x, at.y);

async function spawn(page: Page): Promise<View> {
  test.skip(test.info().project.name !== 'iphone', 'the touch pad is the iPhone profile');
  // BUNDLES_DIR=<dir>: serve *.bundle.js from a local build (a lane's source change before the integrator rebuilds).
  const bundles = process.env.BUNDLES_DIR;
  if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = `${bundles}/${/\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]}`;
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await openRoute(page, { query: '?engine=own', viewMode: 'chase' });
  const start = await view(page);
  expect(start.mode, 'street following on the phone').toBe('street');
  expect(start.pad, 'the street-follow pad').toBe('street');
  return start;
}

test('iPhone: one tap of a turn button at the seeded spawn sets the rider off', async ({ page }) => {
  test.setTimeout(150_000);
  const start = await spawn(page);
  await quickTap(page, await padButton(page, 'right'));
  await expect.poll(async () => { const v = await view(page); return Math.hypot(v.x - start.x, v.y - start.y); }, { timeout: 5000, message: 'the rider moves after a single tap' }).toBeGreaterThan(30);
  const after = await view(page);
  expect(after.waiting, 'no longer waiting for a side').toBe(false);
  expect(after.parked).toBe(false);
});

test('iPhone: waiting for a side, a single tap commits the turn (a hold is not needed)', async ({ page }) => {
  test.setTimeout(150_000);
  const start = await spawn(page);
  // Set off with the up arrow, as engine-own's ride() does: the spawn faces
  // across the street, so the rider stops at once and waits for a side.
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await view(page)).waiting, { timeout: 5000 }).toBe(true);
  await page.waitForTimeout(800);
  const waiting = await view(page);
  expect(Math.hypot(waiting.x - start.x, waiting.y - start.y), 'still at the spawn').toBeLessThan(2);
  expect(Math.abs(waiting.speed)).toBeLessThan(1);
  await quickTap(page, await padButton(page, 'right'));
  await expect.poll(async () => { const v = await view(page); return Math.hypot(v.x - waiting.x, v.y - waiting.y); }, { timeout: 5000, message: 'the rider moves after a single tap' }).toBeGreaterThan(30);
  const after = await view(page);
  expect(after.waiting).toBe(false);
  expect(after.queued, 'the tap was spent on the turn, not left queued').toBe(0);
});
