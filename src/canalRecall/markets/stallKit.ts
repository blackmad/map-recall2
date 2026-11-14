/**
 * Market-stall kit (lane markets-20261114): the Albert Cuypmarkt and Ten Katemarkt stalls as street furniture.
 * Pure: no three.js, no IO. Every part is its own small mesh drawn as ONE instanced draw for every stall that uses
 * it (marketLayer.ts), so a market is a handful of draws however many stalls it has.
 *
 * Local frame of a stall (metres): x along the row, +y toward the aisle the stall serves (its front), z up; origin on
 * the ground at the middle of the front post line. Faces coloured SLOT (#ff00ff) take the instance colour (the
 * awning's canvas tone, a van's paint, a goods block's tone), like street-furniture-source.js furnitureMaterial.
 *
 * Measurements (panoramas, Gemeente Amsterdam, CC BY 4.0; the bike hoop 0.9 m apart and the 0.95 m counter scale
 * them; read off the 2022-03-21 and 2020-01-06 Albert Cuypstraat captures and the 2024-12-11 / 2025-07-31 Ten
 * Katestraat ones): the standard Amsterdam marktkraam frame is ~4 m along the row and ~2.2 m deep; galvanised square
 * posts; a counter at ~0.9 m one metre deep at the front; a canvas roof ~2.35 m over the aisle falling to ~2.1 m
 * at the back (from the 2.44 m panorama eye the canvas tops read lit and near the horizon, so they sit about eye height
 * and slope away from the aisle), overhanging
 * the front posts by ~0.5 m with a short valance; canvas back and end sheets down to the counter (the 2020-01-06 rows).
 */

export const SLOT = '#ff00ff';

export const STALL = {
  length: 4.0,
  depth: 2.2,
  post: 0.05,
  counterH: 0.9,
  counterDepth: 1.0,
  counterT: 0.06,
  roofFrontZ: 2.35,
  roofBackZ: 2.1,
  overhang: 0.5,
  valance: 0.15,
  backSheetBottom: 1.0,
} as const;

/** Van / food truck at a row end (the 2021 Albert Cuypstraat west-end capture: a coffee trailer and a white van). */
export const VAN = { length: 5.4, width: 2.05, height: 2.55, cabLength: 1.25, wheelR: 0.36 } as const;

export const MARKET_TONES = {
  steel: '#9a9d9b',
  steelDark: '#6d706f',
  counter: '#8b7457',
  counterCloth: '#3f4f45',
  crate: '#a07a4c',
  crateGreen: '#4d6b3a',
  ice: '#e6ecee',
  fish: '#a9b2b6',
  fishPink: '#d39a86',
  rack: '#5b5e60',
  boxDark: '#4a4744',
  cheese: '#e2b94e',
  cheeseRind: '#b8862f',
  bucket: '#3b3f3c',
  glass: '#3a4a52',
  tyre: '#26282a',
  white: '#ece9e1',
} as const;

/** Produce tones read from the Ten Katemarkt 2024-12-11 capture and the Cuyp 2020 shot (oranges, apples, greens, lemons, aubergines). */
export const PRODUCE = ['#d8742a', '#b8322a', '#5f8f35', '#e1c43a', '#5a3550', '#8fb04a', '#c9562f', '#e9a33a'] as const;
export const FABRIC = ['#2c3e66', '#8c2f3a', '#d6cfc2', '#3d6b5a', '#c9a227', '#6a4a7c', '#1f2124', '#b85c38'] as const;
export const FLOWERS = ['#d6336c', '#f2c12e', '#e8590c', '#ae3ec9', '#f8f0e3', '#c2255c'] as const;

export type MarketPartId =
  | 'stall-frame' | 'roof-plain' | 'roof-striped'
  | 'goods-produce' | 'goods-fabric' | 'goods-fish' | 'goods-general' | 'goods-cheese' | 'goods-flowers'
  | 'van';
export const MARKET_PART_IDS: readonly MarketPartId[] = ['stall-frame', 'roof-plain', 'roof-striped', 'goods-produce', 'goods-fabric', 'goods-fish', 'goods-general', 'goods-cheese', 'goods-flowers', 'van'];
export type GoodsKind = 'produce' | 'fabric' | 'fish' | 'general' | 'cheese' | 'flowers';
export const GOODS_KINDS: readonly GoodsKind[] = ['produce', 'fabric', 'fish', 'general', 'cheese', 'flowers'];

/**
 * Per-part triangle caps (the street-furniture rule: one instanced draw per part, so a part's triangles multiply by
 * every stall; Albert Cuyp places ~250 stalls). A whole stall (frame + roof + goods) stays under STALL_TRI_CAP.
 */
export const MARKET_TRI_CAPS: Readonly<Record<MarketPartId, number>> = {
  'stall-frame': 96, 'roof-plain': 40, 'roof-striped': 120,
  'goods-produce': 140, 'goods-fabric': 150, 'goods-fish': 120, 'goods-general': 140, 'goods-cheese': 140, 'goods-flowers': 140,
  van: 160,
};
export const STALL_TRI_CAP = 360;

export type MarketMesh = { id: MarketPartId; positions: Float32Array; colours: Float32Array; triangles: number; heightM: number };

type V = [number, number, number];
const hexToRgb = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const srgbToLinear = (c: number): number => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
/** Linear RGB 0-1 of an sRGB hex (three.js vertex colours are linear). SLOT stays exactly (1, 0, 1). */
export const linearOf = (hex: string): [number, number, number] => hexToRgb(hex).map(v => srgbToLinear(v / 255)) as [number, number, number];
export const isSlot = (r: number, g: number, b: number): boolean => r > 0.98 && g < 0.02 && b > 0.98;

/** Minimal triangle-soup builder (flat shading: the material computes normals from the faces). */
class Soup {
  readonly p: number[] = []; readonly c: number[] = [];
  tri(a: V, b: V, d: V, hex: string): void { const col = linearOf(hex); for (const v of [a, b, d]) { this.p.push(...v); this.c.push(...col); } }
  quad(a: V, b: V, d: V, e: V, hex: string): void { this.tri(a, b, d, hex); this.tri(a, d, e, hex); }
  /** Both windings: thin canvas seen from above and below. */
  quad2(a: V, b: V, d: V, e: V, hex: string): void { this.quad(a, b, d, e, hex); this.quad(a, e, d, b, hex); }
  /** Axis-aligned box; `bottom` false leaves the base open, `top` false the lid (posts). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: string, top = true, bottom = false, topHex = hex): void {
    if (top) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], topHex);
    if (bottom) this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], hex);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], hex);
    this.quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], hex);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], hex);
    this.quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], hex);
  }
  done(id: MarketPartId): MarketMesh {
    let h = 0; for (let i = 2; i < this.p.length; i += 3) h = Math.max(h, this.p[i]);
    return { id, positions: Float32Array.from(this.p), colours: Float32Array.from(this.c), triangles: this.p.length / 9, heightM: h };
  }
}

const S = STALL, L = S.length / 2;
/** Roof height at y (front posts at y = 0, back at y = -depth), extended over the overhang. */
export const roofZ = (y: number): number => S.roofFrontZ + (S.roofBackZ - S.roofFrontZ) * (-y / S.depth);

/** Frame: four posts, two roof side rails, the front roof rail, the counter top and its cloth skirt. 74 tris. */
export function frameModel(): MarketMesh {
  const b = new Soup(), p = S.post / 2, T = MARKET_TONES;
  for (const x of [-L + p, L - p]) for (const y of [-p, -S.depth + p]) b.box(x - p, y - p, -0.2, x + p, y + p, roofZ(y), T.steel, false);
  // Side rails under the canvas (front to back), and the front rail: the frame line the panoramas read under the roof.
  for (const x of [-L + p, L - p]) b.box(x - p, -S.depth, roofZ(0) - 0.07, x + p, 0, roofZ(0) - 0.02, T.steel, false, true);
  b.box(-L, -p, roofZ(0) - 0.07, L, p, roofZ(0) - 0.02, T.steel, false, true);
  // Counter: a board on trestles at the front, the cloth skirt hiding the crates under it.
  b.box(-L + 0.08, -S.counterDepth, S.counterH - S.counterT, L - 0.08, 0.02, S.counterH, T.counter, true, true);
  b.quad([-L + 0.1, 0.03, 0.05], [L - 0.1, 0.03, 0.05], [L - 0.1, 0.03, S.counterH - S.counterT], [-L + 0.1, 0.03, S.counterH - S.counterT], T.counterCloth);
  return b.done('stall-frame');
}

/** Canvas roof slab sloping down to the aisle, a valance over the front, the back sheet down to the counter. */
function roof(stripes: number): MarketMesh {
  const b = new Soup(), y0 = S.overhang, y1 = -S.depth - 0.05, z0 = roofZ(y0), z1 = roofZ(y1);
  const n = Math.max(1, stripes), w = S.length / n;
  for (let i = 0; i < n; i++) {
    // Stripes run front-to-back (the Cuyp red-and-white awnings); odd stripes white.
    const hex = n > 1 && i % 2 === 1 ? MARKET_TONES.white : SLOT, xa = -L + i * w, xb = xa + w;
    b.quad2([xa, y1, z1], [xb, y1, z1], [xb, y0, z0], [xa, y0, z0], hex);
    b.quad2([xa, y0, z0], [xb, y0, z0], [xb, y0, z0 - S.valance], [xa, y0, z0 - S.valance], hex);
  }
  b.quad2([-L, -S.depth, S.backSheetBottom], [L, -S.depth, S.backSheetBottom], [L, -S.depth, z1], [-L, -S.depth, z1], SLOT);
  // End sheets: the back half of each end closed down to the counter.
  for (const x of [-L, L]) b.quad2([x, -S.depth, S.backSheetBottom], [x, -S.counterDepth, S.backSheetBottom], [x, -S.counterDepth, roofZ(-S.counterDepth)], [x, -S.depth, z1], SLOT);
  return b.done(n > 1 ? 'roof-striped' : 'roof-plain');
}
export const roofPlainModel = (): MarketMesh => roof(1);
/** Eight stripes across the 4 m roof (0.5 m each), as on the Cuyp's red-and-white and green-and-white awnings. */
export const STRIPES = 8;
export const roofStripedModel = (): MarketMesh => roof(STRIPES);

/** Goods sit on the counter top (z = counterH) between x ±(L - 0.15), y in [-counterDepth + 0.05, -0.05]. */
const top = S.counterH, gx0 = -L + 0.2, gx1 = L - 0.2, gy0 = -S.counterDepth + 0.08, gy1 = -0.06;

/** Produce: two rows of tilted crates heaped in fruit and veg tones, plus a stacked crate tower at one end. */
export function produceModel(): MarketMesh {
  const b = new Soup(), cols = 5, w = (gx1 - gx0) / cols, T = MARKET_TONES;
  for (let r = 0; r < 2; r++) for (let i = 0; i < cols; i++) {
    const xa = gx0 + i * w + 0.03, xb = xa + w - 0.06, ya = r === 0 ? gy0 : (gy0 + gy1) / 2 + 0.02, yb = r === 0 ? (gy0 + gy1) / 2 - 0.02 : gy1;
    const zf = top + 0.08, zb = top + (r === 0 ? 0.3 : 0.18); // back row higher: the heap leans to the aisle
    const fruit = PRODUCE[(r * 3 + i * 5) % PRODUCE.length];
    // Crate rim (four sides) and the heaped top as one sloped quad.
    b.quad([xa, yb, top], [xb, yb, top], [xb, yb, zf], [xa, yb, zf], T.crate);
    b.quad([xb, ya, top], [xb, yb, top], [xb, yb, zf], [xb, ya, zb], T.crate);
    b.quad([xa, yb, top], [xa, ya, top], [xa, ya, zb], [xa, yb, zf], T.crate);
    b.quad([xa, ya, zb + 0.04], [xb, ya, zb + 0.04], [xb, yb, zf + 0.04], [xa, yb, zf + 0.04], fruit);
  }
  // Empty crates stacked behind the counter (every produce stall has them).
  b.box(-L + 0.3, -S.depth + 0.15, 0, -L + 0.9, -S.depth + 0.6, 0.85, T.crateGreen);
  b.box(L - 0.9, -S.depth + 0.15, 0, L - 0.3, -S.depth + 0.6, 0.55, T.crate);
  return b.done('goods-produce');
}

/** Fabric: a clothes rail across the stall with hanging garments in mixed tones, folded stacks on the counter. */
export function fabricModel(): MarketMesh {
  const b = new Soup(), T = MARKET_TONES, y = -S.counterDepth - 0.35, n = 8, w = (S.length - 0.6) / n;
  b.box(-L + 0.25, y - 0.02, 1.85, L - 0.25, y + 0.02, 1.89, T.rack, true, true);
  for (const x of [-L + 0.3, L - 0.3]) b.box(x - 0.02, y - 0.02, 0, x + 0.02, y + 0.02, 1.85, T.rack, false);
  for (let i = 0; i < n; i++) {
    const xa = -L + 0.3 + i * w + 0.02, xb = xa + w - 0.04, hex = FABRIC[(i * 3) % FABRIC.length], z0 = 0.95 + (i % 3) * 0.12;
    b.box(xa, y - 0.18, z0, xb, y + 0.18, 1.82, hex, false, true);
  }
  for (let i = 0; i < 4; i++) {
    const xa = gx0 + i * (gx1 - gx0) / 4 + 0.05, xb = xa + (gx1 - gx0) / 4 - 0.1;
    b.box(xa, gy0 + 0.1, top, xb, gy1 - 0.1, top + 0.12 + (i % 2) * 0.08, FABRIC[(i * 5 + 1) % FABRIC.length]);
  }
  return b.done('goods-fabric');
}

/** Fish: a white ice tray sloping to the aisle, rows of silver and salmon fillets, a glass sneeze guard. */
export function fishModel(): MarketMesh {
  const b = new Soup(), T = MARKET_TONES;
  b.box(gx0, gy0, top, gx1, gy1, top + 0.12, T.ice);
  b.quad([gx0, gy0, top + 0.3], [gx1, gy0, top + 0.3], [gx1, gy1, top + 0.13], [gx0, gy1, top + 0.13], T.ice);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    const xa = gx0 + 0.08 + i * (gx1 - gx0 - 0.16) / 6, xb = xa + (gx1 - gx0 - 0.16) / 6 - 0.08, ya = gy0 + 0.06 + r * 0.28, yb = ya + 0.2;
    const zr = top + 0.3 - (0.17 * (ya - gy0) / (gy1 - gy0));
    b.quad([xa, ya, zr + 0.03], [xb, ya, zr + 0.03], [xb, yb, zr - 0.02], [xa, yb, zr - 0.02], (r + i) % 3 === 0 ? T.fishPink : T.fish);
  }
  b.quad2([gx0, gy1 + 0.04, top + 0.15], [gx1, gy1 + 0.04, top + 0.15], [gx1, gy1 - 0.1, top + 0.5], [gx0, gy1 - 0.1, top + 0.5], T.glass);
  return b.done('goods-fish');
}

/** General goods (phone cases, bags, household): stacked boxes in the instance tone and dark cartons, a pegboard behind. */
export function generalModel(): MarketMesh {
  const b = new Soup(), T = MARKET_TONES;
  for (let i = 0; i < 5; i++) {
    const xa = gx0 + i * (gx1 - gx0) / 5 + 0.04, xb = xa + (gx1 - gx0) / 5 - 0.08;
    b.box(xa, gy0 + 0.05, top, xb, gy1 - 0.05, top + 0.1 + ((i * 7) % 3) * 0.07, i % 2 ? SLOT : T.boxDark);
  }
  // Hung goods on a rail at the back of the counter (bags, cases): small blocks, no backing board.
  b.box(-L + 0.3, -S.counterDepth - 0.12, 1.78, L - 0.3, -S.counterDepth - 0.08, 1.81, T.rack, true, true);
  for (let i = 0; i < 6; i++) {
    const xa = -L + 0.45 + i * 0.55;
    b.box(xa, -S.counterDepth - 0.14, 1.32 + (i % 2) * 0.12, xa + 0.38, -S.counterDepth - 0.06, 1.76, i % 2 ? SLOT : FABRIC[(i * 3) % FABRIC.length], false, true);
  }
  b.box(-L + 0.4, -S.depth + 0.2, 0, -L + 1.1, -S.depth + 0.7, 0.7, T.boxDark);
  return b.done('goods-general');
}

/** Cheese / nuts: wheels as octagonal drums stacked on the counter, a tall glass-fronted tier behind. */
export function cheeseModel(): MarketMesh {
  const b = new Soup(), T = MARKET_TONES, n = 6, r = 0.17;
  const drum = (cx: number, cy: number, z0: number, h: number): void => {
    const ring = (z: number) => Array.from({ length: n }, (_, i): V => [cx + r * Math.cos((i + 0.5) * 2 * Math.PI / n), cy + r * Math.sin((i + 0.5) * 2 * Math.PI / n), z]);
    const a = ring(z0), c = ring(z0 + h);
    for (let i = 0; i < n; i++) b.quad(a[i], a[(i + 1) % n], c[(i + 1) % n], c[i], T.cheeseRind);
    for (let i = 1; i < n - 1; i++) b.tri(c[0], c[i], c[i + 1], T.cheese);
  };
  for (let i = 0; i < 5; i++) drum(gx0 + 0.25 + i * (gx1 - gx0 - 0.5) / 4, (gy0 + gy1) / 2, top, 0.1 + (i % 2) * 0.1);
  b.box(-L + 0.4, -S.counterDepth - 0.5, 0, L - 0.4, -S.counterDepth - 0.1, 1.5, T.counter, true, false, T.cheese);
  return b.done('goods-cheese');
}

/** Flowers: two tiers of bucket troughs on the counter with bunches as coloured blocks (the Ten Katemarkt flower stalls). */
export function flowersModel(): MarketMesh {
  const b = new Soup(), T = MARKET_TONES, n = 6;
  for (let r = 0; r < 2; r++) {
    const ya = r ? gy0 : (gy0 + gy1) / 2, yb = r ? (gy0 + gy1) / 2 - 0.04 : gy1, z0 = top + r * 0.2;
    b.box(gx0, ya, z0, gx1, yb, z0 + 0.22, T.bucket, false);
    for (let i = 0; i < n; i++) {
      const xa = gx0 + i * (gx1 - gx0) / n + 0.03, xb = xa + (gx1 - gx0) / n - 0.06;
      b.box(xa, ya, z0 + 0.22, xb, yb, z0 + 0.42, FLOWERS[(i + r * 2) % FLOWERS.length]);
    }
  }
  return b.done('goods-flowers');
}

/** Van / food truck: box body in the instance tone, a darker cab, a serving hatch on the aisle side, four wheels. */
export function vanModel(): MarketMesh {
  const b = new Soup(), T = MARKET_TONES, V0 = VAN, l = V0.length / 2, w = V0.width / 2, r = V0.wheelR;
  b.box(-l + V0.cabLength, -w, r, l, w, V0.height, SLOT, true);
  b.box(-l, -w, r, -l + V0.cabLength, w, V0.height - 0.55, SLOT, true);
  b.quad([-l - 0.005, w - 0.15, 1.3], [-l - 0.005, -w + 0.15, 1.3], [-l - 0.005, -w + 0.15, V0.height - 0.65], [-l - 0.005, w - 0.15, V0.height - 0.65], T.glass);
  // Serving hatch: the aisle side (+y) of the body, its flap propped up.
  b.quad([-l + V0.cabLength + 0.5, w + 0.005, 1.1], [l - 0.4, w + 0.005, 1.1], [l - 0.4, w + 0.005, 2.05], [-l + V0.cabLength + 0.5, w + 0.005, 2.05], T.boxDark);
  b.quad2([-l + V0.cabLength + 0.5, w, 2.1], [l - 0.4, w, 2.1], [l - 0.4, w + 0.6, 2.3], [-l + V0.cabLength + 0.5, w + 0.6, 2.3], SLOT);
  for (const x of [-l + 0.75, l - 0.9]) for (const y of [-w, w - 0.22]) b.box(x - r, y, 0, x + r, y + 0.22, 2 * r, T.tyre, true);
  return b.done('van');
}

export const MARKET_MODELS: Readonly<Record<MarketPartId, () => MarketMesh>> = {
  'stall-frame': frameModel, 'roof-plain': roofPlainModel, 'roof-striped': roofStripedModel,
  'goods-produce': produceModel, 'goods-fabric': fabricModel, 'goods-fish': fishModel, 'goods-general': generalModel,
  'goods-cheese': cheeseModel, 'goods-flowers': flowersModel, van: vanModel,
};
export const goodsPart = (k: GoodsKind): MarketPartId => `goods-${k}` as MarketPartId;
