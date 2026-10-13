/**
 * City look highlight (`?cityLook=1`, look/cityLook.ts): the active landmark answers in highlight yellow, and the
 * yellow keeps the shading and the material grain (the default highlight keeps the model's own colour and shading
 * and adds a yellow glow; the first city-look variant drew a flat unshaded yellow, review 2026-10-13).
 *
 * Shots, not a gate: the Westerkerk and the Royal Palace on the Dam, highlighted, under the four flag combinations.
 *   PW_PORT=4446 HIGHLIGHT_OUT=artifacts/citylook-review/highlight-after npx playwright test building-look-highlight --project=desktop
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

type Spot = { name: string; landmarkId: string; centre: [number, number]; standDeg: number; standM: number };
const SPOTS: Spot[] = [
  { name: 'westerkerk', landmarkId: 'extract_landmarks_1692085215', centre: [4.8838960, 52.3744999], standDeg: 140, standM: 72 },
  { name: 'dam-royal-palace', landmarkId: 'extract_landmarks_342809743', centre: [4.891409, 52.373196], standDeg: 345, standM: 105 },
];
const FLAGS = [
  { name: 'default', query: '' },
  { name: 'shared-frame', query: '?sharedFrame=1' },
  { name: 'citylook', query: '?cityLook=1' },
  { name: 'citylook-shared-frame', query: '?cityLook=1&sharedFrame=1' },
];
const OUT = process.env.HIGHLIGHT_OUT ?? 'artifacts/citylook-review/highlight';
const only = process.env.HIGHLIGHT_FLAGS?.split(',').filter(Boolean);

function standpoint(s: Spot): { lng: number; lat: number; bearing: number } {
  const b = s.standDeg * Math.PI / 180;
  const dLat = s.standM * Math.cos(b) / 111320;
  const dLng = s.standM * Math.sin(b) / (111320 * Math.cos(s.centre[1] * Math.PI / 180));
  return { lng: s.centre[0] + dLng, lat: s.centre[1] + dLat, bearing: (s.standDeg + 180) % 360 };
}

async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }): Promise<void> {
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

for (const flags of FLAGS) for (const spot of SPOTS) {
  if (only && !only.includes(flags.name)) continue;
  test(`highlight: ${spot.name} ${flags.name}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'shots: desktop');
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: flags.query, abortHeavyTiles: true });
    const p = standpoint(spot);
    await teleport(page, p);
    await page.waitForTimeout(2500);
    await teleport(page, p);
    await page.waitForTimeout(6000);
    const lit = await page.evaluate((id) => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap;
      const landmark = (g.landmarks || []).find((l: any) => l.id === id) ?? (g._allLandmarks || []).find((l: any) => l.id === id);
      if (!landmark) return { found: false, highlighted: 0 };
      vm.setActiveLandmark(landmark);
      const entries = vm._signatureLandmarks?._entries || [];
      return { found: true, highlighted: entries.filter((e: any) => e.highlighted).length };
    }, spot.landmarkId);
    expect(lit.found, `${spot.landmarkId} in game.landmarks`).toBe(true);
    expect(lit.highlighted, 'a signature model takes the highlight').toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: `${OUT}/${spot.name}-${flags.name}.png` });
  });
}
