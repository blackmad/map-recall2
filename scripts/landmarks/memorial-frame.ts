import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {letterBoxes, placeFigure, type Pose, type Joints} from './figure-kit';

type Colour = Parameters<BuildingTools['add']>[1];

/**
 * Shared local-frame helpers for the memorial builders. A builder authors in a local frame whose +z is the monument's front
 * (the way it faces) and +x its left; `facingDeg` is the front's compass bearing (clockwise from north), the model frame being
 * x east, z south, y up. Every call rotates into the model frame, so builders never think about bearings.
 */
export function memorialFrame(b: BuildingTools, facingDeg: number) {
  const yaw = Math.PI - facingDeg * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
  const put = (g: T.BufferGeometry, x: number, y: number, z: number, colour: Colour) => {
    g.rotateY(yaw);
    b.add(g, colour, x * c + z * s, y, -x * s + z * c);
  };
  /** Box standing on y, centred on x/z (local frame), optionally turned about y. */
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, colour: Colour, turn = 0) => {
    const g = new T.BoxGeometry(w, h, d); if (turn) g.rotateY(turn); put(g, x, y + h / 2, z, colour);
  };
  const ball = (x: number, y: number, z: number, rx: number, ry: number, rz: number, colour: Colour, seg = 10) => {
    const g = new T.SphereGeometry(1, seg, Math.max(5, seg - 3)); g.scale(rx, ry, rz); put(g, x, y, z, colour);
  };
  /** Tapered rod from a to b: radius r0 at a, r1 at b. */
  const limb = (a: number[], d: number[], r0: number, r1: number, colour: Colour, seg = 7) => {
    const from = new T.Vector3(...a), to = new T.Vector3(...d), v = to.clone().sub(from), g = new T.CylinderGeometry(r1, r0, v.length(), seg, 1);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.clone().normalize()));
    const m = from.clone().add(to).multiplyScalar(0.5);
    put(g, m.x, m.y, m.z, colour);
  };
  /** Raised lettering (closed stroke boxes) on a face: `face` is the outward normal (+z front, +x left, -x right, -z back); 'up' lays text on a horizontal surface, readable from +z. */
  const lettering = (text: string, heightM: number, maxW: number, x: number, y: number, z: number, face: 'front' | 'left' | 'right' | 'back' | 'up', colour: Colour, depth = 0.03) => {
    const turn = {front: 0, left: Math.PI / 2, right: -Math.PI / 2, back: Math.PI, up: 0}[face];
    for (const g of letterBoxes(text, heightM, maxW, depth)) { if (face === 'up') g.rotateX(-Math.PI / 2); else g.rotateY(turn); put(g, x, y, z, colour); }
  };
  /** A figure in the local frame (feet/seat origin at x,y,z, turned `turn` from the monument's front); joints come back in the LOCAL frame. */
  const figure = (pose: Pose, x: number, y: number, z: number, colour: Colour, accent: Colour = colour, turn = 0) => {
    const j = placeFigure(b, pose, {x: x * c + z * s, y, z: -x * s + z * c, yaw: yaw + turn}, colour, accent);
    const inv = new T.Matrix4().makeRotationY(-yaw);
    const loc = (v: T.Vector3) => v.clone().applyMatrix4(inv);
    return {tris: j.tris, joints: {pelvis: loc(j.pelvis), neck: loc(j.neck), head: loc(j.head), handL: loc(j.handL), handR: loc(j.handR), elbowL: loc(j.elbowL), elbowR: loc(j.elbowR), footL: loc(j.footL), footR: loc(j.footR), kneeL: loc(j.kneeL), kneeR: loc(j.kneeR)} as Record<string, T.Vector3>, raw: j as Joints};
  };
  return {yaw, put, box, ball, limb, lettering, figure};
}
