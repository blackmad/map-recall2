/**
 * Which building footprint is under a map click, from the published z14 city
 * tiles (`building-tiles/14/x/y.geojson.gz`, the BAG/OSM layer the ride draws).
 * One tile (~200 KB gzipped) is fetched per new area clicked and kept.
 */
import { tileFor, tileKey } from '../slippyTiles';
import { bagPandNumber, inPolygon } from './indexBuilder';
import type { ClickTarget } from './panel';
import type { LngLat } from './types';

type Feature = { properties?: { id?: unknown }; geometry?: { type: string; coordinates: unknown } };

/** The footprint containing a point, among a tile's features. Pure, for tests. */
export function footprintAt([lng, lat]: LngLat, features: readonly Feature[]): ClickTarget {
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const polygons = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as number[][][][];
    if (!polygons.some(poly => inPolygon(lng, lat, poly))) continue;
    const id = String(f.properties?.id ?? '');
    const pand = bagPandNumber(id);
    if (pand) return { kind: 'pand', id: pand };
    if (/^[nwr]\d+$/.test(id)) return { kind: 'osm', id };
  }
  return { kind: 'point' };
}

async function readTile(response: Response): Promise<{ features?: Feature[] }> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  // Hosting may or may not have decoded the gzip already.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export class FootprintLookup {
  private readonly tiles = new Map<string, Promise<Feature[]>>();
  constructor(private readonly extractBase: string, private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  async at(lngLat: LngLat): Promise<ClickTarget> {
    const tile = tileFor(lngLat[0], lngLat[1], 14);
    const key = tileKey(tile);
    let features = this.tiles.get(key);
    if (!features) {
      features = this.fetchImpl(`${this.extractBase}/building-tiles/${key}.geojson.gz`)
        .then(r => (r.ok ? readTile(r) : { features: [] }))
        .then(fc => fc.features ?? [])
        .catch(() => { this.tiles.delete(key); return []; });
      this.tiles.set(key, features);
    }
    return footprintAt(lngLat, await features);
  }
}
