/**
 * Facade tone (issue #71): large-recipe and landmark GLBs beside the procedural rows, desktop frames at six spots
 * (camera pinned since #73, so two runs frame alike), with the luma of each pipeline's pixels. Not part of check:canal: a before/after record for look changes.
 *
 *   PW_PORT=4621 TONE_OUT=artifacts/facade-tone/before npx playwright test facade-tone --project=desktop
 *   TONE_SPOTS=haarlemmerweg,dam picks spots; LOOK_BUNDLES_DIR=<dir> serves *.bundle.js from <dir> (as mood-shots).
 *
 * tone.json per spot: mean sRGB luma of the GLB pixels (those that change when the landmark layer is hidden: large
 * recipes, recipe houses, landmarks), of the procedural pixels (those that change when the streamed buildings are
 * hidden) and of every building pixel, each split into walls and roofs (faces whose world normal points up), plus the
 * share of the frame each covers.
 */
import { test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { openRoute } from './helpers';

const OUT = process.env.TONE_OUT || 'artifacts/facade-tone';
const ONLY = process.env.TONE_SPOTS?.split(',').filter(Boolean);

/** The rider stands `standM` from `target` toward compass `stand` and faces the target. */
type Spot = { name: string; target: [number, number]; stand: number; standM: number };
export const TONE_SPOTS: Spot[] = [
  // The 1983/1992 Haarlemmerweg blocks facing the Westerpark (north fronts, shade side), from the park bank.
  { name: 'haarlemmerweg', target: [4.8752, 52.3852], stand: 10, standM: 75 },
  // Van Eeghenstraat 110 and 180-212 (north fronts, slate roofs) from the Vondelpark path, closer in than the first
  // framing (60 m north), which looked over the park's trees onto the roofs only (#73).
  { name: 'van-eeghen', target: [4.8686, 52.3564], stand: 345, standM: 42 },
  // Herengracht west bank at the Bartolotti house, from across the canal (east fronts).
  { name: 'herengracht', target: [4.8856, 52.3744], stand: 100, standM: 55 },
  // Stadsdeel Nieuw-West (Osdorpplein office, 44 m) from the south-west; the first framing (4.8076, 52.3585) had no
  // GLB in view, only the square (#73).
  { name: 'nieuw-west', target: [4.8211, 52.3790], stand: 215, standM: 90 },
  { name: 'bilderdijk', target: [4.87195, 52.3672], stand: 215, standM: 60 },
  // The Royal Palace's east front (white stone) from the Dam.
  { name: 'dam', target: [4.8913, 52.3731], stand: 95, standM: 110 },
];

async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
  }, p);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => { (window as any).__toneIdle = 0; });
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks;
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const w = window as any, key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}`;
    w.__toneIdle = idle && landmarksIdle && key === w.__toneKey ? (w.__toneIdle || 0) + 1 : 0;
    w.__toneKey = key;
    return w.__toneIdle >= 4;
  }, null, { timeout: 180_000, polling: 1000 });
}

const lumaOf = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
async function raw(png: Buffer) {
  const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * Mean luma of `shot` over the pixels where `bare` differs (a hidden layer's pixels) and their share; split into walls
 * and roofs by `faces` (the frame drawn with every three.js surface classified by its world normal: red = facing up).
 */
function masked(shot: Buffer, bare: Buffer, faces: Buffer) {
  const acc = { all: [0, 0], walls: [0, 0], roofs: [0, 0] };
  for (let k = 0; k < shot.length; k += 3) {
    const d = Math.abs(shot[k] - bare[k]) + Math.abs(shot[k + 1] - bare[k + 1]) + Math.abs(shot[k + 2] - bare[k + 2]);
    if (d <= 18) continue;
    const l = lumaOf(shot[k], shot[k + 1], shot[k + 2]), up = faces[k] > 128 && faces[k + 1] < 128;
    for (const key of ['all', up ? 'roofs' : 'walls'] as const) { acc[key][0] += l; acc[key][1]++; }
  }
  const px = shot.length / 3, out: Record<string, { luma: number; share: number }> = {};
  for (const [key, [sum, n]] of Object.entries(acc)) out[key] = { luma: +(sum / Math.max(1, n)).toFixed(1), share: +(n / px).toFixed(3) };
  return out;
}

test('facade tone: GLB and procedural pixels at six spots', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough');
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  const bundles = process.env.LOOK_BUNDLES_DIR;
  if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await openRoute(page, { travelMode: 'car', abortHeavyTiles: true });
  await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
  });
  const results: Record<string, unknown> = {};
  for (const spot of TONE_SPOTS.filter(s => !ONLY || ONLY.includes(s.name))) {
    const b = spot.stand * Math.PI / 180, c = spot.target;
    const p = { lng: c[0] + Math.sin(b) * spot.standM / (111320 * Math.cos(c[1] * Math.PI / 180)), lat: c[1] + Math.cos(b) * spot.standM / 111320, bearing: (spot.stand + 180) % 360 };
    await teleport(page, p);
    await page.waitForTimeout(2500);
    await teleport(page, p);
    console.log(`${spot.name}: settling`);
    await settle(page);
    // Pin the camera (as block-face.spec.ts does): the chase camera's lag left before and after runs framed differently,
    // which moved the masked luma by more than a look change does (#73). Eye on the stand line, `standM` out and up at
    // 35 deg, looking at the target 8 m up.
    await page.evaluate(({ eye, target, alt }) => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
      vm.__toneSync ??= vm.sync; vm.sync = () => {}; map.stop();
      map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, alt, { lng: target[0], lat: target[1] }, 8));
    }, { eye: [p.lng, p.lat], target: c, alt: Math.round(spot.standM * Math.tan(35 * Math.PI / 180)) + 8 });
    await page.waitForTimeout(2500);
    await settle(page);
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const map = (window as any).canalRecallGame.vectorMap.map, canvas = map.getCanvas();
      for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
    });
    await page.waitForTimeout(600);
    const shot = await page.screenshot();
    writeFileSync(join(OUT, `${spot.name}.png`), shot);
    const hide = async (what: 'landmarks' | 'facades' | 'both' | 'none') => {
      await page.evaluate(what => {
        const vm = (window as any).canalRecallGame.vectorMap;
        vm.__toneLandmarks ??= vm._signatureLandmarks?.enabled;
        vm._threeBuildings?.setVisible(!(what === 'facades' || what === 'both'));
        if (vm._signatureLandmarks) vm._signatureLandmarks.enabled = what === 'landmarks' || what === 'both' ? false : vm.__toneLandmarks;
        vm.map.triggerRepaint();
      }, what);
      await page.waitForTimeout(800);
      return page.screenshot();
    };
    const noGlb = await hide('landmarks'), noFacades = await hide('facades'), bare = await hide('both');
    await hide('none');
    // Face classes: every shared-frame surface in red where its world normal points up (z, the frame is east/north/up), green otherwise.
    await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, sf = vm._sharedFrame, THREE = (window as any).CanalRecallThree.THREE;
      sf.scene.overrideMaterial = new THREE.ShaderMaterial({ side: THREE.DoubleSide,
        vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: 'varying vec3 vW; void main() { vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); gl_FragColor = abs(n.z) > 0.5 ? vec4(1.0, 0.0, 0.0, 1.0) : vec4(0.0, 1.0, 0.0, 1.0); }' });
      vm.map.triggerRepaint();
    });
    await page.waitForTimeout(800);
    const faces = await page.screenshot();
    await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; vm._sharedFrame.scene.overrideMaterial = null; vm.map.triggerRepaint(); });
    await page.evaluate(() => { for (const e of Array.from(document.body.querySelectorAll('*'))) (e as HTMLElement).style.visibility = ''; });
    await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; if (vm.__toneSync) vm.sync = vm.__toneSync; });
    const s = await raw(shot);
    const f = await raw(faces);
    results[spot.name] = { glb: masked(s, await raw(noGlb), f), procedural: masked(s, await raw(noFacades), f), buildings: masked(s, await raw(bare), f) };
  }
  writeFileSync(join(OUT, 'tone.json'), JSON.stringify(results, null, 1));
  console.log(JSON.stringify(results));
});
