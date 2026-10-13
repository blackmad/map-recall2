import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

const OUT = process.env.LOOK_DIR || 'artifacts/felix-view';
const SPOTS = [
  { name: 'felix-wide', at: [4.883664, 52.369997], zoom: 0.62 },
  { name: 'felix-close', at: [4.883664, 52.369997], zoom: 1.1 },
] as const;

async function park(page: Page, at: readonly number[], zoom: number) {
  await page.evaluate(({ at, zoom }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const ppm = (0, eval)('PIXELS_PER_METER') as number;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * ppm;
    const wx = L._lastOffsetX + (at[0] - L._lastCenterLng) * k;
    const wy = L._lastOffsetY - (at[1] - L._lastCenterLat) * 111320 * ppm;
    g.player.x = wx; g.player.y = wy; g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'north';
    const c = g.camera;
    c.detached = true; c.northUp = true; c.rotation = 0; c.viewMode = 'north';
    c.anchorX = wx; c.anchorY = wy; c.x = wx; c.y = wy; c.zoom = zoom;
  }, { at, zoom });
}

test('felix in-game view', async ({ page }) => {
  test.setTimeout(600_000);
  await page.addInitScript(() => { (window as any).__canalRecallFacades = true; (window as any).__canalRecallTrees3d = false; (window as any).__canalRecallBuildings3d = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'north', abortHeavyTiles: true, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap._facadesActive?.() === true, null, { timeout: 120_000 });
  mkdirSync(OUT, { recursive: true });
  for (const spot of SPOTS) {
    await park(page, spot.at, spot.zoom);
    await page.waitForTimeout(7000);
    await park(page, spot.at, spot.zoom);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${spot.name}.png` });
  }
});
