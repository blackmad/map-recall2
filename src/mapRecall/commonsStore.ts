/**
 * Our own record of what we have read from Wikimedia Commons, so a scrape is paid for once and
 * every derived file (area postcards, place photos) can be rebuilt offline from it.
 *
 * Two tables, each a sorted JSON-lines file in the store directory (scripts/fetch-area-photos.ts
 * says where; it is kept out of git because it grows by about 2 KB per file):
 *   - geosearch.jsonl: one line per geosearch query (point, radius, namespace, limit) with every hit
 *     it returned (page id, title, coordinates), so "which files lie inside this area" is answerable
 *     without the network;
 *   - files.jsonl: one line per file page with the imageinfo we asked for (URLs, size, MIME type) and
 *     the licence and credit fields of its extmetadata, HTML as Commons sent it.
 *
 * Pure: (de)serialisation and lookups only; the fetch script does the I/O.
 */

export interface GeoHit { pageid: number; title: string; lat: number; lon: number }
export interface GeoQuery { lat: number; lon: number; radiusM: number; namespace: number; limit: number; hits: GeoHit[]; fetchedAt: string }

export interface StoredFile {
  pageid: number;
  title: string;
  url: string;
  thumbUrl?: string;
  thumbWidth?: number;
  width: number;
  height: number;
  mime: string;
  /** extmetadata values we keep (licence, credit, description, dates, categories). */
  meta: Record<string, string>;
  fetchedAt: string;
}

/** extmetadata fields worth keeping: enough to credit, license and describe a file without asking again. */
export const KEPT_META = [
  'LicenseShortName', 'License', 'LicenseUrl', 'UsageTerms', 'AttributionRequired', 'Copyrighted', 'Restrictions',
  'Artist', 'Credit', 'Attribution', 'ImageDescription', 'ObjectName', 'DateTimeOriginal', 'DateTime', 'Categories',
  'GPSLatitude', 'GPSLongitude',
] as const;

export const geoKey = (q: Pick<GeoQuery, 'lat' | 'lon' | 'radiusM' | 'namespace' | 'limit'>) =>
  `${q.lat.toFixed(5)},${q.lon.toFixed(5)},${q.radiusM},${q.namespace},${q.limit}`;

export class CommonsStore {
  readonly geo = new Map<string, GeoQuery>();
  readonly files = new Map<number, StoredFile>();

  static parse(geoText: string, filesText: string): CommonsStore {
    const store = new CommonsStore();
    for (const line of geoText.split('\n')) if (line.trim()) { const q = JSON.parse(line) as GeoQuery; store.geo.set(geoKey(q), q); }
    for (const line of filesText.split('\n')) if (line.trim()) { const f = JSON.parse(line) as StoredFile; store.files.set(f.pageid, f); }
    return store;
  }

  /** Stable text: queries by key, files by page id, so reruns diff only what changed. */
  serialise(): { geo: string; files: string } {
    const lines = <T>(rows: T[]) => rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
    // Hits keep the API's nearest-first order: callers cap lists by it, so reordering would change answers.
    const geo = [...this.geo.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, q]) => q);
    return { geo: lines(geo), files: lines([...this.files.values()].sort((a, b) => a.pageid - b.pageid)) };
  }

  addGeo(query: GeoQuery) { this.geo.set(geoKey(query), query); }
  getGeo(q: Pick<GeoQuery, 'lat' | 'lon' | 'radiusM' | 'namespace' | 'limit'>) { return this.geo.get(geoKey(q)); }

  /** Store one imageinfo page from the action API (`prop=imageinfo&iiprop=url|size|mime|extmetadata`). */
  addImageInfoPage(page: { pageid: number; title: string; imageinfo?: Array<Record<string, any>> }, fetchedAt: string): StoredFile | undefined {
    const info = page.imageinfo?.[0];
    if (!info) return undefined;
    const meta: Record<string, string> = {};
    for (const key of KEPT_META) { const value = info.extmetadata?.[key]?.value; if (value != null && value !== '') meta[key] = String(value); }
    const file: StoredFile = {
      pageid: page.pageid, title: page.title, url: info.url, thumbUrl: info.thumburl, thumbWidth: info.thumbwidth,
      width: info.width, height: info.height, mime: info.mime, meta, fetchedAt,
    };
    this.files.set(file.pageid, file);
    return file;
  }
}

/** Action API answers some failures (rate limits, maxlag, bad params) with HTTP 200 and an error body. */
export function apiError(data: unknown): { code: string; info?: string; retryable: boolean } | undefined {
  const error = (data as { error?: { code?: string; info?: string } } | null)?.error;
  if (!error) return undefined;
  const code = error.code ?? 'unknown';
  return { code, info: error.info, retryable: /ratelimit|maxlag|readonly|internal|toomany|timeout|busy/i.test(code) };
}
