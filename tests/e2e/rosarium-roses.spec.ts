import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

// Vondelpark Rosarium (OSM a147997044): the hexagonal beds between the paved
// paths carry instanced rose bushes. Asserts the bushes stream in at the
// Rosarium and shoots riding (chase, cockpit) and oblique views:
//   PW_PORT=4435 npx playwright test rosarium-roses --project=desktop --project=iphone
const OUT = process.env.LOOK_DIR || 'artifacts/rosarium-roses';
// On the main Vondelpark path north-east of the Rosarium, facing its centre.
const AT = [4.86410, 52.35794] as const;
const FACE = [4.86350, 52.35760] as const;

async function parkAt(page: Page, view: 'chase' | 'cockpit') {
  await page.evaluate(({ at, face, view }) => {
    const g = (window as any).canalRecallGame;
    const L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: readonly number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at), b = toWorld(face);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = view; g.camera.viewMode = view; g.camera.northUp = false;
    g.vectorMap.setTreesVisible(true);
  }, { at: [...AT], face: [...FACE], view });
}

const roseStats = (page: Page) => page.evaluate(() => {
  const t = (window as any).canalRecallGame.vectorMap._inventoryTrees;
  return t ? { roses: t.debugRoses ?? 0, triangles: t.debugRoseTriangles ?? 0, draws: t.debugDraws, zoom: t.map.getZoom() } : null;
});

test('Rosarium hex beds carry rose bushes', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => { (window as any).__canalRecallTrees3d = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  mkdirSync(OUT, { recursive: true });
  for (const view of ['chase', 'cockpit'] as const) {
    await parkAt(page, view);
    await page.waitForTimeout(6000);
    await parkAt(page, view);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/rosarium-${view}-${testInfo.project.name}.png` });
    console.log(view, testInfo.project.name, JSON.stringify(await roseStats(page)));
  }
  // Oblique free camera over the beds.
  for (const [name, zoom, pitch, bearing] of [['oblique', 18.4, 55, 200], ['overview', 17.6, 35, 200]] as const) {
    await page.evaluate(({ face, zoom, pitch, bearing }) => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
      vm.sync = () => {}; map.stop();
      map.jumpTo({ center: face, zoom, pitch, bearing });
    }, { face: [...FACE], zoom, pitch, bearing });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/rosarium-${name}-${testInfo.project.name}.png` });
    const stats = await roseStats(page);
    console.log(name, testInfo.project.name, JSON.stringify(stats));
    expect(stats?.roses ?? 0).toBeGreaterThan(300);
  }
});
