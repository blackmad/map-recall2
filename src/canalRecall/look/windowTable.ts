// The per-layer window table (lane R2-A, #228): for every bay layer of a look's atlas, where its windows are, in the
// same canvas pixels the painter (bayTextures.ts `draw` / `layoutWindows` / `windowAt`) draws them, so the facade
// shader can draw frames, glass and muntins analytically (look/windowSdf.ts) instead of only sampling the 256 px cell.
//
// A slot is a descriptor: `bayVariant(entry)` (bayLook.ts) fixes window count, axes, shape, sash and frame tone, and
// the rect fractions come from the painter's own `bayWindowGeometry`, `canalGroundGeometry` and
// `bayDoorWindowGeometry`. No per-building data. Door, shop and plain cells, the procedural cells, the roofs and the
// drawn looks (storybook, cartoon: outlined, which the analytic frame does not draw) get no analytic windows.
//
// Packed as a small RGBA float DataTexture, WINDOW_TABLE_WIDTH texels per layer row, read with texelFetch by layer
// (not a uniform array: iOS fragment-uniform limits). Layout of a row:
//   texel 0                 header: (window count, cell canvas height px, 0, 0)
//   texels 1 + 4 i .. 4 + 4 i, window i (at most WINDOW_TABLE_MAX):
//     t0  opening rect in cell uv: x0, x1, y0 (bottom), y1 (top); uv y runs up (the atlas rows are bottom-up)
//     t1  shape (0 rect, 1 segmental, 2 arch), muntin pattern (MUNTIN codes), frame inset x, frame inset y (uv)
//     t2  frame colour (sRGB 0..1, after the look's calm pass), frame accent (1: the accent tint multiplies it)
//     t3  head rise (uv y; segmental), glass lift (look's calm), 0, 0
// All lengths are fractions of the cell (u of BAY_PX, v of the cell's canvas height).

import { BAY_PX, GROUND_PX, STOREY_PX, SHOP_KINDS, bayDoorWindowGeometry, bayWindowGeometry, canalGroundGeometry, type BayVariant, type Look } from '../bayTextures.js';
import { BAY_ENTRIES, bayVariant } from '../bayLook.js';
import { LOOK_VARIANTS } from './palette.js';
import { PROCEDURAL_RECIPE_LAYER_OFFSET } from '../streetFacadeRendering.js';
import { lookAtlasLayers } from './paintLookAtlas.js';

import { WINDOW_TABLE_MAX, WINDOW_TABLE_WIDTH } from './windowSdf.js';
export { WINDOW_TABLE_MAX, WINDOW_TABLE_WIDTH };

/** Muntin patterns, the painter's `sash` branches (windowAt). */
export const MUNTIN = { none: 0, transom: 1, pairedTransom: 2, cross: 3, sixOverSix: 4, ribbon: 5 } as const;
export const SHAPE = { rect: 0, segmental: 1, arch: 2 } as const;

/** One window in canvas pixels (y down from the cell's top), as `windowAt(p, x, y, w, h, v)` receives it. */
export type CanvasWindow = { x: number; y: number; w: number; h: number; shape: keyof typeof SHAPE; muntin: number; inset: number; /** Vertical inset when it differs (the ribbon band). */ insetY?: number; frame: string; accent: boolean; rise: number };
export type LayerWindows = { layer: number; cellH: number; windows: CanvasWindow[]; reason?: string };

const isShop = (kind: string) => (SHOP_KINDS as readonly string[]).includes(kind);

function muntinOf(v: BayVariant): number {
  if (v.sash === 'paired-transom') return MUNTIN.pairedTransom;
  if (v.sash === 'transom') return MUNTIN.transom;
  if (v.sash === 'plain') return MUNTIN.none;
  return v.family === 'punched' ? MUNTIN.cross : MUNTIN.sixOverSix;
}

/** windowAt's frame and inset for the photo look (`cartoon` false): the painter's literal values. */
function windowOf(x: number, y: number, w: number, h: number, v: BayVariant): CanvasWindow {
  const restrained = v.trimDensity === 'restrained';
  const inset = restrained ? 5 : v.paleAccents ? 13 : 9;
  const frame = v.openingGroup || v.frameTone === 'dark' ? '#2c302f' : v.paintedFrames ? '#ffffff' : '#f1ede2';
  const shape = v.shape === 'segmental' ? 'segmental' : v.shape === 'arch' ? 'arch' : 'rect';
  return { x, y, w, h, shape, muntin: muntinOf(v), inset, frame, accent: !!v.paintedFrames, rise: Math.min(w * .10, h * .07) };
}

/** layoutWindows(p, v, w, y, h): the windows of one row. */
function layoutRow(v: BayVariant, w: number, y0: number, h0: number, look: Look): CanvasWindow[] {
  const g = bayWindowGeometry(v, y0, h0, look), ww = g.width, y = g.y, h = g.height;
  if (v.entranceAssembly === 'raised-plain') return [.20, .47, .80].map(a => windowOf(w * a - ww / 2, y, ww, h, v));
  if (v.entranceAssembly === 'raised-pilaster') return [.205, .53, .80].map(a => windowOf(w * a - ww / 2, y, ww, h, v));
  if (v.facadeAssembly === 'stacked-open-balcony') return [.17, .5, .83].map(a => { const wide = w * (a === .5 ? .28 : .145); return windowOf(w * a - wide / 2, y, wide, h, { ...v, sash: a === .5 ? 'paired-transom' : 'transom' }); });
  return Array.from({ length: v.windows }, (_, i) => windowOf(((i + 0.5) / v.windows) * w - ww / 2, y, ww, h, v));
}

/** The ribbon band (bayTextures `ribbon`): one opening with quarter mullions, frame #cfd3d4, 10 px inset. */
function ribbonOf(w: number, y: number, h: number): CanvasWindow {
  return { x: 14, y: y - 8, w: w - 28, h: h + 16, shape: 'rect', muntin: MUNTIN.ribbon, inset: 10, insetY: 8, frame: '#cfd3d4', accent: false, rise: 0 };
}

/**
 * The windows the painter draws in a bay variant's cell (canvas px), or none with the reason. Mirrors `draw` in
 * bayTextures.ts branch by branch for the kinds the atlas holds (BAY_KINDS: upper, ground, groundDoor, shops, plain).
 */
export function canvasWindows(v: BayVariant, look: Look = 'photo'): { cellH: number; windows: CanvasWindow[]; reason?: string } {
  const w = BAY_PX, h = v.kind === 'upper' || v.kind === 'upperTall' || v.kind === 'attic' || v.kind === 'plain' ? STOREY_PX : GROUND_PX;
  const none = (reason: string) => ({ cellH: h, windows: [], reason });
  if (LOOK_VARIANTS[look].outline) return none('drawn look (outlined)');
  if (v.kind === 'plain') return none('plain');
  if (isShop(v.kind)) return none('shop');
  if (v.kind === 'groundDoor') return none('door');
  const ground = v.kind === 'ground';
  if (v.family === 'ribbon' || v.family === 'curtain') {
    if (!ground) return { cellH: h, windows: [ribbonOf(w, v.family === 'curtain' ? 8 : v.kind === 'attic' ? 120 : 70, v.family === 'curtain' ? h - 24 : v.kind === 'attic' ? 90 : 140)] };
    return { cellH: h, windows: [windowOf(w * 0.2, 80, 140, 140, { ...v, shape: 'rect', archetype: 'modern' })] };
  }
  if (ground) {
    if (v.groundAssembly) {
      const row = canalGroundGeometry(v), door = v.groundAssembly === 'tall-side-entry';
      const axes = door ? row.axes.slice(0, -1) : row.axes;
      const windows = axes.map(a => windowOf(w * (a - row.width / 2), h * (1 - row.head), w * row.width, h * (row.head - row.sill), v));
      // The side-entry door is a window-framed opening with a painted leaf over its lower half: not analytic.
      return { cellH: h, windows };
    }
    if (v.facadeAssembly === 'stacked-open-balcony') {
      const g = bayWindowGeometry(v, 70, 240, look);
      return { cellH: h, windows: [.17, .5, .83].map(a => { const ww = w * (a === .5 ? .28 : .145); return windowOf(w * a - ww / 2, g.y, ww, g.height, { ...v, sash: a === .5 ? 'paired-transom' : 'transom' }); }) };
    }
    if (v.entranceAssembly === 'raised-plain') {
      const g = bayDoorWindowGeometry(v, look);
      return { cellH: h, windows: [.20, .47, .80].map(a => windowOf(w * a - g.width / 2, g.y, g.width, g.height, v)) };
    }
    return { cellH: h, windows: layoutRow(v, w, 70, 150, look) };
  }
  // Upper storeys (BAY_KINDS has no upperTall / attic cells).
  const [y, wh] = v.kind === 'upperTall' ? [26, 250] : v.kind === 'attic' ? [96, 118] : [62, 188];
  if (v.archetype === 'school' && !v.proportions) return { cellH: h, windows: [0.3, 0.7].map(cx => windowOf(w * cx - 38, y + 6, 76, wh - 8, { ...v, shape: 'rect', shutters: false })) };
  return { cellH: h, windows: layoutRow(v, w, y, wh, look) };
}

/** The windows of every layer of a look's atlas (index = layer); layers with none carry the reason. */
export function lookWindowLayers(look: 'procedural' | Look): LayerWindows[] {
  const { layers } = lookAtlasLayers(look, false);
  const out: LayerWindows[] = Array.from({ length: layers }, (_, layer) => ({ layer, cellH: STOREY_PX, windows: [], reason: 'not a bay cell' }));
  const bayLook: Look = look === 'procedural' ? 'photo' : look;
  for (const entry of BAY_ENTRIES) {
    const layer = look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET + entry.layer : entry.layer;
    if (entry.originalMasonry) { out[layer] = { layer, cellH: STOREY_PX, windows: [], reason: 'masonry cell' }; continue; }
    const got = canvasWindows(bayVariant(entry), bayLook);
    out[layer] = { layer, ...got, windows: got.windows.slice(0, WINDOW_TABLE_MAX) };
    if (got.windows.length > WINDOW_TABLE_MAX) out[layer].reason = `${got.windows.length} windows, table holds ${WINDOW_TABLE_MAX}`;
  }
  return out;
}

const hexRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** paintLookAtlas.ts calmBayLayers on a non-wall, non-accent texel: dark ink lifts toward 150 by `glassLift`. */
export function calmInk(rgb: readonly number[], glassLift: number): [number, number, number] {
  const lum = (rgb[0] + rgb[1] + rgb[2]) / 3;
  if (lum >= 90) return [rgb[0], rgb[1], rgb[2]];
  const k = glassLift * (1 - lum / 90);
  return [rgb[0] + (150 - rgb[0]) * k, rgb[1] + (150 - rgb[1]) * k, rgb[2] + (150 - rgb[2]) * k];
}

/** The packed table: `data` RGBA float32, WINDOW_TABLE_WIDTH × `layers`, and the count of layers with windows. */
export function windowTableData(look: 'procedural' | Look, layerCount?: number): { data: Float32Array; width: number; height: number; layersWithWindows: number; windows: number } {
  const rows = lookWindowLayers(look), height = Math.max(1, layerCount ?? rows.length);
  // The calm pass runs on every non-procedural look (paintLookArrays); procedural bay cells keep their paint.
  const glassLift = look === 'procedural' ? 0 : LOOK_VARIANTS[look].glassLift;
  const data = new Float32Array(WINDOW_TABLE_WIDTH * height * 4);
  let layersWithWindows = 0, windows = 0;
  for (const row of rows) {
    if (row.layer >= height || !row.windows.length) continue;
    layersWithWindows++;
    const base = row.layer * WINDOW_TABLE_WIDTH * 4, H = row.cellH;
    data[base] = row.windows.length; data[base + 1] = H;
    row.windows.forEach((win, i) => {
      const o = base + (1 + 4 * i) * 4;
      data.set([win.x / BAY_PX, (win.x + win.w) / BAY_PX, 1 - (win.y + win.h) / H, 1 - win.y / H], o);
      data.set([SHAPE[win.shape], win.muntin, win.inset / BAY_PX, (win.insetY ?? win.inset) / H], o + 4);
      const frame = win.accent ? hexRgb(win.frame) : calmInk(hexRgb(win.frame), glassLift);
      data.set([frame[0] / 255, frame[1] / 255, frame[2] / 255, win.accent ? 1 : 0], o + 8);
      data.set([win.rise / H, glassLift, win.h / H, 0], o + 12);
      windows++;
    });
  }
  return { data, width: WINDOW_TABLE_WIDTH, height, layersWithWindows, windows };
}

/** The table as a three.js DataTexture (nearest, no mips; texelFetch only). */
export function createWindowTableTexture(THREE: any, look: 'procedural' | Look, layerCount?: number): any {
  const { data, width, height } = windowTableData(look, layerCount);
  const t = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  t.userData = { bytes: data.byteLength, windowTable: look };
  return t;
}

/**
 * Every layer's window openings in cell uv (x of BAY_PX, y of the cell's canvas height, y down: the pitch does not
 * care), empty where the layer has none: the roll-off chain's window pitch (look/cellMips.ts rectWindowPitch, lane R3-E #240).
 */
export function layerWindowRects(look: 'procedural' | Look): { x0: number; x1: number; y0: number; y1: number }[][] {
  return lookWindowLayers(look).map(row => row.windows.map(w => ({ x0: w.x / BAY_PX, x1: (w.x + w.w) / BAY_PX, y0: w.y / row.cellH, y1: (w.y + w.h) / row.cellH })));
}
