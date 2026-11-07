import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    canalRecallGame?: { state: number; player?: { x: number } | null };
  }
}

/**
 * Setup-rail selects stay in the DOM for tests/legacy wiring but are `hidden`
 * (enamel ChoiceRow is the visible control). Playwright refuses selectOption on
 * invisible nodes unless forced — that is why CI burned 15 minutes on retries.
 */
export async function setHiddenSelect(page: Page, id: string, value: string): Promise<void> {
  await page.locator(`#${id}`).selectOption(value, { force: true });
}

export type OpenRouteOptions = {
  travelMode?: 'boat' | 'car' | 'transit';
  viewMode?: 'north' | 'heading' | 'chase';
  seedRandom?: boolean;
  abortHeavyTiles?: boolean;
  /** Jump straight into racing after the player spawns. */
  enterRacing?: boolean;
  playerTimeoutMs?: number;
  /** Seed for Math.random, so different values give different routes. */
  seed?: number;
  /** Query string for the page URL, e.g. `?streetChunks=0`. */
  query?: string;
  /** Steering scheme; phones default to 'street' (follow the street). */
  controlMode?: 'street' | 'relative' | 'absolute';
};

/**
 * `ENGINE=own` runs a spec against the engine world view (src/canalRecall/engine/ownWorldView.ts, `?engine=own`):
 * three.js owns the frame and MapLibre is never constructed. openRoute applies it; specs that `goto` themselves call it.
 */
export async function useEngine(page: Page): Promise<void> {
  if (process.env.ENGINE === 'own') await page.addInitScript(() => { (window as any).__canalRecallEngine = 'own'; });
  await useBundlesDir(page);
}

/**
 * `BUNDLES_DIR=<dir>` serves the game's `*.bundle.js` from a scratch build instead of the committed ones (lanes build
 * their bundles outside the tree; the integrator rebuilds the committed ones). Bundles missing there are served as usual.
 */
export async function useBundlesDir(page: Page): Promise<void> {
  // `WORLD_DIR=<dir>` serves world-v1 (tiles.json, cells, far/, shells/) from a staged compile, as aerial-pan.mjs does.
  const world = process.env.WORLD_DIR;
  if (world) await page.route(/\/data\/extracts\/amsterdam\/world-v1\/([\w/.-]+?)(\?.*)?$/, route => {
    const file = join(world, /\/world-v1\/([\w/.-]+?)(\?.*)?$/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: file.endsWith('.json') ? 'application/json' : 'application/octet-stream' }) : route.continue();
  });
  const dir = process.env.BUNDLES_DIR;
  if (!dir) return;
  await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = join(dir, new URL(route.request().url()).pathname.split('/').pop()!);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }) : route.continue();
  });
}

/** Boot Canal Recall, set prefs via the hidden selects, and start a route. */
export async function openRoute(page: Page, options: OpenRouteOptions = {}): Promise<void> {
  const {
    travelMode = 'car',
    viewMode,
    seedRandom = true,
    abortHeavyTiles = true,
    enterRacing = true,
    playerTimeoutMs = 90_000,
    seed: seedValue = 0x5eed1234,
    query = '',
    controlMode,
  } = options;

  if (seedRandom) {
    await page.addInitScript((initial: number) => {
      let seed = initial;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      };
    }, seedValue);
  }
  if (abortHeavyTiles) {
    await page.route(/3dbag|cesium3dtiles/i, (route) => route.abort());
  }
  if (process.env.PW_OFFLINE_MAP) await serveMapLibreOffline(page);
  await useEngine(page);

  await page.goto(`/canal-drive/${query}`);
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame))).toBe(true);
  if (process.env.ENGINE === 'own') expect(await page.evaluate(() => (window.canalRecallGame as any).vectorMap.engine), 'ENGINE=own: the engine world view is in charge').toBe('own');
  await expect(page.locator('#route-card')).toBeVisible();
  await setHiddenSelect(page, 'travel-mode', travelMode);
  if (viewMode) await setHiddenSelect(page, 'view-mode', viewMode);
  if (controlMode) {
    await page.evaluate(mode => {
      const g = window.canalRecallGame as unknown as { _overlay: { store: { patchPrefs(p: object, z: unknown): void } }; _overlayZoom(): unknown };
      g._overlay.store.patchPrefs({ controlMode: mode }, g._overlayZoom());
    }, controlMode);
  }
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(
    () => page.evaluate(() => Boolean(window.canalRecallGame?.player?.x)),
    { timeout: playerTimeoutMs },
  ).toBe(true);
  if (enterRacing) {
    await page.evaluate(() => { window.canalRecallGame.state = 4; });
  }
}

/**
 * Sandboxes without internet (cloud sessions) cannot reach unpkg or the
 * basemap host. `PW_OFFLINE_MAP=1` serves the installed maplibre-gl and a
 * background-only style instead: the streamed building tiles, trees and route
 * layers still draw (they come from the local extract), the basemap does not.
 */
export async function serveMapLibreOffline(page: Page): Promise<void> {
  const dist = resolve(process.cwd(), 'node_modules/maplibre-gl/dist');
  await page.route(/unpkg\.com\/maplibre-gl@5(\.[0-9.]+)?\/dist\/maplibre-gl\.js/, route => route.fulfill({ path: resolve(dist, 'maplibre-gl.js'), contentType: 'application/javascript' }));
  await page.route(/unpkg\.com\/maplibre-gl@5(\.[0-9.]+)?\/dist\/maplibre-gl\.css/, route => route.fulfill({ path: resolve(dist, 'maplibre-gl.css'), contentType: 'text/css' }));
  await page.route(/tiles\.openfreemap\.org/, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ version: 8, name: 'offline', sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ece6d6' } }] }),
  }));
}

/**
 * Wait until the own engine's world has landed for a held camera (2026-11-07, user: "screenshot logic needs to wait
 * for pop-in"). Specs that hold the camera by stubbing `vectorMap.sync` also stop the far and baked coarse tiers and
 * the ground's dissolves, which only advance from `sync`; this drives them with `settleTick()` and polls
 * `worldSettled()` (engine/ownWorldView.ts) until two polls in a row agree. Returns the last status; warns on timeout.
 */
export async function settleWorld(page: Page, where = 'settle', timeoutMs = 90_000): Promise<unknown> {
  let previous = '', stable = 0, last: unknown = null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (let k = 0; k < 5; k++) {
      await page.evaluate(() => { const vm = (window as any).canalRecallGame?.vectorMap; if (vm?.settleTick) vm.settleTick(); else vm?.host?.triggerRepaint?.(); });
      await page.waitForTimeout(100);
    }
    const now = await page.evaluate(() => (window as any).canalRecallGame?.vectorMap?.worldSettled?.() ?? { settled: true, legacy: true });
    last = now;
    const key = JSON.stringify(now);
    stable = (now as any).settled && key === previous ? stable + 1 : 0;
    previous = key;
    if (stable >= 2) return now;
  }
  console.warn(`${where}: world not settled after ${timeoutMs / 1000} s: ${previous}`);
  return last;
}
