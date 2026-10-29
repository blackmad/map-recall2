import { test, expect, type Page } from '@playwright/test';
import { setHiddenSelect } from './helpers';

// Named regressions (feedback of 2026-10-25, build 2620cb1) against the live
// rendered water mask. Geometry with OSM water is pinned in
// scripts/check-canal-car.ts; this drives the real controller.
//   50ea10bf: an F4 vessel from Centraal lay by the Buiksloterweg pontoon and would not dock.
//   1d632c41: the vessel stood on the NDSM-werf quay 24.7 m from the stop and would not dock.
//   f80d47da: the hull ran half over the north-shore quay at 52.392846,4.897173.
const cases = [
  { id: '50ea10bf', label: 'Buiksloterweg', lat: 52.382217, lng: 4.903187, heading: 310.8, dock: 'Buiksloterweg' },
  { id: '1d632c41', label: 'NDSM-werf', lat: 52.401408, lng: 4.891088, heading: 284.4, dock: 'NDSM-werf' },
  { id: 'f80d47da', label: 'north shore', lat: 52.392846, lng: 4.897173, heading: 290.1, dock: null },
] as const;

async function launch(page: Page) {
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame)).toBe(true);
  await setHiddenSelect(page, 'travel-mode', 'car');
  await setHiddenSelect(page, 'view-mode', 'chase');
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._launchPoiRoute({ id: 'ferry-fb-south', name: 'South test', lat: 52.3741, lng: 4.8950 },
      { id: 'ferry-fb-noord', name: 'Noord test', lat: 52.3990, lng: 4.8930 }, { explicitDestination: true });
  });
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame.player), { timeout: 90000 }).toBe(true);
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.state = 4; g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; });
}

for (const c of cases) {
  test(`ferry feedback ${c.id}: ${c.label}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard controller; one project is enough');
    test.setTimeout(180000);
    await launch(page);
    // Aboard an F4 vessel from Centraal, 70 m back along the reported heading.
    await page.evaluate(({ lat, lng, heading }) => {
      const g = (window as any).canalRecallGame, p = g.player, F = (window as any).CanalRecallFerry;
      const links = F.ferryLinksOf(g.track);
      const origin = links.find((l: any) => l.ref === 'F4').to.name === 'Centraal Station' ? links.find((l: any) => l.ref === 'F4').to : links.find((l: any) => l.ref === 'F4').from;
      const target = g.osmLoader.latLngToWorld(lat, lng), a = heading * Math.PI / 180;
      const start = { x: target.x - Math.cos(a) * 210, y: target.y - Math.sin(a) * 210, angle: a };
      p.speed = 0;
      F.board(p, { terminal: origin, berth: start }, links);
      p.ferryUnarmed = [];
      p.ferryDeparted = true;
      g.camera.x = p.x; g.camera.y = p.y;
      const w = window as any;
      w.__ferryLog = { aground: 0, frames: 0, results: {} as Record<string, number> };
      const runtime = w.CanalRecallFerryTravel, after = runtime.afterMove.bind(runtime);
      runtime.afterMove = (game: any, previous: any) => {
        const r = after(game, previous);
        const log = w.__ferryLog; log.frames++; log.results[r] = (log.results[r] || 0) + 1;
        const q = game.player;
        if (r === "docked") log.docked = { x: q.x, y: q.y };
        if (r === "blocked") (log.blockedAt ||= []).push(log.frames);
        if (q.ferryOrigin) {
          const edge = F.leadingEdge(q, previous) || [];
          const wet = (x: number, y: number) => game.vectorMap.isWater(x, y, game.osmLoader);
          // A blocked frame restores the previous position: that is where the
          // vessel ended up. Count hulls that moved onto land.
          const moved = Math.hypot(q.x - previous.x, q.y - previous.y) > 0;
          if (moved && [q, ...edge].some((e: any) => !wet(e.x, e.y))) log.aground++;
        }
        return r;
      };
    }, c);
    // Let the water mask render around the vessel before it moves.
    await expect.poll(() => page.evaluate(() => { const g = (window as any).canalRecallGame, p = g.player; return g.vectorMap.isWater(p.x, p.y, g.osmLoader); }), { timeout: 15000 }).toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: testInfo.outputPath(`${c.id}-approach.png`) });
    await page.keyboard.down('ArrowUp');
    if (c.dock) {
      await expect.poll(() => page.evaluate(() => !(window as any).canalRecallGame.player.ferryOrigin), { timeout: 20000 }).toBe(true);
    } else {
      await page.waitForTimeout(5000);
    }
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath(`${c.id}-after.png`) });
    const state = await page.evaluate(() => {
      const g = (window as any).canalRecallGame, p = g.player, F = (window as any).CanalRecallFerry;
      const piers = F.ferryAccessesOf(g.track).map((s: any) => s.ferryTerminal);
      const at0 = (window as any).__ferryLog.docked || p;
      const nearest = piers.reduce((a: any, b: any) => (Math.hypot(a.land.x - at0.x, a.land.y - at0.y) < Math.hypot(b.land.x - at0.x, b.land.y - at0.y) ? a : b));
      const log = (window as any).__ferryLog, at = log.docked || p;
      return { aboard: !!p.ferryOrigin, isBoat: !!p.isBoat, pier: nearest.name, atLand: Math.hypot(nearest.land.x - at.x, nearest.land.y - at.y) < 0.5, log };
    });
    console.log(JSON.stringify({ id: c.id, ...state }));
    if (c.dock) {
      expect(state).toMatchObject({ aboard: false, isBoat: false, pier: c.dock, atLand: true });
    } else {
      expect(state.aboard).toBe(true);
      expect(state.log.aground, 'frames with the hull centre or bow on land').toBe(0);
      expect(state.log.results.blocked || 0, 'the bank stopped the vessel').toBeGreaterThan(0);
    }
  });
}
