// Coverage census for the BGT plaza report (lane bgt-plazas-20261110): BGT paved polygons by collection, functie and
// fysiek_voorkomen, city-wide and in Centrum, with how many touch a routing corridor and how much of their area no
// corridor covers (sampled on a 2 m grid against each corridor's playable half-width plus the guard's 4 px).
//
//   NODE_OPTIONS=--max-old-space-size=12000 npx tsx scripts/routing/bgt-plaza-census.ts > artifacts/bgt-plaza-census.json
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { isMotorOnlyHighway } from '../../src/canalRecall/routing/bikeAccess.ts';
import { loadRoutingFeatures } from '../lib/routingFeatures.ts';
import { boxOf, insidePolygon, polygonArea, toMetres, type Box } from './bgtPlazaGeometry.ts';
import type { Polygon } from 'polygon-clipping';

const SOURCE_DATA = process.env.MAP_RECALL_SOURCE_DATA || '/Users/blackmad/Code/map-recall2-source-data';
const DIRS: Array<[string, string]> = [
  ['wegdeel', process.env.BGT_WEGDEEL_DIR || `${SOURCE_DATA}/datasets/bgt-roads-20261016/cells`],
  ['onbegroeid', process.env.BGT_ONBEGROEID_DIR || 'artifacts/own-ground/raw/bgt-roads/onbegroeidterreindeel'],
];
const HALF_PX: Record<string, number> = {
  primary: 30, primary_link: 24, secondary: 26, secondary_link: 22, tertiary: 21, tertiary_link: 18, residential: 18,
  unclassified: 17, living_street: 16, service: 13, busway: 18, cycleway: 9, pedestrian: 14, footway: 7, path: 8,
};
const KEEP = /^(wegdeel\/(voetgangersgebied|plein|woonerf|voetpad|parkeervlak|inrit)|onbegroeid)\//;

const centrum: Polygon = (JSON.parse(readFileSync('public/data/extracts/amsterdam/boundaries.json', 'utf8')) as Array<{ name: string; geometry: [number, number][][][] }>)
  .find(b => b.name === 'Centrum')!.geometry[0].map(ring => ring.map(([lat, lon]) => toMetres(lon, lat)));

type Seg = { ax: number; ay: number; bx: number; by: number; reach: number };
const grid = new Map<string, Seg[]>();
const G = 50;
for (const f of await loadRoutingFeatures<{ highway?: string; path?: [number, number][]; paths?: [number, number][][] }>()) {
  if (isMotorOnlyHighway(f.highway)) continue;
  const reach = (HALF_PX[f.highway ?? 'residential'] ?? 32) / 3 + 4 / 3;
  for (const p of f.paths ?? (f.path ? [f.path] : [])) {
    if (p.length < 2 || (p.length > 3 && p[0][0] === p.at(-1)![0] && p[0][1] === p.at(-1)![1])) continue;
    for (let i = 0; i + 1 < p.length; i++) {
      const [ax, ay] = toMetres(p[i][1], p[i][0]), [bx, by] = toMetres(p[i + 1][1], p[i + 1][0]);
      const seg = { ax, ay, bx, by, reach };
      for (let gx = Math.floor((Math.min(ax, bx) - reach) / G); gx <= Math.floor((Math.max(ax, bx) + reach) / G); gx++) {
        for (let gy = Math.floor((Math.min(ay, by) - reach) / G); gy <= Math.floor((Math.max(ay, by) + reach) / G); gy++) {
          const k = `${gx},${gy}`; const l = grid.get(k); if (l) l.push(seg); else grid.set(k, [seg]);
        }
      }
    }
  }
}
const covered = (x: number, y: number, slack = 0) => {
  for (const s of grid.get(`${Math.floor(x / G)},${Math.floor(y / G)}`) ?? []) {
    const vx = s.bx - s.ax, vy = s.by - s.ay, l2 = vx * vx + vy * vy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - s.ax) * vx + (y - s.ay) * vy) / l2)) : 0;
    if (Math.hypot(x - (s.ax + t * vx), y - (s.ay + t * vy)) <= s.reach + slack) return true;
  }
  return false;
};

type Row = { count: number; area: number; centrumCount: number; centrumArea: number; touching: number; touchingUncovered: number; uncoveredArea: number; centrumUncoveredArea: number };
const rows = new Map<string, Row>();
const seen = new Set<string>();
for (const [collection, dir] of DIRS) {
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json.gz'))) {
    const cell = JSON.parse(gunzipSync(readFileSync(`${dir}/${file}`)).toString()) as { features: Array<{ id: string; functie: string; fv: string | null; h: number; eind: string | null; g: [number, number][][][] }> };
    for (const f of cell.features) {
      if (seen.has(f.id) || f.h !== 0 || f.eind) continue;
      seen.add(f.id);
      const key = collection === 'wegdeel' ? `wegdeel/${f.functie}/${f.fv}` : `onbegroeid/${f.fv}`;
      if (!KEEP.test(key)) continue;
      const polygons: Polygon[] = f.g.map(poly => poly.map(ring => ring.map(([lon, lat]) => toMetres(lon, lat))));
      const area = polygons.reduce((t, p) => t + polygonArea(p), 0);
      const box: Box = boxOf(polygons.flat());
      const inC = insidePolygon(centrum, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
      // Sample on a 2 m grid (at least the box centre): touching = any sample within 1 m beyond a corridor's reach.
      let samples = 0, open = 0, touch = false;
      for (let x = box.minX + 1; x < box.maxX; x += 2) for (let y = box.minY + 1; y < box.maxY; y += 2) {
        if (!polygons.some(p => insidePolygon(p, x, y))) continue;
        samples++;
        if (!covered(x, y)) open++;
        if (!touch && covered(x, y, 1)) touch = true;
      }
      const uncovered = samples ? area * open / samples : 0;
      const row = rows.get(key) ?? { count: 0, area: 0, centrumCount: 0, centrumArea: 0, touching: 0, touchingUncovered: 0, uncoveredArea: 0, centrumUncoveredArea: 0 };
      row.count++; row.area += area;
      if (inC) { row.centrumCount++; row.centrumArea += area; row.centrumUncoveredArea += uncovered; }
      if (touch) { row.touching++; if (open > 0) row.touchingUncovered++; }
      row.uncoveredArea += uncovered;
      rows.set(key, row);
    }
  }
}
const out = Object.fromEntries([...rows.entries()].sort((a, b) => b[1].area - a[1].area)
  .map(([k, r]) => [k, Object.fromEntries(Object.entries(r).map(([n, v]) => [n, Math.round(v)]))]));
console.log(JSON.stringify(out, null, 1));
