// road-marks-v1: the OSM nodes that say what a road paints, per own-ground 1 km cell (pure, dependency-free; shared by
// scripts/own-ground/build-road-marks.ts, the ground store and surveyMarkings.ts).
//
// The own-ground OSM extract carries ways only, and most Amsterdam crossings are mapped as nodes on the road
// (`highway=crossing` with `crossing:markings`), so without the nodes the junctions of Zuid and Oost had no zebra
// (road look v2, 2026-10-16). Source: the archived OpenStreetMap Amsterdam extract (.cache/osm-source/Amsterdam.osm.pbf,
// © OpenStreetMap contributors, ODbL), filtered with osmium at build time; the game never calls an API.
//
// Cell file: { version: 1, key, n: [x, y, code, dir, ...] } — four integers per node: the game's local frame in whole
// decimetres (groundStore toLocal), the MARK code, and the direction it applies to along the road way
// (1 forward, -1 backward, 0 both / untagged).

export const ROAD_MARKS_VERSION = 1 as const;
export const ROAD_MARKS_EXTRACT = 'road-marks-v1';
export const ROAD_MARKS_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

export const MARK = { zebra: 1, blocks: 2, signals: 3, giveWay: 4, stop: 5 } as const;
export type MarkKind = keyof typeof MARK;
/** Added to a crossing's code when the crossing has its own signals (crossing=traffic_signals / crossing:signals=yes). */
export const MARK_SIGNALISED = 16;

export interface RoadMarksCell { version: typeof ROAD_MARKS_VERSION; key: string; n: number[] }
export interface RoadMarksManifest { version: typeof ROAD_MARKS_VERSION; cells: string[]; source: string; attribution: string; counts?: Record<string, number> }

export interface RoadMark { p: [number, number]; kind: MarkKind; signalised: boolean; dir: 1 | -1 | 0 }

const KIND_OF: Record<number, MarkKind> = Object.fromEntries(Object.entries(MARK).map(([k, v]) => [v, k as MarkKind]));

/** What a node paints, from its tags; null when nothing (an unmarked crossing, a signal on a footway, ...). */
export function markOf(tags: Record<string, string>): { kind: MarkKind; signalised: boolean; dir: 1 | -1 | 0 } | null {
  const dirTag = tags['traffic_signals:direction'] ?? tags.direction ?? '';
  const dir: 1 | -1 | 0 = dirTag === 'forward' ? 1 : dirTag === 'backward' ? -1 : 0;
  const hw = tags.highway;
  if (hw === 'traffic_signals') return { kind: 'signals', signalised: true, dir };
  if (hw === 'give_way') return { kind: 'giveWay', signalised: false, dir };
  if (hw === 'stop') return { kind: 'stop', signalised: false, dir };
  if (hw !== 'crossing' && !tags.crossing) return null;
  const c = tags.crossing, m = tags['crossing:markings'];
  const signalised = c === 'traffic_signals' || tags['crossing:signals'] === 'yes';
  if (c === 'unmarked' || c === 'no' || c === 'informal' || m === 'no' || m === 'surface') return null;
  if (m === 'zebra' || m === 'yes' || m === 'ladder' || m === 'zebra:double') return { kind: 'zebra', signalised, dir: 0 };
  if (m === 'dashes' || m === 'dots' || m === 'lines' || m === 'dashes:dots') return { kind: 'blocks', signalised, dir: 0 };
  if (c === 'zebra' || c === 'marked' || c === 'uncontrolled' || signalised) return { kind: 'zebra', signalised, dir: 0 };
  return null;
}

export function encodeMarks(marks: readonly RoadMark[]): number[] {
  return marks.flatMap(m => [Math.round(m.p[0] * 10), Math.round(m.p[1] * 10), MARK[m.kind] + (m.signalised ? MARK_SIGNALISED : 0), m.dir]);
}

export function decodeMarks(cell: RoadMarksCell | null | undefined): RoadMark[] {
  const out: RoadMark[] = [];
  const n = cell?.n ?? [];
  for (let i = 0; i + 3 < n.length; i += 4) {
    const code = n[i + 2], kind = KIND_OF[code & 15];
    if (!kind) continue;
    out.push({ p: [n[i] / 10, n[i + 1] / 10], kind, signalised: (code & MARK_SIGNALISED) !== 0, dir: (n[i + 3] === 1 ? 1 : n[i + 3] === -1 ? -1 : 0) });
  }
  return out;
}

export function isRoadMarksCell(v: unknown): v is RoadMarksCell {
  const c = v as RoadMarksCell;
  return !!c && c.version === ROAD_MARKS_VERSION && typeof c.key === 'string' && Array.isArray(c.n) && c.n.length % 4 === 0 && c.n.every(Number.isInteger);
}
