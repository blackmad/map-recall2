import { test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';
import { move } from './periodWallPlaces';

// New-build lane strips (lane/newbuild-kit-20261110): a raised chase-like camera at each spot, beside the panorama
// (scripts/look/generic-gap-panos.ts) for the sheet (scripts/newbuild/sheet.ts).
//   NB_SPOTS=scripts/newbuild/spots.json NB_OUT=<dir> NB_QUERY='?engine=own&buildings3d=storybook' \
//     PW_PORT=4759 npx playwright test newbuild-strip --project=desktop --workers=1
// spots.json: [{ slug, lng, lat, bearing, distM?, eyeM?, targetM? }]: the camera stands distM behind (lng, lat) along
// `bearing`, eyeM up, looking at (lng, lat) targetM up. Defaults 60 m, 14 m, 8 m (the user's chase frames).
const OUT = process.env.NB_OUT || 'artifacts/newbuild/off';
type Spot = { slug: string; lng: number; lat: number; bearing: number; distM?: number; eyeM?: number; targetM?: number };
const SPOTS: Spot[] = process.env.NB_SPOTS ? JSON.parse(readFileSync(process.env.NB_SPOTS, 'utf8')) : [];
const ONLY = process.env.NB_ONLY ? new Set(process.env.NB_ONLY.split(',')) : null;

async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks;
    const map = vm.map ?? vm.cameraMap, c = map.getCenter(); map.jumpTo({ center: [c.lng + 1e-9, c.lat] });
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const w = window as any, key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}`;
    w.__nbIdle = idle && landmarksIdle && key === w.__nbKey ? (w.__nbIdle || 0) + 1 : 0;
    w.__nbKey = key;
    return w.__nbIdle >= 5;
  }, null, { timeout: 180_000, polling: 1000 });
  await page.evaluate(() => { const w = window as any, vm = w.canalRecallGame.vectorMap; (vm.map ?? vm.cameraMap).jumpTo(w.__nbCamera); });
  await page.waitForTimeout(3000);
}

test('newbuild strip', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' || !SPOTS.length, 'desktop camera strip, needs NB_SPOTS');
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1326, height: 761 });
  // BUNDLES_DIR=<dir>: serve freshly built bundles (context routes also reach the chunk worker, page routes do not).
  const bundles = process.env.BUNDLES_DIR;
  if (bundles) await page.context().route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = `${bundles}/${/\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]}`;
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  // NB_MODELS_DIR=<dir>: serve model files found there (<dir>/ordinary-buildings/<file>.glb) instead: a staged GLB.
  const modelsDir = process.env.NB_MODELS_DIR;
  if (modelsDir) await page.context().route(/\/canal-drive\/models\/([\w/.-]+?\.glb)(\?.*)?$/, route => {
    const file = `${modelsDir}/${/\/models\/([\w/.-]+?\.glb)/.exec(route.request().url())![1]}`;
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'model/gltf-binary' }) : route.continue();
  });
  // NB_DATA_DIR=<dir>: serve extract files found there instead (the "before" tiles of a data fix).
  const dataDir = process.env.NB_DATA_DIR;
  if (dataDir) await page.context().route(/\/data\/extracts\/amsterdam\/([\w/.-]+?)(\?.*)?$/, route => {
    const file = `${dataDir}/${/\/amsterdam\/([\w/.-]+?)(\?.*)?$/.exec(route.request().url())![1]}`;
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'application/octet-stream' }) : route.continue();
  });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false, query: process.env.NB_QUERY || '' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  const meta: Record<string, unknown> = {};
  for (const s of SPOTS) {
    if (ONLY && !ONLY.has(s.slug)) continue;
    const cam = { eye: move([s.lng, s.lat], s.bearing + 180, s.distM ?? 60), eyeM: s.eyeM ?? 14, target: [s.lng, s.lat], targetM: s.targetM ?? 8 };
    await page.evaluate(({ cam }) => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map ?? vm.cameraMap;
      g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; (window as any).__nbIdle = 0;
      g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
      vm.sync = () => {}; map.stop?.(); map.setMaxPitch?.(85); map.setVerticalFieldOfView?.(55); map.setPadding?.({ top: 0, bottom: 0, left: 0, right: 0 });
      (window as any).__nbCamera = map.calculateCameraOptionsFromTo({ lng: cam.eye[0], lat: cam.eye[1] }, cam.eyeM, { lng: cam.target[0], lat: cam.target[1] }, cam.targetM);
      map.jumpTo((window as any).__nbCamera);
    }, { cam });
    await settle(page);
    await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map ?? vm.cameraMap;
      if (vm.map) { for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'visibility') !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none'); } else vm.setLabelsVisible?.(false);
      const canvas = map.getCanvas() as HTMLCanvasElement;
      for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
    });
    await page.waitForTimeout(1000);
    await page.locator('canvas.maplibregl-canvas, canvas.engine-canvas').first().screenshot({ path: `${OUT}/${s.slug}.png` });
    meta[s.slug] = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._threeBuildings?.stats?.() ?? null);
  }
  writeFileSync(`${OUT}/meta.json`, JSON.stringify({ query: process.env.NB_QUERY || '', meta }, null, 1));
});
