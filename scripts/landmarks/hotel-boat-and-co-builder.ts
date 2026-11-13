import type {BuildingTools} from './cultural-builders';
import type {Frame} from './nearbar-kit';
import {raisedLettering} from './ornament-kit';
import {Mesh, edgeFrame, holed, inset, lancetDormer, loft, twoSidedLetters, type Cut, type V2} from './houthavens-kit';
import source from './hotel-boat-and-co-footprints.json';

/**
 * Hotel Boat&Co (now The July Boat&Co), Revaleiland 500, Houthavens (BAG pand 0363100012250188, bouwjaar 2019, opened
 * 4 October 2019): Hans Kollhoff with Kollhoff & Pols Architecten (The Hague), "an ode to the Amsterdam School"
 * (baunetz.de, "Hans Kollhoff plant im Houthavens"): an H-shaped brick hotel at the tip of the island with two arms
 * towards the IJ, a high natural-stone plinth, a deep rounded zinc roof zone with pointed dormers, and a glazed atrium
 * at the rear as the neighbourhood's living room.
 *
 * Native frame of hotel-boat-and-co-footprints.json (x east, z south, y up from the 3DBAG ground 0.68 m NAP).
 * Plan (BAG ring + 3DBAG LoD2.2 roof planes, CC BY 4.0):
 *  - two arms on the NW and SE fronts (34.4 m), each ending in a corner pavilion on the IJ (the NE end; a 5 m risalit
 *    0.46 m proud between two 2.3 m flanks); six oriel bays 2.46 m wide, 0.6 m proud on each long front;
 *  - the spine between them; the courtyard on the IJ side 39.5 x 13.6 m (3DBAG has no roof there; the 2021 water-side
 *    panoramas show the stone ground storey running across it and the orthophoto shows terrace furniture on top);
 *  - the atrium on the SW (street) side between the arms' ends, 30.5 x 8.1 m, glazed front and roof at 14.3 m.
 * Heights: walls to the cornice at 14.8 (3DBAG mansard foot 14.2-15.2), zinc mansard 1.6 m deep to the flat top at 18.0
 * (3DBAG 17.8-18.0). Storeys from the water-side panorama TMX7316010203-001972_pano_0000_001083 (2021-01-21, zoomed
 * thumbnails, 10.7 px/m): stone plinth to 3.8, four brick storeys of 2.75 m, cornice 14.8, mansard to 18.0.
 * Fronts: panoramas listed in hotel-boat-and-co-inventory.json.
 */
const R = (source as {facadeRing: number[][]}).facadeRing.map(p => [p[0], p[1]] as V2);
/**
 * Dormers on plain wall stretches stand back in the zinc slope, not on the wall line: their fronts SET_BACK behind the
 * wall plane, their feet 0.1 m above the line where that front meets the slope (the slope hides the gap below). On the
 * wall line the frames merged into the facade plane and the openings audit judged the glass against the wall below.
 */
const SET_BACK = 0.35;
const PLINTH = 3.8, FLOORS = [3.8, 6.55, 9.3, 12.05], EAVE = 14.8, TOP = 18.0, MANS = 1.6, ATR = 14.3, COURT = 13.6, ATR_D = 8.1;
const SLOPE_FOOT = EAVE + SET_BACK * (TOP - EAVE) / MANS + 0.1;

const add = (a: V2, d: V2, s: number): V2 => [a[0] + d[0] * s, a[1] + d[1] * s];
const unit = (a: V2, b: V2): V2 => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
const CENTRE: V2 = [R.reduce((s, p) => s + p[0], 0) / R.length, R.reduce((s, p) => s + p[1], 0) / R.length];
/** Normal of the line a -> b pointing towards the ring's centre. */
const inward = (a: V2, b: V2): V2 => {
  const d = unit(a, b), n: V2 = [-d[1], d[0]], mid: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return (CENTRE[0] - mid[0]) * n[0] + (CENTRE[1] - mid[1]) * n[1] > 0 ? n : [-n[0], -n[1]];
};
const SW_IN = inward(R[32], R[38]), NE_IN = inward(R[0], R[1]);
const AW = add(R[34], SW_IN, ATR_D), AE = add(R[35], SW_IN, ATR_D);
const CE = add(R[0], NE_IN, COURT), CN = add(R[1], NE_IN, COURT);
/** Building ring without the courtyard and the atrium. */
const BODY: V2[] = [...R.slice(1, 35), AW, AE, ...R.slice(35), R[0], CE, CN];
/** Simplified ring for the mansard (oriels and pavilion risalits dropped). */
const MANSARD: V2[] = [R[1], R[7], R[32], R[34], AW, AE, R[35], R[38], R[63], R[0], CE, CN];

let m: Mesh;
let b: BuildingTools;

/** Windows of the brick storeys: `cols` window centres, width w. */
function storeyCuts(cols: number[], w: number): Cut[] {
  const cuts: Cut[] = [];
  for (const t of cols) for (const f of FLOORS) cuts.push({t0: t - w / 2, t1: t + w / 2, y0: f + 0.6, y1: f + 2.25, depth: 0.18, back: 'glass', reveal: 'stone'});
  return cuts;
}
function windowTrim(f: Frame, cuts: Cut[]) {
  for (const c of cuts) {
    const w = c.t1 - c.t0, mid = (c.t0 + c.t1) / 2, tr = c.y0 + (c.y1 - c.y0) * 0.72;
    m.box(f, c.t0 - 0.06, c.t1 + 0.06, c.y0 - 0.12, c.y0, -0.05, 0.08, 'stone', ['back']);            // sill
    if (w > 0.9) m.rect(f, mid - 0.04, mid + 0.04, c.y0, c.y1, -0.12, 'frame');                       // mullion
    m.rect(f, c.t0, c.t1, tr - 0.04, tr + 0.04, -0.12, 'frame');                                       // transom
  }
}
/** Brick wall on BODY edge i up to the cornice with window columns; stone plinth below with ground openings. */
function front(i: number, cols: number[], w: number, ground: Cut[], y0 = 0) {
  const {f, len} = edgeFrame(BODY, i);
  const cuts = storeyCuts(cols, w).filter(c => c.t0 >= 0.15 && c.t1 <= len - 0.15);
  holed(m, f, len, Math.max(y0, PLINTH), EAVE, 'brick', cuts);
  windowTrim(f, cuts);
  if (y0 < PLINTH) {
    const g = ground.filter(c => c.t0 >= 0.1 && c.t1 <= len - 0.1);
    holed(m, f, len, y0, PLINTH, 'stone', g);
    for (const c of g) if (c.t1 - c.t0 > 1.4) m.rect(f, (c.t0 + c.t1) / 2 - 0.05, (c.t0 + c.t1) / 2 + 0.05, c.y0, c.y1, -0.15, 'bronze');
    if (len > 0.7) m.box(f, 0, len, PLINTH - 0.25, PLINTH, 0, 0.18, 'stone', ['back']);              // plinth cornice
  }
  if (len > 0.7) m.box(f, 0, len, EAVE - 0.45, EAVE, 0, 0.3, 'stone', ['back']);                      // main cornice
  return {f, len};
}
const even = (len: number, pitch: number, margin = 1.2) => {
  const n = Math.max(1, Math.floor((len - 2 * margin) / pitch) + 1), step = n > 1 ? (len - 2 * margin) / (n - 1) : 0;
  return Array.from({length: n}, (_, k) => (n > 1 ? margin + k * step : len / 2));
};
const groundRow = (cols: number[], w: number, door?: number): Cut[] => cols.map(t => (
  {t0: t - w / 2, t1: t + w / 2, y0: t === door ? 0.05 : 0.6, y1: 3.1, depth: 0.25, back: t === door ? 'dark' : 'glass', reveal: 'stone'}));

function walls() {
  for (let i = 0; i < BODY.length; i++) {
    const a = BODY[i], c = BODY[(i + 1) % BODY.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 0.05) continue;
    const ri = R.indexOf(a);
    if (len < 0.7) { front(i, [], 1, []); continue; }                                                  // jogs and oriel cheeks
    if (a === AW || c === AW || a === AE || c === AE) {                                                // atrium side and back walls
      const cols = even(len, 2.9);
      front(i, cols, 1.3, groundRow(cols, 1.6)); continue;
    }
    if (a === CE || c === CE || a === CN || c === CN) { front(i, even(len, 3.0), 1.4, [], PLINTH); continue; } // courtyard walls over the terrace
    if (len > 4.5 && len < 5.3) {                                                                      // pavilion risalit: three window pairs, arched door
      const pairs: number[] = [];
      for (const t of [len / 2 - 1.55, len / 2, len / 2 + 1.55]) pairs.push(t - 0.33, t + 0.33);
      const door = len / 2;
      const {f} = front(i, pairs, 0.52, [{t0: door - 1.3, t1: door + 1.3, y0: 0.05, y1: 3.2, depth: 0.35, back: 'dark', reveal: 'stone'},
        {t0: 0.35, t1: 1.05, y0: 0.6, y1: 3.1, depth: 0.25, back: 'glass', reveal: 'stone'}, {t0: len - 1.05, t1: len - 0.35, y0: 0.6, y1: 3.1, depth: 0.25, back: 'glass', reveal: 'stone'}]);
      m.box(f, door - 1.55, door + 1.55, 3.2, 3.5, 0, 0.2, 'stone', ['back']);
      continue;
    }
    if (len >= 0.7 && len < 2.35 && (ri <= 7 || ri >= 62)) { front(i, [len / 2], 0.7, groundRow([len / 2], 0.9)); continue; } // pavilion flanks
    if (len >= 2.35 && len < 2.6) { front(i, [len / 2 - 0.55, len / 2 + 0.55], 0.8, groundRow([len / 2], 1.6)); continue; }    // oriel front
    if (len > 2.9 && len < 3.3) { front(i, [len / 2], 1.3, groundRow([len / 2], 1.8)); continue; }                              // between oriels
    const cols = even(len, 3.1);                                                                       // arms' SW ends
    front(i, cols, 1.3, groundRow(cols, 1.8, len > 9 ? cols[1] : undefined));
  }
  m.flat(BODY, EAVE, 'slate');
}

/** The courtyard on the IJ: stone ground storey with a terrace on top behind a parapet and glass balustrade. */
function courtyard() {
  const ring: V2[] = [R[0], R[1], CN, CE];
  const {f, len} = edgeFrame(ring, 0);
  const cols = even(len, 3.0, 1.6), door = cols[Math.floor(cols.length / 2)];
  const g = groundRow(cols, 2.0, door);
  holed(m, f, len, 0, PLINTH, 'stone', g);
  for (const c of g) m.rect(f, (c.t0 + c.t1) / 2 - 0.05, (c.t0 + c.t1) / 2 + 0.05, c.y0, c.y1, -0.15, 'bronze');
  m.box(f, 0, len, PLINTH - 0.25, PLINTH, 0, 0.18, 'stone', ['back']);
  m.flat(ring, PLINTH, 'concrete');
  m.box(f, 0, len, PLINTH, PLINTH + 0.4, -0.3, 0, 'stone', ['bottom']);
  m.box(f, 0, len, PLINTH + 0.4, PLINTH + 1.1, -0.2, -0.12, 'glass', ['bottom']);
}

/** The glazed atrium on the street side: stone sill, bronze mullions and transoms, glass roof. */
function atrium() {
  const ring: V2[] = [R[34], AW, AE, R[35]];
  const {f, len} = edgeFrame(ring, 3);
  const bays = 15, p = len / bays;
  m.box(f, 0, len, 0, 0.6, -0.4, 0, 'stone');
  m.rect(f, 0, len, 0.6, ATR - 0.5, -0.2, 'glass');
  for (let k = 0; k <= bays; k++) m.box(f, k * p - 0.08, k * p + 0.08, 0.6, ATR - 0.5, -0.2, 0.05, 'bronze', ['back']);
  for (const y of [3.4, 7.9, 11.0]) m.box(f, 0, len, y, y + 0.14, -0.2, 0.02, 'bronze', ['back']);
  m.box(f, 0, len, ATR - 0.5, ATR + 0.12, -0.2, 0.15, 'bronze');           // top band: a 12 cm lip above the glass roof
  // the glass roof as a closed 5 cm slab (top, underside, edges): a single sheet left a 30 m open edge along the front
  m.flat(ring, ATR, 'glass');
  m.flat(ring, ATR - 0.05, 'glass', true);
  loft(m, ring, ring, ATR - 0.05, ATR, 'glass');
}

/** Zinc mansard on the simplified ring, flat top, pointed dormers, the pavilions' lettering. */
function mansard() {
  const top = inset(MANSARD, MANS);
  loft(m, MANSARD, top, EAVE, TOP, 'slate');
  m.flat(top, TOP, 'slate');
  const cols = {frame: 'stone', roof: 'slate', glass: 'glass', mullion: 'frame'};
  // one dormer over each oriel on the long fronts (oriel fronts are the 2.46 m ring edges 0.6 m out of the chord)
  for (const [a, c] of [[R[7], R[32]], [R[38], R[63]]] as [V2, V2][]) {
    const i = MANSARD.indexOf(a), {f, len} = edgeFrame(MANSARD, i);
    const along = (p: V2) => (p[0] - f.origin[0]) * f.tangent[0] + (p[1] - f.origin[1]) * f.tangent[1];
    const out = (p: V2) => (p[0] - f.origin[0]) * f.n[0] + (p[1] - f.origin[1]) * f.n[1];
    const i0 = R.indexOf(a), i1 = R.indexOf(c);
    for (let k = Math.min(i0, i1); k < Math.max(i0, i1); k++) {
      const p = R[k], q = R[k + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (l > 2.3 && l < 2.6 && out(p) > 0.4) {
        const t = (along(p) + along(q)) / 2;
        if (t > 1 && t < len - 1) lancetDormer(m, f, {t, width: 2.1, y0: SLOPE_FOOT, ySpring: 16.3, yApex: 17.75, front: -SET_BACK, depth: 2.4, frame: 0.2}, cols, 1);
      }
    }
  }
  // pavilions: one wide lancet dormer over the risalit; BOAT&CO (north) and HOTEL (east) on a frame on the roof
  for (const [a, text] of [[R[1], 'BOAT&CO'], [R[63], 'HOTEL']] as [V2, string][]) {
    const i = MANSARD.indexOf(a), {f, len} = edgeFrame(MANSARD, i);
    lancetDormer(m, f, {t: len / 2, width: 4.4, y0: EAVE + 0.05, ySpring: 16.0, yApex: 18.7, front: 0.46, depth: 2.6, frame: 0.3}, cols, 2);
    const L = raisedLettering({text, heightM: 0.85, maxWidthM: 6.0, depthM: 0.06});
    const g = twoSidedLetters(L.geometry), t = len / 2, o = -MANS - 0.6;
    g.translate(0, TOP + 0.35 + L.heightM / 2, 0);
    g.rotateY(Math.atan2(f.n[0], f.n[1]));
    g.translate(f.origin[0] + f.tangent[0] * t + f.n[0] * o, 0, f.origin[1] + f.tangent[1] * t + f.n[1] * o);
    b.add(g, 'green');
    m.box(f, t - 3.1, t + 3.1, TOP, TOP + 0.3, o - 0.15, o - 0.02, 'greyBrick');
    for (const s of [-1, 1]) m.box(f, t + s * 2.9 - 0.04, t + s * 2.9 + 0.04, TOP, TOP + 1.3, o - 0.12, o - 0.04, 'greyBrick');
    m.box(f, t + 2.2 - 0.05, t + 2.2 + 0.05, TOP, TOP + 6.0, o - 2.0, o - 1.9, 'white');            // flagpole
  }
  // spine front on the courtyard: nine pointed dormers (2021 water-side panorama)
  {
    const i = MANSARD.indexOf(CE), {f, len} = edgeFrame(MANSARD, i);
    for (const t of even(len, 3.6, 2.6).slice(0, 9)) lancetDormer(m, f, {t, width: 1.7, y0: SLOPE_FOOT, ySpring: 16.2, yApex: 17.6, front: -SET_BACK, depth: 2.2, frame: 0.18}, cols, 1);
  }
  // the arms' SW ends: four close-set dormers each (2021/2024 street panoramas, w03-230 / w06-230)
  for (const a of [R[32], R[35]]) {
    const i = MANSARD.indexOf(a), {f, len} = edgeFrame(MANSARD, i);
    for (const t of [0.2, 0.4, 0.6, 0.8].map(k => len * k)) lancetDormer(m, f, {t, width: Math.min(1.8, len * 0.17), y0: SLOPE_FOOT, ySpring: 16.2, yApex: 17.6, front: -SET_BACK, depth: 2.2, frame: 0.18}, cols, 1);
  }
}

export function buildHotelBoatAndCo(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  m = new Mesh(tools);
  walls();
  courtyard();
  atrium();
  mansard();
  m.flush();
}
