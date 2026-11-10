import { test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Review frames, not a regression (feedback fc427560 at IJdok; lane glass-parts-20261110,
// docs/reports/glass-parts-20261110.md). Parks the rider at each view and shoots the chase camera, so before/after
// frames of OSM glass/mirror parts can be compared, on desktop and on the iPhone project.
//   GLASS_FRAMES_OUT=<dir> GLASS_FRAMES=<views.json> [GLASS_QUERY='?world=live'] [GLASS_LOOK=storybook] \
//     PW_PORT=4895 bash /tmp/canal-pw.sh npx playwright test glass-parts-frames --project=desktop --project=iphone --workers=1
// Shots are named <id>-<project>.png.
// views.json: [{ id, player: { x, y, angle }, zoom? }] (a feedback note's context.player and camera.zoom) or [{ id, eye: [lng, lat], target: [lng, lat] }]
const OUT = process.env.GLASS_FRAMES_OUT || 'artifacts/glass-parts/frames';
type View = { id: string; player?: { x: number; y: number; angle: number }; eye?: [number, number]; target?: [number, number]; zoom?: number };
const views: View[] = process.env.GLASS_FRAMES ? JSON.parse(readFileSync(process.env.GLASS_FRAMES, 'utf8')) : [];

async function park(page: Page, v: View) {
  return page.evaluate((v) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * 3;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * 3 });
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.handleInput = () => {};
    if (v.player) { g.player.x = v.player.x; g.player.y = v.player.y; g.player.angle = v.player.angle; }
    else { const a = toWorld(v.eye!), b = toWorld(v.target!); g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x); }
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
    if (v.zoom) g.camera.zoom = v.zoom;
    const lng = L._lastCenterLng + (g.player.x - L._lastOffsetX) / k, lat = L._lastCenterLat - (g.player.y - L._lastOffsetY) / (111320 * 3);
    return { lng, lat };
  }, v);
}

test('glass parts: chase frames', async ({ page }, info) => {
  test.skip(!views.length, 'set GLASS_FRAMES=<views.json>');
  test.setTimeout(150_000 + views.length * 40_000);
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript((look) => {
    try {
      const prefs = JSON.parse(localStorage.getItem('canalRecall.preferences.v1') || '{}');
      localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({ ...prefs, buildingLook: look }));
    } catch { /* private window */ }
  }, process.env.GLASS_LOOK || 'storybook');
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, query: process.env.GLASS_QUERY || '' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  for (const v of views) {
    const at = await park(page, v);
    console.log(`${v.id}: player at ${at.lng.toFixed(6)}, ${at.lat.toFixed(6)}; look ${await page.evaluate(() => (window as any).canalRecallGame.vectorMap.buildingLook?.())}`);
    await page.waitForTimeout(12000);
    await page.screenshot({ path: `${OUT}/${v.id}-${info.project.name}.png` });
  }
});
