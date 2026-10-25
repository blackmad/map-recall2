import { test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Review frames, not a regression (issue #65, "the tall buildings on the south side of
// westerpark ... on haarlemmerweg"; same method as #62). Parks the rider on a park path facing each building and shoots the chase
// camera plus a low oblique from the path, so before/after installs can be compared.
//   PARK_FRAMES_OUT=artifacts/westerpark-south/before PARK_FRAMES=<views.json> \
//     PW_PORT=4667 bash /tmp/canal-pw.sh npx playwright test westerpark-south-frames --project=desktop
// views.json: [{ id, eye: [lng, lat], target: [lng, lat] }]
const OUT = process.env.PARK_FRAMES_OUT || 'artifacts/westerpark-south/frames';
type View = { id: string; eye: [number, number]; target: [number, number]; label?: string };
const views: View[] = process.env.PARK_FRAMES ? JSON.parse(readFileSync(process.env.PARK_FRAMES, 'utf8')) : [];

async function parkAt(page: Page, at: number[], face: number[]) {
  await page.evaluate(({ at, face }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * 3;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * 3 });
    const a = toWorld(at), b = toWorld(face);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.handleInput = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
  }, { at, face });
}

test('westerpark south: chase frames from the park', async ({ page }, info) => {
  test.skip(!views.length || info.project.name !== 'desktop', 'set PARK_FRAMES=<views.json>');
  test.setTimeout(120_000 + views.length * 40_000);
  mkdirSync(OUT, { recursive: true });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  for (const v of views) {
    await parkAt(page, v.eye, v.target);
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${OUT}/${v.label || v.id}-chase.png` });
    await page.evaluate(({ eye, target }) => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
      const sync = vm.sync; vm.sync = () => {}; map.stop(); map.setMaxPitch(85);
      map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, 2.5, { lng: target[0], lat: target[1] }, 9));
      (window as any).__restoreSync = sync;
    }, { eye: v.eye, target: v.target });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/${v.label || v.id}-path.png` });
    await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; if ((window as any).__restoreSync) vm.sync = (window as any).__restoreSync; });
  }
});
