/**
 * Street class for the street-template ranking (streetTemplate.ts) and the family-default cells (complete.ts): `main` or
 * `side`. Main when the OSM highway class says so, when tram track runs along it, or when it ranks high for rides (mean ride
 * passes >= 5); street-classes.json, written by scripts/house-line/route-c/street-classes.ts, keeps the reason per street
 * (`why`). A street the table does not know is `side`.
 */
import TABLE from './street-classes.json' with { type: 'json' };

export type StreetClass = 'main' | 'side';
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const MAIN = new Set((TABLE as { main: string[] }).main.map(norm));
export function streetClassOf(street: string | null | undefined): StreetClass | null {
  if (!street) return null;
  return MAIN.has(norm(street)) ? 'main' : 'side';
}
