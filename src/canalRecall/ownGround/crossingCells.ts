// The zebras the ground renderer draws in a roads-v1 cell, built the way groundCell.ts builds them (its ways, its
// RoadIndex box with the parking islands and crossing strips, the 0.5 m fast raster, its road-marks-v1 nodes),
// without the meshes of the rest of the cell. For the crossing audit (scripts/own-ground/audit-crossings.ts), the
// orthophoto renders (render-crossings.ts) and the named crossing regressions (crossingAudit.test.ts).
import { fromLocal, type GroundStore } from './groundStore.js';
import { prepareWays, resolvePriorSidewalks, type LocalWay } from './streets.js';
import { RoadIndex } from './roadSurfaces.js';
import { buildSurveyMarkings, crossingStripPoints, SegGrid, segDist, wayDirAt, ZEBRA, type CrossingPlanStats, type DrawnCrossing } from './surveyMarkings.js';
import { auditCrossings, AUDIT_CATEGORIES, type AuditCategory, type CrossingFinding, type GroundAt } from './crossingAudit.js';
import type { RoadMark } from './roadMarks.js';
import type { Vec2 } from './surface.js';

/** groundCell.ts ROAD_FAST_PAD_M. */
const PAD = 60;

export interface CellCrossings { key: string; rect: [number, number, number, number]; ways: LocalWay[]; own: Set<number>; marks: readonly RoadMark[]; index: RoadIndex; crossings: DrawnCrossing[]; /** How the crossing candidates of the neighbourhood were planned (absent from the old generator). */ plan?: CrossingPlanStats }

/** `build`: the markings generator (the audit's before run passes the old one). */
export async function cellCrossings(store: GroundStore, key: string, build: typeof buildSurveyMarkings = buildSurveyMarkings, strips = true): Promise<CellCrossings | null> {
  const input = await store.cellInput(key, 0);
  if (!input.roads && !input.roadsAround?.some(r => r?.surfaces.length)) return null;
  const [x0, y0, x1, y1] = input.rect;
  const dropped = new Set<number>(input.dropWays ?? []), seen = new Set<number>(dropped), all: LocalWay[] = [], own = new Set<number>();
  for (const e of [input.osm, ...input.osmAround]) if (e) for (const w of prepareWays(e.ways, input.project)) { if (seen.has(w.id)) continue; seen.add(w.id); all.push(w); }
  for (const w of input.osm?.ways ?? []) if (!dropped.has(w.id)) own.add(w.id);
  const ways = resolvePriorSidewalks(all);
  let rb: [number, number, number, number] = [x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD];
  for (const w of ways) if (own.has(w.id)) for (const p of w.points) rb = [Math.min(rb[0], p[0] - 10), Math.min(rb[1], p[1] - 10), Math.max(rb[2], p[0] + 10), Math.max(rb[3], p[1] + 10)];
  const index = new RoadIndex([input.roads, ...(input.roadsAround ?? [])], rb);
  const marks = input.marks ?? [];
  index.parkingIslands();
  if (strips) index.crossingStrips(crossingStripPoints(ways, marks));
  index.prepareFast([x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD]);
  const inCell = (p: Vec2) => p[0] >= x0 && p[0] < x1 && p[1] >= y0 && p[1] < y1;
  const mk = build({ ways, ownsWay: w => own.has(w.id), ownsPoint: inCell, marks, box: [rb[0] - 30, rb[1] - 30, rb[2] + 30, rb[3] + 30], index, height: () => 0, lift: { paint: 0, red: 0 } });
  return { key, rect: [x0, y0, x1, y1], ways, own, marks, index, crossings: mk.crossings, plan: (mk as { plan?: CrossingPlanStats }).plan };
}

/** Exact ground lookup (no fast raster): the h = 0 polygon under the point, its drawn class and mesh. */
export const exactGround = (index: RoadIndex): GroundAt => (x, y) => {
  const k = index.findAll(x, y).find(j => index.records[j].h === 0);
  return k === undefined ? null : { cls: index.drawClass(k), mesh: index.mesh(k) };
};

/** The direction of the nearest carriageway way within 3 m (its chord over ±4 m), for the audit's skew test. */
export function roadDirOf(ways: readonly LocalWay[]): (p: Vec2) => Vec2 | null {
  const grid = new SegGrid<LocalWay>(8);
  for (const w of ways) if (w.section.bands[0]?.kind === 'carriageway' && (!w.tags.bridge || w.tags.bridge === 'no')) for (let i = 0; i + 1 < w.points.length; i++) grid.add(w.points[i], w.points[i + 1], w, 3);
  return p => {
    let best: { w: LocalWay; d: number } | null = null;
    for (const s of grid.near(p)) { const d = segDist(p, s.a, s.b); if (d <= 3 && (!best || d < best.d)) best = { w: s.item, d }; }
    return best ? wayDirAt(best.w.points, p) : null;
  };
}

export interface CityAudit { cells: number; crossings: number; /** Summed over the cells' neighbourhood plans (a candidate near an edge counts in each cell that plans it). */ plan?: Record<string, number>; counts: Record<AuditCategory, number>; flagged: (CrossingFinding & { key: string; lngLat: [number, number] })[] }

/**
 * The crossing audit over the given cells: every cell's drawn zebras (the overlap test sees the neighbours' too,
 * across cell edges), each cell's own measured against its exact polygons.
 */
export async function auditCity(store: GroundStore, keys: readonly string[], opts: { build?: typeof buildSurveyMarkings; strips?: boolean; log?: (line: string) => void } = {}): Promise<CityAudit> {
  const cells = (key: string) => cellCrossings(store, key, opts.build, opts.strips ?? true);
  const byCell = new Map<string, DrawnCrossing[]>();
  for (const key of keys) { const c = await cells(key); if (c) byCell.set(key, c.crossings); }
  const everything = [...byCell.values()].flat();
  const out: CityAudit = { cells: byCell.size, crossings: 0, counts: Object.fromEntries(AUDIT_CATEGORIES.map(k => [k, 0])) as Record<AuditCategory, number>, flagged: [] };
  for (const key of byCell.keys()) {
    const c = await cells(key);
    if (!c) continue;
    const [x0, y0, x1, y1] = c.rect;
    const near = everything.filter(e => e.centre[0] > x0 - 40 && e.centre[0] < x1 + 40 && e.centre[1] > y0 - 40 && e.centre[1] < y1 + 40);
    const mine = new Set(byCell.get(key));
    if (c.plan) { out.plan ??= {}; for (const [k, v] of Object.entries(c.plan)) out.plan[k] = (out.plan[k] ?? 0) + v; }
    const r = auditCrossings(near, exactGround(c.index), ZEBRA, x => mine.has(x), roadDirOf(c.ways));
    out.crossings += r.crossings;
    for (const k of AUDIT_CATEGORIES) out.counts[k] += r.counts[k];
    for (const f of r.flagged) out.flagged.push({ ...f, key, lngLat: fromLocal(f.at[0], f.at[1]).map(v => +v.toFixed(6)) as [number, number] });
    opts.log?.(`${key} ${r.crossings} ${JSON.stringify(r.counts)}`);
  }
  return out;
}
