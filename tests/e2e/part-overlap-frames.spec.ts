import { test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { openRoute } from './helpers';

// Review frames, not a regression (feedback fc427560 "there's some texture fighting here", IJdok; lane
// part-overlap-20261110, docs/reports/part-overlap-20261110.md). Parks the rider at each view and shoots the chase
// camera, so before/after frames of interpenetrating OSM building:parts can be compared.
//   PART_FRAMES_OUT=<dir> PART_FRAMES=<views.json> [PART_QUERY='?world=live'] [BUNDLES_DIR=<scratch bundles>] \
//     PW_PORT=4435 bash /tmp/canal-pw.sh npx playwright test part-overlap-frames --project=desktop --workers=1
// views.json: [{ id, player: { x, y, angle }, zoom? }] (a feedback note's context.player and camera.zoom) or [{ id, eye: [lng, lat], target: [lng, lat] }]
const OUT = process.env.PART_FRAMES_OUT || 'artifacts/part-overlap/frames';
type View = { id: string; player?: { x: number; y: number; angle: number }; eye?: [number, number]; target?: [number, number]; zoom?: number };
// PART_DROP_IDS=w1,w2 (with PART_QUERY='?world=live'): leave these features out of the served building tiles, to
// find which feature owns a patch of the frame.
const DROP = new Set((process.env.PART_DROP_IDS || '').split(',').filter(Boolean));
const views: View[] = process.env.PART_FRAMES ? JSON.parse(readFileSync(process.env.PART_FRAMES, 'utf8')) : [];

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

test('part overlap: chase frames', async ({ page }, info) => {
  test.skip(!views.length || info.project.name !== 'desktop', 'set PART_FRAMES=<views.json>');
  test.setTimeout(150_000 + views.length * 40_000);
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript((look) => {
    try {
      const prefs = JSON.parse(localStorage.getItem('canalRecall.preferences.v1') || '{}');
      localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({ ...prefs, buildingLook: look }));
    } catch { /* private window */ }
  }, process.env.PART_LOOK || 'storybook');
  if (DROP.size) await page.route(/\/(building|bag)-tiles\/14\/\d+\/\d+\.geojson\.gz/, async route => {
    const response = await route.fetch();
    const raw = await response.body();
    const text = (raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw).toString('utf8');
    const collection = JSON.parse(text);
    collection.features = collection.features.filter((f: { properties?: { id?: string } }) => !DROP.has(String(f.properties?.id)));
    await route.fulfill({ response, body: zlib.gzipSync(JSON.stringify(collection)) });
  });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, query: process.env.PART_QUERY || '' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  for (const v of views) {
    const at = await park(page, v);
    console.log(`${v.id}: player at ${at.lng.toFixed(6)}, ${at.lat.toFixed(6)}; look ${await page.evaluate(() => (window as any).canalRecallGame.vectorMap.buildingLook?.())}`);
    await page.waitForTimeout(12000);
    await page.screenshot({ path: `${OUT}/${v.id}.png` });
  }
});
