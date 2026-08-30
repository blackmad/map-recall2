import { expect, Page, test } from '@playwright/test';

// A driving harness rather than a scripted scenario: it plans routes between
// random points of the real Amsterdam street network and drives them with the
// game's own physics, then reports what went wrong.
//
// Two failure modes look identical to a player — "I am stuck and the game will
// not take me anywhere" — but have different causes, so they are separated:
//
//   unroutable  the router cannot connect two points of one connected
//               component, i.e. the graph itself is broken;
//   pinned      the car stops moving while the throttle is open, i.e. the road
//               guard has wedged it against the edge of the corridor.
//
// A run that merely fails to navigate (the autopilot drives the wrong way, or
// runs out of simulated time on a long route) is reported but not asserted on:
// that is a limitation of the test driver, not of the game.

type Point = { x: number; y: number };
type DriveOutcome = 'arrived' | 'pinned' | 'lost' | 'timeout';
type DriveFailure = {
  reason: 'unroutable' | 'pinned' | 'lost';
  lat: number;
  lng: number;
  street: string;
  distanceLeftPx?: number;
};
type HarnessReport = {
  pairs: number;
  routable: number;
  wedges: number;
  outcomes: Record<DriveOutcome, number>;
  componentShare: number;
  failures: DriveFailure[];
};

declare global {
  interface Window {
    canalRecallGame: {
      state: number;
      travelMode: string;
      player: Point & { angle: number; speed: number; vx: number; vy: number; throttle: number; brake: number; steerInput: number; handbrake: boolean; distancePx: number; handleInput: () => void };
      track: {
        finishPoint: Point;
        findRoute(from: Point, to: Point): Point[];
        getNearestRoad(x: number, y: number): { dist: number; angle: number; width: number } | null;
        getRoadName(x: number, y: number): string;
        clearFrameCache(): void;
        _routingGraph(): { allNodes: Array<{ key: string; x: number; y: number; edges: Array<{ node: unknown }> }> };
      };
      osmLoader: { _lastCenterLat: number; _lastCenterLng: number; _lastOffsetX: number; _lastOffsetY: number };
      _updateRacing(dt: number): void;
      _updateCanalQuiz(dt: number): void;
      _updateBridgeQuiz(previous: Point | null): void;
      driveHarness?: (runs: number, seed: number) => HarnessReport;
    };
  }
}

async function openCarRoute(page: Page): Promise<void> {
  // The route the game picks decides where the world origin lands, which
  // changes how geometry rounds into routing-graph cells. Seed the generator
  // so every run of the harness drives the same city.
  await page.addInitScript(() => {
    let seed = 0x5eed1234;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  await page.locator('#travel-mode').selectOption('car');
  await page.locator('#view-mode').selectOption('north');
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.player?.x)), { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => { window.canalRecallGame.state = 4; });
}

// Installed in the page so drives run at simulation speed rather than in real
// time: one `_updateRacing` call per simulated frame, no rAF, no rendering.
function installHarness(): void {
  const game = window.canalRecallGame;
  const STEP = 1 / 30;
  const ARRIVE_PX = 90;
  const MAX_SECONDS = 200;
  const LOST_SECONDS = 25;   // no progress along the route while still moving
  const PINNED_SECONDS = 5;  // barely moving at all, throttle open

  const toLatLng = (point: Point) => {
    const loader = game.osmLoader;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
    return {
      lat: loader._lastCenterLat - (point.y - loader._lastOffsetY) / (metersPerDegreeLat * 3),
      lng: loader._lastCenterLng + (point.x - loader._lastOffsetX) / (metersPerDegreeLng * 3),
    };
  };

  game.driveHarness = (runs, seed) => {
    // Park the real animation loop: this harness drives the simulation itself,
    // and a second updater running at display rate makes every run different.
    game.state = 6; // PAUSED
    let state = seed >>> 0;
    const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };

    // Drive only inside the graph's largest component: a pair that spans two
    // components is a data problem, counted separately, not a driving one.
    const { allNodes } = game.track._routingGraph();
    const seen = new Set<string>();
    let largest: Array<{ key: string; x: number; y: number }> = [];
    for (const node of allNodes) {
      if (seen.has(node.key)) continue;
      const stack = [node];
      const group: typeof largest = [];
      seen.add(node.key);
      while (stack.length) {
        const current = stack.pop()!;
        group.push(current);
        for (const edge of current.edges) {
          const next = edge.node as { key: string; x: number; y: number; edges: Array<{ node: unknown }> };
          if (seen.has(next.key)) continue;
          seen.add(next.key);
          stack.push(next);
        }
      }
      if (group.length > largest.length) largest = group;
    }

    const failures: DriveFailure[] = [];
    const outcomes: Record<DriveOutcome, number> = { arrived: 0, pinned: 0, lost: 0, timeout: 0 };
    let routable = 0;
    let wedges = 0;
    const player = game.player;
    player.handleInput = () => {};
    // Recall questions stop the vehicle dead by design; this harness is about
    // whether the network can be driven, so they are silenced for the run.
    game._updateCanalQuiz = () => {};
    game._updateBridgeQuiz = () => {};

    for (let run = 0; run < runs; run++) {
      const from = largest[Math.floor(random() * largest.length)];
      const to = largest[Math.floor(random() * largest.length)];
      // City-trip distances: several junctions to negotiate, and short enough
      // that a completed drive fits inside the simulated time budget.
      const straightLine = from && to ? Math.hypot(from.x - to.x, from.y - to.y) : 0;
      if (straightLine < 1200 || straightLine > 6000) { run--; continue; }
      const path = game.track.findRoute(from, to);
      if (!path || path.length < 2) {
        failures.push({ reason: 'unroutable', street: game.track.getRoadName(from.x, from.y), ...toLatLng(from) });
        continue;
      }
      routable++;

      const startRoad = game.track.getNearestRoad(from.x, from.y);
      if (startRoad && startRoad.dist > startRoad.width) { run--; routable--; continue; }
      player.x = from.x; player.y = from.y;
      player.angle = Math.atan2(path[1].y - from.y, path[1].x - from.x);
      player.speed = 0; player.vx = 0; player.vy = 0; player.distancePx = 0;
      game.track.finishPoint = { ...to };

      let index = 1;
      // "Progress along the route" is not straight-line progress toward the
      // destination. Amsterdam routes routinely head away from their endpoint
      // to get around a canal, rail line, or one-way block. The old Euclidean
      // check declared those correct detours lost after 25 seconds.
      const distanceFrom = new Array(path.length).fill(0);
      for (let i = path.length - 2; i >= 0; i--) {
        distanceFrom[i] = distanceFrom[i + 1]
          + Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
      }
      let closestRouteApproach = Infinity;
      let lostSeconds = 0;
      let pinnedSeconds = 0;
      let reversing = 0;
      let elapsed = 0;
      let outcome: DriveOutcome = 'timeout';
      while (elapsed < MAX_SECONDS) {
        // Steer for a point a fixed distance ahead of wherever the car
        // actually is on the path, so overshooting a vertex is recoverable —
        // a driver who drifts wide rejoins the route rather than circling it.
        let nearest = index, nearestDistance = Infinity;
        for (let i = Math.max(0, index - 4); i < Math.min(path.length, index + 24); i++) {
          const d = Math.hypot(path[i].x - player.x, path[i].y - player.y);
          if (d < nearestDistance) { nearestDistance = d; nearest = i; }
        }
        index = nearest;
        let lookahead = 0, targetIndex = index;
        while (targetIndex < path.length - 1 && lookahead < 120) {
          lookahead += Math.hypot(path[targetIndex + 1].x - path[targetIndex].x, path[targetIndex + 1].y - path[targetIndex].y);
          targetIndex++;
        }
        const target = path[targetIndex];
        let error = Math.atan2(target.y - player.y, target.x - player.x) - player.angle;
        while (error > Math.PI) error -= 2 * Math.PI;
        while (error < -Math.PI) error += 2 * Math.PI;

        // A city driver, not a qualifying lap: hold a modest cruise and slow
        // for the turn, or the car overshoots every junction and the harness
        // ends up measuring the autopilot instead of the network.
        if (reversing > 0) {
          // What a player does when they have nosed into a kerb: back off,
          // turn the other way, and take the junction again.
          reversing -= STEP;
          player.steerInput = Math.max(-1, Math.min(1, -error * 2.5));
          player.throttle = 0;
          player.brake = 1;
        } else {
          const cruise = Math.abs(error) > 0.5 ? 60 : 170;
          player.steerInput = Math.max(-1, Math.min(1, error * 2.5));
          player.throttle = player.speed < cruise ? 1 : 0;
          player.brake = player.speed > cruise * 1.6 ? 1 : 0;
        }
        player.handbrake = false;

        // The real loop clears this before every frame; without it the road
        // guard keeps comparing the car against the span it started on.
        game.track.clearFrameCache();
        const before = { x: player.x, y: player.y };
        game._updateRacing(STEP);
        elapsed += STEP;

        const moved = Math.hypot(player.x - before.x, player.y - before.y);
        const remaining = Math.hypot(to.x - player.x, to.y - player.y);
        const routeRemaining = distanceFrom[index] + nearestDistance;
        if (routeRemaining < closestRouteApproach - 20) {
          closestRouteApproach = routeRemaining;
          lostSeconds = 0;
        } else {
          lostSeconds += STEP;
        }
        // Pinned: the car is asking to move and barely moving. A rolling stop
        // at a tight junction is fine; five seconds of it is the wedge bug.
        if (moved < 0.5 && player.throttle > 0) pinnedSeconds += STEP; else pinnedSeconds = 0;
        // Every wedge is counted, even the ones the driver reverses out of:
        // being stopped dead with the throttle open is the bug, whether or not
        // a three-point turn eventually frees the car.
        if (reversing <= 0 && pinnedSeconds > 1.5) { reversing = 1.2; wedges++; }

        if (remaining < ARRIVE_PX) { outcome = 'arrived'; break; }
        if (pinnedSeconds > PINNED_SECONDS) { outcome = 'pinned'; break; }
        if (lostSeconds > LOST_SECONDS) { outcome = 'lost'; break; }
      }
      outcomes[outcome]++;
      if (outcome === 'pinned' || outcome === 'lost') {
        failures.push({
          reason: outcome,
          street: game.track.getRoadName(player.x, player.y),
          distanceLeftPx: Math.round(Math.hypot(to.x - player.x, to.y - player.y)),
          ...toLatLng(player),
        });
      }
    }
    game.state = 4; // RACING
    return { pairs: runs, routable, wedges, outcomes, componentShare: largest.length / allNodes.length, failures };
  };
}

test('driving harness: planned routes can actually be driven', async ({ page }) => {
  test.setTimeout(300_000);
  await openCarRoute(page);
  await page.evaluate(installHarness);
  const report = await page.evaluate(() => window.canalRecallGame.driveHarness!(24, 0x51ce7));

  console.log(`largest routing component: ${(report.componentShare * 100).toFixed(1)}% of graph nodes`);
  console.log(`routable ${report.routable}/${report.pairs} — ${JSON.stringify(report.outcomes)}, ${report.wedges} wedges against the kerb`);
  for (const failure of report.failures.slice(0, 10)) {
    console.log(`  ${failure.reason} @ ${failure.lat.toFixed(5)},${failure.lng.toFixed(5)} — ${failure.street || '(unnamed)'}${failure.distanceLeftPx ? ` (${failure.distanceLeftPx}px short)` : ''}`);
  }

  // Inside one component every pair is routable by definition; this catches a
  // regression in the graph builder rather than in the extract.
  expect(report.routable).toBe(report.pairs);
  // No drive may end with the car pinned against the edge of the corridor.
  // Wedging at all was epidemic before the guard learned to slide along a kerb
  // rather than stop against it: the same 24 drives logged 151 wedges and 11
  // arrivals, against 16 and 18 now. The bound is deliberately loose — it is
  // there to catch a return to that behaviour, not to pin an exact number.
  expect(report.outcomes.pinned).toBe(0);
  expect(report.wedges).toBeLessThanOrEqual(40);
  expect(report.outcomes.arrived).toBeGreaterThanOrEqual(14);
  // And the network must not fragment back into islands.
  expect(report.componentShare).toBeGreaterThan(0.7);
});
