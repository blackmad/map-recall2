// Piers and pontoons over the water (pure): OSM `man_made=pier` drawn as a low deck where it stands over mapped water.
//
// Feedback ee2b30 (2026-11-19, Haparandadam): "missing land under lightposts". The BGT lamp posts on the
// Haparandasteiger (way 171610575) and the long jetty west of it stood in open water: the own ground's water is the
// OpenFreeMap z14 snapshot (elevation-v1), which has no piers, and the OSM ground extract keeps none either. The
// orthophoto shows every one of those lamps on a pier OSM maps (scripts/own-ground/fetch-piers.ts → piers-v1).
//
// Rule: each pier's outline (a closed way as drawn; an open way buffered to its `width`, PIER_LINE_WIDTH_M without one)
// is clipped to the cell's water polygons, so only the part over water is drawn and nothing changes on land. Its top
// stands PIER_FREEBOARD_M over the water it lies in (floating=yes lower), with sides down past the water line. The top
// is vertex-coloured into `deckTop`, the sides into `deckBody` (the deck layers: never cut by the water mask). The same
// placed outlines answer `pierTopAt`, the base street furniture stands on (gameGround.ts surfaceBase).

import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import earcut from 'earcut';
import { emptyMesh, vertex, type MeshArrays } from './drape.js';
import type { Vec2 } from './surface.js';
import type { WaterGeometry } from './water.js';

type RGB = [number, number, number];
type LngLat = [number, number];

/** One pier as the extract stores it: `g` lng/lat (6 dp), `a` a closed outline, `f` floating=yes, `w` an open way's width (m). */
export interface PierRecord { id: number; g: LngLat[]; a?: 1; f?: 1; w?: number }
export interface PiersExtract { version: 1; source: string; licence: string; fetched: string; piers: PierRecord[] }

/** Top over the water it lies in, metres: a fixed jetty, and a floating pontoon (floating=yes). */
export const PIER_FREEBOARD_M = { fixed: 0.9, floating: 0.5 } as const;
/** Width of an open pier way without a `width` tag, metres (Amsterdam mooring fingers and jetties: 1-2.5 m). */
export const PIER_LINE_WIDTH_M = 1.6;
/** Sides reach this far under the water line, metres. */
export const PIER_SKIRT_M = 0.25;
/** A clipped piece smaller than this is dropped, square metres (a sliver along the shore line). */
export const PIER_MIN_AREA_M2 = 0.5;
export const PIER_COLOURS = { top: [0.56, 0.52, 0.46] as RGB, side: [0.33, 0.30, 0.27] as RGB };

/** A pier in the game frame: its outline (CCW), box, top over the water and floating flag. */
export interface PlacedPier { id: number; ring: Vec2[]; bbox: [number, number, number, number]; floating: boolean }

const area2 = (r: readonly Vec2[]): number => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; };
const boxOf = (r: readonly Vec2[]): [number, number, number, number] => r.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]);

/** An open polyline buffered to `width` as one polygon (square ends, mitred joins clamped): the union of its segment boxes. */
export function bufferLine(pts: readonly Vec2[], width: number): Vec2[][] {
  const h = width / 2, boxes: Polygon[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay);
    if (l < 1e-6) continue;
    const ux = (bx - ax) / l, uy = (by - ay) / l, nx = -uy * h, ny = ux * h;
    // Each box runs h past its ends, so consecutive boxes overlap at the joint (no notch on the outside of a bend).
    const sx = ax - ux * (i === 0 ? 0 : h), sy = ay - uy * (i === 0 ? 0 : h), ex = bx + ux * (i + 2 === pts.length ? 0 : h), ey = by + uy * (i + 2 === pts.length ? 0 : h);
    boxes.push([[[sx + nx, sy + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [sx - nx, sy - ny], [sx + nx, sy + ny]]]);
  }
  if (!boxes.length) return [];
  const u = boxes.length === 1 ? [boxes[0]] : polygonClipping.union(boxes[0], ...boxes.slice(1));
  return u.map(p => p[0].slice(0, -1).map(q => [q[0], q[1]] as Vec2));
}

/** Records → placed piers in the game frame (`project`: lng/lat → local metres). Open ways are buffered; rings are CCW. */
export function placePiers(records: readonly PierRecord[], project: (p: LngLat) => Vec2): PlacedPier[] {
  const out: PlacedPier[] = [];
  for (const r of records) {
    const pts = r.g.map(project);
    const rings = r.a && pts.length >= 4 ? [pts.slice(0, -1)] : bufferLine(pts, r.w && r.w > 0 && r.w < 30 ? r.w : PIER_LINE_WIDTH_M);
    for (const ring of rings) {
      if (ring.length < 3 || Math.abs(area2(ring)) < PIER_MIN_AREA_M2) continue;
      const ccw = area2(ring) < 0 ? ring.slice().reverse() : ring;
      out.push({ id: r.id, ring: ccw, bbox: boxOf(ccw), floating: r.f === 1 });
    }
  }
  return out;
}

const toPoly = (rings: readonly (readonly Vec2[])[]): Polygon => rings.map(r => { const c = r.map(p => [p[0], p[1]] as [number, number]); c.push(c[0]); return c as Ring; });

/**
 * The parts of `pier` over the given water polygons (each polygon: outer ring then holes), as polygons (outer, holes),
 * with the water level each part lies in (the polygon's `levels` entry, else `fallback`).
 */
export function pierOverWater(pier: PlacedPier, water: readonly WaterGeometry[], fallback: number, rect?: readonly [number, number, number, number]): { poly: Vec2[][]; waterZ: number }[] {
  const out: { poly: Vec2[][]; waterZ: number }[] = [];
  const [x0, y0, x1, y1] = pier.bbox;
  if (rect && (x1 < rect[0] || x0 > rect[2] || y1 < rect[1] || y0 > rect[3])) return out;
  // Inside the cell's rectangle only (a pier across a seam: each cell draws its own part, once).
  let subject: Polygon | MultiPolygon = toPoly([pier.ring]);
  if (rect && !(x0 >= rect[0] && x1 <= rect[2] && y0 >= rect[1] && y1 <= rect[3])) {
    try { subject = polygonClipping.intersection(subject, toPoly([[[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]]])); } catch { return out; }
    if (!subject.length) return out;
  }
  for (const g of water) g.polygons.forEach((wp, k) => {
    if (!wp.length) return;
    const b = boxOf(wp[0]);
    if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) return;
    let clip: MultiPolygon;
    try { clip = polygonClipping.intersection(subject, toPoly(wp)); } catch { return; }
    for (const p of clip) {
      const poly = p.map(r => r.slice(0, -1).map(q => [q[0], q[1]] as Vec2));
      const a = Math.abs(area2(poly[0])) - poly.slice(1).reduce((s, h) => s + Math.abs(area2(h)), 0);
      if (a >= PIER_MIN_AREA_M2) out.push({ poly, waterZ: g.levels?.[k] ?? fallback });
    }
  });
  return out;
}

/** A pier part's top (earcut, facing up) and sides (each ring edge, outward, down to PIER_SKIRT_M under the water). */
export function pierMesh(parts: readonly { poly: Vec2[][]; floating: boolean; waterZ: number }[]): { top: MeshArrays; body: MeshArrays } {
  const top = emptyMesh(true), body = emptyMesh(true), C = PIER_COLOURS;
  for (const { poly, floating, waterZ } of parts) {
    const z = waterZ + (floating ? PIER_FREEBOARD_M.floating : PIER_FREEBOARD_M.fixed), zb = waterZ - PIER_SKIRT_M;
    const flat: number[] = [], holes: number[] = [];
    for (const r of poly) { if (flat.length) holes.push(flat.length / 2); for (const p of r) flat.push(p[0], p[1]); }
    const tri = earcut(flat, holes.length ? holes : undefined, 2);
    const base = top.positions.length / 3;
    for (let i = 0; i < flat.length; i += 2) vertex(top, flat[i], flat[i + 1], z, C.top);
    // Up-facing: earcut keeps the input winding; make every triangle counter-clockwise from above.
    for (let i = 0; i < tri.length; i += 3) {
      const [a, b, c] = [tri[i], tri[i + 1], tri[i + 2]];
      const cross = (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]) - (flat[2 * b + 1] - flat[2 * a + 1]) * (flat[2 * c] - flat[2 * a]);
      if (cross >= 0) top.indices.push(base + a, base + b, base + c); else top.indices.push(base + a, base + c, base + b);
    }
    poly.forEach((r, ri) => {
      // area2 > 0: counter-clockwise. Outward (off the deck) is right of p → q on a CCW outer ring or a CW hole.
      const right = (ri === 0) === (area2(r) > 0);
      for (let i = 0; i < r.length; i++) {
        const p = r[i], q = r[(i + 1) % r.length], dx = q[0] - p[0], dy = q[1] - p[1];
        if (Math.hypot(dx, dy) < 1e-4) continue;
        const k = [vertex(body, p[0], p[1], zb, C.side), vertex(body, q[0], q[1], zb, C.side), vertex(body, q[0], q[1], z, C.side), vertex(body, p[0], p[1], z, C.side)];
        const n: [number, number] = right ? [dy, -dx] : [-dy, dx];
        // (q − p) × up = (dy, −dx): the quad k0 k1 k2 faces that way.
        if (n[0] * dy - n[1] * dx > 0) body.indices.push(k[0], k[1], k[2], k[0], k[2], k[3]); else body.indices.push(k[0], k[2], k[1], k[0], k[3], k[2]);
      }
    });
  }
  return { top, body };
}

/** The pier deck's top at (x, y) when a pier stands there over water (`wet`), else undefined. */
export function pierTopAt(piers: readonly PlacedPier[], x: number, y: number, wet: (x: number, y: number) => boolean, waterZ: (x: number, y: number) => number): number | undefined {
  for (const p of piers) {
    if (x < p.bbox[0] || x > p.bbox[2] || y < p.bbox[1] || y > p.bbox[3]) continue;
    let inside = false;
    const r = p.ring;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) inside = !inside;
    if (inside && wet(x, y)) return waterZ(x, y) + (p.floating ? PIER_FREEBOARD_M.floating : PIER_FREEBOARD_M.fixed);
  }
  return undefined;
}
