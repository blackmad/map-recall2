import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Block-face chunks in game: per installed face (chunk id `chunk-face-*`) a street-level shot from the opposite
// pavement or quay (across the water on a canal), eye at 1.7 m, pitched up so cornices and gable tops are in
// frame, plus an oblique along the face; and a check that the face is ONE layer entry.
//   node --import tsx scripts/block-face/compile.ts --face=<id> --install
//   PW_PORT=4410 npx playwright test block-face --project=desktop --project=iphone
//   BLOCK_FACES=wallen-oza-41-57,marnix-124-138 PW_PORT=4410 npx playwright test block-face   (a subset)
const OUT = 'artifacts/block-face/in-game';
const manifest = JSON.parse(readFileSync('public/canal-drive/ordinary-buildings-data/chunks.json', 'utf8'));
const only = process.env.BLOCK_FACES?.split(',').map(s => `chunk-face-${s.trim()}`);
const faces = manifest.chunks.filter((c: any) => c.id.startsWith('chunk-face-') && (!only || only.includes(c.id)));
const EYE_M = 1.7;

/**
 * Distance (m) from the face anchor along the outward normal to the first building on the other side
 * (OpenMapTiles `building` polygons; the face's own pands are skipped by starting 4 m out). Canals have no
 * building in the water, so the ray reaches the houses on the far quay. null when nothing is hit within 80 m.
 */
async function oppositeBuildingM(page: Page, anchor: number[], outward: number): Promise<number | null> {
  return page.evaluate(({ anchor, outward }) => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    const kx = 111320 * Math.cos(anchor[1] * Math.PI / 180), ky = 111320;
    const r = outward * Math.PI / 180, dx = Math.sin(r), dy = Math.cos(r);
    let best: number | null = null;
    const hit = (a: number[], b: number[]) => {
      // Ray (from the anchor, local metres) against segment a-b.
      const ax = (a[0] - anchor[0]) * kx, ay = (a[1] - anchor[1]) * ky, bx = (b[0] - anchor[0]) * kx, by = (b[1] - anchor[1]) * ky;
      const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) return;
      const t = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den;
      if (u >= 0 && u <= 1 && t >= 4 && t <= 80 && (best === null || t < best)) best = t;
    };
    for (const f of map.querySourceFeatures('openmaptiles', { sourceLayer: 'building' })) {
      const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) for (const ring of poly) for (let i = 0; i + 1 < ring.length; i++) hit(ring[i], ring[i + 1]);
    }
    return best;
  }, { anchor, outward });
}

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
    // Street level from the opposite pavement/quay: 2 m in front of the first building across the street or canal
    // (at least 8 m out, 22 m when nothing is found), eye at 1.7 m, pitched up until the top of the chunk (gable
    // tops, finials) sits just inside the top of the frame. Plus an oblique along the face.
    const half = (chunk.bounds.max[0] - chunk.bounds.min[0]) / 2, topM = chunk.bounds.max[1];
    const opposite = await oppositeBuildingM(page, chunk.instance.anchor, outward);
    const streetM = Math.max(8, opposite === null ? 22 : opposite - 2);
    // MapLibre draws pitch > 90 (looking up) but the chunk layer does not follow it, so the camera looks level
    // (pitch 90, verticals stay vertical) and acts as a shift lens instead: top padding moves the horizon down to
    // HORIZON of the frame height, and the vertical field of view is chosen so the chunk top (gable tops, finials)
    // sits inside the top edge with TOP_MARGIN_M to spare (measured frames came out ~2 m tighter than this pinhole
    // estimate). The ground and water fill the strip below the horizon.
    const HORIZON = 0.78, TOP_MARGIN_M = 4, viewport = page.viewportSize()!;
    const topDeg = Math.atan2(topM + TOP_MARGIN_M - EYE_M, streetM) * 180 / Math.PI;
    // The chunk top lands at TOP_FRAC of the frame: below the phone's full-width route card, near the top on desktop.
    const TOP_FRAC = viewport.width < 600 ? 0.16 : 0.03;
    const focalPx = (HORIZON - TOP_FRAC) * viewport.height / Math.tan(topDeg * Math.PI / 180);
    const fov = Math.min(110, Math.max(30, 2 * Math.atan(viewport.height / 2 / focalPx) * 180 / Math.PI));
    const padTop = Math.round(2 * (HORIZON - 0.5) * viewport.height);
    const views: [string, number[], number, number[], number, number, number][] = [
      // 1 deg below level: at exactly 90 MapLibre leaves the street and water below the horizon unpainted.
      ['street', ahead(chunk.instance.anchor, outward, streetM), EYE_M, chunk.instance.anchor, EYE_M - streetM * Math.tan(Math.PI / 180), fov, padTop],
      ['oblique', ahead(ahead(chunk.instance.anchor, outward, 10), bearing, -half - 12), 3, ahead(chunk.instance.anchor, bearing, half * 0.3), 1, 36.87, 0],
    ];
    const shots: Record<string, unknown> = { oppositeBuildingM: opposite && +opposite.toFixed(1), streetM: +streetM.toFixed(1), topM, topDeg: +topDeg.toFixed(1) };
    for (const [name, eye, eyeAlt, target, targetAlt, fovDeg, padTop] of views) {
      shots[name] = await page.evaluate(({ eye, eyeAlt, target, targetAlt, fovDeg, padTop }) => {
        const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
        vm.sync = () => {}; map.stop(); map.setMaxPitch(90); map.setVerticalFieldOfView(fovDeg); map.setPadding({ top: padTop, bottom: 0, left: 0, right: 0 });
        const opts = map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, eyeAlt, { lng: target[0], lat: target[1] }, targetAlt);
        map.jumpTo(opts);
        return { fov: +fovDeg.toFixed(1), pitch: +map.getPitch().toFixed(1), bearing: +map.getBearing().toFixed(1), cameraAltM: +map.transform.getCameraAltitude().toFixed(2) };
      }, { eye, eyeAlt, target, targetAlt, fovDeg, padTop });
      await page.waitForTimeout(4500);
      await page.screenshot({ path: `${OUT}/${chunk.name}-${info.project.name}-${name}.png` });
    }
    const layer = await page.evaluate(({ chunkId, replaces }) => {
      const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
      return { chunkShown: l.shown.has(chunkId), housesShown: replaces.filter((id: string) => l.shown.has(id)).length, entries: l._entries.filter((e: any) => e.spec.id === chunkId).length };
    }, { chunkId: chunk.id, replaces: chunk.replaces });
    writeFileSync(`${OUT}/${chunk.name}-${info.project.name}.json`, JSON.stringify({ ...layer, shots }, null, 1));
    expect(layer.chunkShown).toBe(true);
    expect(layer.housesShown).toBe(0);
    expect(layer.entries).toBe(1);
  });
}
