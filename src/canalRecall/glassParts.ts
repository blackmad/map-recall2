/**
 * Glazed OSM parts (lane glass-parts-20261110, feedback fc427560 at IJdok).
 *
 * OSM tags a skybridge, an oriel or a glass atrium `building:material=glass` (or `mirror`, the Zuidas towers). The
 * building tiles used to drop the tag and keep only its colour prior, `#5a81a0` (scripts/lib/building-colors.ts), so
 * the own engine drew those parts as opaque, windowless blue boxes. The tiles now carry `material` for these values only
 * (scripts/building-tiles/stamp-glass-material.ts, build-lod1-tiles.ts), and the mesh gives the part the modern
 * archetype's curtain-wall cell on every wall: a glass band with mullions in an aluminium frame, the same texture array
 * and program as every other facade (no new material, no transparency, so nothing to depth-sort).
 *
 * Parts without the tag are untouched (pinned in glassParts.test.ts).
 */
import { BAY_STYLES, bayLayer } from './bayLook.js';
import { bayVariantOpenings } from './facadeOpenings.js';
import { cellSetOf, lookHex, type BuildingLook } from './look/palette.js';
import type { Look } from './bayTextures.js';
import type { MeshBuilding } from './threeBuildingMesh.js';
import type { GlazedMaterial } from './glazedMaterial.js';

export { GLAZED_MATERIALS, glazedMaterialOf, glazingOf, type GlazedMaterial } from './glazedMaterial.js';

/** The modern archetype's curtain-wall preset (bayLook.ts BAY_STYLES.modern, `family: 'curtain'`). */
export const CURTAIN_STYLE = BAY_STYLES.modern.findIndex(v => v.family === 'curtain');
/** The curtain cell's frame and spandrel (wall- and accent-tinted pixels): clear anodised aluminium, the IJdok bridge's
 *  fins and the usual Amsterdam office mullion. Mirror glass (the Zuidas towers, nhow RAI) reads silver on the 2024
 *  panorama, so its frame and spandrel are paler still, not the darker blue the glass band alone would give. */
export const GLAZING_FRAME_HEX: Record<GlazedMaterial, string> = { glass: '#bfc5c8', mirror: '#cfd3d5' };
export const GLAZING_SPANDREL_HEX: Record<GlazedMaterial, string> = { glass: '#8e9ba2', mirror: '#b4bcc0' };
/** The colour `materialColors.glass` gives an untagged glass part: a prior, not a mapped colour. */
const GLASS_PRIOR_HEX = '#5a81a0';

/**
 * Turn a glazed part into a curtain wall: every storey (ground and door bays too) in the curtain cell, frame and
 * spandrel tints, no shop, door, plinth, parapet, cornice or facade extras. A colour the mapper tagged (anything but the
 * material prior) tints the spandrels, so a coloured glass part keeps its hue. Procedural looks and `untextured` have
 * no curtain cell; the part draws as before there.
 */
export function applyGlazing(building: MeshBuilding, material: GlazedMaterial, look: BuildingLook, taggedColour?: unknown): boolean {
  const cells = cellSetOf(look);
  if (cells === 'procedural' || look === 'untextured' || CURTAIN_STYLE < 0) return false;
  const bayLook = cells as Look;
  const curtain = bayLayer('modern', CURTAIN_STYLE, 'upper');
  const tagged = typeof taggedColour === 'string' && /^#[0-9a-f]{6}$/i.test(taggedColour) && taggedColour.toLowerCase() !== GLASS_PRIOR_HEX && taggedColour.toLowerCase() !== '#d2c9bc' ? taggedColour : undefined;
  building.bare = false;
  building.plainWalls = false;
  building.style = 'modern';
  building.period = undefined;
  building.layers = { upper: curtain, ground: curtain, door: curtain };
  building.openings = bayVariantOpenings({ archetype: 'modern', kind: 'upper', ...BAY_STYLES.modern[CURTAIN_STYLE] }, bayLook);
  building.wallHex = lookHex(GLAZING_FRAME_HEX[material], bayLook);
  building.accentHex = lookHex(tagged ?? GLAZING_SPANDREL_HEX[material], bayLook);
  building.groundHex = undefined;
  building.shop = false; building.shopfront = false; building.signature = undefined; building.chain = undefined;
  building.parapetM = undefined; building.storeyScale = undefined; building.setbackCrown = false;
  building.layoutScale = { bay: 1, storey: 1, ground: 1, doorEvery: 1000 };
  building.extras = false; building.registerForce = undefined; building.stoop = undefined;
  return true;
}
