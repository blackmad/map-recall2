import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { openRoute } from './helpers';

// Named regression (user report 2026-10-01, "driving through this tunnel in
// centraal is really hard"): the Cuyperspassage cycle tunnel runs under
// Centraal's train shed, which OSM maps as a 9 m prism from the ground
// (w451533149). In the chase view the slab covered the corridor, the route
// line and the kerbs, and the rider saw only the bike's x-ray silhouette on
// beige. While a ground-based footprint contains the rider, building
// extrusions now go see-through (src/canalRecall/coveredPassage.ts).
//
// Measured on the rider's screen box: the share of pixels in the slab's
// colour (before: ~0.9, after: ~0).

const PASSAGE: [number, number, number] = [52.3797, 4.89862, 0.62]; // lat, lng, compass bearing (rad)
const OPEN_STREET: [number, number, number] = [52.37450, 4.89450, 0.0]; // Damrak

async function placeRider(page: Page, [lat, lng, bearing]: [number, number, number]) {
  await page.evaluate(([lat, lng, bearing]) => {
    const game = (window as any).canalRecallGame;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const x = loader._lastOffsetX + (lng - loader._lastCenterLng) * perLng;
    const y = loader._lastOffsetY - (lat - loader._lastCenterLat) * perLat;
    const road = game.track.getNearestRoad(x, y);
    Object.assign(game.player, { x: road.x, y: road.y, vx: 0, vy: 0, speed: 0, angle: bearing - Math.PI / 2 });
  }, [lat, lng, bearing]);
}

/** Share of pixels in a box around the rider that are the train shed's beige wall colour. */
async function slabShare(page: Page): Promise<number> {
  const box = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const vm = g.vectorMap;
    const p = vm.map.project(vm.worldToLngLat(g.player.x, g.player.y, g.osmLoader));
    const rect = vm.map.getCanvas().getBoundingClientRect();
    return { x: Math.round(rect.left + p.x - 160), y: Math.round(rect.top + p.y - 200), width: 320, height: 160 };
  });
  const png = await page.screenshot({ clip: box });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let slab = 0;
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    // w451533149 is #d2c9bc; lit and shaded faces stay within this band.
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 175 && r < 225 && r - b > 14 && r - b < 40 && g - b > 6 && g - b < 26) slab++;
  }
  return slab / total;
}

test('the rider can see the Cuyperspassage under Centraal\'s train shed', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one camera is enough');
  test.setTimeout(180_000);
  // The shed comes from the building appearance layers, which need the
  // building tiles (not aborted here).
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await placeRider(page, PASSAGE);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.riderCovered), { timeout: 90_000 }).toBe(true);
  await page.waitForTimeout(1000);
  const under = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.riderCovered);
  const share = await slabShare(page);
  console.log(`under the train shed: riderCovered=${under}, slab share ${share.toFixed(2)}`);
  expect(under, 'the train shed is recognised as covering the rider').toBe(true);
  expect(share, 'the corridor is not hidden behind the shed').toBeLessThan(0.2);

  await placeRider(page, OPEN_STREET);
  await page.waitForTimeout(2500);
  const open = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return { covered: vm.riderCovered, opacity: vm.map.getPaintProperty('osm-colored-buildings', 'fill-extrusion-opacity') };
  });
  expect(open.covered, 'out in the open the buildings come back').toBe(false);
  expect(typeof open.opacity === 'number' && open.opacity < 0.5, 'opacity restored').toBe(false);
});
