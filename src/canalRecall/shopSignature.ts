// The signature storefront of a business the map labels (shopfronts.json `signatures`): a canvas awning over the ground
// floor on the street wall nearest its OSM point, and a blade sign above it, in the business's colour.
//
// Lane shopfront-hendrix-20261114 (feedback 7be6c55a, café Hendrix, Bilderdijkkade / De Clercqstraat, pand
// 0363100012132271). The old storefront was a flat 0.2 m slab 0.95 m deep, inset a fixed 0.4 m from each end of the
// nearest wall of any kind. Three faults followed:
//  - from the chase camera a thin flat slab in a pale colour reads as a bare rod along the facade, not an awning;
//  - at a chamfered corner (the wall turns 45 deg) its outer corner stood 0.4 m proud of the chamfer face, so the rod
//    stuck out past the corner (a slab d deep must stop d * cot(turn) short of a convex end, here d itself);
//  - the nearest wall could be a party wall hidden by the neighbour or a 2.5 m chamfer.
// Now: the awning slopes down and out from the ground storey's head to a hanging valance (Amsterdam café awnings, the
// photo's orange ones), each end stops where the neighbouring wall's plane would cut it, and the wall is picked from
// the exposed street walls first (the chain fascia's rule).

/** Plan-view wall frame: start point, unit direction along the wall and the outward normal. */
export type SignatureWall = { x0: number; y0: number; x1: number; y1: number; len: number; nx: number; ny: number; hole: boolean };
/** One flat quad (corners in order) with its outward normal and colour. */
export type SignatureQuad = { q: [number, number, number][]; n: [number, number, number]; hex: string };

export const AWNING = {
  /** Gap kept between the wall and the canvas (no z-fight with the facade). */
  wallGapM: 0.05,
  /** How far the canvas reaches out from the wall. */
  depthM: 1.0,
  /** Drop of the canvas over its depth. */
  dropM: 0.45,
  /** The hanging valance under the front edge. */
  valanceM: 0.22,
  /** Minimum inset from either end of the wall. */
  endInsetM: 0.4,
  /** Below this the awning is not drawn (a short or heavily trimmed wall). */
  minSpanM: 1.2,
  /** A neighbouring wall turned less than this (sin of ~20 deg) counts as the same frontage: no trim. */
  minTurnSin: 0.34,
  /** The canvas head sits this far under the ground storey's top, kept within [minHeadM, maxHeadM] over the base. */
  headBelowGroundTopM: 0.1, minHeadM: 2.9, maxHeadM: 3.6,
} as const;

const near = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by) < 1e-3;
/** Edges shorter than this (survey jitter, a 0.1 m jog at a chamfer) are walked past to the wall beyond. */
const JOG_M = 0.5;

/** The first wall of at least JOG_M after (`dir` 1) or before (-1) `wall` in its ring, walking past short jogs. */
function neighbourWall(wall: SignatureWall, walls: readonly SignatureWall[], dir: 1 | -1): SignatureWall | null {
  let x = dir > 0 ? wall.x1 : wall.x0, y = dir > 0 ? wall.y1 : wall.y0;
  for (let step = 0; step < 4; step++) {
    const other = walls.find(o => o !== wall && o.hole === wall.hole && (dir > 0 ? near(o.x0, o.y0, x, y) : near(o.x1, o.y1, x, y)));
    if (!other) return null;
    if (other.len >= JOG_M) return other;
    x = dir > 0 ? other.x1 : other.x0; y = dir > 0 ? other.y1 : other.y0;
  }
  return null;
}

/**
 * How far along the wall an awning `depth` deep may run before its outer corner crosses the neighbouring wall's plane:
 * [start, end] in metres along the wall, inset at least `endInsetM`. A convex 90 deg corner allows the whole wall, a
 * 45 deg chamfer stops `depth` short, a near-collinear neighbour (turn under ~20 deg) is the same frontage. Short jogs
 * (under 0.5 m) between the wall and its neighbour are walked past.
 */
export function awningSpan(wall: SignatureWall, walls: readonly SignatureWall[], depth: number = AWNING.depthM): [number, number] {
  const L = wall.len, ux = (wall.x1 - wall.x0) / L, uy = (wall.y1 - wall.y0) / L;
  let start: number = AWNING.endInsetM, end = L - AWNING.endInsetM;
  for (const dir of [1, -1] as const) {
    const other = neighbourWall(wall, walls, dir);
    if (!other) continue;
    const un = ux * other.nx + uy * other.ny;
    if (Math.abs(un) < AWNING.minTurnSin) continue;
    // The awning's outer corner C(a) = wall start + u a + n depth keeps to the open side of the neighbour's plane
    // (behind it at a convex corner, in front of it at a concave one); both cases reduce to a un + s vs 0 with the
    // bound's direction set by which end the neighbour is at.
    const s = (wall.x0 - other.x0) * other.nx + (wall.y0 - other.y0) * other.ny + depth * (wall.nx * other.nx + wall.ny * other.ny);
    const limit = -s / un;
    if (dir > 0) end = Math.min(end, limit); else start = Math.max(start, limit);
  }
  return [start, end];
}

/**
 * The wall a signature storefront goes on: the exposed street wall (`street`) nearest the point, else the nearest exposed
 * wall, else any; walls under 2.5 m (a chamfer, a jog) never. Null when none qualifies.
 */
export function signatureWall(px: number, py: number, street: readonly SignatureWall[], exposed: readonly SignatureWall[], all: readonly SignatureWall[]): SignatureWall | null {
  const pick = (walls: readonly SignatureWall[]) => {
    let best: SignatureWall | null = null, bestD = Infinity;
    for (const e of walls) {
      if (e.hole || e.len < 2.5) continue;
      const dx = e.x1 - e.x0, dy = e.y1 - e.y0, t = Math.max(0, Math.min(1, ((px - e.x0) * dx + (py - e.y0) * dy) / (e.len * e.len)));
      const d = Math.hypot(px - e.x0 - dx * t, py - e.y0 - dy * t);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  };
  return pick(street) ?? pick(exposed) ?? pick(all);
}

/** `hex` darkened by `k` (0..1 kept). */
export function shadeHex(hex: string, k: number): string {
  const v = parseInt(hex.slice(1), 16), c = (s: number) => Math.round(((v >> s) & 255) * k).toString(16).padStart(2, '0');
  return /^#[0-9a-f]{6}$/i.test(hex) ? `#${c(16)}${c(8)}${c(0)}` : hex;
}

/**
 * The storefront's quads: the sloped canvas (top and underside), its valance (front and back), the two end cheeks and the
 * blade sign (iron bracket and board) above the awning at the end nearest the point. `base` is the wall's foot, `groundM`
 * the ground storey's height (the awning hangs from its head).
 */
export function signatureQuads(px: number, py: number, wall: SignatureWall, walls: readonly SignatureWall[], base: number, groundM: number, hex: string): SignatureQuad[] {
  const L = wall.len, ux = (wall.x1 - wall.x0) / L, uy = (wall.y1 - wall.y0) / L, nx = wall.nx, ny = wall.ny;
  const P = (a: number, o: number, z: number): [number, number, number] => [wall.x0 + ux * a + nx * o, wall.y0 + uy * a + ny * o, z];
  const N = (a: number, o: number, z: number): [number, number, number] => { const h = Math.hypot(a, o, z) || 1; return [(ux * a + nx * o) / h, (uy * a + ny * o) / h, z / h]; };
  const out: SignatureQuad[] = [];
  const [a0, a1] = awningSpan(wall, walls);
  const g = AWNING.wallGapM, D = AWNING.depthM;
  const zt = base + Math.max(AWNING.minHeadM, Math.min(AWNING.maxHeadM, groundM - AWNING.headBelowGroundTopM)), zf = zt - AWNING.dropM, zv = zf - AWNING.valanceM;
  if (a1 - a0 >= AWNING.minSpanM) {
    const under = shadeHex(hex, 0.72), up = N(0, AWNING.dropM, D - g);
    out.push(
      { q: [P(a0, g, zt), P(a1, g, zt), P(a1, D, zf), P(a0, D, zf)], n: up, hex },
      { q: [P(a0, g, zt - 0.04), P(a1, g, zt - 0.04), P(a1, D, zf - 0.02), P(a0, D, zf - 0.02)], n: [-up[0], -up[1], -up[2]], hex: under },
      { q: [P(a0, D, zf), P(a1, D, zf), P(a1, D, zv), P(a0, D, zv)], n: N(0, 1, 0), hex },
      { q: [P(a0, D - 0.02, zf), P(a1, D - 0.02, zf), P(a1, D - 0.02, zv), P(a0, D - 0.02, zv)], n: N(0, -1, 0), hex: under },
      { q: [P(a0, g, zt), P(a0, D, zf), P(a0, D, zv), P(a0, g, zt - 0.04)], n: N(-1, 0, 0), hex },
      { q: [P(a1, g, zt), P(a1, D, zf), P(a1, D, zv), P(a1, g, zt - 0.04)], n: N(1, 0, 0), hex },
    );
  }
  // Blade sign near the end of the frontage closest to the point, above the awning: iron bracket and a 0.9 m board.
  const along = Math.max(0.6, Math.min(L - 0.6, (px - wall.x0) * ux + (py - wall.y0) * uy));
  const at = Math.max(a0 + 0.1, Math.min(a1 - 0.1, along < L / 2 ? 0.6 : L - 0.6));
  const sb = zt + 0.25;
  box(P, N, at - 0.04, at + 0.04, 0.05, 1.2, sb + 0.85, sb + 0.93, '#2a2a2a', out);
  box(P, N, at - 0.07, at + 0.07, 0.25, 1.15, sb, sb + 0.85, hex, out);
  return out;
}

function box(P: (a: number, o: number, z: number) => [number, number, number], N: (a: number, o: number, z: number) => [number, number, number],
  a0: number, a1: number, o0: number, o1: number, z0: number, z1: number, hex: string, out: SignatureQuad[]): void {
  out.push(
    { q: [P(a0, o1, z0), P(a1, o1, z0), P(a1, o1, z1), P(a0, o1, z1)], n: N(0, 1, 0), hex },
    { q: [P(a0, o0, z0), P(a1, o0, z0), P(a1, o0, z1), P(a0, o0, z1)], n: N(0, -1, 0), hex },
    { q: [P(a0, o0, z0), P(a0, o1, z0), P(a0, o1, z1), P(a0, o0, z1)], n: N(-1, 0, 0), hex },
    { q: [P(a1, o0, z0), P(a1, o1, z0), P(a1, o1, z1), P(a1, o0, z1)], n: N(1, 0, 0), hex },
    { q: [P(a0, o0, z1), P(a1, o0, z1), P(a1, o1, z1), P(a0, o1, z1)], n: [0, 0, 1], hex },
    { q: [P(a0, o0, z0), P(a1, o0, z0), P(a1, o1, z0), P(a0, o1, z0)], n: [0, 0, -1], hex },
  );
}
