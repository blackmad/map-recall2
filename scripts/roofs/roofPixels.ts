/**
 * Pands from the BAG-keyed base tiles, in RD metres, and the orthophoto pixels on their roofs.
 *
 * A pand's outline is the 3DBAG/BAG footprint; the roof is sampled strictly inside it, eroded by
 * `erodeM` (0.5 m: gutters, parapet copings, the neighbour's wall in the lean of an off-nadir photo).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/rdCoordinates.ts';
import type { OrthoMosaic } from './orthoTiles.ts';

export type RdRing = Array<[number, number]>;
export type Pand = {
  /** 16-digit BAG pand id (no prefix). */
  id: string;
  tile: string;
  roof: number; height: number; eaves: number | null; ridge: number | null; year: number | null;
  /** Polygons (outer + holes) in RD metres. */
  polygons: RdRing[][];
  bbox: [number, number, number, number];
  areaM2: number;
  /** First vertex of the first outer ring, lng/lat: the runtime's local frame for furniture offsets. */
  anchor: [number, number];
};

const ringArea = (r: RdRing) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a / 2; };

export function* readPands(tilesDir: string, only?: (tile: string) => boolean): Generator<Pand> {
  for (const x of fs.readdirSync(tilesDir).filter(n => /^\d+$/.test(n)).sort()) {
    for (const file of fs.readdirSync(path.join(tilesDir, x)).filter(n => n.endsWith('.geojson.gz')).sort()) {
      const tile = `${x}/${file.replace('.geojson.gz', '')}`;
      if (only && !only(tile)) continue;
      const collection = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tilesDir, x, file))).toString('utf8'));
      for (const f of collection.features) {
        const p = f.properties ?? {};
        const id = String(p.id ?? '');
        if (!id.startsWith('NL.IMBAG.Pand.')) continue;
        const g = f.geometry;
        const polys: number[][][][] = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
        if (!polys.length) continue;
        const polygons = polys.map(poly => poly.map(ring => ring.map(([lng, lat]) => lngLatToRd(lng, lat)) as RdRing));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, area = 0;
        for (const poly of polygons) {
          for (const [x0, y0] of poly[0]) { minX = Math.min(minX, x0); maxX = Math.max(maxX, x0); minY = Math.min(minY, y0); maxY = Math.max(maxY, y0); }
          area += Math.abs(ringArea(poly[0])) - poly.slice(1).reduce((s, h) => s + Math.abs(ringArea(h)), 0);
        }
        yield { id: id.slice(14), tile, roof: Number(p.roof) || 0, height: Number(p.height) || 0, eaves: p.eaves ?? null, ridge: p.ridge ?? null, year: p.year ?? null,
          polygons, bbox: [minX, minY, maxX, maxY], areaM2: area, anchor: polys[0][0][0] as [number, number] };
      }
    }
  }
}

const inRing = (x: number, y: number, r: RdRing) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; }
  return inside;
};
const segDist2 = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
  const ex = ax + t * dx - x, ey = ay + t * dy - y; return ex * ex + ey * ey;
};
export function insidePand(x: number, y: number, pand: Pand, erodeM: number): boolean {
  for (const poly of pand.polygons) {
    if (!inRing(x, y, poly[0]) || poly.slice(1).some(h => inRing(x, y, h))) continue;
    if (erodeM <= 0) return true;
    const e2 = erodeM * erodeM;
    for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if (segDist2(x, y, ring[j][0], ring[j][1], ring[i][0], ring[i][1]) < e2) return false;
    return true;
  }
  return false;
}

export type RoofPixels = {
  /** RGB triples of the sampled pixels. */
  rgb: Uint8Array;
  /** RD x/y of each sample. */
  xy: Float32Array;
  n: number;
  /** Ground step between samples, metres (the mosaic resolution times the stride). */
  stepM: number;
};

/** Sample the roof (eroded outline) on the mosaic grid; a stride keeps big roofs at about `maxSamples`. */
export function roofPixels(pand: Pand, mosaic: OrthoMosaic, erodeM = 0.5, maxSamples = 4000): RoofPixels {
  const [minX, minY, maxX, maxY] = pand.bbox, res = mosaic.res;
  const stride = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, pand.areaM2) / (res * res) / maxSamples)));
  const step = res * stride;
  const rgb: number[] = [], xy: number[] = [];
  for (let y = maxY - step / 2; y > minY; y -= step) for (let x = minX + step / 2; x < maxX; x += step) {
    if (!insidePand(x, y, pand, erodeM)) continue;
    const p = mosaic.pixel(x, y);
    if (!p) continue;
    rgb.push(p[0], p[1], p[2]); xy.push(x, y);
  }
  return { rgb: Uint8Array.from(rgb), xy: Float32Array.from(xy), n: rgb.length / 3, stepM: step };
}

/** RD point to east/north metres from the pand's anchor vertex (the runtime frame: lng/lat scaled locally). */
export function rdToAnchorOffset(pand: Pand, x: number, y: number): [number, number] {
  const [lng, lat] = rdToLngLat(x, y), [lng0, lat0] = pand.anchor;
  return [(lng - lng0) * 111_320 * Math.cos(lat0 * Math.PI / 180), (lat - lat0) * 110_540];
}
