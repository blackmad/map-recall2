import { test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';
import { move } from './periodWallPlaces';

// Generic-generator uplift sheet (GitHub #102): a rider-height camera looking along the street at each spot, beside
// the panorama from scripts/look/generic-gap-panos.ts (sheet: scripts/look/generic-gap-sheet.mjs).
//   GAP_SPOTS=<spots.json> GAP_OUT=<dir> PW_PORT=4589 npx playwright test generic-gap-strip --project=desktop
// spots.json: [{ slug, lng, lat, bearing }]. GAP_QUERY is appended to the page URL.
const OUT = process.env.GAP_OUT || 'artifacts/generic-gap/off';
const SPOTS: { slug: string; lng: number; lat: number; bearing: number }[] = process.env.GAP_SPOTS ? JSON.parse(readFileSync(process.env.GAP_SPOTS, 'utf8')) : [];

async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks;
    const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-9, c.lat] });
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const w = window as any, key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}`;
    w.__gapIdle = idle && landmarksIdle && key === w.__gapKey ? (w.__gapIdle || 0) + 1 : 0;
    w.__gapKey = key;
    return w.__gapIdle >= 5;
  }, null, { timeout: 180_000, polling: 1000 });
  await page.evaluate(() => { const w = window as any; w.canalRecallGame.vectorMap.map.jumpTo(w.__gapCamera); });
  await page.waitForTimeout(3000);
}

test('generic gap strip', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' || !SPOTS.length, 'desktop camera strip, needs GAP_SPOTS');
  test.setTimeout(1_200_000);
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false, query: process.env.GAP_QUERY || '' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  const stats: Record<string, unknown> = {};
  for (const s of SPOTS) {
    const cam = { eye: move([s.lng, s.lat], s.bearing + 180, 6), target: move([s.lng, s.lat], s.bearing, 40) };
    await page.evaluate(({ cam }) => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
      g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; (window as any).__gapIdle = 0;
      g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
      vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView(55); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      (window as any).__gapCamera = map.calculateCameraOptionsFromTo({ lng: cam.eye[0], lat: cam.eye[1] }, 2.5, { lng: cam.target[0], lat: cam.target[1] }, 6);
      map.jumpTo((window as any).__gapCamera);
    }, { cam });
    await settle(page);
    await page.evaluate(() => {
      const map = (window as any).canalRecallGame.vectorMap.map;
      for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'visibility') !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none');
      const canvas = map.getCanvas() as HTMLCanvasElement;
      for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
    });
    await page.waitForTimeout(1000);
    await page.locator('canvas.maplibregl-canvas').first().screenshot({ path: `${OUT}/${s.slug}.png` });
    stats[s.slug] = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._threeBuildings?.stats?.() ?? null);
  }
  writeFileSync(`${OUT}/meta.json`, JSON.stringify({ query: process.env.GAP_QUERY || '', stats }, null, 1));
});
