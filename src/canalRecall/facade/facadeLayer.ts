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

import { gableProfile, assumedGable } from './generate.ts';
import type { GableType } from './houseRecord.ts';

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
  /**
   * The front gable's form. `stated` where the register named it in prose,
   * assumed from the construction year otherwise. Never measured — the
   * *height* it rises to is measured, the shape it makes getting there is not.
   */
  gable?: { type: GableType; stated: boolean } | null;
  /** Routes the assumed-gable choice only. Never supplies a dimension. */
  year?: number | null;
  /** Present only where this building's front has been observed. */
  facade: {
    /** Front wall ends in local metres: x0, y0, x1, y1. */
    wall: [number, number, number, number];
    wallMaterial: string | null;
    /** Openings as [along the wall, above ground, width, height], in metres. */
    openings: Array<[number, number, number, number]>;
  } | null;
}

export interface Lod22Extract {
  metadata: {
    areaId: string;
    localOrigin: { x: number; y: number };
    localOriginLngLat: [number, number];
    attribution: string;
  };
  buildings: Lod22Building[];
  /** Canal surfaces, drawn at a published level rather than a measured one. */
  water?: { levelNap: number; rings: number[][] };
}

export const WATER_COLOUR = 0x27383a;

/**
 * Triangulate a water ring by ear clipping.
 *
 * Canal polygons are simple, non-convex and often long and thin, so a fan from
 * the first vertex folds over itself on the bends. Ear clipping is a few lines
 * and handles them, which is cheaper than pulling in a triangulation library for
 * 72 rings.
 */
export function triangulateRing(ring: number[]): number[] {
  const n = ring.length / 2;
  if (n < 3) return [];
  const indices = Array.from({ length: n }, (_, i) => i);
  const x = (i: number) => ring[i * 2], y = (i: number) => ring[i * 2 + 1];

  const area = () => {
    let total = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) total += x(j) * y(i) - x(i) * y(j);
    return total / 2;
  };
  // Work counter-clockwise so the ear test's sign is consistent.
  if (area() < 0) indices.reverse();

  const inTriangle = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, px: number, py: number) => {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };

  const out: number[] = [];
  let guard = indices.length * 3;
  while (indices.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < indices.length; i++) {
      const a = indices[(i - 1 + indices.length) % indices.length];
      const b = indices[i];
      const c = indices[(i + 1) % indices.length];
      const cross = (x(b) - x(a)) * (y(c) - y(a)) - (y(b) - y(a)) * (x(c) - x(a));
      if (cross <= 0) continue;                                  // reflex, not an ear
      let contains = false;
      for (const other of indices) {
        if (other === a || other === b || other === c) continue;
        if (inTriangle(x(a), y(a), x(b), y(b), x(c), y(c), x(other), y(other))) { contains = true; break; }
      }
      if (contains) continue;
      out.push(x(a), y(a), x(b), y(b), x(c), y(c));
      indices.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;                                          // degenerate; stop rather than spin
  }
  if (indices.length === 3) {
    for (const i of indices) out.push(x(i), y(i));
  }
  return out;
}

/** Water surface geometry, flat at the published level. */
export function waterGeometry(extract: Lod22Extract): { positions: number[]; normals: number[] } {
  const positions: number[] = [], normals: number[] = [];
  if (!extract.water) return { positions, normals };
  const z = extract.water.levelNap;
  for (const ring of extract.water.rings) {
    const flat = triangulateRing(ring);
    for (let i = 0; i < flat.length; i += 2) {
      positions.push(flat[i], flat[i + 1], z);
      normals.push(0, 0, 1);
    }
  }
  return { positions, normals };
}

export type ColourMode = 'massing' | 'height' | 'evidence' | 'facade';

/**
 * Named wall materials, as flat colours for the massing layer.
 *
 * A subset of the full vocabulary in `materials.ts`, inlined so the layer has
 * no import cycle and so a renderer with no texture pack still shows what was
 * measured. The texture slots live with the materials; these are the fallbacks.
 */
export const WALL_COLOURS: Record<string, number> = {
  'brick-red': 0x9c4b39, 'brick-red-brown': 0x8a5a44, 'brick-purple-brown': 0x6f4a45,
  'brick-yellow': 0xb09a6f, 'brick-grey': 0x7d7873,
  'painted-white': 0xe5e2d9, 'painted-cream': 0xd8cdb4, 'painted-grey': 0x9aa0a0,
  'painted-black': 0x2b2b2b, 'painted-green': 0x26433a,
  'sandstone': 0xcdc3ab, 'stucco': 0xded6c8,
};

/** Glass, for a measured opening. */
export const GLASS_COLOUR = 0x2f3a40;

/**
 * Joinery and stonework, for the parts that are drawn rather than measured.
 *
 * White frames and a pale sill against a dark wall is the single strongest cue
 * this fabric gives at a distance, so it gets a colour of its own rather than
 * inheriting the wall's. Not quite white: painted joinery outdoors reads warm
 * and slightly grey, and pure white against measured brick looks like a decal.
 */
export const FRAME_COLOUR = 0xe8e4d9;
export const SILL_COLOUR = 0xbdb6a6;
/**
 * A front door reads as a solid panel, not as glass.
 *
 * Drawing doors as dark panes is what made the ground floor of every building
 * look like another storey of windows. Painted joinery in a dark colour — the
 * near-black green and oxblood this fabric actually uses — is what separates a
 * doorway from the window beside it at any distance.
 */
export const DOOR_COLOUR = 0x24312c;
/**
 * The hijsbalk: the hoist beam under the gable.
 *
 * Canal houses are deep, their stairs are famously impossible, and everything
 * large came in through the windows — so a beam projects from the gable with a
 * hook on it, and on most of this fabric it is still there. It is one of the
 * two or three details that say "Amsterdam" rather than "old European city",
 * which is why it is worth drawing even though it is generated rather than
 * measured.
 */
export const BEAM_COLOUR = 0x3b3129;
/** The cornice. Painted the same as the joinery, being the same trade. */
export const TRIM_COLOUR = 0xdcd6c8;

/** Buildings whose front has been observed read differently from those that have not. */
export const FACADE_COLOURS = { observed: 0x1baf7a, unobserved: 0x3d4548 } as const;

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
  /** A gable type the register named in prose. Weaker than a measurement. */
  stated: 0x4a9fd8,
  /** Drawn from the vocabulary. Nobody observed this; it is here to look right. */
  generated: 0x8a6bbf,
} as const;

export function colourFor(building: Lod22Building, mode: ColourMode, part: GeometryPart): number {
  // Trim is joinery in every mode but evidence, where the point is to show what
  // was measured and trim was not.
  if (part === 'trim' && mode !== 'evidence') return TRIM_COLOUR;
  if (mode === 'facade') {
    // The roof is tiled, not painted, and a measured roof colour is a separate
    // pipeline; until it lands, a slate that reads as slate beats a green that
    // reads as nothing. The gable is wall — it *is* the front wall, continued.
    if (part === 'roof') return building.facade ? 0x585f5e : 0x3a4143;
    // Where a wall material was measured, show it; where the front was observed
    // but the colour was not, fall back to the observed marker rather than to a
    // brick that was never seen.
    if (!building.facade) return FACADE_COLOURS.unobserved;
    const measured = building.facade.wallMaterial ? WALL_COLOURS[building.facade.wallMaterial] : undefined;
    return measured ?? FACADE_COLOURS.observed;
  }
  if (mode === 'massing') return part === 'roof' ? MASSING_ROOF : MASSING_WALL;
  const { ridge, estimated } = drawableHeights(building);
  if (mode === 'height') {
    const band = HEIGHT_BANDS.find(([max]) => ridge <= max) ?? HEIGHT_BANDS[HEIGHT_BANDS.length - 1];
    return band[1];
  }
  // Evidence mode reports provenance, so the drawn vocabulary has to declare
  // itself: an assumed gable and a cornice nobody measured are not evidence of
  // anything, and colouring them like the massing would launder them into it.
  if (part === 'trim') return EVIDENCE_COLOURS.generated;
  if (part === 'gable') {
    return gableFor(building).stated ? EVIDENCE_COLOURS.stated : EVIDENCE_COLOURS.generated;
  }
  if (estimated) return EVIDENCE_COLOURS.estimated;
  return building.reason === 'inverted' || building.reason === 'impossible'
    ? EVIDENCE_COLOURS.inverted
    : EVIDENCE_COLOURS.measured;
}

/**
 * The plot's own frame: along the street, and into the plot.
 *
 * Everything above the eaves is built in this frame rather than on the
 * footprint ring, because a canal-house roof is a property of the *plot* — one
 * ridge running front to back — and not of whatever the registry's ring does at
 * a light well or a rear annexe. Following the ring upward is what produced the
 * old centroid-tapered roof, and a shape tapered toward its own centroid is a
 * marquee, not a house.
 *
 * Where the front has been observed, the front wall gives the frame directly.
 * Where it has not, the longest edge stands in: the plots here are long and
 * narrow, so the longest edge runs front-to-back and the ridge runs with it.
 * That is the same rule either way, just measured with a worse instrument.
 */
function plotFrame(building: Lod22Building):
  { ox: number; oy: number; ux: number; uy: number; nx: number; ny: number } | null {
  const ring = building.ring, count = ring.length / 2;
  if (count < 3) return null;

  if (building.facade) {
    const [x0, y0, x1, y1] = building.facade.wall;
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (length >= 0.5) {
      const ux = (x1 - x0) / length, uy = (y1 - y0) / length;
      // Into the plot, away from the street: the opposite of the outward normal
      // the openings are set proud along.
      return { ox: x0, oy: y0, ux, uy, nx: -uy, ny: ux };
    }
  }

  // No observed front. Take the longest edge as the depth axis, so the ridge
  // runs along the plot rather than across it.
  let best = -1, bx = 1, by = 0;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const dx = ring[j * 2] - ring[i * 2], dy = ring[j * 2 + 1] - ring[i * 2 + 1];
    const length = Math.hypot(dx, dy);
    if (length > best) { best = length; bx = dx / length; by = dy / length; }
  }
  if (best <= 0) return null;
  // The long edge is the depth axis, so `u` — across the plot — is its normal.
  return { ox: ring[0], oy: ring[1], ux: -by, uy: bx, nx: bx, ny: by };
}

/**
 * Which gable this building gets, and whether anybody said so.
 *
 * The rule the project turns on applies to the *type*, not to the roof: the
 * ridge height is measured from laser altimetry for almost every building here,
 * so a pitched roof is a measurement and drawing one is reporting it. Which
 * shaped gable screens that roof from the street is not measured anywhere, and
 * is stated in prose by the register for 636 of the 3,025. So: state it where
 * stated, assume it from the construction year where not, and mark the
 * difference so the evidence mode can show which is which.
 *
 * A building with no observed front gets `punt` — a plain triangle. It is the
 * least any pitched roof can end in, so it invents the least. A klokgevel on a
 * building nobody has photographed would be a confident lie about the exact
 * thing this façade twin exists to avoid lying about.
 */
export function gableFor(building: Lod22Building): { type: GableType; stated: boolean } {
  if (building.gable) return building.gable;
  if (!building.facade) return { type: 'punt', stated: false };
  return { type: assumedGable(building.year ?? null), stated: false };
}

/**
 * Build the geometry for one building, in metres in the extract's local frame.
 *
 * Returned as plain arrays so this is testable without a WebGL context — the
 * layer turns them into buffers. Walls are the footprint extruded to the eaves.
 * Above that the plot frame takes over: one ridge front-to-back, two roof
 * planes falling to the party walls, a shaped gable screening the front and a
 * plain triangle closing the back.
 *
 * `part` distinguishes what is being reported from what is being drawn around
 * it. `wall` and `roof` are massing, and are measured. `gable` and `trim` are
 * the generated vocabulary — the shape of the gable and the cornice under it —
 * and a renderer that wants to show only what was measured can drop them.
 */
export type GeometryPart = 'wall' | 'roof' | 'gable' | 'trim';

/** Projecting depth and height of the cornice under a gable, in metres. */
const CORNICE = { project: 0.22, height: 0.30 };

export function buildingGeometry(building: Lod22Building):
  { positions: number[]; normals: number[]; isRoof: boolean[]; part: GeometryPart[] } {
  const ring = building.ring;
  const count = ring.length / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const isRoof: boolean[] = [];
  const part: GeometryPart[] = [];
  if (count < 3) return { positions, normals, isRoof, part };

  const { eaves, ridge } = drawableHeights(building);
  const base = building.ground;
  const top = base + eaves;

  let cx = 0, cy = 0;
  for (let i = 0; i < count; i++) { cx += ring[i * 2]; cy += ring[i * 2 + 1]; }
  cx /= count; cy /= count;

  /**
   * A quad, wound so its front face points out of the building.
   *
   * Winding cannot be assumed here. BAG footprint rings arrive in both
   * directions — the registry does not promise an orientation — and the plot
   * frame's normal flips with them, so quads written in a fixed vertex order
   * came out front-facing on some buildings and back-facing on others. The GPU
   * discards back faces, so those buildings rendered with holes in their roofs
   * and walls that you could see straight through into a dark interior. It is
   * not a rendering setting to paper over with `DoubleSide`: a face whose
   * normal points into the building is also lit as though the sun were inside.
   *
   * So every face is checked against the building's own centre and flipped if
   * it is facing inward. Sound for the shapes here, which are extrusions and
   * roofs over a single footprint.
   */
  const quad = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
                kind: GeometryPart) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-9) return;                       // collapsed; contributes nothing
    nx /= length; ny /= length; nz /= length;
    // Does it face away from the building's middle?
    const fx = (a[0] + b[0] + c[0] + d[0]) / 4 - cx;
    const fy = (a[1] + b[1] + c[1] + d[1]) / 4 - cy;
    const fz = (a[2] + b[2] + c[2] + d[2]) / 4 - (base + eaves / 2);
    const order = (nx * fx + ny * fy + nz * fz) < 0
      ? [a, c, b, a, d, c]                           // inward: reverse the winding
      : [a, b, c, a, c, d];
    if ((nx * fx + ny * fy + nz * fz) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    for (const pt of order) {
      positions.push(pt[0], pt[1], pt[2]);
      normals.push(nx, ny, nz);
      isRoof.push(kind === 'roof');
      part.push(kind);
    }
  };

  // Walls, base to eaves, on the footprint the registry published.
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const x0 = ring[i * 2], y0 = ring[i * 2 + 1];
    const x1 = ring[j * 2], y1 = ring[j * 2 + 1];
    quad([x0, y0, base], [x1, y1, base], [x1, y1, top], [x0, y0, top], 'wall');
  }

  const rise = ridge - eaves;
  const frame = plotFrame(building);
  if (rise <= 0.15 || !frame) return { positions, normals, isRoof, part };

  // Extent of the footprint in the plot's own frame: `s` across the frontage,
  // `d` into the plot.
  const { ox, oy, ux, uy, nx, ny } = frame;
  let sMin = Infinity, sMax = -Infinity, dMin = Infinity, dMax = -Infinity;
  for (let i = 0; i < count; i++) {
    const px = ring[i * 2] - ox, py = ring[i * 2 + 1] - oy;
    const s = px * ux + py * uy, d = px * nx + py * ny;
    if (s < sMin) sMin = s; if (s > sMax) sMax = s;
    if (d < dMin) dMin = d; if (d > dMax) dMax = d;
  }
  const width = sMax - sMin, depth = dMax - dMin;
  if (width < 1 || depth < 1) return { positions, normals, isRoof, part };

  /**
   * Is this actually a canal plot?
   *
   * Everything above the eaves is built in the plot frame — one ridge front to
   * back, two planes to the party walls, a gable screening the front — and all
   * of that is true of a canal house and false of a church, a warehouse, a
   * 1960s block or an L-shaped corner site. Applied to those, it spans the
   * bounding box rather than the footprint and throws long triangular shards
   * out over the neighbours, which is exactly what it did.
   *
   * The boundary's own numbers draw the line. Median frontage is 6.0 m and the
   * plots are far deeper than wide, so: no wider than 15 m, at least as deep as
   * it is wide, and filling at least 65% of its own bounding box, which is what
   * separates a rectangle from an L. That leaves out roughly a fifth of the
   * boundary, and a fifth of the boundary is not canal houses.
   *
   * What the rest gets is the old centroid taper. It is a dull roof and it is
   * not what those buildings have, but it is contained by the footprint, and a
   * dull roof in the right place beats a dramatic one in the wrong place.
   */
  let ringArea = 0;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    ringArea += ring[j * 2] * ring[i * 2 + 1] - ring[i * 2] * ring[j * 2 + 1];
  }
  const fill = Math.abs(ringArea / 2) / (width * depth);
  const isCanalPlot = width <= 15 && depth >= width && fill >= 0.65;

  if (!isCanalPlot) {
    // Tapered toward the centroid, so it cannot leave the footprint.
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const x0 = ring[i * 2], y0 = ring[i * 2 + 1];
      const x1 = ring[j * 2], y1 = ring[j * 2 + 1];
      const rx0 = cx + (x0 - cx) * 0.22, ry0 = cy + (y0 - cy) * 0.22;
      const rx1 = cx + (x1 - cx) * 0.22, ry1 = cy + (y1 - cy) * 0.22;
      quad([x0, y0, top], [x1, y1, top], [rx1, ry1, base + ridge], [rx0, ry0, base + ridge], 'roof');
    }
    return { positions, normals, isRoof, part };
  }

  // World point from plot coordinates.
  const at = (s: number, d: number, z: number): [number, number, number] =>
    [ox + ux * s + nx * d, oy + uy * s + ny * d, z];

  const sc = (sMin + sMax) / 2;
  const zTop = base + ridge;

  // Two roof planes, falling from the ridge to the party walls at the eaves.
  quad(at(sMin, dMin, top), at(sMin, dMax, top), at(sc, dMax, zTop), at(sc, dMin, zTop), 'roof');
  quad(at(sc, dMin, zTop), at(sc, dMax, zTop), at(sMax, dMax, top), at(sMax, dMin, top), 'roof');
  // The back closes with a plain triangle. Nobody has seen it; nobody gets a
  // klokgevel on the side they cannot see from the canal.
  quad(at(sMin, dMax, top), at(sc, dMax, zTop), at(sMax, dMax, top), at(sMax, dMax, top), 'roof');

  // Close the front of the roof volume with a plain triangle, *before* the
  // shaped gable goes on.
  //
  // This is structure, not decoration, and leaving it out left holes. The roof
  // planes rise in a straight line from the eaves at the party wall to the ridge
  // at the centre; a shaped gable does not follow that line — a `lijst` stops at
  // half the rise, a `klok` swells and tucks — so wherever the profile sits
  // below the roof's leading edge there was nothing at all between them. What
  // showed through was the *back* of the far roof plane, which is culled, so it
  // read as a black hole punched in the roof. A canal house has a real gable
  // wall behind its shaped one; now so does this.
  const { type } = gableFor(building);
  quad(at(sMin, dMin, top), at(sc, dMin, zTop), at(sMax, dMin, top), at(sMax, dMin, top), 'gable');

  // The shaped gable, a screen wall standing a little in front of that — which
  // is what it is in life, and the reason a canal frontage reads as a row of
  // distinct silhouettes rather than as one continuous roofline.
  const profile = gableProfile(type, width, rise);
  // A hair proud of the wall below, so the two coplanar surfaces cannot fight
  // for the same pixels along the eaves line where they meet.
  const front = dMin - 0.02;
  for (let i = 0; i + 1 < profile.length; i++) {
    const [a0, h0] = profile[i], [a1, h1] = profile[i + 1];
    const s0 = sMin + a0, s1 = sMin + a1;
    quad(at(s0, front, top), at(s1, front, top),
         at(s1, front, top + h1), at(s0, front, top + h0), 'gable');
  }

  // The cornice under it. A projecting band is close to universal on this
  // fabric and it is what stops a wall from ending as a bare cut edge, but it
  // is drawn from the vocabulary, not measured, so it is tagged as trim.
  const cs = CORNICE.project, ch = CORNICE.height;
  const cz = top - ch, out = dMin - cs;
  quad(at(sMin, out, cz), at(sMax, out, cz), at(sMax, out, top), at(sMin, out, top), 'trim');
  quad(at(sMin, out, top), at(sMax, out, top), at(sMax, dMin, top), at(sMin, dMin, top), 'trim');
  quad(at(sMin, dMin, cz), at(sMax, dMin, cz), at(sMax, out, cz), at(sMin, out, cz), 'trim');

  return { positions, normals, isRoof, part };
}

/**
 * Measured openings, as recessed reveals on the front wall.
 *
 * These used to be flat rectangles set 5 cm proud of the wall, on the reasoning
 * that at the distance a rider reads this from, a plane and a real reveal are
 * indistinguishable. That was wrong, and wrong in a way a screenshot settles:
 * a proud dark rectangle reads as a *sticker*, because the one cue that says
 * "hole" is the shadow down one side of the reveal.
 *
 * The first attempt at fixing it was worse: it set the glass 140 mm *behind*
 * the wall plane, which would be right if the wall had a hole in it. The wall
 * is an unbroken extrusion of the footprint, so every pane went inside the
 * building where nothing can see it, and the only part left visible was the
 * sill, which projects. A terrace rendered as rows of little white dashes.
 *
 * Cutting real apertures means triangulating a polygon with holes for 1,340
 * façades, and it buys nothing at the distance this is read from. So the depth
 * is built *outward* instead: the pane sits just proud of the wall, and the
 * joinery around it stands proud of the pane. The frame's inner faces then
 * point back at the glass and catch no sun, which puts the shadow exactly where
 * a reveal would put it. Same cue, no boolean.
 *
 * The frame is the other half. Amsterdam glazing sits in white-painted joinery
 * against a dark wall, and that contrast is most of what makes a canal
 * elevation legible at a distance — it is the reason the fabric reads as rows
 * of bright verticals rather than as a wall with dents. The *positions* here
 * are measured; that there is a frame at all, and that it is white, is drawn
 * from the vocabulary, so the frame is tagged separately from the glass.
 *
 * Returns nothing for a building whose front has not been observed. That is the
 * rule the whole project turns on: no façade without an observation of it.
 */
export type OpeningPart = 'glass' | 'frame' | 'sill' | 'door' | 'beam';

/**
 * What an opening *is*, read from the rectangle that was measured.
 *
 * The detector measures rectangles and nothing had ever said what they were, so
 * every one of them drew as glass and the canal ring had no front doors in it
 * at all. Classification here is honest because it uses only measured
 * quantities — where the opening sits relative to this building's own ground,
 * and its proportions — and no prior about what a house ought to have. A tall
 * narrow opening standing on the pavement is a door in any city; a wide one is
 * a shopfront; anything below the pavement is a souterrain, which on these
 * plots is a real storey and not an error.
 *
 * The one thing it cannot do is tell a door from a very tall window that
 * happens to reach the ground, and it does not pretend to: `door` is a reading
 * of a shape, which is why it is drawn as a panel rather than asserted in a
 * record.
 */
export type OpeningKind = 'window' | 'door' | 'shopfront' | 'souterrain';

export function classifyOpening(
  aboveGroundM: number, widthM: number, heightM: number,
): OpeningKind {
  const top = aboveGroundM + heightM;
  // Entirely below the pavement, or nearly so: the basement storey a canal
  // house is entered *over*, up its stoep.
  if (top <= 0.9) return 'souterrain';
  if (aboveGroundM <= -0.35) return 'souterrain';
  // Standing on the pavement.
  if (aboveGroundM < 0.7 && heightM >= 1.9) {
    if (widthM > 2.0 || (widthM > 1.5 && heightM < 2.6)) return 'shopfront';
    if (heightM / widthM >= 1.5) return 'door';
    return 'shopfront';
  }
  return 'window';
}

/**
 * The window assembly, in metres.
 *
 * `glass` clears the wall by just enough not to fight it for pixels; `frame`
 * is how far the joinery stands proud of the pane, which is what casts the
 * shadow that reads as depth; `width` is the joinery's face width and `sill`
 * how far the sill throws water clear.
 */
const REVEAL = { glass: 0.02, frame: 0.11, width: 0.09, sill: 0.07 };

export function openingGeometry(building: Lod22Building):
  { positions: number[]; normals: number[]; part: OpeningPart[] } {
  const positions: number[] = [];
  const normals: number[] = [];
  const part: OpeningPart[] = [];
  if (!building.facade?.openings.length) return { positions, normals, part };

  const [x0, y0, x1, y1] = building.facade.wall;
  const length = Math.hypot(x1 - x0, y1 - y0);
  if (length < 0.5) return { positions, normals, part };
  const ux = (x1 - x0) / length, uy = (y1 - y0) / length;
  // Outward normal, to the right of the wall's own direction.
  const nx = uy, ny = -ux;

  // A point on the wall: `s` along it, `d` proud of it, `z` absolute.
  const at = (s: number, d: number, z: number): [number, number, number] =>
    [x0 + ux * s + nx * d, y0 + uy * s + ny * d, z];

  const quad = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
                kind: OpeningPart) => {
    const vx0 = b[0] - a[0], vy0 = b[1] - a[1], vz0 = b[2] - a[2];
    const vx1 = c[0] - a[0], vy1 = c[1] - a[1], vz1 = c[2] - a[2];
    const mx = vy0 * vz1 - vz0 * vy1, my = vz0 * vx1 - vx0 * vz1, mz = vx0 * vy1 - vy0 * vx1;
    const len = Math.hypot(mx, my, mz);
    if (len < 1e-9) return;
    for (const pt of [a, b, c, a, c, d]) {
      positions.push(pt[0], pt[1], pt[2]);
      normals.push(mx / len, my / len, mz / len);
      part.push(kind);
    }
  };

  for (const [along, up, width, height] of building.facade.openings) {
    if (along < -0.5 || along > length + 0.5) continue;   // outside its own wall
    if (width < 0.2 || height < 0.2) continue;
    const s0 = along, s1 = along + width;
    const zb = building.ground + up, zt = zb + height;
    const g = REVEAL.glass, f = REVEAL.frame;
    const w = Math.min(REVEAL.width, width / 3, height / 3);

    // Glass, or a solid door leaf where the shape says door.
    const kind = classifyOpening(up, width, height);
    quad(at(s0 + w, g, zb + w), at(s1 - w, g, zb + w),
         at(s1 - w, g, zt - w), at(s0 + w, g, zt - w),
         kind === 'door' ? 'door' : 'glass');

    // Joinery: four bands standing proud of the pane. Outer face first, then
    // the inner face that looks back across the glass — that one faces away
    // from the sun and is the shadow a reveal would cast.
    const band = (a0: number, a1: number, b0: number, b1: number) => {
      quad(at(a0, f, b0), at(a1, f, b0), at(a1, f, b1), at(a0, f, b1), 'frame');
    };
    band(s0, s1, zb, zb + w);                       // cill piece
    band(s0, s1, zt - w, zt);                       // head
    band(s0, s0 + w, zb + w, zt - w);               // left stile
    band(s1 - w, s1, zb + w, zt - w);               // right stile

    // The returns, from the joinery's proud face back down to the pane.
    quad(at(s0 + w, f, zb + w), at(s1 - w, f, zb + w), at(s1 - w, g, zb + w), at(s0 + w, g, zb + w), 'frame');
    quad(at(s0 + w, g, zt - w), at(s1 - w, g, zt - w), at(s1 - w, f, zt - w), at(s0 + w, f, zt - w), 'frame');
    quad(at(s0 + w, g, zb + w), at(s0 + w, g, zt - w), at(s0 + w, f, zt - w), at(s0 + w, f, zb + w), 'frame');
    quad(at(s1 - w, f, zb + w), at(s1 - w, f, zt - w), at(s1 - w, g, zt - w), at(s1 - w, g, zb + w), 'frame');

    // A sill, throwing water clear of the wall below — but only on a window.
    // A door and a shopfront meet the pavement, and putting a projecting stone
    // sill across a doorway is drawing a step nobody measured.
    if (kind === 'window' || kind === 'souterrain') {
      const p = REVEAL.sill;
      quad(at(s0 - p, p, zb), at(s1 + p, p, zb), at(s1 + p, g, zb), at(s0 - p, g, zb), 'sill');
      quad(at(s0 - p, p, zb - p), at(s1 + p, p, zb - p), at(s1 + p, p, zb), at(s0 - p, p, zb), 'sill');
    }
  }

  /**
   * The hijsbalk, under the apex of the gable.
   *
   * Generated, not measured — the detector looks for openings and a beam is not
   * one. It is included because it is nearly universal on this fabric and
   * because its absence is conspicuous: a canal gable without one reads as a
   * model of a canal house rather than a canal house. Placed at the centre of
   * the frontage just under the ridge, which is where the thing it lifts has to
   * come through.
   */
  const beamTop = building.ridge ?? building.eaves;
  if (beamTop !== null && (building.ridge ?? 0) - (building.eaves ?? 0) > 1.2) {
    const centre = length / 2;
    const z = building.ground + beamTop - 0.75;
    const half = 0.075, reach = 0.55;
    // A square section standing out of the gable, drawn on its four long faces.
    quad(at(centre - half, 0, z - half), at(centre + half, 0, z - half),
         at(centre + half, reach, z - half), at(centre - half, reach, z - half), 'beam');
    quad(at(centre - half, reach, z + half), at(centre + half, reach, z + half),
         at(centre + half, 0, z + half), at(centre - half, 0, z + half), 'beam');
    quad(at(centre - half, 0, z - half), at(centre - half, reach, z - half),
         at(centre - half, reach, z + half), at(centre - half, 0, z + half), 'beam');
    quad(at(centre + half, reach, z - half), at(centre + half, 0, z - half),
         at(centre + half, 0, z + half), at(centre + half, reach, z + half), 'beam');
    // The end face, where the hook hangs.
    quad(at(centre - half, reach, z - half), at(centre + half, reach, z - half),
         at(centre + half, reach, z + half), at(centre - half, reach, z + half), 'beam');
  }
  return { positions, normals, part };
}

/** Every building whose footprint the boundary contains, for tier ownership. */
export const ownedPandIds = (extract: Lod22Extract): Set<string> =>
  new Set(extract.buildings.map(building => building.id));
