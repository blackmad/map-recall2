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
import { ROW_FRONT_EXTRAS, type RowDormerDraw, type RowFrontRecord, type RowHeadsDraw, type RowSeriesDraw } from './rowFront.ts';

/** Grounds that put the ground storey on a souterrain (stoop over basement windows). */
const SOUTERRAIN_GROUNDS: ReadonlySet<string> = new Set(['souterrain', 'stoop-and-windows']);

const span = (f: RowFront) => f.sub ? [f.sub.a0, f.sub.a1] as const : [0, 1] as const;

/** One pand's series draw from its fronts (street order) and their designs. */
export function seriesDraw(fronts: readonly RowFront[], designs: readonly RowDesign[]): RowSeriesDraw {
  const d0 = designs[0];
  const heads: RowHeadsDraw[] = [];
  const dormers: RowDormerDraw[] = [];
  let mansard: RowDesign['roofStorey']['value'] | null = null;
  fronts.forEach((f, i) => {
    const [a0, a1] = span(f), d = designs[i], h = d.heads.value;
    if (h && h.dressing !== 'none') heads.push({ a0, a1, shape: h.shape, dressing: h.dressing, ...(h.storeys?.length ? { storeys: [...h.storeys] } : {}) });
    const rs = d.roofStorey.value;
    if (rs.kind !== 'mansard') return;
    mansard ??= rs;
    const n = Math.max(0, Math.round(rs.dormersPerFront));
    for (let k = 0; k < n; k++) dormers.push({ a: +(a0 + (k + 0.5) / n * (a1 - a0)).toFixed(4), kind: rs.dormerKind ?? 'plain', ...(rs.hoist ? { hoist: true } : {}) });
  });
  const extras = (d0.extras.value ?? []).filter(x => !ROW_FRONT_EXTRAS.includes(x));
  const m = mansard as RowDesign['roofStorey']['value'] | null;
  return {
    id: fronts[0].seriesId,
    ...(d0.cornice.value ? { cornice: d0.cornice.value } : {}),
    roofStorey: m ? { kind: 'mansard', material: m.material ?? 'slate', dormers } : { kind: 'none', riseM: 0, dormers: [] },
    ...(heads.length ? { heads } : {}),
    ...(extras.length ? { extras } : {}),
    ...(fronts.some(f => SOUTERRAIN_GROUNDS.has(f.ground.basement ?? '')) ? { souterrain: true } : {}),
  };
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
    const out: RowFrontRecord = {
      ...rec, series: seriesDraw(fronts, designs),
      wall: { hex: walls[0].hex, source: 'judged', finish: walls[0].material },
      sources: { ...rec.sources, series: `house-rows ${row.id}: ${[...new Set(fronts.map(f => f.seriesId))].join(', ')}`, wall: `judged ${walls[0].family} (${designs[0].wall.source}: ${designs[0].wall.ref})` },
    };
    if (rec.subFronts && walls.some(w => w.hex !== walls[0].hex)) out.subFronts = rec.subFronts.map((s, i) => ({ ...s, wallHex: walls[i]?.hex ?? walls[0].hex }));
    return out;
  });
}
