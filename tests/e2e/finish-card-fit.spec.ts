// The arrival card must fit the window it is drawn in.
//
// User report 2026-10-02 (De Dolphijn on a laptop): with a photo, a ribbon,
// first-time gains, a sign-in tease and a personal best all on the card, its
// Next route / Share actions ran off the bottom of the screen. The card now
// tightens its spacing and prose in steps, and scales only as a last resort.

import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

type FinishGame = {
  state: number;
  viewport: { width: number; height: number };
  _render: () => void;
  _finishCardBounds?: { x: number; y: number; w: number; h: number };
  [key: string]: unknown;
};

declare global {
  interface Window { canalRecallGame: FinishGame }
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop window sizes');
});

for (const size of [{ width: 1440, height: 700 }, { width: 1280, height: 600 }]) {
  test(`a full arrival card fits a ${size.width}x${size.height} window`, async ({ page }) => {
    await page.setViewportSize(size);
    await openRoute(page);
    const result = await page.evaluate(() => {
      const game = window.canalRecallGame;
      window.localStorage.setItem('satb_bestTimes', JSON.stringify({ 'fit-check': { time: 9999 } }));
      Object.assign(game, {
        _raceKey: 'fit-check',
        _shareUrl: 'https://example.test/route',
        quizCorrect: 4, quizAttempts: 5, quizPoints: 370, quizBestStreak: 3,
        _explorationRouteGain: { newNames: 2, newNeighborhoods: 0, newLandmarks: 1 },
        _explorationSnapshot: {
          totalRoutes: 3, learnedWaterways: new Array(22).fill('w'), learnedStreets: [],
          learnedTransitLines: [], learnedTransitStops: [],
          visitedNeighborhoods: new Array(13).fill('n'), seenLandmarks: new Array(23).fill('l'),
        },
        _ribbon: {
          id: 'bronze', label: 'BRONZE RIBBON', color: '#D9A05B', dim: 'rgba(217,160,91,.13)', score: 0.65,
          axes: [{ label: 'Recall', score: 0.8 }, { label: 'Unaided', score: 0 }, { label: 'Efficiency', score: 1 }],
        },
      });
      game.state = 5; // FINISHED
      game._render();
      return { card: game._finishCardBounds, viewport: game.viewport };
    });
    expect(result.card, 'the arrival card was drawn').toBeTruthy();
    const { card, viewport } = result as { card: NonNullable<FinishGame['_finishCardBounds']>; viewport: FinishGame['viewport'] };
    expect(card.y, 'the card starts on screen').toBeGreaterThanOrEqual(0);
    expect(card.y + card.h, 'the actions end above the bottom edge').toBeLessThanOrEqual(viewport.height);
  });
}
