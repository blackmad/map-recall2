// roads-v1 version-3 cells: junction slivers merged, same-class seams dissolved, kerb stubs dropped (engine round 5,
// lane R5-C2, issue #263; rules in src/canalRecall/ownGround/roadSlivers.ts dissolveSlivers).
//
//   npx tsx scripts/own-ground/build-road-slivers.ts [--from public/data/extracts/amsterdam/roads-v1] [--out artifacts/roads-v1-staging] [--cells a,b] [--no-seams]
//
// Reads the published version-2 cells and writes <out>/cells-v3/<key>.json.gz, <out>/cells.json (the published
// manifest with `v3: true`) and <out>/report.json (polygons before/after per class, sliver area moved by class pair,
// kerb runs, bytes). Why from the published cells and not the raw BGT: the version-2 ancillary collections
// (ondersteunendwegdeel, onbegroeidterreindeel) are not in the source archive (bgt-roads-20261016 holds wegdeel only), so
// a rebuild from raw would drop the islands, verges and squares; the published cells carry the topology exactly (shared
// edges have identical decimetre vertices, topoSimplify.ts), which is all the dissolve needs. build-bgt-roads.ts calls the
// same function (`--slivers`) for the next full rebuild.
//
// Publish (integrator, after review): cp -r <out>/cells-v3 public/data/extracts/amsterdam/roads-v1/ and copy
// <out>/cells.json over roads-v1/cells.json (it differs only by `v3: true` and the report's v3 block). `?roadSlivers=0`
// keeps reading roads-v1/cells/.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { roadCellProblems, ROAD_CELLS_V3_DIR, type RoadCell, type RoadsManifest } from '../../src/canalRecall/ownGround/roadCells.ts';
import { dissolveSlivers, sliverStats, type DissolveStats } from '../../src/canalRecall/ownGround/roadSlivers.ts';
import { decodeRoadCell } from '../../src/canalRecall/ownGround/roadCells.ts';

const argOf = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const FROM = argOf('--from') ?? 'public/data/extracts/amsterdam/roads-v1';
const OUT = argOf('--out') ?? 'artifacts/roads-v1-staging';
const seams = !process.argv.includes('--no-seams');
const manifest = JSON.parse(readFileSync(`${FROM}/cells.json`, 'utf8')) as RoadsManifest;
const keys = argOf('--cells')?.split(',') ?? manifest.cells;
rmSync(`${OUT}/${ROAD_CELLS_V3_DIR}`, { recursive: true, force: true });
mkdirSync(`${OUT}/${ROAD_CELLS_V3_DIR}`, { recursive: true });
const t0 = Date.now();
const total: Record<string, number> = {}, moved: Record<string, number> = {}, byBefore: Record<string, number> = {}, byAfter: Record<string, number> = {};
const perCell: Record<string, { before: number; after: number; slivers: number; kept: number; kerbs: [number, number]; gz: [number, number] }> = {};
let gzBefore = 0, gzAfter = 0, sliversAfter = 0, stubsAfter = 0;
for (const key of keys) {
  const f = `${FROM}/cells/${key}.json.gz`;
  if (!existsSync(f)) continue;
  const raw = readFileSync(f), cell = JSON.parse(gunzipSync(raw).toString()) as RoadCell;
  const { cell: out, stats } = dissolveSlivers(cell, { seams });
  const problems = roadCellProblems(out);
  if (problems.length) throw new Error(`${key}: ${problems.join('; ')}`);
  const gz = gzipSync(Buffer.from(JSON.stringify(out)), { level: 9 });
  writeFileSync(`${OUT}/${ROAD_CELLS_V3_DIR}/${key}.json.gz`, gz);
  gzBefore += raw.length; gzAfter += gz.length;
  for (const [k, v] of Object.entries(stats)) if (typeof v === 'number') total[k] = (total[k] ?? 0) + v;
  for (const [k, v] of Object.entries(stats.movedM2)) moved[k] = +((moved[k] ?? 0) + v).toFixed(1);
  for (const [k, v] of Object.entries(stats.byClassBefore)) byBefore[k] = (byBefore[k] ?? 0) + v;
  for (const [k, v] of Object.entries(stats.byClassAfter)) byAfter[k] = (byAfter[k] ?? 0) + v;
  const d = decodeRoadCell(out), after = sliverStats(d.surfaces.filter(s => s.h === 0).map(s => ({ c: s.c, k: s.k, h: s.h, rings: s.rings })), d.kerbs);
  sliversAfter += after.slivers; stubsAfter += after.kerbShort;
  perCell[key] = { before: stats.polygonsBefore, after: stats.polygonsAfter, slivers: stats.slivers, kept: after.slivers, kerbs: [stats.kerbRunsBefore, stats.kerbRunsAfter], gz: [raw.length, gz.length] };
}
const report = {
  built: new Date().toISOString(), from: FROM, seams, cells: Object.keys(perCell).length, seconds: Math.round((Date.now() - t0) / 100) / 10,
  polygons: { before: total.polygonsBefore, after: total.polygonsAfter, byClassBefore: byBefore, byClassAfter: byAfter },
  slivers: { groundBefore: total.slivers, merged: total.sliversMerged, keptNoNeighbour: total.sliversKept, groundAfter: sliversAfter, areaMovedM2ByClass: moved, areaMovedM2: +Object.values(moved).reduce((a, b) => a + b, 0).toFixed(1) },
  seamsDissolved: total.seamsDissolved, unionFailed: total.unionFailed,
  kerbs: { runsBefore: total.kerbRunsBefore, runsAfter: total.kerbRunsAfter, stubsDropped: total.kerbStubsDropped, stubsAfter, segmentsRemoved: total.kerbSegmentsRemoved, segmentsAdded: total.kerbSegmentsAdded },
  gzBytes: { before: gzBefore, after: gzAfter },
  perCell,
};
const man: RoadsManifest = { ...manifest, v3: true, report: { ...(manifest.report ?? {}), v3: { built: report.built, polygons: report.polygons.after, slivers: report.slivers, kerbRuns: report.kerbs.runsAfter, gzBytes: gzAfter } } };
writeFileSync(`${OUT}/cells.json`, JSON.stringify(man));
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
const { perCell: _p, ...summary } = report;
void _p; void ({} as DissolveStats);
console.log(JSON.stringify(summary, null, 1));
