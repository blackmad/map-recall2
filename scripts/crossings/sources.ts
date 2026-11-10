// Open-data sources for the crossing register (G3, 2026-11-10), each cached under artifacts/crossings/raw so a draft
// re-runs offline and the record's evidence names the exact request.
//
//   BGT      PDOK OGC API Features https://api.pdok.nl/lv/bgt/ogc/v1 (CC0): overbruggingsdeel, tunneldeel,
//            kunstwerkdeel_vlak, spoor, wegdeel (hoogteligging ≠ 0), scheiding_lijn (muur). The API returns every
//            historical version of an object: only current ones (no eind_registratie, status bestaand) are kept.
//   AHN      AHN4 via PDOK WCS https://service.pdok.nl/rws/ahn/wcs/v1_0 (CC0): dtm_05m and dsm_05m, NAP metres.
//   OSM      Overpass API (© OpenStreetMap contributors, ODbL): ways with bridge/tunnel/layer and railways, with ids.
//   Panorama api.data.amsterdam.nl/panorama (Gemeente Amsterdam, CC BY 4.0): the nearest panorama and its thumbnail.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { readGeoTiff, type Raster } from '../../src/canalRecall/ownGround/geotiff.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';

export type LngLat = [number, number];
export const RAW = process.env.CROSSINGS_RAW ?? 'artifacts/crossings/raw';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const key = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);

async function cached(kind: string, url: string, init?: RequestInit, binary = false): Promise<Buffer> {
  const file = join(RAW, kind, key(url + (init?.body ?? '')) + (binary ? '.bin' : '.json'));
  if (existsSync(file)) return readFileSync(file);
  for (let attempt = 0; ; attempt++) {
    let status = 'network';
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': 'MapRecallCrossings/1.0', ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(90_000) });
      status = String(res.status);
      if (res.ok) {
        const b = Buffer.from(await res.arrayBuffer());
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, b);
        writeFileSync(file + '.url', url + '\n');
        return b;
      }
    } catch (e) { status = String(e); }
    if (attempt >= 5) throw new Error(`${kind} ${status}: ${url}`);
    await sleep(1500 * (attempt + 1));
  }
}

// ------------------------------------------------------------------ BGT
export const BGT_API = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections';
export type BgtCollection = 'overbruggingsdeel' | 'tunneldeel' | 'kunstwerkdeel_vlak' | 'kunstwerkdeel_lijn' | 'spoor' | 'wegdeel' | 'scheiding_lijn' | 'waterdeel' | 'overigbouwwerk';
export interface BgtFeature { id: string; collection: BgtCollection; props: Record<string, unknown>; type: string; coords: LngLat[][] /* rings or one line */ }

/** Current BGT features of `collection` in a bbox [w, s, e, n] (lng/lat), every page. */
export async function bgt(collection: BgtCollection, bbox: readonly number[], filter: Record<string, string> = {}): Promise<BgtFeature[]> {
  const out = new Map<string, BgtFeature>();
  let url: string | null = `${BGT_API}/${collection}/items?` + new URLSearchParams({ bbox: bbox.map(v => v.toFixed(6)).join(','), limit: '1000', f: 'json', ...filter });
  for (let page = 0; url && page < 200; page++) {
    const d = JSON.parse((await cached('bgt', url)).toString()) as { features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null }[]; links?: { rel: string; href: string }[] };
    for (const f of d.features) {
      const p = f.properties;
      if (p.eind_registratie || (p.status && p.status !== 'bestaand') || !f.geometry) continue;
      const g = f.geometry, coords: LngLat[][] = g.type === 'Polygon' ? (g.coordinates as LngLat[][]) : g.type === 'MultiPolygon' ? (g.coordinates as LngLat[][][]).map(r => r[0]) : g.type === 'LineString' ? [g.coordinates as LngLat[]] : g.type === 'MultiLineString' ? (g.coordinates as LngLat[][]) : g.type === 'Point' ? [[g.coordinates as LngLat]] : [];
      out.set(String(p.lokaal_id), { id: String(p.lokaal_id), collection, props: p, type: g.type, coords });
    }
    url = d.links?.find(l => l.rel === 'next')?.href ?? null;
  }
  return [...out.values()];
}

// ------------------------------------------------------------------ AHN
export const WCS = 'https://service.pdok.nl/rws/ahn/wcs/v1_0';
export interface AhnSampler { url: string; at(p: LngLat): number; raster: Raster }
/** AHN4 dtm_05m / dsm_05m over a lng/lat bbox, sampled at a point (NaN: no data). */
export async function ahn(coverage: 'dtm_05m' | 'dsm_05m', bbox: readonly number[]): Promise<AhnSampler> {
  const a = lngLatToRd([bbox[0], bbox[1]]), b = lngLatToRd([bbox[2], bbox[3]]);
  const rb = [Math.floor(Math.min(a.x, b.x)), Math.floor(Math.min(a.y, b.y)), Math.ceil(Math.max(a.x, b.x)), Math.ceil(Math.max(a.y, b.y))];
  const url = `${WCS}?` + new URLSearchParams({ SERVICE: 'WCS', VERSION: '1.0.0', REQUEST: 'GetCoverage', COVERAGE: coverage, CRS: 'EPSG:28992', BBOX: rb.join(','), RESX: '0.5', RESY: '0.5', FORMAT: 'GEOTIFF' });
  const raster = readGeoTiff(await cached('ahn', url, undefined, true), x => inflateSync(x));
  return {
    url, raster,
    at(p) {
      const r = lngLatToRd(p), i = Math.floor((r.x - raster.originX) / raster.pixelX), j = Math.floor((raster.originY - r.y) / Math.abs(raster.pixelY));
      if (i < 0 || j < 0 || i >= raster.width || j >= raster.height) return NaN;
      const v = raster.data[j * raster.width + i];
      return v === v && Math.abs(v) < 1000 ? v : NaN;
    },
  };
}
/** A robust level: the median of the samples that have data within `r` metres (3 × 3 at r/1.5 spacing… 9 samples). */
export function ahnMedian(s: AhnSampler, p: LngLat, r = 1.5): number {
  const KX = 111320 * Math.cos((p[1] * Math.PI) / 180), KY = 110540, v: number[] = [];
  for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) { const z = s.at([p[0] + dx / KX, p[1] + dy / KY]); if (z === z) v.push(z); }
  v.sort((x, y) => x - y);
  return v.length ? v[v.length >> 1] : NaN;
}

// ------------------------------------------------------------------ OSM (Overpass)
export const OVERPASS = 'https://overpass-api.de/api/interpreter';
export interface OsmWayFull { id: number; tags: Record<string, string>; g: LngLat[] }
/** Railways in a bbox, with ids and tags (rail-v1 keeps neither; the highways come from own-ground-osm-v1). `highways`: those too. */
export async function overpassWays(bbox: readonly number[], highways = false): Promise<OsmWayFull[]> {
  const b = `${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]}`;
  const q = highways ? `[out:json][timeout:120];(way[highway](${b});way[railway~"^(rail|light_rail|subway|tram|narrow_gauge)$"](${b}););out tags geom;` : `[out:json][timeout:120];way[railway~"^(rail|light_rail|subway|tram|narrow_gauge)$"](${b});out tags geom;`;
  const d = JSON.parse((await cached('osm', OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).toString()) as { elements: { id: number; tags?: Record<string, string>; geometry?: { lon: number; lat: number }[] }[] };
  return d.elements.filter(e => e.geometry).map(e => ({ id: e.id, tags: e.tags ?? {}, g: e.geometry!.map(q => [q.lon, q.lat] as LngLat) }));
}

// ------------------------------------------------------------------ Panoramas
export interface PanoRef { id: string; at: LngLat; heading: number; taken: string; thumbnail: string }
/** The nearest panoramas to `p` within `radius` (metres), newest first per distance band. */
export async function panoramas(p: LngLat, radius = 40, n = 4): Promise<PanoRef[]> {
  const url = `https://api.data.amsterdam.nl/panorama/panoramas/?` + new URLSearchParams({ near: `${p[0]},${p[1]}`, radius: String(radius), page_size: '40', srid: '4326' });
  const d = JSON.parse((await cached('pano', url)).toString()) as { _embedded?: { panoramas: { pano_id: string; timestamp: string; geometry: { coordinates: number[] }; _links: { thumbnail: { href: string } } }[] } };
  const KX = 111320 * Math.cos((p[1] * Math.PI) / 180), KY = 110540;
  const all = (d._embedded?.panoramas ?? []).map(q => {
    const at: LngLat = [q.geometry.coordinates[0], q.geometry.coordinates[1]];
    const heading = (((Math.atan2((p[0] - at[0]) * KX, (p[1] - at[1]) * KY) * 180) / Math.PI) + 360) % 360;
    return { id: q.pano_id, at, heading: Math.round(heading), taken: q.timestamp.slice(0, 10), thumbnail: `${q._links.thumbnail.href}?heading=${Math.round(heading)}&width=900&aspect=1.5&horizon=0.45`, d: Math.hypot((at[0] - p[0]) * KX, (at[1] - p[1]) * KY) };
  });
  // Newest year first, then nearest: the street as it is now.
  all.sort((a, b) => b.taken.slice(0, 4).localeCompare(a.taken.slice(0, 4)) || a.d - b.d);
  return all.slice(0, n).map(({ d: _d, ...r }) => r);
}
/** A panorama thumbnail's JPEG bytes (cached). */
export async function panoramaImage(ref: PanoRef): Promise<Buffer> { return cached('pano-img', ref.thumbnail, undefined, true); }
