// The riding surface: AHN relief plus measured bridge decks, as one height
// function every ground mesh, overlay and model base samples (pure).
//
// Scene frame: the game's local metres (x east, y north) and z in metres above
// `sceneDatumNAP` (+1.37 m NAP: canal water −0.40 m NAP plus the 1.77 m quay
// freeboard the flat elevation layer uses), so the canal belt's quays stay near
// z = 0 and the water sits at z = −1.77 as before.
//
// Decks join the roads by construction: a measured profile stores the deck
// height relative to the straight line between its two approach ends. Here
// that line is re-based on *our* relief at those ends, so where the profile
// returns to zero the deck height equals the ground the street ribbons and the
// quay walls are draped on — no seam, no step.

import { applyLocalToRd, type GroundField, type LocalToRd } from './heightField.js';
import type { DeckProfile } from '../elevation/bridgeDeck.js';

export type Vec2 = [number, number];
export type HeightFn = (x: number, y: number) => number;

/** Lateral blend from a deck edge back to the ground, metres. */
export const DECK_BLEND_M = 2;
const BUCKET_M = 25;

export interface DeckSurface {
  profile: DeckProfile;
  /** Scene z of the deck top per station. */
  z: Float64Array;
  /** Ground z at the two ends the deck was re-based on. */
  ends: [number, number];
}

const smoothstep = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export class GroundSurface {
  readonly decks: DeckSurface[] = [];
  private readonly buckets = new Map<string, DeckSurface[]>();
  /** Height used where the field has no tile (keeps a missing tile flat, not a hole). */
  fallbackZ = 0;

  constructor(readonly field: GroundField, readonly localToRd: LocalToRd, readonly datumNAP: number) {}

  /** Relief only (no decks), scene z. */
  ground = (x: number, y: number): number => {
    const [rx, ry] = applyLocalToRd(this.localToRd, x, y);
    const h = this.field.heightRd(rx, ry);
    return h === h ? h - this.datumNAP : this.fallbackZ;
  };

  /** Re-base a measured profile on the relief and index it for `height`. */
  addDeck(profile: DeckProfile): DeckSurface {
    const n = profile.x.length;
    const g0 = this.ground(profile.x[0], profile.y[0]), g1 = this.ground(profile.x[n - 1], profile.y[n - 1]);
    const s0 = profile.s[0], span = (profile.s[n - 1] - s0) || 1;
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) z[i] = g0 + (g1 - g0) * ((profile.s[i] - s0) / span) + profile.h[i];
    const deck: DeckSurface = { profile, z, ends: [g0, g1] };
    this.decks.push(deck);
    const [x0, y0, x1, y1] = profile.bbox, pad = DECK_BLEND_M;
    for (let bx = Math.floor((x0 - pad) / BUCKET_M); bx <= Math.floor((x1 + pad) / BUCKET_M); bx++)
      for (let by = Math.floor((y0 - pad) / BUCKET_M); by <= Math.floor((y1 + pad) / BUCKET_M); by++) {
        const k = `${bx}:${by}`;
        (this.buckets.get(k) ?? this.buckets.set(k, []).get(k)!).push(deck);
      }
    return deck;
  }

  /** Where (x, y) sits relative to a deck: station index/fraction, lateral distance, deck z there. */
  static locate(deck: DeckSurface, x: number, y: number): { d: number; z: number; halfWidth: number; s: number } {
    const p = deck.profile, n = p.x.length;
    let best = Infinity, bi = 0, bt = 0;
    for (let i = 0; i + 1 < n; i++) {
      const ax = p.x[i], ay = p.y[i], dx = p.x[i + 1] - ax, dy = p.y[i + 1] - ay, len2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      const ex = ax + dx * t - x, ey = ay + dy * t - y, d2 = ex * ex + ey * ey;
      if (d2 < best) { best = d2; bi = i; bt = t; }
    }
    const lerp = (arr: Float64Array) => arr[bi] + (arr[Math.min(n - 1, bi + 1)] - arr[bi]) * bt;
    // Beyond either end the point is not on the deck at all.
    const beyond = (bi === 0 && bt === 0) || (bi === n - 2 && bt === 1);
    return { d: beyond ? Infinity : Math.sqrt(best), z: lerp(deck.z), halfWidth: lerp(p.halfWidth), s: lerp(p.s) };
  }

  /** Riding-surface z: relief, lifted onto any measured deck within its width (blended over DECK_BLEND_M). */
  height = (x: number, y: number): number => {
    const g = this.ground(x, y);
    const list = this.buckets.get(`${Math.floor(x / BUCKET_M)}:${Math.floor(y / BUCKET_M)}`);
    if (!list) return g;
    let z = g;
    for (const deck of list) {
      const [x0, y0, x1, y1] = deck.profile.bbox;
      if (x < x0 - DECK_BLEND_M || x > x1 + DECK_BLEND_M || y < y0 - DECK_BLEND_M || y > y1 + DECK_BLEND_M) continue;
      const at = GroundSurface.locate(deck, x, y);
      if (at.d === Infinity) continue;
      const w = 1 - smoothstep((at.d - at.halfWidth) / DECK_BLEND_M);
      if (w <= 0) continue;
      // Never pull the surface below the relief: a deck only adds height.
      z = Math.max(z, g + w * (at.z - g));
    }
    return z;
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
