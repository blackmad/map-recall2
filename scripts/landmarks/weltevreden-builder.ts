import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {archSlab, getSink, ledgeStrip, letters, put, ringFrame, setSink, slab} from './nearbar-kit';
import source from './weltevreden-footprints.json';

/**
 * WELTEVREDEN, Plantage Middenlaan 47 (BAG pand 0363100012181160, BAG 1815; rijksmonument 4106 "Buitenhuis Weltevreden
 * (Artis)": a dwarshuis, XIX A, the register naming the dormer and the glazing bars). The white wooden garden house between
 * the tall brick Plantage Middenlaan 45 and Welgelegen (no. 49).
 *
 * Massing is drawn by hand on the BAG footprint (footprints.json, facade ring), not the 3DBAG shell: the 3DBAG roof carries a
 * 10.2 m strip along the north-west end that is the taller neighbour bleeding into this pand (the 2019 and 2022 panoramas
 * show the white house's hipped roof running down to the neighbour's wall). The front block 12.57 x 5.7 m with the cornice
 * at 4.3 m and a hipped roof to the 3DBAG ridge (8.2 m), and the 1.9 m wide flat-roofed annexe (2.7 m) at the back.
 *
 * Front (facade ring edge 4, w01-209) read from the rectified Gemeente Amsterdam panorama TMX7316010203-001181_pano_0000_003955
 * (2019, frontal; w01-209.alt.jpg, CC BY 4.0), 50.2 px/m across the 12.57 m front (t = x / 50.2 from the north-west end),
 * heights h = (425 - y) / 50 to the pavement; the 2023 frontal (TMX7316010203-002933_pano_0009_000098) and the 2022 oblique
 * (TMX7316010203-002541_pano_0003_000060) for the weatherboarding and the set-back dormer:
 *  - white painted horizontal weatherboarding between corner boards and the door pilasters;
 *  - two tall windows (a three-light top row over three columns of glazing bars) with tall black shutters folded open;
 *  - the black double door under a fanlight with a half-round radial fan, between pilasters carrying the frieze that bears
 *    the name WELTEVREDEN; a small wall lamp; the downpipe;
 *  - the white cornice with its zinc gutter, the black glazed pantile hipped roof with a roof light;
 *  - the wide dormer storey (5.9 m) standing back behind the cornice: white boarded front, three windows with dark 3 x 3
 *    glazing bars, a moulded cap, grey zinc cheeks and a flat top; a chimney at the ridge;
 *  - the low black cast-iron front-garden railing on its kerb with the gate before the door.
 */
type Src = {facadeRing: number[][]};
const src = source as unknown as Src;
const FRONT = ringFrame(src.facadeRing, 4);
const F = FRONT.f, L = FRONT.len;
const D = 5.7; // depth of the front block (facade ring edge 3)
const EAVES = 4.3, RIDGE = 8.2, HIP = 2.4, OVER = 0.3;
const SLOPE = (RIDGE - EAVES) / (D / 2);
const roofY = (depth: number) => EAVES + SLOPE * depth;

const t = (x: number) => +(x / 50.2).toFixed(3);
const h = (y: number) => +((425 - y) / 50).toFixed(3);
const WIN = [[t(95), t(167)], [t(462), t(535)]] as const;
const SHUT = [[t(50), t(92)], [t(168), t(205)], [t(422), t(460)], [t(538), t(578)]] as const;
const WIN_Y = [0.75, h(258)] as const;
const TRANSOM = h(290);
const DOOR = [t(273), t(354)] as const;
const PIL = [[t(245), t(272)], [t(355), t(382)]] as const;
const FRIEZE = [h(245), h(212)] as const;
const DORMER = [t(165), t(460)] as const;
const DORMER_OUT = 0.02, DORMER_TOP = h(75);

/** World point from front-frame coordinates (t along, y up, o outward). */
const W = (tt: number, y: number, o: number): [number, number, number] => [F.origin[0] + F.tangent[0] * tt + F.n[0] * o, y, F.origin[1] + F.tangent[1] * tt + F.n[1] * o];

export function buildWeltevreden(_w: number, _d: number, b: BuildingTools) {
  // front block and the annexe at the back of the south-east end
  slab(b, F, L / 2, 0, L, EAVES, D, 'sandstone', -D);
  slab(b, F, (10.68 + L) / 2, 0, L - 10.68, 2.7, 5.2, 'sandstone', -D - 5.2);
  slab(b, F, (10.68 + L) / 2, 2.7, L - 10.68, 0.08, 5.2, 'slate', -D - 5.2);
  hipRoof(b);
  const sink0 = getSink();
  setSink(0.04);
  front(b);
  setSink(sink0);
  dormer(b);
  chimney(b, t(312), D / 2, 8.6);
  roofPanel(b, t(485), 1.0, 0.55, 0.7);
}

/** Hipped roof of black glazed pantiles with a 0.3 m overhang; the ridge runs between the hips HIP in from each end. */
function hipRoof(b: BuildingTools) {
  const y0 = EAVES + 0.06; // the eaves sit on the cornice crown, so the overhang never hangs over the frieze
  const a = W(-OVER, y0, OVER), c = W(L + OVER, y0, OVER), e = W(L + OVER, y0, -D - OVER), g = W(-OVER, y0, -D - OVER);
  const r0 = W(HIP, RIDGE, -D / 2), r1 = W(L - HIP, RIDGE, -D / 2);
  const tris = [[a, c, r1], [a, r1, r0], [c, e, r1], [e, g, r0], [e, r0, r1], [g, a, r0]];
  const pos: number[] = [];
  for (const tri of tris) {
    const [p, q, r] = tri;
    const n = new T.Vector3().crossVectors(new T.Vector3(...q).sub(new T.Vector3(...p)), new T.Vector3(...r).sub(new T.Vector3(...p)));
    pos.push(...(n.y >= 0 ? [...p, ...q, ...r] : [...p, ...r, ...q]));
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.userData.role = 'roof';
  b.add(geo, 'slate' as never);
  // soffit under the overhang, so the eaves do not read as a paper edge from below
  const soffit = new T.BufferGeometry();
  const s = [W(-OVER, y0, OVER), W(L + OVER, y0, OVER), W(L + OVER, y0, -D - OVER), W(-OVER, y0, -D - OVER)];
  soffit.setAttribute('position', new T.Float32BufferAttribute([...s[0], ...s[2], ...s[1], ...s[0], ...s[3], ...s[2]], 3));
  soffit.computeVertexNormals();
  b.add(soffit, 'sandstone' as never);
}

function front(b: BuildingTools) {
  // horizontal weatherboards: a board edge every 0.2 m, cut round the shutters, window and the door surround
  const surround: [number, number] = [PIL[0][0], PIL[1][1]];
  for (let y = 0.35; y < FRIEZE[0] - 0.05; y += 0.2) {
    const cuts: [number, number][] = y < SHUT_Y[1] + 0.02 && y > WIN_Y[0] - 0.02 ? [[SHUT[0][0], SHUT[1][1]], surround, [SHUT[2][0], SHUT[3][1]]] : [surround];
    let p0 = 0.2;
    for (const [c0, c1] of [...cuts, [L - 0.2, L - 0.2] as [number, number]]) {
      if (c0 - p0 > 0.1) ledgeStrip(b, F, (p0 + c0) / 2, y, c0 - p0, 0.025, 0.035, 'stone');
      p0 = Math.max(p0, c1);
    }
  }
  // corner boards
  for (const tc of [0.1, L - 0.1]) slab(b, F, tc, 0, 0.2, 4.06, 0.06, 'sandstone');
  // the frieze over the whole front and the cornice with its zinc gutter (y 205-245)
  slab(b, F, L / 2, FRIEZE[0], L, 4.06 - FRIEZE[0], 0.08, 'sandstone');
  slab(b, F, L / 2, 4.06, L + 0.1, 0.1, 0.22, 'sandstone');
  slab(b, F, L / 2, 4.16, L + 0.3, EAVES + 0.06 - 4.16, 0.36, 'sandstone');
  slab(b, F, L / 2, EAVES, L + 0.4, 0.14, 0.12, 'concrete', 0.36);
  letters(b, F, 'WELTEVREDEN', (DOOR[0] + DOOR[1]) / 2, h(241) - 0.02, 0.08, 0.025, 0.015, 'bronze', 0.034);
  for (const [a, c] of WIN) window(b, a, c);
  for (const [a, c] of SHUT) shutter(b, a, c);
  entrance(b);
  // wall lamp (x 228, y 302) and the downpipe from the gutter (x 392)
  slab(b, F, t(228), h(310), 0.14, 0.2, 0.12, 'bronze', 0.04);
  put(b, F, new T.CylinderGeometry(0.045, 0.045, EAVES - 0.1, 6).translate(0, (EAVES - 0.1) / 2, 0), t(392), 0, 0.1, 'concrete');
  fence(b);
}

const SHUT_Y = [h(375), h(255)] as const;

/** Tall window: white frame, a three-light top row over three columns of dark glazing bars, a white sill. */
function window(b: BuildingTools, a: number, c: number) {
  const w = c - a, m = (a + c) / 2, [y0, y1] = WIN_Y, B = 0.09;
  slab(b, F, m, y0, w, y1 - y0, 0.015, 'glass', 0.02);
  for (const s of [-1, 1]) slab(b, F, m + s * (w / 2 - B / 2), y0, B, y1 - y0, 0.1, 'frame');
  slab(b, F, m, y0, w, B, 0.1, 'frame');
  slab(b, F, m, y1 - B, w, B, 0.1, 'frame');
  slab(b, F, m, TRANSOM - 0.04, w, 0.08, 0.1, 'frame');
  for (const k of [1, 2]) slab(b, F, a + k * w / 3, y0 + B, 0.035, y1 - y0 - 2 * B, 0.06, 'dark', 0.03);
  for (const yy of [h(325), h(350), y0 + 0.4]) slab(b, F, m, yy, w - 2 * B, 0.035, 0.06, 'dark', 0.03);
  slab(b, F, m, y0 - 0.08, w + 0.12, 0.08, 0.14, 'sandstone');
}

/** A tall black shutter folded open against the boards, with two raised panels. */
function shutter(b: BuildingTools, a: number, c: number) {
  const w = c - a, m = (a + c) / 2, [y0, y1] = SHUT_Y;
  slab(b, F, m, y0, w, y1 - y0, 0.05, 'dark', 0.04);
  for (const [p0, p1] of [[y0 + 0.12, y0 + 1.0], [y0 + 1.15, y1 - 0.12]]) slab(b, F, m, p0, w - 0.16, p1 - p0, 0.025, 'dark', 0.09);
}

function entrance(b: BuildingTools) {
  const dm = (DOOR[0] + DOOR[1]) / 2, dw = DOOR[1] - DOOR[0], spring = h(290) + 0.02, top = h(248);
  // pilasters carrying the frieze
  for (const [a, c] of PIL) slab(b, F, (a + c) / 2, 0, c - a, FRIEZE[0], 0.14, 'sandstone');
  slab(b, F, dm, top, PIL[1][1] - PIL[0][0], FRIEZE[0] - top, 0.1, 'sandstone');
  // the fanlight: dark glass, a half-round radial fan of white bars, the transom bar
  slab(b, F, dm, h(298), dw, top - h(298), 0.015, 'glass', 0.02);
  slab(b, F, dm, h(298), dw, spring - h(298), 0.09, 'frame');
  const r = Math.min(dw / 2, top - spring) - 0.04;
  archSlab(b, F, dm, spring, 2 * r, r, 0.02, 'glass', 0.05, 10);
  for (let k = 1; k < 8; k++) {
    const ang = Math.PI * k / 8;
    put(b, F, new T.BoxGeometry(0.03, r, 0.04).translate(0, r / 2, 0.02).rotateZ(ang - Math.PI / 2), dm, spring, 0.05, 'frame');
  }
  put(b, F, new T.TorusGeometry(r, 0.025, 4, 12, Math.PI).translate(0, 0, 0.06), dm, spring, 0.03, 'frame');
  for (const s of [-1, 1]) slab(b, F, dm + s * (dw / 2 - 0.04), h(298), 0.08, top - h(298), 0.09, 'frame');
  slab(b, F, dm, top - 0.07, dw, 0.07, 0.09, 'frame');
  // black panelled double door
  slab(b, F, dm, 0, dw, h(298), 0.05, 'dark', 0.02);
  for (const s of [-1, 1]) for (const [y0, y1] of [[0.2, 1.05], [1.25, h(298) - 0.18]]) slab(b, F, dm + s * dw / 4, y0, dw / 2 - 0.24, y1 - y0, 0.03, 'dark', 0.07);
  slab(b, F, dm, 0, 0.04, h(298), 0.04, 'bronze', 0.07);
  slab(b, F, dm, 0, PIL[1][1] - PIL[0][0], 0.1, 0.35, 'stone');
}

/**
 * The dormer storey: a zinc box standing in the front plane behind the cornice, from below the roof plane to its flat top
 * at h 7.0 (y 75), back into the slope; the white boarded front with three windows (x 197-255, 283-342, 370-428; y 110-187),
 * dark frames and 3 x 3 glazing bars in a white surround; a moulded cap.
 */
function dormer(b: BuildingTools) {
  const [a, c] = DORMER, m = (a + c) / 2, w = c - a;
  const y0 = roofY(-DORMER_OUT) - 0.2, back = (DORMER_TOP - EAVES) / SLOPE + 0.5;
  slab(b, F, m, y0, w, DORMER_TOP - y0, back + DORMER_OUT, 'concrete', -back);
  // white boarded front plate
  slab(b, F, m, y0, w, DORMER_TOP - y0, 0.06, 'sandstone', DORMER_OUT);
  for (let y = h(195); y < DORMER_TOP - 0.25; y += 0.2) {
    const cuts = y + 0.03 > h(195) && y < h(102) ? DWIN.map(([w0, w1]) => [w0 - 0.12, w1 + 0.12] as const) : [];
    let p0 = a + 0.05;
    for (const [c0, c1] of [...cuts, [c - 0.05, c - 0.05] as const]) {
      if (c0 - p0 > 0.05) ledgeStrip(b, F, (p0 + c0) / 2, y, c0 - p0, 0.025, 0.03, 'stone', DORMER_OUT + 0.06);
      p0 = Math.max(p0, c1);
    }
  }
  // cap: a moulded cornice over the front and cheeks, and the flat zinc top
  slab(b, F, m, DORMER_TOP - 0.18, w + 0.16, 0.18, 0.2, 'sandstone', DORMER_OUT);
  slab(b, F, m, DORMER_TOP, w + 0.3, 0.1, back + DORMER_OUT + 0.3, 'concrete', -back);
  slab(b, F, m, DORMER_TOP + 0.1, w - 0.6, 0.06, 1.2, 'glass', -back + 0.3); // the roof light on the flat top (2019)
  for (const [w0, w1] of DWIN) {
    const wm = (w0 + w1) / 2, ww = w1 - w0, wy0 = h(187), wy1 = h(110), o = DORMER_OUT + 0.06;
    slab(b, F, wm, wy0 - 0.08, ww + 0.2, wy1 - wy0 + 0.16, 0.04, 'sandstone', o);
    slab(b, F, wm, wy0, ww, wy1 - wy0, 0.015, 'glass', o + 0.06);
    for (const s of [-1, 1]) slab(b, F, wm + s * (ww / 2 - 0.04), wy0, 0.08, wy1 - wy0, 0.12, 'dark', o + 0.04);
    slab(b, F, wm, wy0, ww, 0.08, 0.12, 'dark', o + 0.04);
    slab(b, F, wm, wy1 - 0.08, ww, 0.08, 0.12, 'dark', o + 0.04);
    for (const k of [1, 2]) {
      slab(b, F, w0 + k * ww / 3, wy0, 0.035, wy1 - wy0, 0.1, 'dark', o + 0.04);
      slab(b, F, wm, wy0 + k * (wy1 - wy0) / 3 - 0.018, ww, 0.035, 0.1, 'dark', o + 0.04);
    }
    slab(b, F, wm, wy0 - 0.1, ww + 0.16, 0.06, 0.16, 'sandstone', o);
  }
}
const DWIN = [[t(197), t(255)], [t(283), t(342)], [t(370), t(428)]] as const;

/** Brick stack at `depth` behind the front, from inside the roof to `top`. */
function chimney(b: BuildingTools, at: number, depth: number, top: number) {
  const y0 = roofY(depth - 0.3) - 0.1;
  slab(b, F, at, y0, 0.45, top - y0, 0.55, 'brick', -depth - 0.27);
  slab(b, F, at, top - 0.1, 0.55, 0.1, 0.65, 'brick', -depth - 0.32);
}

/** Roof light lying 4 cm over the front slope, centred `depth` behind the front. */
function roofPanel(b: BuildingTools, at: number, depth: number, w: number, len: number) {
  const pitch = Math.atan(SLOPE), off = 0.05;
  put(b, F, new T.BoxGeometry(w, len, 0.05).rotateX(pitch - Math.PI / 2), at, roofY(depth) + off * Math.cos(pitch), -depth + off * Math.sin(pitch), 'glass');
}

/** Low black cast-iron railing on a brick kerb 1.2 m out, posts with ball tops, the gate before the door (y 345-425). */
function fence(b: BuildingTools) {
  const out = 1.2, H = 1.2, posts = [0.15, t(160), PIL[0][0] - 0.05, PIL[1][1] + 0.05, t(460), L - 0.15];
  slab(b, F, L / 2, 0, L - 0.2, 0.15, 0.18, 'stone', out - 0.08);
  slab(b, F, L / 2, 0.3, L - 0.3, 0.035, 0.035, 'bronze', out);
  slab(b, F, L / 2, H - 0.12, L - 0.3, 0.035, 0.035, 'bronze', out);
  const n = Math.round((L - 0.3) / 0.2);
  for (let k = 0; k <= n; k++) slab(b, F, 0.15 + k * (L - 0.3) / n, 0.15, 0.018, H - 0.1, 0.018, 'bronze', out + 0.008);
  for (const p of posts) {
    slab(b, F, p, 0.15, 0.06, H + 0.05, 0.06, 'bronze', out - 0.012);
    put(b, F, new T.SphereGeometry(0.05, 6, 4), p, H + 0.25, out + 0.018, 'bronze');
  }
}

