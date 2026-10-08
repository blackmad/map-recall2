import { resolve } from 'node:path';
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
  viewMode?: 'north' | 'heading' | 'chase' | 'cockpit';
  seedRandom?: boolean;
  abortHeavyTiles?: boolean;
  /** Jump straight into racing after the player spawns. */
  enterRacing?: boolean;
  playerTimeoutMs?: number;
  /** Seed for Math.random, so different values give different routes. */
  seed?: number;
};

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

  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();
  await setHiddenSelect(page, 'travel-mode', travelMode);
  if (viewMode) await setHiddenSelect(page, 'view-mode', viewMode);
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
  await page.route(/unpkg\.com\/maplibre-gl@5(?:\.\d+\.\d+)?\/dist\/maplibre-gl\.js/, route => route.fulfill({ path: resolve(dist, 'maplibre-gl.js'), contentType: 'application/javascript' }));
  await page.route(/unpkg\.com\/maplibre-gl@5(?:\.\d+\.\d+)?\/dist\/maplibre-gl\.css/, route => route.fulfill({ path: resolve(dist, 'maplibre-gl.css'), contentType: 'text/css' }));
  await page.route(/tiles\.openfreemap\.org/, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ version: 8, name: 'offline', sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ece6d6' } }] }),
  }));
}
