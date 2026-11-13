// One destination per place.
//
// The landmark extract, the hand-modelled catalogue and OSM's habit of
// tagging an institution and its building separately all produce the same
// place twice: "University of Amsterdam" and the modelled "Universiteit van
// Amsterdam" share Q214341; "Oost-Indisch Huis" and "Dutch East Indian
// Company" share a QID; "Spanjemonument" and "1936-1939 No Pasaran" share one
// article; the modelled "De Krijtberg" (no QID) stands where OSM puts
// "Sint-Franciscus Xaveriuskerk"; and the Westertoren is the Westerkerk's
// tower. A rider offered both halves of a pair is offered the same ride
// twice. This folds them at pool build time.
//
// Pure: no network, no DOM. The winner of a group keeps its id (saved
// preferences, stamps and arrival cards key on it) and borrows the fame
// fields it lacks from the dropped twin, so a modelled entry without a QID
// still ranks as famous as its extract twin.

import { A_LIST } from './poiNotability';
import { normaliseAnswer } from '../answerPath';
import { landmarkNotability } from './landmarkSelection';

export interface DedupeFeature {
  id: string;
  name: string;
  center?: readonly number[];
  routeCenter?: readonly number[];
  wikidata?: string;
  wikipedia?: string;
  wikipediaUrl?: string;
  /** Wikidata P361 (part of). */
  wikidataPartOf?: string[];
  wikidataSitelinks?: number;
  wikipediaPageviews60d?: number;
  heritage?: string[];
  wikidataInstanceOf?: string[];
  type?: string;
  manualPoi?: boolean;
  modelId?: string;
}

export type DuplicateReason = 'same-wikidata' | 'same-article' | 'same-building' | 'part-of';

export interface DuplicateRemoval {
  removedId: string;
  removedName: string;
  keptId: string;
  keptName: string;
  reason: DuplicateReason;
}

/** Two names within this of each other, and alike, are one building. */
export const SAME_BUILDING_KM = 0.08;
/** A part (tower, wing) further than this from its whole is its own place. */
export const PART_OF_KM = 0.3;

function kmApart(a: DedupeFeature, b: DedupeFeature): number {
  const p = (a.routeCenter ?? a.center) as readonly number[] | undefined;
  const q = (b.routeCenter ?? b.center) as readonly number[] | undefined;
  if (!p || !q) return Infinity;
  const lat = (p[0] - q[0]) * 111.32;
  const lng = (p[1] - q[1]) * 111.32 * Math.cos(p[0] * Math.PI / 180);
  return Math.hypot(lat, lng);
}

/** `nl:Spanjemonument`, `https://nl.wikipedia.org/wiki/Spanjemonument` -> `nl:spanjemonument`. */
export function articleKey(feature: Pick<DedupeFeature, 'wikipedia' | 'wikipediaUrl'>): string[] {
  const keys: string[] = [];
  if (feature.wikipedia) {
    const at = feature.wikipedia.indexOf(':');
    const lang = at > 0 ? feature.wikipedia.slice(0, at) : 'en';
    const title = at > 0 ? feature.wikipedia.slice(at + 1) : feature.wikipedia;
    keys.push(`${lang}:${title.replace(/_/g, ' ').trim().toLowerCase()}`);
  }
  if (feature.wikipediaUrl) {
    const match = /^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)$/.exec(feature.wikipediaUrl);
    if (match) {
      let title = match[2];
      try { title = decodeURIComponent(title); } catch { /* keep raw */ }
      keys.push(`${match[1]}:${title.replace(/_/g, ' ').trim().toLowerCase()}`);
    }
  }
  return keys;
}

const STOP_WORDS = new Set(['the', 'de', 'het', 'a', 'van', 'of', 'amsterdam', 'museum', 'house', 'huis', 's', 'op', 'in', 'en', 'and']);
const PART_WORDS = /\b(toren|tower|spire|bell tower|klokkentoren)\b|toren$/;

/** Where-it-is suffixes ("Het Lieverdje (Spui)") name the square, not the thing. */
function stripLocation(name: string): string {
  return name.replace(/\([^)]*\)/g, ' ');
}

function tokens(name: string): string[] {
  return normaliseAnswer(stripLocation(name)).split(' ').filter(token => token && !STOP_WORDS.has(token));
}

/** A street, square or park name on its own says where, not what. */
const PLACE_TOKEN = /(plein|straat|gracht|kade|weg|laan|park|plantsoen|dijk|markt)$/;

const A_LIST_GROUP = new Map<string, string>();
for (const entry of A_LIST) for (const name of [entry.name, ...(entry.aliases ?? [])]) A_LIST_GROUP.set(normaliseAnswer(name), entry.name);

/**
 * Whether two names plausibly name the same place: equal after
 * normalisation, aliases of one A-list entry (Ons' Lieve Heer op Solder /
 * Our Lord in the Attic; De Krijtberg / Sint-Franciscus Xaveriuskerk), one
 * containing the other, or sharing most of their meaningful words.
 */
export function namesAlike(a: string, b: string): boolean {
  const na = normaliseAnswer(a), nb = normaliseAnswer(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ga = A_LIST_GROUP.get(na), gb = A_LIST_GROUP.get(nb);
  if (ga && ga === gb) return true;
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const setA = new Set(ta), setB = new Set(tb);
  const [shorter, longer] = ta.length <= tb.length ? [ta, setB] : [tb, setA];
  const telling = shorter.filter(token => token.length >= 4 && !PLACE_TOKEN.test(token));
  if (telling.length && shorter.every(token => longer.has(token))) return true;
  const shared = ta.filter(token => setB.has(token)).length;
  return shared / Math.max(ta.length, tb.length) >= 0.6;
}

/** "Westertoren" -> "wester", "Zuiderkerk Tower" -> "zuider", "Westerkerk" -> "wester". */
function stem(name: string): string {
  return normaliseAnswer(name).replace(/\b(tower|church|spire)\b/g, '').replace(/(kerkstoren|kerktoren|toren|kerk)\b/g, '')
    .replace(/\s+/g, ' ').trim();
}

/** Whether `part` names a tower of the building `whole` names (Westertoren / Westerkerk). */
export function isComplexPart(part: DedupeFeature, whole: DedupeFeature): boolean {
  if (part.wikidata && whole.wikidata && part.wikidataPartOf?.includes(whole.wikidata)) return kmApart(part, whole) <= PART_OF_KM;
  if (!PART_WORDS.test(normaliseAnswer(part.name)) || PART_WORDS.test(normaliseAnswer(whole.name))) return false;
  const s = stem(part.name);
  return !!s && s === stem(whole.name) && kmApart(part, whole) <= PART_OF_KM;
}

/** Group rank: modelled first (it carries the 3D asset and researched card), then fame. */
function rank(feature: DedupeFeature): number {
  return (feature.manualPoi ? 1000 : 0) + landmarkNotability(feature);
}

const FAME_FIELDS = ['wikidata', 'wikidataSitelinks', 'wikipediaPageviews60d', 'heritage', 'wikidataInstanceOf', 'wikipedia', 'wikipediaUrl'] as const;

/**
 * Fold duplicate destinations. Order is preserved for the survivors; each
 * removal says which feature absorbed it and why.
 */
export function dedupeDestinations<T extends DedupeFeature>(features: readonly T[]): { kept: T[]; removed: DuplicateRemoval[] } {
  const parent = features.map((_, index) => index);
  const reasonOf = new Map<number, DuplicateReason>();
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (i: number, j: number, reason: DuplicateReason) => {
    const a = find(i), b = find(j);
    if (a === b) return;
    parent[b] = a;
    if (!reasonOf.has(i)) reasonOf.set(i, reason);
    if (!reasonOf.has(j)) reasonOf.set(j, reason);
  };
  const byKey = new Map<string, number>();
  features.forEach((feature, i) => {
    const keys = [
      ...(feature.wikidata ? [`q:${feature.wikidata}`] : []),
      ...articleKey(feature).map(key => `w:${key}`),
    ];
    for (const key of keys) {
      const prior = byKey.get(key);
      if (prior === undefined) byKey.set(key, i);
      else join(prior, i, key.startsWith('q:') ? 'same-wikidata' : 'same-article');
    }
  });
  // Same building, or a tower of a church, by proximity. O(n^2) over ~600
  // features is a few hundred thousand cheap distance checks.
  const parts = new Set<number>();
  for (let i = 0; i < features.length; i += 1) {
    for (let j = i + 1; j < features.length; j += 1) {
      const a = features[i], b = features[j];
      const km = kmApart(a, b);
      if (km > PART_OF_KM) continue;
      if (isComplexPart(a, b)) { parts.add(i); join(j, i, 'part-of'); continue; }
      if (isComplexPart(b, a)) { parts.add(j); join(i, j, 'part-of'); continue; }
      if (km <= SAME_BUILDING_KM && namesAlike(a.name, b.name)) join(i, j, 'same-building');
    }
  }
  const groups = new Map<number, number[]>();
  features.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  const winners = new Map<number, T>();
  const removed: DuplicateRemoval[] = [];
  for (const members of groups.values()) {
    // A tower never wins over its church.
    const eligible = members.filter(i => !parts.has(i));
    const pool = eligible.length ? eligible : members;
    const best = pool.reduce((a, b) => (rank(features[b]) > rank(features[a]) ? b : a));
    const winner: T = { ...features[best] };
    for (const i of members) {
      if (i === best) continue;
      const loser = features[i];
      for (const field of FAME_FIELDS) {
        if ((winner as DedupeFeature)[field] == null && loser[field] != null) {
          (winner as Record<string, unknown>)[field] = loser[field];
        }
      }
      removed.push({ removedId: loser.id, removedName: loser.name, keptId: winner.id, keptName: winner.name, reason: reasonOf.get(i) ?? 'same-building' });
    }
    winners.set(best, winner);
  }
  const kept = features.flatMap((_, i) => (winners.has(i) ? [winners.get(i)!] : []));
  return { kept, removed };
}

/**
 * Pairs that survive `dedupeDestinations` yet look alike: close and sharing a
 * name word, for the audit script to print so a human can decide.
 */
export function nearDuplicates<T extends DedupeFeature>(features: readonly T[], km = 0.15): Array<{ a: T; b: T; km: number }> {
  const out: Array<{ a: T; b: T; km: number }> = [];
  for (let i = 0; i < features.length; i += 1) {
    for (let j = i + 1; j < features.length; j += 1) {
      const d = kmApart(features[i], features[j]);
      if (d > km) continue;
      const ta = new Set(tokens(features[i].name));
      if (tokens(features[j].name).some(token => token.length >= 4 && ta.has(token))) out.push({ a: features[i], b: features[j], km: d });
    }
  }
  return out;
}
