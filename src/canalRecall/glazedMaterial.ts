/**
 * Which OSM materials the building tiles carry (lane glass-parts-20261110): glass and mirror only, because the mesh draws
 * them as a curtain wall (glassParts.ts). Dependency-free, so the tile builders and the stamp script can import it.
 */
/** OSM material values the tiles carry, because the mesh draws them as glazing. Everything else stays off the wire. */
export const GLAZED_MATERIALS = ['glass', 'mirror'] as const;
export type GlazedMaterial = (typeof GLAZED_MATERIALS)[number];

/** The OSM keys that state a wall's material, most specific first. */
const MATERIAL_KEYS = ['building:facade:material', 'facade:material', 'building:material'] as const;

/** `glass` / `mirror` when an OSM tag set states a glazed wall; undefined otherwise. */
export function glazedMaterialOf(tags: Record<string, unknown> | undefined | null): GlazedMaterial | undefined {
  if (!tags) return undefined;
  for (const key of MATERIAL_KEYS) {
    const raw = tags[key];
    if (typeof raw !== 'string') continue;
    const value = raw.split(';')[0].trim().toLowerCase();
    if (value) return (GLAZED_MATERIALS as readonly string[]).includes(value) ? value as GlazedMaterial : undefined;
  }
  return undefined;
}

/** A tile feature's `material` when it is a glazing value. */
export const glazingOf = (p: Record<string, unknown>): GlazedMaterial | undefined =>
  typeof p.material === 'string' && (GLAZED_MATERIALS as readonly string[]).includes(p.material) ? p.material as GlazedMaterial : undefined;
