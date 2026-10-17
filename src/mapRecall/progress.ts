/**
 * What the player has learned, read from the spaced-repetition store
 * (src/spacedRepetition.ts) for the start rail and the end-of-session screen.
 *
 * The store (localStorage `mapRecall_reviewStates_v1`, with its event log
 * `mapRecall_reviewEvents_v1`) is shared with Canal Recall, so "known" places
 * and earned neighbourhood postcards carry across both apps. Everything here
 * is pure; callers pass `now` for determinism.
 */
import type { GameMode, RoundResult, StreetFeature } from '../types';
import { rateRound, scheduleReview, type ReviewEvent, type ReviewRating, type ReviewState } from '../spacedRepetition';
import { getFeatureKey } from '../utils/featureIdentity';

const stateKey = (featureKey: string, mode: GameMode) => `${featureKey}_${mode}`;

const indexStates = (states: readonly ReviewState[]) =>
  new Map(states.map((state) => [stateKey(state.featureKey, state.mode), state]));

const inCity = (state: ReviewState, cityId?: string) => !cityId || !state.featureSnapshot?.cityId || state.featureSnapshot.cityId === cityId;

/** Reviews in `mode` whose due time has passed (optionally for one city). */
export function dueCount(states: readonly ReviewState[], mode: GameMode, now = Date.now(), cityId?: string): number {
  return states.filter((state) => state.mode === mode && state.dueAt <= now && inCity(state, cityId)).length;
}

/** Places answered well at least once since their last lapse in `mode` (repetitions >= 1). */
export function knownCount(states: readonly ReviewState[], mode: GameMode, cityId?: string): number {
  return states.filter((state) => state.mode === mode && state.repetitions >= 1 && inCity(state, cityId)).length;
}

/** The start rail's one-line summary. */
export function progressLine(states: readonly ReviewState[], mode: GameMode, now = Date.now(), cityId?: string): string {
  const due = dueCount(states, mode, now, cityId);
  const known = knownCount(states, mode, cityId);
  if (!due && !known) return 'Nothing due · 0 known yet — start with canals';
  return `${due ? `Due today ${due}` : 'Nothing due'} · Known ${known}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** "today", "tomorrow" or "Thu 16 Oct", in local time. */
export function formatReviewDay(dueAt: number, now = Date.now()): string {
  const today = startOfDay(now);
  const day = startOfDay(dueAt);
  if (day <= today) return 'today';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (day === tomorrow.getTime()) return 'tomorrow';
  const date = new Date(dueAt);
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export interface SessionItem {
  featureKey: string;
  name: string;
  type: StreetFeature['type'];
  rating: ReviewRating;
  nextReviewAt: number;
  /** "today" / "tomorrow" / "Thu 16 Oct". */
  nextReview: string;
  result: RoundResult;
}

export interface SessionGroups {
  /** Answered well and already known before this session. */
  known: SessionItem[];
  /** Rated again or hard. */
  shaky: SessionItem[];
  /** Answered well and not known before: first sight, or relearned after a lapse. */
  fresh: SessionItem[];
}

const isWell = (rating: ReviewRating) => rating === 'good' || rating === 'easy';

/**
 * Sorts a session's answers into Known / Still shaky / New. The next review comes
 * from `statesAfter` (what recordReview wrote); a result missing there is
 * rescheduled from `statesBefore` so the screen never shows a blank date.
 */
export function sessionGroups(
  results: readonly RoundResult[],
  statesBefore: readonly ReviewState[],
  statesAfter: readonly ReviewState[],
  now = Date.now(),
): SessionGroups {
  const before = indexStates(statesBefore);
  const after = indexStates(statesAfter);
  const groups: SessionGroups = { known: [], shaky: [], fresh: [] };
  for (const result of results) {
    const featureKey = getFeatureKey(result.feature);
    const key = stateKey(featureKey, result.gameMode);
    const previous = before.get(key);
    const rating = rateRound(result);
    const next = after.get(key) ?? scheduleReview(result, previous, now).state;
    const item: SessionItem = {
      featureKey,
      name: result.feature.name,
      type: result.feature.type,
      rating,
      nextReviewAt: next.dueAt,
      nextReview: formatReviewDay(next.dueAt, now),
      result,
    };
    if (!isWell(rating)) groups.shaky.push(item);
    else if ((previous?.repetitions ?? 0) >= 1) groups.known.push(item);
    else groups.fresh.push(item);
  }
  return groups;
}

// ---- Neighbourhood postcards ----
//
// A postcard is proof of spaced recall, not of one lucky answer. The rule,
// in the words the rack uses: recall a neighbourhood on two different days,
// at least once by pinning it on the map. Spelled out:
//
// - A *recall* is a correct answer about the neighbourhood itself: a Pinpoint
//   rated good/easy and within PIN_RECALL_METERS of the area (0 m inside it),
//   or a correct Guess Name / riding answer. Skips, misses, hinted "hard"
//   answers and mere exposure (a riding name shown but not asked) are not.
// - Earned when any of these first holds over the area's recalls, oldest first:
//   1. recalls on 2 different local days, at least one of them a pin;
//   2. a precise pin (inside the area, <= PRECISE_PIN_METERS) and a recall at
//      least LATER_SESSION_MS later: the next session, not the same round;
//   3. Guess Name alone (multiple choice is weaker evidence): 3 different days.
// - Review states carry no history, so a state with >= STATE_ONLY_REPETITIONS
//   good answers in a row also earns one. That covers progress synced from
//   another device, whose review events stay in the cloud.
// - Once earned, a later miss does not take the card back; it only makes the
//   area due for review again.

/** A pin this close to the area (0 inside it) counts as a recall. */
export const PIN_RECALL_METERS = 250;
/** A pin this close is a precise placement (inside the area or on its edge). */
export const PRECISE_PIN_METERS = 60;
/** "Later": far enough apart to be another session, not the next round. */
export const LATER_SESSION_MS = 30 * 60_000;
/** Distinct days of Guess Name answers that earn a card without a pin. */
export const NAME_ONLY_DAYS = 3;
/** Consecutive good answers that earn a card from a review state alone. */
export const STATE_ONLY_REPETITIONS = 3;

/** One sentence for the rack's empty state. */
export const POSTCARD_RULE = 'Recall a neighbourhood on two different days, once by pinning it on the map, to collect its postcard.';

export interface EarnedArea {
  featureKey: string;
  name: string;
  cityId?: string;
  /** When the rule was met; the rack shows the newest first. */
  earnedAt: number;
}

export interface AreaPostcard extends EarnedArea {
  earned: boolean;
  /** Distinct local days with a recall. */
  recallDays: number;
  /** Days the rule still asks for from here: 2, or 3 when only Guess Name has been used. */
  daysNeeded: number;
  pinned: boolean;
  lastRecalledAt: number;
  /** "1 of 2 days", "1 of 2 days · pin it once"; empty once earned. */
  hint: string;
}

interface Recall { at: number; day: number; pin: boolean; precise: boolean }

const nameKey = (cityId: string | undefined, name: string) => `${cityId ?? ''}|${name.trim().toLowerCase()}`;

const recallOf = (event: ReviewEvent): Recall | null => {
  if (!isWell(event.rating) || event.result.skipped || event.result.isCorrect === false) return null;
  const pin = event.mode !== 'guess_name';
  const distance = event.result.distanceErrorMeters;
  if (pin && distance !== undefined && distance > PIN_RECALL_METERS) return null;
  return { at: event.reviewedAt, day: startOfDay(event.reviewedAt), pin, precise: pin && distance !== undefined && distance <= PRECISE_PIN_METERS };
};

/** When `recalls` (oldest first) first meet the rule, or null. */
function earnedAtOf(recalls: readonly Recall[]): number | null {
  const days = new Set<number>();
  let pinned = false;
  let firstPrecise = Infinity;
  for (const recall of recalls) {
    days.add(recall.day);
    pinned ||= recall.pin;
    if (days.size >= 2 && pinned) return recall.at;
    if (recall.at - firstPrecise >= LATER_SESSION_MS) return recall.at;
    if (days.size >= NAME_ONLY_DAYS) return recall.at;
    if (recall.precise) firstPrecise = Math.min(firstPrecise, recall.at);
  }
  return null;
}

const progressHint = (days: number, pinned: boolean): { daysNeeded: number; hint: string } => {
  if (pinned) return { daysNeeded: 2, hint: '1 of 2 days' };
  if (days <= 1) return { daysNeeded: 2, hint: '1 of 2 days · pin it once' };
  return { daysNeeded: NAME_ONLY_DAYS, hint: `${days} of ${NAME_ONLY_DAYS} days · or pin it` };
};

/**
 * Every neighbourhood with at least one recall, earned or on its way, merged
 * across modes and keys by city + name. Earned first (newest first), then the
 * in-progress areas, most recently recalled first. Review events are joined to
 * their area through the states' snapshots, so an event whose state was
 * forgotten no longer counts.
 */
export function postcardProgress(states: readonly ReviewState[], events: readonly ReviewEvent[], cityId?: string): AreaPostcard[] {
  interface Area { featureKey: string; name: string; cityId?: string; recalls: Recall[]; stateEarnedAt: number | null; stateRecalledAt: number }
  const areas = new Map<string, Area>();
  const areaOfKey = new Map<string, Area>();
  for (const state of states) {
    const snapshot = state.featureSnapshot;
    if (!snapshot || snapshot.type !== 'neighborhood') continue;
    if (cityId && snapshot.cityId && snapshot.cityId !== cityId) continue;
    const key = nameKey(snapshot.cityId, snapshot.name);
    let area = areas.get(key);
    if (!area) {
      area = { featureKey: state.featureKey, name: snapshot.name, cityId: snapshot.cityId, recalls: [], stateEarnedAt: null, stateRecalledAt: 0 };
      areas.set(key, area);
    }
    areaOfKey.set(stateKey(state.featureKey, state.mode), area);
    if (state.repetitions >= 1) area.stateRecalledAt = Math.max(area.stateRecalledAt, state.lastReviewedAt);
    if (state.repetitions >= STATE_ONLY_REPETITIONS) {
      area.stateEarnedAt = Math.min(area.stateEarnedAt ?? Infinity, state.lastReviewedAt);
    }
  }
  const seenEvents = new Set<string>();
  for (const event of events) {
    const area = areaOfKey.get(stateKey(event.featureKey, event.mode));
    if (!area || seenEvents.has(event.id)) continue;
    seenEvents.add(event.id);
    const recall = recallOf(event);
    if (recall) area.recalls.push(recall);
  }

  const result: AreaPostcard[] = [];
  for (const area of areas.values()) {
    area.recalls.sort((a, b) => a.at - b.at);
    const fromEvents = earnedAtOf(area.recalls);
    const earnedAt = fromEvents ?? area.stateEarnedAt;
    const lastRecalledAt = Math.max(area.stateRecalledAt, area.recalls.at(-1)?.at ?? 0);
    if (earnedAt === null && !lastRecalledAt) continue;
    const recallDays = Math.max(new Set(area.recalls.map((recall) => recall.day)).size, area.stateRecalledAt ? 1 : 0);
    const pinned = area.recalls.some((recall) => recall.pin);
    const progress = earnedAt === null ? progressHint(recallDays, pinned) : { daysNeeded: 0, hint: '' };
    result.push({
      featureKey: area.featureKey, name: area.name, cityId: area.cityId,
      earned: earnedAt !== null, earnedAt: earnedAt ?? lastRecalledAt,
      recallDays, pinned, lastRecalledAt, ...progress,
    });
  }
  return result.sort((a, b) => Number(b.earned) - Number(a.earned) || b.earnedAt - a.earnedAt);
}

/** Neighbourhoods with a postcard (see `postcardProgress`), newest first. */
export function earnedAreas(states: readonly ReviewState[], events: readonly ReviewEvent[], cityId?: string): EarnedArea[] {
  return postcardProgress(states, events, cityId).filter((area) => area.earned)
    .map(({ featureKey, name, cityId: city, earnedAt }) => ({ featureKey, name, cityId: city, earnedAt }));
}

/** Featurekeys and city+name keys of the earned set, for matching extract features. */
export function earnedAreaKeys(states: readonly ReviewState[], events: readonly ReviewEvent[], cityId?: string): Set<string> {
  const keys = new Set<string>();
  for (const area of earnedAreas(states, events, cityId)) {
    keys.add(area.featureKey);
    keys.add(nameKey(area.cityId, area.name));
  }
  return keys;
}

/** Whether `feature` is in an `earnedAreaKeys` set. */
export const isEarned = (keys: ReadonlySet<string>, feature: Pick<StreetFeature, 'cityId' | 'name'> & Partial<StreetFeature>): boolean =>
  keys.has(nameKey(feature.cityId, feature.name)) || (!!feature.center && keys.has(getFeatureKey(feature as StreetFeature)));

/**
 * The events as they stood when `states` were current: an event counts only if
 * its state existed then and had already reviewed it. With the session's
 * before-states this recovers the log at the session's start without a clock.
 */
export function eventsAsOf(events: readonly ReviewEvent[], states: readonly ReviewState[]): ReviewEvent[] {
  const byKey = indexStates(states);
  return events.filter((event) => {
    const state = byKey.get(stateKey(event.featureKey, event.mode));
    return !!state && event.reviewedAt <= state.lastReviewedAt;
  });
}

/**
 * Neighbourhood postcards this session earned: areas the rule accepts after
 * the session (`statesAfter` + `events`) and not before it, one result per
 * area, best answer first (highest points).
 */
export function newlyEarned(
  results: readonly RoundResult[],
  statesBefore: readonly ReviewState[],
  statesAfter: readonly ReviewState[],
  events: readonly ReviewEvent[],
): RoundResult[] {
  const had = earnedAreaKeys(statesBefore, eventsAsOf(events, statesBefore));
  const has = earnedAreaKeys(statesAfter, events);
  const seen = new Set<string>();
  return results
    .filter((result) => result.feature.type === 'neighborhood' && isWell(rateRound(result))
      && isEarned(has, result.feature) && !isEarned(had, result.feature))
    .sort((a, b) => b.pointsEarned - a.pointsEarned)
    .filter((result) => {
      const key = nameKey(result.feature.cityId, result.feature.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * "today", "yesterday", "3 days ago", "2 weeks ago", "3 months ago", by local
 * calendar day (a review at 23:50 is "yesterday" at 00:10).
 */
export function formatDaysAgo(then: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = Math.round(days / 365);
  return years === 1 ? 'a year ago' : `${years} years ago`;
}

/** The question card's seen-before chip, or null for a first sight. Never says where. */
export function seenBeforeLabel(
  states: readonly ReviewState[],
  feature: StreetFeature,
  mode: GameMode,
  now = Date.now(),
): string | null {
  const state = indexStates(states).get(stateKey(getFeatureKey(feature), mode));
  if (!state || !Number.isFinite(state.lastReviewedAt)) return null;
  const parts = [`Seen ${formatDaysAgo(state.lastReviewedAt, now)}`];
  if (state.lapses > 0) parts.push('missed before');
  else if (state.repetitions >= 2) parts.push(`known · ${state.repetitions} reviews`);
  return parts.join(' · ');
}
