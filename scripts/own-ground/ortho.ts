// PDOK 8 cm orthophoto crops in the own-ground frame (Beeldmateriaal Nederland, CC BY 4.0).
//
// Tiles are fetched from the open luchtfoto WMS (Actueel_orthoHR, EPSG:3857, 128 m × 1000 px ≈ 7.8 cm per pixel
// in Web Mercator, ~4.8 cm on the ground at 52.37 N) and cached as JPEG; `orthoCrop` samples them on a north-up grid
// of the game's local frame (groundStore toLocal), the grid render-topdown.ts and road-look.ts rasterise the own
// ground on, so a texel of either is the same patch of street.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';

export const ORTHO_ATTRIBUTION = 'Luchtfoto: Beeldmateriaal Nederland (PDOK), CC BY 4.0';
const R = 6378137, TILE_M = 128, TILE_PX = 1000;
const merc = (lng: number, lat: number): [number, number] => [(lng * Math.PI / 180) * R, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * R];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class OrthoTiles {
  private readonly tiles = new Map<string, Promise<Uint8Array>>();
  constructor(readonly cache = process.env.ORTHO_CACHE ?? '.cache/pdok-ortho-8cm') {}

  private async fetchTile(tx: number, ty: number): Promise<Uint8Array> {
    const file = join(this.cache, `${tx}_${ty}.jpg`);
    if (!existsSync(file)) {
      const x0 = tx * TILE_M, y0 = ty * TILE_M, url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
      url.search = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', LAYERS: 'Actueel_orthoHR', STYLES: '', CRS: 'EPSG:3857', BBOX: `${x0},${y0},${x0 + TILE_M},${y0 + TILE_M}`, WIDTH: String(TILE_PX), HEIGHT: String(TILE_PX), FORMAT: 'image/jpeg' }).toString();
      let res: Response | null = null;
      for (let i = 0; i < 4; i++) { res = await fetch(url, { headers: { 'User-Agent': 'MapRecallRoadLook/1.0' } }); if (res.ok) break; await sleep(600 * (i + 1)); }
      if (!res?.ok) throw new Error(`PDOK ${tx},${ty}: ${res?.status}`);
      mkdirSync(this.cache, { recursive: true });
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
    const { data } = await sharp(readFileSync(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return new Uint8Array(data);
  }

  private tile(tx: number, ty: number): Promise<Uint8Array> {
    const k = `${tx}_${ty}`;
    let p = this.tiles.get(k);
    if (!p) { p = this.fetchTile(tx, ty); this.tiles.set(k, p); }
    return p;
  }

  /** RGB over [x0, x0 + w·res] × [y0, y0 + h·res] of the local frame, north up (row 0 at y0 + h·res), bilinear. */
  async crop(x0: number, y0: number, w: number, h: number, res: number): Promise<Uint8Array> {
    const out = new Uint8Array(w * h * 3);
    // Mercator position of every texel centre (the local frame is near-conformal over a crop: corners suffice, but per texel is cheap).
    const need = new Set<string>();
    const pos = new Float64Array(w * h * 2);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const [lng, lat] = fromLocal(x0 + (i + 0.5) * res, y0 + h * res - (j + 0.5) * res), [mx, my] = merc(lng, lat);
      pos[(j * w + i) * 2] = mx; pos[(j * w + i) * 2 + 1] = my;
      need.add(`${Math.floor(mx / TILE_M)}_${Math.floor(my / TILE_M)}`);
    }
    const data = new Map<string, Uint8Array>();
    for (const k of need) { const [tx, ty] = k.split('_').map(Number); data.set(k, await this.tile(tx, ty)); }
    const sample = (mx: number, my: number, c: number) => {
      const tx = Math.floor(mx / TILE_M), ty = Math.floor(my / TILE_M), d = data.get(`${tx}_${ty}`);
      if (!d) return 0;
      const px = Math.min(TILE_PX - 1, Math.max(0, Math.floor((mx - tx * TILE_M) / TILE_M * TILE_PX))), py = Math.min(TILE_PX - 1, Math.max(0, Math.floor(((ty + 1) * TILE_M - my) / TILE_M * TILE_PX)));
      return d[(py * TILE_PX + px) * 3 + c];
    };
    const step = TILE_M / TILE_PX;
    for (let t = 0; t < w * h; t++) {
      const mx = pos[t * 2], my = pos[t * 2 + 1];
      for (let c = 0; c < 3; c++) {
        // A 2 × 2 box under the texel (the tiles are finer than the 0.1 m grid).
        out[t * 3 + c] = (sample(mx - step / 2, my - step / 2, c) + sample(mx + step / 2, my - step / 2, c) + sample(mx - step / 2, my + step / 2, c) + sample(mx + step / 2, my + step / 2, c)) / 4;
      }
    }
    return out;
  }

  /** Tiles held for `rgbAt` (load with `hold`, free with `release`). */
  private held = new Map<string, Uint8Array>();
  /** Tile keys under a local-frame box. */
  tilesUnder(x0: number, y0: number, x1: number, y1: number): string[] {
    const out = new Set<string>();
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { const [lng, lat] = fromLocal(x, y), [mx, my] = merc(lng, lat); out.add(`${Math.floor(mx / TILE_M)}_${Math.floor(my / TILE_M)}`); }
    const ks = [...out].map(k => k.split('_').map(Number)), xs = ks.map(k => k[0]), ys = ks.map(k => k[1]), all: string[] = [];
    for (let tx = Math.min(...xs); tx <= Math.max(...xs); tx++) for (let ty = Math.min(...ys); ty <= Math.max(...ys); ty++) all.push(`${tx}_${ty}`);
    return all;
  }
  /** Is the tile already on disk? */
  cached(key: string): boolean { return existsSync(join(this.cache, `${key}.jpg`)); }
  /** Load tiles (fetching the missing ones) so `rgbAt` can read them synchronously. */
  async hold(keys: Iterable<string>): Promise<void> {
    for (const k of keys) { if (this.held.has(k)) continue; const [tx, ty] = k.split('_').map(Number); this.held.set(k, await this.fetchTile(tx, ty)); }
  }
  /** Free every held tile (and the crop cache). */
  release(): void { this.held.clear(); this.tiles.clear(); }
  /** Raw sRGB at a local-frame point (2 × 2 box as `crop`), or null when its tile is not held. */
  rgbAt(x: number, y: number): [number, number, number] | null {
    const [lng, lat] = fromLocal(x, y), [mx, my] = merc(lng, lat), step = TILE_M / TILE_PX, out: [number, number, number] = [0, 0, 0];
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const ax = mx + dx * step / 2, ay = my + dy * step / 2, tx = Math.floor(ax / TILE_M), ty = Math.floor(ay / TILE_M), d = this.held.get(`${tx}_${ty}`);
      if (!d) return null;
      const px = Math.min(TILE_PX - 1, Math.max(0, Math.floor((ax - tx * TILE_M) / TILE_M * TILE_PX))), py = Math.min(TILE_PX - 1, Math.max(0, Math.floor(((ty + 1) * TILE_M - ay) / TILE_M * TILE_PX)));
      for (let c = 0; c < 3; c++) out[c] += d[(py * TILE_PX + px) * 3 + c] / 4;
    }
    return out;
  }
}
