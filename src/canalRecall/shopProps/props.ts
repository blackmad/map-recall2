// The shop props (lane shop-goods-20261116): low-poly builders in the kit's local frame (x along the wall, y out towards
// the street, z up, origin on the ground at the prop's centre). Each states its triangle cost (PROP_COST, tested), its
// footprint along the wall and its depth, so a layout can fit it and a budget can be read off the table.
import { hash01, Mesh, shade, type PropTri, type V3 } from './kit.js';
import { BIKE_RACK, BIKE_RACK_PERP, BIKE_RACK_PERP_TRIS, BIKE_RACK_TRIS, OMAFIETS_LOW, OMAFIETS_LOW_TRIS, OMAFIETS_PERP, OMAFIETS_PERP_TRIS, OMAFIETS_WINDOW, OMAFIETS_WINDOW_TRIS } from './bikeMeshes.generated.js';

/** Lane shop-bikes: frame colours of Dutch city bikes, a palette with weights (black dominates; matte navy, dark green,
 *  cream, burgundy; the occasional pastel). A rental fleet's bikes are recoloured from any of these. */
export const BIKE_PALETTE = [
  { hex: '#161616', w: 5 }, { hex: '#1f2a3d', w: 2.5 }, { hex: '#29402f', w: 2 }, { hex: '#d6cbae', w: 1.5 }, { hex: '#6b1e2a', w: 1.5 },
  { hex: '#3a3d40', w: 1 }, { hex: '#a9cfc6', w: 0.5 }, { hex: '#e4b9c2', w: 0.4 }, { hex: '#b8c8e0', w: 0.4 },
] as const;
export const BIKE_HEXES = BIKE_PALETTE.map(c => c.hex);
/** A frame colour from the palette for 0 <= u < 1. */
export function bikeHex(u: number): string {
  const total = BIKE_PALETTE.reduce((t, c) => t + c.w, 0);
  let pick = u * total;
  for (const c of BIKE_PALETTE) if ((pick -= c.w) < 0) return c.hex;
  return BIKE_PALETTE[0].hex;
}
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

const GROUP_HEX = { dark: '#222222', saddle: '#2e241c', tyre: '#141414', chrome: '#a9b0b4' } as const;
const fromFlat = (m: Mesh, flat: readonly number[], hex: string) => {
  for (let i = 0; i < flat.length; i += 9) m.tri([flat[i], flat[i + 1], flat[i + 2]], [flat[i + 3], flat[i + 4], flat[i + 5]], [flat[i + 6], flat[i + 7], flat[i + 8]], hex);
};

/** Lane shop-bikes: the player's omafiets baked low (bikeMeshes.generated.ts, scripts/shop-props/bake-shop-bikes.ts),
 *  side-on with its chain case to the street (+y), front wheel at -x; its frame and fork in `frameHex`, mudguards,
 *  carrier, chain case and bars dark, rims and stem chrome. `perp` (David 2026-11-16: "bikes should face perpendicular to
 *  the storefront") is parked nose to the wall, both flanks drawn, the faces turned to the wall culled; `shop` is side-on
 *  for a narrow pavement; `window` is the outline LOD for behind the glass. */
export function omafiets(frameHex: string, lod: 'perp' | 'shop' | 'window' = 'shop'): PropTri[] {
  const m = new Mesh(), src = lod === 'perp' ? OMAFIETS_PERP : lod === 'shop' ? OMAFIETS_LOW : OMAFIETS_WINDOW;
  fromFlat(m, src.frame, frameHex);
  for (const g of ['dark', 'saddle', 'tyre', 'chrome'] as const) fromFlat(m, src[g], GROUP_HEX[g]);
  return m.tris;
}

/** The baked omafiets's length (tyre to tyre, with its mudguards) and its bars' width across. */
export const OMAFIETS_SIZE = (() => {
  const all = Object.values(OMAFIETS_LOW).flatMap(a => [...a]), xs = all.filter((_, i) => i % 3 === 0), ys = all.filter((_, i) => i % 3 === 1);
  return { lengthM: Math.max(...xs) - Math.min(...xs), widthM: Math.max(...ys) - Math.min(...ys) };
})();

/** Lane shop-bikes: the street-furniture bike rack (models/street-furniture/bike-rack.glb), an inverted U across x. */
export function bikeRack(hex = STEEL, perp = false): PropTri[] {
  const m = new Mesh();
  fromFlat(m, perp ? BIKE_RACK_PERP : BIKE_RACK, hex);
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
      const x = -w / 2 + (k + 0.5) * (w / per) + (r(`${s}:${k}:x`) - 0.5) * 0.04, yb = y - 0.1, h = 0.18 + r(`${s}:${k}:h`) * 0.12;
      m.quad([x - 0.08, yb + 0.06, z], [x + 0.08, yb + 0.06, z], [x + 0.1, yb + 0.06, z + 0.24], [x - 0.1, yb + 0.06, z + 0.24], STEEL, [0, 1, 0]);
      m.quad([x - 0.07, yb + 0.05, z + 0.24], [x + 0.07, yb + 0.05, z + 0.24], [x + 0.1, yb + 0.05, z + 0.24 + h], [x - 0.1, yb + 0.05, z + 0.24 + h], LEAF[k % LEAF.length], [0, 1, 0]);
      const c1 = BLOOMS[Math.floor(r(`${s}:${k}:c`) * BLOOMS.length)], c2 = r(`${s}:${k}:m`) < 0.5 ? c1 : BLOOMS[Math.floor(r(`${s}:${k}:d`) * BLOOMS.length)];
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

/** Lane retail-pass (David 2026-11-16: the stations "read as small dark-red blocks at gallery size"): a styling station
 *  at the size a salon has it. At the back (y -0.8) a 0.8 x 1.25 m mirror in its frame, its glass pale and its lamp bar
 *  over it lit (what the photos show through dark salon glass: the lit mirrors), a shelf under it with three bottles; the
 *  chair before it, back to the street, as big as a real hydraulic chair (0.6 m seat, back to 1.12 m, headrest to
 *  1.3 m), on a chrome column and base. `frameHex` the mirror's frame, `shelfHex` the shelf. 72 tris. */
export function stylingStation(chairHex: string, frameHex = '#1a1a1a', shelfHex = '#ece8e0', bottles: readonly string[] = ['#2f6fb0', '#e8e2d2', '#c0392b']): PropTri[] {
  const m = new Mesh(), CHROME = '#a9b0b4', yb = -0.8;
  // Mirror: frame, glass (lit: it shows the lit room), lamp bar over it.
  m.quad([-0.4, yb, 0.8], [0.4, yb, 0.8], [0.4, yb, 2.05], [-0.4, yb, 2.05], frameHex, [0, 1, 0]);
  m.quad([-0.35, yb + 0.01, 0.85], [0.35, yb + 0.01, 0.85], [0.35, yb + 0.01, 1.98], [-0.35, yb + 0.01, 1.98], '#c9d3d8', [0, 1, 0], true);
  m.quad([-0.3, yb + 0.02, 2.06], [0.3, yb + 0.02, 2.06], [0.3, yb + 0.02, 2.12], [-0.3, yb + 0.02, 2.12], '#ffe9b8', [0, 1, 0], true);
  // The shelf under it and three bottles on it.
  m.box(-0.42, 0.42, yb, yb + 0.2, 0.74, 0.8, shelfHex, { ends: false });
  bottles.forEach((hex, k) => m.bump(-0.3 + k * 0.12, -0.22 + k * 0.12, yb + 0.05, yb + 0.13, 0.8, 0.14 + 0.03 * (k % 2), hex, shade(hex, 1.15)));
  // The chair: base plate, column, seat, back, headrest on its stem, arms, footrest.
  m.quad([-0.28, -0.28, 0.02], [0.28, -0.28, 0.02], [0.28, 0.28, 0.02], [-0.28, 0.28, 0.02], shade(CHROME, 0.7), [0, 0, 1]);
  m.box(-0.07, 0.07, -0.07, 0.07, 0.02, 0.4, CHROME, { top: false });
  m.box(-0.3, 0.3, -0.3, 0.22, 0.4, 0.56, chairHex, {});
  m.box(-0.28, 0.28, 0.16, 0.28, 0.56, 1.08, chairHex, {});
  // The headrest sits on the back (a gap between them read as a monitor on a desk at gallery size).
  m.box(-0.17, 0.17, 0.17, 0.29, 1.08, 1.3, shade(chairHex, 1.12), {});
  for (const x of [-0.37, 0.3]) m.box(x, x + 0.07, -0.26, 0.18, 0.58, 0.7, chairHex, {});
  m.strip([-0.18, -0.38, 0.16], [0.18, -0.38, 0.16], 0.07, CHROME, [0, 0, 1]);
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
      if (r(`${s}:${k}:e`) < 0.12) continue; // a gap on the shelf
      const x = -w / 2 + (k + 0.15) * (w / items), c = palette[Math.floor(r(`${s}:${k}:c`) * palette.length)];
      m.bump(x, x + (w / items) * 0.7, -0.1, 0.15, z, 0.12 + r(`${s}:${k}:h`) * 0.12, c, shade(c, 1.2));
    }
  }
  return m.tris;
}

/** Muted canal-house postcards: a sky tone over a building hue (blues, ochres, brick reds, a green, a slate). */
const CARD_SKY = ['#bcd0e0', '#d9e2e8', '#e6dcc3', '#a9c1d6'] as const;
const CARD_HOUSE = ['#4f739c', '#36567f', '#7d9bb8', '#c79a3f', '#b9863a', '#a8452f', '#b5562f', '#6b8a5a', '#4a5560', '#8f3b34'] as const;
const SPIN_APOTHEM = 0.24, SPIN_TIERS = 5;
/** Faces of the octagonal drum that face the street (cos of the angle off +y above this); the rest are never seen. */
const spinFaces = (turn: number) => [0, 1, 2, 3, 4, 5, 6, 7].filter(k => Math.cos(turn + (k * Math.PI) / 4) > -0.2);

/** A pavement postcard spinner (David 2026-11-16: the flat card grid "looks bad"): an octagonal base plate, a pole
 *  about 1.65 m tall, an octagonal drum with five tiers of cards, each card a white border round a canal-house picture
 *  (sky over a building hue) leaning back a little at the top. `turn` is the drum's turn about its pole; only the faces
 *  towards the street are drawn: 22 tris (plate 8, pole 8, cap 8) + 32 per face (backing 2, five cards of 6). */export function postcardSpinner(r: (k: string) => number, turn = 0): PropTri[] {
  const m = new Mesh(), A = SPIN_APOTHEM, Rc = A / Math.cos(Math.PI / 8), steel = '#7d8387', dark = '#2c2f33';
  // Base plate (an octagon, seen from above) and the pole below the drum and above it.
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
    m.tri([0, 0, 0.03], [0.3 * Math.sin(a0), 0.3 * Math.cos(a0), 0.03], [0.3 * Math.sin(a1), 0.3 * Math.cos(a1), 0.03], shade(steel, 0.9), [0, 0, 1]);
  }
  m.strip([0, 0, 0.03], [0, 0, 0.5], 0.04, steel, [0, 1, 0]); m.strip([0, 0, 0.03], [0, 0, 0.5], 0.04, steel, [1, 0, 0]);
  m.strip([0, 0, 1.58], [0, 0, 1.65], 0.04, steel, [0, 1, 0]); m.strip([0, 0, 1.58], [0, 0, 1.65], 0.04, steel, [1, 0, 0]);
  // The drum's cap: an octagon seen from above.
  const V = (k: number, z: number): V3 => { const a = turn + (k - 0.5) * (Math.PI / 4); return [Rc * Math.sin(a), Rc * Math.cos(a), z]; };
  for (let k = 0; k < 8; k++) m.tri([0, 0, 1.58], V(k, 1.58), V(k + 1, 1.58), shade(dark, 1.4), [0, 0, 1]);
  for (const k of spinFaces(turn)) {
    const phi = turn + (k * Math.PI) / 4, d: [number, number] = [Math.sin(phi), Math.cos(phi)], t: [number, number] = [Math.cos(phi), -Math.sin(phi)];
    const nrm: V3 = [d[0], d[1], 0.12];
    // The drum's face behind the cards.
    m.quad(V(k, 0.5), V(k + 1, 0.5), V(k + 1, 1.58), V(k, 1.58), dark, [d[0], d[1], 0]);
    for (let i = 0; i < SPIN_TIERS; i++) {
      const z0 = 0.56 + i * 0.2, h = 0.17, lean = 0.035, w = 0.17, wp = 0.145, hp = 0.12;
      // A point on the card plane: `u` along the face, `v` up the card (0..h), `o` out from the drum (bottom out, top back).
      const P = (u: number, v: number, o: number): V3 => {
        const rad = A + 0.03 + o - lean * (v / h);
        return [d[0] * rad + t[0] * u, d[1] * rad + t[1] * u, z0 + v];
      };
      m.quad(P(-w / 2, 0, 0), P(w / 2, 0, 0), P(w / 2, h, 0), P(-w / 2, h, 0), '#f4f1e8', nrm);
      const g = (a: string) => r(`${k}:${i}:${a}`), hv = CARD_HOUSE[Math.floor(g('h') * CARD_HOUSE.length)], sky = CARD_SKY[Math.floor(g('s') * CARD_SKY.length)];
      const vb = (h - hp) / 2, vm = vb + hp * 0.42;
      m.quad(P(-wp / 2, vb, 0.004), P(wp / 2, vb, 0.004), P(wp / 2, vm, 0.004), P(-wp / 2, vm, 0.004), hv, nrm);
      m.quad(P(-wp / 2, vm, 0.004), P(wp / 2, vm, 0.004), P(wp / 2, vb + hp, 0.004), P(-wp / 2, vb + hp, 0.004), sky, nrm);
    }
  }
  return m.tris;
}
/** Most the spinner costs (a turn that shows five faces); one showing four costs 32 less. */
export const POSTCARD_SPINNER_TRIS = 24 + 5 * 32;

/** Cost of each fixed-size prop (tested against its builder). */
export const PROP_COST = { omafietsPerp: OMAFIETS_PERP_TRIS, bikeRackPerp: BIKE_RACK_PERP_TRIS, omafiets: OMAFIETS_LOW_TRIS, omafietsWindow: OMAFIETS_WINDOW_TRIS, bikeRack: BIKE_RACK_TRIS, bike: 54, bakfiets: 58, rail: 6, crate: 34, crateNoCard: 32, plant: 6, plantTall: 8, barberStation: 50, washBasin: 24, counter: 14, postcardSpinner: POSTCARD_SPINNER_TRIS, stylingStation: 72 } as const;
/** A bucket tier's cost for `w`. */
export const bucketTierCost = (w: number) => 3 * (4 + Math.max(1, Math.floor(w / 0.27)) * 8);
