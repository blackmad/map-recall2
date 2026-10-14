import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {POSES} from './figure-kit';
import {headOnFigure} from './bust-kit';
import {dressFigure} from './clothing-kit';

/**
 * Spanjemonument (Amsterdam-Noord; the memorial to the Dutch volunteers of the Spanish Civil War, 1936-1939): a slender stainless-steel ribbon
 * rising about 5 m from a round steel foot in an S-curve, and over its tip two bronze figures flying horizontally, one close behind and above the
 * other, arms stretched forward, head up (the Eddy Roos photograph shows them level with the steel stem's end, the 2019 panorama from the south-east
 * shows the pair seen from the front). The stem stands in a circle of brick paving about 6 m across where pigeons gather. A little way off a
 * low brick wall carries a pink granite plaque lettered 1936-1939 NO PASARAN with a text under it.
 * Source photos: Wikimedia Commons "2021 Spanjemonument-beeld (1)(2)(3)" and "-plaquette (1)" (Ceescamel, CC BY-SA 4.0) and "Spanje monument groot"
 * (Eddy Roos, CC BY-SA 4.0); Gemeente Amsterdam panorama TMX7316010203-001303_pano_0002_000532 (CC BY 4.0, 2019), 5 m away.
 * Local frame: +z is the flight direction (the heads), +x the left of the figures. FACING 235 (towards SW) is read from that panorama, where the figures'
 * arms point to the left of a view looking WNW: +-30. The wall and plaque position is an estimate (ahead of the flight, about 3.7 m), the plaque wording
 * is the one line the photo shows, the text under it is not legible and is left a blank plate. Height 5.4 m is scaled off the trees (about 11 m) behind.
 */
const FACING = 235;

export function buildSpanjemonument(_w: number, _d: number, b: BuildingTools) {
  const fr = memorialFrame(b, FACING);
  const {put, box, lettering, figure} = fr;
  // ---- brick paving circle and a steel foot
  const disc = (r: number, h: number, colour: 'greyBrick' | 'frame') => { const g = new T.CylinderGeometry(r, r, h, 32); put(g, 0, h / 2, 0, colour); };
  disc(3.0, 0.04, 'greyBrick'); disc(0.55, 0.09, 'frame');
  // ---- stem: a flat steel ribbon in an S-curve (a squashed tube along a smooth curve)
  const curve = new T.CatmullRomCurve3([[0, 0.05, 0], [0, 1.1, -0.18], [0, 2.3, 0.12], [0, 3.5, -0.24], [0, 4.6, -0.3], [0, 5.42, -0.34]].map(([x, y, z]) => new T.Vector3(x, y, z)));
  const tube = new T.TubeGeometry(curve, 18, 0.11, 6, false);
  tube.scale(0.45, 1, 1.0);                                   // thin across the flight, deeper along it: a ribbon
  put(tube, 0, 0, 0, 'frame');
  // ---- two flying bronzes: the torso leans fully forward, legs trail back, arms reach forward past the head
  const fly = (x: number, y: number, z: number, roll: number, armAsym: number) => {
    const pose = POSES.standing();
    pose.height = 1.7; pose.lean = 1.5; pose.bendSide = roll; pose.stout = 0.95;
    pose.legs = {l: {pitch: -1.42, roll: 0.06, bend: 0.1}, r: {pitch: -1.5, roll: -0.06, bend: 0.25}};
    pose.arms = {l: {pitch: 2.95, roll: 0.12, bend: 0.1}, r: {pitch: 3.0 - armAsym, roll: 0.15, bend: 0.12}};
    pose.head = {pitch: -1.15};
    const f = figure(pose, x, y, z, 'bronze');
    dressFigure(fr, f, {height: 1.7, colour: 'bronze', sleeve: 0.9, trouser: 0.9, chest: 0.95});
    headOnFigure(fr, f, {sex: 'm', hair: 'short', colour: 'bronze', scale: 1.0});
    return f;
  };
  fly(0, 5.2, -0.62, 0.0, 0.0);
  fly(0.28, 5.72, -1.1, 0.25, 0.4);
  // ---- brick wall with the pink granite plaque, ahead of the flight
  const WZ = 3.9, FACE = WZ - 0.225;
  box(0, 0, WZ, 2.6, 1.15, 0.45, 'brick');
  box(0, 0.5, FACE - 0.025, 1.9, 0.5, 0.04, 'pink');
  lettering('1936-1939 NO PASARAN', 0.07, 1.5, 0, 0.88, FACE - 0.047, 'back', 'white', 0.012);
}
