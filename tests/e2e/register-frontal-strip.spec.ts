import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { useEngine } from './helpers';

// Register-recipes verdict strip (2026-11-10). Per pand the rider is parked at the panorama's spot (so the wall is drawn
// by the detail tier, as a rider sees it), then the camera stands at that spot, raised to the
// cams' eye height and looking level at the wall, beside the photo from scripts/register-facts/frontal-photos.ts.
//   REG_CAMS=<cams.json> REG_OUT=<dir> REG_QUERY='&world=live&registerFacts=0' PW_PORT=4755 \
//     bash /tmp/canal-pw.sh npx playwright test tests/e2e/register-frontal-strip.spec.ts --project=desktop --workers=1
// `world=live`: compiled world-v1 cells carry the decoration baked at compile time, so only the live tile path shows the
// browser flag. Needs public/data/extracts/amsterdam/monument-facts.json for `registerFacts=1` (the integrator publishes it).
const OUT = process.env.REG_OUT || 'artifacts/register-frontal';
type Cam = { slug: string; ids: string[]; eye: [number, number]; eyeAlt: number; target: [number, number]; targetAlt: number; vfov?: number };
const CAMS: Cam[] = (process.env.REG_CAMS ? JSON.parse(readFileSync(process.env.REG_CAMS, 'utf8')) as Cam[] : []).filter(c => !process.env.REG_ONLY || process.env.REG_ONLY.split(',').includes(c.slug));
test.use({ viewport: { width: 1280, height: 800 } });

async function settle(page: Page) {
  let last = '';
  await expect.poll(async () => {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, s = vm._completeCity?.status?.(), t = vm._threeBuildings, g = vm._ownGround;
      vm.host?.triggerRepaint?.();
      return JSON.stringify([s?.inFlight, s?.queued, s?.tiles, s?.features, t?.chunks?.size, t?.pending?.length ?? 0, t?.inflight?.size ?? 0, t?.staged?.length ?? 0, t?.fading?.size ?? 0, t?.leaving?.size ?? 0, g?.loadingCells ?? 0]);
    });
    const v = JSON.parse(now), ok = now === last && !v[0] && !v[1] && v.slice(5).every((n: number) => n === 0);
    last = now;
    return ok;
  }, { timeout: 120_000, intervals: [2000] }).toBe(true);
}

test('register frontal strip', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' || !CAMS.length, 'desktop camera strip, needs REG_CAMS');
  test.setTimeout(120_000 + CAMS.length * 150_000);
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => { let seed = 0x5eed1234; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; }; });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await useEngine(page);
  const probe: Record<string, unknown> = {};
  for (const c of CAMS) {
    // The rider starts at the panorama's spot; the finish is Dam square (a race needs a finish some way off).
    const [e, f] = [c.eye, [4.8926, 52.3731]];
    await page.goto(`/canal-drive/?engine=own&travel=car&governor=0${process.env.REG_QUERY ?? ''}#race=${e[1]},${e[0]},${e[1]},${e[0]},${f[1]},${f[0]}`);
    await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);
    await page.evaluate(() => { const g = (window as any).canalRecallGame; g.state = 4; g._quizFreezesRide = () => false; g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; g.player.handleInput = () => {}; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
    await expect.poll(() => page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; return vm.engine === 'own' && !!vm._threeBuildings?.ready; }), { timeout: 120_000 }).toBe(true);
    await settle(page);
    await page.evaluate(({ c }) => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map ?? vm.cameraMap;
      if (vm._playerBike?._modelRoot) vm._playerBike._modelRoot.visible = false;
      vm.sync = () => {}; vm.aimAtWorld = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView(c.vfov ?? 55); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      map.jumpTo(map.calculateCameraOptionsFromTo({ lng: c.eye[0], lat: c.eye[1] }, c.eyeAlt, { lng: c.target[0], lat: c.target[1] }, c.targetAlt));
      vm.setLabelsVisible?.(false);
      const canvas = map.getCanvas() as HTMLCanvasElement;
      for (const el of Array.from(document.body.querySelectorAll('*'))) if (el !== canvas && !el.contains(canvas)) (el as HTMLElement).style.visibility = 'hidden';
    }, { c });
    await page.waitForTimeout(1500);
    await settle(page);
    await page.waitForTimeout(500);
    await page.locator('canvas.maplibregl-canvas, canvas.engine-canvas').first().screenshot({ path: `${OUT}/${c.slug}.jpg`, type: 'jpeg', quality: 88 });
    // Which pands the screen centre and quarter points hit (the frame is on the review pand) and how they are drawn.
    probe[c.slug] = await page.evaluate(() => {
      const t = (window as any).canalRecallGame.vectorMap._threeBuildings; if (!t?.inspectAtScreen) return null;
      const cv = t.map.getCanvas(), w = cv.clientWidth, h = cv.clientHeight, out: Record<string, unknown> = {};
      for (const [fx, fy] of [[.5, .5], [.5, .3], [.3, .5], [.7, .5]]) { const hit = t.inspectAtScreen(w * fx, h * fy, w, h); if (hit && !out[hit.id]) out[hit.id] = { lngLat: hit.lngLat, featureTarget: hit.featureTarget, at: [fx, fy] }; }
      return out;
    });
  }
  writeFileSync(`${OUT}/probe.json`, JSON.stringify(probe, null, 1));
});
