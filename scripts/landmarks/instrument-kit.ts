import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {memorialFrame} from './memorial-frame';

type Colour = Parameters<BuildingTools['add']>[1];
type Frame = ReturnType<typeof memorialFrame>;

/**
 * A double bass as a body with neck and scroll (local frame of the monument). The instrument is built upright in its own frame
 * (y along the axis from the end pin, +z the front plate with the strings, +x its left) and tilted by `lean` (towards -z, the
 * player) and `side` (towards +x) about the end pin, which stands at `pin`. `fingerY` is a height up the neck; `fingerPoint`
 * returns where a hand placed there lies, so a figure's hand can be matched to the fingerboard.
 */
export const bassMatrix = (pin: T.Vector3, o: {lean: number; side: number; scale?: number}) => {
  const s = o.scale ?? 1;
  return new T.Matrix4().makeTranslation(pin.x, pin.y, pin.z)
    .multiply(new T.Matrix4().makeRotationZ(-o.side)).multiply(new T.Matrix4().makeRotationX(-o.lean)).multiply(new T.Matrix4().makeScale(s, s, s));
};
/** Where a point `y` up the fingerboard lies for a bass whose end pin stands at `pin`. */
export const bassNeckPoint = (pin: T.Vector3, o: {lean: number; side: number; scale?: number}, y: number) => new T.Vector3(0, y, 0.09).applyMatrix4(bassMatrix(pin, o));

export function doubleBass(f: Frame, pin: T.Vector3, o: {lean: number; side: number; scale?: number; colour: Colour}) {
  const c = o.colour;
  const m = bassMatrix(pin, o);
  const put = (g: T.BufferGeometry) => { g.applyMatrix4(m); f.put(g, 0, 0, 0, c); };
  const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number, seg = 12) => { const g = new T.SphereGeometry(1, seg, 8); g.scale(rx, ry, rz); g.translate(x, y, z); put(g); };
  const bx = (w: number, h: number, d: number, x: number, y: number, z: number, rotX = 0) => { const g = new T.BoxGeometry(w, h, d); if (rotX) g.rotateX(rotX); g.translate(x, y, z); put(g); };
  // body: lower bout, waist, upper bout (rib depth 0.2 m, flat plate, sloping shoulders)
  ell(0.31, 0.33, 0.1, 0, 0.46, 0, 14);
  ell(0.19, 0.11, 0.095, 0, 0.84, 0);
  ell(0.235, 0.2, 0.097, 0, 1.0, 0, 14);
  // end pin, tailpiece, bridge, f-hole shadows as thin raised slots
  { const g = new T.CylinderGeometry(0.008, 0.006, 0.22, 5); g.translate(0, 0.0, 0); put(g); }
  bx(0.1, 0.34, 0.02, 0, 0.3, 0.105);
  bx(0.17, 0.02, 0.03, 0, 0.7, 0.115);
  for (const sx of [-1, 1]) bx(0.014, 0.17, 0.012, sx * 0.1, 0.72, 0.1, 0.12 * sx);
  // neck and fingerboard
  bx(0.05, 0.62, 0.06, 0, 1.4, 0.0);
  bx(0.07, 1.0, 0.026, 0, 1.38, 0.058);
  // pegbox, scroll, tuners
  bx(0.06, 0.22, 0.06, 0, 1.95, -0.005);
  { const g = new T.TorusGeometry(0.046, 0.02, 5, 9); g.rotateY(Math.PI / 2); g.translate(0, 2.1, -0.02); put(g); }
  ell(0.022, 0.05, 0.03, 0, 2.06, 0.0, 6);
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) bx(0.07, 0.016, 0.02, sx * 0.05, 1.9 + k * 0.07, -0.015);
}

/** A piano accordion held at the chest: two end boxes, bellows folds, a keyboard box and a grill; `turn` rotates it about y, `tilt` about x. */
export function accordion(f: Frame, at: T.Vector3, o: {width?: number; height?: number; depth?: number; turn?: number; tilt?: number; roll?: number; folds?: number; colour: Colour}) {
  const w = o.width ?? 0.5, h = o.height ?? 0.5, d = o.depth ?? 0.2, n = o.folds ?? 7, c = o.colour;
  const m = new T.Matrix4().makeTranslation(at.x, at.y, at.z).multiply(new T.Matrix4().makeRotationY(o.turn ?? 0)).multiply(new T.Matrix4().makeRotationX(o.tilt ?? 0)).multiply(new T.Matrix4().makeRotationZ(o.roll ?? 0));
  const put = (g: T.BufferGeometry) => { g.applyMatrix4(m); f.put(g, 0, 0, 0, c); };
  const bx = (bw: number, bh: number, bd: number, x: number, y: number, z: number) => { const g = new T.BoxGeometry(bw, bh, bd); g.translate(x, y, z); put(g); };
  const endW = w * 0.2, bell = w - endW * 2;
  bx(endW, h, d, -w / 2 + endW / 2, 0, 0); bx(endW, h, d, w / 2 - endW / 2, 0, 0);       // keyboard end and bass end
  bx(endW * 0.9, h * 0.94, d * 0.55, -w / 2 + endW * 0.45, 0, d * 0.5);                 // key bank on the front
  bx(endW * 0.9, h * 0.6, d * 0.2, w / 2 - endW * 0.45, 0, d * 0.54);                    // grill
  for (let i = 0; i < n; i++) bx(bell / n * 0.82, h * (0.93 - (i % 2) * 0.07), d * (0.88 - (i % 2) * 0.1), -bell / 2 + (i + 0.5) * bell / n, 0, 0);
}
