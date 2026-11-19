/**
 * The four named regression rows for design units (handoff 2026-11-19 §2; sheets in map-recall2-screenshots
 * ui/2026-11-16-review-392 and ui/2026-11-16-de-pijp; David's verdicts on #392 and #393). Each row lists its expected
 * partition into buildings as designed, and the ordekaart object that holds each building.
 */
export interface RegressionRow {
  name: string;
  /** Expected units, each a list of 16-digit pand ids: the photographed row's fronts. */
  units: string[][];
  /** Further members the area join found in the same object (same BAG year, full height): corner and side-face pands
   *  outside the photographed run. Pinned so the test is exact; per unit, in the order of `units`. */
  found: string[][];
  objects: string[];
  note: string;
}

const P = (ids: number[]) => ids.map(n => `0363100012${String(n).padStart(6, '0')}`);

export const REGRESSION_ROWS: readonly RegressionRow[] = [
  { name: 'Marnixplein', units: [P([168305, 168300, 174907])], found: [P([174906])], objects: ['centrum:6588'],
    note: 'one 1891 building over three pands; drawn today as three houses with 4, 3 and 3 storeys and three roofs (#392)' },
  { name: 'Goudsbloemstraat', units: [P([172514, 172469, 172468, 172467, 172466, 172470, 168668])], found: [P([168626])], objects: ['centrum:22'],
    note: 'one building over seven pands; drawn today in three treatments with mixed storeys (#392)' },
  { name: 'Rustenburgerstraat', units: [P([119632, 166734, 157322]), P([159752, 236414]), P([156003])], found: [[], [], P([157523, 165571, 165889])], objects: ['ring:8276', 'ring:8275', 'ring:8274'],
    note: 'three 1896 designs (Stork, Oostveen, Vlaanderen) over six pands; drawn today as one flat type (#393)' },
  { name: 'Van Ostadestraat', units: [P([160643, 159402]), P([160667, 156658]), P([153176, 158962]), P([156774, 163030, 153534, 156780])], found: [P([161193, 163999, 164736, 165987, 166070]), [], [], []], objects: ['ring:8815', 'ring:8794', 'ring:8792', 'ring:8793'],
    note: 'four designs by four architects over ten pands; drawn today as one type grouped by height (#393)' },
];
