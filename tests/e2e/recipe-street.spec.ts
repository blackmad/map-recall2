import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Recipe-pipeline street (Bilderdijkstraat): park the rider in front of the installed houses and
// screenshot the street at play zoom, plus the runtime facts that matter:
// shared GLBs fetched once, every house shown, exact BAG-host suppression, no grey host boxes left.
//   PW_PORT=4403 npx playwright test recipe-street --project=desktop --project=iphone
const OUT = 'artifacts/recipe-street';
const catalogue = JSON.parse(readFileSync('public/canal-drive/ordinary-buildings-data/catalogue.json', 'utf8'));
const houses: any[] = catalogue.models.filter((m: any) => m.source === 'building-recipes');

async function parkAt(page: Page, at: number[], face: number[]) {
  await page.evaluate(({ at, face }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at), b = toWorld(face);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
  }, { at, face });
}

const metresToDegrees = (lat: number) => ({ lat: 1 / 111320, lng: 1 / (111320 * Math.cos(lat * Math.PI / 180)) });
const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number) => {
  const d = metresToDegrees(lat), r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres * d.lng, lat + Math.cos(r) * metres * d.lat];
};

test('recipe street: installed Bilderdijkstraat houses render in the game from the rider position', async ({ page }, info) => {
  test.setTimeout(300_000);
  expect(houses.length).toBeGreaterThan(10);
  const glbRequests: string[] = [];
  page.on('request', r => { if (/recipe-bilder-[0-9]+\.glb/.test(r.url())) glbRequests.push(r.url().split('?')[0].split('/').pop()!); });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  // Street direction = frontage direction of the first house; the rider starts at one end, 9 m out on the street side, looking along it.
  const along = (h: any) => 90 + h.instance.northOffsetDegrees;
  const bearing = along(houses[0]);
  const sorted = [...houses].sort((a, b) => {
    const dir = [Math.sin(bearing * Math.PI / 180), Math.cos(bearing * Math.PI / 180)];
    return (a.anchor[0] * dir[0] + a.anchor[1] * dir[1]) - (b.anchor[0] * dir[0] + b.anchor[1] * dir[1]);
  });
  const first = sorted[0], outward = (bearing + 90) % 360;
  const at = ahead(ahead(first.anchor, bearing, -12), outward, 9);
  const face = ahead(at, bearing, 40);
  await parkAt(page, at, face);
  mkdirSync(OUT, { recursive: true });
  // Let tiles, facts and the shared GLBs stream in; jiggle the map so the loader requests what is now in view.
  await page.waitForFunction(({ need }) => {
    const vm = (window as any).canalRecallGame.vectorMap, l = vm._signatureLandmarks;
    const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-7, c.lat] });
    return l && need.filter((id: string) => l.shown.has(id)).length >= Math.min(8, need.length);
  }, { need: houses.map(h => h.id) }, { timeout: 120_000, polling: 1000 });
  await parkAt(page, at, face);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/in-game-${info.project.name}-start.png` });
  // Ride a short way along the street so the whole row passes through the view.
  const stats = async () => page.evaluate((ids: string[]) => {
    const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
    return { shown: ids.filter(id => l.shown.has(id)).length, failed: ids.filter(id => l._failed.has(id)).length, sharedAssets: l._sharedAssets.size, entries: l._entries.length,
      suppressed: l.shownSuppressOsmIds().filter((id: string) => ids.includes(`ordinary-${id.split('.').pop()}`)).length,
      mirrored: l._entries.filter((e: any) => e.placement.mirror).length };
  }, houses.map(h => h.id));
  const mid = sorted[Math.floor(sorted.length / 2)];
  for (const [i, spot] of [mid, sorted.at(-1)!].entries()) {
    const atN = ahead(ahead(spot.anchor, bearing, -10), outward, 9);
    await parkAt(page, atN, ahead(atN, bearing, 40));
    await page.waitForFunction(() => { const vm = (window as any).canalRecallGame.vectorMap; const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-7, c.lat] }); return true; });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/in-game-${info.project.name}-${i === 0 ? 'mid' : 'far'}.png` });
  }
  // Free-camera close views of the row from the street side (the game camera would follow the rider).
  const centre = ahead(sorted[Math.floor(sorted.length / 2)].anchor, outward, 6);
  for (const [name, zoom, pitch] of [['row-street', 19.3, 64], ['row-high', 18.5, 50]] as const) {
    await page.evaluate(({ centre, bearing, zoom, pitch }) => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
      vm.sync = () => {}; map.stop();
      map.jumpTo({ center: centre, zoom, pitch, bearing });
    }, { centre, bearing, zoom, pitch });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/in-game-${info.project.name}-${name}.png` });
    if (name === 'row-street') {
      // Same camera with the ordinary-model layer off: the grey/textured host buildings the models replace.
      await page.evaluate(() => (window as any).canalRecallGame.vectorMap._signatureLandmarks.setEnabled(false));
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${OUT}/in-game-${info.project.name}-${name}-models-off.png` });
      await page.evaluate(() => (window as any).canalRecallGame.vectorMap._signatureLandmarks.setEnabled(true));
      await page.waitForTimeout(3000);
    }
  }
  const result = { ...(await stats()), houses: houses.length, uniqueMeshes: new Set(houses.map(h => h.modelUrl)).size, glbRequests: glbRequests.length, distinctGlbRequests: new Set(glbRequests).size, project: info.project.name };
  console.log('recipe-street', JSON.stringify(result));
  writeFileSync(`${OUT}/in-game-${info.project.name}.json`, JSON.stringify(result, null, 1));
  expect(result.failed).toBe(0);
  expect(result.shown).toBeGreaterThanOrEqual(8);
  // Each shared GLB is fetched once, however many houses use it.
  expect(result.glbRequests).toBe(result.distinctGlbRequests);
});
