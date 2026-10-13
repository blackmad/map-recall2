/**
 * PDOK luchtfoto (Beeldmateriaal Nederland, CC BY 4.0) on its native RD grid.
 *
 * The WMTS `EPSG:28992` matrix set is metric and north-up, so a pand outline in
 * RD metres maps to pixels by a scale and an offset: no reprojection per pixel.
 * Level 14 is 0.21 m/px (the "25 cm" product's native grid), level 15 0.105 m,
 * level 16 0.0525 m (the 8 cm HR set). Tiles are 256 px.
 *
 * Every tile is cached on disk under `.cache/luchtfoto-20261013/<layer>/<level>/<col>/<row>.jpeg`;
 * `archive-luchtfoto.ts` copies the cache into map-recall2-source-data with the licence line.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const LUCHTFOTO_LICENCE = 'Beeldmateriaal Nederland / PDOK luchtfoto, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0';
export const WMTS = 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0';
/** EPSG:28992 matrix set (PDOK): top-left corner and level-0 resolution. */
export const RD_ORIGIN = { x: -285401.92, y: 903401.92 };
export const RD_RES0 = 3440.64;
export const TILE_PX = 256;
export const resolutionAt = (level: number): number => RD_RES0 / 2 ** level;
export const tileSpanM = (level: number): number => resolutionAt(level) * TILE_PX;

export type OrthoTileKey = { layer: string; level: number; col: number; row: number };
export const tileOfRd = (x: number, y: number, level: number): { col: number; row: number } => ({
  col: Math.floor((x - RD_ORIGIN.x) / tileSpanM(level)),
  row: Math.floor((RD_ORIGIN.y - y) / tileSpanM(level)),
});
/** RD of a tile's top-left corner. */
export const tileOriginRd = (col: number, row: number, level: number): { x: number; y: number } => ({
  x: RD_ORIGIN.x + col * tileSpanM(level),
  y: RD_ORIGIN.y - row * tileSpanM(level),
});

export const DEFAULT_CACHE = path.resolve('.cache/luchtfoto-20261013');
export const tileFile = (cache: string, k: OrthoTileKey) => path.join(cache, k.layer, String(k.level), String(k.col), `${k.row}.jpeg`);
export const tileUrl = (k: OrthoTileKey) => `${WMTS}/${k.layer}/EPSG:28992/${k.level}/${k.col}/${k.row}.jpeg`;

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** The tile's JPEG bytes, from cache or the network (retried); null for a 404 (outside the coverage). */
export async function fetchOrthoTile(k: OrthoTileKey, cache = DEFAULT_CACHE): Promise<Buffer | null> {
  const file = tileFile(cache, k);
  try { return fs.readFileSync(file); } catch { /* fetch */ }
  let last: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(tileUrl(k), { headers: { 'User-Agent': 'MapRecallRoofFacts/1.0 (open data research)' } });
      if (response.status === 404) return null;
      if (response.ok) {
        const bytes = Buffer.from(await response.arrayBuffer());
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
        return bytes;
      }
      last = new Error(`HTTP ${response.status} ${tileUrl(k)}`);
    } catch (error) { last = error; }
    await wait(300 * 2 ** attempt);
  }
  throw last;
}

/** Every tile key touching any of the RD boxes. */
export function tilesForBoxes(boxes: Iterable<readonly [number, number, number, number]>, level: number): Array<{ col: number; row: number }> {
  const seen = new Set<string>(), out: Array<{ col: number; row: number }> = [];
  for (const [minX, minY, maxX, maxY] of boxes) {
    const a = tileOfRd(minX, maxY, level), b = tileOfRd(maxX, minY, level);
    for (let row = a.row; row <= b.row; row++) for (let col = a.col; col <= b.col; col++) {
      const k = `${col}/${row}`; if (!seen.has(k)) { seen.add(k); out.push({ col, row }); }
    }
  }
  return out;
}

/** Download (to the cache only) every listed tile, `concurrency` at a time. Returns [fetched, missing]. */
export async function prefetch(layer: string, level: number, tiles: ReadonlyArray<{ col: number; row: number }>, concurrency = 24, cache = DEFAULT_CACHE): Promise<[number, number]> {
  let next = 0, fetched = 0, missing = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, tiles.length) }, async () => {
    while (next < tiles.length) {
      const t = tiles[next++];
      if (fs.existsSync(tileFile(cache, { layer, level, ...t }))) continue;
      const bytes = await fetchOrthoTile({ layer, level, ...t }, cache);
      if (bytes) fetched++; else missing++;
    }
  }));
  return [fetched, missing];
}

export type RgbImage ={ data: Uint8Array; width: number; height: number };
export async function decodeRgb(bytes: Buffer): Promise<RgbImage> {
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

/**
 * A mosaic of tiles covering an RD box at one level: `pixel(x, y)` reads the RGB at an RD point
 * (nearest pixel), or null outside the fetched coverage.
 */
export class OrthoMosaic {
  readonly res: number;
  private tiles = new Map<string, RgbImage | null>();
  constructor(readonly layer: string, readonly level: number, readonly cache = DEFAULT_CACHE) { this.res = resolutionAt(level); }
  private key(col: number, row: number) { return `${col}/${row}`; }
  /** Load every tile touching the RD box. */
  async load(minX: number, minY: number, maxX: number, maxY: number, concurrency = 12): Promise<void> {
    const a = tileOfRd(minX, maxY, this.level), b = tileOfRd(maxX, minY, this.level);
    const jobs: Array<[number, number]> = [];
    for (let row = a.row; row <= b.row; row++) for (let col = a.col; col <= b.col; col++) if (!this.tiles.has(this.key(col, row))) jobs.push([col, row]);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (next < jobs.length) {
        const [col, row] = jobs[next++];
        const bytes = await fetchOrthoTile({ layer: this.layer, level: this.level, col, row }, this.cache);
        this.tiles.set(this.key(col, row), bytes ? await decodeRgb(bytes) : null);
      }
    }));
  }
  /** Drop decoded tiles to bound memory. */
  clear(): void { this.tiles.clear(); }
  get size(): number { return this.tiles.size; }
  pixel(x: number, y: number): [number, number, number] | null {
    const span = tileSpanM(this.level);
    const fx = (x - RD_ORIGIN.x) / span, fy = (RD_ORIGIN.y - y) / span;
    const col = Math.floor(fx), row = Math.floor(fy);
    const img = this.tiles.get(this.key(col, row));
    if (!img) return null;
    const px = Math.min(img.width - 1, Math.floor((fx - col) * img.width)), py = Math.min(img.height - 1, Math.floor((fy - row) * img.height));
    const i = (py * img.width + px) * 3;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  }
}
