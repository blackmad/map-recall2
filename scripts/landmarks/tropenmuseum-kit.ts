import * as T from 'three';
import {barQuad, drawOpening, type PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {recess} from '../../src/canalRecall/blockBuilding/components';
import type {WinParams} from '../../src/canalRecall/blockBuilding/spec';

/** Hand-modelling helpers drawn in a wall panel's own frame (u along the wall, v up, d out of the wall), after the Hoofdbureau builder. */
export interface KitStats {openings: number; failed: string[]; drawn: string[]}
export const BAR = 0.04;
export const STONE = 'stone', FRAME = 'frame', GLASS = 'glass', DARK = 'door', WALL = 'wall';
/** wrought iron: a slot the opening audit reads as host trim (an isolated 'dark' part counts as a detached opening assembly) */
export const IRON = 'cross';

/** A closed box (the compile sets closedBoxes, so PanelCtx.box already closes its back). */
export function solid(c: PanelCtx, slot: string, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number, part = c.part()) {
  c.box(slot, u0, u1, v0, v1, d0, d1, part);
  return part;
}

/** A three.js geometry built in the wall's frame (x along u, y = v, z = d) placed at (u, v, d); the winding is kept. */
export function geom(c: PanelCtx, slot: string, g: T.BufferGeometry, u: number, v: number, d: number, part = c.part()) {
  const src = g.index ? g.toNonIndexed() : g, a = src.getAttribute('position');
  for (let i = 0; i < a.count; i += 3) {
    const q = [0, 1, 2].map(k => c.P(u + a.getX(i + k), v + a.getY(i + k), d + a.getZ(i + k)));
    c.mesh.tri(slot, q[0], q[1], q[2], part);
  }
  return part;
}
export const extrude = (shape: T.Shape, depth: number, curveSegments = 8) => new T.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments});
export const shapeOf = (pts: [number, number][], holes: [number, number][][] = []) => {
  const s = new T.Shape(pts.map(q => new T.Vector2(q[0], q[1])));
  for (const h of holes) s.holes.push(new T.Path(h.map(q => new T.Vector2(q[0], q[1]))));
  return s;
};
/** Polygon points of a segmental or round arch head: springing at v = spring, chord u0..u1, rise `rise` (half the chord = round). */
export function archHead(u0: number, u1: number, spring: number, rise: number, seg = 8): [number, number][] {
  const half = (u1 - u0) / 2, cx = (u0 + u1) / 2, r = (half * half + rise * rise) / (2 * rise), cy = spring + rise - r;
  const aR = Math.atan2(spring - cy, half), aL = Math.PI - aR, pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) { const a = aL + (aR - aL) * i / seg; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts; // left to right
}
/** An arch ring (stone hood): outer and inner arcs over the chord, thickness t, a closed prism `depth` out of the wall. */
export function archRing(c: PanelCtx, slot: string, u0: number, u1: number, spring: number, rise: number, t: number, depth: number, d0 = 0, seg = 8) {
  const outer = archHead(u0 - t, u1 + t, spring, rise + t, seg), inner = archHead(u0, u1, spring, rise, seg);
  const ring: [number, number][] = [...outer, ...[...inner].reverse()];
  return geom(c, slot, extrude(shapeOf(ring), depth), 0, 0, d0);
}
/** A measured window cut into the wall (recess, glass back, frame ring, bars BAR in front of the glass). */
export function opening(c: PanelCtx, stats: KitStats, what: string, u0: number, u1: number, v0: number, v1: number, w: WinParams) {
  const back = drawOpening(c, u0, u1, v0, v1, {frameW: 0.05, sillSlot: null, headSlot: null, barD: BAR, ...w}, 1);
  if (back === null || back > 0) stats.failed.push(`${what}${back === null ? '' : ' (proud, not cut)'} u ${u0.toFixed(2)}..${u1.toFixed(2)} v ${v0.toFixed(2)}..${v1.toFixed(2)}`); else stats.openings++;
  return back;
}
/** A deep cut into the wall (door, void): reveals in the wall slot and a back plane in `backSlot`. */
export function deepRecess(c: PanelCtx, stats: KitStats, what: string, u0: number, u1: number, v0: number, v1: number, depth: number, backSlot: string) {
  const a = Math.max(u0, c.p.uMin + 0.05), b = Math.min(u1, c.p.uMax - 0.05);
  const r = recess(c, a, b, v0, v1, depth, backSlot);
  if (!r) stats.failed.push(`${what} recess u ${a.toFixed(2)}..${b.toFixed(2)} v ${v0}..${v1}`); else stats.drawn.push(what);
  return r ? {...r, u0: a, u1: b} : null;
}
export {barQuad};

/** Wrought-iron tie-rod anchor (sieranker): a thin stem with a diamond, `h` tall, standing on the wall (the side leaves and crown are below gallery-pixel size). */
export function anchorIron(c: PanelCtx, u: number, v0: number, h: number, part = c.part()) {
  geom(c, IRON, new T.BoxGeometry(0.05, h, 0.1), u, v0 + h / 2, 0.05, part);
  geom(c, IRON, new T.BoxGeometry(0.26, 0.26, 0.05).rotateZ(Math.PI / 4), u, v0 + h * 0.75, 0.085, part);
}
/** Round ornamental ring (oculus surround): stone ring with a glass disc and `bosses` cartouche blocks. */
export function oculus(c: PanelCtx, u: number, v: number, outer: number, glass: number, bosses = 8) {
  const ringS = new T.Shape(); ringS.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new T.Path(); hole.absarc(0, 0, glass + 0.08, 0, Math.PI * 2, true); ringS.holes.push(hole);
  const part = c.part();
  geom(c, STONE, extrude(ringS, 0.14, 10), u, v, 0.02, part);
  const disc = new T.Shape(); disc.absarc(0, 0, glass + 0.08, 0, Math.PI * 2, false);
  geom(c, GLASS, extrude(disc, 0.04, 8), u, v, 0.02, part);
  for (let i = 0; i < bosses; i++) { const a = i * Math.PI * 2 / bosses + 0.2; geom(c, STONE, new T.BoxGeometry(0.16, 0.16, 0.1).rotateZ(a), u + Math.cos(a) * (outer - 0.1), v + Math.sin(a) * (outer - 0.1), 0.16, part); }
  for (const a of [0, Math.PI / 2]) geom(c, FRAME, new T.BoxGeometry(2 * glass, 0.04, 0.05).rotateZ(a), u, v, 0.1, part);
}
/** Standing figure (robe, chest, arms, head) on a pedestal top at v, `h` tall. */
export function figure(c: PanelCtx, slot: string, u: number, v: number, d: number, h: number, wide = 1) {
  const k = h / 2.25, part = c.part();
  geom(c, slot, new T.CylinderGeometry(0.22 * k * wide, 0.27 * k * wide, 1.2 * k, 6), u, v + 0.6 * k, d, part);
  geom(c, slot, new T.CylinderGeometry(0.29 * k * wide, 0.22 * k * wide, 0.55 * k, 6), u, v + 1.47 * k, d, part);
  for (const side of [-1, 1]) geom(c, slot, new T.BoxGeometry(0.12 * k, 0.8 * k, 0.14 * k), u + side * 0.32 * k * wide, v + 1.25 * k, d + 0.02, part);
  geom(c, slot, new T.SphereGeometry(0.16 * k, 6, 4), u, v + 2.0 * k, d, part);
  return part;
}
/** Reclining figure (tympanum): body along u, raised head and knees. */
export function reclining(c: PanelCtx, slot: string, u: number, v: number, d: number, len: number, flip = 1) {
  const part = c.part(), k = len / 1.2;
  geom(c, slot, new T.CylinderGeometry(0.13 * k, 0.15 * k, len * 0.8, 6).rotateZ(Math.PI / 2), u, v + 0.15 * k, d, part);
  geom(c, slot, new T.SphereGeometry(0.13 * k, 6, 4), u - flip * len * 0.42, v + 0.4 * k, d, part);
  geom(c, slot, new T.CylinderGeometry(0.08 * k, 0.09 * k, 0.55 * k, 6).rotateZ(Math.PI / 3 * flip), u + flip * len * 0.3, v + 0.38 * k, d, part);
  return part;
}

/**
 * A window applied to a wall face the host does not carry (a bespoke slab, see tropenmuseum-block.ts): a glass box, head and sill bars,
 * and a mullion and transom standing 5 cm clear of the glass face (no two same-facing faces within 3 cm: the audit's z-fight gate). A glass face more than 8 cm proud reads as an overhanging assembly, so it stays at 4 cm.
 * About 60 triangles; not cut into the wall, so it cannot fail to fit.
 */
export function proudWindow(c: PanelCtx, u0: number, u1: number, v0: number, v1: number, mulls: number | boolean = 1, rows = true, part = c.part(), d0 = 0) {
  solid(c, GLASS, u0, u1, v0, v1, d0, d0 + 0.04, part);
  solid(c, FRAME, u0 - 0.05, u1 + 0.05, v0 - 0.06, v0, d0, d0 + 0.09, part);
  solid(c, FRAME, u0 - 0.05, u1 + 0.05, v1, v1 + 0.06, d0, d0 + 0.09, part);
  const nm = mulls === true ? 1 : mulls === false ? 0 : mulls;
  for (let i = 1; i <= nm; i++) { const u = u0 + (u1 - u0) * i / (nm + 1); solid(c, FRAME, u - 0.025, u + 0.025, v0, v1, d0 + 0.04, d0 + 0.09, part); }
  if (rows) solid(c, FRAME, u0, u1, (v0 + v1) / 2 - 0.025, (v0 + v1) / 2 + 0.025, d0 + 0.04, d0 + 0.09, part);
  return part;
}
