import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';
import { budget } from './helpers/budget';

// Named regression (user report 2026-11-05, own engine, plan #213 item B): riding into a house front made the house
// vanish. Under `?engine=own` the cover query is the streamed footprint at the rider's exact point
// (ownWorldView.updateRiderCover), and the road corridor's edge on a narrow canal street lies a little inside the
// houses' footprints, so a bump read as "under a building" and setHidden('cover') took the house away. The cover is
// now route-aware (coveredPassage.ts coveringBuildingOnPath) and dims rather than hides.
//
// Two Jordaan streets: Nieuwe Leliestraat by the world A/B's bloemgracht-80 spot (a narrow street, where the road
// corridor reaches furthest into the house footprints) and Bloemgracht's canal-side street a block south. The rider is
// put on the named street's centreline nearest the spot, turned to face the nearer house, and held at full throttle
// into it for four seconds. Asserted: no
// building is hidden or ghosted for the cover and the rider is never read as covered. Logged: how far the bike's
// point gets inside a footprint (the road guard's clamp, a road-lane measurement: 2.2-2.6 m at Nieuwe Leliestraat on
// 2026-11-05) and what the old rule (`?coverRoute=0`) did at the same spot. The rider is off the seeded route, so the
// road-underfoot rule answers (the harder case: on the route the route itself runs on along the street).

// `reaches`: the bike's point gets inside the house footprint there (measured 2026-11-05: Nieuwe Leliestraat 1.1-2.6 m,
// Bloemgracht 1.4 m: the road guard's clamp, a road-lane item, lets the bike's point that far into a footprint).
const SPOTS = {
  'Nieuwe Leliestraat': { at: [52.3752, 4.8798], reaches: true },
  Bloemgracht: { at: [52.3747, 4.8800], reaches: true },
} as const satisfies Record<string, { at: readonly [number, number]; reaches: boolean }>; // lat, lng

type Probe = { covered: boolean; cover: string[]; ghosted: string[]; depthM: number; id: string | null };

async function bumpHouse(page: Page, street: keyof typeof SPOTS): Promise<{ road: string; facing: number; samples: Probe[] }> {
  const [lat, lng] = SPOTS[street].at;
  const setup = await page.evaluate(([lat, lng, street]) => {
    const game = (window as any).canalRecallGame;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const px = loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng;
    const py = loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat;
    // The named street's centreline point nearest the spot.
    let best = { d: Infinity, x: px, y: py };
    for (const seg of game.track.segments) {
      if (seg.name !== street) continue;
      for (let i = 1; i < seg.points.length; i++) {
        const a = seg.points[i - 1], b = seg.points[i], dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0;
        const x = a.x + dx * t, y = a.y + dy * t, d = Math.hypot(x - px, y - py);
        if (d < best.d) best = { d, x, y };
      }
    }
    const x = best.x, y = best.y;
    const road = game.track.getNearestRoad(x, y);
    // Put the rider there first: the city streams around the rider and the camera.
    Object.assign(game.player, { x: road.x, y: road.y, vx: 0, vy: 0, speed: 0, angle: road.angle });
    return { x: road.x, y: road.y, angle: road.angle, name: game.track.getRoadName(road.x, road.y) };
  }, [lat, lng, street] as const);
  // Face the nearer house front (perpendicular to the street), once the streamed footprints there have arrived.
  const scan = () => page.evaluate(({ x, y, angle }) => {
    const game = (window as any).canalRecallGame, vm = game.vectorMap, city = vm._completeCity;
    let best = { angle, d: Infinity };
    if (!city?.featuresAt) return best;
    for (const side of [-Math.PI / 2, Math.PI / 2]) {
      const a = angle + side;
      for (let m = 1; m <= 15; m += 0.5) {
        const [lo, la] = vm.worldToLngLat(x + Math.cos(a) * m * 3, y + Math.sin(a) * m * 3, game.osmLoader);
        if (city.featuresAt(lo, la).some((f: any) => !(Number(f.properties?.min_height) > 2.5))) { if (m < best.d) best = { angle: a, d: m }; break; }
      }
    }
    return best;
  }, setup);
  await expect.poll(async () => (await scan()).d, { timeout: 90_000 }).toBeLessThan(15);
  const facing = await scan();
  await page.evaluate(({ x, y, angle }) => {
    Object.assign((window as any).canalRecallGame.player, { x, y, vx: 0, vy: 0, speed: 0, angle });
  }, { x: setup.x, y: setup.y, angle: facing.angle });
  expect(facing.d, 'a house front within 15 m of the street').toBeLessThan(15);
  const samples: Probe[] = [];
  const probe = () => page.evaluate(() => {
    const game = (window as any).canalRecallGame, vm = game.vectorMap, helpers = (window as any).CanalRecallBuildings;
    const [lo, la] = vm.worldToLngLat(game.player.x, game.player.y, game.osmLoader);
    let depthM = 0, id: string | null = null;
    for (const f of vm._completeCity.featuresAt(lo, la)) {
      if (Number(f.properties?.min_height) > 2.5) continue;
      const d = helpers.insideDepthM ? helpers.insideDepthM(f.geometry, [lo, la]) : 0;
      if (d > depthM) { depthM = d; id = String(f.properties?.id); }
    }
    const tb = vm._threeBuildings;
    return { covered: !!vm.riderCovered, cover: [...(tb?.hiddenBy?.get('cover') ?? [])], ghosted: tb?.ghostedIds?.() ?? [], depthM, id };
  });
  await page.keyboard.down('ArrowUp');
  for (let i = 0; i < 40; i++) { samples.push(await probe()); await page.waitForTimeout(100); }
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(800);
  samples.push(await probe());
  return { road: setup.name, facing: facing.d, samples };
}

test.describe('rider cover', () => {
  // Both engines since lane F4 (#320, 2026-11-09, "buildings still disappearing when I smash into them"): the default
  // MapLibre engine kept the point-only rule after E1 and still hid the bumped house; it now runs the same route-aware
  // rule (engine/streetVisibility.ts streetCoverInWorld). Under MapLibre `_completeCity.featuresAt` is the streamer's
  // copy too, so the probe below reads the same footprints.
  // BUNDLES_DIR=<dir>: serve *.bundle.js from a lane's scratch build (as engine-own.spec does).
  test.beforeEach(async ({ page }) => {
    const bundles = process.env.BUNDLES_DIR;
    if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = `${bundles}/${/\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]}`;
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
  });

  for (const street of Object.keys(SPOTS) as (keyof typeof SPOTS)[]) {
    const [lat, lng] = SPOTS[street].at;
    test(`a bump into a ${street} house front (${lat}, ${lng}) hides and dims nothing`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'one camera is enough');
      test.setTimeout(300_000);
      await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
      const run = await bumpHouse(page, street);
      const maxDepth = Math.max(...run.samples.map(s => s.depthM));
      const coveredSamples = run.samples.filter(s => s.covered || s.cover.length || s.ghosted.length).length;
      const anyCovered = coveredSamples > budget('coverBumpHidden');
      console.log(`bump on ${run.road}: house front ${run.facing} m off the centreline; bike point max ${maxDepth.toFixed(2)} m inside a footprint; covered=${anyCovered}`);
      expect(run.road).toBe(street);
      if (SPOTS[street].reaches) expect(maxDepth, 'the bike reached the house footprint (else this pin tests nothing)').toBeGreaterThan(0);
      expect(anyCovered, 'no building is taken away or dimmed by a bump').toBe(false);
    });
  }

  // The before number: the point-only rule at the same spot covers the bumped house (2026-11-05: 37/41 samples).
  test('old rule A/B (?coverRoute=0): the same bump at Nieuwe Leliestraat', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one camera is enough');
    test.skip(!process.env.COVER_AB, 'set COVER_AB=1 for the before number');
    test.setTimeout(300_000);
    await page.addInitScript(() => { (window as any).__canalRecallCoverRoute = '0'; });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
    const run = await bumpHouse(page, 'Nieuwe Leliestraat');
    const maxDepth = Math.max(...run.samples.map(s => s.depthM));
    const covered = run.samples.filter(s => s.covered).length;
    console.log(`old rule at ${run.road}: max ${maxDepth.toFixed(2)} m inside; covered in ${covered}/${run.samples.length} samples; ghosted ${JSON.stringify([...new Set(run.samples.flatMap(s => s.ghosted))])}`);
  });
});
