/**
 * three's built-in surface materials as node-frame shaders (lane node-world-frames): MeshStandardMaterial (the own
 * ground, standard GLB materials), MeshLambertMaterial (normalised landmark materials) and MeshBasicMaterial (overlays),
 * under the shared frame's rig (light.ts), with no environment map, as the game draws them.
 *
 *   diffuseColor = color x sRGB-decoded map(uv x repeat + offset) x vertex colour (linear) x opacity
 *   standard:  direct  = sun n.l lit (Lambert(diffuse) + GGX(F0 0.04 or albedo, roughness))
 *              indirect = hemisphere irradiance / PI x diffuse x (1 - Fss Ess - Fms Ems) + Fms Ems irradiance / PI
 *              (three's computeMultiscattering with Karis' analytic DFG in place of its LUT)
 *   lambert:   light.ts lambert(); basic: the colour itself
 *   out = linearToSRGB(... + emissive), then the fog in sRGB.
 */
import { lambert, linearToSrgb, srgbToLinearFast, sunFacing, type SceneLight } from './light.ts';
import { sample2D, type Texture2D } from './texture.ts';
import type { ShadeInput, WorldMaterial } from './worldRaster.ts';
import type { FogFn, ShadowFn } from './chunkMaterial.ts';

export type SurfaceKind = 'standard' | 'lambert' | 'basic';

export type SurfaceSpec = {
  kind: SurfaceKind;
  /** Linear colour (three's Color). */
  color: [number, number, number];
  map?: Texture2D | null;
  /** UV transform of the map (three's Texture repeat / offset; ground textures repeat once per n metres). */
  repeat?: [number, number]; offset?: [number, number];
  roughness?: number; metalness?: number;
  emissive?: [number, number, number];
  opacity?: number;
  /** Alpha cutout (glTF MASK). */
  alphaTest?: number;
  /** Fog off for this material (three's `fog: false`). */
  noFog?: boolean;
  /** Lit by the rig's sun only through n.l, no cast shadow received (receiveShadow false). */
  noShadow?: boolean;
  /** The sun's specular lobe off (cheaper; the ground at roughness >= 0.85 barely shows one). */
  noSpecular?: boolean;
};

export type SurfaceArrays = {
  uvs?: ArrayLike<number> | null;
  /** Per-vertex colours, linear 0..1, `colorSize` per vertex (3 or 4). */
  colors?: ArrayLike<number> | null; colorSize?: number;
  /** Per-vertex normals (smooth shading); absent: the triangle's flat normal. */
  normals?: ArrayLike<number> | null;
};

export type SurfaceEnv = { light: SceneLight; shadow?: ShadowFn | null; fog?: FogFn | null; eye: readonly number[]; focal: number; anisotropy?: number };

const sat = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Karis' analytic DFG (three's legacy DFGApprox): (scale, bias) of F0 for a GGX lobe. */
export function dfgApprox(roughness: number, dotNV: number): [number, number] {
  const rx = roughness * -1 + 1, ry = roughness * -0.0275 + 0.0425, rz = roughness * -0.572 + 1.04, rw = roughness * 0.022 - 0.04;
  const a004 = Math.min(rx * rx, Math.pow(2, -9.28 * dotNV)) * rx + ry;
  return [-1.04 * a004 + rz, 1.04 * a004 + rw];
}

export function dfgApproxInto(roughness: number, dotNV: number, out: Float64Array): void {
  const rx = roughness * -1 + 1, ry = roughness * -0.0275 + 0.0425, rz = roughness * -0.572 + 1.04, rw = roughness * 0.022 - 0.04;
  const a004 = Math.min(rx * rx, Math.pow(2, -9.28 * dotNV)) * rx + ry;
  out[0] = -1.04 * a004 + rz; out[1] = 1.04 * a004 + rw;
}

/** GGX specular BRDF (three's BRDF_GGX: Schlick F, height-correlated Smith V, GGX D), f90 = 1. */
export function brdfGgx(L: readonly number[], V: readonly number[], N: readonly number[], f0: number, roughness: number): number {
  const a = roughness * roughness;
  let hx = L[0] + V[0], hy = L[1] + V[1], hz = L[2] + V[2];
  const hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
  const dotNL = sat(N[0] * L[0] + N[1] * L[1] + N[2] * L[2]), dotNV = sat(N[0] * V[0] + N[1] * V[1] + N[2] * V[2]);
  const dotNH = sat(N[0] * hx + N[1] * hy + N[2] * hz), dotVH = sat(V[0] * hx + V[1] * hy + V[2] * hz);
  const fres = Math.pow(2, (-5.55473 * dotVH - 6.98316) * dotVH), F = f0 * (1 - fres) + fres;
  const a2 = a * a, gv = dotNL * Math.sqrt(a2 + (1 - a2) * dotNV * dotNV), gl = dotNV * Math.sqrt(a2 + (1 - a2) * dotNL * dotNL);
  const Vis = 0.5 / Math.max(gv + gl, 1e-6), den = dotNH * dotNH * (a2 - 1) + 1, D = a2 / (Math.PI * den * den);
  return F * Vis * D;
}

export function surfaceMaterial(spec: SurfaceSpec, arr: SurfaceArrays, env: SurfaceEnv, positions: ArrayLike<number>): WorldMaterial {
  const { light } = env, aniso = env.anisotropy ?? 16;
  const rep = spec.repeat ?? [1, 1], off = spec.offset ?? [0, 0];
  const rough = Math.min(1, Math.max(0.0525, spec.roughness ?? 1)), metal = spec.metalness ?? 0;
  const dfg = new Float64Array(2), tex = new Float64Array(4), irr = new Float64Array(3), dc = [0, 0, 0];
  const Lv = light.toSun, V = [0, 0, 0], N = [0, 0, 0];
  const cs = arr.colorSize ?? 3;
  let lastTri = -1, texPerM = 0;
  return {
    shade(s: ShadeInput, out: Float64Array): boolean {
      const { i0, i1, i2, b0, b1, b2 } = s;
      dc[0] = spec.color[0]; dc[1] = spec.color[1]; dc[2] = spec.color[2];
      let alpha = spec.opacity ?? 1;
      const U = arr.uvs;
      if (spec.map && U) {
        const u = (U[i0 * 2] * b0 + U[i1 * 2] * b1 + U[i2 * 2] * b2) * rep[0] + off[0];
        const v = (U[i0 * 2 + 1] * b0 + U[i1 * 2 + 1] * b1 + U[i2 * 2 + 1] * b2) * rep[1] + off[1];
        const tri = i0 * 7919 + i1 * 31 + i2;
        if (tri !== lastTri) {
          lastTri = tri;
          const P = positions;
          const e1x = P[i1 * 3] - P[i0 * 3], e1y = P[i1 * 3 + 1] - P[i0 * 3 + 1], e1z = P[i1 * 3 + 2] - P[i0 * 3 + 2];
          const e2x = P[i2 * 3] - P[i0 * 3], e2y = P[i2 * 3 + 1] - P[i0 * 3 + 1], e2z = P[i2 * 3 + 2] - P[i0 * 3 + 2];
          const wa = Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x);
          const du1 = (U[i1 * 2] - U[i0 * 2]) * rep[0], dv1 = (U[i1 * 2 + 1] - U[i0 * 2 + 1]) * rep[1], du2 = (U[i2 * 2] - U[i0 * 2]) * rep[0], dv2 = (U[i2 * 2 + 1] - U[i0 * 2 + 1]) * rep[1];
          texPerM = wa > 0 ? Math.sqrt(Math.abs(du1 * dv2 - du2 * dv1) / wa) * Math.sqrt(spec.map.size[0] * spec.map.size[1]) : 0;
        }
        const minor = s.dist / env.focal, major = minor / Math.max(0.02, s.cosView);
        const rho = texPerM * Math.max(minor, major / aniso);
        sample2D(spec.map, u, v, rho > 0 ? Math.log2(rho) : 0, tex);
        dc[0] *= srgbToLinearFast(tex[0]); dc[1] *= srgbToLinearFast(tex[1]); dc[2] *= srgbToLinearFast(tex[2]);
        alpha *= tex[3];
      }
      const C = arr.colors;
      if (C) {
        dc[0] *= C[i0 * cs] * b0 + C[i1 * cs] * b1 + C[i2 * cs] * b2;
        dc[1] *= C[i0 * cs + 1] * b0 + C[i1 * cs + 1] * b1 + C[i2 * cs + 1] * b2;
        dc[2] *= C[i0 * cs + 2] * b0 + C[i1 * cs + 2] * b1 + C[i2 * cs + 2] * b2;
        if (cs === 4) alpha *= C[i0 * 4 + 3] * b0 + C[i1 * 4 + 3] * b1 + C[i2 * 4 + 3] * b2;
      }
      if (spec.alphaTest !== undefined && alpha < spec.alphaTest) return false;
      let nx = s.nx, ny = s.ny, nz = s.nz;
      const NN = arr.normals;
      if (NN) {
        nx = NN[i0 * 3] * b0 + NN[i1 * 3] * b1 + NN[i2 * 3] * b2; ny = NN[i0 * 3 + 1] * b0 + NN[i1 * 3 + 1] * b1 + NN[i2 * 3 + 1] * b2; nz = NN[i0 * 3 + 2] * b0 + NN[i1 * 3 + 2] * b1 + NN[i2 * 3 + 2] * b2;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        if (s.back) { nx = -nx; ny = -ny; nz = -nz; }
      }
      const em = spec.emissive;
      if (spec.kind === 'basic') {
        for (let k = 0; k < 3; k++) out[k] = linearToSrgb(dc[k]);
      } else {
        const lit = spec.noShadow || !env.shadow || sunFacing(light, nx, ny, nz) <= 0 ? 1 : env.shadow(s.px, s.py, s.pz, nx, ny, nz);
        if (spec.kind === 'lambert') {
          lambert(light, nx, ny, nz, lit, irr);
          for (let k = 0; k < 3; k++) out[k] = linearToSrgb(dc[k] * irr[k] + (em ? em[k] : 0));
        } else {
          V[0] = env.eye[0] - s.px; V[1] = env.eye[1] - s.py; V[2] = env.eye[2] - s.pz;
          const vl = Math.hypot(V[0], V[1], V[2]) || 1; V[0] /= vl; V[1] /= vl; V[2] /= vl;
          N[0] = nx; N[1] = ny; N[2] = nz;
          const dotNL = sat(nx * Lv[0] + ny * Lv[1] + nz * Lv[2]), dotNV = sat(nx * V[0] + ny * V[1] + nz * V[2]);
          const sunK = dotNL * (1 - light.shadowIntensity * (1 - lit));
          dfgApproxInto(rough, dotNV, dfg);
          const fa = dfg[0], fb = dfg[1], Ess = fa + fb, Ems = 1 - Ess, h = 0.5 * nz + 0.5;
          const spec1 = spec.noSpecular ? 0 : brdfGgx(Lv, V, N, 0.04, rough);
          for (let k = 0; k < 3; k++) {
            const diff = dc[k] * (1 - metal), f0 = 0.04 + (dc[k] - 0.04) * metal;
            const fss = f0 * fa + fb, favg = f0 + (1 - f0) * 0.047619, fms = fss * favg / (1 - Ems * favg);
            const hemi = light.ground[k] + (light.sky[k] - light.ground[k]) * h;
            const direct = light.sun[k] * sunK * (diff / Math.PI + (metal > 0 ? brdfGgx(Lv, V, N, f0, rough) : spec1));
            const fssD = 0.04 * fa + fb, favgD = 0.04 + 0.96 * 0.047619, fmsD = fssD * favgD / (1 - Ems * favgD);
            const indirect = hemi / Math.PI * (diff * (1 - (fssD + fmsD * Ems)) + fms * Ems);
            out[k] = linearToSrgb(direct + indirect + (em ? em[k] : 0));
          }
        }
      }
      if (env.fog && !spec.noFog) env.fog(s.dist, out);
      out[3] = alpha;
      return true;
    },
  };
}
