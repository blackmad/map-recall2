import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Engine programme P1: camera parity under `?engine=own`. The own engine rides the start flight and the Anne Frank
// House → Rijksmuseum route; every sampled camera (centre, zoom, bearing, pitch, elevation, fov) is replayed in a
// second page whose world view is MapLibre (the oracle), and the ground points the engine put at six screen probes
// must land within the budget there. The own page never constructs maplibregl.Map; the oracle is a separate page.
const PARITY_PX: number = JSON.parse(readFileSync('tests/perf/budgets.json', 'utf8')).entries.cameraParityPx.value;

type Pose = { phase: 'intro' | 'ride'; lng: number; lat: number; zoom: number; bearing: number; pitch: number; elevation: number; fovDeg: number; w: number; h: number; probes: Array<[number, number, number, number]> };

async function seed(page: Page): Promise<void> {
  // Automated browsers skip the start flight unless forced (presentationRuntime.ts _planIntro).
  await page.addInitScript(() => { (window as any).__canalRecallForceIntro = true; });
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
}

const samplePose = (page: Page, phase: Pose['phase']) => page.evaluate((phase) => {
  const vm = (window as any).canalRecallGame.vectorMap;
  const cam = vm.cameraMap.camera, el = vm.cameraMap.getCanvas();
  const w = el.clientWidth, h = el.clientHeight;
  const probes: Array<[number, number, number, number]> = [];
  for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.8], [0.8, 0.8], [0.5, 0.95], [0.3, 0.6], [0.7, 0.55]]) {
    const ll = cam.unproject(fx * w, fy * h);
    if (!ll) continue;
    const lng = ll.lng ?? ll[0], lat = ll.lat ?? ll[1];
    const p = cam.project([lng, lat]);
    if (p.depth > 0) probes.push([lng, lat, p.x, p.y]);
  }
  return { phase, lng: cam.lng, lat: cam.lat, zoom: cam.zoom, bearing: cam.bearing, pitch: cam.pitch, elevation: cam.elevation, fovDeg: cam.fovDeg, w, h, probes };
}, phase);

test('?engine=own camera matches MapLibre along the start flight and the Anne Frank → Rijksmuseum ride', async ({ page }) => {
  test.setTimeout(300_000);
  await seed(page);
  await page.goto('/canal-drive/?engine=own');
  await page.waitForFunction(() => (window as any).canalRecallGame?.routePois?.length, null, { timeout: 90_000 });
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap.engine)).toBe('own');
  await page.locator('#travel-mode').selectOption('car', { force: true });
  await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.routePois.some((p: any) => p.id === 'anne-frank') && g.routePois.some((p: any) => p.id === 'rijksmuseum'); });
  await page.locator('#poi-destination').selectOption('rijksmuseum');
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g._pickDestinationNear = () => g.routePois.find((p: any) => p.id === 'anne-frank'); });
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());

  const poses: Pose[] = [];
  // The start flight: from the submit until the ride hands the camera to the chase (RACING and introOverview 0),
  // keeping the distinct cameras.
  let last = '';
  for (let i = 0; i < 600; i++) {
    const done = await page.evaluate(() => { const g = (window as any).canalRecallGame; return g.state === 4 && g.camera.introOverview === 0; });
    if (done) break;
    const pose = await samplePose(page, 'intro');
    const key = [pose.lng, pose.lat, pose.zoom, pose.bearing, pose.pitch].map(v => v.toFixed(6)).join();
    if (key !== last && pose.probes.length) { poses.push(pose); last = key; }
    await page.waitForTimeout(100);
  }
  await page.keyboard.down('ArrowUp');
  for (let i = 0; i < 20; i++) { poses.push(await samplePose(page, 'ride')); await page.waitForTimeout(400); }
  await page.keyboard.up('ArrowUp');
  expect(poses.filter(p => p.phase === 'intro').length, 'start-flight samples').toBeGreaterThanOrEqual(3);

  // The oracle: the same viewport, MapLibre's world view, each pose replayed with jumpTo.
  const oracle = await page.context().newPage();
  await seed(oracle);
  await oracle.goto('/canal-drive/');
  await oracle.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?.map?.loaded?.(), null, { timeout: 90_000 });
  const misfits = await oracle.evaluate((poses: Pose[]) => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    map.setMaxPitch(85);
    const el = map.getCanvas();
    return poses.map(p => {
      if (el.clientWidth !== p.w || el.clientHeight !== p.h) return { phase: p.phase, zoom: p.zoom, pitch: p.pitch, px: Infinity, size: `${el.clientWidth}x${el.clientHeight} vs ${p.w}x${p.h}` } as any;
      if (Math.abs(map.getVerticalFieldOfView() - p.fovDeg) > 1e-6) map.setVerticalFieldOfView(p.fovDeg);
      map.jumpTo({ center: [p.lng, p.lat], zoom: p.zoom, bearing: p.bearing, pitch: p.pitch, elevation: p.elevation });
      // MapLibre draws with its view-projection matrix, which lifts the camera by the centre elevation; `map.project`
      // uses `_pixelMatrix`, built before that lift (maplibre-gl 5.24 MercatorTransform._calcMatrices), so off the
      // ground plane by up to ~6 px per metre of deck elevation at z18. The oracle is what MapLibre draws.
      const T = map.transform, vp = T._viewProjMatrix ?? T.currentTransform?._viewProjMatrix, ws = T.worldSize;
      const mc = (window as any).maplibregl.MercatorCoordinate;
      const drawn = (lng: number, lat: number) => {
        const q = mc.fromLngLat([lng, lat], 0), X = q.x * ws, Y = q.y * ws;
        const cx = vp[0] * X + vp[4] * Y + vp[12], cy = vp[1] * X + vp[5] * Y + vp[13], cw = vp[3] * X + vp[7] * Y + vp[15];
        return { x: (cx / cw + 1) / 2 * el.clientWidth, y: (1 - cy / cw) / 2 * el.clientHeight };
      };
      let worst = 0, projectWorst = 0;
      for (const [lng, lat, x, y] of p.probes) {
        const q = drawn(lng, lat); worst = Math.max(worst, Math.hypot(q.x - x, q.y - y));
        const r = map.project([lng, lat]); projectWorst = Math.max(projectWorst, Math.hypot(r.x - x, r.y - y));
      }
      return { phase: p.phase, zoom: p.zoom, pitch: p.pitch, px: worst, size: '', elevation: p.elevation, projectPx: projectWorst };
    });
  }, poses);
  await oracle.close();
  const worst = (phase: Pose['phase']) => Math.max(...misfits.filter(m => m.phase === phase).map(m => m.px));
  console.log('engine parity', JSON.stringify({ budgetPx: PARITY_PX, samples: misfits.length, introMaxPx: worst('intro'), rideMaxPx: worst('ride'),
    projectMaxPx: Math.max(...misfits.map((m: any) => m.projectPx)),
    trace: misfits.map((m: any) => [m.phase[0], Math.round(m.zoom * 100) / 100, Math.round(m.pitch), Math.round(m.px * 100) / 100, Math.round(m.elevation * 100) / 100]) }));
  for (const m of misfits) expect(m.size, 'oracle viewport matches').toBe('');
  expect(worst('intro'), 'start flight').toBeLessThanOrEqual(PARITY_PX);
  expect(worst('ride'), 'Anne Frank → Rijksmuseum ride').toBeLessThanOrEqual(PARITY_PX);
});
