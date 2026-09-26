/**
 * Playable Canal Recall cities and their extract roots.
 *
 * The extractor is city-agnostic; the runtime used to hardcode Amsterdam.
 * Everything that loads versioned data or stamps a recall key goes through
 * this catalog so a second city cannot silently write Amsterdam mastery.
 */

export const CANAL_CITY_IDS = ['amsterdam', 'utrecht', 'rotterdam', 'den-haag'] as const;
export type CanalCityId = (typeof CANAL_CITY_IDS)[number];

export interface CanalCityCenter {
  lat: number;
  lng: number;
}

/**
 * Nominatim `viewbox` order: west,north,east,south — same as the current
 * Amsterdam home-geocode URL.
 */
export type GeocodeViewbox = readonly [west: number, north: number, east: number, south: number];

export interface CanalCity {
  id: CanalCityId;
  /** Short UI label on the briefing. */
  name: string;
  /** Product line under the title, e.g. "Canal Recall". */
  productName: string;
  center: CanalCityCenter;
  /** Path relative to `public/canal-drive/` (used with `new URL(..., location)`). */
  extractPath: string;
  geocodeSuffix: string;
  geocodeViewbox: GeocodeViewbox;
  /** Postcard / place-only caption province. */
  provinceCaption: string;
  /** Offered on the route briefing. */
  playable: boolean;
  /**
   * Curated surprise-route anchors. Empty → destinations come only from the
   * prominence-ranked landmark extract (Utrecht / Rotterdam / Den Haag).
   */
  curatedPois: ReadonlyArray<{ id: string; name: string; lat: number; lng: number }>;
}

const AMSTERDAM_POIS: CanalCity['curatedPois'] = [
  { id: 'central', name: 'Central Station', lat: 52.3784943, lng: 4.899843 },
  { id: 'anne-frank', name: 'Anne Frank House', lat: 52.3753446, lng: 4.8840669 },
  { id: 'rijksmuseum', name: 'Rijksmuseum', lat: 52.3598672, lng: 4.8864162 },
  { id: 'maritime', name: 'National Maritime Museum', lat: 52.371493, lng: 4.9151332 },
  { id: 'nemo', name: 'NEMO Science Museum', lat: 52.3738532, lng: 4.9121113 },
  { id: 'palace', name: 'Royal Palace', lat: 52.373258, lng: 4.8918222 },
  { id: 'red-light', name: 'Red Light District', lat: 52.3719371, lng: 4.8956406 },
  { id: 'rembrandt', name: 'Rembrandt House', lat: 52.3693692, lng: 4.9012497 },
  { id: 'hart', name: 'H’ART Museum', lat: 52.3656522, lng: 4.9022137 },
  { id: 'westerkerk', name: 'Westerkerk', lat: 52.3743736, lng: 4.8837289 },
  { id: 'mint', name: 'Mint Tower', lat: 52.3670418, lng: 4.8932804 },
];

/** Degrees of padding around a city centre for Nominatim home search. */
function viewboxAround(center: CanalCityCenter, pad = 0.18): GeocodeViewbox {
  return [
    center.lng - pad,
    center.lat + pad,
    center.lng + pad,
    center.lat - pad,
  ];
}

export const CANAL_CITIES: Record<CanalCityId, CanalCity> = {
  amsterdam: {
    id: 'amsterdam',
    name: 'Amsterdam',
    productName: 'Canal Recall',
    center: { lat: 52.372851, lng: 4.8936 },
    extractPath: '../data/extracts/amsterdam',
    geocodeSuffix: ', Amsterdam',
    // Preserves the historical Amsterdam home search window.
    geocodeViewbox: [4.72, 52.43, 5.02, 52.27],
    provinceCaption: 'Noord-Holland',
    playable: true,
    curatedPois: AMSTERDAM_POIS,
  },
  utrecht: {
    id: 'utrecht',
    name: 'Utrecht',
    productName: 'Canal Recall',
    center: { lat: 52.0907374, lng: 5.1214201 },
    extractPath: '../data/extracts/utrecht',
    geocodeSuffix: ', Utrecht',
    geocodeViewbox: viewboxAround({ lat: 52.0907374, lng: 5.1214201 }),
    provinceCaption: 'Utrecht',
    playable: true,
    // Historic-core anchors — prominence ranking alone prefers universities
    // and Science Park over Dom / Oudegracht destinations.
    curatedPois: [
      { id: 'dom-tower', name: 'Dom tower', lat: 52.090764, lng: 5.121398 },
      { id: 'centraal-museum', name: 'Centraal Museum', lat: 52.083445, lng: 5.126395 },
      { id: 'museum-speelklok', name: 'Museum Speelklok', lat: 52.0907282, lng: 5.1194134 },
      { id: 'buurkerk', name: 'Buurkerk', lat: 52.090738, lng: 5.119781 },
      { id: 'jacobikerk', name: 'Jacobikerk', lat: 52.094895, lng: 5.115757 },
      { id: 'catharijneconvent', name: 'Museum Catharijneconvent', lat: 52.087646, lng: 5.124579 },
      { id: 'academiegebouw', name: 'Academiegebouw', lat: 52.0902439, lng: 5.1223339 },
      { id: 'inktpot', name: 'De Inktpot', lat: 52.087099, lng: 5.115846 },
      { id: 'pieterskerk', name: 'Pieterskerk', lat: 52.091397, lng: 5.124743 },
      { id: 'rietveld', name: 'Rietveld-Schröderhuis', lat: 52.085297, lng: 5.147607 },
    ],
  },
  rotterdam: {
    id: 'rotterdam',
    name: 'Rotterdam',
    productName: 'Canal Recall',
    center: { lat: 51.9225, lng: 4.47917 },
    extractPath: '../data/extracts/rotterdam',
    geocodeSuffix: ', Rotterdam',
    geocodeViewbox: viewboxAround({ lat: 51.9225, lng: 4.47917 }, 0.22),
    provinceCaption: 'Zuid-Holland',
    playable: true,
    curatedPois: [
      { id: 'euromast', name: 'Euromast', lat: 51.905356, lng: 4.466785 },
      { id: 'laurenskerk', name: 'Grote of Sint-Laurenskerk', lat: 51.921706, lng: 4.486122 },
      { id: 'doelen', name: 'de Doelen', lat: 51.9220495, lng: 4.4726898 },
      { id: 'bibliotheek', name: 'Centrale Bibliotheek', lat: 51.9223535, lng: 4.4871283 },
      { id: 'depot-boijmans', name: 'Depot Boijmans Van Beuningen', lat: 51.9139529, lng: 4.471132 },
      { id: 'zoo', name: 'Rotterdam Zoo', lat: 51.924954, lng: 4.450176 },
    ],
  },
  'den-haag': {
    id: 'den-haag',
    name: 'Den Haag',
    productName: 'Canal Recall',
    center: { lat: 52.0705, lng: 4.3007 },
    extractPath: '../data/extracts/den-haag',
    geocodeSuffix: ', Den Haag',
    geocodeViewbox: viewboxAround({ lat: 52.0705, lng: 4.3007 }),
    provinceCaption: 'Zuid-Holland',
    playable: true,
    curatedPois: [
      { id: 'binnenhof', name: 'Binnenhof', lat: 52.079334, lng: 4.312407 },
      { id: 'huis-ten-bosch', name: 'Huis ten Bosch', lat: 52.093169, lng: 4.343465 },
      { id: 'amare', name: 'Amare', lat: 52.078015, lng: 4.318695 },
      { id: 'catshuis', name: 'Catshuis', lat: 52.090293, lng: 4.284739 },
      { id: 'kb', name: 'KB, nationale bibliotheek', lat: 52.0815311, lng: 4.3275274 },
    ],
  },
};

export const DEFAULT_CITY_ID: CanalCityId = 'amsterdam';

export function parseCityId(raw: unknown, fallback: CanalCityId = DEFAULT_CITY_ID): CanalCityId {
  if (typeof raw !== 'string') return fallback;
  return (CANAL_CITY_IDS as readonly string[]).includes(raw)
    ? raw as CanalCityId
    : fallback;
}

export function cityById(id: CanalCityId | string | null | undefined): CanalCity {
  return CANAL_CITIES[parseCityId(id)];
}

export function playableCities(): CanalCity[] {
  return CANAL_CITY_IDS.map(id => CANAL_CITIES[id]).filter(city => city.playable);
}

/** Absolute or page-relative URL for a file inside the city's extract. */
export function extractUrl(
  city: CanalCity | CanalCityId | string,
  file: string,
  base: string | URL = typeof window !== 'undefined' ? window.location.href : 'http://localhost/canal-drive/',
): string {
  const resolved = typeof city === 'string' ? cityById(city) : city;
  return new URL(`${resolved.extractPath}/${file}`, base).toString();
}

/** Relative path string used by loaders that still take a path prefix. */
export function extractPath(city: CanalCity | CanalCityId | string): string {
  return (typeof city === 'string' ? cityById(city) : city).extractPath;
}
