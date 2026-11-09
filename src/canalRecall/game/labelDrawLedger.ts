// The label-draw ledger (#281): which names the map has on screen now, and when
// each was last drawn. The landmark question reads it so that it never asks
// about a building whose name was just on screen (the Brakke Grond, ride
// review #280 defect 1: its orientation label sat on screen at the start of
// Today's ride and the ride asked "Which building is this?" five seconds later).
//
// Writers: each label layer replaces its own drawn set when it re-plans
// (labels/labelOverlay.ts for the MapLibre engine, engine/overlays/labelLayer.ts
// for the own engine); the drive-by card notes the landmark it shows. Reader:
// game/landmarkQuestionRuntime.ts. The layers live in different bundles, so the
// ledger is shared through `window.__canalRecallLabelLedger` (sharedLedger).
//
// Pure apart from sharedLedger; times are milliseconds on one clock
// (performance.now() in the browser), never the race clock, which pauses.

import { inViewCone, LANDMARK_QUESTION_HALF_CONE, nameKey, type QuestionRider } from './landmarkQuestion';
import type { WorldPoint } from './worldTypes';

/** A landmark whose name was drawn this recently is not asked about. */
export const LABEL_RECENT_MS = 30_000;
/** A landmark whose drive-by card showed this recently is not asked about. */
export const CARD_RECENT_MS = 60_000;
/** Metres: inside this band (and the view cone) a landmark becomes the
 *  candidate and its name and its distractors' names are withheld before
 *  the question opens at LANDMARK_QUESTION_RADIUS_M. */
export const LANDMARK_APPROACH_RADIUS_M = 300;
/** Hysteresis: a candidate is kept while inside this multiple of the band... */
export const APPROACH_KEEP_FACTOR = 1.25;
/** ...and within this much more of the cone, so its labels do not blink. */
export const APPROACH_KEEP_EXTRA_CONE = (20 * Math.PI) / 180;
/** Short keys ("de", "het") would match half the city. */
const MIN_MATCH_KEY = 4;

export type SkipReason = 'labelRecent' | 'cardRecent';

export interface LabelDrawLedger {
  /** Per layer, the name keys it has on screen now. */
  current: Map<string, Set<string>>;
  /** Name key → when it was last on screen (set when it leaves a layer's drawn set). */
  lastDrawn: Map<string, number>;
  /** Name key → when its drive-by card last showed. */
  cards: Map<string, number>;
}

export function createLedger(): LabelDrawLedger {
  return { current: new Map(), lastDrawn: new Map(), cards: new Map() };
}

/** One layer's drawn set, replaced whole. Names that left it are stamped `at`. */
export function setDrawn(ledger: LabelDrawLedger, layer: string, names: Iterable<string>, at: number): void {
  const next = new Set<string>();
  for (const name of names) { const key = nameKey(name || ''); if (key) next.add(key); }
  setDrawnKeys(ledger, layer, next, at);
}

/** setDrawn with the name keys already made (`nameKey`, cached by the caller).
 *  An unchanged set writes nothing: a name on screen reads as `now` from
 *  `current`, and its lastDrawn is stamped when it leaves (#287). */
export function setDrawnKeys(ledger: LabelDrawLedger, layer: string, next: ReadonlySet<string>, at: number): void {
  const prior = ledger.current.get(layer);
  if (prior && prior.size === next.size) {
    let same = true;
    for (const key of next) if (!prior.has(key)) { same = false; break; }
    if (same) return;
  }
  if (prior) for (const key of prior) if (!next.has(key)) ledger.lastDrawn.set(key, at);
  for (const key of next) ledger.lastDrawn.set(key, at);
  ledger.current.set(layer, new Set(next));
  // Forget what can no longer veto anything.
  if (ledger.lastDrawn.size > 2000) {
    for (const [key, time] of ledger.lastDrawn) if (at - time > LABEL_RECENT_MS * 2) ledger.lastDrawn.delete(key);
  }
}

/** A drive-by (or any) card named this landmark at `at`. */
export function noteCardShown(ledger: LabelDrawLedger, name: string, at: number): void {
  const key = nameKey(name || '');
  if (key) ledger.cards.set(key, at);
}

/** Whether a drawn label and a landmark name are the same place: equal, or one
 *  holds the other as whole words ("Vlaams Cultuurhuis De Brakke Grond" and
 *  "De Brakke Grond"). */
export function namesMatch(labelKey: string, landmarkKey: string): boolean {
  if (!labelKey || !landmarkKey) return false;
  if (labelKey === landmarkKey) return true;
  const [short, long] = labelKey.length < landmarkKey.length ? [labelKey, landmarkKey] : [landmarkKey, labelKey];
  return short.length >= MIN_MATCH_KEY && ` ${long} `.includes(` ${short} `);
}

function lastMatch(map: Map<string, number>, key: string): number | null {
  let best: number | null = null;
  for (const [other, time] of map) if (namesMatch(other, key) && (best === null || time > best)) best = time;
  return best;
}

/** When the name was last on screen: `now` while any layer draws it, null if never. */
export function lastLabelDrawn(ledger: LabelDrawLedger, name: string, now: number): number | null {
  const key = nameKey(name || '');
  if (!key) return null;
  for (const drawn of ledger.current.values()) for (const other of drawn) if (namesMatch(other, key)) return now;
  return lastMatch(ledger.lastDrawn, key);
}

export function lastCardShown(ledger: LabelDrawLedger, name: string): number | null {
  return lastMatch(ledger.cards, nameKey(name || ''));
}

/** Null when the landmark may be asked about; otherwise why not. The label
 *  rule wins when both apply. */
export function landmarkSkipReason(ledger: LabelDrawLedger, name: string, now: number): SkipReason | null {
  const drawn = lastLabelDrawn(ledger, name, now);
  if (drawn !== null && now - drawn < LABEL_RECENT_MS) return 'labelRecent';
  const card = lastCardShown(ledger, name);
  if (card !== null && now - card < CARD_RECENT_MS) return 'cardRecent';
  return null;
}

/** The page's one ledger, shared by every bundle that draws or reads labels. */
export function sharedLedger(target: { __canalRecallLabelLedger?: LabelDrawLedger } | null | undefined = globalThis as never): LabelDrawLedger {
  if (!target) return createLedger();
  return (target.__canalRecallLabelLedger ||= createLedger());
}

/** `__canalRecallSession.landmarkSkips[reason]`: candidates passed over, each
 *  landmark counted once per reason per ride (`seen` holds `id:reason`). */
export function bumpSkipCounter(
  target: { __canalRecallSession?: Record<string, unknown> } | null | undefined,
  seen: Set<string>, id: string, reason: SkipReason,
): boolean {
  if (!target || seen.has(`${id}:${reason}`)) return false;
  seen.add(`${id}:${reason}`);
  const session = (target.__canalRecallSession ||= {});
  const skips = (session.landmarkSkips ||= { labelRecent: 0, cardRecent: 0 }) as Record<SkipReason, number>;
  skips[reason] = (Number(skips[reason]) || 0) + 1;
  return true;
}

/** Whether the candidate is still being approached: the band and the cone,
 *  each widened (APPROACH_KEEP_*), so the withheld labels do not blink back
 *  on at the band's edge. */
export function approachKept(rider: QuestionRider, point: WorldPoint, bandPx: number, halfCone = LANDMARK_QUESTION_HALF_CONE): boolean {
  return inViewCone(rider, point, bandPx * APPROACH_KEEP_FACTOR, halfCone + APPROACH_KEEP_EXTRA_CONE);
}
