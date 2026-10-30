/**
 * Where an OSM building part starts above the ground. `min_height` is metres;
 * `building:min_level` is storeys, and was read as metres until 2026-10-30,
 * so the bridging buildings over Kerkstraat and Reguliersdwarsstraat stood
 * 1 m off the street and closed it. A storey is the part's own height over its
 * levels when both are tagged, otherwise STOREY_M (the `levels * 3` the
 * height default already uses).
 */
export const STOREY_M = 3;
/** Thickness of a canopy drawn from a `roof` outline with no tagged base. */
export const ROOF_SLAB_M = 1;

const num = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export function osmMinHeightM(tags: Readonly<Record<string, unknown>>, heightM: number | null = num(tags.height)): number {
  const metres = num(tags.min_height);
  if (metres !== null) return Math.max(0, metres);
  const minLevel = num(tags['building:min_level']);
  // A roof is a canopy (bus station, petrol station): a slab under its top, not a block.
  if ((minLevel === null || minLevel <= 0) && (tags.building === 'roof' || tags['building:part'] === 'roof'))
    return heightM !== null && heightM > ROOF_SLAB_M + 2 ? heightM - ROOF_SLAB_M : 0;
  if (minLevel === null || minLevel <= 0) return 0;
  const levels = num(tags['building:levels']);
  const storey = heightM !== null && levels !== null && levels > 0 ? heightM / levels : STOREY_M;
  const start = minLevel * storey;
  // Never at or above the top: a part needs some wall to draw.
  return heightM !== null ? Math.min(start, Math.max(0, heightM - 1)) : start;
}
