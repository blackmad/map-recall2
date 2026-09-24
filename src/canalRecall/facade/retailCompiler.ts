/** Turn a storefront assembly into concrete, metric, low-poly patch
 * primitives the shared facade compiler can emit.
 *
 * This lives strictly downstream of `assembleStorefront`: it invents no
 * geometry. Every patch is derived from a feature's source-pixel bounds mapped
 * linearly onto the wall rectangle. Absent or unknown awning states emit
 * nothing, and a fascia patch is never emitted without literal sign text.
 *
 * Pure and deterministic, no Three.js or browser dependency.
 */

import type { StorefrontAssembly } from './storefrontAssembly.ts';

/** A rectangle on the wall face. `xM` runs along the wall from its left edge,
 * `yM` runs up from the wall base; both in metres. */
export interface MetricRect {
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
}

export type RetailPatchKind =
  | 'display-glass'
  | 'entrance'
  | 'fascia'
  | 'awning-canopy'
  | 'awning-housing';

/** `role` names the architectural element; `kind` names the patch primitive. */
export interface RetailPatch {
  role: string;
  kind: RetailPatchKind;
  rect: MetricRect;
  colour?: string;
  text?: string;
}

export interface RetailCompileOptions {
  wallWidthM: number;
  wallHeightM: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
  glassColour?: string;
  frameColour?: string;
  fasciaColour?: string;
}

/** Rects thinner than this in either axis are noise, not renderable patches. */
const MIN_SIZE_M = 0.02;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high);

const nonEmpty = (value: string | undefined): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

function pixelBoundsToRect(
  bounds: [number, number, number, number],
  options: RetailCompileOptions,
): MetricRect {
  const [left, top, right, bottom] = bounds;
  const { wallWidthM, wallHeightM, sourceWidthPx, sourceHeightPx } = options;
  return {
    xM: (left / sourceWidthPx) * wallWidthM,
    yM: wallHeightM - (bottom / sourceHeightPx) * wallHeightM,
    widthM: ((right - left) / sourceWidthPx) * wallWidthM,
    heightM: ((bottom - top) / sourceHeightPx) * wallHeightM,
  };
}

/** Clamp a metric rect to the wall rectangle, or null when nothing (or only a
 * sub-centimetre sliver) survives. */
function clampToWall(
  rect: MetricRect,
  wallWidthM: number,
  wallHeightM: number,
): MetricRect | null {
  if (![rect.xM, rect.yM, rect.widthM, rect.heightM].every(Number.isFinite)) return null;
  const x0 = clamp(rect.xM, 0, wallWidthM);
  const x1 = clamp(rect.xM + rect.widthM, 0, wallWidthM);
  const y0 = clamp(rect.yM, 0, wallHeightM);
  const y1 = clamp(rect.yM + rect.heightM, 0, wallHeightM);
  const widthM = x1 - x0;
  const heightM = y1 - y0;
  if (widthM < MIN_SIZE_M || heightM < MIN_SIZE_M) return null;
  return { xM: x0, yM: y0, widthM, heightM };
}

const withColour = <T extends RetailPatch>(patch: T, colour: string | undefined): T =>
  colour === undefined ? patch : { ...patch, colour };

export function compileRetail(
  assembly: StorefrontAssembly,
  options: RetailCompileOptions,
): RetailPatch[] {
  const { wallWidthM, wallHeightM, sourceWidthPx, sourceHeightPx } = options;
  if (![wallWidthM, wallHeightM, sourceWidthPx, sourceHeightPx].every(Number.isFinite)) return [];
  if (wallWidthM <= 0 || wallHeightM <= 0 || sourceWidthPx <= 0 || sourceHeightPx <= 0) return [];

  const patches: RetailPatch[] = [];
  const emit = (
    role: string,
    kind: RetailPatchKind,
    feature: { bounds: [number, number, number, number] },
    colour: string | undefined,
    text?: string,
  ): void => {
    const rect = clampToWall(pixelBoundsToRect(feature.bounds, options), wallWidthM, wallHeightM);
    if (!rect) return;
    let patch: RetailPatch = { role, kind, rect };
    patch = withColour(patch, nonEmpty(colour));
    if (text !== undefined) patch = { ...patch, text };
    patches.push(patch);
  };

  if (assembly.entrance) {
    emit('door', 'entrance', assembly.entrance, assembly.entrance.colour ?? options.frameColour);
  }

  for (const window of assembly.displayWindows) {
    emit('shop-window', 'display-glass', window, options.glassColour);
  }

  const signText = typeof assembly.signText === 'string' && assembly.signText.trim().length > 0
    ? assembly.signText
    : null;
  if (assembly.fascia && signText !== null) {
    emit('sign', 'fascia', assembly.fascia, options.fasciaColour, signText);
  }

  const awning = assembly.awnings[0];
  if (awning) {
    if (assembly.awningState === 'extended') {
      emit('awning', 'awning-canopy', awning, awning.colour);
    } else if (assembly.awningState === 'retracted') {
      emit('awning', 'awning-housing', awning, awning.colour ?? options.frameColour);
    }
  }

  return patches;
}
