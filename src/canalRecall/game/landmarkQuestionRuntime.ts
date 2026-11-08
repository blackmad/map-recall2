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
  hasBeenNamed,
  landmarkWithheldNames,
  landmarkChoices,
  LANDMARK_QUESTION_RADIUS_M,
  landmarkQuestionsEnabled,
  mayAskLandmark,
  noteSighting,
  pickLandmarkQuestion,
  readSightings,
  SAME_COMPLEX_M,
  saveSightings,
  type QuestionLandmark,
  type Sightings,
} from './landmarkQuestion';
import { isWorthACard } from './landmarkData';
import { decideQuestion, EMPTY_BUDGET, recordAsk } from './questionBudget';
import { answerHoldMayHide } from './silentPass';
import { MANUAL_LANDMARKS } from '../landmarks/manualModels';
import { t } from '../../i18n/index.ts';
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
  _modelledLandmarkIds?: Set<string>;
  /** Tap target of the drive-by card's "Noticed" action. */
  _landmarkActionBounds?: { x: number; y: number; w: number; h: number } | null;
};

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
   * Per frame, from `_updateLandmarks` before the drive-by pick: open a
   * landmark question when a modelled landmark with a card is in view within
   * 150 m, the slot is free and the question budget has a slot. True when one
   * opened (the drive-by pick then stands down this frame).
   */
  _tryLandmarkQuestion(): boolean {
    if (!this.player || this.player.ferryOrigin) return false;
    if (!this._landmarkQuestionsOn()) return false;
    const gate = this._teachingGate();
    if (!mayAskLandmark({
      questionOpen: !!this.quizPromptName || !!this._silentPass,
      streetCandidate: !!this.quizCandidateName,
      feedbackVisible: !!this.quizFeedback || gate.promptVisible,
      utilityOpen: gate.utilityOpen,
    })) return false;
    const asked = (this._landmarkAsked ||= new Set());
    const sightings = this._landmarkSightings();
    const destination = this.routeTo?.landmarkId
      || (typeof this.routeTo?.id === 'string' && this.routeTo.id.startsWith('lm-') ? this.routeTo.id.slice(3) : '');
    const skip = new Set<string>(asked);
    if (destination) skip.add(destination);
    const radiusPx = LANDMARK_QUESTION_RADIUS_M * PIXELS_PER_METER;
    const candidates = this.landmarks.filter(landmark => !skip.has(landmark.id)
      && !this._seenLandmarks.has(landmark.id)
      && !hasBeenNamed(sightings, landmark.id)
      && Math.abs(landmark.x - this.player!.x) <= radiusPx && Math.abs(landmark.y - this.player!.y) <= radiusPx
      && isWorthACard(landmark) && this._landmarkIsModelled(landmark.id)
      // The destination card names the destination; a landmark sharing its
      // name would be answered by the HUD.
      && landmark.name !== this.routeTo?.name);
    const chosen = pickLandmarkQuestion(this.player, candidates, { radiusPx, skip });
    if (!chosen) return false;

    const budget = decideQuestion(this._questionBudget || EMPTY_BUDGET, { name: chosen.name, kind: 'new-unlearned' }, this.raceTime, {
      maxAsksPerMinute: this._askBudgetPerMinute(),
    });
    // Free Ride has no route budget of its own; it asks at the same pace.
    if (budget.action !== 'ask') return false;

    const withHood = (landmark: Landmark): QuestionLandmark => ({
      id: landmark.id, name: landmark.name, x: landmark.x, y: landmark.y,
      hood: this._neighborhoodAt(landmark.x, landmark.y)?.name ?? null,
    });
    const answer = withHood(chosen);
    const pool = this.landmarks
      .filter(landmark => isWorthACard(landmark) && Math.hypot(landmark.x - chosen.x, landmark.y - chosen.y) <= FILLER_MAX_M * PIXELS_PER_METER)
      .map(withHood);
    const choices = landmarkChoices(answer, pool, {
      sameComplexPx: SAME_COMPLEX_M * PIXELS_PER_METER, fillerMaxPx: FILLER_MAX_M * PIXELS_PER_METER, shuffle,
    });
    asked.add(chosen.id);
    if (!choices) return false;

    this._questionBudget = recordAsk(this._questionBudget || EMPTY_BUDGET, this.raceTime);
    this._landmarkQuestion = { id: chosen.id, name: chosen.name, hood: answer.hood || '' };
    // Every choice is withheld, not only the answer: a labelled distractor in
    // view would name the lit building by elimination.
    this.quizWithheldNames = landmarkWithheldNames(chosen.name, choices);
    // The card names the buurt and the side, never the building.
    const heading = this.player.speed < 0 ? this.player.angle + Math.PI : this.player.angle;
    const off = Math.atan2(chosen.y - this.player.y, chosen.x - this.player.x) - heading;
    const bearing = Math.atan2(Math.sin(off), Math.cos(off));
    // World y points down the screen, so a positive bearing is to the right.
    const side = Math.abs(bearing) < AHEAD_HALF_ANGLE ? t('ride.landmarkQuestion.ahead')
      : bearing < 0 ? t('ride.landmarkQuestion.left') : t('ride.landmarkQuestion.right');
    this._openQuizPrompt({
      kind: 'landmark', name: chosen.name, subject: 'landmark',
      question: t('ride.landmarkQuestion.heading'),
      context: answer.hood ? `${side} · ${answer.hood}` : side,
      choices,
    });
    this._dressLandmarkPrompt();
    // The building under question is lit, unnamed, so "this" has a referent.
    this.vectorMap?.setActiveLandmark(chosen);
    bumpSessionCounter(window as unknown as { __canalRecallSession?: Record<string, unknown> }, 'landmarksAsked');
    return true;
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
