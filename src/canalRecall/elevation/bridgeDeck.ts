// Bridge decks with measured AHN profiles, plus a flat fallback for the rest.
//
// A measured profile (729 municipal bridges, `bridge-surfaces-v1`) is a run of
// stations along the road: station s, a point, and the deck height above the
// straight line between the two approach ends (DSM on the deck, DTM on the
// approaches, 8 m blend). The game's ground is z = 0 everywhere, so that
// relative height is exactly what to draw: the ramps start at the street and
// the hump rises over the water. Unmeasured bridges over water (movable
// bridges such as the Magere Brug, and newer ones) get their municipal
// footprint as a flat deck at street level, with a fascia over the water.

import earcut from 'earcut';
import type { FallbackBridge, MeasuredBridge } from './elevationData.js';
import { MeshBuilder, hexToRgb, type MeshData, type RGB, type V3 } from './meshBuilder.js';

export const DECK_STEP_M = 0.5;
/** Ignore DSM noise this close to the approach baseline when trimming ramps. */
const RAMP_EPSILON_M = 0.03;
const PARAPET_HEIGHT_M = 0.55;
const PARAPET_THICKNESS_M = 0.22;
const FALLBACK_TOP_M = 0.03;
const FALLBACK_THICKNESS_M = 0.45;

const FAMILY: Record<string, { thickness: number; fascia: string; parapet: string }> = {
  'masonry-arch': { thickness: 0.6, fascia: '#8a5541', parapet: '#97614b' },
  'concrete-deck': { thickness: 0.45, fascia: '#a7a29a', parapet: '#b4afa6' },
  'steel-deck': { thickness: 0.35, fascia: '#4f5d57', parapet: '#3e4a45' },
  'wooden-deck': { thickness: 0.3, fascia: '#7a5a3c', parapet: '#6a4c32' },
};
const DEFAULT_FAMILY = FAMILY['concrete-deck'];
export const DECK_TOP = hexToRgb('#ece8de');
const SOFFIT = hexToRgb('#5d5650');
const ABUTMENT = hexToRgb('#7b5a4a');

type ToScene = (x: number, y: number) => [number, number];

export interface DeckProfile {
  id: string;
  name: string;
  family: string;
  /** Resampled stations (every DECK_STEP_M), scene metres. */
  x: Float64Array;
  y: Float64Array;
  s: Float64Array;
  h: Float64Array;
  halfWidth: Float64Array;
  water: [number, number] | null;
  deck: [number, number];
  bbox: [number, number, number, number];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Decode a measured bridge and resample it at DECK_STEP_M along its stations. */
export function decodeProfile(bridge: MeasuredBridge, quant: number, toScene: ToScene = (x, y) => [x, y]): DeckProfile {
  const raw: { x: number; y: number; s: number; h: number }[] = [];
  for (let i = 0; i + 3 < bridge.p.length; i += 4) {
    const [x, y] = toScene(bridge.p[i] * quant, bridge.p[i + 1] * quant);
    raw.push({ x, y, s: bridge.p[i + 2] / 100, h: Math.max(0, bridge.p[i + 3] / 100) });
  }
  raw.sort((a, b) => a.s - b.s);
  // Trim flat approach ends: keep a metre of ground either side of the ramps and the deck.
  const first = raw.findIndex(r => r.h > RAMP_EPSILON_M);
  const last = raw.length - 1 - [...raw].reverse().findIndex(r => r.h > RAMP_EPSILON_M);
  let s0 = first >= 0 ? raw[first].s : bridge.deck[0];
  let s1 = first >= 0 ? raw[last].s : bridge.deck[1];
  s0 = Math.max(raw[0].s, Math.min(s0, bridge.deck[0]) - 1);
  s1 = Math.min(raw[raw.length - 1].s, Math.max(s1, bridge.deck[1]) + 1);
  const count = Math.max(2, Math.round((s1 - s0) / DECK_STEP_M) + 1);
  const out = { x: new Float64Array(count), y: new Float64Array(count), s: new Float64Array(count), h: new Float64Array(count), halfWidth: new Float64Array(count) };
  let j = 0;
  for (let i = 0; i < count; i++) {
    const s = lerp(s0, s1, i / (count - 1));
    while (j < raw.length - 2 && raw[j + 1].s < s) j++;
    const a = raw[j], b = raw[j + 1] ?? raw[j];
    const t = b.s > a.s ? Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s))) : 0;
    out.x[i] = lerp(a.x, b.x, t);
    out.y[i] = lerp(a.y, b.y, t);
    out.s[i] = s;
    out.h[i] = lerp(a.h, b.h, t);
    out.halfWidth[i] = s >= bridge.deck[0] && s <= bridge.deck[1] ? bridge.width / 2 : Math.max(bridge.approachHalfWidth, 1.5);
  }
  // A light 3-tap smooth: the DSM sees parked cars and railings as deck.
  const smooth = out.h.slice();
  for (let i = 1; i < count - 1; i++) smooth[i] = (out.h[i - 1] + 2 * out.h[i] + out.h[i + 1]) / 4;
  out.h = smooth;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const r = out.halfWidth[i] + 1;
    minX = Math.min(minX, out.x[i] - r); maxX = Math.max(maxX, out.x[i] + r);
    minY = Math.min(minY, out.y[i] - r); maxY = Math.max(maxY, out.y[i] + r);
  }
  return { id: bridge.id, name: bridge.name, family: bridge.family, ...out, water: bridge.water, deck: bridge.deck, bbox: [minX, minY, maxX, maxY] };
}

function tangentAt(p: DeckProfile, i: number): [number, number] {
  const a = Math.max(0, i - 1), b = Math.min(p.x.length - 1, i + 1);
  const dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a];
  const length = Math.hypot(dx, dy) || 1;
  return [dx / length, dy / length];
}

export interface DeckStyle {
  top?: RGB;
}

/**
 * Deck mesh: road surface, side faces (retaining walls over land, a fascia of
 * the family's thickness over water), parapets along the deck, a soffit, and
 * for masonry arches spandrels and a barrel vault down to the water.
 */
export function measuredDeckMesh(p: DeckProfile, freeboard: number, style: DeckStyle = {}): MeshData {
  const mesh = new MeshBuilder();
  const fam = FAMILY[p.family] ?? DEFAULT_FAMILY;
  const fascia = hexToRgb(fam.fascia), parapet = hexToRgb(fam.parapet), top = style.top ?? DECK_TOP;
  const n = p.x.length;
  const overWater = (s: number) => !!p.water && s >= p.water[0] && s <= p.water[1];
  const onDeck = (s: number) => s >= p.deck[0] - 0.5 && s <= p.deck[1] + 0.5;
  // Arch springing just above the water, crown under the deck's thinnest point.
  let arch: { s0: number; s1: number; spring: number; crown: number } | null = null;
  if (p.family === 'masonry-arch' && p.water) {
    const s0 = p.water[0] + 0.3, s1 = p.water[1] - 0.3;
    const mid = (s0 + s1) / 2;
    const iMid = p.s.findIndex(s => s >= mid);
    const crown = (iMid >= 0 ? p.h[iMid] : 0) - fam.thickness - 0.15;
    const spring = -freeboard + 0.35;
    if (s1 - s0 > 1.5 && crown - spring > 0.5) arch = { s0, s1, spring, crown };
  }
  const archZ = (s: number) => {
    if (!arch) return null;
    if (s <= arch.s0 || s >= arch.s1) return null;
    const u = (s - (arch.s0 + arch.s1) / 2) / ((arch.s1 - arch.s0) / 2);
    return arch.spring + (arch.crown - arch.spring) * Math.sqrt(Math.max(0, 1 - u * u));
  };
  const edges: { l: [number, number]; r: [number, number]; il: [number, number]; ir: [number, number]; z: number; bottom: number; normal: [number, number] }[] = [];
  for (let i = 0; i < n; i++) {
    const [tx, ty] = tangentAt(p, i);
    const nx = -ty, ny = tx; // left of the direction of travel
    const w = p.halfWidth[i], iw = Math.max(0.3, w - PARAPET_THICKNESS_M);
    const z = p.h[i] + 0.02;
    const s = p.s[i];
    let bottom: number;
    if (overWater(s)) bottom = archZ(s) ?? (arch ? -freeboard : z - fam.thickness);
    else bottom = 0;
    edges.push({
      l: [p.x[i] + nx * w, p.y[i] + ny * w], r: [p.x[i] - nx * w, p.y[i] - ny * w],
      il: [p.x[i] + nx * iw, p.y[i] + ny * iw], ir: [p.x[i] - nx * iw, p.y[i] - ny * iw],
      z, bottom: Math.min(bottom, z), normal: [nx, ny],
    });
  }
  for (let i = 0; i + 1 < n; i++) {
    const a = edges[i], b = edges[i + 1];
    const sMid = (p.s[i] + p.s[i + 1]) / 2;
    const deckHere = onDeck(sMid);
    const wet = overWater(sMid);
    const nl: V3 = [(a.normal[0] + b.normal[0]) / 2, (a.normal[1] + b.normal[1]) / 2, 0];
    const nr: V3 = [-nl[0], -nl[1], 0];
    // Road surface.
    mesh.quad([a.l[0], a.l[1], a.z], [b.l[0], b.l[1], b.z], [b.r[0], b.r[1], b.z], [a.r[0], a.r[1], a.z], [0, 0, 1], top);
    const rise = deckHere ? PARAPET_HEIGHT_M : 0;
    const sideColour = wet ? fascia : deckHere ? parapet : ABUTMENT;
    // Outer faces, from parapet top down to the fascia / arch / ground.
    mesh.wall(a.l[0], a.l[1], b.l[0], b.l[1], a.z + rise, a.bottom, b.z + rise, b.bottom, nl, sideColour);
    mesh.wall(b.r[0], b.r[1], a.r[0], a.r[1], b.z + rise, b.bottom, a.z + rise, a.bottom, nr, sideColour);
    if (rise > 0) {
      // Parapet inner faces and caps.
      mesh.wall(a.il[0], a.il[1], b.il[0], b.il[1], a.z + rise, a.z, b.z + rise, b.z, nr, parapet);
      mesh.wall(b.ir[0], b.ir[1], a.ir[0], a.ir[1], b.z + rise, b.z, a.z + rise, a.z, nl, parapet);
      mesh.quad([a.l[0], a.l[1], a.z + rise], [b.l[0], b.l[1], b.z + rise], [b.il[0], b.il[1], b.z + rise], [a.il[0], a.il[1], a.z + rise], [0, 0, 1], parapet);
      mesh.quad([a.r[0], a.r[1], a.z + rise], [b.r[0], b.r[1], b.z + rise], [b.ir[0], b.ir[1], b.z + rise], [a.ir[0], a.ir[1], a.z + rise], [0, 0, 1], parapet);
    }
    if (wet) {
      // Soffit or barrel vault, seen from a boat or across the canal.
      const az = arch && archZ(p.s[i]) != null ? a.bottom : a.z - (FAMILY[p.family] ?? DEFAULT_FAMILY).thickness;
      const bz = arch && archZ(p.s[i + 1]) != null ? b.bottom : b.z - (FAMILY[p.family] ?? DEFAULT_FAMILY).thickness;
      mesh.quad([a.l[0], a.l[1], az], [a.r[0], a.r[1], az], [b.r[0], b.r[1], bz], [b.l[0], b.l[1], bz], [0, 0, -1], arch ? fascia : SOFFIT);
    }
  }
  // End caps of the ramps (a sliver where the approach meets the street).
  for (const [e, sign] of [[edges[0], -1], [edges[n - 1], 1]] as const) {
    if (e.z - 0 < 0.05) continue;
    const t = tangentAt(p, sign < 0 ? 0 : n - 1);
    mesh.quad([e.l[0], e.l[1], e.z], [e.r[0], e.r[1], e.z], [e.r[0], e.r[1], 0], [e.l[0], e.l[1], 0], [t[0] * sign, t[1] * sign, 0], ABUTMENT);
  }
  return mesh.build();
}

export interface FallbackDeck {
  id: string;
  name: string;
  /** Footprint ring in scene metres. */
  ring: number[];
}

export function decodeFallback(bridge: FallbackBridge, quant: number, toScene: ToScene = (x, y) => [x, y]): FallbackDeck {
  const ring: number[] = [];
  for (let i = 0; i + 1 < bridge.ring.length; i += 2) ring.push(...toScene(bridge.ring[i] * quant, bridge.ring[i + 1] * quant));
  // Faces are built for a CCW ring (outward = right of each edge).
  let area = 0;
  for (let i = 0, n = ring.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    area += ring[i * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[i * 2 + 1];
  }
  if (area < 0) {
    const points: number[][] = [];
    for (let i = 0; i < ring.length; i += 2) points.push([ring[i], ring[i + 1]]);
    ring.length = 0;
    for (const point of points.reverse()) ring.push(point[0], point[1]);
  }
  return { id: bridge.id, name: bridge.name, ring };
}

/** A measured deck this low reads as flat: draw it like an unmeasured footprint. */
export const FLAT_DECK_MAX_M = 0.3;
export function isFlatMeasured(bridge: MeasuredBridge): boolean {
  if (bridge.outline.length < 6) return false;
  for (let i = 3; i < bridge.p.length; i += 4) if (bridge.p[i] / 100 >= FLAT_DECK_MAX_M) return false;
  return true;
}

/** Flat footprint deck: the road surface (drawn without depth so overlays stay on it). */
export function fallbackDeckTop(deck: FallbackDeck, colour: RGB = DECK_TOP): MeshData {
  const mesh = new MeshBuilder();
  mesh.flat(deck.ring, earcut(deck.ring, undefined, 2), FALLBACK_TOP_M, [0, 0, 1], colour);
  return mesh.build();
}

/** Flat footprint deck: fascia and soffit below street level (seen only through the water). */
export function fallbackDeckUnderside(deck: FallbackDeck, family = 'steel-deck'): MeshData {
  const mesh = new MeshBuilder();
  const fascia = hexToRgb((FAMILY[family] ?? DEFAULT_FAMILY).fascia);
  const ring = deck.ring, n = ring.length / 2;
  const bottom = FALLBACK_TOP_M - FALLBACK_THICKNESS_M;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = ring[i * 2], y0 = ring[i * 2 + 1], x1 = ring[j * 2], y1 = ring[j * 2 + 1];
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (length < 1e-3) continue;
    // CCW ring: outward is the right of each edge.
    mesh.wall(x0, y0, x1, y1, FALLBACK_TOP_M, bottom, FALLBACK_TOP_M, bottom, [(y1 - y0) / length, -(x1 - x0) / length, 0], fascia);
  }
  mesh.flat(ring, earcut(ring, undefined, 2), bottom, [0, 0, -1], SOFFIT);
  return mesh.build();
}

/** Point-in-ring (even-odd) over a flat [x, y, …] ring. */
export function pointInRing(ring: ArrayLike<number>, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length / 2 - 1; i < ring.length / 2; j = i++) {
    const xi = ring[i * 2], yi = ring[i * 2 + 1], xj = ring[j * 2], yj = ring[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface DeckHit {
  id: string;
  height: number;
  /** Unit tangent of the profile at the hit (scene frame). */
  tangent: [number, number];
}

/**
 * Deck height under a point, for lifting the rider's model onto a bridge.
 * Visual only: the rider's 2D position and the road graph are unchanged.
 * A bridge that does not cross water (a viaduct) lifts only a rider heading
 * along it, so a street passing underneath stays on the ground.
 */
export class DeckIndex {
  private readonly grid = new Map<string, DeckProfile[]>();
  constructor(private readonly profiles: readonly DeckProfile[], private readonly bucketM = 40) {
    for (const p of profiles) {
      for (let gx = Math.floor(p.bbox[0] / bucketM); gx <= Math.floor(p.bbox[2] / bucketM); gx++) {
        for (let gy = Math.floor(p.bbox[1] / bucketM); gy <= Math.floor(p.bbox[3] / bucketM); gy++) {
          const key = `${gx},${gy}`;
          const list = this.grid.get(key);
          if (list) list.push(p); else this.grid.set(key, [p]);
        }
      }
    }
  }

  get size(): number {
    return this.profiles.length;
  }

  heightAt(x: number, y: number, heading?: [number, number]): DeckHit | null {
    const candidates = this.grid.get(`${Math.floor(x / this.bucketM)},${Math.floor(y / this.bucketM)}`);
    if (!candidates) return null;
    let best: DeckHit | null = null;
    for (const p of candidates) {
      if (x < p.bbox[0] || x > p.bbox[2] || y < p.bbox[1] || y > p.bbox[3]) continue;
      let bestDistance = Infinity, bestHeight = 0, bestHalf = 0, bestTangent: [number, number] = [1, 0];
      for (let i = 0; i + 1 < p.x.length; i++) {
        const ax = p.x[i], ay = p.y[i], dx = p.x[i + 1] - ax, dy = p.y[i + 1] - ay;
        const len2 = dx * dx + dy * dy;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
        const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
        if (d < bestDistance) {
          bestDistance = d;
          bestHeight = lerp(p.h[i], p.h[i + 1], t);
          bestHalf = lerp(p.halfWidth[i], p.halfWidth[i + 1], t);
          const length = Math.sqrt(len2) || 1;
          bestTangent = [dx / length, dy / length];
        }
      }
      if (bestDistance > bestHalf + 0.25) continue;
      if (!p.water && heading && Math.abs(heading[0] * bestTangent[0] + heading[1] * bestTangent[1]) < 0.6) continue;
      if (!best || bestHeight > best.height) best = { id: p.id, height: bestHeight, tangent: bestTangent };
    }
    return best;
  }
}

/**
 * Height and nose-up pitch for a two-contact vehicle (rear, front offsets in
 * metres along the heading). `sample` returns the surface height at a point.
 */
export function surfacePose(sample: (x: number, y: number) => number, x: number, y: number, heading: [number, number], contacts: [number, number] = [-0.6, 0.6]): { height: number; pitch: number } {
  const [rear, front] = contacts;
  const hr = sample(x + heading[0] * rear, y + heading[1] * rear);
  const hf = sample(x + heading[0] * front, y + heading[1] * front);
  const hc = sample(x, y);
  const span = front - rear;
  return { height: Math.max(hc, (hr + hf) / 2), pitch: span > 0 ? Math.atan2(hf - hr, span) : 0 };
}
