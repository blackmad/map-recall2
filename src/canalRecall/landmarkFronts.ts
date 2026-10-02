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
  /** OSM/BAG footprint parts that carry the front; the first also names its geometry, so hiding it hides the front. */
  ids: string[];
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
  /**
   * How the roofline can be checked against the reference photo: 'full' (default), 'front-only'
   * when roofs or towers behind the front show above it in the photo (only a front taller than
   * the photo is an error), or 'unmeasured' when the photo does not reach the top.
   */
  roofline?: 'full' | 'front-only' | 'unmeasured';
  /** Thickness of the slab in front of the footprint wall, metres. */
  depthM: number;
  hex: string;
  boxes: FrontBox[];
  windows: FrontWindows[];
  /**
   * Further profiled slabs standing forward of the wall (a risalit with its pediment): each
   * runs from z = 0 up to its own roofline, between `out0` and `out1` metres out.
   */
  slabs?: { outline: [number, number][]; out0: number; out1: number; hex: string }[];
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
/** `hint` is the face's outward direction in the wall frame [along, up, out], for winding. */
export type FrontTri = { p: [number, number, number][]; hex: string; hint: [number, number, number] };

/** Wall-frame triangles: x along the wall, z up, y outward. `toWorld` places them. */
export function frontTriangles(front: Front, toWorld: (along: number, up: number, out: number) => [number, number, number]): FrontTri[] {
  const tris: FrontTri[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], hex: string, hint: [number, number, number]) => {
    const [pa, pb, pc, pd] = [a, b, c, d].map(([x, z, y]) => toWorld(x, z, y));
    tris.push({ p: [pa, pb, pc], hex, hint }, { p: [pa, pc, pd], hex, hint });
  };
  const box = ({ x0, x1, z0, z1, out0 = 0, out1, hex }: FrontBox) => {
    // Front, two sides, top and underside; the back sits against the wall.
    quad([x0, z0, out1], [x1, z0, out1], [x1, z1, out1], [x0, z1, out1], hex, [0, 0, 1]);
    quad([x0, z0, out0], [x0, z0, out1], [x0, z1, out1], [x0, z1, out0], hex, [-1, 0, 0]);
    quad([x1, z0, out1], [x1, z0, out0], [x1, z1, out0], [x1, z1, out1], hex, [1, 0, 0]);
    quad([x0, z1, out1], [x1, z1, out1], [x1, z1, out0], [x0, z1, out0], hex, [0, 1, 0]);
    quad([x0, z0, out0], [x1, z0, out0], [x1, z0, out1], [x0, z0, out1], hex, [0, -1, 0]);
  };

  // A profiled slab is x-monotone, so a vertical strip per outline segment covers it.
  const slab = (o: [number, number][], o0: number, o1: number, hex: string) => {
    for (let i = 1; i < o.length; i++) {
      const [xa, za] = o[i - 1], [xb, zb] = o[i];
      if (xb <= xa) continue;
      quad([xa, 0, o1], [xb, 0, o1], [xb, zb, o1], [xa, za, o1], hex, [0, 0, 1]);
      quad([xa, za, o1], [xb, zb, o1], [xb, zb, o0], [xa, za, o0], hex, [-(zb - za), xb - xa, 0]);
    }
    const [xs, zs] = o[0], [xe, ze] = o[o.length - 1];
    quad([xs, 0, o0], [xs, 0, o1], [xs, zs, o1], [xs, zs, o0], hex, [-1, 0, 0]);
    quad([xe, 0, o1], [xe, 0, o0], [xe, ze, o0], [xe, ze, o1], hex, [1, 0, 0]);
  };
  const d = front.depthM;
  slab(front.outline, 0, d, front.hex);
  for (const extra of front.slabs ?? []) slab(extra.outline, extra.out0 + d, extra.out1 + d, extra.hex);

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

// --- Game adapter -----------------------------------------------------------

export type FrontLook = 'procedural' | 'untextured' | 'photo' | 'storybook' | 'cartoon';

const toHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const fromHsl = ([h, s, l]: [number, number, number]) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0')).join('');
};

/**
 * A front's colours per Building look. Fronts are authored in measured, natural colours
 * (the photo look); storybook warms and lifts them a little and cartoon saturates them, so a
 * landmark sits in each look like its neighbours do without per-look authoring.
 */
export function lookHex(hex: string, look: FrontLook): string {
  if (look === 'photo' || look === 'procedural' || look === 'untextured') return hex;
  const [h, s, l] = toHsl(hex);
  if (look === 'storybook') return fromHsl([(h + 360 - 4) % 360, Math.min(1, s * 1.15), Math.min(0.9, l + 0.03)]);
  // Cartoon: punchy but not neon; darks (glass, iron) stay dark so windows still read.
  return fromHsl([h, Math.min(1, s * 1.7 + 0.08), l < 0.35 ? l : Math.min(0.85, l * 1.08)]);
}

/** A front as landmark-kit triangles in local metres from `origin` (x east, y north, z up). */
export function frontKitGeometry(front: Front, origin: { lng: number; lat: number }, look: FrontLook) {
  const kx = 111_320 * Math.cos(origin.lat * Math.PI / 180), ky = 110_540;
  const local = ([lng, lat]: [number, number]) => [(lng - origin.lng) * kx, (lat - origin.lat) * ky];
  const [ax, ay] = local(front.start), [bx, by] = local(front.end), len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len, uy = (by - ay) / len, ox = uy, oy = -ux;
  const colours = new Map<string, string>();
  const tris = frontTriangles(front, (along, up, out) => [ax + ux * along + ox * out, ay + uy * along + oy * out, up]).flatMap(t => {
    let [a, b, c] = t.p as [[number, number, number], [number, number, number], [number, number, number]];
    const [ha, hu, ho] = t.hint, hint = [ux * ha + ox * ho, uy * ha + oy * ho, hu];
    const raw = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    if (raw[0] * hint[0] + raw[1] * hint[1] + raw[2] * hint[2] < 0) [b, c] = [c, b];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n: [number, number, number] = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...n);
    if (l < 1e-9) return [];
    let hex = colours.get(t.hex);
    if (!hex) colours.set(t.hex, hex = lookHex(t.hex, look));
    return [{ p: [a, b, c] as [[number, number, number], [number, number, number], [number, number, number]], uv: [[0, 0], [1, 0], [1, 1]] as [[number, number], [number, number], [number, number]], layer: 'flat' as const, hex, n: [n[0] / l, n[1] / l, n[2] / l] as [number, number, number] }];
  });
  return { id: front.ids[0], tris };
}
