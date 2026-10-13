import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openRoute } from './helpers';

// Look consistency (docs/LOOK.md, lane 2026-10-13): fixed camera shots of the
// same four blocks for before/after review of palette and light changes.
// Each block mixes the three building pipelines: a landmark GLB, recipe-built
// houses (Bilderdijkstraat) and generic streamed extrusions.
//
//   LOOK_SHOTS_OUT=artifacts/look/before PW_OFFLINE_MAP=1 PW_PORT=4424 npx playwright test look-consistency --project=desktop
//   LOOK_SHOTS_QUERY='?sharedFrame=1' … for the shared-frame rig.
//   LOOK_SHOTS_LOOKS=photo,cartoon picks the Building looks (default photo).
//   LOOK_BUNDLES_DIR=<dir> serves any *.bundle.js found there instead of the
//   committed one (A/B of a source change before the integrator rebuilds).
// Compare two directories with `node scripts/compare-look-shots.mjs <a> <b>`.
// PW_OFFLINE_MAP=1 replaces the live basemap with a flat background, so the
// shots are deterministic run to run (the basemap tiles are not ours).
const OUT = process.env.LOOK_SHOTS_OUT || 'artifacts/look-consistency';
const QUERY = process.env.LOOK_SHOTS_QUERY || '';
const LOOKS = (process.env.LOOK_SHOTS_LOOKS || 'photo').split(',').map(s => s.trim()).filter(Boolean);

type View = { name: string; target: [number, number]; bearing: number; distM: number; altM: number; targetAltM: number };
export const LOOK_VIEWS: View[] = [
  // Westerkerk from Raadhuisstraat: landmark GLB among canal houses.
  { name: 'westerkerk', target: [4.88390, 52.37450], bearing: 200, distM: 140, altM: 45, targetAltM: 15 },
  // Bilderdijkstraat: recipe-built houses (ordinary catalogue instances) beside generic 1890s rows.
  { name: 'bilderdijk', target: [4.87195, 52.36720], bearing: 110, distM: 120, altM: 40, targetAltM: 8 },
  // De Pijp: Amsterdam School period walls (the 1915-1944 era).
  { name: 'pijp', target: [4.89350, 52.35350], bearing: 160, distM: 160, altM: 55, targetAltM: 8 },
  // Dam: Royal Palace and the Bijenkorf front kits (lookHex per look).
  { name: 'dam', target: [4.89260, 52.37300], bearing: 250, distM: 170, altM: 60, targetAltM: 12 },
];

const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number): [number, number] => {
  const r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320];
};

/** Only the 3D frame is under review: labels (collision fades), the HUD and the minimap differ run to run. */
async function quiet(page: Page): Promise<void> {
  await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'visibility') !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none');
    const canvas = map.getCanvas() as HTMLCanvasElement;
    for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
  });
}

async function settle(page: Page): Promise<void> {
  // Streamed buildings idle, landmarks idle, then a few frames for textures and shadows.
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks;
    const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-9, c.lat] });
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    // Landmarks load in batches of two on moveend and tiles keep arriving; the
    // resident set (buildings, landmarks shown) must hold still for five polls.
    const w = window as any, key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}`;
    w.__lookIdle = idle && landmarksIdle && key === w.__lookKey ? (w.__lookIdle || 0) + 1 : 0;
    w.__lookKey = key;
    return w.__lookIdle >= 5;
  }, null, { timeout: 180_000, polling: 1000 });
  // The polls nudged the centre to trigger moveend; return to the exact camera.
  await page.evaluate(() => { const w = window as any; w.canalRecallGame.vectorMap.map.jumpTo(w.__lookCamera); });
  await page.waitForTimeout(5000);
}

// 3DBAG detailed buildings stream from data.3dbag.nl, so this one needs the network: LOOK_DETAILED=1.
test('shared frame: 3DBAG detailed buildings join the frame and bring no light', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' || !process.env.LOOK_DETAILED, 'network: LOOK_DETAILED=1');
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const bundles = process.env.LOOK_BUNDLES_DIR;
  if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, query: process.env.LOOK_DETAILED_QUERY ?? '?sharedFrame=1' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setDetailedBuildingsVisible(true));
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap._detailedBuildings?.ready, null, { timeout: 120_000 });
  const view = LOOK_VIEWS[0], eye = ahead(view.target, view.bearing, view.distM);
  await page.evaluate(({ eye, view }) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
    vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, view.altM, { lng: view.target[0], lat: view.target[1] }, view.targetAltM));
  }, { eye, view });
  await page.waitForTimeout(15_000);
  const frame = await page.evaluate(() => {
    const f = (window as any).canalRecallGame.vectorMap._sharedFrame, lights: string[] = [];
    f.scene.traverse((o: any) => { if (o.isLight) lights.push(o.name || o.type); });
    let meshes = 0;
    const root = f.registry.all().find((e: any) => e.id === 'detailed-buildings')?.participant.participant.root;
    root?.traverse((o: any) => { if (o.isMesh) meshes++; });
    return { lights, participants: f.registry.all().map((e: any) => e.id), detailedMeshes: meshes, tilesStats: root?.children[0]?.tilesRenderer?.stats, customLayer: !!(window as any).canalRecallGame.vectorMap.map.getLayer('detailed-buildings-3dbag') };
  });
  await page.screenshot({ path: `${OUT}/detailed-shared.png` });
  writeFileSync(`${OUT}/detailed-shared.json`, JSON.stringify(frame, null, 1));
  expect(frame.participants).toContain('detailed-buildings');
  expect(frame.customLayer, 'no own custom layer in the shared frame').toBe(false);
  expect(frame.lights.sort()).toEqual(['shared-frame-sky', 'shared-frame-sun']);
  // Not asserted yet: in this headless run the tileset loads (`ready`) but no tile is traversed
  // (stats.tilesProcessed 0), in the shared frame and in the legacy layer alike. See the lane report.
});

test.describe('look consistency shots', () => {
  for (const look of LOOKS) test(`look shots: ${look}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is enough for a pixel comparison');
    test.setTimeout(600_000);
    const dir = `${OUT}/${look}`;
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    // A/B without touching the committed bundles: serve freshly built ones from a scratch dir.
    const bundles = process.env.LOOK_BUNDLES_DIR;
    if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false, query: QUERY });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
    await page.evaluate((l) => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference(l), look);
    await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._buildings3dLook)).toBe(look);
    const meta: Record<string, unknown> = { query: QUERY, look, sharedFrame: await page.evaluate(() => !!(window as any).canalRecallGame.vectorMap._sharedFrame) };
    for (const view of LOOK_VIEWS) {
      const eye = ahead(view.target, view.bearing, view.distM);
      await page.evaluate(({ eye, view }) => {
        const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
        g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; (window as any).__lookIdle = 0;
        g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
        vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView(50); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        (window as any).__lookCamera = map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, view.altM, { lng: view.target[0], lat: view.target[1] }, view.targetAltM);
        map.jumpTo((window as any).__lookCamera);
      }, { eye, view });
      await settle(page);
      await quiet(page);
      await page.waitForTimeout(1500);
      await page.locator('canvas.maplibregl-canvas').first().screenshot({ path: `${dir}/${view.name}.png` });
    }
    if (meta.sharedFrame) {
      // One rig for every layer: the frame's scene holds the sun and the sky and no private light.
      const frame = await page.evaluate(() => {
        const f = (window as any).canalRecallGame.vectorMap._sharedFrame, lights: string[] = [];
        f.scene.traverse((o: any) => { if (o.isLight) lights.push(o.name || o.type); });
        return { lights, participants: f.registry.all().map((e: any) => e.id) };
      });
      meta.frame = frame;
      expect(frame.lights.sort()).toEqual(['shared-frame-sky', 'shared-frame-sun']);
    }
    writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 1));
  });
});
