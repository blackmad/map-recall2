// Ground v2 constraints (design docs/handoffs/ground-v2-design-20261110.md, "Constraints"; lane G2a #372).
//
// Everything that is not a surface polygon enters the ground v2 bake as a GroundConstraint: level regions (a deck's
// underside, a slot or cut floor, a level crossing), breaklines (creases and height steps), covered floors (tunnels)
// and suppress rings (an authored crossing turns inference off). This file is G2c's contract with G3 (crossing
// records) and G1 (deck caps). G2a lands the types and `cellConstraints` so the bake compiles against them; phase 1
// bakes with no providers (the surface alone), so every list it reads is empty.
//
// Pure: no THREE, no DOM, no fetches.

import type { Rect } from './groundStore.js';

/** Game frame, metres (the bake converts to its integer grid). */
export type Vec2 = [number, number];

/** Where a constraint came from: the audit and the debug section print it; precedence between overlapping ones uses `rank`. */
export interface ConstraintSource {
  kind: 'crossing' | 'cap' | 'cut' | 'deck' | 'quay' | 'relief';
  /** Crossing record id, RailViaduct id, Cut id, deck register id, … */
  id: string;
  /** 3 reviewed record, 2 unreviewed record, 1 inferred (G1 / tunnels.ts), 0 relief-derived. */
  rank: number;
}

/** A height function over a region (scene z, metres). */
export type Level =
  | { kind: 'flat'; z: number }
  /** Linear along a→b, constant across. */
  | { kind: 'ramp'; a: Vec2; b: Vec2; za: number; zb: number }
  /** Along a centreline (slot floors, rail grade). */
  | { kind: 'stations'; line: Vec2[]; z: number[] }
  /** min(relief, z): G1's deck caps. */
  | { kind: 'cap'; z: number };

/** A region whose ground height is not the relief: under a deck, a slot or cut floor, a level crossing. */
export interface LevelRegion {
  type: 'level';
  ring: Vec2[];
  level: Level;
  /** Optional class override (a level crossing: carriageway), a partition rank. */
  classOverride?: number;
  source: ConstraintSource;
}

/**
 * A line the triangulation must follow. `step` absent: a crease (embankment top or foot, deck end), same z both sides.
 * `step` present: the line's vertices are duplicated and a vertical strip joins them (kerb face, cut wall, abutment,
 * quay edge, portal); `material` is the strip's GroundLayer. `pin` fixes the z along the line (a deck end at the deck's z).
 */
export interface Breakline {
  type: 'break';
  line: Vec2[];
  pin?: Level;
  step?: { high: 'left' | 'right'; highLevel?: Level; lowLevel?: Level; material: 'kerb' | 'deckBody' | 'quay' | 'land' };
  source: ConstraintSource;
}

/** A covered floor under the ground sheet (tunnel): its own sheet, joined at `portals` (edges of `ring`, by index). */
export interface Covered { type: 'covered'; ring: Vec2[]; level: Level; portals: number[]; mouth: 'dark' | 'none'; source: ConstraintSource }

/** Inference off: the crossing is authored, so tunnels.ts / railSpans.ts / G1 caps must not invent one here. */
export interface Suppress { type: 'suppress'; ring: Vec2[]; what: ('cut' | 'span' | 'cap' | 'portal')[]; source: ConstraintSource }

export type GroundConstraint = LevelRegion | Breakline | Covered | Suppress;

/** A source of constraints near a cell (G2c: crossings, caps, cuts, spans, decks, quays, relief). */
export interface ConstraintProvider { name: string; near(rect: Rect, padM: number): GroundConstraint[] }

/** The pad around a cell within which providers are asked (groundStore CELL_INPUT_PAD_M). */
export const CONSTRAINT_PAD_M = 200;

const ringOf = (c: GroundConstraint): readonly Vec2[] => (c.type === 'break' ? c.line : c.ring);

/** Does a constraint's ring or line reach the rect (padded)? */
export function constraintNear(c: GroundConstraint, rect: Rect, padM = 0): boolean {
  const pts = ringOf(c);
  if (!pts.length) return false;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 >= rect[0] - padM && x0 <= rect[2] + padM && y1 >= rect[1] - padM && y0 <= rect[3] + padM;
}

/**
 * All constraints near a cell, from every provider, in a stable order (source.rank desc, then id, then provider order).
 * Suppress rings then remove every lower-rank constraint of the named kinds that they overlap (bbox test; G2c refines).
 */
export function cellConstraints(rect: Rect, providers: readonly ConstraintProvider[], padM = CONSTRAINT_PAD_M): GroundConstraint[] {
  const all: { c: GroundConstraint; p: number; i: number }[] = [];
  providers.forEach((prov, p) => prov.near(rect, padM).forEach((c, i) => { if (constraintNear(c, rect, padM)) all.push({ c, p, i }); }));
  all.sort((a, b) => b.c.source.rank - a.c.source.rank || (a.c.source.id < b.c.source.id ? -1 : a.c.source.id > b.c.source.id ? 1 : 0) || a.p - b.p || a.i - b.i);
  const suppress = all.filter(e => e.c.type === 'suppress').map(e => e.c as Suppress);
  const kindOf = (c: GroundConstraint): Suppress['what'][number] | null => (c.source.kind === 'cut' ? 'cut' : c.source.kind === 'cap' ? 'cap' : c.type === 'covered' ? 'portal' : c.source.kind === 'deck' ? 'span' : null);
  const box = (pts: readonly Vec2[]): Rect => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  return all.map(e => e.c).filter(c => {
    if (c.type === 'suppress') return true;
    const k = kindOf(c);
    if (!k) return true;
    const b = box(ringOf(c));
    return !suppress.some(s => s.source.rank > c.source.rank && s.what.includes(k) && (() => { const sb = box(s.ring); return sb[2] >= b[0] && sb[0] <= b[2] && sb[3] >= b[1] && sb[1] <= b[3]; })());
  });
}
