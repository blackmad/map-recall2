// Follow-ups to the building-article lane (2026-10-31):
//  - street-side art is clickable from the ground (streetArt.ts, street-art.json):
//    the Homomonument has no OSM artwork node and no building, only a Wikidata point;
//  - famous unlinked articles were promoted to landmarks (promote-building-articles.ts):
//    the Diamond Museum opens the landmark card, not a plain building card
//    (Paradiso, Magna Plaza and the Amstel hotel turned out to be bespoke manual POIs already);
//  - routable streets with an article get a ride card (build-street-articles.ts):
//    Zeedijk was a named regression with no card at all.
//
//   PW_PORT=4388 npx playwright test street-art-landmark-cards --project=desktop
//   SHOT_DIR=/some/dir … also writes <SHOT_DIR>/{homomonument,paradiso,zeedijk}-card.png
import { test, expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';

const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];
const HOMOMONUMENT: [number, number] = [4.884722, 52.374444];
const DIAMOND = { id: 'NL.IMBAG.Pand.0363100012076129', center: [4.882440, 52.359468] as [number, number] };

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
  await page.waitForTimeout(1500);
}

async function notice(page: Page) {
  return page.evaluate(() => {
    const n = (window as any).canalRecallGame._landmarkNotice;
    return n ? { id: n.id, name: n.name, type: n.type, detail: n.detail, longDetail: n.longDetail, wikipediaUrl: n.wikipediaUrl, extractLang: n.extractLang, imageUrl: n.imageUrl } : null;
  });
}

async function canvasBox(page: Page) {
  return page.evaluate(() => { const r = (window as any).canalRecallGame.vectorMap.map.getCanvas().getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
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

test('street art, promoted landmarks and street articles open their cards', async ({ page }) => {
  test.setTimeout(400_000);
  await boot(page);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._streetArt?.size ?? 0), { timeout: 60_000 }).toBeGreaterThan(1000);

  // The camera target sits at the canvas centre: a click there is a click on
  // the square, 0 m from the monument's point.
  await lookAt(page, HOMOMONUMENT, 18.4, 55, 30);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._landmarkNotice?.name), { timeout: 10_000 }).toBe('Homomonument');
  const art = await notice(page);
  expect(art!.id).toBe('street-art-Q51411');
  expect(art!.type).toBe('memorial');
  expect(art!.detail).toMatch(/memorial/i);
  expect(art!.extractLang).toBe('en');
  expect(art!.wikipediaUrl).toMatch(/wikipedia\.org\/wiki\/Homomonument/);
  if (process.env.SHOT_DIR) { await page.waitForTimeout(2500); await page.screenshot({ path: `${process.env.SHOT_DIR}/homomonument-card.png` }); }

  await lookAt(page, DIAMOND.center, 17.2, 50, 0);
  await resident(page, DIAMOND.id);
  const point = await roofPoint(page, DIAMOND.id);
  expect(point, 'the Diamond Museum projects on screen').not.toBeNull();
  const b2 = await canvasBox(page);
  await page.mouse.click(b2.x + point!.x, b2.y + point!.y);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._landmarkNotice?.id), { timeout: 10_000 }).toBe('article_landmarks_Q1208561');
  const diamond = await notice(page);
  expect(diamond!.name).toMatch(/Diamond Museum/);
  expect(diamond!.detail).toMatch(/diamond/i);
  if (process.env.SHOT_DIR) { await page.waitForTimeout(2500); await page.screenshot({ path: `${process.env.SHOT_DIR}/diamond-museum-card.png` }); }

  // The ride card for a street that only the article pipeline knows.
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g._clearLandmarkNotice(); g._showStreetKnowledge('Zeedijk', 'street', true); });
  const zeedijk = await notice(page);
  expect(zeedijk, 'Zeedijk has a ride card').not.toBeNull();
  expect(zeedijk!.type).toBe('street');
  expect(zeedijk!.extractLang).toBe('en');
  // The short line may be the street-name origin; the article lede sits in the long text.
  expect(`${zeedijk!.detail} ${zeedijk!.longDetail}`).toMatch(/Zeedijk|dike|dyke|street/);
  expect(zeedijk!.wikipediaUrl).toMatch(/wikipedia\.org\/wiki\//);
  if (process.env.SHOT_DIR) { await page.waitForTimeout(2500); await page.screenshot({ path: `${process.env.SHOT_DIR}/zeedijk-card.png` }); }
});
