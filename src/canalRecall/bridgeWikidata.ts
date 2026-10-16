// Find the Wikidata item (and so the Wikipedia article) for a named bridge
// that OSM left untagged.
//
// The 300 bridges the extract generator picked all carried an OSM `wikidata`
// tag; the 116 routed decks `askableBridges.ts` added carry none, so their
// cards had no encyclopedia text. Amsterdam's bridges are well covered on
// Wikidata (nl.wikipedia has an article for most numbered bridges), but often
// under the painted number ("Brug 236") with the name as an alias, and OSM's
// spelling drifts ("Katten brug", "Hilletjes Brug"). A candidate is accepted
// only when it is both close and named alike, and an ambiguous match is left
// out: a wrong article on a card teaches a wrong place.

import { bridgeSpellingKey } from './askableBridges.ts';

export type LatLon = [number, number];

/** One Wikidata item near Amsterdam, as the SPARQL box query returns it. */
export interface WikidataBridgeCandidate {
  qid: string;
  coord: LatLon;
  /** Dutch label and aliases. */
  names: string[];
  nlwiki?: string;
  enwiki?: string;
}

export interface BridgeToMatch {
  name: string;
  center?: LatLon;
  path?: LatLon[];
  paths?: LatLon[][];
  /** Painted number from the city register, when the register describes it. */
  registerNr?: number;
}

export interface WikidataMatch {
  qid: string;
  via: 'name' | 'number';
  metres: number;
  nlwiki?: string;
  enwiki?: string;
}

/** Wikidata coordinates are a point on or beside the bridge; a deck is a few
 *  tens of metres long. IJburg's Baltic-port bridges (Kronstadtbrug,
 *  Kolbergbrug, Pernaubrug…) sit 50–100 m apart and Wikidata's points for
 *  them land on their neighbours, so a looser radius swaps their articles. */
export const MATCH_METRES = 60;

/** Spelling key for matching, with a leading Dutch article dropped
 *  ("De Hollandse Iepbrug" = "Hollandse Iepbrug") and the letters NFD leaves
 *  whole folded (the register spells Skłodowska "Sklodowska"). */
export function bridgeMatchKey(name: string): string {
  return bridgeSpellingKey(name.trim().replace(/^(de|het|'t)\s+/i, '').replace(/ł/g, 'l').replace(/Ł/g, 'L'));
}

/** "Brug 236", "brug nr. 236" → 236. */
export function bridgeNumberLabel(label: string): number | undefined {
  const match = /^brug\s*(?:nr\.?|nummer)?\s*(\d+)\b/i.exec(label.trim());
  return match ? Number(match[1]) : undefined;
}

export function metresBetween([lat0, lng0]: LatLon, [lat1, lng1]: LatLon): number {
  return Math.hypot((lat1 - lat0) * 110_540, (lng1 - lng0) * 111_320 * Math.cos(lat0 * Math.PI / 180));
}

function nearestMetres(bridge: BridgeToMatch, point: LatLon): number {
  const points = [
    ...(bridge.center ? [bridge.center] : []),
    ...(bridge.paths ?? (bridge.path ? [bridge.path] : [])).flat(),
  ];
  return points.length ? Math.min(...points.map(other => metresBetween(other, point))) : Infinity;
}

/**
 * The one item this bridge is, or null. A name match beats a number match;
 * two different items matching the same way is ambiguous.
 */
export function matchBridgeWikidata(
  bridge: BridgeToMatch,
  candidates: readonly WikidataBridgeCandidate[],
  maxMetres = MATCH_METRES,
): WikidataMatch | null {
  const key = bridgeMatchKey(bridge.name);
  const byName = new Map<string, WikidataMatch>();
  const byNumber = new Map<string, WikidataMatch>();
  for (const candidate of candidates) {
    const metres = nearestMetres(bridge, candidate.coord);
    if (metres > maxMetres) continue;
    const match = { qid: candidate.qid, metres, nlwiki: candidate.nlwiki, enwiki: candidate.enwiki };
    if (candidate.names.some(name => bridgeMatchKey(name) === key)) {
      byName.set(candidate.qid, { ...match, via: 'name' });
    } else if (bridge.registerNr != null
      && candidate.names.some(name => bridgeNumberLabel(name) === bridge.registerNr)) {
      byNumber.set(candidate.qid, { ...match, via: 'number' });
    }
  }
  for (const matches of [byName, byNumber]) {
    if (matches.size === 1) return [...matches.values()][0];
    if (matches.size > 1) return null;
  }
  return null;
}

/** The `wikipedia` tag OSM would carry: the Dutch article first, as the
 *  existing bridges have it; the enrich pass finds English from there. */
export function wikipediaTag(match: Pick<WikidataMatch, 'nlwiki' | 'enwiki'>): string | undefined {
  if (match.nlwiki) return `nl:${match.nlwiki}`;
  if (match.enwiki) return `en:${match.enwiki}`;
  return undefined;
}
