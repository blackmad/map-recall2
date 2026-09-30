import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Traps, not routes: a rider who is not on the centreline. Around a point
// (default: the Westeinde bridge over the Singelgracht, user report
// 2026-09-30 "my bike is entirely stuck on this bridge, can't move at all"),
// every reachable pose on a grid of positions and eight headings is given
// throttle with the stick left, centred and right, and reverse. A pose where
// none of the four moves the bike 15 px (5 m) in 4 s is a trap: "can't move
// at all". Turning round at a narrow dead end takes longer than 4 s and is
// not one.
//
//   DECK_PROBE=lat,lng[;lat,lng…]  probe points (default: Westeinde)
//   DECK_PROBE_OUT=path            write the report as JSON

const DEFAULT_POINTS: Array<[number, number]> = [[52.35895, 4.89815]];

test('no pose on a bridge deck traps the bike', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pure simulation; one project is enough');
  test.setTimeout(1_800_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 90_000 });
  const points: Array<[number, number]> = process.env.DECK_PROBE
    ? process.env.DECK_PROBE.split(';').map(p => p.split(',').map(Number) as [number, number])
    : DEFAULT_POINTS;
  const radius = Number(process.env.DECK_PROBE_RADIUS || 60);
  const report = await page.evaluate(({ points, radius }) => {
    const game = (window as any).canalRecallGame;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const toWorld = ([lat, lng]: [number, number]) => ({
      x: loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng,
      y: loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat,
    });
    const toLatLng = (x: number, y: number): [number, number] => [
      +(loader._lastCenterLat - (y - loader._lastOffsetY) / perLat).toFixed(6),
      +(loader._lastCenterLng + (x - loader._lastOffsetX) / perLng).toFixed(6),
    ];
    game.state = 6;
    const player = game.player;
    player.handleInput = () => {};
    game._updateCanalQuiz = () => {};
    game._updateBridgeQuiz = () => {};
    const STEP = 1 / 30;
    const traps: any[] = [];
    let poses = 0;
    for (const point of points) {
      const centre = toWorld(point);
      const R = radius;
      for (let dx = -R; dx <= R; dx += 10) for (let dy = -R; dy <= R; dy += 10) {
        const x = centre.x + dx, y = centre.y + dy;
        for (let h = 0; h < 8; h++) {
          const angle = -Math.PI + h * Math.PI / 4;
          game.track.clearFrameCache();
          const road = game.track.getGuardRoad(x, y, angle);
          // Only poses the guard itself accepts: the rider can be here.
          if (!road || road.dist > road.width) continue;
          poses++;
          let best = 0;
          const outcomes: number[] = [];
          for (const [steer, throttle, brake] of [[-1, 1, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1]]) {
            Object.assign(player, { x, y, angle, speed: 0, vx: 0, vy: 0 });
            player._uTurnHeading = null;
            game._blockedCarFrames = 0;
            let far = 0;
            for (let t = 0; t < 4; t += STEP) {
              player.steerInput = steer;
              player.throttle = throttle;
              player.brake = brake;
              player.handbrake = false;
              game.track.clearFrameCache();
              game._updateRacing(STEP);
              far = Math.max(far, Math.hypot(player.x - x, player.y - y));
            }
            outcomes.push(Math.round(far));
            best = Math.max(best, far);
          }
          if (best < 15) traps.push({ at: toLatLng(x, y), headingDeg: Math.round(angle * 180 / Math.PI), outcomes, road: game.track.getRoadName(x, y, angle) });
        }
      }
    }
    game.state = 4;
    return { poses, traps };
  }, { points, radius });
  if (process.env.DECK_PROBE_OUT) writeFileSync(process.env.DECK_PROBE_OUT, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ poses: report.poses, traps: report.traps.length }));
  expect(report.traps).toEqual([]);
});
