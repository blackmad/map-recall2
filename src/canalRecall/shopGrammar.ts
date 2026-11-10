// Shopfront grammar (`?shopGrammar=1`, lane B6.5): the colour a generic shop's ground floor is painted.
//
// Before: a shop's ground floor drew its paint from GROUND_PAINTS (60 % cream, 10 % each racing green, oxblood,
// navy, grey, black), a guess. Measured: the 299 storefront specs read off Amsterdam panoramas (storefrontSpecs.ts,
// scripts/storefronts/) whose building the shopfronts extract classes as a café/restaurant/bar (289 shopCafe,
// 10 shopBar; one shopDeli)  say ground-floor paint is cream/white 35 %, warm brown/terracotta
// 25 %, near-black 21 %, charcoal 10 %, mid grey 6 % and cool navy/slate 4 %: dark neutrals and browns dominate,
// racing green and oxblood (20 % of the old table) do not occur. The retail kinds (florist, bike, window shop, supermarket) have no measured
// specs of their own (n = 0), so they use the same measured distribution rather than an invented one.
//
// Colour only: no new texture cell. `groundHex` already tints the ground-floor cell, so the layer count is unchanged.
// Off (the default), `shopGroundHex` is never called and every pick is as before.
import { unitDraw } from './buurtProfiles/profiles.js';
import { lookHex, type BuildingLook } from './look/palette.js';

export function shopGrammarEnabled(): boolean {
  const g = globalThis as { __canalRecallShopGrammar?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallShopGrammar === 'boolean') return g.__canalRecallShopGrammar;
  try { return new URLSearchParams(g.location?.search ?? '').get('shopGrammar') === '1'; } catch { return false; }
}

export type PaintClass = 'pale' | 'grey' | 'charcoal' | 'black' | 'warm' | 'cool';
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
/** HSL lightness, saturation, hue (degrees) of a #rrggbb. */
function hsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [l, 0, 0];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [l, s, h * 60];
}
/** The measured-paint class of a colour (the classes the table below was derived with). */
export function paintClass(hex: string): PaintClass {
  const [l, s, h] = hsl(hex);
  if (l > 0.8) return 'pale';
  if (s < 0.12) return l < 0.18 ? 'black' : l < 0.3 ? 'charcoal' : 'grey';
  if (l < 0.18) return 'black';
  return h < 65 || h >= 330 ? 'warm' : 'cool';
}
const hexOf = (c: [number, number, number]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
/** Weighted class medians of a set of sampled paints: how SHOP_GROUND_PAINTS was derived (see shopGrammar.test.ts). */
export function derivePalette(hexes: readonly string[]): Array<{ cls: PaintClass; hex: string; n: number }> {
  const by = new Map<PaintClass, string[]>();
  for (const h of hexes) { const c = paintClass(h); (by.get(c) ?? by.set(c, []).get(c)!).push(h); }
  return [...by].map(([cls, list]) => {
    const ch = [1, 3, 5].map(i => list.map(h => parseInt(h.slice(i, i + 2), 16)).sort((a, b) => a - b)).map(a => a[a.length >> 1]) as [number, number, number];
    return { cls, hex: hexOf(ch), n: list.length };
  }).sort((a, b) => b.n - a.n);
}

/** Class medians of the 298 measured (299 until the 2026-11-10 shopfronts refresh) hospitality ground-floor walls, weighted by count (n in comments). */
export const SHOP_GROUND_PAINTS: ReadonlyArray<{ hex: string; weight: number }> = [
  { hex: '#ece6e0', weight: 105 }, // pale (cream, white)
  { hex: '#7a4a38', weight: 74 },  // warm (brown, terracotta, warm dark)
  { hex: '#2a2a2c', weight: 62 },  // black / near-black
  { hex: '#3a3c3c', weight: 29 },  // charcoal
  { hex: '#8a8a86', weight: 17 },  // mid grey
  { hex: '#3a4f7a', weight: 11 },  // cool (navy, slate)
];
const TOTAL = SHOP_GROUND_PAINTS.reduce((s, p) => s + p.weight, 0);

/** The ground-floor paint of a shop: the measured distribution, a stable draw per building. */
export function shopGroundHex(id: string, look: BuildingLook): string {
  let r = unitDraw(id, 'shopPaint') * TOTAL;
  for (const p of SHOP_GROUND_PAINTS) { if (r < p.weight) return look === 'photo' ? p.hex : lookHex(p.hex, look); r -= p.weight; }
  return SHOP_GROUND_PAINTS[0].hex;
}
