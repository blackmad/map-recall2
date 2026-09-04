/**
 * The façade twin's massing, drawn in the game.
 *
 * A MapLibre `type: 'custom', renderingMode: '3d'` layer on the Three.js
 * runtime the game already ships, per the build prompt: no second Three.js, no
 * second camera model, no separate application. If it does not render in the
 * game the user actually drives, it does not ship.
 *
 * What it draws is deliberately modest. LoD2.2 massing — footprint, eaves,
 * ridge, roof form — and nothing else, because that is all that has been
 * observed of 2,981 of the 3,025 buildings. The point of getting this on screen
 * before the façade work continues is that a silhouette is checkable by eye in
 * seconds, and every measurement bug so far took paragraphs of prose to find in
 * JSON.
 *
 * Tier ownership matters here and is the one rule that cannot be bent: inside
 * the boundary this layer owns the buildings, and the 3DBAG tile layer must be
 * told to stop drawing them. Two representations of one building fighting for
 * the same pixels is the z-fighting the renderer design exists to prevent.
 */

export interface Lod22Building {
  id: string;
  /** Flat [x0,y0,x1,y1,…] in metres from the extract's local origin. */
  ring: number[];
  /** Ground level, metres above the vertical datum. */
  ground: number;
  /** Metres above this building's own ground, or null when unmeasured. */
  eaves: number | null;
  ridge: number | null;
  roof: string;
  reason: string | null;
}

export interface Lod22Extract {
  metadata: {
    areaId: string;
    localOrigin: { x: number; y: number };
    localOriginLngLat: [number, number];
    attribution: string;
  };
  buildings: Lod22Building[];
}

export type ColourMode = 'massing' | 'height' | 'evidence';

/** Height above ground the renderer uses when the model measured none. */
const FALLBACK_RIDGE_M = 11;
const FALLBACK_EAVES_RATIO = 0.78;

/**
 * A building's drawable heights.
 *
 * A building with no measured height still has to be drawn — leaving a hole in
 * a terrace is worse than a wall of the wrong height, because a hole reads as
 * "no building here" rather than "height unknown". So it gets a fallback, and
 * the fallback is reported as one: `estimated` drives both the evidence colour
 * mode and the coverage line, so nothing can mistake it for a measurement.
 */
export function drawableHeights(building: Lod22Building): { eaves: number; ridge: number; estimated: boolean } {
  const ridge = building.ridge ?? building.eaves ?? null;
  if (ridge === null) return { eaves: FALLBACK_RIDGE_M * FALLBACK_EAVES_RATIO, ridge: FALLBACK_RIDGE_M, estimated: true };
  // A flat roof has no ridge above its eaves; a pitched one always does, so a
  // missing eaves is filled from the ridge rather than the building vanishing.
  const eaves = building.eaves ?? (building.roof === 'flat' ? ridge : ridge * FALLBACK_EAVES_RATIO);
  return { eaves: Math.min(eaves, ridge), ridge, estimated: building.ridge === null };
}

const MASSING_WALL = 0xb8ada0;
const MASSING_ROOF = 0x8a7f74;

/** Colour ramps, held here so the layer and its legend cannot disagree. */
export const HEIGHT_BANDS: readonly [max: number, colour: number][] = [
  [8, 0xf0e0d6], [12, 0xdcb49c], [16, 0xc48a68], [20, 0xa4603d], [Infinity, 0x7a3618],
];

export const EVIDENCE_COLOURS = {
  measured: 0x1baf7a,
  inverted: 0xeda100,
  estimated: 0xe34948,
} as const;

export function colourFor(building: Lod22Building, mode: ColourMode, part: 'wall' | 'roof'): number {
  if (mode === 'massing') return part === 'roof' ? MASSING_ROOF : MASSING_WALL;
  const { ridge, estimated } = drawableHeights(building);
  if (mode === 'height') {
    const band = HEIGHT_BANDS.find(([max]) => ridge <= max) ?? HEIGHT_BANDS[HEIGHT_BANDS.length - 1];
    return band[1];
  }
  if (estimated) return EVIDENCE_COLOURS.estimated;
  return building.reason === 'inverted' || building.reason === 'impossible'
    ? EVIDENCE_COLOURS.inverted
    : EVIDENCE_COLOURS.measured;
}

/**
 * Build the geometry for one building, in metres in the extract's local frame.
 *
 * Returned as plain arrays so this is testable without a WebGL context — the
 * layer turns them into buffers. Walls are the footprint extruded to the eaves;
 * the roof is a prism from eaves to ridge, tapered toward the centroid so a
 * pitched building reads as pitched at a distance without pretending to know
 * a ridge direction nobody measured.
 */
export function buildingGeometry(building: Lod22Building): { positions: number[]; normals: number[]; isRoof: boolean[] } {
  const ring = building.ring;
  const count = ring.length / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const isRoof: boolean[] = [];
  if (count < 3) return { positions, normals, isRoof };

  const { eaves, ridge } = drawableHeights(building);
  const base = building.ground;
  const top = base + eaves;

  let cx = 0, cy = 0;
  for (let i = 0; i < count; i++) { cx += ring[i * 2]; cy += ring[i * 2 + 1]; }
  cx /= count; cy /= count;

  const quad = (ax: number, ay: number, az: number, bx: number, by: number, bz: number,
                cxx: number, cyy: number, cz: number, dx: number, dy: number, dz: number, roof: boolean) => {
    // Two triangles, with a flat normal from the first.
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cxx - ax, vy = cyy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    for (const [px, py, pz] of [[ax, ay, az], [bx, by, bz], [cxx, cyy, cz], [ax, ay, az], [cxx, cyy, cz], [dx, dy, dz]]) {
      positions.push(px, py, pz);
      normals.push(nx / length, ny / length, nz / length);
      isRoof.push(roof);
    }
  };

  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const x0 = ring[i * 2], y0 = ring[i * 2 + 1];
    const x1 = ring[j * 2], y1 = ring[j * 2 + 1];
    // Walls, base to eaves.
    quad(x0, y0, base, x1, y1, base, x1, y1, top, x0, y0, top, false);
    // Roof, eaves to ridge, drawn toward the centroid.
    if (ridge > eaves) {
      const rx0 = cx + (x0 - cx) * 0.22, ry0 = cy + (y0 - cy) * 0.22;
      const rx1 = cx + (x1 - cx) * 0.22, ry1 = cy + (y1 - cy) * 0.22;
      quad(x0, y0, top, x1, y1, top, rx1, ry1, base + ridge, rx0, ry0, base + ridge, true);
    }
  }
  return { positions, normals, isRoof };
}

/** Every building whose footprint the boundary contains, for tier ownership. */
export const ownedPandIds = (extract: Lod22Extract): Set<string> =>
  new Set(extract.buildings.map(building => building.id));
