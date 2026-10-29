// The wall colour a street chunk draws head-on for a house palette, before the look's exposure: what
// scripts/look/build-chunk-wall-exposure.ts (and face-wall-exposure.ts) compare with the strip wall as `stripOverDrawn`.
//
// A measured wall (`palette.wallTint: "measured"` or `wallMaterial: "painted-brick"`) exports `tintSource: measured`
// (buildingRecipe/oudWest.ts `markPaintedBrick`), so the look draws `cityMeasuredWallTint` (the colour itself over the
// brick cell, no city brick clamp) and normalises it by its own recorded white. Until 2026-10-29 the exposure check read
// such a wall through `cityWallTint` (L clamped to 0.3-0.6, S floored at 0.12), so a pale or grey measured wall counted
// as off-tone when it was drawn exactly (Oud-West kit, #98).
import { BRICK_CELL_MEAN, MEASURED_TINT_SOURCE, cityTint, hexToRgb } from './palette.ts';

export interface DrawnWallPalette { brick: string; wallMaterial?: string; wallTint?: string }

/** Whether the palette's wall is drawn as a measured tint. */
export const isMeasuredWall = (p: DrawnWallPalette) => p.wallTint === 'measured' || p.wallMaterial === 'painted-brick';

/** The wall tint the look draws for this palette (`brick` already a hex swatch). */
export function drawnWallTint(p: DrawnWallPalette): string {
  if (p.wallMaterial === 'stucco') return cityTint('stucco', p.brick);
  return cityTint('brick', p.brick, isMeasuredWall(p) ? MEASURED_TINT_SOURCE : undefined);
}

/** Rec. 709 luma (sRGB bytes) of the wall drawn head-on: the tint times the brick cell mean (the texture it multiplies). */
export function drawnWallLuma(p: DrawnWallPalette): number {
  const [r, g, b] = hexToRgb(drawnWallTint(p));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) * (p.wallMaterial === 'stucco' ? 1 : BRICK_CELL_MEAN);
}
