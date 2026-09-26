/** One-call retail lane: extracted ground-floor features in, renderable retail
 * patches out.
 *
 * This module is deliberately thin composition over `assembleStorefront` and
 * `compileRetail`. It invents no geometry, no sign text and no awning states;
 * both of those rules live in the modules it composes, so the shared facade
 * compiler can opt in to retail without bespoke per-address logic.
 *
 * Pure and deterministic, no Three.js or browser dependency.
 */

import {
  assembleStorefront,
  type FacadeFeature,
  type StorefrontAssembly,
} from './storefrontAssembly.ts';
import { compileRetail, type RetailPatch } from './retailCompiler.ts';

/** Extracted ground-floor features plus the pixel dimensions they were measured
 * against. `assembleStorefront` derives its own band from feature bounds, so the
 * dimensions are only needed for the pixel-to-metre mapping in `compileRetail`. */
export interface RetailSource {
  features: FacadeFeature[];
  imageDimensions: { width: number; height: number };
}

export interface RetailPatchResult {
  assembly: StorefrontAssembly;
  patches: RetailPatch[];
  confidence: 'high' | 'low';
  hasEntrance: boolean;
  hasDisplayWindow: boolean;
  signText: string | null;
}

export interface RetailPatchOptions {
  /** Passed through to `assembleStorefront`; upper-floor cut for the ground band. */
  groundBandTopFraction?: number;
  glassColour?: string;
  frameColour?: string;
  fasciaColour?: string;
}

/**
 * Assemble a storefront from `source` and compile it onto a wall of the given
 * metric size. Returns `null` when the frontage is not retail (no display
 * glazing), mirroring `assembleStorefront`.
 *
 * Degenerate wall/source dimensions do not throw: `compileRetail` abstains and
 * the result carries an empty `patches` array while still reporting the
 * assembled storefront summary.
 */
export function retailPatchesFromSource(
  source: RetailSource,
  wall: { widthM: number; heightM: number },
  options: RetailPatchOptions = {},
): RetailPatchResult | null {
  const assembly = assembleStorefront(source.features, {
    groundBandTopFraction: options.groundBandTopFraction,
  });
  if (assembly === null) return null;

  const patches = compileRetail(assembly, {
    wallWidthM: wall.widthM,
    wallHeightM: wall.heightM,
    sourceWidthPx: source.imageDimensions.width,
    sourceHeightPx: source.imageDimensions.height,
    glassColour: options.glassColour,
    frameColour: options.frameColour,
    fasciaColour: options.fasciaColour,
  });

  return {
    assembly,
    patches,
    confidence: assembly.confidence,
    hasEntrance: assembly.entrance !== null,
    hasDisplayWindow: assembly.displayWindows.length > 0,
    signText: assembly.signText,
  };
}
