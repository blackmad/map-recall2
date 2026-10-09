import { test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { openRoute } from './helpers';

// In-game review shots along Haparandaweg (Houthavens). Opt-in, writes screenshots only:
//   node --import tsx scripts/haparandaweg/spots.ts
//   HAP_SHOTS=1 PW_PORT=4421 npx playwright test haparandaweg-street --project=desktop --project=iphone
// HAP_ONLY=name1,name2 limits the spots. The held models must be un-held locally for the buildings to appear.
test.skip(!process.env.HAP_SHOTS, 'set HAP_SHOTS=1 to capture');

const OUT = process.env.HAP_DIR || 'artifacts/haparandaweg/ingame';
const SPOTS: { name: string; at: [number, number]; face: [number, number] }[] = JSON.parse(readFileSync('artifacts/haparandaweg/spots.json', 'utf8'));

test('haparandaweg in-game shots', async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  mkdirSync(OUT, { recursive: true });
  const only = process.env.HAP_ONLY?.split(',');
  for (const spot of SPOTS.filter(s => !only || only.some(o => s.name.includes(o)))) {
    const park = () => page.evaluate(({ at, face }) => {
      const g = (window as any).canalRecallGame, L = g.osmLoader;
      const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
      const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
      const a = toWorld(at), b = toWorld(face);
      g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
      g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
      g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
      g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
      g.vectorMap.setTreesVisible(true);
    }, { at: spot.at, face: spot.face });
    await park();
    await page.waitForTimeout(5000);
    await park();
    await page.waitForFunction(() => { const b = (window as any).canalRecallGame.vectorMap._threeBuildings; return !b || (b.ready && !b.pending.length && !b.inflight.size); }, null, { timeout: 15_000 }).catch(() => {});
    // Free camera: stop the game steering the map, then look at the target from the parked side.
    await page.evaluate(({ at, face, street }) => {
      const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
      vm.sync = () => {}; map.stop();
      const bearing = (Math.atan2((face[0] - at[0]) * Math.cos(face[1] * Math.PI / 180), face[1] - at[1]) * 180) / Math.PI;
      const dist = Math.hypot((face[0] - at[0]) * 111320 * Math.cos(face[1] * Math.PI / 180), (face[1] - at[1]) * 111320);
      if (street) { map.jumpTo({ center: at, zoom: 18.6, pitch: 74, bearing }); } else map.jumpTo({ center: face, zoom: dist > 30 ? 18.4 : 18.8, pitch: 66, bearing });
    }, { at: spot.at, face: spot.face, street: spot.name.startsWith('street') });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/${spot.name}-${testInfo.project.name}.png` });
  }
});
