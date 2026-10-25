/**
 * Large-tier crown cantilever (Salt, Haarlemmerweg 940-1138, MVRDV 2023; bespoke lane 2026-10-21).
 *
 * The 3DBAG LoD2.2 shell of a `kind: "large"` house is one extruded prism: it cannot express a volume that
 * overhangs its own ground floor. This component takes the shell after the standard facade compose and, for a house
 * whose intent opts in with `crown`, turns the top `storeys` storeys into a block that is pushed out over one or more
 * named bearings by `overhang` bays of the dominant front's pitch:
 *
 *  - the overhanging side's wall above the soffit is replaced by a new panel on the moved plane, with the same
 *    measured bay pattern (`windowPattern`, phase-aligned with the panel below) and the same window height/sill as the
 *    shell, so the grid continues;
 *  - the two end walls are extended by the same depth with the same pair rhythm (the shell's end walls keep their
 *    windows; only the new strip is added);
 *  - a coffered soffit closes the overhang (the photographed signature: a deep white waffle underside), with a 0.45 m
 *    fascia on the three visible edges and a filler band closing the shell's cut;
 *  - a flat roof deck 0.49 m under the parapet closes the moved crown at the top; the 3DBAG roof and its plant stand
 *    above it, untouched.
 *
 * All geometry is laid in the overhung panel's own frame (u along the wall, v its outward normal), because the LoD2.2
 * plan is not axis-aligned (Haarlemmerweg 940's south wall runs 1.3 deg off east-west): an axis-aligned crown would
 * open 0.2-0.5 m wedge gaps at the corners. Every new panel is cut on the bay grid, so no long edge spans an opening,
 * and the slab's own faces close the wall edges they meet (the block-kit open-edge gate).
 *
 * Evidence for Haarlemmerweg 940: the crown is 6 storeys over a 10-storey shaft; the overhang is two pair-pitches
 * (4 bays = 5.44 m), read from the four coffer rows and the soffit/crown-face angle in the 2025-09-29 panorama and the
 * 2023 Commons photos. The other three bearings are flush: the north panorama of 2025-07-01 shows no soffit on the
 * north face, and the crown's end faces line up with the shaft in the south-east and south-west panoramas. The module
 * is geometry-only and unit-tested (`crownCantilever.test.ts`); houses without `crown` are not touched.
 */
import {MeshBuilder, type V3} from '../blockBuilding/mesh.ts';
import type {Panel} from '../blockBuilding/panels.ts';
import type {Row, System, WinParams} from '../blockBuilding/spec.ts';
import type {LargeBuildingRecipe, LargeGroupFit} from './fitLarge.ts';
import type {CrownIntent} from './intent.ts';

export interface CrownReport {
  /** the storey line the crown's soffit sits on (m) */
  soffitM: number;
  /** plan overhang per bearing (m) */
  overhangM: {N: number; S: number; E: number; W: number};
  crownStoreys: number;
  /** the axes the crown is pushed out on */
  bearings: string[];
  /** coffer cells across the front and along the overhang */
  coffers: {across: number; deep: number} | null;
  addedTriangles: number;
  removedTriangles: number;
}

const EPS = 1e-6;
/** The soffit's ribs hang this deep under the ceiling; the crown's cut and its fascia sit on the ceiling plane. */
export const SOFFIT_RIB_M = 0.45;
/** The crown's roof deck, under the parapet (the parapet is the wall top; the 3DBAG roof surfaces stay above it). */
export const CROWN_DECK_M = 0.49;
/** Parapet cap width (m) along the crown's wall tops (closes the wall's top edge). */
const PARAPET_CAP_M = 0.22;
const BEARINGS = ['N', 'E', 'S', 'W'] as const;

/** The overhung panel's frame: u along the wall (the panel's own axis), n its outward horizontal normal. */
export interface Frame {o: V3; u: V3; n: V3}
/** A wall run: the front at `at` on n, or an end at `at` on u; `s` runs along the wall. */
interface Run {where: 'front' | 'endW' | 'endE'; at: number; outward: 1 | -1}

const same = (a: V3, b: V3) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS && Math.abs(a[2] - b[2]) < EPS;
const norm2 = (x: number, z: number): [number, number] => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

/** Clip a triangle at a horizontal plane; returns the parts below and above (fan-triangulated, 0-3 triangles each). */
export function clipTriangleAtHeight(a: V3, b: V3, c: V3, y: number): {below: V3[][]; above: V3[][]} {
  const pts = [a, b, c];
  const side = (p: V3) => p[1] - y;
  const poly = (keep: (s: number) => boolean) => {
    const out: V3[] = [];
    for (let i = 0; i < 3; i++) {
      const p = pts[i], q = pts[(i + 1) % 3], sp = side(p), sq = side(q);
      if (keep(sp)) out.push(p);
      if (keep(sp) !== keep(sq)) {
        const t = sp / (sp - sq);
        const cut: V3 = [p[0] + (q[0] - p[0]) * t, y, p[2] + (q[2] - p[2]) * t];
        if (!out.some(o => same(o, cut))) out.push(cut);
      }
    }
    return out;
  };
  const fan = (polygon: V3[]) => {
    const tris: V3[][] = [];
    for (let i = 1; i + 1 < polygon.length; i++) {
      const t = [polygon[0], polygon[i], polygon[i + 1]];
      const area = Math.hypot(
        (t[1][1] - t[0][1]) * (t[2][2] - t[0][2]) - (t[1][2] - t[0][2]) * (t[2][1] - t[0][1]),
        (t[1][2] - t[0][2]) * (t[2][0] - t[0][0]) - (t[1][0] - t[0][0]) * (t[2][2] - t[0][2]),
        (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0]),
      );
      if (area > 1e-9) tris.push(t);
    }
    return tris;
  };
  return {below: fan(poly(s => s <= EPS)), above: fan(poly(s => s >= -EPS))};
}

/**
 * The dominant front: the group with the most bays (the pair rhythm), then nearest to south (the photographed front).
 * Its pitch, pattern and window shape drive the crown's new walls.
 */
export function crownGroup(recipe: LargeBuildingRecipe): LargeGroupFit {
  const usable = recipe.groups.filter(g => g.system !== 'blank' && g.mainPanel !== null && g.pitchM > 0);
  const pool = usable.length ? usable : recipe.groups;
  const southness = (g: LargeGroupFit) => (g.bearingDeg === null ? 180 : Math.abs(((g.bearingDeg - 180 + 540) % 360) - 180));
  return [...pool].sort((a, b) => b.bays - a.bays || southness(a) - southness(b))[0];
}

/** The window rhythm of a group's typical row: width fractions (cycling per bay, in the system's cycle order), height fraction and sill (m). */
export function crownWindow(recipe: LargeBuildingRecipe, group: LargeGroupFit): {widths: number[]; hFrac: number; sillM: number} {
  const system = recipe.spec.systems[group.specSystem] as System | undefined;
  const rows: Row[] = system ? [system.typical, ...(system.typical.cycle ?? []), ...Object.values(system.rowOverrides ?? {})] : [];
  const wins = rows.map(r => r.win).filter((w): w is WinParams => !!w && typeof w.w === 'number');
  const widths = wins.length ? [...new Set(wins.map(w => w.w as number))] : [0.6];
  const win = wins.find(w => w.sillSlot !== null) ?? wins[0];
  return {widths, hFrac: win?.h !== undefined && win.h <= 1 ? win.h : 0.5, sillM: win?.sill ?? 0.9};
}

export interface CrownPlan {
  group: LargeGroupFit;
  /** the overhung panel and its frame */
  panel: Panel | undefined;
  frame: Frame;
  /** the crown's plan along its own axes: s along the wall, v out of it */
  sMin: number; sMax: number;
  /** the soffit height (the storey line), the ceiling plane (soffit + ribs) and the eaves */
  soffitM: number; cutM: number; eavesM: number;
}

/** Resolve the crown's frame, extent and heights from the fitted recipe (the panel's own axes, never world x/z). */
export function resolveCrown(recipe: LargeBuildingRecipe, crown: CrownIntent, panels: Panel[] = []): CrownPlan {
  const group = crownGroup(recipe);
  const panel = group.mainPanel === null ? undefined : panels.find(p => p.index === group.mainPanel);
  const storeys = group.storeys;
  if (!Number.isInteger(crown.storeys) || crown.storeys < 1 || crown.storeys >= storeys) throw Error(`${recipe.id}: crown.storeys ${crown.storeys} must be 1..${storeys - 1}`);
  const soffit = group.lines[storeys - crown.storeys];
  if (soffit === undefined) throw Error(`${recipe.id}: no storey line ${storeys - crown.storeys} for the crown soffit`);
  const [ux, uz] = panel ? norm2(panel.r[0], panel.r[2]) : [1, 0];
  const [nx, nz] = panel ? norm2(panel.n[0], panel.n[2]) : [0, 1];
  const o: V3 = panel ? [panel.o[0], 0, panel.o[2]] : [0, 0, 0];
  const frame: Frame = {o, u: [ux, 0, uz], n: [nx, 0, nz]};
  // The plan's extent along the wall: the building's two end-wall planes projected on u. The overhung panel alone
  // stops short of them (Haarlemmerweg 940's south panel ends 0.83 m east of the west wall above the notch), so a
  // crown drawn to the panel's span leaves an open vertical slot at the corner, which the photos do not show.
  const sAll = recipe.set.ground.flatMap(g => g.rings.flat().map(p => (p[0] - o[0]) * ux + (p[2] - o[2]) * uz));
  const planeAt = (bearing: number): number | null => {
    const dist = (g: LargeGroupFit) => Math.abs((((g.bearingDeg ?? bearing) - bearing + 540) % 360) - 180);
    const g = [...recipe.groups].sort((a, b) => dist(a) - dist(b))[0];
    const q = g?.mainPanel === null || g?.mainPanel === undefined ? undefined : panels.find(r => r.index === g.mainPanel);
    return q ? (q.o[0] - o[0]) * ux + (q.o[2] - o[2]) * uz : null;
  };
  const sW = planeAt(270), sE = planeAt(90);
  const sMin = sW !== null && sW < (panel ? panel.uMin : Math.min(...sAll)) ? sW : panel ? panel.uMin : Math.min(...sAll);
  const sMax = sE !== null && sE > (panel ? panel.uMax : Math.max(...sAll)) ? sE : panel ? panel.uMax : Math.max(...sAll);
  return {group, panel, frame, sMin, sMax, soffitM: soffit, cutM: soffit + SOFFIT_RIB_M, eavesM: group.eavesM};
}

const at = (f: Frame, s: number, y: number, v = 0): V3 => [f.o[0] + f.u[0] * s + f.n[0] * v, y, f.o[2] + f.u[2] * s + f.n[2] * v];
const runPoint = (f: Frame, r: Run, s: number, y: number, off = 0): V3 =>
  r.where === 'front' ? at(f, s, y, r.at + off) : at(f, r.at + r.outward * off, y, s);
const runNormal = (f: Frame, r: Run): V3 => r.where === 'front' ? [f.n[0] * 1, 0, f.n[2] * 1] : [f.u[0] * r.outward, 0, f.u[2] * r.outward];

/**
 * Replace the overhanging side's crown wall, extend the end walls, and close the crown with a coffered soffit and a
 * roof deck. Mutates the mesh (part 0: the new panels are the shell's own massing, not applied ornament).
 */
export function applyCrownCantilever(mesh: MeshBuilder, recipe: LargeBuildingRecipe, crown: CrownIntent, panels: Panel[] = []): CrownReport {
  const plan = resolveCrown(recipe, crown, panels);
  const {group, frame, sMin, sMax, eavesM, soffitM, cutM} = plan;
  const over: Record<string, number> = {N: 0, S: 0, E: 0, W: 0};
  for (const b of BEARINGS) if (crown.overhang?.[b]) over[b] = crown.overhang[b]! * group.pitchM;
  const bearings = BEARINGS.filter(b => over[b] > 0.05);
  if (!bearings.length) throw Error(`${recipe.id}: crown needs at least one overhanging bearing`);
  if (bearings.some(b => b !== 'S')) throw Error(`${recipe.id}: crownCantilever implements the south overhang (the photographed side); ${bearings.join('+')} is not supported yet`);
  const d = over.S;
  const before = mesh.triangles;
  // The shell's own south wall stays exactly as composed: the crown volume (moved wall, end strips, soffit, deck)
  // wraps it, so its crown band is enclosed and never seen; nothing is cut, so no seam opens and no window part is
  // left behind. (Cutting and moving the band would tear every reveal and sill at the storey line.)

  const win = crownWindow(recipe, group);
  const slots = (g: LargeGroupFit) => ({wall: g.slots.wall, glass: g.slots.glass, stone: g.slots.stone, frame: g.slots.frame});
  const groupAt = (bearing: number) => {
    const dist = (g: LargeGroupFit) => Math.abs((((g.bearingDeg ?? bearing) - bearing + 540) % 360) - 180);
    return [...recipe.groups].sort((a, b) => dist(a) - dist(b))[0] ?? group;
  };
  const sGroup = group, eGroup = groupAt(90), wGroup = groupAt(270);
  const front: Run = {where: 'front', at: d, outward: 1};
  // the crown's floors: the shell's own lines from the soffit line up (the plain parapet band is the last one)
  const floors = [...group.lines.filter(l => l >= soffitM - EPS && l < eavesM - 0.05), eavesM];
  // bays phase-aligned with the panel below: the panel's u axis, one bay per `pitchM`, over the panel's own span
  const panelBays = (bays: number) => {
    const out: {u0: number; u1: number; index: number}[] = [];
    const p = plan.panel, pitch = p ? (p.uMax - p.uMin) / bays : (sMax - sMin) / bays;
    for (let b = 0; b < bays; b++) {
      const c = p ? p.uMin + (b + 0.5) * pitch : sMin + (b + 0.5) * pitch;
      out.push({u0: c - pitch / 2, u1: c + pitch / 2, index: b});
    }
    return out.sort((a, b) => a.u0 - b.u0);
  };
  const baysAcross = Math.max(1, group.bays);
  const panelSpan: [number, number] = [plan.panel ? plan.panel.uMin : sMin, plan.panel ? plan.panel.uMax : sMax];
  addCrownWall(mesh, frame, front, panelSpan[0], panelSpan[1], cutM, floors, panelBays(baysAcross), win, slots(sGroup));
  // the building's end-wall planes stand up to 0.9 m outside the overhung panel: a plain white corner pier closes
  // the crown's corner there (the photos show a solid white corner, not an open slot)
  if (sMin < panelSpan[0] - 0.02) {
    addPanel(mesh, frame, front, sMin, panelSpan[0], cutM, eavesM, sGroup.slots.wall, 1);
    // and its return on the shell's own wall plane, closing the crown's corner over the base's notch
    addPanel(mesh, frame, {where: 'front', at: 0, outward: 1}, sMin, panelSpan[0], cutM, eavesM, sGroup.slots.wall, 1);
  }
  if (sMax > panelSpan[1] + 0.02) {
    addPanel(mesh, frame, front, panelSpan[1], sMax, cutM, eavesM, sGroup.slots.wall, 1);
    addPanel(mesh, frame, {where: 'front', at: 0, outward: 1}, panelSpan[1], sMax, cutM, eavesM, sGroup.slots.wall, 1);
  }
  // the shell's own S wall now stops at the cut: close the band behind the soffit with the wall colour (its top edge
  // is the soffit ceiling's north edge, its bottom edge the shell wall's cut line)
  addPanel(mesh, frame, {where: 'front', at: 0, outward: 1}, sMin, sMax, soffitM, cutM, sGroup.slots.wall, 1);
  // end walls: the new strip south of the shell's end wall, two pair-bays wide, from the shell's wall line to the crown
  const stripBays = Math.max(1, Math.round(d / (group.pitchM * 2)));
  const stripList = Array.from({length: stripBays}, (_, i) => ({u0: i * d / stripBays, u1: (i + 1) * d / stripBays, index: i}));
  const west: Run = {where: 'endW', at: sMin, outward: -1}, east: Run = {where: 'endE', at: sMax, outward: 1};
  addCrownWall(mesh, frame, east, 0, d, cutM, floors, stripList, win, slots(eGroup));
  addCrownWall(mesh, frame, west, 0, d, cutM, floors, stripList, win, slots(wGroup));
  // soffit: ceiling at the cut, rib undersides at the soffit line, fascia on the three visible edges
  const coffers = crown.coffers === false ? null : {across: baysAcross, deep: Math.max(1, Math.round(d / group.pitchM))};
  addSoffit(mesh, frame, front, {s0: sMin, s1: sMax, d, yCeil: cutM, yRib: soffitM, slots: {wall: sGroup.slots.wall}, coffers});
  // parapet: a 0.2 m up-facing strip on each wall top (closes the wall's top edge) and its inner reveal, so the
  // crown's top has a real edge without any face lying in a wall plane (no coplanar overlap)
  const deckTop = eavesM - CROWN_DECK_M + 0.2;
  const p = PARAPET_CAP_M;
  mesh.quad(sGroup.slots.wall, at(frame, sMin, eavesM, d - p), at(frame, sMax, eavesM, d - p), at(frame, sMax, eavesM, d), at(frame, sMin, eavesM, d), 0, [0, 1, 0]);
  mesh.quad(wGroup.slots.wall, at(frame, sMin, eavesM, 0), at(frame, sMin + p, eavesM, 0), at(frame, sMin + p, eavesM, d - p), at(frame, sMin, eavesM, d - p), 0, [0, 1, 0]);
  mesh.quad(eGroup.slots.wall, at(frame, sMax - p, eavesM, 0), at(frame, sMax, eavesM, 0), at(frame, sMax, eavesM, d - p), at(frame, sMax - p, eavesM, d - p), 0, [0, 1, 0]);
  mesh.quad(sGroup.slots.wall, at(frame, sMin, deckTop, d - p), at(frame, sMax, deckTop, d - p), at(frame, sMax, eavesM, d - p), at(frame, sMin, eavesM, d - p), 0, [-frame.n[0], 0, -frame.n[2]] as V3);
  mesh.quad(wGroup.slots.wall, at(frame, sMin + p, deckTop, 0), at(frame, sMin + p, deckTop, d - p), at(frame, sMin + p, eavesM, d - p), at(frame, sMin + p, eavesM, 0), 0, alongFrame(frame, 1));
  mesh.quad(eGroup.slots.wall, at(frame, sMax - p, deckTop, 0), at(frame, sMax - p, deckTop, d - p), at(frame, sMax - p, eavesM, d - p), at(frame, sMax - p, eavesM, 0), 0, alongFrame(frame, -1));
  // roof deck over the overhang strip: a closed slab 0.15 m inside the walls (nothing open, nothing near-coplanar)
  deckBox(mesh, frame, sMin + 0.15, sMax - 0.15, 0.15, d - 0.15, eavesM - CROWN_DECK_M, 0.2);
  void before;

  return {soffitM, overhangM: {N: over.N, S: over.S, E: over.E, W: over.W}, crownStoreys: crown.storeys, bearings,
    coffers, addedTriangles: mesh.triangles - before, removedTriangles: 0};
}

/** A rectangle of a wall run (s run x y run) at depth `off` (negative = recessed), facing outward or inward. */
function addPanel(mesh: MeshBuilder, f: Frame, r: Run, s0: number, s1: number, y0: number, y1: number, slot: string, facing: 1 | -1, off = 0) {
  if (s1 - s0 < 1e-4 || y1 - y0 < 1e-4) return 0;
  const n = runNormal(f, r).map(v => v * facing) as V3;
  mesh.quad(slot, runPoint(f, r, s0, y0, off), runPoint(f, r, s1, y0, off), runPoint(f, r, s1, y1, off), runPoint(f, r, s0, y1, off), 0, n);
  return 1;
}

/**
 * One crown wall run: the wall field (per-bay bands + piers) and one recessed opening per bay per storey, with a stone
 * sill face and a mullion bar in the wide openings. `y0` clips the first (fascia) band; every band is cut on the bay
 * grid so no long edge spans an opening. The height fraction, sill and width pattern come from the group's measured row.
 */
export function addCrownWall(mesh: MeshBuilder, f: Frame, r: Run, s0: number, s1: number, y0: number,
  floors: number[], bays: {u0: number; u1: number; index: number}[], win: {widths: number[]; hFrac: number; sillM: number}, slots: {wall: string; glass: string; stone: string; frame: string}) {
  const n = runNormal(f, r);
  const reveal = 0.18;
  const along = (sign: 1 | -1): V3 => [f.u[0] * sign, 0, f.u[2] * sign];
  for (let k = 0; k + 1 < floors.length; k++) {
    const fb = Math.max(floors[k], y0), ft = floors[k + 1], h = ft - fb;
    if (h < 0.05) continue;
    if (h < 1.2) { for (const b of bays) addPanel(mesh, f, r, b.u0, b.u1, fb, ft, slots.wall, 1); continue; } // the parapet band
    const sillY = fb + Math.min(h - 0.4, win.sillM), wh = Math.max(0.4, Math.min(h - 0.3 - win.sillM, win.hFrac * h));
    const headY = sillY + wh;
    for (const b of bays) {
      addPanel(mesh, f, r, b.u0, b.u1, fb, sillY, slots.wall, 1);
      addPanel(mesh, f, r, b.u0, b.u1, headY, ft, slots.wall, 1);
    }
    let cursor = s0;
    for (const b of bays) {
      const p = b.u1 - b.u0, frac = win.widths[Math.max(0, b.index) % win.widths.length];
      const w = Math.max(0.4, Math.min(p - 0.16, frac * p)), c = (b.u0 + b.u1) / 2, w0 = c - w / 2, w1 = c + w / 2;
      addPanel(mesh, f, r, cursor, w0, sillY, headY, slots.wall, 1);
      cursor = w1;
      // reveal: jambs (facing into the opening), head (down), sill (up, stone)
      mesh.quad(slots.wall, runPoint(f, r, w0, sillY), runPoint(f, r, w0, headY), runPoint(f, r, w0, headY, -reveal), runPoint(f, r, w0, sillY, -reveal), 0, along(1));
      mesh.quad(slots.wall, runPoint(f, r, w1, sillY), runPoint(f, r, w1, headY), runPoint(f, r, w1, headY, -reveal), runPoint(f, r, w1, sillY, -reveal), 0, along(-1));
      mesh.quad(slots.wall, runPoint(f, r, w0, headY), runPoint(f, r, w1, headY), runPoint(f, r, w1, headY, -reveal), runPoint(f, r, w0, headY, -reveal), 0, [0, -1, 0]);
      mesh.quad(slots.stone, runPoint(f, r, w0, sillY), runPoint(f, r, w1, sillY), runPoint(f, r, w1, sillY, -reveal), runPoint(f, r, w0, sillY, -reveal), 0, [0, 1, 0]);
      // glass at the back of the reveal, with one mullion in the wide (two-light) openings
      mesh.quad(slots.glass, runPoint(f, r, w0, sillY, -reveal), runPoint(f, r, w1, sillY, -reveal), runPoint(f, r, w1, headY, -reveal), runPoint(f, r, w0, headY, -reveal), 0, n);
      if (w >= 1.0) {
        const mu = c, mw = 0.025, o = -reveal + 0.025, o2 = o + 0.02;
        const b00 = runPoint(f, r, mu - mw, sillY + 0.02, o), b10 = runPoint(f, r, mu + mw, sillY + 0.02, o);
        const b01 = runPoint(f, r, mu - mw, sillY + 0.02, o2), b11 = runPoint(f, r, mu + mw, sillY + 0.02, o2);
        const t00 = runPoint(f, r, mu - mw, headY - 0.02, o), t10 = runPoint(f, r, mu + mw, headY - 0.02, o);
        const t01 = runPoint(f, r, mu - mw, headY - 0.02, o2), t11 = runPoint(f, r, mu + mw, headY - 0.02, o2);
        mesh.quad(slots.frame, b00, b10, t10, t00, 0, n);
        mesh.quad(slots.frame, b11, b01, t01, t11, 0, n.map(v => -v) as V3);
        mesh.quad(slots.frame, b00, t00, t01, b01, 0, along(-1));
        mesh.quad(slots.frame, b10, b11, t11, t10, 0, along(1));
        mesh.quad(slots.frame, b00, b01, b11, b10, 0, [0, -1, 0]);
        mesh.quad(slots.frame, t00, t10, t11, t01, 0, [0, 1, 0]);
      }
    }
    addPanel(mesh, f, r, cursor, s1, sillY, headY, slots.wall, 1);
  }
  return 1;
}

/**
 * Coffered soffit over the overhang: the ceiling at `yCeil`, square ribs hanging to `yRib` on the facade's bay grid,
 * a 0.45 m fascia on the south and both ends. Ribs are open at the top (the ceiling is their top face) and stand
 * 1.5 cm clear of the fascia, so no coplanar face.
 */
export function addSoffit(mesh: MeshBuilder, f: Frame, front: Run, o: {s0: number; s1: number; d: number; yCeil: number; yRib: number; slots: {wall: string}; coffers: {across: number; deep: number} | null}) {
  const {s0, s1, d, yCeil, yRib} = o;
  const down: V3 = [0, -1, 0];
  const pt = (s: number, v: number) => at(f, s, 0, v);
  // fascia on the south and both ends (the crown wall and end strips start on its top edge)
  mesh.quad(o.slots.wall, runPoint(f, front, s0, yRib), runPoint(f, front, s1, yRib), runPoint(f, front, s1, yCeil), runPoint(f, front, s0, yCeil), 0, runNormal(f, front));
  mesh.quad(o.slots.wall, pt(s0, 0).map((v, i) => i === 1 ? yRib : v) as V3, pt(s0, d).map((v, i) => i === 1 ? yRib : v) as V3, pt(s0, d).map((v, i) => i === 1 ? yCeil : v) as V3, pt(s0, 0).map((v, i) => i === 1 ? yCeil : v) as V3, 0, alongFrame(f, -1));
  mesh.quad(o.slots.wall, pt(s1, 0).map((v, i) => i === 1 ? yRib : v) as V3, pt(s1, d).map((v, i) => i === 1 ? yRib : v) as V3, pt(s1, d).map((v, i) => i === 1 ? yCeil : v) as V3, pt(s1, 0).map((v, i) => i === 1 ? yCeil : v) as V3, 0, alongFrame(f, 1));
  if (!o.coffers) { mesh.quad(o.slots.wall, pt(s0, 0).map((v, i) => i === 1 ? yCeil : v) as V3, pt(s1, 0).map((v, i) => i === 1 ? yCeil : v) as V3, pt(s1, d).map((v, i) => i === 1 ? yCeil : v) as V3, pt(s0, d).map((v, i) => i === 1 ? yCeil : v) as V3, 0, down); return; }
  const {across, deep} = o.coffers;
  const cw = (s1 - s0) / across, cd = d / deep, rib = 0.22, gap = 0.015;
  for (let i = 0; i < across; i++) for (let j = 0; j < deep; j++) {
    const sa = s0 + i * cw, sb = sa + cw, va = j * cd, vb = va + cd;
    mesh.quad(o.slots.wall, at(f, sa, yCeil, va), at(f, sb, yCeil, va), at(f, sb, yCeil, vb), at(f, sa, yCeil, vb), 0, down);
  }
  const ribBox = (sa: number, sb: number, va: number, vb: number) => {
    mesh.quad(o.slots.wall, at(f, sb, yRib, va), at(f, sb, yRib, vb), at(f, sb, yCeil, vb), at(f, sb, yCeil, va), 0, alongFrame(f, 1));
    mesh.quad(o.slots.wall, at(f, sa, yRib, va), at(f, sa, yRib, vb), at(f, sa, yCeil, vb), at(f, sa, yCeil, va), 0, alongFrame(f, -1));
    mesh.quad(o.slots.wall, at(f, sa, yRib, vb), at(f, sb, yRib, vb), at(f, sb, yCeil, vb), at(f, sa, yCeil, vb), 0, [f.n[0], 0, f.n[2]]);
    mesh.quad(o.slots.wall, at(f, sa, yRib, va), at(f, sb, yRib, va), at(f, sb, yCeil, va), at(f, sa, yCeil, va), 0, [-f.n[0], 0, -f.n[2]]);
    mesh.quad(o.slots.wall, at(f, sa, yRib, va), at(f, sb, yRib, va), at(f, sb, yRib, vb), at(f, sa, yRib, vb), 0, down);
  };
  for (let i = 0; i <= across; i++) {
    const s = s0 + i * cw, half = Math.min(rib / 2, cw / 3);
    const sa = Math.max(s0 + gap, s - half), sb = Math.min(s1 - gap, s + half);
    if (sb - sa > 1e-3) ribBox(sa, sb, gap, d - gap);
  }
  for (let j = 0; j <= deep; j++) {
    const v = j * cd, half = Math.min(rib / 2, cd / 3);
    const va = Math.max(gap, v - half), vb = Math.min(d - gap, v + half);
    if (vb - va > 1e-3) ribBox(s0 + gap, s1 - gap, va, vb);
  }
}

const alongFrame = (f: Frame, sign: 1 | -1): V3 => [f.u[0] * sign, 0, f.u[2] * sign];

/** A closed roof-deck slab in the crown's frame (top, bottom and four sides share every edge). */
function deckBox(mesh: MeshBuilder, f: Frame, s0: number, s1: number, v0: number, v1: number, y: number, thick: number) {
  const up: V3 = [0, 1, 0], down: V3 = [0, -1, 0];
  mesh.quad('roof', at(f, s0, y + thick, v0), at(f, s1, y + thick, v0), at(f, s1, y + thick, v1), at(f, s0, y + thick, v1), 0, up);
  mesh.quad('roof', at(f, s0, y, v0), at(f, s1, y, v0), at(f, s1, y, v1), at(f, s0, y, v1), 0, down);
  mesh.quad('roof', at(f, s0, y, v0), at(f, s1, y, v0), at(f, s1, y + thick, v0), at(f, s0, y + thick, v0), 0, [-f.n[0], 0, -f.n[2]]);
  mesh.quad('roof', at(f, s0, y, v1), at(f, s1, y, v1), at(f, s1, y + thick, v1), at(f, s0, y + thick, v1), 0, [f.n[0], 0, f.n[2]]);
  mesh.quad('roof', at(f, s0, y, v0), at(f, s0, y, v1), at(f, s0, y + thick, v1), at(f, s0, y + thick, v0), 0, alongFrame(f, -1));
  mesh.quad('roof', at(f, s1, y, v0), at(f, s1, y, v1), at(f, s1, y + thick, v1), at(f, s1, y + thick, v0), 0, alongFrame(f, 1));
}

export const CROWN_SIDES = BEARINGS;
