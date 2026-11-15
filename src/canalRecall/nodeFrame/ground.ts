/**
 * The own ground in the node frame (lane node-world-frames): the game's GroundStore and groundCell builder on the
 * extract files, the game's own ground materials (OwnGround.makeMaterials on the canvas shims), drawn as the game
 * installs them (gameGround.ts install): per layer, the base material, the water cut of CUT layers by the cell's
 * mask (groundMaterial.ts CUT_GLSL), polygon offsets by rank (OFFSET / RED_OFFSET / RAIL_OFFSET).
 *
 * Cells: the game's ring (wantedCells: every 1 km cell within RADIUS_M of the centre, LOD 0 within NEAR_M), minus
 * the cells wholly behind the camera. A built cell is cached on disk under `cacheDir`, keyed by the cell, its LOD and
 * a hash of the builder's sources and the extract manifests: the first frame near a place builds (~1-4 s a cell),
 * later frames read it back.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { BuiltCell, GroundMask, PackedMesh } from '../ownGround/groundCell.ts';
import type { GroundStore } from '../ownGround/groundStore.ts';
import { srgbToLinear } from './light.ts';
import { surfaceMaterial, type SurfaceEnv, type SurfaceSpec } from './surfaceMaterial.ts';
import { texture2D, type Texture2D } from './texture.ts';
import type { WorldDraw } from './worldRaster.ts';

export const GROUND_RADIUS_M = 1400;
export const GROUND_NEAR_M = 350;
const EXTRACT = 'public/data/extracts/amsterdam';

/** Which mask channel cuts a layer (gameGround.ts CUT): 0 = R (water), 1 = G (water minus decks). */
export const CUT_CHANNEL: Record<string, 0 | 1> = Object.fromEntries([
  ...['land', 'park', 'garden', 'wood', 'square', 'parking', 'lawn', 'bed', 'shrub', 'bark', 'sand', 'parkGravel', 'parkPath', 'pond', 'bare'].map(l => [l, 0 as const]),
  ...['asphalt', 'klinker', 'brick', 'cycle', 'paving', 'gravel', 'kerb', 'paint', 'tram', 'bollard'].map(l => [l, 1 as const]),
]);

/** The cut test of one cell's mask for a channel: true where the layer is discarded (inside the extent, channel < 0.5). */
export function maskCut(mask: GroundMask, channel: 0 | 1, affine: readonly number[] = [1, 0, 0, 0, 1, 0]): (x: number, y: number) => boolean {
  const { x0, y0, res, width, height, texels } = mask, sx = width * res, sy = height * res;
  // `affine` maps the caller's (x, y) to the mask's ground-local metres: lx = a0 x + a1 y + a2, ly = a3 x + a4 y + a5.
  const [a0, a1, a2, a3, a4, a5] = affine;
  return (x, y) => {
    const u = (a0 * x + a1 * y + a2 - x0) / sx, v = (a3 * x + a4 * y + a5 - y0) / sy;
    if (!(u > 0 && v > 0 && u < 1 && v < 1)) return false;
    // LinearFilter, no mips, rows from y0 up (DataTexture, flipY false).
    const fx = u * width - 0.5, fy = v * height - 0.5;
    const xa = Math.max(0, Math.min(width - 1, Math.floor(fx))), ya = Math.max(0, Math.min(height - 1, Math.floor(fy)));
    const xb = Math.min(width - 1, xa + 1), yb = Math.min(height - 1, ya + 1), tx = Math.max(0, Math.min(1, fx - xa)), ty = Math.max(0, Math.min(1, fy - ya));
    // No closure here: tsx's keepNames wraps every arrow made per call in __name (it was half the frame).
    const ra = ya * width, rb = yb * width;
    const val = (texels[(ra + xa) * 2 + channel] * (1 - tx) + texels[(ra + xb) * 2 + channel] * tx) * (1 - ty) + (texels[(rb + xa) * 2 + channel] * (1 - tx) + texels[(rb + xb) * 2 + channel] * tx) * ty;
    return val < 127.5;
  };
}

let codeHash: string | null = null;
/** Hash of the ground builder's closure (every src/canalRecall source) and the extract manifests' sizes and times. */
export function groundCacheKey(root: string): string {
  if (codeHash) return codeHash;
  const h = createHash('sha256');
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|js)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) h.update(fs.readFileSync(p));
    }
  };
  // The whole src/canalRecall tree: the builder imports outside ownGround/ (elevation/bridgeDeck, look/palette,
  // threeBuildingFeatures, streetFronts, routing), and a stale cell drew last week's kerbs (lane node-world-frames).
  walk(path.join(root, 'src/canalRecall'));
  for (const d of ['ground-height-v1', 'own-ground-osm-v1', 'elevation-v1', 'parks-v1', 'roads-v1', 'courtyards-v1', 'open-ground-v1', 'open-ground-v2', 'road-marks-v1', 'rail-v1']) {
    const dir = path.join(root, EXTRACT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(n => /\.json$/.test(n)).sort()) { const st = fs.statSync(path.join(dir, f)); h.update(`${d}/${f}:${st.size}:${st.mtimeMs}`); }
  }
  return (codeHash = h.digest('hex').slice(0, 16));
}

export type GroundScene = { store: GroundStore; cells: BuiltCell[]; ms: { init: number; build: number; cached: number; built: number } };

/** Distance from a point to a rect. */
const rectDistance = (r: readonly number[], x: number, y: number) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - y, 0, y - r[3]));

/**
 * The ground cells the game would draw around `centre` (own-ground local metres), skipping cells whose rect lies
 * wholly behind the camera's horizontal view (`forward`, local x/y, unit) with a margin.
 */
export async function loadGround(root: string, cacheDir: string, centre: [number, number], forward: [number, number] | null, opts: { radiusM?: number; nearM?: number; log?: (s: string) => void; seen?: (rect: readonly number[]) => boolean } = {}): Promise<GroundScene> {
  const { GroundStore, maybeGunzip } = await import('../ownGround/groundStore.ts');
  const { buildCell } = await import('../ownGround/groundCell.ts');
  const t0 = performance.now();
  const fetchBytes = async (p: string) => maybeGunzip(new Uint8Array(await fs.promises.readFile(path.join(root, EXTRACT, p))));
  const store = new GroundStore(fetchBytes as never, { parks: true, roads: true, rails: true });
  await store.init();
  const t1 = performance.now();
  const R = opts.radiusM ?? GROUND_RADIUS_M, NEAR = opts.nearM ?? GROUND_NEAR_M, [x, y] = centre;
  const size = (store as unknown as { elevation: { cellSizeM: number } }).elevation.cellSizeM;
  const [cx, cy] = store.cellAt(x, y).split('_').map(Number), span = Math.ceil(R / size) + 1;
  const wanted: { key: string; lod: 0 | 1; d: number }[] = [];
  for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
    const key = `${cx + dx}_${cy + dy}`;
    if (!store.covers(key)) continue;
    const rect = store.cellRect(key), d = rectDistance(rect, x, y);
    if (d > R) continue;
    if (forward && d > 50) {
      // Behind: every corner more than 30 degrees behind the side of the view.
      const ahead = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[0], rect[3]], [rect[2], rect[3]]].some(([px, py]) => ((px - x) * forward[0] + (py - y) * forward[1]) > -0.2 * Math.hypot(px - x, py - y));
      if (!ahead) continue;
    }
    if (opts.seen && d > 50 && !opts.seen(rect)) continue;
    wanted.push({ key, lod: d <= NEAR ? 0 : 1, d });
  }
  wanted.sort((a, b) => a.d - b.d);
  const hash = groundCacheKey(root), dir = path.join(cacheDir, 'ground');
  fs.mkdirSync(dir, { recursive: true });
  const cells: BuiltCell[] = [];
  let cached = 0, built = 0;
  for (const w of wanted) {
    const file = path.join(dir, `${w.key}-lod${w.lod}-${hash}.v8.gz`);
    let cell: BuiltCell | null = null;
    if (fs.existsSync(file)) { try { cell = v8.deserialize(gunzipSync(fs.readFileSync(file))) as BuiltCell; cached++; } catch { cell = null; } }
    // A cached cell skips cellInput, which prepares the cell in the store: its measured decks (bridges) placed on the
    // riding surface, as the game's main-thread store has them. Without this the rider, the furniture and every
    // surface read stood on the bare relief under a bridge (Rijnstraat 080338, 165078: 0.8 m low).
    if (cell) await store.prepareCell(w.key);
    if (!cell) {
      const tb = performance.now();
      const input = await store.cellInput(w.key, w.lod, 'full');
      cell = buildCell(input);
      delete cell.sources;
      fs.writeFileSync(file, gzipSync(v8.serialize(cell), { level: 1 }));
      built++;
      opts.log?.(`ground ${w.key} lod${w.lod} built ${(performance.now() - tb).toFixed(0)} ms`);
    }
    cells.push(cell);
  }
  // The relief around the centre (building bases and wall feet read it).
  await store.ensureRelief([x - 700, y - 700, x + 700, y + 700]);
  const t2 = performance.now();
  return { store, cells, ms: { init: t1 - t0, build: t2 - t1, cached, built } };
}

/** The game's ground materials as surface specs (OwnGround.makeMaterials run on a stand-in for the layer). */
export type GroundLook = Record<string, { spec: SurfaceSpec; offset: number; castShadow: boolean; doubleSide: boolean; vertexColors: boolean }>;

export async function groundLook(search = ''): Promise<GroundLook> {
  const THREE = await import('three');
  const gg = await import('../ownGround/gameGround.ts') as Record<string, unknown>;
  const cls = Object.values(gg).find(v => typeof v === 'function' && (v as { prototype?: { makeMaterials?: unknown } }).prototype?.makeMaterials) as { prototype: { makeMaterials(this: unknown): void; canvasTexture: unknown } };
  const fake: Record<string, unknown> & { base: Record<string, any> } = { THREE, opts: { groundLook: 'default' }, railStripes: { stripes: !/[?&]railStripes=0/.test(search), minPx: 1 }, base: {}, blendMaterial() {} };
  fake.canvasTexture = (cls.prototype.canvasTexture as (...a: unknown[]) => unknown).bind(fake);
  cls.prototype.makeMaterials.call(fake);
  const maps = new Map<unknown, Texture2D>();
  const out: GroundLook = {};
  for (const [layer, m] of Object.entries(fake.base)) {
    if (!m || /^(route|routeCasing|highlight|destination)$/.test(layer)) continue;
    let map: Texture2D | null = null;
    if (m.map?.image) {
      map = maps.get(m.map.image) ?? null;
      if (!map) {
        const c = m.map.image, img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        map = texture2D(img.data, c.width, c.height, true, false);
        maps.set(m.map.image, map);
      }
    }
    const kind = m.type === 'MeshBasicMaterial' ? 'basic' : m.type === 'MeshLambertMaterial' ? 'lambert' : 'standard';
    out[layer] = {
      spec: { kind, color: [m.color.r, m.color.g, m.color.b], map, repeat: map ? [m.map.repeat.x, m.map.repeat.y] : undefined, offset: map ? [m.map.offset.x, m.map.offset.y] : undefined, roughness: m.roughness, metalness: m.metalness, noSpecular: (m.roughness ?? 1) >= 0.85 && !(m.metalness > 0) },
      offset: m.polygonOffset ? -(m.polygonOffsetFactor as number) : 0,
      castShadow: layer === 'deckBody' || layer === 'hedge' || layer === 'furniture',
      doubleSide: m.side === THREE.DoubleSide,
      vertexColors: !!m.vertexColors,
    };
  }
  return out;
}

/** World-space draws of the ground cells. `toWorld` maps ground-local (x, y, scene z) into the frame's world. */
export function groundDraws(scene: GroundScene, look: GroundLook, toWorld: (positions: Float32Array) => Float32Array, env: SurfaceEnv, worldToLocal: readonly number[]): WorldDraw[] {
  const draws: WorldDraw[] = [];
  for (const cell of scene.cells) {
    for (const [layer, p] of Object.entries(cell.layers) as [string, PackedMesh][]) {
      const l = look[layer];
      if (!l || !p.indices.length) continue;
      const positions = toWorld(p.positions);
      // Normals: the ground layers' frame turns with the positions' (a rotation about z plus north compensation, both
      // tiny); flat-ish ground keeps them as built.
      const channel = CUT_CHANNEL[layer];
      const cut = cell.mask && channel !== undefined ? maskCut(cell.mask, channel, worldToLocal) : null;
      draws.push({
        positions, indices: p.indices, cull: l.doubleSide ? 'none' : 'back', offset: l.offset, name: `ground/${cell.key}/${layer}`,
        cut: cut ?? undefined,
        material: surfaceMaterial(l.spec, { uvs: p.uvs, colors: l.vertexColors ? p.colors : null, colorSize: 3, normals: p.normals }, env, positions),
      });
    }
  }
  return draws;
}

/** sRGB hex to the linear triple three's Color holds. */
export const linearOf = (r: number, g: number, b: number): [number, number, number] => [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];
