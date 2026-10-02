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

export type ShopfrontExtract = { version: 1; kinds: ShopKind[]; buildings: Record<string, number> };

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

/** Stamp a building's shopfront (`shopKind`) or, once the extract is in, `shopQuiet` on the rest. */
export function decorateShopfront<T extends GeoFeature>(feature: T): T {
  if (!extract) return feature;
  const p = feature.properties;
  if (p.shopKind !== undefined || p.shopQuiet !== undefined) return feature;
  const index = extract.buildings[String(p.id ?? '')];
  const kind = index === undefined ? undefined : extract.kinds[index];
  return { ...feature, properties: { ...p, ...(kind ? { shopKind: kind } : { shopQuiet: true }) } };
}
