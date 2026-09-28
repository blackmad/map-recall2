import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-28, "my bike is stuck at this
// intersection"): the Marnixstraat / Westerkade / Lijnbaansgracht junction at
// the Bullebakssluis, beside the Nieuwe Naatje statue. Turning off Marnixstraat
// into Westerkade, the road guard judged the bike against Marnixstraat (the
// heading pick) while it sat on Westerkade, so each step into the turn was
// undone and the bike wedged past the junction. Before the fix 13 of 30
// arm-to-arm drives here failed; every turn below wedged.
const ARMS: Record<string, [number, number]> = {
  marnixN: [52.3745, 4.8766],
  marnixS: [52.3727, 4.87585],
  lijnS: [52.37325, 4.8768],
  westerkade: [52.37396, 4.8769],
  lijnN: [52.3748, 4.8775],
};
const TURNS: Array<[string, string]> = [
  ['marnixN', 'westerkade'],
  ['marnixN', 'lijnS'],
  ['marnixS', 'lijnS'],
  ['lijnN', 'westerkade'],
  ['lijnN', 'lijnS'],
];

test('the bike turns off Marnixstraat at the Bullebakssluis without wedging', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pure simulation; one project is enough');
  test.setTimeout(180_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 60_000 });
  const results = await page.evaluate(({ arms, turns }) => {
    const game = (window as any).canalRecallGame;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const toWorld = ([lat, lng]: [number, number]) => ({
      x: loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng,
      y: loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat,
    });
    const { allNodes } = game.track._routingGraph();
    const snap = (latLng: [number, number]) => {
      const target = toWorld(latLng);
      let best = allNodes[0], bestDistance = Infinity;
      for (const node of allNodes) {
        const distance = Math.hypot(node.x - target.x, node.y - target.y);
        if (distance < bestDistance) { bestDistance = distance; best = node; }
      }
      return best;
    };
    game.state = 6; // PAUSED: this test steps the simulation itself
    const player = game.player;
    player.handleInput = () => {};
    game._updateCanalQuiz = () => {};
    game._updateBridgeQuiz = () => {};
    const STEP = 1 / 30;
    return turns.map(([fromArm, toArm]) => {
      const from = snap(arms[fromArm]), to = snap(arms[toArm]);
      const path = game.track.findRoute(from, to);
      Object.assign(player, { x: from.x, y: from.y, speed: 0, vx: 0, vy: 0, angle: Math.atan2(path[1].y - from.y, path[1].x - from.x) });
      game.track.finishPoint = { ...to };
      let index = 1, pinned = 0, wedges = 0, arrived = false;
      for (let elapsed = 0; elapsed < 40 && !arrived; elapsed += STEP) {
        // The driving harness's autopilot: steer for a point ~40 m along the route.
        let nearestDistance = Infinity;
        for (let i = Math.max(0, index - 4); i < Math.min(path.length, index + 24); i++) {
          const d = Math.hypot(path[i].x - player.x, path[i].y - player.y);
          if (d < nearestDistance) { nearestDistance = d; index = i; }
        }
        let lookahead = 0, targetIndex = index;
        while (targetIndex < path.length - 1 && lookahead < 120) {
          lookahead += Math.hypot(path[targetIndex + 1].x - path[targetIndex].x, path[targetIndex + 1].y - path[targetIndex].y);
          targetIndex++;
        }
        const target = path[targetIndex];
        let error = Math.atan2(target.y - player.y, target.x - player.x) - player.angle;
        error = Math.atan2(Math.sin(error), Math.cos(error));
        const cruise = Math.abs(error) > 0.5 ? 60 : 170;
        player.steerInput = Math.max(-1, Math.min(1, error * 2.5));
        player.throttle = player.speed < cruise ? 1 : 0;
        player.brake = player.speed > cruise * 1.6 ? 1 : 0;
        player.handbrake = false;
        game.track.clearFrameCache();
        const before = { x: player.x, y: player.y };
        game._updateRacing(STEP);
        const moved = Math.hypot(player.x - before.x, player.y - before.y);
        pinned = moved < 0.5 && player.throttle > 0 ? pinned + STEP : 0;
        if (pinned > 1.5) { wedges++; pinned = 0; }
        arrived = Math.hypot(to.x - player.x, to.y - player.y) < 60;
      }
      game.state = 4;
      return { turn: `${fromArm} → ${toArm}`, arrived, wedges };
    });
  }, { arms: ARMS, turns: TURNS });
  for (const result of results) {
    expect(result, result.turn).toEqual({ turn: result.turn, arrived: true, wedges: 0 });
  }
});
