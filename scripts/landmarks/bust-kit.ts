import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {memorialFrame} from './memorial-frame';

type Colour = Parameters<BuildingTools['add']>[1];
type Frame = ReturnType<typeof memorialFrame>;

export interface BustOptions {
  /** Base centre of the cut chest (local frame, y = underside of the bust). */
  x: number; y: number; z: number;
  /** Uniform scale; 1 gives a 0.68 m bust (base to crown). */
  scale?: number;
  /** Turn of the whole bust about y relative to the monument front (radians). */
  turn?: number;
  sex?: 'm' | 'f';
  bow?: boolean; glasses?: boolean; collar?: boolean;
  /** Hair: 'short', 'wave' (curled to the nape and ears), 'bald'. */
  hair?: 'short' | 'wave' | 'bald';
  colour: Colour;
}

/**
 * A portrait bust in a cut-off chest: an elliptical torso that widens to the shoulders, a deltoid stump on each side, a neck, a head
 * with brow, nose, ears and chin, hair, and (per bust) glasses, bow tie, lapels. Closed overlapping solids, never coplanar. The
 * torso, shoulders and neck make it read as a person from every side.
 */
export function bust(f: Frame, o: BustOptions) {
  const {put} = f;
  const s = o.scale ?? 1, c = o.colour, turn = o.turn ?? 0;
  const woman = o.sex === 'f';
  const add = (g: T.BufferGeometry, x: number, y: number, z: number) => { g.scale(s, s, s); g.translate(x * s, y * s, z * s); g.rotateY(turn); put(g, o.x, o.y, o.z, c); };
  const sph = (rx: number, ry: number, rz: number, x: number, y: number, z: number, seg = 10) => { const g = new T.SphereGeometry(1, seg, Math.max(5, seg - 3)); g.scale(rx, ry, rz); add(g, x, y, z); };
  const cyl = (r0: number, r1: number, h: number, zs: number, x: number, y: number, z: number, seg = 14) => { const g = new T.CylinderGeometry(r1, r0, h, seg, 1); g.scale(1, 1, zs); add(g, x, y + h / 2, z); };
  const bx = (w: number, h: number, d: number, x: number, y: number, z: number, rotZ = 0) => { const g = new T.BoxGeometry(w, h, d); if (rotZ) g.rotateZ(rotZ); add(g, x, y, z); };
  const rod = (a: number[], b: number[], r: number) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...b), v = to.clone().sub(from), g = new T.CylinderGeometry(r, r, v.length(), 5, 1);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
    const m = from.clone().add(to).multiplyScalar(0.5);
    add(g, m.x, m.y, m.z);
  };
  // torso: wider at the shoulders; deltoid stumps either side
  cyl(woman ? 0.17 : 0.2, woman ? 0.2 : 0.25, 0.34, 0.56, 0, 0, 0, 16);
  sph(woman ? 0.215 : 0.265, 0.075, 0.15, 0, 0.335, 0, 14);
  for (const sx of [-1, 1]) sph(0.075, 0.12, 0.095, sx * (woman ? 0.2 : 0.25), 0.27, 0, 8);
  // neck and head
  cyl(0.066, 0.06, 0.12, 1, 0, 0.35, 0.005, 10);
  const hy = 0.56;
  sph(0.092, 0.118, 0.105, 0, hy, 0.012, 12);
  sph(0.05, 0.04, 0.045, 0, hy - 0.095, 0.05, 8);
  bx(0.024, 0.045, 0.034, 0, hy - 0.015, 0.112);
  bx(0.145, 0.016, 0.03, 0, hy + 0.034, 0.095);
  for (const sx of [-1, 1]) sph(0.012, 0.03, 0.02, sx * 0.094, hy - 0.01, 0, 6);
  if (o.glasses) {
    for (const sx of [-1, 1]) bx(0.058, 0.045, 0.014, sx * 0.04, hy + 0.012, 0.108);
    bx(0.03, 0.01, 0.014, 0, hy + 0.025, 0.108);
  }
  const hair = o.hair ?? (woman ? 'wave' : 'short');
  if (hair !== 'bald') {
    sph(0.098, 0.082, 0.112, 0, hy + 0.05, -0.005, 10);
    if (hair === 'wave') {
      for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) sph(0.03, 0.04, 0.05, sx * (0.098 - k * 0.006), hy - 0.01 - k * 0.055, -0.01 - k * 0.012, 6);
      sph(0.09, 0.09, 0.06, 0, hy - 0.01, -0.08, 8);
    } else sph(0.094, 0.085, 0.07, 0, hy - 0.005, -0.07, 8);
  }
  if (!woman) {
    for (const sx of [-1, 1]) rod([sx * 0.04, 0.34, 0.138], [sx * 0.12, 0.1, 0.14], 0.016);
    if (o.bow) {
      bx(0.035, 0.032, 0.022, -0.03, 0.335, 0.148, 0.2); bx(0.035, 0.032, 0.022, 0.03, 0.335, 0.148, -0.2); bx(0.02, 0.026, 0.026, 0, 0.335, 0.152);
    } else if (o.collar) {
      for (const sx of [-1, 1]) bx(0.06, 0.012, 0.045, sx * 0.04, 0.346, 0.12, sx * 0.5);
    }
  } else sph(0.1, 0.05, 0.04, 0, 0.3, 0.127, 8);
}

export interface HeadOptions {
  /** Head centre in the local frame. */
  x: number; y: number; z: number;
  /** Heading of the face in the local frame (radians, 0 faces +z, positive towards +x). */
  turn?: number; scale?: number;
  sex?: 'm' | 'f'; glasses?: boolean; hair?: 'short' | 'wave' | 'bald' | 'wild'; moustache?: boolean;
  colour: Colour;
}

/** A modelled head with brow, nose, ears, chin and hair, to put on a figure-kit body in place of the kit's pointed 6 x 3 sphere. */
export function portraitHead(f: Frame, o: HeadOptions) {
  const s = o.scale ?? 1, turn = o.turn ?? 0, woman = o.sex === 'f';
  const add = (g: T.BufferGeometry, x: number, y: number, z: number) => { g.scale(s, s, s); g.translate(x * s, y * s, z * s); g.rotateY(turn); f.put(g, o.x, o.y, o.z, o.colour); };
  const sph = (rx: number, ry: number, rz: number, x: number, y: number, z: number, seg = 10) => { const g = new T.SphereGeometry(1, seg, Math.max(5, seg - 3)); g.scale(rx, ry, rz); add(g, x, y, z); };
  const bx = (w: number, h: number, d: number, x: number, y: number, z: number) => add(new T.BoxGeometry(w, h, d), x, y, z);
  sph(0.092, 0.118, 0.105, 0, 0, 0.012, 12);
  sph(0.05, 0.04, 0.045, 0, -0.095, 0.05, 8);
  bx(0.024, 0.045, 0.034, 0, -0.015, 0.112);
  bx(0.145, 0.016, 0.03, 0, 0.034, 0.095);
  for (const sx of [-1, 1]) sph(0.012, 0.03, 0.02, sx * 0.094, -0.01, 0, 6);
  if (o.glasses) { for (const sx of [-1, 1]) bx(0.058, 0.045, 0.014, sx * 0.04, 0.012, 0.108); bx(0.03, 0.01, 0.014, 0, 0.025, 0.108); }
  if (o.moustache) bx(0.07, 0.014, 0.02, 0, -0.058, 0.108);
  const hair = o.hair ?? (woman ? 'wave' : 'short');
  if (hair !== 'bald') {
    sph(0.098, 0.082, 0.112, 0, 0.05, -0.005, 10);
    if (hair === 'wave') { for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) sph(0.03, 0.04, 0.05, sx * (0.098 - k * 0.006), -0.01 - k * 0.055, -0.01 - k * 0.012, 6); sph(0.09, 0.09, 0.06, 0, -0.01, -0.08, 8); }
    else if (hair === 'wild') { for (let k = 0; k < 5; k++) sph(0.04, 0.035, 0.04, (k - 2) * 0.045, 0.1 - Math.abs(k - 2) * 0.012, 0.02, 6); sph(0.094, 0.085, 0.07, 0, -0.005, -0.07, 8); }
    else sph(0.094, 0.085, 0.07, 0, -0.005, -0.07, 8);
  }
}

/** Put a portrait head on a figure placed through `f.figure`, facing where the figure's head frame faces. */
export function headOnFigure(f: Frame, fig: ReturnType<Frame['figure']>, o: Omit<HeadOptions, 'x' | 'y' | 'z' | 'turn'>) {
  const h = fig.joints.head;
  const dir = new T.Vector3(0, 0, 1).transformDirection(fig.raw.frameHead);
  const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
  const lx = dir.x * c + dir.z * s, lz = -dir.x * s + dir.z * c;
  const n = fig.joints.neck;
  f.limb([n.x, n.y - 0.03, n.z], [h.x, h.y - 0.05, h.z], 0.068, 0.058, o.colour, 8);                 // neck
  portraitHead(f, {...o, x: h.x, y: h.y, z: h.z, turn: Math.atan2(lx, lz)});
}
