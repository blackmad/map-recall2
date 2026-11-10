/**
 * Stage container stacks (open industrial yards) and rail sidings from the cached OSM extract
 * (src/canalRecall/yardFill.ts). Staging only: scripts/data/yard-fill/{container-stacks,rail-sidings}.json
 * and yard-fill.report.json; a renderer adapter behind ?yardFill=1 reads them (not wired here).
 *
 * Usage: node --import tsx scripts/build-yard-fill.ts
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { containerStacks, project, unproject, ringArea, SIDING_BALLAST_WIDTH_M } from '../src/canalRecall/yardFill';
import { outerRings, pointInRing, type LngLat, type Ring } from '../src/canalRecall/landmarks/osmUnderModels';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'scripts/data/yard-fill');
const pbf = path.join(ROOT, '.cache/osm-source/Amsterdam.osm.pbf');
// Reviewed anchors only: OSM has no container-terminal tag, and "industrial + private aisles" also matches
// substations, fuel depots and waste sites (first run, 2026-11-09, put stacks on 20 of them). A terminal's extent is the
// hull of its private service aisles within ANCHOR_RADIUS_M of the anchor, buffered by HULL_BUFFER_M.
const ANCHORS = [
  { id: 'hornweg-terminal', name: 'Hornweg container terminal (Westpoort)', at: [4.8041, 52.4076] as LngLat, bbox: '4.790,52.400,4.820,52.416', stacks: true },
  { id: 'zaanstraat-rail-yard', name: 'Zaanstraat rail yard', at: [4.8739, 52.3899] as LngLat, bbox: '4.860,52.384,4.890,52.396', stacks: false },
];
const ANCHOR_RADIUS_M = 220, HULL_BUFFER_M = 15;
type F = { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } };
const lines = (g: F['geometry']): LngLat[][] => g.type === 'LineString' ? [g.coordinates as LngLat[]] : g.type === 'MultiLineString' ? g.coordinates as LngLat[][] : [];
const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function hull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((x, y) => x[0] - y[0] || x[1] - y[1]), lo: [number, number][] = [], up: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
const stacks: { id: string; name: string; areaM2: number; aisles: number; boxes: ReturnType<typeof containerStacks> }[] = [];
const sidingsOut: { anchor: string; lines: LngLat[][] }[] = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yardfill-'));
for (const an of ANCHORS) {
  const part = path.join(tmp, `${an.id}.osm.pbf`), seq = path.join(tmp, `${an.id}.geojsonseq`);
  execFileSync('osmium', ['extract', '-b', an.bbox, pbf, '-o', part, '--overwrite']);
  execFileSync('osmium', ['export', part, '-f', 'geojsonseq', '-x', 'print_record_separator=false', '-o', seq, '--overwrite']);
  const feats = fs.readFileSync(seq, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as F);
  const near = (p: LngLat) => { const [x, y] = project(p, an.at); return Math.hypot(x, y) <= ANCHOR_RADIUS_M; };
  sidingsOut.push({ anchor: an.id, lines: feats.filter(f => f.properties.railway === 'rail' && (f.properties.service === 'yard' || f.properties.service === 'spur')).flatMap(f => lines(f.geometry)).filter(l => l.some(near)) });
  if (!an.stacks) continue;
  const aisles = feats.filter(f => f.properties.highway === 'service' && f.properties.access === 'private').flatMap(f => lines(f.geometry)).filter(l => l.some(near));
  const pts: [number, number][] = [];
  for (const l of aisles) for (const p of l) { const [x, y] = project(p, an.at); for (let k = 0; k < 8; k++) pts.push([x + HULL_BUFFER_M * Math.cos(k * Math.PI / 4), y + HULL_BUFFER_M * Math.sin(k * Math.PI / 4)]); }
  if (pts.length < 3) continue;
  const h = hull(pts), ring: Ring = [...h, h[0]].map(([x, y]) => unproject(x, y, an.at));
  const bl = feats.filter(f => f.properties.building && f.geometry.type !== 'Point' && f.geometry.type !== 'LineString').flatMap(f => outerRings(f.geometry as never)).filter(r => pointInRing(r[0], ring));
  const area = ringArea([...h, h[0]]);
  stacks.push({ id: an.id, name: an.name, areaM2: Math.round(area), aisles: aisles.length, boxes: containerStacks(an.id, ring, aisles, bl) });
}
fs.mkdirSync(OUT, { recursive: true });
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
fs.writeFileSync(path.join(OUT, 'container-stacks.json'), `${JSON.stringify({ version: 'yard-fill-v1', yards: stacks.map(s => ({ ...s, boxes: s.boxes.map(b => [r5(b.c[0]), r5(b.c[1]), b.headingDeg, b.h, b.colour]) })), boxFields: ['lng', 'lat', 'headingDeg', 'heightM', 'colour'], boxSizeM: [12.2, 2.44] })}\n`);
fs.writeFileSync(path.join(OUT, 'rail-sidings.json'), `${JSON.stringify({ version: 'yard-fill-v1', ballastWidthM: SIDING_BALLAST_WIDTH_M, anchors: sidingsOut.map(s => ({ anchor: s.anchor, lines: s.lines.map(l => l.map(p => [r5(p[0]), r5(p[1])])) })) })}\n`);
const report = { generatedAt: new Date().toISOString().slice(0, 10), anchors: ANCHORS.map(a => a.id), stackYards: stacks.map(s => ({ id: s.id, areaM2: s.areaM2, aisles: s.aisles, boxes: s.boxes.length })), sidingLines: Object.fromEntries(sidingsOut.map(s => [s.anchor, s.lines.length])), firstRunRejected: 'industrial+aisles heuristic matched 20 substations/fuel/waste sites; replaced by reviewed anchors' };
fs.writeFileSync(path.join(OUT, 'yard-fill.report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
fs.rmSync(tmp, { recursive: true, force: true });
