// Landmarks you can name (G3, #273): when a modelled landmark comes into view
// the ride may ask "Which building is this?" with four names from the same
// buurt, one of them right. A correct answer fires the passport's `named`
// stamp (collection/poiCollection.ts), which nothing fired before.
//
// This module is pure: it picks the landmark, deals the four names, decides
// whether the one card slot is free, and keeps the per-landmark sightings
// (noticed on a drive-by card, named in a question) that count toward a
// buurt's passport. The browser half is landmarkQuestionRuntime.ts.

import type { WorldPoint } from './worldTypes';
import { freeRideLandmarkQuizEnabled } from '../featureFlags';

/** Metres: how close the rider must be to the landmark's street point (its
 *  snap onto the network, `x`/`y`) to be asked about it. "Which building is
 *  this?" only makes sense right beside the building: at 150 m the user was
 *  asked about FOAM from Vijzelstraat with the building round the corner
 *  (2026-11-13). */
export const LANDMARK_QUESTION_RADIUS_M = 35;
/** Metres: and how close to the building's own point (`ownX`/`ownY`). Wider
 *  than the street radius because a large building's point sits deep in its
 *  plot; it still rules out a snap onto a street the building does not face. */
export const LANDMARK_QUESTION_OWN_RADIUS_M = 80;
/** Radians either side of the heading in which a building beside the rider
 *  still counts: ahead and alongside, not once it is behind. */
export const LANDMARK_BESIDE_HALF_CONE = (110 * Math.PI) / 180;
/** Radians either side of the direction of travel that count as "in view". */
export const LANDMARK_QUESTION_HALF_CONE = (55 * Math.PI) / 180;
/** Metres: a name standing this close to the answer is the same complex
 *  (Westertoren beside the Westerkerk) and would be a second right answer. */
export const SAME_COMPLEX_M = 40;
/** One right name and three others. */
export const LANDMARK_CHOICE_COUNT = 4;
/** Further than this from the answer a filler name is no longer a neighbour. */
export const FILLER_MAX_M = 900;

export interface QuestionRider extends WorldPoint {
  angle: number;
  speed: number;
}

export interface QuestionLandmark extends WorldPoint {
  id: string;
  name: string;
  /** The building's own point, before the snap of `x`/`y` onto the network. */
  ownX?: number;
  ownY?: number;
  /** The buurt the landmark stands in, when known. */
  hood?: string | null;
}

/** Same normalisation spirit as answerPath: case, accents, punctuation. */
export function nameKey(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Whether `point` is ahead of the rider within `radiusPx` and the cone. */
export function inViewCone(rider: QuestionRider, point: WorldPoint, radiusPx: number, halfCone = LANDMARK_QUESTION_HALF_CONE): boolean {
  const dx = point.x - rider.x, dy = point.y - rider.y;
  const distance = Math.hypot(dx, dy);
  if (distance > radiusPx) return false;
  if (distance < 1) return true;
  const heading = rider.speed < 0 ? rider.angle + Math.PI : rider.angle;
  let off = Math.atan2(dy, dx) - heading;
  off = Math.atan2(Math.sin(off), Math.cos(off));
  return Math.abs(off) <= halfCone;
}

/** Off the heading, in radians (0 ahead, π behind); reversing looks back. */
function offHeading(rider: QuestionRider, point: WorldPoint): number {
  const heading = rider.speed < 0 ? rider.angle + Math.PI : rider.angle;
  const off = Math.atan2(point.y - rider.y, point.x - rider.x) - heading;
  return Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
}

/** The building's own point, or its street point when the extract has none. */
export function ownPoint(landmark: WorldPoint & { ownX?: number; ownY?: number }): WorldPoint {
  return Number.isFinite(landmark.ownX) && Number.isFinite(landmark.ownY)
    ? { x: landmark.ownX!, y: landmark.ownY! } : landmark;
}

/** Whether the rider is right beside the landmark: within
 *  LANDMARK_QUESTION_RADIUS_M of its street point and
 *  LANDMARK_QUESTION_OWN_RADIUS_M of the building, which is ahead or
 *  alongside, not behind. Only then can "this" be told apart on screen. */
export function besideLandmark(
  rider: QuestionRider,
  landmark: WorldPoint & { ownX?: number; ownY?: number },
  pxPerMetre: number,
): boolean {
  if (Math.hypot(landmark.x - rider.x, landmark.y - rider.y) > LANDMARK_QUESTION_RADIUS_M * pxPerMetre) return false;
  const own = ownPoint(landmark);
  const distance = Math.hypot(own.x - rider.x, own.y - rider.y);
  if (distance > LANDMARK_QUESTION_OWN_RADIUS_M * pxPerMetre) return false;
  return distance < pxPerMetre || offHeading(rider, own) <= LANDMARK_BESIDE_HALF_CONE;
}

/** The nearest candidate in view, or null. `skip` holds ids already asked,
 *  named, seen as a card this ride, or the route's own destination. */
export function pickLandmarkQuestion<T extends QuestionLandmark>(
  rider: QuestionRider,
  candidates: readonly T[],
  options: { radiusPx: number; skip?: ReadonlySet<string>; halfCone?: number },
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (!candidate.name || options.skip?.has(candidate.id)) continue;
    if (!inViewCone(rider, candidate, options.radiusPx, options.halfCone)) continue;
    const distance = Math.hypot(candidate.x - rider.x, candidate.y - rider.y);
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  return best;
}

/**
 * Four names, the answer among them: the others from the same buurt first,
 * then the nearest landmarks around it. A name that is the answer's own
 * complex (within `sameComplexPx`) or reads the same is never a distractor.
 * Null when fewer than three honest distractors exist: no question then.
 */
export function landmarkChoices<T extends QuestionLandmark>(
  answer: T,
  pool: readonly T[],
  options: { sameComplexPx: number; fillerMaxPx: number; shuffle?: <U>(items: U[]) => U[]; count?: number },
): string[] | null {
  const count = options.count ?? LANDMARK_CHOICE_COUNT;
  const taken = new Set([nameKey(answer.name)]);
  const near = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.y - b.y);
  const eligible = pool.filter(other => other.id !== answer.id && !!other.name
    && near(other, answer) > options.sameComplexPx);
  const byDistance = (a: T, b: T) => near(a, answer) - near(b, answer) || a.name.localeCompare(b.name);
  const sameHood = answer.hood ? eligible.filter(other => other.hood === answer.hood).sort(byDistance) : [];
  const filler = eligible.filter(other => !(answer.hood && other.hood === answer.hood) && near(other, answer) <= options.fillerMaxPx)
    .sort(byDistance);
  const picked: string[] = [];
  for (const other of [...sameHood, ...filler]) {
    if (picked.length >= count - 1) break;
    const key = nameKey(other.name);
    if (!key || taken.has(key)) continue;
    // "Westerkerk" and "Westerkerk (toren)" read as one answer.
    if ([...taken].some(seen => seen.includes(key) || key.includes(seen))) continue;
    taken.add(key);
    picked.push(other.name);
  }
  if (picked.length < count - 1) return null;
  const choices = [answer.name, ...picked];
  return options.shuffle ? options.shuffle(choices) : choices;
}

/** The names withheld on every label surface while a landmark question is
 *  open: the answer and its three distractors, each once. */
export function landmarkWithheldNames(answer: string, choices: readonly string[]): string[] {
  return [...new Set([answer, ...choices].filter(Boolean))];
}

/** What else owns the one card slot this frame. */
export interface CardSlot {
  /** A question (street, bridge, landmark) is open, or a name is withheld. */
  questionOpen: boolean;
  /** A street name is settling into a question: its label is hidden as the
   *  candidate, and a landmark question would unhide it. */
  streetCandidate: boolean;
  /** Answer feedback or the answer hold is still on screen. */
  feedbackVisible: boolean;
  /** A settings/help panel or the expanded article is over the ride. */
  utilityOpen: boolean;
}

/** The one-card rule: a landmark question only into an empty slot. */
export function mayAskLandmark(slot: CardSlot): boolean {
  return !slot.questionOpen && !slot.streetCandidate && !slot.feedbackVisible && !slot.utilityOpen;
}

/** Whether rides ask landmark questions without a flag. Off in the #281
 *  hotfix (the question could name a building whose label was just on
 *  screen); back on with the label-draw ledger and approach withholding. */
export const LANDMARK_QUESTIONS_DEFAULT_ON = true;

/** `?landmarkQuestions=0|false|off` restores drive-by cards only; when the
 *  default is off, only `?landmarkQuestions=1|true|on` turns them on. Free
 *  Ride never asks by default (user 2026-11-09, F1 #311): only with
 *  `?freeRideQuiz=1` (featureFlags.ts) and "Quiz me on landmarks" on. */
export function landmarkQuestionsEnabled(search: string, mode: { freeRide: boolean; freeRideQuiz: boolean }): boolean {
  const flag = /[?&]landmarkQuestions=([^&]*)/.exec(search || '');
  if (flag && (flag[1] === '0' || flag[1] === 'false' || flag[1] === 'off')) return false;
  const optedIn = !!flag && (flag[1] === '1' || flag[1] === 'true' || flag[1] === 'on');
  if (!LANDMARK_QUESTIONS_DEFAULT_ON && !optedIn) return false;
  return mode.freeRide ? mode.freeRideQuiz && freeRideLandmarkQuizEnabled(search) : true;
}

// ---- Sightings: noticed and named landmarks, per buurt ----

export const LANDMARK_SIGHTINGS_KEY = 'canalRecall.landmarkSightings.v1';

export type SightingHow = 'noticed' | 'named';

export interface Sighting {
  hood: string;
  how: SightingHow;
  at: number;
}

/** By landmark id. `named` outranks `noticed`; a later notice never demotes it. */
export type Sightings = Record<string, Sighting>;

interface StoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readSightings(store: StoreLike | null | undefined): Sightings {
  try {
    const raw = store?.getItem(LANDMARK_SIGHTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<Sighting>>;
    const out: Sightings = {};
    for (const [id, value] of Object.entries(parsed || {})) {
      if (!value || (value.how !== 'noticed' && value.how !== 'named')) continue;
      out[id] = { hood: String(value.hood || ''), how: value.how, at: Number(value.at) || 0 };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveSightings(store: StoreLike | null | undefined, sightings: Sightings): void {
  try { store?.setItem(LANDMARK_SIGHTINGS_KEY, JSON.stringify(sightings)); } catch { /* private mode */ }
}

/** Record one sighting. Pure; `isNew` is true the first time this landmark
 *  reaches this level (a first notice, or a first naming). */
export function noteSighting(sightings: Sightings, id: string, hood: string, how: SightingHow, at: number): { sightings: Sightings; isNew: boolean } {
  const existing = sightings[id];
  if (existing && (existing.how === 'named' || existing.how === how)) return { sightings, isNew: false };
  return { sightings: { ...sightings, [id]: { hood: hood || existing?.hood || '', how, at } }, isNew: true };
}

/** Landmarks noticed or named, overall or in one buurt: passport credit. */
export function sightingCredit(sightings: Sightings, hood?: string): number {
  return Object.values(sightings).filter(s => !hood || s.hood === hood).length;
}

export function hasBeenNamed(sightings: Sightings, id: string): boolean {
  return sightings[id]?.how === 'named';
}

// ---- Session counters (the plan's `__canalRecallSession`) ----

export type SessionCounter = 'landmarksAsked' | 'landmarksNamed' | 'landmarksNoticed';

/** Bump a local, never-sent counter on `window.__canalRecallSession`, which
 *  other lanes share: only this lane's keys are touched. */
export function bumpSessionCounter(target: { __canalRecallSession?: Record<string, unknown> } | null | undefined, key: SessionCounter): number {
  if (!target) return 0;
  const session = (target.__canalRecallSession ||= {});
  const next = (Number(session[key]) || 0) + 1;
  session[key] = next;
  return next;
}

/** "On the right · Museumkwartier": the side, then the buurt the plaque shows (R2-8). */
export function questionContext(side: string, buurt: string | null | undefined): string {
  return buurt ? `${side} · ${buurt}` : side;
}
