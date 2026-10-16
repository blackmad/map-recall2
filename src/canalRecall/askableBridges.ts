// Which named bridges the bridge question can ask.
//
// `bridges.json` was the 300 most prominent OSM bridges, and every one of the
// 300 has a Wikidata or Wikipedia link: the cut was effectively "linked
// bridges only". The route question only asks "Which bridge are you on?" for
// a bridge in that file, and since `bridgeStreetName.ts` (2026-10-16) a
// bridge-named way outside it either answers with the street it carries or is
// transparent. So the 124 bridge names on routed ways that were cut were
// taught by no question at all (the Noordsche Compagniebrug among them).
//
// The rule: every bridge-named way the rider can actually ride (a way in the
// routing graph whose name `isBridgeWayName` accepts) is askable, unless
//   - its name is a register number ("Brug 117"), which the game never asks;
//   - its deck is shorter than the distance a route question needs to settle
//     (`ROUTE_QUIZ_SETTLE_METRES`): the rider is off it before it can open.
//
// Ids follow the extract generator's scheme (`extract_bridges_<hash of
// "bridges:<lower-case name>">`), so an entry added here keeps its id when the
// generator later produces it itself, and existing ids are never touched.

import { isBridgeWayName } from './game/bridgeStreetName';
import { ROUTE_QUIZ_SETTLE_METRES } from './game/recallRules';

export type LatLon = [number, number];

/** The register-number names the game drops everywhere (`Brug 117`, `1127`). */
export const GENERIC_BRIDGE_NAME = /^\s*(brug\s*|bridge\s*)?\d+\s*$/i;

/** Same hash the extract generator uses for feature ids. */
export function stableStringHash(value: string): number {
  return [...value].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 17);
}

/** The id `build-amsterdam-extract.ts` gives a bridge of this name. */
export function bridgeFeatureId(name: string): string {
  return `extract_bridges_${Math.abs(stableStringHash(`bridges:${name.trim().toLocaleLowerCase()}`))}`;
}

export function metresBetween([lat0, lon0]: LatLon, [lat1, lon1]: LatLon): number {
  const latScale = 110_540;
  const lonScale = 111_320 * Math.cos(((lat0 + lat1) / 2) * Math.PI / 180);
  return Math.hypot((lat1 - lat0) * latScale, (lon1 - lon0) * lonScale);
}

export function lineMetres(line: readonly LatLon[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += metresBetween(line[i - 1], line[i]);
  return total;
}

/** A routing way, as `streets-routing.json` publishes it. */
export interface RoutingWay {
  name: string;
  highway?: string;
  bridge?: boolean;
  path?: LatLon[];
  paths?: LatLon[][];
}

const linesOf = (way: { path?: LatLon[]; paths?: LatLon[][] }): LatLon[][] =>
  (way.paths?.length ? way.paths : way.path ? [way.path] : []).filter(line => line.length > 1);

/** Two spellings this close are one bridge. */
const SAME_BRIDGE_METRES = 150;

/** Ends this close are one deck (a deck split mid-span, or two carriageways'
 *  shared abutment node after simplification). */
const JOIN_METRES = 3;

/**
 * Length of the longest run of joined pieces: what a rider can travel on the
 * name without leaving it. Parallel carriageways are separate runs.
 */
export function longestDeckMetres(lines: readonly LatLon[][]): number {
  const parent = lines.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) index = parent[index] = parent[parent[index]];
    return index;
  };
  for (let a = 0; a < lines.length; a++) {
    for (let b = a + 1; b < lines.length; b++) {
      const ends = [lines[a][0], lines[a][lines[a].length - 1]];
      const others = [lines[b][0], lines[b][lines[b].length - 1]];
      if (ends.some(end => others.some(other => metresBetween(end, other) <= JOIN_METRES))) {
        parent[find(a)] = find(b);
      }
    }
  }
  const totals = new Map<number, number>();
  lines.forEach((line, index) => totals.set(find(index), (totals.get(find(index)) || 0) + lineMetres(line)));
  return Math.max(0, ...totals.values());
}

export interface DeckGroup {
  name: string;
  lines: LatLon[][];
  highway?: string;
  longestDeckMetres: number;
}

/** Bridge-named routing ways grouped by name, in first-seen order. */
export function routedDeckGroups(ways: readonly RoutingWay[]): DeckGroup[] {
  const groups = new Map<string, DeckGroup>();
  for (const way of ways) {
    const name = (way.name || '').trim();
    if (!isBridgeWayName(name)) continue;
    const group = groups.get(name) || { name, lines: [], highway: way.highway, longestDeckMetres: 0 };
    group.lines.push(...linesOf(way));
    groups.set(name, group);
  }
  for (const group of groups.values()) group.longestDeckMetres = longestDeckMetres(group.lines);
  return [...groups.values()];
}

export type ExclusionReason = 'register-number' | 'deck-too-short' | 'no-geometry' | 'spelling-variant';

/** "Heiligewegssluis" and "Heiligewegsluis", "Katten brug" and "Kattenbrug":
 *  case, spaces, punctuation and doubled letters folded away. A trailing
 *  -sluis folds to -brug: in Amsterdam "sluis" is the old word for a bridge,
 *  and OSM maps the Vier Heemskinderenbrug also as "Vier Heemskinderensluis"
 *  7 m away (nl.wikipedia gives both names). Only spellings within
 *  SAME_BRIDGE_METRES collide, so distinct -sluis and -brug stay apart. */
export function bridgeSpellingKey(name: string): string {
  return name.toLocaleLowerCase().normalize('NFD').replace(/[^\p{L}]/gu, '').replace(/(\p{L})\1+/gu, '$1').replace(/sluis$/u, 'brug');
}

export interface AskableDecision {
  name: string;
  askable: boolean;
  reason?: ExclusionReason;
  longestDeckMetres: number;
}

/** Whether a routed bridge name can be asked, and if not, why. */
export function decideAskable(group: DeckGroup, minDeckMetres = ROUTE_QUIZ_SETTLE_METRES): AskableDecision {
  const base = { name: group.name, longestDeckMetres: Math.round(group.longestDeckMetres * 10) / 10 };
  if (GENERIC_BRIDGE_NAME.test(group.name) || /^brug\s+\d+/i.test(group.name)) {
    return { ...base, askable: false, reason: 'register-number' };
  }
  if (!group.lines.length) return { ...base, askable: false, reason: 'no-geometry' };
  if (group.longestDeckMetres < minDeckMetres) return { ...base, askable: false, reason: 'deck-too-short' };
  return { ...base, askable: true };
}

/** The bridge-feature shape the extract publishes (the fields this sets). */
export interface AskableBridgeFeature {
  id: string;
  name: string;
  type: 'bridge';
  cityId: string;
  center: LatLon;
  funFact: string;
  clues: string[];
  distractors: string[];
  difficulty: 'hard';
  prominenceScore: number;
  highway?: string;
  path: LatLon[];
  paths?: LatLon[][];
  /** Why the entry exists: it was added for the bridge question, not by
   *  prominence. Lets a later refresh tell the two apart. */
  askableBy: 'routed-deck';
}

/** Midpoint along a line, by length. */
function midpoint(line: readonly LatLon[]): LatLon {
  const half = lineMetres(line) / 2;
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const step = metresBetween(line[i - 1], line[i]);
    if (walked + step >= half && step > 0) {
      const t = (half - walked) / step;
      return [
        Number((line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t).toFixed(6)),
        Number((line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t).toFixed(6)),
      ];
    }
    walked += step;
  }
  return line[0];
}

/** A published feature for an askable deck group. Distractors are filled by
 *  the caller from the whole bridge pool. */
export function askableBridgeFeature(group: DeckGroup, cityId: string): AskableBridgeFeature {
  const longest = group.lines.reduce((best, line) => (lineMetres(line) > lineMetres(best) ? line : best), group.lines[0]);
  const totalMetres = group.lines.reduce((sum, line) => sum + lineMetres(line), 0);
  const feature: AskableBridgeFeature = {
    id: bridgeFeatureId(group.name),
    name: group.name,
    type: 'bridge',
    cityId,
    center: midpoint(longest),
    funFact: '',
    clues: [],
    distractors: [],
    difficulty: 'hard',
    // The generator's score with no Wikidata/Wikipedia link and no class bonus.
    prominenceScore: Math.round(Math.log10(Math.max(10, totalMetres)) * 12),
    path: group.lines[0],
    askableBy: 'routed-deck',
  };
  if (group.highway) feature.highway = group.highway;
  if (group.lines.length > 1) feature.paths = group.lines;
  return feature;
}

export interface SupplementOptions {
  /** Official spellings (the municipal register's names). When two routed
   *  spellings of one bridge collide, the official one is asked. */
  officialNames?: ReadonlySet<string>;
}

export interface SupplementResult {
  added: AskableBridgeFeature[];
  /** Routed bridge names already in the published file. */
  alreadyAskable: string[];
  excluded: AskableDecision[];
  routedNames: number;
}

/**
 * The askable decks the published bridges are missing. Existing entries are
 * never rewritten; a new entry whose id collides with an existing one (a hash
 * collision, or the same name under another spelling) is an error.
 */
export function supplementBridges(
  published: ReadonlyArray<{ id: string; name: string; center?: LatLon }>,
  ways: readonly RoutingWay[],
  cityId: string,
  options: SupplementOptions = {},
): SupplementResult {
  const names = new Set(published.map(bridge => bridge.name.trim()));
  const ids = new Set(published.map(bridge => bridge.id));
  const groups = routedDeckGroups(ways);
  const added: AskableBridgeFeature[] = [];
  const alreadyAskable: string[] = [];
  const excluded: AskableDecision[] = [];
  // One bridge under two OSM spellings must not be two questions, each the
  // other's distractor. The published spelling wins, then the official one,
  // then the longer deck. Only spellings within SAME_BRIDGE_METRES collide:
  // Amsterdam reuses bridge names across districts.
  const official = options.officialNames || new Set<string>();
  const totalMetres = (group: DeckGroup) => group.lines.reduce((sum, line) => sum + lineMetres(line), 0);
  const rank = (name: string, group?: DeckGroup) =>
    (names.has(name) ? 1e9 : 0) + (official.has(name) ? 1e6 : 0) + (group ? totalMetres(group) : 0);
  const centreOf = (group: DeckGroup) => group.lines[0][0];
  const spellings = new Map<string, Array<{ name: string; centre: LatLon; group?: DeckGroup }>>();
  const addSpelling = (name: string, centre: LatLon | undefined, group?: DeckGroup) => {
    if (!centre) return;
    const key = bridgeSpellingKey(name);
    spellings.set(key, [...(spellings.get(key) || []), { name, centre, group }]);
  };
  for (const bridge of published) addSpelling(bridge.name.trim(), bridge.center);
  for (const group of groups) if (group.lines.length) addSpelling(group.name, centreOf(group), group);
  const variantOf = (group: DeckGroup): boolean => {
    if (!group.lines.length) return false;
    const mine = rank(group.name, group);
    return (spellings.get(bridgeSpellingKey(group.name)) || []).some(other => other.name !== group.name
      && metresBetween(other.centre, centreOf(group)) <= SAME_BRIDGE_METRES
      && (rank(other.name, other.group) > mine || (rank(other.name, other.group) === mine && other.name < group.name)));
  };
  for (const group of groups) {
    if (names.has(group.name)) { alreadyAskable.push(group.name); continue; }
    const decision = decideAskable(group);
    if (!decision.askable) { excluded.push(decision); continue; }
    if (variantOf(group)) {
      excluded.push({ ...decision, askable: false, reason: 'spelling-variant' });
      continue;
    }
    const feature = askableBridgeFeature(group, cityId);
    if (ids.has(feature.id)) throw new Error(`id ${feature.id} for "${group.name}" is already taken`);
    ids.add(feature.id);
    added.push(feature);
  }
  added.sort((a, b) => a.name.localeCompare(b.name));
  return { added, alreadyAskable, excluded, routedNames: groups.length };
}
