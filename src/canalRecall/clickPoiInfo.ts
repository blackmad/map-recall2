/** Mapped information for the actual building selected by the mesh picker. */
import type { BuildingHit, GeoJsonFeature, LandmarkNotice } from './game/worldTypes';

export type PolygonGeometry = Extract<GeoJsonFeature['geometry'], { type: 'Polygon' | 'MultiPolygon' }>;
/** Canonical OSM ID, name, longitude, latitude, category, mapped kind, address,
 * validated website, explicitly English description. */
export type ClickPoiRow = [string, string, number, number, string, string, string, string, string];
export interface ClickPoiFile { version: 1; source: string; points: ClickPoiRow[] }

export function validPoiWebsite(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(/^[a-z]+:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    return /^(https?:)$/.test(url.protocol) && url.hostname.includes('.') && !url.username && !url.password
      ? url.href : '';
  } catch { return ''; }
}

function inRing(point: readonly number[], ring: number[][]): boolean {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    // A mapped entrance on the outer wall belongs to the building; a point
    // on a courtyard boundary is excluded by the hole test below.
    if (Math.abs(cross) < 1e-14 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)
      && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function poiInsideBuilding(point: readonly number[], geometry: PolygonGeometry): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(rings => rings.length && inRing(point, rings[0])
    && !rings.slice(1).some(hole => inRing(point, hole)));
}

const osmUrl = (id: string) => `https://www.openstreetmap.org/${({ n: 'node', w: 'way', r: 'relation' } as Record<string, string>)[id[0]]}/${id.slice(1)}`;
const cell = (lng: number, lat: number) => `${Math.floor(lng * 1000)}/${Math.floor(lat * 1000)}`;

export class ClickPoiIndex {
  private readonly cells = new Map<string, ClickPoiRow[]>();
  private readonly rows: ClickPoiRow[] = [];
  constructor(file: ClickPoiFile | null | undefined) {
    if (file?.version !== 1 || !Array.isArray(file.points)) return;
    for (const row of file.points) {
      if (!Array.isArray(row) || !/^[nwr]\d+$/.test(row[0]) || !row[1]
        || !Number.isFinite(row[2]) || !Number.isFinite(row[3])) continue;
      this.rows.push(row);
      const key = cell(row[2], row[3]);
      const group = this.cells.get(key) ?? [];
      group.push(row); this.cells.set(key, group);
    }
  }

  contained(geometry: PolygonGeometry): ClickPoiRow[] {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    const outer = polygons.flatMap(rings => rings[0] ?? []);
    if (!outer.length) return [];
    const xs = outer.map(p => Math.floor(p[0] * 1000)), ys = outer.map(p => Math.floor(p[1] * 1000));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const candidates: ClickPoiRow[] = [];
    if ((maxX - minX + 1) * (maxY - minY + 1) > 2000) candidates.push(...this.rows);
    else for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) candidates.push(...(this.cells.get(`${x}/${y}`) ?? []));
    const found = candidates.filter(row => poiInsideBuilding([row[2], row[3]], geometry))
      .sort((a, b) => Number(!!b[8]) - Number(!!a[8]) || Number(!!b[7]) - Number(!!a[7]) || a[0].localeCompare(b[0]));
    // A venue may have both its entrance node and its building mapped.
    const seen = new Set<string>();
    return found.filter(row => {
      const key = row[1].normalize('NFC').toLocaleLowerCase('nl').trim();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  card(building: BuildingHit): LandmarkNotice | null {
    if (!building.footprint) return null;
    const places = this.contained(building.footprint);
    if (!places.length) return null;
    // A mapped mall describes the physical complex; its tenant shops belong
    // in the remaining information rather than naming the entire building.
    const title = places.findIndex(row => row[1] === building.name || row[5] === 'a mall');
    if (title > 0) places.unshift(...places.splice(title, 1));
    const summaries = places.slice(0, 8).map(row => `${row[1]} is mapped as ${row[5] || row[4]}${row[6] ? ` at ${row[6]}` : ''}.`
      + (row[8] ? ` ${row[8]}` : ''));
    const paragraphs = summaries.map((summary, i) => summary
      + (validPoiWebsite(places[i][7]) ? `\nWebsite: ${validPoiWebsite(places[i][7])}` : '')
      + `\nMap source: ${osmUrl(places[i][0])}`);
    const first = places[0];
    return {
      id: `clicked-poi-${building.id}`, name: places.length > 1 ? `${first[1]} + ${places.length - 1} mapped places` : first[1],
      type: first[4], detail: `${first[1]} is mapped as ${first[5] || first[4]}${first[6] ? ` at ${first[6]}` : ''}.`,
      longDetail: summaries.join('\n\n'), factTexts: paragraphs,
      sourceUrl: osmUrl(first[0]), lngLat: [first[2], first[3]], featureTarget: building.featureTarget,
    };
  }
}
