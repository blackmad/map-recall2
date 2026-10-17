// road-marks-v1 (src/canalRecall/ownGround/roadMarks.ts): crossing, signal, give-way and stop nodes per own-ground cell,
// from the archived OSM extract (no network). Staged, with a report; `--publish` copies the staged cells into the extract.
//
//   npx tsx scripts/own-ground/build-road-marks.ts [--pbf .cache/osm-source/Amsterdam.osm.pbf] [--publish]
//
// Cells: those of the roads-v1 extract (the markings are drawn on its carriageway polygons only).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { encodeMarks, markOf, ROAD_MARKS_ATTRIBUTION, ROAD_MARKS_EXTRACT, ROAD_MARKS_VERSION, type RoadMark, type RoadMarksCell, type RoadMarksManifest } from '../../src/canalRecall/ownGround/roadMarks.ts';

const argOf = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const PBF = argOf('--pbf') ?? '.cache/osm-source/Amsterdam.osm.pbf';
const OUT = 'artifacts/own-ground/staging/road-marks-v1';
const ROOT = 'public/data/extracts/amsterdam';

async function main(): Promise<void> {
  if (!existsSync(PBF)) throw new Error(`no OSM extract at ${PBF}`);
  const work = join(tmpdir(), `road-marks-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const filtered = join(work, 'marks.osm.pbf'), seq = join(work, 'marks.geojsonseq');
  execFileSync('osmium', ['tags-filter', '--overwrite', '-o', filtered, PBF, 'n/highway=crossing,give_way,stop,traffic_signals', 'n/crossing']);
  execFileSync('osmium', ['export', '--overwrite', '-f', 'geojsonseq', '-x', 'print_record_separator=false', '-o', seq, filtered]);
  const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
  await store.init();
  const byCell = new Map<string, RoadMark[]>(), counts: Record<string, number> = {};
  let nodes = 0, skipped = 0, outside = 0;
  for (const line of readFileSync(seq, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const f = JSON.parse(line) as { geometry: { type: string; coordinates: [number, number] }; properties: Record<string, string> };
    if (f.geometry?.type !== 'Point') continue;
    nodes++;
    const m = markOf(f.properties);
    if (!m) { skipped++; continue; }
    const p = toLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]), key = store.cellAt(p[0], p[1]);
    if (!store.roadCells.has(key)) { outside++; continue; }
    (byCell.get(key) ?? byCell.set(key, []).get(key)!).push({ p, ...m });
    const label = m.kind + (m.signalised && m.kind !== 'signals' ? '+signals' : '');
    counts[label] = (counts[label] ?? 0) + 1;
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'cells'), { recursive: true });
  let bytes = 0;
  const cells = [...byCell.keys()].sort();
  for (const key of cells) {
    const marks = byCell.get(key)!.sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]);
    const cell: RoadMarksCell = { version: ROAD_MARKS_VERSION, key, n: encodeMarks(marks) };
    const gz = gzipSync(JSON.stringify(cell), { level: 9 });
    bytes += gz.byteLength;
    writeFileSync(join(OUT, 'cells', `${key}.json.gz`), gz);
  }
  const manifest: RoadMarksManifest = { version: ROAD_MARKS_VERSION, cells, source: `OpenStreetMap ${PBF.split('/').pop()} (osmium tags-filter)`, attribution: ROAD_MARKS_ATTRIBUTION, counts };
  writeFileSync(join(OUT, 'cells.json'), JSON.stringify(manifest));
  const report = { nodes, skipped, outside, cells: cells.length, bytesGz: bytes, counts };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report));
  rmSync(work, { recursive: true, force: true });
  if (process.argv.includes('--publish')) {
    const dest = join(ROOT, ROAD_MARKS_EXTRACT);
    rmSync(dest, { recursive: true, force: true });
    cpSync(OUT, dest, { recursive: true });
    rmSync(join(dest, 'report.json'));
    console.log('published', dest);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
