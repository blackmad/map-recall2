/**
 * Street class for the street-template ranking (streetTemplate.ts) and the family-default cells (complete.ts): `main` or
 * `side`, from the OSM highway classes of the street's named ways (street-classes.json, written by
 * scripts/house-line/route-c/street-classes.ts; the rule is in that script). A street the table does not know is `side`.
 * Known gap: a tram street mapped `residential` (Vijzelstraat, Leidsestraat) reads as side.
 */
import TABLE from './street-classes.json' with { type: 'json' };

export type StreetClass = 'main' | 'side';
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const MAIN = new Set((TABLE as { main: string[] }).main.map(norm));
export function streetClassOf(street: string | null | undefined): StreetClass | null {
  if (!street) return null;
  return MAIN.has(norm(street)) ? 'main' : 'side';
}
