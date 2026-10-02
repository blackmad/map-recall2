// Facade cells for the three.js building layer (spike, 2026-10-02).
//
// A cell is one bay wide and one storey tall, painted at a fixed 256 x 256
// pixels whatever its metres, so every cell of every style can sit in one
// texture array and be sampled with REPEAT wrapping, mipmaps and anisotropy.
// The wall layout (`facadeLayout.ts`) chooses a whole number of bays per wall
// and a whole number of storeys per building, then stretches a cell by under
// ~15% to fit; the painter works in metres so a brick is a brick at any style.
//
// Three cell kinds per style:
//   upper  – a normal storey, repeated up the wall
//   ground – the street floor beside the door
//   door   – the street floor with the front door in it (one bay, not repeated)
//
// RGBA convention: rgb is the final colour for fixed materials (frames, glass,
// stone, doors). For *tintable* wall (brick, render, concrete) rgb is a
// luminance texture near 1.0 and alpha is the tint weight: the shader computes
// `rgb * mix(1, tint, alpha)`. So one cell serves every wall colour, mortar
// stays pale (low alpha), and a white frame stays white on a red wall.
// Everything is pure and deterministic, so it runs in Node tests.

import { FACADE_STYLES, type FacadeStyle } from './genericFacades.js';

export const CELL_PX = 256;
export type CellKind = 'upper' | 'ground' | 'door' | 'plain' | 'shop';
/** `plain` is bare wall (no openings): gable faces and blind ends. */
export const CELL_KINDS: readonly CellKind[] = ['upper', 'ground', 'door', 'plain', 'shop'];
/** Two looks per style (bond, shutters, window heads), picked per building so a street is not one cell. */
export const CELL_VARIANTS = 2;

/** Texture-array layer for a style, variant and cell kind. */
export const cellLayer = (style: FacadeStyle, kind: CellKind, variant = 0): number =>
  (FACADE_STYLES.indexOf(style) * CELL_VARIANTS + (variant % CELL_VARIANTS)) * CELL_KINDS.length + CELL_KINDS.indexOf(kind);
export const CELL_LAYER_COUNT = FACADE_STYLES.length * CELL_VARIANTS * CELL_KINDS.length;

/** Nominal bay width and heights in metres, plus how often a door recurs. */
export type StyleDims = { bay: number; ground: number; storey: number; doorEvery: number };
export const STYLE_DIMS: Record<FacadeStyle, StyleDims> = {
  // 17th/18th-century canal house: two sash windows a floor, one door to the side.
  canal: { bay: 5.0, ground: 3.3, storey: 3.1, doorEvery: 4 },
  // 1860-1914 (Jordaan, Pijp, Oud-West): one tall arched window per bay.
  c19: { bay: 4.4, ground: 3.6, storey: 3.0, doorEvery: 4 },
  // Amsterdam School 1910-1935: ribbon windows between brick piers.
  school: { bay: 4.8, ground: 3.0, storey: 3.0, doorEvery: 3 },
  // 1945-1985 strokenbouw: ribbon windows over white spandrels, balcony slabs.
  postwar: { bay: 3.6, ground: 2.9, storey: 2.85, doorEvery: 4 },
  modern: { bay: 4.2, ground: 3.8, storey: 3.0, doorEvery: 4 },
  tower: { bay: 3.0, ground: 3.2, storey: 3.2, doorEvery: 6 },
};

type Rgb = [number, number, number];
const hex = (value: string): Rgb => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) as Rgb;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
const scaleRgb = (a: Rgb, k: number): Rgb => a.map(v => Math.max(0, Math.min(255, Math.round(v * k)))) as Rgb;

function hash2(a: number, b: number, seed: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A cell under construction. Coordinates are metres from the bottom-left. */
class Cell {
  readonly data = new Uint8ClampedArray(CELL_PX * CELL_PX * 4);
  readonly kx: number; readonly ky: number;
  constructor(readonly w: number, readonly h: number) { this.kx = CELL_PX / w; this.ky = CELL_PX / h; }

  /** Write one pixel. Row 0 is the bottom of the wall (v = 0). */
  put(px: number, py: number, rgb: Rgb, alpha: number) {
    if (px < 0 || py < 0 || px >= CELL_PX || py >= CELL_PX) return;
    const i = (py * CELL_PX + px) * 4;
    this.data[i] = rgb[0]; this.data[i + 1] = rgb[1]; this.data[i + 2] = rgb[2]; this.data[i + 3] = alpha;
  }

  /** Fixed-colour rectangle (alpha 0: the tint does not touch it). */
  rect(x: number, y: number, w: number, h: number, rgb: Rgb, alpha = 0) {
    const x0 = Math.round(x * this.kx), x1 = Math.max(x0 + 1, Math.round((x + w) * this.kx));
    const y0 = Math.round(y * this.ky), y1 = Math.max(y0 + 1, Math.round((y + h) * this.ky));
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) this.put(px, py, rgb, alpha);
  }

  /** Fixed-colour fill of an arbitrary region, testing each pixel centre. */
  fill(x: number, y: number, w: number, h: number, inside: (mx: number, my: number) => Rgb | null, alpha = 0) {
    const x0 = Math.max(0, Math.floor(x * this.kx)), x1 = Math.min(CELL_PX, Math.ceil((x + w) * this.kx));
    const y0 = Math.max(0, Math.floor(y * this.ky)), y1 = Math.min(CELL_PX, Math.ceil((y + h) * this.ky));
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const colour = inside((px + 0.5) / this.kx, (py + 0.5) / this.ky);
      if (colour) this.put(px, py, colour, alpha);
    }
  }

  /** Read a pixel's rgb back (for shading on top of what is there). */
  rgbAt(px: number, py: number): Rgb { const i = (py * CELL_PX + px) * 4; return [this.data[i], this.data[i + 1], this.data[i + 2]]; }
}

// -- Materials ---------------------------------------------------------------

/**
 * Brick in stretcher bond, as luminance + tint weight. Course and brick sizes
 * are adjusted to divide the cell exactly so the cell tiles in both axes.
 * Each brick gets its own brightness (hand-moulded Dutch brick varies a lot),
 * with the odd dark clinker, and the bed joints are pale mortar.
 */
function paintBrick(cell: Cell, seed: number, opts: { y0?: number; y1?: number; contrast?: number; courseM?: number; brickM?: number; flemish?: boolean } = {}) {
  const courses = Math.max(1, Math.round(cell.h / (opts.courseM ?? 0.075)));
  const perCourse = Math.max(2, Math.round(cell.w / (opts.brickM ?? 0.21)));
  const courseH = cell.h / courses, brickL = cell.w / perCourse;
  const contrast = opts.contrast ?? 1;
  const jointH = 0.011, jointW = 0.011;
  const y0 = Math.floor((opts.y0 ?? 0) * cell.ky), y1 = Math.min(CELL_PX, Math.ceil((opts.y1 ?? cell.h) * cell.ky));
  for (let py = y0; py < y1; py++) for (let px = 0; px < CELL_PX; px++) {
    // 3 x 3 samples per pixel so a 4 px course keeps a soft mortar line.
    let lum = 0, mortar = 0;
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
      const mx = (px + (sx + 0.5) / 3) / cell.kx, my = (py + (sy + 0.5) / 3) / cell.ky;
      const course = Math.floor(my / courseH);
      const inBed = my - course * courseH < jointH;
      let brick: number, inHead: boolean, header = false;
      if (opts.flemish) {
        // Flemish bond: stretcher, header, stretcher, header, shifted half a unit each course.
        const unit = cell.w / Math.max(2, Math.round(cell.w / (brickL * 1.5)));
        const shifted = ((course % 2 ? mx + unit / 2 : mx) % cell.w + cell.w) % cell.w;
        const u = Math.floor(shifted / unit), within = shifted - u * unit;
        const stretcher = unit * 0.68;
        header = within >= stretcher;
        const start = header ? stretcher : 0;
        brick = u * 2 + (header ? 1 : 0);
        inHead = within - start < jointW;
      } else {
        const shifted = (course % 2 ? mx + brickL / 2 : mx) % cell.w;
        brick = Math.floor(shifted / brickL);
        inHead = shifted - brick * brickL < jointW;
      }
      if (inBed || inHead) { mortar++; lum += 0.95; continue; }
      const r = hash2(brick + (course % 2 ? 7 : 0), course, seed);
      // Dutch headers are often glazed dark; the odd clinker brick too.
      const dark = (header ? 0.84 : 1) * (r < 0.04 ? 0.78 : 1);
      lum += (0.88 + (r - 0.5) * 0.22 * contrast + (hash2(course, 91, seed) - 0.5) * 0.04) * dark;
    }
    const lumean = Math.min(1, lum / 9);
    // Mortar weight: 1 for brick, falling to 0.25 as mortar fills the pixel.
    const alpha = 255 * (1 - 0.75 * (mortar / 9));
    const v = Math.round(lumean * 255);
    cell.put(px, py, [v, v, v], Math.round(alpha));
  }
}

/** Render / concrete: near-flat luminance with faint mottling, optional joints. */
function paintRender(cell: Cell, seed: number, panelM = 0, y0 = 0, y1 = cell.h) {
  const row0 = Math.floor(y0 * cell.ky), row1 = Math.min(CELL_PX, Math.ceil(y1 * cell.ky));
  for (let py = row0; py < row1; py++) for (let px = 0; px < CELL_PX; px++) {
    const n = (hash2(px >> 2, py >> 2, seed) - 0.5) * 0.07 + (hash2(px >> 4, py >> 4, seed + 1) - 0.5) * 0.06;
    let v = 0.94 + n;
    if (panelM > 0) {
      const mx = px / cell.kx, my = py / cell.ky;
      const jx = mx % panelM, jy = my % panelM;
      if (jx < 0.02 || jy < 0.02) v -= 0.14;
    }
    const g = Math.round(Math.min(1, v) * 255);
    cell.put(px, py, [g, g, g], 255);
  }
}

/** Dressed stone (plinth, sills, banding): fixed colour with ashlar joints. */
function paintStone(cell: Cell, x: number, y: number, w: number, h: number, base: Rgb, seed: number, blockW = 0.62, blockH = 0.3) {
  const rows = Math.max(1, Math.round(h / blockH)), rowH = h / rows;
  cell.fill(x, y, w, h, (mx, my) => {
    const row = Math.floor((my - y) / rowH);
    const cols = Math.max(1, Math.round(w / blockW)), bw = w / cols;
    const off = row % 2 ? bw / 2 : 0;
    const local = (mx - x + off) % w;
    const col = Math.floor(local / bw);
    const joint = (my - y) - row * rowH < 0.014 || local - col * bw < 0.014;
    const r = hash2(col, row, seed);
    return joint ? scaleRgb(base, 0.74) : scaleRgb(base, 0.94 + r * 0.1);
  });
}

// -- Openings ----------------------------------------------------------------

const GLASS_TOP = hex('#7d93a0'), GLASS_BOTTOM = hex('#1f2a33');

/** Window glass: dark with a soft sky gradient so panes read as glass, not holes. */
function paintGlass(cell: Cell, x: number, y: number, w: number, h: number, seed: number, arch = false) {
  const tone = 0.85 + hash2(Math.round(x * 100), Math.round(y * 100), seed) * 0.3;
  cell.fill(x, y, w, h, (mx, my) => {
    if (arch) {
      const rise = w / 2, cy = y + h - rise;
      if (my > cy && Math.hypot(mx - (x + w / 2), my - cy) > w / 2) return null;
    }
    const t = Math.max(0, Math.min(1, (my - y) / h));
    const diagonal = Math.max(0, 1 - Math.abs(((mx - x) / w) - ((my - y) / h) * 0.6 - 0.35) * 4) * 0.12;
    return scaleRgb(mixRgb(GLASS_BOTTOM, GLASS_TOP, t * t * 0.7 + diagonal), tone);
  });
}

type SashOptions = { cols: number; rows: number; frame: Rgb; bar?: number; arch?: boolean; shutters?: Rgb | null; shutterStripe?: boolean; sill?: Rgb | null; lintel?: Rgb | null; seed: number; reveal?: number };

/**
 * A sash or casement window: frame, glazing bars, glass, plus optional stone
 * sill, lintel and shutters. (x, y) is the bottom-left of the *glass opening*.
 */
function paintWindow(cell: Cell, x: number, y: number, w: number, h: number, o: SashOptions) {
  const f = 0.07, bar = o.bar ?? 0.035, reveal = o.reveal ?? 0.05;
  if (o.shutters) {
    const sw = Math.min(0.5, w * 0.48);
    for (const sx of [x - f - sw, x + w + f]) {
      cell.rect(sx, y - f, sw, h + 2 * f, o.shutters);
      // Amsterdam's red-and-white luiken: a white band down the middle.
      if (o.shutterStripe) cell.rect(sx + sw * 0.35, y - f, sw * 0.3, h + 2 * f, hex('#ece8dd'));
      // Louvres: darker slats every 7 cm.
      for (let sy = y - f + 0.05; sy < y + h + f - 0.04; sy += 0.075) cell.rect(sx + 0.03, sy, sw - 0.06, 0.02, scaleRgb(o.shutters, 0.72));
    }
  }
  if (o.lintel) cell.rect(x - f - 0.1, y + h + f, w + 2 * f + 0.2, 0.17, o.lintel);
  if (o.sill) cell.rect(x - f - 0.1, y - f - 0.07, w + 2 * f + 0.2, 0.07, o.sill);
  // Frame is the whole opening; glass sits inside it.
  if (o.arch) {
    const rise = (w + 2 * f) / 2, cy = y + h - rise + f;
    cell.fill(x - f, y - f, w + 2 * f, h + 2 * f, (mx, my) => (my > cy && Math.hypot(mx - (x + w / 2), my - cy) > rise ? null : o.frame));
  } else cell.rect(x - f, y - f, w + 2 * f, h + 2 * f, o.frame);
  paintGlass(cell, x, y, w, h, o.seed, o.arch);
  // Reveal shadow: a dark line down the left and along the top inside the frame.
  cell.rect(x, y, reveal * 0.6, h - (o.arch ? w / 2 : 0), scaleRgb(GLASS_BOTTOM, 0.55));
  if (!o.arch) cell.rect(x, y + h - reveal * 0.6, w, reveal * 0.6, scaleRgb(GLASS_BOTTOM, 0.55));
  for (let c = 1; c < o.cols; c++) cell.rect(x + (w * c) / o.cols - bar / 2, y, bar, h, o.frame);
  for (let r = 1; r < o.rows; r++) cell.rect(x, y + (h * r) / o.rows - bar / 2, w, bar, o.frame);
}

type DoorOptions = { x: number; w: number; h: number; colour: Rgb; frame: Rgb; fanlight?: boolean; glass?: boolean; seed: number; steps?: Rgb | null };

/** A front door: leaf with raised panels, stone/painted surround, optional fanlight and steps. */
function paintDoor(cell: Cell, o: DoorOptions) {
  const f = 0.1, base = o.steps ? 0.36 : 0;
  if (o.steps) {
    // Two stone steps projecting under the door.
    cell.rect(o.x - 0.3, 0, o.w + 0.6, base * 0.5, o.steps);
    cell.rect(o.x - 0.12, base * 0.5, o.w + 0.24, base * 0.5, scaleRgb(o.steps, 1.06));
  }
  const top = base + o.h;
  cell.rect(o.x - f, base, o.w + 2 * f, o.h + f, o.frame);
  cell.rect(o.x, base, o.w, o.h, o.colour);
  if (o.glass) {
    paintGlass(cell, o.x + 0.12, base + 0.35, o.w - 0.24, o.h - 0.5, o.seed);
  } else {
    // Raised panels: a lighter top edge and darker bottom edge on two rectangles.
    for (const [py, ph] of [[base + 0.2, o.h * 0.38], [base + 0.2 + o.h * 0.44, o.h * 0.3]] as const) {
      cell.rect(o.x + 0.12, py, o.w - 0.24, ph, scaleRgb(o.colour, 0.82));
      cell.rect(o.x + 0.14, py + ph - 0.03, o.w - 0.28, 0.03, scaleRgb(o.colour, 1.25));
    }
  }
  // Brass letter-box and handle.
  cell.rect(o.x + o.w * 0.2, base + o.h * 0.5, o.w * 0.35, 0.05, hex('#b99a4a'));
  cell.rect(o.x + o.w - 0.2, base + o.h * 0.46, 0.07, 0.07, hex('#b99a4a'));
  if (o.fanlight) {
    // Semicircular fanlight above the transom, with radiating bars.
    const r = (o.w + 2 * f) / 2, cx = o.x + o.w / 2, cy = top + 0.06;
    cell.rect(o.x - f, top, o.w + 2 * f, 0.07, o.frame);
    cell.fill(o.x - f, cy, o.w + 2 * f, r, (mx, my) => {
      const d = Math.hypot(mx - cx, my - cy);
      if (d > r || my < cy) return null;
      if (d > r - 0.07) return o.frame;
      const a = Math.atan2(my - cy, mx - cx);
      const bars = Math.abs(((a * 4 / Math.PI) % 1) - 0.5) > 0.46 || d < 0.1;
      return bars ? o.frame : scaleRgb(mixRgb(GLASS_BOTTOM, GLASS_TOP, 0.4), 1);
    });
  }
}

/**
 * A shopfront across a whole ground-floor bay. Two looks: a striped awning over
 * one big window, and a dark fascia sign over a window with a wood stall riser.
 */
function paintShopfront(cell: Cell, W: number, H: number, dark: boolean) {
  const frame = hex('#ece8dd'), wood = hex('#3f2c22');
  cell.rect(0, 0, W, 0.4, scaleRgb(STONE, 0.9));
  const x0 = 0.3, x1 = W - 0.3;
  if (!dark) {
    cell.rect(x0 - 0.08, 0.55, x1 - x0 + 0.16, 2.0, frame);
    paintGlass(cell, x0, 0.62, x1 - x0, 1.86, 9);
    cell.rect(x0 + (x1 - x0) / 2 - 0.03, 0.62, 0.06, 1.86, frame);
    // Striped awning, slightly proud of the wall: red and cream.
    const stripes = Math.max(6, Math.round(W / 0.34)), sw = (x1 - x0 + 0.3) / stripes;
    for (let i = 0; i < stripes; i++) cell.rect(x0 - 0.15 + i * sw, 2.55, sw, 0.5, i % 2 ? hex('#efe9da') : hex('#a83a32'));
    cell.rect(x0 - 0.15, 2.5, x1 - x0 + 0.3, 0.06, scaleRgb(hex('#a83a32'), 0.6));
  } else {
    cell.rect(0.15, H - 0.95, W - 0.3, 0.6, hex('#2f4a3a'));
    for (let i = 0; i < 7; i++) cell.rect(0.55 + i * ((W - 1.1) / 7), H - 0.78, (W - 1.1) / 7 - 0.1, 0.26, hex('#e9e1c9'));
    cell.rect(x0 - 0.08, 0.55, x1 - x0 + 0.16, H - 1.7, frame);
    cell.rect(x0, 0.55, x1 - x0, 0.55, wood);
    paintGlass(cell, x0, 1.14, x1 - x0, H - 2.4, 9);
    for (const f of [1 / 3, 2 / 3]) cell.rect(x0 + (x1 - x0) * f - 0.03, 1.14, 0.06, H - 2.4, frame);
  }
}

/** Street-level weathering: wall luminance falls ~12% over the bottom 0.7 m (splash, grime), ground cells only. */
function grime(cell: Cell, kind: CellKind): Uint8ClampedArray {
  if (kind === 'upper') return cell.data;
  const rows = Math.round(0.7 * cell.ky);
  for (let py = 0; py < rows; py++) {
    const k = 0.88 + 0.12 * (py / rows);
    for (let px = 0; px < CELL_PX; px++) {
      const i = (py * CELL_PX + px) * 4;
      if (cell.data[i + 3] < 128) continue;
      cell.data[i] *= k; cell.data[i + 1] *= k; cell.data[i + 2] *= k;
    }
  }
  return cell.data;
}

// -- Styles ------------------------------------------------------------------

const STONE = hex('#b8ad98'), STONE_LIGHT = hex('#cfc6b4'), WHITE = hex('#ece8dd'), CREAM = hex('#e2d9c2');
const DOOR_COLOURS = [hex('#2c4a3d'), hex('#3a2a22'), hex('#1f3b57'), hex('#5a2a24')];
const SHUTTER_COLOURS = [hex('#2f4a3a'), hex('#7a2f27'), hex('#27384f')];

/**
 * Paint one cell. `seed` varies the brick pattern per style so two adjacent
 * styles never share a mortar grid; the door and shutter colours are fixed per
 * style (variety between houses comes from the wall tint and the layout).
 */
export function paintCell(style: FacadeStyle, kind: CellKind, variant = 0): Uint8ClampedArray {
  const dims = STYLE_DIMS[style];
  const height = kind === 'upper' ? dims.storey : dims.ground;
  const cell = new Cell(dims.bay, height);
  const v1 = variant % CELL_VARIANTS === 1;
  const seed = FACADE_STYLES.indexOf(style) * 31 + CELL_KINDS.indexOf(kind) * 7 + 5 + (v1 ? 101 : 0);
  const doorColour = DOOR_COLOURS[(FACADE_STYLES.indexOf(style) + (v1 ? 2 : 0)) % DOOR_COLOURS.length];
  const shutter = v1 ? hex('#8a2e28') : SHUTTER_COLOURS[0];
  const W = dims.bay;

  if (kind === 'shop') {
    if (style === 'canal' || style === 'c19' || style === 'school') paintBrick(cell, seed);
    else paintRender(cell, seed, style === 'tower' ? 0.75 : 0.6);
    paintShopfront(cell, W, height, v1);
    return grime(cell, 'ground');
  }

  if (kind === 'plain') {
    if (style === 'canal' || style === 'c19' || style === 'school') paintBrick(cell, seed, { flemish: style === 'canal' && v1 });
    else paintRender(cell, seed, style === 'tower' ? 0.75 : 0.6);
    return cell.data;
  }

  if (style === 'canal') {
    paintBrick(cell, seed, { flemish: v1 });
    const cols = [W * 0.3, W * 0.7];
    if (kind === 'upper') {
      // Sash windows on the bay's 30% / 70% axes; stone sill and lintel.
      for (const cx of cols) paintWindow(cell, cx - 0.55, 0.42, 1.1, 2.05, { cols: 2, rows: 3, frame: WHITE, sill: STONE_LIGHT, lintel: STONE_LIGHT, seed });
    } else {
      paintStone(cell, 0, 0, W, 0.62, STONE, seed);
      cell.rect(0, 0.62, W, 0.05, STONE_LIGHT);
      if (kind === 'ground') {
        for (const cx of cols) paintWindow(cell, cx - 0.5, 0.95, 1.0, 1.9, { cols: 2, rows: 3, frame: WHITE, sill: STONE_LIGHT, lintel: STONE_LIGHT, shutters: shutter, shutterStripe: v1, seed });
      } else {
        // The door stands under the left window column, so the axes run unbroken from street to eaves.
        paintDoor(cell, { x: cols[0] - 0.56, w: 1.12, h: 2.35, colour: doorColour, frame: WHITE, fanlight: true, steps: STONE, seed });
        paintWindow(cell, cols[1] - 0.5, 0.95, 1.0, 1.9, { cols: 2, rows: 3, frame: WHITE, sill: STONE_LIGHT, lintel: STONE_LIGHT, seed: seed + 3 });
      }
    }
    return grime(cell, kind);
  }

  if (style === 'c19') {
    paintBrick(cell, seed, { contrast: 0.8, flemish: false });
    // A stucco cornice line at the top of every storey.
    const ww = 1.35;
    if (kind === 'upper') {
      cell.rect(0, height - 0.16, W, 0.16, CREAM);
      cell.rect(0, height - 0.19, W, 0.03, scaleRgb(CREAM, 0.8));
      paintWindow(cell, W / 2 - ww / 2, 0.6, ww, 1.85, { cols: 2, rows: 2, frame: WHITE, sill: STONE_LIGHT, lintel: v1 ? null : STONE_LIGHT, arch: v1, seed });
    } else {
      // Rusticated plaster plinth with deep joints.
      cell.rect(0, 0, W, 1.15, CREAM);
      for (let y = 0.22; y < 1.15; y += 0.22) cell.rect(0, y, W, 0.03, scaleRgb(CREAM, 0.78));
      cell.rect(0, 1.15, W, 0.07, scaleRgb(CREAM, 0.88));
      cell.rect(0, height - 0.18, W, 0.18, CREAM);
      if (kind === 'ground') paintWindow(cell, W / 2 - 0.7, 1.3, 1.4, 1.85, { cols: 2, rows: 2, frame: WHITE, sill: STONE_LIGHT, lintel: v1 ? null : STONE_LIGHT, arch: v1, shutters: null, seed });
      else paintDoor(cell, { x: W / 2 - 0.6, w: 1.2, h: 2.3, colour: DOOR_COLOURS[1], frame: WHITE, fanlight: false, steps: STONE, seed });
    }
    return grime(cell, kind);
  }

  if (style === 'school') {
    paintBrick(cell, seed, { contrast: 1.15, courseM: 0.07 });
    // Dark brick piers at the bay edges and a pale sill band: the School's banding.
    const pier = 0.34;
    cell.rect(0, 0, pier, height, scaleRgb(WHITE, 0.4), 255);
    cell.rect(W - pier, 0, pier, height, scaleRgb(WHITE, 0.4), 255);
    if (kind === 'upper') {
      cell.rect(pier, 0.82, W - 2 * pier, 0.1, STONE_LIGHT);
      paintWindow(cell, pier + 0.3, 0.95, W - 2 * pier - 0.6, 1.35, { cols: 3, rows: 2, frame: hex('#4a3a2e'), sill: null, lintel: null, seed });
    } else {
      cell.rect(pier, 0, W - 2 * pier, 0.5, scaleRgb(hex('#9b8f7d'), 1));
      if (kind === 'ground') paintWindow(cell, pier + 0.3, 0.95, W - 2 * pier - 0.6, 1.4, { cols: 3, rows: 2, frame: hex('#4a3a2e'), lintel: null, seed });
      else paintDoor(cell, { x: W / 2 - 0.55, w: 1.1, h: 2.2, colour: hex('#4a2f24'), frame: hex('#4a3a2e'), glass: false, steps: STONE, seed });
    }
    return grime(cell, kind);
  }

  if (style === 'postwar') {
    paintRender(cell, seed, 0);
    const band = hex('#bab6ac');
    if (kind === 'upper') {
      // Balcony slab at the storey's foot, white spandrel under a ribbon window.
      cell.rect(0, 0, W, 0.2, band);
      cell.rect(0.2, 0.2, W - 0.4, 0.7, hex('#e6e4dc'));
      paintWindow(cell, 0.3, 0.95, W - 0.6, 1.4, { cols: 2, rows: 1, frame: hex('#9aa1a3'), lintel: null, seed });
    } else {
      cell.rect(0, 0, W, 0.35, hex('#9a978f'));
      if (kind === 'ground') paintWindow(cell, 0.3, 1.2, W - 0.6, 0.95, { cols: 2, rows: 1, frame: hex('#9aa1a3'), lintel: null, seed });
      else {
        paintDoor(cell, { x: 0.4, w: 1.1, h: 2.2, colour: hex('#3d4c57'), frame: hex('#9aa1a3'), glass: true, seed });
        cell.rect(0.2, 2.5, 1.5, 0.14, band);
        paintWindow(cell, 2.0, 1.2, 1.3, 0.95, { cols: 1, rows: 1, frame: hex('#9aa1a3'), lintel: null, seed });
      }
    }
    return grime(cell, kind);
  }

  if (style === 'modern') {
    paintRender(cell, seed, 0.6);
    const frame = hex('#2f3337');
    if (kind === 'upper') {
      paintWindow(cell, 0.4, 0.5, 2.0, 2.0, { cols: 2, rows: 1, frame, lintel: null, seed });
      paintWindow(cell, 2.9, 0.15, 0.8, 2.35, { cols: 1, rows: 1, frame, lintel: null, seed });
    } else {
      paintWindow(cell, 0.25, 0.3, 2.6, 3.1, { cols: 2, rows: 1, frame, lintel: null, seed });
      if (kind === 'door') paintDoor(cell, { x: 3.0, w: 1.0, h: 2.3, colour: frame, frame, glass: true, seed });
      else paintWindow(cell, 3.1, 0.3, 0.85, 3.1, { cols: 1, rows: 1, frame, lintel: null, seed });
    }
    return grime(cell, kind);
  }

  // tower: concrete panel grid with a square window and a pale floor band.
  paintRender(cell, seed, 0.75);
  const frame = hex('#3b4146');
  if (kind === 'upper') {
    cell.rect(0, 0, W, 0.22, hex('#d1cec6'));
    paintWindow(cell, 0.3, 0.6, W - 0.6, 1.9, { cols: 2, rows: 1, frame, lintel: null, seed });
  } else {
    cell.rect(0, 0, W, 0.3, hex('#9a978f'));
    if (kind === 'ground') paintWindow(cell, 0.3, 0.8, W - 0.6, 1.9, { cols: 2, rows: 1, frame, lintel: null, seed });
    else paintDoor(cell, { x: W / 2 - 0.55, w: 1.1, h: 2.3, colour: hex('#262b30'), frame, glass: true, seed });
  }
  return grime(cell, kind);
}

/** All cells in layer order, as one buffer for a texture array. */
export function paintAllCells(): Uint8ClampedArray {
  const layer = CELL_PX * CELL_PX * 4;
  const out = new Uint8ClampedArray(layer * CELL_LAYER_COUNT);
  for (const style of FACADE_STYLES) for (let variant = 0; variant < CELL_VARIANTS; variant++) for (const kind of CELL_KINDS) out.set(paintCell(style, kind, variant), cellLayer(style, kind, variant) * layer);
  return out;
}

/**
 * The procedural cells as the two arrays the shader samples: RGBA colour and
 * an RG tint mask (R = wall tint weight, G = accent, unused here), the same
 * layout the bay looks use, so one shader serves every look.
 */
export function paintProceduralLayers(extra: Uint8ClampedArray[] = []): { layers: number; colour: Uint8Array; mask: Uint8Array } {
  const base = paintAllCells(), layerBytes = CELL_PX * CELL_PX * 4;
  const all = new Uint8ClampedArray(base.length + extra.length * layerBytes);
  all.set(base); extra.forEach((cell, i) => all.set(cell, base.length + i * layerBytes));
  const total = CELL_LAYER_COUNT + extra.length, pixels = CELL_PX * CELL_PX * total;
  const colour = new Uint8Array(pixels * 4), mask = new Uint8Array(pixels * 2);
  for (let i = 0; i < pixels; i++) {
    colour[i * 4] = all[i * 4]; colour[i * 4 + 1] = all[i * 4 + 1]; colour[i * 4 + 2] = all[i * 4 + 2]; colour[i * 4 + 3] = 255;
    mask[i * 2] = all[i * 4 + 3]; mask[i * 2 + 1] = 0;
  }
  return { layers: total, colour, mask };
}
