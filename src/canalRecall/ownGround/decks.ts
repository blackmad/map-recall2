// Bridge bodies on the own ground (pure): measured decks from their re-based
// profiles (surface.ts) and unmeasured footprints as flat decks.
//
// The deck *top* is the riding surface itself (GroundSurface.height), so the
// street ribbons drawn over it carry road paint across the bridge. This module
// adds what is under and beside the top: side faces (fascia over water,
// abutment walls buried into the relief over land), parapets, soffits, and
// for masonry arches a vault down toward the water.

import earcut from 'earcut';
import { densify, drapeTriangles, emptyMesh, vertex, type MeshArrays } from './drape.js';
import type { DeckSurface, HeightFn, Vec2 } from './surface.js';

type RGB = [number, number, number];
const hex = (h: string): RGB => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };

const FAMILY: Record<string, { thickness: number; fascia: RGB; parapet: RGB }> = {
  'masonry-arch': { thickness: 0.6, fascia: hex('#8a5541'), parapet: hex('#97614b') },
  'concrete-deck': { thickness: 0.45, fascia: hex('#a7a29a'), parapet: hex('#b4afa6') },
  'steel-deck': { thickness: 0.35, fascia: hex('#4f5d57'), parapet: hex('#3e4a45') },
  'wooden-deck': { thickness: 0.3, fascia: hex('#7a5a3c'), parapet: hex('#6a4c32') },
};
export const DECK_TOP: RGB = hex('#8e8a84');
const SOFFIT: RGB = hex('#4d4843');
const ABUTMENT: RGB = hex('#7b5a4a');
const PARAPET_H = 0.55, PARAPET_T = 0.22, BURY = 0.4;

/** Is (x, y) over water? (signed mask distance < 0) */
export type WaterTest = (x: number, y: number) => boolean;

function quad(m: MeshArrays, a: number, b: number, c: number, d: number): void { m.indices.push(a, b, c, a, c, d); }

/**
 * One measured deck. `ground` is the relief without decks (for burying the
 * abutment walls), `waterZ` the canal level.
 */
export function measuredDeckBody(deck: DeckSurface, ground: HeightFn, overWater: WaterTest, waterZ: number): MeshArrays {
  const m = emptyMesh(true), p = deck.profile, fam = FAMILY[p.family] ?? FAMILY['concrete-deck'];
  const idx: number[] = [];
  for (let i = 0; i < p.s.length; i++) if (p.s[i] >= p.deck[0] - 0.5 && p.s[i] <= p.deck[1] + 0.5) idx.push(i);
  if (idx.length < 2) return m;
  let arch: { s0: number; s1: number; spring: number; crown: number } | null = null;
  if (p.family === 'masonry-arch' && p.water) {
    const s0 = p.water[0] + 0.3, s1 = p.water[1] - 0.3, mid = (s0 + s1) / 2;
    const iMid = p.s.findIndex(s => s >= mid);
    const crown = (iMid >= 0 ? deck.z[iMid] : 0) - fam.thickness - 0.15, spring = waterZ + 0.35;
    if (s1 - s0 > 1.5 && crown - spring > 0.5) arch = { s0, s1, spring, crown };
  }
  const archZ = (s: number) => {
    if (!arch || s <= arch.s0 || s >= arch.s1) return null;
    const u = (s - (arch.s0 + arch.s1) / 2) / ((arch.s1 - arch.s0) / 2);
    return arch.spring + (arch.crown - arch.spring) * Math.sqrt(Math.max(0, 1 - u * u));
  };
  const onDeck = (s: number) => s >= p.deck[0] && s <= p.deck[1];
  type Row = { L: Vec2; R: Vec2; Li: Vec2; Ri: Vec2; z: number; bottomL: number; bottomR: number; water: boolean; parapet: boolean };
  const rows: Row[] = idx.map(i => {
    const a = Math.max(0, i - 1), b = Math.min(p.s.length - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l, hw = p.halfWidth[i];
    const L: Vec2 = [p.x[i] + nx * hw, p.y[i] + ny * hw], R: Vec2 = [p.x[i] - nx * hw, p.y[i] - ny * hw];
    const Li: Vec2 = [L[0] - nx * PARAPET_T, L[1] - ny * PARAPET_T], Ri: Vec2 = [R[0] + nx * PARAPET_T, R[1] + ny * PARAPET_T];
    const z = deck.z[i], water = overWater(p.x[i], p.y[i]);
    const under = archZ(p.s[i]) ?? z - fam.thickness;
    const bottom = (q: Vec2) => (overWater(q[0], q[1]) ? under : Math.min(ground(q[0], q[1]), z) - BURY);
    return { L, R, Li, Ri, z, bottomL: bottom(L), bottomR: bottom(R), water, parapet: onDeck(p.s[i]) };
  });
  for (let k = 0; k + 1 < rows.length; k++) {
    const a = rows[k], b = rows[k + 1];
    const topA = a.parapet ? a.z + PARAPET_H : a.z, topB = b.parapet ? b.z + PARAPET_H : b.z;
    const colour = (w: boolean) => (w ? fam.fascia : ABUTMENT);
    // Left side faces left (outward), right side faces right.
    {
      const c = colour(a.water || b.water);
      const t0 = vertex(m, a.L[0], a.L[1], topA, c), t1 = vertex(m, b.L[0], b.L[1], topB, c), b1 = vertex(m, b.L[0], b.L[1], b.bottomL, c), b0 = vertex(m, a.L[0], a.L[1], a.bottomL, c);
      quad(m, t0, t1, b1, b0);
      const u0 = vertex(m, a.R[0], a.R[1], topA, c), u1 = vertex(m, b.R[0], b.R[1], topB, c), d1 = vertex(m, b.R[0], b.R[1], b.bottomR, c), d0 = vertex(m, a.R[0], a.R[1], a.bottomR, c);
      quad(m, u0, d0, d1, u1);
    }
    if (a.parapet && b.parapet) {
      const c = fam.parapet;
      // Parapet tops and inner faces.
      for (const [o, i, faceLeft] of [[[a.L, b.L], [a.Li, b.Li], false], [[a.R, b.R], [a.Ri, b.Ri], true]] as [[Vec2, Vec2], [Vec2, Vec2], boolean][]) {
        const ot0 = vertex(m, o[0][0], o[0][1], a.z + PARAPET_H, c), ot1 = vertex(m, o[1][0], o[1][1], b.z + PARAPET_H, c);
        const it0 = vertex(m, i[0][0], i[0][1], a.z + PARAPET_H, c), it1 = vertex(m, i[1][0], i[1][1], b.z + PARAPET_H, c);
        const ib0 = vertex(m, i[0][0], i[0][1], a.z, c), ib1 = vertex(m, i[1][0], i[1][1], b.z, c);
        if (faceLeft) { quad(m, ot0, ot1, it1, it0); quad(m, it0, it1, ib1, ib0); } else { quad(m, ot0, it0, it1, ot1); quad(m, it0, ib0, ib1, it1); }
      }
    }
    if (a.water && b.water) {
      // Soffit / vault facing down.
      const zA = archZ(p.s[idx[k]]) ?? a.z - fam.thickness, zB = archZ(p.s[idx[k + 1]]) ?? b.z - fam.thickness;
      const s0 = vertex(m, a.L[0], a.L[1], zA, SOFFIT), s1 = vertex(m, a.R[0], a.R[1], zA, SOFFIT), s2 = vertex(m, b.R[0], b.R[1], zB, SOFFIT), s3 = vertex(m, b.L[0], b.L[1], zB, SOFFIT);
      quad(m, s0, s3, s2, s1);
    }
  }
  return m;
}

/** An unmeasured footprint (CCW ring, scene coords): top draped on the surface, fascia and soffit over water. */
export function flatDeckBody(ring: readonly Vec2[], height: HeightFn, overWater: WaterTest, topLift = 0.02, thickness = 0.45): { top: MeshArrays; body: MeshArrays } {
  const top = emptyMesh(true), body = emptyMesh(true);
  const flat = ring.flatMap(p => [p[0], p[1]]);
  const tris = earcut(flat);
  drapeTriangles(top, flat, tris, height, topLift, 3, DECK_TOP);
  // Soffit: same triangles, reversed, a deck thickness down.
  const under = emptyMesh(true);
  drapeTriangles(under, flat, tris, height, topLift - thickness, 3, SOFFIT);
  for (let i = 0; i < under.indices.length; i += 3) [under.indices[i + 1], under.indices[i + 2]] = [under.indices[i + 2], under.indices[i + 1]];
  const base = body.positions.length / 3;
  body.positions.push(...under.positions); body.uvs.push(...under.uvs); body.colors!.push(...under.colors!);
  for (const i of under.indices) body.indices.push(i + base);
  const closed = [...ring, ring[0]];
  const pts = densify(closed, 1);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (!overWater(mx, my)) continue;
    const ha = height(a[0], a[1]) + topLift, hb = height(b[0], b[1]) + topLift, c = ABUTMENT.map(v => v * 0.8) as RGB;
    const t0 = vertex(body, a[0], a[1], ha, c), t1 = vertex(body, b[0], b[1], hb, c), b1 = vertex(body, b[0], b[1], hb - thickness, c), b0 = vertex(body, a[0], a[1], ha - thickness, c);
    // CCW ring: outward is the right of a→b.
    quad(body, t0, b0, b1, t1);
  }
  return { top, body };
}
