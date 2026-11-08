// Named regression (user shot 2026-11-08, #258): at Sloterdijk the POI label
// "Shri Guru Nanak Gurdwara Sahib" titled the building card and the body said
// "This building has no name or date in the map data." A tap on a drawn label
// carries the label's text and point only (labelLayer.ts hitTest); the card now
// finds the place's mapped row and says what it is (buildingFacts.ts
// describeBuilding `place`, clickPoiInfo.ts `named`).
//
//   PW_PORT=4673 npx playwright test card-poi-name --project=desktop --workers=1
//   SHOT_DIR=/some/dir … also writes <SHOT_DIR>/card-poi-<state>-<desktop|phone>.png
import { test, expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';

const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];
const GURDWARA = { name: 'Shri Guru Nanak Gurdwara Sahib', center: [4.849011, 52.390768] as [number, number] };
/** Herengracht area canal house whose register entry names it ("Schwartze-huis", rijksmonument). */
const SCHWARTZE = { id: 'NL.IMBAG.Pand.0363100012182945', center: [4.90017, 52.36263] as [number, number] };
const HORTUS_ID = 'extract_landmarks_1294795881';
const SHOT = process.env.SHOT_DIR;

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
    g._clearLandmarkNotice();
    map.__jumpTo.call(map, { center, zoom, pitch, bearing });
  }, { center, zoom, pitch, bearing });
}

/** CSS point of a frame-pixel point. */
async function clickFrame(page: Page, x: number, y: number) {
  const box = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, canvas = vm.frameCanvas(), r = canvas.getBoundingClientRect();
    return { x: r.left, y: r.top, sx: r.width / canvas.width, sy: r.height / canvas.height };
  });
  await page.mouse.click(box.x + x * box.sx, box.y + y * box.sy);
}

async function notice(page: Page) {
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame._landmarkNotice), { timeout: 10_000 }).toBe(true);
  await page.waitForTimeout(1200); // a fact tile may refresh the card in place
  return page.evaluate(() => {
    const n = (window as any).canalRecallGame._landmarkNotice;
    return { id: n.id, name: n.name, type: n.type, detail: n.detail, sourceUrl: n.sourceUrl };
  });
}

async function roofPoint(page: Page, id: string) {
  return page.evaluate((id) => {
    const w = window as any, vm = w.canalRecallGame.vectorMap, tb = vm._threeBuildings, T = w.CanalRecallThree.THREE;
    const canvas = vm.frameCanvas(), W = canvas.width, H = canvas.height;
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

async function resident(page: Page, id: string) {
  await expect.poll(() => page.evaluate((id) => {
    const tb = (window as any).canalRecallGame.vectorMap._threeBuildings;
    return [...tb.chunks.values()].some((c: any) => c.mesh && c.ranges.has(id));
  }, id), { timeout: 90_000 }).toBe(true);
  await page.waitForTimeout(1500);
}

async function shot(page: Page, state: string) {
  if (!SHOT) return;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT}/card-poi-${state}-desktop.png` });
  // The phone layout: a true 390-wide viewport (see landmark-panel.spec.ts on the iPhone project).
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOT}/card-poi-${state}-phone.png` });
  await page.setViewportSize(size);
  await page.waitForTimeout(1000);
}

test('a tapped POI label, a named canal house, a nameless house and a landmark each get a truthful card', async ({ page }) => {
  test.setTimeout(500_000);
  await boot(page);

  // 1. The gurdwara's label.
  await lookAt(page, GURDWARA.center, 17.3, 50, 0);
  const label = await expect.poll(() => page.evaluate((name) => {
    const l = (window as any).canalRecallGame.vectorMap._labels.placed.find((p: any) => p.text === name && p.x !== undefined);
    return l ? { x: l.x, y: l.y } : null;
  }, GURDWARA.name), { timeout: 60_000 }).not.toBeNull().then(() => page.evaluate((name) => {
    const l = (window as any).canalRecallGame.vectorMap._labels.placed.find((p: any) => p.text === name);
    return { x: l.x, y: l.y };
  }, GURDWARA.name));
  await clickFrame(page, label.x, label.y);
  const gurdwara = await notice(page);
  console.log('gurdwara card', JSON.stringify(gurdwara));
  expect(gurdwara.name).toBe(GURDWARA.name);
  expect(gurdwara.detail).not.toMatch(/no name/);
  expect(gurdwara.detail).toMatch(/gurdwara|place of worship/i);
  await shot(page, 'gurdwara');

  // 2. A nameless house nearby with no POI: the first resident pand within ~200 m whose card is untitled.
  const nameless = await page.evaluate((center) => {
    const g = (window as any).canalRecallGame, tb = g.vectorMap._threeBuildings;
    for (const [key, chunk] of tb.chunks) {
      if (key.startsWith('extras:') || !chunk.mesh) continue;
      for (const f of chunk.source) {
        const id = String(f.properties.id);
        if (!chunk.ranges.has(id) || f.properties.name) continue;
        const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
        const [lng, lat] = ring[0];
        if (Math.abs(lng - center[0]) > 0.002 || Math.abs(lat - center[1]) > 0.0012) continue;
        if (g._clickPoiInfo?.card({ id, footprint: f.geometry, lngLat: [lng, lat], featureTarget: null })) continue;
        return id;
      }
    }
    return null;
  }, GURDWARA.center);
  expect(nameless).not.toBeNull();
  await page.evaluate(() => (window as any).canalRecallGame._clearLandmarkNotice());
  const p2 = await roofPoint(page, nameless!);
  await clickFrame(page, p2!.x, p2!.y);
  const plain = await notice(page);
  console.log('nameless card', JSON.stringify(plain));
  expect(plain.type).toBe('building');
  if (plain.name === 'No building details') expect(plain.detail).toMatch(/no name or date/);
  else expect(plain.detail).not.toMatch(/no name/);
  await shot(page, 'nameless');

  // 3. A canal house the register names.
  await lookAt(page, SCHWARTZE.center, 17.6, 50, 0);
  await resident(page, SCHWARTZE.id);
  const p3 = await roofPoint(page, SCHWARTZE.id);
  await clickFrame(page, p3!.x, p3!.y);
  const named = await notice(page);
  console.log('named card', JSON.stringify(named));
  expect(named.detail).not.toMatch(/no name/);
  await shot(page, 'named');

  // 4. A landmark (Hortus Botanicus greenhouse): its researched card is unchanged.
  const hortus = await page.evaluate((id) => {
    const l = (window as any).canalRecallGame.landmarks.find((x: any) => x.id === id);
    return l ? { center: [l.center?.[1] ?? l.lngLat?.[0], l.center?.[0] ?? l.lngLat?.[1]], buildingIds: l.buildingIds ?? [] } : null;
  }, HORTUS_ID);
  expect(hortus).not.toBeNull();
  await lookAt(page, hortus!.center as [number, number], 17.4, 50, 0);
  const owner = String(hortus!.buildingIds[0] ?? '');
  if (owner) {
    await resident(page, owner);
    const p4 = await roofPoint(page, owner);
    await clickFrame(page, p4!.x, p4!.y);
  } else {
    await page.evaluate((id) => {
      const g = (window as any).canalRecallGame, l = g.landmarks.find((x: any) => x.id === id);
      g._showLandmarkNotice(l, { kind: 'sticky' }, 'click');
    }, HORTUS_ID);
  }
  const landmark = await notice(page);
  console.log('landmark card', JSON.stringify(landmark));
  expect(landmark.detail).not.toMatch(/no name/);
  await shot(page, 'landmark');
});
