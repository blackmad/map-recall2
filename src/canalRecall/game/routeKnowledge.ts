import type { StreetKnowledgeEntry } from './extracts';
import { sentencesUpTo } from './landmarkData';

export type RouteKnowledgeType = 'street' | 'water' | 'bridge';
export type RouteKnowledgeIndex = Map<string, StreetKnowledgeEntry>;

const eligible = (entry: StreetKnowledgeEntry) => entry.wikipediaUrl || entry.wikipediaExtract || entry.nameOrigin;

/** One published street-name origin (`street-name-origins.json`). */
export interface StreetNameOrigin {
  name: string;
  kind: 'street' | 'water' | 'bridge';
  en: string;
}

/** Join answer names to exact extract identities without merging street/water homonyms. */
export function buildRouteKnowledgeIndex(
  legacy: readonly StreetKnowledgeEntry[],
  streets: readonly StreetKnowledgeEntry[],
  waters: readonly StreetKnowledgeEntry[],
  normalise: (name: string) => string,
  origins: readonly StreetNameOrigin[] = [],
): RouteKnowledgeIndex {
  const index: RouteKnowledgeIndex = new Map();
  const add = (entry: StreetKnowledgeEntry, type: RouteKnowledgeType) => {
    index.set(`${type}:${normalise(entry.name)}`, { ...entry, type });
  };
  for (const entry of legacy) add(entry, entry.type === 'water' ? 'water' : 'street');
  // Exact extract records deliberately overwrite legacy summaries: their IDs
  // are what join to the reviewed fact catalog.
  for (const entry of streets) if (eligible(entry)) add(entry, 'street');
  for (const entry of waters) if (eligible(entry)) add(entry, 'water');
  // Name origins cover ~4,900 streets against a few hundred with Wikipedia:
  // attach to an existing entry, or stand alone as the whole card. Bridges
  // get their own entries, for the card after a bridge is named.
  for (const origin of origins) {
    if (!origin.en) continue;
    const type: RouteKnowledgeType = origin.kind;
    const key = `${type}:${normalise(origin.name)}`;
    const existing = index.get(key);
    index.set(key, existing ? { ...existing, nameOrigin: origin.en } : { name: origin.name, type, nameOrigin: origin.en });
  }
  return index;
}

const sentencesOf = (text: string) => text.trim().split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean);

export const STREET_CARD_DETAIL_CHARS = 150;
export const STREET_CARD_LONG_CHARS = 280;

/**
 * The text of a street card. The name's origin leads: why a street is called
 * what it is, is the hook that makes the name stick, which is what the game
 * teaches. A Wikipedia lede, when there is one, follows in the long text.
 * A first sentence like "Legume." is too thin alone, so the short text takes
 * sentences until it is full.
 */
export function streetCardText(entry: Pick<StreetKnowledgeEntry, 'nameOrigin' | 'wikipediaExtract'>): { detail: string; longDetail: string } {
  const origin = sentencesOf(entry.nameOrigin || '');
  const extract = sentencesOf(entry.wikipediaExtract || '');
  if (!origin.length) {
    return { detail: sentencesUpTo(extract.slice(0, 1), STREET_CARD_DETAIL_CHARS), longDetail: sentencesUpTo(extract.slice(0, 3), STREET_CARD_LONG_CHARS) };
  }
  return {
    detail: sentencesUpTo(origin, STREET_CARD_DETAIL_CHARS),
    longDetail: sentencesUpTo([...origin, ...extract], STREET_CARD_LONG_CHARS),
  };
}

export function routeKnowledgeFor(
  index: RouteKnowledgeIndex,
  name: string,
  type: RouteKnowledgeType,
  normalise: (name: string) => string,
): StreetKnowledgeEntry | undefined {
  const key = normalise(name);
  // A bridge is only ever explained as a bridge; a street and the canal it
  // replaced share a story.
  if (type === 'bridge') return index.get(`bridge:${key}`);
  return index.get(`${type}:${key}`)
    || index.get(`${type === 'street' ? 'water' : 'street'}:${key}`);
}

export interface StreetKnowledgeOfferInput {
  /** Wikipedia URL or extract — otherwise there is nothing to put on the card. */
  hasExtract: boolean;
  /** Once per named street per drive, same idea as `_seenLandmarks`. */
  alreadyShownThisDrive: boolean;
  /** The card names the street; it must not sit next to an unanswered quiz. */
  quizOpen: boolean;
  /** Neighborhood and landmark cards keep the bottom band; do not stack. */
  landmarkCardOpen: boolean;
  /** After a quiz answer the encyclopedia may replace whatever card is up. */
  replaceOpenCard?: boolean;
}

/**
 * Encyclopedia on a named street is allowed after a quiz answer, or when a
 * known name is adopted silently. Novel streets stay quiet until answered —
 * the card would otherwise reveal the name under question.
 */
export function shouldOfferStreetKnowledge(input: StreetKnowledgeOfferInput): boolean {
  if (!input.hasExtract || input.alreadyShownThisDrive) return false;
  if (input.quizOpen) return false;
  if (input.landmarkCardOpen && !input.replaceOpenCard) return false;
  return true;
}
