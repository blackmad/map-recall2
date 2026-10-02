import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

// User report 2026-10-02: the bike started pointing away from the route, with the camera
// behind it, so the first thing a rider saw was the route line running off behind them.
// The road's tangent has two directions and the extract picks one arbitrarily.
//
// Routes are not the same on every run (a seed does not pin them), so these check properties
// that hold for any route instead of one expected angle:
//   1. wiring: the start angle is what `startHeading` returns for the real road and route;
//   2. when the first 35 px of the route clearly run one way along the road, the bike faces that way;
//   3. once the camera settles it sits behind the bike.
// (Which direction is best for a route that leaves sideways is the unit check's business.)
const rides = [['car', 0x5eed1234], ['car', 0x1234abcd], ['car', 0x0badf00d], ['car', 0x7777aaaa], ['car', 0x13572468], ['car', 0x2468ace1], ['boat', 0x5eed1234], ['boat', 0x2468ace0]] as const;
for (const [travelMode, seed] of rides) {
  test(`${travelMode} (seed ${seed.toString(16)}) starts facing along the route, camera behind`, async ({ page }) => {
    test.setTimeout(150_000);
    // START_HEADING_OFF=1 swaps the fix for the old behaviour, to show these tests do catch it.
    if (process.env.START_HEADING_OFF) {
      await page.addInitScript(() => {
        let routeApi: any;
        Object.defineProperty(window, 'CanalRecallRoute', { configurable: true, get: () => routeApi, set: (value) => { routeApi = { ...value, startHeading: undefined }; } });
      });
    }
    // An exception in the heading code during ride setup would stop the player spawning at all.
    const headingErrors: string[] = [];
    page.on('pageerror', error => { if (/startHeading|routeSelection|_setupRace/i.test(`${error.message} ${error.stack ?? ''}`)) headingErrors.push(error.message); });
    await openRoute(page, { travelMode, viewMode: 'chase', seed });
    expect(headingErrors, 'heading code threw while setting up the ride').toEqual([]);
    const measure = () => page.evaluate(() => {
      const game = (window as any).canalRecallGame;
      const { x, y, angle } = game.player;
      const route: Array<{ x: number; y: number }> = game.routePath ?? [];
      const start = game.track.startPoint;
      const road = game.track.getNearestRoad(start.x, start.y, null);
      const roadAngle: number = road ? road.angle : 0;
      const fn = (window as any).CanalRecallRoute?.startHeading;
      const expectedAngle: number | null = fn ? fn(roadAngle, { x: start.x, y: start.y }, route, game.track.finishPoint) : null;
      const first = route.find(p => Math.hypot(p.x - x, p.y - y) >= 35);
      const firstLeg = first ? ((first.x - x) * Math.cos(roadAngle) + (first.y - y) * Math.sin(roadAngle)) / Math.hypot(first.x - x, first.y - y) : 0;
      const along = (a: number) => Math.cos(a) * Math.cos(roadAngle) + Math.sin(a) * Math.sin(roadAngle);
      const gameBearing = game.vectorMap.map?.getBearing?.();
      const wanted = (((angle + Math.PI / 2) * 180 / Math.PI) % 360 + 360) % 360;
      return {
        routePoints: route.length, firstLeg, headingAlongRoad: along(angle), expectedAngle, angle,
        bearing: gameBearing == null ? null : ((gameBearing % 360) + 360) % 360, wanted,
      };
    });
    const result = await measure();
    expect(result.routePoints).toBeGreaterThan(1);
    // 1. Wiring (angles compared modulo a full turn).
    if (process.env.START_HEADING_OFF) {
      // The control: with the fix off only property 2 can catch the old behaviour.
    } else {
      expect(result.expectedAngle, 'startHeading is loaded').not.toBeNull();
      const diff = Math.abs(Math.atan2(Math.sin(result.angle - result.expectedAngle!), Math.cos(result.angle - result.expectedAngle!)));
      expect(diff, JSON.stringify(result)).toBeLessThan(0.01);
    }
    // 2. A clear first leg decides: facing along the road the way the route leaves.
    if (Math.abs(result.firstLeg) >= 0.5) {
      expect(Math.sign(result.headingAlongRoad) * Math.sign(result.firstLeg), `facing away from a clear first leg: ${JSON.stringify(result)}`).toBeGreaterThan(0);
    }
    // 3. The camera eases around after the spawn; once settled it sits behind the bike.
    if (result.bearing != null) {
      await expect.poll(async () => {
        const now = await measure();
        return Math.abs(((now.bearing! - now.wanted + 540) % 360) - 180);
      }, { timeout: 20_000, message: 'camera settles behind the heading' }).toBeLessThan(25);
    }
  });
}
