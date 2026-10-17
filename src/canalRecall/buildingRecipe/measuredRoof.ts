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
