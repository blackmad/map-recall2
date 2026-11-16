// Shop interiors (lane shop-interiors-20261116, `?shopInteriors=1`, SHOP_INTERIORS=1 in Node; default off).
//
// A shop window's glass draws a room behind it by interior mapping: the glass quad's fragment shader casts the view ray
// into a virtual box (floor, ceiling, side walls, back wall, and one mid-plane of furniture with alpha) and samples the
// room's faces from one procedural atlas (atlas.ts). No geometry is added: the pane is one quad, as the glass was.
//
// This module is the pure half: the room kinds, which room a shop type gets (never a random room: a bakery's window
// shows a counter and bread shelves, a bike shop bikes), the seeded per-shop variant and how a pane carries all of it to
// the shader in its existing vertex attributes (uv and the accent colour), so the chunk layout is unchanged.
//
// Off: nothing here is called; every triangle, attribute and shader is as before.

import type { GoodsKind } from '../retailGoods.js';
import { TEMPLATE_REAL, type RetailTemplate } from '../retailTemplates.js';

/** The room kinds, in atlas order (atlas.ts paints one cell per kind). */
export const ROOM_KINDS = [
  'supermarket', 'clothing', 'cafeBar', 'restaurant', 'bakery', 'bikeShop', 'bookshop', 'pharmacy',
  'hairdresser', 'gallery', 'office', 'dark', 'takeaway', 'florist', 'shopGeneric',
] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

/**
 * Window goods (retailGoods.ts, the 40 shop types) to room. Typed as a full Record so a new goods kind fails to compile
 * until it is given a room. `redWindow` is null: red-light fronts are lane R's window part and keep their own look.
 */
export const GOODS_ROOM: Record<GoodsKind, RoomKind | null> = {
  aisles: 'supermarket', produce: 'supermarket', souvenirs: 'supermarket', liquor: 'supermarket',
  drugstore: 'pharmacy', pharmacy: 'pharmacy', cosmetics: 'pharmacy', ducks: 'pharmacy',
  bread: 'bakery', butcher: 'bakery', cheese: 'bakery', deli: 'bakery', gelato: 'bakery', waffles: 'bakery', jars: 'bakery',
  books: 'bookshop', magazines: 'bookshop', tobacco: 'bookshop',
  phones: 'gallery', optician: 'gallery', shoes: 'gallery',
  clothing: 'clothing',
  bikes: 'bikeShop',
  hair: 'hairdresser', tattoo: 'hairdresser',
  exchange: 'office',
  coffeeshop: 'dark', smartshop: 'dark',
  doner: 'takeaway', fastfood: 'takeaway', frites: 'takeaway', bainMarie: 'takeaway', bowls: 'takeaway',
  pizza: 'restaurant', pancakes: 'restaurant',
  cafe: 'cafeBar', brownBar: 'cafeBar',
  flowers: 'florist',
  // Own-light windows keep their own look: FEBO's lit automatiek wall is the front's identity; red-light windows are lane R's part.
  automatiek: null, redWindow: null,
};

/** Templates whose room is not their goods' (a restaurant shares the café's goods cell; templates with no goods). */
export const TEMPLATE_ROOM: Partial<Record<RetailTemplate, RoomKind | null>> = {
  restaurant: 'restaurant', cafe: 'cafeBar', brownBar: 'cafeBar', butcher: 'bakery', hairdresser: 'hairdresser',
  moneyTransfer: 'office', exchange: 'office', pizza: 'takeaway', redLight: null,
};

export type RoomQuery = {
  template?: RetailTemplate | string; goods?: GoodsKind;
  /** The generic shopfront's kind (shopfronts.ts `shopKind`): `groundShop` is a neutral shop with no template. */
  shopKind?: string;
  /** shopfronts.ts `shopQuiet`: a ground floor with no shop read; its window stays dark. */
  quiet?: boolean;
};

/**
 * The room a shop's window shows: the template's own, else its goods', else a neutral front's plain generic shop (dim,
 * never a trade), else dark for a quiet front. null: no interior (red-light windows, or nothing to say).
 */
export function roomFor(q: RoomQuery): RoomKind | null {
  if (q.template && q.template in TEMPLATE_ROOM) return TEMPLATE_ROOM[q.template as RetailTemplate] ?? null;
  // A template's trade is its retail-real goods kind, whether or not that look is accepted yet (a round-n chain front
  // still sells what it sells).
  const goods = q.goods ?? (q.template ? TEMPLATE_REAL[q.template as RetailTemplate]?.goods : undefined);
  if (goods) return GOODS_ROOM[goods];
  if (q.template) return null;
  if (q.quiet) return 'dark';
  if (q.shopKind === 'groundShop') return 'shopGeneric';
  return null;
}

/** Stable 0..1 hash of a string (FNV-1a), the same as retailFront.ts. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/**
 * The per-shop variant byte (0..255) from the shop's seed. The shader reads it as: bit 0 mirrors the room, bits 1-2 the
 * room's depth (ROOM_DEPTHS), bits 3-7 a horizontal offset into the room's repeating back wall and mid-plane.
 */
export function roomVariant(seed: string): number {
  return Math.floor(hash01(`${seed}:room`) * 256) & 255;
}
/** Depths (m) the variant picks from. */
export const ROOM_DEPTHS = [3.6, 4.4, 5.2, 6.0] as const;
export function decodeVariant(v: number): { mirror: boolean; depthM: number; offset: number } {
  return { mirror: (v & 1) === 1, depthM: ROOM_DEPTHS[(v >> 1) & 3], offset: (v >> 3) / 32 };
}

/** Pane uv: u runs 0..1 across the glass, v 0..1 up it; v is lifted by this marker so the shader knows an interior. */
export const INTERIOR_V = 4;
/** Accent bytes: room index, variant, flags (bit 0: the template draws lit, a chain's bright interior). */
export function interiorAccent(room: RoomKind, variant: number, lit: boolean): string {
  const r = ROOM_KINDS.indexOf(room);
  return '#' + [r, variant & 255, lit ? 1 : 0].map(v => v.toString(16).padStart(2, '0')).join('');
}
export function decodeAccent(hex: string): { room: RoomKind; variant: number; lit: boolean } {
  const n = parseInt(hex.slice(1), 16);
  return { room: ROOM_KINDS[(n >> 16) & 255], variant: (n >> 8) & 255, lit: (n & 1) === 1 };
}

let cached: boolean | undefined;
/** `?shopInteriors=1` (SHOP_INTERIORS=1 in Node); a test may set `__canalRecallShopInteriors`. Default off. */
export function shopInteriorsEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]shopInteriors=([01])\b/.exec(search)?.[1] : undefined;
  return (q ?? env) === '1';
}
export function shopInteriorsOn(): boolean {
  const g = globalThis as { __canalRecallShopInteriors?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallShopInteriors === 'boolean') return g.__canalRecallShopInteriors;
  return (cached ??= shopInteriorsEnabled(g.location?.search ?? null, g.process?.env?.SHOP_INTERIORS ?? null));
}
/** `?shopDusk=0..1`: the interiors' own light (0 day, 1 dusk: lit, warm, the reflection weaker). Default 0. */
export function shopDuskLevel(search?: string | null): number {
  const g = globalThis as { location?: { search?: string } };
  const v = Number(/[?&]shopDusk=([0-9.]+)/.exec(search ?? g.location?.search ?? '')?.[1] ?? 0);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}
