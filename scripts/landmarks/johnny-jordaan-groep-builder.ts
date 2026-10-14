import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {bust, headOnFigure} from './bust-kit';
import {letterBoxes, POSES} from './figure-kit';

/**
 * The Johnny Jordaanplein group (Prinsengracht at the Elandsgracht; OSM nodes 1704741755 Johnny Jordaan, 11913325449 Tante Leen, 11913325451
 * Johnny Meijer): five bronzes on granite plinths in an arc facing a low semicircular concrete bench with wooden seats whose face carries the raised
 * bronze letters JOHNNY JORDAAN PLEIN. Seen from the bench, left to right: the double-bass player (a standing man, the bass in front of him, his left hand
 * on the neck), Tante Leen (bust on a pillar, curled short hair), Johnny Jordaan (bust on a pillar, thick glasses, bow tie), the accordionist Johnny Meijer
 * (seated on a bentwood chair on a bronze slab, accordion with bellows), and a man with an accordion and a woman standing behind and above him
 * (half-length, on the biggest block, a plaque with the Amsterdam crosses). Pillars carry the raised names and years in the Commons photos; the plaques on
 * the blocks are too small to read and are left as plain dark plates.
 * Source photos: Wikimedia Commons "Statues in Johnny Jordaanplein 01-03" (HJ Mitchell, CC BY 4.0) and "2024 Johnny Jordaanplein ..." (Ceescamel, CC0).
 * Local frame: +z is the way the figures face (towards the bench), +x left of the figures, which is the viewer's right at the bench. FACING 160 is an
 * estimate (+-20) from the 2016-2020 panoramas, where the bass and Tante Leen face the camera standing SSE of the group. Origin: the Johnny Jordaan pillar.
 * Plinth sizes and bronze heights are scaled off the Commons photos against the 0.45 m pillar and the 1.75 m figure standard: estimates.
 */
const FACING = 160;

export function buildJohnnyJordaanGroep(_w: number, _d: number, b: BuildingTools) {
  const fr0 = memorialFrame(b, FACING);
  const {put, box, ball, limb, figure} = fr0;
  // ---- bench: a concrete ring sector 0.6 m thick with wooden seats on the two outer thirds, lettering on the outer face
  const CZ = -0.3, RI = 3.7, RO = 4.3, A = 76 * Math.PI / 180;
  const ringSector = (a0: number, a1: number, r0: number, r1: number, y0: number, h: number, colour: 'concrete' | 'ochre' | 'greyBrick') => {
    const sh = new T.Shape(), n = 14;
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const x = r1 * Math.sin(a), z = CZ + r1 * Math.cos(a); if (i === 0) sh.moveTo(x, -z); else sh.lineTo(x, -z); }
    for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; sh.lineTo(r0 * Math.sin(a), -(CZ + r0 * Math.cos(a))); }
    const g = new T.ExtrudeGeometry(sh, {depth: h, bevelEnabled: false});
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    put(g, 0, 0, 0, colour);
  };
  ringSector(-A, A, RI, RO, 0, 0.52, 'concrete');
  const wood = (a0: number, a1: number) => ringSector(a0, a1, RI + 0.02, RO - 0.02, 0.5, 0.08, 'ochre');
  wood(-A + 0.04, -0.28); wood(0.28, A - 0.04);
  // raised bronze letters on three tangent faces of the outer wall
  for (const [word, deg, maxW] of [['JOHNNY', -30, 1.5], ['JORDAAN', 0, 1.9], ['PLEIN', 30, 1.35]] as [string, number, number][]) {
    const a = deg * Math.PI / 180;
    for (const g of letterBoxes(word, 0.3, maxW, 0.03)) {
      g.translate(0, 0, -0.004); g.rotateY(a);
      put(g, (RO) * Math.sin(a), 0.27, CZ + RO * Math.cos(a), 'gold');
    }
  }
  // ---- plinth helper: granite block (or pillar) with a dark plaque on the front
  const plinth = (x: number, z: number, w: number, d: number, h: number, plaque = true) => {
    box(x, 0, z, w, h, d, 'concrete');
    if (plaque) box(x, h * 0.4, z + d / 2 + 0.005, Math.min(0.42, w * 0.7), 0.22, 0.014, 'greyBrick');
  };
  const BRONZE = 'bronze' as const;
  // ---- 1. the double-bass player (left), on a 1.1 x 0.8 block with a bronze slab
  {
    const bx0 = -3.35, bz0 = 0.55, top = 0.85;
    plinth(bx0, bz0, 1.0, 0.75, top);
    box(bx0, top, bz0, 1.12, 0.06, 0.88, BRONZE);
    const y0 = top + 0.06;
    const pose = POSES.standing();
    pose.height = 1.8; pose.stout = 1.25; pose.chest = 1.3; pose.skirt = {len: 0.25, flare: 1.15};
    pose.arms = {l: {pitch: 1.55, roll: 0.15, bend: 0.5}, r: {pitch: 0.7, roll: -0.2, bend: 1.2}};   // left hand up the neck, right hand low on the strings
    pose.head = {pitch: 0.12, yaw: 0.25};
    const bass = figure(pose, bx0 + 0.05, y0, bz0 - 0.1, BRONZE);
    headOnFigure(fr0, bass, {sex: 'm', hair: 'wild', moustache: true, colour: BRONZE, scale: 1.1});
    // the bass: lower and upper bouts, waist, neck and scroll, strings side
    ball(bx0 - 0.28, y0 + 0.62, bz0 + 0.2, 0.27, 0.34, 0.095, BRONZE, 12);
    ball(bx0 - 0.28, y0 + 1.1, bz0 + 0.2, 0.2, 0.26, 0.09, BRONZE, 12);
    limb([bx0 - 0.28, y0 + 1.25, bz0 + 0.28], [bx0 - 0.22, y0 + 1.95, bz0 + 0.26], 0.035, 0.03, BRONZE, 6);
    ball(bx0 - 0.215, y0 + 2.02, bz0 + 0.26, 0.045, 0.065, 0.045, BRONZE, 6);
    box(bx0 - 0.28, y0, bz0 + 0.2, 0.04, 0.04, 0.05, BRONZE);
  }
  // ---- 2. Tante Leen: bust on a pillar
  plinth(-1.65, -0.1, 0.45, 0.45, 0.9, false);
  bust(memorialFrame(b, FACING), {x: -1.65, y: 0.9, z: -0.1, scale: 1.2, sex: 'f', hair: 'wave', colour: BRONZE});
  // ---- 3. Johnny Jordaan: bust on a pillar (origin)
  plinth(0, 0, 0.45, 0.45, 0.9, false);
  bust(memorialFrame(b, FACING), {x: 0, y: 0.9, z: 0, scale: 1.2, sex: 'm', hair: 'short', glasses: true, bow: true, colour: BRONZE});
  // the carved names on the pillar fronts
  const fr = memorialFrame(b, FACING);
  fr.lettering('TANTE LEEN', 0.05, 0.36, -1.65, 0.5, -0.1 + 0.225 - 0.003, 'front', 'gold', 0.012);
  fr.lettering('1912   1992', 0.045, 0.36, -1.65, 0.42, -0.1 + 0.225 - 0.003, 'front', 'gold', 0.012);
  fr.lettering('JOHNNY JORDAAN', 0.05, 0.4, 0, 0.5, 0.225 - 0.003, 'front', 'gold', 0.012);
  fr.lettering('1924   1989', 0.045, 0.36, 0, 0.42, 0.225 - 0.003, 'front', 'gold', 0.012);
  // ---- 4. Johnny Meijer: seated accordionist on a bentwood chair, on a 0.8 block with a bronze slab
  {
    const mx = 1.45, mz = 0.2, top = 0.78;
    plinth(mx, mz, 0.85, 0.75, top);
    box(mx, top, mz, 0.98, 0.05, 0.88, BRONZE);
    const y0 = top + 0.05;
    // chair: seat disc, four legs, back ring support of a bentwood stool
    const seat = new T.CylinderGeometry(0.2, 0.2, 0.035, 12); put(seat, mx, y0 + 0.44, mz - 0.1, BRONZE);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) limb([mx + sx * 0.16, y0, mz - 0.1 + sz * 0.16], [mx + sx * 0.12, y0 + 0.44, mz - 0.1 + sz * 0.12], 0.016, 0.014, BRONZE, 5);
    const ring = new T.TorusGeometry(0.16, 0.012, 5, 12); ring.rotateX(Math.PI / 2); put(ring, mx, y0 + 0.2, mz - 0.1, BRONZE);
    const pose = POSES.seated(y0 * 0 + 0.5);
    pose.height = 1.78; pose.stout = 1.3; pose.chest = 1.25; pose.lean = 0.12;
    pose.legs = {l: {pitch: 1.45, roll: 0.12, bend: 1.45}, r: {pitch: 1.45, roll: 0.12, bend: 1.45}};
    pose.arms = {l: {pitch: 1.05, roll: 0.35, bend: 1.0}, r: {pitch: 1.05, roll: 0.35, bend: 1.0}};
    pose.head = {pitch: 0.1};
    const j = figure(pose, mx, y0 + 0.0, mz - 0.1, BRONZE);
    headOnFigure(fr0, j, {sex: 'm', hair: 'short', colour: BRONZE, scale: 1.15});
    // the accordion on the chest: two end boxes with ten bellows folds between
    const ay = y0 + 0.78, az = mz + 0.2;
    box(mx - 0.25, ay - 0.2, az - 0.1, 0.1, 0.36, 0.2, BRONZE); box(mx + 0.25, ay - 0.2, az - 0.1, 0.1, 0.36, 0.2, BRONZE);
    for (let i = 0; i < 9; i++) box(mx - 0.19 + i * 0.0475, ay - 0.185 + (i % 2) * 0.01, az - 0.1, 0.036, 0.33 - (i % 2) * 0.03, 0.18 - (i % 2) * 0.02, BRONZE);
    void j;
  }
  // ---- 5. the couple on the large block: a man holding an accordion, a woman behind and above him
  {
    const cx = 3.3, cz = 0.75, top = 0.95;
    plinth(cx, cz, 1.15, 0.9, top);
    // the man: half-length, shoulders turned a little towards the woman, in a pullover; a stout bust-like torso
    const frame = memorialFrame(b, FACING);
    frame.box(cx - 0.18, top, cz + 0.05, 0.62, 0.34, 0.4, BRONZE);                   // waist and lap block
    bust(frame, {x: cx - 0.18, y: top + 0.28, z: cz + 0.05, scale: 1.3, sex: 'm', hair: 'bald', glasses: true, collar: true, turn: -0.2, colour: BRONZE});
    // the woman behind and above: torso column under a bust
    ball(cx + 0.28, top + 0.9, cz - 0.28, 0.2, 0.55, 0.14, BRONZE, 10);
    bust(frame, {x: cx + 0.28, y: top + 0.72, z: cz - 0.28, scale: 1.1, sex: 'f', hair: 'wave', turn: -0.15, colour: BRONZE});
    // the accordion held at the man's chest, bellows towards the woman's side
    const ax = cx + 0.22, ay = top + 0.05, az = cz + 0.3;
    box(ax - 0.16, ay, az, 0.1, 0.5, 0.2, BRONZE); box(ax + 0.16, ay, az, 0.1, 0.5, 0.2, BRONZE);
    for (let i = 0; i < 5; i++) box(ax - 0.1 + i * 0.05, ay + 0.02 + (i % 2) * 0.01, az, 0.035, 0.46 - (i % 2) * 0.03, 0.18 - (i % 2) * 0.02, BRONZE);
    // forearms from the man's shoulders to the accordion
    limb([cx - 0.18 + 0.32, top + 0.62, cz + 0.08], [ax - 0.15, ay + 0.3, az - 0.04], 0.07, 0.05, BRONZE, 7);
    limb([cx - 0.18 - 0.32, top + 0.6, cz + 0.08], [ax + 0.12, ay + 0.2, az + 0.08], 0.07, 0.05, BRONZE, 7);
  }
}
