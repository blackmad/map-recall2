// Retail realism (lane retail-real-20261115): the texture-array layers the retail look uses after the two logo pages,
// and the flag that turns them on. Layout from the first logo layer (retailLogos.ts retailLogoLayer), in order:
//   +0, +1        logo pages 1 and 2 (round 6; atlas.png with the bold-sans lettering cell, atlas-2.png)
//   +2 ..         the window-goods layers (retailGoods.ts, painted at load: GOODS_LAYERS of them)
//   then          the lettering faces (retailType.ts: serif, condensed, script; published PNG pages)
//   then          the chain-logo pages (retailChainLogos.ts; published PNG pages)
// Facade layers are bytes (threeBuildingMesh layers: Uint8Array), and WebGL2 promises 256 array layers, so the last
// page must stay under 256 (checked by retailPages.test.ts).
//
// `?retailReal=0` (RETAIL_REAL=0 in Node) draws round n's look: two logo pages, the building's shop cell in the panes,
// the bold sans on every name, the ten round-6 chain logos. Default on in this lane.
import { GOODS_LAYERS } from './retailGoods.js';
import { TYPE_FACES } from './retailTypeFaces.js';
import { CHAIN_LOGO_PAGES } from './retailChainLogos.js';

export const RETAIL_REAL_DEFAULT = true;
export function retailRealEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]retailReal=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? RETAIL_REAL_DEFAULT : v === '1';
}
let cached: boolean | undefined;
/** The flag for this page or process (a test may set `__canalRecallRetailReal`). */
export function retailRealOn(): boolean {
  const g = globalThis as { __canalRecallRetailReal?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallRetailReal === 'boolean') return g.__canalRecallRetailReal;
  return (cached ??= retailRealEnabled(g.location?.search ?? null, g.process?.env?.RETAIL_REAL ?? null));
}

/** Offsets from the first logo layer. */
export const GOODS_BASE = 2;
export const TYPE_BASE = GOODS_BASE + GOODS_LAYERS;
export const CHAIN_LOGO_BASE = TYPE_BASE + TYPE_FACES.length;
/** Layers the retail look takes from the first logo layer: 2 without retailReal. */
export function retailPageCount(real = retailRealOn()): number {
  return real ? CHAIN_LOGO_BASE + CHAIN_LOGO_PAGES : 2;
}

let cachedAll: boolean | undefined;
/** `?retailRealAll=1` (RETAIL_REAL_ALL=1): every template takes its retail-real look, accepted or not (candidate frames for
 *  the blind A/B). Off by default: only REAL_ACCEPTED templates (retailTemplates.ts) do. */
export function retailRealAllOn(): boolean {
  const g = globalThis as { __canalRecallRetailRealAll?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallRetailRealAll === 'boolean') return g.__canalRecallRetailRealAll;
  return (cachedAll ??= /[?&]retailRealAll=1\b/.test(g.location?.search ?? '') || g.process?.env?.RETAIL_REAL_ALL === '1');
}

let cachedParts: boolean | undefined;
/** `?retailParts=1` (RETAIL_PARTS=1): round 4's template parts (retailTemplates.ts TEMPLATE_PARTS: shutter boxes, neon
 *  window signs, lettering on the glass) and per-pand front overrides. Off until they win a blind A/B. */
export function retailPartsOn(): boolean {
  const g = globalThis as { __canalRecallRetailParts?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallRetailParts === 'boolean') return g.__canalRecallRetailParts;
  return (cachedParts ??= /[?&]retailParts=1\b/.test(g.location?.search ?? '') || g.process?.env?.RETAIL_PARTS === '1');
}

let cachedBrand: boolean | undefined;
let cachedBrandAll: boolean | undefined;
/** Round 7 (lane retail-real; default on since round t, 2026-11-16, after its blind): the brands in ACCEPTED_BRANDS
 *  (retailBrandStyles.ts) draw their measured style (letters on the wall with no band, blade signs with their glyph,
 *  dark plate glass), and the pavement racks and boards draw as postcard stands and chalkboards. `?retailBrand=0`
 *  (RETAIL_BRAND=0) turns it off; `?retailBrand=all` (RETAIL_BRAND=all) applies every measured brand, for review. */
export function retailBrandOn(): boolean {
  const g = globalThis as { __canalRecallRetailBrand?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallRetailBrand === 'boolean') return g.__canalRecallRetailBrand;
  return (cachedBrand ??= !(/[?&]retailBrand=0\b/.test(g.location?.search ?? '') || g.process?.env?.RETAIL_BRAND === '0'));
}
/** `?retailBrand=all`: every measured brand style acts, not only the accepted ones. */
export function retailBrandAll(): boolean {
  const g = globalThis as { __canalRecallRetailBrandAll?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallRetailBrandAll === 'boolean') return g.__canalRecallRetailBrandAll;
  return (cachedBrandAll ??= /[?&]retailBrand=all\b/.test(g.location?.search ?? '') || g.process?.env?.RETAIL_BRAND === 'all');
}
