/**
 * Row coherence for block faces (user, 2026-10-16: "you probably could have guessed that one house here isn't higher
 * than the rest"). A typed row (consecutive houses placing one house type, built within two years of each other) was
 * built as one design, so its cornice is one line and its roof one ridge. 3DBAG LoD2.2 reads the eaves of some
 * members off a mansard's flat top or a rear roof carried out to the facade: on Kinkerstraat 315-359 (18 pands of
 * `kinker-1902-balcony-axis`, 1903) the survey eaves split into 12.9-13.9 m (the cornice) and 14.5-16.1 m (the flat
 * top), and the bell-gable pand 343 would have crowned at 18.6 m. The lane hand-fixed eight with `measuredEaves`;
 * this module reproduces those eight from the row alone.
 *
 * Thresholds: LoD2.2 noise within one cornice is 2-8 cm (the cornice-group snap accepts 0.8 m), the misread is
 * 2.5-3.5 m, and a real difference between same-type same-year neighbours is at least a half storey (1.15 m), so a
 * member more than `thresholdM` (0.8) off the row line is a misread unless its photo skyline confirms it within
 * `skylineToleranceM`. The row line is the median of the strip measurements when at least half the members carry one
 * (a single measured member is its own evidence, not the row's: Kinkerstraat 224 is the one house of its row with an
 * attic storey, measured at 14.5 m over neighbours at 13.2-14.0 m), else the mode of the unmeasured members' 3DBAG
 * eaves: the densest half-threshold window (every street front of a member is a sample; a misread is always upward, so
 * a tie goes to the lower window), refined by mean shift (the median of the samples within a half threshold, until
 * stable). Single linkage would chain the Kinkerstraat 315-359 cornice readings 13.0-13.9 m into the flat-top readings
 * 14.5-16.1 m through the 0.7 m gap, and a full-threshold window lands between the two cornice lines of Kinkerstraat
 * 206-242 (13.4 and 13.95 m, one type run) instead of on one of them. A type run can hold two genuine cornice lines
 * (Kinkerstraat 212-220 and 222-228: one type, one year, 0.6-0.8 m apart): three or more adjacent members whose 3DBAG
 * eaves agree within `agreeM` are a sub-row on its own line and are never clamped (a misread is per house: the flat top
 * of a mansard, a rear roof; the two adjacent misreads of Kinkerstraat 319-321 agree too, so a pair is not enough).
 * Ridges: 3DBAG ridge noise within a row is centimetres; a roof
 * max more than `ridgeThresholdM` over the row's median ridge is capped at the ridge plus `ridgeCapAboveM`. Explicit
 * `measuredEaves` always win.
 */
import type {BuildingFacts} from '../buildingRecipe/facts.ts';

export const ROW_COHERENCE = {
  /** A member's eaves this far off the row line (and not confirmed by its skyline) takes the line. */
  thresholdM: 0.8,
  /** A member's roof max this far over the row ridge is capped. */
  ridgeThresholdM: 0.2,
  /** The cap: the row ridge plus this. */
  ridgeCapAboveM: 0.1,
  /** A photo skyline within this of the member's own eaves confirms it (a genuinely lower or higher house). */
  skylineToleranceM: 0.4,
  minMembers: 3,
  /** Adjacent members whose 3DBAG eaves agree within this form a sub-row (three or more). */
  agreeM: 0.15,
  /** The row line is the lowest eaves window holding at least this share of the densest window's samples. */
  windowShare: 0.7,
  /** Members' build years within this of the row's modal year. */
  yearSpread: 2,
};

export interface RowHouse { pandId: string; typeId?: string; builtYear: number | null }

/** Consecutive houses (indices) placing one type, built within `yearSpread` of the run's modal year; rows of `minMembers` or more. */
export function findRows(houses: RowHouse[], opts: {minMembers?: number; yearSpread?: number} = {}): number[][] {
  const min = opts.minMembers ?? ROW_COHERENCE.minMembers, spread = opts.yearSpread ?? ROW_COHERENCE.yearSpread, rows: number[][] = [];
  for (let i = 0; i < houses.length;) {
    const t = houses[i].typeId;
    if (!t) { i++; continue; }
    let j = i;
    while (j < houses.length && houses[j].typeId === t) j++;
    const run = houses.slice(i, j).map((h, k) => ({i: i + k, year: h.builtYear}));
    const years = run.map(r => r.year).filter((y): y is number => y !== null);
    if (years.length) {
      const count = new Map<number, number>();
      for (const y of years) count.set(y, (count.get(y) ?? 0) + 1);
      const modal = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      const members = run.filter(r => r.year !== null && Math.abs(r.year - modal) <= spread).map(r => r.i);
      if (members.length >= min) rows.push(members);
    }
    i = j;
  }
  return rows;
}

export interface RowMember {
  i: number; pandId: string;
  /** The first street front's fitted eaves (the party-line verdicts use it) and every street front's (modules of one pand each read their own 3DBAG profile). */
  eavesM: number; frontEavesM?: Record<string, number>;
  stripEavesM?: number; ridgeM: number; roofMaxM: number; skylineEavesM?: number;
}
export interface RowLines {
  eavesM: number; eavesSource: 'strip' | '3dbag'; ridgeM: number; cluster: number[];
  /** Sub-rows off the row line: three or more adjacent members agreeing with each other, on their own line (member indices). */
  subRows?: {eavesM: number; members: number[]}[];
}

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const cm = (v: number) => Math.round(v * 100) / 100;

/** The row's cornice line and ridge (see the module note). */
export function rowLines(members: RowMember[], thresholdM = ROW_COHERENCE.thresholdM, agreeM = ROW_COHERENCE.agreeM): RowLines {
  const strip = members.map(m => m.stripEavesM).filter((v): v is number => v !== undefined);
  const ridgeM = cm(median(members.map(m => m.ridgeM)));
  if (strip.length * 2 >= members.length) return {eavesM: cm(median(strip)), eavesSource: 'strip', ridgeM, cluster: members.filter(m => m.stripEavesM !== undefined).map(m => m.i)};
  const lines = modeLine(members, thresholdM);
  // Sub-rows: runs of three or more adjacent unmeasured members agreeing within `agreeM`, off the row line.
  const subRows: {eavesM: number; members: number[]}[] = [];
  const ordered = [...members].sort((a, b) => a.i - b.i);
  for (let a = 0; a < ordered.length;) {
    let b = a + 1;
    while (b < ordered.length && ordered[b].i === ordered[b - 1].i + 1 && ordered[b].stripEavesM === undefined && ordered[a].stripEavesM === undefined && Math.abs(ordered[b].eavesM - ordered[b - 1].eavesM) <= agreeM) b++;
    const run = ordered.slice(a, b), line = cm(median(run.map(m => m.eavesM)));
    if (run.length >= 3 && Math.abs(line - lines.eavesM) > agreeM) subRows.push({eavesM: line, members: run.map(m => m.i)});
    a = b;
  }
  return {...lines, ridgeM, ...(subRows.length ? {subRows} : {})};
}

function modeLine(members: RowMember[], thresholdM: number): RowLines {
  const ridgeM = cm(median(members.map(m => m.ridgeM)));
  // Every street front's eaves of an unmeasured member is a sample (a pand of three modules has three readings of the same cornice).
  const samples = members.filter(m => m.stripEavesM === undefined).flatMap(m => (m.frontEavesM ? Object.values(m.frontEavesM) : [m.eavesM]).map(v => ({i: m.i, v}))).sort((a, b) => a.v - b.v);
  const half = thresholdM / 2;
  // The lowest window nearly as dense as the densest: a misread is upward (a flat top, a rear roof read at the facade),
  // so of two comparable groups the lower one is the cornice (Kinkerstraat 315-359: twelve cornice readings spread over
  // 1.8 m against eight flat-top readings within 0.5 m).
  const windows = samples.map(a => samples.filter(s => s.v >= a.v && s.v <= a.v + half));
  const densest = Math.max(0, ...windows.map(w => w.length));
  let best = windows.find(w => w.length >= ROW_COHERENCE.windowShare * densest) ?? [];
  let centre = median(best.map(s => s.v));
  for (let k = 0; k < 20; k++) {
    best = samples.filter(s => Math.abs(s.v - centre) <= half);
    const next = median(best.map(s => s.v));
    if (Math.abs(next - centre) < 1e-6) break;
    centre = next;
  }
  return {eavesM: cm(centre), eavesSource: '3dbag', ridgeM, cluster: [...new Set(best.map(s => s.i))]};
}

export interface RowClamp {
  pandId: string; row: string;
  /** The first clamped front's eaves, and every clamped street front by id. */
  eavesM?: {from: number; to: number}; fronts?: Record<string, {from: number; to: number}>;
  ridgeM?: {from: number; to: number}; note: string;
}

/** What the row rule does to one member (nothing for a member measured on the strip, or confirmed by its skyline). */
export function rowClampFor(m: RowMember, lines: RowLines, rowId: string, o: Partial<typeof ROW_COHERENCE> = {}): RowClamp | null {
  const t = o.thresholdM ?? ROW_COHERENCE.thresholdM, rt = o.ridgeThresholdM ?? ROW_COHERENCE.ridgeThresholdM, above = o.ridgeCapAboveM ?? ROW_COHERENCE.ridgeCapAboveM, st = o.skylineToleranceM ?? ROW_COHERENCE.skylineToleranceM;
  if (m.stripEavesM !== undefined) return null;
  const out: RowClamp = {pandId: m.pandId, row: rowId, note: ''}, notes: string[] = [];
  const sub = lines.subRows?.find(s => s.members.includes(m.i));
  const fronts = m.frontEavesM ?? {front0: m.eavesM};
  for (const [id, e] of Object.entries(fronts)) {
    if (sub) { if (Math.abs(e - sub.eavesM) > t) { (out.fronts ??= {})[id] = {from: cm(e), to: sub.eavesM}; out.eavesM ??= {from: cm(e), to: sub.eavesM}; notes.push(`${id}: eaves ${cm(e)} -> ${sub.eavesM} m (its sub-row's line, ${sub.members.length} adjacent members agreeing; the row line is ${lines.eavesM} m)`); } continue; }
    const off = e - lines.eavesM;
    if (Math.abs(off) <= t) continue;
    if (m.skylineEavesM !== undefined && Math.abs(m.skylineEavesM - e) <= st) { notes.push(`${id}: eaves ${cm(e)} m stands ${cm(off)} m off the row line ${lines.eavesM} m but the photo skyline confirms it (${cm(m.skylineEavesM)} m): kept`); continue; }
    (out.fronts ??= {})[id] = {from: cm(e), to: lines.eavesM};
    out.eavesM ??= {from: cm(e), to: lines.eavesM};
    notes.push(`${id}: eaves ${cm(e)} -> ${lines.eavesM} m (row line, ${lines.eavesSource}; ${cm(off)} m off)`);
  }
  if (m.roofMaxM > lines.ridgeM + rt) { out.ridgeM = {from: cm(m.roofMaxM), to: cm(lines.ridgeM + above)}; notes.push(`roof max ${cm(m.roofMaxM)} -> ${cm(lines.ridgeM + above)} m (row ridge ${lines.ridgeM} m)`); }
  if (!out.eavesM && !out.ridgeM) return null;
  out.note = notes.join('; ');
  return out;
}

/** Survey roof vertices clamped under `capM` (m above the pand ground); heights follow. Untouched facts when nothing stands above. */
export function clampRoofVertices(facts: BuildingFacts, capM: number): BuildingFacts {
  const ground = facts.heights.groundNAP, cap = ground + capM;
  if (!facts.roofsRD.some(r => r.vertices.some(v => v[2] > cap + 1e-6))) return facts;
  const roofsRD = facts.roofsRD.map(r => {
    const vertices = r.vertices.map(v => v[2] > cap ? [v[0], v[1], cap] : v), ringsRD = r.ringsRD.map(ring => ring.map(v => v[2] > cap ? [v[0], v[1], cap] : v));
    const zs = vertices.map(v => v[2]), dz = Math.max(...zs) - Math.min(...zs);
    return {...r, vertices, ringsRD, ...(dz < 1e-3 ? {slopeDeg: 0} : {})};
  });
  const z = roofsRD.flatMap(r => r.vertices.map(v => v[2] - ground));
  return {...facts, roofsRD, heights: {...facts.heights, roofMaxM: Math.max(...z), ridgeM: Math.min(facts.heights.ridgeM, capM)}};
}
