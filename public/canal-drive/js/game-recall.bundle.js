"use strict";
(() => {
  // src/canalRecall/game/recallRules.ts
  var METERS_PER_DEGREE_LAT = 111320;
  function metersPerDegreeLng(centerLat) {
    return METERS_PER_DEGREE_LAT * Math.cos(centerLat * Math.PI / 180);
  }
  function toLatLon(origin, x, y) {
    const { centerLat, centerLng, offsetX, offsetY, pixelsPerMeter } = origin;
    return [
      centerLat - (y - offsetY) / (METERS_PER_DEGREE_LAT * pixelsPerMeter),
      centerLng + (x - offsetX) / (metersPerDegreeLng(centerLat) * pixelsPerMeter)
    ];
  }
  function toWorld(origin, lat, lon) {
    const { centerLat, centerLng, offsetX, offsetY, pixelsPerMeter } = origin;
    return {
      x: (lon - centerLng) * metersPerDegreeLng(centerLat) * pixelsPerMeter + offsetX,
      y: -(lat - centerLat) * METERS_PER_DEGREE_LAT * pixelsPerMeter + offsetY
    };
  }
  function isPlaceKnown(knownPoints, x, y, radiusPixels) {
    if (!knownPoints) return false;
    return knownPoints.some((point) => Math.hypot(point.x - x, point.y - y) <= radiusPixels);
  }
  function segmentsIntersect(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
  function bridgeGate(a, b, halfWidth) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length * halfWidth, ny = dx / length * halfWidth;
    return [{ x: mx - nx, y: my - ny }, { x: mx + nx, y: my + ny }];
  }
  function findCrossedBridge(bridges, previous, current, byBoat, gateHalfWidth) {
    for (const bridge of bridges) {
      for (const line of bridge.lines) {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i];
          if (byBoat) {
            if (segmentsIntersect(previous, current, a, b)) return bridge;
          } else {
            const gate = bridgeGate(a, b, gateHalfWidth);
            if (segmentsIntersect(previous, current, gate[0], gate[1])) return bridge;
          }
        }
      }
    }
    return null;
  }
  function crossingQuestionKind(input) {
    if (input.hasWater && !input.waterKnownHere) {
      if (!input.byBoat && input.alreadyAsked !== "water" && !input.waterSuppressedHere) return "water";
      return null;
    }
    if (input.alreadyAsked === "bridge") return null;
    if (input.bridgeName === input.currentRoadName) return null;
    if (input.bridgeName === input.quizCurrentName) return null;
    if (input.bridgeSuppressedHere) return null;
    return "bridge";
  }
  function pickDistractors(pool, answer, limit, shuffle2) {
    return shuffle2([...new Set(pool)].filter((candidate) => candidate && candidate !== answer)).slice(0, limit);
  }
  var CLEARED = { candidateName: "", candidateSeconds: 0 };
  var MAX_HEADING_OFF_ROAD = Math.PI / 4;
  var MIN_QUIZ_SPEED = 5;
  function advanceRouteQuiz(state, input, dt, suppressedHere) {
    const { roadName, currentName } = input;
    if (roadName && roadName !== currentName && suppressedHere) {
      return { action: "adopt", name: roadName, state: CLEARED };
    }
    if (!roadName || roadName === currentName) return { action: "idle", state: CLEARED };
    if (input.headingOffRoad !== null && input.headingOffRoad > MAX_HEADING_OFF_ROAD) {
      return { action: "idle", state: CLEARED };
    }
    if (roadName !== state.candidateName) {
      return { action: "idle", state: { candidateName: roadName, candidateSeconds: 0 } };
    }
    const candidateSeconds = state.candidateSeconds + dt;
    const settled = { candidateName: roadName, candidateSeconds };
    const settleFor = input.alreadyRevealed ? input.retestSeconds : input.settleSeconds;
    if (candidateSeconds < settleFor || Math.abs(input.speed) < MIN_QUIZ_SPEED) {
      return { action: "idle", state: settled };
    }
    return { action: "ask", name: roadName, state: settled };
  }
  function headingOffRoad(playerAngle, roadAngle) {
    let difference = Math.abs(playerAngle - roadAngle) % Math.PI;
    if (difference > Math.PI / 2) difference = Math.PI - difference;
    return difference;
  }

  // src/canalRecall/game/modes.ts
  function isCar(mode) {
    return mode === "car";
  }

  // src/canalRecall/routing/cycleTrack.ts
  var CYCLE_TRACK_ANSWER_MULTIPLIER = 1.1;

  // src/canalRecall/game/recallRuntime.ts
  var DISTRACTOR_COUNT = 3;
  var CHOICE_POOL_RADIUS = 1500;
  function shuffle(items) {
    return items.sort(() => Math.random() - 0.5);
  }
  var GameRecallRuntime = class {
    // ---- Store and account row ----
    _setupRecallStore() {
      this.recall = window.CanalRecallStoreModule ? window.CanalRecallStoreModule.store : null;
      this._skipMastered = document.getElementById("skip-mastered");
      const overlay = window.CanalRecallOverlay?.getOverlay?.() ?? this._overlay;
      const skip = overlay?.store.getState().prefs.skipMastered ?? (typeof this._pendingSkipMastered === "boolean" ? this._pendingSkipMastered : true);
      if (this.recall) this.recall.enabled = skip;
      this._pendingSkipMastered = void 0;
      if (!this.recall) return;
      const recall = this.recall;
      if (overlay) {
        overlay.callbacks.onSkipMastered = (enabled) => {
          recall.enabled = enabled;
          this._refreshMasteredLabels();
          this._savePreferences();
        };
        overlay.callbacks.onAccountClick = async () => {
          overlay.store.setAccount({ busy: true });
          try {
            if (recall.signedIn) await recall.signOut();
            else await recall.signIn();
          } catch (error) {
            this._setRouteError(error.message || "Could not sign in.");
          } finally {
            overlay.store.setAccount({ busy: false });
          }
        };
      }
      recall.onUserChange((user) => {
        if (!overlay) return;
        if (user) {
          overlay.store.setAccount({
            visible: true,
            label: user.label,
            note: `${recall.masteredCount} answers synced`,
            buttonLabel: "Sign out"
          });
        } else {
          overlay.store.setAccount({
            visible: true,
            label: "Playing as guest",
            note: "Sign in to remember which streets you already know across devices.",
            buttonLabel: "Sign in"
          });
        }
      });
      recall.init().then(() => {
        if (recall.available && overlay) overlay.store.setAccount({ visible: true });
        this._refreshMasteredLabels();
      });
    }
    // ---- Route-relative coordinates ----
    /** `null` until a road network has been loaded, because there is no
     *  projection origin to convert against yet. */
    _worldOrigin() {
      const loader = this.osmLoader;
      if (!loader || loader._lastCenterLat === void 0 || loader._lastCenterLng === void 0) return null;
      return {
        centerLat: loader._lastCenterLat,
        centerLng: loader._lastCenterLng,
        offsetX: loader._lastOffsetX,
        offsetY: loader._lastOffsetY,
        pixelsPerMeter: PIXELS_PER_METER
      };
    }
    _toLatLon(x, y) {
      const origin = this._worldOrigin();
      return origin ? toLatLon(origin, x, y) : null;
    }
    _toWorld(lat, lon) {
      const origin = this._worldOrigin();
      return origin ? toWorld(origin, lat, lon) : null;
    }
    // ---- Recall identity ----
    _recallFeatureAt(name, x, y, type = "") {
      if (!name) return null;
      const center = this._toLatLon(x, y);
      if (!center) return null;
      const meta = this.osmLoader && this.osmLoader.featureMeta && this.osmLoader.featureMeta.get(name);
      return {
        name,
        type: type || meta && meta.type || (isCar(this.travelMode) ? "street" : "canal"),
        cityId: meta && meta.cityId || "amsterdam",
        center
      };
    }
    _revealName(name) {
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
    _refreshMasteredLabels() {
      this._mapLabelNames = new Set(this.revealedNames);
      this._knownPlaces = /* @__PURE__ */ new Map();
      if (!this.recall || !this.recall.enabled) return;
      for (const place of this.recall.knownPlaces()) {
        this._rememberKnownPlace(place.name, place.center);
      }
    }
    _rememberKnownPlace(name, center) {
      const point = center && this._toWorld(center[0], center[1]);
      if (!point) return;
      const points = this._knownPlaces.get(name);
      if (points) points.push(point);
      else this._knownPlaces.set(name, [point]);
    }
    /** Is this label close enough to somewhere the player has proved they know it? */
    _isPlaceKnown(name, x, y) {
      if (!window.CanalRecallStoreModule) return false;
      const radius = window.CanalRecallStoreModule.RECALL_LOCAL_RADIUS_METERS * PIXELS_PER_METER;
      return isPlaceKnown(this._knownPlaces.get(name), x, y, radius);
    }
    /** True when this name was answered near the player recently enough that
     *  asking it again here would be noise — a wrong answer included, which the
     *  scheduler parks briefly so a correction is not instantly re-tested. */
    _isRecallSuppressedHere(name) {
      if (!this.recall || !this.recall.enabled || !this.player) return false;
      const feature = this._recallFeatureAt(name, this.player.x, this.player.y);
      return !!feature && this.recall.isSuppressedHere(feature);
    }
    // ---- Bridge labels ----
    _bridgeGate(a, b) {
      return bridgeGate(a, b, BRIDGE_GATE_HALF_WIDTH);
    }
    /**
     * A bridge named correctly keeps its label, the same way a learned waterway
     * does. It is map annotation, not HUD: drawn under the vehicle, kept faint,
     * and suppressed entirely near the vehicle, because a label sitting on top
     * of the boat hides the one thing the player is steering.
     */
    _renderBridgeLabels() {
      if (!this._learnedBridges || this._learnedBridges.size === 0 || !this.player) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      for (const bridge of this._learnedBridges.values()) {
        const point = bridge.labelPoint;
        if (!point) continue;
        const range = Math.hypot(point.x - this.player.x, point.y - this.player.y);
        if (range > BRIDGE_LABEL_RANGE) continue;
        const screen = this.camera.worldToScreen(point.x, point.y);
        if (screen.x < 0 || screen.x > CANVAS_W || screen.y < 0 || screen.y > CANVAS_H) continue;
        const clearance = Math.max(0, Math.min(
          1,
          (range - BRIDGE_LABEL_CLEARANCE) / BRIDGE_LABEL_CLEARANCE
        ));
        if (clearance <= 0) continue;
        ctx.globalAlpha = 0.55 * clearance;
        const width = ctx.measureText(bridge.name).width + 12;
        ctx.fillStyle = "rgba(3,18,28,0.55)";
        roundRect(ctx, screen.x - width / 2, screen.y - 24, width, 16, 4);
        ctx.fill();
        ctx.fillStyle = "#E7D5A3";
        ctx.fillText(bridge.name, screen.x, screen.y - 12);
      }
      ctx.restore();
    }
    // ---- The route question ----
    _updateCanalQuiz(dt) {
      if (!this.player) return;
      const name = this.track.getRoadName(this.player.x, this.player.y);
      const interesting = !!name && name !== this.quizCurrentName;
      const nearestRoad = interesting ? this.track.getNearestRoad(this.player.x, this.player.y) : null;
      const decision = advanceRouteQuiz({
        candidateName: this.quizCandidateName,
        candidateSeconds: this.quizCandidateTimer
      }, {
        roadName: name,
        currentName: this.quizCurrentName,
        headingOffRoad: nearestRoad ? headingOffRoad(this.player.angle, nearestRoad.angle) : null,
        speed: this.player.speed,
        alreadyRevealed: this.revealedNames.has(name),
        settleSeconds: QUIZ_CANDIDATE_DELAY,
        retestSeconds: QUIZ_RETEST_DELAY
      }, dt, interesting && this._isRecallSuppressedHere(name));
      this.quizCandidateName = decision.state.candidateName;
      this.quizCandidateTimer = decision.state.candidateSeconds;
      if (decision.action === "idle") return;
      if (decision.action === "adopt") {
        this.quizCurrentName = decision.name;
        this.learnedNames.add(decision.name);
        this._revealName(decision.name);
        this._showStreetKnowledge(decision.name, isCar(this.travelMode) ? "street" : "water");
        return;
      }
      const quizRoad = this.track.getNearestRoad(this.player.x, this.player.y);
      this._openQuizPrompt({
        kind: "route",
        name: decision.name,
        subject: isCar(this.travelMode) ? "street" : "waterway",
        question: isCar(this.travelMode) ? "Which street are you on now?" : "Which waterway are you on now?",
        context: "You made a turn",
        segmentIndex: quizRoad ? quizRoad.segIdx : -1,
        pointIndex: quizRoad ? quizRoad.ptIdx : 0
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
    _openQuizPrompt({ kind, name, subject, question, context, choices = null, segmentIndex = -1, pointIndex = 0 }) {
      if (!this.player) return;
      this._pendingCrossing = null;
      this.quizPromptKind = kind;
      this.quizPromptName = name;
      this.quizPromptSegmentIndex = segmentIndex;
      this.quizPromptPointIndex = pointIndex;
      this.quizFeedback = "";
      this._clearLandmarkNotice();
      this._neighborhoodNotice = null;
      this._neighborhoodNoticeTimer = 0;
      this.player.speed = 0;
      this.player.vx = 0;
      this.player.vy = 0;
      const chip = QUIZ_SUBJECTS[subject] || QUIZ_SUBJECTS.water;
      this._promptKind.dataset.kind = chip.kind;
      this._promptKind.firstElementChild.innerHTML = chip.icon;
      this._promptKindLabel.textContent = chip.label;
      this._promptHeading.textContent = question;
      this._promptQuestion.textContent = context;
      this._promptInput.setAttribute("aria-label", `${chip.label} name`);
      this._promptInput.placeholder = chip.placeholder;
      this._prompt.style.display = "flex";
      const playerScreen = this.camera.worldToScreen(this.player.x, this.player.y);
      this._prompt.classList.toggle("dock-left", playerScreen.x > CANVAS_W / 2);
      this._promptInput.value = "";
      this._promptFeedback.textContent = "";
      const submit = document.getElementById("canal-submit");
      if (this.routeOptions.answerMode === "multiple") {
        this._promptInput.style.display = "none";
        if (submit) submit.style.display = "none";
        this._promptChoices.style.display = "grid";
        this._renderCanalChoices(name, choices);
      } else {
        this._promptChoices.style.display = "none";
        this._promptInput.style.display = "block";
        if (submit) submit.style.display = "block";
        requestAnimationFrame(() => this._promptInput.focus());
      }
    }
    // ---- The crossing question ----
    /**
     * Ask about the crossing the player just made — the water first, then the
     * bridge over it. Both travel modes are the same test: the hull or chassis
     * crosses the bridge's mapped centreline.
     */
    _updateBridgeQuiz(previousPosition) {
      if (this.quizPromptName || !this.bridges.length || !previousPosition || !this.player) return;
      if (Math.abs(this.player.speed) < 5) return;
      if (this.raceTime - this._lastBridgeQuizAt < BRIDGE_QUIZ_COOLDOWN) return;
      const movedBy = Math.hypot(this.player.x - previousPosition.x, this.player.y - previousPosition.y);
      if (movedBy <= 0) return;
      const byBoat = !isCar(this.travelMode);
      const closest = findCrossedBridge(
        this.bridges,
        previousPosition,
        this.player,
        byBoat,
        BRIDGE_GATE_HALF_WIDTH
      );
      if (!closest) return;
      const crossing = CanalRecallBridges.nearestCrossing(
        closest.crossings,
        this.player.x,
        this.player.y,
        CROSSING_MATCH_RANGE
      );
      if (!crossing) return;
      const key = `${closest.id}#${crossing.index}`;
      const water = crossing.waterway ? {
        name: crossing.waterway,
        type: crossing.waterwayType || "canal",
        cityId: "amsterdam",
        center: crossing.center
      } : null;
      const bridgeFeature = {
        name: closest.name,
        type: "bridge",
        cityId: "amsterdam",
        center: crossing.center
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
        quizCurrentName: this.quizCurrentName
      });
      if (!kind) return;
      this._quizzedCrossings.set(key, kind);
      this._lastBridgeQuizAt = this.raceTime;
      const labelled = crossing;
      labelled.labelPoint = { x: this.player.x, y: this.player.y };
      const answer = kind === "water" && water ? water.name : closest.name;
      const pool = kind === "water" ? crossing.waterDistractors : closest.distractors;
      const alternatives = pickDistractors(pool, answer, DISTRACTOR_COUNT, shuffle);
      this._openQuizPrompt({
        kind: kind === "water" ? "crossing-water" : "bridge",
        name: answer,
        subject: kind === "water" ? "water" : "bridge",
        question: kind === "water" ? byBoat ? "Which water are you on?" : "Which water is under this bridge?" : "Which bridge is this?",
        context: byBoat ? "Passing under a bridge" : "Crossing a bridge",
        choices: alternatives.length >= 2 ? [answer, ...alternatives] : null
      });
      this._pendingCrossing = { bridge: closest, crossing: labelled, key, water };
    }
    // ---- Answer choices ----
    _renderCanalChoices(correctName, explicitChoices = null) {
      if (explicitChoices) {
        this._renderChoiceButtons(shuffle([...explicitChoices]));
        return;
      }
      if (!this.player) return;
      const player = this.player;
      const nearbyNames = this.track.segments.filter((segment) => segment.points.some((point) => Math.hypot(point.x - player.x, point.y - player.y) < CHOICE_POOL_RADIUS)).map((segment) => segment.name).filter((name) => !!name);
      const alternatives = pickDistractors(nearbyNames, correctName, DISTRACTOR_COUNT, shuffle);
      this._renderChoiceButtons(shuffle([correctName, ...alternatives]));
    }
    _renderChoiceButtons(choices) {
      this._choiceOrder = choices;
      this._promptChoices.replaceChildren(...choices.map((name, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "canal-choice";
        const key = document.createElement("span");
        key.className = "canal-choice-key";
        key.textContent = String(index + 1);
        button.append(key, document.createTextNode(name));
        button.addEventListener("click", () => this._submitCanalAnswer(name));
        return button;
      }));
    }
    /** 1-4 answer the open multiple-choice question without reaching for the
     *  mouse; 0 says so when you do not know it, which is a real answer of its
     *  own. */
    _handleChoiceShortcut() {
      if (!this.quizPromptName) return;
      if (this.input.wasPressed("Digit0") || this.input.wasPressed("Numpad0")) {
        this._submitCanalAnswer(null, true);
        return;
      }
      if (this.routeOptions.answerMode !== "multiple") return;
      if (!this._choiceOrder || this._choiceOrder.length === 0) return;
      for (let index = 0; index < Math.min(this._choiceOrder.length, 4); index++) {
        if (this.input.wasPressed(`Digit${index + 1}`) || this.input.wasPressed(`Numpad${index + 1}`)) {
          this._submitCanalAnswer(this._choiceOrder[index]);
          return;
        }
      }
    }
    _normaliseCanalName(value) {
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
    _submitCanalAnswer(selectedAnswer, noIdea = false) {
      if (!this.quizPromptName || !this.player) return;
      const correctName = this.quizPromptName;
      const answer = selectedAnswer == null ? this._promptInput.value : selectedAnswer;
      const pending = this._pendingCrossing;
      let recallFeature;
      if (pending && this.quizPromptKind === "crossing-water") {
        recallFeature = pending.water;
      } else if (pending && this.quizPromptKind === "bridge") {
        recallFeature = {
          name: correctName,
          type: "bridge",
          cityId: "amsterdam",
          center: pending.crossing.center
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
          bestStreak: this.quizBestStreak
        },
        difficultyMultiplier: DIFFICULTY_SCORE_MULTIPLIERS[this.routeDifficulty] || 0.85,
        noveltyMultiplier: (this._routeMastery[this._normaliseCanalName(correctName)] || 0) < 0.5 ? 1.15 : 1,
        cycleTrackMultiplier: (() => {
          if (!isCar(this.travelMode) || !this.player) return 1;
          const road = this.track.getNearestRoad(this.player.x, this.player.y);
          const segment = road && this.track.segments?.[road.segIdx];
          return segment?.separatedCycleTrack ? CYCLE_TRACK_ANSWER_MULTIPLIER : 1;
        })(),
        gameyFeatures: this.gameyFeatures,
        recallFeature,
        recallStore: this.recall,
        revealName: (name) => this._revealName(name),
        markLearned: (name) => this.learnedNames.add(name),
        rememberKnownPlace: (name, center) => this._rememberKnownPlace(name, center)
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
      this._clearLandmarkNotice();
      this._neighborhoodNotice = null;
      this._neighborhoodNoticeTimer = 0;
      const atCrossing = this.quizPromptKind === "bridge" || this.quizPromptKind === "crossing-water";
      if (!atCrossing) {
        this.quizCurrentName = correctName;
      } else if (this.quizPromptKind === "bridge" && correct && pending) {
        this._learnedBridges.set(pending.key, {
          name: correctName,
          labelPoint: pending.crossing.labelPoint
        });
        if (this.track.getRoadName(this.player.x, this.player.y) === correctName) {
          this.quizCurrentName = correctName;
        }
      }
      this._pendingCrossing = null;
      this.quizPromptKind = "route";
      this.quizCandidateName = "";
      this.quizCandidateTimer = 0;
      this.quizPromptName = "";
      this.quizPromptSegmentIndex = -1;
      this.quizPromptPointIndex = 0;
      const learnedRoute = !atCrossing ? correctName : "";
      const learnedRouteType = isCar(this.travelMode) ? "street" : "water";
      setTimeout(() => {
        this._prompt.style.display = "none";
        this.quizFeedback = "";
        this.canvas.focus();
        if (learnedRoute) this._showStreetKnowledge(learnedRoute, learnedRouteType, true);
      }, correct ? ANSWER_HOLD_CORRECT : ANSWER_HOLD_WRONG);
    }
  };
  window.CanalRecallGameModules = window.CanalRecallGameModules || [];
  window.CanalRecallGameModules.push(GameRecallRuntime);
})();
