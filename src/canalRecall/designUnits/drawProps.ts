/**
 * Design units (T2, `?designUnits=1`): the property the decoration pass (designUnits/draw.ts withDesignUnits) stamps on a
 * member pand of a multi-pand segment, and that the facade, roof and mesh code read in place of the pand id. Kept free of
 * imports so the leaf modules (genericFacades, roofMesh, threeBuildingFeatures, threeBuildingMesh) can read it without
 * pulling the decorator in. Absent (flag off, a one-pand segment, a pand in no segment): every reader behaves as before.
 */
export interface DesignUnitDraw {
  /** The segment's seed: every per-building prior hashes on it instead of the pand id. */
  seed: string;
  segment: string;
  /** The segment's eaves line (m); null when the segment has none (then heights stay the pand's own). */
  eavesM: number | null;
  /** The member's slice on its main street (its longest slice), metres from the segment's left end on that street. */
  street: string;
  fromM: number;
  toM: number;
  /** The segment's module on that street: the median member slice width (m). The bay pitch divides it evenly. */
  moduleM: number;
  /** Its place among the segment's members on that street (left to right) and their count. */
  k: number;
  n: number;
  /** The segment's anchor (lng, lat) when the extract states one: where the measured wall pool looks for every member, so
   *  they draw one wall. Absent: no pool draw for members (each member's own point drew a different wall). */
  at?: readonly [number, number];
  /** Listed in the segment's exceptions: read off the line, drawn at it. */
  exception?: true;
}

/** The stamped draw, validated; null when absent or malformed. */
export function designUnitOf(p: Record<string, unknown> | null | undefined): DesignUnitDraw | null {
  const d = p?.designUnit as Partial<DesignUnitDraw> | undefined;
  if (!d || typeof d !== 'object' || typeof d.seed !== 'string' || !d.seed) return null;
  if (!Number.isFinite(d.fromM) || !Number.isFinite(d.toM) || !(d.toM! > d.fromM!) || !(Number(d.moduleM) > 0)) return null;
  return d as DesignUnitDraw;
}

/**
 * The bay count of a member's slice when the segment's rhythm (one bay pitch `bayM`) is laid out once along its frontage
 * from the segment's left end: the slice owns the bays between the grid lines nearest its two ends, so each party wall
 * falls on a grid line and the columns run on across it. At least one bay.
 */
export function sliceBays(fromM: number, toM: number, bayM: number): number {
  if (!(bayM > 0)) return 1;
  return Math.max(1, Math.round(toM / bayM) - Math.round(fromM / bayM));
}
/**
 * The segment's bay pitch: the module (median member width) split into the whole number of bays nearest the style's
 * pitch `nominalM`, so a member one module wide draws exactly that many bays and every party wall of a designed row
 * falls on the grid (Van Ostadestraat 5.2 m houses on a 3.6 m cell: one cell each, not one and two).
 */
export function segmentBayM(moduleM: number, nominalM: number): number {
  if (!(moduleM > 0) || !(nominalM > 0)) return nominalM;
  return moduleM / Math.max(1, Math.round(moduleM / nominalM));
}

/** The id every per-building prior hashes on: the segment seed for a segment member, else the pand id. */
export function seedIdOf(p: Record<string, unknown> | null | undefined): string {
  const d = p?.designUnit as { seed?: unknown } | undefined;
  return d && typeof d.seed === 'string' && d.seed ? d.seed : String(p?.id ?? '');
}
