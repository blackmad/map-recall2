// Web-Mercator tile maths and the colour pyramid for the overview tiles (pure).
//
// The tiles are the own ground seen from straight above (raster.ts), each pixel the mean of its sub-samples' layer
// tones (layerColours.ts), so a street narrower than a pixel tints it as the textured ground's mip does. Pixels
// without own ground are transparent: the basemap below them shows (in the own-ground palette, basemapPalette.ts).

import type { RGB } from '../look/palette.js';

export const TILE_PX = 256;

/** Tile x/y containing a lng/lat at zoom z. */
export function tileOf(lng: number, lat: number, z: number): [number, number] {
  const n = 2 ** z, s = Math.sin(lat * Math.PI / 180);
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n);
  return [Math.max(0, Math.min(n - 1, x)), Math.max(0, Math.min(n - 1, y))];
}

/** Lng/lat of a fractional tile coordinate (tile units at zoom z). */
export function lngLatOfTile(tx: number, ty: number, z: number): [number, number] {
  const n = 2 ** z;
  return [tx / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))) * 180 / Math.PI];
}

/** Tiles at zoom z covering a lng/lat bbox [w, s, e, n]. */
export function tilesInBbox(bbox: readonly [number, number, number, number], z: number): [number, number][] {
  const [x0, y0] = tileOf(bbox[0], bbox[3], z), [x1, y1] = tileOf(bbox[2], bbox[1], z), out: [number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}

/**
 * One tile's RGBA pixels: `sample(lng, lat)` gives a layer colour or null (no own ground) at `k`×`k` sub-samples per
 * pixel; the pixel is their mean colour (linear-light average of sRGB is not needed for a flat map; the mip of the
 * game's textures averages sRGB too) with alpha the covered share.
 */
export function renderTile(z: number, x: number, y: number, k: number, sample: (lng: number, lat: number) => RGB | null, px = TILE_PX): Uint8ClampedArray {
  const out = new Uint8ClampedArray(px * px * 4);
  for (let row = 0; row < px; row++) for (let col = 0; col < px; col++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const [lng, lat] = lngLatOfTile(x + (col + (i + 0.5) / k) / px, y + (row + (j + 0.5) / k) / px, z);
      const c = sample(lng, lat);
      if (!c) continue;
      r += c[0]; g += c[1]; b += c[2]; n++;
    }
    const o = (row * px + col) * 4;
    if (n) { out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); out[o + 3] = Math.round(255 * n / (k * k)); }
  }
  return out;
}

/** The parent of four child tiles (null = absent child): 2×2 premultiplied-alpha mean. */
export function parentTile(children: readonly [Uint8ClampedArray | null, Uint8ClampedArray | null, Uint8ClampedArray | null, Uint8ClampedArray | null], px = TILE_PX): Uint8ClampedArray {
  const out = new Uint8ClampedArray(px * px * 4), half = px / 2;
  for (let q = 0; q < 4; q++) {
    const c = children[q];
    if (!c) continue;
    const ox = (q % 2) * half, oy = Math.floor(q / 2) * half;
    for (let row = 0; row < half; row++) for (let col = 0; col < half; col++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = ((row * 2 + dy) * px + col * 2 + dx) * 4, al = c[i + 3];
        r += c[i] * al; g += c[i + 1] * al; b += c[i + 2] * al; a += al;
      }
      const o = ((oy + row) * px + ox + col) * 4;
      if (a) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); out[o + 3] = Math.round(a / 4); }
    }
  }
  return out;
}

export const isEmptyTile = (rgba: Uint8ClampedArray) => { for (let i = 3; i < rgba.length; i += 4) if (rgba[i]) return false; return true; };
