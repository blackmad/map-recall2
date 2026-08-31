// Recall questions: the prompt card, the spaced-repetition store, and the
// bridge/street crossings that trigger a question.
//
// The browser-facing half. Every rule about *what* to ask, *where* it is filed
// and *when* a name has settled lives in `recallRules.ts`, tested without a
// DOM. Adding a rule here rather than there makes it unreachable by tests.
//
// Methods are copied onto `Game.prototype` by `game.js`, so `this` is the Game
// instance. The interface merged into the class below is what types it.

import {
  advanceRouteQuiz,
  bridgeGate,
  crossingQuestionKind,
  findCrossedBridge,
  headingOffRoad,
  isPlaceKnown,
  pickDistractors,
  toLatLon,
  toWorld,
  type LatLon,
  type WorldOrigin,
} from './recallRules';
import type { PendingCrossing, RecallFeature, RecallHost } from './host';
import { isCar, type QuizPromptKind, type QuizSubject } from './modes';
import type { Bridge, BridgeCrossing, WorldPoint } from './worldTypes';

/** How many wrong answers a multiple-choice question offers. */
const DISTRACTOR_COUNT = 3;
/** px — how far from the vehicle a nearby name may be and still be offered as
 *  a plausible wrong answer. */
const CHOICE_POOL_RADIUS = 1500;

function shuffle<T>(items: T[]): T[] {
  return items.sort(() => Math.random() - 0.5);
}

export interface GameRecallRuntime extends RecallHost {}

export class GameRecallRuntime {
  // ---- Store and account row ----

  _setupRecallStore(): void {
    this.recall = window.CanalRecallStoreModule ? window.CanalRecallStoreModule.store : null;
    const row = document.getElementById('account-row');
    const label = document.getElementById('account-label');
    const note = document.getElementById('account-note');
    const button = document.getElementById('account-button') as HTMLButtonElement | null;
    this._skipMastered = document.getElementById('skip-mastered') as HTMLInputElement;
    if (!this.recall || !row || !label || !note || !button) return;
    const recall = this.recall;
    this._skipMastered.addEventListener('change', () => {
      recall.enabled = this._skipMastered.checked;
      this._refreshMasteredLabels();
      this._savePreferences();
    });
    recall.onUserChange((user) => {
      row.style.display = 'flex';
      if (user) {
        label.textContent = user.label;
        // One name can be several answers now: a long street is learned a
        // stretch at a time, and each stretch is scheduled on its own.
        note.textContent = `${recall.masteredCount} answers synced`;
        button.textContent = 'Sign out';
      } else {
        label.textContent = 'Playing as guest';
        note.textContent = 'Sign in to remember which streets you already know across devices.';
        button.textContent = 'Sign in';
      }
    });
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        if (recall.signedIn) await recall.signOut();
        else await recall.signIn();
      } catch (error) {
        this._routeError.textContent = (error as Error).message || 'Could not sign in.';
      } finally {
        button.disabled = false;
      }
    });
    recall.init().then(() => {
      if (recall.available) row.style.display = 'flex';
      this._refreshMasteredLabels();
    });
  }

  // ---- Route-relative coordinates ----

  /** `null` until a road network has been loaded, because there is no
   *  projection origin to convert against yet. */
  _worldOrigin(): WorldOrigin | null {
    const loader = this.osmLoader;
    if (!loader || loader._lastCenterLat === undefined || loader._lastCenterLng === undefined) return null;
    return {
      centerLat: loader._lastCenterLat,
      centerLng: loader._lastCenterLng,
      offsetX: loader._lastOffsetX,
      offsetY: loader._lastOffsetY,
      pixelsPerMeter: PIXELS_PER_METER,
    };
  }

  _toLatLon(x: number, y: number): LatLon | null {
    const origin = this._worldOrigin();
    return origin ? toLatLon(origin, x, y) : null;
  }

  _toWorld(lat: number, lon: number): WorldPoint | null {
    const origin = this._worldOrigin();
    return origin ? toWorld(origin, lat, lon) : null;
  }

  // ---- Recall identity ----

  _recallFeatureAt(name: string, x: number, y: number, type = ''): RecallFeature | null {
    if (!name) return null;
    const center = this._toLatLon(x, y);
    if (!center) return null;
    const meta = this.osmLoader && this.osmLoader.featureMeta && this.osmLoader.featureMeta.get(name);
    return {
      name,
      type: type || (meta && meta.type) || (isCar(this.travelMode) ? 'street' : 'canal'),
      cityId: (meta && meta.cityId) || 'amsterdam',
      center,
    };
  }

  _revealName(name: string): void {
    if (!name) return;
    this.revealedNames.add(name);
    this._mapLabelNames.add(name);
  }

  /**
   * Seed the map labels with everywhere the store already considers known, so
   * a learned street is named from the first frame rather than only after the
   * player happens to drive onto it. Places, not names: labelling the whole of
   * a long street because one junction was answered would hand the player the
   * answer to the far end before it was ever asked.
   */
  _refreshMasteredLabels(): void {
    this._mapLabelNames = new Set(this.revealedNames);
    this._knownPlaces = new Map();
    if (!this.recall || !this.recall.enabled) return;
    for (const place of this.recall.knownPlaces()) {
      this._rememberKnownPlace(place.name, place.center);
    }
  }

  _rememberKnownPlace(name: string, center: LatLon | null | undefined): void {
    const point = center && this._toWorld(center[0], center[1]);
    if (!point) return;
    const points = this._knownPlaces.get(name);
    if (points) points.push(point); else this._knownPlaces.set(name, [point]);
  }

  /** Is this label close enough to somewhere the player has proved they know it? */
  _isPlaceKnown(name: string, x: number, y: number): boolean {
    if (!window.CanalRecallStoreModule) return false;
    const radius = window.CanalRecallStoreModule.RECALL_LOCAL_RADIUS_METERS * PIXELS_PER_METER;
    return isPlaceKnown(this._knownPlaces.get(name), x, y, radius);
  }

  /** True when this name was answered near the player recently enough that
   *  asking it again here would be noise — a wrong answer included, which the
   *  scheduler parks briefly so a correction is not instantly re-tested. */
  _isRecallSuppressedHere(name: string): boolean {
    if (!this.recall || !this.recall.enabled || !this.player) return false;
    const feature = this._recallFeatureAt(name, this.player.x, this.player.y);
    return !!feature && this.recall.isSuppressedHere(feature);
  }

  // ---- Bridge labels ----

  _bridgeGate(a: WorldPoint, b: WorldPoint): [WorldPoint, WorldPoint] {
    return bridgeGate(a, b, BRIDGE_GATE_HALF_WIDTH);
  }

  /**
   * A bridge named correctly keeps its label, the same way a learned waterway
   * does. It is map annotation, not HUD: drawn under the vehicle, kept faint,
   * and suppressed entirely near the vehicle, because a label sitting on top
   * of the boat hides the one thing the player is steering.
   */
  _renderBridgeLabels(): void {
    if (!this._learnedBridges || this._learnedBridges.size === 0 || !this.player) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (const bridge of this._learnedBridges.values()) {
      const point = bridge.labelPoint;
      if (!point) continue;
      const range = Math.hypot(point.x - this.player.x, point.y - this.player.y);
      if (range > BRIDGE_LABEL_RANGE) continue;
      const screen = this.camera.worldToScreen(point.x, point.y);
      if (screen.x < 0 || screen.x > CANVAS_W || screen.y < 0 || screen.y > CANVAS_H) continue;
      // Fade in with distance from the vehicle: invisible where it would
      // overlap the boat or car, settled at a background weight beyond that.
      const clearance = Math.max(0, Math.min(1,
        (range - BRIDGE_LABEL_CLEARANCE) / BRIDGE_LABEL_CLEARANCE));
      if (clearance <= 0) continue;
      ctx.globalAlpha = 0.55 * clearance;
      const width = ctx.measureText(bridge.name).width + 12;
      ctx.fillStyle = 'rgba(3,18,28,0.55)';
      roundRect(ctx, screen.x - width / 2, screen.y - 24, width, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#E7D5A3';
      ctx.fillText(bridge.name, screen.x, screen.y - 12);
    }
    ctx.restore();
  }

  // ---- The route question ----

  _updateCanalQuiz(dt: number): void {
    if (!this.player) return;
    const name = this.track.getRoadName(this.player.x, this.player.y);
    // Only worth a spatial query once there is a name that could become a
    // question; on most frames there is not.
    const interesting = !!name && name !== this.quizCurrentName;
    const nearestRoad = interesting ? this.track.getNearestRoad(this.player.x, this.player.y) : null;
    const decision = advanceRouteQuiz({
      candidateName: this.quizCandidateName,
      candidateSeconds: this.quizCandidateTimer,
    }, {
      roadName: name,
      currentName: this.quizCurrentName,
      headingOffRoad: nearestRoad ? headingOffRoad(this.player.angle, nearestRoad.angle) : null,
      speed: this.player.speed,
      alreadyRevealed: this.revealedNames.has(name),
      settleSeconds: QUIZ_CANDIDATE_DELAY,
      retestSeconds: QUIZ_RETEST_DELAY,
    }, dt, interesting && this._isRecallSuppressedHere(name));

    this.quizCandidateName = decision.state.candidateName;
    this.quizCandidateTimer = decision.state.candidateSeconds;
    if (decision.action === 'idle') return;

    if (decision.action === 'adopt') {
      // A name the player has already proved they know is adopted silently
      // instead of being asked again until it falls due.
      this.quizCurrentName = decision.name;
      this.learnedNames.add(decision.name);
      this._revealName(decision.name);
      return;
    }

    const quizRoad = this.track.getNearestRoad(this.player.x, this.player.y);
    this._openQuizPrompt({
      kind: 'route',
      name: decision.name,
      subject: isCar(this.travelMode) ? 'street' : 'waterway',
      question: isCar(this.travelMode) ? 'Which street are you on now?' : 'Which waterway are you on now?',
      context: 'You made a turn',
      segmentIndex: quizRoad ? quizRoad.segIdx : -1,
      pointIndex: quizRoad ? quizRoad.ptIdx : 0,
    });
  }

  /**
   * Shared prompt plumbing for every kind of recall question.
   *
   * `subject` is what the answer *is* — a street, a bridge, or the water under
   * one. It is the chip at the top of the card, because "Crossing a bridge" as
   * the headline above "Which water are you crossing?" read as a question
   * about the bridge. The question is the headline now and the situation is
   * the caption under it.
   */
  _openQuizPrompt({ kind, name, subject, question, context, choices = null, segmentIndex = -1, pointIndex = 0 }: {
    kind: QuizPromptKind;
    name: string;
    subject: QuizSubject;
    question: string;
    context: string;
    choices?: string[] | null;
    segmentIndex?: number;
    pointIndex?: number;
  }): void {
    if (!this.player) return;
    this._pendingCrossing = null;
    this.quizPromptKind = kind;
    this.quizPromptName = name;
    this.quizPromptSegmentIndex = segmentIndex;
    this.quizPromptPointIndex = pointIndex;
    this.player.speed = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    const chip = QUIZ_SUBJECTS[subject] || QUIZ_SUBJECTS.water;
    this._promptKind.dataset.kind = chip.kind;
    (this._promptKind.firstElementChild as HTMLElement).innerHTML = chip.icon;
    this._promptKindLabel.textContent = chip.label;
    this._promptHeading.textContent = question;
    this._promptQuestion.textContent = context;
    this._promptInput.setAttribute('aria-label', `${chip.label} name`);
    this._promptInput.placeholder = chip.placeholder;
    this._prompt.style.display = 'flex';
    const playerScreen = this.camera.worldToScreen(this.player.x, this.player.y);
    this._prompt.classList.toggle('dock-left', playerScreen.x > CANVAS_W / 2);
    this._promptInput.value = '';
    this._promptFeedback.textContent = '';
    const submit = document.getElementById('canal-submit');
    if (this.routeOptions.answerMode === 'multiple') {
      this._promptInput.style.display = 'none';
      if (submit) submit.style.display = 'none';
      this._promptChoices.style.display = 'grid';
      this._renderCanalChoices(name, choices);
    } else {
      this._promptChoices.style.display = 'none';
      this._promptInput.style.display = 'block';
      if (submit) submit.style.display = 'block';
      requestAnimationFrame(() => this._promptInput.focus());
    }
  }

  // ---- The crossing question ----

  /**
   * Ask about the crossing the player just made — the water first, then the
   * bridge over it. Both travel modes are the same test: the hull or chassis
   * crosses the bridge's mapped centreline.
   */
  _updateBridgeQuiz(previousPosition: WorldPoint | null): void {
    if (this.quizPromptName || !this.bridges.length || !previousPosition || !this.player) return;
    if (Math.abs(this.player.speed) < 5) return;
    // Bridge questions are rationed. Crossing five bridges in a minute along a
    // canal ring produced five prompts, each one stopping the vehicle dead,
    // which is neither good teaching nor good driving.
    if (this.raceTime - this._lastBridgeQuizAt < BRIDGE_QUIZ_COOLDOWN) return;
    const movedBy = Math.hypot(this.player.x - previousPosition.x, this.player.y - previousPosition.y);
    if (movedBy <= 0) return;

    const byBoat = !isCar(this.travelMode);
    const closest = findCrossedBridge(
      this.bridges, previousPosition, this.player, byBoat, BRIDGE_GATE_HALF_WIDTH);
    if (!closest) return;

    // Which of this bridge's crossings was it? "IJburglaan" is 66 mapped ways
    // making five separate bridges kilometres apart, and being asked for it
    // once taught one of them.
    const crossing = CanalRecallBridges.nearestCrossing(
      closest.crossings, this.player.x, this.player.y, CROSSING_MATCH_RANGE) as BridgeCrossing | null;
    if (!crossing) return;
    const key = `${closest.id}#${crossing.index}`;

    const water: RecallFeature | null = crossing.waterway ? {
      name: crossing.waterway,
      type: crossing.waterwayType || 'canal',
      cityId: 'amsterdam',
      center: crossing.center as LatLon,
    } : null;
    const bridgeFeature: RecallFeature = {
      name: closest.name, type: 'bridge', cityId: 'amsterdam', center: crossing.center as LatLon,
    };

    const kind = crossingQuestionKind({
      bridgeName: closest.name,
      hasWater: !!water,
      alreadyAsked: this._quizzedCrossings.get(key),
      byBoat,
      waterKnownHere: !!water && !!this.recall && this.recall.isKnownHere(water),
      waterSuppressedHere: !!water && !!this.recall && this.recall.isSuppressedHere(water),
      bridgeSuppressedHere: !!this.recall && this.recall.isSuppressedHere(bridgeFeature),
      currentRoadName: this.track.getRoadName(this.player.x, this.player.y),
      quizCurrentName: this.quizCurrentName,
    });
    if (!kind) return;

    this._quizzedCrossings.set(key, kind);
    this._lastBridgeQuizAt = this.raceTime;
    const labelled = crossing as BridgeCrossing & { labelPoint?: WorldPoint };
    labelled.labelPoint = { x: this.player.x, y: this.player.y };

    const answer = kind === 'water' && water ? water.name : closest.name;
    const pool = kind === 'water' ? crossing.waterDistractors : closest.distractors;
    const alternatives = pickDistractors(pool, answer, DISTRACTOR_COUNT, shuffle);
    this._openQuizPrompt({
      kind: kind === 'water' ? 'crossing-water' : 'bridge',
      name: answer,
      subject: kind === 'water' ? 'water' : 'bridge',
      question: kind === 'water'
        ? (byBoat ? 'Which water are you on?' : 'Which water is under this bridge?')
        : 'Which bridge is this?',
      context: byBoat ? 'Passing under a bridge' : 'Crossing a bridge',
      choices: alternatives.length >= 2 ? [answer, ...alternatives] : null,
    });
    this._pendingCrossing = { bridge: closest as Bridge, crossing: labelled, key, water };
  }

  // ---- Answer choices ----

  _renderCanalChoices(correctName: string, explicitChoices: string[] | null = null): void {
    if (explicitChoices) {
      this._renderChoiceButtons(shuffle([...explicitChoices]));
      return;
    }
    if (!this.player) return;
    const player = this.player;
    const nearbyNames = this.track.segments
      .filter(segment => segment.points.some(point =>
        Math.hypot(point.x - player.x, point.y - player.y) < CHOICE_POOL_RADIUS))
      .map(segment => segment.name)
      .filter((name): name is string => !!name);
    const alternatives = pickDistractors(nearbyNames, correctName, DISTRACTOR_COUNT, shuffle);
    this._renderChoiceButtons(shuffle([correctName, ...alternatives]));
  }

  _renderChoiceButtons(choices: string[]): void {
    this._choiceOrder = choices;
    this._promptChoices.replaceChildren(...choices.map((name, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'canal-choice';
      // The number is the keyboard shortcut, so show it on the button.
      const key = document.createElement('span');
      key.className = 'canal-choice-key';
      key.textContent = String(index + 1);
      button.append(key, document.createTextNode(name));
      button.addEventListener('click', () => this._submitCanalAnswer(name));
      return button;
    }));
  }

  /** 1-4 answer the open multiple-choice question without reaching for the
   *  mouse; 0 says so when you do not know it, which is a real answer of its
   *  own. */
  _handleChoiceShortcut(): void {
    if (!this.quizPromptName) return;
    if (this.input.wasPressed('Digit0') || this.input.wasPressed('Numpad0')) {
      this._submitCanalAnswer(null, true);
      return;
    }
    if (this.routeOptions.answerMode !== 'multiple') return;
    if (!this._choiceOrder || this._choiceOrder.length === 0) return;
    for (let index = 0; index < Math.min(this._choiceOrder.length, 4); index++) {
      if (this.input.wasPressed(`Digit${index + 1}`) || this.input.wasPressed(`Numpad${index + 1}`)) {
        this._submitCanalAnswer(this._choiceOrder[index]);
        return;
      }
    }
  }

  _normaliseCanalName(value: string): string {
    return CanalRecallAnswerPath.normaliseAnswer(value);
  }

  // ---- Filing the answer ----

  /**
   * `noIdea` is the player saying they do not know, which is different from
   * answering wrong. A four-option question is guessable one time in four, and
   * a lucky guess used to retire the street outright — it counted as
   * knowledge, stopped being asked, and put its name on the map. So the honest
   * answer has to be strictly better than guessing or nobody will ever press
   * it: it costs no accuracy, because you did not answer, and it schedules the
   * name to come back in ten minutes. Guessing wrong costs accuracy and the
   * streak; guessing right when you did not know quietly poisons the whole
   * review schedule.
   */
  _submitCanalAnswer(selectedAnswer: string | null, noIdea = false): void {
    if (!this.quizPromptName || !this.player) return;
    const correctName = this.quizPromptName;
    const answer = selectedAnswer == null ? this._promptInput.value : selectedAnswer;
    // A crossing answer belongs to the crossing, not to wherever the vehicle
    // rolled to a stop; everything else belongs to where the player was.
    const pending: PendingCrossing | null = this._pendingCrossing;
    let recallFeature: RecallFeature | null;
    if (pending && this.quizPromptKind === 'crossing-water') {
      recallFeature = pending.water;
    } else if (pending && this.quizPromptKind === 'bridge') {
      recallFeature = {
        name: correctName, type: 'bridge', cityId: 'amsterdam',
        center: pending.crossing.center as LatLon,
      };
    } else {
      recallFeature = this._recallFeatureAt(correctName, this.player.x, this.player.y);
    }
    const result = CanalRecallAnswerPath.submitAnswer({
      correctName,
      answer,
      noIdea,
      score: {
        attempts: this.quizAttempts,
        correct: this.quizCorrect,
        points: this.quizPoints,
        streak: this.quizStreak,
        bestStreak: this.quizBestStreak,
      },
      difficultyMultiplier: DIFFICULTY_SCORE_MULTIPLIERS[this.routeDifficulty] || 0.85,
      noveltyMultiplier: (this._routeMastery[this._normaliseCanalName(correctName)] || 0) < 0.5 ? 1.15 : 1,
      gameyFeatures: this.gameyFeatures,
      recallFeature,
      recallStore: this.recall,
      revealName: (name: string) => this._revealName(name),
      markLearned: (name: string) => this.learnedNames.add(name),
      rememberKnownPlace: (name: string, center: LatLon) => this._rememberKnownPlace(name, center),
    });
    const correct = result.wasCorrect;
    this.quizAttempts = result.attempts;
    this.quizCorrect = result.correct;
    this.quizPoints = result.points;
    this.quizStreak = result.streak;
    this.quizBestStreak = result.bestStreak;
    this.quizFeedback = result.feedback;
    this._promptFeedback.textContent = result.feedback;
    this._promptFeedback.style.color = result.feedbackColor;
    // Neither a bridge nor the water beneath it is what the wheels are on:
    // keep the waterway/street the player is actually travelling, or the route
    // quiz re-fires the moment the prompt closes.
    const atCrossing = this.quizPromptKind === 'bridge' || this.quizPromptKind === 'crossing-water';
    if (!atCrossing) {
      this.quizCurrentName = correctName;
    } else if (this.quizPromptKind === 'bridge' && correct && pending) {
      this._learnedBridges.set(pending.key, {
        name: correctName, labelPoint: pending.crossing.labelPoint,
      });
      // If the bridge carries the name of the road under the wheels, that name
      // is now answered — otherwise the street quiz asks for it again on the
      // very next frame.
      if (this.track.getRoadName(this.player.x, this.player.y) === correctName) {
        this.quizCurrentName = correctName;
      }
    }
    this._pendingCrossing = null;
    this.quizPromptKind = 'route';
    this.quizCandidateName = '';
    this.quizCandidateTimer = 0;
    this.quizPromptName = '';
    this.quizPromptSegmentIndex = -1;
    this.quizPromptPointIndex = 0;
    // "Not quite — this is Lijnbaansgracht" is the single most useful sentence
    // in the game, and it used to vanish in 650 ms. A correction now stays up
    // long enough to actually read the name that was missed.
    const learnedStreet = !atCrossing && isCar(this.travelMode) ? correctName : '';
    setTimeout(() => {
      this._prompt.style.display = 'none';
      this.canvas.focus();
      if (learnedStreet) this._showStreetKnowledge(learnedStreet);
    }, correct ? ANSWER_HOLD_CORRECT : ANSWER_HOLD_WRONG);
  }
}

window.CanalRecallGameModules = window.CanalRecallGameModules || [];
window.CanalRecallGameModules.push(GameRecallRuntime);
