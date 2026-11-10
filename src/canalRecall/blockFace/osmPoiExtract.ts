/**
 * Local OSM business extract for block-face intake (lane belt-gg-west 2026-11-10).
 *
 * Intake used to ask Overpass once per face for shops, amenities, crafts, offices, healthcare and tourism inside the
 * face's bbox. On a rate-limited day that took 3-12 minutes per face, and it was most of the canal belt's intake time.
 * The same query asked once for the whole city (`scripts/block-face/fetch-osm-pois.ts`) is archived as a versioned
 * extract; intake cuts each face's bbox from it here and asks Overpass only when no extract covers the face.
 *
 * Extract file: `{bbox: [s, w, n, e], fetchedAt, endpoint, query, elements}`: Overpass JSON with `out center tags`.
 */
import type {OsmBusiness} from './uses.ts';

export interface OverpassExtract { bbox: number[]; fetchedAt: string; endpoint?: string; query?: string; elements: any[]; cutFrom?: string }

/** The six keys intake reads, so a cut from the city extract equals a per-face query on the same data. */
export const POI_KEYS = ['shop', 'amenity', 'craft', 'office', 'healthcare', 'tourism'] as const;

export function poiQuery(bbox: number[], timeoutS = 60): string {
  const b = bbox.join(',');
  return `[out:json][timeout:${timeoutS}];(${POI_KEYS.map(k => `nwr["${k}"](${b});`).join('')});out center tags;`;
}

/** Whether `outer` ([s, w, n, e]) contains `inner`. */
export const bboxCovers = (outer: number[], inner: number[]) => outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];

const latLon = (e: any): [number, number] | null => {
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  return typeof lat === 'number' && typeof lon === 'number' ? [lat, lon] : null;
};

/** The elements of `extract` inside `bbox` ([s, w, n, e]), as a per-face Overpass response; null when the extract does
 *  not cover the bbox. Elements without one of the intake keys are dropped, so a wider extract cuts to the same set. */
export function cutExtract(extract: OverpassExtract, bbox: number[], source: string): OverpassExtract | null {
  if (!bboxCovers(extract.bbox, bbox)) return null;
  const [s, w, n, e] = bbox;
  const elements = extract.elements.filter(x => {
    const ll = latLon(x);
    return ll && ll[0] >= s && ll[0] <= n && ll[1] >= w && ll[1] <= e && x.tags && POI_KEYS.some(k => k in x.tags);
  });
  return {bbox, fetchedAt: extract.fetchedAt, endpoint: extract.endpoint, query: extract.query, cutFrom: source, elements};
}

/** Intake's business list from an Overpass response (per-face or cut). */
export function businessesFrom(json: OverpassExtract): OsmBusiness[] {
  return (json.elements ?? []).filter(e => e.tags && latLon(e)).map(e => ({type: e.type, id: e.id, lngLat: [e.lon ?? e.center.lon, e.lat ?? e.center.lat], tags: e.tags, fetchedAt: json.fetchedAt}));
}

/** Newest extract file name among `names` (`amsterdam-pois-YYYYMMDD.json[.gz]`), or null. */
export function newestExtract(names: string[]): string | null {
  const hits = names.filter(n => /^amsterdam-pois-\d{8}\.json(\.gz)?$/.test(n)).sort();
  return hits.at(-1) ?? null;
}
