import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Named regression (user report 2026-10-10, "what's with the weird specular highlights on our landmark
// buildings?"): Hotel Jakarta showed a soft white blob across its glazed facade and dark roof, and the
// Muziekgebouw (4'33 Grand Café, by the Passenger Terminal) glossy roofs. The legacy landmark layer bakes
// MapLibre's whole view-projection into the camera's projection matrix and leaves the camera at the
// identity, so three.js put the viewer at each model's footprint centre on the ground: every GGX highlight
// was computed for an eye inside the building and smeared across walls and roofs regardless of where the
// player looked from. Landmarks now render diffuse-only (see landmarkShading.ts), like the city around them.
//
// Writes oblique shots per landmark for review and asserts every visible landmark material is diffuse.
//   LANDMARK_SHOTS_OUT=artifacts/landmark-shading/after PW_PORT=4433 npx playwright test landmark-shading
//   LANDMARK_SHOTS=hotel-jakarta,eye-filmmuseum … to pick landmarks; before shots: LANDMARK_SHOTS_QUERY='?landmarkSpecular=1' LANDMARK_SHOTS_ALLOW_SPECULAR=1.
const OUT = process.env.LANDMARK_SHOTS_OUT || 'artifacts/landmark-shading';
const DEFAULT = ['hotel-jakarta', 'muziekgebouw-bimhuis', 'scheepvaarthuis', 'zuiderkerk', 'eye-filmmuseum'];
const ids = process.env.LANDMARK_SHOTS?.split(',').map(s => s.trim()) ?? DEFAULT;
const models = JSON.parse(readFileSync('public/canal-drive/models/signature-landmarks.json', 'utf8')).models as Record<string, any>;

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

for (const id of ids) {
  const spec = models[id];
  test(`landmark shading: ${id}`, async ({ page }, info) => {
    test.skip(!spec, `no signature model ${id}`);
    test.setTimeout(300_000);
    mkdirSync(OUT, { recursive: true });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, query: process.env.LANDMARK_SHOTS_QUERY || '' });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
    const anchor = spec.placement.anchor as number[];
    const facade = spec.placement.facadeBearingDegrees ?? 0;
    const radius = Math.max(spec.extent?.widthMetres ?? 30, spec.extent?.depthMetres ?? 30) / 2;
    const height = spec.extent?.heightMetres ?? 20;
    await parkAt(page, ahead(anchor, facade + 90, radius + 30), anchor);
    await page.waitForFunction(({ id }) => {
      const vm = (window as any).canalRecallGame.vectorMap, l = vm._signatureLandmarks;
      const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-7, c.lat] });
      return l && l.shown.has(id);
    }, { id }, { timeout: 150_000, polling: 1000 });
    // Three obliques round the model: from the facade side, its opposite quarter, and a low street-ish view.
    const views: [string, number, number, number][] = [
      ['front', facade + 90, radius + 45, height + 25],
      ['back', facade - 60, radius + 45, height + 25],
      ['low', facade + 140, radius + 25, 6],
    ];
    for (const [name, bearing, dist, alt] of views) {
      const eye = ahead(anchor, bearing, dist);
      await page.evaluate(({ eye, alt, anchor, targetAlt }) => {
        const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
        vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView(50); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        map.jumpTo(map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, alt, { lng: anchor[0], lat: anchor[1] }, targetAlt));
      }, { eye, alt, anchor, targetAlt: height * 0.4 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${OUT}/${id}-${info.project.name}-${name}.png` });
    }
    const materials = await page.evaluate(({ id }) => {
      const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
      const out: { type: string; name: string; specular: boolean }[] = [];
      for (const entry of l._entries.filter((e: any) => e.spec.id === id)) entry.group.traverse((child: any) => {
        if (!child.isMesh) return;
        for (const m of Array.isArray(child.material) ? child.material : [child.material]) {
          out.push({ type: m.type, name: m.name, specular: m.type === 'MeshStandardMaterial' || m.type === 'MeshPhysicalMaterial' || m.type === 'MeshPhongMaterial' });
        }
      });
      return out;
    }, { id });
    writeFileSync(`${OUT}/${id}-${info.project.name}.json`, JSON.stringify(materials, null, 1));
    expect(materials.length).toBeGreaterThan(0);
    if (process.env.LANDMARK_SHOTS_ALLOW_SPECULAR !== '1') {
      expect(materials.filter(m => m.specular), 'landmark materials must be diffuse-only').toEqual([]);
    }
  });
}
