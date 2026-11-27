import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// The ride's frame cap (engine/frameCap.ts, desktop-perf lane 2026-11-27): the own engine draws at most 60 frames a
// second unless the player turns on "Full frame rate" or the URL says `?fpsCap=0`. Measured on the M4 Pro at dpr 2
// (docs/perf/desktop-power-20261127.md): capped, a 120 Hz ride spends ~19 % less CPU and ~29 % less GPU time a second.
// The live Settings panel patches the store, then the game reads the live settings (game-route.js onLiveChange).
type CapGame = { vectorMap: { host?: { maxFps: number | null } }; _overlay: { store: { patchPrefs(p: object, z: unknown): void } }; _overlayZoom(): unknown; _readLiveSettings(): void };
const hostCap = (page: import('@playwright/test').Page) => page.evaluate(() => { const host = (window.canalRecallGame as unknown as CapGame).vectorMap.host; return host ? host.maxFps : 'no host'; });

test('frame cap: 60 by default, and Full frame rate turns it off live', async ({ page }) => {
  await openRoute(page, { travelMode: 'car' });
  await expect.poll(() => hostCap(page)).toBe(60);
  await page.evaluate(() => { const g = window.canalRecallGame as unknown as CapGame; g._overlay.store.patchPrefs({ fullFrameRate: true }, g._overlayZoom()); g._readLiveSettings(); });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __canalRecallFpsCap?: number }).__canalRecallFpsCap)).toBe(0);
  await expect.poll(() => hostCap(page)).toBe(null);
  await page.evaluate(() => { const g = window.canalRecallGame as unknown as CapGame; g._overlay.store.patchPrefs({ fullFrameRate: false }, g._overlayZoom()); g._readLiveSettings(); });
  await expect.poll(() => hostCap(page)).toBe(60);
  await expect(page.locator('#live-full-frame-rate')).toHaveCount(1);
});

test('frame cap: ?fpsCap=0 runs every frame whatever the setting', async ({ page }) => {
  await openRoute(page, { travelMode: 'car', query: '?fpsCap=0' });
  await expect.poll(() => hostCap(page)).toBe(null);
});
