// Landmarks you can name (G3, #273): the browser half of landmarkQuestion.ts.
//
// Mixed onto `GameLandmarkRuntime` by `installLandmarkQuestion` (one module per
// runtime file, scripts/check-game-decomposition.mjs), so `this` is the Game.
//
// The question reuses the street question's card, choices, keys, scoring and
// answer hold. While it is open `quizPromptName` is the landmark's name, which
// is what every label surface already withholds (labelPolicy, labelOverlay,
// own-engine labels); the drive-by card, building clicks and the expanded
// panel are closed by the open prompt, and Free Ride markers skip it here.

import {
  bumpSessionCounter,
  FILLER_MAX_M,
  inViewCone,
  landmarkWithheldNames,
  landmarkChoices,
  LANDMARK_QUESTION_RADIUS_M,
  landmarkQuestionsEnabled,
  mayAskLandmark,
  questionContext,
  noteSighting,
  readSightings,
  SAME_COMPLEX_M,
  saveSightings,
  type QuestionLandmark,
  type Sightings,
} from './landmarkQuestion';
import { isWorthACard } from './landmarkData';
import { isBuildingLandmark } from './landmarkKind';
import { pickAskable, readLandmarkReviews, recordLandmarkOutcome, reviewKind, seedFromSightings, type LandmarkReviews } from './landmarkReview';
import { approachKept, bumpSkipCounter, LANDMARK_APPROACH_RADIUS_M, landmarkSkipReason, sharedLedger } from './labelDrawLedger';
import { decideQuestion, EMPTY_BUDGET, recordAsk } from './questionBudget';
import { answerHoldMayHide } from './silentPass';
import { MANUAL_LANDMARKS } from '../landmarks/manualModels';
import { language, t } from '../../i18n/index.ts';
import { landmarkDisplayName } from './landmarkNamesNl.ts';
import type { LandmarkHost, RecallHost } from './host';
import type { Landmark } from './worldTypes';

/** Radians either side of the heading that read as "Ahead" rather than a side. */
const AHEAD_HALF_ANGLE = (15 * Math.PI) / 180;

/** A small building with a pediment, in the chip's stroke style. */
const LANDMARK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10 12 4l9 6"/><path d="M5 10v9M19 10v9M9.5 19v-5h5v5M3 20h18"/></svg>';

type QuestionHost = LandmarkHost & Pick<RecallHost,
  | 'quizPromptKind' | 'quizCandidateName' | 'quizAttempts' | 'quizCorrect' | 'quizPoints' | 'quizStreak' | 'quizBestStreak'
  | 'routeDifficulty' | 'gameyFeatures' | 'routeTo' | '_promptKind' | '_promptKindLabel' | '_promptFeedback'
  | '_answerHoldToken' | '_overlay' | '_questionBudget' | 'maxAsksPerMinute'
> & {
  _silentPass?: unknown;
  _answerReveal?: unknown;
  _promptInput?: HTMLInputElement;
  _openQuizPrompt(options: {
    kind: 'landmark'; name: string; subject: 'landmark'; question: string; context: string; choices: string[] | null;
  }): void;
  _markAnsweredChoices(correctName: string, answer: string | null, correct: boolean): void;
  _askBudgetPerMinute(): number | undefined;
  _revealName(name: string): void;
  _reclaimKeyboardFocus?(): void;
  _showLandmarkNotice(notice: Landmark, hold: { kind: 'sticky' }, source: 'drive-by'): void;
  _neighborhoodAt(x: number, y: number): { name: string } | null;
  /** The landmark under question, while its question is open or held. */
  _landmarkQuestion?: { id: string; name: string; hood: string } | null;
  /** Landmarks asked this ride: one ask each. */
  _landmarkAsked?: Set<string>;
  _landmarkSightingsCache?: Sightings;
  /** Per-landmark review schedule (landmarkReview.ts), persisted across rides. */
  _landmarkReviewsCache?: LandmarkReviews;
  _modelledLandmarkIds?: Set<string>;
  /** The landmark being approached, its choices dealt and withheld (#281). */
  _landmarkApproach?: LandmarkApproach | null;
  landmarkApproachWithheld?: string[];
  /** `id:reason` of candidates already counted as skipped this ride. */
  _landmarkSkipsSeen?: Set<string>;
  /** Tap target of the drive-by card's "Noticed" action. */
  _landmarkActionBounds?: { x: number; y: number; w: number; h: number } | null;
};

/** A candidate landmark while the rider approaches it (#281). */
export interface LandmarkApproach {
  landmark: Landmark; choices: string[]; hood: string; since: number;
  /** What it is to the question budget: a due review or never asked (#300). */
  kind: 'due-review' | 'new-unlearned';
}

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

function search(): string {
  try { return typeof location === 'undefined' ? '' : location.search || ''; } catch { return ''; }
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export interface GameLandmarkQuestionRuntime extends QuestionHost {}

export class GameLandmarkQuestionRuntime {
  /** Whether this ride asks landmark questions (flag, Free Ride opt-in). */
  _landmarkQuestionsOn(): boolean {
    const prefs = (this._overlay ?? window.CanalRecallOverlay?.getOverlay?.())?.store.getState().prefs as { landmarkQuiz?: boolean } | undefined;
    return landmarkQuestionsEnabled(search(), { freeRide: !!this.freeRide, freeRideQuiz: !!prefs?.landmarkQuiz });
  }

  _landmarkSightings(): Sightings {
    return (this._landmarkSightingsCache ??= readSightings(storage()));
  }

  /** The review schedule, with landmarks named before it existed seeded on the first rung (#300). */
  _landmarkReviews(): LandmarkReviews {
    return (this._landmarkReviewsCache ??= seedFromSightings(readLandmarkReviews(storage()), this._landmarkSightings()));
  }

  _noteLandmarkSighting(landmark: { id: string; x: number; y: number }, how: 'noticed' | 'named'): boolean {
    const hood = this._neighborhoodAt(landmark.x, landmark.y)?.name || this.currentNeighborhood || '';
    const step = noteSighting(this._landmarkSightings(), landmark.id, hood, how, Date.now());
    if (!step.isNew) return false;
    this._landmarkSightingsCache = step.sightings;
    saveSightings(storage(), step.sightings);
    return true;
  }

  /** Landmark ids with a hand-built model (the manual catalogue). */
  _landmarkIsModelled(id: string): boolean {
    if (!this._modelledLandmarkIds) {
      this._modelledLandmarkIds = new Set();
      for (const spec of MANUAL_LANDMARKS) {
        const landmarkId = (spec as { landmarkId?: string }).landmarkId;
        if (landmarkId) this._modelledLandmarkIds.add(landmarkId);
      }
    }
    return this._modelledLandmarkIds.has(id);
  }

  /**
   * Per frame, from `_updateLandmarks` before the drive-by pick. Two steps (#281):
   *
   * 1. The candidate. A modelled landmark with a card, in view inside the
   *    approach band (LANDMARK_APPROACH_RADIUS_M), whose name no label layer has
   *    drawn in the last 30 s and whose drive-by card has not shown in the last
   *    60 s (labelDrawLedger.ts), becomes the candidate: its four choices are
   *    dealt now and every one of them is withheld from the map
   *    (`landmarkApproachWithheld`), so the labels leave at the label budget's
   *    own fade before the question can open. Kept, with hysteresis, while the
   *    rider still approaches it; released (the labels fade back) when not.
   * 2. The question. Within 150 m and the cone, the slot free and the budget
   *    with a slot: the question opens with the dealt choices. True when one
   *    opened (the drive-by pick then stands down this frame).
   */
  _tryLandmarkQuestion(): boolean {
    if (!this.player || this.player.ferryOrigin || !this._landmarkQuestionsOn()) { this._releaseLandmarkApproach(); return false; }
    const player = this.player;
    const approach = this._landmarkApproachCandidate();
    if (!approach) return false;
    const gate = this._teachingGate();
    if (!mayAskLandmark({
      questionOpen: !!this.quizPromptName || !!this._silentPass,
      streetCandidate: !!this.quizCandidateName,
      feedbackVisible: !!this.quizFeedback || gate.promptVisible,
      utilityOpen: gate.utilityOpen,
    })) return false;
    const chosen = approach.landmark;
    if (!inViewCone(player, chosen, LANDMARK_QUESTION_RADIUS_M * PIXELS_PER_METER)) return false;

    const budget = decideQuestion(this._questionBudget || EMPTY_BUDGET, { name: chosen.name, kind: approach.kind }, this.raceTime, {
      maxAsksPerMinute: this._askBudgetPerMinute(),
    });
    // Free Ride has no route budget of its own; it asks at the same pace.
    if (budget.action !== 'ask') return false;

    (this._landmarkAsked ||= new Set()).add(chosen.id);
    this._questionBudget = recordAsk(this._questionBudget || EMPTY_BUDGET, this.raceTime);
    this._landmarkQuestion = { id: chosen.id, name: chosen.name, hood: approach.hood };
    // Every choice is withheld, not only the answer: a labelled distractor in
    // view would name the lit building by elimination. The approach already
    // withheld the same names, so nothing on the map changes as it opens.
    // Choices read in the UI language where the catalogue has a Dutch name
    // (#283); the map may label either, so both spellings are withheld.
    const lang = language();
    const shownChoices = approach.choices.map(name => landmarkDisplayName(name, lang));
    this.quizWithheldNames = landmarkWithheldNames(chosen.name, [...approach.choices, ...shownChoices, landmarkDisplayName(chosen.name, lang)]);
    this._landmarkApproach = null;
    this.landmarkApproachWithheld = [];
    // The card names the buurt and the side, never the building.
    const heading = player.speed < 0 ? player.angle + Math.PI : player.angle;
    const off = Math.atan2(chosen.y - player.y, chosen.x - player.x) - heading;
    const bearing = Math.atan2(Math.sin(off), Math.cos(off));
    // World y points down the screen, so a positive bearing is to the right.
    const side = Math.abs(bearing) < AHEAD_HALF_ANGLE ? t('ride.landmarkQuestion.ahead')
      : bearing < 0 ? t('ride.landmarkQuestion.left') : t('ride.landmarkQuestion.right');
    this._openQuizPrompt({
      kind: 'landmark', name: landmarkDisplayName(chosen.name, lang), subject: 'landmark',
      question: t('ride.landmarkQuestion.heading'),
      // The plaque's buurt (placeBuurt.ts, L5), so the card and the plaque name one buurt (R2-8).
      context: questionContext(side, this.currentNeighborhood || approach.hood),
      choices: shownChoices,
    });
    this._dressLandmarkPrompt();
    // The building under question is lit, unnamed, so "this" has a referent.
    this.vectorMap?.setActiveLandmark(chosen);
    bumpSessionCounter(window as unknown as { __canalRecallSession?: Record<string, unknown> }, 'landmarksAsked');
    return true;
  }

  /** Drop the approached candidate; its labels fade back in (#281). */
  _releaseLandmarkApproach(): void {
    if (!this._landmarkApproach && !this.landmarkApproachWithheld?.length) return;
    this._landmarkApproach = null;
    this.landmarkApproachWithheld = [];
  }

  /** The landmark being approached (step 1 of `_tryLandmarkQuestion`): kept
   *  while still approached, else the nearest eligible one in the band. */
  _landmarkApproachCandidate(): LandmarkApproach | null {
    const player = this.player!;
    const bandPx = LANDMARK_APPROACH_RADIUS_M * PIXELS_PER_METER;
    const held = this._landmarkApproach;
    if (held) {
      const live = this.landmarks.find(landmark => landmark.id === held.landmark.id);
      if (live && !this._seenLandmarks.has(live.id) && approachKept(player, live, bandPx)) return held;
      this._releaseLandmarkApproach();
    }
    const asked = (this._landmarkAsked ||= new Set());
    const reviews = this._landmarkReviews();
    const wallNow = Date.now();
    const destination = this.routeTo?.landmarkId
      || (typeof this.routeTo?.id === 'string' && this.routeTo.id.startsWith('lm-') ? this.routeTo.id.slice(3) : '');
    const skip = new Set<string>(asked);
    if (destination) skip.add(destination);
    const ledger = sharedLedger(window as never);
    const now = performance.now();
    const session = window as unknown as { __canalRecallSession?: Record<string, unknown> };
    const skipped = (this._landmarkSkipsSeen ||= new Set());
    const candidates = this.landmarks.filter(landmark => {
      // Asked this ride, or named and not yet due again (#300).
      if (skip.has(landmark.id) || this._seenLandmarks.has(landmark.id) || reviewKind(reviews[landmark.id], wallNow) === 'known') return false;
      if (Math.abs(landmark.x - player.x) > bandPx || Math.abs(landmark.y - player.y) > bandPx) return false;
      // "Which building is this?": statues and memorials keep their drive-by card (R2-7).
      if (!isWorthACard(landmark) || !isBuildingLandmark(landmark) || !this._landmarkIsModelled(landmark.id)) return false;
      // The destination card names the destination; a landmark sharing its
      // name would be answered by the HUD.
      if (landmark.name === this.routeTo?.name) return false;
      if (!inViewCone(player, landmark, bandPx)) return false;
      // The map named it moments ago, or a card did: asking now tests the
      // last few seconds, not the city (#281).
      // The map labels it in the interface's language (#307): either spelling counts.
      const shown = landmarkDisplayName(landmark.name, language());
      const reason = landmarkSkipReason(ledger, landmark.name, now)
        ?? (shown !== landmark.name ? landmarkSkipReason(ledger, shown, now) : null);
      if (reason) { bumpSkipCounter(session, skipped, landmark.id, reason); return false; }
      return true;
    });
    // Due reviews before never-asked landmarks, nearest first within each (#300).
    const pick = pickAskable(
      candidates.map(landmark => ({ id: landmark.id, landmark, distance: Math.hypot(landmark.x - player.x, landmark.y - player.y) })),
      reviews, wallNow,
    );
    if (!pick) return null;
    const chosen = pick.candidate.landmark;
    const withHood = (landmark: Landmark): QuestionLandmark => ({
      id: landmark.id, name: landmark.name, x: landmark.x, y: landmark.y,
      hood: this._neighborhoodAt(landmark.x, landmark.y)?.name ?? null,
    });
    const answer = withHood(chosen);
    const pool = this.landmarks
      .filter(landmark => isWorthACard(landmark) && isBuildingLandmark(landmark) && Math.hypot(landmark.x - chosen.x, landmark.y - chosen.y) <= FILLER_MAX_M * PIXELS_PER_METER)
      .map(withHood);
    const choices = landmarkChoices(answer, pool, {
      sameComplexPx: SAME_COMPLEX_M * PIXELS_PER_METER, fillerMaxPx: FILLER_MAX_M * PIXELS_PER_METER, shuffle,
    });
    // Too few honest distractors: never a question about this one.
    if (!choices) { asked.add(chosen.id); return null; }
    this._landmarkApproach = { landmark: chosen, choices, hood: answer.hood || '', since: now, kind: pick.kind };
    // Both spellings are withheld where the catalogue has a Dutch name (#283): the map may label either.
    const approachLang = language();
    this.landmarkApproachWithheld = landmarkWithheldNames(chosen.name, [...choices, ...choices.map(name => landmarkDisplayName(name, approachLang)), landmarkDisplayName(chosen.name, approachLang)]);
    return this._landmarkApproach;
  }

  /** The chip reads "Landmark" with a building icon (the legacy chip table
   *  has no landmark row; the Storybook state calls this too). */
  _dressLandmarkPrompt(): void {
    this._promptKind.dataset.kind = 'landmark';
    const icon = this._promptKind.firstElementChild as HTMLElement | null;
    if (icon) icon.innerHTML = LANDMARK_ICON;
  }

  /** `_submitCanalAnswer` hands a landmark question here: scored like a
   *  street, filed as a stamp instead of a street recall row. */
  _submitLandmarkAnswer(selectedAnswer: string | null, noIdea = false): void {
    const asked = this._landmarkQuestion;
    if (!asked || !this.quizPromptName || !this.player) return;
    const correctName = this.quizPromptName;
    const answer = selectedAnswer == null ? (this._promptInput?.value ?? '') : selectedAnswer;
    const result = CanalRecallAnswerPath.submitAnswer({
      correctName,
      displayName: correctName,
      say: t,
      answer,
      noIdea,
      score: {
        attempts: this.quizAttempts, correct: this.quizCorrect, points: this.quizPoints,
        streak: this.quizStreak, bestStreak: this.quizBestStreak,
      },
      difficultyMultiplier: DIFFICULTY_SCORE_MULTIPLIERS[this.routeDifficulty] || 0.85,
      noveltyMultiplier: 1.15,
      gameyFeatures: this.gameyFeatures,
      recallFeature: null,
      recallStore: null,
      revealName: (name: string) => this._revealName(name),
    });
    const correct = result.wasCorrect;
    window.CanalRecallAnalytics?.answer(this, correct, noIdea);
    this.quizAttempts = result.attempts;
    this.quizCorrect = result.correct;
    this.quizPoints = result.points;
    this.quizStreak = result.streak;
    this.quizBestStreak = result.bestStreak;
    this.quizFeedback = result.feedback;
    this._promptFeedback.textContent = result.feedback;
    this._promptFeedback.style.color = result.feedbackColor;
    this._markAnsweredChoices(correctName, answer, correct);

    const landmark = this.landmarks.find(item => item.id === asked.id) || null;
    // The schedule: named right climbs 1, 3, 7, 21 days; a miss comes back next ride (#300).
    this._landmarkReviewsCache = recordLandmarkOutcome(storage(), this._landmarkReviews(), asked.id,
      correct ? 'right' : noIdea ? 'no-idea' : 'wrong', Date.now());
    if (correct && landmark) {
      // The passport's `named` stamp: defined in poiCollection.ts, never fired before.
      (window as unknown as { CanalCollection?: { record(event: { id: string; name: string; how: 'named' }): unknown } })
        .CanalCollection?.record({ id: landmark.id, name: landmark.name, how: 'named' });
      this._noteLandmarkSighting(landmark, 'named');
      bumpSessionCounter(window as unknown as { __canalRecallSession?: Record<string, unknown> }, 'landmarksNamed');
    }
    if (landmark) {
      this._seenLandmarks.add(landmark.id);
      this._seenLandmarkNames.add(landmark.name);
    }
    this.quizPromptKind = 'route';
    this.quizPromptName = '';
    this.quizPromptSubject = '';
    this._landmarkQuestion = null;
    this.quizWithheldNames = [];
    this.vectorMap?.setActiveLandmark(null);
    const holdToken = this._answerHoldToken = (this._answerHoldToken || 0) + 1;
    setTimeout(() => {
      if (!answerHoldMayHide(holdToken === this._answerHoldToken, !!this.quizPromptName, !!this._silentPass)) return;
      this._prompt.style.display = 'none';
      document.getElementById('canal-card')?.classList.remove('answered');
      this.quizFeedback = '';
      if (typeof this._reclaimKeyboardFocus === 'function') this._reclaimKeyboardFocus();
      else this.canvas.focus();
      // Named now, so its card can say what it is.
      if (landmark) {
        this._showLandmarkNotice(landmark, { kind: 'sticky' }, 'drive-by');
        this.vectorMap?.setActiveLandmark(landmark);
      }
    }, correct ? ANSWER_HOLD_CORRECT : ANSWER_HOLD_WRONG);
  }

  /** The drive-by card's "Noticed": the landmark counts toward its buurt's
   *  passport (neighborhoodPassport.ts credit). */
  _noticeLandmark(): boolean {
    const notice = this._landmarkNotice;
    if (!notice) return false;
    const landmark = this.landmarks.find(item => item.id === notice.id);
    if (!landmark) return false;
    const fresh = this._noteLandmarkSighting(landmark, 'noticed');
    if (fresh) bumpSessionCounter(window as unknown as { __canalRecallSession?: Record<string, unknown> }, 'landmarksNoticed');
    return fresh;
  }

  /** Whether the open card offers "Noticed": a drive-by card for a real
   *  landmark, and "Noted" once it has been tapped. */
  _landmarkCardAction(): { label: string; done: boolean } | null {
    const notice = this._landmarkNotice;
    if (!notice || this._landmarkNoticeSource !== 'drive-by') return null;
    if (!this.landmarks.some(item => item.id === notice.id)) return null;
    // `?landmarkQuestions=0` is today's drive-by card, untouched.
    if (/[?&]landmarkQuestions=(0|false|off)(&|$)/.test(search())) return null;
    const done = !!this._landmarkSightings()[notice.id];
    return { label: done ? t('ride.landmarkNoticed.done') : t('ride.landmarkNoticed.action'), done };
  }
}

/** Mix the question onto a runtime class (landmarkRuntime.ts). */
export function installLandmarkQuestion(target: { prototype: object }): void {
  for (const name of Object.getOwnPropertyNames(GameLandmarkQuestionRuntime.prototype)) {
    if (name === 'constructor') continue;
    Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(GameLandmarkQuestionRuntime.prototype, name)!);
  }
}
