import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user request 2026-10-01, "after I get a street right or
// wrong, I really think we need it in big letters on the street ahead of me to
// reinforce it"). The answered name stands on the street ahead, green when
// right and red when missed, and nothing is shown while the question is open.
test('the answered street is named on the street ahead, never the open question', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map layer logic; one project is enough');
  test.setTimeout(120000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  // The style is rebuilt once during start-up; wait for the overlay to exist.
  await page.waitForFunction(() => !!(window as any).canalRecallGame?.vectorMap?.map?.getLayer('answered-street-name'), null, { timeout: 30000 });
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const map = game.vectorMap.map;
    // MapLibre 5 keeps setData input under `_data.geojson`.
    const painted = () => { const data = (map.getSource('answered-street') as any)?._data; return (data?.geojson ?? data)?.features ?? []; };
    // A long named street near the bike, ridden from its first vertex.
    let segmentIndex = -1, nearest = Infinity;
    game.track.segments.forEach((segment: any, index: number) => {
      if (!segment.name || segment.points.length < 2) return;
      let length = 0;
      for (let i = 1; i < segment.points.length; i++) length += Math.hypot(segment.points[i].x - segment.points[i - 1].x, segment.points[i].y - segment.points[i - 1].y);
      if (length < 500) return;
      const d = Math.hypot(segment.points[0].x - game.player.x, segment.points[0].y - game.player.y);
      if (d < nearest) { nearest = d; segmentIndex = index; }
    });
    const segment = game.track.segments[segmentIndex];
    const [a, b] = segment.points;
    Object.assign(game.player, { x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x), speed: 0 });
    const name = segment.name;
    const ask = () => {
      game.quizPromptKind = 'route';
      game.quizPromptName = name;
      game.quizPromptSubject = name;
      game.quizPromptSegmentIndex = segmentIndex;
      game.quizPromptPointIndex = 0;
    };
    ask();
    game._render();
    const whileAsking = painted().length;
    game._submitCanalAnswer(name);
    game._render();
    const right = painted().map((f: any) => ({ ...f.properties, type: f.geometry.type }));
    ask();
    game._submitCanalAnswer('Definitely Not A Street');
    game._render();
    const wrong = painted().map((f: any) => f.properties);
    game.raceTime += 10;
    game._render();
    const expired = painted().length;
    return { name, whileAsking, right, wrong, expired };
  });
  expect(result.name, 'the test needs a long named street near the bike').toBeTruthy();
  expect(result.whileAsking, 'nothing shown while the question is open').toBe(0);
  expect(result.right.length, 'one name painted on the street ahead').toBe(1);
  expect(result.right.every((p: any) => p.name === result.name && p.correct === true && p.type === 'Point')).toBe(true);
  expect(result.wrong.length).toBe(1);
  expect(result.wrong.every((p: any) => p.name === result.name && p.correct === false)).toBe(true);
  expect(result.expired, 'cleared after a few seconds').toBe(0);
});
