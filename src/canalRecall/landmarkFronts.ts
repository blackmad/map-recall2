// Landmark fronts: a low-poly relief for the one street wall that makes a
// landmark recognisable, in flat colours that match the rest of the city.
//
// A kit (landmarkKits.ts) gives a landmark its silhouette from above: towers,
// spires, pitched roofs. It says nothing about a front, so a building known by
// its elevation (the Bijenkorf's arched pediment and deep cornices, the Beurs's
// row of stepped gables) stays a blank box. A front is that elevation, modelled
// as a handful of boxes on the wall plane: a profiled wall slab, projecting
// cornices and pilasters, recessed window panes and shopfronts.
//
// Measurements come from rectified street panoramas, used as a drawing
// reference only: no photo pixels reach the game, so there is no texture
// licence to clear and nothing that clashes with the flat-shaded city.

export type FrontBox = {
  /** Along the wall from its start, metres. */ x0: number; x1: number;
  /** Height above the wall's base, metres. */ z0: number; z1: number;
  /** Out from the wall plane (negative is recessed), metres. */ out0?: number; out1: number;
  hex: string;
};
/** A repeating window grid: one pane per (column, row), recessed into the wall with a sill. */
export type FrontWindows = { xs: number[]; rows: [number, number][]; w: number; hex: string; frameHex?: string };
export type Front = {
  name: string;
  /** The wall's two ends, as [lng, lat], walking with the building on the left (outward to the right). */
  start: [number, number]; end: [number, number];
  /** The wall slab's roofline as [alongM, topM] points, left to right. */
  outline: [number, number][];
  /**
   * Where the footprint part behind the front really stops. OSM gives one height for the
   * whole part (its highest point), so without this the plain prism rises flat-topped
   * behind a pediment or row of gables and hides them.
   */
  bodyTopM?: number;
  /** Thickness of the slab in front of the footprint wall, metres. */
  depthM: number;
  hex: string;
  boxes: FrontBox[];
  windows: FrontWindows[];
};

/** Points along an arch springing at (x0, z) to (x1, z) and rising `rise` metres. */
export function arch(x0: number, x1: number, z: number, rise: number, segments = 8): [number, number][] {
  const r = ((x1 - x0) ** 2 / 4 + rise ** 2) / (2 * rise), cx = (x0 + x1) / 2, cz = z + rise - r;
  const half = Math.asin((x1 - x0) / 2 / r);
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = -half + (2 * half * i) / segments;
    return [cx + r * Math.sin(a), cz + r * Math.cos(a)] as [number, number];
  });
}

/** A triangle in local metres: x east, y north, z up. */
export type FrontTri = { p: [number, number, number][]; hex: string };

/** Wall-frame triangles: x along the wall, z up, y outward. `toWorld` places them. */
export function frontTriangles(front: Front, toWorld: (along: number, up: number, out: number) => [number, number, number]): FrontTri[] {
  const tris: FrontTri[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], hex: string) => {
    const [pa, pb, pc, pd] = [a, b, c, d].map(([x, z, y]) => toWorld(x, z, y));
    tris.push({ p: [pa, pb, pc], hex }, { p: [pa, pc, pd], hex });
  };
  const box = ({ x0, x1, z0, z1, out0 = 0, out1, hex }: FrontBox) => {
    // Front, two sides, top and underside; the back sits against the wall.
    quad([x0, z0, out1], [x1, z0, out1], [x1, z1, out1], [x0, z1, out1], hex);
    quad([x0, z0, out0], [x0, z0, out1], [x0, z1, out1], [x0, z1, out0], hex);
    quad([x1, z0, out1], [x1, z0, out0], [x1, z1, out0], [x1, z1, out1], hex);
    quad([x0, z1, out1], [x1, z1, out1], [x1, z1, out0], [x0, z1, out0], hex);
    quad([x0, z0, out0], [x1, z0, out0], [x1, z0, out1], [x0, z0, out1], hex);
  };

  // The profiled slab: x-monotone, so a vertical strip per outline segment covers it.
  const d = front.depthM, o = front.outline;
  for (let i = 1; i < o.length; i++) {
    const [xa, za] = o[i - 1], [xb, zb] = o[i];
    if (xb <= xa) continue;
    quad([xa, 0, d], [xb, 0, d], [xb, zb, d], [xa, za, d], front.hex);
    quad([xa, za, d], [xb, zb, d], [xb, zb, 0], [xa, za, 0], front.hex);
  }
  const [xs, zs] = o[0], [xe, ze] = o[o.length - 1];
  quad([xs, 0, 0], [xs, 0, d], [xs, zs, d], [xs, zs, 0], front.hex);
  quad([xe, 0, d], [xe, 0, 0], [xe, ze, 0], [xe, ze, d], front.hex);

  for (const b of front.boxes) box({ ...b, out0: (b.out0 ?? 0) + d, out1: b.out1 + d });
  for (const grid of front.windows) for (const cx of grid.xs) for (const [z0, z1] of grid.rows) {
    const x0 = cx - grid.w / 2, x1 = cx + grid.w / 2;
    // A pane just proud of the slab face, a lighter frame round it and a sill below.
    box({ x0: x0 - 0.12, x1: x1 + 0.12, z0: z0 - 0.12, z1: z1 + 0.12, out0: d, out1: d + 0.04, hex: grid.frameHex ?? '#d8d0c0' });
    box({ x0, x1, z0, z1, out0: d, out1: d + 0.07, hex: grid.hex });
    box({ x0: x0 - 0.2, x1: x1 + 0.2, z0: z0 - 0.3, z1: z0 - 0.12, out0: d, out1: d + 0.25, hex: front.hex });
  }
  return tris;
}
