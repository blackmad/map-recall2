// Generic facades for the streamed LoD1 city (experiment, 2026-10-01).
//
// The user asked for "a really generic building look … doors/windows, ideally
// very very roughly based on year of construction and size". The city is a
// MapLibre fill-extrusion; the only per-feature texture MapLibre 5 offers on
// one is `fill-extrusion-pattern`, a sprite image tiled over every wall. That
// shapes everything here:
//
// - A pattern replaces `fill-extrusion-color` outright, so the wall colour has
//   to be baked into the image. Each (style, wall colour) pair is one image;
//   every style picks from a short, period-plausible slice of the existing
//   contextual palette, so twenty images cover the city.
// - The pattern's horizontal axis is the edge distance along the footprint
//   ring and its vertical axis is the absolute elevation, in tile pixels at
//   the integer *tile zoom*. With fade disabled that means a pattern is a
//   fixed number of screen pixels per integer zoom, i.e. its size in metres
//   halves at every zoom step. `facadePixelRatio` registers the images with a
//   pixel ratio per tile zoom so one image is always 32 m tall on the wall; the
//   runtime swaps the image set when the integer zoom changes. The ratio is
//   stored as an integer by MapLibre (a fractional one silently broke the
//   layer at zoom 19), which caps the zoom range — see FACADE_PIXELS_PER_M.
// - Vertical phase: the shader adds the tile's pixel origin modulo the pattern
//   size. That origin is a multiple of 512 tile pixels, and the pattern is
//   2^(z−11) tile pixels tall, which divides 512 at every zoom used here — so
//   the image's bottom row always sits on the ground and doors stay at street
//   level. A building taller than 32 m sees the ground floor repeat; the
//   towers style draws no distinct ground floor for that reason.
// - The extrusion's top face samples the same image, so the pattern layer
//   stops a cornice short of the wall top and the ordinary coloured layer
//   draws that cornice (and the roof face) above it. Nothing is coplanar.
//
// These are display priors, not evidence: the period comes from the BAG
// construction year (via `building-facts`), the rest is invented rhythm.

import { CONTEXTUAL_BUILDING_COLOURS, type ContextualBuildingColour } from './cityAppearancePalette.js';
import { BUILDING_FACT_ZOOM, plausibleYear, shortBuildingId, type BuildingFactTile } from './buildingFacts.js';

export const FACADE_STYLES = ['canal', 'c19', 'school', 'postwar', 'modern', 'tower'] as const;
export type FacadeStyle = (typeof FACADE_STYLES)[number];

/** Metres of wall one pattern image spans vertically. */
export const FACADE_PATTERN_HEIGHT_M = 32;
/**
 * Image pixels per metre of wall height. MapLibre packs a pattern's pixel
 * ratio into a Uint16 vertex attribute, so the ratio must be a whole number
 * ≥ 1 at every tile zoom we draw: ratio = R·2^(16−z), hence R = 2^(maxZ−16).
 * 8 px/m supports tile zoom 19; above it the facades step aside.
 */
export const FACADE_PIXELS_PER_M = 8;
/** The coloured band the plain wall layer keeps above the patterned wall. */
export const FACADE_CORNICE_M = 0.45;
/** Below this exposed wall height (sheds, bike stores) no facade is drawn. */
export const FACADE_MIN_WALL_M = 2.6;
/** Below this footprint (kiosks, garden huts) no facade is drawn. */
export const FACADE_MIN_FOOTPRINT_M2 = 14;
/** Image name prefix; the tile zoom follows it (`gf18-canal-priorBrickRed`). */
export const FACADE_IMAGE_PREFIX = 'gf';

/** The palette slice each period draws from. Plausible, not observed. */
export const FACADE_STYLE_COLOURS: Record<FacadeStyle, readonly ContextualBuildingColour[]> = {
  canal: ['priorBrickRed', 'priorBrickBrown', 'priorBrickDark', 'priorPlaster', 'priorCanalGreen'],
  c19: ['priorBrickRed', 'priorBrickBrown', 'priorBrickBuff', 'priorPlaster'],
  school: ['priorBrickRed', 'priorBrickBrown', 'priorBrickDark'],
  postwar: ['priorBrickBuff', 'priorBrickRed', 'priorModernGrey'],
  modern: ['priorModernLight', 'priorModernGrey', 'priorBrickBuff'],
  tower: ['priorModernGrey', 'priorModernLight'],
};

export type FacadeInput = { year: number | null; heightM: number; minHeightM: number; footprintM2: number };

/**
 * A period style from construction year and size. Bounded and explainable:
 * year picks the period; size only promotes tall post-war blocks to the
 * tower grid and drops tiny structures.
 */
export function facadeStyleFor({ year, heightM, minHeightM, footprintM2 }: FacadeInput): FacadeStyle | null {
  if (!(heightM - minHeightM >= FACADE_MIN_WALL_M) || !(footprintM2 >= FACADE_MIN_FOOTPRINT_M2)) return null;
  const known = year !== null && plausibleYear(year);
  if (heightM >= 30 && (!known || year! >= 1950)) return 'tower';
  if (!known) return heightM <= 14 ? 'c19' : 'postwar';
  if (year! < 1860) return 'canal';
  if (year! < 1915) return 'c19';
  if (year! < 1945) return 'school';
  if (year! < 1985) return 'postwar';
  return 'modern';
}

function stableIndex(id: string, length: number): number {
  let hash = 2166136261;
  for (const char of id) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % length;
}

export const facadeKey = (style: FacadeStyle, colour: ContextualBuildingColour) => `${style}-${colour}`;

/** The eight wall colours a mapped colour can snap to. */
export const FACADE_WALL_COLOURS: readonly ContextualBuildingColour[] = [
  'priorBrickRed', 'priorBrickBrown', 'priorBrickDark', 'priorBrickBuff',
  'priorPlaster', 'priorModernLight', 'priorModernGrey', 'priorCanalGreen',
];

const HEX = /^#?([0-9a-f]{6})$/i;
const rgbOf = (hex: string) => { const n = parseInt(hex.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

/** Closest of the eight wall colours to a mapped hex colour; null if not a 6-digit hex. */
export function snapWallColour(hex: unknown): ContextualBuildingColour | null {
  if (typeof hex !== 'string' || !HEX.test(hex.trim())) return null;
  const [r, g, b] = rgbOf(hex.trim());
  let best: ContextualBuildingColour | null = null, bestD = Infinity;
  for (const colour of FACADE_WALL_COLOURS) {
    const [cr, cg, cb] = rgbOf(CONTEXTUAL_BUILDING_COLOURS[colour]);
    // Weighted RGB distance (redmean) tracks perceived difference better than plain RGB.
    const mr = (r + cr) / 2, d = (2 + mr / 256) * (r - cr) ** 2 + 4 * (g - cg) ** 2 + (2 + (255 - mr) / 256) * (b - cb) ** 2;
    if (d < bestD) { bestD = d; best = colour; }
  }
  return best;
}

/** Every (style, colour) the city can ask for: all styles in all eight wall colours. */
export function allFacadeKeys(): Array<{ key: string; style: FacadeStyle; colour: ContextualBuildingColour }> {
  return FACADE_STYLES.flatMap(style => FACADE_WALL_COLOURS.map(colour => ({ key: facadeKey(style, colour), style, colour })));
}

/** Approximate area of a lng/lat polygon's outer ring, in square metres. */
export function footprintAreaM2(geometry: unknown): number {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || !g.coordinates) return 0;
  const polygons = g.type === 'Polygon' ? [g.coordinates as number[][][]]
    : g.type === 'MultiPolygon' ? g.coordinates as number[][][][] : [];
  let total = 0;
  for (const polygon of polygons) {
    const ring = polygon[0];
    if (!ring || ring.length < 4) continue;
    const lat0 = ring[0][1] * Math.PI / 180;
    const kx = 111_320 * Math.cos(lat0), ky = 110_540;
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      sum += (ring[j][0] * kx) * (ring[i][1] * ky) - (ring[i][0] * kx) * (ring[j][1] * ky);
    }
    total += Math.abs(sum) / 2;
  }
  return total;
}

type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };

/**
 * The streamer's post-decoration hook: give a building a facade key, and the
 * period-plausible wall colour that key bakes in. Buildings on the
 * citywide identity prior get a period-plausible colour; ones with an OSM hex
 * colour snap to the nearest wall colour. Measured colours keep the plain look — and only when the ground floor is not drawn as
 * its own layer (it would share walls with the pattern).
 */
export function decorateFacade<T extends Feature>(feature: T): T {
  const p = feature.properties || {};
  const prior = p.appearanceStyleSource === 'citywide-identity-palette-v3-not-measured';
  // A building with its own OSM colour tag keeps that colour's family: the
  // facade is baked in the closest of the eight wall colours.
  const mapped = prior || p.appearanceStyleSource !== undefined ? null
    : snapWallColour(p.sideColour ?? p.colour ?? p.color);
  if (!prior && !mapped) return feature;
  if (p.groundAppearanceStyleSource !== undefined && p.groundAppearanceStyleSource !== 'wall-inherited-not-independently-measured') return feature;
  const heightM = Number(p.height), minHeightM = Number(p.minHeight) || 0;
  if (!Number.isFinite(heightM)) return feature;
  const year = Number.isFinite(Number(p.constructionYear)) && p.constructionYear !== null ? Number(p.constructionYear) : null;
  const style = facadeStyleFor({ year, heightM, minHeightM, footprintM2: footprintAreaM2(feature.geometry) });
  if (!style) return feature;
  const colours = FACADE_STYLE_COLOURS[style];
  const colour = mapped ?? colours[stableIndex(String(p.id ?? ''), colours.length)];
  const hex = CONTEXTUAL_BUILDING_COLOURS[colour];
  return { ...feature, properties: { ...p, facade: facadeKey(style, colour), facadeStyle: style, sideColour: hex, groundColour: hex } };
}

// ---------------------------------------------------------------------------
// Construction years from the building-facts tiles
// ---------------------------------------------------------------------------

async function readMaybeGzippedJson(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('gzip facts need DecompressionStream');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * A tile enricher for `BuildingTileStreamer.setTileEnricher`: fetch the
 * building-facts tile cut on the same z14 grid, in parallel with the building
 * tile, and stamp `constructionYear` on each building it names. A missing or
 * unreadable facts tile leaves the buildings yearless (size-only styling).
 */
export function constructionYearEnricher(baseUrl: string, fetchImpl: typeof fetch = (...args) => fetch(...args)) {
  const root = baseUrl.replace(/\/$/, '');
  return async (tile: { z: number; x: number; y: number }, signal?: AbortSignal) => {
    if (tile.z !== BUILDING_FACT_ZOOM) return (_features: Feature[]) => {};
    let rows: BuildingFactTile['buildings'] | null = null;
    try {
      const response = await fetchImpl(`${root}/building-facts/${tile.z}/${tile.x}/${tile.y}.json.gz`, { signal });
      if (response.ok) {
        const value = await readMaybeGzippedJson(response) as BuildingFactTile;
        if (value && value.version === 1 && value.buildings && typeof value.buildings === 'object') rows = value.buildings;
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
    }
    return (features: Feature[]) => {
      if (!rows) return;
      for (const feature of features) {
        const id = String(feature.properties?.id ?? '');
        const row = rows[shortBuildingId(id)];
        if (row && plausibleYear(row[0])) feature.properties.constructionYear = row[0];
      }
    };
  };
}

// ---------------------------------------------------------------------------
// Pattern images
// ---------------------------------------------------------------------------

/** Horizontal image pixels per metre: the pattern's x axis is mercator edge
 *  distance, its y axis plain metres, so the two scales differ by latitude. */
export function facadeHorizontalPixelsPerM(latitude: number, pixelsPerM = FACADE_PIXELS_PER_M): number {
  // display px/m along an edge = 512·2^z / (C·cos φ); up a wall = 2^z / 65536.
  return pixelsPerM * (512 * 65536) / (40_075_016.686 * Math.cos(latitude * Math.PI / 180));
}

/** The `pixelRatio` that makes one image span `FACADE_PATTERN_HEIGHT_M` of
 *  wall at this integer tile zoom. */
export function facadePixelRatio(tileZoom: number): number {
  const imageHeight = FACADE_PATTERN_HEIGHT_M * FACADE_PIXELS_PER_M;
  const displayHeight = FACADE_PATTERN_HEIGHT_M * 2 ** tileZoom / 65536;
  return imageHeight / displayHeight;
}

/** Zoom distance past an integer boundary before the image set changes. */
export const FACADE_ZOOM_HYSTERESIS = 0.3;

/** Facades are drawn from this zoom; below it the image set stays at 15. */
export const FACADE_MIN_TILE_ZOOM = 15;
/** The highest tile zoom with a whole-number pixel ratio (see above). */
export const FACADE_MAX_TILE_ZOOM = 16 + Math.log2(FACADE_PIXELS_PER_M);
/** The image set for a map zoom, or null above the supported range, where
 *  the plain walls return. */
export function facadeTileZoom(mapZoom: number, current: number | null = null): number | null {
  // The chase camera's zoom wanders around an integer while the rider moves;
  // swapping the image set (a tile re-layout) on every crossing made facades
  // flip back and forth. Hold the current set until the zoom is clearly past it.
  const held = current !== null && mapZoom >= current - FACADE_ZOOM_HYSTERESIS && mapZoom < current + 1 + FACADE_ZOOM_HYSTERESIS;
  const tileZoom = held ? current : Math.floor(mapZoom);
  if (tileZoom > FACADE_MAX_TILE_ZOOM) return null;
  return Math.max(FACADE_MIN_TILE_ZOOM, tileZoom);
}
export const facadeImageName = (tileZoom: number, key: string) => `${FACADE_IMAGE_PREFIX}${tileZoom}-${key}`;

/** The layer's pattern expression for one tile zoom's image set. */
export function facadePatternExpression(tileZoom: number): unknown[] {
  return ['image', ['concat', `${FACADE_IMAGE_PREFIX}${tileZoom}-`, ['get', 'facade']]];
}

type Rgb = [number, number, number];
const hexRgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const shade = (rgb: Rgb, k: number): Rgb => rgb.map(v => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)))) as Rgb;

/** Rectangles in wall metres: x from the bay's left edge, y up from the ground. */
type Rect = { x: number; y: number; w: number; h: number; c: Rgb };

type Opening = { x: number; w: number; sill: number; h: number; mullions?: number; transom?: boolean };
type StyleSpec = {
  bay: number; ground: number; storey: number;
  upper: Opening[]; groundWindows: Opening[]; door?: { x: number; w: number; h: number; fanlight?: boolean };
  frame: string; frameW: number; glass: string; doorColour: string;
  /** Darker brick band at each floor line (Amsterdam School), or a light slab (post-war). */
  floorBand?: { h: number; k: number; light?: boolean };
  /** Lintel band just over each window. */
  lintel?: number;
  /** A thin party-wall line at the bay edge (canal-house rhythm). */
  partyWall?: boolean;
};

const STYLE_SPECS: Record<FacadeStyle, StyleSpec> = {
  canal: {
    bay: 6.4, ground: 3.8, storey: 3.4, partyWall: true,
    door: { x: 0.8, w: 1.2, h: 2.7, fanlight: true },
    groundWindows: [{ x: 2.8, w: 1.05, sill: 1.0, h: 2.2, transom: true }, { x: 4.6, w: 1.05, sill: 1.0, h: 2.2, transom: true }],
    upper: [{ x: 0.85, w: 1.05, sill: 0.7, h: 2.05, transom: true }, { x: 2.7, w: 1.05, sill: 0.7, h: 2.05, transom: true }, { x: 4.55, w: 1.05, sill: 0.7, h: 2.05, transom: true }],
    frame: '#f2efe6', frameW: 0.13, glass: '#2b3843', doorColour: '#3a2a22',
  },
  c19: {
    bay: 5.4, ground: 3.6, storey: 3.2, lintel: 0.22,
    door: { x: 0.5, w: 1.1, h: 2.5, fanlight: true },
    groundWindows: [{ x: 2.2, w: 1.3, sill: 0.9, h: 2.0, transom: true }, { x: 3.9, w: 1.0, sill: 0.9, h: 2.0 }],
    upper: [{ x: 0.75, w: 1.15, sill: 0.8, h: 1.9, transom: true }, { x: 3.0, w: 1.15, sill: 0.8, h: 1.9, transom: true }],
    frame: '#e9e1cc', frameW: 0.11, glass: '#2d3944', doorColour: '#2f3a33',
  },
  school: {
    bay: 4.8, ground: 3.0, storey: 3.0, floorBand: { h: 0.32, k: 0.78 },
    door: { x: 0.5, w: 1.0, h: 2.25 },
    groundWindows: [{ x: 2.1, w: 2.0, sill: 1.0, h: 1.3, mullions: 2 }],
    upper: [{ x: 1.0, w: 2.8, sill: 0.95, h: 1.45, mullions: 3, transom: true }],
    frame: '#efe9dc', frameW: 0.1, glass: '#2c3843', doorColour: '#4a2f24',
  },
  postwar: {
    bay: 3.6, ground: 2.9, storey: 2.85, floorBand: { h: 0.26, k: 1.35, light: true },
    door: { x: 0.35, w: 1.0, h: 2.2 },
    groundWindows: [{ x: 1.8, w: 1.4, sill: 1.25, h: 0.9 }],
    upper: [{ x: 0.3, w: 3.0, sill: 0.95, h: 1.45, mullions: 1 }],
    frame: '#9aa1a3', frameW: 0.07, glass: '#33424e', doorColour: '#3d4c57',
  },
  modern: {
    bay: 4.2, ground: 3.8, storey: 3.0,
    door: { x: 3.0, w: 1.0, h: 2.5 },
    groundWindows: [{ x: 0.3, w: 2.4, sill: 0.25, h: 3.0, mullions: 1 }],
    upper: [{ x: 0.4, w: 2.0, sill: 0.6, h: 1.9 }, { x: 2.95, w: 0.8, sill: 0.35, h: 2.25 }],
    frame: '#2f3337', frameW: 0.07, glass: '#3a4b58', doorColour: '#262b30',
  },
  tower: {
    bay: 3.0, ground: 3.2, storey: 3.2, floorBand: { h: 0.3, k: 1.3, light: true },
    groundWindows: [{ x: 0.35, w: 2.3, sill: 0.8, h: 1.8, mullions: 1 }],
    upper: [{ x: 0.35, w: 2.3, sill: 0.8, h: 1.8, mullions: 1 }],
    frame: '#3b4146', frameW: 0.06, glass: '#3a4c5a', doorColour: '#262b30',
  },
};

export function facadeRects(style: FacadeStyle, wallHex: string): { bay: number; rects: Rect[]; wall: Rgb } {
  const spec = STYLE_SPECS[style];
  const wall = hexRgb(wallHex);
  const frame = hexRgb(spec.frame), glass = hexRgb(spec.glass), sky = shade(hexRgb(spec.glass), 1.28), door = hexRgb(spec.doorColour);
  const rects: Rect[] = [];
  const opening = (o: Opening, floorY: number) => {
    const y = floorY + o.sill, f = spec.frameW;
    if (spec.lintel) rects.push({ x: o.x - 0.12, y: y + o.h, w: o.w + 0.24, h: spec.lintel, c: shade(wall, 0.8) });
    rects.push({ x: o.x, y, w: o.w, h: o.h, c: frame });
    rects.push({ x: o.x + f, y: y + f, w: o.w - 2 * f, h: o.h - 2 * f, c: glass });
    // A lighter upper pane reads as sky in the glass from the chase camera.
    rects.push({ x: o.x + f, y: y + f + (o.h - 2 * f) * 0.62, w: o.w - 2 * f, h: (o.h - 2 * f) * 0.38, c: sky });
    for (let m = 1; m <= (o.mullions || 0); m++) {
      rects.push({ x: o.x + (o.w * m) / ((o.mullions || 0) + 1) - f / 2, y, w: f, h: o.h, c: frame });
    }
    if (o.transom) rects.push({ x: o.x, y: y + o.h * 0.58, w: o.w, h: f, c: frame });
  };
  if (spec.partyWall) rects.push({ x: 0, y: 0, w: 0.14, h: FACADE_PATTERN_HEIGHT_M, c: shade(wall, 0.72) });
  // Ground floor.
  if (spec.door) {
    const d = spec.door;
    rects.push({ x: d.x - 0.1, y: 0, w: d.w + 0.2, h: d.h + 0.1, c: frame });
    rects.push({ x: d.x, y: 0, w: d.w, h: d.h, c: door });
    if (d.fanlight) rects.push({ x: d.x + 0.08, y: d.h - 0.55, w: d.w - 0.16, h: 0.42, c: glass });
  }
  for (const o of spec.groundWindows) opening(o, 0);
  // Upper storeys, to the top of the image.
  for (let floor = spec.ground; floor < FACADE_PATTERN_HEIGHT_M - 0.5; floor += spec.storey) {
    if (spec.floorBand) {
      const band = spec.floorBand;
      rects.push({ x: 0, y: floor - band.h / 2, w: spec.bay, h: band.h, c: shade(wall, band.k) });
    }
    for (const o of spec.upper) if (floor + o.sill + o.h < FACADE_PATTERN_HEIGHT_M) opening(o, floor);
  }
  return { bay: spec.bay, rects, wall };
}

/** RGBA pixels for one facade image; pure, so it runs in tests and workers. */
export function rasterizeFacade(style: FacadeStyle, wallHex: string, latitude: number): { width: number; height: number; data: Uint8ClampedArray } {
  const { bay, rects, wall } = facadeRects(style, wallHex);
  const sx = facadeHorizontalPixelsPerM(latitude), sy = FACADE_PIXELS_PER_M;
  const width = Math.max(4, Math.round(bay * sx));
  const height = FACADE_PATTERN_HEIGHT_M * sy;
  // Use the rounded width's own scale so the bay tiles seamlessly.
  const kx = width / bay;
  const data = new Uint8ClampedArray(width * height * 4);
  const fill = (x0: number, y0: number, x1: number, y1: number, c: Rgb) => {
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
        const i = (y * width + x) * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }
  };
  fill(0, 0, width, height, wall);
  for (const r of rects) {
    // Wall y runs up from the ground; image rows run down from the top.
    const x0 = Math.round(r.x * kx), x1 = Math.max(x0 + 1, Math.round((r.x + r.w) * kx));
    const y1 = height - Math.round(r.y * sy), y0 = Math.min(y1 - 1, height - Math.round((r.y + r.h) * sy));
    fill(x0, y0, x1, y1, r.c);
  }
  return { width, height, data };
}

type ImageMap = {
  hasImage(id: string): boolean;
  addImage(id: string, image: { width: number; height: number; data: Uint8ClampedArray }, options?: { pixelRatio?: number }): void;
  removeImage(id: string): void;
};

/**
 * Keeps one tile zoom's facade images registered on the map, rasterised once
 * and re-added with a new pixel ratio when the zoom band changes.
 */
export class FacadeImageSet {
  private readonly pixels = new Map<string, { width: number; height: number; data: Uint8ClampedArray }>();
  private readonly registered = new Set<number>();
  constructor(private readonly map: ImageMap, private readonly latitude = 52.37) {}

  ensure(tileZoom: number): void {
    if (this.registered.has(tileZoom)) return;
    const ratio = facadePixelRatio(tileZoom);
    for (const { key, style, colour } of allFacadeKeys()) {
      let image = this.pixels.get(key);
      if (!image) { image = rasterizeFacade(style, CONTEXTUAL_BUILDING_COLOURS[colour], this.latitude); this.pixels.set(key, image); }
      const name = facadeImageName(tileZoom, key);
      if (!this.map.hasImage(name)) this.map.addImage(name, image, { pixelRatio: ratio });
    }
    this.registered.add(tileZoom);
  }

  /** Drop every zoom band but `keep` (call once tiles have re-laid out). */
  prune(keep: number): void {
    for (const zoom of [...this.registered]) {
      if (zoom === keep) continue;
      for (const { key } of allFacadeKeys()) {
        const name = facadeImageName(zoom, key);
        if (this.map.hasImage(name)) this.map.removeImage(name);
      }
      this.registered.delete(zoom);
    }
  }
}
