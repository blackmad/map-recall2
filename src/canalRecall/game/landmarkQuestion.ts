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

/** Metres: how close a landmark must be to be asked about. */
export const LANDMARK_QUESTION_RADIUS_M = 150;
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

/** OFF by default since 2026-11-09 (hotfix, #281): the ride review found the question asking about
 *  a building whose label had just been on screen (the Brakke Grond), and "never revealed before the
 *  answer" is the one hard rule. `?landmarkQuestions=1` opts in (the specs do); L1 (#281) turns the
 *  default back on once a candidate's label is withheld during the approach. With the flag on, Free
 *  Ride asks only when the rider switched "Quiz me on landmarks" on. */
export const LANDMARK_QUESTIONS_DEFAULT_ON = false;
export function landmarkQuestionsEnabled(search: string, mode: { freeRide: boolean; freeRideQuiz: boolean }): boolean {
  const flag = /[?&]landmarkQuestions=([^&]*)/.exec(search || '');
  if (flag && (flag[1] === '0' || flag[1] === 'false' || flag[1] === 'off')) return false;
  if (!LANDMARK_QUESTIONS_DEFAULT_ON && !(flag && (flag[1] === '1' || flag[1] === 'true' || flag[1] === 'on'))) return false;
  return mode.freeRide ? mode.freeRideQuiz : true;
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
