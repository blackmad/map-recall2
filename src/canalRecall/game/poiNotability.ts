// Notability of a route destination: how recognisable a landmark is to a
// first-time visitor, independent of how close it is or how new its corridor
// is to the player. The route picker uses this to favour the landmarks a
// player is most likely to want to learn, while still leaving room for the
// occasional surprise.
//
// Pure and unit-testable: no network, no canvas, no Game instance. Every input
// field is optional and read defensively, matching the extract shape, so a
// bare POI still scores a stable baseline rather than NaN.

import { normaliseAnswer } from '../answerPath';

/** Wikidata item id for a Dutch rijksmonument (national heritage site). */
export const HERITAGE_RIJKSMONUMENT = 'Q916333';
/** Wikidata item id for a UNESCO World Heritage Site (the Amsterdam canal ring). */
export const HERITAGE_UNESCO = 'Q9259';

/**
 * The inputs the score needs. `name` and, when present, `wikidata` are used
 * for A-list matching; the rest are optional enrichment fields that the
 * runtime loader carries through from the landmark extract.
 */
export interface PoiNotability {
  name: string;
  wikidata?: string;
  /** Wikipedia language-sitelink count — a proxy for international fame. */
  sitelinks?: number;
  /** 60-day Wikipedia pageviews of the linked article. Missing = unknown,
   *  and is treated as neutral rather than as a measured zero. */
  pageviews60d?: number;
  /** P1435 heritage-designation Q-ids (rijksmonument, UNESCO, …). */
  heritage?: string[];
  /** Coarse extract type ("museum", "library", "university", …). */
  type?: string;
  /** Raw OSM tourism / amenity / historic tags, when the extract carries them. */
  tourism?: string;
  amenity?: string;
  historic?: string;
  /** Wikidata P31 (instance-of) Q-ids, used for tag weighting without OSM tags. */
  wikidataInstanceOf?: string[];
  /** Hand-modelled assets get only a tiny tie-break, never a floor. */
  manualPoi?: boolean;
}

/** A hand-curated list of the most recognisable Amsterdam landmarks. */
export interface AListEntry {
  /** Canonical (English) name. */
  name: string;
  /** Alternate names used by the extract or curated list, matched after normalisation. */
  aliases?: string[];
  /** Wikidata Q-ids that identify the landmark (institution and/or building). */
  wikidata?: string[];
}

/**
 * The destinations a first-time visitor to Amsterdam is most likely to know,
 * and therefore most worth a route that ends at them. Matched against the
 * extract by normalised name or by Wikidata id, so name drift in OSM or a
 * translated curated label does not drop a landmark off the list.
 */
export const A_LIST: readonly AListEntry[] = [
  { name: 'Rijksmuseum', wikidata: ['Q190804'] },
  { name: 'Van Gogh Museum', wikidata: ['Q224124'] },
  { name: 'Stedelijk Museum', aliases: ['Stedelijk Museum Amsterdam'], wikidata: ['Q924335', 'Q42175133'] },
  { name: 'Anne Frank Huis', aliases: ['Anne Frank House'], wikidata: ['Q165366'] },
  { name: 'Westerkerk', wikidata: ['Q1130722'] },
  { name: 'Koninklijk Paleis', aliases: ['Royal Palace', 'Paleis op de Dam', 'Royal Palace of Amsterdam'], wikidata: ['Q1056152'] },
  { name: 'Nieuwe Kerk', aliases: ['Nieuwe Kerk Amsterdam'], wikidata: ['Q1419675'] },
  { name: 'Oude Kerk', aliases: ['Oude Kerk Amsterdam'], wikidata: ['Q623558'] },
  { name: 'Concertgebouw', aliases: ['Royal Concertgebouw', 'Koninklijk Concertgebouw'], wikidata: ['Q849957'] },
  { name: 'Amsterdam Centraal', aliases: ['Central Station', 'Amsterdam Centraal Station'], wikidata: ['Q50719'] },
  { name: 'Magere Brug', aliases: ['Skinny Bridge', 'Skinny bridge'], wikidata: ['Q1344400'] },
  { name: 'Munttoren', aliases: ['Mint Tower', 'Munt Tower'], wikidata: ['Q1429748'] },
  { name: 'De Waag', aliases: ['Waag', 'Weigh House'], wikidata: ['Q2466999'] },
  { name: 'Begijnhof', wikidata: ['Q1629214'] },
  { name: 'Homomonument', wikidata: ['Q51411'] },
  { name: 'Rembrandthuis', aliases: ['Rembrandt House', 'Museum Het Rembrandthuis', 'Rembrandt House Museum'], wikidata: ['Q277316'] },
  { name: 'Portugese Synagoge', aliases: ['Portuguese Synagogue'], wikidata: ['Q1853707'] },
  { name: 'Joods Museum', aliases: ['Jewish Museum', 'Jewish Historical Museum', 'Joods Historisch Museum'], wikidata: ['Q702726'] },
  { name: 'Het Scheepvaartmuseum', aliases: ['National Maritime Museum', 'Scheepvaartmuseum', 'Nederlands Scheepvaartmuseum'], wikidata: ['Q1616123'] },
  { name: 'NEMO', aliases: ['NEMO Science Museum', 'Nemo'], wikidata: ['Q1422000'] },
  { name: 'EYE Filmmuseum', aliases: ['Eye Filmmuseum', 'EYE Film Institute'], wikidata: ['Q1538389'] },
  { name: "A'DAM Toren", aliases: ["A'DAM Tower", 'Adam Tower', 'ADAM Tower'], wikidata: ['Q21185268'] },
  { name: 'Artis', aliases: ['Natura Artis Magistra', 'Artis Zoo'], wikidata: ['Q713124'] },
  { name: 'Hortus Botanicus', aliases: ['Hortus Botanicus Amsterdam', 'Botanical Garden Amsterdam'], wikidata: ['Q2475752'] },
  { name: 'Koninklijk Theater Carré', aliases: ['Royal Theater Carré', 'Theater Carré', 'Carré'], wikidata: ['Q1106490'] },
  { name: 'Tuschinski', aliases: ['Pathé Tuschinski', 'Tuschinski Theater', 'Pathé Tuschinski Cinema'], wikidata: ['Q599272'] },
  { name: 'Bloemenmarkt', aliases: ['Flower Market'], wikidata: ['Q643079'] },
  { name: 'Schreierstoren', aliases: ['Schreierstoren'], wikidata: ['Q610402'] },
  { name: 'Montelbaanstoren', wikidata: ['Q1946061'] },
  { name: 'Westergasfabriek', wikidata: ['Q4848627'] },
  { name: 'Albert Cuypmarkt', aliases: ['Albert Cuyp Market'], wikidata: ['Q1322408'] },
  { name: 'Heineken Experience', aliases: ['Heineken Experience Amsterdam'], wikidata: ['Q2087161'] },
  { name: "Hermitage", aliases: ["H'ART Museum", 'Hermitage Amsterdam', 'H ART Museum'], wikidata: ['Q2509774'] },
  { name: 'Amstel Hotel', wikidata: ['Q1780741'] },
  { name: 'Stopera', aliases: ['Muziektheater'], wikidata: ['Q1587736'] },
  { name: 'Sint-Nicolaasbasiliek', aliases: ['Basilica of Saint Nicholas', 'Basiliek van de Heilige Nicolaas', 'Co-kathedrale Basiliek van Sint Nicolaas'], wikidata: ['Q1350750'] },
  { name: 'De Krijtberg', aliases: ['Krijtberg', 'Sint-Franciscus Xaveriuskerk'], wikidata: ['Q1180056'] },
  { name: 'Zuiderkerk', wikidata: ['Q228629'] },
  { name: 'Noorderkerk', wikidata: ['Q613854'] },
  { name: 'Vondelpark', wikidata: ['Q2279698'] },
  { name: 'Nationaal Monument', aliases: ['National Monument', 'National Monument on Dam Square', 'Dam Square', 'Nationaal Monument op de Dam'], wikidata: ['Q473851'] },
  { name: 'Leidseplein', wikidata: ['Q501445'] },
  { name: 'Rembrandtplein', wikidata: ['Q613678'] },
  { name: 'Museumplein', wikidata: ['Q2172631'] },
  { name: 'Stadsschouwburg', aliases: ['Stadsschouwburg Amsterdam', 'Internationaal Theater Amsterdam'], wikidata: ['Q1817103'] },
  { name: 'Bijbels Museum', aliases: ['Biblical Museum'], wikidata: ['Q2111026'] },
  { name: 'Hollandsche Schouwburg', wikidata: ['Q2206529'] },
  { name: 'Nationaal Holocaust Namenmonument', aliases: ['Holocaust Namenmonument', 'National Holocaust Names Monument'], wikidata: ['Q66023853'] },
  { name: 'De Dokwerker', aliases: ['Dokwerker'], wikidata: ['Q1179838'] },
  { name: "Ons' Lieve Heer op Solder", aliases: ['Our Lord in the Attic', "Museum Ons' Lieve Heer op Solder"], wikidata: ['Q493160'] },
  { name: 'Amsterdam Museum', wikidata: ['Q1820897'] },
  { name: 'Moco', aliases: ['Moco Museum'], wikidata: ['Q26832671'] },
  { name: 'FOAM', aliases: ['Foam', 'Fotografiemuseum Amsterdam'], wikidata: ['Q5422840'] },
  { name: 'Huis Bartolotti', aliases: ['Bartolotti House'], wikidata: ['Q2205055'] },
  { name: 'Scheepvaarthuis', aliases: ['Shipping House'], wikidata: ['Q2078885'] },
  { name: 'Beurs van Berlage', aliases: ["Berlage's Stock Market", 'Berlage Beurs'], wikidata: ['Q851200'] },
  { name: 'Centrale Bibliotheek', aliases: ['OBA', 'Amsterdam Public Library Oosterdok', 'Openbare Bibliotheek Amsterdam', 'Centrale Bibliotheek OBA'], wikidata: ['Q50413436'] },
];

const A_LIST_BY_NAME = new Map<string, AListEntry>();
const A_LIST_BY_WIKIDATA = new Map<string, AListEntry>();
for (const entry of A_LIST) {
  for (const name of [entry.name, ...(entry.aliases ?? [])]) {
    A_LIST_BY_NAME.set(normaliseAnswer(name), entry);
  }
  for (const qid of entry.wikidata ?? []) A_LIST_BY_WIKIDATA.set(qid, entry);
}

/** Whether a POI is on the curated A-list, by normalised name or Wikidata id. */
export function isAList(poi: Pick<PoiNotability, 'name' | 'wikidata'>): boolean {
  if (poi.wikidata && A_LIST_BY_WIKIDATA.has(poi.wikidata)) return true;
  return A_LIST_BY_NAME.has(normaliseAnswer(poi.name || ''));
}

/** Added to every A-list member, large enough to dominate the ordinary tail. */
export const A_LIST_BOOST = 8;
/** Hand-modelled assets get only a tie-break bump, not the old 220 floor. */
export const MANUAL_TIEBREAK = 0.05;
/** Rijksmonument heritage bonus (UNESCO, below, supersedes it). */
export const HERITAGE_RIJKSMONUMENT_BONUS = 2;
/** UNESCO canal-ring heritage bonus. */
export const HERITAGE_UNESCO_BONUS = 3;

export type TagKind =
  | 'museum' | 'attraction' | 'viewpoint' | 'zoo'
  | 'artwork' | 'memorial' | 'place_of_worship';

/** Wikidata P31 instance-of Q-ids mapped to a coarse destination kind. */
const MUSEUM_QIDS = new Set(['Q33506', 'Q207694', 'Q17431399']);
const ZOO_QIDS = new Set(['Q43501']);
const PLACE_OF_WORSHIP_QIDS = new Set(['Q16970', 'Q1370598', 'Q32815', 'Q34627']);
const ARTWORK_QIDS = new Set(['Q838948', 'Q179700', 'Q860861']);
const MEMORIAL_QIDS = new Set(['Q5003624', 'Q4989906']);
const ATTRACTION_QIDS = new Set(['Q570116']);

/** The coarse destination kind from OSM tags, the extract type, or Wikidata. */
export function tagKind(poi: PoiNotability): TagKind | null {
  const tourism = poi.tourism ?? (poi.type === 'museum' ? 'museum' : undefined);
  if (tourism) {
    if (tourism === 'museum') return 'museum';
    if (tourism === 'attraction') return 'attraction';
    if (tourism === 'viewpoint') return 'viewpoint';
    if (tourism === 'zoo') return 'zoo';
    if (tourism === 'artwork') return 'artwork';
  }
  if (poi.amenity === 'place_of_worship') return 'place_of_worship';
  if (poi.historic === 'memorial') return 'memorial';
  const inst = poi.wikidataInstanceOf ?? [];
  if (inst.some(qid => MUSEUM_QIDS.has(qid))) return 'museum';
  if (inst.some(qid => ZOO_QIDS.has(qid))) return 'zoo';
  if (inst.some(qid => PLACE_OF_WORSHIP_QIDS.has(qid))) return 'place_of_worship';
  if (inst.some(qid => ARTWORK_QIDS.has(qid))) return 'artwork';
  if (inst.some(qid => MEMORIAL_QIDS.has(qid))) return 'memorial';
  if (inst.some(qid => ATTRACTION_QIDS.has(qid))) return 'attraction';
  return null;
}

/** Museums and zoos are classic destinations; plain churches are not, unless
 *  heritage or the A-list already marks them as notable. */
export function tagWeight(poi: PoiNotability): number {
  switch (tagKind(poi)) {
    case 'museum':
    case 'attraction':
    case 'viewpoint':
    case 'zoo':
      return 1.5;
    case 'artwork':
    case 'memorial':
      return 0.8;
    case 'place_of_worship': {
      const notable = isAList(poi) || (poi.heritage?.includes(HERITAGE_RIJKSMONUMENT) ?? false);
      return notable ? 0 : -1.5;
    }
    default:
      return 0;
  }
}

/** P1435 heritage bonus: UNESCO (canal ring) outranks rijksmonument. */
export function heritageBonus(heritage: readonly string[] | undefined): number {
  if (!heritage?.length) return 0;
  if (heritage.includes(HERITAGE_UNESCO)) return HERITAGE_UNESCO_BONUS;
  if (heritage.includes(HERITAGE_RIJKSMONUMENT)) return HERITAGE_RIJKSMONUMENT_BONUS;
  return 0;
}

/**
 * The notability score: international fame (sitelinks + pageviews), heritage
 * designation, destination kind, and A-list membership. Missing pageviews are
 * neutral (they contribute nothing) rather than being read as zero evidence.
 */
export function notabilityScore(poi: PoiNotability): number {
  const sitelinks = Math.log2((poi.sitelinks ?? 0) + 1);
  const pageviews = poi.pageviews60d == null ? 0 : Math.log10(poi.pageviews60d + 1);
  return sitelinks + pageviews + heritageBonus(poi.heritage) + tagWeight(poi)
    + (isAList(poi) ? A_LIST_BOOST : 0) + (poi.manualPoi ? MANUAL_TIEBREAK : 0);
}

/** Temperature for the softmax-style pick weight: higher = more variety. */
export const NOTABILITY_TEMPERATURE = 3;

/** Expected pick weight for weighted sampling by notability. */
export function notabilityWeight(score: number, temperature = NOTABILITY_TEMPERATURE): number {
  return Math.exp(score / temperature);
}

/** Cap on the home-pick fame factor (so a favourite cannot swamp the ring). */
export const NOTABILITY_FAME_CAP = 2;
/** Notability points per +1 of fame factor. */
export const NOTABILITY_FAME_SCALE = 10;

/**
 * A bounded multiplicative fame term for home-mode scoring, alongside novelty.
 * Ranges from 1 (unknown) up to 1 + NOTABILITY_FAME_CAP for the most famous.
 */
export function notabilityFameFactor(poi: PoiNotability): number {
  return 1 + Math.min(NOTABILITY_FAME_CAP, Math.max(0, notabilityScore(poi)) / NOTABILITY_FAME_SCALE);
}
