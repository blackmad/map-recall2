/**
 * Installed models in the node frame (lane node-world-frames): every GLB the game draws by default (landmarks/
 * browser.ts GAME_BUILDING_MODELS: the placed manual models and the ordinary catalogue, plus the street chunks of
 * ordinary-buildings-data/chunks.json through applyStreetChunks), placed as signature-landmarks-source.js `_add`
 * places them and shaded as landmarkShading.ts normaliseLandmarkMaterials leaves them (Lambert, glass sky tint).
 *
 * Placement (Mercator, mean-radius metre `u`; maplibre's MercatorCoordinate):
 *   v      = (x, y - min.y, z) of the GLB scene (surveyed models are not recentred; fitted ones are, in x and z)
 *   group  = scale(s) (x negated when mirrored)
 *   matrix = translate(anchor, altitude) . scale(u, -u, u) . rotZ((90 - modelRotationDegrees) deg) . rotX(pi / 2)
 *            or, with a horizontal basis {x, y}: rows [u x0, 0, -u y0], [u x1, 0, -u y1], [0, u, 0]
 *   lifted by the ground base (gameGround.ts pointBase: the lowest relief within 3 m of the anchor).
 * The full GLB is drawn near the camera and `.lod1.glb` (when current) past LOD1_M, as the projected-radius rule picks.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { GlbScene } from '../glbRaster/load.ts';
import { srgbToLinear } from './light.ts';
import { surfaceMaterial, type SurfaceEnv, type SurfaceSpec } from './surfaceMaterial.ts';
import { texture2D, type Texture2D } from './texture.ts';
import type { GeoFrame } from './frame.ts';
import { worldOfLngLat } from './frame.ts';
import type { WorldDraw } from './worldRaster.ts';

/** Earth's mean radius (maplibre's MercatorCoordinate). */
const MEAN_RADIUS_M = 6371008.8;
const GLASS_SKY_TINT: [number, number, number] = [0.035, 0.05, 0.07];
const GLASS_NAME = /glass|glaz|window|vitr|ruit/i;
/** Beyond this the lod1 file (when current) stands in for the full GLB. */
export const LOD1_M = 250;

export type ModelSpec = { id: string; modelUrl: string; surveyed?: { anchor: [number, number] } & Record<string, unknown>; footprint?: { centre: [number, number] }; suppressOsmIds?: string[]; [k: string]: unknown };
export type PlacedModel = { spec: ModelSpec; file: string; anchor: [number, number]; d: number };

/** The models the game draws by default, nearest first, within `radiusM` of `at` and not wholly behind `forward`. */
export async function gameModels(root: string, at: [number, number], radiusM: number): Promise<{ specs: ModelSpec[]; held: string[] }> {
  const lm = await import('../landmarks/browser.ts') as Record<string, any>;
  const { BLANK_INSTALLS } = await import('../landmarks/blankInstalls.ts');
  const { DEFAULT_HELD_CHUNKS } = await import('../landmarks/ordinaryChunks.ts');
  // Node has no `window`: installDraws reads bare fronts as off, so the measured blank installs are dropped here.
  const base = (lm.GAME_BUILDING_MODELS as ModelSpec[]).filter(m => !(m.id in BLANK_INSTALLS));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/canal-drive/ordinary-buildings-data/chunks.json'), 'utf8'));
  const applied = lm.applyStreetChunks(base, manifest, DEFAULT_HELD_CHUNKS) as { models: ModelSpec[]; chunks: ModelSpec[] };
  const all = [...applied.models, ...applied.chunks];
  return { specs: all, held: [...DEFAULT_HELD_CHUNKS] };
}

export function modelFile(root: string, url: string): string {
  return path.join(root, 'public/canal-drive', url.replace(/^\.\//, '').replace(/\?.*$/, ''));
}

const glbCache = new Map<string, Promise<GlbScene>>();
export function loadGlbFile(file: string): Promise<GlbScene> {
  let p = glbCache.get(file);
  if (!p) { p = import('../glbRaster/load.ts').then(m => m.loadGlb(new Uint8Array(fs.readFileSync(file)))); glbCache.set(file, p); }
  return p;
}

/** Scene bounds of a loaded GLB (three's Box3.setFromObject over the baked node transforms). */
export function glbBounds(g: GlbScene): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const p of g.primitives) for (let i = 0; i < p.positions.length; i += 3) for (let k = 0; k < 3; k++) { const v = p.positions[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  return { min, max };
}

/**
 * The model's GLB-to-world map (camera metres, z up) as a 3x4 row-major affine, from the game's placement. `base` is
 * the ground lift, metres.
 */
export function modelMatrix(f: GeoFrame, placement: { anchor: readonly number[]; altitudeMetres?: number; modelRotationDegrees: number; scale: number; mirror?: boolean; horizontalBasis?: { x: readonly number[]; y: readonly number[] } }, recentre: [number, number, number], base: number): number[] {
  const [ax, ay] = worldOfLngLat(f, placement.anchor[0], placement.anchor[1]);
  // A model metre in camera metres: the mean-radius Mercator metre over the frame's equatorial one.
  const k = 1 / (2 * Math.PI * MEAN_RADIUS_M * Math.cos(placement.anchor[1] * Math.PI / 180)) / f.unitsPerMetre;
  const az = (placement.altitudeMetres ?? 0) * k + base;
  const s = placement.scale, sx = placement.mirror ? -s : s;
  // Model (x, y, z) after the recentre and group scale: X = sx (x + rx), Y = s (y + ry), Z = s (z + rz).
  // World (east, north, up) of Mercator (mx, my, mz): east = mx, north = -my, up = mz.
  let ex: number[], ez: number[], ey: number[];
  if (placement.horizontalBasis) {
    const { x, y } = placement.horizontalBasis;
    // mx = u (x0 X - y0 Z), my = u (x1 X - y1 Z), mz = u Y
    ex = [k * x[0], 0, -k * y[0]]; ey = [-k * x[1], 0, k * y[1]]; ez = [0, k, 0];
  } else {
    // rotX(pi/2): (X, Y, Z) -> (X, -Z, Y); rotZ(phi): (a, b) -> (a c - b s, a s + b c); scale(u, -u, u).
    const phi = (90 - placement.modelRotationDegrees) * Math.PI / 180, c = Math.cos(phi), sn = Math.sin(phi);
    // a = X, b = -Z: mx = u (X c + Z sn), my = -u (X sn - Z c), mz = u Y; north = -my.
    ex = [k * c, 0, k * sn]; ey = [k * sn, 0, -k * c]; ez = [0, k, 0];
  }
  const [rx, ry, rz] = recentre, sc = [sx, s, s];
  const row = (r: number[], t: number) => [r[0] * sc[0], r[1] * sc[1], r[2] * sc[2], r[0] * sc[0] * rx + r[1] * sc[1] * ry + r[2] * sc[2] * rz + t];
  return [...row(ex, ax), ...row(ey, ay), ...row(ez, az)];
}

const texCache = new WeakMap<object, Texture2D>();

/** Draws of one placed GLB under the landmark look. `fog` is the landmark's (the limit ramp only, landmarkHaze). */
export function modelDraws(g: GlbScene, M: number[], env: SurfaceEnv, name: string): WorldDraw[] {
  const det = M[0] * (M[5] * M[10] - M[6] * M[9]) - M[1] * (M[4] * M[10] - M[6] * M[8]) + M[2] * (M[4] * M[9] - M[5] * M[8]);
  const flip = det < 0, draws: WorldDraw[] = [];
  for (const p of g.primitives) {
    const m = g.materials[p.material], n = p.positions.length / 3;
    const pos = new Float32Array(n * 3), nrm = p.normals ? new Float32Array(n * 3) : null;
    for (let v = 0; v < n; v++) {
      const x = p.positions[v * 3], y = p.positions[v * 3 + 1], z = p.positions[v * 3 + 2];
      for (let r = 0; r < 3; r++) pos[v * 3 + r] = M[r * 4] * x + M[r * 4 + 1] * y + M[r * 4 + 2] * z + M[r * 4 + 3];
      if (nrm && p.normals) {
        // Rotation x uniform scale (and the mirror): the inverse transpose is the matrix itself up to scale and sign.
        const a = p.normals[v * 3], b = p.normals[v * 3 + 1], c = p.normals[v * 3 + 2];
        let X = M[0] * a + M[1] * b + M[2] * c, Y = M[4] * a + M[5] * b + M[6] * c, Z = M[8] * a + M[9] * b + M[10] * c;
        if (flip) { X = -X; Y = -Y; Z = -Z; }
        // A mirror flips handedness: three negates the normal matrix's determinant effect by flipping the face, so the
        // transformed normal keeps pointing out once negated twice; keep it unit.
        const l = Math.hypot(X, Y, Z) || 1; nrm[v * 3] = (flip ? -X : X) / l; nrm[v * 3 + 1] = (flip ? -Y : Y) / l; nrm[v * 3 + 2] = (flip ? -Z : Z) / l;
      }
    }
    let indices = p.indices;
    if (flip) { indices = new Uint32Array(p.indices); for (let i = 0; i + 2 < indices.length; i += 3) { const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t; } }
    let map: Texture2D | null = null;
    if (m.baseColorTexture) {
      map = texCache.get(m.baseColorTexture) ?? null;
      if (!map) { map = texture2D(m.baseColorTexture.rgba, m.baseColorTexture.width, m.baseColorTexture.height, false, false); texCache.set(m.baseColorTexture, map); }
    }
    const glass = !m.unlit && GLASS_NAME.test(m.name);
    const spec: SurfaceSpec = {
      kind: m.unlit ? 'basic' : 'lambert', color: [m.baseColor[0], m.baseColor[1], m.baseColor[2]], map,
      emissive: glass ? [m.emissive[0] + GLASS_SKY_TINT[0], m.emissive[1] + GLASS_SKY_TINT[1], m.emissive[2] + GLASS_SKY_TINT[2]] : m.emissive,
      opacity: m.alphaMode === 'BLEND' ? m.baseColor[3] : 1, alphaTest: m.alphaMode === 'MASK' ? m.alphaCutoff : undefined,
    };
    draws.push({
      positions: pos, indices, cull: m.doubleSided ? 'none' : 'back', blend: m.alphaMode === 'BLEND' && m.baseColor[3] < 0.999, name,
      material: surfaceMaterial(spec, { uvs: p.uvs, colors: p.colors, colorSize: 4, normals: nrm }, env, pos),
    });
  }
  return draws;
}

export const linear3 = (hex: string): [number, number, number] => { const n = parseInt(hex.replace('#', ''), 16); return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)]; };

/** buildingTypes/runtime.ts RuntimeInstance (public/canal-drive/building-types/instances.json). */
export type TypeInstance = { pand: string; unit: string; anchor: [number, number]; northOffsetDegrees: number; scale: [number, number, number]; groundAltitudeMetres: number; area?: string; alsoSuppress?: string[] };

/**
 * Building-type instances (buildingTypes/runtime.ts, wired in signature-landmarks-source.js): each area is a surveyed
 * spec at its instances' bounding-box centre, rotation 90 (GLB +x east, +z south), lifted by the ground base at that
 * anchor; inside it each instance is T(east, alt, south) . Ry(yaw) . S with yaw = pi - (180 + northOffset) deg.
 * Returns, per wanted instance, its GLB-to-world 3x4 and the pand ids it suppresses. The runtime draws instances
 * past NEAR_METRES as massing boxes and culls them past CULL_METRES; this keeps the unit mesh out to `radiusM`.
 */
export function typeInstanceMatrices(f: GeoFrame, instances: readonly TypeInstance[], areaBase: (anchor: [number, number]) => number, want: (wx: number, wy: number) => boolean): { inst: TypeInstance; M: number[]; hides: string[] }[] {
  const byArea = new Map<string, TypeInstance[]>();
  for (const i of instances) { const k = i.area ?? ''; let l = byArea.get(k); if (!l) byArea.set(k, l = []); l.push(i); }
  const out: { inst: TypeInstance; M: number[]; hides: string[] }[] = [];
  for (const list of byArea.values()) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const i of list) { x0 = Math.min(x0, i.anchor[0]); x1 = Math.max(x1, i.anchor[0]); y0 = Math.min(y0, i.anchor[1]); y1 = Math.max(y1, i.anchor[1]); }
    const anchor: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2];
    let base: number | null = null;
    const [ax, ay] = worldOfLngLat(f, anchor[0], anchor[1]);
    const k = 1 / (2 * Math.PI * MEAN_RADIUS_M * Math.cos(anchor[1] * Math.PI / 180)) / f.unitsPerMetre;
    for (const inst of list) {
      const [wx, wy] = worldOfLngLat(f, inst.anchor[0], inst.anchor[1]);
      if (!want(wx, wy)) continue;
      base ??= areaBase(anchor);
      // East/south metres from the area anchor in the loader's frame (equatorial Mercator metre at the anchor).
      const east = (wx - ax) / k, south = -(wy - ay) / k;
      const yaw = Math.PI - ((180 + inst.northOffsetDegrees) * Math.PI) / 180, c = Math.cos(yaw), s = Math.sin(yaw), [sx, sy, sz] = inst.scale;
      // Area frame: E = c sx x + s sz z + east, U = sy y + alt, S = -s sx x + c sz z + south; world = anchor + k (E, -S, U).
      const M = [k * c * sx, 0, k * s * sz, ax + k * east, k * s * sx, 0, -k * c * sz, ay - k * south, 0, k * sy, 0, base + k * inst.groundAltitudeMetres];
      out.push({ inst, M, hides: [inst.pand, ...(inst.alsoSuppress ?? [])].map(p => `NL.IMBAG.Pand.${p}`) });
    }
  }
  return out;
}
