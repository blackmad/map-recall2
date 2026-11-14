/**
 * One wall-colour rule for the three wall paths (`?wallRule=1`, Node `WALL_RULE=1`; default off, byte-identical off):
 *
 *  - the kit and every installed GLB: a brick/accent slot's tint (cityLook.ts `slotForMaterial`, tileBuildings/writeTile.ts
 *    `gltfSlot`, buildingRecipe/likeness.ts `gameColour`);
 *  - the ordinary mesher: a house spec's wall (houseSpec/decorate.ts `specWallColour`, the `specWallDisplay` lift);
 *
 * A measured or record wall colour is drawn as measured: it takes the measured-tint path (palette.ts
 * `cityMeasuredWallTint`, the colour itself over the brick cell) instead of `cityWallTint`'s lift (palette.ts:593,
 * L -> 0.12 + 0.9 L clamped to 0.3-0.6, S floored at 0.12; measured on the front records 2026-11-13 as OKLab
 * L' = 0.150 + 0.847 L, +0.08 L on a dark brick: the "model path lightens dark walls" complaint), and a spec's measured
 * pixel skips the spec lift. Unmeasured or guessed walls keep today's city tint: a GLB tint that is one of the named
 * palette guesses below (the kit's SWATCHES, the landmark builders' default palette) and a spec wall that is a family
 * tone standing in for a trim misread (`specWallSource` fromPixel false).
 */

let cached: boolean | undefined;
/** The flag from a query string (`wallRule=1|on|true`) or an env value; anything else is off. */
export function wallRuleEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]wallRule=(\w+)/.exec(search)?.[1] : undefined, v = q ?? env ?? '';
  return v === '1' || v === 'on' || v === 'true';
}
/** The flag as the runtime sees it: the page's query in a browser, WALL_RULE in Node. Read once. */
export function wallRuleOn(): boolean {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = wallRuleEnabled(g.location?.search ?? null, g.process?.env?.WALL_RULE ?? null));
}
/** Tests and tools only: force the flag (undefined = read it again). */
export const setWallRuleFlag = (on?: boolean) => { cached = on; };

/**
 * Wall tints that are a named guess, not a reading: the kit's SWATCHES (buildingRecipe/intent.ts; the test pins the copy)
 * and the landmark builders' default palette (`brick`, `greyBrick`, `red` of scripts/landmarks/*: #9a5240, #7d7871, #ac624e).
 */
export const GUESSED_WALL_TINTS: ReadonlySet<string> = new Set([
  '#7a3e2c', '#4e3027', '#9a5236', '#b39468', '#6d6560', '#2a2a2a', '#e6e2d8', '#d9ccaa', '#9a9a94', '#c8bb9c',
  '#ece9e0', '#e4dcc4', '#26392f', '#1e1e1e', '#5a2224', '#23303f', '#7c7f7c', '#4a3426', '#7a5a3a',
  '#9a5240', '#7d7871', '#ac624e',
]);

export type WallProvenance = 'measured' | 'guessed';
/** A GLB wall slot's provenance: tagged measured, else a named guess, else a specific colour (record or reading). */
export function glbWallProvenance(tint: string, source?: string | null): WallProvenance {
  if (source === 'measured') return 'measured';
  return GUESSED_WALL_TINTS.has(tint.toLowerCase()) ? 'guessed' : 'measured';
}
/** The tint source a GLB slot is drawn with: unchanged with the rule off or off the wall slots; `measured` for a measured wall. */
export function ruledSlotSource<S extends string>(slot: string, tint: string, source: S | undefined): S | 'measured' | undefined {
  if (!wallRuleOn() || source === 'measured' || (slot !== 'brick' && slot !== 'accent')) return source;
  return glbWallProvenance(tint, source) === 'measured' ? 'measured' : source;
}
/** A spec wall under the rule: the measured pixel as is; a family tone (a guess) or the rule off keeps the spec lift. */
export function ruledSpecWall(src: { hex: string; fromPixel: boolean }, lifted: () => string): string {
  return wallRuleOn() && src.fromPixel ? src.hex : lifted();
}
