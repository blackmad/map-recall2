import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-29, "this card/highlight happens a
// little late — after I've already almost passed it"). The card opened 300 px
// from the landmark's centre, about a second before passing at cruise; it now
// looks ahead along the path, and replaces a street card that has been up.
test('a drive-by card opens seconds before the landmark, even over a street card', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'trigger logic; one project is enough');
  test.setTimeout(120000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const landmark = game.landmarks.find((l: any) => (l.detail || l.longDetail) && l.imageUrl) || game.landmarks[0];
    const others = game.landmarks.filter((l: any) => l !== landmark);
    for (const l of others) game._seenLandmarks.add(l.id);
    game._seenLandmarks.delete(landmark.id);
    const route = game.routePath;
    game.routePath = null;
    game.quizFeedback = null;
    Object.assign(game.player, { x: landmark.x - 700, y: landmark.y + 100, angle: 0, speed: 260 });
    // A street card that has been up for six seconds (PREEMPT_AFTER_SECONDS).
    game._showLandmarkNotice({ id: 'street:test', name: 'Teststraat', detail: 'A street.' }, { kind: 'timed', seconds: 8 }, 'street');
    game._landmarkNoticeState.elapsed = 6;
    game._updateLandmarks(1 / 60);
    const opened = game._landmarkNotice?.id;
    game.routePath = route;
    return { opened, wanted: landmark.id, source: game._landmarkNoticeSource, mode: game.viewport?.mode, gate: game._teachingGate(), seen: game._seenLandmarks.has(landmark.id) };
  });
  expect(result.opened, JSON.stringify(result)).toBe(result.wanted);
});
