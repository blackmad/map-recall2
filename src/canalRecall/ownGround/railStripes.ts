// Rails as their own high-contrast layer on the ballast bed (lane R1-B #224, user shot S4 "railway lines are not crisp",
// Zuidas from the air, build 69d4c65). Pure (strings and numbers); gameGround.ts installs it on the ballast material.
//
// Before: the rails were two ±0.12 m dark stripes and five sleepers painted into one 256 px / 3.1 m ballast tile
// (gameGround.ts, issue #145) at ground anisotropy 4. Past ~100 m the mips averaged the stripes into the ballast
// (a 0.24 m stripe in a 3.1 m tile is 8 % of a texel row at mip 4) and beyond LOD 1 (350 m) the ridge rails are not
// built, so the corridors read as banded grey with faint lines. Sleepers (+16 luma) averaged into a hatch.
//
// Now (`?railStripes=1`, default): the tile is the ballast noise alone, and the fragment shader draws
//   stripes   two analytic stripes at the gauge in the rail tone (≥ 60 luma under the ballast), box-filtered by the
//             pixel's footprint across the track, so they stay continuous and dark at any distance and mip;
//   sleepers  analytic, faded to the ballast as a sleeper period drops under SLEEPER_FADE_PX pixels along the track,
//             instead of averaging into a hatch.
// `?railMinPx=1` (default) holds each stripe at least RAIL_MIN_PX wide on screen (the overview lines' rule,
// ownMap/layers.ts), so the rails do not thin out to nothing where LOD 1 drops the 0.14 m ridge rails: a far track
// reads as one or two dark lines on its bed. The stripes widen at most to RAIL_MIN_HALF_MAX_M (never over the bed).
// Both off: the baked tile exactly as before (gameGround paints it and installs nothing).

import { RAIL_SECTION, RAIL_STRIPE, RAIL_TONES, SLEEPER_TILE_M } from './railTracks.js';

/** Screen-space minimum stripe width, px. */
export const RAIL_MIN_PX = 1.25;
/** The widest a widened stripe gets (half, metres): under half the gauge, so a near track keeps two lines. */
export const RAIL_MIN_HALF_MAX_M = 0.5;
/** Sleepers per tile, their start and width along the track (metres): the baked tile's layout. */
export const SLEEPERS = { perTile: 5, start: 0.17, width: 0.26, u0: 0.25, u1: SLEEPER_TILE_M - 0.25 } as const;
/** Sleepers fade out as their period drops from FROM to TO px on screen (they never mip into a hatch). */
export const SLEEPER_FADE_PX = { from: 6, to: 2.5 } as const;

export interface RailStripeOptions { stripes: boolean; minPx: boolean }

const srgbToLinear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** Linear multipliers on the ballast's albedo that give the rail and sleeper tones. */
export const railStripeFactors = () => ({
  stripe: RAIL_STRIPE.tone.map((c, i) => srgbToLinear(c) / srgbToLinear(RAIL_TONES.ballast[i])),
  sleeper: RAIL_TONES.sleeper.map((c, i) => srgbToLinear(c) / srgbToLinear(RAIL_TONES.ballast[i])),
});
/** sRGB luma the stripes sit under the ballast (the brief: ≥ 60). */
export const RAIL_STRIPE_CONTRAST = luma(RAIL_TONES.ballast) - luma(RAIL_STRIPE.tone);

/** Stripe centres across the bed's top (u, metres): the rail heads at the gauge. */
export const railStripeCentres = (): [number, number] => [RAIL_SECTION.topHalf - RAIL_SECTION.gauge / 2, RAIL_SECTION.topHalf + RAIL_SECTION.gauge / 2];

/** CPU twin of the shader's stripe coverage at `u` (metres across the top) for a pixel `fu` metres wide across. */
export function stripeCoverage(u: number, fu: number, minPx: boolean): number {
  const half = minPx ? Math.min(RAIL_MIN_HALF_MAX_M, Math.max(RAIL_STRIPE.half, RAIL_MIN_PX * 0.5 * fu)) : RAIL_STRIPE.half;
  const w = Math.max(fu, 1e-6);
  let c = 0;
  for (const centre of railStripeCentres()) c = Math.max(c, Math.min(1, Math.max(0, (half - Math.abs(u - centre)) / w + 0.5)));
  return c;
}

/** CPU twin of the sleeper fade for a pixel `fv` metres long along the track. */
export function sleeperFade(fv: number): number {
  const periodPx = SLEEPER_TILE_M / SLEEPERS.perTile / Math.max(fv, 1e-6);
  const t = Math.min(1, Math.max(0, (periodPx - SLEEPER_FADE_PX.to) / (SLEEPER_FADE_PX.from - SLEEPER_FADE_PX.to)));
  return t * t * (3 - 2 * t);
}

const f = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const v3 = (a: readonly number[]) => `vec3(${a.map(x => f(+x.toFixed(5))).join(', ')})`;

/** The fragment edit, after `#include <map_fragment>` (needs USE_MAP: vMapUv is u, v over SLEEPER_TILE_M). */
export function railStripeGlsl(o: RailStripeOptions): string {
  const k = railStripeFactors(), [c0, c1] = railStripeCentres(), period = SLEEPER_TILE_M / SLEEPERS.perTile;
  const half = o.minPx ? `min(${f(RAIL_MIN_HALF_MAX_M)}, max(${f(RAIL_STRIPE.half)}, ${f(RAIL_MIN_PX * 0.5)} * railFu))` : f(RAIL_STRIPE.half);
  return /* glsl */`
#ifdef USE_MAP
{
  vec2 railM = vMapUv * ${f(SLEEPER_TILE_M)};
  float railU = mod(railM.x, ${f(SLEEPER_TILE_M)});
  float railFu = max(length(vec2(dFdx(railM.x), dFdy(railM.x))), 1e-5);
  float railFv = max(length(vec2(dFdx(railM.y), dFdy(railM.y))), 1e-5);
  // Sleepers: box-filtered bars across the top, faded to the ballast as their period nears a pixel or two.
  float railPeriodPx = ${f(period)} / railFv;
  float railSleeperFade = smoothstep(${f(SLEEPER_FADE_PX.to)}, ${f(SLEEPER_FADE_PX.from)}, railPeriodPx);
  float railS = mod(railM.y - ${f(SLEEPERS.start)}, ${f(period)});
  float railSd = min(abs(railS - ${f(SLEEPERS.width / 2)}), abs(railS - ${f(+(period + SLEEPERS.width / 2).toFixed(4))}));
  float railSleeper = clamp((${f(SLEEPERS.width / 2)} - railSd) / railFv + 0.5, 0.0, 1.0)
    * clamp((${f(+((SLEEPERS.u1 - SLEEPERS.u0) / 2).toFixed(4))} - abs(railU - ${f(+((SLEEPERS.u0 + SLEEPERS.u1) / 2).toFixed(4))})) / railFu + 0.5, 0.0, 1.0);
  diffuseColor.rgb *= mix(vec3(1.0), ${v3(k.sleeper)}, railSleeper * railSleeperFade);
  // The rails: two stripes at the gauge, full rail tone at their centre whatever the mip.
  float railHalf = ${half};
  float railC = max(clamp((railHalf - abs(railU - ${f(+c0.toFixed(4))})) / railFu + 0.5, 0.0, 1.0), clamp((railHalf - abs(railU - ${f(+c1.toFixed(4))})) / railFu + 0.5, 0.0, 1.0));
  diffuseColor.rgb *= mix(vec3(1.0), ${v3(k.stripe)}, railC);
}
#endif`;
}

/** A three.js material whose onBeforeCompile / customProgramCacheKey are already the ground's (groundMaterial.ts). */
interface PatchableMaterial { onBeforeCompile: (shader: { fragmentShader: string }, renderer: unknown) => void; customProgramCacheKey: () => string }

/**
 * Install the stripes on the ballast's base material, after groundProgram: its cut and fade clones call the base's
 * onBeforeCompile and key, so they draw the same program. Its own cache key, so no other ground layer shares it.
 */
export function installRailStripes(m: PatchableMaterial, o: RailStripeOptions): void {
  if (!o.stripes) return;
  const before = m.onBeforeCompile, key = m.customProgramCacheKey, glsl = railStripeGlsl(o), suffix = `-rails${o.minPx ? 'Min' : ''}1`;
  m.onBeforeCompile = (shader, renderer) => {
    before.call(m, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>${glsl}`);
  };
  m.customProgramCacheKey = () => `${key.call(m)}${suffix}`;
}

/** `?railStripes=0` / `window.__canalRecallRailStripes = false`: the baked tile as before. */
export function railStripesFlag(): boolean { return pageFlag('railStripes', '__canalRecallRailStripes'); }
/** `?railMinPx=0` / `window.__canalRecallRailMinPx = false`: stripes at their physical width only. */
export function railMinPxFlag(): boolean { return pageFlag('railMinPx', '__canalRecallRailMinPx'); }

/** `?farRail=0` / `window.__canalRecallFarRail = false`: no rail corridors in the far ring (farRing.ts). */
export function farRailFlag(): boolean { return pageFlag('farRail', '__canalRecallFarRail'); }

/** `?farRailDrape=0` / `window.__canalRecallFarRailDrape = false`: far rail bands sampled at their bends only (farRing.ts, #232). */
export function farRailDrapeFlag(): boolean { return pageFlag('farRailDrape', '__canalRecallFarRailDrape'); }

function pageFlag(param: string, global: string): boolean {
  try {
    const g = globalThis as Record<string, unknown> & { location?: { search?: string } };
    const asked = g[global] ?? (typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get(param) : null);
    return !(asked === false || asked === '0' || asked === 'false' || asked === 'off');
  } catch { return true; }
}
