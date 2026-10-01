import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Every bridge, both ways (user report 2026-09-30: "my bike is entirely stuck
// on this bridge, can't move at all" — "please make sure to fix the bridge
// navigation once and for all").
//
// By default it drives a named set: the Westeinde bridges south of
// Frederiksplein from the report, and bridges the full sweep pinned the bike
// on before surface connectors, the past-the-end guard contact and the
// shoulder step fix (2026-09-30: 416 pins on 33 crossings → 161 on 13).
// BRIDGE_SWEEP_ALL=1 drives every bridge way (~1 min; 0 pins since the
// trail-following back-out, 2026-10-01). Both assert zero pins and traps.
//
// For each bridge way in the routing extract the bike starts ~45 m before one
// end, is routed to ~45 m past the other, and is driven there by the driving
// harness's autopilot with the game's own physics and road guard. A drive
// whose route does not actually cross the deck is skipped, not counted.
//
//   BRIDGE_SWEEP_ALL=1     every bridge way instead of the named set
//   BRIDGE_SWEEP_LIMIT=n   only the first n bridges
//   BRIDGE_SWEEP_IDS=a,b   only these feature ids
//   BRIDGE_SWEEP_NEAR=lat,lng,metres  only bridges around a point
//   BRIDGE_SWEEP_OUT=path  write the full report as JSON
//
// The driver rides like a player: stopped for 0.75 s (or rocking within 8 px
// for 1.5 s) it backs out the way it came, along the trail it actually rode,
// ~50 px (further on each retry, ≤ 3 s), then plans again from there. A pin is
// 4 s, recovery included, without getting 10 px from anywhere. Each pin is then
// tested the way a player would get out (full left, straight, full right and
// reverse, 3 s each); a pin none of those frees is a trap.

type Bridge = { id: string; name: string; path: Array<[number, number]> };

const NAMED_BRIDGES = [
  'routing_10504', 'routing_10502', 'routing_29842', // Westeinde over the Singelgracht (user report)
  'routing_11683', // Karel van het Revebrug: way end short of the next street
  'routing_42558', // Ezelsbrug
  'routing_8479', // Cornelis Lelylaan
  'routing_11910', // Hoofdweg
  'routing_11132', // Molenaarsweg
  'routing_17496', // Baden Powellweg
  'routing_41128', // Nieuwe Utrechtseweg
  'routing_43343', // Dijkmeerlaan
  'routing_22983', // Papendrechtstraat
  'routing_11538', // Oeverlandenweg
];

test('the bike crosses every bridge in both directions without wedging', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pure simulation; one project is enough');
  test.setTimeout(3_600_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 90_000 });
  const limit = Number(process.env.BRIDGE_SWEEP_LIMIT || 0);
  const all = process.env.BRIDGE_SWEEP_ALL === '1' || Boolean(process.env.BRIDGE_SWEEP_NEAR || process.env.BRIDGE_SWEEP_LIMIT);
  const onlyIds = (process.env.BRIDGE_SWEEP_IDS || (all ? '' : NAMED_BRIDGES.join(','))).split(',').filter(Boolean);
  const near = process.env.BRIDGE_SWEEP_NEAR ? process.env.BRIDGE_SWEEP_NEAR.split(',').map(Number) : null;
  const report = await page.evaluate(async ({ limit, onlyIds, near }) => {
    const game = (window as any).canalRecallGame;
    const features = await (await fetch('../data/extracts/amsterdam/streets-routing.json')).json();
    let bridges: Bridge[] = features
      .filter((f: any) => f.bridge && (f.paths || [f.path]).some((p: any) => p && p.length >= 2))
      .map((f: any) => ({ id: f.id, name: f.name, path: (f.paths || [f.path]).find((p: any) => p && p.length >= 2) }))
      // A closed ring is a deck outline, not a way to ride (see osm-loader).
      .filter((b: Bridge) => !(b.path.length > 3 && b.path[0][0] === b.path.at(-1)![0] && b.path[0][1] === b.path.at(-1)![1]));
    if (onlyIds.length) bridges = bridges.filter(b => onlyIds.includes(b.id));
    if (near) {
      const [lat, lng, metres] = near;
      bridges = bridges.filter(b => b.path.some(([pLat, pLng]) =>
        Math.hypot((pLat - lat) * 111320, (pLng - lng) * 111320 * Math.cos(lat * Math.PI / 180)) < metres));
    }
    if (limit) bridges = bridges.slice(0, limit);

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
    const { allNodes } = game.track._routingGraph();
    const CELL = 120;
    const grid = new Map<string, any[]>();
    for (const node of allNodes) {
      const key = `${Math.floor(node.x / CELL)},${Math.floor(node.y / CELL)}`;
      (grid.get(key) ?? grid.set(key, []).get(key)!).push(node);
    }
    const snap = (p: { x: number; y: number }) => {
      let best = null, bestDistance = Infinity;
      const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const node of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          // Not the tip of a dead-end stub: a rider does not start a crossing
          // facing the end of a cul-de-sac, and the driver cannot three-point turn.
          if (node.edges.length < 2) continue;
          const d = Math.hypot(node.x - p.x, node.y - p.y);
          if (d < bestDistance) { bestDistance = d; best = node; }
        }
      }
      return bestDistance < 90 ? best : null;
    };
    const segDist = (p: any, a: any, b: any) => {
      const abx = b.x - a.x, aby = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
      return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y);
    };

    game.state = 6; // PAUSED: the sweep steps the simulation itself
    const player = game.player;
    player.handleInput = () => {};
    game._updateCanalQuiz = () => {};
    game._updateBridgeQuiz = () => {};
    let tried: any = null;
    if (onlyIds.length) {
      const update = player.update.bind(player);
      player.update = (dt: number, track: any) => {
        update(dt, track);
        tried = [+player.x.toFixed(1), +player.y.toFixed(1)];
        const S = (window as any).CanalRecallRoadSurface;
        const all = S.contactsAt(S.roadsNear(track.roadIndex, player.x, player.y, 2), player.x, player.y)
          .filter((c: any) => c.dist < c.width + 12)
          .map((c: any) => `${c.segIdx}/${c.ptIdx}:${c.dist.toFixed(1)}/${c.width}@${c.angle.toFixed(2)}`);
        const g = track.getGuardRoad(player.x, player.y, player.angle);
        tried.push(g && `${g.segIdx}/${g.ptIdx}:${g.dist.toFixed(1)}/${g.width}@${g.angle.toFixed(2)}`, [...new Set(all)].join(' '));
      };
    }
    const STEP = 1 / 30;
    const escapes = () => {
      const saved = { x: player.x, y: player.y, angle: player.angle, speed: player.speed, vx: player.vx, vy: player.vy, blocked: game._blockedCarFrames };
      const tries: number[] = [];
      for (const [steer, throttle, brake] of [[-1, 1, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1]]) {
        Object.assign(player, { x: saved.x, y: saved.y, angle: saved.angle, speed: saved.speed, vx: saved.vx, vy: saved.vy });
        game._blockedCarFrames = saved.blocked;
        let far = 0;
        for (let t = 0; t < 3; t += STEP) {
          Object.assign(player, { steerInput: steer, throttle, brake, handbrake: false });
          game.track.clearFrameCache();
          game._updateRacing(STEP);
          far = Math.max(far, Math.hypot(player.x - saved.x, player.y - saved.y));
        }
        tries.push(Math.round(far));
      }
      Object.assign(player, { x: saved.x, y: saved.y, angle: saved.angle, speed: saved.speed, vx: saved.vx, vy: saved.vy });
      game._blockedCarFrames = saved.blocked;
      return tries;
    };
    let trapCount = 0;
    const failures: any[] = [];
    let driven = 0, skipped = 0, arrivedCount = 0, wedgeCount = 0;
    for (const bridge of bridges) {
      const pts = bridge.path.map(toWorld);
      const mid = pts[Math.floor(pts.length / 2)];
      const midpoint = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : mid;
      for (const reverse of [false, true]) {
        const way = reverse ? [...pts].reverse() : pts;
        const a = way[0], a2 = way[1], b = way.at(-1)!, b2 = way.at(-2)!;
        const out = (p: any, q: any) => { const l = Math.hypot(p.x - q.x, p.y - q.y) || 1; return { x: p.x + (p.x - q.x) / l * 135, y: p.y + (p.y - q.y) / l * 135 }; };
        const from = snap(out(a, a2)), to = snap(out(b, b2));
        if (!from || !to || from === to) { skipped++; continue; }
        const route = game.track.findRoute(from, to);
        if (!route || route.length < 2) { skipped++; continue; }
        let crosses = false;
        for (let i = 0; i < route.length - 1 && !crosses; i++) crosses = segDist(midpoint, route[i], route[i + 1]) < 12;
        if (!crosses) { skipped++; continue; }
        driven++;
        Object.assign(player, { x: from.x, y: from.y, speed: 0, vx: 0, vy: 0, angle: Math.atan2(route[1].y - from.y, route[1].x - from.x) });
        player._uTurnHeading = null;
        game._blockedCarFrames = 0;
        game.track.finishPoint = { ...to };
        let index = 1, pinned = 0, wedges = 0, arrived = false, wedgeAt: [number, number] | null = null;
        let path = route, replans = 0, stillFor = 0, recover = 0;
        // Where the bike has actually been, every 8 px: always rideable, so the
        // way out of a tip it nosed into.
        const trail: Array<{ x: number; y: number }> = [{ x: from.x, y: from.y }];
        let backTo: { x: number; y: number } | null = null;
        const history: Array<{ x: number; y: number }> = [];
        const pinHistory: Array<{ x: number; y: number }> = [];
        const traps: any[] = [];
        const trace: any[] = [];
        for (let elapsed = 0; elapsed < 30 && !arrived; elapsed += STEP) {
          let nearestDistance = Infinity;
          for (let i = Math.max(0, index - 4); i < Math.min(path.length, index + 24); i++) {
            const d = Math.hypot(path[i].x - player.x, path[i].y - player.y);
            if (d < nearestDistance) { nearestDistance = d; index = i; }
          }
          // Knocked off the plan (a kerb, a missed turn): plan again from here,
          // as the game's own reroute does.
          if (nearestDistance > 60 && replans < 8) {
            const again = game.track.findRoute({ x: player.x, y: player.y }, to);
            if (again && again.length >= 2) { path = again; index = 0; replans++; }
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
          // Stopped against a kerb or the end of a way, a player backs out.
          // Stopped, or rocking in place without getting anywhere.
          const recent = history.slice(-45);
          const rocking = recent.length === 45 && recent.every(q => Math.hypot(q.x - recent[0].x, q.y - recent[0].y) < 8);
          if ((stillFor > 0.75 || rocking) && recover <= 0) {
            recover = 3; stillFor = 0; history.length = 0;
            // ~50 px back along the trail; the points passed are dropped, so a
            // second try goes further back.
            let back = 0;
            while (trail.length > 1 && back < 50) {
              const last = trail.pop()!;
              back += Math.hypot(last.x - trail[trail.length - 1].x, last.y - trail[trail.length - 1].y);
            }
            backTo = { ...trail[trail.length - 1] };
          }
          // (`history` drives recovery; `pinHistory` is never cleared by it, so
          // a bike that recovery cannot free still counts as pinned.)
          if (recover > 0 && backTo && Math.hypot(backTo.x - player.x, backTo.y - player.y) < 12) recover = 0;
          if (recover <= 0 && backTo) {
            // Backed out: plan again from here.
            backTo = null;
            const again = game.track.findRoute({ x: player.x, y: player.y }, to);
            if (again && again.length >= 2) { path = again; index = 0; }
          }
          if (recover > 0 && backTo) {
            // Reverse with the tail toward the trail point: the bike moves
            // along -heading, so point the nose straight away from it.
            recover -= STEP;
            let away = Math.atan2(player.y - backTo.y, player.x - backTo.x) - player.angle;
            away = Math.atan2(Math.sin(away), Math.cos(away));
            player.steerInput = Math.max(-1, Math.min(1, away * 2.5));
            player.throttle = 0;
            player.brake = 1;
          } else {
            player.steerInput = Math.max(-1, Math.min(1, error * 2.5));
            player.throttle = player.speed < cruise ? 1 : 0;
            player.brake = player.speed > cruise * 1.6 ? 1 : 0;
          }
          player.handbrake = false;
          game.track.clearFrameCache();
          const before = { x: player.x, y: player.y };
          game._updateRacing(STEP);
          const moved = Math.hypot(player.x - before.x, player.y - before.y);
          if (trace.length < 400 && wedges === 0) {
            const g = game.track.getGuardRoad(player.x, player.y, player.angle);
            trace.push({ at: toLatLng(player.x, player.y), p: [+player.x.toFixed(1), +player.y.toFixed(1)], a: +player.angle.toFixed(2), v: +player.speed.toFixed(1), steer: +player.steerInput.toFixed(2), blocked: game._blockedCarFrames, tried, pref: game.track._preferredCorridorName || null, uturn: player._uTurnHeading ?? null, hard: !!player._stickHardSteer,
              g: g && { x: +g.x.toFixed(1), y: +g.y.toFixed(1), dist: +g.dist.toFixed(1), width: +g.width.toFixed(1), angle: +g.angle.toFixed(2), seg: g.segIdx, name: game.track.segments[g.segIdx]?.name } });
            if (trace.length > 90) trace.shift();
          }
          stillFor = moved < 0.5 ? stillFor + STEP : 0;
          if (recover <= 0) {
            const tip = trail[trail.length - 1];
            if (Math.hypot(player.x - tip.x, player.y - tip.y) >= 8) trail.push({ x: player.x, y: player.y });
          }
          // A pin: 4 s, recovery included, without getting 10 px from anywhere.
          history.push({ x: player.x, y: player.y });
          if (history.length > 120) history.shift();
          pinHistory.push({ x: player.x, y: player.y });
          if (pinHistory.length > 120) pinHistory.shift();
          const anchor = pinHistory[0];
          pinned = pinHistory.length === 120 && pinHistory.every(q => Math.hypot(q.x - anchor.x, q.y - anchor.y) < 10) ? 1 : 0;
          if (pinned) {
            pinHistory.length = 0;
            wedges++; wedgeAt ??= toLatLng(player.x, player.y);
            const tries = escapes();
            if (Math.max(...tries) < 30 && traps.length < 3) traps.push({ at: toLatLng(player.x, player.y), headingDeg: Math.round(player.angle * 180 / Math.PI), tries });
          }
          arrived = Math.hypot(to.x - player.x, to.y - player.y) < 60;
        }
        if (arrived) arrivedCount++;
        wedgeCount += wedges;
        trapCount += traps.length;
        if (wedges || !arrived) {
          failures.push({
            id: bridge.id, name: bridge.name, reverse, wedges, traps, replans, arrived,
            bridge: toLatLng(midpoint.x, midpoint.y), wedgeAt,
            endedAt: toLatLng(player.x, player.y),
            road: game.track.getRoadName(player.x, player.y, player.angle),
            ...(onlyIds.length ? { trace, path: path.filter((q: any) => Math.hypot(q.x - player.x, q.y - player.y) < 200).map((q: any) => [+q.x.toFixed(1), +q.y.toFixed(1)]) } : {}),
          });
        }
      }
    }
    game.state = 4;
    return { bridges: bridges.length, driven, skipped, arrived: arrivedCount, wedges: wedgeCount, traps: trapCount, failures };
  }, { limit, onlyIds, near });
  if (process.env.BRIDGE_SWEEP_OUT) writeFileSync(process.env.BRIDGE_SWEEP_OUT, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, failures: report.failures.length }));
  expect(report.failures.filter((f: any) => f.traps.length), 'crossings with a trap').toEqual([]);
  expect(report.failures.filter((f: any) => f.wedges).map((f: any) => `${f.name || f.id} ${f.reverse ? '←' : '→'}`), 'pinned crossings').toEqual([]);
});
