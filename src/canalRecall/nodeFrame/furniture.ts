/**
 * Street furniture in the node frame, as the ride draws it (public/canal-drive/js/street-furniture-source.js, lane #170):
 * the z15 extract tiles (public/data/extracts/amsterdam/street-furniture/), each record expanded by placement.ts
 * (alignContainerRows, instancesOf), one ride model per kind (streetFurniture/models.ts rideModel). Per instance:
 *
 *   world  = T(lng/lat, surfaceBase + RIDE_BASE_LIFT_M) . Rz(yaw) . S(scale)
 *   colour = the model's vertex colour; magenta SLOT faces take the instance colour (fraction lid, poster)
 *   shade  = MeshStandardMaterial roughness 0.82, flat shading (smooth where the model carries normals), receives the
 *            sun's shadow, casts none
 *
 * Drawn within RADIUS_M of the rider (the camera subject), as the adapter's riderViewBox does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { RIDE_BASE_LIFT_M, isSlot, linearOf, rideModel, type FurnitureMesh, type FurnitureModelId } from '../streetFurniture/models.ts';
import { alignContainerRows, instancesOf, type FurnitureInstance } from '../streetFurniture/placement.ts';
import type { FurnitureRecord } from '../streetFurniture/extract.ts';
import { surfaceMaterial, type SurfaceEnv } from './surfaceMaterial.ts';
import type { WorldDraw } from './worldRaster.ts';

/** street-furniture-source.js RADIUS_M: furniture draws within this many metres of the rider. */
export const FURNITURE_RADIUS_M = 220;

const TILE_CACHE = new Map<string, FurnitureInstance[]>();
const MODEL_CACHE = new Map<FurnitureModelId, FurnitureMesh>();

/** The z15 tile x/y of a point (street-furniture-source.js `tile`). */
const tileXY = (lng: number, lat: number): [number, number] => [Math.floor((lng + 180) / 360 * 32768), Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 32768)];

/** Every instance in the extract tiles that touch the box round `at` (lng/lat) of `radiusM`. */
export function furnitureInstances(root: string, at: [number, number], radiusM = FURNITURE_RADIUS_M): FurnitureInstance[] {
  const dir = path.join(root, 'public/data/extracts/amsterdam/street-furniture');
  const indexFile = path.join(dir, 'index.json');
  if (!fs.existsSync(indexFile)) return [];
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8')) as { version: number; zoom: number; tiles: { key: string; url: string }[] };
  if (index.version !== 1 || index.zoom !== 15) return [];
  const meta = new Map(index.tiles.map(t => [t.key, t]));
  const dLat = radiusM / 110_540, dLng = radiusM / (111_320 * Math.cos(at[1] * Math.PI / 180));
  const [x0, y1] = tileXY(at[0] - dLng, at[1] - dLat), [x1, y0] = tileXY(at[0] + dLng, at[1] + dLat);
  const out: FurnitureInstance[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const key = `15/${x}/${y}`, m = meta.get(key);
    if (!m) continue;
    let list = TILE_CACHE.get(key);
    if (!list) {
      const bytes = fs.readFileSync(path.join(dir, m.url));
      const data = JSON.parse((bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString('utf8')) as { version: number; key: string; items: FurnitureRecord[] };
      list = [];
      if (data.version === 1 && data.key === key) for (const r of alignContainerRows(data.items)) for (const i of instancesOf(r)) list.push(i);
      TILE_CACHE.set(key, list);
    }
    out.push(...list);
  }
  return out;
}

/**
 * The world draws for the furniture near the rider: one draw per kind (all its instances baked into one buffer, as
 * the ride's InstancedMesh). `toWorld(lng, lat)` gives world x/y (metres east/north), `base(lng, lat)` the surface
 * base (gameGround surfaceBase) or undefined off the relief, `want(wx, wy)` the view test.
 */
export function furnitureDraws(instances: readonly FurnitureInstance[], env: SurfaceEnv, rider: [number, number],
  toWorld: (lng: number, lat: number) => [number, number], base: (lng: number, lat: number) => number | undefined,
  want: (wx: number, wy: number) => boolean, radiusM = FURNITURE_RADIUS_M): { draws: WorldDraw[]; count: number } {
  const [rx, ry] = toWorld(rider[0], rider[1]);
  const groups = new Map<FurnitureModelId, { inst: FurnitureInstance; x: number; y: number }[]>();
  for (const inst of instances) {
    const [x, y] = toWorld(inst.lng, inst.lat);
    if (Math.hypot(x - rx, y - ry) > radiusM || !want(x, y)) continue;
    (groups.get(inst.model) ?? groups.set(inst.model, []).get(inst.model)!).push({ inst, x, y });
  }
  const draws: WorldDraw[] = [];
  let count = 0;
  for (const [id, items] of groups) {
    let m = MODEL_CACHE.get(id);
    if (!m) MODEL_CACHE.set(id, m = rideModel(id));
    const nv = m.positions.length / 3;
    const pos = new Float32Array(items.length * nv * 3), col = new Float32Array(items.length * nv * 3);
    const nrm = m.normals ? new Float32Array(items.length * nv * 3) : null;
    items.forEach(({ inst, x, y }, k) => {
      const z0 = (base(inst.lng, inst.lat) ?? 0) + RIDE_BASE_LIFT_M;
      const c = Math.cos(inst.yaw), s = Math.sin(inst.yaw), sc = inst.scale;
      const slot = inst.slotHex ? linearOf(inst.slotHex) : [1, 1, 1];
      for (let v = 0; v < nv; v++) {
        const lx = m!.positions[v * 3] * sc, ly = m!.positions[v * 3 + 1] * sc, lz = m!.positions[v * 3 + 2] * sc, o = (k * nv + v) * 3;
        pos[o] = x + c * lx - s * ly; pos[o + 1] = y + s * lx + c * ly; pos[o + 2] = z0 + lz;
        const r = m!.colours[v * 3], g = m!.colours[v * 3 + 1], b = m!.colours[v * 3 + 2];
        // The instance colour on the magenta slot faces (setColorAt: white when the instance has none).
        if (isSlot(r, g, b)) { col[o] = slot[0]; col[o + 1] = slot[1]; col[o + 2] = slot[2]; } else { col[o] = r; col[o + 1] = g; col[o + 2] = b; }
        if (nrm && m!.normals) {
          const a = m!.normals[v * 3], bb = m!.normals[v * 3 + 1];
          nrm[o] = c * a - s * bb; nrm[o + 1] = s * a + c * bb; nrm[o + 2] = m!.normals[v * 3 + 2];
        }
      }
    });
    // Non-indexed triangles (models.ts), double-sided like the ride's thin parts are not: three's default FrontSide.
    const indices = new Uint32Array(items.length * nv);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
    draws.push({ positions: pos, indices, cull: 'back', name: `furniture/${id}`,
      material: surfaceMaterial({ kind: 'standard', color: [1, 1, 1], roughness: 0.82, metalness: 0 }, { colors: col, colorSize: 3, normals: nrm }, env, pos) });
    count += items.length;
  }
  return { draws, count };
}
