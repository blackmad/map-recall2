/**
 * House rows (lane R, docs/handoffs/house-rows-plan-20261114.md): lane D's solved row record (houseSpec/row/types.ts)
 * to the renderer's front records. Lane D's `rowFrontRecords` (houseSpec/row/emit.ts) gives each pand its wall top,
 * storeys, bays and sub-fronts; this joins each record to the design its series states:
 *
 *  - `series`: the series id (seeds the bay preset, the extras' dice and the roof tone), its cornice, the head dressing
 *    per front span (a two-series pand gets one span per sub-front), the roof storey with `dormersPerFront` dormers
 *    centred in each front, the extras beyond ROW_FRONT_EXTRAS, and the souterrain a stoop-and-windows ground reads;
 *  - `wall`: the series' judged family tone (`series[].design.wall.hex`, judgedColour.ts) as source `judged`. A front
 *    record's own wall stays `reviewed` / `strip-measured` only.
 *
 * Nothing here is rolled: a field the series does not state is left out and the renderer draws no component for it.
 */
import { frontDesign, type RowDesign, type RowFront, type RowRecord } from '../houseSpec/row/types.ts';
import { rowFrontRecords } from '../houseSpec/row/emit.ts';
import { headsList } from '../houseSpec/row/solve.ts';
import { ROW_FRONT_EXTRAS, type RowDormerDraw, type RowFrontRecord, type RowHeadsDraw, type RowSeriesDraw } from './rowFront.ts';

/** Grounds that put the ground storey on a souterrain (stoop over basement windows). */
const SOUTERRAIN_GROUNDS: ReadonlySet<string> = new Set(['souterrain', 'stoop-and-windows']);

/** A stated stoop (ground basement `stoop` / `stoop-and-windows`) and the street door's side; none stated: none drawn. */
function stoopOf(fronts: readonly RowFront[]): { stoop: { side: 'left' | 'right' | 'centre' } } | null {
  const f = fronts.find(x => x.ground.basement === 'stoop' || x.ground.basement === 'stoop-and-windows');
  if (!f) return null;
  const side = f.ground.doorSide === 'right' ? 'right' : f.ground.doorSide === 'centre' ? 'centre' : f.ground.doorSide === 'left' ? 'left' : null;
  return side ? { stoop: { side } } : null;
}
const span = (f: RowFront) => f.sub ? [f.sub.a0, f.sub.a1] as const : [0, 1] as const;

/** One pand's series draw from its fronts (street order) and their designs. */
export function seriesDraw(fronts: readonly RowFront[], designs: readonly RowDesign[], built?: number | null, rowId = ''): RowSeriesDraw {
  const d0 = designs[0];
  const heads: RowHeadsDraw[] = [];
  const dormers: RowDormerDraw[] = [];
  let mansard: RowDesign['roofStorey']['value'] | null = null;
  // Over a souterrain the bel-etage (D's ground, storey 0) is the renderer's first upper row: stated storeys shift by one.
  const shift = fronts.some(f => SOUTERRAIN_GROUNDS.has(f.ground.basement ?? '')) ? 1 : 0;
  fronts.forEach((f, i) => {
    const [a0, a1] = span(f), d = designs[i];
    // A front may state several dressings by storey (171218: jack-blocks below, arch rings on the top storey).
    const hs = d.heads.value ? headsList(d.heads.value) : [];
    for (const h of hs) if (h && h.dressing !== 'none') heads.push({ a0, a1, shape: h.shape, dressing: h.dressing, ...(h.storeys?.length ? { storeys: h.storeys.map(k => k + shift) } : {}) });
    const rs = d.roofStorey.value;
    if (rs.kind !== 'mansard') return;
    mansard ??= rs;
    const n = Math.max(0, Math.round(rs.dormersPerFront));
    for (let k = 0; k < n; k++) dormers.push({ a: +(a0 + (k + 0.5) / n * (a1 - a0)).toFixed(4), kind: rs.dormerKind ?? 'plain', ...(rs.hoist ? { hoist: true } : {}) });
  });
  // The renderer takes the first head whose span and storeys match a window: storey-specific dressings go first.
  heads.sort((p, q) => (p.storeys ? 0 : 1) - (q.storeys ? 0 : 1));
  const extras = (d0.extras.value ?? []).filter(x => !ROW_FRONT_EXTRAS.includes(x));
  const m = mansard as RowDesign['roofStorey']['value'] | null;
  return {
    id: fronts[0].seriesId,
    ...(d0.cornice.value ? { cornice: d0.cornice.value } : {}),
    roofStorey: m ? { kind: 'mansard', material: m.material ?? 'slate', dormers } : { kind: 'none', riseM: 0, dormers: [] },
    ...(heads.length ? { heads } : {}),
    ...(extras.length ? { extras } : {}),
    ...(fronts.some(f => SOUTERRAIN_GROUNDS.has(f.ground.basement ?? '')) ? { souterrain: true } : {}),
    ...(stoopOf(fronts) ?? {}),
    // One window preset per window kind in the row (Kinkerstraat: every series states t-windows), not per series.
    look: { bays: d0.bays.value, year: built ?? null, heightM: d0.corniceTopM.value ?? null, seed: `${rowId}:${d0.windows.value}`, whiteFrames: d0.whiteFrames.value },
  };
}

/** The look's year: the earliest build year of every member whose series states the same window kind (the look's
 *  seed), so one window preset is one period (Kinkerstraat 90 and 86-88 picked another preset on their own years). */
function seriesYear(row: RowRecord, seriesId: string): number | null {
  const kind = row.series.find(x => x.id === seriesId)?.design.windows.value;
  const same = new Set(row.series.filter(x => x.design.windows.value === kind).flatMap(x => x.fronts));
  const years = row.members.filter(m => m.built && m.fronts.some(f => same.has(f))).map(m => m.built!);
  return years.length ? Math.min(...years) : null;
}

/** Lane D's front records for a row, each joined to its series draw and its series' judged wall tone. */
export function rowFrontsWithSeries(row: RowRecord): RowFrontRecord[] {
  const byPand = new Map(row.members.map(m => [m.pandId, m]));
  return rowFrontRecords(row).map(rec => {
    const member = byPand.get(rec.pandId);
    if (!member) return rec;
    const fronts = member.fronts.map(id => row.fronts.find(f => f.id === id)).filter((f): f is RowFront => !!f);
    if (!fronts.length) return rec;
    const designs = fronts.map(f => frontDesign(row, f));
    const walls = designs.map(d => d.wall.value);
    // The world draws every pand from flat ground (no terrain under the mesher), so a row stands to its series line in
    // the street datum: per-pand 3DBAG ground offsets stepped the drawn cornice (Kinkerstraat 104 0.2 m, 110 0.7 m low).
    const line = designs[0].corniceTopM.value;
    const lined = line !== null && line > 2 ? { topM: line, eavesM: line, ...(rec.subFronts ? { subFronts: rec.subFronts.map((sf, i) => ({ ...sf, topM: designs[i]?.corniceTopM.value ?? line, eavesM: designs[i]?.corniceTopM.value ?? line })) } : {}) } : {};
    const out: RowFrontRecord = {
      ...rec, ...lined, series: seriesDraw(fronts, designs, seriesYear(row, fronts[0].seriesId), row.id),
      wall: { hex: walls[0].hex, source: 'judged', finish: walls[0].material },
      sources: { ...rec.sources, ...(line !== null ? { eaves: `${rec.sources.eaves}; drawn at the series line ${line} m (street datum: the world has no terrain)` } : {}), series: `house-rows ${row.id}: ${[...new Set(fronts.map(f => f.seriesId))].join(', ')}`, wall: `judged ${walls[0].family} (${designs[0].wall.source}: ${designs[0].wall.ref})` },
    };
    if (rec.subFronts && walls.some(w => w.hex !== walls[0].hex)) out.subFronts = rec.subFronts.map((s, i) => ({ ...s, wallHex: walls[i]?.hex ?? walls[0].hex }));
    const joins = mansardJoins(row, rec.pandId);
    if (joins && out.series?.roofStorey?.kind === 'mansard') out.series.roofStorey.joins = joins;
    return out;
  });
}

/** Cornice lines within this step (m, street datum) read as one line: the mansard runs on across the party wall. */
export const ROW_LINE_STEP_M = 0.2;
/** The member's mansard runs on into its street-order neighbour's (left / right as seen) when their cornice lines agree
 *  within ROW_LINE_STEP_M: no hip at the party wall, inside a series or across two, and also into a neighbour with no
 *  stated roof storey on the same line (Kinkerstraat 90 into 86-88: 3DBAG 16.84 / 16.62 m, both cornices at ~14.2 m on
 *  the face strip, so 86-88's top is not clearly lower). */
export function mansardJoins(row: RowRecord, pandId: string): { left?: true; right?: true } | null {
  const i = row.members.findIndex(m => m.pandId === pandId);
  if (i < 0) return null;
  const edge = (m: RowRecord['members'][number], end: 'first' | 'last') => {
    const id = end === 'first' ? m.fronts[0] : m.fronts[m.fronts.length - 1];
    const f = row.fronts.find(x => x.id === id);
    return f ? frontDesign(row, f).corniceTopM.value : null;
  };
  const near = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) <= ROW_LINE_STEP_M + 1e-9;
  const m = row.members[i], left = row.members[i - 1], right = row.members[i + 1];
  const out = {
    ...(left && near(edge(m, 'first'), edge(left, 'last')) ? { left: true as const } : {}),
    ...(right && near(edge(m, 'last'), edge(right, 'first')) ? { right: true as const } : {}),
  };
  return out.left || out.right ? out : null;
}
