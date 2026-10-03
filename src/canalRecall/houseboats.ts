// Low-poly houseboats from OSM footprints.
//
// Amsterdam has ~3,000 houseboats mapped as `building=houseboat`, and they line the
// canals the player rides along, yet the building tiles carried almost none of them.
// Two kinds cover nearly all of them:
//   - an ark: a box-shaped floating house on a concrete pontoon, mapped as a rectangle;
//     a low dark hull, a cabin with a band of windows, a flat or pitched roof, and an
//     open deck at one end;
//   - a converted barge: a long hull mapped by tracing its outline (bow curve included);
//     the traced outline is the hull, with a low cabin amidships and a wheelhouse aft.
// Everything is derived from the footprint and a hash of the id, so a boat keeps its
// look between sessions. Flat colours only, recoloured per Building look by the caller.

import earcut from 'earcut';
import { fitRect } from './roofMesh.js';
import type { KitPartGeometry, KitTri } from './landmarkKits.js';

export type Houseboat = { id: string; ring: [number, number][]; levels?: number; roof?: string; name?: string; kind?: string };
type V3 = [number, number, number];

const HULLS = ['#2d3033', '#363c43', '#243040', '#2c3a2f', '#3b2f2a'];
const CABINS = ['#6e5139', '#2f5d50', '#e6e0d2', '#c9a24a', '#3d4a5c', '#7a2e2a', '#24322a', '#a7b4a1', '#5b6f86', '#d8cbb0'];
const ROOFS = ['#2a2a2c', '#47474a', '#5a4636', '#3c4a3f'];
const DECK = '#8b6b4b', GLASS = '#3b4a57', FRAME = '#efeadf', DOOR = '#4a3426';
/** Water level is the map's ground plane; the hull's waterline sits just below it. */
const WATERLINE = -0.1;

function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
const pick = <T>(list: readonly T[], id: string, salt: string) => list[Math.floor(hash(`${id}:${salt}`) * list.length) % list.length];

class Sink {
  readonly tris: KitTri[] = [];
  tri(a: V3, b: V3, c: V3, hex: string, hint: V3) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) { [b, c] = [c, b]; n = [-n[0], -n[1], -n[2]]; }
    const l = Math.hypot(...n);
    if (l < 1e-9) return;
    this.tris.push({ p: [a, b, c], uv: [[0, 0], [1, 0], [1, 1]], layer: 'flat', hex, n: [n[0] / l, n[1] / l, n[2] / l] });
  }
  quad(a: V3, b: V3, c: V3, d: V3, hex: string, hint: V3) { this.tri(a, b, c, hex, hint); this.tri(a, c, d, hex, hint); }
}

/** One boat's triangles in local metres from `origin` (x east, y north, z up). */
export function houseboatGeometry(boat: Houseboat, origin: { lng: number; lat: number }): KitPartGeometry | null {
  const kx = 111_320 * Math.cos(origin.lat * Math.PI / 180), ky = 110_540;
  let pts = boat.ring.map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * ky] as [number, number]);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
  if (pts.length < 3) return null;
  const rect = fitRect([...pts, pts[0]], 64);
  if (!rect) return null;
  // Boat frame: u along the length, v across, centred on the fitted rectangle.
  let ux = rect.ux, uy = rect.uy, L = rect.len, W = rect.wid;
  if (W > L) { [ux, uy] = [-uy, ux]; [L, W] = [W, L]; }
  const vx = -uy, vy = ux, cx = rect.cx, cy = rect.cy;
  const at = (a: number, b: number, z: number): V3 => [cx + ux * a + vx * b, cy + uy * a + vy * b, z];
  const dir = (a: number, b: number, z: number): V3 => [ux * a + vx * b, uy * a + vy * b, z];
  const sink = new Sink(), id = boat.id;
  const box = (a0: number, a1: number, b0: number, b1: number, z0: number, z1: number, hex: string, bottom = false) => {
    sink.quad(at(a0, b0, z1), at(a1, b0, z1), at(a1, b1, z1), at(a0, b1, z1), hex, [0, 0, 1]);
    sink.quad(at(a0, b0, z0), at(a1, b0, z0), at(a1, b0, z1), at(a0, b0, z1), hex, dir(0, -1, 0));
    sink.quad(at(a0, b1, z0), at(a1, b1, z0), at(a1, b1, z1), at(a0, b1, z1), hex, dir(0, 1, 0));
    sink.quad(at(a0, b0, z0), at(a0, b1, z0), at(a0, b1, z1), at(a0, b0, z1), hex, dir(-1, 0, 0));
    sink.quad(at(a1, b0, z0), at(a1, b1, z0), at(a1, b1, z1), at(a1, b0, z1), hex, dir(1, 0, 0));
    if (bottom) sink.quad(at(a0, b0, z0), at(a1, b0, z0), at(a1, b1, z0), at(a0, b1, z0), hex, [0, 0, -1]);
  };
  /** Windows as panes just proud of a side wall (side = -1 or 1 across, or 'end' faces along). */
  const sideWindows = (a0: number, a1: number, b: number, z0: number, z1: number, every: number, width: number) => {
    const n = Math.max(1, Math.floor((a1 - a0) / every)), step = (a1 - a0) / n, out = Math.sign(b) * 0.04;
    for (let k = 0; k < n; k++) {
      const m = a0 + step * (k + 0.5);
      sink.quad(at(m - width / 2 - 0.08, b + out * 0.5, z0 - 0.08), at(m + width / 2 + 0.08, b + out * 0.5, z0 - 0.08), at(m + width / 2 + 0.08, b + out * 0.5, z1 + 0.08), at(m - width / 2 - 0.08, b + out * 0.5, z1 + 0.08), FRAME, dir(0, Math.sign(b), 0));
      sink.quad(at(m - width / 2, b + out, z0), at(m + width / 2, b + out, z0), at(m + width / 2, b + out, z1), at(m - width / 2, b + out, z1), GLASS, dir(0, Math.sign(b), 0));
    }
  };
  const cabinHex = pick(CABINS, id, 'cabin'), roofHex = pick(ROOFS, id, 'roof'), hullHex = pick(HULLS, id, 'hull');
  const traced = pts.length > 8;

  if (!traced) {
    // An ark: pontoon, cabin over most of it, an open deck at one end.
    const hullTop = 0.5;
    box(-L / 2, L / 2, -W / 2, W / 2, WATERLINE, hullTop, hullHex);
    const deckLen = Math.min(3.5, Math.max(1.4, L * 0.14)), deckAtStart = hash(`${id}:deck`) < 0.5;
    const a0 = deckAtStart ? -L / 2 + deckLen : -L / 2 + 0.3, a1 = deckAtStart ? L / 2 - 0.3 : L / 2 - deckLen;
    const half = Math.max(1, W / 2 - 0.3), levels = Math.min(3, boat.levels ?? (hash(`${id}:levels`) < 0.12 ? 2 : 1));
    const height = levels * 2.5 + hash(`${id}:height`) * 0.3, top = hullTop + height;
    box(deckAtStart ? -L / 2 : a1, deckAtStart ? a0 : L / 2, -W / 2 + 0.05, W / 2 - 0.05, hullTop, hullTop + 0.08, DECK);
    box(a0, a1, -half, half, hullTop, top, cabinHex);
    for (let level = 0; level < levels; level++) {
      const z0 = hullTop + level * 2.5 + 0.9, z1 = z0 + 1.0;
      sideWindows(a0 + 0.4, a1 - 0.4, -half, z0, z1, 2.4, 1.3);
      sideWindows(a0 + 0.4, a1 - 0.4, half, z0, z1, 2.4, 1.3);
    }
    // A door and a window on the deck end.
    const endA = deckAtStart ? a0 - 0.04 : a1 + 0.04, endDir = dir(deckAtStart ? -1 : 1, 0, 0);
    sink.quad(at(endA, -0.45, hullTop + 0.05), at(endA, 0.45, hullTop + 0.05), at(endA, 0.45, hullTop + 2.0), at(endA, -0.45, hullTop + 2.0), DOOR, endDir);
    if (half > 1.6) sink.quad(at(endA, 0.8, hullTop + 0.9), at(endA, Math.min(half - 0.3, 2.2), hullTop + 0.9), at(endA, Math.min(half - 0.3, 2.2), hullTop + 1.9), at(endA, 0.8, hullTop + 1.9), GLASS, endDir);
    const pitched = boat.roof === 'gabled' || boat.roof === 'hipped' || (!boat.roof && hash(`${id}:pitch`) < 0.22);
    if (pitched) {
      // A low gabled roof along the length, with gable triangles in the cabin colour.
      const o = 0.25, rise = Math.min(1.6, half * 0.55), ridge = top + rise;
      sink.quad(at(a0 - o, -half - o, top), at(a1 + o, -half - o, top), at(a1 + o, 0, ridge), at(a0 - o, 0, ridge), roofHex, dir(0, -1, 1.5));
      sink.quad(at(a0 - o, half + o, top), at(a1 + o, half + o, top), at(a1 + o, 0, ridge), at(a0 - o, 0, ridge), roofHex, dir(0, 1, 1.5));
      sink.tri(at(a0, -half, top), at(a0, half, top), at(a0, 0, ridge), cabinHex, dir(-1, 0, 0));
      sink.tri(at(a1, -half, top), at(a1, half, top), at(a1, 0, ridge), cabinHex, dir(1, 0, 0));
    } else {
      box(a0 - 0.25, a1 + 0.25, -half - 0.25, half + 0.25, top, top + 0.18, roofHex, true);
    }
  } else {
    // A barge: the traced outline is the hull; a low cabin amidships and a wheelhouse at the
    // squarer (stern) end, since the bow is the pointed one.
    const hullTop = 0.9;
    const flat = pts.flat(), index = earcut(flat);
    for (let i = 0; i < index.length; i += 3) {
      const [a, b, c] = [index[i], index[i + 1], index[i + 2]].map(k => [pts[k][0], pts[k][1], hullTop] as V3);
      sink.tri(a, b, c, DECK, [0, 0, 1]);
    }
    let area2 = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      // Outward is right of travel on a counter-clockwise ring.
      const nx = area2 > 0 ? y1 - y0 : y0 - y1, ny = area2 > 0 ? x0 - x1 : x1 - x0;
      sink.quad([x0, y0, WATERLINE], [x1, y1, WATERLINE], [x1, y1, hullTop], [x0, y0, hullTop], hullHex, [nx, ny, 0]);
    }
    const widthAt = (a: number) => {
      let w = 0;
      for (const [x, y] of pts) { const pa = (x - cx) * ux + (y - cy) * uy; if (Math.abs(pa - a) < L * 0.08) w = Math.max(w, Math.abs((x - cx) * vx + (y - cy) * vy)); }
      return w;
    };
    const stern = widthAt(L * 0.42) >= widthAt(-L * 0.42) ? 1 : -1;
    const half = Math.max(0.8, W / 2 - 0.6);
    const c0 = -0.22 * L * stern, c1 = 0.28 * L * stern, cabinTop = hullTop + 1.5;
    box(Math.min(c0, c1), Math.max(c0, c1), -half, half, hullTop, cabinTop, cabinHex);
    box(Math.min(c0, c1) - 0.15, Math.max(c0, c1) + 0.15, -half - 0.15, half + 0.15, cabinTop, cabinTop + 0.12, roofHex);
    sideWindows(Math.min(c0, c1) + 0.4, Math.max(c0, c1) - 0.4, -half, hullTop + 0.55, hullTop + 1.15, 1.6, 0.7);
    sideWindows(Math.min(c0, c1) + 0.4, Math.max(c0, c1) - 0.4, half, hullTop + 0.55, hullTop + 1.15, 1.6, 0.7);
    const w0 = 0.33 * L * stern, w1 = w0 + 2.2 * stern, wh = Math.max(0.7, Math.min(half, 1.2)), whTop = hullTop + 2.4;
    box(Math.min(w0, w1), Math.max(w0, w1), -wh, wh, hullTop, whTop, cabinHex);
    box(Math.min(w0, w1) - 0.15, Math.max(w0, w1) + 0.15, -wh - 0.15, wh + 0.15, whTop, whTop + 0.12, roofHex);
    sideWindows(Math.min(w0, w1) + 0.2, Math.max(w0, w1) - 0.2, -wh, hullTop + 1.3, hullTop + 2.1, 2.2, 1.6);
    sideWindows(Math.min(w0, w1) + 0.2, Math.max(w0, w1) - 0.2, wh, hullTop + 1.3, hullTop + 2.1, 2.2, 1.6);
  }
  return { id, tris: sink.tris };
}

/** Group boats by the z14 tile of their first vertex, the building layer's chunk key. */
export function houseboatsByTile(boats: readonly Houseboat[]): Map<string, Houseboat[]> {
  const out = new Map<string, Houseboat[]>();
  for (const boat of boats) {
    const [lng, lat] = boat.ring[0];
    const n = 2 ** 14, rad = lat * Math.PI / 180;
    const key = `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`;
    let list = out.get(key);
    if (!list) out.set(key, list = []);
    list.push(boat);
  }
  return out;
}

/** Landmark types that can be aboard a boat. A crane, statue or memorial on
 *  the quay beside a moored boat is not the boat (Kraan 2868 stands 4 m from
 *  one). */
const ABOARD_TYPES = new Set(['museum', 'hotel', 'restaurant', 'cafe', 'bar', 'gallery', 'theatre', 'attraction']);
/** m — a landmark point this close to a hull's outline is on that boat. The
 *  Houseboat Museum's OSM node sits 1.8 m outside the Hendrika Maria's traced
 *  outline; the nearest quay-side landmark is 3.9 m from its boat. */
export const ABOARD_TOLERANCE_M = 3;

/**
 * The houseboat a landmark is, for a landmark with no building of its own:
 * the Houseboat Museum is a barge, so `landmark-buildings.json` (a join on
 * building ways) has nothing for it and the card lit nothing (user report
 * 2026-10-03, "houseboat museum doesn't light up yellow"). The point must lie
 * inside a boat's outline or within `ABOARD_TOLERANCE_M` of it, and the
 * landmark must be a kind of place a boat can be.
 */
export function boatForLandmark(boats: readonly Houseboat[], lngLat: readonly [number, number], type: string | undefined): string | null {
  if (!type || !ABOARD_TYPES.has(type)) return null;
  const [lng, lat] = lngLat;
  const mx = 111320 * Math.cos(lat * Math.PI / 180), my = 110540;
  let best: string | null = null, bestDistance = ABOARD_TOLERANCE_M;
  for (const boat of boats) {
    const ring = boat.ring;
    if (Math.abs((ring[0][0] - lng) * mx) > 200 || Math.abs((ring[0][1] - lat) * my) > 200) continue;
    let inside = false, nearest = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][0] - lng) * mx, ay = (ring[j][1] - lat) * my;
      const bx = (ring[i][0] - lng) * mx, by = (ring[i][1] - lat) * my;
      if ((ay > 0) !== (by > 0) && 0 < ax + (bx - ax) * (0 - ay) / (by - ay)) inside = !inside;
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      nearest = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy));
    }
    if (inside) return boat.id;
    if (nearest <= bestDistance) { best = boat.id; bestDistance = nearest; }
  }
  return best;
}
