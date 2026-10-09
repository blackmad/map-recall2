// Audit: which streamed buildings render as plain coloured boxes (no facade)?
//
// Runs every building tile through the game's own decoration chain
// (galleryPipeline.gameDecorator, with construction years and the landmark /
// listed sets the game loads) and then meshBuildingFor in the default 'photo'
// look. A building is "bare" when the mesh builder gives it no facade.
// Writes artifacts/large-tier/candidates.json and summary.json.
//
//   node --import tsx scripts/large-tier/audit.ts [--min-area=150] [--out=artifacts/large-tier]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { gameDecorator, type Feature } from '../../src/canalRecall/galleryPipeline.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { footprintAreaM2 } from '../../src/canalRecall/genericFacades.ts';
import { shortBuildingId, plausibleYear } from '../../src/canalRecall/buildingFacts.ts';
import { KIT_HIDE_IDS, KIT_PART_IDS } from '../../src/canalRecall/landmarkKits.ts';
import { largeTierReason } from '../../src/canalRecall/largeBuildingTier.ts';
import { SIGNATURE_MODELS, suppressedOsmIds } from '../../src/canalRecall/landmarks/signatureModels.ts';
import { footprintPolygon, pointInRing, type LngLat } from '../../src/canalRecall/landmarks/signaturePlacement.ts';

const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const MIN_AREA = Number(arg('min-area', '150'));
const OUT = arg('out', 'artifacts/large-tier');
const EXTRACT = 'public/data/extracts/amsterdam';
const gz = (file: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());

const landmarkIds = new Set<string>();
for (const list of Object.values(JSON.parse(fs.readFileSync(`${EXTRACT}/landmark-buildings.json`, 'utf8')).buildings as Record<string, string[]>)) for (const id of list) landmarkIds.add(String(id));
const gablesFile = JSON.parse(fs.readFileSync(`${EXTRACT}/monument-gables.json`, 'utf8'));
const listed = new Set<string>(gablesFile.listedLandmarks ?? []);
const gables = new Map(Object.entries(gablesFile.buildings ?? {})) as never;
const decorate = gameDecorator({ landmarkIds, listed, gables });
const hidden = new Set<string>([...KIT_HIDE_IDS, ...KIT_PART_IDS]);
const signatureIds = new Set(suppressedOsmIds());
const signatureRings = SIGNATURE_MODELS.filter(m => m.footprint).map(m => footprintPolygon(m.footprint!, 4));
const bySignature = (id: string, c: [number, number]) => signatureIds.has(id) || signatureRings.some(r => pointInRing(c as unknown as LngLat, r));

// Frontage: distance from a footprint to the nearest named street or canal centreline.
type Seg = { a: [number, number]; b: [number, number]; name: string; kind: 'canal' | 'main' | 'street' };
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;
const xy = (lng: number, lat: number): [number, number] => [(lng - 4.9) * KX, (lat - 52.37) * KY];
const segs: Seg[] = [];
const MAIN = new Set(['primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link']);
for (const s of JSON.parse(fs.readFileSync(`${EXTRACT}/streets-routing.json`, 'utf8')) as Array<{ name: string; highway: string; path: [number, number][] }>) {
  if (!s.name || !s.path) continue;
  for (let i = 1; i < s.path.length; i++) segs.push({ a: xy(s.path[i - 1][1], s.path[i - 1][0]), b: xy(s.path[i][1], s.path[i][0]), name: s.name, kind: MAIN.has(s.highway) ? 'main' : 'street' });
}
for (const w of JSON.parse(fs.readFileSync(`${EXTRACT}/water.json`, 'utf8')) as Array<{ name: string; paths?: [number, number][][]; path?: [number, number][] }>) {
  if (!w.name || !/gracht|Amstel|kanaal|singel|Singel/i.test(w.name)) continue;
  for (const p of w.paths ?? (w.path ? [w.path] : [])) for (let i = 1; i < p.length; i++) segs.push({ a: xy(p[i - 1][1], p[i - 1][0]), b: xy(p[i][1], p[i][0]), name: w.name, kind: 'canal' });
}
const CELL = 100;
const grid = new Map<string, Seg[]>();
for (const s of segs) {
  const x0 = Math.floor(Math.min(s.a[0], s.b[0]) / CELL), x1 = Math.floor(Math.max(s.a[0], s.b[0]) / CELL);
  const y0 = Math.floor(Math.min(s.a[1], s.b[1]) / CELL), y1 = Math.floor(Math.max(s.a[1], s.b[1]) / CELL);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = `${x},${y}`; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(s); }
}
const segDist = (p: [number, number], s: Seg) => {
  const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - s.a[0] - t * dx, p[1] - s.a[1] - t * dy);
};
/** Nearest street/canal to any vertex of the ring, per kind. */
function frontage(ring: number[][]) {
  const best: Record<Seg['kind'], { d: number; name: string }> = { canal: { d: Infinity, name: '' }, main: { d: Infinity, name: '' }, street: { d: Infinity, name: '' } };
  for (const [lng, lat] of ring) {
    const p = xy(lng, lat), cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (const s of grid.get(`${x},${y}`) ?? []) {
      const d = segDist(p, s); if (d < best[s.kind].d) best[s.kind] = { d, name: s.name };
    }
  }
  return best;
}
// Canal belt (grachtengordel + Jordaan + centre), roughly the Singelgracht ring.
const CANAL_BELT = [[4.8735, 52.3590], [4.8810, 52.3565], [4.9050, 52.3570], [4.9230, 52.3620], [4.9180, 52.3780], [4.9050, 52.3800], [4.8890, 52.3830], [4.8770, 52.3810], [4.8730, 52.3700]];
const inside = (pt: number[], poly: number[][]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > pt[1]) !== (poly[j][1] > pt[1]) && pt[0] < (poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };

type Row = { id: string; reason: string; areaM2: number; heightM: number; year: number | null; centroid: [number, number]; wallHex: string; canalBelt: boolean; landmark: boolean; nearestCanal: string | null; canalDistM: number; nearestStreet: string | null; streetDistM: number; mainStreet: boolean; visibility: number; hiddenByKit: boolean; hiddenBySignatureModel: boolean };
const rows: Row[] = [];
let total = 0, bareAll = 0, bareArea = 0, facedLarge = 0;
const tilesRoot = `${EXTRACT}/building-tiles/14`;
for (const x of fs.readdirSync(tilesRoot)) for (const file of fs.readdirSync(path.join(tilesRoot, x))) {
  const y = file.replace('.geojson.gz', '');
  const fc = gz(path.join(tilesRoot, x, file)) as { features: Feature[] };
  let facts: Record<string, number[]> = {};
  const factsFile = `${EXTRACT}/building-facts/14/${x}/${y}.json.gz`;
  if (fs.existsSync(factsFile)) facts = gz(factsFile).buildings ?? {};
  for (const raw of fc.features) {
    total++;
    const p = { ...raw.properties };
    const row = facts[shortBuildingId(String(p.id ?? ''))];
    if (row && plausibleYear(row[0])) p.constructionYear = row[0];
    const feature = decorate({ ...raw, properties: p });
    const b = meshBuildingFor(feature, 'photo');
    if (!b) continue;
    const area = footprintAreaM2(feature.geometry);
    const reason = !b.bare ? 'faced' : landmarkIds.has(String(feature.properties.id)) && !feature.properties.landmarkBare ? 'landmark-unmodelled' : largeTierReason(feature.properties, feature.geometry);
    if (!b.bare || feature.properties.kitWall) { if (area >= MIN_AREA && feature.properties.largeTier) facedLarge++; continue; }
    bareAll++; bareArea += area;
    if (area < MIN_AREA) continue;
    const ring = (feature.geometry as { type: string; coordinates: number[][][] | number[][][][] }).type === 'Polygon' ? (feature.geometry as { coordinates: number[][][] }).coordinates[0] : (feature.geometry as { coordinates: number[][][][] }).coordinates[0][0];
    const c = ring.reduce((s, q) => [s[0] + q[0] / ring.length, s[1] + q[1] / ring.length], [0, 0]) as [number, number];
    const f = frontage(ring);
    const id = String(feature.properties.id);
    const heightM = Number(feature.properties.height) || 0;
    const canalD = f.canal.d, streetD = Math.min(f.main.d, f.street.d);
    // Visibility: big wall area seen from a canal or a main street ranks first.
    const exposure = canalD < 30 ? 3 : f.main.d < 20 ? 2.5 : streetD < 15 ? 1.5 : 0.5;
    const visibility = Math.round(exposure * Math.sqrt(area) * Math.min(heightM, 40) * (inside(c, CANAL_BELT) ? 2 : 1));
    rows.push({ id, reason, areaM2: Math.round(area), heightM, year: (feature.properties.constructionYear as number) ?? null, centroid: [+c[1].toFixed(6), +c[0].toFixed(6)], wallHex: b.wallHex, canalBelt: inside(c, CANAL_BELT), landmark: landmarkIds.has(id), nearestCanal: canalD < 60 ? f.canal.name : null, canalDistM: Math.round(canalD), nearestStreet: streetD < 40 ? (f.main.d <= f.street.d ? f.main.name : f.street.name) : null, streetDistM: Math.round(streetD), mainStreet: f.main.d < 20, visibility, hiddenByKit: hidden.has(id), hiddenBySignatureModel: bySignature(id, c) });
  }
}
rows.sort((a, b) => b.visibility - a.visibility);
const shown = rows.filter(r => !r.hiddenByKit && !r.hiddenBySignatureModel);
const byReason = (list: Row[]) => list.reduce((m, r) => { m[r.reason] = (m[r.reason] ?? 0) + 1; return m; }, {} as Record<string, number>);
const belt = shown.filter(r => r.canalBelt);
const summary = {
  generated: new Date().toISOString(), look: 'photo', minAreaM2: MIN_AREA, buildingsScanned: total,
  bareAnySize: bareAll, bareAnySizeAreaM2: Math.round(bareArea),
  bareLarge: rows.length, bareLargeShown: shown.length, bareLargeAreaM2: shown.reduce((s, r) => s + r.areaM2, 0), bareLargeByReason: byReason(shown),
  canalBelt: { count: belt.length, areaM2: belt.reduce((s, r) => s + r.areaM2, 0), byReason: byReason(belt), onCanal: belt.filter(r => r.canalDistM < 30).length, onMainStreet: belt.filter(r => r.mainStreet).length },
  largeTierFaced: facedLarge,
  top20: shown.slice(0, 20).map(r => `${r.id} ${r.reason} ${r.areaM2} m2 ${r.heightM} m ${r.nearestCanal ?? r.nearestStreet ?? ''}`),
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/candidates.json`, JSON.stringify(rows, null, 1));
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
