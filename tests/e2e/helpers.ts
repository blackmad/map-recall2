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
 * Page setup every ride spec shares. The own engine (src/canalRecall/engine/ownWorldView.ts) is the only world view
 * since MapLibre was deleted (2026-11-27), so `ENGINE=` and `?engine=` no longer choose anything; this only applies
 * `BUNDLES_DIR`. openRoute calls it; specs that `goto` themselves call it.
 */
export async function useEngine(page: Page): Promise<void> {
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
  // `STAGED_CANAL_DIR=<dir>` serves any /canal-drive/<path> file that exists under <dir>/<path> (a lane's staged
  // ordinary-buildings-data/catalogue.json and models/ordinary-buildings/*.glb), so a lane can frame its staged installs
  // without touching the committed catalogue; files missing there are served as usual.
  const staged = process.env.STAGED_CANAL_DIR;
  if (staged) await page.route(/\/canal-drive\/((?:ordinary-buildings-data|models)\/[\w/.-]+?)(\?.*)?$/, route => {
    const file = join(staged, /\/canal-drive\/([\w/.-]+?)(\?.*)?$/.exec(new URL(route.request().url()).pathname)![1]);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: file.endsWith('.json') ? 'application/json' : file.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream' }) : route.continue();
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
  await useEngine(page);

  await page.goto(`/canal-drive/${query}`);
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame))).toBe(true);
  expect(await page.evaluate(() => (window.canalRecallGame as any).vectorMap?.engine), 'the own engine is the world view').toBe('own');
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

/** What a shot's world looked like when it was taken (src/canalRecall/whatsNewPairGuard.ts EngineState). */
export type ShotWorld = { settled: boolean; pending: string[]; buildings: number | null; waitedMs: number; tiers?: unknown };

/**
 * Settle for a screenshot (What's New pairs, demo shots; user 2026-11-22: a "before" frame showed empty lots because
 * it was taken on a fixed timer). settleWorld waits for the streaming tiers; this then also waits until the camera has
 * no pending work (engine/settle.ts: overview, ground, building tiles, facades within 800 m, landmark GLBs in flight)
 * and the resident building count has stopped changing for three polls in a row. Returns what it saw, so the caller
 * can record it and refuse the frame (ShotWorld.settled false) instead of publishing a half-loaded world.
 */
export async function settleForShot(page: Page, where = 'shot', timeoutMs = 120_000): Promise<ShotWorld> {
  const start = Date.now();
  const tiers = await settleWorld(page, where, timeoutMs);
  let previous = '', stable = 0;
  let last: ShotWorld = { settled: false, pending: ['not polled'], buildings: null, waitedMs: 0 };
  while (Date.now() - start < timeoutMs) {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame?.vectorMap;
      if (vm?.settleTick) vm.settleTick(); else vm?.host?.triggerRepaint?.();
      const w = vm?.worldSettled?.() ?? { settled: true };
      const pending: string[] = vm?.pendingWork?.() ?? [];
      const stats = vm?._threeBuildings?.stats?.();
      return { settled: !!w.settled, pending, buildings: typeof stats?.buildings === 'number' ? stats.buildings : null };
    });
    last = { ...now, waitedMs: Date.now() - start, tiers };
    const key = JSON.stringify(now);
    stable = now.settled && !now.pending.length && key === previous ? stable + 1 : 0;
    previous = key;
    if (stable >= 3) return last;
    await page.waitForTimeout(500);
  }
  console.warn(`${where}: not settled for a shot after ${timeoutMs / 1000} s: ${previous}`);
  return { ...last, settled: false };
}

/** A spot `standM` metres from `centre` on bearing `standDeg`, looking back at it (or along `faceDeg`). */
export function standpoint(s: { centre: readonly [number, number]; standDeg: number; standM: number; faceDeg?: number }): { lng: number; lat: number; bearing: number } {
  const b = s.standDeg * Math.PI / 180;
  const dLat = s.standM * Math.cos(b) / 111320;
  const dLng = s.standM * Math.sin(b) / (111320 * Math.cos(s.centre[1] * Math.PI / 180));
  return { lng: s.centre[0] + dLng, lat: s.centre[1] + dLat, bearing: s.faceDeg ?? (s.standDeg + 180) % 360 };
}

/** Put the rider at a lng/lat facing `bearing`, stopped and deaf to input (demo shots, What's New pairs). */
export async function teleportRider(page: Page, p: { lng: number; lat: number; bearing: number }): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

/** A finish/pause/run-card action's hit box, in canvas units (presentationRuntime `_finishButtonBounds`). */
export type CardActionBounds = { x: number; y: number; w: number; h: number; id: string };

/**
 * Screen (CSS px) centre of an arrival-card action. `_finishButtonBounds` are canvas units
 * (CANVAS_W × CANVAS_H), not CSS px: on desktop the 1280 × 800 canvas is scaled to the window
 * (1.125 at 1440 × 900), so a click at the raw bounds lands ~80 px above the row and falls through
 * to the building inspector (#278: that probe artefact was once read as a dead-click bug). Always
 * map through the canvas rect; on the phone the scale is 1, so the two agree there.
 */
export async function finishKeycapCentre(page: Page, id: string): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return page.evaluate(want => {
    const g = (window as any).canalRecallGame;
    const rect = g.canvas.getBoundingClientRect() as DOMRect;
    const kx = rect.width / (0, eval)('CANVAS_W'), ky = rect.height / (0, eval)('CANVAS_H');
    const b = (g._finishButtonBounds as Array<{ x: number; y: number; w: number; h: number; id: string }> | undefined)?.find(bounds => bounds.id === want);
    return b ? { x: rect.left + (b.x + b.w / 2) * kx, y: rect.top + (b.y + b.h / 2) * ky, w: b.w * kx, h: b.h * ky } : null;
  }, id);
}
