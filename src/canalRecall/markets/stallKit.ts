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
  /** The canvas is as long as the frame pitch (frame + placer.ts STALL_GAP_M): neighbouring roofs butt into one tunnel. */
  roofLength: 4.3,
  depth: 2.2,
  post: 0.05,
  counterH: 0.9,
  counterDepth: 1.0,
  counterT: 0.06,
  roofFrontZ: 2.4,
  roofBackZ: 2.8,
  overhang: 0.5,
  valance: 0.28,
  backSheetBottom: 0.9,
  /** Ten Kate parasol: a rectangular pyramid over the table, its pole at the table's back edge. */
  parasolW: 4.1,
  parasolD: 2.8,
  parasolEdgeZ: 2.35,
  parasolPeakZ: 2.95,
  parasolValance: 0.16,
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

/**
 * Produce tones read from the Ten Katemarkt 2024-12-11 capture and the Cuyp 2020 shot (oranges, apples, greens, lemons,
 * aubergines), toned down after round 1's sheets: in the photos the heaps sit in the canvas shade and read muted.
 */
export const PRODUCE = ['#c27a45', '#a24a3e', '#6b8a47', '#c4ad52', '#4e3d4c', '#93a85e', '#b05c40', '#b89a50', '#7d9a52', '#8c3f3a'] as const;
export const FABRIC = ['#3a4660', '#7a4046', '#c9c2b4', '#4a6458', '#a89058', '#5e5068', '#2e2f33', '#8e6450', '#b0a89a', '#56606a'] as const;
export const FLOWERS = ['#c4486e', '#d9b444', '#cf6a35', '#9a5aa8', '#ece6d8', '#b0405e'] as const;
/** A tone scaled toward black (shade < 1) or white (shade > 1): the sunlit and shaded sides of one heap. */
export function shadeOf(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const out = c.map(v => Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)));
  return `#${out.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

export type MarketPartId =
  | 'stall-frame' | 'stall-table' | 'roof-plain' | 'roof-striped' | 'roof-parasol'
  | 'goods-produce' | 'goods-fabric' | 'goods-fish' | 'goods-general' | 'goods-cheese' | 'goods-flowers'
  | 'van';
export const MARKET_PART_IDS: readonly MarketPartId[] = ['stall-frame', 'stall-table', 'roof-plain', 'roof-striped', 'roof-parasol', 'goods-produce', 'goods-fabric', 'goods-fish', 'goods-general', 'goods-cheese', 'goods-flowers', 'van'];
export type GoodsKind = 'produce' | 'fabric' | 'fish' | 'general' | 'cheese' | 'flowers';
export const GOODS_KINDS: readonly GoodsKind[] = ['produce', 'fabric', 'fish', 'general', 'cheese', 'flowers'];

/**
 * Per-part triangle caps (the street-furniture rule: one instanced draw per part, so a part's triangles multiply by
 * every stall; Albert Cuyp places ~250 stalls). A whole stall (frame + roof + goods) stays under STALL_TRI_CAP.
 */
export const MARKET_TRI_CAPS: Readonly<Record<MarketPartId, number>> = {
  'stall-frame': 64, 'stall-table': 64, 'roof-plain': 40, 'roof-striped': 140, 'roof-parasol': 40,
  'goods-produce': 140, 'goods-fabric': 160, 'goods-fish': 120, 'goods-general': 140, 'goods-cheese': 140, 'goods-flowers': 140,
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

/** Counter: a board on trestles at the front, the cloth skirt hiding the crates under it (frame and table stalls). */
function counter(b: Soup): void {
  const T = MARKET_TONES;
  b.box(-L + 0.08, -S.counterDepth, S.counterH - S.counterT, L - 0.08, 0.02, S.counterH, T.counter, true, true);
  b.quad([-L + 0.1, 0.03, 0.05], [L - 0.1, 0.03, 0.05], [L - 0.1, 0.03, S.counterH - S.counterT], [-L + 0.1, 0.03, S.counterH - S.counterT], T.counterCloth);
}

/** Frame: four posts up to the canvas, the front roof rail, the counter. */
export function frameModel(): MarketMesh {
  const b = new Soup(), p = S.post / 2, T = MARKET_TONES;
  for (const x of [-L + p, L - p]) for (const y of [-p, -S.depth + p]) b.box(x - p, y - p, -0.2, x + p, y + p, roofZ(y), T.steel, false);
  b.box(-L, -p, roofZ(0) - 0.07, L, p, roofZ(0) - 0.02, T.steel, false, true);
  counter(b);
  return b.done('stall-frame');
}

/** Table stall (under a parasol, Ten Kate): the counter on four trestle legs, crates stacked behind. */
export function tableModel(): MarketMesh {
  const b = new Soup(), T = MARKET_TONES;
  for (const x of [-L + 0.15, L - 0.2]) for (const y of [-0.08, -S.counterDepth + 0.05]) b.box(x, y, -0.2, x + 0.05, y + 0.04, S.counterH - S.counterT, T.steelDark, false);
  counter(b);
  b.box(-L + 0.3, -S.depth + 0.3, 0, -L + 1.0, -S.depth + 0.85, 0.75, T.crate);
  return b.done('stall-table');
}

/**
 * Canvas roof (the Cuyp, 2020-01-06 and 2022-03-21 rows): one slab as long as the frame pitch, so neighbours butt into
 * a continuous covered tunnel, low over the aisle (2.4 m) and rising to 2.8 m at the back; a deep valance on the
 * street side; the back sheet down to the counter; the back half of each end closed.
 */
function roof(stripes: number): MarketMesh {
  const b = new Soup(), y0 = S.overhang, y1 = -S.depth - 0.05, z0 = roofZ(y0), z1 = roofZ(y1), R = S.roofLength / 2;
  const n = Math.max(1, stripes), w = S.roofLength / n;
  for (let i = 0; i < n; i++) {
    // Stripes run front-to-back (the Cuyp red-and-white awnings); odd stripes white.
    const hex = n > 1 && i % 2 === 1 ? MARKET_TONES.white : SLOT, xa = -R + i * w, xb = xa + w;
    b.quad2([xa, y1, z1], [xb, y1, z1], [xb, y0, z0], [xa, y0, z0], hex);
    b.quad2([xa, y0, z0], [xb, y0, z0], [xb, y0, z0 - S.valance], [xa, y0, z0 - S.valance], hex);
  }
  b.quad2([-R, -S.depth, S.backSheetBottom], [R, -S.depth, S.backSheetBottom], [R, -S.depth, z1], [-R, -S.depth, z1], SLOT);
  for (const x of [-L, L]) b.quad2([x, -S.depth, S.backSheetBottom], [x, -S.counterDepth, S.backSheetBottom], [x, -S.counterDepth, roofZ(-S.counterDepth)], [x, -S.depth, z1], SLOT);
  return b.done(n > 1 ? 'roof-striped' : 'roof-plain');
}
export const roofPlainModel = (): MarketMesh => roof(1);
/** Eight stripes across the roof, as on the Cuyp's red-and-white and green-and-white awnings. */
export const STRIPES = 8;
export const roofStripedModel = (): MarketMesh => roof(STRIPES);

/**
 * Parasol (the Ten Katemarkt's lime- and dark-green market umbrellas, 2024-12-11): a square-cornered pyramid over the
 * table and the trader's space, centred over the back of the counter, a short valance all round, the pole.
 */
export function parasolModel(): MarketMesh {
  // The canopy's front edge reaches the roof overhang line; the pole (and the peak) stands just behind the counter.
  const b = new Soup(), T = MARKET_TONES, hw = S.parasolW / 2, hd = S.parasolD / 2, cy = S.overhang - hd, py = -S.counterDepth - 0.1, ze = S.parasolEdgeZ, zp = S.parasolPeakZ;
  const c: V[] = [[-hw, cy - hd, ze], [hw, cy - hd, ze], [hw, cy + hd, ze], [-hw, cy + hd, ze]], peak: V = [0, py, zp];
  for (let i = 0; i < 4; i++) {
    const p0 = c[i], p1 = c[(i + 1) % 4];
    b.tri(p0, p1, peak, SLOT); b.tri(p0, peak, p1, SLOT);
    b.quad2(p0, p1, [p1[0], p1[1], ze - S.parasolValance], [p0[0], p0[1], ze - S.parasolValance], SLOT);
  }
  b.box(-0.025, py - 0.025, 0, 0.025, py + 0.025, zp, T.steel, false);
  return b.done('roof-parasol');
}

/** Goods sit on the counter top (z = counterH) between x ±(L - 0.15), y in [-counterDepth + 0.05, -0.05]. */
const top = S.counterH, gx0 = -L + 0.2, gx1 = L - 0.2, gy0 = -S.counterDepth + 0.08, gy1 = -0.06;

/**
 * Produce: three rows of crates stepped up toward the trader (the sloped display), each heaped in one fruit or
 * vegetable with a sunlit front slope and a shaded back slope (two shades per crate), crates stacked behind.
 */
export function produceModel(): MarketMesh {
  const b = new Soup(), cols = 6, rows = 3, w = (gx1 - gx0) / cols, dRow = (gy1 - gy0) / rows, T = MARKET_TONES;
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
    const xa = gx0 + i * w + 0.02, xb = xa + w - 0.04, yb = gy1 - r * dRow, ya = yb - dRow + 0.03, zc = top + r * 0.13;
    const fruit = PRODUCE[(r * 7 + i * 3 + (i >> 1)) % PRODUCE.length], ym = (ya + yb) / 2, zm = zc + 0.17;
    b.quad([xa, yb, zc - 0.02], [xb, yb, zc - 0.02], [xb, yb, zc + 0.09], [xa, yb, zc + 0.09], T.crate); // crate front
    b.quad([xa, yb, zc + 0.09], [xb, yb, zc + 0.09], [xb, ym, zm], [xa, ym, zm], shadeOf(fruit, 1.12)); // heap, aisle side
    b.quad([xa, ym, zm], [xb, ym, zm], [xb, ya, zc + 0.1], [xa, ya, zc + 0.1], shadeOf(fruit, 0.78)); // heap, back
  }
  b.box(-L + 0.3, -S.depth + 0.15, 0, -L + 0.9, -S.depth + 0.6, 0.85, T.crateGreen);
  b.box(L - 0.9, -S.depth + 0.15, 0, L - 0.3, -S.depth + 0.6, 0.55, T.crate);
  return b.done('goods-produce');
}

/** Textiles: two rails of hanging garments (one over the counter's back, one behind), folded stacks on the counter. */
export function fabricModel(): MarketMesh {
  const b = new Soup(), T = MARKET_TONES, n = 6, w = (S.length - 0.6) / n;
  for (const [k, y, zTop] of [[0, -S.counterDepth - 0.3, 2.05], [1, -S.depth + 0.35, 2.2]] as const) {
    b.box(-L + 0.25, y - 0.02, zTop, L - 0.25, y + 0.02, zTop + 0.04, T.rack, true, true);
    for (let i = 0; i < n; i++) {
      const xa = -L + 0.3 + i * w + 0.015, xb = xa + w - 0.03, hex = FABRIC[(i * 3 + k * 5) % FABRIC.length], z0 = (k ? 1.1 : 1.0) + ((i + k) % 3) * 0.14;
      b.box(xa, y - 0.17, z0, xb, y + 0.17, zTop - 0.03, hex, false, false);
    }
  }
  for (let i = 0; i < 3; i++) {
    const xa = gx0 + i * (gx1 - gx0) / 3 + 0.05, xb = xa + (gx1 - gx0) / 3 - 0.1;
    b.box(xa, gy0 + 0.1, top, xb, gy1 - 0.1, top + 0.14 + (i % 2) * 0.08, FABRIC[(i * 5 + 2) % FABRIC.length], true, false);
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
  'stall-frame': frameModel, 'stall-table': tableModel, 'roof-plain': roofPlainModel, 'roof-striped': roofStripedModel, 'roof-parasol': parasolModel,
  'goods-produce': produceModel, 'goods-fabric': fabricModel, 'goods-fish': fishModel, 'goods-general': generalModel,
  'goods-cheese': cheeseModel, 'goods-flowers': flowersModel, van: vanModel,
};
export const goodsPart = (k: GoodsKind): MarketPartId => `goods-${k}` as MarketPartId;
