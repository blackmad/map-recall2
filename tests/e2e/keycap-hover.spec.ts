import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// #301: the pause card's keycaps highlight on hover like the arrival card's (one drawer, keycapAction.ts).
// Desktop only: a phone has no keycaps.

/** Mean luma of a canvas region, logical units. */
async function luma(page: Page, b: { x: number; y: number; w: number; h: number }) {
  return page.evaluate(r => {
    const g = (window as any).canalRecallGame;
    const k = g.canvas.width / g.viewport.width;
    const d = g.ctx.getImageData(Math.round(r.x * k), Math.round(r.y * k), Math.round(r.w * k), Math.round(r.h * k)).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return s / (d.length / 4);
  }, b);
}

test('pause card keycap darkens under the mouse', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'keycaps are desktop only');
  await openRoute(page);
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.hud.hoverPoint = null; g.state = 6; });
  await page.waitForFunction(() => !!(window as any).canalRecallGame._pauseButtonBounds?.length, null, { timeout: 10_000 });
  const box = await page.evaluate(() => (window as any).canalRecallGame._pauseButtonBounds[0] as { x: number; y: number; w: number; h: number });
  // The keycap itself: the left 40 px of the action, mid-height.
  const cap = { x: box.x + 2, y: box.y + 8, w: 30, h: 12 };
  await page.waitForTimeout(300);
  const before = await luma(page, cap);
  await page.screenshot({ path: 'artifacts/ui-debts/pause-before.png' });
  await page.evaluate(b => { (window as any).canalRecallGame.hud.hoverPoint = { x: b.x + 10, y: b.y + 10 }; }, box);
  await page.waitForTimeout(300);
  const after = await luma(page, cap);
  await page.screenshot({ path: 'artifacts/ui-debts/pause-hover.png' });
  console.log('pause keycap luma', JSON.stringify({ before, after }));
  expect(after, 'the hovered keycap is darker').toBeLessThan(before - 3);
});
