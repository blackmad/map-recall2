import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {compileLargeBuilding, type CompiledLargeBuilding, type LargeCompileHooks} from '../../src/canalRecall/buildingRecipe/largeCompile';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent';
import {largeSurfaceSet} from '../../src/canalRecall/buildingRecipe/fitLarge';
import {barQuad, drawOpening, type PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {recess} from '../../src/canalRecall/blockBuilding/components';
import {letteringGeometry} from '../../src/canalRecall/buildingRecipe/signage';
import {fitsPanel, newell, rectPoly, type Panel} from '../../src/canalRecall/blockBuilding/panels';
import {dot, norm, sub} from '../../src/canalRecall/blockBuilding/mesh';
import type {WinParams} from '../../src/canalRecall/blockBuilding/spec';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';
import intentJson from './hoofdbureau-elandsgracht-intent.json';
import factsJson from './hoofdbureau-elandsgracht-facts.json';
import facadesJson from './hoofdbureau-elandsgracht-facades.json';

/**
 * Hoofdbureau van Politie, Elandsgracht 117 (BAG 0363100012169550, 1941; city public works). A hybrid builder:
 *
 *  - massing: the 3DBAG LoD2.2 walls and roofs verbatim, through the large-tier fit and block-kit compose
 *    (`compileLargeBuilding`), one facade system per wall group of scripts/landmarks/hoofdbureau-elandsgracht-intent.json;
 *  - every photographed front that the facade systems cannot express is drawn here, in its own 3DBAG panel's frame, from the
 *    measurements in scripts/landmarks/hoofdbureau-elandsgracht-facades.json (rectified panorama crops read on a metre grid):
 *    the Elandsgracht end wall (open ground storey on columns, round windows, Hildo Krop's three figures, the banner and the
 *    Amsterdam arms), the open corner bay and main entrance with POLITIE and the police emblem on the Marnixstraat front, the
 *    Marnixstraat end block (ground hall behind a corner column, window block with its balcony, ledge, glazed top under a bowed
 *    roof slab, the police sign), the tall Singelgracht end with four balconies, the pink quay front with its stone pair, the
 *    stair bay and framed bay, the portholes and vehicle gate, white stone hoods, chequer panels and barred basement windows.
 *
 * Every part is block-kit mesh with a material slot (no free geometry, no anchors). Local frame = the large tier's: x east,
 * z south, y up from the 3DBAG ground, origin the BAG footprint centroid.
 */
const FACTS = factsJson as unknown as BuildingFacts;
const SET = largeSurfaceSet(FACTS).set;
/** 3DBAG wall surfaces (one per hooded wall group of the intent) of the 1941 south-east fronts with white stone window hoods. */
const HOOD_SURFACES = [41, 216, 53];
/** The photographed 1941 front (w07) whose chequer panels and barred basement windows are drawn. */
const CHEQUER_SURFACES = [41, 8];

/** MeshBuilder slot materialSlot (recipe) -> landmark palette name. */
const PALETTE: Record<string, 'brick' | 'stone' | 'glass' | 'frame' | 'dark' | 'blue' | 'white' | 'slate'> = {
  brick: 'brick', stucco: 'white', stone: 'stone', glass: 'glass', frame: 'frame', door: 'dark', accent: 'blue', slate: 'slate', roofTile: 'slate', bitumen: 'slate',
};
/** block-kit slots by role (largeMaterialSlot maps them to recipe material slots, PALETTE to colours) */
const WHITE = 'police-white', BLUE = 'police-blue', DARK = 'door', RAIL = 'frame';
/** glazing bars, doors and inner panels stand 4 cm in front of the glass as closed boxes (the kit's 1.5 cm bars z-fight with
 *  it at range; 3 cm is the audit's minimum clearance, 5 cm the block-kit attachment limit) */
const BAR = 0.04;

type Facades = typeof facadesJson.walls;
const F: Facades = facadesJson.walls;

export interface HoofdbureauStats {
  triangles: number; hoods: number; chequers: number; basements: number; openings: number; failed: string[];
  drawn: string[];
}

/** surfaces of a panel (3DBAG LoD2.2 boundary indices) */
const surfacesOf = (p: Panel) => p.walls.map(k => SET.walls[k]?.surface ?? -1);
const has = (p: Panel, s: number) => surfacesOf(p).includes(s);

/** A closed box in the panel's frame (`PanelCtx.box` adds its back only with closedBoxes; a free-standing part always needs it). */
function solid(c: PanelCtx, slot: string, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number, part: number) {
  c.box(slot, u0, u1, v0, v1, d0, d1, part);
  if (!c.closedBoxes) c.mesh.quad(slot, c.P(u0, v0, d0), c.P(u1, v0, d0), c.P(u1, v1, d0), c.P(u0, v1, d0), part, [-c.p.n[0], -c.p.n[1], -c.p.n[2]]);
}

/** A three.js geometry built in the wall's frame (x along u, y = v, z out of the wall = d) at (u, v, d); x/y/z -> r/up/n keeps the winding. */
function geom(c: PanelCtx, slot: string, g: T.BufferGeometry, u: number, v: number, d: number, part = c.part()) {
  const src = g.index ? g.toNonIndexed() : g, a = src.getAttribute('position');
  for (let i = 0; i < a.count; i += 3) {
    const q = [0, 1, 2].map(k => c.P(u + a.getX(i + k), v + a.getY(i + k), d + a.getZ(i + k)));
    c.mesh.tri(slot, q[0], q[1], q[2], part);
  }
  return part;
}

/** Extrude a shape drawn in (x along the wall, y up) `depth` out of the wall. */
const extrude = (shape: T.Shape, depth: number, curveSegments = 8) => new T.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments});
/** A plan shape (x along the wall, y = out of the wall) extruded `h` up: a slab whose back edge lies on the wall. */
const slab = (shape: T.Shape, h: number) => extrude(shape, h).rotateX(-Math.PI / 2).scale(1, 1, -1);

/** Mirror a geometry in x and keep its faces outward. */
function mirrorX(g: T.BufferGeometry) {
  const m = (g.index ? g.toNonIndexed() : g).clone();
  m.scale(-1, 1, 1);
  const a = m.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < a.count; i += 3) for (let k = 0; k < 3; k++) { const t = a.getComponent(i + 1, k); a.setComponent(i + 1, k, a.getComponent(i + 2, k)); a.setComponent(i + 2, k, t); }
  return m;
}
/** slab() flips z: fix the winding the same way */
const flipWinding = (g: T.BufferGeometry) => { const m = (g.index ? g.toNonIndexed() : g).clone(); const a = m.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < a.count; i += 3) for (let k = 0; k < 3; k++) { const t = a.getComponent(i + 1, k); a.setComponent(i + 1, k, a.getComponent(i + 2, k)); a.setComponent(i + 2, k, t); } return m; };

/** A measured window cut into the wall (recessed 0.18 m by the kit, glass back, frame ring, bars BAR in front of the glass). */
function opening(c: PanelCtx, stats: HoofdbureauStats, what: string, u0: number, u1: number, v0: number, v1: number, w: WinParams) {
  const back = drawOpening(c, u0, u1, v0, v1, {frameW: 0.06, sillSlot: null, headSlot: null, ...w}, 1);
  if (back === null || back > 0) stats.failed.push(`${what}${back === null ? '' : ' (proud, not cut)'} u ${u0.toFixed(2)}..${u1.toFixed(2)} v ${v0.toFixed(2)}..${v1.toFixed(2)}`); else stats.openings++;
  return back;
}
/** fractions for bars on a pitch across a width */
const pitchBars = (width: number, pitch: number) => { const n = Math.max(1, Math.round(width / pitch)); return Array.from({length: n - 1}, (_, k) => (k + 1) / n); };

/** Cylinder standing from v0 to v1 at (u, d). */
const column = (c: PanelCtx, slot: string, u: number, d: number, v0: number, v1: number, r: number, seg = 12) =>
  geom(c, slot, new T.CylinderGeometry(r, r, v1 - v0, seg, 1), u, (v0 + v1) / 2, d);

/** A deep cut into the wall (open ground storey, void, gate): reveals in the wall slot, a back plane in `backSlot`. */
function deepRecess(c: PanelCtx, stats: HoofdbureauStats, what: string, u0: number, u1: number, v0: number, v1: number, depth: number, backSlot: string) {
  const a = Math.max(u0, c.p.uMin + 0.05), b = Math.min(u1, c.p.uMax - 0.05);
  const r = recess(c, a, b, v0, v1, depth, backSlot);
  if (!r) stats.failed.push(`${what} recess u ${a.toFixed(2)}..${b.toFixed(2)} v ${v0}..${v1}`); else stats.drawn.push(what);
  return r ? {...r, u0: a, u1: b} : null;
}

/** A standing figure (robe, chest, arms, head) on a console top at v, centred d out of the wall. */
function figure(c: PanelCtx, slot: string, u: number, v: number, d: number, h: number, wide = 1) {
  const k = h / 2.25, part = c.part();
  geom(c, slot, new T.CylinderGeometry(0.22 * k * wide, 0.27 * k * wide, 1.2 * k, 10), u, v + 0.6 * k, d, part);          // legs and robe
  geom(c, slot, new T.CylinderGeometry(0.29 * k * wide, 0.22 * k * wide, 0.55 * k, 10), u, v + 1.47 * k, d, part);        // chest and shoulders
  for (const side of [-1, 1]) geom(c, slot, new T.BoxGeometry(0.12 * k, 0.8 * k, 0.14 * k), u + side * 0.32 * k * wide, v + 1.25 * k, d + 0.02, part);
  geom(c, slot, new T.CylinderGeometry(0.06 * k, 0.07 * k, 0.12 * k, 8), u, v + 1.8 * k, d, part);                           // neck
  geom(c, slot, new T.SphereGeometry(0.16 * k, 10, 8), u, v + 2.0 * k, d, part);                                              // head
  return part;
}

/** Ring (stone surround) with a dark glass disc, round window on the wall. */
function roundWindow(c: PanelCtx, u: number, v: number, outer: number, glass: number) {
  const part = c.part(), tube = (outer - glass) / 4;
  geom(c, WHITE, new T.TorusGeometry(glass / 2 + tube, tube, 4, 14), u, v, 0.03, part);
  geom(c, DARK, new T.CylinderGeometry(glass / 2 + 0.01, glass / 2 + 0.01, 0.04, 14).rotateX(Math.PI / 2), u, v, 0.03, part);
}

/**
 * Stroke-font lettering (the kit's `letteringGeometry`) as closed solids from the wall out to `d`: front faces, back faces
 * on the wall and a side wall on every outline edge, so the letters leave no open edge and stand clear of the wall plane.
 */
function solidLettering(c: PanelCtx, text: string, uc: number, vc: number, d: number, heightM: number, maxWidthM: number, slot: string) {
  const L = letteringGeometry({text, heightM, maxWidthM}), pos = L.positions, part = c.part();
  const key = (x: number, y: number) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;
  const edges = new Map<string, {n: number; a: [number, number]; b: [number, number]}>();
  for (let i = 0; i < pos.length; i += 9) {
    const t: [number, number][] = [[pos[i], pos[i + 1]], [pos[i + 3], pos[i + 4]], [pos[i + 6], pos[i + 7]]];
    // winding in (u, v): counter-clockwise faces the viewer
    const ccw = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0]) > 0, o = ccw ? t : [t[0], t[2], t[1]] as [number, number][];
    if (Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0])) < 1e-10) continue;
    const P = (q: [number, number], dd: number) => c.P(uc + q[0], vc + q[1], dd);
    c.mesh.tri(slot, P(o[0], d), P(o[1], d), P(o[2], d), part);
    c.mesh.tri(slot, P(o[0], 0), P(o[2], 0), P(o[1], 0), part);
    for (let k = 0; k < 3; k++) {
      const a = o[k], b = o[(k + 1) % 3], ka = key(...a), kb = key(...b), k2 = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const e = edges.get(k2) ?? {n: 0, a, b}; e.n++; edges.set(k2, e);
    }
  }
  // outline edges (used once): a side quad, outward = to the right of the counter-clockwise edge
  for (const e of edges.values()) if (e.n === 1) c.mesh.quad(slot, c.P(uc + e.a[0], vc + e.a[1], 0), c.P(uc + e.b[0], vc + e.b[1], 0), c.P(uc + e.b[0], vc + e.b[1], d), c.P(uc + e.a[0], vc + e.a[1], d), part);
  return part;
}

// ---- walls ---------------------------------------------------------------------------------------------------------------

/** w16: the Elandsgracht end wall of the Marnixstraat wing. */
function endWall(c: PanelCtx, stats: HoofdbureauStats, s: Record<string, string>) {
  const W = F['w16-337'], U = (x: number) => x + W.sToU, g = W.openGround;
  // Open ground storey: a real recess (back wall in brick), the slab edge over it, four white columns at the facade line.
  const r = deepRecess(c, stats, 'w16 open ground storey', c.p.uMin, c.p.uMax, 0.05, g.top, g.depth, s.wall);
  solid(c, s.stone, c.p.uMin + 0.05, c.p.uMax - 0.05, g.slab[0], g.slab[1], 0, 0.08, c.part());
  if (r) for (const x of g.columns) column(c, WHITE, U(x), -0.35, 0.05, g.top, g.columnDiameter / 2);
  // Six round windows.
  for (const x of W.roundWindows.s) roundWindow(c, U(x), W.roundWindows.y, W.roundWindows.outerDiameter, W.roundWindows.glassDiameter);
  // Krop's three figures on their consoles.
  const fg = W.figures;
  for (const x of fg.s) {
    const part = c.part();
    solid(c, s.stone, U(x) - fg.consoleWidth / 2, U(x) + fg.consoleWidth / 2, fg.console[0], fg.console[1], 0, 0.5, part);
    figure(c, WHITE, U(x), fg.console[1], 0.27, fg.figure[1] - fg.figure[0]);
  }
  // The banner: a ribbon the measured band wide along the measured centreline, curling down at both ends.
  const b = W.banner, bw = b.band[1] - b.band[0];
  const pts = new T.CatmullRomCurve3(b.centreline.map(([x, y]) => new T.Vector3(U(x), y, 0))).getPoints(36);
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy);
    // the curls cross over themselves: alternate the front 3 cm so no two faces share a plane
    geom(c, WHITE, new T.BoxGeometry(l + 0.03, bw, 0.12 + 0.03 * (i % 3)).rotateZ(Math.atan2(dy, dx)), (p.x + q.x) / 2, (p.y + q.y) / 2, (0.12 + 0.03 * (i % 3)) / 2);
  }
  // The arms: crowned shield (pale with three saltires) held by two rampant lions standing on the banner.
  const A = W.arms, sc = U(A.shieldCentreS), sh = A.shieldTop - A.shieldPoint, k = sh / 2.3, sw = A.shieldWidth / 1.7;
  const shield = new T.Shape();
  shield.moveTo(-0.85, 1.05); shield.lineTo(0.85, 1.05); shield.lineTo(0.85, -0.2);
  shield.quadraticCurveTo(0.85, -0.95, 0, -1.25); shield.quadraticCurveTo(-0.85, -0.95, -0.85, -0.2); shield.lineTo(-0.85, 1.05);
  const sy = A.shieldTop - 1.05 * k, arms = c.part();
  geom(c, WHITE, extrude(shield, 0.22).scale(sw, k, 1), sc, sy, 0, arms);
  geom(c, s.stone, new T.BoxGeometry(0.5 * sw, 2.15 * k, 0.06), sc, sy - 0.1 * k, 0.25, arms);                        // the pale
  for (const dy of [0.62, 0, -0.62]) for (const rot of [Math.PI / 4, -Math.PI / 4]) geom(c, WHITE, new T.BoxGeometry(0.46 * sw, 0.09, 0.05).rotateZ(rot), sc, sy + dy * k, 0.3, arms);
  const crownBase = A.shieldTop + 0.05, ch = A.crownTop - crownBase;
  geom(c, WHITE, new T.CylinderGeometry(0.5, 0.5, 0.2 * ch, 16), sc, crownBase + 0.1 * ch, 0.3, arms);              // crown band
  geom(c, WHITE, new T.SphereGeometry(0.46, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55 * ch / 0.46, 1), sc, crownBase + 0.2 * ch, 0.3, arms);
  geom(c, WHITE, new T.BoxGeometry(0.08, 0.3 * ch, 0.08), sc, A.crownTop - 0.15 * ch, 0.3, arms);                    // orb cross
  geom(c, WHITE, new T.BoxGeometry(0.24, 0.07, 0.08), sc, A.crownTop - 0.12 * ch, 0.3, arms);
  const lion = new T.Shape();
  [[0, 0], [0.55, 0], [0.7, 0.55], [0.95, 0.95], [0.95, 1.6], [1.25, 2.0], [1.2, 2.45], [1.45, 2.6], [1.5, 2.95], [1.15, 3.15],
    [0.8, 3.0], [0.6, 2.55], [0.25, 2.3], [0.15, 1.6], [-0.35, 1.9], [-0.55, 2.45], [-0.4, 1.6], [0.05, 1.05], [-0.15, 0.45], [0, 0]]
    .forEach(([x, y], i) => i ? lion.lineTo(x, y) : lion.moveTo(x, y));
  // authored 2.05 x 3.15; measured 2.5 x (lionTop - lionFoot)
  const [l0, l1] = A.lionsS[0], lx = (l1 - l0) / 2.05, ly = (A.lionTop - A.lionFoot) / 3.15;
  const left = extrude(lion, 0.3).scale(lx, ly, 1);
  geom(c, WHITE, left, U(l0) + 0.55 * lx, A.lionFoot, 0, arms);
  geom(c, WHITE, mirrorX(left), U(A.lionsS[1][1]) - 0.55 * lx, A.lionFoot, 0, arms);
  stats.drawn.push('w16 end wall: arms, banner, figures, round windows, colonnade');
}

/** w22 and the Marnixstraat front w02: the open corner bay, the entrance with POLITIE and the emblem. */
function marnixFront(c: PanelCtx, stats: HoofdbureauStats, s: Record<string, string>) {
  const p = c.p;
  if (has(p, 167)) {
    const r = deepRecess(c, stats, 'w22 open ground storey', p.uMin, p.uMax, 0.05, F['w22-246'].openGround.top, F['w22-246'].openGround.depth, s.wall);
    if (r) solid(c, s.stone, p.uMin + 0.05, p.uMax - 0.05, F['w22-246'].openGround.top, F['w22-246'].openGround.top + 0.45, 0, 0.08, c.part());
    return;
  }
  const W = F['w02-67'], off = has(p, 233) ? W.surfaces['233'] : has(p, 72) ? W.surfaces['72'] : null;
  if (off === null) return;
  const U = (x: number) => x + off, og = W.openGround;
  // open corner bay on columns
  const from = Math.max(U(og.from), p.uMin);
  const r = deepRecess(c, stats, `w02 open ground storey (surface ${has(p, 233) ? 233 : 72})`, from, p.uMax, 0.05, og.top, og.depth, s.wall);
  if (r) {
    solid(c, s.stone, r.u0, r.u1, og.top, og.top + 0.45, 0, 0.08, c.part());
    for (const x of og.columns) if (U(x) > r.u0 + 0.4 && U(x) < r.u1 - 0.4) column(c, WHITE, U(x), -0.4, 0.05, og.top, og.columnDiameter / 2);
  }
  if (!has(p, 233)) return;
  // main entrance: recessed glazed doors, side light, the white lintel band, POLITIE in police blue with the emblem over the O
  const e = W.entrance, er = recess(c, U(e.s[0]), U(e.s[1]), e.y[0], e.y[1], 0.6, s.glass);
  if (er) {
    const bars = c.part(), q = (a: number, b: number, lo: number, hi: number, slot: string) => barQuad(c, slot, er.Q, a, b, lo, hi, er.back, er.back + BAR, bars);
    const a = U(e.s[0]), b = U(e.s[1]), mid = (a + b) / 2;
    q(a, b, e.y[0], e.y[0] + 0.08, s.frame); q(a, b, e.y[1] - 0.08, e.y[1], s.frame); q(a, a + 0.08, e.y[0] + 0.08, e.y[1] - 0.08, s.frame); q(b - 0.08, b, e.y[0] + 0.08, e.y[1] - 0.08, s.frame);
    q(mid - 1.0, mid + 1.0, e.y[0] + 0.08, e.y[0] + 2.4, DARK); q(a + 0.08, b - 0.08, 2.45, 2.53, s.frame);
    stats.drawn.push('w02 entrance');
  } else stats.failed.push('w02 entrance');
  opening(c, stats, 'w02 side light', U(e.s[1] + 0.7), U(e.lintel.s[1] - 0.2), 0.6, e.y[1], {frame: s.frame, glass: s.glass, mullAt: [0.5], rowsAt: [0.7]});
  solid(c, WHITE, U(e.lintel.s[0]), U(e.lintel.s[1]), e.lintel.y[0], e.lintel.y[1], 0, e.lintel.out, c.part());
  const L = W.lettering, ls = U((L.s[0] + L.s[1]) / 2);
  solidLettering(c, L.text, ls, (L.y[0] + L.y[1]) / 2, 0.06, L.y[1] - L.y[0], L.s[1] - L.s[0], BLUE);
  // police emblem: a blue shield with a white flame, over the O
  const em = L.emblem, eh = em.y[1] - em.y[0], ew = em.s[1] - em.s[0], badge = new T.Shape(), flame = new T.Shape();
  badge.moveTo(-0.5, 0.45); badge.lineTo(0.5, 0.45); badge.lineTo(0.5, -0.05); badge.quadraticCurveTo(0.45, -0.38, 0, -0.55); badge.quadraticCurveTo(-0.45, -0.38, -0.5, -0.05); badge.lineTo(-0.5, 0.45);
  flame.moveTo(0, 0.32); flame.quadraticCurveTo(0.22, 0.02, 0.1, -0.3); flame.lineTo(-0.1, -0.3); flame.quadraticCurveTo(-0.22, 0.02, 0, 0.32);
  const part = c.part(), eu = U((em.s[0] + em.s[1]) / 2), ev = (em.y[0] + em.y[1]) / 2 + 0.1 * eh;
  geom(c, BLUE, extrude(badge, 0.06).scale(ew, eh, 1), eu, ev, 0, part);
  geom(c, WHITE, extrude(flame, 0.03).scale(ew, eh, 1), eu, ev, 0.06, part);
  stats.drawn.push('w02 POLITIE lettering and emblem');
}

/** w15: the Marnixstraat end block at the Elandsgracht corner. */
function cornerBlock(c: PanelCtx, stats: HoofdbureauStats, s: Record<string, string>) {
  // w15's heights in the facades file are already registered (yShift is recorded there, not applied again)
  const W = F['w15-67'], U = (x: number) => x + W.sToU, Y = (y: number) => y;
  const p = c.p, gh = W.groundHall;
  // Ground hall behind the corner column: glazed back, door pair, transom, the column under the corner pier.
  const r = deepRecess(c, stats, 'w15 ground hall', U(gh.s[0]), Math.min(U(gh.s[1]), p.uMax - 0.06), gh.y[0], gh.y[1], gh.depth, s.glass);
  if (r) {
    const bars = c.part(), q = (a: number, b: number, lo: number, hi: number, slot: string) => barQuad(c, slot, r.Q, a, b, lo, hi, r.back, r.back + BAR, bars);
    q(r.u0, r.u1, gh.glass[0] - 0.08, gh.glass[0], s.frame); q(r.u0, r.u1, 3.0, 3.07, s.frame);
    for (let x = r.u0 + 1.4; x < U(gh.doors[0]) - 0.3; x += 1.4) q(x - 0.04, x + 0.04, gh.glass[0], gh.y[1] - 0.05, s.frame);
    q(U(gh.doors[0]), U(gh.doors[1]), gh.y[0] + 0.02, gh.glass[0] - 0.08, s.wall);   // stair block under the doors (inside)
    q(U(gh.doors[0]) + 0.4, U(gh.doors[0]) + 2.2, gh.glass[0], gh.glass[0] + 2.2, DARK);
    column(c, WHITE, U(gh.column.s), -0.3, gh.y[0], gh.y[1], gh.column.diameter / 2);
  }
  solid(c, WHITE, U(gh.s[0]), U(W.windowBlock.s[1]), gh.lintel[0], gh.lintel[1], 0, 0.08, c.part());
  // Two-storey window block: four lights per storey between white piers, a white spandrel and head band.
  const wb = W.windowBlock, cols: [number, number][] = [];
  let x0 = wb.s[0] + 0.1;
  for (const [a, b] of wb.piers) { cols.push([x0, a]); x0 = b; }
  cols.push([x0, wb.s[1] - 0.1]);
  for (const [lo, hi] of [wb.lower, wb.upper]) for (const [a, b] of cols) opening(c, stats, 'w15 window', U(a), U(b), Y(lo) + 0.02, Y(hi) - 0.02, {frame: s.frame, glass: s.glass, mullAt: [0.5], rowsAt: [0.72]});
  const wp = c.part();
  solid(c, WHITE, U(wb.s[0]), U(wb.s[1]), wb.spandrel[0], wb.spandrel[1], 0, 0.06, wp);
  solid(c, WHITE, U(wb.s[0]), U(wb.s[1]), wb.upper[1], wb.y[1], 0, 0.06, wp);
  // Balcony: a deep slab apron on the wall over the spandrel, white rail on three sides.
  const bl = W.balcony, ba = U(bl.s[0]), bb = U(bl.s[1]), bp = c.part();
  solid(c, s.stone, ba, bb, bl.frontUnderside, bl.top, 0, bl.out, bp);
  const rail = c.part(), rt = bl.top + bl.rail;
  solid(c, RAIL, ba, bb, rt - 0.05, rt, bl.out - 0.05, bl.out, rail);
  // side rails start 12 cm off the wall: clear of the window frames, so the rail is judged with its slab, not with the windows
  for (const u of [ba, bb - 0.04]) solid(c, RAIL, u, u + 0.04, rt - 0.05, rt, 0.12, bl.out - 0.05, rail);
  for (let u = ba; u <= bb - 0.03; u += 0.16) solid(c, RAIL, u, u + 0.025, bl.top, rt - 0.05, bl.out - 0.04, bl.out - 0.015, rail);
  for (const u of [ba, bb - 0.025]) for (let d = 0.2; d < bl.out - 0.1; d += 0.16) solid(c, RAIL, u, u + 0.025, bl.top, rt - 0.05, d, d + 0.025, rail);
  // Stone ledge, then the two-storey glazed top: one opening, white spandrel panel and posts inside it.
  const ld = W.ledge;
  solid(c, s.stone, U(ld.s[0]), U(ld.s[1]), ld.y[0], ld.y[1], 0, ld.out, c.part());
  const gt = W.glazedTop, gr = recess(c, U(gt.s[0]), U(gt.s[1]), gt.y[0] + 0.03, gt.upper[1], 0.25, s.glass);
  if (gr) {
    const part = c.part(), q = (a: number, b: number, lo: number, hi: number, slot: string, d = BAR) => barQuad(c, slot, gr.Q, a, b, lo, hi, gr.back, gr.back + d, part);
    const a = U(gt.s[0]), b = U(gt.s[1]);
    q(a, b, gt.spandrel[0], gt.spandrel[1], WHITE);
    for (const x of gt.posts) q(U(x) - 0.06, U(x) + 0.06, gt.y[0] + 0.03, gt.spandrel[0], s.frame), q(U(x) - 0.06, U(x) + 0.06, gt.spandrel[1], gt.upper[1], s.frame);
    for (const x of [a, b - 0.08]) q(x, x + 0.08, gt.y[0] + 0.03, gt.upper[1], s.frame, BAR + 0.03);
    q(a + 0.08, b - 0.08, gt.lower[1] - 0.35, gt.lower[1] - 0.3, s.frame); q(a + 0.08, b - 0.08, gt.upper[0] + 0.45, gt.upper[0] + 0.5, s.frame);
    stats.drawn.push('w15 glazed top');
  } else stats.failed.push('w15 glazed top');
  solid(c, WHITE, U(gt.s[0]) - 0.1, U(gt.s[1]) + 0.1, gt.upper[1], gt.y[1], 0, 0.1, c.part());
  // Roof slab bowing out over the street (segment of a parabola in plan), its back edge on the wall.
  const rf = W.roof, ra = U(ld.s[0]), rb = U(ld.s[1]), half = (rb - ra) / 2, plan = new T.Shape();
  plan.moveTo(-half, 0);
  for (let i = 0; i <= 16; i++) { const t = -1 + i / 8, xx = t * half; plan.lineTo(xx, rf.endOverhang + rf.bow * (1 - t * t)); }
  plan.lineTo(half, 0); plan.lineTo(-half, 0);
  geom(c, s.stone, flipWinding(slab(plan, rf.y[1] - rf.y[0])), (ra + rb) / 2, rf.y[0], 0);
  // Police sign: a blue diamond on a bracket at the corner, turned to the street.
  const sg = W.sign, su = U(sg.s), sv = (sg.y[0] + sg.y[1]) / 2, sp = c.part();
  solid(c, s.stone, su - 0.04, su + 0.04, sv + 0.36, sv + 0.42, 0, sg.out, sp);
  geom(c, BLUE, new T.BoxGeometry(0.04, 0.5, 0.5).rotateX(Math.PI / 4), su, sv, sg.out - 0.38, sp);
  stats.drawn.push('w15 corner block');
}

/** w14: the tall Singelgracht end, four French windows on semicircular balconies. */
function towerEnd(c: PanelCtx, stats: HoofdbureauStats, s: Record<string, string>) {
  const W = F['w14-247'], U = (x: number) => x + W.sToU, dr = W.doors, bc = W.balconies;
  const half = (bc.s[1] - bc.s[0]) / 2, uc = U((bc.s[0] + bc.s[1]) / 2), plan = new T.Shape();
  plan.moveTo(-half, 0); plan.absellipse(0, 0, half, bc.out, Math.PI, 0, true); plan.lineTo(-half, 0);
  for (const [lo, hi] of dr.y) {
    opening(c, stats, 'w14 French window', U(dr.s[0]), U(dr.s[1]), lo, hi, {frame: WHITE, glass: s.glass, mullAt: [0.5], rowsAt: [0.35, 0.68]});
    geom(c, s.stone, flipWinding(slab(plan, bc.slab)), uc, lo - bc.slab, 0);
    const rail = c.part(), top = lo + bc.rail;
    for (let i = 0; i <= 8; i++) {
      const t = Math.PI * i / 8, u = uc - half * Math.cos(t) * 0.97, d = bc.out * Math.sin(t) * 0.94 + 0.02;
      geom(c, RAIL, new T.BoxGeometry(0.03, bc.rail, 0.03), u, lo + bc.rail / 2, d, rail);
      if (i < 8) {
        const t2 = Math.PI * (i + 1) / 8, u2 = uc - half * Math.cos(t2) * 0.97, d2 = bc.out * Math.sin(t2) * 0.94 + 0.02;
        const len = Math.hypot(u2 - u, d2 - d);
        geom(c, RAIL, new T.BoxGeometry(len + 0.02, 0.04, 0.04).rotateY(-Math.atan2(d2 - d, u2 - u)), (u + u2) / 2, top - 0.02, (d + d2) / 2, rail);
      }
    }
  }
  stats.drawn.push('w14 balconies');
}

/** w09: the pink quay front. */
function quayFront(c: PanelCtx, stats: HoofdbureauStats, s: Record<string, string>) {
  const W = F['w09-247'], U = (x: number) => x + W.sToU, Y = (y: number) => y + W.yShift, fr = {frame: s.frame, glass: s.glass};
  for (const row of W.windows.rows) for (let k = 0; k < row.count; k++) {
    const a = row.s0 + k * W.windows.pitch;
    opening(c, stats, 'w09 window', U(a), U(a + W.windows.width), Y(row.y[0]), Y(row.y[1]), {...fr, frameW: 0.1});
  }
  const lr = W.lowRibbon, tr = W.topRibbon, gb = W.glazedBay;
  opening(c, stats, 'w09 low ribbon', U(lr.s[0]), U(lr.s[1]), Y(lr.y[0]), Y(lr.y[1]), {...fr, mullAt: pitchBars(lr.s[1] - lr.s[0], lr.pitch)});
  // top ribbon: one opening if the wall takes it whole, else per light (3DBAG steps the wall top along the quay)
  const ta = U(tr.s[0]), tb = Math.min(U(tr.s[1]), c.p.uMax - 0.1), tv0 = Y(tr.y[0]), tv1 = Math.min(Y(tr.y[1]), c.p.vMax - 0.1);
  if (drawOpening(c, ta, tb, tv0, tv1, {...fr, frameW: 0.06, sillSlot: null, headSlot: null, mullAt: pitchBars(tb - ta, tr.pitch)}, 1) !== null) stats.openings++;
  // over the cantilevered wing (s < the void's right edge) the 3DBAG face is another member: those lights are not drawn
  else for (let x = ta; x + tr.pitch <= tb + 0.01; x += tr.pitch) if (x > U(W.void.s[1])) opening(c, stats, 'w09 top ribbon light', x + 0.08, x + tr.pitch - 0.08, tv0, tv1, fr);
  opening(c, stats, 'w09 glazed bay', U(gb.s[0]), U(gb.s[1]), Y(gb.y[0]), Y(gb.y[1]), {...fr, frameW: 0.12, mullAt: [1 / 3, 2 / 3], rowsAt: Array.from({length: gb.rows - 1}, (_, k) => (k + 1) / gb.rows)});
  deepRecess(c, stats, 'w09 void under the cantilever', U(W.void.s[0]), U(W.void.s[1]), Y(W.void.y[0]), Y(W.void.y[1]), 2.5, DARK);
  // The stone pair on a half-round console.
  const sc = W.sculpture, cu = U((sc.console.s[0] + sc.console.s[1]) / 2), cr = (sc.console.s[1] - sc.console.s[0]) / 2, plan = new T.Shape();
  plan.moveTo(-cr, 0); plan.absellipse(0, 0, cr, 1.0, Math.PI, 0, true); plan.lineTo(-cr, 0);
  const part = c.part();
  geom(c, s.stone, flipWinding(slab(plan, Y(sc.console.y[1]) - Y(sc.console.y[0]))), cu, Y(sc.console.y[0]), 0, part);
  const fh = sc.figures[1] - sc.figures[0], fu = U((sc.s[0] + sc.s[1]) / 2);
  figure(c, s.stone, fu - 0.38, Y(sc.figures[0]), 0.5, fh, 1.05);
  figure(c, s.stone, fu + 0.38, Y(sc.figures[0]), 0.45, fh * 0.96, 1.0);
  stats.drawn.push('w09 quay front and sculpture pair');
}

/** w05: portholes on the end pier and the gated vehicle entrance. */
function elandsgrachtWall(c: PanelCtx, stats: HoofdbureauStats, s: Record<string, string>) {
  const W = F['w05-337'], U = (x: number) => x + W.sToU;
  for (const y of W.portholes.y) for (const x of W.portholes.s) roundWindow(c, U(x), y, W.portholes.diameter, W.portholes.diameter - 0.16);
  const gt = W.gate, r = deepRecess(c, stats, 'w05 vehicle gate', U(gt.s[0]), U(gt.s[1]), gt.y[0], gt.y[1], 0.4, DARK);
  if (r) {
    const part = c.part();
    for (let u = r.u0 + 0.1; u < r.u1 - 0.1; u += gt.bars) barQuad(c, RAIL, r.Q, u, u + 0.08, gt.y[0] + 0.02, gt.y[1] - 0.02, r.back, r.back + BAR, part);
    barQuad(c, RAIL, r.Q, r.u0 + 0.02, r.u1 - 0.02, 2.0, 2.08, r.back, r.back + BAR + 0.03, part);
  }
  void s;
  stats.drawn.push('w05 portholes and gate');
}

/** w20: the glazed stair bay; w23: the framed bay and its low ribbon; w30: the glazed hall under the wing. */
function singelBays(c: PanelCtx, stats: HoofdbureauStats, s: Record<string, string>) {
  const p = c.p;
  if (has(p, 44)) {
    const W = F['w20-247'], U = (x: number) => x + W.sToU, b = W.bay, a = U(b.s[0]), z = U(b.s[1]), part = c.part();
    // dark steel body projecting from the wall, glazed bands on its front with mullions
    c.box(DARK, a, z, b.y[0], b.y[1], 0, b.out, part);
    for (const [lo, hi] of b.glass) {
      barQuad(c, s.glass, (u, v, d) => c.P(u, v, d), a + 0.1, z - 0.1, lo, hi, b.out, b.out + BAR, part);
      for (let u = a + 0.1; u <= z - 0.1; u += 0.62) solid(c, DARK, u - 0.025, u + 0.025, lo, hi, b.out + BAR, b.out + 2 * BAR, part);
    }
    stats.drawn.push('w20 stair bay');
  }
  if (has(p, 164)) {
    const W = F['w23-248'], U = (x: number) => x + W.sToU, Y = (y: number) => y + W.yShift, f = W.frame;
    const top = Math.min(Y(f.y[1]), p.vMax - 0.06), lo = Y(f.y[0]), a = U(f.s[0]), z = Math.min(U(f.s[1]), p.uMax - 0.05), bd = f.border, part = c.part();
    solid(c, DARK, a, a + bd, lo, top, 0, f.out, part); solid(c, DARK, z - bd, z, lo, top, 0, f.out, part); solid(c, DARK, a + bd, z - bd, lo, lo + bd, 0, f.out, part);
    opening(c, stats, 'w23 framed bay', a + bd + 0.05, z - bd - 0.05, lo + bd + 0.05, top - 0.05, {frame: s.frame, glass: s.glass, frameW: 0.1, mullAt: [0.25, 0.5, 0.75], rowsAt: [0.3, 0.55, 0.8]});
    opening(c, stats, 'w23 low ribbon', Math.max(U(0.15), p.uMin + 0.1), U(7.1), Y(3.6), Y(4.45), {frame: s.frame, glass: s.glass, mullAt: pitchBars(6.95, 0.9)});
    stats.drawn.push('w23 framed bay');
  }
  if (has(p, 112)) {
    opening(c, stats, 'w30 glazed hall', p.uMin + 0.3, p.uMax - 0.3, 2.5, 9.5, {frame: 'frame@g2', glass: 'glass', frameW: 0.1, mullAt: [1 / 3, 2 / 3], rowsAt: [0.25, 0.5, 0.75]});
    stats.drawn.push('w30 glazed hall');
  }
}

/** Hand-modelled parts, drawn in each panel's own frame so every one sits on the exact 3DBAG wall plane. */
export function hoofdbureauHooks(stats: HoofdbureauStats): LargeCompileHooks {
  const W02 = F['w02-67'];
  return {
    budget: 40000,
    barOffsetM: BAR,
    skipCell: (p, floor, bay, bays) => {
      const u0 = p.uMin + (p.uMax - p.uMin) * bay / bays, u1 = p.uMin + (p.uMax - p.uMin) * (bay + 1) / bays;
      // Marnixstraat front: no kit cells where the builder draws the entrance and the open corner bay
      if (has(p, 233) && floor === 0 && u1 > W02.entrance.s[0] + W02.surfaces['233'] + 0.3) return true;
      if ((has(p, 72) || has(p, 167)) && floor === 0) return true;
      // Elandsgracht wall: the porthole pier and the gate
      const w05 = F['w05-337'];
      if (has(p, 177) && floor >= 1 && u1 > w05.portholes.s[0] + w05.sToU - 0.6 && u0 < w05.portholes.s[3] + w05.sToU + 0.6) return true;
      if (has(p, 177) && floor === 0 && u0 < w05.gate.s[1] + w05.sToU + 0.2) return true;
      return false;
    },
    panelHook: (c, info, g) => {
      const p = c.p, s: Record<string, string> = {wall: g?.slots.wall ?? 'wall', frame: g?.slots.frame ?? 'frame', stone: g?.slots.stone ?? 'stone', glass: g?.slots.glass ?? 'glass'};
      if (has(p, 190)) endWall(c, stats, s);
      if (has(p, 233) || has(p, 72) || has(p, 167)) marnixFront(c, stats, s);
      if (has(p, 38)) cornerBlock(c, stats, s);
      if (has(p, 10)) towerEnd(c, stats, s);
      if (has(p, 4)) quayFront(c, stats, s);
      if (has(p, 177)) elandsgrachtWall(c, stats, s);
      if (has(p, 44) || has(p, 164) || has(p, 112)) singelBays(c, stats, s);
      if (!g) return;
      if (HOOD_SURFACES.some(w => g.surfaces.includes(w))) {
        const chequer = CHEQUER_SURFACES.some(w => g.surfaces.includes(w)) && surfacesOf(p).some(w => CHEQUER_SURFACES.includes(w));
        const rows = new Map<number, [number, number, number, number, number][]>();
        // Heavy white stone hood over every sash window, a little wider than the opening (panorama 2025, west wing).
        for (const [k, list] of c.holes) {
          // The hood sits on the member wall's own plane (3DBAG walls drift a few cm from the merged panel plane).
          const ring = p.members![k].rings[0], nm = norm(newell(ring)), den = dot(nm, p.n);
          for (const [u0, u1, v0, v1] of list) {
            const at = c.P((u0 + u1) / 2, v1, 0), d = Math.abs(den) > 1e-6 ? dot(nm, sub(ring[0], at)) / den : 0;
            const key = Math.round(v0 * 4) / 4;
            rows.set(key, [...(rows.get(key) ?? []), [u0, u1, v0, v1, d]]);
            // No hood where it would run past the wall's top or side edge (it would hang in the air at a corner or eaves).
            if (v1 + 0.34 > g.eavesM || !fitsPanel(p, rectPoly(u0 - 0.2, u1 + 0.2, v1 + 0.02, v1 + 0.32), 0.05)) continue;
            c.box(s.stone, u0 - 0.16, u1 + 0.16, v1 + 0.03, v1 + 0.3, d, d + 0.17, c.part());
            stats.hoods++;
          }
        }
        if (chequer) {
          const W = F['w07-157'], ch = W.chequer;
          const lowest = Math.min(...rows.keys());
          for (const [key, row] of rows) {
            row.sort((a, b) => a[0] - b[0]);
            // Raised chequer brick panel between neighbouring windows: three rows of alternate blocks, 6 cm proud.
            for (let i = 0; i + 1 < row.length; i++) {
              const [, a1, v0, v1, d] = row[i], b0 = row[i + 1][0], gap = b0 - a1;
              if (gap < ch.width * 0.6) continue;
              const w = Math.min(ch.width, gap - 0.4), uc = (a1 + b0) / 2, vc = v0 + (v1 - v0) * 0.3, cw = w / 4, chh = ch.height / 3, part = c.part();
              if (!fitsPanel(p, rectPoly(uc - w / 2, uc + w / 2, vc - ch.height / 2, vc + ch.height / 2), 0.05)) continue;
              for (let r = 0; r < 3; r++) for (let k = r % 2; k < 4; k += 2)
                c.box(s.wall, uc - w / 2 + k * cw, uc - w / 2 + (k + 1) * cw, vc - ch.height / 2 + r * chh, vc - ch.height / 2 + (r + 1) * chh, d, d + ch.out, part);
              stats.chequers++;
            }
            // Barred basement window under each ground-floor window that leaves room for it.
            if (key !== lowest) continue;
            for (const [u0, u1, v0] of row) {
              // under the lowest window row (the ground storey is blank brick), where it leaves at least 0.5 m of wall
              const bs = W.basement, uc = (u0 + u1) / 2, top = Math.min(bs.y[1], v0 - 0.2);
              if (top - bs.y[0] < 0.5 || v0 > 6) continue;
              const r = recess(c, uc - bs.width / 2, uc + bs.width / 2, bs.y[0], top, 0.15, DARK);
              if (!r) continue;
              const part = c.part();
              for (let k = 1; k <= bs.bars; k++) {
                const u = uc - bs.width / 2 + bs.width * k / (bs.bars + 1);
                barQuad(c, RAIL, r.Q, u - 0.02, u + 0.02, bs.y[0], top, r.back, r.back + BAR, part);
              }
              stats.basements++;
            }
          }
        }
      }
      void info;
    },
  };
}

export function compileHoofdbureau(): {built: CompiledLargeBuilding; stats: HoofdbureauStats} {
  const intent = validateLargeIntent(intentJson);
  const stats: HoofdbureauStats = {triangles: 0, hoods: 0, chequers: 0, basements: 0, openings: 0, failed: [], drawn: []};
  const built = compileLargeBuilding(intent, FACTS, hoofdbureauHooks(stats));
  return {built, stats};
}

export function buildHoofdbureauElandsgracht(_w: number, _d: number, b: BuildingTools) {
  const {built} = compileHoofdbureau();
  built.group.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const name = PALETTE[o.userData.materialSlot as string];
    if (!name) throw Error(`hoofdbureau: no palette colour for materialSlot ${o.userData.materialSlot}`);
    // Per-group palette variants (slot names with an @) keep their own colour through the spare palette names red (wall) and gold (frame).
    const variant = o.name.includes('@');
    const colour = variant && name === 'brick' ? 'red' : variant && name === 'frame' ? 'gold' : name;
    const src = o.geometry as T.BufferGeometry, g = src.index ? src.toNonIndexed() : src.clone(), a = g.getAttribute('position');
    // The 3DBAG shell has a sunken ramp below the street (lowest -4.4 m): the landmark ground is y = 0, so drop what lies fully below it and clamp the rest.
    const keep: number[] = [];
    for (let i = 0; i < a.count; i += 3) if (Math.max(a.getY(i), a.getY(i + 1), a.getY(i + 2)) > 0.01) for (let k = 0; k < 3; k++) keep.push(a.getX(i + k), Math.max(0, a.getY(i + k)), a.getZ(i + k));
    if (!keep.length) return;
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); out.computeVertexNormals();
    b.add(out, colour);
  });
}
