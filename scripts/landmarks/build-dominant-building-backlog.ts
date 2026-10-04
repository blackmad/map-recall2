/** Low-priority research candidates from the published city; never creates POIs. */
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { triageDominantBuilding, type FidelityReview } from './dominant-building-triage';
import { SIGNATURE_MODELS } from '../../src/canalRecall/landmarks/signatureModels';

const root = 'public/data/extracts/amsterdam/building-tiles';
const output = 'public/canal-drive/dominant-building-backlog.json';
const queue = JSON.parse(fs.readFileSync('public/canal-drive/poi-work-queue.json', 'utf8'));
const thresholds = queue.dominantBuildingThresholds;
const fidelity = JSON.parse(fs.readFileSync('public/canal-drive/dominant-building-fidelity.json', 'utf8'));
const destinations = JSON.parse(fs.readFileSync('public/canal-drive/landmark-backlog.json', 'utf8')).destinations;
const excluded = new Set(SIGNATURE_MODELS.flatMap(model => model.suppressOsmIds ?? []));
type Point = [number, number];
type Candidate = { id: string; name: string | null; footprintSquareMetres: number; heightMetres: number;
  minHeightMetres: number; center: Point; bounds: number[]; rings: Point[][]; holes: Point[][]; aliases: string[]; raisedParts: boolean; roofShape: string; poiNames: string[] };
const candidates = new Map<string, Candidate>();
const index = JSON.parse(fs.readFileSync(path.join(root, 'index-z14.json'), 'utf8'));
const municipality = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/boundaries.json', 'utf8'))
  .find((boundary: any) => boundary.kind === 'municipality' && boundary.name === 'Amsterdam');
if (!municipality) throw new Error('Amsterdam municipality boundary is required.');
const cityPolygons: Point[][][] = municipality.geometry.map((polygon: number[][][]) =>
  polygon.map(ring => ring.map(p => [p[1], p[0]])));
function area(ring: Point[]): number {
  const origin = ring[0];
  const kx = 111320 * Math.cos(origin[1] * Math.PI / 180);
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    sum += (a[0] - origin[0]) * kx * (b[1] - origin[1]) * 111320
      - (b[0] - origin[0]) * kx * (a[1] - origin[1]) * 111320;
  }
  return Math.abs(sum) / 2;
}
function inside(point: Point, ring: Point[]): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
function touches(point: Point, ring: Point[]): boolean {
  const kx = 111320 * Math.cos(point[1] * Math.PI / 180);
  return ring.some((a, index) => {
    const b = ring[(index + 1) % ring.length];
    const ax = (a[0] - point[0]) * kx, ay = (a[1] - point[1]) * 111320;
    const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * 111320;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + t * dx, ay + t * dy) <= 0.6;
  });
}
for (const tile of index.tileList as string[]) {
  const data = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, tile + '.geojson.gz'))).toString());
  for (const feature of data.features) {
    const props = feature.properties ?? {}, id = String(props.id ?? feature.id ?? '');
    if (!id || candidates.has(id) || excluded.has(id)) continue;
    const polygons = feature.geometry?.type === 'Polygon' ? [feature.geometry.coordinates]
      : feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
    if (!polygons.length) continue;
    const footprint = polygons.reduce((sum: number, rings: Point[][]) =>
      sum + Math.max(0, area(rings[0]) - rings.slice(1).reduce((holes, ring) => holes + area(ring), 0)), 0);
    const height = Number(props.height);
    if (!(footprint >= thresholds.footprintSquareMetres || height >= thresholds.heightMetres)) continue;
    const rings: Point[][] = polygons.map((polygon: Point[][]) => polygon[0]);
    const points = rings.flat();
    const bounds = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
      Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
    const center: Point = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
    if (!cityPolygons.some(polygon => inside(center, polygon[0]) && !polygon.slice(1).some(hole => inside(center, hole)))) continue;
    candidates.set(id, { id, name: props.name ?? null, footprintSquareMetres: footprint,
      heightMetres: Number.isFinite(height) ? height : 0, minHeightMetres: Number(props.minHeight) || 0,
      center, bounds, rings, holes: polygons.flatMap((polygon: Point[][]) => polygon.slice(1)), aliases: [], raisedParts: Number(props.minHeight) > 0, roofShape: String(props.roofShape ?? props['roof:shape'] ?? ''),
      poiNames: destinations.filter((poi: any) => Number.isFinite(poi.lng) && Number.isFinite(poi.lat)
        && polygons.some((poly: Point[][]) => inside([poi.lng, poi.lat], poly[0])
          && !poly.slice(1).some(hole => inside([poi.lng, poi.lat], hole)))).map((poi: any) => poi.name) });
  }
}
// Group near-identical footprints and clearly raised parts. Ground-level
// courtyard neighbors remain separate even when enclosed by a larger building.
const retained: Candidate[] = [];
for (const item of [...candidates.values()].sort((a, b) => b.footprintSquareMetres - a.footprintSquareMetres)) {
  const parent = retained.find(other => {
    const tolerance = 0.00001;
    if (item.bounds[0] < other.bounds[0] - tolerance || item.bounds[1] < other.bounds[1] - tolerance
      || item.bounds[2] > other.bounds[2] + tolerance || item.bounds[3] > other.bounds[3] + tolerance) return false;
    const twin = item.footprintSquareMetres / other.footprintSquareMetres >= 0.85
      && Math.abs(item.heightMetres - other.heightMetres) < 3;
    if (!twin && !(item.minHeightMetres > 0 && other.minHeightMetres === 0)) return false;
    const vertices = item.rings.flat();
    return vertices.filter(p => other.rings.some(ring => inside(p, ring) || touches(p, ring))
      && !other.holes.some(hole => inside(p, hole) && !touches(p, hole))).length / vertices.length >= 0.8;
  });
  if (parent) {
    parent.aliases.push(item.id);
    parent.raisedParts ||= item.minHeightMetres > 0;
    parent.poiNames = [...new Set([...parent.poiNames, ...item.poiNames])];
    parent.heightMetres = Math.max(parent.heightMetres, item.heightMetres);
  } else retained.push(item);
}
const items = retained.sort((a, b) => b.footprintSquareMetres * b.heightMetres - a.footprintSquareMetres * a.heightMetres)
  .map(({ rings: _rings, holes: _holes, bounds: _bounds, minHeightMetres: _base, ...item }) => ({
    ...item, fidelity: triageDominantBuilding({ heightMetres: item.heightMetres, holes: _holes.length,
      outlines: _rings.length, vertices: _rings.reduce((sum, ring) => sum + ring.length - 1, 0),
      raisedParts: item.raisedParts, roofShape: item.roofShape, poiNames: item.poiNames }, fidelity.reviews[item.id] as FidelityReview | undefined),
    footprintSquareMetres: Math.round(item.footprintSquareMetres), heightMetres: Math.round(item.heightMetres * 10) / 10,
    priority: 'low', status: 'needs-identification-and-research',
    sourceUrl: /^[wr]\d+$/.test(item.id) ? `https://www.openstreetmap.org/${item.id[0] === 'w' ? 'way' : 'relation'}/${item.id.slice(1)}`
      : 'https://3dbag.nl/en/viewer',
  }));
fs.writeFileSync(output, JSON.stringify({ version: 1, source: root, boundaryId: municipality.id, thresholds,
  notes: ['Dimensions are published-source estimates. Candidates are not destinations or researched POIs.',
    'Exact modeled identities excluded; repeated tile identities, near-identical footprints and raised parts grouped.',
    'Ground-level courtyard buildings remain separate. Uncertain complex identities require manual research.'],
  candidateCount: items.length, candidates: items }, null, 2) + '\n');
console.log(`${items.length} dominant building candidates written to ${output}.`);
