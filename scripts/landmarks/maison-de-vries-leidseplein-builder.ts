import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, disc, getSink, ledgeStrip, put, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {cantedHead, stripedAwningOn} from './striped-awning-kit';
import source from './maison-de-vries-leidseplein-footprints.json';

/**
 * FORMER MAISON DE VRIES, Leidseplein 1-3 / Leidsestraat 103-109 (BAG pand 0363100012174479, BAG 1917; gemeentelijk monument
 * 209014, A. Jacot for Maison De Vries). Register: a department store "als van een classicistisch paleis: boven de geheel
 * gewijzigde pui zijn de forse muurdammen uitgevoerd als ionische, kolossale pilasters die een klassiek hoofdgestel dragen,
 * bekroond door een attica en een afgeplat schilddak met mastiekleien en zinkgedekte hoekpinakels. De gevels zijn wit
 * geverfd." Balustrades on the second building layer, Secession ornament in the attic lisenen, new timber infills between
 * the piers (before 1960).
 *
 * Massing: the 3DBAG LoD2.2 shell (maison-de-vries-leidseplein-footprints.json, bag-shell-prepare.ts) with its mansard,
 * the flat top at 23.6 m and the three zinc corner pinnacles to 25.3 m. Fronts read from Gemeente Amsterdam panoramas
 * (CC BY 4.0), rectified at 50 px/m, heights above the 3DBAG ground (1.37 m NAP):
 *  - Leidseplein front (ring edge 4, w02-229, 20.3 m, t from the west corner): TMX7316010203-002306_pano_0001_001396
 *    (2021-09-09, sunlit, heights and tints), TMX7316010203-001053_pano_0000_002013 (2019, 8 m away: the canted bays, the
 *    pierced bay plinths and the awnings), TMX7316010203-001660_pano_0000_000662 (2020) and
 *    TMX7316010203-002619_pano_0024_000043 (2022, the roof and skylights);
 *  - Leidsestraat front (ring edge 3, w01-323, 24.1 m, t from the north-east party wall): TMX7316010203-001053_pano_0000_002080
 *    (2019, the whole front), TMX7316010203-001674_pano_0000_002377 (2020, the corner storeys close up) and
 *    recording_2025-07-14_05-25-22_01784 (2025).
 * Both fronts: five (Leidseplein) and six (Leidsestraat) bays at a 3.8 m pitch between 1.1 m colossal pilasters; the west
 * corner is a 1.25 m pier on each face. Per item in maison-de-vries-leidseplein-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const S = src.surfaces;

/** Storey heights (w02 2021). */
const PUI_TOP = 3.65, FASCIA_TOP = 4.55, CORNICE_TOP = 4.95, BAL_TOP = 5.55;
const ROWS: [number, number][] = [[5.6, 8.0], [9.0, 11.55], [12.55, 15.0]];
/** Transom below each window head (the 2019 close view: the upper lights about 1 m tall). */
const TRANSOM = 0.98;
const ORIEL_TOP = 15.05, CAP0 = 14.7, ARCH0 = 15.5, FRIEZE0 = 15.95, CORN0 = 16.85, CORN1 = 17.5, ATTIC_TOP = 19.6;
/** Bay: 2.7 m between pilasters, a canted timber oriel with a 1.6 m front 0.55 m out, 45-degree cants. */
const HALF = 1.35, FRONT = 1.6, DEPTH = 0.55, PIL = 1.1, PIL_OUT = 0.35;
const PITCH = 3.8;

const edge = (i: number) => ringFrame(src.facadeRing, i);

export function buildMaisonDeVriesLeidseplein(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'stone', roof: 'slate', roofFor: s => (pinnacleAt(s) ? 'copper' : 'slate'), wallFor: s => (pinnacleAt(s) ? 'copper' : 'stone')});
  const sink0 = getSink();
  setSink(0.12, true);
  // Leidseplein (w02): five bays from the west corner, the striped awnings on every oriel window
  const w02 = edge(4);
  front(b, w02.f, w02.len, Array.from({length: 5}, (_, k) => 2.6 + k * PITCH), {awnings: true, cornerAt: 'start', pui: ['shop', 'door', 'shop', 'atm', 'entrance']});
  // Leidsestraat (w01): six bays from the north-east party wall to the west corner, no awnings
  const w01 = edge(3);
  front(b, w01.f, w01.len, Array.from({length: 6}, (_, k) => 2.55 + k * PITCH), {awnings: false, cornerAt: 'end', pui: ['atm', 'shop', 'shop', 'shop', 'shop', 'shop']});
  skylights(b, w02.f);
  pinnacleCaps(b);
  setSink(sink0);
}

/** The 3DBAG pinnacle boxes over the mansard (tops at 25.2-25.4 m): small surfaces wholly above the flat top. */
const PINNACLES: [number, number][] = [[-16.3, -1.25], [-7.75, 8.95], [-2.2, -12.3]];
function pinnacleAt(s: Surface) {
  const r = s.rings[0];
  if (Math.min(...r.map(p => p[1])) < 23.5) return false;
  const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[2], 0) / r.length;
  return PINNACLES.some(([x, z]) => Math.hypot(cx - x, cz - z) < 1.4);
}

type Pui = 'shop' | 'door' | 'atm' | 'entrance';

/**
 * One street front: pui, pilasters with pedestals and capitals, the canted oriels with their pierced plinths, the
 * entablature and the attic. `cornerAt` is the end of the front at the west corner; its pier is 1.25 m wide and the
 * horizontal members there run on past the corner by their own depth so the two fronts close round it.
 */
function front(b: BuildingTools, f: Frame, len: number, bays: number[], o: {awnings: boolean; cornerAt: 'start' | 'end'; pui: Pui[]}) {
  // pilaster centres between and beside the bays; the corner pier spans from the corner to its bay's edge
  const piers: {a: number; c: number}[] = [];
  piers.push({a: 0, c: bays[0] - HALF});
  for (let k = 0; k + 1 < bays.length; k++) piers.push({a: bays[k] + HALF, c: bays[k + 1] - HALF});
  piers.push({a: bays[bays.length - 1] + HALF, c: len});
  const atCorner = (p: {a: number; c: number}) => (o.cornerAt === 'start' ? p.a === 0 : p.c === len);
  // horizontal members: from s0 to s1, running past the corner by their depth on the face that owns the corner closure (w02)
  const run = (d: number): [number, number] => (o.cornerAt === 'start' ? [-d, len] : [0, len]);
  const band = (y: number, h: number, d: number, colour: string, out = 0) => { const [a, c] = run(d + out); slab(b, f, (a + c) / 2, y, c - a, h, d, colour, out); };

  pui(b, f, len, bays, piers, o.pui, run);
  band(PUI_TOP, FASCIA_TOP - PUI_TOP, 0.22, 'stone');
  band(FASCIA_TOP, 0.28, 0.4, 'stone');
  band(FASCIA_TOP + 0.28, CORNICE_TOP - FASCIA_TOP - 0.28, 0.48, 'stone');

  for (const p of piers) pilaster(b, f, p.a, p.c, atCorner(p), o.cornerAt);
  for (const [k, c] of bays.entries()) oriel(b, f, c, o.awnings, k);

  // entablature: two-fascia architrave, plain frieze, cornice (bed mould, corona, cyma)
  band(ARCH0, 0.2, 0.14, 'stone', 0);
  band(ARCH0 + 0.2, FRIEZE0 - ARCH0 - 0.2, 0.2, 'stone', 0);
  band(FRIEZE0, CORN0 - FRIEZE0, 0.08, 'stone', 0);
  band(CORN0, 0.2, 0.32, 'stone');
  band(CORN0 + 0.2, 0.33, 0.68, 'stone');
  band(CORN0 + 0.53, CORN1 - CORN0 - 0.53, 0.58, 'stone');
  attic(b, f, len, bays, piers, run);
}

/** The ground storey: piers under the pilasters with the dark plinth, and one opening per bay. */
function pui(b: BuildingTools, f: Frame, len: number, bays: number[], piers: {a: number; c: number}[], kinds: Pui[], run: (d: number) => [number, number]) {
  // piers 0.15 m narrower than the pilasters on each side (w02 2021: the openings 2.9 m wide)
  for (const p of piers) {
    const a = p.a === 0 ? run(0.3)[0] : p.a + 0.12, c = p.c === len ? len : p.c - 0.12;
    slab(b, f, (a + c) / 2, 0, c - a, PUI_TOP, 0.25, 'stone');
    // the dark plinth 5 cm inside the pier's edges (no side face on the pier's side planes)
    slab(b, f, (a + c) / 2, 0, c - a - 0.1, 0.9, 0.31, 'dark');
  }
  for (const [k, c] of bays.entries()) {
    // the opening fills the gap between the piers less 2 cm a side (no side faces on the piers' side planes)
    const w = 2 * HALF + 0.2, kind = kinds[k];
    if (kind === 'atm') {
      // the grey cash-machine panel with its louvre head and two screens (w02 bay 4, w01 bay 1)
      slab(b, f, c, 0, w, PUI_TOP, 0.08, 'greyBrick');
      for (const s of [-0.62, 0.62]) slab(b, f, c + s, 1.25, 0.42, 0.55, 0.06, 'dark', 0.08);
      slab(b, f, c, 2.85, w - 0.1, 0.06, 0.06, 'dark', 0.08);
      continue;
    }
    if (kind === 'entrance') {
      // recessed dark glazed entrance (w02 bay 5)
      slab(b, f, c, 0, w, PUI_TOP, 0.06, 'dark');
      slab(b, f, c, 0.4, w - 0.5, PUI_TOP - 0.5, 0.06, 'glass', 0.06);
      continue;
    }
    // shop window or glazed doors: dark frame, glass, a transom at 2.95 m
    slab(b, f, c, 0, w, PUI_TOP, 0.06, 'dark');
    slab(b, f, c, 0.4, w - 0.16, PUI_TOP - 0.5, 0.06, 'glass', 0.06);
    slab(b, f, c, 2.92, w - 0.16, 0.08, 0.06, 'dark', 0.12);
    if (kind === 'door') for (const s of [-0.62, 0, 0.62]) slab(b, f, c + s, 0.4, 0.07, 2.5, 0.06, 'dark', 0.12);
  }
}

/** Colossal pilaster from the cornice of the pui to the architrave: pedestal, shaft, simplified Ionic capital. */
function pilaster(b: BuildingTools, f: Frame, a: number, c: number, corner: boolean, cornerAt: 'start' | 'end') {
  // the corner pier on w02 runs on past the corner by each part's own projection (it closes the corner); on w01 it stops there
  const part = (y: number, h: number, d: number, grow = 0) => {
    const a0 = corner && cornerAt === 'start' ? a - d : a - grow / 2, c0 = corner && cornerAt === 'end' ? c : c + grow / 2;
    slab(b, f, (a0 + c0) / 2, y, c0 - a0, h, d, 'stone');
  };
  part(CORNICE_TOP, BAL_TOP - CORNICE_TOP + 0.1, PIL_OUT + 0.1);
  part(BAL_TOP + 0.1, CAP0 - BAL_TOP - 0.1, PIL_OUT);
  // capital: echinus band, volutes on the open sides, abacus
  part(CAP0, 0.25, PIL_OUT + 0.06, 0.06);
  const vols = corner ? (cornerAt === 'start' ? [c - 0.25] : [a + 0.25]) : [a + 0.2, c - 0.2];
  for (const v of vols) disc(b, f, v, CAP0 + 0.42, 0.2, 0.08, 'stone', PIL_OUT + 0.06);
  part(CAP0 + 0.62, ARCH0 - CAP0 - 0.62, PIL_OUT + 0.14, 0.2);
}

/** A frame on the segment (ta, oa) -> (tb, ob) given in the parent frame's (t, out); n points away from the parent wall. */
function sub(f: Frame, ta: number, oa: number, tb: number, ob: number): Frame {
  const L = Math.hypot(tb - ta, ob - oa), dt = (tb - ta) / L, dout = (ob - oa) / L;
  const w = (t: number, o: number): [number, number] => [f.tangent[0] * t + f.n[0] * o, f.tangent[1] * t + f.n[1] * o];
  const p = w(ta, oa);
  return {origin: [f.origin[0] + p[0], f.origin[1] + p[1]], tangent: w(dt, dout), n: w(-dout, dt)};
}

/** Vertical prism on the wall: `plan` in (t, out) about t = c, from y to y + h. */
function prism(b: BuildingTools, f: Frame, c: number, plan: [number, number][], y: number, h: number, colour: string) {
  const g = new T.ExtrudeGeometry(new T.Shape(plan.map(([x, z]) => new T.Vector2(x, -z))), {depth: h, bevelEnabled: false});
  g.rotateX(-Math.PI / 2);
  put(b, f, g, c, y, 0, colour);
}

/**
 * The canted timber oriel of one bay (2019 close view): its pierced plinth with seven small round-headed openings on the
 * front and two on each cant, three storeys of windows (a wide light on the front, a narrow one on each cant, transoms),
 * fluted spandrel panels between the storeys, a cap under the capitals; on the Leidseplein a striped markies over every
 * window.
 */
function oriel(b: BuildingTools, f: Frame, c: number, awnings: boolean, k: number) {
  // the plan's back corners lean in (no side face on the pilasters' side planes)
  const plan = (d: number, e = 0): [number, number][] => [[-HALF + 0.06, -0.2], [HALF - 0.06, -0.2], [HALF, 0], [FRONT / 2 + e, d], [-FRONT / 2 - e, d], [-HALF, 0]];
  // plinth (stone) and the bay body (painted timber, white), and the cap a little larger than the bay
  prism(b, f, c, plan(DEPTH), CORNICE_TOP, BAL_TOP - CORNICE_TOP, 'stone');
  prism(b, f, c, plan(DEPTH), BAL_TOP, ORIEL_TOP - BAL_TOP, 'white');
  prism(b, f, c, plan(DEPTH + 0.07, 0.03), ORIEL_TOP, 0.12, 'white');
  const faces = [
    {g: sub(f, c - HALF, 0, c - FRONT / 2, DEPTH), cant: true},
    {g: sub(f, c - FRONT / 2, DEPTH, c + FRONT / 2, DEPTH), cant: false},
    {g: sub(f, c + FRONT / 2, DEPTH, c + HALF, 0), cant: true},
  ];
  const cw = Math.hypot(HALF - FRONT / 2, DEPTH);
  for (const {g, cant} of faces) {
    const w = cant ? cw : FRONT, mid = w / 2;
    // the pierced plinth: dark round-headed openings standing 5 cm proud of its face
    const n = cant ? 2 : 7, pitch = (w - 0.2) / n;
    for (let i = 0; i < n; i++) archSlab(b, g, 0.1 + pitch * (i + 0.5), CORNICE_TOP + 0.14, Math.min(0.09, pitch * 0.5), 0.3, 0.05, 'dark', 0, 3);
    slab(b, g, mid, BAL_TOP - 0.08, w - 0.02, 0.1, 0.08, 'stone');
    for (const [y0, y1] of ROWS) {
      // window: glass behind the frame, corner posts, transom and (front) the frame of the wide light
      const gw = w - (cant ? 0.2 : 0.26);
      slab(b, g, mid, y0, gw, y1 - y0, 0.06, 'glass');
      slab(b, g, mid, y1 - TRANSOM, gw, 0.08, 0.12, 'white');
      slab(b, g, mid, y0 - 0.08, w - 0.04, 0.1, 0.14, 'white');
      if (!cant) for (const s of [-0.42, 0.42]) slab(b, g, mid + s, y0, 0.07, y1 - y0, 0.12, 'white');
    }
    // fluted spandrel panels between the storeys: thin vertical ribs 5 cm proud
    for (const [y0, y1] of [[ROWS[0][1], ROWS[1][0]], [ROWS[1][1], ROWS[2][0]]] as [number, number][]) {
      const ribs = Math.max(2, Math.round((w - 0.1) / 0.13));
      for (let i = 0; i < ribs; i++) ledgeStrip(b, g, 0.05 + (w - 0.1) * (i + 0.5) / ribs, y0 + 0.08, 0.035, y1 - y0 - 0.16, 0.05, 'white');
    }
  }
  if (!awnings) return;
  // the striped markies over each window: head on the bay at the window head, cloth 0.3 m out and 0.4 m down, scalloped
  // valance, side cheeks hanging 0.9 m against the cants (2019 close view)
  const head = cantedHead(c, HALF - 0.06, FRONT + 0.06, DEPTH + 0.03);
  for (const [, y1] of ROWS) stripedAwningOn(b, f, {head, yHead: y1 + 0.06, drop: 0.4, proj: 0.3, endProj: 0.3, stripe: 0.13, valance: 0.12, scallop: 0.07, cheeks: true, cheekHem: y1 + 0.06 - 0.9, colours: ['blue', 'white']});
  void k;
}

/**
 * The attic (17.5-19.6 m): its wall standing up in front of the mansard, the lisenen over the pilasters with their
 * Secession ribs and squares, three small windows per bay, the coping.
 */
function attic(b: BuildingTools, f: Frame, len: number, bays: number[], piers: {a: number; c: number}[], run: (d: number) => [number, number]) {
  const [a0, a1] = run(0.3), [c0, c1] = run(0.36);
  slab(b, f, (a0 + a1) / 2, CORN1, a1 - a0, ATTIC_TOP - 0.2 - CORN1, 0.3, 'stone');
  slab(b, f, (c0 + c1) / 2, ATTIC_TOP - 0.2, c1 - c0, 0.2, 0.36, 'stone');
  for (const p of piers) {
    // over each pilaster; a pier at either end spans its whole width, and the w02 corner lisene runs on past the corner
    const end = p.a === 0 || p.c === len;
    const s0 = p.a === 0 && a0 < 0 ? -0.5 : end ? p.a : (p.a + p.c) / 2 - 0.55, s1 = end ? p.c : (p.a + p.c) / 2 + 0.55;
    slab(b, f, (s0 + s1) / 2, CORN1, s1 - s0, ATTIC_TOP - CORN1 + 0.12, 0.5, 'stone');
  }
  // trim in front of the attic is not sunk: the mansard starts at 18.5 m just behind the wall line
  const sink = getSink();
  setSink(0);
  for (const p of piers) {
    // the ornament: four thin vertical grooves-as-ribs ending in small squares (w02 2021), centred on the lisene's face
    const c = p.a === 0 ? p.c - 0.55 : p.c === len ? p.a + 0.45 : (p.a + p.c) / 2;
    for (const s of [-0.22, -0.075, 0.075, 0.22]) {
      ledgeStrip(b, f, c + s, 18.1, 0.04, 0.72, 0.05, 'white', 0.5);
      slab(b, f, c + s, 17.92, 0.1, 0.1, 0.06, 'white', 0.5);
    }
  }
  for (const c of bays) for (const s of [-0.8, 0, 0.8]) {
    slab(b, f, c + s, 17.66, 0.5, 0.9, 0.06, 'glass', 0.3);
    slab(b, f, c + s, 17.6, 0.6, 0.07, 0.12, 'white', 0.3);
  }
  setSink(sink, true);
}

/** Three large skylights on the Leidseplein slope of the mansard (2022 view), 12 cm over the 3DBAG roof plane. */
function skylights(b: BuildingTools, f: Frame) {
  const at = (t: number, back: number): T.Vector3 | null => {
    const x = f.origin[0] + f.tangent[0] * t - f.n[0] * back, z = f.origin[1] + f.tangent[1] * t - f.n[1] * back;
    const y = roofHeightAt(S, x, z);
    return y === null ? null : new T.Vector3(x, y + 0.12, z);
  };
  for (const [t0, t1] of [[3.3, 6.7], [8.2, 10.2], [11.5, 15.0]]) {
    const q = [at(t0, 1.0), at(t1, 1.0), at(t1, 2.3), at(t0, 2.3)];
    if (q.some(p => p === null)) continue;
    const [p0, p1, p2, p3] = q as T.Vector3[];
    // one winding, facing up (the export's materials are double-sided)
    const up = p1.clone().sub(p0).cross(p2.clone().sub(p0)).y > 0;
    const g = new T.BufferGeometry().setFromPoints(up ? [p0, p1, p2, p0, p2, p3] : [p0, p2, p1, p0, p3, p2]);
    g.computeVertexNormals();
    b.add(g, 'glass' as never);
  }
}

/** Moulded caps and low pyramids on the zinc corner pinnacles (register: zinkgedekte hoekpinakels; w02 2021). */
function pinnacleCaps(b: BuildingTools) {
  for (const [x, z] of PINNACLES) {
    const top = roofHeightAt(S, x, z);
    if (top === null || top < 24.5) continue;
    b.add(new T.BoxGeometry(1.5, 0.16, 1.5).translate(x, top + 0.08, z), 'copper' as never);
    b.add(new T.ConeGeometry(0.75, 0.5, 4).rotateY(Math.PI / 4).translate(x, top + 0.16 + 0.25, z), 'copper' as never);
  }
}
