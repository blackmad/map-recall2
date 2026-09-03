// Frame composition, the menu, the pause overlay and the arrival card.
//
// The browser-facing half. What the trip is *graded* on lives in
// `routeRibbon.ts` and what the player has collected lives in
// `progressStore.ts`, both tested without a canvas. This file decides where
// things sit on screen and paints them.
//
// Methods are copied onto `Game.prototype` by `game.js`, so `this` is the Game
// instance. The interface merged into the class below is what types it.

import {
  computeRouteRibbon,
  idealRouteLength,
  type RouteRibbon,
} from './routeRibbon';
import {
  explorationGain,
  getBestTime,
  mergeExploration,
  pixelsToMiles,
  readExploration,
  recordBestTime,
  saveExploration,
  type Exploration,
} from './progressStore';
import { isCar } from './modes';
import type { PresentationHost } from './host';
import type { Landmark } from './worldTypes';

/** One measured band of the arrival card. Each block reports its own height so
 *  the card measures itself, instead of keeping a stack of hand-tuned offsets
 *  in step with the layout below. */
interface CardBlock {
  height: number;
  /** Draw a divider above this block, and give it a wider lead. */
  rule?: boolean;
  draw(top: number): void;
}

// The arrival card was the last dark surface: navy with a sky accent, sitting
// at the end of a route played entirely on paper. These are the shared tokens.
const INK = '#24322b', MUTED = '#68746e', BODY = '#3d4a43', ACCENT = '#c75f43';
const GOOD = '#356653';

export interface GamePresentationRuntime extends PresentationHost {}

export class GamePresentationRuntime {
  // ---- The frame ----

  _render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // The arrival card is a full-screen modal; on a phone the settings and help
    // buttons sat on top of its actions in the bottom-right corner.
    const utility = document.getElementById('utility-buttons');
    if (utility) utility.style.display = this.state === GameState.FINISHED ? 'none' : '';

    if (this.state === GameState.MENU) { this._renderMenu(); return; }
    if (this.state === GameState.MAP_SELECT) {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    if (this.state === GameState.LOADING) {
      this.loadingScreen.draw(ctx, this.loadingMessage, this.loadingProgress);
      return;
    }
    if (!this.player) return;
    const player = this.player;

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
    const byBoat = !isCar(this.travelMode);
    this.vectorMap.setPlayerBike(player, this.osmLoader, pitched && !byBoat);
    this.vectorMap.setPlayerBoat(player, this.osmLoader, pitched && byBoat);
    this.vectorMap.setRoute(this._liveRoutePath || this.routePath, this.osmLoader, this.routeOptions.line);
    if (!byBoat) {
      this.vectorMap.setStreetHighlights(
        this.track, this.osmLoader, this.learnedNames,
        this.quizPromptName, this.quizPromptSegmentIndex);
    }

    this.renderer.drawTrack(this.camera, this.track);
    if (byBoat) {
      this.renderer.drawQuestionFeature(
        this.camera, this.track, this.quizPromptName,
        this.quizPromptSegmentIndex, this.quizPromptPointIndex, this.raceTime);
    }
    this.renderer.drawSkidMarks(this.particles, this.camera);

    this._renderBridgeLabels();
    const meshReady = pitched
      && (byBoat ? this.vectorMap.isPlayerBoatReady() : this.vectorMap.isPlayerBikeReady());
    if (!meshReady) {
      if (byBoat) this.renderer.drawCar(player, this.camera);
      else this.renderer.drawPlayerCar(player, this.camera);
    }
    this.renderer.drawParticles(this.particles, this.camera);

    // Streets stay named on the map once you have been told the name, in the
    // car as well as the boat — that is how the name sticks while you drive
    // along it. The one being asked about is withheld, or the map would be
    // answering the question for you. A label is earned per place, not per
    // name: knowing the Overtoom at the Vondelpark must not write it across
    // the Kinkerbuurt end that has never been asked.
    this.track.drawLabels(ctx, this.camera,
      (text, x, y) => this._mapLabelNames.has(text) || this._isPlaceKnown(text, x, y),
      this.quizPromptName || this.quizCandidateName, player);

    // Results replace the live HUD rather than competing with it.
    if (this.state === GameState.FINISHED) { this._renderFinish(); return; }

    this._syncHudLayout();
    this.hud.drawTripReadout(ctx, player.speed, this._playerDistancePx());
    this.hud.drawCanalScore(ctx, this.quizCorrect, this.quizAttempts, this.quizPoints,
      this.quizFeedback, this.quizStreak, this.gameyFeatures,
      this.hud.tripText(player.speed, this._playerDistancePx()));
    // Hide a new route name from the first candidate frame, not only after the
    // delayed question opens. Otherwise the HUD reveals the answer during the
    // turn-confirmation window.
    const routeAnswerHidden = !!this.quizPromptName
      || (!!this.quizCandidateName && this.quizCandidateName !== this.quizCurrentName);
    const visibleRouteName = routeAnswerHidden ? '' : this.track.getRoadName(player.x, player.y);
    this.hud.drawCurrentLocation(ctx, visibleRouteName, this.currentNeighborhood,
      this.travelMode, routeAnswerHidden);
    this.hud.drawDestination(ctx, this.routeTo.name,
      this.track.getDistanceToFinish(player.x, player.y), this._routeLearningPlan?.expectedNovelty ?? null);

    if (this.routeOptions.arrow) {
      this.hud.drawFinishDirection(ctx, player.x, player.y,
        this.track.finishPoint.x, this.track.finishPoint.y, this.camera);
    }
    if (this.showMiniMap) this.hud.drawCityOverview(ctx, this);
    this._renderLandmarkNotice();
    this._renderNeighborhoodNotice();
    this._renderZoomBadge();
    this._renderRecenterButton();
    if (this._debugMode) this._renderDebug();
    this._renderControlsHint();

    if (this.state === GameState.RACING && !this._overlayOpen()) {
      // Last, so nothing can be drawn over the only way to steer — but not at
      // all while a question or panel owns the screen: the vehicle is stopped,
      // the card covers the pad, and a pad drawn under a card is dead controls.
      this.hud.drawDpad(ctx, this.input.padKeys);
      if (this.input.showTouchHint) this.hud.drawTouchHint(ctx);
    }
    if (this.state === GameState.PAUSED) this._renderPaused();
    if (this.state === GameState.FINISHED) this._renderFinish();
  }

  /** Place the whole HUD for this frame. One call, so every card agrees about
   *  where the others are and the phone layout stays collision-free. */
  _syncHudLayout(): void {
    const ui = window.CanalRecallUi;
    this._hudLayoutCache = ui.hudLayout({
      viewport: this.viewport,
      tripWidth: 180,
      landmarkHeight: 130,
      feedbackVisible: !!this.quizFeedback,
      neighborhoodVisible: !!this.currentNeighborhood,
      minimapVisible: this.showMiniMap,
      zoomVisible: this._zoomBadgeTimer > 0,
      controlsVisible: !this.input.isMobile && this.raceTime < CONTROLS_HINT_DURATION,
    });
    this.hud.setLayout(this._hudLayoutCache);
  }

  /** The frame's layout, computing it if a caller runs before _syncHudLayout. */
  _hudRects(): ReturnType<typeof window.CanalRecallUi.hudLayout> {
    if (!this._hudLayoutCache) this._syncHudLayout();
    return this._hudLayoutCache!;
  }

  /** The player's odometer, in world px. Not on the shared vehicle type
   *  because only the presentation layer reads it. */
  _playerDistancePx(): number {
    return (this.player as unknown as { distancePx?: number })?.distancePx ?? 0;
  }

  /** Shown briefly after a change rather than permanently: a standing "35%"
   *  reads as a mystery statistic. */
  _renderZoomBadge(): void {
    if (this._zoomBadgeTimer <= 0) return;
    const ctx = this.ctx;
    const rect = this._hudRects().zoomBadge;
    this.hud.paperCard(ctx, rect, { radius: 9 });
    ctx.fillStyle = window.CanalRecallUi.paperTheme.inkMuted;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(this.camera.zoom * 100)}%`, rect.x + rect.width / 2, rect.y + 15);
  }

  _renderRecenterButton(): void {
    if (Math.hypot(this.camera.panX, this.camera.panY) <= 40) {
      this._recenterBtnBounds = null;
      return;
    }
    const ctx = this.ctx;
    const layout = this._hudRects();
    const compact = layout.mode === 'compact';
    // 44 px is the smallest reliable touch target; the desktop button was 28.
    const width = compact ? 132 : 110, height = compact ? 44 : 28;
    const x = Math.round(CANVAS_W / 2 - width / 2);
    // Below the top card stack, which is taller on a phone than on desktop.
    const y = Math.round(compact ? layout.destination.y + layout.destination.height + 10 : 70);
    this.hud.paperCard(ctx, { x, y, width, height }, { solid: true, radius: compact ? 14 : 8 });
    ctx.fillStyle = window.CanalRecallUi.paperTheme.moss;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(compact ? 'RE-CENTER' : 'RE-CENTER (R)', CANVAS_W / 2, y + height / 2 + 4);
    this._recenterBtnBounds = { x, y, w: width, h: height };
  }

  /** Only while the player is settling in. It used to sit permanently on top
   *  of the recall panel. */
  _renderControlsHint(): void {
    if (this.input.isMobile || this.raceTime >= CONTROLS_HINT_DURATION) return;
    const ctx = this.ctx;
    const rect = this._hudRects().controlsHint;
    ctx.globalAlpha = Math.min(1, CONTROLS_HINT_DURATION - this.raceTime);
    ctx.fillStyle = window.CanalRecallUi.paperTheme.inkMuted;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?: help  G: settings  M: map  O: north  D: labels  P: pause',
      rect.x + rect.width / 2, rect.y + 9);
    ctx.globalAlpha = 1;
  }

  // ---- Menu ----

  _renderMenu(): void {
    const ctx = this.ctx;
    const cx = CANVAS_W / 2;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const t = Date.now() / 1000;
    ctx.strokeStyle = 'rgba(33,150,243,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    const flash = Math.floor(t * 3) % 2;
    for (let i = 0; i < 6; i++) {
      const px = (i * 220 + t * 40) % (CANVAS_W + 200) - 100;
      const py = 180 + Math.sin(i * 1.7 + t * 0.5) * 120;
      ctx.beginPath();
      ctx.arc(px, py + 200, 50, 0, Math.PI * 2);
      ctx.fillStyle = (i + flash) % 2 === 0 ? 'rgba(33,100,243,0.08)' : 'rgba(244,67,54,0.06)';
      ctx.fill();
    }

    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, 'rgba(10,10,20,0.9)');
    grad.addColorStop(0.4, 'rgba(10,10,20,0.7)');
    grad.addColorStop(0.7, 'rgba(10,10,20,0.8)');
    grad.addColorStop(1, 'rgba(10,10,20,0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 58px monospace';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFD700';
    ctx.fillText('AMSTERDAM CANAL RECALL', cx, 70);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Navigate the real canal network and name each waterway after you turn', cx, 100);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, cx - 320, 120, 640, 160, 10);
    ctx.fill();

    ctx.textAlign = 'left';
    const rulesX = cx - 290;
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
    rules.forEach((line, index) => ctx.fillText(line, rulesX, 165 + index * 18));

    ctx.fillStyle = '#777';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.input.isMobile
      ? 'Left side: Steer    Right side: Gas/Brake    Double-tap: Drift'
      : 'Arrow Keys / WASD - Drive    SPACE - Drift    TAB - Map    N - Sound    -/+ Zoom', cx, 298);

    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);
    ctx.fillStyle = `rgba(144,202,249,${0.4 + pulse * 0.6})`;
    ctx.font = 'bold 24px monospace';
    ctx.fillText(this.input.isMobile ? 'TAP TO START' : 'PRESS ENTER TO START', cx, CANVAS_H / 2 + 55);

    if (!this._menuQuote) {
      this._menuQuote = BANDIT_QUOTES[Math.floor(Math.random() * BANDIT_QUOTES.length)];
    }
    ctx.fillStyle = 'rgba(255,215,0,0.5)';
    ctx.font = 'italic 13px monospace';
    ctx.fillText(`"${this._menuQuote.text}"`, cx, CANVAS_H / 2 + 90);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px monospace';
    ctx.fillText(`— ${this._menuQuote.character}`, cx, CANVAS_H / 2 + 107);

    this._renderExplorationBadge(cx);
    this._renderMenuChase(t);
    this._renderMenuFooter(cx);
  }

  /** For a returning player: what they have collected so far. This used to be
   *  wrapped in a `try/catch` around an undefined `cx`, so it silently never
   *  drew at all. */
  _renderExplorationBadge(cx: number): void {
    const exploration = this._loadExploration();
    if (exploration.totalRoutes <= 0) return;
    const ctx = this.ctx;
    const known = exploration.learnedWaterways.length + exploration.learnedStreets.length;
    const parts: string[] = [];
    if (known > 0) parts.push(`${known} waterways`);
    if (exploration.visitedNeighborhoods.length > 0) parts.push(`${exploration.visitedNeighborhoods.length} hoods`);
    if (exploration.seenLandmarks.length > 0) parts.push(`${exploration.seenLandmarks.length} landmarks`);

    ctx.fillStyle = 'rgba(88,28,135,.3)';
    roundRect(ctx, cx - 200, CANVAS_H / 2 + 120, 400, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#C4B5FD';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Amsterdam: ${parts.join(' · ')} · ${exploration.totalRoutes} routes`,
      cx, CANVAS_H / 2 + 138);
  }

  _renderMenuChase(t: number): void {
    const ctx = this.ctx;
    const chaseY = CANVAS_H - 130;
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

    const carX = (t * 80) % (CANVAS_W + 300) - 100;
    ctx.save();
    ctx.translate(carX, chaseY);
    ctx.fillStyle = '#FFD700';
    roundRect(ctx, -15, -8, 30, 16, 3);
    ctx.fill();
    ctx.restore();

    const copFlash = Math.floor(t * 8) % 2;
    ctx.save();
    ctx.translate(carX - 120, chaseY);
    ctx.fillStyle = '#1A1A2E';
    roundRect(ctx, -15, -8, 30, 16, 3);
    ctx.fill();
    ctx.fillStyle = copFlash === 0 ? '#2196F3' : '#F44336';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    const radarPulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.beginPath();
    ctx.arc(0, 0, 25 + radarPulse * 10, 0, Math.PI * 2);
    ctx.strokeStyle = copFlash === 0 ? 'rgba(33,150,243,0.3)' : 'rgba(244,67,54,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(carX - 260, chaseY);
    ctx.fillStyle = '#1A1A2E';
    roundRect(ctx, -15, -8, 30, 16, 3);
    ctx.fill();
    ctx.fillStyle = copFlash === 1 ? '#2196F3' : '#F44336';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ['RICHMOND', 'CHICAGO', 'NEW YORK', 'LONDON', 'PARIS']
      .forEach((name, index) => ctx.fillText(name, 130 + index * 230, CANVAS_H - 50));
  }

  _renderMenuFooter(cx: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    const creditText = 'Vibe coded by Alan and Claude — ';
    const linkText = 'alan.is';
    const creditWidth = ctx.measureText(creditText).width;
    const linkWidth = ctx.measureText(linkText).width;
    const startX = cx - (creditWidth + linkWidth) / 2;
    ctx.textAlign = 'left';
    ctx.fillText(creditText, startX, CANVAS_H - 15);
    ctx.fillStyle = 'rgba(100,180,255,0.6)';
    ctx.fillText(linkText, startX + creditWidth, CANVAS_H - 15);
    ctx.fillRect(startX + creditWidth, CANVAS_H - 13, linkWidth, 1);
    this._alanLinkBounds = { x: startX + creditWidth, y: CANVAS_H - 26, w: linkWidth, h: 16 };

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`v${GAME_VERSION}`, CANVAS_W - 10, 15);

    const ghText = 'GitHub';
    ctx.font = '11px monospace';
    const ghWidth = ctx.measureText(ghText).width;
    const ghX = cx - ghWidth / 2;
    ctx.fillStyle = 'rgba(100,180,255,0.6)';
    ctx.textAlign = 'left';
    ctx.fillText(ghText, ghX, CANVAS_H - 2);
    ctx.fillRect(ghX, CANVAS_H, ghWidth, 1);
    this._githubLinkBounds = { x: ghX, y: CANVAS_H - 13, w: ghWidth, h: 16 };
  }

  // ---- Pause ----

  _renderPaused(): void {
    const ctx = this.ctx;
    const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, cx - 200, cy - 80, 400, 185, 12);
    ctx.fill();

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', cx, cy - 20);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px monospace';
    ctx.fillText('P / ESC / SPACE to resume', cx, cy + 25);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px monospace';
    ctx.fillText('M — back to menu', cx, cy + 45);

    if (this._shareUrl) {
      if (this._copiedTimer > 0) {
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('Copied!', cx, cy + 62);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '12px monospace';
        ctx.fillText('C — copy race link', cx, cy + 62);
      }
    }

    ctx.font = '12px monospace';
    ctx.fillStyle = '#AAA';
    const miles = this._playerDistancePx() / PIXELS_PER_METER / 1609.344;
    const progress = (this.player as unknown as { raceProgress?: number })?.raceProgress ?? 0;
    ctx.fillText(
      `Time: ${this.hud.formatTime(this.raceTime)}  |  ${miles.toFixed(2)} mi  |  ${Math.round(progress * 100)}%`,
      cx, cy + 80);
  }

  // ---- The arrival card ----

  /**
   * One surface, one type system, and a running list of blocks that report
   * their own height, so the card measures itself instead of keeping a stack
   * of hand-tuned offsets in step with the layout below.
   *
   * Time is a stat here, not the headline: the game does not reward speed, and
   * a 38 px stopwatch said it did.
   */
  _renderFinish(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(36,50,43,.42)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const cx = CANVAS_W / 2;
    const compact = this.viewport.mode === 'compact';
    // 600 is wider than a phone screen, which put the card's left edge at
    // x = -105 and its actions off the side.
    const cardW = Math.min(600, CANVAS_W - 24);
    const padX = compact ? 18 : 30;
    const cardX = cx - cardW / 2;
    const innerW = cardW - padX * 2;
    const gamey = this.gameyFeatures;
    const exploration = this._explorationSnapshot && this._explorationSnapshot.totalRoutes > 0
      ? this._explorationSnapshot : null;
    const ribbon = gamey ? this._ribbon : null;
    const landmark = this._finishLandmark();
    const image = landmark ? this._landmarkImages?.get(landmark.id) : undefined;
    const hasImage = !!image && image.complete && image.naturalWidth > 0;

    const rule = (y: number): void => {
      ctx.strokeStyle = 'rgba(97,89,74,.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + padX, y + 0.5);
      ctx.lineTo(cardX + cardW - padX, y + 0.5);
      ctx.stroke();
    };

    let bestText = '';
    if (this._raceKey) {
      const stored = getBestTime(localStorage, this._raceKey);
      if (stored && this.raceTime <= stored.time) bestText = '★  New personal best';
      else if (stored) bestText = `Personal best  ${this.hud.formatTime(stored.time)}`;
    }

    const blocks: CardBlock[] = [];

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
      const height = Math.max(photo, 20 + blurb.length * 17) + 14;
      blocks.push({ height, draw: (top) => {
        if (hasImage && image) {
          ctx.save();
          ctx.beginPath();
          roundRect(ctx, cardX + padX, top, photo, photo, 8);
          ctx.clip();
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
    const recallNoun = isCar(this.travelMode) ? 'Streets' : 'Canals';
    const accuracy = this.quizAttempts > 0 ? Math.round(100 * this.quizCorrect / this.quizAttempts) : 0;
    const stats = [
      { label: recallNoun, value: `${this.quizCorrect}/${this.quizAttempts}` },
      { label: 'Recall', value: `${accuracy}%` },
      { label: 'Time', value: this.hud.formatTime(this.raceTime).slice(0, -2) },
      { label: 'Distance', value: `${(this._playerDistancePx() / PIXELS_PER_METER / 1000).toFixed(2)} km` },
    ];
    if (gamey) stats.splice(2, 0, { label: 'Points', value: String(this.quizPoints) });

    const footerBits = [
      this.routeDifficulty.charAt(0).toUpperCase() + this.routeDifficulty.slice(1),
      isCar(this.travelMode) ? 'Bike' : 'Boat',
      this.viewMode.replace('-', ' ').replace(/^./, c => c.toUpperCase()),
    ];
    if (gamey && this.quizBestStreak >= 2) footerBits.push(`Best streak ${this.quizBestStreak}`);

    // Five stats across a 600 px card is four columns of comfortable space; the
    // same five across a 366 px phone card ran "420", "03:33" and "0.00 km"
    // into each other. On a phone they wrap into rows of at most three.
    const statsPerRow = compact ? Math.min(3, stats.length) : stats.length;
    const statRows = Math.ceil(stats.length / statsPerRow);
    const ROW_H = 48;
    blocks.push({ height: 30 + statRows * ROW_H, rule: true, draw: (top) => {
      ctx.textAlign = 'center';
      stats.forEach((stat, index) => {
        const row = Math.floor(index / statsPerRow);
        // The last row is centred rather than left-packed, so a trailing pair
        // does not sit under the first two columns with a gap beside it.
        const inRow = Math.min(statsPerRow, stats.length - row * statsPerRow);
        const column = innerW / inRow;
        const sx = cardX + padX + column * ((index % statsPerRow) + 0.5);
        const sy = top + row * ROW_H;
        ctx.fillStyle = INK; ctx.font = `bold ${compact ? 19 : 21}px monospace`;
        ctx.fillText(stat.value, sx, sy + 24);
        ctx.fillStyle = MUTED; ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(stat.label, sx, sy + 42);
      });
      ctx.fillStyle = MUTED; ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(footerBits.join('  ·  '), cx, top + statRows * ROW_H + 18);
    } });

    if (ribbon) {
      blocks.push({ height: 86, rule: true, draw: (top) => {
        this._renderRouteRibbon(ctx, cardX + padX, top + 6, innerW, 74);
      } });
    }

    if (exploration) {
      const known = exploration.learnedWaterways.length + exploration.learnedStreets.length;
      const totals: string[] = [];
      if (known > 0) totals.push(`${known} names`);
      if (exploration.visitedNeighborhoods.length > 0) totals.push(`${exploration.visitedNeighborhoods.length} neighborhoods`);
      if (exploration.seenLandmarks.length > 0) totals.push(`${exploration.seenLandmarks.length} landmarks`);
      const fresh: string[] = [];
      if (this.learnedNames.size > 0) fresh.push(`${this.learnedNames.size} names`);
      if (this._visitedNeighborhoods.size > 0) fresh.push(`${this._visitedNeighborhoods.size} neighborhoods`);
      if (this._seenLandmarkNames.size > 0) fresh.push(`${this._seenLandmarkNames.size} landmarks`);
      // The label sits beside the totals on a wide card and above them on a
      // phone: right-aligned totals ran straight into "CITY KNOWLEDGE".
      const knowledgeStacked = compact;
      const knowledgeH = (knowledgeStacked ? 34 : 18) + (fresh.length ? 20 : 0) + 18;
      blocks.push({ height: knowledgeH, rule: true, draw: (top) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = MUTED; ctx.font = 'bold 9px monospace';
        ctx.fillText('CITY KNOWLEDGE', cardX + padX, top + 12);
        ctx.fillStyle = BODY; ctx.font = '12px system-ui, sans-serif';
        if (knowledgeStacked) {
          ctx.fillText(totals.join('  ·  ') || 'Start exploring', cardX + padX, top + 30);
        } else {
          ctx.textAlign = 'right';
          ctx.fillText(totals.join('  ·  ') || 'Start exploring', cardX + cardW - padX, top + 12);
        }
        if (fresh.length) {
          ctx.textAlign = 'left';
          ctx.fillStyle = ACCENT;
          ctx.font = '11px system-ui, sans-serif';
          ctx.fillText(`+${fresh.join(', +')} this route`,
            cardX + padX, top + (knowledgeStacked ? 50 : 32));
        }
      } });
    }

    if (bestText) {
      blocks.push({ height: 26, draw: (top) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = bestText.startsWith('★') ? GOOD : MUTED;
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(bestText, cardX + padX, top + 14);
      } });
    }

    // A phone has no ENTER, ESC or C, so the keycaps that document the actions
    // on a keyboard are the actions themselves on touch: full-width buttons
    // with 44 px targets, hit-tested against `_finishButtonBounds`.
    type FinishAction = { id: 'again' | 'route' | 'copy'; key: string; caption: string };
    const actions: FinishAction[] = [
      { id: 'again', key: 'ENTER', caption: 'Try again' },
      { id: 'route', key: 'ESC', caption: 'Choose route' },
    ];
    if (this._shareUrl) {
      actions.push({ id: 'copy', key: 'C', caption: this._copiedTimer > 0 ? 'Link copied' : 'Copy race link' });
    }
    const BUTTON_H = 44, BUTTON_GAP = 8;
    const finishButtons: NonNullable<typeof this._finishButtonBounds> = [];
    this._finishButtonBounds = finishButtons;
    blocks.push({
      height: compact ? actions.length * BUTTON_H + (actions.length - 1) * BUTTON_GAP : 34,
      rule: true,
      draw: (top) => {
        if (compact) {
          let by = top;
          for (const action of actions) {
            const primary = action.id === 'again';
            const bounds = { x: cardX + padX, y: by, w: cardW - padX * 2, h: BUTTON_H };
            ctx.fillStyle = primary ? '#356653' : 'rgba(238,233,223,.9)';
            roundRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, 12);
            ctx.fill();
            if (!primary) {
              ctx.strokeStyle = 'rgba(97,89,74,.28)'; ctx.lineWidth = 1; ctx.stroke();
            }
            ctx.textAlign = 'center';
            ctx.fillStyle = primary ? '#ffffff' : (action.caption === 'Link copied' ? GOOD : INK);
            ctx.font = '700 14px system-ui, sans-serif';
            ctx.fillText(action.caption, bounds.x + bounds.w / 2, by + 28);
            finishButtons.push({ ...bounds, id: action.id });
            by += BUTTON_H + BUTTON_GAP;
          }
          ctx.textAlign = 'left';
          return;
        }
        ctx.textAlign = 'left';
        let ax = cardX + padX;
        for (const action of actions) {
          ctx.font = 'bold 11px monospace';
          const keyW = ctx.measureText(action.key).width + 14;
          ctx.fillStyle = 'rgba(97,89,74,.14)';
          roundRect(ctx, ax, top + 4, keyW, 20, 5);
          ctx.fill();
          ctx.fillStyle = INK;
          ctx.fillText(action.key, ax + 7, top + 18);
          ax += keyW + 8;
          ctx.fillStyle = action.caption === 'Link copied' ? GOOD : MUTED;
          ctx.font = '12px system-ui, sans-serif';
          ctx.fillText(action.caption, ax, top + 18);
          ax += ctx.measureText(action.caption).width + 22;
        }
      },
    });

    // Measurement and drawing share one formula for the space above a block,
    // so the card cannot end up with a band of dead space at the bottom.
    const GAP = 16, PAD_TOP = 30, PAD_BOTTOM = 26;
    const leadFor = (block: CardBlock, index: number): number =>
      (index === 0 ? 0 : block.rule ? GAP * 2 : GAP);
    let cardH = PAD_TOP + PAD_BOTTOM;
    blocks.forEach((block, index) => { cardH += leadFor(block, index) + block.height; });
    const cardY = Math.max(16, Math.min(
      Math.round((CANVAS_H - cardH) / 2), Math.max(16, CANVAS_H - cardH - 16)));

    this.hud.paperCard(ctx, { x: cardX, y: cardY, width: cardW, height: cardH },
      { solid: true, radius: 16 });

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

  /** The landmark that stands for the destination: the one that shares its
   *  name, or failing that the nearest one to the finish point. */
  _finishLandmark(): Landmark | null {
    if (!this.routeTo || this.routeTo.id === 'home' || !this.landmarks) return null;
    const wanted = this._normaliseCanalName(this.routeTo.name);
    const byName = this.landmarks.find(
      landmark => this._normaliseCanalName(landmark.name) === wanted);
    if (byName) return byName;
    if (!this.track) return null;

    let nearest: Landmark | null = null;
    let nearestDistance = 220;
    for (const landmark of this.landmarks) {
      const distance = Math.hypot(
        landmark.x - this.track.finishPoint.x, landmark.y - this.track.finishPoint.y);
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    return nearest;
  }

  /** A medal, the tier, and the per-axis breakdown, so the grade explains
   *  itself rather than reading as a black box. */
  _renderRouteRibbon(
    ctx: CanvasRenderingContext2D, boxX: number, boxY: number, boxW: number, boxH: number,
  ): void {
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

  // ---- Grading and persistence ----
  //
  // Thin adapters: the rules are in routeRibbon.ts and progressStore.ts.

  _idealRouteLength(): number {
    return idealRouteLength(this._plannedRouteLengthPx, this.routePath);
  }

  _computeRouteRibbon(): RouteRibbon {
    return computeRouteRibbon({
      correct: this.quizCorrect,
      attempts: this.quizAttempts,
      aidsUsed: this._assistUsage || {},
      typedAnswers: this.routeOptions.answerMode === 'typing',
      idealPx: this._idealRouteLength(),
      actualPx: this._playerDistancePx(),
    });
  }

  _getBestTime(key: string | null) {
    return getBestTime(localStorage, key);
  }

  _saveBestTime(): void {
    try {
      recordBestTime(localStorage, this._raceKey, {
        time: this.raceTime,
        date: new Date().toISOString(),
        distance: pixelsToMiles(this._playerDistancePx(), PIXELS_PER_METER),
      });
    } catch (error) {
      console.warn('Could not save best time:', error);
    }
  }

  _loadExploration(): Exploration {
    return readExploration(localStorage);
  }

  /** Returns the merged collection so the finish card can show both the totals
   *  and what this route added. */
  _saveExploration(): Exploration | null {
    try {
      const before = readExploration(localStorage);
      const after = mergeExploration(before, {
        byBoat: !isCar(this.travelMode),
        learnedNames: this.learnedNames,
        visitedNeighborhoods: this._visitedNeighborhoods,
        seenLandmarkNames: this._seenLandmarkNames,
        correct: this.quizCorrect,
        attempts: this.quizAttempts,
      });
      saveExploration(localStorage, after);
      return after;
    } catch (error) {
      console.warn('Could not save exploration:', error);
      return null;
    }
  }

  /** What this route added, for the finish card. */
  _explorationGain(before: Exploration, after: Exploration) {
    return explorationGain(before, after);
  }
}

window.CanalRecallGameModules = window.CanalRecallGameModules || [];
window.CanalRecallGameModules.push(GamePresentationRuntime);
