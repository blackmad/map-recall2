/**
 * The street-template scale of a pand on the table's instrument (streetTemplate.ts): the building tile's 3DBAG height and the
 * footprint's narrow side. Reads the z14 building tile at the pand's position (and its 8 neighbours when the centroid sits on
 * a tile edge).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { footprintWidthM } from '../../../src/canalRecall/houseSpec/streetTemplate.ts';

const TILES = 'public/data/extracts/amsterdam/building-tiles/14';
const cache = new Map<string, any[]>();
const tile = (x: number, y: number) => {
  const k = `${x}/${y}`; if (cache.has(k)) return cache.get(k)!;
  const f = path.join(TILES, String(x), `${y}.geojson.gz`);
  const feats = fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString()).features : [];
  cache.set(k, feats); return feats;
};
export function pandScale(pandId: string, lng: number, lat: number): { heightM: number | null; widthM: number | null } {
  const n = 2 ** 14, tx = Math.floor((lng + 180) / 360 * n), r = lat * Math.PI / 180, ty = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  const id = pandId.startsWith('NL.IMBAG.Pand.') ? pandId : `NL.IMBAG.Pand.${pandId}`;
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    const f = tile(tx + dx, ty + dy).find((ft: any) => ft.properties.id === id);
    if (!f) continue;
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
    const h = f.properties.height;
    return { heightM: typeof h === 'number' && h > 0 ? +h.toFixed(1) : null, widthM: footprintWidthM(ring) };
  }
  return { heightM: null, widthM: null };
}
