import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression, feedback d18eca (2026-11-13, "why is START still hanging out in the sky?"; also in c361c8,
// 47d096, 62d5a3): the START tag was drawn for the whole ride. Once the start lay behind the chase camera its
// projection landed mirrored above the horizon, so the tag rode along at the top edge of the screen.
// Now the tag goes once the rider is 50 m on or the first question is up (StartTagLatch, vehicleScreenBox.ts), and a
// screen label whose point is behind the camera or past the far plane is not drawn (projectWorld's offView).
// A guided ride: Free Ride hides the tag anyway.

const state = (page: Page) => page.evaluate(() => {
  const g = (window as any).canalRecallGame, t = g.track;
  const s = g.camera.worldToScreen(t.startPoint.x, t.startPoint.y);
  const metres = Math.hypot(g.player.x - t.startPoint.x, g.player.y - t.startPoint.y) / 3;
  return {
    gone: !!t.startTagGone, box: t._lastStartTagBox, start: { x: s.x, y: s.y, offView: !!s.offView },
    metres, asked: g.quizAttempts > 0 || !!g.quizPromptName, engine: g.vectorMap.engine || 'maplibre',
  };
});

test('the START tag stays at the start and never hangs in the sky (d18eca)', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await openRoute(page, { viewMode: 'chase' });
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap.isPlayerBikeReady?.(), null, { timeout: 120_000 });
  await page.waitForTimeout(1500);

  const atStart = await state(page);
  await page.screenshot({ path: testInfo.outputPath('start-tag-at-start.png') });
  console.log(JSON.stringify({ atStart }));
  if (!atStart.asked) {
    expect(atStart.gone, 'at the start, before any question, the tag is up').toBe(false);
    expect(atStart.box, 'and drawn').not.toBeNull();
  }

  // 120 m on along the heading, the start now behind the camera; hold the rider still there.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame, p = g.player, d = 120 * 3;
    p.x += Math.cos(p.angle) * d; p.y += Math.sin(p.angle) * d; p.speed = 0;
  });
  await page.waitForTimeout(2500);
  const on = await state(page);
  await page.screenshot({ path: testInfo.outputPath('start-tag-120m-on.png') });
  console.log(JSON.stringify({ on }));
  expect(on.metres).toBeGreaterThan(50);
  expect(on.gone, '50 m on, the tag is gone').toBe(true);
  expect(on.box, 'and not drawn').toBeNull();

  // Riding back does not bring it back.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame, p = g.player, s = g.track.startPoint;
    p.x = s.x; p.y = s.y; p.speed = 0;
  });
  await page.waitForTimeout(1500);
  const back = await state(page);
  console.log(JSON.stringify({ back }));
  expect(back.gone).toBe(true);
  expect(back.box).toBeNull();
});

test('a screen label point behind the chase camera is off view (d18eca)', async ({ page }) => {
  test.setTimeout(240_000);
  await openRoute(page, { viewMode: 'chase' });
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap.isPlayerBikeReady?.(), null, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = (window as any).canalRecallGame, p = g.player;
    const at = (m: number) => { const s = g.camera.worldToScreen(p.x + Math.cos(p.angle) * m * 3, p.y + Math.sin(p.angle) * m * 3); return { x: s.x, y: s.y, offView: !!s.offView }; };
    return { ahead: at(30), behind: at(-300), pitched: !!g.camera.projector };
  });
  console.log(JSON.stringify(r));
  expect(r.pitched, 'the chase view projects through the 3D camera').toBe(true);
  expect(r.ahead.offView, '30 m ahead is in view').toBe(false);
  expect(r.behind.offView, '300 m behind is off view').toBe(true);
});
