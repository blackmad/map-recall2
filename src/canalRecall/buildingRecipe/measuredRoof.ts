/**
 * A large recipe's flat-roof colour from the roof-facts sidecar (PDOK orthophoto, `roofs/roofSlots.ts`).
 *
 * The kit draws a flat roof in its material's flat grey, which the look maps by lightness onto the flat-roof priors
 * (`cityRoofTint`: the buff gravel above L 0.40, dark bitumen below). Over a buff or grey render that prior can land
 * within a few ΔE of the walls, and the block reads as one slab from the street (Kinkerstraat 89-105, 2026-10-16).
 * The city already knows what each pand's roof looks like from above; a measured fact gives the colour the city drew
 * the same pand in before the install (`roofSlotHex`), carried by intent `roof.flat` and exported as measured.
 */
import { MIN_CONFIDENCE, roofSlotHex, type RoofFact, type RoofSlot } from '../roofs/roofSlots.ts';

/** Slots a flat roof can honestly take from the photo: tiles are pitched (a flat roof reading red is a misread). */
const FLAT_ROOF_FROM: ReadonlySet<RoofSlot> = new Set(['gravel', 'bitumen-dark', 'bitumen-light', 'white-membrane', 'slate', 'zinc', 'sedum', 'terrace']);

export interface FlatRoofReading { hex: string; slot: RoofSlot; confidence: number; rgb: readonly [number, number, number] }

/** The flat-roof colour for a fact, or null (no fact, below the confidence floor, or a slot a flat roof cannot take). */
export function flatRoofFromFact(fact: RoofFact | null | undefined): FlatRoofReading | null {
  if (!fact || fact.confidence < MIN_CONFIDENCE || !FLAT_ROOF_FROM.has(fact.slot)) return null;
  return { hex: roofSlotHex(fact.slot, fact.rgb), slot: fact.slot, confidence: fact.confidence, rgb: fact.rgb };
}

/** Slots a pitched roof can take from the photo (the classifier's pitched readings: `classifyRoof` with a pitched roof code). */
const PITCHED_ROOF_FROM: ReadonlySet<RoofSlot> = new Set(['slate', 'zinc', 'pantile-red', 'pantile-dark']);

/**
 * The pitched-roof colour for a fact, or null (no fact, below the confidence floor, or a flat-roof slot). Issue #73
 * (2026-10-25, "dark, dour"): a large recipe's pitched classes drew the kit's slate #3b4047, which the look maps onto
 * the city's darkest slate tone, while the same pand's orthophoto reads a mid grey (median slate fact rgb ~130).
 */
export function pitchedRoofFromFact(fact: RoofFact | null | undefined): FlatRoofReading | null {
  if (!fact || fact.confidence < MIN_CONFIDENCE || !PITCHED_ROOF_FROM.has(fact.slot)) return null;
  return { hex: roofSlotHex(fact.slot, fact.rgb), slot: fact.slot, confidence: fact.confidence, rgb: fact.rgb };
}

/**
 * Whether a pitched reading may colour a roof of the intent's `material`: the reading recolours, it never changes what
 * the roof is. Tiles (pantile-red, pantile-dark) only on a tiled material; greys (slate, zinc) on slate, zinc, bitumen
 * and black tile (glazed black tile reads grey from above). Copper stays authored (its green is the identity).
 */
export function pitchedFitsMaterial(slot: RoofSlot, material: string): boolean {
  if (slot === 'pantile-red') return material === 'red-tile';
  if (slot === 'pantile-dark') return material === 'red-tile' || material === 'black-tile';
  return ['slate', 'zinc', 'bitumen', 'black-tile'].includes(material);
}
