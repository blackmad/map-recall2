import { expect, test } from '@playwright/test';
import { openRoute, setHiddenSelect } from './helpers';

// User report 2026-10-02: the bike started pointing away from the route, with the camera
// behind it, so the first thing a rider saw was the route line running off behind them.
// The road's tangent has two directions and the extract stores one arbitrarily.
//
// User report 2026-10-14 (boat, Hugo de Grootgracht to the IJ-toren, `?ownGround=1`): the
// boat still started facing along the canal away from a route that ran east. The planner's
// path begins at the graph node the start snapped to, which can lie behind the spawn, and the
// heading was read from that first vertex. In the 2026-10-14 probe boat seed 2468ace0 (first
// vertex 75 px north, route south) and bike seed 1234abcd (59 px north, route south) both faced
// backwards; seeds do not pin routes from run to run, so the user's start is also pinned below.
//
// Routes are not the same on every run (a seed does not pin them), so these check properties
// that hold for any route instead of one expected angle:
//   1. wiring: the start angle is what `startHeading` returns for the real road and route;
//   2. the spawn heading is within 30 degrees of the first leg's bearing, read here
//      independently: from the start's projection on the route's opening stretch (or that
//      projection itself, for a spawn off the route), the first point at least 35 px (12 m) away;
//   3. the chase camera's forward vector agrees at spawn, and once settled it sits behind.
type Ride = { label: string; travelMode: 'car' | 'boat'; seed?: number; from?: { id: string; name: string; lat: number; lng: number } };
const seeded = [['car', 0x5eed1234], ['car', 0x1234abcd], ['car', 0x0badf00d], ['car', 0x7777aaaa], ['car', 0x13572468], ['car', 0x2468ace1], ['boat', 0x5eed1234], ['boat', 0x2468ace0], ['boat', 0x11112222]] as const;
// The user's 2026-10-14 boat start, pinned: the west end of the Hugo de Grootgracht (Frederik
// Hendrikbuurt) to the IJ-toren. The planner's first vertex is ~12 m west of the spawn and the
// route then runs east past it; the pre-fix heading faced west, along the canal away from it.
const HUGO_DE_GROOTGRACHT = { id: 'start-heading-hugo-de-grootgracht', name: 'Hugo de Grootgracht (west end)', lat: 52.3719, lng: 4.868 };
const IJ_TOREN = { id: 'extract_landmarks_1963830588', name: 'IJ-toren', lat: 52.3776269, lng: 4.9163299 };
const rides: Ride[] = [
  ...seeded.map(([travelMode, seed]) => ({ label: `${travelMode} (seed ${seed.toString(16)})`, travelMode, seed })),
  { label: 'boat (Hugo de Grootgracht to the IJ-toren)', travelMode: 'boat', from: HUGO_DE_GROOTGRACHT },
  { label: 'bike (Hugo de Grootgracht to the IJ-toren)', travelMode: 'car', from: HUGO_DE_GROOTGRACHT },
];
const LEG_TOLERANCE_DEG = 30;
for (const ride of rides) {
  test(`${ride.label} starts facing along the route, camera behind`, async ({ page }) => {
    test.setTimeout(150_000);
    // Controls, to show these tests catch the bugs: START_HEADING_OFF=1 drops `startHeading`
    // (the road's arbitrary tangent, 2026-10-02); START_HEADING_OFF=old swaps in the pre-2026-10-14
    // version, which read the first leg from the route's first vertex.
    if (process.env.START_HEADING_OFF) {
      await page.addInitScript((mode: string) => {
        const old = (roadAngle: number, start: { x: number; y: number }, route: Array<{ x: number; y: number }> | null, finish: { x: number; y: number } | null) => {
          const targets: Array<{ x: number; y: number }> = [];
          if (route && route.length) for (const l of [35, 80, 150, 400]) targets.push(route.find(p => Math.hypot(p.x - start.x, p.y - start.y) >= l) ?? route[route.length - 1]);
          if (finish) targets.push(finish);
          let best = 0;
          for (const t of targets) {
            const dx = t.x - start.x, dy = t.y - start.y, len = Math.hypot(dx, dy);
            if (len < 20) continue;
            const along = (Math.cos(roadAngle) * dx + Math.sin(roadAngle) * dy) / len;
            if (Math.abs(along) >= 0.35) { best = along; break; }
            if (Math.abs(along) > Math.abs(best)) best = along;
          }
          return Math.abs(best) < 0.02 ? roadAngle : best >= 0 ? roadAngle : roadAngle + Math.PI;
        };
        let routeApi: any;
        Object.defineProperty(window, 'CanalRecallRoute', { configurable: true, get: () => routeApi, set: (value) => { routeApi = { ...value, startHeading: mode === 'old' ? old : undefined }; } });
      }, process.env.START_HEADING_OFF);
    }
    // An exception in the heading code during ride setup would stop the player spawning at all.
    const headingErrors: string[] = [];
    page.on('pageerror', error => { if (/startHeading|routeSelection|_setupRace/i.test(`${error.message} ${error.stack ?? ''}`)) headingErrors.push(error.message); });
    if (ride.from) {
      await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
      await page.goto('/canal-drive/');
      await page.waitForFunction(() => !!(window as any).canalRecallGame);
      await setHiddenSelect(page, 'travel-mode', ride.travelMode);
      await setHiddenSelect(page, 'view-mode', 'chase');
      await page.evaluate(([from, to]) => { (window as any).canalRecallGame._launchPoiRoute(from, to, { explicitDestination: true }); }, [ride.from, IJ_TOREN] as const);
      await page.waitForFunction((id) => (window as any).canalRecallGame?.player && (window as any).canalRecallGame.routeFrom?.id === id, ride.from.id, { timeout: 120_000 });
    } else {
      await openRoute(page, { travelMode: ride.travelMode, viewMode: 'chase', seed: ride.seed });
    }
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
      // The route ahead of the spawn: from its projection on the first ~300 m of the route.
      let best = { i: 0, t: 0, d: Infinity }, run = 0;
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i], b = route[i + 1], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        const t = len ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (len * len))) : 0;
        const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
        // Ties (1.5 px) go to the later segment: a doubled-back first leg is read where it passes the spawn again.
        if (d <= best.d + 1.5) best = { i, t, d: Math.min(d, best.d) };
        run += len; if (run > 900) break;
      }
      // A spawn off the route (a POI start short of the network) first heads for the route, so
      // the projection itself is the first target when it is far enough away.
      const a0 = route[best.i], b0 = route[best.i + 1] ?? route[best.i];
      const projection = { x: a0.x + (b0.x - a0.x) * best.t, y: a0.y + (b0.y - a0.y) * best.t };
      const ahead = route.length > 1 ? [projection, ...route.slice(best.i + 1)] : route;
      const first = ahead.find(p => Math.hypot(p.x - x, p.y - y) >= 35) ?? ahead[ahead.length - 1];
      const legBearing = first ? Math.atan2(first.y - y, first.x - x) : null;
      const firstLeg = first ? ((first.x - x) * Math.cos(roadAngle) + (first.y - y) * Math.sin(roadAngle)) / Math.hypot(first.x - x, first.y - y) : 0;
      const along = (a: number) => Math.cos(a) * Math.cos(roadAngle) + Math.sin(a) * Math.sin(roadAngle);
      const gameBearing = game.vectorMap.map?.getBearing?.();
      const wanted = (((angle + Math.PI / 2) * 180 / Math.PI) % 360 + 360) % 360;
      // The camera looks along rotation - 90 degrees in the world frame (y down); bearing = rotation.
      const cameraForward = game.camera.rotation - Math.PI / 2;
      return {
        routeHead: route.slice(0, 8).map(p => [Math.round(p.x - x), Math.round(p.y - y)]), roadDeg: Math.round(roadAngle * 180 / Math.PI),
        routePoints: route.length, firstLeg, headingAlongRoad: along(angle), expectedAngle, angle, legBearing, cameraForward,
        bearing: gameBearing == null ? null : ((gameBearing % 360) + 360) % 360, wanted,
      };
    });
    const offDeg = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) * 180 / Math.PI;
    const result = await measure();
    expect(result.routePoints).toBeGreaterThan(1);
    // 1. Wiring (angles compared modulo a full turn).
    if (process.env.START_HEADING_OFF) {
      // The control: with the fix off only properties 2 and 3 can catch the old behaviour.
    } else {
      expect(result.expectedAngle, 'startHeading is loaded').not.toBeNull();
      const diff = Math.abs(Math.atan2(Math.sin(result.angle - result.expectedAngle!), Math.cos(result.angle - result.expectedAngle!)));
      expect(diff, JSON.stringify(result)).toBeLessThan(0.01);
    }
    // 2. The spawn faces the first leg.
    expect(result.legBearing, 'the route gives a first leg').not.toBeNull();
    expect(offDeg(result.angle, result.legBearing!), `spawn heading vs first leg: ${JSON.stringify(result)}`).toBeLessThanOrEqual(LEG_TOLERANCE_DEG);
    if (Math.abs(result.firstLeg) >= 0.5) {
      expect(Math.sign(result.headingAlongRoad) * Math.sign(result.firstLeg), `facing away from a clear first leg: ${JSON.stringify(result)}`).toBeGreaterThan(0);
    }
    // 3. The chase camera faces the same way (it is reset behind the vehicle at spawn), and once
    // the intro has eased around it sits behind the heading on the map too.
    expect(offDeg(result.cameraForward, result.legBearing!), `camera forward vs first leg: ${JSON.stringify(result)}`).toBeLessThanOrEqual(LEG_TOLERANCE_DEG);
    if (result.bearing != null) {
      await expect.poll(async () => {
        const now = await measure();
        return Math.abs(((now.bearing! - now.wanted + 540) % 360) - 180);
      }, { timeout: 20_000, message: 'camera settles behind the heading' }).toBeLessThan(25);
    }
  });
}
