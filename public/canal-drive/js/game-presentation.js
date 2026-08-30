// Methods in this file are installed on Game.prototype by game.js.
// Keeping each subsystem in a class preserves private runtime state on the Game instance
// while making ownership and review boundaries explicit.
class GamePresentationRuntime {
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (this.state === GameState.MENU) {
      this._renderMenu();
      return;
    }

    if (this.state === GameState.MAP_SELECT) {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }

    if (this.state === GameState.LOADING) {
      this.loadingScreen.draw(ctx, this.loadingMessage, this.loadingProgress);
      return;
    }

    // game view — pass current time to HUD for animations
    this.hud.setTime(this.raceTime);
    if (this._lastZoomShown !== this.camera.zoom) {
      this._lastZoomShown = this.camera.zoom;
      this._zoomBadgeTimer = ZOOM_BADGE_DURATION;
    }
    // Transparent game world over the live MapLibre vector basemap.
    this.vectorMap.sync(this.camera, this.osmLoader, this.canvas);
    // Both travel modes have a real model now; the canvas glyph stays only as
    // the loading fallback, and is not painted over a mesh that is ready.
    const pitched = this.viewMode === 'chase' || this.viewMode === 'cockpit';
    const byBoat = this.travelMode !== 'car';
    const playerUses3dMesh = pitched;
    this.vectorMap.setPlayerBike(this.player, this.osmLoader, pitched && !byBoat);
    this.vectorMap.setPlayerBoat(this.player, this.osmLoader, pitched && byBoat);
    this.vectorMap.setRoute(this._liveRoutePath || this.routePath, this.osmLoader, this.routeOptions.line);
    if (this.travelMode === 'car') {
      this.vectorMap.setStreetHighlights(
        this.track, this.osmLoader, this.learnedNames,
        this.quizPromptName, this.quizPromptSegmentIndex
      );
    }

    this.renderer.drawTrack(this.camera, this.track);
    if (this.travelMode !== 'car') {
      this.renderer.drawQuestionFeature(
        this.camera, this.track, this.quizPromptName,
        this.quizPromptSegmentIndex, this.quizPromptPointIndex, this.raceTime
      );
    }
    this.renderer.drawSkidMarks(this.particles, this.camera);

    this._renderBridgeLabels();
    const meshReady = playerUses3dMesh
      && (byBoat ? this.vectorMap.isPlayerBoatReady() : this.vectorMap.isPlayerBikeReady());
    if (!meshReady) {
      if (byBoat) this.renderer.drawCar(this.player, this.camera);
      else this.renderer.drawPlayerCar(this.player, this.camera);
    }
    this.renderer.drawParticles(this.particles, this.camera);
    // Streets stay named on the map once you have been told the name, in the
    // car as well as the boat — that is how the name sticks while you drive
    // along it. The one being asked about is withheld, or the map would be
    // answering the question for you.
    // A label is earned per place, not per name: knowing the Overtoom at the
    // Vondelpark must not write it across the Kinkerbuurt end that has never
    // been asked.
    this.track.drawLabels(ctx, this.camera,
      (text, x, y) => this._mapLabelNames.has(text) || this._isPlaceKnown(text, x, y),
      this.quizPromptName || this.quizCandidateName, this.player);

    // Results replace the live HUD rather than competing with it.
    if (this.state === GameState.FINISHED) {
      this._renderFinish();
      return;
    }

    // HUD
    this.hud.drawTripReadout(ctx, this.player.speed, this.player.distancePx);
    this.hud.drawCanalScore(ctx, this.quizCorrect, this.quizAttempts, this.quizPoints, this.quizFeedback, this.quizStreak, this.gameyFeatures);
    // Hide a new route name from the first candidate frame, not only after
    // the delayed question opens. Otherwise the HUD reveals the answer during
    // the 650 ms turn-confirmation window.
    const routeAnswerHidden = !!this.quizPromptName
      || (!!this.quizCandidateName && this.quizCandidateName !== this.quizCurrentName);
    const visibleRouteName = routeAnswerHidden ? '' : this.track.getRoadName(this.player.x, this.player.y);
    this.hud.drawCurrentLocation(ctx, visibleRouteName, this.currentNeighborhood, this.travelMode, routeAnswerHidden);
    this.hud.drawDestination(ctx, this.routeTo.name, this.track.getDistanceToFinish(this.player.x, this.player.y));

    if (this.routeOptions.arrow) {
      this.hud.drawFinishDirection(ctx, this.player.x, this.player.y, this.track.finishPoint.x, this.track.finishPoint.y, this.camera);
    }

    if (this.showMiniMap) {
      this.hud.drawCityOverview(ctx, this);
    }
    this._renderLandmarkNotice();
    this._renderNeighborhoodNotice();

    // Zoom badge, shown briefly after a change rather than permanently: a
    // standing "35%" reads as a mystery statistic.
    const zoomPct = Math.round(this.camera.zoom * 100);
    if (this._zoomBadgeTimer > 0) {
      const bottomLayout = window.CanalRecallBottomHud?.bottomHudLayout({
        tripWidth: 180, zoomVisible: true,
        controlsVisible: !this.input.isMobile && this.raceTime < CONTROLS_HINT_DURATION,
      });
      const zoomRect = bottomLayout?.zoomBadge || { x: CANVAS_W/2 - 35, y: CANVAS_H - 35, width: 70, height: 22 };
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, zoomRect.x, zoomRect.y, zoomRect.width, zoomRect.height, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${zoomPct}%`, zoomRect.x + zoomRect.width / 2, zoomRect.y + 15);
    }

    // Re-center button when camera is panned away
    const panDist = Math.hypot(this.camera.panX, this.camera.panY);
    if (panDist > 40) {
      const btnW = 110, btnH = 28;
      const btnX = CANVAS_W / 2 - btnW / 2, btnY = 70;
      ctx.fillStyle = 'rgba(3,18,28,0.85)';
      roundRect(ctx, btnX, btnY, btnW, btnH, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,0.6)';
      ctx.lineWidth = 1;
      roundRect(ctx, btnX, btnY, btnW, btnH, 6);
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RE-CENTER (R)', CANVAS_W / 2, btnY + 18);
      this._recenterBtnBounds = { x: btnX, y: btnY, w: btnW, h: btnH };
    } else {
      this._recenterBtnBounds = null;
    }

    // Debug overlay
    if (this._debugMode) {
      this._renderDebug();
    }

    // Controls hint — only while the player is settling in. It used to sit
    // permanently on top of the recall panel.
    if (!this.input.isMobile && this.raceTime < CONTROLS_HINT_DURATION) {
      const bottomLayout = window.CanalRecallBottomHud?.bottomHudLayout({
        tripWidth: 180, zoomVisible: this._zoomBadgeTimer > 0, controlsVisible: true,
      });
      const hintRect = bottomLayout?.controlsHint || { x: CANVAS_W / 2 - 177, y: CANVAS_H - 32, width: 354, height: 12 };
      const fade = Math.min(1, CONTROLS_HINT_DURATION - this.raceTime);
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textAlign = 'center';
      ctx.fillText('?: help  G: settings  M: map  O: north  D: labels  P: pause', hintRect.x + hintRect.width / 2, hintRect.y + 9);
      ctx.globalAlpha = 1;
    }

    // Touch control zones hint (mobile, first 5 seconds of race)
    if (this.input.isMobile && this.input.showTouchHint && this.state === GameState.RACING) {
      this.hud.drawTouchHint(ctx);
    }

    // pause overlay
    if (this.state === GameState.PAUSED) {
      this._renderPaused();
    }

    // finish overlay
    if (this.state === GameState.FINISHED) {
      this._renderFinish();
    }
  }

  _renderMenu() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Animated city grid background
    const t = Date.now() / 1000;
    ctx.strokeStyle = 'rgba(33,150,243,0.06)';
    ctx.lineWidth = 1;
    // Vertical roads
    for (let x = 0; x < CANVAS_W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    // Horizontal roads
    for (let y = 0; y < CANVAS_H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }

    // Animated police lights sweeping across background
    const flash = Math.floor(t * 3) % 2;
    for (let i = 0; i < 6; i++) {
      const px = (i * 220 + t * 40) % (CANVAS_W + 200) - 100;
      const py = 180 + Math.sin(i * 1.7 + t * 0.5) * 120;
      const col = (i + flash) % 2 === 0 ? 'rgba(33,100,243,0.08)' : 'rgba(244,67,54,0.06)';
      ctx.beginPath();
      ctx.arc(px, py + 200, 50, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }

    // Dark gradient overlay for readability
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, 'rgba(10,10,20,0.9)');
    grad.addColorStop(0.4, 'rgba(10,10,20,0.7)');
    grad.addColorStop(0.7, 'rgba(10,10,20,0.8)');
    grad.addColorStop(1, 'rgba(10,10,20,0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // title with glow
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 58px monospace';
    // Glow
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFD700';
    ctx.fillText('AMSTERDAM CANAL RECALL', CANVAS_W/2, 70);
    ctx.shadowBlur = 0;
    ctx.restore();

    // subtitle
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Navigate the real canal network and name each waterway after you turn', CANVAS_W/2, 100);

    // Rules panel
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, CANVAS_W/2 - 320, 120, 640, 160, 10);
    ctx.fill();

    ctx.textAlign = 'left';
    const rulesX = CANVAS_W/2 - 290;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('HOW TO PLAY:', rulesX, 145);

    ctx.fillStyle = '#CCC';
    ctx.font = '12px monospace';
    const rules = [
      '1. Use WASD or the arrow keys to steer the boat',
      '2. The boat slows dramatically when it leaves mapped water',
      '3. After entering a differently named waterway, type its name',
      '4. Map labels are hidden: navigate from the shape of the city',
      '5. TAB toggles the overview map; -/+ changes zoom',
      '6. This is an early prototype — feedback is the point',
    ];
    for (let i = 0; i < rules.length; i++) {
      ctx.fillText(rules[i], rulesX, 165 + i * 18);
    }

    // Controls
    ctx.fillStyle = '#777';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    if (this.input.isMobile) {
      ctx.fillText('Left side: Steer    Right side: Gas/Brake    Double-tap: Drift', CANVAS_W/2, 298);
    } else {
      ctx.fillText('Arrow Keys / WASD - Drive    SPACE - Drift    TAB - Map    N - Sound    -/+ Zoom', CANVAS_W/2, 298);
    }

    // Mode options
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);

    ctx.fillStyle = `rgba(144,202,249,${0.4 + pulse * 0.6})`;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    const startText = this.input.isMobile ? 'TAP TO START' : 'PRESS ENTER TO START';
    ctx.fillText(startText, CANVAS_W/2, CANVAS_H/2 + 55);

    // Movie quote
    if (!this._menuQuote) {
      this._menuQuote = BANDIT_QUOTES[Math.floor(Math.random() * BANDIT_QUOTES.length)];
    }
    ctx.fillStyle = 'rgba(255,215,0,0.5)';
    ctx.font = 'italic 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`"${this._menuQuote.text}"`, CANVAS_W/2, CANVAS_H/2 + 90);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px monospace';
    ctx.fillText(`— ${this._menuQuote.character}`, CANVAS_W/2, CANVAS_H/2 + 107);

    // Exploration badge (if returning player)
    try {
      const exp = this._loadExploration();
      const totalKnown = exp.learnedWaterways.length + exp.learnedStreets.length;
      if (exp.totalRoutes > 0) {
        ctx.fillStyle = 'rgba(88,28,135,.3)';
        roundRect(ctx, cx - 200, CANVAS_H / 2 + 120, 400, 28, 6);
        ctx.fill();
        ctx.fillStyle = '#C4B5FD';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        const parts = [];
        if (totalKnown > 0) parts.push(`${totalKnown} waterways`);
        if (exp.visitedNeighborhoods.length > 0) parts.push(`${exp.visitedNeighborhoods.length} hoods`);
        if (exp.seenLandmarks.length > 0) parts.push(`${exp.seenLandmarks.length} landmarks`);
        ctx.fillText(`Amsterdam: ${parts.join(' · ')} · ${exp.totalRoutes} routes`, cx, CANVAS_H / 2 + 138);
      }
    } catch (_) {}

    // Animated chase scene at bottom
    const chaseY = CANVAS_H - 130;
    // Road strip
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.fillRect(0, chaseY - 15, CANVAS_W, 30);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.moveTo(0, chaseY);
    ctx.lineTo(CANVAS_W, chaseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Player car (gold) being chased
    const carX = (t * 80) % (CANVAS_W + 300) - 100;
    ctx.save();
    ctx.translate(carX, chaseY);
    ctx.fillStyle = '#FFD700';
    roundRect(ctx, -15, -8, 30, 16, 3);
    ctx.fill();
    ctx.restore();

    // Police car chasing (behind player)
    const copX = carX - 120;
    const copFlash = Math.floor(t * 8) % 2;
    ctx.save();
    ctx.translate(copX, chaseY);
    ctx.fillStyle = '#1A1A2E';
    roundRect(ctx, -15, -8, 30, 16, 3);
    ctx.fill();
    // Siren light
    ctx.fillStyle = copFlash === 0 ? '#2196F3' : '#F44336';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    // Radar ring
    const radarPulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.beginPath();
    ctx.arc(0, 0, 25 + radarPulse * 10, 0, Math.PI * 2);
    ctx.strokeStyle = copFlash === 0 ? 'rgba(33,150,243,0.3)' : 'rgba(244,67,54,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Second police car further behind
    const cop2X = carX - 260;
    ctx.save();
    ctx.translate(cop2X, chaseY);
    ctx.fillStyle = '#1A1A2E';
    roundRect(ctx, -15, -8, 30, 16, 3);
    ctx.fill();
    ctx.fillStyle = copFlash === 1 ? '#2196F3' : '#F44336';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // City silhouette labels
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    const cityNames = ['RICHMOND', 'CHICAGO', 'NEW YORK', 'LONDON', 'PARIS'];
    for (let i = 0; i < cityNames.length; i++) {
      ctx.fillText(cityNames[i], 130 + i * 230, CANVAS_H - 50);
    }

    // Credit
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    const creditText = 'Vibe coded by Alan and Claude — ';
    const linkText = 'alan.is';
    const creditWidth = ctx.measureText(creditText).width;
    const linkWidth = ctx.measureText(linkText).width;
    const totalWidth = creditWidth + linkWidth;
    const startX = CANVAS_W/2 - totalWidth/2;
    ctx.textAlign = 'left';
    ctx.fillText(creditText, startX, CANVAS_H - 15);
    ctx.fillStyle = 'rgba(100,180,255,0.6)';
    ctx.fillText(linkText, startX + creditWidth, CANVAS_H - 15);
    // underline
    ctx.fillRect(startX + creditWidth, CANVAS_H - 13, linkWidth, 1);
    // store link bounds for click detection
    this._alanLinkBounds = { x: startX + creditWidth, y: CANVAS_H - 26, w: linkWidth, h: 16 };

    // Version
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('v' + GAME_VERSION, CANVAS_W - 10, 15);

    // GitHub link
    const ghText = 'GitHub';
    ctx.font = '11px monospace';
    const ghWidth = ctx.measureText(ghText).width;
    const ghX = CANVAS_W/2 - ghWidth/2;
    ctx.fillStyle = 'rgba(100,180,255,0.6)';
    ctx.textAlign = 'left';
    ctx.fillText(ghText, ghX, CANVAS_H - 2);
    ctx.fillRect(ghX, CANVAS_H, ghWidth, 1);
    this._githubLinkBounds = { x: ghX, y: CANVAS_H - 13, w: ghWidth, h: 16 };
  }

  _renderPaused() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Center panel
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, CANVAS_W/2 - 200, CANVAS_H/2 - 80, 400, 185, 12);
    ctx.fill();

    // PAUSED title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W/2, CANVAS_H/2 - 20);

    // Resume hint
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px monospace';
    ctx.fillText('P / ESC / SPACE to resume', CANVAS_W/2, CANVAS_H/2 + 25);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px monospace';
    ctx.fillText('M — back to menu', CANVAS_W/2, CANVAS_H/2 + 45);

    // Share link option
    if (this._shareUrl) {
      if (this._copiedTimer > 0) {
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('Copied!', CANVAS_W/2, CANVAS_H/2 + 62);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '12px monospace';
        ctx.fillText('C — copy race link', CANVAS_W/2, CANVAS_H/2 + 62);
      }
    }

    // Current stats
    ctx.font = '12px monospace';
    ctx.fillStyle = '#AAA';
    const meters = this.player.distancePx / PIXELS_PER_METER;
    const miles = meters / 1609.344;
    const pct = Math.round(this.player.raceProgress * 100);
    ctx.fillText(
      `Time: ${this.hud.formatTime(this.raceTime)}  |  ${miles.toFixed(2)} mi  |  ${pct}%`,
      CANVAS_W/2, CANVAS_H/2 + 80
    );
  }

  // The arrival card. One surface, one type system, and a running list of
  // blocks that report their own height, so the card measures itself instead
  // of keeping a stack of hand-tuned offsets in step with the layout below.
  // Time is a stat here, not the headline: the game does not reward speed, and
  // a 38 px stopwatch said it did.

  _renderFinish() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(2,10,16,.72)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const cx = CANVAS_W / 2;
    const cardW = 600, padX = 30;
    const cardX = cx - cardW / 2;
    const innerW = cardW - padX * 2;
    const gamey = this.gameyFeatures;
    const exploration = this._explorationSnapshot && this._explorationSnapshot.totalRoutes > 0
      ? this._explorationSnapshot : null;
    const ribbon = gamey && this._ribbon ? this._ribbon : null;
    const landmark = this._finishLandmark();
    const image = landmark && this._landmarkImages ? this._landmarkImages.get(landmark.id) : null;
    const hasImage = !!image && image.complete && image.naturalWidth > 0;

    const INK = '#F1F5F9', MUTED = '#8FA3B0', BODY = '#C3D2DC', ACCENT = '#7DD3FC';
    const rule = (y) => {
      ctx.strokeStyle = 'rgba(143,163,176,.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cardX + padX, y + 0.5); ctx.lineTo(cardX + cardW - padX, y + 0.5); ctx.stroke();
    };

    let bestText = '';
    if (this._raceKey) {
      const stored = this._getBestTime(this._raceKey);
      if (stored && this.raceTime <= stored.time) bestText = '★  New personal best';
      else if (stored) bestText = `Personal best  ${this.hud.formatTime(stored.time)}`;
    }

    // ---- Blocks: each measures itself, then draws from a given top edge ----
    const blocks = [];

    blocks.push({ height: 74, draw: (top) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = ACCENT; ctx.font = 'bold 10px monospace';
      ctx.fillText('ARRIVED', cardX + padX, top + 11);
      ctx.fillStyle = INK; ctx.font = '800 26px system-ui, sans-serif';
      ctx.fillText(wrapText(ctx, this.routeTo.name, innerW, 1)[0], cardX + padX, top + 42);
      ctx.fillStyle = MUTED; ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(`${this.routeFrom.name}  →  ${this.routeTo.name}`, cardX + padX, top + 64);
    } });

    if (landmark) {
      const photo = hasImage ? 88 : 0;
      const textX = cardX + padX + (hasImage ? photo + 16 : 0);
      const textW = cardX + cardW - padX - textX;
      ctx.font = '12px system-ui, sans-serif';
      const blurb = wrapText(ctx, landmark.longDetail || landmark.detail
        || 'A place to remember on your Amsterdam map.', textW, hasImage ? 4 : 3);
      const height = Math.max(hasImage ? photo : 0, 20 + blurb.length * 17) + 14;
      blocks.push({ height, draw: (top) => {
        if (hasImage) {
          ctx.save(); ctx.beginPath(); roundRect(ctx, cardX + padX, top, photo, photo, 8); ctx.clip();
          const side = Math.min(image.naturalWidth, image.naturalHeight);
          ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2,
            side, side, cardX + padX, top, photo, photo);
          ctx.restore();
        }
        ctx.textAlign = 'left';
        ctx.fillStyle = MUTED; ctx.font = 'bold 9px monospace';
        const kind = String(landmark.type || 'landmark').toUpperCase();
        ctx.fillText(landmark.wikipediaUrl ? `${kind}  ·  W  WIKIPEDIA` : kind, textX, top + 10);
        ctx.fillStyle = BODY; ctx.font = '12px system-ui, sans-serif';
        blurb.forEach((line, index) => ctx.fillText(line, textX, top + 30 + index * 17));
      } });
    }

    // One stat row instead of four differently coloured boxes.
    const recallNoun = this.travelMode === 'car' ? 'Streets' : 'Canals';
    const accuracy = this.quizAttempts > 0 ? Math.round(100 * this.quizCorrect / this.quizAttempts) : 0;
    const stats = [
      { label: recallNoun, value: `${this.quizCorrect}/${this.quizAttempts}` },
      { label: 'Recall', value: `${accuracy}%` },
      { label: 'Time', value: this.hud.formatTime(this.raceTime).slice(0, -2) },
      { label: 'Distance', value: `${(this.player.distancePx / PIXELS_PER_METER / 1000).toFixed(2)} km` },
    ];
    if (gamey) stats.splice(2, 0, { label: 'Points', value: String(this.quizPoints) });
    const footerBits = [
      this.routeDifficulty.charAt(0).toUpperCase() + this.routeDifficulty.slice(1),
      this.travelMode === 'car' ? 'Bike' : 'Boat',
      this.viewMode.replace('-', ' ').replace(/^./, (c) => c.toUpperCase()),
    ];
    if (gamey && this.quizBestStreak >= 2) footerBits.push(`Best streak ${this.quizBestStreak}`);
    blocks.push({ height: 78, rule: true, draw: (top) => {
      const column = innerW / stats.length;
      ctx.textAlign = 'center';
      stats.forEach((stat, index) => {
        const sx = cardX + padX + column * (index + 0.5);
        ctx.fillStyle = INK; ctx.font = 'bold 21px monospace';
        ctx.fillText(stat.value, sx, top + 26);
        ctx.fillStyle = MUTED; ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(stat.label, sx, top + 44);
      });
      ctx.fillStyle = MUTED; ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(footerBits.join('  ·  '), cx, top + 66);
    } });

    if (ribbon) {
      blocks.push({ height: 86, rule: true, draw: (top) => {
        this._renderRouteRibbon(ctx, cardX + padX, top + 6, innerW, 74);
      } });
    }

    if (exploration) {
      const known = exploration.learnedWaterways.length + exploration.learnedStreets.length;
      const totals = [];
      if (known > 0) totals.push(`${known} names`);
      if (exploration.visitedNeighborhoods.length > 0) totals.push(`${exploration.visitedNeighborhoods.length} neighborhoods`);
      if (exploration.seenLandmarks.length > 0) totals.push(`${exploration.seenLandmarks.length} landmarks`);
      const fresh = [];
      if (this.learnedNames.size > 0) fresh.push(`${this.learnedNames.size} names`);
      if (this._visitedNeighborhoods.size > 0) fresh.push(`${this._visitedNeighborhoods.size} neighborhoods`);
      if (this._seenLandmarkNames.size > 0) fresh.push(`${this._seenLandmarkNames.size} landmarks`);
      blocks.push({ height: fresh.length ? 52 : 36, rule: true, draw: (top) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = MUTED; ctx.font = 'bold 9px monospace';
        ctx.fillText('CITY KNOWLEDGE', cardX + padX, top + 12);
        ctx.fillStyle = BODY; ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(totals.join('  ·  ') || 'Start exploring', cardX + cardW - padX, top + 12);
        if (fresh.length) {
          ctx.textAlign = 'left'; ctx.fillStyle = ACCENT; ctx.font = '11px system-ui, sans-serif';
          ctx.fillText(`+${fresh.join(', +')} this route`, cardX + padX, top + 32);
        }
      } });
    }

    if (bestText) {
      blocks.push({ height: 26, draw: (top) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = bestText.startsWith('★') ? '#5EE0A0' : MUTED;
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(bestText, cardX + padX, top + 14);
      } });
    }

    blocks.push({ height: 34, rule: true, draw: (top) => {
      const actions = [['ENTER', 'Try again'], ['ESC', 'Choose route']];
      if (this._shareUrl) actions.push(['C', this._copiedTimer > 0 ? 'Link copied' : 'Copy race link']);
      ctx.textAlign = 'left';
      let ax = cardX + padX;
      for (const [key, caption] of actions) {
        ctx.font = 'bold 11px monospace';
        const keyW = ctx.measureText(key).width + 14;
        ctx.fillStyle = 'rgba(143,163,176,.16)';
        roundRect(ctx, ax, top + 4, keyW, 20, 5); ctx.fill();
        ctx.fillStyle = INK; ctx.fillText(key, ax + 7, top + 18);
        ax += keyW + 8;
        ctx.fillStyle = caption === 'Link copied' ? '#5EE0A0' : MUTED;
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText(caption, ax, top + 18);
        ax += ctx.measureText(caption).width + 22;
      }
    } });

    // ---- Measure, then draw ----
    // Measurement and drawing share one formula for the space above a block,
    // so the card cannot end up with a band of dead space at the bottom.
    const GAP = 16, PAD_TOP = 30, PAD_BOTTOM = 26;
    const leadFor = (block, index) => (index === 0 ? 0 : block.rule ? GAP * 2 : GAP);
    let cardH = PAD_TOP + PAD_BOTTOM;
    blocks.forEach((block, index) => { cardH += leadFor(block, index) + block.height; });
    const cardY = clamp(Math.round((CANVAS_H - cardH) / 2), 16, Math.max(16, CANVAS_H - cardH - 16));

    ctx.fillStyle = 'rgba(6,20,29,.96)';
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125,211,252,.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textBaseline = 'alphabetic';
    let y = cardY + PAD_TOP;
    blocks.forEach((block, index) => {
      const lead = leadFor(block, index);
      if (block.rule && lead) rule(y + lead / 2);
      y += lead;
      block.draw(y);
      y += block.height;
    });
    ctx.textAlign = 'center';
  }

  _finishLandmark() {
    if (!this.routeTo || this.routeTo.id === 'home' || !this.landmarks) return null;
    const wanted = this._normaliseCanalName(this.routeTo.name);
    return this.landmarks.find(landmark => this._normaliseCanalName(landmark.name) === wanted)
      || (this.track && this.landmarks.reduce((best, landmark) => {
        const distance = Math.hypot(landmark.x - this.track.finishPoint.x, landmark.y - this.track.finishPoint.y);
        return distance < 220 && (!best || distance < best.distance) ? { landmark, distance } : best;
      }, null)?.landmark)
      || null;
  }

  // Ribbon band on the finish card: a medal, the tier, and the per-axis
  // breakdown so the grade explains itself rather than reading as a black box.

  _renderRouteRibbon(ctx, boxX, boxY, boxW, boxH) {
    const ribbon = this._ribbon;
    if (!ribbon) return;

    ctx.fillStyle = ribbon.dim;
    roundRect(ctx, boxX, boxY, boxW, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = ribbon.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Rosette: two tails under a struck medal.
    const medalX = boxX + 42, medalY = boxY + 32, medalR = 20;
    ctx.fillStyle = ribbon.color;
    ctx.globalAlpha = 0.75;
    for (const tailDx of [-9, 9]) {
      ctx.beginPath();
      ctx.moveTo(medalX + tailDx - 6, medalY + 10);
      ctx.lineTo(medalX + tailDx + 6, medalY + 10);
      ctx.lineTo(medalX + tailDx + 3, medalY + 34);
      ctx.lineTo(medalX + tailDx, medalY + 27);
      ctx.lineTo(medalX + tailDx - 3, medalY + 34);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(medalX, medalY, medalR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(3,18,28,.9)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ribbon.color;
    ctx.stroke();
    ctx.fillStyle = ribbon.color;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ribbon.id === 'none' ? '·' : ribbon.label[0], medalX, medalY + 1);
    ctx.textBaseline = 'alphabetic';

    const textX = boxX + 76;
    ctx.textAlign = 'left';
    ctx.fillStyle = ribbon.color;
    ctx.font = 'bold 19px monospace';
    ctx.fillText(ribbon.label, textX, boxY + 26);
    const labelWidth = ctx.measureText(ribbon.label).width;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px monospace';
    ctx.fillText(`${Math.round(ribbon.score * 100)}%`, textX + labelWidth + 12, boxY + 26);

    // Per-axis meters.
    const axes = ribbon.axes;
    const trackW = (boxX + boxW - 18 - textX) / axes.length;
    axes.forEach((axis, index) => {
      const x = textX + index * trackW;
      const w = trackW - 14;
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px monospace';
      ctx.fillText(`${axis.label} ${Math.round(axis.score * 100)}%`, x, boxY + 45);
      ctx.fillStyle = 'rgba(148,163,184,.25)';
      roundRect(ctx, x, boxY + 52, w, 7, 3.5);
      ctx.fill();
      if (axis.score > 0) {
        ctx.fillStyle = ribbon.color;
        const fillW = Math.max(4, w * axis.score);
        roundRect(ctx, x, boxY + 52, fillW, 7, Math.min(3.5, fillW / 2));
        ctx.fill();
      }
    });

    ctx.textAlign = 'center';
  }

  // ---- Nearby landmark learning cues ----

  _idealRouteLength() {
    // The live line is consumed as the player advances, so the ribbon's
    // efficiency reference is the length planned at the start.
    if (this._plannedRouteLengthPx > 0) return this._plannedRouteLengthPx;
    const path = this.routePath;
    if (!path || path.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return total;
  }

  // Grade the finished trip on recall, self-reliance, and route efficiency.
  // Speed is deliberately not an input: a fast lap of the wrong canals should
  // not outrank a deliberate, correctly named route.

  _computeRouteRibbon() {
    const axes = [];

    // A route with no turns to name scores zero recall rather than being
    // excluded, so it settles at ROUTE COMPLETE instead of a free gold.
    const recall = this.quizAttempts > 0 ? this.quizCorrect / this.quizAttempts : 0;
    axes.push({ id: 'recall', label: 'Recall', weight: 0.5, score: recall });

    const used = this._assistUsage || { line: false, arrow: false, minimap: false };
    let aidCost = 0;
    for (const [aid, cost] of Object.entries(RIBBON_AID_COST)) if (used[aid]) aidCost += cost;
    let selfReliance = 1 - aidCost;
    // Typing the name back is a harder recall task than picking from four
    // options, so it buys back some of the aid cost.
    if (this.routeOptions.answerMode === 'typing') selfReliance += 0.15;
    axes.push({ id: 'aids', label: 'Unaided', weight: 0.25, score: clamp(selfReliance, 0, 1) });

    const ideal = this._idealRouteLength();
    const actual = this.player ? this.player.distancePx : 0;
    if (ideal > 0 && actual > 0) {
      // Even a clean run overshoots the graph route slightly, so treat 90% of
      // ideal as a full score and 55% as none.
      const ratio = Math.min(1, ideal / actual);
      axes.push({ id: 'efficiency', label: 'Efficiency', weight: 0.25, score: clamp((ratio - 0.55) / 0.35, 0, 1) });
    }

    const totalWeight = axes.reduce((sum, axis) => sum + axis.weight, 0);
    const score = totalWeight > 0 ? axes.reduce((sum, axis) => sum + axis.weight * axis.score, 0) / totalWeight : 0;
    const tier = ROUTE_RIBBON_TIERS.find(entry => score >= entry.min && recall >= entry.minRecall);
    return { ...tier, score, axes };
  }

  _getBestTime(key) {
    if (!key) return null;
    try {
      const data = JSON.parse(localStorage.getItem(LEADERBOARD_STORAGE_KEY) || '{}');
      return data[key] || null;
    } catch (e) { return null; }
  }

  _saveBestTime() {
    if (!this._raceKey) return;
    try {
      const data = JSON.parse(localStorage.getItem(LEADERBOARD_STORAGE_KEY) || '{}');
      const existing = data[this._raceKey];
      if (!existing || this.raceTime < existing.time) {
        const meters = this.player.distancePx / PIXELS_PER_METER;
        const miles = meters / 1609.344;
        data[this._raceKey] = {
          time: this.raceTime,
          date: new Date().toISOString(),
          distance: parseFloat(miles.toFixed(2))
        };
        // LRU eviction: remove oldest entries if over limit
        const keys = Object.keys(data);
        if (keys.length > LEADERBOARD_MAX_ENTRIES) {
          keys.sort((a, b) => (data[a].date || '').localeCompare(data[b].date || ''));
          while (Object.keys(data).length > LEADERBOARD_MAX_ENTRIES) {
            delete data[keys.shift()];
          }
        }
        localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) { console.warn('Could not save best time:', e); }
  }

  // ---- Exploration collection (persistent across sessions) ----

  _loadExploration() {
    try {
      return JSON.parse(localStorage.getItem(EXPLORATION_STORAGE_KEY) || 'null') || {
        learnedWaterways: [], learnedStreets: [],
        visitedNeighborhoods: [], seenLandmarks: [],
        totalRoutes: 0, totalCorrect: 0, totalAttempts: 0,
      };
    } catch (_) {
      return { learnedWaterways: [], learnedStreets: [], visitedNeighborhoods: [], seenLandmarks: [], totalRoutes: 0, totalCorrect: 0, totalAttempts: 0 };
    }
  }

  _saveExploration() {
    try {
      const data = this._loadExploration();
      const addUnique = (arr, items) => { const set = new Set(arr); for (const item of items) set.add(item); return [...set]; };
      const isBoat = this.travelMode === 'boat';
      if (isBoat) {
        data.learnedWaterways = addUnique(data.learnedWaterways, this.learnedNames);
      } else {
        data.learnedStreets = addUnique(data.learnedStreets, this.learnedNames);
      }
      data.visitedNeighborhoods = addUnique(data.visitedNeighborhoods, this._visitedNeighborhoods);
      data.seenLandmarks = addUnique(data.seenLandmarks, this._seenLandmarkNames);
      data.totalRoutes++;
      data.totalCorrect += this.quizCorrect;
      data.totalAttempts += this.quizAttempts;
      localStorage.setItem(EXPLORATION_STORAGE_KEY, JSON.stringify(data));
      return data;
    } catch (e) { console.warn('Could not save exploration:', e); return null; }
  }
}

window.CanalRecallGameModules = window.CanalRecallGameModules || [];
window.CanalRecallGameModules.push(GamePresentationRuntime);
