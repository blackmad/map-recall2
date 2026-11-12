// Open ground cut free of the road partition (lane G1 of the Ground v2 plan, item A; issue #376).
//
// open-ground-v1 (build-open-ground.ts) is cut free of the OSM area fills and the raised (h >= 1) roads-v1 surfaces, but
// not of the ground-level roads-v1 polygons: BGT's partition keeps terreindeel and wegdeel apart, yet each extract is
// simplified (0.15 m) and rounded (0.1 m) on its own, so their shared edges overlap or gap by a few decimetres. This
// script takes every published open-ground-v1 cell, subtracts the roads-v1 ground polygons (h = 0, every class: the
// carriageway, cycle path, footway and the verges and islands roads-v1 draws) of the 3x3 neighbourhood, and writes
// open-ground-v2 cells to STAGING with a report of the overlap removed per road class. An area no road polygon
// overlaps keeps its encoded rings byte for byte; parts under MIN_PART_M2 are dropped (as the v1 build).
//
//   node --import tsx scripts/own-ground/clip-open-ground.ts [--cells k1,k2]   stage + report
//   node --import tsx scripts/own-ground/clip-open-ground.ts --publish          STAGING -> public/data/extracts/amsterdam/open-ground-v2 (integrator)
//   node --import tsx scripts/own-ground/clip-open-ground.ts --help
//
// The game reads open-ground-v2 when its manifest exists and `?openGroundClip=0` is not set (groundStore.ts).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import polygonClipping from 'polygon-clipping';
import { decodeLine, encodeLine, polygonArea } from '../../src/canalRecall/ownGround/parks.ts';
import { decodeRoadCell, roadCellDir, type RoadCell, type RoadsManifest } from '../../src/canalRecall/ownGround/roadCells.ts';
import type { OpenGroundCell, OpenGroundManifest } from '../../src/canalRecall/ownGround/groundSurface.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';
import { OPEN_GROUND_CLIPPED_EXTRACT } from '../../src/canalRecall/ownGround/groundSurface.ts';

const HELP = `clip-open-ground — open-ground-v1 minus the roads-v1 ground polygons (lane G1 item A)

  node --import tsx scripts/own-ground/clip-open-ground.ts [--cells k1,k2] [--staging <dir>]
      writes <staging>/cells/*.json.gz, <staging>/cells.json and <staging>/report.json (overlap m2 per road class)
  node --import tsx scripts/own-ground/clip-open-ground.ts --publish
      copies the staged extract to public/data/extracts/amsterdam/${OPEN_GROUND_CLIPPED_EXTRACT} (after review)

Default staging: public/data/extracts/amsterdam/staging/${OPEN_GROUND_CLIPPED_EXTRACT}.`;

const ROOT = 'public/data/extracts/amsterdam';
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log(HELP); process.exit(0); }
const STAGING = arg('--staging') ?? join(ROOT, 'staging', OPEN_GROUND_CLIPPED_EXTRACT);
const SOURCE = join(ROOT, 'open-ground-v1');
/** Parts smaller than this (m2) are not drawn (build-open-ground.ts MIN_PART_M2). */
const MIN_PART_M2 = 2;
/** Overlaps under this (m2) per area leave it as it was (a shared edge's rounding, not worth new vertices). */
const MIN_OVERLAP_M2 = 0.05;

const gz = <T>(f: string): T | null => (existsSync(f) ? (JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) as T) : null);
const box = (r: readonly Vec2[]): [number, number, number, number] => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; };
const closed = (r: Vec2[]): Vec2[] => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r);

function main(): void {
  if (process.argv.includes('--publish')) {
    const out = join(ROOT, OPEN_GROUND_CLIPPED_EXTRACT);
    const m = JSON.parse(readFileSync(join(STAGING, 'cells.json'), 'utf8')) as OpenGroundManifest;
    rmSync(out, { recursive: true, force: true }); mkdirSync(join(out, 'cells'), { recursive: true });
    for (const k of m.cells) copyFileSync(join(STAGING, 'cells', `${k}.json.gz`), join(out, 'cells', `${k}.json.gz`));
    writeFileSync(join(out, 'cells.json'), JSON.stringify(m, null, 1) + '\n');
    console.log(`published ${m.cells.length} cells to ${out}`);
    return;
  }
  const manifest = JSON.parse(readFileSync(join(SOURCE, 'cells.json'), 'utf8')) as OpenGroundManifest;
  const roadsManifest = JSON.parse(readFileSync(join(ROOT, 'roads-v1', 'cells.json'), 'utf8')) as RoadsManifest;
  const roadsDir = join(ROOT, 'roads-v1', roadCellDir(roadsManifest));
  const only = arg('--cells')?.split(',');
  const keys = only ?? manifest.cells;
  if (!only) rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(join(STAGING, 'cells'), { recursive: true });
  const totals = { cells: 0, areas: 0, clipped: 0, dropped: 0, beforeM2: 0, overlapM2: 0, byClass: {} as Record<string, number>, failures: 0 };
  const rows: { key: string; areas: number; clipped: number; overlapM2: number }[] = [];
  const t0 = Date.now();
  for (const key of keys) {
    const cell = gz<OpenGroundCell>(join(SOURCE, 'cells', `${key}.json.gz`));
    if (!cell) continue;
    const [cx, cy] = key.split('_').map(Number);
    const roads: { rings: Vec2[][]; b: [number, number, number, number]; c: string }[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const rc = gz<RoadCell>(join(roadsDir, `${cx + i}_${cy + j}.json.gz`));
      if (rc) for (const s of decodeRoadCell(rc).surfaces) if (s.h === 0 && s.rings[0].length >= 3) roads.push({ rings: s.rings.map(r => closed(r.slice())), b: box(s.rings[0]), c: s.c });
    }
    const areas: OpenGroundCell['areas'] = [];
    let clipped = 0, overlapM2 = 0;
    for (const a of cell.areas) {
      totals.areas++;
      const rings = a.r.map(decodeLine).filter(r => r.length >= 3);
      if (!rings.length) { areas.push(a); continue; }
      const b = box(rings[0]);
      const near = roads.filter(r => r.b[0] < b[2] && r.b[2] > b[0] && r.b[1] < b[3] && r.b[3] > b[1]);
      if (!near.length) { areas.push(a); continue; }
      const subject = rings.map(r => closed(r.slice()));
      let parts: Vec2[][][];
      let over = 0;
      try {
        const inter = polygonClipping.intersection(subject as any, ...near.map(n => n.rings as any)) as unknown as Vec2[][][];
        over = inter.reduce((s, p) => s + polygonArea(p), 0);
        if (over < MIN_OVERLAP_M2) { areas.push(a); continue; }
        // Per class, the overlap (report only).
        for (const n of near) {
          const one = polygonClipping.intersection(subject as any, n.rings as any) as unknown as Vec2[][][];
          const m2 = one.reduce((s, p) => s + polygonArea(p), 0);
          if (m2 > 0) totals.byClass[n.c] = (totals.byClass[n.c] ?? 0) + m2;
        }
        parts = polygonClipping.difference(subject as any, ...near.map(n => n.rings as any)) as unknown as Vec2[][][];
      } catch { totals.failures++; areas.push(a); continue; }
      totals.beforeM2 += polygonArea(rings);
      overlapM2 += over; clipped++;
      const kept = parts.map(p => p.map(r => r.slice(0, -1))).filter(p => p[0].length >= 3 && polygonArea(p) >= MIN_PART_M2);
      if (!kept.length) { totals.dropped++; continue; }
      kept.forEach((p, i) => {
        const enc = p.map(encodeLine).filter(e => e.length >= 6);
        if (!enc.length || encodeLine(p[0]).length < 6) return;
        areas.push({ id: kept.length > 1 ? `${a.id}~${i}` : a.id, k: a.k, r: enc });
      });
    }
    totals.cells++; totals.clipped += clipped; totals.overlapM2 += overlapM2;
    rows.push({ key, areas: cell.areas.length, clipped, overlapM2: Math.round(overlapM2) });
    const out: OpenGroundCell = { ...cell, areas };
    writeFileSync(join(STAGING, 'cells', `${key}.json.gz`), gzipSync(JSON.stringify(out), { level: 9 }));
    console.log(`${key.padEnd(7)} ${cell.areas.length} areas, ${clipped} clipped, overlap ${overlapM2.toFixed(0)} m2 [${rows.length}/${keys.length}, ${Math.round((Date.now() - t0) / 1000)} s]`);
  }
  const cells = (only ? [...new Set([...(existsSync(join(STAGING, 'cells.json')) ? (JSON.parse(readFileSync(join(STAGING, 'cells.json'), 'utf8')) as OpenGroundManifest).cells : []), ...rows.map(r => r.key)])] : rows.map(r => r.key)).sort();
  const m: OpenGroundManifest = { ...manifest, cells, provenance: { ...manifest.provenance, clipped: { added: '2026-11-12', script: 'scripts/own-ground/clip-open-ground.ts', what: 'open-ground-v1 minus the roads-v1 ground polygons (h = 0) of the 3x3 neighbourhood; lane G1 item A, issue #376' } } };
  writeFileSync(join(STAGING, 'cells.json'), JSON.stringify(m, null, 1) + '\n');
  const report = { ...totals, overlapM2: Math.round(totals.overlapM2), beforeM2: Math.round(totals.beforeM2), byClass: Object.fromEntries(Object.entries(totals.byClass).map(([k, v]) => [k, Math.round(v)]).sort((a, b) => (b[1] as number) - (a[1] as number))), rows };
  writeFileSync(join(STAGING, 'report.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify({ ...report, rows: undefined }));
}
main();
