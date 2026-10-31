// Extruded building footprints from the z14 building tiles, as plain typed
// arrays (no three.js), so a worker can build them off the main thread
// (footprintWorker.ts) and hand the buffers over without copying.
import earcut from 'earcut';
import type { Vec2 } from './frame';

export interface FootprintFeature { properties: { height?: number; minHeight?: number }; geometry: { type: string; coordinates: unknown } }

export interface FootprintArrays { position: Float32Array; color: Float32Array; index: Uint32Array | Uint16Array }

/** sRGB hex → linear RGB (what THREE.Color.setStyle stores with colour management on). */
export function linearRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

/** Extruded footprints with baked shading (tops light, walls by facing to a fixed sun). */
export function footprintArrays(features: readonly FootprintFeature[], toLocal: (lng: number, lat: number) => Vec2, top: string, wall: string): FootprintArrays {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const cTop = linearRgb(top), cWall = linearRgb(wall);
  const sx = -0.6, sy = 0.8;
  for (const f of features) {
    const g = f.geometry;
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as number[][][][];
    const h = Math.max(3, Number(f.properties.height) || 9);
    for (const poly of polys) {
      const flat: number[] = [], holes: number[] = [];
      const rings = poly.map(r => r.map(([lng, lat]) => toLocal(lng, lat)));
      rings.forEach((ring, i) => { if (i) holes.push(flat.length / 2); for (const [x, y] of ring) flat.push(x, y); });
      let base = pos.length / 3;
      for (let i = 0; i < flat.length; i += 2) { pos.push(flat[i], flat[i + 1], h); col.push(cTop[0], cTop[1], cTop[2]); }
      for (const t of earcut(flat, holes, 2)) idx.push(base + t);
      for (const ring of rings) for (let i = 1; i < ring.length; i++) {
        const [ax, ay] = ring[i - 1], [bx, by] = ring[i];
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const shade = 0.72 + 0.22 * Math.max(0, ((by - ay) * sx - (bx - ax) * sy) / len);
        base = pos.length / 3;
        pos.push(ax, ay, 0, bx, by, 0, bx, by, h, ax, ay, h);
        for (let k = 0; k < 4; k++) col.push(cWall[0] * shade, cWall[1] * shade, cWall[2] * shade);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }
  return {
    position: new Float32Array(pos),
    color: new Float32Array(col),
    index: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
  };
}
