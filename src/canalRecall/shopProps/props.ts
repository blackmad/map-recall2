// The shop props (lane shop-goods-20261116): low-poly builders in the kit's local frame (x along the wall, y out towards
// the street, z up, origin on the ground at the prop's centre). Each states its triangle cost (PROP_COST, tested), its
// footprint along the wall and its depth, so a layout can fit it and a budget can be read off the table.
import { hash01, Mesh, shade, type PropTri, type V3 } from './kit.js';

/** Frame colours of parked Amsterdam bikes (black dominates; dark green, cream, red, blue). */
export const BIKE_HEXES = ['#1a1a1a', '#1a1a1a', '#232323', '#2f4a36', '#d9cfb4', '#9c2a26', '#2b4a78', '#3a3d40'] as const;
const TYRE = '#141414', DARK = '#202020', STEEL = '#8d9396';

/** A bike side-on, rear axle at x = -L/2, front axle at +L/2: 8-sided tyres, a diamond or step-through frame, the
 *  fork, a rear carrier, saddle and a handlebar across. 2 x 16 + 7 x 2 + 4 + 2 + 2 = 54 tris. */
export function bike(frameHex: string, step = false): PropTri[] {
  const m = new Mesh(), R = 0.33, L = 1.08, x0 = -L / 2, t = 0.04, n: V3 = [0, 1, 0];
  const P = (x: number, z: number): V3 => [x0 + x, 0, z];
  m.ring(x0, R, 0, R - 0.025, 0.05, 8, TYRE);
  m.ring(x0 + L, R, 0, R - 0.025, 0.05, 8, TYRE);
  const bb = P(0.42, 0.3), seat = P(0.3, 0.88), head = P(0.92, 0.86), headLow = P(0.95, 0.68), rear = P(0, R), front = P(L, R);
  m.strip(bb, seat, t, frameHex, n);
  m.strip(step ? P(0.36, 0.42) : seat, step ? headLow : head, t, frameHex, n);
  m.strip(bb, headLow, t, frameHex, n);
  m.strip(rear, bb, t * 0.8, frameHex, n);
  m.strip(rear, seat, t * 0.8, frameHex, n);
  m.strip(headLow, front, t * 0.8, frameHex, n);
  m.strip(head, P(0.88, 1.0), t, DARK, n);
  // The saddle: its top and its side; the carrier over the rear wheel; the bar across, seen from above.
  m.box(x0 + 0.2, x0 + 0.42, -0.06, 0.06, 0.92, 0.97, DARK, { ends: false });
  m.strip(P(-0.08, 0.76), P(0.3, 0.8), 0.12, shade(frameHex, 0.8), [0, 0.3, 1]);
  m.strip([x0 + 0.86, -0.28, 1.02], [x0 + 0.86, 0.28, 1.02], 0.035, DARK, [0, 0, 1]);
  return m.tris;
}

/** A bakfiets: the rider's half of a bike behind a timber box over a small front wheel. 58 tris, 2.3 m long. */
export function bakfiets(boxHex: string, frameHex = '#1a1a1a'): PropTri[] {
  const m = new Mesh(), R = 0.33, r = 0.24, x0 = -1.0, n: V3 = [0, 1, 0], t = 0.04;
  const P = (x: number, z: number): V3 => [x0 + x, 0, z];
  m.ring(x0, R, 0, R - 0.025, 0.05, 8, TYRE);
  m.ring(x0 + 1.95, r, 0, r - 0.025, 0.05, 8, TYRE);
  const bb = P(0.42, 0.3), seat = P(0.3, 0.88), head = P(0.85, 0.95), low = P(1.05, 0.22);
  m.strip(bb, seat, t, frameHex, n); m.strip(P(0, R), bb, t * 0.8, frameHex, n); m.strip(P(0, R), seat, t * 0.8, frameHex, n);
  m.strip(bb, low, t, frameHex, n); m.strip(low, P(1.95, r), t, frameHex, n); m.strip(head, P(0.95, 0.45), t, DARK, n);
  // The box: its front and ends; inside, a darker floor seen over the rim.
  m.box(x0 + 1.05, x0 + 1.8, -0.32, 0.32, 0.22, 0.72, boxHex, { top: false });
  m.quad([x0 + 1.07, -0.3, 0.66], [x0 + 1.78, -0.3, 0.66], [x0 + 1.78, 0.3, 0.66], [x0 + 1.07, 0.3, 0.66], shade(boxHex, 0.55), [0, 0, 1]);
  m.box(x0 + 0.2, x0 + 0.42, -0.06, 0.06, 0.92, 0.97, DARK, { ends: false });
  m.strip([x0 + 0.85, -0.3, 1.0], [x0 + 0.85, 0.3, 1.0], 0.035, DARK, [0, 0, 1]);
  return m.tris;
}

/** A pavement bike rail along the wall: a tube on two posts, `w` long. 6 tris. */
export function rail(w: number): PropTri[] {
  const m = new Mesh();
  m.strip([-w / 2, 0, 0.55], [w / 2, 0, 0.55], 0.045, STEEL, [0, 1, 0]);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) m.strip([x, 0, 0], [x, 0, 0.55], 0.045, STEEL, [0, 1, 0]);
  return m.tris;
}

/** Produce by colour: a main and a second tone, and the bump height (bananas lie low, cabbages stand up). */
export const PRODUCE = {
  apples: { hex: '#b8232b', hex2: '#d8452f', h: 0.05 },
  oranges: { hex: '#ee8a1c', hex2: '#f2a23a', h: 0.05 },
  greens: { hex: '#4f8a2e', hex2: '#7cb342', h: 0.05 },
  bananas: { hex: '#f2d23a', hex2: '#d9c22e', h: 0.03 },
  purple: { hex: '#4e2350', hex2: '#6a2f6e', h: 0.04 },
  tomatoes: { hex: '#d8452f', hex2: '#c0392b', h: 0.04 },
  lemons: { hex: '#f4e04d', hex2: '#e8cf2a', h: 0.04 },
  potatoes: { hex: '#b8955f', hex2: '#a07f4c', h: 0.04 },
} as const;
export type Produce = keyof typeof PRODUCE;

/** A display crate 0.5 x 0.4 m filled with one produce: the crate's front and ends, a produce bed and six bumps, and
 *  (when `card`) a price card at its front edge. 6 + 2 + 24 + 2 = 34 tris (32 without a card). */
export function crate(produce: Produce, card = true, crateHex = '#8a6a44'): PropTri[] {
  const m = new Mesh(), p = PRODUCE[produce];
  m.box(-0.25, 0.25, -0.2, 0.2, 0, 0.16, crateHex, { top: false });
  m.quad([-0.24, -0.19, 0.13], [0.24, -0.19, 0.13], [0.24, 0.19, 0.13], [-0.24, 0.19, 0.13], shade(p.hex, 0.7), [0, 0, 1]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = -0.24 + i * 0.16, y = -0.19 + j * 0.19;
    m.bump(x, x + 0.16, y, y + 0.19, 0.13, p.h + 0.015 * ((i + j) % 2), (i + j) % 2 ? p.hex2 : p.hex, p.hex);
  }
  if (card) m.quad([-0.07, 0.205, 0.12], [0.07, 0.205, 0.12], [0.07, 0.205, 0.22], [-0.07, 0.205, 0.22], '#f6f3ea', [0, 1, 0]);
  return m.tris;
}

export const BLOOMS = ['#e85a8c', '#f2c21b', '#f4efe2', '#c8262d', '#8a4fb0', '#f08a2a', '#f7a8c4', '#ffffff', '#d63a6a'] as const;
const LEAF = ['#3d6b35', '#4f7a3a', '#2f5a30'] as const;

/** A florist's stepped stand, `w` wide, three steps of zinc buckets of cut flowers: each step's front and top, each
 *  bucket a tapered zinc front, a stem mass and a two-colour bloom. 12 + 8 per bucket tris. */
export function bucketTier(w: number, seed: string): PropTri[] {
  const m = new Mesh(), per = Math.max(1, Math.floor(w / 0.27)), r = (k: string) => hash01(`${seed}:${k}`);
  for (let s = 0; s < 3; s++) {
    const y = 0.32 - s * 0.26, z = 0.22 + s * 0.24;
    m.box(-w / 2, w / 2, y - 0.26, y, 0, z, s % 2 ? '#5a4632' : '#6b5238', { ends: false });
    for (let k = 0; k < per; k++) {
      const x = -w / 2 + (k + 0.5) * (w / per) + (r(`x${s}${k}`) - 0.5) * 0.04, yb = y - 0.1, h = 0.18 + r(`h${s}${k}`) * 0.12;
      m.quad([x - 0.08, yb + 0.06, z], [x + 0.08, yb + 0.06, z], [x + 0.1, yb + 0.06, z + 0.24], [x - 0.1, yb + 0.06, z + 0.24], STEEL, [0, 1, 0]);
      m.quad([x - 0.07, yb + 0.05, z + 0.24], [x + 0.07, yb + 0.05, z + 0.24], [x + 0.1, yb + 0.05, z + 0.24 + h], [x - 0.1, yb + 0.05, z + 0.24 + h], LEAF[k % LEAF.length], [0, 1, 0]);
      const c1 = BLOOMS[Math.floor(r(`c${s}${k}`) * BLOOMS.length)], c2 = r(`m${s}${k}`) < 0.5 ? c1 : BLOOMS[Math.floor(r(`d${s}${k}`) * BLOOMS.length)];
      m.bump(x - 0.13, x + 0.13, yb - 0.08, yb + 0.12, z + 0.2 + h, 0.1, c1, c2);
    }
  }
  return m.tris;
}

/** A potted plant: the pot's front and a leafy (or flowering) mass over it. 6 tris; `tall` adds a stem (8). */
export function plant(leafHex: string, potHex = '#a0522d', tall = false): PropTri[] {
  const m = new Mesh(), h = tall ? 0.55 : 0.25;
  m.quad([-0.1, 0.1, 0], [0.1, 0.1, 0], [0.12, 0.1, 0.2], [-0.12, 0.1, 0.2], potHex, [0, 1, 0]);
  if (tall) m.strip([0, 0.05, 0.2], [0, 0.05, h], 0.03, '#4a3a22', [0, 1, 0]);
  m.bump(-0.22, 0.22, -0.12, 0.18, tall ? h - 0.05 : 0.18, tall ? 0.2 : 0.14, leafHex, shade(leafHex, 1.15));
  return m.tris;
}

/** A barber's station seen from the street: a mirror on the back with its counter, and the chair before it, its back
 *  to the street (headrest, backrest, seat, arms, a chrome pedestal and footrest). 12 + 38 = 50 tris. */
export function barberStation(chairHex: string): PropTri[] {
  const m = new Mesh(), CHROME = '#a9b0b4';
  // Mirror and counter at the back (y -0.8).
  m.quad([-0.32, -0.8, 1.0], [0.32, -0.8, 1.0], [0.32, -0.8, 1.85], [-0.32, -0.8, 1.85], '#2b2724', [0, 1, 0]);
  m.quad([-0.27, -0.79, 1.05], [0.27, -0.79, 1.05], [0.27, -0.79, 1.8], [-0.27, -0.79, 1.8], '#cfd9dd', [0, 1, 0]);
  m.box(-0.38, 0.38, -0.8, -0.55, 0.82, 0.88, '#e8e4dc', { ends: false });
  m.bump(0.1, 0.2, -0.75, -0.65, 0.88, 0.12, '#3a6ea5', '#d9302f');
  // The chair, back to the street.
  m.box(-0.08, 0.08, -0.08, 0.08, 0, 0.42, CHROME, { top: false });
  m.box(-0.26, 0.26, -0.26, 0.2, 0.42, 0.56, chairHex, {});
  m.box(-0.25, 0.25, 0.14, 0.24, 0.56, 1.12, chairHex, { back: true });
  m.box(-0.12, 0.12, 0.16, 0.22, 1.16, 1.32, shade(chairHex, 0.9), { ends: false });
  for (const x of [-0.29, 0.25]) m.box(x, x + 0.04, -0.22, 0.14, 0.62, 0.68, CHROME, { ends: false });
  m.strip([-0.16, -0.36, 0.18], [0.16, -0.36, 0.18], 0.06, CHROME, [0, 0, 1]);
  return m.tris;
}

/** A backwash basin unit: the cabinet, the basin's dark bowl and a reclined seat before it. 24 tris. */
export function washBasin(): PropTri[] {
  const m = new Mesh();
  m.box(-0.3, 0.3, -0.2, 0.15, 0, 0.82, '#1f1f1f', {});
  m.quad([-0.22, -0.15, 0.83], [0.22, -0.15, 0.83], [0.22, 0.1, 0.83], [-0.22, 0.1, 0.83], '#e8e8e4', [0, 0, 1]);
  m.box(-0.28, 0.28, 0.15, 0.7, 0.35, 0.5, '#2a2a2a', {});
  m.box(-0.26, 0.26, 0.6, 0.72, 0.5, 0.95, '#2a2a2a', { top: false });
  return m.tris;
}

/** A shop counter with a till on it: 8 + 6 = 14 tris. */
export function counter(w: number, hex: string): PropTri[] {
  const m = new Mesh();
  m.box(-w / 2, w / 2, -0.3, 0.3, 0, 0.95, hex, {});
  m.box(w / 2 - 0.4, w / 2 - 0.12, -0.15, 0.1, 0.95, 1.15, '#2a2a2a', { ends: false });
  m.quad([w / 2 - 0.38, 0.105, 1.0], [w / 2 - 0.14, 0.105, 1.0], [w / 2 - 0.14, 0.105, 1.12], [w / 2 - 0.38, 0.105, 1.12], '#7fb2c8', [0, 1, 0]);
  return m.tris;
}

/** A shelf unit `w` wide against the back: two uprights, three shelves (front and top) and goods on each as bumps in the
 *  palette's colours, seeded. 4 + 12 + 4 per item tris. */
export function shelfUnit(w: number, palette: readonly string[], seed: string, frameHex = '#d9d4c8'): PropTri[] {
  const m = new Mesh(), r = (k: string) => hash01(`${seed}:${k}`), items = Math.max(1, Math.floor(w / 0.3));
  for (const x of [-w / 2, w / 2 - 0.04]) m.strip([x + 0.02, 0.2, 0], [x + 0.02, 0.2, 1.7], 0.04, frameHex, [0, 1, 0]);
  for (let s = 0; s < 3; s++) {
    const z = 0.45 + s * 0.45;
    m.box(-w / 2, w / 2, -0.15, 0.2, z - 0.03, z, frameHex, { ends: false });
    for (let k = 0; k < items; k++) {
      if (r(`e${s}${k}`) < 0.12) continue; // a gap on the shelf
      const x = -w / 2 + (k + 0.15) * (w / items), c = palette[Math.floor(r(`c${s}${k}`) * palette.length)];
      m.bump(x, x + (w / items) * 0.7, -0.1, 0.15, z, 0.12 + r(`h${s}${k}`) * 0.12, c, shade(c, 1.2));
    }
  }
  return m.tris;
}

/** Cost of each fixed-size prop (tested against its builder). */
export const PROP_COST = { bike: 54, bakfiets: 58, rail: 6, crate: 34, crateNoCard: 32, plant: 6, plantTall: 8, barberStation: 50, washBasin: 24, counter: 14 } as const;
/** A bucket tier's cost for `w`. */
export const bucketTierCost = (w: number) => 3 * (4 + Math.max(1, Math.floor(w / 0.27)) * 8);
