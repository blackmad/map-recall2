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
  /** The member's window columns: its own D1 read, else the era prior by plot width (eraWindows). Set only for a
   *  pre-1920 segment; the mesher lays them out across the member's own front (the plot is the module, not the segment). */
  bays?: number;
  /** The segment's window pitch (m; module / era count): a member run that is not exactly its slice draws round(run / pitch). */
  bayPitchM?: number;
  /** AHN roof mass over the eaves line (m): a roof storey only at ROOF_STOREY_MIN_M or more (draw.ts segmentRoof). */
  roofRiseM?: number;
  /** The segment's look traits for the bay preset (bayLook spec): the members' read consensus, else the era prior
   *  (1860-1919 Ring fronts: light frames, tall sashes). */
  look?: { dark?: boolean; pale?: boolean; arch?: boolean; tall?: boolean; sash?: 'plain' | 'transom' | 'paired-transom' | 'six-over-six' };
  /** Round 2 (#399: "over aggressively collapsing buildings"): the unit is a family and each plot is its own house. The
   *  plot's seed (segment seed + its one-facade group, else its pand) picks its door place, its wall tone inside the family
   *  (PLOT_TONE_DL) and its dressing among the family's components. */
  plotSeed?: string;
  /** The plot's cornice height (m): its own AHN front p90 clamped to PLOT_EAVES_M of the segment line; else the line. */
  plotEavesM?: number;
  /** Party-wall breaks at the plot's two ends as seen from the street: false where the neighbour on that side is the same
   *  facade (one-facade evidence), so a merged group draws one continuous front. */
  plotBreak?: { left: boolean; right: boolean };
  /** The segment's photo evidence of a roof storey (segments.ts `roofEvidence`): drawn inside the measured top. */
  roofEvidence?: { storey: boolean; dormer?: 'pediment' | 'gabled' | 'plain'; hoist?: boolean; form?: 'mansard' | 'dormers'; source: string; roofSource?: 'photo' | 'reads' | 'default' };
}

/** A plot's cornice stays this close to its segment's eaves line (m). */
export const PLOT_EAVES_M = 0.3;
/** A plot's wall tone stays this close to its family's brick (OKLab L). */
export const PLOT_TONE_DL = 0.03;

/**
 * Window columns of a 1860-1919 Ring front by plot width (the plot is the module): about 2 under 4.8 m, 3 from 4.8 to
 * 7.5 m, 4 to 9.5 m, then one per 2.3 m. That puts the pitch at about 1.7-2.4 m, as the photographed rows have it.
 */
export function eraWindows(widthM: number): number {
  if (!(widthM > 0)) return 1;
  if (widthM < 4.8) return widthM < 2.6 ? 1 : 2;
  if (widthM < 7.5) return 3;
  if (widthM < 9.5) return 4;
  return Math.max(4, Math.round(widthM / 2.3));
}
/** The design-unit tier draws its era rules for segments built in these years (the 19th-century Ring layer). */
export const ERA_YEARS = { from: 1860, to: 1919 } as const;

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
