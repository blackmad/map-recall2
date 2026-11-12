/**
 * Whether a mapped place may title the building that was tapped (lane C1,
 * issue #367; user shot 2026-11-10: one restaurant, "Arepa Shop Amsterdam",
 * named a whole nine-storey slab at Anthony Fokkerweg 61).
 *
 * A place titles its building only when the name matches the building, the
 * place's kind is itself building-scale (mall, school, hotel, ...), or the
 * building is small (footprint < 400 m2, at most 4 storeys) and holds one or
 * two places. Otherwise the building leads and the places follow as
 * "Inside: Arepa Shop Amsterdam (restaurant) + 3 more".
 */
import type { ClickPoiRow, PolygonGeometry } from './clickPoiInfo';
import { storeysFor } from './buildingFacts';

export const SMALL_FOOTPRINT_M2 = 400;
export const SMALL_MAX_STOREYS = 4;
export const SMALL_MAX_PLACES = 2;

/** Kind phrases (click-POI column 5) that describe a whole building. */
const BUILDING_SCALE_KIND = /\b(mall|shopping (centre|center)|school|college|university|hotel|hostel|museum|church|cathedral|chapel|mosque|synagogue|temple|station|library|theatre|theater|cinema|hospital)\b/i;
export const isBuildingScaleKind = (row: Readonly<ClickPoiRow>): boolean => BUILDING_SCALE_KIND.test(row[5] || '');

const norm = (name: string | null | undefined) => (name || '').normalize('NFC').toLocaleLowerCase('nl').trim();

/** Planar area in square metres of a footprint (holes subtracted). */
export function footprintAreaM2(geometry: PolygonGeometry): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const ring = (r: number[][]): number => {
    if (r.length < 3) return 0;
    const lat0 = r[0][1] * Math.PI / 180, mx = 111320 * Math.cos(lat0), my = 110540;
    let s = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      s += (r[j][0] * mx) * (r[i][1] * my) - (r[i][0] * mx) * (r[j][1] * my);
    }
    return Math.abs(s) / 2;
  };
  return polygons.reduce((sum, rings) => sum + rings.reduce((a, r, i) => a + (i ? -ring(r) : ring(r)), 0), 0);
}

export interface TitleInput {
  places: ReadonlyArray<Readonly<ClickPoiRow>>;
  buildingName?: string;
  footprint?: PolygonGeometry;
  heightMetres?: number | null;
}

/** The place that may title the building, or null when the building leads. */
export function titlePlace(input: TitleInput): ClickPoiRow | null {
  const { places } = input;
  if (!places.length) return null;
  const byName = input.buildingName ? places.find(r => norm(r[1]) === norm(input.buildingName)) : undefined;
  if (byName) return byName as ClickPoiRow;
  const scale = places.find(isBuildingScaleKind);
  if (scale) return scale as ClickPoiRow;
  const storeys = storeysFor(input.heightMetres);
  const small = !!input.footprint && footprintAreaM2(input.footprint) < SMALL_FOOTPRINT_M2
    && (storeys == null || storeys <= SMALL_MAX_STOREYS) && places.length <= SMALL_MAX_PLACES;
  return small ? places[0] as ClickPoiRow : null;
}

const bare = (kind: string) => kind.replace(/^(a|an)\s+/i, '');

/** "Inside: Arepa Shop Amsterdam (restaurant) + 2 more", or '' when there is nothing to list. */
export function insideLine(places: ReadonlyArray<Readonly<ClickPoiRow>>, hide: (name: string) => boolean = () => false): string {
  const shown = places.filter(r => r[1] && !hide(r[1]));
  if (!shown.length) return '';
  const first = shown[0], kind = bare(first[5] || '');
  const more = shown.length - 1;
  return `Inside: ${first[1]}${kind ? ` (${kind})` : ''}${more > 0 ? ` + ${more} more` : ''}`;
}
