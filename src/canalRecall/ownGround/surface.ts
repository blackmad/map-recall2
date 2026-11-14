// The riding surface: AHN relief plus measured bridge decks, as one height
// function every ground mesh, overlay and model base samples (pure).
//
// Scene frame: the game's local metres (x east, y north) and z in metres above
// `sceneDatumNAP` (+1.37 m NAP: canal water −0.40 m NAP plus the 1.77 m quay
// freeboard the flat elevation layer uses), so the canal belt's quays stay near
// z = 0 and the water sits at z = −1.77 as before.
//
// Decks join the roads by construction. A measured profile stores the deck
// height relative to the straight line between its two approach ends; that
// line is re-based on *our* relief at those ends (which agrees with the bridge
// pipeline's AHN to ~0.1 m), so the crown lands at the measured height. The
// approach ramps are ground the DTM already carries, so only the deck span
// (`profile.deck`, the DSM-only part) lifts the surface, eased from the relief
// over DECK_EASE_M at each end. Where the deck starts the riding surface is
// the relief itself — no seam, no step — and the quay walls, street ribbons
// and route ribbon all sample this one function.

import { applyLocalToRd, type GroundField, type LocalToRd } from './heightField.js';
import type { DeckProfile } from '../elevation/bridgeDeck.js';
import { cutRelief, insideCut, locateCut, type Cut } from './tunnels.js';

export type Vec2 = [number, number];
export type HeightFn = (x: number, y: number) => number;

/** Lateral blend from a deck edge back to the ground, metres. */
export const DECK_BLEND_M = 0.75;
/** Longitudinal ease from the relief onto the deck at each deck end, metres. */
export const DECK_EASE_M = 2.5;
/**
 * Steepest grade the ease may make (smoothstep peaks at 1.5× its mean): where
 * the DTM approach ends well below the deck start (BRU0067: 0.5 m), the ease
 * lengthens to keep this grade instead of a 35 % kink in 0.5 m. Masonry arches
 * keep their short, steep hump.
 */
export const DECK_EASE_MAX_GRADE = 0.2;
const DECK_EASE_MAX_M = 6;
/**
 * Steepest grade a measured deck span may climb (1:8). The AHN DSM sees cars,
 * lamp posts and railings as deck; a lower envelope at this grade takes their
 * spikes out without lowering any crown (13 of 931 decks change by > 2 cm, no
 * crown by > 5 cm; lane bridges-elevation 2026-10-13).
 */
export const DECK_MAX_GRADE = 0.12;
const BUCKET_M = 25;
const bucketKey = (bx: number, by: number) => (bx + 1_048_576) * 2_097_152 + (by + 1_048_576);

/**
 * GroundSurface.locate's segment index for long profiles (lane rail-street-speed 2026-11-14: a 4,660-station viaduct
 * deck, OSM 130106320, took 4 M locates of 4,660 segments each in one Sloterdijk cell build, 90 % of it). Segments in
 * blocks of LOCATE_BLOCK consecutive ones, each block's point bbox; locate scans only the blocks whose bbox can hold a
 * segment as near as the nearest block's best, in index order with the same arithmetic, so it returns exactly what the
 * full scan returns (the first segment at the minimum distance). Keyed on the profile's `x` array; a profile whose
 * stations move in place (wayDecks.ts setDeckSides) must call forgetLocateIndex.
 */
const LOCATE_BLOCK = 32, LOCATE_GROUP = 16, LOCATE_INDEX_MIN_STATIONS = 4 * LOCATE_BLOCK;
interface LocateIndex { y: Float64Array; n: number; /** Block boxes x0, y0, x1, y1. */ boxes: Float64Array; /** Boxes of LOCATE_GROUP consecutive blocks. */ groups: Float64Array }
const locateIndexes = new WeakMap<Float64Array, LocateIndex>();
export function forgetLocateIndex(p: DeckProfile): void { locateIndexes.delete(p.x); }
function locateIndex(p: DeckProfile): LocateIndex {
  const n = p.x.length, hit = locateIndexes.get(p.x);
  if (hit && hit.y === p.y && hit.n === n) return hit;
  const nb = Math.ceil((n - 1) / LOCATE_BLOCK), boxes = new Float64Array(nb * 4), groups = new Float64Array(Math.ceil(nb / LOCATE_GROUP) * 4).fill(NaN);
  for (let b = 0; b < nb; b++) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    // A NaN station makes the box NaN: never skipped (NaN > bound is false).
    for (let i = b * LOCATE_BLOCK, end = Math.min((b + 1) * LOCATE_BLOCK, n - 1); i <= end; i++) {
      const x = p.x[i], y = p.y[i];
      if (x !== x || y !== y) { x0 = y0 = x1 = y1 = NaN; break; }
      x0 = x0 < x ? x0 : x; y0 = y0 < y ? y0 : y; x1 = x1 > x ? x1 : x; y1 = y1 > y ? y1 : y;
    }
    boxes[4 * b] = x0; boxes[4 * b + 1] = y0; boxes[4 * b + 2] = x1; boxes[4 * b + 3] = y1;
    const g = 4 * Math.floor(b / LOCATE_GROUP);
    if (b % LOCATE_GROUP === 0) { groups[g] = x0; groups[g + 1] = y0; groups[g + 2] = x1; groups[g + 3] = y1; }
    else if (groups[g] === groups[g] && x0 === x0) { groups[g] = Math.min(groups[g], x0); groups[g + 1] = Math.min(groups[g + 1], y0); groups[g + 2] = Math.max(groups[g + 2], x1); groups[g + 3] = Math.max(groups[g + 3], y1); }
    else groups[g] = groups[g + 1] = groups[g + 2] = groups[g + 3] = NaN;
  }
  const index = { y: p.y, n, boxes, groups };
  locateIndexes.set(p.x, index);
  return index;
}
/** Squared distance from (x, y) to box b (a lower bound of every segment's in it); NaN for a NaN box. */
function boxDist2(boxes: Float64Array, b: number, x: number, y: number): number {
  const x0 = boxes[4 * b], y0 = boxes[4 * b + 1], x1 = boxes[4 * b + 2], y1 = boxes[4 * b + 3];
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0, dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
  return x0 !== x0 ? NaN : dx * dx + dy * dy;
}

export interface DeckSurface {
  profile: DeckProfile;
  /** Scene z of the deck top per station (on the centreline, ease included). */
  z: Float64Array;
  /** Relief z at the two approach ends the profile was re-based on. */
  ends: [number, number];
  /** The deck span in stations (the profile's `deck`, clamped to its stations). */
  span: [number, number];
  /** Ease length at each deck end, metres (DECK_EASE_M, longer where the step onto the deck is high). */
  ease: [number, number];
}

/** Lower envelope of `h` at `grade` within the deck span `[d0, d1]` (outside it, h is untouched: the relief carries the ramps). */
export function clampDeckGrade(s: Float64Array, h: Float64Array, deck: readonly [number, number], grade: number): Float64Array {
  const out = h.slice(), idx: number[] = [];
  for (let i = 0; i < s.length; i++) if (s[i] >= deck[0] && s[i] <= deck[1]) idx.push(i);
  for (let k = 1; k < idx.length; k++) { const i = idx[k], j = idx[k - 1]; out[i] = Math.min(out[i], out[j] + grade * (s[i] - s[j])); }
  for (let k = idx.length - 2; k >= 0; k--) { const i = idx[k], j = idx[k + 1]; out[i] = Math.min(out[i], out[j] + grade * (s[j] - s[i])); }
  return out;
}

const smoothstep = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export class GroundSurface {
  readonly decks: DeckSurface[] = [];
  /** Decks by BUCKET_M square, keyed bucketKey(bx, by) (a number: the template-string key allocated on every lookup). */
  private readonly buckets = new Map<number, DeckSurface[]>();
  /** Height used where the field has no tile (keeps a missing tile flat, not a hole). */
  fallbackZ = 0;
  /** Tunnel cuts (tunnels.ts): ramps into tunnels and slots through embankments, placed once each. */
  readonly cuts: Cut[] = [];
  private readonly cutBuckets = new Map<number, Cut[]>();

  constructor(readonly field: GroundField, readonly localToRd: LocalToRd, readonly datumNAP: number) {}

  /** The relief's measured sample spacing under a scene point, metres (2 m in the measured centre, 4 m on the coarse ring). */
  dataStepAt(x: number, y: number): number {
    const [rx, ry] = applyLocalToRd(this.localToRd, x, y);
    return this.field.dataStepRd(rx, ry);
  }

  /** The measured relief alone (no decks, no tunnel cuts), scene z. */
  relief = (x: number, y: number): number => {
    const [rx, ry] = applyLocalToRd(this.localToRd, x, y);
    const h = this.field.heightRd(rx, ry);
    return h === h ? h - this.datumNAP : this.fallbackZ;
  };

  /**
   * Relief (no decks), scene z: the measured relief, except where a tunnel cut says otherwise (tunnels.ts cutRelief:
   * the wall-top level over the cut's strip, the land behind its walls and over its portals lifted to their tops).
   */
  ground = (x: number, y: number): number => {
    const r = this.relief(x, y);
    if (!this.cutBuckets.size) return r;
    const list = this.cutBuckets.get(bucketKey(Math.floor(x / BUCKET_M), Math.floor(y / BUCKET_M)));
    if (!list) return r;
    let z = NaN;
    for (const c of list) {
      const [x0, y0, x1, y1] = c.bbox;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const h = locateCut(c, x, y);
      if (!h) continue;
      const v = cutRelief(c, h, r);
      if (v === v) z = z === z ? Math.max(z, v) : v;
    }
    return z === z ? z : r;
  };

  /** Place a tunnel cut (tunnels.ts) and index it for `ground`, `height` and `cutFloor`. */
  addCut(cut: Cut): void {
    this.cuts.push(cut);
    const [x0, y0, x1, y1] = cut.bbox;
    for (let bx = Math.floor(x0 / BUCKET_M); bx <= Math.floor(x1 / BUCKET_M); bx++)
      for (let by = Math.floor(y0 / BUCKET_M); by <= Math.floor(y1 / BUCKET_M); by++) {
        const k = bucketKey(bx, by);
        (this.cutBuckets.get(k) ?? this.cutBuckets.set(k, []).get(k)!).push(cut);
      }
  }

  /** Take a placed cut off the surface again (groundStore's deterministic cut plans: a lower-keyed plan's cut replaces it). */
  removeCut(cut: Cut): void {
    const i = this.cuts.indexOf(cut);
    if (i < 0) return;
    this.cuts.splice(i, 1);
    const [x0, y0, x1, y1] = cut.bbox;
    for (let bx = Math.floor(x0 / BUCKET_M); bx <= Math.floor(x1 / BUCKET_M); bx++)
      for (let by = Math.floor(y0 / BUCKET_M); by <= Math.floor(y1 / BUCKET_M); by++) {
        const k = bucketKey(bx, by), list = this.cutBuckets.get(k);
        if (!list) continue;
        const j = list.indexOf(cut);
        if (j >= 0) list.splice(j, 1);
        if (!list.length) this.cutBuckets.delete(k);
      }
  }

  /** The riding floor of a tunnel cut whose strip holds (x, y), or NaN (the lowest where strips overlap). */
  cutFloor = (x: number, y: number): number => {
    if (!this.cutBuckets.size) return NaN;
    const list = this.cutBuckets.get(bucketKey(Math.floor(x / BUCKET_M), Math.floor(y / BUCKET_M)));
    if (!list) return NaN;
    let z = NaN;
    for (const c of list) {
      const [x0, y0, x1, y1] = c.bbox;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const h = locateCut(c, x, y);
      if (h && insideCut(c, h)) z = z === z ? Math.min(z, h.floor) : h.floor;
    }
    return z;
  };

  /** Stations → (x, y, hump above the deck-end chord) at station s. */
  private static at(p: DeckProfile, s: number): { x: number; y: number; h: number } {
    const n = p.s.length;
    let i = 0;
    while (i < n - 2 && p.s[i + 1] < s) i++;
    const t = Math.max(0, Math.min(1, (s - p.s[i]) / ((p.s[i + 1] - p.s[i]) || 1)));
    return { x: p.x[i] + (p.x[i + 1] - p.x[i]) * t, y: p.y[i] + (p.y[i + 1] - p.y[i]) * t, h: p.h[i] + (p.h[i + 1] - p.h[i]) * t };
  }

  /** Deck-top z at station s on the centreline, before the ease: approach chord on the relief + measured height. */
  private static deckZ(p: DeckProfile, ends: [number, number], s: number): number {
    const n = p.s.length, u = (s - p.s[0]) / ((p.s[n - 1] - p.s[0]) || 1);
    return ends[0] + (ends[1] - ends[0]) * u + GroundSurface.at(p, s).h;
  }

  /**
   * Place a measured profile's deck on the relief and index it for `height`. `ground`: what its ends and approaches
   * stand on (default the relief with the cuts placed so far; groundStore's deterministic mode passes the bare relief,
   * so a deck does not depend on which cuts were planned before it).
   */
  addDeck(measured: DeckProfile, ground: (x: number, y: number) => number = this.ground): DeckSurface {
    const profile: DeckProfile = { ...measured, h: clampDeckGrade(measured.s, measured.h, measured.deck, DECK_MAX_GRADE) };
    const n = profile.x.length;
    const span: [number, number] = [Math.max(profile.s[0], profile.deck[0]), Math.min(profile.s[n - 1], profile.deck[1])];
    const ends: [number, number] = [ground(profile.x[0], profile.y[0]), ground(profile.x[n - 1], profile.y[n - 1])];
    const z = new Float64Array(n);
    const easeAt = (s: number) => {
      const p = GroundSurface.at(profile, s), jump = Math.abs(GroundSurface.deckZ(profile, ends, s) - ground(p.x, p.y));
      if (profile.family === 'masonry-arch') return DECK_EASE_M;
      return Math.min(Math.max(DECK_EASE_M, 1.5 * jump / DECK_EASE_MAX_GRADE), DECK_EASE_MAX_M, Math.max(DECK_EASE_M, (span[1] - span[0]) / 2));
    };
    const ease: [number, number] = [easeAt(span[0]), easeAt(span[1])];
    for (let i = 0; i < n; i++) {
      const s = profile.s[i];
      if (s <= span[0] || s >= span[1]) { z[i] = ground(profile.x[i], profile.y[i]); continue; }
      const w = GroundSurface.easeWeight(s, span, ease);
      const g = ground(profile.x[i], profile.y[i]);
      z[i] = g + w * (GroundSurface.deckZ(profile, ends, s) - g);
    }
    const deck: DeckSurface = { profile, z, ends, span, ease };
    this.decks.push(deck);
    const [x0, y0, x1, y1] = profile.bbox, pad = DECK_BLEND_M;
    for (let bx = Math.floor((x0 - pad) / BUCKET_M); bx <= Math.floor((x1 + pad) / BUCKET_M); bx++)
      for (let by = Math.floor((y0 - pad) / BUCKET_M); by <= Math.floor((y1 + pad) / BUCKET_M); by++) {
        const k = bucketKey(bx, by);
        (this.buckets.get(k) ?? this.buckets.set(k, []).get(k)!).push(deck);
      }
    return deck;
  }

  /**
   * Give a placed deck its riding edges (DeckProfile.edges, bridgeGaps) and index it over its grown box. Called once,
   * before any cell built from this surface reads the deck (groundStore.ts prepareCell awaits it).
   */
  widenDeck(deck: DeckSurface, edges: { left: Float64Array; right: Float64Array }, bbox: [number, number, number, number]): void {
    deck.profile.edges = edges;
    deck.profile.bbox = bbox;
    const [x0, y0, x1, y1] = bbox, pad = DECK_BLEND_M;
    for (let bx = Math.floor((x0 - pad) / BUCKET_M); bx <= Math.floor((x1 + pad) / BUCKET_M); bx++)
      for (let by = Math.floor((y0 - pad) / BUCKET_M); by <= Math.floor((y1 + pad) / BUCKET_M); by++) {
        const k = bucketKey(bx, by), list = this.buckets.get(k) ?? this.buckets.set(k, []).get(k)!;
        if (!list.includes(deck)) list.push(deck);
      }
  }

  /** 0 at either deck end → 1 once past that end's ease. */
  static easeWeight(s: number, span: readonly [number, number], ease: readonly [number, number]): number {
    return Math.min(smoothstep((s - span[0]) / ease[0]), smoothstep((span[1] - s) / ease[1]));
  }

  /**
   * The deck span's footprint as a closed ring (left edge out, right edge back), scene coords. `range` (stations) widens
   * it along the axis, e.g. to the drawn reach onto the banks (decks.ts deckReach).
   */
  static footprint(deck: DeckSurface, range?: readonly [number, number]): Vec2[] {
    const p = deck.profile, left: Vec2[] = [], right: Vec2[] = [];
    const s0 = Math.min(deck.span[0], range?.[0] ?? Infinity), s1 = Math.max(deck.span[1], range?.[1] ?? -Infinity);
    for (let i = 0; i < p.s.length; i++) {
      if (p.s[i] < s0 - 0.5 || p.s[i] > s1 + 0.5) continue;
      const a = Math.max(0, i - 1), b = Math.min(p.s.length - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l, hw = p.halfWidth[i];
      // DeckProfile.edges (bridgeGaps): the riding width on each side, as the surface reads it.
      const hl = p.edges ? Math.max(hw, p.edges.left[i]) : hw, hr = p.edges ? Math.max(hw, p.edges.right[i]) : hw;
      left.push([p.x[i] + nx * hl, p.y[i] + ny * hl]); right.push([p.x[i] - nx * hr, p.y[i] - ny * hr]);
    }
    return [...left, ...right.reverse()];
  }

  /** Where (x, y) sits relative to a deck: station index/fraction, lateral distance, deck z there. */
  static locate(deck: DeckSurface, x: number, y: number): { d: number; z: number; halfWidth: number; s: number; lateral: number } {
    const p = deck.profile, n = p.x.length;
    let best = Infinity, bi = 0, bt = 0;
    if (n < LOCATE_INDEX_MIN_STATIONS) {
      for (let i = 0; i + 1 < n; i++) {
        const ax = p.x[i], ay = p.y[i], dx = p.x[i + 1] - ax, dy = p.y[i + 1] - ay, len2 = dx * dx + dy * dy || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        const ex = ax + dx * t - x, ey = ay + dy * t - y, d2 = ex * ex + ey * ey;
        if (d2 < best) { best = d2; bi = i; bt = t; }
      }
    } else {
      // The nearest box's block gives an upper bound; every block whose box lies within it (plus rounding slack) is
      // scanned in index order exactly as the full loop would, the others hold no segment at the minimum.
      const { boxes, groups } = locateIndex(p), nb = boxes.length >> 2, ng = groups.length >> 2;
      let firstGroup = 0, firstD2 = Infinity, first = 0, bound = Infinity;
      for (let g = 0; g < ng; g++) { const d2 = boxDist2(groups, g, x, y); if (d2 < firstD2) { firstD2 = d2; firstGroup = g; } }
      firstD2 = Infinity;
      first = firstGroup * LOCATE_GROUP;
      for (let b = first, end = Math.min(first + LOCATE_GROUP, nb); b < end; b++) { const d2 = boxDist2(boxes, b, x, y); if (d2 < firstD2) { firstD2 = d2; first = b; } }
      for (let i = first * LOCATE_BLOCK, end = Math.min((first + 1) * LOCATE_BLOCK, n - 1); i < end; i++) {
        const ax = p.x[i], ay = p.y[i], dx = p.x[i + 1] - ax, dy = p.y[i + 1] - ay, len2 = dx * dx + dy * dy || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        const ex = ax + dx * t - x, ey = ay + dy * t - y, d2 = ex * ex + ey * ey;
        if (d2 < bound) bound = d2;
      }
      bound += bound * 1e-9 + 1e-9;
      for (let g = 0; g < ng; g++) {
        if (boxDist2(groups, g, x, y) > bound) continue;
        for (let b = g * LOCATE_GROUP, bEnd = Math.min(b + LOCATE_GROUP, nb); b < bEnd; b++) {
          if (boxDist2(boxes, b, x, y) > bound) continue;
          for (let i = b * LOCATE_BLOCK, end = Math.min((b + 1) * LOCATE_BLOCK, n - 1); i < end; i++) {
            const ax = p.x[i], ay = p.y[i], dx = p.x[i + 1] - ax, dy = p.y[i + 1] - ay, len2 = dx * dx + dy * dy || 1e-9;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
            const ex = ax + dx * t - x, ey = ay + dy * t - y, d2 = ex * ex + ey * ey;
            if (d2 < best) { best = d2; bi = i; bt = t; }
          }
        }
      }
    }
    const lerp = (arr: Float64Array) => arr[bi] + (arr[Math.min(n - 1, bi + 1)] - arr[bi]) * bt;
    const s = lerp(p.s);
    // DeckProfile.edges (bridgeGaps): the half-width on the point's side of the road line.
    let halfWidth = lerp(p.halfWidth);
    if (p.edges) {
      const j = Math.min(n - 1, bi + 1), left = (p.x[j] - p.x[bi]) * (y - p.y[bi]) - (p.y[j] - p.y[bi]) * (x - p.x[bi]) >= 0;
      halfWidth = Math.max(halfWidth, lerp(left ? p.edges.left : p.edges.right));
    }
    // Only the deck span lifts the surface; the approaches are relief.
    const off = s <= deck.span[0] || s >= deck.span[1];
    return { d: off ? Infinity : Math.sqrt(best), z: lerp(deck.z), halfWidth, s, lateral: Math.sqrt(best) };
  }

  /** Riding-surface z: relief, lifted onto any measured deck within its width (blended over DECK_BLEND_M); a tunnel cut's floor in its strip. */
  height = (x: number, y: number): number => {
    const g = this.ground(x, y);
    const list = this.buckets.get(bucketKey(Math.floor(x / BUCKET_M), Math.floor(y / BUCKET_M)));
    // In a tunnel cut's strip the floor, unless a deck crosses over it (a street bridged over a ramp keeps its deck).
    if (this.cutBuckets.size && !(list && this.deckWeight(x, y) > 0)) { const floor = this.cutFloor(x, y); if (floor === floor) return floor; }
    if (!list) return g;
    let z = g;
    for (const deck of list) {
      const [x0, y0, x1, y1] = deck.profile.bbox;
      if (x < x0 - DECK_BLEND_M || x > x1 + DECK_BLEND_M || y < y0 - DECK_BLEND_M || y > y1 + DECK_BLEND_M) continue;
      const at = GroundSurface.locate(deck, x, y);
      if (at.d === Infinity) continue;
      const w = 1 - smoothstep((at.d - at.halfWidth) / DECK_BLEND_M);
      if (w <= 0) continue;
      // The ease toward each deck end uses this point's own relief, so the deck
      // corners meet sloping ground as exactly as the centreline does.
      const p = deck.profile;
      const e = GroundSurface.easeWeight(at.s, deck.span, deck.ease);
      const top = e >= 1 ? at.z : g + e * (GroundSurface.deckZ(p, deck.ends, at.s) - g);
      // Never pull the surface below the relief: a deck only adds height.
      z = Math.max(z, g + w * (top - g));
    }
    return z;
  };

  /**
   * 1 within a measured deck span's footprint (+1 m past each span end), fading to 0 over DECK_BLEND_M beside it (0 off
   * every deck). `family`: only the decks of that profile family (e.g. 'dry-way-deck', the viaducts over land a track
   * passes under: railTracks' land, groundCell.ts).
   */
  deckWeight = (x: number, y: number, family?: string): number => {
    const list = this.buckets.get(bucketKey(Math.floor(x / BUCKET_M), Math.floor(y / BUCKET_M)));
    if (!list) return 0;
    let best = 0;
    for (const deck of list) {
      if (family !== undefined && deck.profile.family !== family) continue;
      const [x0, y0, x1, y1] = deck.profile.bbox;
      if (x < x0 - DECK_BLEND_M || x > x1 + DECK_BLEND_M || y < y0 - DECK_BLEND_M || y > y1 + DECK_BLEND_M) continue;
      const at = GroundSurface.locate(deck, x, y);
      if (at.s < deck.span[0] - 1 || at.s > deck.span[1] + 1) continue;
      best = Math.max(best, 1 - smoothstep((at.lateral - at.halfWidth) / DECK_BLEND_M));
    }
    return best;
  };

  /** Surface normal by central differences (scene metres). */
  normal(x: number, y: number, e = 0.5): [number, number, number] {
    const dx = (this.height(x + e, y) - this.height(x - e, y)) / (2 * e), dy = (this.height(x, y + e) - this.height(x, y - e)) / (2 * e);
    const l = Math.hypot(dx, dy, 1);
    return [-dx / l, -dy / l, 1 / l];
  }
}

/**
 * Pose of a two-wheeler on the surface: the height under it and its pitch from
 * the contact points `wheelbase/2` ahead and behind (radians, nose-up positive).
 */
export function riderPose(height: HeightFn, x: number, y: number, dir: Vec2, wheelbase = 1.2): { z: number; pitch: number } {
  const h = wheelbase / 2;
  const front = height(x + dir[0] * h, y + dir[1] * h), back = height(x - dir[0] * h, y - dir[1] * h);
  return { z: (front + back) / 2, pitch: Math.atan2(front - back, wheelbase) };
}
