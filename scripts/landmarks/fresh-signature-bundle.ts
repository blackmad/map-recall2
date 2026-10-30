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
