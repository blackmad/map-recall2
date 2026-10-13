// Build the own map's whole-city overview from extracts we already ship — no
// third-party tiles. Writes to a staging path with a coverage report:
//
//   npx tsx scripts/own-map/build-own-map.ts
//   # review artifacts/own-map/staging/own-map-v1/report.json, then
//   mkdir -p public/data/extracts/amsterdam/own-map-v1 && \
//     cp artifacts/own-map/staging/own-map-v1/overview.json.gz public/data/extracts/amsterdam/own-map-v1/
//
// Inputs (public/data/extracts/amsterdam/): elevation-v1 water polygons (the
// basemap's z14 shoreline, already cached), parks.json, streets-routing.json
// (centrelines + highway class), water.json (named centrelines, for labels),
// boundaries.json (neighbourhood names). See docs/research/drop-maplibre-20261010.md.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { toLocal, ORIGIN, KX, KY, type Vec2 } from '../../src/canalRecall/ownMap/frame.ts';
import { simplify, ringArea } from '../../src/canalRecall/ownMap/geometry.ts';
import { encodeLine, streetClassOf, STREET_CLASSES, type OverviewFile } from '../../src/canalRecall/ownMap/overviewFormat.ts';

const SRC = 'public/data/extracts/amsterdam';
const OUT = 'artifacts/own-map/staging/own-map-v1';
const UNIT = 0.5;
const TOL = { street: 1.0, water: 1.2, park: 2.0, waterLine: 4.0 };
const MIN_WATER_AREA = 40;

const json = (name: string) => JSON.parse(readFileSync(join(SRC, name), 'utf8'));
type LatLng = [number, number];
const fromLatLng = (path: LatLng[]): Vec2[] => path.map(([lat, lng]) => toLocal(lng, lat));

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const names: string[] = [], nameIndex = new Map<string, number>();
  const nameOf = (n: string | undefined) => {
    if (!n) return -1;
    let i = nameIndex.get(n);
    if (i === undefined) { i = names.length; names.push(n); nameIndex.set(n, i); }
    return i;
  };
  const report: Record<string, unknown> = {};
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (pts: Vec2[]) => { for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } };

  // Water polygons: elevation-v1 cells (1 km, 0.1 m quantised, elevation frame).
  const index = json('elevation-v1/index.json');
  const quant = index.quantization.xy, size = index.cellSizeM;
  const [ox, oy] = index.origin as [number, number], [mx, my] = index.metresPerDegree as [number, number];
  const water: number[][][] = [];
  let waterIn = 0, waterOut = 0, waterDropped = 0;
  for (const file of readdirSync(join(SRC, 'elevation-v1/cells'))) {
    const cell = json(`elevation-v1/cells/${file}`) as { cell: [number, number]; water: number[][][] };
    const cx = cell.cell[0] * size, cy = cell.cell[1] * size;
    for (const poly of cell.water) {
      const rings: number[][] = [];
      poly.forEach((flat, ri) => {
        const pts: Vec2[] = [];
        for (let i = 0; i + 1 < flat.length; i += 2) pts.push(toLocal(ox + (cx + flat[i] * quant) / mx, oy + (cy + flat[i + 1] * quant) / my));
        waterIn += pts.length;
        const s = simplify(pts, TOL.water);
        if (s.length < 3 || Math.abs(ringArea(s)) < MIN_WATER_AREA) { if (ri === 0) waterDropped++; return; }
        if (ri === 0 || rings.length) { rings.push(encodeLine(s, UNIT)); waterOut += s.length; if (ri === 0) grow(s); }
      });
      if (rings.length) water.push(rings);
    }
  }
  report.water = { polygons: water.length, pointsIn: waterIn, pointsOut: waterOut, droppedSmall: waterDropped };

  // Parks: parks.json outlines (path / paths are closed rings, lat/lng).
  const parks: OverviewFile['parks'] = [];
  let parkPts = 0;
  for (const p of json('parks.json') as Array<{ name: string; path?: LatLng[]; paths?: LatLng[][] }>) {
    const raw = p.paths?.length ? p.paths : p.path ? [p.path] : [];
    const seen = new Set<string>();
    const rings: number[][] = [];
    for (const r of raw) {
      const key = JSON.stringify(r[0]) + r.length;
      if (seen.has(key) || r.length < 4) continue; seen.add(key);
      const s = simplify(fromLatLng(r), TOL.park);
      if (s.length < 3) continue;
      rings.push(encodeLine(s, UNIT)); parkPts += s.length;
    }
    if (rings.length) parks.push([nameOf(p.name), ...rings]);
  }
  report.parks = { parks: parks.length, points: parkPts };

  // Streets by class.
  const streets: number[][] = [];
  const byClass: Record<string, number> = {}, unknown: Record<string, number> = {};
  let stIn = 0, stOut = 0;
  for (const s of json('streets-routing.json') as Array<{ name?: string; highway?: string; path?: LatLng[]; paths?: LatLng[][] }>) {
    const cls = streetClassOf(s.highway);
    if (!cls) { unknown[s.highway ?? '?'] = (unknown[s.highway ?? '?'] ?? 0) + 1; continue; }
    const raw = s.paths?.length ? s.paths : s.path ? [s.path] : [];
    for (const r of raw) {
      if (r.length < 2) continue;
      const pts = fromLatLng(r); stIn += pts.length;
      const simp = simplify(pts, TOL.street);
      const enc = encodeLine(simp, UNIT);
      if (enc.length < 4) continue;
      stOut += simp.length; grow(simp);
      streets.push([STREET_CLASSES.indexOf(cls), nameOf(s.name), ...enc]);
      byClass[cls] = (byClass[cls] ?? 0) + 1;
    }
  }
  report.streets = { lines: streets.length, pointsIn: stIn, pointsOut: stOut, byClass, skippedHighways: unknown };

  // Named water centrelines (labels only).
  const waterLines: number[][] = [];
  for (const w of json('water.json') as Array<{ name?: string; path?: LatLng[]; paths?: LatLng[][] }>) {
    if (!w.name) continue;
    for (const r of (w.paths?.length ? w.paths : w.path ? [w.path] : [])) {
      if (r.length < 2) continue;
      const enc = encodeLine(simplify(fromLatLng(r), TOL.waterLine), UNIT);
      if (enc.length >= 4) waterLines.push([nameOf(w.name), ...enc]);
    }
  }
  report.waterLines = waterLines.length;

  // Neighbourhood label points (centroid of the exterior, as vector-map.js setPlaces does).
  const hoods: number[][] = [];
  for (const b of json('boundaries.json') as Array<{ name: string; kind: string; geometry?: LatLng[][][] }>) {
    if (b.kind !== 'neighbourhood' || !b.geometry) continue;
    for (const poly of b.geometry) {
      const ext = poly[0]; if (!ext || ext.length < 3) continue;
      const pts = fromLatLng(ext);
      const c = pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]).map(v => v / pts.length);
      hoods.push([nameOf(b.name), Math.round(c[0] / UNIT), Math.round(c[1] / UNIT)]);
    }
  }
  report.hoods = hoods.length;

  const file: OverviewFile = {
    version: 1, frame: { origin: [ORIGIN.lng, ORIGIN.lat], kx: KX, ky: KY }, unit: UNIT,
    bounds: [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)],
    names, water, parks, streets, waterLines, hoods,
    sources: ['elevation-v1 water (OpenFreeMap z14 shoreline, cached)', 'parks.json', 'streets-routing.json', 'water.json', 'boundaries.json', '© OpenStreetMap contributors (ODbL)'],
  };
  const text = JSON.stringify(file);
  // Shipped gzipped (like building-tiles): the page inflates it with
  // DecompressionStream, so the transfer size does not depend on the server.
  const gz = gzipSync(text, { level: 9 });
  writeFileSync(join(OUT, 'overview.json.gz'), gz);
  report.bytes = text.length;
  report.gzipBytes = gz.length;
  report.names = names.length;
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main();
