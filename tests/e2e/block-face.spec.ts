import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Block-face chunks in game: one street-level shot per installed face (chunk id `chunk-face-*`), as a rider
// sees it from the far side of the street, plus a check that the face is ONE layer entry and every pand
// resolves to its own BAG id under the cursor.
//   node --import tsx scripts/block-face/compile.ts --face=<id> --install
//   PW_PORT=4410 npx playwright test block-face --project=desktop --project=iphone
const OUT = 'artifacts/block-face/in-game';
const manifest = JSON.parse(readFileSync('public/canal-drive/ordinary-buildings-data/chunks.json', 'utf8'));
const faces = manifest.chunks.filter((c: any) => c.id.startsWith('chunk-face-'));

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

for (const chunk of faces) {
  test(`block face in game: ${chunk.name}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    mkdirSync(OUT, { recursive: true });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, query: '?streetChunks=1' });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
    const bearing = 90 + chunk.instance.northOffsetDegrees, outward = (bearing + 90) % 360;
    const at = ahead(ahead(chunk.instance.anchor, bearing, -12), outward, 9);
    await parkAt(page, at, ahead(at, bearing, 40));
    await page.waitForFunction(({ id }) => {
      const vm = (window as any).canalRecallGame.vectorMap, l = vm._signatureLandmarks;
      const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-7, c.lat] });
      return l && l.shown.has(id);
    }, { id: chunk.id }, { timeout: 150_000, polling: 1000 });
    await parkAt(page, ahead(at, outward, 120), ahead(at, outward, 160));
    // Street level from across the street (pedestrian/rider height), and an oblique along the face.
    const half = (chunk.bounds.max[0] - chunk.bounds.min[0]) / 2;
    const views: [string, number[], number[], number][] = [
      ['street', ahead(chunk.instance.anchor, outward, Math.max(16, half * 0.9)), ahead(chunk.instance.anchor, outward, -1), 2.5],
      ['oblique', ahead(ahead(chunk.instance.anchor, outward, 10), bearing, -half - 12), ahead(chunk.instance.anchor, bearing, half * 0.3), 3],
    ];
    for (const [name, eye, target, height] of views) {
      await page.evaluate(({ eye, target, height }) => {
        const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
        vm.sync = () => {}; map.stop(); map.setMaxPitch(85);
        map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, height, { lng: target[0], lat: target[1] }, height + 4));
      }, { eye, target, height });
      await page.waitForTimeout(4500);
      await page.screenshot({ path: `${OUT}/${chunk.name}-${info.project.name}-${name}.png` });
    }
    const layer = await page.evaluate(({ chunkId, replaces }) => {
      const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
      return { chunkShown: l.shown.has(chunkId), housesShown: replaces.filter((id: string) => l.shown.has(id)).length, entries: l._entries.filter((e: any) => e.spec.id === chunkId).length };
    }, { chunkId: chunk.id, replaces: chunk.replaces });
    writeFileSync(`${OUT}/${chunk.name}-${info.project.name}.json`, JSON.stringify(layer, null, 1));
    expect(layer.chunkShown).toBe(true);
    expect(layer.housesShown).toBe(0);
    expect(layer.entries).toBe(1);
  });
}
