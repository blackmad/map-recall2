/**
 * Legacy landmark palette name -> shared-look `materialSlot` (see `buildingRecipe/recipeLook.ts` RECIPE_SLOTS).
 *
 * `scripts/landmarks/build-manual-landmarks.ts` builds landmark GLBs from a flat colour palette (`brick`, `stone`, `glass`, `dark`, ...).
 * Every material it writes now carries `materialSlot` + `tint` extras so the shared city look (atlas brick, glass gradient, roof cells)
 * can dress it, and the audit's `materialSlotCoverage` measures it. The mapping is by what the surface is, not by how it is coloured:
 *
 *   brick, greyBrick, red      -> brick     (masonry walls; red is painted brick/terracotta in the builders)
 *   stone, sandstone, concrete -> stone     (cut stone, dressed plinths, concrete cladding)
 *   white, pink, ochre         -> stucco    (rendered / painted wall)
 *   slate, bronze, copper      -> slate     (roofs and metal roof cladding; copper roofs are the only copper in the builders)
 *   glass                      -> glass
 *   dark                       -> door      (dark window voids, doors and dark cladding share the door tint)
 *   frame                      -> frame
 *   gold, blue, green          -> accent    (gilding, enamel, painted details)
 *
 * Decals (`decal-<hex>-lit|unlit`: lettering, signage, murals) keep their own colour and take `accent`; they are a coloured print and the
 * only surface the palette cannot name.
 */
export type LandmarkSlot = 'brick' | 'stucco' | 'accent' | 'stone' | 'frame' | 'door' | 'glass' | 'roofTile' | 'slate' | 'bitumen';

export const PALETTE_SLOT: Readonly<Record<string, LandmarkSlot>> = {
  brick: 'brick', greyBrick: 'brick', red: 'brick',
  stone: 'stone', sandstone: 'stone', concrete: 'stone',
  white: 'stucco', pink: 'stucco', ochre: 'stucco',
  slate: 'slate', bronze: 'slate', copper: 'slate',
  glass: 'glass', dark: 'door', frame: 'frame',
  gold: 'accent', blue: 'accent', green: 'accent',
};

/** Slot for a builder palette colour or a `decal-...` material name; undefined for names the builders do not use. */
export function landmarkSlot(materialName: string): LandmarkSlot | undefined {
  if (materialName.startsWith('decal-')) return 'accent';
  return PALETTE_SLOT[materialName];
}

/** The material extras a landmark builder writes: `{materialSlot, tint}` where tint is the surface's `#rrggbb` colour. */
export function slotExtras(materialName: string, hex: string): {materialSlot: LandmarkSlot; tint: string} | undefined {
  const materialSlot = landmarkSlot(materialName);
  return materialSlot && /^#[0-9a-f]{6}$/i.test(hex) ? {materialSlot, tint: hex.toLowerCase()} : undefined;
}
