import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import {beam, board, facingRotation, octagon, octFrustum, pixelText, plate, sails, turned, windingWheel, type C, type P} from './windmill-kit';

/**
 * De Otter (Gillis van Ledenberchstraat 78), paltrok sawmill, 1631, the oldest surviving paltrok (Rijksmonument 1198).
 * Molendatabase 02484a: body clad in wood, front in herringbone (visgraat), open finial (makelaar), a board with the name
 * 'De Otter' on the rear beam, seat curb on 46 wooden rollers, Old Dutch sails of 19.50 m. Photos: municipal panoramas
 * 2017-2025 (CC BY 4.0), Wikimedia Commons 2011-2019 (CC BY-SA). Unlike a smock mill the whole body turns on its low
 * base: a broad deck on the turning curb, the tapering body with its side wings (kasten) under lean-to roofs, and a
 * barrel cap with green rounded gables. Sails on +Z, turned to bearing 248 (towards the Kostverlorenvaart, the side
 * the 2021-2025 panoramas show them on); the separate open timber shed (Rijksmonument 408758) is not part of this model.
 */
export const DE_OTTER = {facing: 248, deckY: 1.8, bodyTop: 10.8, capTop: 12.9, hub: [0, 11.55, 3.35] as P, radius: 9.75, lean: .24,
  body: {w0: 6.0, d0: 6.6, w1: 3.2, d1: 4.8}, deck: {w: 10.2, d: 8.0}, wing: {out: 4.9, z: 2.7, wall: 3.9, roofIn: 5.3}};

/** Tapered four-sided body between two centred rectangles (open top and bottom). */
function taper(b: BuildingTools, y0: number, y1: number, w0: number, d0: number, w1: number, d1: number, c: C): void {
  const lo = [[-w0 / 2, -d0 / 2], [w0 / 2, -d0 / 2], [w0 / 2, d0 / 2], [-w0 / 2, d0 / 2]], hi = [[-w1 / 2, -d1 / 2], [w1 / 2, -d1 / 2], [w1 / 2, d1 / 2], [-w1 / 2, d1 / 2]];
  const pos: number[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, a = [lo[i][0], y0, lo[i][1]], q = [lo[j][0], y0, lo[j][1]], r = [hi[j][0], y1, hi[j][1]], s = [hi[i][0], y1, hi[i][1]];
    pos.push(...a, ...r, ...q, ...a, ...s, ...r);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.userData.role = 'paltrok-body'; b.add(g, c);
}

export function buildDeOtter(_w: number, _d: number, root: BuildingTools): void {
  const b = turned(root, facingRotation(DE_OTTER.facing)), {deckY, bodyTop} = DE_OTTER, B = DE_OTTER.body, W = DE_OTTER.wing;
  const halfW = (y: number) => B.w0 / 2 + (y - deckY) / (bodyTop - deckY) * (B.w1 - B.w0) / 2;
  const halfD = (y: number) => B.d0 / 2 + (y - deckY) / (bodyTop - deckY) * (B.d1 - B.d0) / 2;
  // Turning base: low brick ring, the curb posts and the deck (zaagvloer) that turns with the mill (Commons 2016/2017).
  octFrustum(b, 0, .55, 3.4, 3.3, 'brick', 'curb-ring'); b.add(upwardRoofPlane(octagon(3.3), .55), 'brick');
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; beam(b, [Math.sin(a) * 3.05, .55, Math.cos(a) * 3.05], [Math.sin(a) * 3.3, deckY - .3, Math.cos(a) * 3.3], .22, 'bronze', 'curb-post'); }
  b.box(0, deckY - .3, 0, DE_OTTER.deck.w, .3, DE_OTTER.deck.d, 'bronze');
  // Edge beams of the deck frame, 0.5 m deep (Commons 2016).
  for (const sx of [-1, 1]) { b.box(sx * (DE_OTTER.deck.w / 2 - .12), deckY - .8, 0, .24, .5, DE_OTTER.deck.d - .02, 'bronze'); b.box(0, deckY - .8, sx * (DE_OTTER.deck.d / 2 - .12), DE_OTTER.deck.w - .5, .5, .24, 'bronze'); }
  for (const s of [-1, 1]) for (const x of [-3.9, 3.9]) beam(b, [x, deckY - .3, s * 3.7], [x * .78, .55, s * 2.6], .2, 'bronze', 'deck-strut');
  // Stair from the rear of the deck to the ground.
  for (let k = 0; k < 6; k++) b.box(1.6, k * .3, -DE_OTTER.deck.d / 2 - 1.75 + k * .3, 1.0, .06, .32, 'stone');
  for (const x of [1.08, 2.12]) beam(b, [x, 0, -DE_OTTER.deck.d / 2 - 1.9], [x, deckY, -DE_OTTER.deck.d / 2], .1, 'stone', 'stair-string');
  // Body: tarred weatherboarding, tapering to the cap.
  taper(b, deckY, bodyTop, B.w0, B.d0, B.w1, B.d1, 'copper');
  // The turning curb's closed core under the deck (dark boarding behind the posts, Commons 2016).
  octFrustum(b, .55, deckY - .85, 3.15, 3.15, 'bronze', 'curb-core');
  // Herringbone (visgraat) boarding on the front face: chevron battens 6 cm proud, under the sails.
  const fz = (y: number) => halfD(y) + .07;
  for (let y = deckY + 1.2; y < bodyTop - .8; y += 1.1) {
    const hw = halfW(y) - .2;
    for (const s of [-1, 1]) beam(b, [0, y + .55, fz(y + .55)], [s * hw, y, fz(y)], .08, 'ochre', 'herringbone', .05);
  }
  // Rear face: a small window and a hatch, white framed (Commons 2016).
  const back = turned(b, Math.PI);
  back.box(0, 8.0, halfD(8.45) + .02, .8, .9, .3, 'white'); back.box(0, 8.07, halfD(8.45) + .2, .64, .76, .06, 'glass');
  // Side wings (kasten): lean-to roofs from the body to the deck edge; -X closed and boarded, +X an open frame.
  for (const s of [-1, 1]) {
    const inX = halfW(W.roofIn) - .05, outX = W.out + .25;
    const roof = [[s * inX, W.roofIn, -W.z - .3], [s * outX, W.wall, -W.z - .3], [s * outX, W.wall, W.z + .3], [s * inX, W.roofIn, W.z + .3]] as P[];
    plate(b, s < 0 ? roof : [...roof].reverse(), 'slate', 'wing-roof');
    beam(b, [s * outX, W.wall - .05, -W.z - .3], [s * outX, W.wall - .05, W.z + .3], .14, 'pink', 'wing-fascia');
    if (s < 0) {
      b.box(s * W.out, deckY, 0, .12, W.wall - deckY, 2 * W.z, 'stone');
      for (const z of [-W.z, W.z]) {
        const yIn = W.roofIn;
        const end = new T.Shape().moveTo(halfW(deckY) - .05, deckY).lineTo(W.out, deckY).lineTo(W.out, W.wall).lineTo(inX, yIn).lineTo(halfW(deckY) - .05, yIn).closePath();
        const g = new T.ShapeGeometry(end); g.rotateY(Math.PI); g.translate(0, 0, z); g.userData.role = 'wing-end'; b.add(g, 'stone');
      }
    } else {
      for (const z of [-W.z, 0, W.z]) { beam(b, [W.out, deckY, z], [W.out, W.wall, z], .2, 'stone', 'wing-post'); beam(b, [W.out, W.wall - .7, z], [halfW(W.wall) , W.wall + .5, z], .14, 'stone', 'wing-brace'); }
      beam(b, [W.out, W.wall - .1, -W.z], [W.out, W.wall - .1, W.z], .18, 'stone', 'wing-plate');
    }
  }
  // Barrel cap: light boarded roof between green rounded gables with white rims; open finial (makelaar) on the rear.
  const capR = B.w1 / 2 + .55, capL = B.d1 / 2 + .55;
  const barrel = new T.CylinderGeometry(capR, capR, 2 * capL, 12, 1, true, Math.PI / 2, Math.PI); barrel.rotateX(Math.PI / 2); barrel.scale(1, (DE_OTTER.capTop - bodyTop) / capR, 1); barrel.userData.role = 'cap-roof';
  b.add(barrel, 'concrete', 0, bodyTop, 0);
  b.box(0, bodyTop - .25, 0, B.w1 + .5, .25, 2 * capL, 'bronze');
  for (const s of [-1, 1]) {
    const half = new T.Shape().moveTo(capR - .12, 0).absellipse(0, 0, capR - .12, DE_OTTER.capTop - bodyTop - .12, 0, Math.PI, false).closePath();
    const g = new T.ShapeGeometry(half, 8); if (s < 0) g.rotateY(Math.PI); g.userData.role = 'cap-gable'; b.add(g, 'green', 0, bodyTop, s * capL);
    const rim = new T.TorusGeometry(capR - .06, .08, 4, 12, Math.PI); rim.scale(1, (DE_OTTER.capTop - bodyTop - .06) / (capR - .06), 1); rim.userData.role = 'cap-gable-rim'; b.add(rim, 'pink', 0, bodyTop, s * (capL + .06));
  }
  beam(b, [0, DE_OTTER.capTop - .3, -capL - .12], [0, DE_OTTER.capTop + 1.3, -capL - .12], .16, 'pink', 'makelaar');
  const knob = new T.SphereGeometry(.16, 8, 4); knob.userData.role = 'makelaar'; b.add(knob, 'pink', 0, DE_OTTER.capTop + 1.4, -capL - .12);
  // Rear beam board 'DE OTTER' (Molendatabase; Commons 2016 shows it under the rear gable).
  const rear = turned(b, Math.PI);
  board(rear, 0, bodyTop - .62, capL - .1, 2.6, .5, 'pink', undefined, .1);
  pixelText(rear, 'DE OTTER', 0, bodyTop - .37, capL, .32, 'slate', .04);
  // Sails: Old Dutch lattice, yellow stocks, dark green lattice (Commons 2014).
  const clear = sails(b, {cross: {hub: DE_OTTER.hub, radius: DE_OTTER.radius, rotationDeg: 30, lean: DE_OTTER.lean}, style: 'old-dutch', stock: 'gold', lattice: 'green', latticeWidth: 1.75, barStep: .55, hubC: 'green', shaftFrom: [0, DE_OTTER.hub[1] - .3, 0]});
  if (clear.lowest < .8) throw new Error(`de-otter: sails reach the ground (${JSON.stringify(clear)})`);
  if (clear.forward < DE_OTTER.deck.d / 2 + .3) throw new Error(`de-otter: sails sweep through the deck (${JSON.stringify(clear)})`);
  // Winding gear: capstan wheel at the rear corner of the deck (Commons 2016, green).
  windingWheel(b, [2.9, deckY + .9, -DE_OTTER.deck.d / 2 - .35], .8, 'green');
  beam(b, [2.9, 0, -DE_OTTER.deck.d / 2 - .45], [2.9, deckY + .9, -DE_OTTER.deck.d / 2 - .45], .18, 'green', 'winding-post');
}
