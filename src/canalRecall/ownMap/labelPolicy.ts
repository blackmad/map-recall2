// Which names the own map may draw. Not new rules: the game's existing ones,
// composed in one testable place so that a renderer without MapLibre's layer
// filters cannot drift from them. The product rule (CLAUDE.md): the street or
// canal under question must never be revealed by the HUD or map before the
// answer.
//
// Sources reused (unchanged):
//  - Street/water names are drawn only where earned:
//    `isLabelled(text, x, y) = _mapLabelNames.has(text) || _isPlaceKnown(text, x, y)`
//    (src/canalRecall/game/presentationRuntime.ts:629-631, place test
//    `isPlaceKnown` in src/canalRecall/game/recallRules.ts:51), and the name
//    being asked is withheld: `hiddenName = quizPromptName || quizCandidateName`
//    (presentationRuntime.ts:631), enforced in road-network.js `drawLabels`
//    (public/canal-drive/js/road-network.js:608-630).
//  - The basemap's own road/water labels are hidden outright
//    (vector-map.js `_hideLabels`, :2325) — here they simply never exist.
//  - POI names are screened by `poiNameSpoils` against `buildSpoilerIndex` of
//    every quiz-eligible name (src/canalRecall/orientationPois.ts:143,164;
//    vector-map.js `setSpoilerNames` :1543 / `_spoils` :1609), then thinned
//    (`ownPoiFeatures`, src/canalRecall/ownPois.ts:27).
//  - During a place quiz POI and neighbourhood names go quiet
//    (vector-map.js `setQuizQuietMap`, :2361).

import { buildSpoilerIndex, normaliseSpoilerName, poiNameSpoils, type SpoilerIndex } from '../orientationPois';
import { isPlaceKnown } from '../game/recallRules';
import type { WorldPoint } from '../game/worldTypes';

export interface LabelContext {
  /** The game's `(text, x, y) => _mapLabelNames.has(text) || _isPlaceKnown(text, x, y)`. */
  isLabelled: (text: string, x: number, y: number) => boolean;
  /** `quizPromptName || quizCandidateName`: never drawn, whatever else says. */
  hiddenName: string;
  /** `buildSpoilerIndex` of every quiz-eligible name (extract + track). */
  spoilerIndex: SpoilerIndex | null;
  /** `setQuizQuietMap(true)`: POI and neighbourhood names off. */
  quizQuiet: boolean;
}

/**
 * A street or water name. Same order as road-network.js drawLabels: earned
 * here, and not the one being asked. The hidden name is compared normalised
 * as well as exactly — the canvas compares `===`, which a renderer reading a
 * differently-cased extract name would slip past.
 */
export function streetLabelVisible(ctx: LabelContext, text: string, x: number, y: number): boolean {
  if (!text) return false;
  if (ctx.hiddenName && (text === ctx.hiddenName || normaliseSpoilerName(text) === normaliseSpoilerName(ctx.hiddenName))) return false;
  return ctx.isLabelled(text, x, y);
}

/** A POI / venue / landmark name: never one that contains a quiz name. */
export function poiLabelVisible(ctx: LabelContext, name: string): boolean {
  if (!name || ctx.quizQuiet) return false;
  if (ctx.spoilerIndex && poiNameSpoils(name, ctx.spoilerIndex)) return false;
  // The asked name is always a spoiler, even if the index has not caught up.
  if (ctx.hiddenName && poiNameSpoils(name, buildSpoilerIndex([ctx.hiddenName]))) return false;
  return true;
}

/**
 * A brand icon (Albert Heijn disc). The game screens branded POIs by name
 * before they reach the map (vector-map.js `setBrandedPois`, `_spoils`) and
 * keeps the icons in quiz-quiet — `setQuizQuietMap` hides only the brand and
 * local-food *names* (vector-map.js:2560).
 */
export function brandIconVisible(ctx: LabelContext, name: string): boolean {
  if (ctx.spoilerIndex && poiNameSpoils(name, ctx.spoilerIndex)) return false;
  if (ctx.hiddenName && poiNameSpoils(name, buildSpoilerIndex([ctx.hiddenName]))) return false;
  return true;
}

/**
 * A ferry terminal ("Buiksloterweg ⛴"). The game draws its route's terminals
 * unscreened (vector-map.js `setFerryTerminals`), but a terminal named after
 * the street being asked would answer it, so the asked name is withheld here.
 * Not quieted: the terminals are wayfinding for the ride itself.
 */
export function ferryLabelVisible(ctx: LabelContext, name: string): boolean {
  if (!name) return false;
  return !(ctx.hiddenName && poiNameSpoils(name, buildSpoilerIndex([ctx.hiddenName])));
}

export function neighbourhoodLabelVisible(ctx: LabelContext): boolean {
  return !ctx.quizQuiet;
}

/**
 * The context the game would hand the own map, built from the same fields
 * presentationRuntime uses. `knownPlaces` is `_knownPlaces` (name → world
 * points), `radius` is `RECALL_LOCAL_RADIUS_METERS * PIXELS_PER_METER`.
 */
export function gameLabelContext(game: {
  mapLabelNames: ReadonlySet<string>;
  knownPlaces: ReadonlyMap<string, readonly WorldPoint[]>;
  knownRadius: number;
  quizPromptName?: string | null;
  quizCandidateName?: string | null;
  spoilerNames: Iterable<string>;
  quizQuiet: boolean;
  /** Own-map local metres → the game's world units, for the place test. */
  toWorld: (x: number, y: number) => WorldPoint;
}): LabelContext {
  return {
    isLabelled: (text, x, y) => {
      if (game.mapLabelNames.has(text)) return true;
      const w = game.toWorld(x, y);
      return isPlaceKnown(game.knownPlaces.get(text), w.x, w.y, game.knownRadius);
    },
    hiddenName: game.quizPromptName || game.quizCandidateName || '',
    spoilerIndex: buildSpoilerIndex(game.spoilerNames),
    quizQuiet: game.quizQuiet,
  };
}
