// Lane D1 (issue #321): a building tap shows the building, never a thin POI card; a thin artwork label shows
// the street-art series text. Five pands that each hold exactly one kind-only click POI, plus Brettensuite 11/20.
//   SHOT_DIR=/some/dir PW_PORT=4738 /tmp/canal-pw.sh npx playwright test poi-thin-label-building --project=desktop
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
    const g = (window as any).canalRecallGame, map = g.vectorMap.map ?? g.vectorMap.cameraMap;
    for (const k of cam) { map['__' + k] = map[k]; map[k] = () => map; }
  }, CAM);
}

async function lookAt(page: Page, center: [number, number], zoom = 17.2, pitch = 50, bearing = 0) {
  await page.evaluate(({ center, zoom, pitch, bearing }) => {
    const g = (window as any).canalRecallGame, map = g.vectorMap.map ?? g.vectorMap.cameraMap;
    // The route's opening landmark quiz would swallow a tap (quizPromptName guard); these taps test cards, not quizzes.
    g.quizPromptName = ''; if (g._prompt) g._prompt.style.display = 'none';
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
    const canvas = vm.frameCanvas(), W = canvas.clientWidth, H = canvas.clientHeight;
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
  const box = await page.evaluate(() => { const r = (window as any).canalRecallGame.vectorMap.frameCanvas().getBoundingClientRect(); return { x: r.left, y: r.top }; });
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


const PANDS = [
  { slug: 'canal-house-row', id: 'NL.IMBAG.Pand.0363100012102584', center: [4.871033, 52.379557] as [number, number], poi: 'Croissanterie Balans' },
  { slug: 'corner-shop', id: 'NL.IMBAG.Pand.0363100012081773', center: [4.872157, 52.383197] as [number, number], poi: 'Mama Maria' },
  { slug: 'church', id: 'NL.IMBAG.Pand.0363100012233582', center: [4.874609, 52.380138] as [number, number], poi: "Koninkrijkszaal van Jehova's Getuigen" },
  { slug: 'school', id: 'NL.IMBAG.Pand.0363100012233665', center: [4.861414, 52.365265] as [number, number], poi: 'Winterkoninkje' },
  { slug: 'housing-block', id: 'NL.IMBAG.Pand.0363100012172104', center: [4.884897, 52.378053] as [number, number], poi: 'Kresj Lindengracht' },
];
const shot = async (page: Page, name: string, testInfo: any) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${testInfo.project.name}-${name}.png` });
};

test('a tap on a building holding only a kind-only POI opens the pand card', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await boot(page);
  for (const p of PANDS) {
    await lookAt(page, p.center, 17.6, 45);
    await resident(page, p.id);
    const card = await clickBuilding(page, p.id);
    expect(card.id, `${p.slug}: the pand answers, not the POI`).not.toMatch(/^clicked-poi-/);
    expect(`${card.name} ${card.detail}`, p.slug).not.toMatch(/is mapped as|An artwork/);
    expect(card.type, p.slug).toBe('building');
    await page.waitForTimeout(500);
    await shot(page, p.slug, testInfo);
  }
});

test('Brettensuite 11/20 label tap shows the series text, artist and Wikipedia link', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await boot(page);
  await lookAt(page, [4.836345, 52.38611], 17.4, 45);
  await page.waitForTimeout(4000);
  // The card the user reported, as the old code built it (type building, kind-only blurb).
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._showLandmarkNotice({ id: 'clicked-before', name: 'Brettensuite 11/20', type: 'building', detail: 'An artwork.', lngLat: [4.836345, 52.38611], featureTarget: null }, { kind: 'sticky' }, 'click'); g._expandLandmarkNotice();
  });
  await page.waitForTimeout(800);
  await shot(page, 'brettensuite-before', testInfo);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const card = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const hit = { id: 'n4771449016', landmarkId: 'n4771449016', name: 'Brettensuite 11/20', lngLat: [4.836345, 52.38611], poi: true, featureTarget: null };
    g._clearLandmarkNotice();
    const c = g._cardForClickedBuilding(hit);
    if (c) { g._showLandmarkNotice(c, { kind: 'sticky' }, 'click'); g._expandLandmarkNotice(); }
    return c && { name: c.name, type: c.type, detail: c.detail, longDetail: c.longDetail, wikipediaUrl: c.wikipediaUrl };
  });
  expect(card, 'street art speaks for the thin label').not.toBeNull();
  expect(card!.detail).toMatch(/^Part 11 of 20 of Beeldenroute Brettensuite\./);
  expect(card!.longDetail).toMatch(/Herbert Nouwens/);
  expect(card!.wikipediaUrl).toMatch(/wikipedia\.org/);
  await page.waitForTimeout(800);
  await shot(page, 'brettensuite-after', testInfo);
});
