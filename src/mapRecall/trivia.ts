import type { FeatureType, TriviaText } from '../types';

/** One entry of `street-name-origins.json` (Gemeente Amsterdam BAG register). */
export interface StreetNameOrigin {
  name: string;
  kind: 'street' | 'water' | 'bridge' | string;
  en?: string;
  bagId?: string;
}

/** One entry of `neighborhood-history.json` (see scripts/fetch-neighborhood-history.ts). */
export interface PublishedText {
  en: string; sourceUrl: string; lang: 'en' | 'nl'; original?: string;
  /** Set for text composed from data rather than quoted from an article (see scripts/fill-neighborhood-gaps.ts). */
  sourceLabel?: string;
  kind?: 'wikipedia' | 'derived';
}
export interface NeighborhoodHistoryEntry {
  name: string;
  description?: PublishedText;
  history?: PublishedText;
  nameOrigin?: PublishedText;
}

/** One entry of `neighborhoods-enriched.json`. */
export interface NeighborhoodPhoto { name: string; imageUrl?: string }

interface TriviaBearing {
  name: string;
  type: FeatureType;
  nameOrigin?: TriviaText;
  history?: TriviaText;
  wikipediaExtract?: string;
  wikipediaUrl?: string;
  wikipediaExtractSource?: { sourceUrl: string; sourceLabel: string };
  wikipediaImageUrl?: string;
}

/** Which register kind answers for a quiz feature type. */
export function originKindFor(type: FeatureType): 'street' | 'water' | 'bridge' | null {
  if (type === 'canal' || type === 'water') return 'water';
  if (type === 'bridge') return 'bridge';
  if (type === 'street' || type === 'avenue' || type === 'boulevard' || type === 'square' || type === 'park') return 'street';
  return null;
}

const key = (kind: string, name: string) => `${kind}:${name.trim().toLowerCase()}`;

export const BAG_SOURCE_LABEL = 'Gemeente Amsterdam street-name register';
export const bagRecordUrl = (bagId: string) => `https://api.data.amsterdam.nl/v1/bag/openbareruimtes/${bagId}/`;

/**
 * Attach the register's explanation of a name to streets, waters and bridges.
 * Exact name and kind only: "Amstel" the river and "Amstel" the street are
 * different entries, and a proximity guess could attach the wrong one.
 */
export function attachNameOrigins<T extends TriviaBearing>(features: readonly T[], origins: readonly StreetNameOrigin[] | null | undefined): T[] {
  if (!origins?.length) return features.slice();
  const byKey = new Map<string, StreetNameOrigin>();
  for (const origin of origins) {
    if (origin?.en && origin.name && origin.kind && !byKey.has(key(origin.kind, origin.name))) byKey.set(key(origin.kind, origin.name), origin);
  }
  return features.map((feature) => {
    if (feature.nameOrigin) return feature;
    const kind = originKindFor(feature.type);
    const origin = kind ? byKey.get(key(kind, feature.name)) : undefined;
    if (!origin?.en) return feature;
    return {
      ...feature,
      nameOrigin: {
        text: origin.en,
        sourceUrl: origin.bagId ? bagRecordUrl(origin.bagId) : 'https://api.data.amsterdam.nl/v1/bag/openbareruimtes/',
        sourceLabel: BAG_SOURCE_LABEL,
      },
    };
  });
}

const label = (text: PublishedText) => text.sourceLabel && text.kind === 'derived' ? text.sourceLabel : text.lang === 'nl' ? 'Wikipedia (translated from Dutch)' : 'Wikipedia';
const asTrivia = (text: PublishedText | undefined): TriviaText | undefined =>
  text ? { text: text.en, sourceUrl: text.sourceUrl, sourceLabel: label(text) } : undefined;

/** A neighbourhood's description, photo, history and name origin, by exact name. */
export function attachNeighborhoodTrivia<T extends TriviaBearing>(
  features: readonly T[],
  history: readonly NeighborhoodHistoryEntry[] | null | undefined,
  photos: readonly NeighborhoodPhoto[] | null | undefined,
): T[] {
  const historyByName = new Map((history || []).map((entry) => [entry.name, entry]));
  const photoByName = new Map((photos || []).map((entry) => [entry.name, entry]));
  return features.map((feature) => {
    if (feature.type !== 'neighborhood') return feature;
    const entry = historyByName.get(feature.name);
    const photo = photoByName.get(feature.name)?.imageUrl;
    if (!entry && !photo) return feature;
    // Only an article counts as "the Wikipedia page"; text composed from data links to its own source.
    const articleUrl = [entry?.description, entry?.history, entry?.nameOrigin].find(text => text && text.kind !== 'derived')?.sourceUrl;
    const description = entry?.description;
    return {
      ...feature,
      wikipediaExtract: feature.wikipediaExtract || description?.en,
      wikipediaUrl: feature.wikipediaUrl || (description && description.kind !== 'derived' ? description.sourceUrl : articleUrl),
      wikipediaExtractSource: feature.wikipediaExtract || !description ? feature.wikipediaExtractSource
        : { sourceUrl: description.sourceUrl, sourceLabel: label(description) },
      wikipediaImageUrl: feature.wikipediaImageUrl || photo,
      history: feature.history || asTrivia(entry?.history),
      nameOrigin: feature.nameOrigin || asTrivia(entry?.nameOrigin),
    };
  });
}

/**
 * The description without sentences the name origin already says: Dutch
 * ledes often explain the name in their second sentence, and the card would
 * then print it twice.
 */
export function descriptionWithoutOrigin(description: string | undefined, origin: string | undefined): string | undefined {
  if (!description) return undefined;
  if (!origin) return description;
  const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\d]{4,}/gu) || []);
  const originWords = words(origin);
  // No break after "lit." / "St." / "ca.".
  const sentences = description.split(/(?<![\s(](?:lit|St|ca|c)\.)(?<=[.!?])\s+/);
  // A gloss quoted in both ("lit. 'Neighborhood of the Statesmen'") is a repeat
  // even when the rest of the sentence is new.
  const quoted = (text: string) => (text.match(/['‘"“]([^'’"”]{8,})['’"”]/g) || []).map((q) => q.slice(1, -1).toLowerCase().replace(/^neighbou?rhood/, 'neighbourhood'));
  const originGlosses = new Set(quoted(origin));
  const kept = sentences.filter((sentence) => {
    if (quoted(sentence).some((gloss) => originGlosses.has(gloss))) return false;
    const own = [...words(sentence)];
    if (own.length < 4) return true;
    const shared = own.filter((word) => originWords.has(word)).length;
    return shared / own.length < 0.6;
  });
  return kept.join(' ') || description;
}

/** The `count` area names whose centres lie nearest, as Guess Name choices. */
export function nearestAreaNames(
  areas: ReadonlyArray<{ name: string; center: [number, number] }>,
  target: { name: string; center: [number, number] },
  count: number,
): string[] {
  const cosLat = Math.cos(target.center[0] * Math.PI / 180);
  const distance = (center: [number, number]) => Math.hypot(center[0] - target.center[0], (center[1] - target.center[1]) * cosLat);
  return [...new Set(areas
    .filter((area) => area.name !== target.name)
    .sort((a, b) => distance(a.center) - distance(b.center))
    .map((area) => area.name))]
    .slice(0, count);
}

/** A well-known place inside a neighbourhood, shown as a clue or after the answer. */
export interface NotablePlace { name: string; center: [number, number]; kind: string }

/** One candidate: an encyclopedia landmark or a ranked orientation POI. */
export interface PlaceCandidate { name: string; center: [number, number]; kind: string; score: number }

function inRing([lat, lon]: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const inArea = (point: [number, number], polygons: [number, number][][][]) =>
  polygons.some((polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole)));

export const flatName = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/**
 * The best-known places inside an area: highest score first, at most
 * `perKind` landmarks of a kind and one of any other kind, and never one whose name
 * contains a name the question offers. "De Pijp metro station" inside De Pijp
 * gives the answer away, and "Jordaan café" inside De Pijp would mislead.
 */
export function notablePlacesIn(
  polygons: [number, number][][][] | undefined,
  candidates: readonly PlaceCandidate[],
  forbiddenNames: readonly string[],
  count = 5,
  perKind = 2,
): NotablePlace[] {
  if (!polygons?.length) return [];
  // "Prinses Irenebuurt e.o." → "prinsesirene"; a bare "buurt" would match too much.
  const forbidden = forbiddenNames
    .map((name) => flatName(name.replace(/\s+e\.o\.$/i, '').split('/')[0]).replace(/(buurt|eiland|kwartier|park|wijk)$/, ''))
    .filter((name) => name.length >= 4);
  const lat = polygons.flat(2).map((point) => point[0]);
  const lon = polygons.flat(2).map((point) => point[1]);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lat), Math.max(...lat), Math.min(...lon), Math.max(...lon)];
  const seen = new Set<string>();
  const perKindCount = new Map<string, number>();
  const out: NotablePlace[] = [];
  for (const place of [...candidates].sort((a, b) => b.score - a.score)) {
    if (out.length >= count) break;
    const [y, x] = place.center;
    if (y < minLat || y > maxLat || x < minLon || x > maxLon) continue;
    const flat = flatName(place.name);
    if (!flat || seen.has(flat) || forbidden.some((name) => flat.includes(name))) continue;
    // Two landmarks can both teach; a second bike shop says nothing new.
    if ((perKindCount.get(place.kind) || 0) >= (place.score >= 1000 ? perKind : 1)) continue;
    if (!inArea(place.center, polygons)) continue;
    seen.add(flat);
    perKindCount.set(place.kind, (perKindCount.get(place.kind) || 0) + 1);
    out.push({ name: place.name, center: place.center, kind: place.kind });
  }
  return out;
}

/** Encyclopedia landmarks outrank every orientation POI; POIs keep their rank. */
export function placeCandidates(
  landmarks: ReadonlyArray<{ name: string; center: [number, number]; type?: string; prominenceScore?: number }> | null | undefined,
  orientation: { categories?: string[]; pois?: Array<[string, number, number, number, number, number?]> } | null | undefined,
): PlaceCandidate[] {
  const out: PlaceCandidate[] = [];
  for (const landmark of landmarks || []) {
    // "Canal Ring Area of Amsterdam" is a region, not a place to point at.
    if (/\b(area|district|quarter|neighbou?rhood)\b/i.test(landmark?.name || '')) continue;
    if (landmark?.name && landmark.center) out.push({ name: landmark.name, center: landmark.center, kind: landmark.type || 'landmark', score: 1000 + (landmark.prominenceScore || 0) });
  }
  const categories = orientation?.categories || [];
  for (const [name, lon, lat, category, rank] of orientation?.pois || []) {
    if (name) out.push({ name, center: [lat, lon], kind: categories[category] || 'place', score: rank });
  }
  return out;
}

export type MapDifficulty = 'easy' | 'medium' | 'hard';
export const MAP_DIFFICULTIES: readonly MapDifficulty[] = ['easy', 'medium', 'hard'];

/** Landmark and shop clues inside a neighbourhood help on easy and medium; hard drops them. */
export function placeCluesEnabled(difficulty: MapDifficulty): boolean {
  return difficulty !== 'hard';
}
