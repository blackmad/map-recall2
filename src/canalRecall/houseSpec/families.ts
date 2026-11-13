/**
 * Build-year families (PR1's, scripts/house-line/structure/paired.ts) and the raised crowns, shared by the route-C completer
 * (complete.ts) and the generator of its family defaults (scripts/house-line/route-c/family-defaults.ts).
 */
export const FAMILIES = [
  { id: 'before-1800', from: null, to: 1800 },
  { id: '1800-1879', from: 1800, to: 1880 },
  { id: '1880-1919', from: 1880, to: 1920 },
  { id: '1920-1944', from: 1920, to: 1945 },
  { id: 'after-1944', from: 1945, to: null },
] as const;
export type FamilyId = typeof FAMILIES[number]['id'] | 'unknown';

/** The build-year family of a BAG year (`unknown` when the year is missing or implausible). */
export function familyOf(year: number | null | undefined): FamilyId {
  if (!year || !Number.isFinite(year) || year < 1200) return 'unknown';
  return FAMILIES.find(f => (f.from === null || year >= f.from) && (f.to === null || year < f.to))!.id;
}

/** Crowns that rise over the eaves as a gable (the intent GABLES minus cornice, flat). */
export const RAISED_GABLES: readonly string[] = ['spout', 'neck', 'raised-neck', 'bell', 'step', 'point', 'shouldered'];
