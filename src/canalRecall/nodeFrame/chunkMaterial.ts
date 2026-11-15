/**
 * The lit city-look chunk material (look/cityLook.ts `createCityLookMaterial({lit: true, kind: 'chunk'})`, the facades'
 * material in the shared frame) as a node-frame shader. Per pixel, as the GLSL does:
 *
 *   c, m   = cellTierSample(uv, layer)        cell colour and (tint, accent) mask weights, trilinear at the pixel's
 *                                              footprint (anisotropy 16), blended toward the cell mean where a cell
 *                                              covers fewer than cellTier texels a pixel (roofTier.ts facade tier)
 *   c     *= mix(1, tint, m.r) * mix(1, accent, m.g) * mix(1, wallGain * CITY_LIT_LEVEL, m.r)
 *   albedo = c ^ 2.2;  emissive = SKY_TINT * (1 - smoothstep(0.06, 0.2, luma(c))) * (1 - m.r)
 *   out    = Lambert under the rig (light.ts), flat normal, cast shadow from the sun's map.
 *
 * Vertex inputs are the chunk's: uv (bays x storeys), layer (flat: WebGL's provoking vertex is the last), tint and
 * accent RGB (smooth). Not reproduced: the analytic window SDF (painted windows instead), the roof tier's coarsening,
 * the thin fade's dissolve, highlight/ghost states (hidden ranges are dropped before drawing).
 */
import { sampleAtlas, type Atlas } from './atlas.ts';
import { lambert, linearToSrgb, sunFacing, type SceneLight } from './light.ts';
import type { ShadeInput, WorldMaterial } from './worldRaster.ts';

export type ChunkArrays = { uvs: Float32Array; layers: Uint8Array; tints: Uint8Array; accents: Uint8Array; accentSize?: 3 | 4 };
export type ShadowFn = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => number;
/** three's fog: mixed into the encoded (sRGB) colour, after the colour-space conversion. */
export type FogFn = (dist: number, rgb: Float64Array) => void;

export type ChunkLook = {
  atlas: Atlas; light: SceneLight;
  /** litFacadeWallGain(litWallGain) x CITY_LIT_LEVEL. */
  wallGain: number;
  /** facadeTierUniform(dpr): [from, to] texels per framebuffer pixel. */
  cellTier: [number, number];
  /** Output px per metre at 1 m (the focal in framebuffer px). */
  focal: number;
  shadow?: ShadowFn | null;
  fog?: FogFn | null;
  /** Anisotropic filtering samples (16 on desktop high). */
  anisotropy?: number;
};

const SKY_TINT = [0.035, 0.05, 0.07];
const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function chunkMaterial(look: ChunkLook, a: ChunkArrays, positions: Float32Array): WorldMaterial {
  const { atlas, light } = look, aniso = look.anisotropy ?? 16, as = a.accentSize ?? 4;
  const c = new Float64Array(3), m = new Float64Array(2), irr = new Float64Array(3);
  const mean = atlas.mean, size = atlas.size;
  let lastTri = -1, texPerM = 0;
  return {
    shade(s: ShadeInput, out: Float64Array): boolean {
      const { i0, i1, i2, b0, b1, b2 } = s, U = a.uvs;
      const u = U[i0 * 2] * b0 + U[i1 * 2] * b1 + U[i2 * 2] * b2, v = U[i0 * 2 + 1] * b0 + U[i1 * 2 + 1] * b1 + U[i2 * 2 + 1] * b2;
      const layer = a.layers[i2];
      // Texels per metre of this triangle (uv area over world area), once per triangle.
      const tri = i0 * 7919 + i1 * 31 + i2;
      if (tri !== lastTri) {
        lastTri = tri;
        const P = positions;
        const e1x = P[i1 * 3] - P[i0 * 3], e1y = P[i1 * 3 + 1] - P[i0 * 3 + 1], e1z = P[i1 * 3 + 2] - P[i0 * 3 + 2];
        const e2x = P[i2 * 3] - P[i0 * 3], e2y = P[i2 * 3 + 1] - P[i0 * 3 + 1], e2z = P[i2 * 3 + 2] - P[i0 * 3 + 2];
        const wa = Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x);
        const du1 = U[i1 * 2] - U[i0 * 2], dv1 = U[i1 * 2 + 1] - U[i0 * 2 + 1], du2 = U[i2 * 2] - U[i0 * 2], dv2 = U[i2 * 2 + 1] - U[i0 * 2 + 1];
        const ua = Math.abs(du1 * dv2 - du2 * dv1);
        texPerM = wa > 0 ? Math.sqrt(ua / wa) * size : 0;
      }
      // Footprint: minor axis = metres per pixel at this distance; major stretched by the obliquity.
      const minor = s.dist / look.focal, major = minor / Math.max(0.02, s.cosView);
      const rhoMajor = texPerM * major, rhoAniso = texPerM * Math.max(minor, major / aniso);
      const lod = rhoAniso > 0 ? Math.log2(rhoAniso) : 0;
      sampleAtlas(atlas, layer, u, v, lod, c, m);
      if (texPerM > 0) {
        const far = smoothstep(look.cellTier[0], look.cellTier[1], rhoMajor);
        if (far > 0) {
          const o = layer * 5;
          for (let k = 0; k < 3; k++) c[k] += (mean[o + k] - c[k]) * far;
          m[0] += (mean[o + 3] - m[0]) * far; m[1] += (mean[o + 4] - m[1]) * far;
        }
      }
      const T = a.tints, A = a.accents;
      const wg = 1 + (look.wallGain - 1) * m[0];
      let luma = 0;
      for (let k = 0; k < 3; k++) {
        const tint = (T[i0 * 4 + k] * b0 + T[i1 * 4 + k] * b1 + T[i2 * 4 + k] * b2) / 255;
        const acc = (A[i0 * as + k] * b0 + A[i1 * as + k] * b1 + A[i2 * as + k] * b2) / 255;
        c[k] *= (1 + (tint - 1) * m[0]) * (1 + (acc - 1) * m[1]) * wg;
      }
      luma = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
      const glaze = (1 - smoothstep(0.06, 0.2, luma)) * (1 - m[0]);
      const lit = look.shadow && sunFacing(light, s.nx, s.ny, s.nz) > 0 ? look.shadow(s.px, s.py, s.pz, s.nx, s.ny, s.nz) : 1;
      lambert(light, s.nx, s.ny, s.nz, lit, irr);
      for (let k = 0; k < 3; k++) out[k] = linearToSrgb(Math.pow(Math.max(0, c[k]), 2.2) * irr[k] + SKY_TINT[k] * glaze);
      if (look.fog) look.fog(s.dist, out);
      out[3] = 1;
      return true;
    },
  };
}

