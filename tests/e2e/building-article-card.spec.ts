// Named regression (user 2026-10-30, KNSM-eiland): clicking the Venetiëhof
// ring opened a card that said only "Built 1995", although OSM and Wikidata
// both carry its article (Emerald Empire). Ordinary buildings with an article
// now open it: name, English lede, Wikipedia link, photo
// (src/canalRecall/buildingArticles.ts, building-articles/14 tiles).
//
//   PW_PORT=4388 npx playwright test building-article-card --project=desktop
//   SHOT_DIR=/some/dir … also writes <SHOT_DIR>/emerald-empire-card.png
import { test, expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';

const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];
/** Emerald Empire / Venetiëhof: BAG pand of the apartment ring (OSM relation 3679879). */
const EMERALD = { id: 'NL.IMBAG.Pand.0363100012102098', center: [4.94757, 52.37717] as [number, number] };
/** Gebouw Batavia, Prins Hendrikkade: an article joined by its Wikidata point (no OSM tag), Dutch-only, translated. */
const BATAVIA = { id: 'NL.IMBAG.Pand.0363100012171926', center: [4.90167, 52.37665] as [number, number] };

async function boot(page: Page) {
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return vm._completeCityHasBuildings && vm._threeBuildings?.ready && vm._threeBuildings.chunks.size > 3;
  }, null, { timeout: 120_000 });
  await page.evaluate((cam) => {
    const g = (window as any).canalRecallGame, map = g.vectorMap.map;
    for (const k of cam) { map['__' + k] = map[k]; map[k] = () => map; }
  }, CAM);
}

async function lookAt(page: Page, center: [number, number], zoom = 17.2, pitch = 50, bearing = 0) {
  await page.evaluate(({ center, zoom, pitch, bearing }) => {
    const g = (window as any).canalRecallGame, map = g.vectorMap.map;
    g._clearLandmarkNotice();
    map.__jumpTo.call(map, { center, zoom, pitch, bearing });
  }, { center, zoom, pitch, bearing });
}

async function resident(page: Page, id: string) {
  await expect.poll(() => page.evaluate((id) => {
    const tb = (window as any).canalRecallGame.vectorMap._threeBuildings;
    return [...tb.chunks.values()].some((c: any) => c.mesh && c.ranges.has(id));
  }, id), { timeout: 90_000 }).toBe(true);
  await page.waitForTimeout(1500);
}

async function roofPoint(page: Page, id: string) {
  return page.evaluate((id) => {
    const w = window as any, vm = w.canalRecallGame.vectorMap, tb = vm._threeBuildings, T = w.CanalRecallThree.THREE;
    const canvas = vm.map.getCanvas(), W = canvas.clientWidth, H = canvas.clientHeight;
    for (const [key, chunk] of tb.chunks) {
      if (key.startsWith('extras:') || !chunk.mesh) continue;
      const f = chunk.source.find((x: any) => String(x.properties.id) === id);
      if (!f || !chunk.ranges.has(id)) continue;
      const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
      let lng = 0, lat = 0; for (const [a, b] of ring) { lng += a; lat += b; } lng /= ring.length; lat /= ring.length;
      const kx = 111_320 * Math.cos(52.37 * Math.PI / 180);
      const z = (Number(f.properties.height) || 10) * 0.9 + (chunk.lift?.applied?.get(id) ?? 0);
      const p = new T.Vector3((lng - 4.9) * kx, (lat - 52.37) * 110_540, z).applyMatrix4(chunk.mesh.matrixWorld).applyMatrix4(tb.camera.projectionMatrix);
      return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H };
    }
    return null;
  }, id);
}

async function clickBuilding(page: Page, id: string) {
  const point = await roofPoint(page, id);
  expect(point, `${id} projects on screen`).not.toBeNull();
  const box = await page.evaluate(() => { const r = (window as any).canalRecallGame.vectorMap.map.getCanvas().getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.click(box.x + point!.x, box.y + point!.y);
  await expect.poll(() => page.evaluate(() => {
    const n = (window as any).canalRecallGame._landmarkNotice;
    return n ? { id: n.id, name: n.name, type: n.type, detail: n.detail, wikipediaUrl: n.wikipediaUrl, extractLang: n.extractLang, imageUrl: n.imageUrl } : null;
  }), { timeout: 10_000 }).not.toBeNull();
  return page.evaluate(() => {
    const n = (window as any).canalRecallGame._landmarkNotice;
    return { id: n.id, name: n.name, type: n.type, detail: n.detail, wikipediaUrl: n.wikipediaUrl, extractLang: n.extractLang, imageUrl: n.imageUrl };
  });
}

test('an ordinary building with a Wikipedia article opens it: Emerald Empire and Gebouw Batavia', async ({ page }) => {
  test.setTimeout(400_000);
  await boot(page);

  await lookAt(page, EMERALD.center, 16.6, 55, 20);
  await resident(page, EMERALD.id);
  // The article tile beside the fact tile may still be in flight: the card
  // fills in on arrival, so poll the name rather than the first paint.
  await clickBuilding(page, EMERALD.id);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._landmarkNotice?.name), { timeout: 10_000 }).toBe('Emerald Empire');
  const emerald = await clickBuilding(page, EMERALD.id);
  expect(emerald.type).toBe('building');
  expect(emerald.detail).toMatch(/Jo Coenen/);
  expect(emerald.extractLang).toBe('en');
  expect(emerald.wikipediaUrl).toMatch(/wikipedia\.org\/wiki\/Emerald_Empire/);
  expect(emerald.imageUrl).toMatch(/^https:\/\//);
  if (process.env.SHOT_DIR) {
    await page.waitForTimeout(2500); // photo
    await page.screenshot({ path: `${process.env.SHOT_DIR}/emerald-empire-card.png` });
  }

  await lookAt(page, BATAVIA.center, 17.2, 50, 0);
  await resident(page, BATAVIA.id);
  await clickBuilding(page, BATAVIA.id);
  // A mapped place ("Batavia") shares the footprint: its POI card keeps the
  // name and gains the article's lede and link (_poiCardWithArticle).
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._landmarkNotice?.detail || ''), { timeout: 10_000 }).toMatch(/Prins Hendrikkade/);
  const batavia = await clickBuilding(page, BATAVIA.id);
  expect(batavia.name).toMatch(/Batavia/);
  expect(batavia.extractLang).toBe('en');
  expect(batavia.wikipediaUrl).toMatch(/wikipedia\.org/);
});
