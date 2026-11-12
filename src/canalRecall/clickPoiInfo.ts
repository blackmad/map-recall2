/** Mapped information for the actual building selected by the mesh picker. */
import { isLabelOnly, poiChipEnglish, poiChipKey } from './poiCardPolicy';
import { insideLine, titlePlace } from './placeTitle';
import { language, t } from '../i18n/index.ts';
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

/** The chip for a mapped place: its kind in English (CAFÉ), its category in Dutch. */
export const poiChipLabel = (row: Readonly<ClickPoiRow>): string =>
  language() === 'en' ? poiChipEnglish(row) : t(poiChipKey(row[4]) as Parameters<typeof t>[0]).toUpperCase();

const normalName = (name: string | null | undefined) => (name || '').normalize('NFC').toLocaleLowerCase('nl').trim();
export const osmUrl = (id: string) => `https://www.openstreetmap.org/${({ n: 'node', w: 'way', r: 'relation' } as Record<string, string>)[id[0]]}/${id.slice(1)}`;
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
      const key = normalName(row[1]);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  /**
   * The mapped place a drawn POI label stands for: the same name, nearest to
   * the label's point and within `maxMetres`. A tap on a label carries only
   * its text and point (labelLayer.ts hitTest), no footprint, so `contained`
   * cannot answer it (user shot 2026-11-08, the Sloterdijk gurdwara).
   */
  named(name: string | null | undefined, lngLat: readonly number[] | null | undefined, maxMetres = 60): ClickPoiRow | null {
    const key = normalName(name);
    if (!key || !lngLat || !Number.isFinite(lngLat[0]) || !Number.isFinite(lngLat[1])) return null;
    const [lng, lat] = lngLat;
    const cx = Math.floor(lng * 1000), cy = Math.floor(lat * 1000);
    const mx = 111320 * Math.cos(lat * Math.PI / 180), my = 110540;
    let best: ClickPoiRow | null = null, bestM = maxMetres;
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) {
      for (const row of this.cells.get(`${x}/${y}`) ?? []) {
        if (normalName(row[1]) !== key) continue;
        const metres = Math.hypot((row[2] - lng) * mx, (row[3] - lat) * my);
        if (metres <= bestM) { best = row; bestM = metres; }
      }
    }
    return best;
  }

  /** "Inside: X (restaurant) + n more" for a building whose places do not title it; '' otherwise. */
  inside(building: BuildingHit, hide?: (name: string) => boolean): string {
    if (!building.footprint) return '';
    const places = this.contained(building.footprint).filter(row => !isLabelOnly(row));
    if (!places.length || titlePlace({ places, buildingName: building.name, footprint: building.footprint, heightMetres: building.height })) return '';
    return insideLine(places, hide);
  }

  card(building: BuildingHit): LandmarkNotice | null {
    if (!building.footprint) return null;
    // A place with nothing beyond its kind ("X is mapped as an artwork") is a label, not a card: the building answers.
    const places = this.contained(building.footprint).filter(row => !isLabelOnly(row));
    if (!places.length) return null;
    // A place titles the building only when it is the building (C1, #367):
    // by name, by building-scale kind (a mall), or because the building is
    // small. Otherwise the building card leads and `insideLine` lists them.
    const first = titlePlace({ places, buildingName: building.name, footprint: building.footprint, heightMetres: building.height });
    if (!first) return null;
    places.unshift(...places.splice(places.indexOf(first), 1));
    const summaries = places.slice(0, 8).map(row => `${row[1]} is mapped as ${row[5] || row[4]}${row[6] ? ` at ${row[6]}` : ''}.`
      + (row[8] ? ` ${row[8]}` : ''));
    const paragraphs = summaries.map((summary, i) => summary
      + (validPoiWebsite(places[i][7]) ? `\nWebsite: ${validPoiWebsite(places[i][7])}` : '')
      + `\nMap source: ${osmUrl(places[i][0])}`);
    return {
      id: `clicked-poi-${building.id}`, name: places.length > 1 ? `${first[1]} + ${places.length - 1} mapped places` : first[1],
      type: first[4], typeLabel: poiChipLabel(first), detail: `${first[1]} is mapped as ${first[5] || first[4]}${first[6] ? ` at ${first[6]}` : ''}.`,
      longDetail: summaries.join('\n\n'), factTexts: paragraphs,
      sourceUrl: osmUrl(first[0]), lngLat: [first[2], first[3]], featureTarget: building.featureTarget,
    };
  }
}
