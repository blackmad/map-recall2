import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, getSink, poly, put, ringFrame, ringSlab, sashWindows, segBand, setSink, slab, type Frame} from './nearbar-kit';
import source from './damrak-37-footprints.json';

/**
 * DAMRAK 37 (BAG pand 0363100012178237, bouwjaar 1904, rijksmonument 518424): a narrow grey stone front of five storeys
 * on the Damrak. Two bays: the wider SW bay under a curved stone dormer gable, with a wide segmental-arched shop window
 * and an arcade of three round-arched windows on the third storey; the NE bay a shallow projecting bay on two corbels over
 * the arched entrance, with a carved parapet panel, a large arched window and a slate mansard dormer under a pointed
 * spire. A small slate pinnacle stands on the SW corner.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts), in the front's stone. Over the front the shell
 * rises sheer to 20.5 and 21.25 m where the photo shows a slate mansard over a 17.4 m cornice: a slate skin leans from
 * the cornice back to the shell wall's top there (as muntplein-1).
 *
 * Read from the rectified Gemeente Amsterdam panorama b_20250108_1349_Track19_Sphere_00344 (2025, w02-131.jpg, 50.2 px/m,
 * 3 deg off square) with TMX7316010203-001054_pano_0000_000512 (2018, the same layout in overcast light), CC BY 4.0:
 * h = (1120 - y) / 50.2 from the pavement, t = x / 50.2 + 0.25 from the SW corner (the front fills x 0-400 of the crop,
 * 8.0 of the ring edge's 8.57 m; the slack is split). The SW flank stands behind the Damrak 38-41 row: shell only.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
// the 3DBAG front wall stands 0.01-0.09 m in front of the BAG ring line: the front's parts start 0.1 m out, clear of it
const EF = ringFrame(src.facadeRing, 3, 0.1);
const FF = EF.f;
type Col = 'stone' | 'sandstone' | 'slate' | 'glass' | 'frame' | 'dark' | 'concrete' | 'bronze';

const tx = (x: number) => +(x / 50.2 + 0.25).toFixed(3);
const hy = (y: number) => +((1120 - y) / 50.2).toFixed(3);
const CORNICE = [hy(262), hy(245)] as const; // 17.09-17.43
const BAY = [tx(230), tx(395)] as const; // the projecting NE bay
const BAY_OUT = 0.22, BAY_Y = hy(845); // the bay stands on corbels over the entrance from the string course up

/** The frame moved `out` metres out of the wall (for parts on the projecting bay or in a recess). */
const shift = (F: Frame, out: number): Frame => ({...F, origin: [F.origin[0] + F.n[0] * out, F.origin[1] + F.n[1] * out]});

export function buildDamrak37(_w: number, _d: number, b: BuildingTools) {
  addShell(b, {...src, surfaces: frontStripCut(src.surfaces)} as never, {wall: 'stone', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.04, true);
  front(b);
  setSink(sink0);
}

/**
 * The 3DBAG draws the mansard over the front as a sheer wall on the front line to 20.5 / 21.25 m, a 1.3 m deep strip of
 * roofs at 19.4-20.5 m and two short step walls. The rectified crop shows a slate slope from the 17.4 m cornice whose
 * top edge, 1.3 m back at the 21.2 m main roof, projects onto the front plane at y 120 (19.9 m: a camera 2.4 m up and
 * 21 m out sees a point 1.3 m behind the plane 1.1 m low). So the front walls stop at the cornice, the strip's roofs and
 * step walls go, and mansardSlope() draws the slope back to the main roof.
 */
const STRIP = 1.3;
function frontStripCut(surfaces: Surface[]): Surface[] {
  const F0 = ringFrame(src.facadeRing, 3).f;
  const dist = (p: number[]) => (p[0] - F0.origin[0]) * F0.n[0] + (p[2] - F0.origin[1]) * F0.n[1];
  const along = (p: number[]) => (p[0] - F0.origin[0]) * F0.tangent[0] + (p[2] - F0.origin[1]) * F0.tangent[1];
  const out: Surface[] = [];
  for (const s of surfaces) {
    const r = s.rings[0], d = r.map(dist), t = r.map(along), y = r.map(p => p[1]);
    const inStrip = Math.min(...d) > -STRIP - 0.2 && Math.max(...t) > 1.3;
    if (s.type === 'RoofSurface' && inStrip && Math.min(...y) > 19) continue;
    if (s.type === 'WallSurface' && inStrip && Math.min(...y) > 17.5 && (Math.max(...t) - Math.min(...t) < 0.6 || Math.max(...d) < -1)) continue;
    if (s.type === 'WallSurface' && Math.min(...d) > -0.2 && Math.max(...y) > CORNICE[1] + 0.2 && Math.max(...t) > 1.3) {
      const clamped = r.map(p => [p[0], Math.min(p[1], CORNICE[1]), p[2]]).filter((p, i, a) => i === 0 || p.some((v, k) => Math.abs(v - a[i - 1][k]) > 1e-6));
      out.push({...s, rings: [clamped]});
      continue;
    }
    out.push(s);
  }
  return out;
}

/** A cream-framed window `cols` x `rows`, `out` from the wall, in a plain stone surround with a sill. */
function win(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, cols: number, rows: number, out = 0, transom?: number) {
  const G = shift(F, out), W = shift(G, 0.08); // the sash stands 8 cm proud of its 4 cm surround, clear of z-fighting
  slab(b, G, t, y0 - 0.12, w + 0.36, y1 - y0 + 0.24, 0.04, 'sandstone'); // surround
  slab(b, G, t, y0 - 0.22, w + 0.5, 0.12, 0.2, 'stone'); // sill
  sashWindows(b, W, [t], {lean: true, y: y0, w, h: y1 - y0, cols, rows, frame: 'frame', glass: 'glass'});
  if (transom !== undefined) slab(b, W, t, transom - 0.04, w, 0.08, 0.19, 'frame');
}

/** Round-arched window with a stone archivolt ring; `bar` adds a curved glazing bar at the springing. */
function arched(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, mullions: number, out = 0, ring = 0.2) {
  const G = shift(F, out), spring = y1 - w / 2;
  archSlab(b, G, t, y0 - 0.06, w + 0.14, y1 - y0 + 0.12, 0.07, 'frame', 0, 10);
  archSlab(b, G, t, y0, w, y1 - y0, 0.12, 'glass', 0, 10);
  for (let k = 1; k <= mullions; k++) slab(b, G, t - w / 2 + (w * k) / (mullions + 1), y0, 0.06, spring - y0 + 0.02, 0.17, 'frame');
  archBand(b, G, t, spring - 0.04, w * 0.96, w * 0.48, 0.06, 0.17, 'frame', 0, 10); // the curved bar at the springing
  archBand(b, G, t, spring, w + 2 * ring + 0.1, (w + 2 * ring + 0.1) / 2, ring, 0.2, 'stone', 0, 12);
  slab(b, G, t, y0 - 0.2, w + 0.5, 0.12, 0.16, 'stone');
}

/** Stone ring over a segmental opening (chord w, springing y, rise): the opening's circle offset out by `gap`, `th` thick. */
function segRing(b: BuildingTools, F: Frame, t: number, w: number, spring: number, rise: number, gap: number, th: number, d: number, colour: Col, out = 0) {
  const R = (w * w / 4 + rise * rise) / (2 * rise), cy = spring + rise - R, a0 = Math.asin(w / 2 / R), n = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const a = -a0 + (2 * a0 * i) / n; pts.push([(R + gap + th) * Math.sin(a), cy + (R + gap + th) * Math.cos(a) - spring]); }
  for (let i = n; i >= 0; i--) { const a = -a0 + (2 * a0 * i) / n; pts.push([(R + gap) * Math.sin(a), cy + (R + gap) * Math.cos(a) - spring]); }
  poly(b, F, t, spring, pts, d, colour, out);
}

/** Segmental-arched opening: glass to the springing, then a segment of `rise` over the span. */
function segOpening(b: BuildingTools, F: Frame, t: number, w: number, y0: number, spring: number, rise: number, colour: Col, d: number, out = 0) {
  const n = 12, pts: [number, number][] = [[-w / 2, 0], [w / 2, 0]];
  const R = (w * w / 4 + rise * rise) / (2 * rise);
  for (let i = 0; i <= n; i++) { const x = w / 2 - (w * i) / n; pts.push([x, spring - y0 + rise - R + Math.sqrt(R * R - x * x)]); }
  poly(b, F, t, y0, pts, d, colour, out);
}

function front(b: BuildingTools) {
  const F = FF, L = EF.len;
  // plinth and the string course over the ground storey
  slab(b, F, L / 2, 0, L - 0.04, hy(1080), 0.06, 'sandstone');
  slab(b, F, L / 2, hy(850), L - 0.04, 0.2, 0.2, 'stone');
  // ---- ground storey ----
  // SW bay: the wide segmental-arched shop window (x 35-205, y 880-1075) with its archivolt, mullions and the waved bar
  const tw = (tx(35) + tx(205)) / 2, ww = tx(205) - tx(35), wy0 = hy(1075), wsp = hy(940), wrise = hy(880) - wsp;
  segOpening(b, F, tw, ww + 0.16, wy0 - 0.06, wsp, wrise + 0.06, 'frame', 0.07);
  segOpening(b, F, tw, ww, wy0, wsp, wrise, 'glass', 0.12);
  for (const x of [80, 162]) slab(b, F, tx(x), wy0, 0.07, wsp - wy0 + wrise * 0.6, 0.17, 'frame');
  segBand(b, F, tw, wsp - 0.15, ww * 0.95, 0.35, 0.07, 0.17, 'frame');
  slab(b, F, tw, wy0 + 0.02, ww, 0.08, 0.17, 'frame');
  segRing(b, F, tw, ww, wsp, wrise, 0.1, 0.3, 0.22, 'stone'); // archivolt, clear of the frame
  for (const s of [-1, 1]) slab(b, F, tw + s * (ww / 2 + 0.26), wy0 - 0.1, 0.32, wsp - wy0 + 0.1, 0.2, 'stone'); // jambs
  // three basement lights under it (y 1082-1105)
  for (const [x0, x1] of [[38, 88], [107, 180], [195, 228]]) {
    slab(b, F, (tx(x0) + tx(x1)) / 2, hy(1105) - 0.04, tx(x1) - tx(x0) + 0.08, hy(1082) - hy(1105) + 0.08, 0.14, 'frame');
    slab(b, F, (tx(x0) + tx(x1)) / 2, hy(1105), tx(x1) - tx(x0), hy(1082) - hy(1105), 0.18, 'glass');
  }
  // NE bay: the arched entrance (x 255-345, y 875-1075) in a stone surround, glazed fanlight, dark door, three steps
  const td = (tx(255) + tx(345)) / 2, wd = tx(345) - tx(255), dsp = hy(905), drise = hy(875) - dsp, dy0 = hy(1075);
  segOpening(b, F, td, wd + 0.3, dy0 - 0.1, dsp, drise + 0.12, 'stone', 0.18);
  // the glazed double door (the 2018 view shows the lit hall through it) under the fanlight: one glass field
  segOpening(b, F, td, wd, dy0, dsp, drise, 'dark', 0.24);
  segOpening(b, F, td, wd - 0.2, dy0 + 0.05, dsp, drise - 0.05, 'glass', 0.29);
  slab(b, F, td, dsp - 0.62, wd - 0.1, 0.08, 0.34, 'frame');
  slab(b, F, td, dy0 + 0.05, 0.08, dsp - 0.62 - dy0, 0.34, 'frame');
  for (const s of [-1, 1]) slab(b, F, td + s * 0.42, dy0 + 0.05, 0.3, 0.9, 0.39, 'dark'); // door leaves' lower panels
  for (let k = 0; k < 3; k++) slab(b, F, td, k * (dy0 / 3), wd + 0.2, dy0 / 3, 0.75 - k * 0.25, 'stone');
  // the two corbels that carry the bay (x 230-245 and 380-395, y 840-870)
  for (const x of [237, 388]) {
    slab(b, F, tx(x), hy(870), 0.3, hy(840) - hy(870), BAY_OUT + 0.08, 'stone');
    slab(b, F, tx(x), hy(905), 0.22, hy(870) - hy(905), 0.14, 'stone');
  }
  // ---- the projecting NE bay, string course to cornice ----
  slab(b, F, (BAY[0] + BAY[1]) / 2, BAY_Y, BAY[1] - BAY[0], CORNICE[0] - BAY_Y, BAY_OUT, 'stone');
  const tb = (tx(258) + tx(345)) / 2;
  // first storey: two windows with top lights (x 258-295, 305-345; y 680-800)
  for (const [x0, x1] of [[258, 295], [305, 345]]) win(b, F, (tx(x0) + tx(x1)) / 2, tx(x1) - tx(x0) - 0.1, hy(800), hy(680), 1, 3, BAY_OUT, hy(732));
  // second storey: one wide window, a mullion and a curved transom bar (x 258-345, y 465-580)
  win(b, F, tb, tx(345) - tx(258) - 0.1, hy(580), hy(465), 2, 1, BAY_OUT, hy(540));
  segBand(b, shift(F, BAY_OUT + 0.08), tb, hy(540) + 0.04, tx(345) - tx(258) - 0.12, 0.3, 0.06, 0.2, 'frame');
  // the parapet panel with its two round reliefs (x 240-375, y 385-440)
  const P = shift(F, BAY_OUT);
  slab(b, P, tb, hy(437), tx(375) - tx(240), 0.94, 0.16, 'stone'); // under 1 m tall: the openings gate takes a 1 m plane as the window's host wall
  slab(b, P, tb, hy(390), tx(380) - tx(236), 0.1, 0.24, 'stone');
  for (const x of [270, 330]) {
    ringSlab(b, P, tx(x), hy(413), 0.22, 0.3, 0.1, 'sandstone', 0.16);
    disc(b, P, tx(x), hy(413), 0.22, 0.12, 'sandstone', 0.16);
    disc(b, P, tx(x), hy(413), 0.1, 0.08, 'stone', 0.28);
  }
  // third storey: the wide round-arched window (x 262-345, y 318-385) in its large ring (top y 300)
  arched(b, F, tb, tx(345) - tx(262), hy(385), hy(318), 0, BAY_OUT, 0.3);
  // its two mullions (three lights): painted like the frames but as `concrete`, because as frame parts below the ring's
  // springing the openings gate reads them as standing outside the ring's silhouette
  { const w = tx(345) - tx(262); for (const s of [-1, 1]) slab(b, shift(F, BAY_OUT), tb + (s * w) / 6, hy(385), 0.06, hy(318) - w / 2 - hy(385), 0.17, 'concrete'); }
  // ---- SW bay ----
  // first and second storeys: three windows, the middle one a pair under a raised head
  for (const [yb, yt, ytc] of [[800, 705, 690], [590, 505, 482]] as const) {
    for (const [x0, x1] of [[35, 70], [170, 205]]) win(b, F, (tx(x0) + tx(x1)) / 2, tx(x1) - tx(x0), hy(yb), hy(yt), 1, 3, 0, hy(yt) - 0.42);
    win(b, F, (tx(85) + tx(155)) / 2, tx(155) - tx(85), hy(yb), hy(ytc), 2, 3, 0, hy(ytc) - 0.55);
  }
  // third storey arcade: three round-arched windows under linked archivolts (x 35-80, 100-148, 165-210; y 318-430)
  for (const [x0, x1] of [[35, 80], [100, 148], [165, 210]]) arched(b, F, (tx(x0) + tx(x1)) / 2, tx(x1) - tx(x0), hy(430), hy(318), 1, 0, 0.16);
  slab(b, F, (tx(25) + tx(220)) / 2, hy(440), tx(220) - tx(25), 0.12, 0.2, 'stone'); // the arcade's sill course
  // ---- cornice on brackets across the front ----
  slab(b, F, L / 2, CORNICE[0], L - 0.04, 0.1, 0.18 + BAY_OUT, 'stone');
  for (let x = 20; x < 400; x += 48) slab(b, F, tx(x), CORNICE[0] - 0.35, 0.16, 0.45, 0.32 + BAY_OUT, 'stone');
  slab(b, F, L / 2, CORNICE[1] - 0.2, L - 0.04, 0.2, 0.5 + BAY_OUT, 'stone');
  // ---- roof zone ----
  mansardSlope(b, F, tx(200), L - 0.02, CORNICE[1], 21.2, 0.45, -STRIP - 0.1);
  mansardSlope(b, F, 1.3, tx(200), CORNICE[1], 21.2, -0.35, -STRIP - 0.1); // behind the gable, clear of its window
  gable(b, F);
  dormer(b, F);
  pinnacle(b, F);
}

/** Slate mansard slope from the cornice crown (o = out0, y0) back to the main roof (o = out1, y1), closed underneath. */
function mansardSlope(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number, out0: number, out1: number) {
  const s = new T.Shape([new T.Vector2(out1 - 0.15, 0), new T.Vector2(out0, 0), new T.Vector2(out1, y1 - y0), new T.Vector2(out1 - 0.15, y1 - y0)]);
  const g = new T.ExtrudeGeometry(s, {depth: t1 - t0, bevelEnabled: false});
  g.rotateY(-Math.PI / 2).translate(t1, 0, 0);
  put(b, F, g, 0, y0, 0, 'slate');
}

/** The stone dormer gable over the SW bay: cheeks, concave curves to a neck, a moulded cap; the arched window in a ring. */
function gable(b: BuildingTools, F: Frame) {
  const t0 = tx(45), t1 = tx(200), n0 = tx(97), n1 = tx(150), y0 = CORNICE[1], sh = hy(112), neck = hy(62), cap = hy(30);
  const pts: [number, number][] = [[t0, 0], [t1, 0], [t1, sh - y0]];
  const curve = (a: [number, number], c: [number, number]) => { // concave quarter curve from shoulder a to neck c
    for (let i = 1; i <= 8; i++) { const u = i / 8, ang = (u * Math.PI) / 2; pts.push([a[0] + (c[0] - a[0]) * Math.sin(ang), a[1] + (c[1] - a[1]) * (1 - Math.cos(ang))]); }
  };
  curve([t1, sh - y0], [n1, neck - y0]);
  pts.push([n0, neck - y0]);
  const left: [number, number][] = [];
  for (let i = 1; i <= 8; i++) { const u = i / 8, ang = (u * Math.PI) / 2; left.push([n0 + (t0 - n0) * (1 - Math.cos(ang)), neck - y0 + (sh - neck) * Math.sin(ang)]); }
  pts.push(...left);
  poly(b, F, 0, y0, pts.map(([t, y]) => [t, y]) as [number, number][], 0.36, 'stone', 0);
  // the cap: a moulded block on the neck
  slab(b, F, (n0 + n1) / 2, neck - 0.05, n1 - n0 + 0.2, 0.18, 0.46, 'stone');
  slab(b, F, (n0 + n1) / 2, neck + 0.13, n1 - n0 + 0.05, cap - neck - 0.25, 0.4, 'stone');
  slab(b, F, (n0 + n1) / 2, cap - 0.12, n1 - n0 + 0.25, 0.14, 0.48, 'stone');
  // shoulder scrolls
  for (const t of [t0 + 0.2, t1 - 0.2]) slab(b, F, t, sh - 0.2, 0.5, 0.24, 0.46, 'stone');
  // the round-arched window (x 80-165, y 150-245) in its stone ring
  arched(b, F, (tx(80) + tx(165)) / 2, tx(165) - tx(80), hy(245) + 0.05, hy(150), 1, 0.36, 0.18);
}

/** The NE bay's mansard dormer (x 270-335, window y 185-245) under a four-sided slate spire with a ball finial (tip y 50). */
function dormer(b: BuildingTools, F: Frame) {
  const t = (tx(270) + tx(335)) / 2, w = tx(340) - tx(265), y0 = CORNICE[1], y1 = hy(180), out = 0.62;
  slab(b, F, t, y0, w, y1 - y0, out + 0.8, 'stone', -0.8);
  // no sink: a sunk frame back reaches through the mansard skin behind the dormer face and reads as piercing the roof
  const sink = getSink();
  setSink(0);
  sashWindows(b, shift(F, out), [t], {lean: true, y: hy(245), w: w - 0.36, h: hy(185) - hy(245), cols: 2, rows: 2, frame: 'frame', glass: 'glass'});
  setSink(sink, true);
  const tip = hy(55) + 0.3, half = w / 2 + 0.06; // the tip stands ~0.5 m behind the front: 0.3 m higher than it projects
  const g = new T.ConeGeometry(half * Math.SQRT2, tip - y1, 4).rotateY(Math.PI / 4).translate(0, (tip - y1) / 2, 0);
  put(b, F, g, t, y1, out + 0.08 - half, 'slate');
  put(b, F, new T.SphereGeometry(0.1, 8, 6), t, tip + 0.05, out + 0.08 - half, 'bronze');
}

/** The SW corner's pinnacle: a square stone base over the cornice and a slate cone with a ball (x 0-45, tip y 120). */
function pinnacle(b: BuildingTools, F: Frame) {
  const t = tx(22), base = hy(215), tip = hy(125), r = 0.42;
  slab(b, F, t, CORNICE[1], 0.86, base - CORNICE[1], 0.86, 'stone', -0.4);
  put(b, F, new T.ConeGeometry(r * Math.SQRT2 * 0.85, tip - base, 8).translate(0, (tip - base) / 2, 0), t, base, 0.03, 'slate');
  put(b, F, new T.SphereGeometry(0.09, 8, 6), t, tip + 0.05, 0.03, 'bronze');
}
