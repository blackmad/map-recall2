import type { BboxLngLat, LngLat } from './sources.ts';

export const BAG_OGC_API = 'https://api.pdok.nl/kadaster/bag/ogc/v2';
export const BAG_SCHEMA_VERSION = 'pdok-bag-ogc-v2';

type JsonObject = Record<string, unknown>;

export interface BagFeature {
  id: string;
  type?: 'Feature';
  properties: JsonObject;
  geometry?: { type: string; coordinates: unknown } | null;
}

export interface BagAddress {
  addressId: string;
  vboId: string;
  publicSpaceId: string;
  publicSpaceName: string;
  houseNumber: number;
  houseLetter: string | null;
  suffix: string | null;
  postalCode: string | null;
  localityId: string | null;
  localityName: string | null;
  status: string;
  primary: boolean;
}

export interface BagVbo {
  vboId: string;
  bagItemId: string;
  status: string;
  uses: string[];
  areaSquareMetres: number | null;
  mainAddressId: string | null;
  pandItemIds: string[];
  addresses: BagAddress[];
}

export interface BuildingIdentity {
  pandId: string;
  bagItemId: string;
  addresses: BagAddress[];
  vbos: BagVbo[];
  footprintLngLat: LngLat[];
  constructionYear: number | null;
  status: string;
  active: boolean;
  sourceVersions: {
    registry: typeof BAG_SCHEMA_VERSION;
    endpoint: typeof BAG_OGC_API;
    retrievedAt: string;
  };
}

const strings = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value === 'string') return value.split(',').map(entry => entry.trim()).filter(Boolean);
  return [];
};
const nullableString = (value: unknown): string | null => typeof value === 'string' && value.length > 0 ? value : null;
const nullableNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const itemId = (href: string) => href.split('/').filter(Boolean).at(-1) ?? href;

const outerRing = (geometry: BagFeature['geometry']): LngLat[] => {
  if (!geometry) return [];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates as unknown[] : [];
  let largest: LngLat[] = [];
  let largestArea = -Infinity;
  for (const polygon of polygons as unknown[][]) {
    const ring = polygon?.[0] as unknown[] | undefined;
    if (!Array.isArray(ring)) continue;
    const points = ring
      .filter((point): point is [number, number] => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
      .map(([lng, lat]) => [lng, lat] as LngLat);
    let area = 0;
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
      area += points[previous][0] * points[index][1] - points[index][0] * points[previous][1];
    }
    if (Math.abs(area) > largestArea) { largestArea = Math.abs(area); largest = points; }
  }
  return largest;
};

export function buildBagIdentities(
  pandFeatures: readonly BagFeature[],
  vboFeatures: readonly BagFeature[],
  addressFeatures: readonly BagFeature[],
  retrievedAt: string,
): BuildingIdentity[] {
  const addressesByVbo = new Map<string, BagAddress[]>();
  for (const feature of addressFeatures) {
    const properties = feature.properties;
    const vboId = nullableString(properties.adresseerbaar_object_identificatie);
    const addressId = nullableString(properties.identificatie);
    const publicSpaceId = nullableString(properties.openbare_ruimte_identificatie);
    const publicSpaceName = nullableString(properties.openbare_ruimte_naam);
    const houseNumber = Number(properties.huisnummer);
    if (!vboId || !addressId || !publicSpaceId || !publicSpaceName || !Number.isFinite(houseNumber)) continue;
    const bucket = addressesByVbo.get(vboId) ?? [];
    bucket.push({
      addressId, vboId, publicSpaceId, publicSpaceName, houseNumber,
      houseLetter: nullableString(properties.huisletter), suffix: nullableString(properties.toevoeging),
      postalCode: nullableString(properties.postcode), localityId: nullableString(properties.woonplaats_identificatie),
      localityName: nullableString(properties.woonplaats_naam), status: nullableString(properties.status) ?? 'onbekend', primary: false,
    });
    addressesByVbo.set(vboId, bucket);
  }

  const vbosByPandItem = new Map<string, BagVbo[]>();
  for (const feature of vboFeatures) {
    const properties = feature.properties;
    const vboId = nullableString(properties.identificatie);
    if (!vboId) continue;
    const mainAddressId = nullableString(properties.hoofdadres_identificatie);
    const addresses = (addressesByVbo.get(vboId) ?? []).map(address => ({ ...address, primary: address.addressId === mainAddressId }))
      .sort((left, right) => left.addressId.localeCompare(right.addressId));
    const pandItemIds = strings(properties['pand.href']).map(itemId);
    const vbo: BagVbo = {
      vboId, bagItemId: feature.id, status: nullableString(properties.status) ?? 'onbekend', uses: strings(properties.gebruiksdoel),
      areaSquareMetres: nullableNumber(properties.oppervlakte), mainAddressId, pandItemIds, addresses,
    };
    for (const pandItem of pandItemIds) {
      const bucket = vbosByPandItem.get(pandItem) ?? [];
      bucket.push(vbo);
      vbosByPandItem.set(pandItem, bucket);
    }
  }

  return pandFeatures.flatMap(feature => {
    const properties = feature.properties;
    const pandId = nullableString(properties.identificatie);
    const footprintLngLat = outerRing(feature.geometry);
    if (!pandId || footprintLngLat.length < 4) return [];
    const vbos = (vbosByPandItem.get(feature.id) ?? []).sort((left, right) => left.vboId.localeCompare(right.vboId));
    const uniqueAddresses = new Map<string, BagAddress>();
    for (const vbo of vbos) for (const address of vbo.addresses) uniqueAddresses.set(address.addressId, address);
    const year = nullableNumber(properties.bouwjaar);
    const status = nullableString(properties.status) ?? 'onbekend';
    return [{
      pandId, bagItemId: feature.id, addresses: [...uniqueAddresses.values()].sort((a, b) => a.addressId.localeCompare(b.addressId)),
      vbos, footprintLngLat, constructionYear: year === 1005 ? null : year, status,
      active: status.startsWith('Pand in gebruik') || status === 'Verbouwing pand',
      sourceVersions: { registry: BAG_SCHEMA_VERSION, endpoint: BAG_OGC_API, retrievedAt },
    } satisfies BuildingIdentity];
  }).sort((left, right) => left.pandId.localeCompare(right.pandId));
}

interface FeatureCollection { features?: BagFeature[]; links?: Array<{ rel?: string; href?: string }>; }

async function fetchCollection(collection: 'pand' | 'verblijfsobject' | 'adres', bbox: BboxLngLat, fetchImpl: typeof fetch): Promise<BagFeature[]> {
  const features: BagFeature[] = [];
  let url: string | null = `${BAG_OGC_API}/collections/${collection}/items?bbox=${bbox.join(',')}&limit=1000&f=json`;
  while (url) {
    let response: Response | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      response = await fetchImpl(url, { headers: { 'User-Agent': 'MapRecallFacadeRebuild/1.0' }, signal: AbortSignal.timeout(45_000) });
      if (response.ok) break;
      if (response.status < 500 && response.status !== 429) throw new Error(`BAG ${collection}: HTTP ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
    if (!response?.ok) throw new Error(`BAG ${collection}: HTTP ${response?.status ?? 'no response'} after retries`);
    const payload = await response.json() as FeatureCollection;
    features.push(...(payload.features ?? []));
    url = payload.links?.find(link => link.rel === 'next')?.href ?? null;
  }
  return features;
}

export async function fetchBagBuildingIdentities(
  bbox: BboxLngLat,
  options: { fetchImpl?: typeof fetch; retrievedAt?: string } = {},
): Promise<BuildingIdentity[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const [panden, vbos, addresses] = await Promise.all([
    fetchCollection('pand', bbox, fetchImpl), fetchCollection('verblijfsobject', bbox, fetchImpl), fetchCollection('adres', bbox, fetchImpl),
  ]);
  return buildBagIdentities(panden, vbos, addresses, retrievedAt);
}

export const formatBagAddress = (address: BagAddress): string => {
  const number = `${address.houseNumber}${address.houseLetter ?? ''}${address.suffix ? `-${address.suffix}` : ''}`;
  return `${address.publicSpaceName} ${number}${address.postalCode ? `, ${address.postalCode}` : ''}${address.localityName ? ` ${address.localityName}` : ''}`;
};
