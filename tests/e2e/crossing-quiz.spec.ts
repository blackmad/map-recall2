import { expect, Page, test } from '@playwright/test';

// Named regression locations for the two-stage crossing question. Driving to a
// specific bridge by autopilot is slow and flaky, so this drives the crossing
// test directly: the player is placed on the real span geometry and stepped
// across the same gate the game uses in play.

type Point = { x: number; y: number };

declare global {
  interface Window {
    canalRecallGame: {
      state: number;
      raceTime: number;
      player: Point & { angle: number; speed: number };
      quizPromptName: string;
      quizPromptKind: string;
      quizCurrentName: string;
      bridges: Array<{
        id: string; name: string; lines: Point[][];
        crossings: Array<{ index: number; waterway: string | null; x: number; y: number }>;
      }>;
      recall: { enabled: boolean; isKnownHere(feature: unknown): boolean } | null;
      track: { getRoadName(x: number, y: number): string };
      _lastBridgeQuizAt: number;
      _quizzedCrossings: Map<string, string>;
      _updateBridgeQuiz(previous: Point | null): void;
      _submitCanalAnswer(answer: string | null): void;
    };
  }
}

async function openCarRoute(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let seed = 0x5eed1234;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  });
  await page.route(/3dbag|cesium3dtiles/i, (route) => route.abort());
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  await page.locator('#travel-mode').selectOption('car');
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.player?.x)), { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => { window.canalRecallGame.state = 4; });
}

/** Drive the vehicle through one crossing of a named bridge and report the question asked. */
async function crossBridge(page: Page, bridgeName: string, crossingIndex: number) {
  return page.evaluate(({ bridgeName, crossingIndex }) => {
    const game = window.canalRecallGame;
    const bridge = game.bridges.find((candidate) => candidate.name === bridgeName);
    if (!bridge) return { error: `no bridge named ${bridgeName}` };
    const crossing = bridge.crossings[crossingIndex];
    if (!crossing) return { error: `${bridgeName} has no crossing ${crossingIndex}` };

    // Pick the span of this crossing nearest its centroid and step along it,
    // which is what a car driving the deck does.
    let best: Point[] | null = null;
    let bestDistance = Infinity;
    for (const line of bridge.lines) {
      for (let i = 1; i < line.length; i++) {
        const midX = (line[i - 1].x + line[i].x) / 2, midY = (line[i - 1].y + line[i].y) / 2;
        const distance = Math.hypot(midX - crossing.x, midY - crossing.y);
        if (distance < bestDistance) { bestDistance = distance; best = [line[i - 1], line[i]]; }
      }
    }
    if (!best) return { error: `${bridgeName} has no span geometry` };

    const [a, b] = best;
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const stepX = (b.x - a.x) / length, stepY = (b.y - a.y) / length;
    const previous = { x: midX - stepX * 12, y: midY - stepY * 12 };

    game.quizPromptName = '';
    game._lastBridgeQuizAt = -Infinity;
    game.raceTime = 1000;
    game.quizCurrentName = '';
    game.player.x = midX + stepX * 12;
    game.player.y = midY + stepY * 12;
    game.player.angle = Math.atan2(stepY, stepX);
    game.player.speed = 20;
    game._updateBridgeQuiz(previous);
    return {
      waterway: crossing.waterway,
      roadName: game.track.getRoadName(game.player.x, game.player.y),
      kind: game.quizPromptName ? game.quizPromptKind : null,
      asked: game.quizPromptName || null,
      // The prompt leads with the question and captions it with the situation,
      // and the chip above both says which kind of thing the answer is.
      question: document.querySelector('#canal-card h2')?.textContent || '',
      context: document.querySelector('#canal-card p')?.textContent || '',
      subject: document.getElementById('canal-kind-label')?.textContent || '',
      subjectKind: document.getElementById('canal-kind')?.dataset.kind || '',
      crossings: bridge.crossings.length,
    };
  }, { bridgeName, crossingIndex });
}

test('a bridge over water teaches the water first and the bridge second', async ({ page }) => {
  await openCarRoute(page);

  // The Magere Brug crosses the Amstel. Asked cold, the question is the water.
  const first = await crossBridge(page, 'Magere Brug', 0);
  expect(first.error).toBeUndefined();
  expect(first.waterway).toBe('Amstel');
  expect(first.kind).toBe('crossing-water');
  expect(first.asked).toBe('Amstel');
  expect(first.question).toBe('Which water is under this bridge?');
  expect(first.context).toBe('Crossing a bridge');
  expect(first.subject).toBe('Water');
  expect(first.subjectKind).toBe('water');

  // Answering it right is what unlocks the bridge above it.
  await page.evaluate(() => window.canalRecallGame._submitCanalAnswer('Amstel'));
  const second = await crossBridge(page, 'Magere Brug', 0);
  expect(second.kind).toBe('bridge');
  expect(second.asked).toBe('Magere Brug');
  expect(second.question).toBe('Which bridge is this?');
  expect(second.subject).toBe('Bridge');
  expect(second.subjectKind).toBe('bridge');
});

test('a wrong answer about the water does not unlock the bridge', async ({ page }) => {
  await openCarRoute(page);
  const first = await crossBridge(page, 'Blauwbrug', 0);
  expect(first.waterway).toBe('Amstel');
  expect(first.kind).toBe('crossing-water');

  await page.evaluate(() => window.canalRecallGame._submitCanalAnswer('Prinsengracht'));
  // The crossing is spent for this race either way, but the store must not
  // report the Amstel as known here.
  const known = await page.evaluate(() => window.canalRecallGame.recall!.isKnownHere(
    { name: 'Amstel', type: 'water', cityId: 'amsterdam', center: [52.366333, 4.900899] }));
  expect(known).toBe(false);
});

// The road out of the city to the north carries four separate structures over
// different waters. They used to be published as one bridge named after the
// road, so "which bridge is this?" was answered once, with a road name, for all
// four. The extractor prefers OSM's `bridge:name`, so each is now itself.
test('a road out of the city is several named bridges, not one question', async ({ page }) => {
  await openCarRoute(page);
  const named = await page.evaluate(() => {
    const game = window.canalRecallGame;
    const find = (name: string) => game.bridges.find((candidate) => candidate.name === name);
    return {
      roadsAsBridges: ['Zuiderzeeweg', 'IJburglaan'].filter((road) => Boolean(find(road))),
      schellingwouder: find('Schellingwouderbrug')?.crossings.map((c) => c.waterway) ?? null,
      heerma: find('Enneüs Heermabrug')?.crossings.map((c) => c.waterway) ?? null,
    };
  });
  expect(named.roadsAsBridges, 'a road is not a bridge').toEqual([]);
  expect(named.schellingwouder).toContain('Buiten-IJ');
  expect(named.heerma).toContain('IJmeer');

  // And each is asked about on its own terms.
  const crossing = await crossBridge(page, 'Schellingwouderbrug', 0);
  expect(crossing.error).toBeUndefined();
  expect(crossing.asked).toBe('Buiten-IJ');
});

test('a long street is learned a stretch at a time, and labelled only where it is known', async ({ page }) => {
  await openCarRoute(page);
  const result = await page.evaluate(() => {
    const game = window.canalRecallGame as unknown as {
      track: { segments: Array<{ name: string; points: Point[] }> };
      recall: { record(feature: unknown, correct: boolean): void };
      player: Point;
      _recallFeatureAt(name: string, x: number, y: number): { name: string; center: [number, number] } | null;
      _isRecallSuppressedHere(name: string): boolean;
      _rememberKnownPlace(name: string, center: [number, number]): void;
      _isPlaceKnown(name: string, x: number, y: number): boolean;
    };
    // Take the longest single street run the loaded network has, so the two
    // sample points are genuinely different parts of the city.
    let longest: { name: string; a: Point; b: Point; span: number } | null = null;
    for (const segment of game.track.segments) {
      if (!segment.name || segment.points.length < 2) continue;
      const a = segment.points[0], b = segment.points[segment.points.length - 1];
      const span = Math.hypot(a.x - b.x, a.y - b.y);
      if (!longest || span > longest.span) longest = { name: segment.name, a, b, span };
    }
    if (!longest) return { error: 'no named street segments loaded' };

    const near = longest.a;
    const far = longest.b;
    const feature = game._recallFeatureAt(longest.name, near.x, near.y);
    if (!feature) return { error: 'no recall identity for the street' };
    game.recall.record(feature, true);
    game._rememberKnownPlace(longest.name, feature.center);

    game.player.x = near.x; game.player.y = near.y;
    const suppressedNear = game._isRecallSuppressedHere(longest.name);
    game.player.x = far.x; game.player.y = far.y;
    const suppressedFar = game._isRecallSuppressedHere(longest.name);
    return {
      name: longest.name,
      spanMeters: Math.round(longest.span / 3),
      suppressedNear,
      suppressedFar,
      labelledNear: game._isPlaceKnown(longest.name, near.x, near.y),
      labelledFar: game._isPlaceKnown(longest.name, far.x, far.y),
    };
  });

  expect(result.error).toBeUndefined();
  expect(result.spanMeters).toBeGreaterThan(600);
  // Answered here, so not asked again here — and not asked about the far end
  // of the same street, which is a different piece of local knowledge.
  expect(result.suppressedNear).toBe(true);
  expect(result.suppressedFar).toBe(false);
  // The map says the name only where it has been earned; writing it along the
  // whole street would hand over the answer to the end never asked.
  expect(result.labelledNear).toBe(true);
  expect(result.labelledFar).toBe(false);
});
