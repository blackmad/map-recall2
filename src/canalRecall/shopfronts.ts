// Shopfronts where the shops really are.
//
// A random third of the city's ground floors used to be shops, so a busy shopping
// street (Clercqstraat, Rozengracht) looked like a quiet residential one and vice versa.
// `scripts/build-shopfronts.ts` places every OSM shop, café, restaurant and bar on the
// building it belongs to, picks a shopfront that matches what it sells, and marks the
// buildings along a busy stretch as likely shops too. At runtime the building decorator
// stamps `shopKind` (a shopfront) or `shopQuiet` (no shop) onto each feature, so the mesh
// builder, which runs in a worker, needs nothing but the feature.

import type { ShopKind } from './bayTextures.js';

/**
 * `colours`: a named business's own sign and awning colour, per building. `signatures`: the
 * businesses the game labels on the map (or chains of 3+ branches), whose building gets a 3D
 * awning and blade sign at their OSM point [lng, lat].
 */
export type ShopfrontExtract = {
  version: 1; kinds: ShopKind[]; buildings: Record<string, number>; colours?: Record<string, string>; signatures?: Record<string, [number, number]>;
  /** Supermarket chain stores (scripts/build-supermarkets.ts): building id -> [chain key, lng, lat] of the store's OSM point. */
  chains?: Record<string, [string, number, number]>;
};

/**
 * A supermarket chain's shopfront: the fascia board's colour, the logo panel at the entrance
 * end with its inner mark, and a short brand word in blocky capitals on the fascia.
 */
export type ChainLook = { name: string; fascia: string; logo: string; mark: string; letters: string; word: string };

/**
 * The chains in Amsterdam's OSM data (2026-10, ground-floor stores incl. XL / to go / city formats: 134 Albert
 * Heijn, 30 Jumbo, 19 Lidl, 19 Spar, 18 Vomar, 16 Dirk, 16 Ekoplaza, 8 Aldi, 5 DekaMarkt, 5 Plus). Colours are the fills of
 * each chain's logo SVG on Wikimedia Commons (via its Wikidata P154), except Dirk, whose logo is
 * a PNG (its red is the familiar Dirk red, not measured).
 */
export const SUPERMARKET_CHAINS: Record<string, ChainLook> = {
  ah: { name: 'Albert Heijn', fascia: '#00a0e2', logo: '#ffffff', mark: '#00a0e2', letters: '#ffffff', word: 'AH' },
  jumbo: { name: 'Jumbo', fascia: '#ffcc00', logo: '#1d1d1b', mark: '#ffcc00', letters: '#1d1d1b', word: 'JUMBO' },
  lidl: { name: 'Lidl', fascia: '#0050aa', logo: '#fff000', mark: '#e60a14', letters: '#fff000', word: 'LIDL' },
  aldi: { name: 'Aldi', fascia: '#001e78', logo: '#00b4dc', mark: '#c80000', letters: '#ffffff', word: 'ALDI' },
  dirk: { name: 'Dirk', fascia: '#e30613', logo: '#ffffff', mark: '#e30613', letters: '#ffffff', word: 'DIRK' },
  vomar: { name: 'Vomar', fascia: '#fc0816', logo: '#ffffff', mark: '#fc0816', letters: '#ffffff', word: 'VOMAR' },
  ekoplaza: { name: 'Ekoplaza', fascia: '#00803c', logo: '#95c11f', mark: '#702483', letters: '#ffffff', word: 'EKOPLAZA' },
  spar: { name: 'Spar', fascia: '#157946', logo: '#ec1b24', mark: '#ffffff', letters: '#ffffff', word: 'SPAR' },
  dekamarkt: { name: 'DekaMarkt', fascia: '#e41f13', logo: '#ffffff', mark: '#e41f13', letters: '#ffffff', word: 'DEKA' },
  plus: { name: 'Plus', fascia: '#227647', logo: '#7fbb1d', mark: '#e3131d', letters: '#ffffff', word: 'PLUS' },
};

/** Brand Wikidata ids (OSM brand:wikidata) of each chain's formats: XL, to go, city, express. */
const CHAIN_WIKIDATA: Record<string, string> = {
  Q1653985: 'ah', Q77971185: 'ah', Q78163765: 'ah', Q2262314: 'jumbo', Q124846605: 'jumbo', Q151954: 'lidl', Q41171373: 'aldi',
  Q17502722: 'dirk', Q3202837: 'vomar', Q47017915: 'ekoplaza', Q140024015: 'ekoplaza', Q610492: 'spar', Q124630664: 'spar', Q12321004: 'spar',
  Q124630660: 'spar', Q2489350: 'dekamarkt', Q1978981: 'plus',
};
const CHAIN_NAMES: Array<[RegExp, string]> = [[/^(albert heijn|ah\b)/, 'ah'], [/^jumbo\b/, 'jumbo'], [/^lidl\b/, 'lidl'], [/^aldi\b/, 'aldi'], [/^dirk\b/, 'dirk'], [/^vomar\b/, 'vomar'], [/^ekoplaza\b/, 'ekoplaza'], [/^spar\b/, 'spar'], [/^deka(markt)?\b/, 'dekamarkt'], [/^plus\b/, 'plus']];

/** The supermarket chain an OSM supermarket or convenience store belongs to, or null for an independent. */
export function chainForTags(tags: Record<string, string>): string | null {
  if (tags.shop !== 'supermarket' && tags.shop !== 'convenience') return null;
  const byId = CHAIN_WIKIDATA[tags['brand:wikidata'] ?? ''];
  if (byId) return byId;
  const label = (tags.brand ?? tags.name ?? '').trim().toLowerCase();
  return CHAIN_NAMES.find(([re]) => re.test(label))?.[1] ?? null;
}

/** Sign colours for businesses with no colour of their own in OSM: deep shop-sign colours that read on brick. */
export const SIGN_COLOURS = ['#1f4d3a', '#1c3a5e', '#7a1f2b', '#c9a227', '#2a6f6f', '#222222', '#8a3b12', '#4b2c5e', '#b8442c', '#2f5d8a', '#5a6b2a', '#d6c7a1'];

/** A business's colour: its OSM colour if tagged, else one picked by its name (every branch of a chain alike). */
export function businessColour(name: string, tagged?: string): string {
  if (tagged && /^#[0-9a-f]{6}$/i.test(tagged)) return tagged.toLowerCase();
  let h = 2166136261;
  for (const c of name.trim().toLowerCase()) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return SIGN_COLOURS[(h >>> 0) % SIGN_COLOURS.length];
}

/** The shopfront for an OSM POI's tags, or null when it is not a ground-floor business. */
export function shopKindForTags(tags: Record<string, string>): ShopKind | null {
  const amenity = tags.amenity, shop = tags.shop;
  if (amenity === 'cafe' || amenity === 'ice_cream') return 'shopCafe';
  if (amenity === 'bar' || amenity === 'pub') return 'shopBar';
  if (amenity === 'restaurant' || amenity === 'fast_food') return 'shopCafe';
  if (amenity === 'pharmacy' || amenity === 'bank') return 'shopWindow';
  if (!shop || shop === 'vacant' || shop === 'no') return null;
  if (['bakery', 'pastry', 'cheese', 'deli', 'greengrocer', 'butcher', 'seafood', 'confectionery', 'chocolate', 'coffee', 'tea', 'spices', 'farm'].includes(shop)) return 'shopDeli';
  if (['florist', 'garden_centre', 'plant'].includes(shop)) return 'shopFlorist';
  if (shop === 'bicycle') return 'shopBike';
  if (['supermarket', 'convenience', 'chemist', 'variety_store', 'hardware', 'doityourself'].includes(shop)) return 'groundShop';
  return 'shopWindow';
}

let extract: ShopfrontExtract | null = null;

/** Install the published extract; null removes it (every building falls back to the old random shops). */
export function setShopfronts(data: ShopfrontExtract | null): void {
  extract = data && Array.isArray(data.kinds) && data.buildings ? data : null;
}

export const shopfrontsLoaded = () => extract !== null;

type GeoFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };

/**
 * Stamp a building's shopfront (`shopKind`) or, once the extract is in, `shopQuiet` on the rest.
 * A chain supermarket gets `shopChain` ([key, lng, lat]) and, unless the block's ground floor also
 * holds a café or food shop, the shop window in its fascia colour.
 */
export function decorateShopfront<T extends GeoFeature>(feature: T): T {
  if (!extract) return feature;
  const p = feature.properties;
  if (p.shopKind !== undefined || p.shopQuiet !== undefined) return feature;
  const index = extract.buildings[String(p.id ?? '')];
  const kind = index === undefined ? undefined : extract.kinds[index];
  const id = String(p.id ?? ''), chain = extract.chains?.[id], look = chain ? SUPERMARKET_CHAINS[chain[0]] : undefined;
  // A block whose ground floor also holds cafés or a bakery keeps those fronts in their own colours.
  const mixed = !!kind && kind !== 'groundShop' && kind !== 'shopWindow';
  if (chain && look) return { ...feature, properties: { ...p, shopKind: mixed ? kind : 'shopWindow', shopChain: chain, ...(mixed ? (extract.colours?.[id] ? { shopColour: extract.colours[id] } : {}) : { shopColour: look.fascia }) } };
  const colour = extract.colours?.[id], at = extract.signatures?.[id];
  return { ...feature, properties: { ...p, ...(kind ? { shopKind: kind } : { shopQuiet: true }), ...(colour ? { shopColour: colour } : {}), ...(at ? { shopSignature: at } : {}) } };
}
