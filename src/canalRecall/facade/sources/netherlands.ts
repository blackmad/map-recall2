/**
 * The Dutch national registers, as source adapters.
 *
 * BAG, 3DBAG and the Rijksmonumenten register all cover the whole of the
 * Netherlands. Implementing them once against the interfaces in `../sources.ts`
 * means every Dutch city this project touches — Amsterdam, Utrecht, Rotterdam,
 * Den Haag — is reconnoitred by the same code with a different bounding box,
 * and a non-Dutch city is a matter of writing three adapters rather than a
 * second pipeline.
 */
import { lngLatToRd, rdToLngLat } from '../rdNew.ts';
import { amsterdamPanoramas } from './amsterdamPanorama.ts';
import { openStreetMapSemantics } from './openStreetMap.ts';
import type {
  BboxLngLat, BuildingRegistry, CitySources, HeritageRecord, HeritageSource,
  LngLat, MassingRecord, MassingSource, ProjectedCrs, ProjectedPoint, RegistryBuilding,
} from '../sources.ts';

const USER_AGENT = 'MapRecallFacadeTwin/1.0';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A request that gives up rather than hanging.
 *
 * These services occasionally accept a connection and then never send headers;
 * Node's default is to wait five minutes and then throw, which turns one bad
 * tile into a dead run. A 45 s deadline with retries recovers instead, and a
 * timeout is treated as retryable because it usually is.
 */
async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(45_000),
      });
      if (response.ok) return await response.json();
      if (response.status !== 429 && response.status < 500) throw new Error(`${new URL(url).hostname}: HTTP ${response.status}`);
      lastError = new Error(`${new URL(url).hostname}: HTTP ${response.status}`);
    } catch (error) {
      // A 4xx is final; anything else — timeout, reset, socket hang-up — is worth another go.
      if (error instanceof Error && /HTTP 4\d\d/.test(error.message)) throw error;
      lastError = error;
    }
    await wait(800 * 2 ** attempt);
  }
  throw lastError;
}

/** RD New with NAP heights — what every Dutch national register is published in. */
export const RD_NEW: ProjectedCrs = {
  id: 'EPSG:28992',
  name: 'Amersfoort / RD New',
  verticalDatum: 'NAP',
  toLngLat: (point: ProjectedPoint) => rdToLngLat(point),
  fromLngLat: (lngLat: LngLat) => lngLatToRd(lngLat),
};

/** Rough envelope of the Netherlands, used only to refuse work outside it. */
const NL_BOUNDS = { west: 3.2, south: 50.6, east: 7.3, north: 53.7 };

/**
 * BAG — Basisregistratie Adressen en Gebouwen, the authoritative building
 * register. `identificatie` is the identity everything else is keyed by.
 */
export const bagRegistry: BuildingRegistry = {
  id: 'bag',
  name: 'BAG (PDOK Kadaster OGC API Features v2)',
  license: 'CC0 1.0 — Kadaster',
  covers: ([lng, lat]) => lng >= NL_BOUNDS.west && lng <= NL_BOUNDS.east && lat >= NL_BOUNDS.south && lat <= NL_BOUNDS.north,

  async fetchBuildings(bbox: BboxLngLat): Promise<RegistryBuilding[]> {
    const buildings: RegistryBuilding[] = [];
    let url: string | null = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${bbox.join(',')}&limit=1000&f=json`;
    while (url) {
      const payload = await fetchJson(url);
      for (const feature of payload.features ?? []) {
        const buildingId = feature.properties?.identificatie;
        if (!buildingId) continue;
        const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        const status = String(feature.properties.status ?? 'onbekend');
        const year = typeof feature.properties.bouwjaar === 'number' ? feature.properties.bouwjaar : null;
        for (const polygon of polygons) {
          buildings.push({
            buildingId,
            // 1005 is BAG's sentinel for "construction year unknown". It is not
            // a date, and anything routing attention by age must not read it as
            // one, so it is normalised to null here rather than downstream.
            constructionYear: year === 1005 ? null : year,
            status,
            active: status.startsWith('Pand in gebruik') || status === 'Verbouwing pand',
            uses: String(feature.properties.gebruiksdoel ?? '').split(',').filter(Boolean),
            dwellings: Number(feature.properties.aantal_verblijfsobjecten ?? 0),
            footprintLngLat: polygon[0].map(([lng, lat]: number[]) => [lng, lat] as LngLat),
          });
        }
      }
      url = (payload.links ?? []).find((link: any) => link.rel === 'next')?.href ?? null;
    }
    return buildings;
  },
};

const TILE_M = 250;

/**
 * 3DBAG — LoD2.2 reconstructions of BAG buildings from AHN laser altimetry.
 *
 * Two API behaviours worth not rediscovering: the bbox must be in RD, and a
 * WGS84 bbox returns zero features rather than an error; and its offsets are
 * 1-based, so `offset=0` is an HTTP 500 and paging must follow the server's own
 * `next` link.
 */
export const bag3dMassing: MassingSource = {
  id: '3dbag',
  name: '3DBAG LoD2.2 (api.3dbag.nl)',
  license: 'CC BY 4.0 — 3DBAG, TU Delft',
  vintage: 'api.3dbag.nl collection pand (v2023.10.08 at time of writing)',

  async fetchMassing(bbox: BboxLngLat, crs: ProjectedCrs): Promise<MassingRecord[]> {
    const min = crs.fromLngLat([bbox[0], bbox[1]]);
    const max = crs.fromLngLat([bbox[2], bbox[3]]);
    const attributes: Record<string, any> = {};

    for (let x = Math.floor(min.x / TILE_M) * TILE_M; x <= max.x; x += TILE_M) {
      for (let y = Math.floor(min.y / TILE_M) * TILE_M; y <= max.y; y += TILE_M) {
        let url: string | null = `https://api.3dbag.nl/collections/pand/items?bbox=${x},${y},${x + TILE_M},${y + TILE_M}&limit=100`;
        while (url) {
          const payload = await fetchJson(url);
          for (const feature of payload.features ?? []) {
            for (const [key, object] of Object.entries(feature.CityObjects ?? {}) as Array<[string, any]>) {
              if (object.type !== 'Building') continue;
              attributes[key] = object.attributes;
            }
          }
          url = (payload.links ?? []).find((link: any) => link.rel === 'next')?.href ?? null;
        }
      }
    }

    const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
    const roofForm = (raw: unknown): MassingRecord['roofForm'] => {
      if (raw === 'slanted') return 'pitched';
      if (raw === 'horizontal') return 'flat';
      if (raw === 'multiple horizontal') return 'mixed';
      return 'unknown';
    };

    const seen = new Set<string>();
    const records: MassingRecord[] = [];
    for (const [key, a] of Object.entries(attributes)) {
      const buildingId = key.replace(/^NL\.IMBAG\.Pand\./, '').split('-')[0];
      if (seen.has(buildingId)) continue;
      seen.add(buildingId);
      records.push({
        buildingId,
        storeys: number(a.b3_bouwlagen),
        roofForm: roofForm(a.b3_dak_type),
        roofFormRaw: typeof a.b3_dak_type === 'string' ? a.b3_dak_type : null,
        groundLevel: number(a.b3_h_maaiveld),
        eavesHeight: number(a.b3_h_dak_50p),
        ridgeHeight: number(a.b3_h_nok) ?? number(a.b3_h_dak_max),
        reconstructionError: number(a.b3_rmse_lod22),
        geometryValid: typeof a.b3_val3dity_lod22 === 'string' ? a.b3_val3dity_lod22 === '[]' : null,
        sourceQualityFlag: typeof a.b3_kwaliteitsindicator === 'boolean' ? a.b3_kwaliteitsindicator : null,
        surveyCampaign: typeof a.b3_pw_bron === 'string' ? a.b3_pw_bron : null,
        surveyYear: number(a.b3_pw_datum),
        insufficientInput: typeof a.b3_pw_onvoldoende === 'boolean' ? a.b3_pw_onvoldoende : null,
        groundArea: number(a.b3_opp_grond),
        exteriorWallArea: number(a.b3_opp_buitenmuur),
        partyWallArea: number(a.b3_opp_scheidingsmuur),
      });
    }
    return records;
  },
};

/**
 * The Rijksmonumenten register.
 *
 * Not on any endpoint one would reach for: `api.pdok.nl/rce/rijksmonumenten/*`,
 * the PDOK WFS and the atom index all return 404. It lives in two places that
 * have to be joined — geometry on the RCE's own WFS, and the *redengevende
 * omschrijving* text on the RCE linked-data SPARQL endpoint.
 */
const RCE_WFS = 'https://services.rce.geovoorziening.nl/rce/wfs';
const RCE_SPARQL = 'https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/services/cho/sparql';

export const rijksmonumentenHeritage: HeritageSource = {
  id: 'rijksmonumenten',
  name: 'Rijksmonumentenregister (RCE)',
  license: 'CC0 / CC BY — Rijksdienst voor het Cultureel Erfgoed',

  async fetchHeritage(bbox: BboxLngLat): Promise<HeritageRecord[]> {
    const records: HeritageRecord[] = [];
    const pageSize = 1000;
    for (let start = 0; ; start += pageSize) {
      // WFS 2.0 with this srsName wants latitude first.
      const url = `${RCE_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=rce:NationalListedMonumentPoints`
        + `&outputFormat=application/json&srsName=EPSG:4326&count=${pageSize}&startIndex=${start}`
        + `&bbox=${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]},urn:ogc:def:crs:EPSG::4326`;
      const payload = await fetchJson(url);
      for (const feature of payload.features ?? []) {
        const [a, b] = feature.geometry.coordinates;
        records.push({
          heritageId: String(feature.properties.rijksmonument_nummer),
          buildingId: null,
          lngLat: a > 50 && a < 54 ? [b, a] : [a, b],
          designation: feature.properties.juridische_status ?? null,
          category: feature.properties.hoofdcategorie ?? null,
          subcategory: feature.properties.subcategorie ?? null,
          description: null,
          descriptionLanguage: 'nl',
          recordUrl: feature.properties.rijksmonumenturl ?? null,
        });
      }
      if ((payload.features ?? []).length < pageSize) break;
    }

    // Descriptions come from a separate endpoint, batched by monument number.
    const batchSize = 120;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const query = `PREFIX ceo: <https://linkeddata.cultureelerfgoed.nl/def/ceo#>
SELECT ?nummer ?tekst WHERE {
  VALUES ?nummer { ${batch.map(r => `"${r.heritageId}"`).join(' ')} }
  ?mon ceo:rijksmonumentnummer ?nummer ; ceo:heeftOmschrijving ?o .
  ?o ?p ?tekst . FILTER(isLiteral(?tekst) && STRLEN(STR(?tekst)) > 40)
}`;
      const payload = await fetchJson(RCE_SPARQL, {
        method: 'POST',
        headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query }).toString(),
      });
      const longest = new Map<string, string>();
      for (const binding of payload.results.bindings) {
        const number = binding.nummer.value, text = binding.tekst.value as string;
        if (!longest.has(number) || text.length > longest.get(number)!.length) longest.set(number, text);
      }
      for (const record of batch) record.description = longest.get(record.heritageId) ?? null;
    }
    return records;
  },
};

/**
 * Every Dutch city is reconnoitred by the same three national registers, plus
 * OSM for the hand-mapped semantics no register carries.
 */
export const dutchSources = (cityId: string): CitySources => ({
  cityId,
  crs: RD_NEW,
  registry: bagRegistry,
  massing: bag3dMassing,
  heritage: rijksmonumentenHeritage,
  semantics: openStreetMapSemantics,
  // Street-level imagery is municipal, not national: Amsterdam publishes its
  // own panoramas openly, and another city needs its own adapter or none.
  imagery: cityId === 'amsterdam' ? amsterdamPanoramas : null,
});
