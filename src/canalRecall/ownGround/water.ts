// Water for the own ground (pure): a signed-distance mask that cuts the land
// out of the canals, the water surface at canal level, and quay walls whose
// top follows the relief.
//
// No stencil: the land mesh's fragment shader discards where the mask says
// water, so everything else (water plane, walls, deck undersides) is drawn
// with the ordinary depth test. The mask stores the exact distance to the
// nearest true shoreline (signed: + on land), so bilinear filtering puts the
// cut within centimetres of the quay line even at a 1 m texel.

import earcut from 'earcut';
import { emptyMesh, vertex, densify, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';

/** Polygons as rings of scene coords (outer then holes), shorelines with water on their left. */
export interface WaterGeometry { polygons: Vec2[][][]; shores: Vec2[][] }

export interface WaterMask {
  x0: number; y0: number; res: number; width: number; height: number;
  /** Signed distance to shore, metres, clamped to ±range (+ = land). */
  sdf: Float32Array;
  range: number;
}

/** Scanline even-odd fill: 1 inside water. */
function rasterInside(geo: WaterGeometry, x0: number, y0: number, res: number, w: number, h: number): Uint8Array {
  const inside = new Uint8Array(w * h);
  const edges: [number, number, number, number][] = [];
  for (const poly of geo.polygons) for (const ring of poly) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (a[1] !== b[1]) edges.push([a[0], a[1], b[0], b[1]]);
  }
  // Bucket edges by row span for speed.
  const rows: number[][] = Array.from({ length: h }, () => []);
  edges.forEach((e, k) => {
    const lo = Math.max(0, Math.floor((Math.min(e[1], e[3]) - y0) / res - 0.5)), hi = Math.min(h - 1, Math.ceil((Math.max(e[1], e[3]) - y0) / res - 0.5));
    for (let j = lo; j <= hi; j++) rows[j].push(k);
  });
  const xs: number[] = [];
  for (let j = 0; j < h; j++) {
    const y = y0 + (j + 0.5) * res;
    xs.length = 0;
    for (const k of rows[j]) {
      const [ax, ay, bx, by] = edges[k];
      if ((ay <= y) !== (by <= y)) xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - x0) / res - 0.5)), i1 = Math.min(w - 1, Math.floor((xs[k + 1] - x0) / res - 0.5));
      for (let i = i0; i <= i1; i++) inside[j * w + i] ^= 1;
    }
  }
  return inside;
}

export function buildWaterMask(geo: WaterGeometry, x0: number, y0: number, x1: number, y1: number, res = 1, range = 4): WaterMask {
  const width = Math.ceil((x1 - x0) / res), height = Math.ceil((y1 - y0) / res);
  const inside = rasterInside(geo, x0, y0, res, width, height);
  const dist = new Float32Array(width * height).fill(range);
  for (const line of geo.shores) for (let s = 0; s + 1 < line.length; s++) {
    const [ax, ay] = line[s], [bx, by] = line[s + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - range - x0) / res)), i1 = Math.min(width - 1, Math.ceil((Math.max(ax, bx) + range - x0) / res));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - range - y0) / res)), j1 = Math.min(height - 1, Math.ceil((Math.max(ay, by) + range - y0) / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * res, py = y0 + (j + 0.5) * res;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
      const d = Math.hypot(ax + dx * t - px, ay + dy * t - py);
      const k = j * width + i;
      if (d < dist[k]) dist[k] = d;
    }
  }
  const sdf = new Float32Array(width * height);
  for (let k = 0; k < sdf.length; k++) sdf[k] = inside[k] ? -dist[k] : dist[k];
  return { x0, y0, res, width, height, sdf, range };
}

/** Bilinear signed distance at a scene point (+ land, − water). Outside the mask: land. */
export function maskDistance(m: WaterMask, x: number, y: number): number {
  const fx = (x - m.x0) / m.res - 0.5, fy = (y - m.y0) / m.res - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  if (i < 0 || j < 0 || i + 1 >= m.width || j + 1 >= m.height) return m.range;
  const u = fx - i, v = fy - j, s = m.sdf, w = m.width;
  return (s[j * w + i] * (1 - u) + s[j * w + i + 1] * u) * (1 - v) + (s[(j + 1) * w + i] * (1 - u) + s[(j + 1) * w + i + 1] * u) * v;
}

/** Mask as RGBA8 for a texture: R = 0.5 + d / (2·range). */
export function maskTexels(m: WaterMask): Uint8Array {
  const out = new Uint8Array(m.width * m.height * 4);
  for (let k = 0; k < m.sdf.length; k++) {
    const v = Math.round(255 * Math.max(0, Math.min(1, 0.5 + m.sdf[k] / (2 * m.range))));
    out[k * 4] = v; out[k * 4 + 1] = v; out[k * 4 + 2] = v; out[k * 4 + 3] = 255;
  }
  return out;
}

/** Flat water at `z` (canal level). */
export function waterSurfaceMesh(geo: WaterGeometry, z: number): MeshArrays {
  const m = emptyMesh();
  for (const poly of geo.polygons) {
    const coords: number[] = [], holes: number[] = [];
    poly.forEach((ring, i) => { if (i) holes.push(coords.length / 2); for (const p of ring) coords.push(p[0], p[1]); });
    const base = m.positions.length / 3;
    for (let i = 0; i < coords.length; i += 2) vertex(m, coords[i], coords[i + 1], z);
    const tris = earcut(coords, holes, 2);
    for (let i = 0; i < tris.length; i += 3) {
      const a = tris[i], b = tris[i + 1], c = tris[i + 2];
      const ccw = (coords[b * 2] - coords[a * 2]) * (coords[c * 2 + 1] - coords[a * 2 + 1]) - (coords[b * 2 + 1] - coords[a * 2 + 1]) * (coords[c * 2] - coords[a * 2]) > 0;
      m.indices.push(base + a, base + (ccw ? b : c), base + (ccw ? c : b));
    }
  }
  return m;
}

export const QUAY = { coping: [0.64, 0.61, 0.56] as [number, number, number], brick: [0.48, 0.35, 0.29] as [number, number, number], algae: [0.24, 0.29, 0.25] as [number, number, number] };

/**
 * Quay walls along every shoreline (water on the left), facing the water, from
 * the relief at the bank down past the water plane: coping, brick, algae band.
 * Banks that are not above the water (beaches, reed edges) get no wall.
 */
export function quayWallMesh(geo: WaterGeometry, ground: HeightFn, waterZ: number, step = 2): MeshArrays {
  const m = emptyMesh(true);
  for (const line of geo.shores) {
    const pts = densify(line, step);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 1e-3) continue;
      // Sample the bank half a metre inland (right of a→b), so a filled canal never lowers the top.
      const nx = dy / len, ny = -dx / len;
      const ta = Math.max(ground(a[0] + nx * 0.5, a[1] + ny * 0.5), ground(a[0], a[1])), tb = Math.max(ground(b[0] + nx * 0.5, b[1] + ny * 0.5), ground(b[0], b[1]));
      if (Math.max(ta, tb) < waterZ + 0.15) continue;
      const rows = (t: number) => {
        const coping = Math.max(t - 0.25, waterZ + 0.36), algae = waterZ + 0.35;
        return [t, Math.min(t, coping), Math.min(t, algae), waterZ - 0.25];
      };
      const ra = rows(ta), rb = rows(tb), colours = [QUAY.coping, QUAY.brick, QUAY.algae];
      for (let r = 0; r < 3; r++) {
        if (ra[r] - ra[r + 1] < 1e-3 && rb[r] - rb[r + 1] < 1e-3) continue;
        const v0 = vertex(m, a[0], a[1], ra[r], colours[r]), v1 = vertex(m, b[0], b[1], rb[r], colours[r]);
        const v2 = vertex(m, b[0], b[1], rb[r + 1], colours[r]), v3 = vertex(m, a[0], a[1], ra[r + 1], colours[r]);
        // Facing left of a→b (into the water).
        m.indices.push(v0, v2, v3, v0, v1, v2);
      }
    }
  }
  return m;
}
