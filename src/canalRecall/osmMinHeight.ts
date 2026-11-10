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
/**
 * Top of a canopy drawn from a `roof` outline with no tagged height or levels (lane newbuild-kit, feedback
 * 2c486751): an entrance canopy, petrol station or shelter roof stands about one tall storey up. The building default
 * (9 m) put such an outline at 8-9 m, a slab sticking out of a facade at the third floor (Danzigerkade "Ydek"
 * w848883149, whose real canopy rings the glazed ground floor at about 5 m). Measured on the 2025 panorama.
 */
export const ROOF_CANOPY_TOP_M = 5;
/** Untagged roof outlines this large are station and market roofs, which stand higher: they keep the 9 m default. */
export const LARGE_CANOPY_M2 = 1000;
/** The default height (m) for an OSM outline with no `height` and no `building:levels`. */
export const OSM_DEFAULT_HEIGHT_M = 9;

const num = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const isRoofOutline = (tags: Readonly<Record<string, unknown>>) => tags.building === 'roof' || tags['building:part'] === 'roof';

/**
 * Height (m) of an OSM outline: `height`, else `building:levels` x 3, else a canopy's ROOF_CANOPY_TOP_M for an
 * untagged roof outline under LARGE_CANOPY_M2, else OSM_DEFAULT_HEIGHT_M.
 */
export function osmHeightM(tags: Readonly<Record<string, unknown>>, footprintM2: number): number {
  const height = num(tags.height);
  if (height !== null) return height;
  const levels = num(tags['building:levels']);
  if (levels) return levels * STOREY_M;
  return isRoofOutline(tags) && num(tags.min_height) === null && footprintM2 < LARGE_CANOPY_M2 ? ROOF_CANOPY_TOP_M : OSM_DEFAULT_HEIGHT_M;
}

/** A published tile feature drawn as a canopy slab (an OSM outline exactly ROOF_SLAB_M thick, lifted off the ground). */
export function isRoofCanopySlab(p: Readonly<Record<string, unknown>>): boolean {
  const id = String(p.id ?? ''), min = Number(p.minHeight), top = Number(p.height);
  return /^[wr]\d/.test(id) && min > 0 && Math.abs(top - min - ROOF_SLAB_M) < 1e-6;
}

export function osmMinHeightM(tags: Readonly<Record<string, unknown>>, heightM: number | null = num(tags.height)): number {
  const metres = num(tags.min_height);
  if (metres !== null) return Math.max(0, metres);
  const minLevel = num(tags['building:min_level']);
  // A roof is a canopy (bus station, petrol station): a slab under its top, not a block.
  if ((minLevel === null || minLevel <= 0) && isRoofOutline(tags))
    return heightM !== null && heightM > ROOF_SLAB_M + 2 ? heightM - ROOF_SLAB_M : 0;
  if (minLevel === null || minLevel <= 0) return 0;
  const levels = num(tags['building:levels']);
  const storey = heightM !== null && levels !== null && levels > 0 ? heightM / levels : STOREY_M;
  const start = minLevel * storey;
  // Never at or above the top: a part needs some wall to draw.
  return heightM !== null ? Math.min(start, Math.max(0, heightM - 1)) : start;
}
