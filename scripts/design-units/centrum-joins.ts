/**
 * Design units under option A (#397, approved 2026-11-19), Centrum layer dry run: plots stay separate unless something
 * joins them. Within one ordekaart object (a centrum unit), two street-adjacent pands join when
 *   1. a face intent says so (scripts/block-face/faces/<face>/intent.json corniceGroups, identical, sameAs), or
 *   2. a photo-confirmed same-building run says "one" (lane/centrum-looks-20261115 same-building.json, confidence >= 0.6), or
 *   3. AHN agrees: both front p90 within AHN_JOIN_M of each other and the same BAG year.
 * Joined plots form segments (union-find); everything else draws as today. Reports the joins per source, the segments, and
 * the four regression rows (Marnixplein and Goudsbloemstraat must be one segment each).
 *
 *   node --import tsx scripts/design-units/centrum-joins.ts [--same-building <file>[,<file>]]
 *
 * Reads staging/{design-units.json,ahn-fronts.json} and the base tiles' BAG years; writes staging/centrum-joins.json.
 * Staged only: nothing is published and nothing draws from it.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { DesignUnit } from '../../src/canalRecall/designUnits/types.ts';
import { REGRESSION_ROWS } from '../../src/canalRecall/designUnits/regressionRows.ts';

export const AHN_JOIN_M = 0.3;
const ROOT = path.resolve(import.meta.dirname, '../..');
const STAGING = path.join(ROOT, 'artifacts/design-units/staging');
const norm = (s: string) => String(s).replace(/^NL\.IMBAG\.Pand\./, '');
const units = (JSON.parse(fs.readFileSync(path.join(STAGING, 'design-units.json'), 'utf8')).units as DesignUnit[]).filter(u => u.object?.key.startsWith('centrum:') && u.members.length > 1);
const unitOf = new Map<string, DesignUnit>();
for (const u of units) for (const m of u.members) unitOf.set(m, u);
const ahn = JSON.parse(fs.readFileSync(path.join(STAGING, 'ahn-fronts.json'), 'utf8')).fronts as Record<string, { p90: number } | null>;

// BAG years from the base tiles.
const yearOf = new Map<string, number>();
const TILES = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
for (const x of fs.readdirSync(TILES).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(TILES, x)).filter(n => n.endsWith('.geojson.gz'))) {
  for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, x, f))).toString('utf8')).features) {
    const id = norm(ft.properties?.id ?? '');
    if (unitOf.has(id) && typeof ft.properties.year === 'number') yearOf.set(id, ft.properties.year);
  }
}

// Street adjacency inside a unit: consecutive slices along each face (sorted by position), distinct pands.
const neighbours = (u: DesignUnit): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  for (const f of u.faces ?? []) {
    const ms = [...f.slices].sort((a, b) => a.fromM - b.fromM).map(s => s.pandId);
    for (let i = 1; i < ms.length; i++) if (ms[i] !== ms[i - 1]) out.push([ms[i - 1], ms[i]]);
  }
  return out;
};

const parent = new Map<string, string>();
const find = (a: string): string => { let r = a; while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!; parent.set(a, r); return r; };
const join = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) { parent.set(ra, rb); return true; } return false; };
const sameUnit = (a: string, b: string) => !!unitOf.get(a) && unitOf.get(a) === unitOf.get(b);
const joins = { faceIntent: 0, sameBuilding: 0, ahnYear: 0, faceIntentOutsideUnit: 0, sameBuildingOutsideUnit: 0, separateRunsJoined: 0 };

// 1. face intents.
const FACES = path.join(ROOT, 'scripts/block-face/faces');
const groupJoin = (ps: string[], key: 'faceIntent' | 'sameBuilding') => {
  const ids = ps.map(norm);
  for (let i = 1; i < ids.length; i++) {
    if (!sameUnit(ids[0], ids[i])) { if (unitOf.has(ids[0]) || unitOf.has(ids[i])) joins[`${key}OutsideUnit`]++; continue; }
    if (join(ids[0], ids[i])) joins[key]++;
  }
};
for (const face of fs.readdirSync(FACES)) {
  const f = path.join(FACES, face, 'intent.json'); if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const g of d.continuity?.corniceGroups ?? []) groupJoin(g.pands, 'faceIntent');
  for (const g of d.continuity?.identical ?? []) groupJoin(g.pands, 'faceIntent');
  for (const h of d.houses ?? []) if (h.sameAs) groupJoin([h.pandId, h.sameAs], 'faceIntent');
}
// 2. same-building reads.
const sbArg = process.argv.indexOf('--same-building');
const separate: string[][] = [];
for (const file of sbArg >= 0 ? process.argv[sbArg + 1].split(',') : []) for (const r of (JSON.parse(fs.readFileSync(file, 'utf8')).runs as Array<{ pids: string[]; answer: string; confidence?: number }>)) {
  if ((r.confidence ?? 0) < 0.6) continue;
  if (r.answer === 'one') groupJoin(r.pids, 'sameBuilding');
  else if (r.answer === 'separate') separate.push(r.pids.map(norm));
}
// 3. AHN height and year.
for (const u of units) for (const [a, b] of neighbours(u)) {
  const ha = ahn[a]?.p90, hb = ahn[b]?.p90, ya = yearOf.get(a), yb = yearOf.get(b);
  if (typeof ha === 'number' && typeof hb === 'number' && ya !== undefined && ya === yb && Math.abs(ha - hb) <= AHN_JOIN_M && join(a, b)) joins.ahnYear++;
}
for (const run of separate) if (run.length > 1 && run.every(p => parent.has(p)) && new Set(run.map(find)).size === 1) joins.separateRunsJoined++;

const groups = new Map<string, string[]>();
for (const p of parent.keys()) (groups.get(find(p)) ?? groups.set(find(p), []).get(find(p))!).push(p);
const segs = [...groups.values()].filter(g => g.length > 1);
const pands = units.reduce((t, u) => t + u.members.length, 0);
const rows = REGRESSION_ROWS.map(r => {
  const ids = r.units.flat(), roots = new Set(ids.map(p => (parent.has(p) ? find(p) : p)));
  return { row: r.name, expectedUnits: r.units.length, pands: ids.length, segmentsFound: roots.size, ...(r.units.length === 1 ? { oneSegment: roots.size === 1 } : {}) };
});
const out = { layer: 'centrum', units: units.length, pands, joins, segments: segs.length, pandsInSegments: segs.reduce((t, g) => t + g.length, 0),
  pandsSeparate: pands - segs.reduce((t, g) => t + g.length, 0), separateReadsRuns: separate.length, rows, ahnJoinM: AHN_JOIN_M };
fs.writeFileSync(path.join(STAGING, 'centrum-joins.json'), JSON.stringify({ ...out, segmentsSample: segs.slice(0, 50) }, null, 1));
console.log(JSON.stringify(out, null, 1));
