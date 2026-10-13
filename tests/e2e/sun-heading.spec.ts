/**
 * The sun must not move with the rider (lane-sun-and-mood-20261013, docs/LOOK.md §Light).
 *
 * A ride turning through 360°: the rider stands beside one free-standing
 * building and turns to four headings 90° apart, the chase camera following.
 * The headings sit 45° off the building's axes, so each wall is seen from
 * two headings: once on the left of the screen and once on the right. A
 * light tied to the camera or to the rider lights a wall when it is on one
 * side of the screen and shades it on the other; a world-fixed sun gives the
 * wall the same brightness from both headings, and the walls facing the sun
 * are the bright ones. The bike, seen from behind, must do the opposite: its
 * sunlit side flips from screen-left to screen-right as the rider turns.
 *
 *   PW_PORT=4450 npx playwright test sun-heading --project=desktop
 *   SUN_QUERIES=',?sharedFrame=1,?cityLook=1' picks the frames (default all three);
 *   SUN_OUT=<dir> keeps the shots and sun-heading.json;
 *   LOOK_BUNDLES_DIR=<dir> serves freshly built *.bundle.js (as look-consistency).
 */
import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { openRoute } from './helpers';
import { DEFAULT_LIGHT_RIG } from '../../src/canalRecall/rendererShared/lightRig';

const OUT = process.env.SUN_OUT || 'artifacts/sun-heading';
const QUERIES = (process.env.SUN_QUERIES ?? ',?sharedFrame=1,?cityLook=1').split(',').map(s => s.trim());
/** Relative luma difference a world-fixed wall may show between its two headings (texture sampling, parallax). */
const SAME_WALL_TOLERANCE = 0.1;

// Free-standing buildings with plain walls: a Nieuw-West slab and a park pavilion-sized block.
const SPOTS = [
  { name: 'nieuw-west-slab', centre: [4.8105, 52.3602] as [number, number] },
];

type Face = { i: number; azimuthDeg: number; mid: [number, number]; lenM: number; heightM: number; ex: number; ey: number };
type Sample = { heading: number; face: number; azimuthDeg: number; luma: number; n: number; screenX: number };

async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
  }, p);
}

/** Streamed buildings and landmarks idle for five polls. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => { (window as any).__sunIdle = 0; });
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks;
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const w = window as any, key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}`;
    w.__sunIdle = idle && landmarksIdle && key === w.__sunKey ? (w.__sunIdle || 0) + 1 : 0;
    w.__sunKey = key;
    return w.__sunIdle >= 5;
  }, null, { timeout: 180_000, polling: 1000 });
}

/** The most free-standing plain building near `centre`: few corners, tall, nothing within 12 m. */
async function pickBuilding(page: Page, centre: [number, number]): Promise<{ faces: Face[]; centre: [number, number]; id: string; heightM: number; axisDeg: number }> {
  return page.evaluate(({ centre }) => {
    const t = (window as any).canalRecallGame.vectorMap._threeBuildings;
    const features: any[] = t.lastFeatures;
    const kx = 111320 * Math.cos(centre[1] * Math.PI / 180), ky = 111320;
    const local = ([lng, lat]: number[]) => [(lng - centre[0]) * kx, (lat - centre[1]) * ky];
    const rings = features.map(f => {
      const g = f.geometry, ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' && g.coordinates.length === 1 ? g.coordinates[0][0] : null;
      return ring ? { f, pts: ring.map(local) } : null;
    }).filter(Boolean) as { f: any; pts: number[][] }[];
    const bbox = (pts: number[][]) => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
    const boxes = rings.map(r => bbox(r.pts));
    let best: any = null;
    rings.forEach((r, i) => {
      const p = r.f.properties, h = Number(p.height) || 0, b = boxes[i];
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      if (Math.hypot(cx, cy) > 400 || h < 6 || r.pts.length > 16 || (Number(p.minHeight) || 0) > 0) return;
      const w = b[2] - b[0], d = b[3] - b[1];
      if (Math.min(w, d) < 10) return;
      const clear = boxes.every((o, j) => j === i || o[0] > b[2] + 12 || o[2] < b[0] - 12 || o[1] > b[3] + 12 || o[3] < b[1] - 12);
      if (!clear) return;
      const score = Math.min(h, 20) * Math.min(w, d) / r.pts.length - Math.hypot(cx, cy) * 0.2;
      if (!best || score > best.score) best = { score, i, h };
    });
    if (!best) {
      const near = rings.map((r, i) => { const b = boxes[i]; return { id: r.f.properties.id, d: Math.round(Math.hypot((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)), h: r.f.properties.height, n: r.pts.length, w: Math.round(b[2] - b[0]), dd: Math.round(b[3] - b[1]), clear: boxes.every((o, j) => j === i || o[0] > b[2] + 12 || o[2] < b[0] - 12 || o[1] > b[3] + 12 || o[3] < b[1] - 12) }; }).sort((a, b) => a.d - b.d).slice(0, 15);
      throw new Error(`no free-standing building near the spot ${JSON.stringify(near)}`);
    }
    const r = rings[best.i];
    let pts = r.pts.slice();
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    let area2 = 0;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) area2 += pts[b][0] * pts[a][1] - pts[a][0] * pts[b][1];
    if (area2 < 0) pts = pts.reverse();
    const faces: any[] = [];
    let longest = 0, axisDeg = 0;
    for (let a = 0; a < pts.length; a++) {
      const [x0, y0] = pts[a], [x1, y1] = pts[(a + 1) % pts.length];
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      // Long, plain walls only: a wall beside a jog is partly hidden by its neighbour from one side.
      if (len < 12) continue;
      const nx = dy / len, ny = -dx / len; // outward for a CCW ring
      faces.push({ i: faces.length, azimuthDeg: ((Math.atan2(nx, ny) * 180 / Math.PI) + 360) % 360, mid: [centre[0] + (x0 + x1) / 2 / kx, centre[1] + (y0 + y1) / 2 / ky], lenM: len, heightM: best.h, ex: dx / len, ey: dy / len });
      if (len > longest) { longest = len; axisDeg = ((Math.atan2(dx, dy) * 180 / Math.PI) + 360) % 360; }
    }
    const b = boxes[best.i];
    const c: [number, number] = [centre[0] + (b[0] + b[2]) / 2 / kx, centre[1] + (b[1] + b[3]) / 2 / ky];
    return { faces, centre: c, id: String(r.f.properties.id), heightM: best.h, axisDeg };
  }, { centre });
}

/** Screen points of a grid over each face (25–75 % along, 30–70 % up), from MapLibre's matrix. */
async function facePoints(page: Page, faces: Face[]): Promise<{ face: number; pts: [number, number][]; facing: number }[]> {
  return page.evaluate(({ faces }) => {
    const w = window as any, map = w.canalRecallGame.vectorMap.map, M: number[] = w.__sunProbeMatrix;
    const canvas = map.getCanvas() as HTMLCanvasElement, rect = canvas.getBoundingClientRect();
    const ml = w.maplibregl;
    const project = (lng: number, lat: number, z: number): [number, number, number] | null => {
      const m = ml.MercatorCoordinate.fromLngLat([lng, lat], z);
      const x = m.x, y = m.y, zz = m.z;
      const cx = M[0] * x + M[4] * y + M[8] * zz + M[12], cy = M[1] * x + M[5] * y + M[9] * zz + M[13];
      const cw = M[3] * x + M[7] * y + M[11] * zz + M[15];
      if (cw <= 0) return null;
      return [(cx / cw + 1) / 2 * rect.width, (1 - cy / cw) / 2 * rect.height, cw];
    };
    const kx = 111320 * Math.cos(faces[0]?.mid[1] * Math.PI / 180), ky = 111320;
    return faces.map(f => {
      // The face's middle: 35–65 % along, 25–75 % up, 0.3 m proud of the wall; a screen quad.
      const pts: [number, number][] = [];
      const nx = f.ey, ny = -f.ex;
      for (const [u, v] of [[-0.15, 0.25], [0.15, 0.25], [0.15, 0.75], [-0.15, 0.75]]) {
        const lng = f.mid[0] + (f.ex * u * f.lenM + nx * 0.3) / kx, lat = f.mid[1] + (f.ey * u * f.lenM + ny * 0.3) / ky;
        const p = project(lng, lat, f.heightM * v);
        if (p) pts.push([p[0], p[1]]);
      }
      // Facing: the projected face winds one way when seen from outside.
      const a = project(f.mid[0] - f.ex * f.lenM * 0.5 / kx, f.mid[1] - f.ey * f.lenM * 0.5 / ky, f.heightM * 0.5);
      const b = project(f.mid[0] + f.ex * f.lenM * 0.5 / kx, f.mid[1] + f.ey * f.lenM * 0.5 / ky, f.heightM * 0.5);
      const top = project(f.mid[0], f.mid[1], f.heightM * 0.9);
      let facing = 0;
      if (a && b && top) {
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        // Seen from outside, the wall's direction of travel (+e) runs to the right on screen (y down).
        facing = -((b[0] - a[0]) * (top[1] - my) - (b[1] - a[1]) * (top[0] - mx)) / (Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(top[0] - mx, top[1] - my) + 1e-9);
      }
      return { face: f.i, pts, facing };
    });
  }, { faces });
}

const lumaOf = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

type Grab = { data: Buffer; width: number; height: number; ox: number; oy: number };
async function grab(page: Page): Promise<Grab> {
  const rect = await page.evaluate(() => { const r = (window as any).canalRecallGame.vectorMap.map.getCanvas().getBoundingClientRect(); return { x: r.x, y: r.y }; });
  const png = await page.screenshot();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, ox: rect.x, oy: rect.y };
}

/** Luma of every pixel inside a screen quad, in `img` and in `empty` (the same frame without buildings). */
function quadPixels(img: Grab, empty: Grab, quad: [number, number][]): number[] {
  if (quad.length !== 4) return [];
  const xs = quad.map(p => p[0]), ys = quad.map(p => p[1]);
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = quad[i], [bx, by] = quad[(i + 1) % 4];
      const c = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
      if (c === 0) continue;
      if (sign === 0) sign = c; else if (c !== sign) return false;
    }
    return true;
  };
  const out: number[] = [];
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(img.height - 1 - img.oy, Math.ceil(Math.max(...ys))); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(img.width - 1 - img.ox, Math.ceil(Math.max(...xs))); x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const k = ((y + img.oy) * img.width + x + img.ox) * 3;
      const a = lumaOf(img.data[k], img.data[k + 1], img.data[k + 2]), e = lumaOf(empty.data[k], empty.data[k + 1], empty.data[k + 2]);
      if (Math.abs(a - e) > 6) out.push(a);
    }
  }
  return out;
}


for (const query of QUERIES) {
  const label = query ? query.replace(/^\?/, '').replace(/[=&]/g, '-') : 'default';
  test(`sun stays put while the rider turns: ${label}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is enough');
    test.setTimeout(600_000);
    const dir = join(OUT, label);
    mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    const bundles = process.env.LOOK_BUNDLES_DIR;
    if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', query, abortHeavyTiles: true });
    const report: any = { query, sun: { azimuthDeg: DEFAULT_LIGHT_RIG.sunAzimuthDeg, elevationDeg: DEFAULT_LIGHT_RIG.sunElevationDeg }, spots: [] };
    for (const spot of SPOTS) {
      await teleport(page, { lng: spot.centre[0], lat: spot.centre[1], bearing: 0 });
      await page.waitForTimeout(2500);
      await teleport(page, { lng: spot.centre[0], lat: spot.centre[1], bearing: 0 });
      await settle(page);
      const building = await pickBuilding(page, spot.centre);
      // Probe layer: MapLibre's clip-from-Mercator matrix of the last frame.
      await page.evaluate(() => {
        const map = (window as any).canalRecallGame.vectorMap.map;
        if (!map.getLayer('sun-heading-probe')) map.addLayer({ id: 'sun-heading-probe', type: 'custom', renderingMode: '3d', render(_gl: any, args: any) { (window as any).__sunProbeMatrix = Array.from(args.defaultProjectionData?.mainMatrix ?? args); } });
        for (const layer of map.getStyle().layers) if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
        const t = (window as any).canalRecallGame.vectorMap._inventoryTrees; if (t?.setEnabled) t.setEnabled(false);
      });
      const samples: Sample[] = [];
      const bike: any[] = [];
      const standM = 26 + building.heightM * 0.4;
      for (let k = 0; k < 4; k++) {
        const heading = (building.axisDeg + 45 + k * 90) % 360;
        // The rider stands short of the building, facing its centre.
        const b = heading * Math.PI / 180, c = building.centre;
        const lng = c[0] - Math.sin(b) * standM / (111320 * Math.cos(c[1] * Math.PI / 180)), lat = c[1] - Math.cos(b) * standM / 111320;
        await teleport(page, { lng, lat, bearing: heading });
        await page.waitForTimeout(3500);
        await settle(page);
        await page.evaluate(() => { for (const e of Array.from(document.body.querySelectorAll('*'))) { const c = (window as any).canalRecallGame.vectorMap.map.getCanvas(); if (e !== c && !e.contains(c)) (e as HTMLElement).style.visibility = 'hidden'; } });
        await page.waitForTimeout(800);
        const img = await grab(page);
        await page.screenshot({ path: join(dir, `${spot.name}-h${Math.round(heading)}.png`) });
        const faces = await facePoints(page, building.faces);
        // Keep only points the building layer covers: grab once more with it hidden.
        await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; vm._threeBuildings.setVisible(false); vm.map.triggerRepaint(); });
        await page.waitForTimeout(500);
        const empty = await grab(page);
        await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; vm._threeBuildings.setVisible(true); vm.map.triggerRepaint(); });
        for (const f of faces) {
          if (f.facing < 0.25) continue;
          const lumas = quadPixels(img, empty, f.pts);
          if (lumas.length < 150) continue;
          const mx = f.pts.reduce((s, p) => s + p[0], 0) / f.pts.length;
          samples.push({ heading, face: f.face, azimuthDeg: building.faces[f.face].azimuthDeg, luma: lumas.reduce((a, b) => a + b, 0) / lumas.length, n: lumas.length, screenX: mx });
        }
        // The bike: pixels that change when its model is hidden.
        const hidden = await page.evaluate(() => { const b = (window as any).canalRecallGame.vectorMap._playerBike; if (!b?._modelRoot || !b.lngLat) return null; const at = b.map.project(b.lngLat); b._modelRoot.visible = false; b.map.triggerRepaint(); return [at.x, at.y]; });
        if (hidden) {
          await page.waitForTimeout(400);
          const bare = await grab(page);
          await page.evaluate(() => { const b = (window as any).canalRecallGame.vectorMap._playerBike; b._modelRoot.visible = true; b.map.triggerRepaint(); });
          let minX = Infinity, maxX = -Infinity;
          const px: [number, number, number][] = [];
          for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
            const k = (y * img.width + x) * 3;
            const d = Math.abs(img.data[k] - bare.data[k]) + Math.abs(img.data[k + 1] - bare.data[k + 1]) + Math.abs(img.data[k + 2] - bare.data[k + 2]);
            if (d > 24 && Math.abs(x - img.ox - hidden[0]) < 90 && Math.abs(y - img.oy - hidden[1]) < 120) { px.push([x, y, lumaOf(img.data[k], img.data[k + 1], img.data[k + 2])]); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
          }
          const mid = (minX + maxX) / 2;
          const left = px.filter(p => p[0] < mid), right = px.filter(p => p[0] >= mid);
          const mean = (a: typeof px) => a.length ? a.reduce((s, p) => s + p[2], 0) / a.length : NaN;
          const sunAzimuthDeg = await page.evaluate(() => {
            const b = (window as any).canalRecallGame.vectorMap._playerBike, sun = b._scene?.children.find((c: any) => c.isDirectionalLight);
            if (!sun || !b.lngLat) return null; // shared frame: the rig's sun, not the bike's
            const m = b._transform().elements, p = sun.position;
            const x = m[0] * p.x + m[4] * p.y + m[8] * p.z, y = -(m[1] * p.x + m[5] * p.y + m[9] * p.z);
            return Math.round(((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360);
          });
          bike.push({ heading, pixels: px.length, luma: mean(px), left: mean(left), right: mean(right), sunAzimuthDeg });
        }
      }
      // Pair each wall's two views.
      const walls = new Map<number, Sample[]>();
      for (const s of samples) { const l = walls.get(s.face) ?? []; l.push(s); walls.set(s.face, l); }
      const pairs = [...walls.values()].filter(l => l.length >= 2).map(l => {
        const lumas = l.map(s => s.luma), mean = lumas.reduce((a, b) => a + b, 0) / lumas.length;
        return { face: l[0].face, azimuthDeg: Math.round(l[0].azimuthDeg), views: l.map(s => ({ heading: Math.round(s.heading), luma: +s.luma.toFixed(1), n: s.n, screenX: Math.round(s.screenX) })), spread: +((Math.max(...lumas) - Math.min(...lumas)) / mean).toFixed(3), mean: +mean.toFixed(1) };
      });
      report.spots.push({ spot: spot.name, building: { id: building.id, heightM: building.heightM, axisDeg: Math.round(building.axisDeg) }, walls: pairs, bike });
    }
    // Legacy landmarks: each model carries its own lights in model space. Where does each one's sun point in the world?
    await teleport(page, { lng: 4.8926, lat: 52.3725, bearing: 0 });
    await page.waitForTimeout(2500);
    await teleport(page, { lng: 4.8926, lat: 52.3725, bearing: 0 });
    await settle(page);
    report.landmarkSuns = await page.evaluate(() => {
      const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
      return (l?._entries ?? []).filter((e: any) => e.scene).map((e: any) => {
        const suns = e.scene.children.filter((c: any) => c.isDirectionalLight).sort((a: any, b: any) => b.intensity - a.intensity);
        if (!suns.length) return null;
        const m = e.transform.elements, p = suns[0].position;
        const x = m[0] * p.x + m[4] * p.y + m[8] * p.z, y = -(m[1] * p.x + m[5] * p.y + m[9] * p.z), z = m[2] * p.x + m[6] * p.y + m[10] * p.z;
        const len = Math.hypot(x, y, z);
        return { id: e.spec.id, azimuthDeg: Math.round(((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360), elevationDeg: Math.round(Math.asin(z / len) * 180 / Math.PI) };
      }).filter(Boolean);
    });
    writeFileSync(join(dir, 'sun-heading.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify(report, null, 1));
    const sunAz = DEFAULT_LIGHT_RIG.sunAzimuthDeg, off = (a: number) => Math.abs(((a - sunAz + 540) % 360) - 180);
    for (const l of report.landmarkSuns) {
      expect(off(l.azimuthDeg), `landmark ${l.id}: sun azimuth ${l.azimuthDeg}°`).toBeLessThanOrEqual(1);
      expect(Math.abs(l.elevationDeg - DEFAULT_LIGHT_RIG.sunElevationDeg), `landmark ${l.id}: sun elevation ${l.elevationDeg}°`).toBeLessThanOrEqual(1);
    }
    for (const s of report.spots) {
      expect(s.walls.length, `${s.spot}: walls seen from two headings`).toBeGreaterThanOrEqual(2);
      for (const w of s.walls) expect(w.spread, `${s.spot} wall facing ${w.azimuthDeg}°: same wall, two headings`).toBeLessThanOrEqual(SAME_WALL_TOLERANCE);
      // The wall facing closest to the sun is the brightest one.
      const toSun = [...s.walls].sort((a: any, b: any) => off(a.azimuthDeg) - off(b.azimuthDeg))[0];
      const awaySun = [...s.walls].sort((a: any, b: any) => off(b.azimuthDeg) - off(a.azimuthDeg))[0];
      expect(toSun.mean, `${s.spot}: sun-facing wall (${toSun.azimuthDeg}°) brighter than the wall facing away (${awaySun.azimuthDeg}°)`).toBeGreaterThan(awaySun.mean);
      // The bike's sunlit side follows the world: opposite headings light opposite sides.
      // Seen from behind with the sun to the right, the bike's right half is the lit one. Use the
      // two opposite headings with the sun most to the side (the others light it from ahead or behind).
      if (s.bike.length === 4) {
        const lateral = (b: any) => Math.sin((sunAz - b.heading) * Math.PI / 180);
        const pair = Math.abs(lateral(s.bike[0])) > Math.abs(lateral(s.bike[1])) ? [s.bike[0], s.bike[2]] : [s.bike[1], s.bike[3]];
        for (const b of pair) expect(Math.sign(b.right - b.left), `${s.spot}: bike at heading ${Math.round(b.heading)}, sun ${lateral(b) > 0 ? 'right' : 'left'}: lit half`).toBe(Math.sign(lateral(b)));
      }
    }
  });
}
