// Facade ornaments: the architectural dressing of an Amsterdam facade, in 3D.
//
// facadeExtras.ts holds the street furniture of a facade (hoist beams, stoops, bikes, balconies);
// this file holds its architecture, the parts a painter would pick out in white:
//   - canal houses (17th-18th c.): the crowning kroonlijst on consoles, white sills, lintels with
//     keystones and proud window frames, a door surround with its fanlight bars, floor cornices,
//     pilasters, warehouse loading doors, vases on the cornice;
//   - 19th century: stucco window hoods, string courses, a rusticated plinth, a console cornice;
//   - Amsterdam School (1910-1935): brick fins on the piers, corbelled and stepped rooflines,
//     rounded oriels, a stone plinth band, corner sculpture, ribbon bands, small-paned frames in
//     white or orange, a brick door arch, a corner tower;
//   - postwar and modern: a white roof fascia.
// Everything lines up with the painted openings (facadeOpenings.ts) and the wall's bay grid,
// is drawn as flat-coloured boxes and strips, and is atomic (all of a cornice or none of it).

import { hash01, type ExtraContext, type ExtraSink, type WallComponent } from './facadeExtraCore.js';
import { presetOpenings, type OpeningRow, type Openings } from './facadeOpenings.js';
import type { FacadeStyle } from './genericFacades.js';
import { pilasterHex } from './look/pilasterTone.js';
import { fitProjectionFor } from './projectionWindowFit.js';
import { HEAD, headGrammarOf, headPieces, headRise, type HeadGrammar } from './houseLine/headGrammar.js';

// --- Palette ---------------------------------------------------------------------
export const WHITE = '#efece4', CREAM = '#e4d9bf', STONE = '#cfc6b4', SANDSTONE = '#cdbb98', BLUESTONE = '#5b6066';
const GLAZED_TILE = ['#3d5a4c', '#2f3f52', '#6b3f2e'], SCHOOL_FRAMES = [WHITE, WHITE, '#d9772e', '#e8e0c8'];
const IRON = '#1f2124';
const LUIKEN = ['#2c4f33', '#7a1f2b', '#1f2a2a', '#2c4f33'];
const pickOf = <T>(list: readonly T[], r: number) => list[Math.floor(r * list.length) % list.length];

/** A colour scaled towards black (k < 1) or white (k > 1). */
export function shadeHex(hex: string, k: number): string {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const out = v.map(c => Math.max(0, Math.min(255, Math.round(k <= 1 ? c * k : c + (255 - c) * (k - 1)))));
  return `#${out.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

// --- Geometry helpers --------------------------------------------------------------
/** The openings this building's walls show: given by the mesh, else the bay look's (the default look). */
export const openingsOf = (c: ExtraContext): Openings => {
  const o = c.openings ?? presetOpenings(c.id, c.style);
  // A mirrored door bay (WallLayout.doorMirror): the door and its side window change sides, as the painted cell does.
  return c.layout.doorMirror ? { ...o, door: { ...o.door, axis: 1 - o.door.axis }, doorWindow: o.doorWindow ? { ...o.doorWindow, axes: o.doorWindow.axes.map(a => 1 - a), ...(o.doorWindow.widths ? { widths: [...o.doorWindow.widths] } : {}) } : null } : o;
};
export const isStreetWall = (c: ExtraContext) => c.streetSide ?? c.layout.doorBays.length > 0;
export const storeyZ = (c: ExtraContext, s: number) => c.base + c.layout.groundM + s * c.layout.storeyM;

export type Span = { x: number; hw: number; z0: number; z1: number };
/** The window openings of one row across the wall: upper storey `s`, or the ground floor (s = -1). */
export function windowSpans(c: ExtraContext, s: number): Span[] {
  const o = openingsOf(c), l = c.layout, bw = l.bayWidthM, out: Span[] = [];
  const doors = new Set(l.doorBays);
  for (let i = 0; i < l.bays; i++) {
    const row: OpeningRow | null = s >= 0 ? o.upper : doors.has(i) ? o.doorWindow : c.shopfront ? null : o.ground;
    if (!row) continue;
    const z = s >= 0 ? storeyZ(c, s) : c.base, h = s >= 0 ? l.storeyM : l.groundM;
    // House rows: a stated window share (houseLine/rowSeries.ts ROW_TYPE_LOOK) widens the upper windows to that share of
    // their axis pitch, frames included (Kinkerstraat review: the photo's windows take ~75 % of the bay, the preset ~62 %).
    const share = s >= 0 ? c.rowDress?.windowShare : undefined;
    for (const [index,axis] of row.axes.entries()) out.push({ x: (i + axis) * bw, hw: share ? share * bw / row.axes.length / 2 - ROW_FRAME_M : ((row.widths?.[index] ?? row.width) * bw) / 2, z0: z + row.sill * h, z1: z + row.head * h });
  }
  return out;
}
/** The frame width a widened row window keeps inside its share (m). */
const ROW_FRAME_M = 0.07;
/** The front door of this wall, if it has one. */
export function doorSpan(c: ExtraContext): Span | null {
  if (!c.layout.doorBays.length || !c.groundLevel) return null;
  const d = openingsOf(c).door, bw = c.layout.bayWidthM, g = c.layout.groundM;
  return { x: (c.layout.doorBays[0] + d.axis) * bw, hw: (d.width * bw) / 2, z0: c.base + d.bottom * g, z1: c.base + d.top * g };
}
/** Piers: the wall between window columns (and near each end), where consoles and fins stand. */
export function pierXs(c: ExtraContext): number[] {
  const xs = windowSpans(c, 0).map(w => w.x).sort((a, b) => a - b), out = [Math.min(0.2, c.f.len / 4)];
  for (let i = 1; i < xs.length; i++) out.push((xs[i - 1] + xs[i]) / 2);
  out.push(c.f.len - Math.min(0.2, c.f.len / 4));
  return out;
}
/** [a0, a1] with the door (plus a margin) cut out. */
function aroundDoor(c: ExtraContext, a0: number, a1: number, margin = 0.12): Array<[number, number]> {
  const d = doorSpan(c);
  if (!d) return [[a0, a1]];
  const out: Array<[number, number]> = [], l = d.x - d.hw - margin, r = d.x + d.hw + margin;
  if (l > a0 + 0.05) out.push([a0, Math.min(a1, l)]);
  if (r < a1 - 0.05) out.push([Math.max(a0, r), a1]);
  return out;
}
/** How many upper storeys of per-window dressing fit `room` triangles at `perWindow` each (at least 1, at most `max`). */
function storeysThatFit(c: ExtraContext, s: ExtraSink, perWindow: number, max: number): number {
  const per = Math.max(1, windowSpans(c, 0).length) * perWindow;
  return Math.max(1, Math.min(max, c.layout.storeys, Math.floor(s.room() / per)));
}

/** A speklaag course (m): 14 cm of stone every 30 cm of plain wall at most, at most 3 between two rows; the block faces'
 *  stripe projection. */
export const SPEKLAAG = { h: 0.14, pitch: 0.3, max: 3, out: 0.045 } as const;
/** The block faces' eared surround (blockBuilding/dressings.ts DRESS.surround; pinned equal in routeAFields.test.ts). */
export const EARED_SURROUND = { t: 0.13, out: 0.05, ear: 0.12, earH: 0.14, earOut: 0.07 } as const;

// --- Components ------------------------------------------------------------------------
const CANAL: readonly FacadeStyle[] = ['canal', 'c19'];

/** Profile-only masonry relief; excluded from generic probabilistic components. */
export function paleMasonryAccents(c: ExtraContext, s: ExtraSink): void {
    if (!c.recipe || openingsOf(c).ribbon) return;
    const colour = c.recipe.frameHex ?? CREAM;
    // Alternate pale masonry beside the opening; glazing stays rectangular.
    const windows = windowSpans(c, 0);
    const n = Math.min(c.layout.storeys, Math.floor(s.room() / Math.max(1, windows.length * 24)));
    for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
      for (const fraction of [.15, .5, .85]) {
        const z = w.z0 + (w.z1 - w.z0) * fraction;
        for (const sign of [-1, 1]) {
          const a = w.x + sign * (w.hw + .1);
          if (a - .12 < 0 || a + .12 > c.f.len || z + .06 > c.top) continue;
          s.strip(c.f, a - .12, a + .12, .065, z - .06, z + .06, colour);
        }
      }
    }
    // Quoins belong to actual facade ends, never to each repeated texture bay.
    const ends = [c.runStart ? .16 : null, c.runEnd ? c.f.len - .16 : null].filter((x): x is number => x !== null);
    const count = Math.min(12, Math.floor((c.top - c.base) / .6), Math.floor(s.room() / Math.max(4, ends.length * 4)));
    for (let i = 0; i < count; i++) for (const x of ends) {
      const z = c.base + .25 + i * .6, half = i % 2 ? .12 : .16;
      s.strip(c.f, Math.max(0, x - half), Math.min(c.f.len, x + half), .055, z, Math.min(c.top, z + .18), colour);
    }
}

/** A connected pale entrance assembly follows the quiet painted door rather than inventing a leaf. */
export function restrainedDoorSurround(c: ExtraContext, s: ExtraSink, r: number): void {
  const d = doorSpan(c);
  if (!d || c.shopfront || !c.recipe || c.recipe.family !== 'masonry' || c.recipe.windowHead === 'segmental') return;
  const pale = c.recipe.frameHex ?? WHITE;
  const l = d.x - d.hw, right = d.x + d.hw, top = d.z1 + .025;
  const cap = Math.min(c.base + c.layout.groundM - .04, top + .10);
  if (l < .12 || right > c.f.len - .12 || cap <= top) return;
  // Continuous, shallow masonry surround with a plain header and separate threshold.
  s.strip(c.f, l - .11, l - .005, .04, d.z0, cap, pale);
  s.strip(c.f, right + .005, right + .11, .04, d.z0, cap, pale);
  s.strip(c.f, l - .11, right + .11, .04, top, cap, pale);
  s.strip(c.f, l - .12, right + .12, .06, d.z0 - .035, d.z0 + .015, pale);
  if (c.recipe.period === 'c19' && r < (c.recipe.trim?.arches ?? 0) * .7 && cap + .06 < c.base + c.layout.groundM) {
    s.strip(c.f, d.x - .045, d.x + .045, .065, top - .025, cap + .06, pale);
  }
}

/** One source-supported entrance: raised access, joined pilasters and an open pediment. */
export function raisedPilasterEntrance(c: ExtraContext, s: ExtraSink): void {
  const d = doorSpan(c);
  if (!d || c.shopfront || !c.groundLevel || c.recipe?.entranceAssembly !== 'raised-pilaster') return;
  const colour = c.recipe.frameHex ?? WHITE;
  const l = d.x - d.hw, right = d.x + d.hw, a = l - .19, b = right + .19;
  const head = d.z1 + .05, rise = Math.min(.28, (b - a) * .2), crown = head + .14;
  if (a < .03 || b > c.f.len - .03 || crown + rise > c.base + c.layout.groundM - .04) return;
  s.begin();
  // The stair landing reaches the painted threshold rather than standing below a flush door.
  const threshold = d.z0 - c.base;
  for (let i = 0; i < 3; i++) {
    s.box(c.f, a, b, .01, .78 - i * .23, c.base + threshold * i / 3, c.base + threshold * (i + 1) / 3, STONE, true);
  }
  for (const [p, q] of [[a, l - .015], [right + .015, b]]) {
    s.strip(c.f, p, q, .10, d.z0, head + .10, colour);
    s.strip(c.f, p - .02, q + .02, .15, d.z0, d.z0 + .12, colour);
    s.strip(c.f, p - .02, q + .02, .15, head - .09, head + .07, colour);
  }
  s.strip(c.f, a - .02, b + .02, .16, head, crown, colour);
  // Two narrow diagonal mouldings leave masonry visible within the triangular crown.
  const apex = d.x, z = crown + rise;
  s.wallQuad(c.f, [[a - .04, crown], [apex, z], [apex, z - .055], [a - .04, crown - .055]], .17, colour);
  s.wallQuad(c.f, [[apex, z], [b + .04, crown], [b + .04, crown - .055], [apex, z - .055]], .17, colour);
  s.strip(c.f, a - .04, b + .04, .17, crown - .055, crown, colour);
  // A joined floor course continues the portal's horizontal hierarchy across the front.
  const floor = c.base + c.layout.groundM;
  s.strip(c.f, 0, c.f.len, .12, floor - .12, floor - .04, colour);
  s.strip(c.f, 0, c.f.len, .16, floor - .04, floor + .015, colour);
  s.commit();
}

/** A quieter observed raised entrance shares its leaf and stair landing, without a pediment. */
export function raisedPlainEntrance(c: ExtraContext, s: ExtraSink): void {
  const d = doorSpan(c);
  if (!d || c.shopfront || !c.groundLevel || c.recipe?.entranceAssembly !== 'raised-plain') return;
  const a = d.x - d.hw - .12, b = d.x + d.hw + .12;
  if (a < .02 || b > c.f.len - .02) return;
  s.begin();
  restrainedDoorSurround(c, s, 1);
  const threshold = d.z0 - c.base;
  for (let i = 0; i < 3; i++) s.box(c.f, a, b, .01, .75 - i * .22,
    c.base + threshold * i / 3, c.base + threshold * (i + 1) / 3, STONE, true);
  s.commit();
}

/** A connected raised base and compact entry stair; all axes come from the painted group. */
export function canalSideEntrance(c: ExtraContext, s: ExtraSink): void {
  const d=doorSpan(c);
  if(!d||c.shopfront||!isStreetWall(c)||c.recipe?.groundAssembly!=='tall-side-entry')return;
  const a=d.x-d.hw-.08,b=d.x+d.hw+.08,threshold=d.z0;
  if(a<.02||b>c.f.len-.02||threshold<=c.base+.1)return;
  s.begin();
  s.strip(c.f,0,c.f.len,.035,c.base,threshold,STONE);
  for(let i=0;i<3;i++)s.box(c.f,a,b,.01,.84-i*.24,c.base+(threshold-c.base)*i/3,c.base+(threshold-c.base)*(i+1)/3,STONE);
  for(const x of [a,b]){
    const side={x0:c.f.x0+c.f.ux*x,y0:c.f.y0+c.f.uy*x,ux:c.f.nx,uy:c.f.ny,nx:c.f.ux,ny:c.f.uy,len:.84};
    s.strip(side,.03,.82,.015,threshold+.68,threshold+.72,IRON,.03);
    for(const out of [.08,.42,.78])s.strip(c.f,x-.015,x+.015,out,c.base+(threshold-c.base)*(1-out/.84),threshold+.70,IRON,.03);
  }
  s.commit();
}

// --- House rows (lane R): a series' stated dressing ---------------------------------------------------------------------
/** The row dressings' sizes (m). Head course blocks: the dotted course of white blocks at the window heads (Kinkerstraat
 *  110-100); keystone: a white key on a flat brick arch (98, 96, 92); tympanum: the segmental head's stone fill and its
 *  brick ring (94, 90, 86-88); cornice: the heavy consoled cornice with its frieze (110-90). */
export const ROW_DRESS = {
  block: { w: 0.15, tall: 0.3, short: 0.2, gap: 0.09, pier: 0.42, out: 0.05 },
  keystone: { w: 0.18, h: 0.34, arch: 0.24, out: 0.06 },
  tympanum: { rise: 0.32, ring: 0.14, out: 0.04 },
  /** Lane R round 23: a patterned brick band at the heads (Tolstraat 108704, Pieter Aertszstraat 126746): a course of
   *  the wall's darker brick across the front with a row of burnt-brick blocks on it, wall-family tones, never white. */
  brickBand: { h: 0.32, out: 0.015, block: 0.12, pitch: 0.26, blockOut: 0.025, band: 0.84, dark: 0.64 },
  cornice: { h: 1.15, frieze: 0.62, console: 0.16, pitch: 0.85, corona: 0.42, out: 0.45 },
} as const;

type RowWindow = { x0: number; x1: number; z0: number; z1: number; storey: number; shape?: string; dressing?: string };
/** The windows a row dressing hangs on: the record's boxes on this edge, else the grid's windows with the heads by span. */
export function rowWindowsOf(c: ExtraContext): RowWindow[] {
  const d = c.rowDress;
  if (!d) return [];
  if (d.windows?.length) return d.windows;
  const out: RowWindow[] = [];
  for (let k = 0; k < Math.min(6, c.layout.storeys); k++) for (const w of windowSpans(c, k)) {
    const head = d.heads?.find(h => w.x >= h.x0 - 1e-6 && w.x <= h.x1 + 1e-6 && (!h.storeys || h.storeys.includes(k + 1)));
    out.push({ x0: w.x - w.hw, x1: w.x + w.hw, z0: w.z0, z1: w.z1, storey: k + 1, ...(head ? { shape: head.shape, dressing: head.dressing } : {}) });
  }
  return out;
}

const CONSOLE_MIN = 0.32;
/** Dentils: small white blocks at a close pitch under a corona (m). */
const ROW_DENTILS = { w: 0.08, h: 0.12, pitch: 0.17, bed: 0.26 } as const;
/** The top of the highest head dressing a row wall draws (block course, keystone arch, tympanum, lintel); -inf with none. */
function rowHeadRise(w: RowWindow): number {
  if (w.dressing === 'block-course') return ROW_DRESS.block.tall;
  if (w.dressing === 'brick-band') return ROW_DRESS.brickBand.h;
  const g = headGrammarOf(w.dressing, w.shape);
  return g ? headRise(g, w.x1 - w.x0) : -Infinity;
}
function rowHeadsTop(c: ExtraContext): number {
  let top = -Infinity;
  for (const w of rowWindowsOf(c)) {
    const rise = rowHeadRise(w), z = rise > -Infinity && w.dressing !== 'block-course' && w.dressing !== 'brick-band' ? headLine(c, w, rise) ?? w.z1 : w.z1;
    top = Math.max(top, z + rise);
  }
  return top;
}

/** One storey's dotted head course: blocks over each window (alternating tall and short) and one on each pier. */
function blockCourse(c: ExtraContext, s: ExtraSink, row: RowWindow[]): void {
  const B = ROW_DRESS.block, z = Math.max(...row.map(w => w.z1)), white = c.accentHex && c.accentHex !== '#ffffff' ? WHITE : WHITE;
  const xs = row.map(w => [w.x0, w.x1] as const).sort((p, q) => p[0] - q[0]);
  for (const [x0, x1] of xs) {
    const n = Math.max(2, Math.round((x1 - x0 + 0.2) / (B.w + B.gap))), step = (x1 - x0 + 0.2) / n;
    for (let i = 0; i < n; i++) { const a = x0 - 0.1 + i * step + (step - B.w) / 2, h = i % 2 ? B.short : B.tall; s.strip(c.f, a, a + B.w, B.out, z, Math.min(c.top, z + h), white); }
  }
  // The course runs on across the piers, one block per pier gap at least, and out to the front's ends.
  const gaps: Array<[number, number]> = [];
  let at = 0;
  for (const [x0, x1] of xs) { gaps.push([at, x0 - 0.12]); at = x1 + 0.12; }
  gaps.push([at, c.f.len]);
  for (const [g0, g1] of gaps) {
    const n = Math.floor((g1 - g0) / B.pier);
    for (let i = 0; i < n; i++) { const a = g0 + (g1 - g0) * (i + 0.5) / n - B.w / 2; s.strip(c.f, a, a + B.w, B.out, z, Math.min(c.top, z + (i % 2 ? B.short : B.tall)), white); }
  }
}

/** One storey's patterned brick band at the heads, the front's full width: the band in the wall's darker brick and a row
 *  of burnt-brick blocks along its middle (a band of the wall's own family, so it reads as brickwork, not trim). */
function brickBand(c: ExtraContext, s: ExtraSink, row: RowWindow[]): void {
  const B = ROW_DRESS.brickBand, z = Math.max(...row.map(w => w.z1)), zt = Math.min(c.top, z + B.h);
  if (zt - z < 0.1) return;
  s.strip(c.f, 0, c.f.len, B.out, z, zt, shadeHex(c.wallHex, B.band));
  const n = Math.max(1, Math.floor(c.f.len / B.pitch)), zm = (z + zt) / 2;
  for (let i = 0; i < n; i++) { const x = (i + 0.5) * c.f.len / n; s.strip(c.f, x - B.block / 2, x + B.block / 2, B.blockOut, zm - B.block / 2, zm + B.block / 2, shadeHex(c.wallHex, B.dark)); }
}

/** A window head drawn from the head grammar (houseLine/headGrammar.ts): voussoirs, keys, springers, tympana and
 *  jack-block crowns as flat wall pieces at the opening's scale; the glass follows a segmental or round arch. */
const ARCH_GLASS = '#3d4955';
/** A row window's glass: the transom light catches more sky than the pane below. */
const ROW_GLASS = { light: '#566b79', pane: '#2c3b46' } as const;
/** A row type's glazing (row-glazing, Kinkerstraat round 8): white frames round the widened opening and paler glass,
 *  the photo's windows reading white-framed and pale (curtains, nets, sky) where the dark panes read as holes. */
const ROW_TYPE_GLASS = { light: '#8d9ca5', pane: '#5f6f79', frame: 0.1, frameOut: 0.03 } as const;
/** A single stated shopfront (row-shopfront): frame and fascia in the stated colour, a door, one wide curtained pane. */
const ROW_SHOP = { glass: '#2f3a40', sheen: '#3b4950', panel: '#3c464b', doorHex: '#262c30', door: 1.05, post: 0.14, riser: 0.45, fascia: 0.45, side: 0.22, out: 0.03 } as const;
/** Row joinery (row-sash): the glass a little proud of the painted cell, the frame and bars proud of the glass. */
const ROW_SASH_OUT = { glass: 0.014, frame: 0.024 } as const;
/** Panes per sash by window kind (RowDesign.glazing.panes overrides): 8-over-8, 12-over-12 small panes, a plain sash 1. */
const ROW_SASH_PANES: Readonly<Record<string, number>> = { 'sash-8-over-8': 8, 'sash-small-panes': 12, sash: 1, 'small-over-one': 6, arched: 6 };
/** A sash's panes as columns x rows: the factor pair whose panes stand closest to 1.3 tall to 1 wide (at most 4 columns). */
export function sashGrid(n: number, w: number, h: number): [number, number] {
  let best: [number, number] = [1, n], err = Infinity;
  for (let cols = 1; cols <= Math.min(4, n); cols++) {
    if (n % cols) continue;
    const rows = n / cols, e = Math.abs(Math.log((h / rows) / (w / cols) / 1.3));
    if (e < err - 1e-9) { err = e; best = [cols, rows]; }
  }
  return best;
}
type SashPiece = { x0: number; x1: number; z0: number; z1: number; out: number; hex: string };
/** One window's joinery as flat pieces (wall metres): glass, the white frame ring, then the kind's bars. */
export function rowSashPieces(g: { kind: string; frameM: number; barM: number; panes?: number }, x0: number, x1: number, z0: number, z1: number): SashPiece[] {
  const w = x1 - x0, h = z1 - z0, F = Math.min(g.frameM, w * 0.2, h * 0.12), B = g.barM;
  if (w < 0.3 || h < 0.4) return [];
  const gx0 = x0 + F, gx1 = x1 - F, gz0 = z0 + F, gz1 = z1 - F, out: SashPiece[] = [];
  const glass = (a: number, b: number, hex: string) => out.push({ x0: gx0, x1: gx1, z0: a, z1: b, out: ROW_SASH_OUT.glass, hex });
  const piece = (a0: number, a1: number, b0: number, b1: number) => out.push({ x0: a0, x1: a1, z0: b0, z1: b1, out: ROW_SASH_OUT.frame, hex: WHITE });
  const vbar = (x: number, b0: number, b1: number) => piece(x - B / 2, x + B / 2, b0, b1);
  const hbar = (z: number, wide = 1) => piece(gx0, gx1, z - B * wide / 2, z + B * wide / 2);
  const split = gz1 - (gz1 - gz0) * 0.29;
  glass(split, gz1, ROW_GLASS.light); glass(gz0, split, ROW_GLASS.pane);
  // The frame ring: head, sill rail, jambs.
  piece(x0, x1, gz1, z1); piece(x0, x1, z0, gz0); piece(x0, gx0, gz0, gz1); piece(gx1, x1, gz0, gz1);
  const gw = gx1 - gx0, gh = gz1 - gz0, mid = (gx0 + gx1) / 2;
  if (g.kind in ROW_SASH_PANES || g.kind.startsWith('sash')) {
    // Two sashes on a meeting rail, each its grid of panes.
    const n = g.panes ?? ROW_SASH_PANES[g.kind] ?? 1, zm = gz0 + gh / 2;
    hbar(zm, 1.6);
    // Small panes over one (small-over-one): the upper sash alone is glazed in panes.
    const lower = g.kind !== 'small-over-one', [cols, rows] = sashGrid(n, gw, gh / 2);
    for (let i = 1; i < cols; i++) vbar(gx0 + gw * i / cols, lower ? gz0 : zm, gz1);
    for (const base of lower ? [gz0, zm] : [zm]) for (let j = 1; j < rows; j++) hbar(base + gh / 2 * j / rows);
  } else if (g.kind === 'casement') vbar(mid, gz0, gz1);
  else if (g.kind === 'cross') {
    // A cross window (kruiskozijn, Herengracht 27): a mullion the full height and a transom a third down, both broad.
    const zt = gz1 - gh * 0.36;
    hbar(zt, 1.8); vbar(mid, gz0, gz1);
    out[out.length - 1].x0 = mid - B * 0.9; out[out.length - 1].x1 = mid + B * 0.9;
  }
  else {
    // T-window, tall upper sash, casements under a toplight: the transom and a mullion under it.
    const zt = g.kind === 'casement-toplight' ? gz1 - gh * 0.25 : split;
    hbar(zt, 1.4); vbar(mid, gz0, zt);
  }
  return out;
}
/** Where a head stands: on the opening's head line, or lowered into the opening's top when it would run into the cornice
 *  (Kinkerstraat 90's top storey: the arches sit right under the corona); null when that would take half the opening. */
function headLine(c: ExtraContext, w: RowWindow, rise: number): number | null {
  const room = c.top - (c.rowDress?.cornice ? 0.42 : 0.02), z = Math.min(w.z1, room - rise);
  return z < (w.z0 + w.z1) / 2 ? null : z;
}
/** The room a tablet keeps under a gable's foot band (blind review, Herengracht 27: the band cut the top tablets in two). */
const TABLET_FOOT = 0.26;
function grammarHead(c: ExtraContext, s: ExtraSink, w: RowWindow, g: HeadGrammar): void {
  if (g.tablet) {
    // A tablet stays one whole block: under a gable's foot band, losing its relieving arch first where the room is short.
    const room = c.top - (c.rowDress?.cornice ? 0.42 : c.roofKind === 'gable' ? TABLET_FOOT : 0.02);
    if (w.z1 + headRise(g, w.x1 - w.x0) > room && g.relieving) g = { ...g, relieving: false };
    if (w.z1 + headRise(g, w.x1 - w.x0) > room) {
      // Still short (the top storey under a gable foot, Herengracht 27): one block tight under the band, a little lower
      // and squarer, never cut in two; none when not even that fits.
      const T = HEAD.tablet, z0 = Math.max(w.z1 + 0.06, room - T.h), m = (w.x0 + w.x1) / 2;
      if (room - z0 >= T.minH) s.wallQuad(c.f, [[m - T.w / 2, z0], [m + T.w / 2, z0], [m + T.w / 2, room], [m - T.w / 2, room]], T.out, WHITE);
      return;
    }
  }
  const z = headLine(c, w, headRise(g, w.x1 - w.x0));
  if (z === null) return;
  // The tympanum fill is the wall's own family, a darker ornamented brick (Fable on round 6: a cream fill read as white
  // bottle shapes on 90 and 92); only the keystone is white.
  const hex = { white: WHITE, brick: shadeHex(c.wallHex, 0.78), stone: shadeHex(c.wallHex, 0.6), glass: ARCH_GLASS } as const;
  for (const p of headPieces(g, w.x0, w.x1, z, w.z0)) s.wallQuad(c.f, p.pts, p.out, hex[p.tone]);
}

/** A stated basement front (row-basement): stone courses and their sunk joints, the ledge on top, arched doorways. */
const ROW_BASEMENT = { under: 0.05, out: 0.03, course: 0.32, joint: 0.025, ledge: 0.12, ledgeOut: 0.08, doorW: 1.0, doorH: 2.3, ring: 0.2, recess: '#202326' } as const;
/** The white timber erker (lane R round 24, lane D's `bay-window` gap: Herengracht 163-177, 150-166, 238-256 and the ring
 *  readings): a box or a canted bay on white consoles over one bay, its storeys' lights corner to corner in white posts,
 *  a transom with toplights, a white cap, and an iron railing on its roof when read. Sizes from the kit's timber bay
 *  (buurtGenerator/kit/roofKit.ts TIMBER_LOOK: lights 0.85 m over the floor to 0.3 m under the next, 0.07 m posts). */
export const ROW_ERKER = { side: 0.32, minW: 1.5, depth: 0.75, cant: 0.42, foot: 0.85, head: 0.3, gap: 0.25, post: 0.08, rail: 0.09, transom: 0.68, bar: 0.06,
  pane: 0.75, glass: '#9eabb1', glassOut: 0.012, slab: 0.16, slabOut: 0.06, cap: 0.22, capOut: 0.09, console: { w: 0.16, arm: 0.18, drop: 0.55, inset: 0.14 },
  railH: 0.95, railPitch: 0.13, post2: 0.035, fullInset: 0.18 } as const;
/** The erker's wall-frame outline: its x span at the wall, its front's x span and its depth. */
export function erkerPlan(c: ExtraContext): { xa: number; xb: number; fa: number; fb: number; d: number; zb: number; zt: number; rows: number[] } | null {
  const e = c.rowDress?.erker;
  if (!e) return null;
  const rows = e.storeys.filter(k => k >= 1 && k <= c.layout.storeys).sort((p, q) => p - q);
  if (!rows.length) return null;
  const E = ROW_ERKER, k0 = rows[0], k1 = rows[rows.length - 1];
  // Its place: the whole front, or the window nearest the stated end, else the window nearest the front's centre.
  const ws = windowSpans(c, k0 - 1), to = e.end === 'start' ? 0 : e.end === 'end' ? c.f.len : e.at;
  const w = ws.length ? ws.reduce((a, b) => Math.abs(b.x - to) < Math.abs(a.x - to) ? b : a) : { x: e.at, hw: 0.45 };
  const half = Math.max(E.minW / 2, w.hw + E.side);
  const xa = e.width === 'full' ? E.fullInset : Math.max(0.05, w.x - half), xb = e.width === 'full' ? c.f.len - E.fullInset : Math.min(c.f.len - 0.05, w.x + half);
  if (xb - xa < 1) return null;
  const cant = e.kind === 'canted' ? Math.min(E.cant, (xb - xa) / 4) : 0;
  const zb = storeyZ(c, k0 - 1), top = c.top - (c.rowDress?.cornice ? 0.95 : 0.35);
  const zt = Math.min(storeyZ(c, k1) - (k1 < c.layout.storeys ? E.gap : 0), top);
  if (zt - zb < 1.2) return null;
  return { xa, xb, fa: xa + cant, fb: xb - cant, d: E.depth, zb, zt, rows };
}
function rowErker(c: ExtraContext, s: ExtraSink): void {
  const p = erkerPlan(c), e = c.rowDress?.erker;
  if (!p || !e) return;
  const E = ROW_ERKER, f = c.f, { xa, xb, fa, fb, d, zb, zt } = p;
  const P = (x: number, o: number, z: number): [number, number, number] => [f.x0 + f.ux * x + f.nx * o, f.y0 + f.uy * x + f.ny * o, z];
  // The faces as (x, out) segments from left to right: a box's sides run straight out, a canted bay's on the diagonal.
  const faces: Array<[[number, number], [number, number]]> = [[[xa, 0], [fa, d]], [[fa, d], [fb, d]], [[fb, d], [xb, 0]]];
  const quadOn = (q: [[number, number], [number, number]], u0: number, u1: number, out: number, z0: number, z1: number, hex: string) => {
    const [a, b] = q, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    // The faces run left to right round the body, so (-dy, dx) is the outward normal in the wall frame (x along, o out).
    const nx = -dy / l, no = dx / l;
    const X = (u: number) => a[0] + dx * u + nx * out, O = (u: number) => a[1] + dy * u + no * out;
    const n: [number, number, number] = [f.ux * nx + f.nx * no, f.uy * nx + f.ny * no, 0];
    s.quad(P(X(u0), O(u0), z0), P(X(u1), O(u1), z0), P(X(u1), O(u1), z1), P(X(u0), O(u0), z1), n, hex);
  };
  // The body: white timber faces from the floor slab to the cap (the spandrels between storeys are white boarding).
  for (const q of faces) if (Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) > 0.05) quadOn(q, 0, 1, 0, zb, zt, WHITE);
  // Floor slab on the consoles, and the cap over the top lights, both proud of the body.
  s.box(f, xa - E.slabOut, xb + E.slabOut, 0, d + E.slabOut, zb - E.slab, zb, WHITE, true);
  s.box(f, xa - E.capOut, xb + E.capOut, 0, d + E.capOut, zt, zt + E.cap, WHITE, true);
  // Two consoles under the slab: an arm under it and a drop against the wall.
  for (const x of [xa + E.console.inset, xb - E.console.inset]) {
    const C = E.console, z = zb - E.slab;
    s.box(f, x - C.w / 2, x + C.w / 2, 0, d - 0.05, z - C.arm, z, WHITE, true);
    s.slope(f, x - C.w / 2, x + C.w / 2, 0, d - 0.05, z - C.drop, z - C.arm, WHITE);
  }
  // Per storey: the lights corner to corner on every face, white posts at the corners, head and sill rails, a transom
  // with the toplights over it, casement bars below.
  for (const k of p.rows) {
    const zf = storeyZ(c, k - 1), za = zf + E.foot, zh = Math.min(zf + c.layout.storeyM - E.head, zt - 0.12);
    if (zh - za < 0.6) continue;
    const zm = za + (zh - za) * E.transom;
    for (const q of faces) {
      const l = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
      if (l < 0.2) continue;
      const pu = E.post / l;
      quadOn(q, pu, 1 - pu, E.glassOut, za, zh, E.glass);
      quadOn(q, 0, 1, E.glassOut * 2, zm - E.rail / 2, zm + E.rail / 2, WHITE);
      quadOn(q, 0, 1, E.glassOut * 2, za - 0.04, za + E.rail / 2, WHITE);
      const n = Math.max(1, Math.round(l / E.pane));
      for (let i = 1; i < n; i++) { const u = i / n, bu = E.bar / l / 2; quadOn(q, u - bu, u + bu, E.glassOut * 2, za, zh, WHITE); }
    }
  }
  if (e.roofBalcony) {
    // An iron railing round the erker's roof (its front and sides), a top rail on slim balusters.
    const z0 = zt + E.cap, z1 = z0 + E.railH;
    for (const q of faces) {
      const l = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
      if (l < 0.1) continue;
      const shifted: [[number, number], [number, number]] = [[q[0][0], Math.max(q[0][1], 0.02)], [q[1][0], Math.max(q[1][1], 0.02)]];
      quadOn(shifted, 0, 1, 0.02, z1 - 0.05, z1, IRON);
      const n = Math.max(2, Math.round(l / E.railPitch));
      for (let i = 0; i <= n; i++) { const u = i / n, bu = E.post2 / l / 2; quadOn(shifted, Math.max(0, u - bu), Math.min(1, u + bu), 0.02, z0, z1 - 0.05, IRON); }
    }
  }
}

/** House rows: a front's stated parts beyond the heads and cornice, drawn only when the series or front states them. */
// Grey sandstone/hardstone blocks with deep sunk joints (171218's photo: grey, not the warm cream of the dressings).
const ROW_GROUND_WALL = { out: 0.025, ledge: 0.22, ledgeOut: 0.12, scroll: 0.28, scrollH: 0.45 } as const;
/** A faced ground storey's plate between its openings: horizontal bands cut at every opening's sill and head, each band's
 *  pieces between the openings that cross it. */
export function groundWallBands(holes: ReadonlyArray<readonly [number, number, number, number]>, x0: number, x1: number, z0: number, z1: number): Array<[number, number, Array<[number, number]>]> {
  const cuts = [...new Set([z0, z1, ...holes.flatMap(h => [h[2], h[3]]).filter(z => z > z0 && z < z1)])].sort((a, b) => a - b), out: Array<[number, number, Array<[number, number]>]> = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const za = cuts[i], zb = cuts[i + 1];
    if (zb - za < 0.02) continue;
    const cross = holes.filter(h => h[2] < zb - 1e-6 && h[3] > za + 1e-6 && h[1] > x0 && h[0] < x1).sort((a, b) => a[0] - b[0]), xs: Array<[number, number]> = [];
    let x = x0;
    for (const h of cross) { if (h[0] - x > 0.05) xs.push([x, h[0]]); x = Math.max(x, h[1]); }
    if (x1 - x > 0.05) xs.push([x, x1]);
    if (xs.length) out.push([za, zb, xs]);
  }
  return out;
}
const RUSTIC = { course: 0.34, joint: 0.06, block: 0.95, stone: '#a3a199', jointHex: '#4f4d48', out: 0.07 } as const;
/** Row bands: speklagen as three 10 cm courses a storey at the sill, middle and head lines (the type default until the
 *  record states a count), string-courses and floor-line bands 20 cm (169016). Walls without a row record keep the
 *  shared components' courses. */
const ROW_BANDS = { spek: 0.1, spekLines: [0.04, 0.5, 0.96], spekOut: 0.03, course: 0.2, courseOut: 0.08, margin: 0.06, floor: 0.1, floorOut: 0.05, floorHex: '#a9a193' } as const;
/** The stoop: steps and cheek walls up to the bel-etage door over a souterrain (Weteringschans 169016, 171218). */
const STOOP = { rise: 0.19, tread: 0.3, landing: 0.85, reach: 1.75, cheek: 0.22, side: 0.12, rail: 0.75, hex: '#a3a199', door: '#3b2f27', shutters: 0.4, maxRise: 3, lowRise: 0.95 } as const;
/** The bel-etage street door over a stated stoop: the bel-etage window at the stated end, from the floor up. */
/** The souterrain windows a stoop flight over [x0, x1] stands in front of, with their shutters' margin: [x0, x1, z0, z1]. */
export function stoopHiddenWindows(c: ExtraContext, x0: number, x1: number): Array<[number, number, number, number]> {
  // The souterrain under a stoop's flight [x0, x1]: when the front has souterrain windows (the grid's or traced ones below
  // the bel-etage floor), the cell behind the flight is walled over to the floor, a shutter's width past the cheeks, so no
  // frame or shutter peeks out beside the flight (Herengracht 130); the windows beside it stay.
  const floor = storeyZ(c, 0);
  const low = windowSpans(c, -1).length > 0 || (c.rowDress?.windows ?? []).some(w => w.z1 <= floor + 0.2);
  return low && floor - c.base > 0.6 ? [[Math.max(0, x0 - STOOP.shutters), Math.min(c.f.len, x1 + STOOP.shutters), c.base, floor - 0.1]] : [];
}
/** A stoop's flights along the wall (form `side` / `double`, Herengracht 130): the landing before the door, `PD` deep and
 *  `LW` past the door each side; flights `FW` deep, treads `tread` (no less than `minTread`). The iron railing: `railH` over
 *  the nosings, bars every `bar`. */
export const STOOP_PARALLEL = { PD: 1.15, LW: 0.15, FW: 1.0, tread: 0.22, rise: 0.21, minTread: 0.18, railH: 0.9, rail: 0.05, bar: 0.13, barW: 0.025, iron: '#1d1f20' } as const;
/** The flights' plan for a door `d` and `n` rises: each flight's direction and tread, or null when no flight fits on the wall
 *  (the caller draws the straight flight). `double` falls back to `side`, `side` to the side with more room. */
export function stoopFlights(len: number, d: { x: number; hw: number }, n: number, form: 'side' | 'double'): { lx0: number; lx1: number; flights: Array<{ dir: -1 | 1; tread: number }> } | null {
  const P = STOOP_PARALLEL, lx0 = d.x - d.hw - P.LW, lx1 = d.x + d.hw + P.LW, steps = Math.max(1, n - 1);
  const fit = (dir: -1 | 1) => { const room = (dir > 0 ? len - lx1 : lx0) - 0.05, t = Math.min(P.tread, room / steps); return t >= P.minTread ? { dir, tread: t } : null; };
  const l = fit(-1), r = fit(1);
  if (form === 'double' && l && r) { const t = Math.min(l.tread, r.tread); return { lx0, lx1, flights: [{ dir: -1, tread: t }, { dir: 1, tread: t }] }; }
  const one = l && r ? (len - lx1 >= lx0 ? r : l) : (l ?? r);
  return one ? { lx0, lx1, flights: [one] } : null;
}
/** An iron railing in the wall's plane at `out`: a rail from (xa, za) to (xb, zb) at the rail height, bars down to the
 *  nosings under it. */
function ironRail(c: ExtraContext, s: ExtraSink, out: number, xa: number, za: number, xb: number, zb: number): void {
  const P = STOOP_PARALLEL, h = P.railH;
  s.wallQuad(c.f, [[xa, za + h - P.rail], [xb, zb + h - P.rail], [xb, zb + h], [xa, za + h]], out, P.iron);
  const len = Math.abs(xb - xa), m = Math.max(1, Math.round(len / P.bar));
  for (let i = 0; i <= m; i++) {
    const t = i / m, x = xa + (xb - xa) * t, z = za + (zb - za) * t, w = i === 0 || i === m ? 0.05 : P.barW / 2;
    s.strip(c.f, x - w, x + w, out, z, z + h - P.rail / 2, P.iron, 0.03);
  }
}
/** The stoop along the wall (form side/double): a landing at the door, flights descending along the wall, the souterrain
 *  behind them walled over, iron railings when stated. Returns false when no flight fits (the straight flight is drawn). */
function parallelStoop(c: ExtraContext, s: ExtraSink, d: Span, n: number, rise: number, form: 'side' | 'double', rail: boolean): boolean {
  const P = STOOP_PARALLEL, plan = stoopFlights(c.f.len, d, n, form);
  if (!plan) return false;
  const { lx0, lx1, flights } = plan, steps = n - 1;
  const ends = flights.map(f => f.dir > 0 ? lx1 + steps * f.tread : lx0 - steps * f.tread);
  // The walled-over souterrain takes whole window cells: a cell the flights half cover goes with its shutters (130).
  let lo = Math.min(lx0, ...ends), hi = Math.max(lx1, ...ends);
  for (const w of windowSpans(c, -1)) if (w.x + w.hw + STOOP.shutters > lo && w.x - w.hw - STOOP.shutters < hi) { lo = Math.min(lo, w.x - w.hw); hi = Math.max(hi, w.x + w.hw); }
  for (const [a, b, z0, z1] of stoopHiddenWindows(c, lo, hi)) s.strip(c.f, a, b, 0.1, z0, z1, c.wallHex);
  s.box(c.f, lx0, lx1, 0, P.PD, c.base, d.z0, STOOP.hex);
  for (const f of flights) for (let k = 0; k < steps; k++) {
    const reach = (steps - k) * f.tread, a = f.dir > 0 ? lx1 : lx0 - reach, b = f.dir > 0 ? lx1 + reach : lx0;
    s.box(c.f, a, b, 0, P.FW, c.base + k * rise, c.base + (k + 1) * rise, STOOP.hex);
  }
  if (!rail) return true;
  // The landing's railing across its front, and down each flight's outer edge to its foot.
  ironRail(c, s, P.PD - 0.02, lx0, d.z0, lx1, d.z0);
  for (const f of flights) {
    const x0 = f.dir > 0 ? lx1 : lx0, x1 = x0 + f.dir * steps * f.tread;
    ironRail(c, s, P.FW - 0.02, x0, d.z0, x1 - f.dir * f.tread * 0.5, c.base + rise);
  }
  return true;
}
/** A stated doorcase (RowGround.doorcase, Herengracht 130): pilasters on plinths each side, a frieze and a cornice over
 *  the opening, a pediment or segmental hood on a stated top, and a fanlight with bars over a panelled leaf. Stone is a
 *  warm weathered off-white, painted timber the trim white. */
export const ROW_DOORCASE = { pilaster: 0.2, gap: 0.08, out: 0.12, frieze: 0.22, cornice: 0.12, corniceOut: 0.22, over: 0.1, fan: 0.55, bar: 0.04, rise: 0.42,
  stone: '#d9d0bd', glass: '#2b3138', black: '#1d201f',
  /** The top of the dark 'plinth' strip (facadeExtras): a street door's pilasters stand on it, not through it. */
  plinthTop: 0.5 } as const;
/** A pilastered frame over the whole ground storey (RowDoorcase.span 'ground', Herengracht 142): pilasters at both ends
 *  of the front and in each gap between its openings, under one fascia and cornice over the door and the windows. */
function rowGroundSurround(c: ExtraContext, s: ExtraSink, d: Span, dc: { material: 'stone' | 'timber' }, z0: number): void {
  const K = ROW_DOORCASE, hex = dc.material === 'stone' ? K.stone : WHITE, L = c.f.len;
  const wins = windowSpans(c, -1);
  const opens = [[d.x - d.hw, d.x + d.hw, d.z1] as const, ...wins.map(w => [w.x - w.hw, w.x + w.hw, w.z1] as const)].sort((p, q) => p[0] - q[0]);
  const zt = Math.max(...opens.map(o => o[2])) + 0.08, P = K.pilaster + 0.06, zf = zt + K.frieze + 0.08, zc = zf + K.cornice;
  // Pilasters at both ends of the front and beside the door; the rest of the storey is one shop window between them.
  const xs = [0, L - P, ...[d.x - d.hw - 0.06 - P, d.x + d.hw + 0.06].filter(a => a > P + 0.1 && a + P < L - P - 0.1)];
  const shadow = shadeHex(hex, 0.5);
  // The shadows each pilaster and the band throw (in front of a stated ground facing, ROW_GROUND_WALL.out), so a white
  // frame reads as one solid frame on a pale ground storey.
  for (const a of xs) for (const [p, q] of [[a - 0.07, a], [a + P, a + P + 0.07]] as const) if (p >= 0 && q <= L) s.strip(c.f, p, q, 0.045, z0, zt, shadow);
  s.strip(c.f, 0, L, 0.045, zt - 0.09, zt, shadow);
  // The shop window: the bays beside the door glazed from a low sill to the band, two mullions and a transom, white.
  if (wins.length) {
    const dl = d.x - d.hw - 0.06 - P, dr = d.x + d.hw + 0.06 + P;
    for (const [a, b] of [[P + 0.08, dl - 0.08], [dr + 0.08, L - P - 0.08]] as const) {
      if (b - a < 0.9) continue;
      const g0 = z0 + 0.45, g1 = zt - 0.1, F = 0.07, bar = 0.06, tz = g0 + (g1 - g0) * 0.74;
      s.strip(c.f, a, b, 0.05, g0, g1, K.glass);
      for (const [p, q, r, u] of [[a, b, g0 - F, g0], [a, b, g1, g1 + F], [a - F, a, g0 - F, g1 + F], [b, b + F, g0 - F, g1 + F]] as const) s.strip(c.f, p, q, 0.06, r, u, hex);
      for (const k of [1, 2]) { const x = a + (b - a) * k / 3; s.strip(c.f, x - bar / 2, x + bar / 2, 0.062, g0, g1, hex); }
      s.strip(c.f, a, b, 0.062, tz - bar / 2, tz + bar / 2, hex);
      // A panelled stall board under the glass.
      s.strip(c.f, a, b, 0.055, z0, g0 - F, shadeHex(hex, 0.92));
    }
  }
  for (const a of xs) {
    s.box(c.f, a, a + P, 0, K.out, z0, zt, hex);
    s.box(c.f, a - 0.03, a + P + 0.03, 0, K.out + 0.03, z0, z0 + 0.3, hex);
    s.box(c.f, a - 0.03, a + P + 0.03, 0, K.out + 0.03, zt - 0.12, zt, hex);
  }
  // One solid band over the whole front: a fascia, a shadow line under the cornice, the cornice.
  s.box(c.f, 0, L, 0, K.out, zt, zf, hex);
  s.strip(c.f, 0, L, K.out + 0.005, zf - 0.05, zf, shadow);
  s.box(c.f, 0, L, 0, K.corniceOut, zf, zc, hex);
}
/** A white timber frame over the whole ground storey (RowDoorcase.span 'frame', 0363100012176327): posts at the front's
 *  ends and between the door and each window, an entresol rail across them all with a light over every opening, the
 *  windows glazed to the floor of the frame, the door under its own light, a head beam and a slim cornice on top. */
export const ROW_GROUND_FRAME = { post: 0.15, rail: 0.12, beam: 0.18, out: 0.09, corniceOut: 0.16, cornice: 0.08, sill: 0.3, bar: 0.05, entresol: 0.58, tiers: 0.5, under: 0.3 } as const;
function rowGroundFrame(c: ExtraContext, s: ExtraSink, d: Span, dc: { material: 'stone' | 'timber'; door?: string; entresol?: number; tiers?: 2 }, z0: number): void {
  const K = ROW_GROUND_FRAME, hex = dc.material === 'stone' ? ROW_DOORCASE.stone : WHITE, L = c.f.len, P = K.post;
  const wins = windowSpans(c, -1);
  const opens = [{ a: d.x - d.hw, b: d.x + d.hw, z1: d.z1, door: true }, ...wins.map(w => ({ a: w.x - w.hw, b: w.x + w.hw, z1: w.z1, door: false }))].sort((p, q) => p.a - q.a);
  // Two tall tiers (Herengracht 279): the frame fills its storey up to under the next storey's sills, the rail at mid
  // height, the upper lights glazed like the lower; else it stops over the openings, the entresol low under the beam.
  const next = Array.from({ length: c.layout.storeys + 1 }, (_, k) => storeyZ(c, k)).find(z => z > z0 + 1.5);
  const two = dc.tiers === 2 && next !== undefined, top = Math.max(...opens.map(o => o.z1)) + 0.08;
  const zt = two ? Math.max(top, next! - K.under - K.beam - K.cornice) : top, ze = z0 + (zt - z0) * Math.min(0.8, Math.max(0.4, dc.entresol ?? (two ? K.tiers : K.entresol)));
  // Cells: the front cut midway between neighbouring openings, a post on every cut.
  const cuts = [0, ...opens.slice(1).map((o, i) => (opens[i].b + o.a) / 2), L];
  const shadow = shadeHex(hex, 0.5), leaf = dc.door === 'black' ? ROW_DOORCASE.black : dc.door ?? STOOP.door;
  for (let i = 0; i < opens.length; i++) {
    const a = cuts[i] + (i ? P / 2 : P), b = cuts[i + 1] - (i + 1 < opens.length ? P / 2 : P);
    if (b - a < 0.3) continue;
    const mid = (a + b) / 2, g0 = opens[i].door ? d.z0 : z0 + K.sill;
    // The entresol light over every cell, a bar down its middle.
    s.strip(c.f, a, b, 0.05, ze + K.rail / 2, zt, ROW_DOORCASE.glass);
    s.strip(c.f, mid - K.bar / 2, mid + K.bar / 2, 0.06, ze, zt, hex);
    if (opens[i].door) {
      // The door under its light, filling the cell, with two raised panels.
      s.strip(c.f, a, b, 0.05, g0, ze, leaf);
      for (const [p, q] of [[g0 + 0.15, g0 + (ze - g0) * 0.42], [g0 + (ze - g0) * 0.5, ze - 0.15]] as const) s.strip(c.f, a + 0.1, b - 0.1, 0.06, p, q, shadeHex(leaf, dc.door === 'black' ? 1.1 : 1.12));
    } else {
      // The window glazed to the frame's low sill, a mullion and a transom.
      s.strip(c.f, a, b, 0.05, g0, ze - K.rail / 2, ROW_DOORCASE.glass);
      s.strip(c.f, mid - K.bar / 2, mid + K.bar / 2, 0.06, g0, ze, hex);
      s.strip(c.f, a, b, 0.06, g0 + (ze - g0) * 0.72 - K.bar / 2, g0 + (ze - g0) * 0.72 + K.bar / 2, hex);
      s.strip(c.f, a, b, 0.055, z0, g0, shadeHex(hex, 0.92));
    }
  }
  // Posts with their shadows, the entresol rail, the head beam and cornice.
  for (let i = 0; i < cuts.length; i++) {
    const a = i === 0 ? 0 : i === cuts.length - 1 ? L - P : cuts[i] - P / 2;
    for (const [p, q] of [[a - 0.06, a], [a + P, a + P + 0.06]] as const) if (p >= 0 && q <= L) s.strip(c.f, p, q, 0.045, z0, zt, shadow);
    s.box(c.f, a, a + P, 0, K.out, z0, zt, hex);
  }
  s.box(c.f, 0, L, 0, K.out - 0.02, ze - K.rail / 2, ze + K.rail / 2, hex);
  s.strip(c.f, 0, L, 0.045, zt - 0.06, zt, shadow);
  s.box(c.f, 0, L, 0, K.out, zt, zt + K.beam, hex);
  s.box(c.f, 0, L, 0, K.corniceOut, zt + K.beam, zt + K.beam + K.cornice, hex);
}
/** An 1800s timber cornice as stated (RowDesign.corniceDress; Herengracht 158, 164, 174, 209, 248): a painted corona and
 *  bed moulding, what carries them (modillions, consoles over the piers, dentils), a painted frieze over the top windows
 *  (plain, sunk panels, or a low attic light over each window axis), and a pediment, segmental cap or balustrade on top. */
export const ROW_TIMBER_CORNICE = { corona: 0.2, coronaOut: 0.5, bed: 0.16, bedOut: 0.32, architrave: 0.1, archOut: 0.07,
  modillion: { w: 0.1, h: 0.14, pitch: 0.34 }, console: { w: 0.2, h: 0.62, out: 0.3 }, frieze: { plain: 0.55, panels: 0.65, 'attic-lights': 0.85, min: 0.3 },
  /** The shadow under the corona between its supports, as the photos read it (the supports stand out light against it). */
  soffit: 0.62,
  light: { maxW: 1.4, h: 0.42, frame: 0.07 }, pediment: { slope: 0.3, band: 0.16 }, balustrade: { h: 0.72, baluster: 0.09, pitch: 0.24 },
  paints: { white: WHITE, cream: CREAM, grey: '#8f918c' } } as const;
function rowTimberCornice(c: ExtraContext, s: ExtraSink, dr: NonNullable<NonNullable<ExtraContext['rowDress']>['corniceDress']>): void {
  const K = ROW_TIMBER_CORNICE, t = c.top, L = c.f.len;
  const P = dr.paint ? (K.paints as Record<string, string>)[dr.paint] ?? dr.paint : WHITE;
  const zc = t - K.corona, zb = zc - K.bed;
  // The frieze: from over the top windows' heads (their dressing included) up to the bed moulding.
  const ws = rowWindowsOf(c), topZ1 = ws.length ? Math.max(...ws.map(w => w.z1)) : zb - K.frieze.plain;
  const top = ws.filter(w => w.z1 > topZ1 - 0.3);
  const fmax = dr.frieze ? K.frieze[dr.frieze] : K.frieze.plain;
  const fz0 = Math.max(zb - fmax, Math.max(rowHeadsTop(c), topZ1) + 0.12), fh = zb - fz0;
  if (dr.frieze && fh >= K.frieze.min) {
    s.strip(c.f, 0, L, 0.03, fz0, zb, P);
    // The architrave: a thin moulding along the frieze's foot.
    s.box(c.f, 0, L, 0, K.archOut, fz0 - K.architrave, fz0, P, true);
    if (dr.frieze === 'attic-lights') {
      // Centred in the frieze below what carries the corona.
      const sup = dr.supports === 'modillions' ? K.modillion.h : dr.supports === 'dentils' ? ROW_DENTILS.h : 0, fr = fh - sup;
      const lh = Math.min(K.light.h, fr - 0.16), lz0 = fz0 + (fr - lh) / 2;
      if (lh >= 0.18) for (const w of top) {
        // One wide low light per window axis (blind review: single openings, not paired lights).
        const xm = (w.x0 + w.x1) / 2, hw = Math.min(K.light.maxW, (w.x1 - w.x0) * 0.95) / 2, F = K.light.frame;
        // A shadowed reveal round the opening, a white frame inside it, and glazing bars: three panes, a transom when tall.
        const R = 0.035, Wf = WHITE, bar = 0.03, sh = shadeHex(P, 0.62);
        s.strip(c.f, xm - hw - R, xm + hw + R, 0.035, lz0 - R, lz0 + lh + R, sh);
        s.strip(c.f, xm - hw, xm + hw, 0.04, lz0, lz0 + lh, ROW_DOORCASE.glass);
        s.strip(c.f, xm - hw, xm + hw, 0.05, lz0, lz0 + F * 0.6, Wf);
        s.strip(c.f, xm - hw, xm + hw, 0.05, lz0 + lh - F * 0.6, lz0 + lh, Wf);
        for (const x of [xm - hw, xm + hw - F * 0.6]) s.strip(c.f, x, x + F * 0.6, 0.05, lz0, lz0 + lh, Wf);
        for (const k of [1, 2]) { const x = xm - hw + (2 * hw) * k / 3; s.strip(c.f, x - bar / 2, x + bar / 2, 0.052, lz0, lz0 + lh, Wf); }
        if (lh >= 0.36) s.strip(c.f, xm - hw, xm + hw, 0.052, lz0 + lh * 0.55 - bar / 2, lz0 + lh * 0.55 + bar / 2, Wf);
      }
    } else if (dr.frieze === 'panels') {
      // Sunk panels between the piers: a raised frame round each, its field a shade darker.
      const xs = [0, ...top.map(w => (w.x0 + w.x1) / 2), L].sort((a, b) => a - b), m = 0.12;
      for (let i = 0; i + 1 < xs.length; i++) {
        const a = xs[i] + m, b = xs[i + 1] - m, z0 = fz0 + m, z1 = zb - m;
        if (b - a < 0.3 || z1 - z0 < 0.12) continue;
        s.strip(c.f, a, b, 0.035, z0, z1, shadeHex(P, 0.9));
        for (const [p, q, r, u] of [[a, b, z0 - 0.04, z0], [a, b, z1, z1 + 0.04], [a - 0.04, a, z0 - 0.04, z1 + 0.04], [b, b + 0.04, z0 - 0.04, z1 + 0.04]] as const) s.strip(c.f, p, q, 0.05, r, u, P);
      }
    }
  }
  // What carries the corona.
  if (dr.supports === 'modillions') {
    // Under the bed moulding, light blocks against the soffit's shadow.
    s.strip(c.f, 0, L, 0.035, zb - K.modillion.h, zb, shadeHex(P, K.soffit));
    const n = Math.max(3, Math.round(L / K.modillion.pitch));
    for (let i = 0; i < n; i++) { const x = (i + 0.5) * L / n; s.box(c.f, Math.max(0, x - K.modillion.w / 2), Math.min(L, x + K.modillion.w / 2), 0, K.bedOut + 0.06, zb - K.modillion.h, zb, P); }
  } else if (dr.supports === 'consoles') {
    // A console over each pier: a deep head under the corona tapering to a slim foot (a scroll in profile).
    const h = Math.min(K.console.h, Math.max(0.3, zb - fz0 + K.bed)), W2 = K.console.w / 2;
    for (const x of pierXs(c)) {
      const a = Math.max(0, x - W2), b = Math.min(L, x + W2);
      // Its shadow on the frieze round it, so a painted console reads on a painted frieze.
      s.strip(c.f, Math.max(0, a - 0.05), Math.min(L, b + 0.05), 0.035, zb - h - 0.04, zb, shadeHex(P, K.soffit));
      s.box(c.f, a, b, 0, K.bedOut + 0.04, zb - 0.22, zb, P);
      s.box(c.f, a + 0.02, b - 0.02, 0, K.console.out * 0.6, zb - h * 0.65, zb - 0.22, P);
      s.box(c.f, a + 0.04, b - 0.04, 0, K.console.out * 0.35, zb - h, zb - h * 0.65, P);
      // Carved: a scroll's eye at the head and a smaller one at the foot, a leaf down the face.
      wallDisc(c, s, x, zb - 0.13, W2 * 0.8, K.console.out + 0.02, shadeHex(P, 0.72));
      wallDisc(c, s, x, zb - 0.13, W2 * 0.4, K.console.out + 0.03, P);
      wallDisc(c, s, x, zb - h + 0.08, W2 * 0.55, K.console.out * 0.35 + 0.02, shadeHex(P, 0.72));
      s.wallQuad(c.f, [[x - W2 * 0.35, zb - 0.26], [x + W2 * 0.35, zb - 0.26], [x + 0.01, zb - h * 0.7], [x - 0.01, zb - h * 0.7]], K.console.out * 0.6 + 0.01, shadeHex(P, 0.8));
    }
  } else if (dr.supports === 'dentils') {
    const D = ROW_DENTILS, n = Math.max(4, Math.round(L / D.pitch));
    s.strip(c.f, 0, L, 0.035, zb - D.h, zb, shadeHex(P, K.soffit));
    for (let i = 0; i < n; i++) { const x = (i + 0.5) * L / n; s.box(c.f, Math.max(0, x - D.w / 2), Math.min(L, x + D.w / 2), 0, K.bedOut + 0.06, zb - D.h, zb, P); }
  }
  // The bed moulding (in the corona's shadow) and the corona.
  s.box(c.f, 0, L, 0, K.bedOut, zb, zc, shadeHex(P, 0.84), true);
  s.box(c.f, 0, L, 0, K.coronaOut, zc, t, P, true);
  // On top: a cap over the centre, or a balustrade.
  if (dr.centre === 'pediment' || dr.centre === 'segmental') {
    const w = L * (dr.centreShare ?? 0.5), a = (L - w) / 2, b = a + w, mid = L / 2, rise = w / 2 * K.pediment.slope, B = K.pediment.band;
    if (dr.centre === 'pediment') {
      // A moulded pediment: a recessed tympanum a shade darker, the raking cornices in two steps with a shadow line under
      // them, and a cornice across its foot.
      s.wallQuad(c.f, [[a, t], [b, t], [mid, t + rise], [mid, t + rise]], 0.04, shadeHex(P, 0.9));
      for (const [p0, p1] of [[[a - 0.04, t], [mid, t + rise]], [[mid, t + rise], [b + 0.04, t]]] as Array<[[number, number], [number, number]]>) {
        wallBar(c, s, [p0[0], p0[1] - B * 0.35], [p1[0], p1[1] - B * 0.35], 0.05, 0.08, shadeHex(P, 0.6));
        wallBar(c, s, [p0[0], p0[1] + B * 0.15], [p1[0], p1[1] + B * 0.15], B * 0.7, K.bedOut - 0.08, shadeHex(P, 0.86));
        wallBar(c, s, [p0[0], p0[1] + B * 0.6], [p1[0], p1[1] + B * 0.6], B * 0.55, K.bedOut, P);
      }
      s.box(c.f, a, b, 0, K.bedOut - 0.08, t, t + 0.08, shadeHex(P, 0.86));
    } else {
      const n = 12, h = (u: number) => rise * 1.3 * Math.sin(Math.PI * u);
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n, x0 = a + w * u0, x1 = a + w * u1;
        s.wallQuad(c.f, [[x0, t], [x1, t], [x1, t + h(u1)], [x0, t + h(u0)]], 0.06, P);
        wallBar(c, s, [x0, t + h(u0) + B / 2], [x1, t + h(u1) + B / 2], B, K.bedOut, P);
      }
    }
  } else if (dr.centre === 'balustrade') {
    const w = L * (dr.centreShare ?? 1), a = (L - w) / 2, b = a + w, Bq = K.balustrade, out = K.coronaOut - 0.12;
    s.box(c.f, a, b, 0.02, out, t, t + 0.12, P);
    const n = Math.max(2, Math.floor(w / Bq.pitch));
    // Turned balusters: a belly, a slim neck and a cap between plinth and rail.
    const bh = Bq.h - 0.24, bz = t + 0.12, bw = Bq.baluster;
    for (let i = 0; i < n; i++) {
      const x = a + (i + 0.5) * w / n;
      s.box(c.f, x - bw / 2, x + bw / 2, out - 0.2, out - 0.06, bz, bz + bh * 0.45, P);
      s.box(c.f, x - bw * 0.28, x + bw * 0.28, out - 0.18, out - 0.08, bz + bh * 0.45, bz + bh * 0.8, P);
      s.box(c.f, x - bw * 0.42, x + bw * 0.42, out - 0.19, out - 0.07, bz + bh * 0.8, bz + bh, P);
    }
    for (const x of [a, b - 0.2]) s.box(c.f, x, x + 0.2, 0.02, out, t + 0.12, t + Bq.h - 0.12, P);
    s.box(c.f, a, b, 0.02, out, t + Bq.h - 0.12, t + Bq.h, P);
  }
}
/** A disc of radius r on the wall face (a scroll's eye, a boss), as a fan of quads. */
function wallDisc(c: ExtraContext, s: ExtraSink, x: number, z: number, r: number, out: number, hex: string, n = 12): void {
  for (let i = 0; i < n; i++) {
    const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n;
    s.wallQuad(c.f, [[x, z], [x + r * Math.cos(a0), z + r * Math.sin(a0)], [x + r * Math.cos(a1), z + r * Math.sin(a1)], [x, z]], out, hex);
  }
}
/** A bar of width w from p to q on the wall face (fanlight tracery). */
function wallBar(c: ExtraContext, s: ExtraSink, p: readonly [number, number], q: readonly [number, number], w: number, out: number, hex: string): void {
  const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2;
  s.wallQuad(c.f, [[p[0] + nx, p[1] + nz], [q[0] + nx, q[1] + nz], [q[0] - nx, q[1] - nz], [p[0] - nx, p[1] - nz]], out, hex);
}
function rowDoorcase(c: ExtraContext, s: ExtraSink, d: Span, dc: NonNullable<NonNullable<NonNullable<ExtraContext['rowDress']>['stoop']>['doorcase']>, z0 = d.z0, own = true): void {
  const K = ROW_DOORCASE, hex = dc.material === 'stone' ? K.stone : WHITE, x0 = d.x - d.hw, x1 = d.x + d.hw;
  const leaf = dc.door === 'black' ? K.black : dc.door ?? STOOP.door;
  const fan = dc.fanlight === false ? 0 : Math.min(K.fan, (d.z1 - d.z0) * 0.25), zf = d.z1 - fan;
  // The leaf with two raised panels, and the fanlight's glass with its transom and bars.
  s.strip(c.f, x0, x1, 0.03, d.z0, zf, leaf);
  for (const [a, b] of [[d.z0 + 0.15, d.z0 + (zf - d.z0) * 0.42], [d.z0 + (zf - d.z0) * 0.5, zf - 0.15]] as const) s.strip(c.f, x0 + 0.1, x1 - 0.1, 0.045, a, b, shadeHex(leaf, 1.1));
  if (fan > 0) {
    s.strip(c.f, x0, x1, 0.03, zf, d.z1, K.glass);
    s.strip(c.f, x0, x1, 0.05, zf, zf + K.bar * 1.5, hex);
    if (dc.fanlight === 'oval' || dc.fanlight === 'oval-spoked') {
      // An oval ring touching the fanlight's frame; `oval` a small lozenge at its centre (judged closer on
      // Herengracht 144, 2026-11-15), `oval-spoked` four short spokes from the ring to the frame instead.
      const xm = (x0 + x1) / 2, zm = (zf + d.z1) / 2, hx = (x1 - x0) / 2 - 0.03, hz = (d.z1 - zf) / 2 - 0.03, n = 18;
      for (let i = 0; i < n; i++) {
        const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n;
        wallBar(c, s, [xm + hx * Math.cos(a0), zm + hz * Math.sin(a0)], [xm + hx * Math.cos(a1), zm + hz * Math.sin(a1)], K.bar, 0.05, hex);
      }
      if (dc.fanlight === 'oval-spoked') {
        for (const [p, q] of [[[xm - hx, zm], [x0, zm]], [[xm + hx, zm], [x1, zm]], [[xm, zm + hz], [xm, d.z1]], [[xm, zm - hz], [xm, zf]]] as Array<[[number, number], [number, number]]>) wallBar(c, s, p, q, K.bar, 0.05, hex);
      } else {
        const pts: Array<[number, number]> = [[xm - hx * 0.4, zm], [xm, zm + hz * 0.45], [xm + hx * 0.4, zm], [xm, zm - hz * 0.45]];
        for (let i = 0; i < 4; i++) wallBar(c, s, pts[i], pts[(i + 1) % 4], K.bar, 0.05, hex);
      }
    } else if (dc.fanlight === 'diamond') {
      // A lozenge touching the fanlight's frame at its four mid-points, and a smaller one inside it.
      const xm = (x0 + x1) / 2, zm = (zf + d.z1) / 2, hx = (x1 - x0) / 2, hz = (d.z1 - zf) / 2;
      for (const k of [1, 0.5]) {
        const pts: Array<[number, number]> = [[xm - hx * k, zm], [xm, zm + hz * k], [xm + hx * k, zm], [xm, zm - hz * k]];
        for (let i = 0; i < 4; i++) wallBar(c, s, pts[i], pts[(i + 1) % 4], K.bar, 0.05, hex);
      }
    } else for (let i = 1; i < 4; i++) { const x = x0 + (x1 - x0) * i / 4; s.strip(c.f, x - K.bar / 2, x + K.bar / 2, 0.05, zf, d.z1, hex); }
  }
  // The frame round the opening.
  s.strip(c.f, x0 - 0.06, x0, 0.06, z0, d.z1, hex);
  s.strip(c.f, x1, x1 + 0.06, 0.06, z0, d.z1, hex);
  if (!own) return;
  // Pilasters on plinths.
  const pl0 = x0 - K.gap - K.pilaster, pr1 = x1 + K.gap + K.pilaster;
  for (const [a, b] of [[pl0, x0 - K.gap], [x1 + K.gap, pr1]] as const) {
    s.box(c.f, a, b, 0, K.out, z0, d.z1 + 0.05, hex);
    s.box(c.f, a - 0.03, b + 0.03, 0, K.out + 0.03, z0, z0 + 0.3, hex);
    s.box(c.f, a - 0.03, b + 0.03, 0, K.out + 0.03, d.z1 - 0.12, d.z1 + 0.05, hex);
  }
  // The entablature: a frieze and a cornice over the pilasters.
  const zt = d.z1 + 0.05, zc = zt + K.frieze;
  s.box(c.f, pl0, pr1, 0, K.out, zt, zc, hex);
  s.box(c.f, pl0 - K.over, pr1 + K.over, 0, K.corniceOut, zc, zc + K.cornice, hex);
  const top = zc + K.cornice, a = pl0 - K.over, b = pr1 + K.over, mid = (a + b) / 2, rise = Math.min(K.rise, (b - a) * 0.22);
  if (dc.top === 'pediment') {
    s.wallQuad(c.f, [[a, top], [b, top], [mid, top + rise], [mid, top + rise]], K.corniceOut - 0.04, hex);
    // The raking cornices as thin slabs over the face.
    s.wallQuad(c.f, [[a - 0.04, top], [mid, top + rise + 0.06], [mid, top + rise - 0.04], [a + 0.12, top]], K.corniceOut, shadeHex(hex, 1.04));
    s.wallQuad(c.f, [[b + 0.04, top], [mid, top + rise + 0.06], [mid, top + rise - 0.04], [b - 0.12, top]], K.corniceOut, shadeHex(hex, 1.04));
  } else if (dc.top === 'segmental') {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, h = (t: number) => rise * Math.sin(Math.PI * t);
      s.wallQuad(c.f, [[a + (b - a) * t0, top], [a + (b - a) * t1, top], [a + (b - a) * t1, top + h(t1)], [a + (b - a) * t0, top + h(t0)]], K.corniceOut - 0.04, hex);
    }
  }
}
export function stoopDoor(c: ExtraContext): Span | null {
  const st = c.rowDress?.stoop;
  if (!st || !c.groundLevel || c.layout.storeys < 1) return null;
  if (st.at !== undefined) {
    // The read door's place (rowDressOnEdge stoopAt): the bel-etage window nearest it, a traced one when the record traced
    // the windows. A read door index is the place itself: the painted cells draw the read window count, which the extras'
    // grid need not share (Herengracht 132: 6 painted windows, 4 grid spans; the door slab stood over half a window).
    const floor = storeyZ(c, 0), above = (c.rowDress?.windows ?? []).filter(w => w.z0 >= floor - 0.3), sill = Math.min(...above.map(w => w.z0));
    const traced = above.filter(w => w.z0 < sill + 0.5).map(w => ({ x: (w.x0 + w.x1) / 2, hw: (w.x1 - w.x0) / 2, z1: w.z1 }));
    const ws = traced.length ? traced : windowSpans(c, 0);
    if (!ws.length) return null;
    const w = ws.reduce((a, b) => Math.abs(b.x - st.at!) < Math.abs(a.x - st.at!) ? b : a);
    const x = st.exact && !traced.length ? Math.min(c.f.len - 0.6, Math.max(0.6, st.at)) : w.x;
    // A full ground storey under the stated stoop (no souterrain cell: Herengracht 162's bel-etage floor 4.4 m up): the door
    // stands in the ground storey up a short flight, not a storey-high grey block under a slab (reviewers' 113, 248-287).
    if (floor - c.base > STOOP.maxRise) {
      const head = Math.max(...windowSpans(c, -1).map(g => g.z1), c.base + STOOP.lowRise + 2.1);
      return { x, hw: Math.max(w.hw, 0.5), z0: c.base + STOOP.lowRise, z1: Math.min(floor - 0.25, head) };
    }
    return { x, hw: Math.max(w.hw, 0.5), z0: floor, z1: w.z1 };
  }
  const ws = windowSpans(c, 0).sort((a, b) => a.x - b.x);
  if (!ws.length) return null;
  const w = st.end === 'start' ? ws[0] : st.end === 'end' ? ws[ws.length - 1] : ws.reduce((a, b) => Math.abs(b.x - c.f.len / 2) < Math.abs(a.x - c.f.len / 2) ? b : a);
  return { x: w.x, hw: Math.max(w.hw, 0.5), z0: storeyZ(c, 0), z1: w.z1 };
}
/** Openings (with their head dressing and a margin) a row band stops at: windows, ground windows and doors. */
function rowBandHoles(c: ExtraContext): Array<readonly [number, number, number, number]> {
  const m = ROW_BANDS.margin, holes: Array<readonly [number, number, number, number]> = [];
  for (const w of rowWindowsOf(c)) holes.push([w.x0 - m, w.x1 + m, w.z0 - m - 0.05, w.z1 + Math.max(0.08, rowHeadRise(w)) + m]);
  for (const w of windowSpans(c, -1)) holes.push([w.x - w.hw - m, w.x + w.hw + m, w.z0 - m, w.z1 + m]);
  for (const d of [doorSpan(c), stoopDoor(c)]) if (d) holes.push([d.x - d.hw - 0.3, d.x + d.hw + 0.3, d.z0 - m, d.z1 + 1.0]);
  return holes;
}
/** One band course [z0, z1] across the wall, broken at `holes`. */
function rowBand(c: ExtraContext, s: ExtraSink, holes: ReadonlyArray<readonly [number, number, number, number]>, z0: number, z1: number, out: number, hex: string): void {
  const cut = holes.filter(h => h[2] < z1 && h[3] > z0).sort((a, b) => a[0] - b[0]);
  let x = 0;
  for (const h of [...cut, [c.f.len, c.f.len, 0, 0] as const]) {
    if (Math.min(c.f.len, h[0]) - x > 0.12) s.strip(c.f, x, Math.min(c.f.len, h[0]), out, z0, z1, hex);
    x = Math.max(x, h[1]);
  }
}
/** Row walls: the stated bands, bold. Speklagen run the whole wall between the bel-etage floor and the cornice; the
 *  floor-line and sill courses run at every storey. Returns false for walls without a row record. */
function rowBands(c: ExtraContext, s: ExtraSink, kind: 'speklagen' | 'string-courses' | 'floor-cornices', hex: string): boolean {
  if (!c.rowDress) return false;
  const holes = rowBandHoles(c), l = c.layout, o = openingsOf(c), top = c.top - (c.rowDress.cornice ? 0.95 : 0.3);
  if (kind === 'speklagen') {
    // Three thin courses per storey at its windows' sill, middle and head lines, broken at the openings so they read as
    // short strips on the piers (Fable on the round-6 sheets: seven thick bands a storey turned 169016 and 171218 into
    // cream-and-red stripes; the photo's wall reads dark red-brown with thin white lines).
    const byStorey = new Map<number, Array<{ z0: number; z1: number }>>();
    for (const w of rowWindowsOf(c)) (byStorey.get(w.storey) ?? byStorey.set(w.storey, []).get(w.storey)!).push(w);
    const med = (v: number[]) => v.sort((p, q) => p - q)[Math.floor(v.length / 2)];
    for (const ws of byStorey.values()) {
      const z0 = med(ws.map(w => w.z0)), z1 = med(ws.map(w => w.z1));
      for (const f of ROW_BANDS.spekLines) {
        const a = z0 + (z1 - z0) * f - ROW_BANDS.spek / 2;
        if (a + ROW_BANDS.spek <= top) rowBand(c, s, holes, a, a + ROW_BANDS.spek, ROW_BANDS.spekOut, CREAM);
      }
    }
    return true;
  }
  for (let k = 0; k < Math.min(6, l.storeys); k++) {
    const z = kind === 'floor-cornices' ? storeyZ(c, k) - 0.06 : storeyZ(c, k) + o.upper.sill * l.storeyM - ROW_BANDS.course - 0.02;
    if (z + ROW_BANDS.course > top) continue;
    // Floor-line courses: thin dull stone (Weteringschans 168096, blind review 6: two heavy white bands where the photo
    // has faint stone string courses). Sill courses keep their 20 cm.
    if (kind === 'floor-cornices') rowBand(c, s, [], z, z + ROW_BANDS.floor, ROW_BANDS.floorOut, hex);
    else rowBand(c, s, holes, z, z + ROW_BANDS.course, ROW_BANDS.courseOut, hex);
  }
  return true;
}

const BALCONY = { depth: 0.55, slab: 0.16, rail: 0.1, height: 0.95, post: 0.07, pitch: 0.16, side: 0.3 } as const;
const PORCH = { pier: 0.22, out: 0.32, beam: 0.24, rise: 0.55 } as const;

export const ROW_COMPONENTS: readonly WallComponent[] = [
  { id: 'row-rustication', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'plinth-face', build: (c, s) => {
    // A rusticated stone souterrain (Weteringschans 171218): stone courses with sunk joints over the ground cell,
    // stopping at its windows and door.
    if (!c.groundLevel) return;
    const z0 = c.base, z1 = c.base + c.layout.groundM;
    const holes = [...windowSpans(c, -1).map(w => [w.x - w.hw - 0.05, w.x + w.hw + 0.05, w.z0, w.z1] as const), ...(doorSpan(c) ? [(d => [d.x - d.hw - 0.05, d.x + d.hw + 0.05, d.z0, d.z1] as const)(doorSpan(c)!)] : [])];
    for (let z = z0; z < z1 - 0.05; z += RUSTIC.course) {
      const za = z, zb = Math.min(z1, z + RUSTIC.course - RUSTIC.joint);
      const cut = holes.filter(h => h[2] < zb && h[3] > za).sort((a, b) => a[0] - b[0]);
      let x = 0;
      const course = Math.round((z - z0) / RUSTIC.course), shift = course % 2 ? RUSTIC.block / 2 : 0;
      for (const h of [...cut, [c.f.len, c.f.len, 0, 0] as const]) {
        const xe = Math.min(c.f.len, h[0]);
        if (xe - x > 0.1) {
          // The dark sunk joint behind the course, then stone blocks proud of it, the vertical joints staggered per course.
          s.strip(c.f, x, xe, RUSTIC.out * 0.3, za, Math.min(z1, za + RUSTIC.course), RUSTIC.jointHex);
          let a = x;
          while (xe - a > 0.1) {
            // The next joint at least a joint's width on (a joint landing exactly on `a` would never advance).
            const next = Math.floor((a - shift) / RUSTIC.block + 1) * RUSTIC.block + shift, far = next - a < 0.1 ? next + RUSTIC.block : next;
            const b = xe - far < 0.25 ? xe : Math.min(xe, far);
            s.strip(c.f, a, b - (b < xe ? RUSTIC.joint : 0), RUSTIC.out, za, zb, RUSTIC.stone);
            a = b;
          }
        }
        x = Math.max(x, h[1]);
      }
    }
  } },
  { id: 'row-balcony', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'balcony', build: (c, s) => {
    // A stone balustrade balcony before the centre window of the first upper storey (Weteringschans 169016, 171218).
    const storey = c.rowDress?.balcony?.storeys[0] ?? 1, ws = rowWindowsOf(c).filter(w => w.storey === storey);
    if (!ws.length) return;
    const mid = c.f.len / 2, w = ws.reduce((a, b) => Math.abs((b.x0 + b.x1) / 2 - mid) < Math.abs((a.x0 + a.x1) / 2 - mid) ? b : a);
    const x0 = w.x0 - BALCONY.side, x1 = w.x1 + BALCONY.side, z = w.z0 - 0.05;
    s.box(c.f, x0, x1, 0, BALCONY.depth, z - BALCONY.slab, z, STONE, true);
    s.box(c.f, x0 + 0.1, x1 - 0.1, 0, 0.12, z - BALCONY.slab - 0.22, z - BALCONY.slab, STONE, true);
    const top = z + BALCONY.height, n = Math.max(3, Math.round((x1 - x0) / BALCONY.pitch));
    for (let i = 0; i <= n; i++) { const x = x0 + 0.04 + (x1 - x0 - 0.08) * i / n; s.box(c.f, x - BALCONY.post / 2, x + BALCONY.post / 2, BALCONY.depth - 0.1, BALCONY.depth - 0.03, z, top - BALCONY.rail, WHITE); }
    s.box(c.f, x0, x1, BALCONY.depth - 0.13, BALCONY.depth, top - BALCONY.rail, top, WHITE);
    for (const xe of [x0, x1 - 0.12]) s.box(c.f, xe, xe + 0.12, 0, BALCONY.depth, z, top, WHITE);
  } },
  { id: 'row-erker', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'row-erker', build: (c, s) => {
    // A stated white timber erker (lane R round 24, lane D's bay-window gap) over the centre bay: rowErker draws it.
    rowErker(c, s);
  } },
  { id: 'row-porch', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'door-surround', build: (c, s) => {
    // A gabled entrance porch: stone piers either side of the street door, a beam and a pointed pediment over it.
    const d = stoopDoor(c) ?? doorSpan(c);
    if (!d || !c.groundLevel) return;
    const l = d.x - d.hw - PORCH.pier, r = d.x + d.hw + PORCH.pier, zt = Math.min(c.top - 0.6, d.z1 + 0.12);
    for (const x of [l, r - PORCH.pier]) s.box(c.f, x, x + PORCH.pier, 0, PORCH.out, d.z0, zt, WHITE);
    s.box(c.f, l - 0.06, r + 0.06, 0, PORCH.out + 0.04, zt, zt + PORCH.beam, WHITE, true);
    const zb = zt + PORCH.beam, apex = zb + PORCH.rise;
    s.wallQuad(c.f, [[l - 0.06, zb], [r + 0.06, zb], [d.x + 0.001, apex], [d.x, apex]], PORCH.out + 0.02, WHITE);
    s.wallQuad(c.f, [[l + 0.12, zb + 0.06], [r - 0.12, zb + 0.06], [d.x + 0.001, apex - 0.14], [d.x, apex - 0.14]], PORCH.out + 0.035, STONE);
  } },
  { id: 'row-glazing', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'glazing', build: (c, s) => {
    // A row type's wider windows (c.rowDress.windowShare): the glass over the widened opening, a transom light over two
    // casements (the T-window), so the painted cell's narrower window and its frame do not show inside it.
    if (!c.rowDress?.windowShare) return;
    for (let k = 0; k < Math.min(6, c.layout.storeys); k++) for (const w of windowSpans(c, k)) {
      const l = w.x - w.hw, r = w.x + w.hw, zt = w.z1 - (w.z1 - w.z0) * 0.29, F = ROW_TYPE_GLASS.frame;
      s.wallQuad(c.f, [[l, zt], [r, zt], [r, w.z1], [l, w.z1]], 0.012, ROW_TYPE_GLASS.light);
      s.wallQuad(c.f, [[l, w.z0], [r, w.z0], [r, zt], [l, zt]], 0.012, ROW_TYPE_GLASS.pane);
      // The frame: jambs and head round the opening (the frame share of the type's window width), the sill below.
      const fo = F - ROW_FRAME_M;
      s.strip(c.f, l - ROW_FRAME_M, l + fo, ROW_TYPE_GLASS.frameOut, w.z0, w.z1 + ROW_FRAME_M, WHITE);
      s.strip(c.f, r - fo, r + ROW_FRAME_M, ROW_TYPE_GLASS.frameOut, w.z0, w.z1 + ROW_FRAME_M, WHITE);
      s.strip(c.f, l - ROW_FRAME_M, r + ROW_FRAME_M, ROW_TYPE_GLASS.frameOut, w.z1 - fo, w.z1 + ROW_FRAME_M, WHITE);
      s.strip(c.f, l - ROW_FRAME_M, r + ROW_FRAME_M, ROW_TYPE_GLASS.frameOut, w.z0 - ROW_FRAME_M, w.z0 + fo, WHITE);
      s.strip(c.f, l, r, 0.02, zt - 0.03, zt + 0.03, WHITE);
      // Buurt kit paired casements (rowDress.mullionShare): a broad white post the full height parts the pair.
      const mh = c.rowDress.mullionShare ? (r - l) * c.rowDress.mullionShare / 2 : 0;
      if (mh) s.strip(c.f, w.x - mh, w.x + mh, 0.025, w.z0, w.z1, WHITE);
      else s.strip(c.f, w.x - 0.025, w.x + 0.025, 0.02, w.z0, zt - 0.03, WHITE);
    }
  } },
  { id: 'row-floors', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'row-floors', build: (c, s) => {
    // Floor bands on the stated rows' floor lines (RowDesign.windowHeights, house rows round 5): the traced windows stand
    // on a plain wall, so the storeys' floor lines are drawn here where the painted cells would have put them.
    const fl = c.rowDress?.floorsM, top = c.top - (c.rowDress?.cornice ? 0.95 : 0.3);
    if (!fl) return;
    for (const f of fl) { const z = c.base + f; if (z > c.base + 0.5 && z + ROW_BANDS.floor < top) rowBand(c, s, [], z - ROW_BANDS.floor / 2, z + ROW_BANDS.floor / 2, ROW_BANDS.floorOut, ROW_BANDS.floorHex); }
  } },
  { id: 'row-ground-wall', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'row-ground-wall', build: (c, s) => {
    // A ground storey faced apart from the wall above (RowDesign.groundWall, house rows round 5): Herengracht 12's white
    // stucco under brown brick, a belt house's white pilastered plinth storey. A plate over the front's span of the ground
    // cell, open at its windows and door, under a ledge (scrolled ends when stated).
    const gw = c.rowDress?.groundWalls;
    if (!gw?.length || !c.groundLevel) return;
    const z0 = c.base, z1 = c.base + c.layout.groundM;
    const holes = [...windowSpans(c, -1).map(w => [w.x - w.hw - 0.04, w.x + w.hw + 0.04, w.z0, w.z1] as const),
      ...rowWindowsOf(c).filter(w => w.z0 < z1 - 0.1).map(w => [w.x0 - 0.04, w.x1 + 0.04, w.z0, w.z1] as const),
      ...(doorSpan(c) ? [(d => [d.x - d.hw - 0.05, d.x + d.hw + 0.05, d.z0, d.z1] as const)(doorSpan(c)!)] : [])];
    for (const g of gw) {
      const x0 = Math.max(0, g.x0), x1 = Math.min(c.f.len, g.x1);
      if (x1 - x0 < 0.3) continue;
      for (const [za, zb, xs] of groundWallBands(holes, x0, x1, z0, z1)) for (const [a, b] of xs) s.strip(c.f, a, b, ROW_GROUND_WALL.out, za, zb, g.hex);
      if (g.top === 'plain') continue;
      // The ledge: a moulded band proud of the facing, a little wider than it; scrolled ends stand under it at both ends.
      s.box(c.f, x0, x1, 0, ROW_GROUND_WALL.ledgeOut, z1 - ROW_GROUND_WALL.ledge, z1, g.hex, true);
      if (g.top === 'scrolled') for (const [a, b] of [[x0, x0 + ROW_GROUND_WALL.scroll], [x1 - ROW_GROUND_WALL.scroll, x1]] as const) s.box(c.f, a, b, 0, ROW_GROUND_WALL.ledgeOut * 0.8, z1 - ROW_GROUND_WALL.ledge - ROW_GROUND_WALL.scrollH, z1 - ROW_GROUND_WALL.ledge, g.hex, true);
    }
  } },
  { id: 'row-basement', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'row-basement', build: (c, s) => {
    // A stated basement front (RowGround.basementFront, Herengracht 25-29): the souterrain faced in a stone plinth with
    // sunk joints, arched doorways in it (a stone ring, a dark recess, a door leaf), the basement windows left open.
    const K = ROW_BASEMENT, top = storeyZ(c, 0) - K.under;
    if (top - c.base < 0.9) return;
    for (const b of c.rowDress?.basements ?? []) {
      const x0 = Math.max(0, b.x0), x1 = Math.min(c.f.len, b.x1);
      if (x1 - x0 < 0.5) continue;
      const doors = b.doors.map(([p, q]) => { const m = (p + q) / 2, hw = Math.min(K.doorW, (q - p) * 0.8) / 2; return [Math.max(x0 + 0.1, m - hw), Math.min(x1 - 0.1, m + hw)] as const; }).filter(([p, q]) => q - p > 0.5);
      const over = (a: number, z: number) => doors.some(([p, q]) => a > p - K.ring - 0.05 && a < q + K.ring + 0.05) && z > 0;
      const holes = windowSpans(c, -1).filter(w => w.x > x0 && w.x < x1 && !over(w.x, 1)).map(w => [w.x - w.hw, w.x + w.hw, w.z0, w.z1] as const);
      const zt = top, joint = shadeHex(b.hex, 0.8);
      for (const [za, zb, xs] of groundWallBands(holes, x0, x1, c.base, zt)) for (const [p, q] of xs) {
        s.strip(c.f, p, q, K.out, za, zb, b.hex);
        // Sunk joints every course.
        for (let z = za + K.course; z < zb - 0.05; z += K.course) s.strip(c.f, p, q, K.out + 0.004, z - K.joint / 2, z + K.joint / 2, joint);
      }
      s.box(c.f, x0, x1, 0, K.ledgeOut, zt - K.ledge, zt, shadeHex(b.hex, 1.08), true);
      for (const [p, q] of doors) {
        const w = q - p, m = (p + q) / 2, rise = b.head === 'round' ? w / 2 : Math.max(0.2, w / 5), zs = Math.min(zt - K.ledge - 0.08 - rise - K.ring, c.base + K.doorH);
        if (zs - c.base < 1.2) continue;
        const N = 12, arc = (r: number, t: number): [number, number] => {
          const R = (w * w / 4 + rise * rise) / (2 * rise), cz = zs + rise - R, half = Math.asin(Math.min(1, w / 2 / R)), a = -half + 2 * half * t;
          return [m + (R + r) * Math.sin(a), cz + (R + r) * Math.cos(a)];
        };
        // The recess: dark, up into the arch; the door leaf in it, set back.
        s.wallQuad(c.f, [[p, c.base], [q, c.base], [q, zs], [p, zs]], K.out + 0.006, K.recess);
        for (let i = 0; i < N; i++) { const a = arc(0, i / N), d = arc(0, (i + 1) / N); s.wallQuad(c.f, [[a[0], zs], [d[0], zs], d, a], K.out + 0.006, K.recess); }
        s.wallQuad(c.f, [[p + 0.08, c.base], [q - 0.08, c.base], [q - 0.08, zs - 0.05], [p + 0.08, zs - 0.05]], K.out + 0.01, ROW_DOORCASE.black);
        // The stone ring: voussoirs, the key a little proud.
        for (let i = 0; i < N; i++) { const a0 = arc(0, i / N), a1 = arc(0, (i + 1) / N), b1 = arc(K.ring, (i + 1) / N), b0 = arc(K.ring, i / N); s.wallQuad(c.f, [a0, a1, b1, b0], K.out + 0.02 + (i % 2) * 0.004, shadeHex(b.hex, i === N / 2 || i === N / 2 - 1 ? 1.16 : 1.06)); }
        // The jambs.
        for (const [a, d] of [[p - K.ring * 0.7, p], [q, q + K.ring * 0.7]] as const) s.strip(c.f, a, d, K.out + 0.02, c.base, zs, shadeHex(b.hex, 1.06));
      }
    }
  } },
  { id: 'row-sash', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'row-sash', build: (c, s) => {
    // The stated joinery (RowDesign.glazing, house rows round 5): the glass, a white frame round it and the window kind's
    // glazing bars over every upper window, so a canal front carries its white (8-over-8 sashes, T-windows) instead of the
    // painted cell's dark glass and thin outline.
    const g = c.rowDress?.glazing;
    if (!g) return;
    for (const w of rowWindowsOf(c)) for (const p of rowSashPieces(g, w.x0, w.x1, w.z0, w.z1)) s.wallQuad(c.f, [[p.x0, p.z0], [p.x1, p.z0], [p.x1, p.z1], [p.x0, p.z1]], p.out, p.hex);
  } },
  { id: 'row-shopfront', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'shopfront', build: (c, s) => {
    // A stated single shopfront (ground.shopUnits 1; Weteringschans 168042 "a black-framed shopfront with a patterned glass
    // fascia panel over a large curtained window and a narrow door"): one opening across the ground in the stated frame
    // colour, the door at the stated end, a glazed panel over the window. Covers the painted shop cell.
    const sf = c.rowDress?.shopFront;
    if (!sf || !c.groundLevel || c.f.len < 2) return;
    const S = ROW_SHOP, z0 = c.base, z1 = Math.min(storeyZ(c, 0), c.top) - 0.05, L = c.f.len;
    if (z1 - z0 < 2) return;
    s.wallQuad(c.f, [[0.05, z0], [L - 0.05, z0], [L - 0.05, z1], [0.05, z1]], S.out, sf.frameHex);
    const g0 = S.side, g1 = L - S.side, gz0 = z0 + S.riser, gz1 = z1 - S.fascia, tz = gz1 - Math.min(0.9, (gz1 - gz0) * 0.3);
    // The door: a narrow leaf at the stated end, from the pavement up to the panel.
    const dw = Math.min(S.door, (g1 - g0) * 0.3), d0 = sf.doorEnd === 'end' ? g1 - dw : sf.doorEnd === 'centre' ? (L - dw) / 2 : g0, d1 = d0 + dw;
    const w0 = sf.doorEnd === 'start' ? d1 + S.post : g0, w1 = sf.doorEnd === 'end' ? d0 - S.post : g1;
    s.wallQuad(c.f, [[d0, z0 + 0.05], [d1, z0 + 0.05], [d1, tz], [d0, tz]], S.out + 0.01, S.doorHex);
    if (sf.doorEnd !== 'centre') {
      // The pane is glass (blind review 7: a grey pane read as a shutter): dark glass, a lighter band of sky at the top and
      // one diagonal sheen across it.
      s.wallQuad(c.f, [[w0, gz0], [w1, gz0], [w1, tz], [w0, tz]], S.out + 0.01, S.glass);
      const ww = w1 - w0, hh = tz - gz0;
      s.wallQuad(c.f, [[w0, tz - hh * 0.1], [w1, tz - hh * 0.1], [w1, tz], [w0, tz]], S.out + 0.012, S.sheen);
      s.wallQuad(c.f, [[w0 + ww * 0.46, gz0], [w0 + ww * 0.53, gz0], [w0 + ww * 0.71, tz - hh * 0.16], [w0 + ww * 0.64, tz - hh * 0.16]], S.out + 0.014, S.sheen);
    }
    s.wallQuad(c.f, [[g0, tz + 0.08], [g1, tz + 0.08], [g1, gz1], [g0, gz1]], S.out + 0.01, S.panel);
  } },
  { id: 'row-stoop', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'stoop', build: (c, s) => {
    // A stated stoop: the street door at the bel-etage (its window's place at the stated end), a flight of steps
    // straight out to the pavement between two stone cheek walls, a landing at the door.
    const d = stoopDoor(c);
    if (!d) return;
    const h = d.z0 - c.base;
    if (h < 0.3) return;
    const n = Math.max(2, Math.ceil(h / STOOP.rise)), rise = h / n, x0 = d.x - d.hw - 0.1, x1 = d.x + d.hw + 0.1;
    const form = c.rowDress?.stoop?.form, rail = !!c.rowDress?.stoop?.railing;
    // A stated flight along the wall (Herengracht 130's double stoop): the door first, then the landing and flights.
    // Along the wall the flights rise steeper (STOOP_PARALLEL.rise, tread), as the canal-house double stoops do (130).
    const nA = Math.max(2, Math.ceil(h / STOOP_PARALLEL.rise));
    const along = c.rowDress?.stoop?.steps !== false && (form === 'side' || form === 'double') && stoopFlights(c.f.len, d, nA, form);
    // A souterrain window behind the flight (basement 'stoop-and-windows', Herengracht 130): the flight stands where the read
    // door is, so the window cell there is walled over (its frame and shutters peeked out beside the flight); the souterrain
    // windows beside it stay.
    if (!along && c.rowDress?.stoop?.steps !== false && d.z0 >= storeyZ(c, 0) - 1e-6) for (const [a, b, z0, z1] of stoopHiddenWindows(c, x0 - STOOP.cheek, x1 + STOOP.cheek)) s.strip(c.f, a, b, 0.1, z0, z1, c.wallHex);
    // The door leaf and its white frame, over the bel-etage window's glass.
    const dcase = c.rowDress?.stoop?.doorcase;
    // A stated ground frame (0363100012176327's stoop door in its white frame) stands from the stoop's landing.
    if (dcase?.span === 'frame') rowGroundFrame(c, s, d, dcase, d.z0);
    else if (dcase) rowDoorcase(c, s, d, dcase);
    else {
      s.strip(c.f, d.x - d.hw, d.x + d.hw, 0.03, d.z0, d.z1, STOOP.door);
      s.strip(c.f, d.x - d.hw - 0.1, d.x - d.hw, 0.05, d.z0, d.z1 + 0.1, WHITE);
      s.strip(c.f, d.x + d.hw, d.x + d.hw + 0.1, 0.05, d.z0, d.z1 + 0.1, WHITE);
      s.strip(c.f, d.x - d.hw - 0.1, d.x + d.hw + 0.1, 0.05, d.z1, d.z1 + 0.1, WHITE);
    }
    if (c.rowDress?.stoop?.steps === false) return;
    if (along && parallelStoop(c, s, d, nA, h / nA, form as 'side' | 'double', rail)) return;
    // The flight stays within the pavement (STOOP.reach out from the wall): a tall bel-etage gets steeper treads.
    const tread = n > 1 ? Math.min(STOOP.tread, (STOOP.reach - STOOP.landing) / (n - 1)) : STOOP.tread;
    for (let k = 0; k < n; k++) s.box(c.f, x0, x1, 0, STOOP.landing + (n - 1 - k) * tread, c.base + k * rise, c.base + (k + 1) * rise, STOOP.hex);
    const run = STOOP.landing + (n - 1) * tread;
    // Cheek walls: low beside the flight, a parapet's height beside the landing.
    for (const [a0, a1] of [[x0 - STOOP.cheek, x0], [x1, x1 + STOOP.cheek]] as const) {
      s.box(c.f, a0, a1, 0, run + STOOP.side, c.base, c.base + Math.max(0.5, h * 0.5) + 0.25, STOOP.hex);
      s.box(c.f, a0, a1, 0, STOOP.landing + STOOP.side, c.base, d.z0 + STOOP.rail, STOOP.hex);
    }
    // A stated railing on the straight flight: iron bars and a rail over each cheek, stepping down with the treads.
    if (rail) for (const x of [x0 - STOOP.cheek / 2, x1 + STOOP.cheek / 2]) for (let k = 0; k < n; k++) {
      const o0 = k === n - 1 ? 0 : STOOP.landing + (n - 2 - k) * tread, o1 = STOOP.landing + (n - 1 - k) * tread, z = c.base + (k + 1) * rise + STOOP_PARALLEL.railH;
      s.box(c.f, x - 0.025, x + 0.025, o0, o1, z - STOOP_PARALLEL.rail, z, STOOP_PARALLEL.iron);
      s.box(c.f, x - 0.012, x + 0.012, o1 - 0.04, o1 - 0.015, c.base + (k + 1) * rise, z, STOOP_PARALLEL.iron);
    }
  } },
  { id: 'row-doorcase', styles: ['canal', 'c19', 'school'], p: 0, street: true, group: 'door-frame', build: (c, s) => {
    // A stated doorcase on the street door (RowGround.doorcase): pilasters, entablature or pediment, fanlight.
    const dc = c.rowDress?.doorcase, d = doorSpan(c);
    if (!dc || !d) return;
    // The pilasters stand on the dark plinth strip, not through it.
    const z0 = Math.max(d.z0, Math.min(c.base + ROW_DOORCASE.plinthTop, d.z1 - 1));
    if (dc.span === 'frame') { rowGroundFrame(c, s, d, dc, z0); return; }
    rowDoorcase(c, s, d, dc, z0, dc.span !== 'ground');
    if (dc.span === 'ground') rowGroundSurround(c, s, d, dc, z0);
  } },
  { id: 'row-cornice', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'crown', rise: 1.6, build: (c, s) => {
    // The series' cornice at the wall top: a cream frieze, consoles at a steady pitch, a corona and its cyma, white.
    // `simple` keeps the corona and cyma alone. A stated timber cornice (RowDesign.corniceDress) draws its own parts.
    const C = ROW_DRESS.cornice, t = c.top, kind = c.rowDress?.cornice;
    if (c.rowDress?.corniceDress && c.roofKind !== 'gable') { rowTimberCornice(c, s, c.rowDress.corniceDress); return; }
    if (!kind || c.roofKind === 'gable') return;
    const simple = kind === 'simple';
    if (kind === 'frieze') {
      // A modest light dentil band (Weteringschans s1, review 5: the cream bracketed frieze read too bright and deep):
      // a narrow bed of the wall's own brick toned light, small white dentils under a slim corona.
      const D = ROW_DENTILS, z0 = t - 0.2 - D.bed;
      s.strip(c.f, 0, c.f.len, 0.02, z0, t - 0.2, shadeHex(c.wallHex, 1.25));
      const n = Math.max(4, Math.round(c.f.len / D.pitch));
      for (let i = 0; i < n; i++) { const x = (i + 0.5) * c.f.len / n; s.box(c.f, Math.max(0, x - D.w / 2), Math.min(c.f.len, x + D.w / 2), 0.02, 0.12, t - 0.2 - D.h, t - 0.2, WHITE); }
      s.box(c.f, 0, c.f.len, 0, 0.22, t - 0.2, t, WHITE, true);
      return;
    }
    if (!simple) {
      // The frieze sits on the top storey's head dressing, never over it (Kinkerstraat 104: the block course runs right
      // under the frieze); with no room left above the heads the frieze goes and the consoles stand on the course.
      const z0 = Math.max(t - C.h, rowHeadsTop(c) + 0.04, Math.max(-Infinity, ...rowWindowsOf(c).map(w => w.z1)) + 0.12), frieze = Math.min(C.frieze, t - 0.4 - z0);
      // A bracketed cornice's frieze is the wall's brick between white consoles (Weteringschans 169016 and 171218; blind
      // review: a cream frieze block read too white at rule 10). The heavy cornice keeps its cream frieze.
      if (frieze > 0.12 && kind !== 'bracketed') s.strip(c.f, 0, c.f.len, 0.03, z0, z0 + frieze, CREAM);
      const n = Math.max(2, Math.round(c.f.len / C.pitch));
      // Consoles keep at least CONSOLE_MIN under the corona: on a front whose top heads reach the cornice
      // (Weteringschans 169016) they stand between the heads rather than vanish.
      const c0 = Math.min(z0 + 0.1, t - 0.4 - CONSOLE_MIN);
      for (let i = 0; i < n; i++) { const x = (i + 0.5) * c.f.len / n; s.box(c.f, Math.max(0, x - C.console / 2), Math.min(c.f.len, x + C.console / 2), 0.03, 0.3, c0, t - 0.4, WHITE); }
      if (kind === 'bracketed') {
        // A dentil course under the corona between the consoles (Weteringschans 169016, 171218 under the mansards).
        const D = ROW_DENTILS, m = Math.max(4, Math.round(c.f.len / D.pitch));
        for (let i = 0; i < m; i++) { const x = (i + 0.5) * c.f.len / m; s.strip(c.f, Math.max(0, x - D.w / 2), Math.min(c.f.len, x + D.w / 2), 0.1, t - 0.4 - D.h, t - 0.4, WHITE); }
      }
    }
    s.box(c.f, 0, c.f.len, 0, 0.3, t - 0.4, t - 0.2, WHITE, true);
    s.box(c.f, 0, c.f.len, 0, simple ? 0.3 : C.out, t - 0.2, t, WHITE, true);
  } },
  { id: 'row-heads', styles: ['canal', 'c19', 'school'], p: 0, wide: true, group: 'window-head', build: (c, s) => {
    // The series' head dressing per window (houseLine/rowFront.ts RowHeadsDraw): a block course per storey of the spans
    // that state one, keystones and tympana per window. Plain heads draw nothing.
    const ws = rowWindowsOf(c);
    const storeys = [...new Set(ws.filter(w => w.dressing === 'block-course').map(w => w.storey))];
    for (const k of storeys) blockCourse(c, s, ws.filter(w => w.storey === k && w.dressing === 'block-course'));
    for (const k of new Set(ws.filter(w => w.dressing === 'brick-band').map(w => w.storey))) brickBand(c, s, ws.filter(w => w.storey === k && w.dressing === 'brick-band'));
    for (const w of ws) {
      if (w.dressing === 'block-course' || w.dressing === 'brick-band') continue;
      const g = headGrammarOf(w.dressing, w.shape);
      if (g) grammarHead(c, s, w, g);
    }
    // A head stated on the ground storey itself (storeys [0]: RowGround.archedOpenings, Herengracht 27's arched ground
    // window): only where it says so, never by an unlisted storey.
    if (c.rowDress?.windows?.length) return;
    for (const w of windowSpans(c, -1)) {
      const h = c.rowDress?.heads?.find(q => q.storeys?.includes(0) && w.x >= q.x0 - 1e-6 && w.x <= q.x1 + 1e-6);
      const g = h && headGrammarOf(h.dressing, h.shape);
      if (g) grammarHead(c, s, { x0: w.x - w.hw, x1: w.x + w.hw, z0: w.z0, z1: w.z1, storey: 0, shape: h.shape, dressing: h.dressing }, g);
    }
  } },
];

export const ORNAMENT_COMPONENTS: readonly WallComponent[] = [
  ...ROW_COMPONENTS,
  { id: 'kroonlijst', styles: CANAL, p: { canal: 0.6, c19: 0.15 }, wide: true, street: true, group: 'crown', build: (c, s, r) => {
    // Deep moulded cornice in white: a bed moulding, the corona and a drip, on consoles at the piers.
    // Not under a stepped or neck gable: that front ends in its gable (roofMesh.ts).
    if (c.roofKind === 'gable') return;
    const t = c.top, hex = r < 0.75 ? WHITE : CREAM;
    // Slimmed 2026-10-03 (user: "these overhangs look a little heavy / too wide"): 0.68 m out to 0.4 m.
    s.box(c.f, 0, c.f.len, 0, 0.16, t - 0.4, t - 0.28, hex, true);
    s.box(c.f, 0, c.f.len, 0, 0.3, t - 0.28, t - 0.1, hex, true);
    s.box(c.f, 0, c.f.len, 0, 0.4, t - 0.1, t, hex, true);
    for (const x of pierXs(c).slice(0, 6)) s.box(c.f, Math.max(0, x - 0.09), Math.min(c.f.len, x + 0.09), 0.04, 0.26, t - 0.7, t - 0.4, hex);
  } },
  { id: 'console-cornice', styles: ['c19', 'canal'], p: { c19: 0.4, canal: 0.12 }, wide: true, street: true, group: 'crown', build: (c, s) => {
    // Late 19th century: a cream cornice on paired consoles, with a plain frieze strip.
    if (c.roofKind === 'gable') return;
    const t = c.top;
    s.strip(c.f, 0, c.f.len, 0.04, t - 0.52, t - 0.26, CREAM);
    s.box(c.f, 0, c.f.len, 0, 0.28, t - 0.26, t - 0.1, CREAM, true);
    s.box(c.f, 0, c.f.len, 0, 0.38, t - 0.1, t, WHITE, true);
    const piers = pierXs(c), ends = piers.length > 2 ? [piers[0], piers[Math.floor(piers.length / 2)], piers[piers.length - 1]] : piers;
    for (const x of ends) for (const dx of [-0.14, 0.07]) s.box(c.f, Math.max(0, x + dx), Math.min(c.f.len, x + dx + 0.07), 0.04, 0.26, t - 0.52, t - 0.26, CREAM);
  } },
  { id: 'corbel-roofline', styles: ['school'], p: 0.45, wide: true, street: true, group: 'crown', build: (c, s) => {
    // Amsterdam School: brick courses corbelled out step by step under a cream coping.
    const t = c.top, brick = shadeHex(c.wallHex, 0.82);
    s.box(c.f, 0, c.f.len, 0, 0.08, t - 0.62, t - 0.46, brick, true);
    s.box(c.f, 0, c.f.len, 0, 0.17, t - 0.46, t - 0.3, brick, true);
    s.box(c.f, 0, c.f.len, 0, 0.27, t - 0.3, t - 0.06, brick, true);
    s.box(c.f, 0, c.f.len, 0, 0.33, t - 0.06, t + 0.06, CREAM, true);
  } },
  { id: 'stepped-parapet', styles: ['school'], p: 0.2, wide: true, street: true, group: 'crown', rise: 1.25, build: (c, s) => {
    // A stepped brick parapet rising to the middle of the front, each step capped in stone.
    if (c.f.len < 6) return;
    const t = c.top, L = c.f.len, brick = shadeHex(c.wallHex, 0.9);
    const steps: Array<[number, number, number]> = [[0, L, 0.35], [L * 0.22, L * 0.78, 0.75], [L * 0.38, L * 0.62, 1.1]];
    let z = t;
    for (const [a0, a1, h] of steps) { s.box(c.f, a0, a1, 0, 0.3, z, t + h, brick, false, true); s.box(c.f, a0 - 0.04, a1 + 0.04, -0.02, 0.36, t + h, t + h + 0.08, CREAM, true, true); z = t + h; }
  } },
  { id: 'white-fascia', styles: ['postwar', 'modern', 'tower'], p: { postwar: 0.5, modern: 0.35, tower: 0.25 }, wide: true, group: 'crown', build: (c, s) => {
    s.box(c.f, 0, c.f.len, 0, 0.22, c.top - 0.42, c.top, WHITE, true);
  } },
  // --- Doors ------------------------------------------------------------------------------------
  { id: 'door-surround', styles: CANAL, p: { canal: 0.5, c19: 0.4 }, street: true, group: 'door-frame', build: (c, s, r) => {
    // White jambs, an entablature over the door and the fanlight's radiating bars.
    if (c.recipe && c.recipe.trimDensity !== 'ornate') { restrainedDoorSurround(c, s, r); return; }
    const d = doorSpan(c); if (!d) return;
    const l = d.x - d.hw, rr = d.x + d.hw, top = d.z1 + 0.04;
    s.box(c.f, l - 0.2, l, 0, 0.1, d.z0, top, WHITE);
    s.box(c.f, rr, rr + 0.2, 0, 0.1, d.z0, top, WHITE);
    s.box(c.f, l - 0.3, rr + 0.3, 0, 0.2, top, top + 0.22, WHITE, true);
    if (r < 0.5) s.box(c.f, l - 0.36, rr + 0.36, 0, 0.26, top + 0.22, top + 0.3, WHITE, true);
    if (openingsOf(c).door.fanlight) {
      const fz0 = d.z1 - (d.z1 - d.z0) * 0.28;
      s.strip(c.f, l, rr, 0.05, fz0 - 0.04, fz0, WHITE);
      for (const k of [-0.5, 0, 0.5]) s.strip(c.f, d.x + k * d.hw * 0.7 - 0.02, d.x + k * d.hw * 0.7 + 0.02, 0.05, fz0, d.z1 - 0.04, WHITE);
    }
  } },
  { id: 'portiek', styles: CANAL, p: { c19: 0.35, canal: 0.06 }, street: true, group: 'door-frame', build: (c, s) => {
    // Dress the existing painted entrance; a second solid door panel duplicates its leaf.
    const d = doorSpan(c); if (!d || !c.groundLevel) return;
    const l = d.x - d.hw - 0.05, rr = d.x + d.hw + 0.05, top = d.z1 + 0.3;
    s.box(c.f, l - 0.22, l, 0, 0.14, c.base, top, STONE);
    s.box(c.f, rr, rr + 0.22, 0, 0.14, c.base, top, STONE);
    s.box(c.f, l - 0.26, rr + 0.26, 0, 0.18, top - 0.3, top + 0.12, STONE, true);
    s.box(c.f, d.x - 0.12, d.x + 0.12, 0, 0.22, top - 0.32, top + 0.16, WHITE, true);
    for (let k = 0; k < 4; k++) s.box(c.f, l + 0.02, rr - 0.02, 0, 0.75 - k * 0.18, c.base + k * 0.2, c.base + (k + 1) * 0.2, STONE);
  } },
  { id: 'brick-door-arch', styles: ['school'], p: 0.4, street: true, group: 'door-frame', build: (c, s) => {
    // A deep brick surround stepped out twice round the door, a stone block over it.
    const d = doorSpan(c); if (!d) return;
    const l = d.x - d.hw, rr = d.x + d.hw, brick = shadeHex(c.wallHex, 0.78), top = d.z1 + 0.05;
    for (const [w, o, up] of [[0.16, 0.14, 0.18], [0.32, 0.07, 0.4]] as const) {
      s.box(c.f, l - w, l - w + 0.16, 0, o, d.z0, top + up, brick);
      s.box(c.f, rr + w - 0.16, rr + w, 0, o, d.z0, top + up, brick);
      s.box(c.f, l - w, rr + w, 0, o, top + up - 0.18, top + up, brick, true);
    }
    s.box(c.f, d.x - 0.22, d.x + 0.22, 0, 0.18, top + 0.2, top + 0.5, SANDSTONE, true);
  } },
  { id: 'iron-balconies', styles: CANAL, p: { c19: 0.6, canal: 0.12 }, wide: true, street: true, group: 'balcony', build: (c, s, r) => {
    // Oud-West / Pijp (Kinkerstraat 321): Juliet balconies stacked up one window axis, a stone
    // slab on two corbels with a black iron railing of bars between two rails. A grander front
    // has one on every window of the first floor.
    if (c.layout.storeys < 1) return;
    const per = openingsOf(c).upper.axes.length, all = r < 0.25, pick = per === 3 ? 1 : Math.floor(r * 7) % per;
    const spans = (k: number) => windowSpans(c, k).filter((_, i) => all || i % per === pick);
    const n = all ? 1 : Math.max(1, Math.min(3, c.layout.storeys, Math.floor(s.room() / Math.max(1, spans(0).length * 44))));
    for (let k = 0; k < n; k++) for (const w of spans(k)) {
      const a0 = w.x - w.hw - 0.12, a1 = w.x + w.hw + 0.12, z = w.z0 - 0.02;
      s.box(c.f, a0, a1, 0, 0.42, z - 0.1, z, STONE, true);
      for (const x of [a0 + 0.14, a1 - 0.14]) s.strip(c.f, x - 0.07, x + 0.07, 0.3, z - 0.32, z - 0.1, STONE);
      s.strip(c.f, a0, a1, 0.4, z + 0.86, z + 0.92, IRON, 0.04);
      s.strip(c.f, a0, a1, 0.4, z + 0.1, z + 0.14, IRON, 0.03);
      for (let i = 0; i < 4; i++) { const x = a0 + 0.1 + ((a1 - a0 - 0.2) * i) / 3; s.strip(c.f, x - 0.02, x + 0.02, 0.4, z, z + 0.9, IRON, 0.03); }
    }
  } },
  // --- Windows ---------------------------------------------------------------------------------
  { id: 'window-sills', styles: ['canal', 'c19', 'school'], p: { canal: 0.6, c19: 0.5, school: 0.35 }, wide: true, build: (c, s, r) => {
    // A proud sill under every window, white on a canal house, stone on the School's brick.
    const hex = c.style === 'school' || r < 0.25 ? STONE : WHITE, n = storeysThatFit(c, s, 4, 6);
    for (let k = -1; k < n; k++) for (const w of windowSpans(c, k)) s.strip(c.f, w.x - w.hw - 0.07, w.x + w.hw + 0.07, 0.11, w.z0 - 0.08, w.z0, hex);
  } },
  { id: 'white-lintels', styles: CANAL, p: { canal: 0.4, c19: 0.12 }, wide: true, group: 'window-head', build: (c, s, r) => {
    // A white flat arch over each window, with a keystone on the grander houses.
    const o = openingsOf(c); if (o.ribbon || c.recipe?.windowHead === 'segmental') return;
    const restrained = !!c.recipe && c.recipe.trimDensity !== 'ornate';
    const key = !restrained && r < 0.55, n = storeysThatFit(c, s, key ? 8 : 4, 5);
    for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
      if (o.upper.arch) { s.strip(c.f, w.x - 0.1, w.x + 0.1, 0.07, w.z1 + 0.02, w.z1 + 0.26, WHITE); continue; }
      s.strip(c.f, w.x - w.hw - (restrained ? 0.03 : 0.1), w.x + w.hw + (restrained ? 0.03 : 0.1), restrained ? 0.025 : 0.05, w.z1 + 0.02, w.z1 + (restrained ? 0.07 : 0.2), WHITE);
      if (key) s.strip(c.f, w.x - 0.09, w.x + 0.09, 0.09, w.z1 + 0.01, w.z1 + 0.27, WHITE);
    }
  } },
  { id: 'stucco-hoods', styles: CANAL, p: { c19: 0.5, canal: 0.12 }, wide: true, group: 'window-head', build: (c, s, r) => {
    // 19th-century stucco hood mouldings: a cornice over each window with a sloped top.
    if (openingsOf(c).ribbon || c.recipe?.windowHead === 'segmental') return;
    const restrained = !!c.recipe && c.recipe.trimDensity !== 'ornate';
    const hex = r < 0.6 ? WHITE : CREAM, n = storeysThatFit(c, s, 6, 5);
    for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
      const a0 = w.x - w.hw - (restrained ? .04 : .14), a1 = w.x + w.hw + (restrained ? .04 : .14);
      s.strip(c.f, a0, a1, restrained ? .04 : .14, w.z1 + .03, w.z1 + (restrained ? .09 : .2), hex);
      s.slope(c.f, a0, a1, 0, restrained ? .04 : .14, w.z1 + (restrained ? .12 : .3), w.z1 + (restrained ? .09 : .2), hex);
    }
  } },
  { id: 'white-window-frames', styles: CANAL, p: { canal: 0.3, c19: 0.35 }, wide: true, build: (c, s) => {
    // Painted frames standing proud of the brick: jambs and head round every window.
    if (openingsOf(c).ribbon || c.recipe?.windowHead === 'segmental') return;
    // A stated eared surround (routeAFields.ts) is the frame; a thin frame inside it would only thicken its edge.
    if (c.registerForce?.includes('eared-surrounds')) return;
    const groundCost = windowSpans(c, -1).length * 12;
    const n = Math.max(0, Math.min(5, c.layout.storeys, Math.floor((s.room() - groundCost) / Math.max(12, windowSpans(c, 0).length * 12))));
    for (let k = -1; k < n; k++) for (const w of windowSpans(c, k)) {
      const colour = c.recipe?.frameHex ?? WHITE;
      const restrained = !!c.recipe && c.recipe.trimDensity !== 'ornate', frame = restrained ? .025 : .07, out = restrained ? .025 : .05;
      s.strip(c.f, Math.max(0, w.x - w.hw - frame), w.x - w.hw + 0.01, out, w.z0, Math.min(c.top, w.z1 + 0.04), colour);
      s.strip(c.f, w.x + w.hw - 0.01, Math.min(c.f.len, w.x + w.hw + frame), out, w.z0, Math.min(c.top, w.z1 + 0.04), colour);
      s.strip(c.f, Math.max(0, w.x - w.hw - frame), Math.min(c.f.len, w.x + w.hw + frame), out, w.z1 - 0.02, Math.min(c.top, w.z1 + 0.05), colour);
    }
  } },
  { id: 'eared-surrounds', styles: CANAL, p: 0, wide: true, group: 'window-head', build: (c, s) => {
    // Lane WG step 2 (houseSpec/routeAFields.ts `surround`): a stated stone surround at the block faces' weight
    // (blockBuilding/dressings.ts DRESS.surround, the eared surround of the Nassaukade benchmark): 13 cm jambs, a head
    // that runs past them with ears. Forced only (p 0): never a dice pick, so a wall without the field is unchanged.
    const o = openingsOf(c); if (o.ribbon || o.upper.arch || c.recipe?.windowHead === 'segmental') return;
    const S = EARED_SURROUND, colour = c.recipe?.frameHex ?? WHITE, n = storeysThatFit(c, s, 20, 5);
    for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
      const l = w.x - w.hw, r = w.x + w.hw, head = Math.min(c.top, w.z1 + S.t);
      if (l - S.t - S.ear < 0 || r + S.t + S.ear > c.f.len || head <= w.z1) continue;
      s.strip(c.f, l - S.t, l + 0.01, S.out, w.z0, w.z1 + 0.02, colour);
      s.strip(c.f, r - 0.01, r + S.t, S.out, w.z0, w.z1 + 0.02, colour);
      s.strip(c.f, l - S.t - S.ear, r + S.t + S.ear, S.out + 0.01, w.z1, head, colour);
      s.strip(c.f, l - S.t - S.ear, l - S.t + 0.02, S.earOut, w.z1 - S.earH, w.z1 + 0.02, colour);
      s.strip(c.f, r + S.t - 0.02, r + S.t + S.ear, S.earOut, w.z1 - S.earH, w.z1 + 0.02, colour);
    }
  } },
  { id: 'school-window-bars', styles: ['school'], p: 0.4, wide: true, build: (c, s, r) => {
    // Small-paned windows: a transom and glazing bars in white or the School's orange.
    const hex = pickOf(SCHOOL_FRAMES, r), n = storeysThatFit(c, s, 12, 4);
    for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
      const zt = w.z1 - (w.z1 - w.z0) * 0.3;
      s.strip(c.f, w.x - w.hw, w.x + w.hw, 0.04, zt - 0.03, zt + 0.03, hex);
      for (const f of [-1 / 3, 1 / 3]) s.strip(c.f, w.x + f * w.hw * 2 - 0.025, w.x + f * w.hw * 2 + 0.025, 0.04, w.z0, w.z1, hex);
    }
  } },
  // --- Bands and courses ---------------------------------------------------------------------
  { id: 'floor-cornices', styles: CANAL, p: { canal: 0.3, c19: 0.2 }, wide: true, build: (c, s, r) => {
    // A white band course at every floor line.
    const hex = r < 0.7 ? WHITE : STONE;
    if (rowBands(c, s, 'floor-cornices', ROW_BANDS.floorHex)) return;
    // A stated band (c.bandM, houseSpec/routeAFields.ts) is centred on the floor line at its height.
    for (let k = 0; k < Math.min(6, c.layout.storeys); k++) { const z = storeyZ(c, k); s.strip(c.f, 0, c.f.len, 0.08, c.bandM ? z - c.bandM / 2 : z - 0.03, c.bandM ? z + c.bandM / 2 : z + 0.04, hex); }
  } },
  { id: 'speklagen', styles: CANAL, p: 0, wide: true, build: (c, s) => {
    // Lane WG step 3 (houseSpec/routeAFields.ts bands `speklagen`): bacon courses, stone courses across the plain wall
    // between one row's heads and the next row's sills (and over the ground row), full width so no strip crosses glass. One
    // floor-line band read as nothing at row distance (Weteringschans 171218). Course height and projection are the block
    // faces' stripe (blockBuilding/dressings.ts DRESS.stripe out; SPEKLAAG_M); forced only (p 0).
    if (rowBands(c, s, 'speklagen', CREAM)) return;
    const o = openingsOf(c), l = c.layout, n = Math.min(6, l.storeys);
    const zones: Array<[number, number]> = [[c.base + (o.ground?.head ?? o.door.top) * l.groundM, storeyZ(c, 0) + o.upper.sill * l.storeyM]];
    for (let k = 0; k < n - 1; k++) zones.push([storeyZ(c, k) + o.upper.head * l.storeyM, storeyZ(c, k + 1) + o.upper.sill * l.storeyM]);
    for (const [z0, z1] of zones) {
      const room = Math.min(z1, c.top) - z0 - 0.06, count = Math.max(0, Math.min(SPEKLAAG.max, Math.floor(room / SPEKLAAG.pitch)));
      if (!count) continue;
      const gap = (Math.min(z1, c.top) - z0 - count * SPEKLAAG.h) / (count + 1);
      for (let i = 0; i < count; i++) { const a = z0 + gap * (i + 1) + SPEKLAAG.h * i; s.strip(c.f, 0, c.f.len, SPEKLAAG.out, a, a + SPEKLAAG.h, CREAM); }
    }
  } },
  { id: 'string-courses', styles: CANAL, p: { c19: 0.45, canal: 0.1 }, wide: true, build: (c, s) => {
    // 19th century: a thin proud stone ledge running through the sills of each storey (the bay
    // drawing paints the flat band; this only adds its drip edge).
    if (rowBands(c, s, 'string-courses', CREAM)) return;
    const o = openingsOf(c);
    for (let k = 0; k < Math.min(6, c.layout.storeys); k++) { const z = storeyZ(c, k) + o.upper.sill * c.layout.storeyM; s.strip(c.f, 0, c.f.len, 0.06, c.bandM ? z - 0.04 - c.bandM : z - 0.1, z - 0.04, CREAM); }
  } },
  { id: 'ribbon-bands', styles: ['school'], p: 0.35, wide: true, build: (c, s, r) => {
    // The School's horizontal emphasis: pale bands above and below every window row.
    const hex = r < 0.6 ? CREAM : WHITE;
    for (let k = 0; k < Math.min(5, c.layout.storeys); k++) {
      const w = windowSpans(c, k)[0]; if (!w) continue;
      s.strip(c.f, 0, c.f.len, 0.06, w.z0 - 0.14, w.z0 - 0.02, hex);
      s.strip(c.f, 0, c.f.len, 0.06, w.z1 + 0.04, w.z1 + 0.14, hex);
    }
  } },
  { id: 'floor-slab-edges', styles: ['postwar', 'modern', 'tower'], p: { postwar: 0.4, modern: 0.25, tower: 0.3 }, wide: true, build: (c, s) => {
    // Strokenbouw and later: the white concrete floor-slab edges read as bands across the front.
    for (let k = 0; k < Math.min(10, c.layout.storeys); k++) { const z = storeyZ(c, k); s.strip(c.f, 0, c.f.len, 0.1, z - 0.12, z + 0.1, WHITE); }
  } },
  // --- Piers, pilasters, fins ------------------------------------------------------------------
  { id: 'corner-pilasters', styles: CANAL, p: { canal: 0.22, c19: 0.3 }, wide: true, street: true, build: (c, s, r) => {
    // Pilasters at both ends of the front, with a capital; on a wide patrician house, on every pier.
    if (c.layout.storeys < 1) return;
    // A dice pilaster takes the wall's own colour; a stated one stays pale (look/pilasterTone.ts, `?pilasterTone=0`).
    const hex = pilasterHex(c, r < 0.6 ? WHITE : STONE), z0 = storeyZ(c, 0) - 0.15, z1 = c.top - 0.45;
    const xs = c.f.len >= 9 && r < 0.3 ? pierXs(c) : [0, c.f.len];
    for (const x of xs.slice(0, 6)) {
      const a0 = Math.max(0, Math.min(c.f.len - 0.42, x - 0.21)), a1 = a0 + 0.42;
      s.box(c.f, a0, a1, 0, 0.1, z0, z1, hex, true);
      s.box(c.f, a0 - 0.05, a1 + 0.05, 0, 0.16, z1, z1 + 0.18, hex, true);
    }
  } },
  { id: 'brick-fins', styles: ['school'], p: 0.35, wide: true, street: true, build: (c, s) => {
    // Vertical brick fins on the piers, running from the first floor to the roof.
    if (c.layout.storeys < 1) return;
    const brick = shadeHex(c.wallHex, 0.8), z0 = storeyZ(c, 0) - 0.3;
    for (const x of pierXs(c).slice(1, -1).slice(0, 8)) s.box(c.f, x - 0.11, x + 0.11, 0, 0.32, z0, c.top - 0.05, brick, true);
  } },
  // --- Projections --------------------------------------------------------------------------
  { id: 'oriel', styles: ['school', 'c19'], p: { school: 0.25, c19: 0.08 }, street: true, group: 'oriel', build: (c, s, r) => {
    // A rounded oriel over one or two storeys: three stepped boxes read as a curve, with glass
    // bands, a stone corbel under it and a cap.
    if (c.layout.storeys < 2 || c.f.len < 5.5) return;
    // Feedback d99e51 (Postjesweg 0363100012104321): at 0.5 / 0.3 of the wall the oriel cut half of two windows; it now
    // stands on a window axis or pier where it covers windows whole, narrowed at most to 60 %, or is not drawn
    // (projectionWindowFit.ts). Where nothing was cut it is as before (x and k = 1 exactly).
    const fit = fitProjectionFor(c.id, 'oriel', c.f.len * (r < 0.5 ? 0.5 : 0.3), 1.38, [0, 1].filter(k => k < Math.min(2, c.layout.storeys - 1)).flatMap(k => windowSpans(c, k)), c.f.len);
    if (!fit) return;
    const x = fit.x, k = fit.scale, z0 = storeyZ(c, 0) + 0.1, z1 = storeyZ(c, Math.min(2, c.layout.storeys - 1)) - 0.1;
    const glassZ0 = z0 + 0.7, glassZ1 = z1 - 0.35, frame = c.style === 'school' ? pickOf(SCHOOL_FRAMES, r) : WHITE;
    s.box(c.f, x - 0.75 * k, x + 0.75 * k, 0, 0.4, z0 - 0.4, z0, SANDSTONE, true);
    const body = shadeHex(c.wallHex, 0.88);
    // Shallower since 2026-10-03 (0.85 m out read as a box bolted on: "awful imposing extrusions").
    for (const [hw, o] of [[1.3, 0.2], [1.05, 0.38], [0.7, 0.5]] as const) s.box(c.f, x - hw * k, x + hw * k, 0, o, z0, z1, body, true);
    // Glass on each step's face, where the step stands out past the next one.
    for (const [a0, a1, o] of [[-1.22, -1.1, 0.2], [-0.95, -0.8, 0.38], [-0.62, 0.62, 0.5], [0.8, 0.95, 0.38], [1.1, 1.22, 0.2]] as const) s.strip(c.f, x + a0 * k, x + a1 * k, o + 0.01, glassZ0, glassZ1, '#8ea6b4', 0.01);
    s.strip(c.f, x - 0.6 * k, x + 0.6 * k, 0.53, glassZ0 + (glassZ1 - glassZ0) * 0.68, glassZ0 + (glassZ1 - glassZ0) * 0.72, frame, 0.03);
    s.box(c.f, x - 1.38 * k, x + 1.38 * k, 0, 0.56, z1, z1 + 0.14, c.style === 'school' ? '#4f7a6a' : STONE, true);
  } },
  // --- Ground floor -------------------------------------------------------------------------
  { id: 'rusticated-plinth', styles: CANAL, p: { c19: 0.4, canal: 0.12 }, wide: true, street: true, group: 'plinth', build: (c, s) => {
    // Banded stucco on the ground floor up to the window sills: courses with deep joints.
    if (!c.groundLevel || c.shopfront) return;
    const top = Math.min(c.base + 1.15, (windowSpans(c, -1)[0]?.z0 ?? c.base + 1.2) - 0.05);
    for (let z = c.base; z < top - 0.12; z += 0.27) for (const [a0, a1] of aroundDoor(c, 0, c.f.len)) s.strip(c.f, a0, a1, 0.05, z, Math.min(top, z + 0.22), CREAM);
    for (const [a0, a1] of aroundDoor(c, 0, c.f.len, 0.05)) s.strip(c.f, a0, a1, 0.08, top, top + 0.08, WHITE);
  } },
  { id: 'stone-plinth-band', styles: ['school'], p: 0.45, wide: true, group: 'plinth', build: (c, s, r) => {
    // A band of natural stone or glazed tile along the foot, under a pale course.
    if (!c.groundLevel) return;
    const hex = r < 0.5 ? BLUESTONE : pickOf(GLAZED_TILE, r * 2);
    for (const [a0, a1] of aroundDoor(c, 0, c.f.len, 0.02)) { s.strip(c.f, a0, a1, 0.05, c.base, c.base + 0.85, hex); s.strip(c.f, a0, a1, 0.08, c.base + 0.85, c.base + 0.95, CREAM); }
  } },
  // --- Canal-house specials -----------------------------------------------------------------
  { id: 'warehouse-shutters', styles: ['canal'], p: 0.1, wide: true, street: true, group: 'axis', build: (c, s, r) => {
    // A pakhuis front: the loading doors stacked up the middle axis, shutters in a white frame.
    if (c.layout.storeys < 2 || c.f.len < 4.5) return;
    const x = c.f.len / 2, hex = pickOf(LUIKEN, r), hw = Math.min(0.62, c.layout.bayWidthM * 0.13);
    for (let k = 0; k < Math.min(4, c.layout.storeys); k++) {
      const z0 = storeyZ(c, k) + 0.25, z1 = storeyZ(c, k) + c.layout.storeyM * 0.82;
      s.strip(c.f, x - hw - 0.08, x + hw + 0.08, 0.03, z0 - 0.08, z1 + 0.08, WHITE);
      s.box(c.f, x - hw, x + hw, 0, 0.08, z0, z1, hex);
    }
  } },
  { id: 'cornice-vases', styles: CANAL, p: { canal: 0.25, c19: 0.1 }, wide: true, street: true, atomic: true, rise: 1.0, build: (c, s) => {
    // Stone vases (acroteria) on the cornice: one at each end, one in the middle of a wide front.
    if (c.roofKind === 'gable' || c.roofKind === 'mansard') return;
    const xs = c.f.len >= 7 ? [0.3, c.f.len / 2, c.f.len - 0.3] : [0.3, c.f.len - 0.3];
    for (const x of xs) {
      s.box(c.f, x - 0.17, x + 0.17, 0.12, 0.46, c.top, c.top + 0.22, WHITE);
      s.box(c.f, x - 0.12, x + 0.12, 0.17, 0.41, c.top + 0.22, c.top + 0.62, STONE);
      s.box(c.f, x - 0.05, x + 0.05, 0.24, 0.34, c.top + 0.62, c.top + 0.78, STONE);
    }
  } },
  // --- Amsterdam School specials ------------------------------------------------------------
  { id: 'corner-sculpture', styles: ['school'], p: 0.2, street: true, build: (c, s, r) => {
    // A sculpted stone piece at a corner over the ground floor: blocks stepping out, then a head.
    if (c.layout.storeys < 1) return;
    const right = r < 0.5, z = storeyZ(c, 0) - 0.2, L = c.f.len;
    const at = (a0: number, a1: number) => (right ? [L - a1, L - a0] : [a0, a1]) as [number, number];
    for (const [a0, a1, o, z0, z1] of [[0, 0.7, 0.3, z - 0.35, z], [0, 0.55, 0.48, z, z + 0.45], [0, 0.4, 0.58, z + 0.45, z + 0.95], [0.08, 0.32, 0.5, z + 0.95, z + 1.2]] as const) {
      const [p, q] = at(a0, a1); s.box(c.f, p, q, 0, o, z0, z1, SANDSTONE, true);
    }
  } },
  { id: 'school-tower', styles: ['school'], p: 0.1, wide: true, street: true, rise: 2.3, build: (c, s, r) => {
    // A corner tower: one end of the block carried two metres above the roof, a tall slit window in it.
    if (c.f.len < 8 || c.layout.storeys < 2) return;
    const L = c.f.len, w = 1.6, a0 = r < 0.5 ? 0 : L - w, brick = shadeHex(c.wallHex, 0.86);
    s.box(c.f, a0, a0 + w, 0, 0.4, storeyZ(c, 0), c.top + 2.0, brick, true, true);
    s.box(c.f, a0 - 0.05, a0 + w + 0.05, -0.05, 0.48, c.top + 2.0, c.top + 2.15, CREAM, true, true);
    s.strip(c.f, a0 + w / 2 - 0.2, a0 + w / 2 + 0.2, 0.42, storeyZ(c, 1), c.top + 1.6, '#4d5f6b', 0.02);
  } },
];
