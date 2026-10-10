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

export type Vec2 = [number, number];
export type HeightFn = (x: number, y: number) => number;

/** Lateral blend from a deck edge back to the ground, metres. */
export const DECK_BLEND_M = 0.75;
/** Longitudinal ease from the relief onto the deck at each deck end, metres. */
export const DECK_EASE_M = 2.5;
const BUCKET_M = 25;

export interface DeckSurface {
  profile: DeckProfile;
  /** Scene z of the deck top per station (on the centreline, ease included). */
  z: Float64Array;
  /** Relief z at the two approach ends the profile was re-based on. */
  ends: [number, number];
  /** The deck span in stations (the profile's `deck`, clamped to its stations). */
  span: [number, number];
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

  /** Place a measured profile's deck on the relief and index it for `height`. */
  addDeck(profile: DeckProfile): DeckSurface {
    const n = profile.x.length;
    const span: [number, number] = [Math.max(profile.s[0], profile.deck[0]), Math.min(profile.s[n - 1], profile.deck[1])];
    const ends: [number, number] = [this.ground(profile.x[0], profile.y[0]), this.ground(profile.x[n - 1], profile.y[n - 1])];
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const s = profile.s[i];
      if (s <= span[0] || s >= span[1]) { z[i] = this.ground(profile.x[i], profile.y[i]); continue; }
      const w = smoothstep(Math.min(s - span[0], span[1] - s) / DECK_EASE_M);
      const g = this.ground(profile.x[i], profile.y[i]);
      z[i] = g + w * (GroundSurface.deckZ(profile, ends, s) - g);
    }
    const deck: DeckSurface = { profile, z, ends, span };
    this.decks.push(deck);
    const [x0, y0, x1, y1] = profile.bbox, pad = DECK_BLEND_M;
    for (let bx = Math.floor((x0 - pad) / BUCKET_M); bx <= Math.floor((x1 + pad) / BUCKET_M); bx++)
      for (let by = Math.floor((y0 - pad) / BUCKET_M); by <= Math.floor((y1 + pad) / BUCKET_M); by++) {
        const k = `${bx}:${by}`;
        (this.buckets.get(k) ?? this.buckets.set(k, []).get(k)!).push(deck);
      }
    return deck;
  }

  /** The deck span's footprint as a closed ring (left edge out, right edge back), scene coords. */
  static footprint(deck: DeckSurface): Vec2[] {
    const p = deck.profile, left: Vec2[] = [], right: Vec2[] = [];
    for (let i = 0; i < p.s.length; i++) {
      if (p.s[i] < deck.span[0] - 0.5 || p.s[i] > deck.span[1] + 0.5) continue;
      const a = Math.max(0, i - 1), b = Math.min(p.s.length - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l, hw = p.halfWidth[i];
      left.push([p.x[i] + nx * hw, p.y[i] + ny * hw]); right.push([p.x[i] - nx * hw, p.y[i] - ny * hw]);
    }
    return [...left, ...right.reverse()];
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
    const s = lerp(p.s);
    // Only the deck span lifts the surface; the approaches are relief.
    const off = s <= deck.span[0] || s >= deck.span[1];
    return { d: off ? Infinity : Math.sqrt(best), z: lerp(deck.z), halfWidth: lerp(p.halfWidth), s };
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
      // The ease toward each deck end uses this point's own relief, so the deck
      // corners meet sloping ground as exactly as the centreline does.
      const p = deck.profile;
      const e = smoothstep(Math.min(at.s - deck.span[0], deck.span[1] - at.s) / DECK_EASE_M);
      const top = e >= 1 ? at.z : g + e * (GroundSurface.deckZ(p, deck.ends, at.s) - g);
      // Never pull the surface below the relief: a deck only adds height.
      z = Math.max(z, g + w * (top - g));
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
