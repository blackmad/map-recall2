// Canal elevation extract: types, the local frame, and mercator placement.
//
// Visual-only elevation (`?elevation=1`, see docs/elevation.md). Land stays at
// the game's z = 0 (street / quay level), water sits `quayFreeboardM` below it,
// and bridges carry measured AHN deck profiles. Routing and vehicle physics stay
// 2D; nothing here feeds them.
//
// The extract stores coordinates in a local equirectangular frame around
// `origin` (decimetre integers). That frame is only a storage format: every
// vertex is converted back to lng/lat and then to exact Web Mercator, so the
// render matches MapLibre's own water and roads to the centimetre.

export type LngLat = [number, number];

export interface ElevationIndex {
  version: 1;
  origin: LngLat;
  /** Metres per degree of longitude, latitude in the storage frame. */
  metresPerDegree: [number, number];
  cellSizeM: number;
  quantization: { xy: number; profileS: number; profileH: number };
  waterLevelNAP: number;
  /** Street / quay level above the canal water, metres. */
  quayFreeboardM: number;
  quayFreeboardMethod?: string;
  /** [cellX, cellY, waterVertices, shoreSegments] */
  cells: [number, number, number, number][];
  sources?: Record<string, unknown>;
  attribution?: string;
}

/** One 1 km cell: water polygons (rings of decimetre ints relative to the
 *  cell's SW corner, outer ring CCW then holes CW) and true shorelines
 *  (polylines with the water on their left; cell and coverage seams removed). */
export interface WaterCell {
  cell: [number, number];
  water: number[][][];
  shore: number[][];
}

export interface MeasuredBridge {
  id: string;
  name: string;
  roadIds: string[];
  family: 'masonry-arch' | 'concrete-deck' | 'steel-deck' | 'wooden-deck' | string;
  width: number;
  approachHalfWidth: number;
  /** Station range (m) where the DSM shows the deck. */
  deck: [number, number];
  /** Station range (m) over mapped water, or null for viaducts over land. */
  water: [number, number] | null;
  /** Municipal outline, decimetres in the storage frame. */
  outline: number[];
  endpointNAP: [number, number];
  /** Flattened stations: x, y (dm, storage frame), s (cm), h (cm above the approach baseline). */
  p: number[];
}

export interface FallbackBridge {
  id: string;
  name: string;
  type: string;
  /** Municipal footprint ring, CCW, decimetres in the storage frame. */
  ring: number[];
}

export interface BridgeExtract {
  measured: MeasuredBridge[];
  fallback: FallbackBridge[];
}

/** Storage frame → lng/lat (exact inverse of the generator's forward transform). */
export function localToLngLat(index: Pick<ElevationIndex, 'origin' | 'metresPerDegree'>, x: number, y: number): LngLat {
  return [index.origin[0] + x / index.metresPerDegree[0], index.origin[1] + y / index.metresPerDegree[1]];
}

export function lngLatToLocal(index: Pick<ElevationIndex, 'origin' | 'metresPerDegree'>, lng: number, lat: number): [number, number] {
  return [(lng - index.origin[0]) * index.metresPerDegree[0], (lat - index.origin[1]) * index.metresPerDegree[1]];
}

/** Web Mercator in MapLibre's unit square (x east, y south). */
export function mercator(lng: number, lat: number): [number, number] {
  const x = (180 + lng) / 360;
  const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
  return [x, y];
}

/** MapLibre's `meterInMercatorCoordinateUnits` at a latitude. */
export function metreInMercator(lat: number): number {
  const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6371008.8;
  return 1 / (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180));
}

/**
 * The scene frame every elevation mesh is built in: east-north-up metres at the
 * render anchor, whose model matrix is translate(anchor) · scale(s, −s, s).
 * Converting through mercator (not the storage frame's flat metres) keeps a
 * vertex 10 km from the anchor where MapLibre draws it.
 */
export class SceneFrame {
  readonly anchor: LngLat;
  readonly anchorMercator: [number, number];
  readonly scale: number;
  constructor(readonly index: Pick<ElevationIndex, 'origin' | 'metresPerDegree'>, anchor: LngLat = index.origin) {
    this.anchor = anchor;
    this.anchorMercator = mercator(anchor[0], anchor[1]);
    this.scale = metreInMercator(anchor[1]);
  }

  /** Storage-frame metres → scene metres (x east, y north). */
  fromLocal(x: number, y: number): [number, number] {
    const [lng, lat] = localToLngLat(this.index, x, y);
    const [mx, my] = mercator(lng, lat);
    return [(mx - this.anchorMercator[0]) / this.scale, -(my - this.anchorMercator[1]) / this.scale];
  }

  fromLngLat(lng: number, lat: number): [number, number] {
    const [mx, my] = mercator(lng, lat);
    return [(mx - this.anchorMercator[0]) / this.scale, -(my - this.anchorMercator[1]) / this.scale];
  }

  /** Rewrite a positions array (x, y in storage metres; z untouched) into scene metres in place. */
  placeLocalPositions(positions: Float32Array | number[]): void {
    for (let i = 0; i < positions.length; i += 3) {
      const [x, y] = this.fromLocal(positions[i], positions[i + 1]);
      positions[i] = x;
      positions[i + 1] = y;
    }
  }
}

export function cellKey(cx: number, cy: number): string {
  return `${cx}_${cy}`;
}

/** Cells whose square intersects a radius around a storage-frame point. */
export function cellsNear(index: Pick<ElevationIndex, 'cellSizeM' | 'cells'>, x: number, y: number, radiusM: number): string[] {
  const size = index.cellSizeM;
  const out: string[] = [];
  for (const [cx, cy] of index.cells) {
    const nx = Math.max(cx * size, Math.min(x, (cx + 1) * size));
    const ny = Math.max(cy * size, Math.min(y, (cy + 1) * size));
    if (Math.hypot(nx - x, ny - y) <= radiusM) out.push(cellKey(cx, cy));
  }
  return out;
}

export function validateIndex(value: unknown): ElevationIndex {
  const index = value as ElevationIndex;
  if (!index || index.version !== 1 || !Array.isArray(index.cells) || !Array.isArray(index.origin)
    || !Array.isArray(index.metresPerDegree) || !(index.cellSizeM > 0)
    || !(index.quayFreeboardM > 0 && index.quayFreeboardM < 6)) throw new Error('Invalid canal elevation index');
  return index;
}
