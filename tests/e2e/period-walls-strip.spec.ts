import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';
import { CAMERAS, WALL_PLACES } from './periodWallPlaces';

// Measured period walls (GitHub #46): the same chase and 3/4 aerial cameras on five streets, flag off vs on.
//   WALLS_OUT=artifacts/period-walls/strip/off PW_OFFLINE_MAP=1 PW_PORT=4550 npx playwright test period-walls-strip --project=desktop
//   WALLS_QUERY='?walls=measured' WALLS_OUT=artifacts/period-walls/strip/on …
const OUT = process.env.WALLS_OUT || 'artifacts/period-walls/strip/off';
const QUERY = process.env.WALLS_QUERY || '';

const ONLY = (process.env.WALLS_PLACES || '').split(',').filter(Boolean);

async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks;
    const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-9, c.lat] });
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const w = window as any, key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}`;
    w.__wallsIdle = idle && landmarksIdle && key === w.__wallsKey ? (w.__wallsIdle || 0) + 1 : 0;
    w.__wallsKey = key;
    return w.__wallsIdle >= 5;
  }, null, { timeout: 180_000, polling: 1000 });
  await page.evaluate(() => { const w = window as any; w.canalRecallGame.vectorMap.map.jumpTo(w.__wallsCamera); });
  await page.waitForTimeout(4000);
}

test('period walls strip', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop camera strip');
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false, query: QUERY });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference('photo'));
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._buildings3dLook)).toBe('photo');
  const meta: Record<string, unknown> = { query: QUERY };
  for (const place of WALL_PLACES.filter(p => !ONLY.length || ONLY.includes(p.name))) for (const [kind, cam] of Object.entries(CAMERAS(place))) {
    await page.evaluate(({ cam }) => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
      g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; (window as any).__wallsIdle = 0;
      g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
      vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView(55); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      (window as any).__wallsCamera = map.calculateCameraOptionsFromTo({ lng: cam.eye[0], lat: cam.eye[1] }, cam.altM, { lng: cam.target[0], lat: cam.target[1] }, cam.targetAltM);
      map.jumpTo((window as any).__wallsCamera);
    }, { cam });
    await settle(page);
    await page.evaluate(() => {
      const map = (window as any).canalRecallGame.vectorMap.map;
      for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'visibility') !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none');
      const canvas = map.getCanvas() as HTMLCanvasElement;
      for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
    });
    await page.waitForTimeout(1200);
    await page.locator('canvas.maplibregl-canvas').first().screenshot({ path: `${OUT}/${place.name}-${kind}.png` });
  }
  writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
});
