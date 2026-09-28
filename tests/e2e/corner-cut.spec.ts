import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-28, "we should be able to cut
// corners a bit more", the Oosterdokskade corner by LOT 61). Road corridors
// are straight bands with square inside corners, so a diagonal line through a
// turn hit the rollback. The inside of each corner is now filleted
// (`filletedExcess`): a point on the inside bisector 2 m past both edges is
// ridden as asphalt.
test('the Oosterdokskade corner by LOT 61 can be cut', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map geometry; one project is enough');
  test.setTimeout(120000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north' });
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame, track = game.track, loader = game.osmLoader;
    const mLat = 111320 * 3, mLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const target = { x: loader._lastOffsetX + (4.9058 - loader._lastCenterLng) * mLng, y: loader._lastOffsetY - (52.3763 - loader._lastCenterLat) * mLat };
    // Every vertex where Oosterdokskade meets another way at 45–135°.
    let best: any = null;
    for (const segment of track.segments) {
      const points = segment.points;
      for (let i = 0; i < points.length; i++) {
        const v = points[i];
        if (Math.hypot(v.x - target.x, v.y - target.y) > 450) continue;
        for (const other of track.segments) {
          if (other === segment) continue;
          const op = other.points;
          const end = Math.hypot(op[0].x - v.x, op[0].y - v.y) < 3 ? 0 : Math.hypot(op[op.length - 1].x - v.x, op[op.length - 1].y - v.y) < 3 ? op.length - 1 : -1;
          if (end < 0) continue;
          const armA = points[i > 0 ? i - 1 : i + 1], armB = op[end === 0 ? 1 : op.length - 2];
          if (!armA || !armB) continue;
          const ua = { x: armA.x - v.x, y: armA.y - v.y }, ub = { x: armB.x - v.x, y: armB.y - v.y };
          const la = Math.hypot(ua.x, ua.y), lb = Math.hypot(ub.x, ub.y);
          if (la < 30 || lb < 30) continue;
          const theta = Math.acos(Math.max(-1, Math.min(1, (ua.x * ub.x + ua.y * ub.y) / (la * lb))));
          if (theta < Math.PI / 4 || theta > 3 * Math.PI / 4) continue;
          if (!(segment.name === 'Oosterdokskade' || other.name === 'Oosterdokskade')) continue;
          const distance = Math.hypot(v.x - target.x, v.y - target.y);
          if (!best || distance < best.distance) best = { v, ua: { x: ua.x / la, y: ua.y / la }, ub: { x: ub.x / lb, y: ub.y / lb }, theta, distance, names: [segment.name, other.name], widths: [segment.width, other.width] };
        }
      }
    }
    if (!best) return null;
    const bisector = { x: best.ua.x + best.ub.x, y: best.ua.y + best.ub.y };
    const bl = Math.hypot(bisector.x, bisector.y);
    const width = Math.max(...best.widths);
    const reach = (width + 6) / Math.sin(best.theta / 2);
    const point = { x: best.v.x + bisector.x / bl * reach, y: best.v.y + bisector.y / bl * reach };
    const heading = Math.atan2(best.ua.y, best.ua.x);
    const guard = track.getGuardRoad(point.x, point.y, heading);
    const surface = (window as any).CanalRecallRoadSurface;
    const contacts = surface.contactsAt(surface.roadsNear(track.roadIndex, point.x, point.y, 2), point.x, point.y);
    const unfilleted = surface.pickGuardContact(contacts, heading);
    return { unfilleted: unfilleted.dist - unfilleted.width, names: best.names, theta: best.theta * 180 / Math.PI, metresAway: best.distance / 3, dist: guard?.dist, width: guard?.width, surface: track.getSurface(point.x, point.y) };
  });
  expect(result, 'the corner is still in the network').not.toBeNull();
  expect(result!.metresAway, JSON.stringify(result)).toBeLessThan(150);
  expect(result!.unfilleted, 'the square corner put this point past the edge').toBeGreaterThan(4);
  expect(result!.dist, JSON.stringify(result)).toBeLessThanOrEqual(result!.width);
  expect(result!.surface, JSON.stringify(result)).not.toBe('grass');
});
