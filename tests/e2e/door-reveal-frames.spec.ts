import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

// Review frames, not a regression (issue #181, "we really fail to capture the way most Amsterdam
// houses have an inset doorway"). Parks the rider in the street 9 m before a door on three rows
// whose types carry a door reveal and shoots the chase camera (cockpit) plus a low oblique from
// 4.5 m out, so the installed chunks can be compared before and after the reveal install.
//   DOOR_FRAMES_OUT=staging/door-reveals/frames/before PW_PORT=4827 \
//     bash /tmp/canal-pw.sh npx playwright test door-reveal-frames --workers=1
// The rows: Eerste Helmersstraat 241 (reveal 0.25 m), Anthonisz row 160204 (painted portiek
// 0.6 m), President Steynstraat 145744 (brick portiek 0.85 m with a step).
const OUT = process.env.DOOR_FRAMES_OUT || 'staging/door-reveals/frames';
const views = [
  { id: 'helmers-241', eye: [4.8664679, 52.3612299], target: [4.8663669, 52.3611639] },
  { id: 'anthonisz-160204', eye: [4.8857247, 52.3538397], target: [4.885619, 52.3537765] },
  { id: 'steyn-145744', eye: [4.9161774, 52.3512008], target: [4.9161723, 52.3511104] },
];

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
    // closest chase framing the player can reach with the zoom keys, so a door is more than a few pixels
    g.camera.zoom = g.camera.maxZoom;
  }, { at, face });
}

test('door reveals: cockpit and oblique frames of three rows', async ({ page }, info) => {
  test.setTimeout(150_000 + views.length * 40_000);
  const out = `${OUT}/${info.project.name}`;
  mkdirSync(out, { recursive: true });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  for (const v of views) {
    await parkAt(page, v.eye, v.target);
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${out}/${v.id}-cockpit.png` });
    await page.evaluate(({ eye, target }) => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map ?? vm.cameraMap;
      // the rider stands at the eye: hide the bike for the oblique (own-ground-marnix-bridge.spec.ts does the same)
      if (vm._playerBike?._modelRoot) vm._playerBike._modelRoot.visible = false;
      const sync = vm.sync; vm.sync = () => {}; map.stop(); map.setMaxPitch(85);
      map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, 2.2, { lng: target[0], lat: target[1] }, 1.5));
      (window as any).__restoreSync = sync;
    }, { eye: v.eye, target: v.target });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${out}/${v.id}-oblique.png` });
    await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; if ((window as any).__restoreSync) vm.sync = (window as any).__restoreSync; if (vm._playerBike?._modelRoot) vm._playerBike._modelRoot.visible = true; });
  }
});
