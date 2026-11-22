/**
 * Measured openings (belt-windows lane, 2026-11-22). Until now a house's windows were a kind name (`sash-4-over-4`,
 * `heads`, `whiteFrames`): their width, height, sill, spacing and panes came from the kit's painted bay cell, so a front
 * whose windows nearly fill their bays (Herengracht 90: 1.3 m wide casements, two lights under a transom) drew as narrow
 * tall 4-over-4 sashes. This is the language for what the photo says about each window row:
 *
 *   - `x`: the bay centres, as shares of the front's width as seen (left to right; the ground front's convention,
 *     designUnits/soloGround.ts GroundOpening);
 *   - `w`, `h`, `sill`: the window's width and height and its sill over the storey's floor, in metres measured on the
 *     rectified crop at its pixels per metre (frames included: the outer edge of the frame, not the reveal);
 *   - `head`: flat, segmental or round (the arch's crown is the top of `h`);
 *   - `panes`: columns x rows of lights, with an optional transom: the top `transom` share of the glass is a toplight
 *     row (`topCols` lights, default `cols`), the panes under it;
 *   - `frame`: the frame's paint (hex); absent: the read's white or dark frames; `sash`: the sashes' and bars' paint
 *     where it differs from the frame;
 *   - `surround`: the dressing round the frame (the read's window surround vocabulary); `none` draws nothing.
 *
 * One row per storey (0 = the ground storey), with a grid `default` every row takes and per-bay `except`ions. Doors stay
 * with the ground front (groundFront): a ground row lists windows only; where a ground front is read, its boxes are drawn
 * and the ground row lends them only its panes and frame.
 *
 * The drawing keeps the photo's proportions: widths scale by the drawn front over `frontM`, heights and sills by the drawn
 * storey over the measured `storeyM`. Pure and browser-safe. Absent: nothing changes.
 */

export const OPENING_HEADS = ['flat', 'segmental', 'round'] as const;
export type OpeningHead = (typeof OPENING_HEADS)[number];
/** The dressing round a window frame (houseSpec SPEC_WINDOW_SURROUNDS less the head-only ones the head parts draw). */
export const OPENING_SURROUNDS = ['none', 'full-frame', 'block-dressings', 'sill', 'keystone', 'stone-lintel', 'jack-blocks'] as const;
export type OpeningSurround = (typeof OPENING_SURROUNDS)[number];
export type OpeningMethod = 'pixel' | 'eye';

/** A window's lights: `cols` x `rows` under an optional transom (the top `transom` share of the glass, `topCols` lights). */
export interface PaneLayout { cols: number; rows: number; transom?: number; topCols?: number }

/** What a window looks like (every field of a row, a bay exception or the grid default). */
export interface OpeningLook {
  /** Width over the frame (m, photo). */
  w: number;
  /** Height over the frame, sill to head (m, photo). */
  h: number;
  /** The sill (frame bottom) over the storey's floor line (m, photo). */
  sill: number;
  head?: OpeningHead;
  panes?: PaneLayout;
  /** Frame paint (hex): the outer frame (the casing round the lights). */
  frame?: string;
  /** The sashes' and bars' paint where it differs from the frame (Herengracht 90: white casings, dark brown sashes). */
  sash?: string;
  surround?: OpeningSurround;
}
export interface OpeningRow extends Partial<OpeningLook> {
  /** 0 = the ground storey, 1 = the first upper storey, ... */
  storey: number;
  /** Bay centres as shares of the front's width, left to right as seen. */
  x: number[];
  /** Per-bay exceptions, keyed by the bay's index in `x`. */
  except?: Record<string, Partial<OpeningLook>>;
  /** How the row was measured: one method for all its values, or per value (absent values: the row's `all`). */
  by: OpeningMethod | ({ all: OpeningMethod } & Partial<Record<'x' | keyof OpeningLook, OpeningMethod>>);
}
export interface OpeningGrid {
  /** The measured front's width (m): the crop's span over its pixels per metre. */
  frontM: number;
  /** The photo's front line [lngA, latA, lngB, latB], left to right as seen (belt windows 2: the wall the crop was cut on,
   *  at the picked facade edges). A drawn street run longer than `frontM` (a footprint edge running past the photo's wall,
   *  Herengracht 72: a 6.61 m run under a 4.2 m front) takes the grid on the stretch of it this line covers. */
  line?: [number, number, number, number];
  /** The measured floor-to-floor heights (m), the ground storey (pavement to first floor) first; the top storey up to
   *  the cornice zone's foot or the gable's eaves line. */
  storeyM: number[];
  default?: Partial<OpeningLook>;
  rows: OpeningRow[];
  note?: string;
}

/** One window to draw, in drawn metres: `x` its centre from the front's left as seen, z over the storey's floor. */
export interface OpeningBox {
  storey: number;
  bay: number;
  x: number;
  hw: number;
  z0: number;
  z1: number;
  head: OpeningHead;
  panes: PaneLayout;
  frame?: string;
  sash?: string;
  surround: DrawnSurround;
}

/**
 * Belt windows 2: the stock kit's dressing round a window (bayTextures.ts windowAt: a stone lintel, a sill and pale side
 * blocks), drawn round a measured window whose grid states no surround, so a measured front keeps what the stock cells
 * painted (Herengracht 12, 54: the lane's bare frames had replaced them). `restrained`: the thin lintel and sill.
 */
export interface StockTrim { lintel: 'flat' | 'arch' | 'none'; restrained: boolean; blocks: boolean }
/** A drawn window's dressing: a stated surround, or the stock kit's. */
export type DrawnSurround = OpeningSurround | { stock: StockTrim };
/** The stock kit's stone (bayTextures.ts windowAt `stone`). */
export const STOCK_STONE = '#cfc8b8';

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const METHODS: readonly string[] = ['pixel', 'eye'];

function lookProblems(v: unknown, at: string): string[] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return [`${at}: an object`];
  const l = v as Record<string, unknown>, p: string[] = [];
  if (l.w !== undefined && !num(l.w, 0.15, 6)) p.push(`${at}.w: 0.15-6 m`);
  if (l.h !== undefined && !num(l.h, 0.15, 8)) p.push(`${at}.h: 0.15-8 m`);
  if (l.sill !== undefined && !num(l.sill, -0.5, 6)) p.push(`${at}.sill: -0.5-6 m`);
  if (l.head !== undefined && !(OPENING_HEADS as readonly unknown[]).includes(l.head)) p.push(`${at}.head: ${OPENING_HEADS.join('|')}`);
  if (l.surround !== undefined && !(OPENING_SURROUNDS as readonly unknown[]).includes(l.surround)) p.push(`${at}.surround: ${OPENING_SURROUNDS.join('|')}`);
  if (l.frame !== undefined && !(typeof l.frame === 'string' && HEX.test(l.frame))) p.push(`${at}.frame: #rrggbb`);
  if (l.sash !== undefined && !(typeof l.sash === 'string' && HEX.test(l.sash))) p.push(`${at}.sash: #rrggbb`);
  if (l.panes !== undefined) {
    const q = l.panes as Record<string, unknown> | null;
    if (!q || typeof q !== 'object') p.push(`${at}.panes: an object`);
    else {
      if (!(Number.isInteger(q.cols) && num(q.cols, 1, 8))) p.push(`${at}.panes.cols: 1-8`);
      if (!(Number.isInteger(q.rows) && num(q.rows, 1, 8))) p.push(`${at}.panes.rows: 1-8`);
      if (q.transom !== undefined && !num(q.transom, 0.08, 0.6)) p.push(`${at}.panes.transom: 0.08-0.6`);
      if (q.topCols !== undefined && !(Number.isInteger(q.topCols) && num(q.topCols, 1, 8))) p.push(`${at}.panes.topCols: 1-8`);
    }
  }
  return p;
}

/** Problems with a grid (empty = valid). */
export function openingGridProblems(v: unknown): string[] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['openings: an object'];
  const g = v as Record<string, unknown>, p: string[] = [];
  if (!num(g.frontM, 1.5, 40)) p.push('frontM: 1.5-40 m');
  if (g.line !== undefined && !(Array.isArray(g.line) && g.line.length === 4 && g.line.every(v => num(v, -180, 180)))) p.push('line: [lngA, latA, lngB, latB]');
  if (!Array.isArray(g.storeyM) || !g.storeyM.length || !g.storeyM.every(x => num(x, 1, 10))) p.push('storeyM: a list of 1-10 m');
  if (g.default !== undefined) p.push(...lookProblems(g.default, 'default'));
  if (!Array.isArray(g.rows) || !g.rows.length) p.push('rows: a non-empty list');
  const seen = new Set<number>();
  for (const [i, r] of (Array.isArray(g.rows) ? g.rows : []).entries()) {
    const at = `rows[${i}]`, row = r as Record<string, unknown>;
    if (!row || typeof row !== 'object') { p.push(`${at}: an object`); continue; }
    if (!(Number.isInteger(row.storey) && num(row.storey, 0, 12))) p.push(`${at}.storey: 0-12`);
    else if (seen.has(row.storey as number)) p.push(`${at}.storey: one row per storey`);
    else seen.add(row.storey as number);
    if (Array.isArray(g.storeyM) && Number.isInteger(row.storey) && (row.storey as number) >= g.storeyM.length) p.push(`${at}.storey: no storeyM for it`);
    if (!Array.isArray(row.x) || !row.x.length || !row.x.every(x => num(x, 0, 1))) p.push(`${at}.x: shares 0-1`);
    else for (let k = 1; k < row.x.length; k++) if (!((row.x[k] as number) > (row.x[k - 1] as number))) { p.push(`${at}.x: left to right`); break; }
    const { storey: _s, x: _x, except, by, ...look } = row;
    p.push(...lookProblems(look, at));
    if (except !== undefined) {
      if (!except || typeof except !== 'object') p.push(`${at}.except: an object`);
      else for (const [k, e] of Object.entries(except)) {
        if (!(Number.isInteger(Number(k)) && Array.isArray(row.x) && Number(k) >= 0 && Number(k) < row.x.length)) p.push(`${at}.except[${k}]: a bay index`);
        p.push(...lookProblems(e, `${at}.except[${k}]`));
      }
    }
    const methodOk = typeof by === 'string' ? METHODS.includes(by) : !!by && typeof by === 'object' && METHODS.includes((by as Record<string, unknown>).all as string) && Object.values(by).every(m => METHODS.includes(m as string));
    if (!methodOk) p.push(`${at}.by: pixel|eye or {all, <field>: pixel|eye}`);
    for (let b = 0; b < (Array.isArray(row.x) ? row.x.length : 0); b++) {
      const l = resolvedLook(g as unknown as OpeningGrid, row as unknown as OpeningRow, b);
      if (!l) p.push(`${at} bay ${b}: w, h and sill must be stated (row, exception or default)`);
    }
  }
  return p;
}

/** A valid grid, or null. */
export function openingGridOf(v: unknown): OpeningGrid | null {
  return v && !openingGridProblems(v).length ? v as OpeningGrid : null;
}

/** The look of bay `bay` of `row`: the grid default, the row, the bay's exception, in that order; null when w, h or sill is
 *  stated nowhere. */
export function resolvedLook(g: Pick<OpeningGrid, 'default'>, row: OpeningRow, bay: number): OpeningLook | null {
  const pick = <K extends keyof OpeningLook>(k: K): OpeningLook[K] | undefined => (row.except?.[String(bay)]?.[k] ?? row[k] ?? g.default?.[k]) as OpeningLook[K] | undefined;
  const w = pick('w'), h = pick('h'), sill = pick('sill');
  if (w === undefined || h === undefined || sill === undefined) return null;
  const out: OpeningLook = { w, h, sill };
  for (const k of ['head', 'panes', 'frame', 'sash', 'surround'] as const) { const v = pick(k); if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v; }
  return out;
}

/** The method a value of a row was measured by. */
export function methodOf(row: OpeningRow, field: 'x' | keyof OpeningLook): OpeningMethod {
  return typeof row.by === 'string' ? row.by : row.by[field] ?? row.by.all;
}

/** One pane, the default lights when a row states none. */
export const SINGLE_LIGHT: PaneLayout = { cols: 1, rows: 1 };

/**
 * The windows of `storey` in drawn metres: centres along the drawn front (`frontM`, as seen), z over the storey's drawn
 * floor, scaled from the photo by the drawn storey (`storeyM`) over the measured one. A window is held inside its storey
 * (its head at most 0.1 m under the next floor) and inside the front.
 */
/** How far (share) the drawn front may differ from the measured one and still take the grid stretched to it. */
export const OPENING_STRETCH = 0.15;
export function openingBoxes(g: OpeningGrid, storey: number, drawn: { frontM: number; storeyM: number }, stock?: StockTrim): OpeningBox[] {
  const row = g.rows.find(r => r.storey === storey), measured = g.storeyM[storey];
  if (!row || !(measured > 0) || !(drawn.frontM > 0) || !(drawn.storeyM > 0)) return [];
  // A drawn front within STRETCH of the photo's takes the grid stretched to it; one further off is a footprint run longer
  // than the photo's wall (Herengracht 70: a 6.38 m run, a 4.17 m wall), which the render frames from the run's start, so
  // the windows keep their metres from there.
  const fits = Math.abs(drawn.frontM / g.frontM - 1) <= OPENING_STRETCH;
  const kx = fits ? drawn.frontM / g.frontM : 1, kz = drawn.storeyM / measured, out: OpeningBox[] = [];
  row.x.forEach((share, bay) => {
    const l = resolvedLook(g, row, bay);
    if (!l) return;
    const x = share * g.frontM * kx, hw = Math.min(l.w * kx / 2, x, drawn.frontM - x);
    const z0 = Math.max(0, l.sill * kz), z1 = Math.min(drawn.storeyM - 0.1, (l.sill + l.h) * kz);
    if (!(hw > 0.1) || !(z1 - z0 > 0.2)) return;
    out.push({ storey, bay, x: +x.toFixed(4), hw: +hw.toFixed(4), z0: +z0.toFixed(4), z1: +z1.toFixed(4), head: l.head ?? 'flat', panes: l.panes ?? SINGLE_LIGHT, ...(l.frame ? { frame: l.frame } : {}), ...(l.sash ? { sash: l.sash } : {}), surround: l.surround ?? (stock ? { stock } : 'none') });
  });
  return out;
}

// ------------------------------------------------------------------------------------------------------------ joinery

/** The joinery's sizes (m) and its depth over the wall (the window drawn on a flat wall: glass a little proud of it, the
 *  frame and bars proud of the glass). */
// Belt windows 2: the frame 0.085 -> 0.12 m and the bars 0.035 -> 0.045 m (the stock cell's frame is 0.09 m with the era
// frame boards outside it; the lane's thinner ring read as a bare dark box at review scale).
export const JOINERY = { frame: 0.12, bar: 0.045, rail: 0.075, transom: 0.08, reveal: 0.04, revealOut: 0.006, glassOut: 0.012, frameOut: 0.028, surroundOut: 0.04, surround: 0.13, block: 0.32, arcSteps: 8 } as const;
/** The glass: the toplight a little paler (sky in it), the panes darker. */
export const OPENING_GLASS = { pane: '#2f3d47', light: '#4d606c', sky: '#4a5d6a' } as const;
/**
 * Belt windows 2: the glass behind dark joinery. Dark sashes (Herengracht 10, 16, 38, 64, 90) or dark frames (30, 48, 54,
 * 82, 88) on the dark glass drew plain dark boxes; in the photos that glass shows the sky, and the bars read dark on it.
 */
export const OPENING_GLASS_LIT = { pane: '#7d909c', light: '#a7b6bf', sky: '#97a8b3' } as const;
/** The reveal's shadow round the frame (the stock cell's 4 px band). */
export const OPENING_REVEAL = '#2a221c';
/** A paint dark enough that the glass behind it is drawn lit (relative luminance, 0-1). */
export function darkPaint(hex: string | undefined): boolean {
  if (!hex || !HEX.test(hex)) return false;
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] < 0.3;
}

/** A flat piece of joinery: a quad (x along the front, z up, in the window's frame of reference) at its depth. */
export interface JoineryPiece { pts: [[number, number], [number, number], [number, number], [number, number]]; out: number; hex: string }

/** The head's arc over [x0, x1] springing at z: its height at x (0 for a flat head). Segmental: a rise of a sixth of the
 *  width; round: a half circle. */
function arcRise(head: OpeningHead, w: number): number {
  return head === 'round' ? w / 2 : head === 'segmental' ? w / 6 : 0;
}
function arcAt(head: OpeningHead, x0: number, x1: number, x: number): number {
  const w = x1 - x0, r = arcRise(head, w);
  if (!r) return 0;
  const u = Math.max(-1, Math.min(1, (x - (x0 + x1) / 2) / (w / 2)));
  if (head === 'round') return r * Math.sqrt(1 - u * u);
  // A circular segment of rise r over chord w.
  const R = (w * w / 4 + r * r) / (2 * r), dx = u * w / 2;
  return Math.sqrt(Math.max(0, R * R - dx * dx)) - (R - r);
}

/**
 * One window's joinery as flat quads (x along the front, z up; the caller places them on its wall): the surround, the
 * glass (toplight paler), the frame ring, the transom and the bars. The head's arc is drawn in `arcSteps` slices.
 */
export function joineryPieces(b: Pick<OpeningBox, 'x' | 'hw' | 'z0' | 'z1' | 'head' | 'panes' | 'surround' | 'sash'>, frameHex: string, surroundHex: string): JoineryPiece[] {
  const sashHex = b.sash ?? frameHex, J = JOINERY, x0 = b.x - b.hw, x1 = b.x + b.hw, w = x1 - x0, out: JoineryPiece[] = [];
  const rise = Math.min(arcRise(b.head, w), (b.z1 - b.z0) * 0.6), spring = b.z1 - rise;
  const F = Math.min(J.frame, w * 0.13, (b.z1 - b.z0) * 0.09), B = Math.min(J.bar, F * 0.5);
  const G = darkPaint(sashHex) || darkPaint(frameHex) ? OPENING_GLASS_LIT : OPENING_GLASS;
  const quad = (a0: number, a1: number, z0: number, z1: number, o: number, hex: string) => { if (a1 - a0 > 1e-4 && z1 - z0 > 1e-4) out.push({ pts: [[a0, z0], [a1, z0], [a1, z1], [a0, z1]], out: o, hex }); };
  // An arched band between two outlines (outer and inner), in slices: [xa, xb] at heights top(x) and bottom(x).
  const arcBand = (a0: number, a1: number, top: (x: number) => number, bottom: (x: number) => number, o: number, hex: string) => {
    const n = rise > 0 ? J.arcSteps : 1;
    for (let i = 0; i < n; i++) {
      const p = a0 + (a1 - a0) * i / n, q = a0 + (a1 - a0) * (i + 1) / n;
      out.push({ pts: [[p, bottom(p)], [q, bottom(q)], [q, top(q)], [p, top(p)]], out: o, hex });
    }
  };
  const outerTop = (x: number) => spring + (rise > 0 ? arcAt(b.head, x0, x1, x) : 0);
  // The surround: a flat band round the frame (full-frame: all round; a sill: under it only; a stone lintel: over it).
  const S = J.surround;
  // The reveal's shadow round the frame (the stock cell's dark band), under every other piece.
  arcBand(x0 - J.reveal, x1 + J.reveal, x => (rise > 0 ? spring + arcAt(b.head, x0 - J.reveal, x1 + J.reveal, x) : b.z1) + J.reveal, () => b.z0 - J.reveal, J.revealOut, OPENING_REVEAL);
  if (typeof b.surround === 'object') {
    // The stock kit's dressing (bayTextures.ts windowAt, 100 px a metre): a stone lintel 6 cm over the head (26 cm tall,
    // 12 cm past each jamb; restrained 8 cm and 4 cm), a stone sill under the frame, pale blocks beside the jambs.
    const t = b.surround.stock, r = t.restrained, stone = STOCK_STONE;
    if (t.blocks) {
      const bw = r ? 0.1 : 0.18, bh = r ? 0.12 : 0.18, step = r ? 0.7 : 0.42;
      for (let z = b.z0 + 0.08; z + bh <= spring; z += step) { quad(x0 - bw - J.reveal, x0 - J.reveal, z, z + bh, J.surroundOut, '#eee9de'); quad(x1 + J.reveal, x1 + J.reveal + bw, z, z + bh, J.surroundOut, '#eee9de'); }
    }
    if (t.lintel !== 'none') {
      const ov = r ? 0.04 : 0.12, lh = r ? 0.08 : 0.26;
      if (t.lintel === 'arch' || rise > 0) arcBand(x0 - ov, x1 + ov, x => spring + Math.max(rise, w / 6) * Math.sqrt(Math.max(0, 1 - ((x - b.x) / (b.hw + ov)) ** 2)) + J.reveal + lh * 0.5, x => spring + Math.max(rise, w / 6) * Math.sqrt(Math.max(0, 1 - ((x - b.x) / (b.hw + ov)) ** 2)) + J.reveal, J.surroundOut, stone);
      else {
        quad(x0 - ov, x1 + ov, b.z1 + 0.06, b.z1 + 0.06 + lh, J.surroundOut, stone);
        // The soldier course's joints (the cell's dark strokes every 10 cm).
        if (!r) for (let x = x0 - ov + 0.1; x < x1 + ov - 0.02; x += 0.1) quad(x - 0.01, x + 0.01, b.z1 + 0.06, b.z1 + 0.06 + lh, J.surroundOut + 0.002, '#7a6150');
      }
      quad(x0 - (r ? 0.04 : 0.1), x1 + (r ? 0.04 : 0.1), b.z0 - (r ? 0.07 : 0.14), b.z0 - 0.02, J.surroundOut, stone);
    }
  }
  if (b.surround === 'keystone' || b.surround === 'jack-blocks') {
    // A stone head over the frame and a sill; keystone: a raised block at its middle; jack-blocks: the head's ends as
    // blocks dropping past it, and short blocks up the jambs.
    const top = rise > 0 ? b.z1 : b.z1 + S * 1.4;
    if (rise > 0) arcBand(x0 - S, x1 + S, x => spring + arcAt(b.head, x0 - S, x1 + S, x) + S, x => outerTop(Math.min(x1, Math.max(x0, x))), J.surroundOut, surroundHex);
    else quad(x0 - S, x1 + S, b.z1, top, J.surroundOut, surroundHex);
    quad(x0 - S, x1 + S, b.z0 - S * 0.6, b.z0, J.surroundOut, surroundHex);
    if (b.surround === 'keystone') { const kw = Math.min(0.22, w * 0.18); quad(b.x - kw / 2, b.x + kw / 2, b.z1 - S * 0.5, top + S * 0.6 + (rise > 0 ? S : 0), J.surroundOut + 0.02, surroundHex); }
    else for (const [a, c] of [[x0 - S * 1.8, x0], [x1, x1 + S * 1.8]] as const) { quad(a, c, spring - S * 1.6, spring, J.surroundOut, surroundHex); quad(a, c, b.z0, b.z0 + S * 1.3, J.surroundOut, surroundHex); }
  }
  if (b.surround === 'block-dressings') {
    // Stone blocks up each jamb, long and short in turn (Herengracht 58's white dressings in grey brick).
    const n = Math.max(2, Math.round((spring - b.z0) / J.block)), h = (spring - b.z0) / n;
    for (let i = 0; i < n; i++) {
      const d = i % 2 ? S : S * 1.9, z0 = b.z0 + i * h + 0.02, z1 = b.z0 + (i + 1) * h - 0.02;
      quad(x0 - d, x0, z0, z1, J.surroundOut, surroundHex); quad(x1, x1 + d, z0, z1, J.surroundOut, surroundHex);
    }
  }
  if (b.surround === 'full-frame' || b.surround === 'block-dressings') {
    // Belt windows 2: a full frame stands a reveal's shadow off the window frame, so a white surround round a white frame
    // still reads as two members (54's and 70's moulded surrounds drew as one fat frame).
    const g = b.surround === 'full-frame' ? 0.03 : 0;
    if (b.surround === 'full-frame') { quad(x0 - S - g, x0 - g, b.z0 - S * 0.6, spring + g, J.surroundOut, surroundHex); quad(x1 + g, x1 + S + g, b.z0 - S * 0.6, spring + g, J.surroundOut, surroundHex); }
    arcBand(x0 - S - g, x1 + S + g, x => (rise > 0 ? spring + arcAt(b.head, x0 - S - g, x1 + S + g, x) : b.z1) + S + g, x => rise > 0 ? Math.max(spring, outerTop(Math.min(x1, Math.max(x0, x)))) + g : b.z1 + g, J.surroundOut, surroundHex);
  }
  if (b.surround === 'full-frame' || b.surround === 'sill' || b.surround === 'block-dressings') quad(x0 - S, x1 + S, b.z0 - S * 0.6, b.z0, J.surroundOut, surroundHex);
  // A full frame's head: a moulded cap over it, proud of the architrave (Herengracht 54, 72: the surrounds' cornices; the
  // lane's flat band read as a bare frame).
  if (b.surround === 'full-frame') {
    const capZ = (rise > 0 ? b.z1 : b.z1 + S) + 0.03, cx0 = x0 - S - 0.1, cx1 = x1 + S + 0.1;
    quad(cx0, cx1, capZ, capZ + 0.07, J.surroundOut + 0.03, surroundHex);
    quad(cx0 - 0.04, cx1 + 0.04, capZ + 0.07, capZ + 0.15, J.surroundOut + 0.05, surroundHex);
  }
  if (b.surround === 'stone-lintel' && !rise) quad(x0 - S, x1 + S, b.z1, b.z1 + S * 1.4, J.surroundOut, surroundHex);
  // The glass inside the frame: the toplight (over the transom) paler.
  const gx0 = x0 + F, gx1 = x1 - F, gz0 = b.z0 + F, glassTop = (x: number) => outerTop(x) - F;
  const gSpring = spring - F, glassH = gSpring - gz0 + (rise > 0 ? rise : 0);
  const t = b.panes.transom, zt = t ? gSpring + (rise > 0 ? rise : 0) - glassH * t : undefined;
  // The panes: the sky's band over their upper part (the stock cell's gradient), the toplight paler still.
  const panes = (z0: number, z1: number) => { const zs = z0 + (z1 - z0) * 0.55; quad(gx0, gx1, z0, zs, J.glassOut, G.pane); quad(gx0, gx1, zs, z1, J.glassOut, G.sky); };
  if (zt !== undefined && zt < gSpring) {
    panes(gz0, zt);
    quad(gx0, gx1, zt, gSpring, J.glassOut, G.light);
    if (rise > 0) arcBand(gx0, gx1, glassTop, () => gSpring, J.glassOut, G.light);
  } else {
    panes(gz0, gSpring);
    if (rise > 0) arcBand(gx0, gx1, glassTop, () => gSpring, J.glassOut, zt !== undefined ? G.light : G.sky);
  }
  // The frame ring: sill rail, jambs, head (arched where the head is).
  quad(x0, x1, b.z0, gz0, J.frameOut, frameHex);
  quad(x0, gx0, gz0, gSpring, J.frameOut, frameHex);
  quad(gx1, x1, gz0, gSpring, J.frameOut, frameHex);
  if (rise > 0) arcBand(x0, x1, outerTop, glassTop, J.frameOut, frameHex);
  else quad(x0, x1, gSpring, b.z1, J.frameOut, frameHex);
  // Sashes painted apart from the casing: their own thin ring inside it.
  if (b.sash && b.sash !== frameHex) {
    quad(gx0, gx1, gz0, gz0 + B, J.frameOut, sashHex); quad(gx0, gx0 + B, gz0, gSpring, J.frameOut, sashHex); quad(gx1 - B, gx1, gz0, gSpring, J.frameOut, sashHex);
    if (!rise) quad(gx0, gx1, gSpring - B, gSpring, J.frameOut, sashHex);
  }
  // The transom and the toplight's mullions.
  const lowTop = zt !== undefined && zt < gSpring ? zt - J.transom / 2 : gSpring;
  if (zt !== undefined && zt < gSpring) {
    quad(gx0, gx1, zt - J.transom / 2, zt + J.transom / 2, J.frameOut, sashHex);
    const tc = b.panes.topCols ?? b.panes.cols;
    for (let i = 1; i < tc; i++) { const x = gx0 + (gx1 - gx0) * i / tc; quad(x - B, x + B, zt + J.transom / 2, rise > 0 ? glassTop(x) : gSpring, J.frameOut, sashHex); }
  }
  // The lights under the transom (or the whole glass): mullions between columns (a casement's meeting stiles broad), rails
  // between rows (a sash's meeting rail broad on a two-row light).
  const { cols, rows } = b.panes, top = (x: number) => zt !== undefined && zt < gSpring ? lowTop : rise > 0 ? glassTop(x) : gSpring;
  for (let i = 1; i < cols; i++) { const x = gx0 + (gx1 - gx0) * i / cols, half = cols === 2 ? J.rail / 2 : B; quad(x - half, x + half, gz0, top(x), J.frameOut, sashHex); }
  const h = lowTop - gz0;
  for (let j = 1; j < rows; j++) { const z = gz0 + h * j / rows, half = rows === 2 && zt === undefined ? J.rail / 2 : B; quad(gx0, gx1, z - half, z + half, J.frameOut, sashHex); }
  return out;
}
