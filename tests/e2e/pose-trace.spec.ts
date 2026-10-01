import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Diagnostic, not a regression: POSE_TRACE="lat,lng,headingDeg,steer[,speed[,throttle,brake]]" drives
// one pose for 3 s with the throttle open and writes every frame (position,
// speed, guard contact and blocked frames) to POSE_TRACE_OUT.
test('trace one pose', async ({ page }, testInfo) => {
  test.skip(!process.env.POSE_TRACE || testInfo.project.name !== 'desktop', 'diagnostic; set POSE_TRACE');
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 90_000 });
  const [lat, lng, headingDeg, steer, speed = 0, throttle = 1, brake = 0] = process.env.POSE_TRACE!.split(',').map(Number);
  const frames = await page.evaluate(({ lat, lng, headingDeg, steer, speed, throttle, brake }) => {
    const game = (window as any).canalRecallGame;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const x = loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng;
    const y = loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat;
    game.state = 6;
    const player = game.player;
    player.handleInput = () => {};
    game._updateCanalQuiz = () => {};
    game._updateBridgeQuiz = () => {};
    Object.assign(player, { x, y, angle: headingDeg * Math.PI / 180, speed, vx: 0, vy: 0 });
    const Car = (window as any).CanalRecallCar;
    const original = Car.constrainCarToRoad;
    let last: any = null;
    Car.constrainCarToRoad = (car: any, prev: any, road: any, prevRoad: any, opts: any) => {
      const tried = { x: +car.x.toFixed(1), y: +car.y.toFixed(1) };
      const result = original(car, prev, road, prevRoad, opts);
      const c = (r: any) => r && { x: +r.x.toFixed(1), y: +r.y.toFixed(1), dist: +r.dist.toFixed(1), width: r.width, angle: +r.angle.toFixed(2), seg: r.segIdx };
      last = { tried, result, road: c(road), prevRoad: c(prevRoad) };
      return result;
    };
    game._blockedCarFrames = 0;
    const out: any[] = [];
    const contacts = (px: number, py: number) => {
      const S = (window as any).CanalRecallRoadSurface;
      return S.contactsAt(S.roadsNear(game.track.roadIndex, px, py, 2), px, py)
        .filter((c: any) => c.dist < c.width + 30)
        .map((c: any) => ({ seg: c.segIdx, name: game.track.segments[c.segIdx]?.name, dist: +c.dist.toFixed(1), width: c.width, angle: +c.angle.toFixed(2) }));
    };
    for (let f = 0; f < 90; f++) {
      player.steerInput = steer; player.throttle = throttle; player.brake = brake; player.handbrake = false;
      game.track.clearFrameCache();
      game.track.clearFrameCache();
      game._updateRacing(1 / 30);
      const g = game.track.getGuardRoad(player.x, player.y, player.angle);
      out.push({ f, p: [+player.x.toFixed(1), +player.y.toFixed(1)], guard: last, a: +player.angle.toFixed(2), v: +player.speed.toFixed(1), blocked: game._blockedCarFrames,
        g: g && { seg: g.segIdx, dist: +g.dist.toFixed(1), width: g.width, angle: +g.angle.toFixed(2) },
        ...(f % 15 === 0 ? { contacts: contacts(player.x, player.y) } : {}) });
    }
    Car.constrainCarToRoad = original;
    game.state = 4;
    return out;
  }, { lat, lng, headingDeg, steer, speed, throttle, brake });
  writeFileSync(process.env.POSE_TRACE_OUT || 'pose-trace.json', JSON.stringify(frames, null, 1));
});
