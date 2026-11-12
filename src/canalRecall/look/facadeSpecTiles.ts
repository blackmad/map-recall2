/**
 * The resolved house specs a runtime record chunk reads (F1 S4b, #380). The world compiler hands the record packer every
 * pand's resolved spec (`d`, `x`, `s` of the house-specs extract, scripts/world/shellBake.ts loadHouseSpecTable); the
 * runtime features carry only the generic path's view (`p.houseSpec`). So the building worker reads the same extract
 * tiles itself: the z14 tiles a chunk's footprints touch (a pand sits in a tile its footprint reaches), each fetched
 * once per worker and kept (the whole extract is ~0.5 MB gzip). The near chunk and the baked tier then pack one record.
 */
import { packFacadeRecordFor, FACADE_RECORD_BYTES, FACADE_RECORD_VERSION, type FacadeRecordInput, type FacadeSpecInput } from './facadeRecord.js';
import type { FacadeRecordSet } from '../world/facadeStreams.js';

export const SPEC_TILE_ZOOM = 14;
type SpecTile = Record<string, { d?: Record<string, unknown>; x?: Record<string, unknown>; s?: Record<string, string> }>;
type Geom = { type: string; coordinates: unknown };

const lngTile = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const latTile = (lat: number, z: number) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z); };

/** z14 tiles (`x/y`) touched by the bounding box of every feature's footprint. */
export function specTilesOf(features: readonly { geometry?: unknown }[], z = SPEC_TILE_ZOOM): string[] {
  const out = new Set<string>();
  const walk = (c: unknown, box: number[]) => {
    if (Array.isArray(c) && typeof c[0] === 'number') { const [x, y] = c as number[]; box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); }
    else if (Array.isArray(c)) for (const k of c) walk(k, box);
  };
  for (const f of features) {
    const g = f.geometry as Geom | null | undefined;
    if (!g) continue;
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    walk(g.coordinates, box);
    if (!Number.isFinite(box[0])) continue;
    for (let x = lngTile(box[0], z); x <= lngTile(box[2], z); x++) for (let y = latTile(box[3], z); y <= latTile(box[1], z); y++) out.add(`${x}/${y}`);
  }
  return [...out].sort();
}

async function readJson(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** One worker's spec tiles: fetched once each (a missing tile is an empty one), looked up by pand id. */
export class SpecTileTable {
  private readonly tiles = new Map<string, Promise<SpecTile>>();
  constructor(private readonly base: string, private readonly fetcher: typeof fetch = (...a) => fetch(...a)) {}
  private tile(key: string): Promise<SpecTile> {
    let t = this.tiles.get(key);
    if (!t) {
      t = this.fetcher(`${this.base.replace(/\/$/, '')}/${SPEC_TILE_ZOOM}/${key}.json.gz`)
        .then(async r => (r.ok ? (((await readJson(r)) as { buildings?: SpecTile })?.buildings ?? {}) : {}))
        .catch(() => ({}));
      this.tiles.set(key, t);
    }
    return t;
  }
  /** `specFor(id)` over the tiles these features touch (the spec as loadHouseSpecTable keeps it: d, x, s). */
  async specFor(features: readonly { geometry?: unknown }[]): Promise<(id: string) => FacadeSpecInput | undefined> {
    const tiles = await Promise.all(specTilesOf(features).map(k => this.tile(k)));
    return (id: string) => {
      for (const t of tiles) { const r = t[id]; if (r) return { d: r.d, ...(r.x ? { x: r.x } : {}), s: r.s }; }
      return undefined;
    };
  }
}

/** A runtime chunk's records: record `k` packed from `inputs[k]` (the mesher's `rec` indexes these). */
export function packChunkRecords(inputs: readonly FacadeRecordInput[]): FacadeRecordSet {
  const bytes = new Uint8Array(inputs.length * FACADE_RECORD_BYTES);
  inputs.forEach((input, k) => bytes.set(packFacadeRecordFor(input), k * FACADE_RECORD_BYTES));
  return { version: FACADE_RECORD_VERSION, count: inputs.length, bytes };
}
