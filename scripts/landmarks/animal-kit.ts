import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {memorialFrame} from './memorial-frame';

type Colour = Parameters<BuildingTools['add']>[1];
type Frame = ReturnType<typeof memorialFrame>;

/**
 * Small carved animals for the Kinderbrug groups, each a few distinct bodies (not one pile of spheres): a sitting squirrel (haunch, upright
 * chest, head with ears, forepaws, a tail curled up and forward over the back), a rabbit crouched with a rounded back, haunch and
 * two long ears, and a dove (breast, head, beak, folded wings, fanned tail). Authored in the animal's own frame (y up, +z the way it
 * looks) and placed at x, y, z in the monument's local frame, turned `turn` about y and scaled by `k`.
 */
function placer(f: Frame, x: number, y: number, z: number, turn: number, k: number, colour: Colour) {
  const m = new T.Matrix4().makeTranslation(x, y, z).multiply(new T.Matrix4().makeRotationY(turn)).multiply(new T.Matrix4().makeScale(k, k, k));
  const put = (g: T.BufferGeometry) => { g.applyMatrix4(m); f.put(g, 0, 0, 0, colour); };
  const ell = (rx: number, ry: number, rz: number, px: number, py: number, pz: number, rotX = 0, seg = 5) => {
    const g = new T.SphereGeometry(1, seg, Math.max(4, seg - 1)); g.scale(rx, ry, rz); if (rotX) g.rotateX(rotX); g.translate(px, py, pz); put(g);
  };
  const rod = (a: number[], b: number[], r0: number, r1: number, seg = 5) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...b), v = to.clone().sub(from);
    const g = new T.CylinderGeometry(r1, r0, v.length(), seg, 1, false);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
    const mid = from.clone().add(to).multiplyScalar(0.5); g.translate(mid.x, mid.y, mid.z); put(g);
  };
  const bx = (w: number, h: number, d: number, px: number, py: number, pz: number, rotX = 0) => { const g = new T.BoxGeometry(w, h, d); if (rotX) g.rotateX(rotX); g.translate(px, py, pz); put(g); };
  return {ell, rod, bx};
}

export function squirrel(f: Frame, x: number, y: number, z: number, o: {turn?: number; k?: number; colour: Colour}) {
  const {ell, rod, bx} = placer(f, x, y, z, o.turn ?? 0, o.k ?? 1, o.colour);
  ell(0.07, 0.065, 0.1, 0, 0.065, -0.03);                      // haunches on the slab
  ell(0.058, 0.09, 0.058, 0, 0.15, 0.02, -0.25);                // upright chest
  ell(0.044, 0.042, 0.05, 0, 0.255, 0.055);                    // head
  bx(0.03, 0.026, 0.04, 0, 0.243, 0.098);                      // muzzle
  bx(0.05, 0.03, 0.03, 0, 0.16, 0.09);                         // paws held to the chest
  for (const sx of [-1, 1]) bx(0.014, 0.036, 0.014, sx * 0.028, 0.3, 0.05, 0.2);   // tufted ears
  // tail: a fat plume rising behind, curling over and forward above the back
  for (const [ty, tz, r] of [[0.07, -0.12, 0.046], [0.17, -0.18, 0.052], [0.29, -0.15, 0.055], [0.37, -0.06, 0.046]]) ell(r * 0.85, r * 1.2, r * 1.1, 0, ty, tz);
}

export function rabbit(f: Frame, x: number, y: number, z: number, o: {turn?: number; k?: number; colour: Colour}) {
  const {ell, rod, bx} = placer(f, x, y, z, o.turn ?? 0, o.k ?? 1, o.colour);
  ell(0.1, 0.1, 0.14, 0, 0.1, -0.02);                          // rounded back
  ell(0.085, 0.085, 0.07, 0, 0.085, -0.1);                     // haunch
  ell(0.055, 0.06, 0.07, 0, 0.14, 0.13);                       // head
  bx(0.04, 0.035, 0.04, 0, 0.125, 0.185);                      // muzzle
  ell(0.022, 0.022, 0.022, 0, 0.1, -0.17, 0, 4);               // scut
  for (const sx of [-1, 1]) rod([sx * 0.03, 0.18, 0.115], [sx * 0.05, 0.37, 0.06], 0.026, 0.012, 4);   // two long ears laid back
  bx(0.09, 0.05, 0.03, 0, 0.03, 0.14);                          // forepaws
}

export function dove(f: Frame, x: number, y: number, z: number, o: {turn?: number; k?: number; colour: Colour}) {
  const {ell, bx} = placer(f, x, y, z, o.turn ?? 0, o.k ?? 1, o.colour);
  ell(0.045, 0.045, 0.085, 0, 0.045, 0, -0.35);                // plump breast and body
  ell(0.028, 0.03, 0.032, 0, 0.1, 0.07);                       // head
  bx(0.012, 0.012, 0.03, 0, 0.095, 0.108);                     // beak
  for (const sx of [-1, 1]) ell(0.012, 0.04, 0.07, sx * 0.043, 0.05, -0.02, -0.35);   // folded wings
  bx(0.05, 0.008, 0.07, 0, 0.02, -0.1, 0.3);                    // fanned tail
}
