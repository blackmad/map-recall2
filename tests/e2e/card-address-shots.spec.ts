// Lane C2 (#368) in-ride shots, Free Ride: a canal house titled by its BAG address, and a place-titled building with the
// address in its body. The published tiles do not exist yet, so the staged ones are served as the extract would.
//
//   SHOT_DIR=/some/dir PW_PORT=4461 /tmp/canal-pw.sh npx playwright test tests/e2e/card-address-shots.spec.ts --project=desktop --workers=1
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];
/** Herengracht area canal house whose register entry names it ("Schwartze-huis", rijksmonument). */
const SCHWARTZE = { id: 'NL.IMBAG.Pand.0363100012182945', center: [4.90017, 52.36263] as [number, number] };
const SHOT = process.env.SHOT_DIR;

async function boot(page: Page) {
  // The published tiles do not exist yet: serve the staged ones as the extract will.
  await page.route(/pand-addresses-v1\/14\/(\d+)\/(\d+)\.json\.gz/, async (route) => {
    const [, x, y] = /pand-addresses-v1\/14\/(\d+)\/(\d+)/.exec(route.request().url())!;
    try { await route.fulfill({ body: await readFile(path.resolve(`public/data/extracts/amsterdam/staging/pand-addresses-v1/14/${x}/${y}.json.gz`)) }); }
    catch { await route.fulfill({ status: 404, body: 'missing' }); }
  });
  await page.goto('/canal-drive/?ride=free&engine=own');
  await page.waitForFunction(() => {
    const g = (window as any).canalRecallGame, vm = g?.vectorMap;
    return g?.state === 4 && g.freeRide && vm?._threeBuildings?.ready && vm._threeBuildings.chunks.size > 3;
  }, null, { timeout: 180_000 });
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
  await page.screenshot({ path: `${SHOT}/card-address-${state}-desktop.png` });
  // The phone layout: a true 390-wide viewport (see landmark-panel.spec.ts on the iPhone project).
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOT}/card-address-${state}-phone.png` });
  await page.setViewportSize(size);
  await page.waitForTimeout(1000);
}


/** The first resident pand (nearest the first resident chunk's first pand) the predicate accepts; its centre for the camera. */
async function findPand(page: Page, kind: 'place' | 'plain', skip = 0) {
  return page.evaluate(([kind, skip]) => {
    const g = (window as any).canalRecallGame, tb = g.vectorMap._threeBuildings;
    let n = 0;
    for (const [key, chunk] of tb.chunks) {
      if (key.startsWith('extras:') || !chunk.mesh) continue;
      for (const f of chunk.source) {
        const id = String(f.properties.id);
        if (!chunk.ranges.has(id)) continue;
        const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
        const [lng, lat] = ring[0];
        const store = g._buildingFacts;
        if (!store.address(id)) continue;
        const card = g._clickPoiInfo?.card({ id, footprint: f.geometry, lngLat: [lng, lat], featureTarget: null });
        if (kind === 'place' ? !card : (card || f.properties.name || store.lookup(id)?.[3]?.n)) continue;
        if (n++ < skip) continue;
        return { id, center: [lng, lat] };
      }
    }
    return null;
  }, [kind, skip] as const);
}

/** Load the fact and address tiles under the resident buildings. */
async function loadTiles(page: Page) {
  await page.evaluate(async () => {
    const g = (window as any).canalRecallGame, tb = g.vectorMap._threeBuildings, seen = new Set<string>(), jobs: Promise<void>[] = [];
    for (const [key, chunk] of tb.chunks) {
      if (key.startsWith('extras:') || !chunk.mesh) continue;
      for (const f of chunk.source.slice(0, 40)) {
        const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
        const k = `${(ring[0][0] * 60) | 0}/${(ring[0][1] * 60) | 0}`;
        if (!seen.has(k)) { seen.add(k); jobs.push(g._buildingFacts.ensureAt(ring[0][0], ring[0][1])); }
      }
    }
    await Promise.all(jobs);
  });
}

test('Free Ride: an address titles a canal house; a place titles its building with the address in the body', async ({ page }) => {
  test.setTimeout(500_000);
  await boot(page);
  expect(await page.evaluate(() => (window as any).canalRecallGame.freeRide)).toBe(true);
  await loadTiles(page);

  // 1. A mapped place in a small building: the place titles, the pand's BAG address follows in the body.
  // The card the click really opens decides: the first candidate whose click titles the place and says the address.
  let place: Awaited<ReturnType<typeof notice>> | null = null;
  for (let skip = 0; skip < 25 && !place; skip++) {
    const placed = await findPand(page, 'place', skip);
    if (!placed) break;
    await page.evaluate(() => (window as any).canalRecallGame._clearLandmarkNotice());
    await lookAt(page, placed.center as [number, number], 17.8, 50, 0);
    await resident(page, placed.id);
    const p1 = await roofPoint(page, placed.id);
    if (!p1) continue;
    await clickFrame(page, p1.x, p1.y);
    const got = await notice(page).catch(() => null);
    if (got && got.id.startsWith('clicked-poi-') && /Address: /.test(got.detail)) place = got;
  }
  console.log('place card', JSON.stringify(place));
  expect(place).not.toBeNull();
  await shot(page, 'place');

  // 2. A nameless house with a BAG address: the address is the title.
  await page.evaluate(() => (window as any).canalRecallGame._clearLandmarkNotice());
  const house = await findPand(page, 'plain');
  expect(house).not.toBeNull();
  await lookAt(page, house!.center as [number, number], 17.8, 50, 0);
  await resident(page, house!.id);
  const point = await roofPoint(page, house!.id);
  await clickFrame(page, point!.x, point!.y);
  const card = await notice(page);
  console.log('house card', JSON.stringify(card));
  expect(card.name).toMatch(/\d/);
  expect(card.name).not.toMatch(/^Built|No building/);
  await shot(page, 'title');
});
