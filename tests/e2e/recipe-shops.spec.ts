import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Close in-game views of named recipe houses (shop signs, doors, dark joinery colours) at street distance.
//   PW_PORT=4411 SHOP_HOUSES=080336,092395,157154 npx playwright test recipe-shops --project=desktop
const OUT = process.env.SHOP_OUT ?? 'artifacts/recipe-shops';
const catalogue = JSON.parse(readFileSync('public/canal-drive/ordinary-buildings-data/catalogue.json', 'utf8'));
const all: any[] = catalogue.models.filter((m: any) => m.source === 'building-recipes');
const wanted = (process.env.SHOP_HOUSES ?? '080336,092395,157154').split(',');
const houses = wanted.map(id => all.find(h => h.id === `ordinary-0363100012${id}`)!);

const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number) => {
  const r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320];
};

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

test('shop houses close up in game', async ({ page }, info) => {
  test.setTimeout(400_000);
  mkdirSync(OUT, { recursive: true });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  for (const h of houses) {
    const bearing = 90 + h.instance.northOffsetDegrees, outward = (bearing + 90) % 360;
    const at = ahead(ahead(h.anchor, bearing, -12), outward, 9);
    await parkAt(page, at, ahead(at, bearing, 40));
    await page.waitForFunction(({ id }) => {
      const vm = (window as any).canalRecallGame.vectorMap, l = vm._signatureLandmarks;
      const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-7, c.lat] });
      return l && l.shown.has(id);
    }, { id: h.id }, { timeout: 120_000, polling: 1000 });
    await parkAt(page, ahead(at, outward, 120), ahead(at, outward, 160));
    for (const [name, back, height] of [['near', info.project.name === 'iphone' ? 22 : 12, 3], ['street', 22, 6]] as const) {
      const eye = ahead(h.anchor, outward, back), target = ahead(h.anchor, outward, -1);
      await page.evaluate(({ eye, target, height }) => {
        const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
        vm.sync = () => {}; map.stop(); map.setMaxPitch(85);
        map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, height, { lng: target[0], lat: target[1] }, height));
      }, { eye, target, height });
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${OUT}/in-game-${info.project.name}-${h.id.slice(-6)}-${name}.png` });
    }
  }
  expect(houses.every(Boolean)).toBe(true);
});
