import { expect, Page, test } from '@playwright/test';
import { openRoute } from './helpers';

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
  /** Diagnostics for a lost drive: how far off the planned route it ended,
   *  how far it travelled while making no progress, its speed, and how far
   *  outside the nearest road's width it sits. A small `wanderPx` at speed 0
   *  is a trap; a large one is the autopilot circling. */
  offRoutePx?: number;
  wanderPx?: number;
  speed?: number;
  offRoadPx?: number;
  /** The pair, so `HARNESS_PAIRS` can re-drive exactly this route. */
  pair?: [[number, number], [number, number]];
  /** With `HARNESS_PAIRS`: the last seconds before failing, one row per 0.25 s. */
  trace?: Array<{ at: [number, number]; angle: number; speed: number; steer: number; road: string; offRoad: number }>;
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
      driveHarness?: (runs: number, seed: number, pairs?: Array<[[number, number], [number, number]]>) => HarnessReport;
    };
  }
}

async function openCarRoute(page: Page): Promise<void> {
  // The route the game picks decides where the world origin lands, which
  // changes how geometry rounds into routing-graph cells. Seed the generator
  // so every run of the harness drives the same city.
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 60_000 });
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

  const toXY = ([lat, lng]: [number, number]) => {
    const loader = game.osmLoader;
    const metersPerDegreeLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
    return {
      x: loader._lastOffsetX + (lng - loader._lastCenterLng) * metersPerDegreeLng * 3,
      y: loader._lastOffsetY - (lat - loader._lastCenterLat) * 111320 * 3,
    };
  };
  const round5 = (point: Point): [number, number] => {
    const { lat, lng } = toLatLng(point);
    return [Number(lat.toFixed(5)), Number(lng.toFixed(5))];
  };

  game.driveHarness = (runs, seed, pairs) => {
    if (pairs) runs = pairs.length;
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
      const tracing = !!pairs;
      const from = pairs ? toXY(pairs[run][0]) : largest[Math.floor(random() * largest.length)];
      const to = pairs ? toXY(pairs[run][1]) : largest[Math.floor(random() * largest.length)];
      // City-trip distances: several junctions to negotiate, and short enough
      // that a completed drive fits inside the simulated time budget.
      const straightLine = from && to ? Math.hypot(from.x - to.x, from.y - to.y) : 0;
      if (!pairs && (straightLine < 1200 || straightLine > 6000)) { run--; continue; }
      let path = game.track.findRoute(from, to);
      if (!path || path.length < 2) {
        failures.push({ reason: 'unroutable', street: game.track.getRoadName(from.x, from.y), ...toLatLng(from) });
        continue;
      }
      routable++;

      const startRoad = game.track.getNearestRoad(from.x, from.y);
      if (!pairs && startRoad && startRoad.dist > startRoad.width) { run--; routable--; continue; }
      const trace: NonNullable<DriveFailure['trace']> = [];
      player.x = from.x; player.y = from.y;
      player.angle = Math.atan2(path[1].y - from.y, path[1].x - from.x);
      player.speed = 0; player.vx = 0; player.vy = 0; player.distancePx = 0;
      game.track.finishPoint = { ...to };

      let index = 1;
      // "Progress along the route" is not straight-line progress toward the
      // destination. Amsterdam routes routinely head away from their endpoint
      // to get around a canal, rail line, or one-way block. The old Euclidean
      // check declared those correct detours lost after 25 seconds.
      const distancesFrom = (route: Point[]) => {
        const out = new Array(route.length).fill(0);
        for (let i = route.length - 2; i >= 0; i--) {
          out[i] = out[i + 1] + Math.hypot(route[i + 1].x - route[i].x, route[i + 1].y - route[i].y);
        }
        return out;
      };
      let distanceFrom = distancesFrom(path);
      // Knocked off the plan, or backed out of a dead end: plan again from
      // here, as the game's own reroute does. Progress is then measured along
      // the new route, from where the bike now is.
      let replans = 0;
      const replan = () => {
        const again = game.track.findRoute({ x: player.x, y: player.y }, to);
        if (!again || again.length < 2) return;
        path = again; distanceFrom = distancesFrom(path); index = 0; replans++;
        closestRouteApproach = distanceFrom[0] + Math.hypot(path[0].x - player.x, path[0].y - player.y);
      };
      // Where the bike has actually been, every 8 px: always rideable, so the
      // way back out of a tip or a wrong turn (bridge sweep, 2026-10-01).
      const trail: Point[] = [{ x: from.x, y: from.y }];
      let backTo: Point | null = null;
      const recent: Point[] = [];
      let closestRouteApproach = Infinity;
      let lostSeconds = 0;
      let wander = 0;
      let lastOffRoute = 0;
      let pinnedSeconds = 0;
      let reversing = 0;
      let facingAwaySeconds = 0;
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
        // A vertex within reach counts as passed; otherwise a bike that
        // overshoots a hairpin keeps turning back to the point behind it.
        if (nearestDistance < 25 && index < path.length - 1) index++;
        let lookahead = 0, targetIndex = index;
        while (targetIndex < path.length - 1 && lookahead < 120) {
          lookahead += Math.hypot(path[targetIndex + 1].x - path[targetIndex].x, path[targetIndex + 1].y - path[targetIndex].y);
          targetIndex++;
        }
        // Line of sight: a lookahead point across a hairpin or a turning
        // loop has open ground between it and the bike, and a driver who aims
        // straight at it only rides into the kerb. Pull the target back along
        // the route until the straight line to it stays on the road.
        const onRoad = (x: number, y: number) => {
          const road = game.track.getNearestRoad(x, y);
          return !!road && road.dist <= road.width;
        };
        const inSight = (point: Point) => {
          const length = Math.hypot(point.x - player.x, point.y - player.y);
          for (let step = 10; step < length; step += 10) {
            const t = step / length;
            if (!onRoad(player.x + (point.x - player.x) * t, player.y + (point.y - player.y) * t)) return false;
          }
          return true;
        };
        while (targetIndex > index + 1 && !inSight(path[targetIndex])) targetIndex--;
        // Cut the corner short of a junction and even the next route point is
        // out of sight: ride into the junction first, as a rider would.
        if (targetIndex === index + 1 && !inSight(path[targetIndex])) targetIndex = index;
        const target = path[targetIndex];
        let error = Math.atan2(target.y - player.y, target.x - player.x) - player.angle;
        while (error > Math.PI) error -= 2 * Math.PI;
        while (error < -Math.PI) error += 2 * Math.PI;

        // A city driver, not a qualifying lap: hold a modest cruise and slow
        // for the turn, or the car overshoots every junction and the harness
        // ends up measuring the autopilot instead of the network.
        if (reversing > 0 && backTo && Math.hypot(backTo.x - player.x, backTo.y - player.y) < 12) reversing = 0;
        if (reversing <= 0 && backTo) { backTo = null; replan(); }
        if (reversing > 0 && backTo) {
          // What a player does when they have nosed into a kerb or a dead end:
          // back out the way they came, along the trail they actually rode,
          // then plan again. The bike reverses along -heading, so the nose
          // points straight away from the trail point.
          reversing -= STEP;
          let away = Math.atan2(player.y - backTo.y, player.x - backTo.x) - player.angle;
          away = Math.atan2(Math.sin(away), Math.cos(away));
          player.steerInput = Math.max(-1, Math.min(1, away * 2.5));
          player.throttle = 0;
          player.brake = 1;
        } else {
          // Slow for the bend ahead on the route, not only for the heading
          // error now: arriving at a sharp corner at cruising speed cut its
          // inside into a side alley (Nieuwendijk into Nieuwezijds Armsteeg).
          let bend = 0, ahead = 0;
          for (let i = index; i < path.length - 2 && ahead < 90; i++) {
            const a1 = Math.atan2(path[i + 1].y - path[i].y, path[i + 1].x - path[i].x);
            const a2 = Math.atan2(path[i + 2].y - path[i + 1].y, path[i + 2].x - path[i + 1].x);
            bend = Math.max(bend, Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))));
            ahead += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
          }
          const cruise = Math.abs(error) > 0.5 || bend > 0.7 ? 60 : 170;
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
        if (tracing && Math.round(elapsed / STEP) % 8 === 0) {
          const road = game.track.getNearestRoad(player.x, player.y);
          trace.push({ at: round5(player), angle: Math.round(player.angle * 100) / 100, speed: Math.round(player.speed), steer: Math.round(player.steerInput * 100) / 100, road: game.track.getRoadName(player.x, player.y), offRoad: road ? Math.round(road.dist - road.width) : -1 });
          if (trace.length > 40) trace.shift();
        }

        const moved = Math.hypot(player.x - before.x, player.y - before.y);
        if (reversing <= 0) {
          const tip = trail[trail.length - 1];
          if (Math.hypot(player.x - tip.x, player.y - tip.y) >= 8) trail.push({ x: player.x, y: player.y });
        }
        recent.push({ x: player.x, y: player.y });
        if (recent.length > 45) recent.shift();
        const remaining = Math.hypot(to.x - player.x, to.y - player.y);
        const routeRemaining = distanceFrom[index] + nearestDistance;
        lastOffRoute = nearestDistance;
        if (routeRemaining < closestRouteApproach - 20) {
          closestRouteApproach = routeRemaining;
          lostSeconds = 0;
          wander = 0;
        } else {
          lostSeconds += STEP;
          wander += moved;
        }
        // Pinned: the car is asking to move and barely moving. A rolling stop
        // at a tight junction is fine; five seconds of it is the wedge bug.
        if (moved < 0.5 && player.throttle > 0) pinnedSeconds += STEP; else pinnedSeconds = 0;
        // Every wedge is counted, even the ones the driver reverses out of:
        // being stopped dead with the throttle open is the bug, whether or not
        // a three-point turn eventually frees the car.
        // A driver whose route is behind them turns round rather than
        // steering full lock into the kerb for ever.
        facingAwaySeconds = Math.abs(error) > 1.9 && reversing <= 0 ? facingAwaySeconds + STEP : 0;
        // Rocking in place: 1.5 s inside 8 px without being pinned outright.
        const rocking = reversing <= 0 && recent.length === 45
          && recent.every(q => Math.hypot(q.x - recent[0].x, q.y - recent[0].y) < 8);
        const backOut = () => {
          // ~50 px back along the trail; the points passed are dropped, so a
          // second try goes further back.
          let back = 0;
          while (trail.length > 1 && back < 50) {
            const last = trail.pop()!;
            back += Math.hypot(last.x - trail[trail.length - 1].x, last.y - trail[trail.length - 1].y);
          }
          backTo = { ...trail[trail.length - 1] };
          reversing = 3; facingAwaySeconds = 0; recent.length = 0;
        };
        if (reversing <= 0 && pinnedSeconds > 1.5) { wedges++; backOut(); }
        else if (reversing <= 0 && (facingAwaySeconds > 0.6 || rocking)) backOut();

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
          offRoutePx: Math.round(lastOffRoute),
          wanderPx: Math.round(wander),
          speed: Math.round(player.speed),
          pair: [round5(from), round5(to)],
          ...(tracing ? { trace } : {}),
          offRoadPx: (() => { const road = game.track.getNearestRoad(player.x, player.y); return road ? Math.round(road.dist - road.width) : -1; })(),
          ...toLatLng(player),
        });
      }
    }
    game.state = 4; // RACING
    return { pairs: runs, routable, wedges, outcomes, componentShare: largest.length / allNodes.length, failures };
  };
}

test('driving harness: planned routes can actually be driven', async ({ page }) => {
  // HARNESS_TIMEOUT_MS: a loaded machine (other worktrees running) needs longer.
  test.setTimeout(Number(process.env.HARNESS_TIMEOUT_MS || 300_000));
  await openCarRoute(page);
  await page.evaluate(installHarness);
  // HARNESS_PAIRS='[[[lat,lng],[lat,lng]],…]' re-drives failures from an
  // earlier run's `pair` and prints each one's trace; the bars do not apply.
  const pairs = process.env.HARNESS_PAIRS ? JSON.parse(process.env.HARNESS_PAIRS) : undefined;
  const report = await page.evaluate(p => window.canalRecallGame.driveHarness!(120, 0x51ce7, p), pairs);

  console.log(`largest routing component: ${(report.componentShare * 100).toFixed(1)}% of graph nodes`);
  console.log(`routable ${report.routable}/${report.pairs} — ${JSON.stringify(report.outcomes)}, ${report.wedges} wedges against the kerb`);
  for (const failure of report.failures.slice(0, Number(process.env.HARNESS_SHOW || 10))) {
    console.log(`  ${failure.reason} @ ${failure.lat.toFixed(5)},${failure.lng.toFixed(5)} — ${failure.street || '(unnamed)'}${failure.distanceLeftPx ? ` (${failure.distanceLeftPx}px short)` : ''}`
      + (failure.wanderPx != null ? ` off-route ${failure.offRoutePx}px, wandered ${failure.wanderPx}px, speed ${failure.speed}, off-road ${failure.offRoadPx}px pair ${JSON.stringify(failure.pair)}` : ''));
    for (const row of failure.trace ?? []) console.log(`    ${JSON.stringify(row)}`);
  }
  if (pairs) return;

  // Inside one component every pair is routable by definition; this catches a
  // regression in the graph builder rather than in the extract.
  expect(report.routable).toBe(report.pairs);

  // No drive may end with the car pinned against the edge of the corridor.
  expect(report.outcomes.pinned).toBe(0);

  // Wedges are counted per drive, not in total, so the bound does not have to
  // be re-tuned every time the sample size changes — which is exactly how the
  // old absolute `<= 40` was calibrated against 24 drives and then meant
  // nothing at 120. Wedging at all was epidemic before the guard learned to
  // slide along a kerb rather than stop against it: 151 wedges in 24 drives,
  // or 6.3 each. It measures 1.6 each now. The bound is deliberately loose —
  // it is here to catch a return to that behaviour, not to pin a number.
  const wedgesPerDrive = report.wedges / report.pairs;
  expect(wedgesPerDrive,
    `${report.wedges} wedges across ${report.pairs} drives`).toBeLessThanOrEqual(3);

  // Arrival is a rate, for the same reason. Measured 2026-08-31 on the
  // 29,051-way extract: 71 of 120, 59%. The floor sits well below that because
  // a legitimate extract change moves this number in either direction — a
  // *sparser* network scores higher, since a half-sized one measured 71%. So
  // this asserts that the city stays drivable, and says nothing about whether
  // it is still fully mapped; `test:canal-car` is what pins coverage.
  //
  // Raised to 0.7 on 2026-09-30: the harness is deterministic now (102 of 120
  // on every run, same lost drives, with one worker or three), so a drop of
  // eighteen arrivals is a real regression in the guard, the graph or the
  // physics, not noise. The earlier run-to-run spread went away with the
  // 2026-09-29 load token, which stopped two loads writing the same world.
  const arrivalRate = report.outcomes.arrived / report.pairs;
  expect(arrivalRate,
    `${report.outcomes.arrived} of ${report.pairs} drives arrived`).toBeGreaterThanOrEqual(0.8);

  // And the network must not fragment back into islands.
  expect(report.componentShare).toBeGreaterThan(0.7);
});
