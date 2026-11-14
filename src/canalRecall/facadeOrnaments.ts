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
import { bayLookOpenings, proceduralOpenings, type OpeningRow, type Openings } from './facadeOpenings.js';
import type { FacadeStyle } from './genericFacades.js';
import { pilasterHex } from './look/pilasterTone.js';
import { headGrammarOf, headPieces, headRise, type HeadGrammar } from './houseLine/headGrammar.js';

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
const BAY_LOOK_STYLES: readonly FacadeStyle[] = ['canal', 'school', 'modern'];
/** The openings this building's walls show: given by the mesh, else the bay look's (the default look). */
export const openingsOf = (c: ExtraContext): Openings => c.openings ?? (BAY_LOOK_STYLES.includes(c.style) ? bayLookOpenings(c.id, c.style) : proceduralOpenings(c.style));
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
    for (const [index,axis] of row.axes.entries()) out.push({ x: (i + axis) * bw, hw: ((row.widths?.[index] ?? row.width) * bw) / 2, z0: z + row.sill * h, z1: z + row.head * h });
  }
  return out;
}
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
/** The top of the highest head dressing a row wall draws (block course, keystone arch, tympanum, lintel); -inf with none. */
function rowHeadRise(w: RowWindow): number {
  if (w.dressing === 'block-course') return ROW_DRESS.block.tall;
  const g = headGrammarOf(w.dressing, w.shape);
  return g ? headRise(g, w.x1 - w.x0) : -Infinity;
}
function rowHeadsTop(c: ExtraContext): number {
  let top = -Infinity;
  for (const w of rowWindowsOf(c)) {
    const rise = rowHeadRise(w), z = rise > -Infinity && w.dressing !== 'block-course' ? headLine(c, w, rise) ?? w.z1 : w.z1;
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

/** A window head drawn from the head grammar (houseLine/headGrammar.ts): voussoirs, keys, springers, tympana and
 *  jack-block crowns as flat wall pieces at the opening's scale; the glass follows a segmental or round arch. */
const ARCH_GLASS = '#3d4955', TYMPANUM_STONE = '#e9e0cc';
/** Where a head stands: on the opening's head line, or lowered into the opening's top when it would run into the cornice
 *  (Kinkerstraat 90's top storey: the arches sit right under the corona); null when that would take half the opening. */
function headLine(c: ExtraContext, w: RowWindow, rise: number): number | null {
  const room = c.top - (c.rowDress?.cornice ? 0.42 : 0.02), z = Math.min(w.z1, room - rise);
  return z < (w.z0 + w.z1) / 2 ? null : z;
}
function grammarHead(c: ExtraContext, s: ExtraSink, w: RowWindow, g: HeadGrammar): void {
  const z = headLine(c, w, headRise(g, w.x1 - w.x0));
  if (z === null) return;
  // The tympanum fill is a pale stone that reads against the brick at row scale (Kinkerstraat 90 read "flat heads").
  const hex = { white: WHITE, brick: shadeHex(c.wallHex, 0.72), stone: TYMPANUM_STONE, glass: ARCH_GLASS } as const;
  for (const p of headPieces(g, w.x0, w.x1, z, w.z0)) s.wallQuad(c.f, p.pts, p.out, hex[p.tone]);
}

/** House rows: a front's stated parts beyond the heads and cornice, drawn only when the series or front states them. */
// Grey sandstone/hardstone blocks with deep sunk joints (171218's photo: grey, not the warm cream of the dressings).
const RUSTIC = { course: 0.34, joint: 0.06, block: 0.95, stone: '#a3a199', jointHex: '#4f4d48', out: 0.07 } as const;
/** Row bands that read at street distance (40 px/m): speklagen 18 cm every ~45 cm of wall (171218), string-courses and
 *  floor-line bands 20 cm (169016). The shared components' hairline courses stay for walls without a row record. */
const ROW_BANDS = { spek: 0.18, spekPitch: 0.46, spekOut: 0.05, course: 0.2, courseOut: 0.08, margin: 0.06 } as const;
/** The stoop: steps and cheek walls up to the bel-etage door over a souterrain (Weteringschans 169016, 171218). */
const STOOP = { rise: 0.19, tread: 0.3, landing: 0.85, reach: 1.75, cheek: 0.22, side: 0.12, rail: 0.75, hex: '#a3a199', door: '#3b2f27' } as const;
/** The bel-etage street door over a stated stoop: the bel-etage window at the stated end, from the floor up. */
export function stoopDoor(c: ExtraContext): Span | null {
  const st = c.rowDress?.stoop;
  if (!st || !c.groundLevel || c.layout.storeys < 1) return null;
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
    const z0 = storeyZ(c, 0) + 0.25, n = Math.floor((top - z0) / ROW_BANDS.spekPitch);
    for (let i = 0; i < n; i++) { const a = z0 + i * ROW_BANDS.spekPitch; rowBand(c, s, holes, a, a + ROW_BANDS.spek, ROW_BANDS.spekOut, CREAM); }
    return true;
  }
  for (let k = 0; k < Math.min(6, l.storeys); k++) {
    const z = kind === 'floor-cornices' ? storeyZ(c, k) - 0.06 : storeyZ(c, k) + o.upper.sill * l.storeyM - ROW_BANDS.course - 0.02;
    if (z + ROW_BANDS.course > top) continue;
    rowBand(c, s, kind === 'floor-cornices' ? [] : holes, z, z + ROW_BANDS.course, ROW_BANDS.courseOut, hex);
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
  { id: 'row-stoop', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'stoop', build: (c, s) => {
    // A stated stoop: the street door at the bel-etage (its window's place at the stated end), a flight of steps
    // straight out to the pavement between two stone cheek walls, a landing at the door.
    const d = stoopDoor(c);
    if (!d) return;
    const h = d.z0 - c.base;
    if (h < 0.3) return;
    const n = Math.max(2, Math.ceil(h / STOOP.rise)), rise = h / n, x0 = d.x - d.hw - 0.1, x1 = d.x + d.hw + 0.1;
    // The door leaf and its white frame, over the bel-etage window's glass.
    s.strip(c.f, d.x - d.hw, d.x + d.hw, 0.03, d.z0, d.z1, STOOP.door);
    s.strip(c.f, d.x - d.hw - 0.1, d.x - d.hw, 0.05, d.z0, d.z1 + 0.1, WHITE);
    s.strip(c.f, d.x + d.hw, d.x + d.hw + 0.1, 0.05, d.z0, d.z1 + 0.1, WHITE);
    s.strip(c.f, d.x - d.hw - 0.1, d.x + d.hw + 0.1, 0.05, d.z1, d.z1 + 0.1, WHITE);
    if (c.rowDress?.stoop?.steps === false) return;
    // The flight stays within the pavement (STOOP.reach out from the wall): a tall bel-etage gets steeper treads.
    const tread = n > 1 ? Math.min(STOOP.tread, (STOOP.reach - STOOP.landing) / (n - 1)) : STOOP.tread;
    for (let k = 0; k < n; k++) s.box(c.f, x0, x1, 0, STOOP.landing + (n - 1 - k) * tread, c.base + k * rise, c.base + (k + 1) * rise, STOOP.hex);
    const run = STOOP.landing + (n - 1) * tread;
    // Cheek walls: low beside the flight, a parapet's height beside the landing.
    for (const [a0, a1] of [[x0 - STOOP.cheek, x0], [x1, x1 + STOOP.cheek]] as const) {
      s.box(c.f, a0, a1, 0, run + STOOP.side, c.base, c.base + Math.max(0.5, h * 0.5) + 0.25, STOOP.hex);
      s.box(c.f, a0, a1, 0, STOOP.landing + STOOP.side, c.base, d.z0 + STOOP.rail, STOOP.hex);
    }
  } },
  { id: 'row-cornice', styles: ['canal', 'c19', 'school'], p: 0, wide: true, street: true, group: 'crown', build: (c, s) => {
    // The series' cornice at the wall top: a cream frieze, consoles at a steady pitch, a corona and its cyma, white.
    // `simple` keeps the corona and cyma alone.
    const C = ROW_DRESS.cornice, t = c.top, kind = c.rowDress?.cornice;
    if (!kind || c.roofKind === 'gable') return;
    const simple = kind === 'simple';
    if (!simple) {
      // The frieze sits on the top storey's head dressing, never over it (Kinkerstraat 104: the block course runs right
      // under the frieze); with no room left above the heads the frieze goes and the consoles stand on the course.
      const z0 = Math.max(t - C.h, rowHeadsTop(c) + 0.04, Math.max(-Infinity, ...rowWindowsOf(c).map(w => w.z1)) + 0.12), frieze = Math.min(C.frieze, t - 0.4 - z0);
      if (frieze > 0.12) s.strip(c.f, 0, c.f.len, 0.03, z0, z0 + frieze, CREAM);
      const n = Math.max(2, Math.round(c.f.len / C.pitch));
      // Consoles keep at least CONSOLE_MIN under the corona: on a front whose top heads reach the cornice
      // (Weteringschans 169016) they stand between the heads rather than vanish.
      const c0 = Math.min(z0 + 0.1, t - 0.4 - CONSOLE_MIN);
      for (let i = 0; i < n; i++) { const x = (i + 0.5) * c.f.len / n; s.box(c.f, Math.max(0, x - C.console / 2), Math.min(c.f.len, x + C.console / 2), 0.03, 0.3, c0, t - 0.4, WHITE); }
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
    for (const w of ws) {
      if (w.dressing === 'block-course') continue;
      const g = headGrammarOf(w.dressing, w.shape);
      if (g) grammarHead(c, s, w, g);
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
    if (rowBands(c, s, 'floor-cornices', hex)) return;
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
    const x = c.f.len * (r < 0.5 ? 0.5 : 0.3), z0 = storeyZ(c, 0) + 0.1, z1 = storeyZ(c, Math.min(2, c.layout.storeys - 1)) - 0.1;
    const glassZ0 = z0 + 0.7, glassZ1 = z1 - 0.35, frame = c.style === 'school' ? pickOf(SCHOOL_FRAMES, r) : WHITE;
    s.box(c.f, x - 0.75, x + 0.75, 0, 0.4, z0 - 0.4, z0, SANDSTONE, true);
    const body = shadeHex(c.wallHex, 0.88);
    // Shallower since 2026-10-03 (0.85 m out read as a box bolted on: "awful imposing extrusions").
    for (const [hw, o] of [[1.3, 0.2], [1.05, 0.38], [0.7, 0.5]] as const) s.box(c.f, x - hw, x + hw, 0, o, z0, z1, body, true);
    // Glass on each step's face, where the step stands out past the next one.
    for (const [a0, a1, o] of [[x - 1.22, x - 1.1, 0.2], [x - 0.95, x - 0.8, 0.38], [x - 0.62, x + 0.62, 0.5], [x + 0.8, x + 0.95, 0.38], [x + 1.1, x + 1.22, 0.2]] as const) s.strip(c.f, a0, a1, o + 0.01, glassZ0, glassZ1, '#8ea6b4', 0.01);
    s.strip(c.f, x - 0.6, x + 0.6, 0.53, glassZ0 + (glassZ1 - glassZ0) * 0.68, glassZ0 + (glassZ1 - glassZ0) * 0.72, frame, 0.03);
    s.box(c.f, x - 1.38, x + 1.38, 0, 0.56, z1, z1 + 0.14, c.style === 'school' ? '#4f7a6a' : STONE, true);
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
