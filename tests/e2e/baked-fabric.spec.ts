import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute, settleWorld } from './helpers';
import { frameSharpness, type Rect } from '../../src/canalRecall/look/sharpness';
import { CRISP_SPOTS } from '../../scripts/look/crispSpots';

// The baked coarse fabric pin (lane R4-A follow-up, #243): at the user's Da Costakade pose (zoom 17.8, pitch 75) with
// the game's sync held, as the crisp spec held it, the baked tier drew no house at all. Its cells' dissolves were
// stepped only from the sync, so every cell stayed at the start of its dissolve, invisible, while its buildings were
// already out of the runtime coarse chunks (a live ride at the pose was fine). The facade layer now steps them with
// the drawn frame, and held-camera specs settle with settleWorld. Here the pose is framed with the tier on and off,
// after a 3 s hold with no settle ticks: every baked cell must be drawn, and the facade band's sharpness
// (look/sharpness.ts) must be within 10 % of the flag-off frame.
//   PW_PORT=4663 BUNDLES_DIR=<scratch> /tmp/canal-pw.sh npx playwright test baked-fabric --project=desktop --workers=1
const SPOT = CRISP_SPOTS.find(s => s.name === 'da-costakade-user')!;
const OUT = 'artifacts/baked-fabric';
test.use({ viewport: { width: SPOT.viewport![0], height: SPOT.viewport![1] } });

async function frame(page: Page, baked: boolean) {
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: `?engine=own&tier=high&governor=0&bakedCoarse=${baked ? 1 : 0}` });
  // The pin runs the engine world view by its own query flag, not the ENGINE=own environment the lane set by hand.
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap.engine), 'the engine world view is in charge').toBe('own');
  const jump = () => page.evaluate((pose) => {
    const vm = (window as any).canalRecallGame.vectorMap;
    vm.sync = () => {}; vm.aimAtWorld = () => {};
    const g = vm._ownGround;
    vm.jumpToLngLat({ ...pose, elevation: g?.ready ? g.heightAt(pose.center) : 0 });
  }, { center: SPOT.center, zoom: SPOT.zoom, bearing: SPOT.bearing, pitch: SPOT.pitch });
  await jump(); await settleWorld(page, 'baked-fabric first jump'); await jump(); await settleWorld(page, 'baked-fabric second jump');
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._bakedCoarse?.stats?.() ?? null);
  // Why the tier is off, when it is (ownWorldView.bakedCoarseOff: flag, no-shel, layer-table, look), for the failure log.
  const off = await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; return { on: vm.bakedCoarseOn ?? null, off: vm.bakedCoarseOff ?? null, world: vm.worldSettled?.() ?? null }; });
  const url: string = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
  const png = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(`${OUT}/${baked ? 'baked' : 'off'}.png`, png);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return { state, off, sharpness: frameSharpness(data, info.width, info.height, info.channels, SPOT.band as Rect) };
}

test('baked fabric: the houses at da-costakade-user draw with the baked tier on (sync held)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the baked tier is a desktop tier');
  // The CI runner's software GL took over four minutes per frame here (the far tier never settled in 90 s), then the test
  // timeout and a retry ran it twice and the job hit its 45-minute limit (2026-11-07 night). The pin is a local-gate
  // spec: check:canal runs it on a Mac with a real GPU, where it takes under a minute.
  test.skip(!!process.env.CI, 'needs a real GPU: the baked tier uploads ~100 MB and the far tier must settle');
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const on = await frame(page, true), off = await frame(page, false);
  const ratio = on.sharpness.laplacianVar / off.sharpness.laplacianVar;
  writeFileSync(`${OUT}/result.json`, JSON.stringify({ on, off, ratio }, null, 1));
  console.log('baked-fabric', JSON.stringify({ on: on.sharpness, off: off.sharpness, ratio: +ratio.toFixed(3), baked: on.state, why: on.off }));
  expect(on.state, 'the baked tier ran').not.toBeNull();
  expect(on.state.cells, 'baked cells resident').toBeGreaterThan(0);
  expect(on.state.fading, 'no baked cell stuck in its dissolve').toBe(0);
  expect(on.state.drawn, 'every resident baked cell drawn').toBe(on.state.cells);
  expect(ratio, 'facade band sharpness against the flag-off frame').toBeGreaterThan(0.9);
});
