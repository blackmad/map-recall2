// rail-v1 (src/canalRecall/ownGround/railTracks.ts): railway tracks per own-ground cell, from the archived OSM extract
// (no network). Staged, with a coverage report; `--publish` copies the staged cells into the extract.
//
//   npx tsx scripts/own-ground/build-rail-tracks.ts [--pbf .cache/osm-source/Amsterdam.osm.pbf] [--publish]
//
// Cells: those of the own-ground OSM extract (the ground is drawn there only). A tram way is kept only where it runs on
// its own bed: where at most a third of its length lies within TRAM_ON_STREET_M of a street way that draws its rails
// (embedded_rails=tram) or of any carriageway, it is separated; otherwise the street draws it already.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { encodeRail, railOf, RAIL_ATTRIBUTION, RAIL_EXTRACT, RAIL_VERSION, type RailCell, type RailManifest, type RailWay } from '../../src/canalRecall/ownGround/railTracks.ts';

type Vec2 = [number, number];
const argOf = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const PBF = argOf('--pbf') ?? '.cache/osm-source/Amsterdam.osm.pbf';
const OUT = 'artifacts/own-ground/staging/rail-v1';
const ROOT = 'public/data/extracts/amsterdam';
const TRAM_ON_STREET_M = 5;
const CARRIAGEWAY = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'busway', 'primary_link', 'secondary_link', 'tertiary_link', 'trunk', 'trunk_link']);

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
}
const metres = (pts: readonly Vec2[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

async function main(): Promise<void> {
  if (!existsSync(PBF)) throw new Error(`no OSM extract at ${PBF}`);
  const work = join(tmpdir(), `rail-v1-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const filtered = join(work, 'rail.osm.pbf'), seq = join(work, 'rail.geojsonseq');
  execFileSync('osmium', ['tags-filter', '--overwrite', '-o', filtered, PBF, 'w/railway=rail,light_rail,subway,narrow_gauge,tram']);
  execFileSync('osmium', ['export', '--overwrite', '-f', 'geojsonseq', '-x', 'print_record_separator=false', '-o', seq, filtered]);
  const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
  await store.init();
  // Street segments that carry trams or cars, per 50 m bucket, for the tram separation test.
  const streets = new Map<string, [Vec2, Vec2][]>();
  const bucket = (p: Vec2) => `${Math.floor(p[0] / 50)}:${Math.floor(p[1] / 50)}`;
  for (const key of store.osmCells) {
    const osm = await store.osmCell(key);
    for (const w of osm?.ways ?? []) {
      if (!((w.tags.embedded_rails ?? '').includes('tram') || CARRIAGEWAY.has(w.tags.highway))) continue;
      const pts = w.g.map(p => toLocal(p[0], p[1]));
      for (let i = 0; i + 1 < pts.length; i++) {
        const seg: [Vec2, Vec2] = [pts[i], pts[i + 1]];
        const ks = new Set([bucket(pts[i]), bucket(pts[i + 1]), bucket([(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2])]);
        for (const k of ks) (streets.get(k) ?? streets.set(k, []).get(k)!).push(seg);
      }
    }
  }
  const nearStreet = (p: Vec2) => {
    const bx = Math.floor(p[0] / 50), by = Math.floor(p[1] / 50);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const [a, b] of streets.get(`${bx + dx}:${by + dy}`) ?? []) if (segDist(p, a, b) < TRAM_ON_STREET_M) return true;
    return false;
  };
  const byCell = new Map<string, RailWay[]>();
  const counts: Record<string, number> = {}, km: Record<string, number> = {}, dropped: Record<string, number> = {};
  let ways = 0;
  for (const line of readFileSync(seq, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const f = JSON.parse(line) as { geometry: { type: string; coordinates: [number, number][] }; properties: Record<string, string> };
    if (f.geometry?.type !== 'LineString') continue;
    ways++;
    const r = railOf(f.properties);
    if (!r) { const k = `${f.properties.railway}:${f.properties.tunnel ? 'tunnel' : 'other'}`; dropped[k] = (dropped[k] ?? 0) + 1; continue; }
    const points = f.geometry.coordinates.map(([lng, lat]) => toLocal(lng, lat));
    if (r.kind === 'tram') {
      // Samples every ~5 m: separated when at most a third of them lie near a street.
      const samples: Vec2[] = [];
      for (let i = 0; i + 1 < points.length; i++) { const [a, b] = [points[i], points[i + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5)); for (let k = 0; k < n; k++) samples.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
      const on = samples.filter(nearStreet).length;
      if (on > samples.length / 3) { dropped['tram:on-street'] = (dropped['tram:on-street'] ?? 0) + 1; continue; }
    }
    const way: RailWay = { ...r, points };
    // Every own-ground cell the way passes through (samples every 25 m).
    const keys = new Set<string>();
    for (let i = 0; i + 1 < points.length; i++) {
      const [a, b] = [points[i], points[i + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 25));
      for (let k = 0; k <= n; k++) keys.add(store.cellAt(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n));
    }
    let inside = false;
    for (const key of keys) if (store.osmCells.has(key)) { (byCell.get(key) ?? byCell.set(key, []).get(key)!).push(way); inside = true; }
    if (!inside) { dropped.outside = (dropped.outside ?? 0) + 1; continue; }
    const label = r.kind + (r.bridge ? '+bridge' : '') + (r.service ? '+service' : '');
    counts[label] = (counts[label] ?? 0) + 1;
    km[label] = (km[label] ?? 0) + metres(points) / 1000;
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'cells'), { recursive: true });
  let bytes = 0;
  const cells = [...byCell.keys()].sort();
  for (const key of cells) {
    const cell: RailCell = { version: RAIL_VERSION, key, w: encodeRail(byCell.get(key)!) };
    const gz = gzipSync(JSON.stringify(cell), { level: 9 });
    bytes += gz.byteLength;
    writeFileSync(join(OUT, 'cells', `${key}.json.gz`), gz);
  }
  const manifest: RailManifest = { version: RAIL_VERSION, cells, source: `OpenStreetMap ${PBF.split('/').pop()} (osmium tags-filter)`, attribution: RAIL_ATTRIBUTION, counts };
  writeFileSync(join(OUT, 'cells.json'), JSON.stringify(manifest));
  const report = { ways, cells: cells.length, ownGroundCells: store.osmCells.size, bytesGz: bytes, counts, km: Object.fromEntries(Object.entries(km).map(([k, v]) => [k, Math.round(v * 10) / 10])), dropped };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  rmSync(work, { recursive: true, force: true });
  if (process.argv.includes('--publish')) {
    const dest = join(ROOT, RAIL_EXTRACT);
    rmSync(dest, { recursive: true, force: true });
    cpSync(OUT, dest, { recursive: true });
    rmSync(join(dest, 'report.json'));
    console.log('published', dest);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
