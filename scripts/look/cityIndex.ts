/**
 * The streamed city as the runtime sees it, for offline look work (measured period walls, row keys): every
 * building-tiles z14 feature with its outer ring, height, the construction year the runtime stamps on it
 * (building-facts, genericFacades.ts constructionYearEnricher) and the buurt group it stands in (boundaries.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { plausibleYear, shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';

export const EXTRACT = path.resolve(import.meta.dirname, '../../public/data/extracts/amsterdam');

export type CityBuilding = {
  id: string; tile: string; ring: [number, number][]; centre: [number, number]; heightM: number; year: number | null; areaM2: number; group: BuurtGroup;
};

/** Buurt groups the measurement reports on (first matching boundary wins, in this order). */
export const BUURT_GROUPS = {
  'kinker-dacosta': ['Kinkerbuurt', 'Da Costabuurt'],
  'oud-west': ['Van Lennepbuurt', 'Helmersbuurt', 'Overtoomse Sluis', 'Vondelparkbuurt', 'Frederik Hendrikbuurt'],
  'oud-zuid': ['Willemspark', 'Museumkwartier', 'Apollobuurt', 'Stadionbuurt', 'Schinkelbuurt', 'Hoofddorppleinbuurt', 'Oud-Zuid'],
  'canal-jordaan': ['Grachtengordel', 'Jordaan', 'Nieuwmarkt/Lastage'],
  'de-pijp': ['De Pijp', 'Oude Pijp', 'Nieuwe Pijp'],
  'nieuw-west': ['Slotervaart', 'Nieuw-West'],
} as const;
export type BuurtGroup = keyof typeof BUURT_GROUPS | 'other';

type Boundary = { name: string; rings: [number, number][][]; bbox: [number, number, number, number] };
function boundaries(): { group: BuurtGroup; b: Boundary }[] {
  const raw = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'boundaries.json'), 'utf8')) as { name: string; geometry: number[][][][] }[];
  const out: { group: BuurtGroup; b: Boundary }[] = [];
  for (const [group, names] of Object.entries(BUURT_GROUPS)) for (const name of names) for (const item of raw.filter(r => r.name === name)) {
    // boundaries.json rings are [lat, lng]; flip to [lng, lat].
    const rings = item.geometry.flatMap(poly => poly.slice(0, 1).map(ring => ring.map(([lat, lng]) => [lng, lat] as [number, number])));
    const xs = rings.flat().map(p => p[0]), ys = rings.flat().map(p => p[1]);
    out.push({ group: group as BuurtGroup, b: { name, rings, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] } });
  }
  return out;
}
export function inRing([x, y]: readonly [number, number], ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const KX = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180), KY = 110_540;
export function ringAreaM2(ring: readonly (readonly [number, number])[]): number {
  if (ring.length < 3) return 0;
  const kx = KX(ring[0][1]);
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * kx) * (ring[i][1] * KY) - (ring[i][0] * kx) * (ring[j][1] * KY);
  return Math.abs(a) / 2;
}

const gz = (file: string) => { const b = fs.readFileSync(file); return JSON.parse((b[0] === 0x1f ? zlib.gunzipSync(b) : b).toString('utf8')); };

/** Every building-tiles feature once (first tile it appears in), with year and buurt group. */
export function loadCity(): CityBuilding[] {
  const years = new Map<string, number>();
  const factRoot = path.join(EXTRACT, 'building-facts/14');
  for (const x of fs.readdirSync(factRoot)) for (const f of fs.readdirSync(path.join(factRoot, x))) {
    const rows = gz(path.join(factRoot, x, f)).buildings as Record<string, number[]>;
    for (const [k, row] of Object.entries(rows)) if (row[0] && plausibleYear(row[0])) years.set(k, row[0]);
  }
  const bounds = boundaries();
  const out: CityBuilding[] = [], seen = new Set<string>();
  const root = path.join(EXTRACT, 'building-tiles/14');
  for (const x of fs.readdirSync(root).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(root, x)).filter(n => n.endsWith('.geojson.gz'))) {
    for (const feature of gz(path.join(root, x, f)).features) {
      const id = String(feature.properties?.id ?? '');
      if (!id || seen.has(id)) continue;
      const g = feature.geometry, ring: [number, number][] | undefined = g?.type === 'Polygon' ? g.coordinates[0] : g?.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : undefined;
      if (!ring?.length) continue;
      seen.add(id);
      const centre: [number, number] = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
      let group: BuurtGroup = 'other';
      for (const { group: gName, b } of bounds) {
        if (centre[0] < b.bbox[0] || centre[0] > b.bbox[2] || centre[1] < b.bbox[1] || centre[1] > b.bbox[3]) continue;
        if (b.rings.some(r => inRing(centre, r))) { group = gName; break; }
      }
      out.push({ id, tile: `${x}/${f.split('.')[0]}`, ring, centre, heightM: Number(feature.properties.height) || 0, year: years.get(shortBuildingId(id)) ?? null, areaM2: ringAreaM2(ring), group });
    }
  }
  return out;
}

/** The report's five periods (the palette's `modern` split at 1985 so post-war and recent blocks are measured apart). */
export type ReportPeriod = 'canal' | 'c19' | 'school' | 'postwar' | 'modern';
export const reportPeriod = (year: number): ReportPeriod => year < 1860 ? 'canal' : year < 1915 ? 'c19' : year < 1945 ? 'school' : year < 1985 ? 'postwar' : 'modern';
