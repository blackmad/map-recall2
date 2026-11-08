import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// #278: desktop mouse clicks on the arrival card's keycaps. The card is drawn on the canvas in logical units
// (CANVAS_W × CANVAS_H); on desktop the canvas is scaled to the window (1280 × 800 drawn at 1440 × 900, scale
// 1.125), so a keycap's screen position is its bounds × rect.width / CANVAS_W. Clicking `_finishButtonBounds`
// as if they were CSS pixels lands ~80 px above the row: that is how G1's probe (#271) concluded clicks "do not
// reach the canvas". This spec moves the real mouse over each keycap (cursor and hover state), clicks it, and
// checks the action happened: Share, Next stop, End run (the run card), New run, and Route setup.

type Bounds = { x: number; y: number; w: number; h: number; id: string };

const shot = (name: string) => `artifacts/keycaps/${name}.png`;

async function arrive(page: Page) {
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    if (g.routeTo.reviewStop) g.routeTo = { ...g.routeTo, reviewStop: undefined };
    g.player.x = g.track.finishPoint.x;
    g.player.y = g.track.finishPoint.y;
    g.player.speed = 0;
  });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 5, null, { timeout: 60_000 });
  await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
  await page.waitForTimeout(400);
}

/** Screen (CSS px) centre of an action's hit box, mapped from canvas units through the canvas rect. */
async function keycapCentre(page: Page, id: string) {
  return page.evaluate(want => {
    const g = (window as any).canalRecallGame;
    const rect = g.canvas.getBoundingClientRect();
    const kx = rect.width / (0, eval)('CANVAS_W'), ky = rect.height / (0, eval)('CANVAS_H');
    const b = (g._finishButtonBounds as Bounds[]).find(bounds => bounds.id === want);
    return b ? { x: rect.left + (b.x + b.w / 2) * kx, y: rect.top + (b.y + b.h / 2) * ky } : null;
  }, id);
}

/** Hover the keycap (the cursor says it is clickable), optionally screenshot, then click it with the mouse. */
async function clickKeycap(page: Page, id: string, hoverShot?: string) {
  const at = await keycapCentre(page, id);
  expect(at, `${id} keycap drawn`).toBeTruthy();
  await page.mouse.move(at!.x - 30, at!.y);
  await page.mouse.move(at!.x, at!.y, { steps: 3 });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).canalRecallGame.canvas.style.cursor), `${id}: pointer cursor`).toBe('pointer');
  if (hoverShot) await page.screenshot({ path: shot(hoverShot) });
  await page.mouse.down();
  await page.mouse.up();
}

test('desktop: every arrival-card keycap answers a mouse click', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'phones tap the full-width buttons (mobile-overlays, chained-run)');
  test.setTimeout(420_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await arrive(page);
  // Share opens the OS share sheet or the clipboard; count the call instead.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    (window as any).__shared = 0;
    g._shareRoute = () => { (window as any).__shared += 1; };
  });
  const first = await page.evaluate(() => (window as any).canalRecallGame._finishButtonBounds.map((b: Bounds) => b.id));
  expect(first).toEqual(['again', 'route', 'copy', 'end']);

  // Share this route.
  await clickKeycap(page, 'copy', 'hover-share');
  await expect.poll(() => page.evaluate(() => (window as any).__shared)).toBe(1);
  expect(await page.evaluate(() => (window as any).canalRecallGame.state)).toBe(5);

  // Next stop deals the run's next leg and rides it.
  const before = await page.evaluate(() => (window as any).canalRecallGame.routeTo.id);
  await clickKeycap(page, 'again');
  await page.waitForFunction(() => (window as any).canalRecallGame.state !== 5, null, { timeout: 30_000 });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  const leg = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return { from: g.routeFrom.id, to: g.routeTo.id };
  });
  expect(leg.from).toBe(before);
  expect(leg.to).not.toBe(before);

  // End run: the run card replaces the arrival card.
  await arrive(page);
  await clickKeycap(page, 'end', 'hover-end-run');
  await page.waitForFunction(() => !!(window as any).canalRecallGame._runCard, null, { timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot('after-end-run') });
  expect(await page.evaluate(() => (window as any).canalRecallGame._finishButtonBounds.map((b: Bounds) => b.id))).toEqual(['again', 'route']);

  // New run from the run card, then Route setup from the next arrival card.
  await clickKeycap(page, 'again');
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  await arrive(page);
  await clickKeycap(page, 'route');
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 0, null, { timeout: 10_000 });
});
