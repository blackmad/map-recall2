/**
 * Serve the signature-landmark catalogue from this checkout's source, not the committed bundle.
 *
 * The game (`GAME_BUILDING_MODELS`) and the gallery (`manual-landmarks.html`, `SIGNATURE_MODELS`) read the catalogue from
 * `public/canal-drive/js/signature-placement.bundle.js`. Leaf lanes may not rebuild that bundle (LANE-RULES), so a new
 * landmark's catalogue entry is missing from the page until the integrator rebuilds it: the review sheet's IN GAME column
 * waited on `shown.has(id)` for a model the game never listed, and the gallery drew no card (#139, De Roos and
 * Hirschgebouw, 2026-10-30). Routing the bundle request to an in-memory esbuild of `src/canalRecall/landmarks/browser.ts`
 * (the same entry and flags as `npm run build:canal-signature-landmarks`) shows the checkout's catalogue without
 * touching the committed bundle.
 */
import path from 'node:path';
import {build} from 'esbuild';
import type {BrowserContext, Page} from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '../..');
let cached: Promise<string> | null = null;

/** The bundle text, built once per process. */
export function freshSignatureBundle(): Promise<string> {
  cached ??= build({
    entryPoints: [path.join(ROOT, 'src/canalRecall/landmarks/browser.ts')],
    bundle: true, format: 'iife', globalName: 'CanalRecallSignatureLandmarks', minify: true, write: false,
  }).then(r => r.outputFiles[0].text);
  return cached;
}

/** Route every request for the signature bundle on `target` to the fresh build. Call before `goto`. */
export async function routeFreshSignatureBundle(target: Page | BrowserContext): Promise<void> {
  const body = await freshSignatureBundle();
  await target.route('**/js/signature-placement.bundle.js*', route => route.fulfill({body, contentType: 'text/javascript'}));
}

/** Ids the page's game layer can draw; `id` missing here means no wait on `shown` can ever succeed. */
export async function gameListsModel(page: Page, id: string): Promise<boolean> {
  return page.evaluate(i => !!(window as any).CanalRecallSignatureLandmarks?.GAME_BUILDING_MODELS?.some((m: {id: string}) => m.id === i), id);
}

/**
 * The IN GAME shots hold the camera by stubbing `vectorMap.sync`, and sync is also what streams the city at a new camera:
 * frames after the fixed 5 s wait showed the landmark alone on an empty lot (Morgan & Mees, 2026-11-14: 4 of 5 frames).
 * Under `?engine=own` this drives the tiers with `settleTick()` and waits for `worldSettled()` twice in a row, as
 * tests/e2e/helpers.ts settleWorld does. Under the default engine (MapLibre) there is no settleTick: the fixed wait stays
 * and the neighbours still do not stream (moving the rider there did not help either), so judge surroundings on
 * `npm run house:frames -- --rule10` frames, which teleport the rider and let the world settle.
 */
export interface HeldSettle { own: boolean; settled: boolean; pending: string[]; buildings: number | null; waitedMs: number }

/**
 * 2026-11-22 (user: the What's New Raamplein "before" showed empty lots): settleTick() drives the ground and the far
 * and baked tiers only. With `sync` stubbed, nothing told the facades' detail block or the building tiles that the
 * camera had jumped, so they kept the route start's plan and `worldSettled()` reported "settled" with nothing requested
 * at the shot. Each tick now also hands the held camera's centre to the detail block (`setDetailCentre`, what sync
 * does every frame) and asks the tiles to follow the camera (`followCamera`), and the wait ends only when the camera has
 * no pending work (engine/settle.ts: building tiles, facades, landmark GLBs) and the resident building count has held
 * for three polls. Returns what it saw: callers refuse a shot that is not `settled`.
 */
export async function settleHeldWorld(page: Page, timeoutMs = 90000): Promise<HeldSettle> {
  const own = await page.evaluate(() => typeof (window as any).canalRecallGame?.vectorMap?.settleTick === 'function');
  if (!own) {
    await page.waitForTimeout(5000);
    console.log('in-game shot: the default engine has no settleTick, so the neighbours do not stream at a held camera; pass --query=engine=own');
    return {own, settled: false, pending: ['default engine'], buildings: null, waitedMs: 5000};
  }
  let previous = '', stable = 0;
  const start = Date.now();
  let last: HeldSettle = {own, settled: false, pending: ['not polled'], buildings: null, waitedMs: 0};
  while (Date.now() - start < timeoutMs) {
    for (let k = 0; k < 5; k++) {
      await page.evaluate(() => {
        const vm = (window as any).canalRecallGame.vectorMap, cam = vm.cameraMap?.camera;
        vm.settleTick();
        if (cam) vm._threeBuildings?.setDetailCentre?.(cam.lng, cam.lat, false);
        vm._completeCity?.followCamera?.();
      });
      await page.waitForTimeout(100);
    }
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap;
      const w = vm.worldSettled?.() ?? {settled: true};
      const stats = vm._threeBuildings?.stats?.();
      return {settled: !!w.settled, pending: (vm.pendingWork?.() ?? []) as string[], buildings: typeof stats?.buildings === 'number' ? stats.buildings as number : null};
    });
    last = {own, ...now, waitedMs: Date.now() - start};
    const key = JSON.stringify(now);
    stable = now.settled && !now.pending.length && key === previous ? stable + 1 : 0;
    previous = key;
    if (stable >= 3) return last;
  }
  console.log(`in-game shot: world not settled after ${timeoutMs / 1000} s: ${previous}`);
  return {...last, settled: false};
}
