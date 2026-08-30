// Methods in this file are installed on Game.prototype by game.js.
// Keeping each subsystem in a class preserves private runtime state on the Game instance
// while making ownership and review boundaries explicit.
class GameRecallRuntime {
  _setupRecallStore() {
    this.recall = window.CanalRecallStoreModule ? window.CanalRecallStoreModule.store : null;
    const row = document.getElementById('account-row');
    const label = document.getElementById('account-label');
    const note = document.getElementById('account-note');
    const button = document.getElementById('account-button');
    this._skipMastered = document.getElementById('skip-mastered');
    if (!this.recall || !row) return;
    this._skipMastered.addEventListener('change', () => {
      this.recall.enabled = this._skipMastered.checked;
      this._refreshMasteredLabels();
      this._savePreferences();
    });
    this.recall.onUserChange((user) => {
      row.style.display = 'flex';
      if (user) {
        label.textContent = user.label;
        // One name can be several answers now: a long street is learned a
        // stretch at a time, and each stretch is scheduled on its own.
        note.textContent = `${this.recall.masteredCount} answers synced`;
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
        if (this.recall.signedIn) await this.recall.signOut();
        else await this.recall.signIn();
      } catch (error) {
        this._routeError.textContent = error.message || 'Could not sign in.';
      } finally {
        button.disabled = false;
      }
    });
    this.recall.init().then(() => {
      if (this.recall.available) row.style.display = 'flex';
      this._refreshMasteredLabels();
    });
  }

  // World pixels are route-relative: the network origin is recomputed for every
  // race from the loaded bounds. Anything that has to survive the race — recall
  // identity above all — is stored in lat/lon.

  _toLatLon(x, y) {
    const loader = this.osmLoader;
    if (!loader || loader._lastCenterLat === undefined) return null;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
    return [
      loader._lastCenterLat - (y - loader._lastOffsetY) / (metersPerDegreeLat * PIXELS_PER_METER),
      loader._lastCenterLng + (x - loader._lastOffsetX) / (metersPerDegreeLng * PIXELS_PER_METER),
    ];
  }

  _toWorld(lat, lon) {
    const loader = this.osmLoader;
    if (!loader || loader._lastCenterLat === undefined) return null;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
    return {
      x: (lon - loader._lastCenterLng) * metersPerDegreeLng * PIXELS_PER_METER + loader._lastOffsetX,
      y: -(lat - loader._lastCenterLat) * metersPerDegreeLat * PIXELS_PER_METER + loader._lastOffsetY,
    };
  }

  // The identity an answer is scheduled against: the name *and the place it was
  // answered*. Knowing Overtoom by the Vondelpark is not knowing Overtoom in
  // the Kinkerbuurt — see src/canalRecall/recallChunks.ts.

  _recallFeatureAt(name, x, y, type = '') {
    if (!name) return null;
    const center = this._toLatLon(x, y);
    if (!center) return null;
    const meta = this.osmLoader && this.osmLoader.featureMeta && this.osmLoader.featureMeta.get(name);
    return {
      name,
      type: type || (meta && meta.type) || (this.travelMode === 'car' ? 'street' : 'canal'),
      cityId: (meta && meta.cityId) || 'amsterdam',
      center,
    };
  }

  _revealName(name) {
    if (!name) return;
    this.revealedNames.add(name);
    this._mapLabelNames.add(name);
  }

  // Seed the map labels with everywhere the store already considers known, so a
  // learned street is named from the first frame rather than only after the
  // player happens to drive onto it. Places, not names: labelling the whole of
  // a long street because one junction was answered would hand the player the
  // answer to the far end before it was ever asked.

  _refreshMasteredLabels() {
    this._mapLabelNames = new Set(this.revealedNames);
    this._knownPlaces = new Map();
    if (!this.recall || !this.recall.enabled) return;
    for (const place of this.recall.knownPlaces()) {
      const point = this._toWorld(place.center[0], place.center[1]);
      if (!point) continue;
      const points = this._knownPlaces.get(place.name);
      if (points) points.push(point); else this._knownPlaces.set(place.name, [point]);
    }
  }

  _rememberKnownPlace(name, center) {
    const point = center && this._toWorld(center[0], center[1]);
    if (!point) return;
    const points = this._knownPlaces.get(name);
    if (points) points.push(point); else this._knownPlaces.set(name, [point]);
  }

  // Is this label close enough to somewhere the player has proved they know it?

  _isPlaceKnown(name, x, y) {
    const points = this._knownPlaces.get(name);
    if (!points || !window.CanalRecallStoreModule) return false;
    const radius = window.CanalRecallStoreModule.RECALL_LOCAL_RADIUS_METERS * PIXELS_PER_METER;
    return points.some(point => Math.hypot(point.x - x, point.y - y) <= radius);
  }

  // True when this name was answered near the player recently enough that
  // asking it again here would be noise — a wrong answer included, which the
  // scheduler parks briefly so a correction is not instantly re-tested.

  _isRecallSuppressedHere(name) {
    if (!this.recall || !this.recall.enabled || !this.player) return false;
    const feature = this._recallFeatureAt(name, this.player.x, this.player.y);
    return !!feature && this.recall.isSuppressedHere(feature);
  }

  // A gate across the middle of a span, perpendicular to it.

  _bridgeGate(a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length * BRIDGE_GATE_HALF_WIDTH, ny = dx / length * BRIDGE_GATE_HALF_WIDTH;
    return [{ x: mx - nx, y: my - ny }, { x: mx + nx, y: my + ny }];
  }

  // A bridge named correctly keeps its label, the same way a learned waterway
  // does. It is map annotation, not HUD: it is drawn under the vehicle, kept
  // faint, and suppressed entirely near the vehicle, because a label sitting
  // on top of the boat hides the one thing the player is steering.

  _renderBridgeLabels() {
    if (!this._learnedBridges || this._learnedBridges.size === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (const bridge of this._learnedBridges.values()) {
      const point = bridge.labelPoint;
      if (!point) continue;
      const range = dist(point.x, point.y, this.player.x, this.player.y);
      if (range > BRIDGE_LABEL_RANGE) continue;
      const screen = this.camera.worldToScreen(point.x, point.y);
      if (screen.x < 0 || screen.x > CANVAS_W || screen.y < 0 || screen.y > CANVAS_H) continue;
      // Fade in with distance from the vehicle: invisible where it would
      // overlap the boat or car, settled at a background weight beyond that.
      const clearance = clamp((range - BRIDGE_LABEL_CLEARANCE) / BRIDGE_LABEL_CLEARANCE, 0, 1);
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

  // Draw the navigation line from the vehicle's current position rather than
  // from the original start, and re-route outright once the player has strayed
  // far enough that the remaining line would be misleading.

  _updateCanalQuiz(dt) {
    const name = this.track.getRoadName(this.player.x, this.player.y);
    // A name the player has already proved they know is adopted silently
    // instead of being asked again until it falls due.
    if (name && name !== this.quizCurrentName && this._isRecallSuppressedHere(name)) {
      this.quizCurrentName = name;
      this.learnedNames.add(name);
      this._revealName(name);
      this.quizCandidateName = '';
      this.quizCandidateTimer = 0;
      return;
    }
    if (!name || name === this.quizCurrentName) {
      this.quizCandidateName = '';
      this.quizCandidateTimer = 0;
      return;
    }
    // Check alignment: player heading must roughly match the road direction
    // to avoid quizzing when merely crossing a waterway/street without turning
    const nearestRoad = this.track.getNearestRoad(this.player.x, this.player.y);
    if (nearestRoad) {
      const playerAngle = this.player.angle;
      const roadAngle = nearestRoad.angle;
      let angleDiff = Math.abs(playerAngle - roadAngle) % Math.PI;
      if (angleDiff > Math.PI / 2) angleDiff = Math.PI - angleDiff;
      if (angleDiff > Math.PI / 4) {
        this.quizCandidateName = '';
        this.quizCandidateTimer = 0;
        return;
      }
    }
    if (name !== this.quizCandidateName) {
      this.quizCandidateName = name;
      this.quizCandidateTimer = 0;
      return;
    }
    this.quizCandidateTimer += dt;
    // A street you have already been told the name of comes back sooner: the
    // point of the label is that you read it while driving, and the re-test
    // that follows should feel like a quick check rather than a fresh
    // question.
    const settleFor = this.revealedNames.has(name) ? QUIZ_RETEST_DELAY : QUIZ_CANDIDATE_DELAY;
    if (this.quizCandidateTimer < settleFor || Math.abs(this.player.speed) < 5) return;

    const quizRoad = this.track.getNearestRoad(this.player.x, this.player.y);
    this._openQuizPrompt({
      kind: 'route',
      name,
      subject: this.travelMode === 'car' ? 'street' : 'waterway',
      question: this.travelMode === 'car' ? 'Which street are you on now?' : 'Which waterway are you on now?',
      context: 'You made a turn',
      segmentIndex: quizRoad ? quizRoad.segIdx : -1,
      pointIndex: quizRoad ? quizRoad.ptIdx : 0,
    });
  }

  // Shared prompt plumbing for every kind of recall question.
  //
  // `subject` is what the answer *is* — a street, a bridge, or the water under
  // one. It is the chip at the top of the card, because "Crossing a bridge" as
  // the headline above "Which water are you crossing?" read as a question
  // about the bridge. The question is the headline now and the situation is
  // the caption under it.

  _openQuizPrompt({ kind, name, subject, question, context, choices = null, segmentIndex = -1, pointIndex = 0 }) {
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
    this._promptKind.firstElementChild.innerHTML = chip.icon;
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
    if (this.routeOptions.answerMode === 'multiple') {
      this._promptInput.style.display = 'none';
      document.getElementById('canal-submit').style.display = 'none';
      this._promptChoices.style.display = 'grid';
      this._renderCanalChoices(name, choices);
    } else {
      this._promptChoices.style.display = 'none';
      this._promptInput.style.display = 'block';
      document.getElementById('canal-submit').style.display = 'block';
      requestAnimationFrame(() => this._promptInput.focus());
    }
  }

  // Ask about the crossing the player just made — the water first, then the
  // bridge over it. Both travel modes are the same test: the hull or chassis
  // crosses the bridge's mapped centreline.

  _updateBridgeQuiz(previousPosition) {
    if (this.quizPromptName || !this.bridges.length || !previousPosition) return;
    if (Math.abs(this.player.speed) < 5) return;
    // Bridge questions are rationed. Crossing five bridges in a minute along a
    // canal ring produced five prompts, each one stopping the vehicle dead,
    // which is neither good teaching nor good driving.
    if (this.raceTime - this._lastBridgeQuizAt < BRIDGE_QUIZ_COOLDOWN) return;
    const currentRoadName = this.track.getRoadName(this.player.x, this.player.y);
    const movedBy = dist(previousPosition.x, previousPosition.y, this.player.x, this.player.y);
    if (movedBy <= 0) return;
    const byBoat = this.travelMode !== 'car';
    let closest = null;
    for (const bridge of this.bridges) {
      for (const line of bridge.lines) {
        for (let i = 1; i < line.length && !closest; i++) {
          const a = line[i - 1], b = line[i];
          if (byBoat) {
            // Passing under: this step's travel crosses the span itself.
            if (segmentsIntersect(previousPosition, this.player, a, b)) closest = bridge;
          } else {
            // Driving over runs along the deck, so the deck line is never
            // crossed — its midpoint gate is.
            const gate = this._bridgeGate(a, b);
            if (segmentsIntersect(previousPosition, this.player, gate[0], gate[1])) closest = bridge;
          }
        }
        if (closest) break;
      }
      if (closest) break;
    }
    if (!closest) return;

    // Which of this bridge's crossings was it? "IJburglaan" is 66 mapped ways
    // making five separate bridges kilometres apart, and being asked for it
    // once taught one of them.
    const crossing = CanalRecallBridges.nearestCrossing(
      closest.crossings, this.player.x, this.player.y, CROSSING_MATCH_RANGE);
    if (!crossing) return;
    const key = `${closest.id}#${crossing.index}`;
    const asked = this._quizzedCrossings.get(key);

    const water = crossing.waterway ? {
      name: crossing.waterway,
      type: crossing.waterwayType || 'canal',
      cityId: 'amsterdam',
      center: crossing.center,
    } : null;
    // A bridge is a landmark *on* a waterway. Naming the deck before you can
    // name the water under it teaches the wrong half, so the crossing asks for
    // the water first and holds the bridge back until that has actually been
    // answered right — per crossing, because the Amstel at the Berlagebrug and
    // the Amstel at the Magere Brug are two pieces of local knowledge.
    const waterKnown = !!water && !!this.recall && this.recall.isKnownHere(water);

    let kind = null;
    if (water && !waterKnown) {
      // Street mode never otherwise asks about water, so the crossing is where
      // the canal gets taught. By boat the route quiz already owns the waterway
      // the hull is on, so the bridge simply waits for it.
      const suppressed = !!this.recall && this.recall.isSuppressedHere(water);
      if (!byBoat && asked !== 'water' && !suppressed) kind = 'water';
    } else if (asked !== 'bridge'
      // Raampoort is both a street and a bridge. Asking for it as a bridge and
      // then again as a street left the player answering the same name twice.
      && closest.name !== currentRoadName && closest.name !== this.quizCurrentName
      && !(this.recall && this.recall.isSuppressedHere(
        { name: closest.name, type: 'bridge', cityId: 'amsterdam', center: crossing.center }))) {
      kind = 'bridge';
    }
    if (!kind) return;

    this._quizzedCrossings.set(key, kind);
    this._lastBridgeQuizAt = this.raceTime;
    crossing.labelPoint = { x: this.player.x, y: this.player.y };

    const answer = kind === 'water' ? water.name : closest.name;
    const pool = kind === 'water' ? crossing.waterDistractors : closest.distractors;
    const alternatives = [...new Set(pool)]
      .filter(candidate => candidate && candidate !== answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
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
    this._pendingCrossing = { bridge: closest, crossing, key, water };
  }

  _renderCanalChoices(correctName, explicitChoices = null) {
    if (explicitChoices) {
      this._renderChoiceButtons([...explicitChoices].sort(() => Math.random() - 0.5));
      return;
    }
    const nearbyNames = this.track.segments
      .filter(segment => segment.points.some(point => dist(point.x, point.y, this.player.x, this.player.y) < 1500))
      .map(segment => segment.name)
      .filter(Boolean);
    const alternatives = [...new Set(nearbyNames)]
      .filter(name => name !== correctName)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    this._renderChoiceButtons([correctName, ...alternatives].sort(() => Math.random() - 0.5));
  }

  _renderChoiceButtons(choices) {
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

  // 1-4 answer the open multiple-choice question without reaching for the mouse;
  // 0 says so when you do not know it, which is a real answer of its own.

  _handleChoiceShortcut() {
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

  _normaliseCanalName(value) {
    return CanalRecallAnswerPath.normaliseAnswer(value);
  }

  // `noIdea` is the player saying they do not know, which is different from
  // answering wrong. A four-option question is guessable one time in four, and
  // a lucky guess used to retire the street outright — it counted as knowledge,
  // stopped being asked, and put its name on the map. So the honest answer has
  // to be strictly better than guessing or nobody will ever press it: it costs
  // no accuracy, because you did not answer, and it schedules the name to come
  // back in ten minutes. Guessing wrong costs accuracy and the streak; guessing
  // right when you did not know quietly poisons the whole review schedule.

  _submitCanalAnswer(selectedAnswer, noIdea = false) {
    if (!this.quizPromptName) return;
    const correctName = this.quizPromptName;
    const answer = selectedAnswer == null ? this._promptInput.value : selectedAnswer;
    // A crossing answer belongs to the crossing, not to wherever the vehicle
    // rolled to a stop; everything else belongs to where the player was.
    let recallFeature = null;
    if (this._pendingCrossing && this.quizPromptKind === 'crossing-water') {
      recallFeature = this._pendingCrossing.water;
    } else if (this._pendingCrossing && this.quizPromptKind === 'bridge') {
      recallFeature = { name: correctName, type: 'bridge', cityId: 'amsterdam', center: this._pendingCrossing.crossing.center };
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
      gameyFeatures: this.gameyFeatures,
      recallFeature,
      recallStore: this.recall,
      revealName: name => this._revealName(name),
      markLearned: name => this.learnedNames.add(name),
      rememberKnownPlace: (name, center) => this._rememberKnownPlace(name, center),
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
    } else if (this.quizPromptKind === 'bridge' && correct && this._pendingCrossing) {
      const { key, crossing } = this._pendingCrossing;
      this._learnedBridges.set(key, { name: correctName, labelPoint: crossing.labelPoint });
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
    const learnedStreet = !atCrossing && this.travelMode === 'car' ? correctName : '';
    setTimeout(() => {
      this._prompt.style.display = 'none';
      this.canvas.focus();
      if (learnedStreet) this._showStreetKnowledge(learnedStreet);
    }, correct ? ANSWER_HOLD_CORRECT : ANSWER_HOLD_WRONG);
  }
}

window.CanalRecallGameModules = window.CanalRecallGameModules || [];
window.CanalRecallGameModules.push(GameRecallRuntime);
