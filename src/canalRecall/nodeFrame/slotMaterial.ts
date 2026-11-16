/**
 * The city look on installed GLBs (look/cityLook.ts `dress`, the lit `kind: 'slot'` variant) as a node-frame shader.
 * In the game every model the landmark layer loads is dressed (signature-landmarks-source.js `_dress`, `?cityLook`
 * on by default, slots inferred): a material that names a slot (`materialSlot` + `tint` extras) or whose name and
 * colour infer one draws the city's shared slot cell (brick, stucco, stone, white, door, glass, roof tiles) from the
 * facade atlas, tinted, instead of its own flat Lambert colour. Per pixel, as the GLSL does:
 *
 *   uv     = glass (clamped pane cell): uv;  else uv / tileM;  no uv: the box projection in the mesh's metres
 *   c, m   = texture(cells | masks, (uv, slotBase + layer))       trilinear at the pixel's footprint, no facade tier
 *   c     *= mix(1, tint, m.r) * litGain                          (accent defaults to white on a slot mesh)
 *   out    = Lambert(c ^ 2.2) under the rig, smooth normals, cast shadow; emissive += SKY_TINT x skyTint
 *
 * Reflective glass (`glassFinish: 'reflective'` under GLASS_REFLECT=1 / `?glassReflect=1`, look/glassReflect.ts): the
 * emissive sky tint is replaced by F env(r) and the albedo by albedo (1 - F)(1 - metalness), the same function as the
 * GLSL (glassReflectInto), with the view vector from env.eye.
 *
 * Not reproduced: the shader window grid on `windowGrid` walls (cityWindowGrid), highlight and dim states.
 */
import * as THREE from 'three';
import { SLOT_LAYERS, WINDOW_GRID_LAYER_FLAG, slotForMaterial, slotLayerOf, slotTintBytes, type SlotVariantHints } from '../look/cityLook.ts';
import { isWhiteWord } from '../look/materialSlotInference.ts';
import { glassReflectInto } from '../look/glassReflect.ts';
import type { WallExposure } from '../look/chunkWallExposure.ts';
import { sampleAtlas, type Atlas } from './atlas.ts';
import { lambert, linearToSrgb, pow22, sunFacing } from './light.ts';
import type { SurfaceEnv } from './surfaceMaterial.ts';
import type { ShadeInput, WorldMaterial } from './worldRaster.ts';
import type { GlbScene } from '../glbRaster/load.ts';

const SKY_TINT = [0.035, 0.05, 0.07];
/** look/cityLook.ts LEVEL_ROOF_MIN_UP: an inferred slate face this level is a flat roof (bitumen). */
const LEVEL_ROOF_MIN_UP = 0.97;

type GlbMaterial = GlbScene['materials'][number];
type GlbPrimitive = GlbScene['primitives'][number];

/** One slot a primitive's material takes: the atlas layer and the tint bytes (0..255), as setSlotAttributes writes them. */
export type SlotPick = { layer: number; tint: [number, number, number]; flat?: { layer: number; tint: [number, number, number] }; reflect?: true };

/** The slot a GLB material takes under the city look (dress with `infer`), or null when it keeps its own material. */
export function slotPickFor(m: GlbMaterial, prim: Pick<GlbPrimitive, 'colors'>, context: { year?: number | null; exposure?: WallExposure | null } = {}): SlotPick | null {
  // GLTFLoader's material as slotForMaterial reads it: the linear factor as a Color (hex in sRGB), BLEND transparent.
  const fake = {
    name: m.name, userData: { ...(m.extras ?? {}) }, color: new THREE.Color().setRGB(m.baseColor[0], m.baseColor[1], m.baseColor[2], THREE.LinearSRGBColorSpace),
    transparent: m.alphaMode === 'BLEND', opacity: m.alphaMode === 'BLEND' ? m.baseColor[3] : 1, vertexColors: !!prim.colors, map: m.baseColorTexture ?? null,
    isMeshBasicMaterial: !!m.unlit,
  };
  const found = slotForMaterial(fake, true);
  if (!found) return null;
  const hints: SlotVariantHints = { year: context.year ?? null, white: found.inferred && isWhiteWord(m.name), source: found.source,
    ...(found.white ? { whitePoint: found.white } : {}), ...(context.exposure ? { exposure: context.exposure } : {}), ...(found.windowGrid ? { windowGrid: true } : {}) };
  const t = slotTintBytes(found.slot, found.tint, hints.source, undefined, hints.whitePoint, hints.exposure, false, true);
  // The window-grid flag (cityWindowGrid) is not drawn here: the wall keeps its slot cell.
  const ordinal = slotLayerOf(found.slot, hints), layer = ordinal >= WINDOW_GRID_LAYER_FLAG ? ordinal - WINDOW_GRID_LAYER_FLAG : ordinal;
  const pick: SlotPick = { layer, tint: [t[0], t[1], t[2]], ...(found.glassFinish === 'reflective' ? { reflect: true as const } : {}) };
  if (found.inferred && found.slot === 'slate' && !found.source) {
    const b = slotTintBytes('bitumen', found.tint, hints.source);
    pick.flat = { layer: slotLayerOf('bitumen', hints), tint: [b[0], b[1], b[2]] };
  }
  return pick;
}

/**
 * The slot material for one placed primitive. `positions`/`normals` are world (the draw's); `local` the GLB's own
 * positions and normals (glTF, +Y up) and `metres` the placement's scale, for the box projection and level faces.
 */
export function slotMaterial(pick: SlotPick, atlas: Atlas, env: SurfaceEnv, positions: Float32Array, normals: Float32Array | null,
  uvs: ArrayLike<number> | null | undefined, local: { positions: ArrayLike<number>; normals?: ArrayLike<number> | null; metres: number }): WorldMaterial {
  const { light } = env, aniso = env.anisotropy ?? 16, size = atlas.size;
  const c = new Float64Array(3), m = new Float64Array(2), irr = new Float64Array(3), uv3 = [0, 0, 0, 0, 0, 0];
  const rn = [0, 0, 0], rv = [0, 0, 0], ra = [0, 0, 0], radd = [0, 0, 0], rkeep = [0, 0, 0];
  let lastTri = -1, texPerM = 0, layer = 0, tint = pick.tint, tile = 1, clamp = false, gain = 1, sky = 0;
  const slotOf = (ordinal: number) => SLOT_LAYERS[Math.max(0, Math.min(SLOT_LAYERS.length - 1, ordinal))];
  /** The cell uv of vertex `i` into uv3[k * 2]. */
  const vertexUv = (i: number, k: number, boxAxis: number) => {
    if (uvs) { uv3[k * 2] = uvs[i * 2]; uv3[k * 2 + 1] = uvs[i * 2 + 1]; if (!clamp) { uv3[k * 2] /= tile; uv3[k * 2 + 1] /= tile; } return; }
    // Box projection (VERTEX_BODY, no uv): the dominant axis of the mesh normal picks the plane, in the mesh's metres.
    const x = local.positions[i * 3] * local.metres, y = local.positions[i * 3 + 1] * local.metres, z = local.positions[i * 3 + 2] * local.metres;
    const [a, b] = boxAxis === 1 ? [x, z] : boxAxis === 0 ? [z, y] : [x, y];
    if (clamp) { uv3[k * 2] = 0.5; uv3[k * 2 + 1] = 0.59; } else { uv3[k * 2] = a / tile; uv3[k * 2 + 1] = b / tile; }
  };
  return {
    shade(s: ShadeInput, out: Float64Array): boolean {
      const { i0, i1, i2, b0, b1, b2 } = s;
      const tri = i0 * 7919 + i1 * 31 + i2;
      if (tri !== lastTri) {
        lastTri = tri;
        // The slot of this triangle (an inferred slate's level faces take the flat roof).
        let use: { layer: number; tint: [number, number, number] } = pick;
        let boxAxis = 2;
        const LN = local.normals;
        if (LN) {
          const nx = LN[i0 * 3] + LN[i1 * 3] + LN[i2 * 3], ny = LN[i0 * 3 + 1] + LN[i1 * 3 + 1] + LN[i2 * 3 + 1], nz = LN[i0 * 3 + 2] + LN[i1 * 3 + 2] + LN[i2 * 3 + 2];
          const l = Math.hypot(nx, ny, nz) || 1, ax = Math.abs(nx / l), ay = Math.abs(ny / l), az = Math.abs(nz / l);
          boxAxis = ay > Math.max(ax, az) ? 1 : ax > az ? 0 : 2;
          if (pick.flat && ny / l >= LEVEL_ROOF_MIN_UP) use = pick.flat;
        }
        layer = use.layer; tint = use.tint;
        const sl = slotOf(layer);
        tile = sl.tileM; clamp = sl.clampUv; gain = sl.litGain; sky = sl.skyTint ? 1 : 0;
        vertexUv(i0, 0, boxAxis); vertexUv(i1, 1, boxAxis); vertexUv(i2, 2, boxAxis);
        const P = positions;
        const e1x = P[i1 * 3] - P[i0 * 3], e1y = P[i1 * 3 + 1] - P[i0 * 3 + 1], e1z = P[i1 * 3 + 2] - P[i0 * 3 + 2];
        const e2x = P[i2 * 3] - P[i0 * 3], e2y = P[i2 * 3 + 1] - P[i0 * 3 + 1], e2z = P[i2 * 3 + 2] - P[i0 * 3 + 2];
        const wa = Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x);
        const ua = Math.abs((uv3[2] - uv3[0]) * (uv3[5] - uv3[1]) - (uv3[4] - uv3[0]) * (uv3[3] - uv3[1]));
        texPerM = wa > 0 ? Math.sqrt(ua / wa) * size : 0;
      }
      let u = uv3[0] * b0 + uv3[2] * b1 + uv3[4] * b2, v = uv3[1] * b0 + uv3[3] * b1 + uv3[5] * b2;
      if (clamp) { u = u < 0 ? 0 : u > 1 ? 1 : u; v = v < 0 ? 0 : v > 1 ? 1 : v; }
      const minor = s.dist / env.focal, major = minor / Math.max(0.02, s.cosView);
      const rho = texPerM * Math.max(minor, major / aniso);
      sampleAtlas(atlas, atlas.slotBase + layer, u, v, rho > 0 ? Math.log2(rho) : 0, c, m);
      for (let k = 0; k < 3; k++) c[k] *= (1 + (tint[k] / 255 - 1) * m[0]) * gain;
      let nx = s.nx, ny = s.ny, nz = s.nz;
      if (normals) {
        const N = normals;
        nx = N[i0 * 3] * b0 + N[i1 * 3] * b1 + N[i2 * 3] * b2; ny = N[i0 * 3 + 1] * b0 + N[i1 * 3 + 1] * b1 + N[i2 * 3 + 1] * b2; nz = N[i0 * 3 + 2] * b0 + N[i1 * 3 + 2] * b1 + N[i2 * 3 + 2] * b2;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        if (s.back) { nx = -nx; ny = -ny; nz = -nz; }
      }
      const lit = !env.shadow || sunFacing(light, nx, ny, nz) <= 0 ? 1 : env.shadow(s.px, s.py, s.pz, nx, ny, nz);
      lambert(light, nx, ny, nz, lit, irr);
      if (pick.reflect && sky) {
        const ex = env.eye[0] - s.px, ey = env.eye[1] - s.py, ez = env.eye[2] - s.pz, el = Math.hypot(ex, ey, ez) || 1;
        rn[0] = nx; rn[1] = ny; rn[2] = nz; rv[0] = ex / el; rv[1] = ey / el; rv[2] = ez / el;
        for (let k = 0; k < 3; k++) ra[k] = pow22(c[k]);
        glassReflectInto(rn, rv, ra, radd, rkeep, light.toSun);
        for (let k = 0; k < 3; k++) out[k] = linearToSrgb(ra[k] * rkeep[k] * irr[k] + radd[k]);
      } else for (let k = 0; k < 3; k++) out[k] = linearToSrgb(pow22(c[k]) * irr[k] + SKY_TINT[k] * sky);
      if (env.fog) env.fog(s.dist, out);
      out[3] = 1;
      return true;
    },
  };
}
