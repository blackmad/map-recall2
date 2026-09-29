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
  type ExplorationGain,
} from './progressStore';
import { notePlaceDay, placeStreakLabel, readPlaceStreak } from './placeStreak';
import {
  readPassport,
  savePassport,
  stampNewNeighborhoods,
} from './neighborhoodPassport';
import { finishStory } from './finishStory';
import { missionBrief } from './missionBrief';
import { introFrame, introOverview, introPlan } from './introFlight';
import { COLD_OPEN_ENABLED } from './coldOpenReview';
import { isCar, isBoat, isTransit } from './modes';
import { travelProfile } from './travelProfile';
import type { PresentationHost } from './host';
import type { Landmark } from './worldTypes';
import { canShowMiniMap, canShowPoiLabels, type TeachingGateInput } from './teachingSurface';
import { bicycleRestrictionNotice } from '../routing/bikeAccess';
import { maskSpoiledName } from '../orientationPois';

/** One measured band of the arrival card. Each block reports its own height so
 *  the card measures itself, instead of keeping a stack of hand-tuned offsets
 *  in step with the layout below. */
interface CardBlock {
  height: number;
  /** Draw a divider above this block, and give it a wider lead. */
  rule?: boolean;
  draw(top: number): void;
}

// Arrival-card type on the daylight paper plate (ink / copper). Card fill
// itself comes from `hud.paperCard` → `hudSurface`.
const INK = '#1f1c17';
const MUTED = '#5f584d';
const BODY = '#2e2a23';
const ACCENT = '#8a4a18';
const GOOD = '#8a4a18';
// Button fill under ink text: copper-mid, 5.6:1 with INK (the darker accent was 4.0:1).
const COPPER = '#c9844a';
const RULE = 'rgba(31,28,23,0.16)';
/** How long a tap or mouse move keeps the settings/help buttons up mid-ride. */
const UTILITY_REVEAL_MS = 3500;

export interface GamePresentationRuntime extends PresentationHost {}

export class GamePresentationRuntime {
  /** Return focus to the canvas after a card action so keyboard driving resumes. */
  _reclaimKeyboardFocus(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== this.canvas) active.blur();
    try { this.canvas.focus({ preventScroll: true }); }
    catch { this.canvas.focus(); }
  }

  /** Logical canvas coordinates shared by mouse, pointer, and touch input. */
  _eventPoint(event: MouseEvent | PointerEvent | Touch): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left) * CANVAS_W / rect.width, y: (event.clientY - rect.top) * CANVAS_H / rect.height };
  }

  // ---- Start-of-ride orientation flight ----

  /** Open the ride on an overview of start and destination, then fly down.
   *  Automated browsers skip it — dozens of specs inspect the driving camera
   *  straight after spawning — unless they set `__canalRecallForceIntro`. */
  _beginIntro(): void {
    const prepared = this._introPrepared;
    this._introPrepared = null;
    this._intro = null;
    const planned = prepared || this._planIntro();
    if (!planned) {
      this.camera.introOverview = 0;
      return;
    }
    this._intro = { plan: planned.plan, elapsed: 0, playZoom: planned.playZoom, overview: 1 };
    this.camera.resetPan();
    this.camera.rotation = 0;
    this.camera.introOverview = 1;
    this._applyIntroCamera(planned.plan.from.x, planned.plan.from.y, planned.plan.from.zoom);
  }

  /** The overview framing for this ride, or null when there is no flight. */
  _planIntro(): { plan: import('./introFlight').IntroPlan; playZoom: number } | null {
    const player = this.player;
    const finish = this.track?.finishPoint;
    if (!player || !finish) return null;
    const forced = (window as unknown as { __canalRecallForceIntro?: boolean }).__canalRecallForceIntro;
    if (navigator.webdriver && !forced) return null;
    this._syncHudLayout();
    const layout = this._hudRects();
    const top = layout.destinationInRecall
      ? layout.recall.y + layout.recall.height
      : Math.max(layout.recall.y + layout.recall.height, layout.destination.y + layout.destination.height);
    const bottom = layout.dpad ? CANVAS_H - layout.dpad.bounds.y : 40;
    const playZoom = this.camera.zoom;
    const start = { x: player.x, y: player.y };
    const box = { width: CANVAS_W, height: CANVAS_H, top: top + 8, bottom: bottom + 8 };
    let from = introOverview(start, finish, box, playZoom);
    // Fit through the projection actually drawn, not the flat maths: aim,
    // measure where the two pins land, refit with the measured scale. Two
    // rounds converge; the flat guess alone was ~2× off on a retina desktop.
    const previous = { introOverview: this.camera.introOverview, rotation: this.camera.rotation };
    this.camera.introOverview = 1;
    this.camera.rotation = 0;
    for (let round = 0; round < 2; round++) {
      this._applyIntroCamera(from.x, from.y, from.zoom);
      this.vectorMap.sync(this.camera, this.osmLoader, this.canvas);
      const a = this.camera.worldToScreen(start.x, start.y);
      const b = this.camera.worldToScreen(finish.x, finish.y);
      const worldSpan = Math.hypot(finish.x - start.x, finish.y - start.y) * from.zoom;
      const scale = Math.hypot(b.x - a.x, b.y - a.y) / worldSpan;
      if (!Number.isFinite(scale) || scale <= 0.05 || scale > 20) break;
      from = introOverview(start, finish, box, playZoom, scale);
    }
    this.camera.introOverview = previous.introOverview;
    this.camera.rotation = previous.rotation;
    return { plan: introPlan(from, this.camera.reducedMotion), playZoom };
  }

  /** Aim the map at the overview while the loading screen is still up, so
   *  the city-scale tiles load there instead of in the flight's first frame
   *  (a ~2 s hitch at 4× CPU throttle). True when the caller should wait for
   *  the map to settle before racing. */
  _prepareIntro(): boolean {
    const planned = this._planIntro();
    this._introPrepared = planned;
    if (!planned) return false;
    this.camera.resetPan();
    this.camera.rotation = 0;
    this.camera.introOverview = 1;
    this._applyIntroCamera(planned.plan.from.x, planned.plan.from.y, planned.plan.from.zoom);
    this.vectorMap.sync(this.camera, this.osmLoader, this.canvas);
    return true;
  }

  _applyIntroCamera(x: number, y: number, zoom: number): void {
    this.camera.x = x;
    this.camera.y = y;
    this.camera.zoom = zoom;
  }

  /** Advance the flight. True while it still owns the frame. Any input skips
   *  it: the flight is orientation, never a gate in front of the controls. */
  _updateIntro(dt: number): boolean {
    const intro = this._intro;
    const player = this.player;
    if (!intro || !player) return false;
    const to = { x: player.x, y: player.y, zoom: intro.playZoom };
    intro.elapsed += dt;
    const frame = this.input.anyInput
      ? { ...to, overview: 0, done: true }
      : introFrame(intro.plan, to, intro.elapsed);
    this._applyIntroCamera(frame.x, frame.y, frame.zoom);
    intro.overview = frame.overview;
    this.camera.introOverview = frame.overview;
    // North-up on the overview, easing into the driving orientation, so a
    // heading-up camera does not snap round at the landing.
    const cam = this.camera;
    const is3d = cam.viewMode === 'chase' || cam.viewMode === 'cockpit';
    const wanted = (cam.northUp || cam.holdHeading ? 0 : player.angle + Math.PI / 2) + (is3d ? cam.bearingOffset : 0);
    const delta = Math.atan2(Math.sin(wanted), Math.cos(wanted));
    cam.rotation = delta * (1 - frame.overview);
    if (frame.done) {
      cam.zoom = intro.playZoom;
      cam.introOverview = 0;
      this._intro = null;
      return false;
    }
    return true;
  }

  /** "You" and the way to the destination, while the overview is up. The
   *  destination pin itself is the renderer's; it is screen-sized, so it
   *  already reads at city scale. No street or canal names are drawn. */
  _renderIntroOverlay(): void {
    const intro = this._intro;
    const player = this.player;
    if (!intro || !player || intro.overview <= 0.02) return;
    const ctx = this.ctx;
    const surface = window.CanalRecallUi.hudSurface;
    const alpha = Math.min(1, intro.overview * 1.4);
    const here = this.camera.worldToScreen(player.x, player.y);
    const finish = this.camera.worldToScreen(this.track.finishPoint.x, this.track.finishPoint.y);
    ctx.save();
    ctx.globalAlpha = alpha;

    // A faint straight bearing between the two, not the route: the flight
    // says which way, the ride teaches how.
    ctx.strokeStyle = surface.arrow;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(here.x, here.y);
    ctx.lineTo(finish.x, finish.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pulsing ring on the vehicle, which is a speck at this scale.
    const pulse = (intro.elapsed % 1.2) / 1.2;
    ctx.strokeStyle = surface.arrow;
    ctx.lineWidth = 3;
    ctx.globalAlpha = alpha * (1 - pulse);
    ctx.beginPath();
    ctx.arc(here.x, here.y, 10 + pulse * 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = surface.arrow;
    ctx.strokeStyle = '#fbf8f2';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(here.x, here.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const tag = 'YOU';
    ctx.font = `800 12px ${surface.fontPlaque}`;
    const tagWidth = ctx.measureText(tag).width + 16;
    const tagRect = { x: Math.round(here.x - tagWidth / 2), y: Math.round(here.y - 38), width: tagWidth, height: 20 };
    this.hud.paperCard(ctx, tagRect, { solid: true, radius: 6 });
    ctx.fillStyle = surface.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, here.x, tagRect.y + 11);

    // Skip affordance where the stick will be (it is not drawn yet), or in
    // the desktop controls-hint slot, which yields to it.
    const layout = this._hudRects();
    const hintY = layout.dpad ? layout.dpad.cy : CANVAS_H - 28;
    const hint = layout.mode === 'compact' ? 'tap to start riding' : 'press any key to start';
    ctx.font = `600 12px ${surface.fontUi}`;
    const hintWidth = ctx.measureText(hint).width + 24;
    this.hud.paperCard(ctx, { x: Math.round(CANVAS_W / 2 - hintWidth / 2), y: hintY - 12, width: hintWidth, height: 24 }, { radius: 9 });
    ctx.fillStyle = surface.inkMuted;
    ctx.fillText(hint, CANVAS_W / 2, hintY + 1);
    ctx.restore();
  }

  /** Canvas camera controls and card hit targets belong with the presentation layer. */
  _setupCameraGestures(): void {
    let dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0, pinchDistance = 0;
    let detachedBeforeDrag = false;
    const livePinch = new Map<number, { x: number; y: number }>();
    // `_cameraZoom` / `_liveZoom` were never assigned once settings moved into
    // the React overlay, so this threw on every pinch step before the step
    // was recorded, and each step multiplied by the distance since the pinch
    // began: a 1.1x pinch zoomed 1.7x (user report 2026-09-28, "zoom in out
    // on mobile is way too sensitive"). Look the sliders up, and tolerate
    // their absence.
    const syncZoom = () => {
      for (const id of ['camera-zoom', 'live-zoom']) {
        const input = document.getElementById(id) as HTMLInputElement | null;
        if (input) input.value = String(this.camera.zoom);
      }
    };
    this.canvas.addEventListener('wheel', event => {
      if (this.state === GameState.MENU) return;
      event.preventDefault();
      if (event.ctrlKey) { this.camera.zoom = Math.min(this.camera.maxZoom, Math.max(this.camera.minZoom, this.camera.zoom * Math.exp(-event.deltaY * .002))); this._zoomTouchedByPlayer = true; }
      else this.camera.pan(event.deltaX, event.deltaY);
      syncZoom();
    }, { passive: false });
    this.canvas.addEventListener('touchstart', event => {
      for (const touch of event.changedTouches) {
        const point = this._eventPoint(touch);
        if (!window.CanalRecallUi.isInsideDpad(point, this.input.dpad)) livePinch.set(touch.identifier, point);
      }
      const points = [...livePinch.values()];
      if (points.length === 2) {
        pinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        // The first finger of a pinch lands alone and starts a drag. A pinch
        // is not a pan: drop the drag and whatever it moved, or every pinch
        // detached the camera and left the bike off screen (user report
        // 2026-09-28).
        if (dragging) {
          dragging = false;
          if (!detachedBeforeDrag) this.camera.resetPan();
        }
      }
    }, { passive: true });
    this.canvas.addEventListener('touchmove', event => {
      let changed = false;
      for (const touch of event.changedTouches) if (livePinch.has(touch.identifier)) { livePinch.set(touch.identifier, this._eventPoint(touch)); changed = true; }
      const points = [...livePinch.values()];
      if (!changed || points.length !== 2) return;
      event.preventDefault();
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (pinchDistance > 0 && distance > 0) { this.camera.zoom = Math.min(this.camera.maxZoom, Math.max(this.camera.minZoom, this.camera.zoom * distance / pinchDistance)); this._zoomTouchedByPlayer = true; syncZoom(); }
      pinchDistance = distance;
    }, { passive: false });
    const endPinch = (event: TouchEvent) => { for (const touch of event.changedTouches) livePinch.delete(touch.identifier); if (livePinch.size < 2) pinchDistance = 0; };
    this.canvas.addEventListener('touchend', endPinch, { passive: true });
    this.canvas.addEventListener('touchcancel', endPinch, { passive: true });
    const revealUtility = () => { this._utilityRevealUntil = performance.now() + UTILITY_REVEAL_MS; };
    this.canvas.addEventListener('pointerdown', event => {
      if (!window.CanalRecallUi.isInsideDpad(this._eventPoint(event), this.input.dpad)) revealUtility();
    });
    let lastMouse = { x: 0, y: 0 };
    this.canvas.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      if (Math.hypot(event.clientX - lastMouse.x, event.clientY - lastMouse.y) > 12) revealUtility();
      lastMouse = { x: event.clientX, y: event.clientY };
    });
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || this.state === GameState.MENU || livePinch.size >= 2 || window.CanalRecallUi.isInsideDpad(this._eventPoint(event), this.input.dpad)) return;
      dragging = true; moved = false; detachedBeforeDrag = !!this.camera.detached;
      downX = lastX = event.clientX; downY = lastY = event.clientY; this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!dragging || livePinch.size >= 2) return;
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) moved = true;
      // A tap wobbles a few pixels; only a real drag detaches the camera.
      if (!moved) return;
      this.camera.pan(lastX - event.clientX, lastY - event.clientY); lastX = event.clientX; lastY = event.clientY;
    });
    this.canvas.addEventListener('pointerup', event => {
      if (dragging && !moved) {
        const { x, y } = this._eventPoint(event);
        const hit = (bounds: { x: number; y: number; w: number; h: number }) => x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
        const finish = this.state === GameState.FINISHED && this._finishButtonBounds?.find(hit);
        const pause = this.state === GameState.PAUSED && this._pauseButtonBounds?.find(hit);
        if (finish) this._runFinishAction(finish.id);
        else if (pause && this._runPauseAction) this._runPauseAction(pause.id);
        else if (this._recenterBtnBounds && hit(this._recenterBtnBounds)) this.camera.resetPan();
        else if (this._landmarkCardBounds && hit(this._landmarkCardBounds)) this._expandLandmarkNotice();
        else this._inspectBuildingAt(event.clientX, event.clientY);
      }
      dragging = false;
    });
  }

  /** True while a DOM overlay owns the screen — quiz, utility, or article. */
  _overlayOpen(): boolean {
    if (this._utilityOpen) return true;
    if (this._prompt && this._prompt.style.display !== 'none' && this._prompt.style.display !== '') {
      return true;
    }
    const panel = document.getElementById('landmark-panel');
    return !!panel && getComputedStyle(panel).display !== 'none';
  }

  /** One teaching surface at a time — see `teachingSurface.ts`. */
  _teachingGate(): TeachingGateInput {
    const promptVisible = !!(this._prompt
      && this._prompt.style.display !== 'none'
      && this._prompt.style.display !== '');
    const panel = document.getElementById('landmark-panel');
    const landmarkPanelOpen = !!panel && getComputedStyle(panel).display !== 'none';
    return {
      quizOpen: !!this.quizPromptName,
      feedbackVisible: !!this.quizFeedback,
      promptVisible,
      utilityOpen: !!this._utilityOpen || landmarkPanelOpen,
    };
  }

  /** Active city catalog entry (extract path, centre, geocode bounds). */
  _activeCity() {
    const Prefs = window.CanalRecallPreferences;
    const id = this.cityId || (Prefs && Prefs.DEFAULT_CITY_ID) || 'amsterdam';
    return Prefs && Prefs.cityById ? Prefs.cityById(id) : {
      id,
      name: id,
      extractPath: `../data/extracts/${id}`,
      center: { lat: 52.372851, lng: 4.8936 },
      geocodeSuffix: `, ${id}`,
      geocodeViewbox: [4.72, 52.43, 5.02, 52.27] as [number, number, number, number],
      provinceCaption: '',
      curatedPois: [],
    };
  }

  _curatedRoutePois() {
    const curated = this._activeCity().curatedPois || [];
    return curated.map(poi => ({ ...poi }));
  }

  _cityDisplayName(): string {
    return this._activeCity().name || 'Amsterdam';
  }

  /** The destination as the ride may show it: with any street or water name
   *  from this track hidden, so "Keizersgrachtkerk" cannot answer the
   *  Keizersgracht question. The arrival card still shows the real name. */
  _destinationLabel(): string {
    const name = this.routeTo?.name || '';
    // Mask only the answer of the question open right now. Masking every
    // street in the ride cut most destinations to "…kerk" for the whole ride
    // (user report 2026-09-28, "this should not cut off my destination");
    // the spoiler only matters while that street is being asked.
    const asking = this.quizPromptName || '';
    const key = `${name}|${asking}`;
    if (this._destinationLabelKey !== key) {
      this._destinationLabelKey = key;
      this._destinationLabelText = asking ? maskSpoiledName(name, [asking]) : name;
    }
    return this._destinationLabelText || name;
  }

  /** Re-layout when the window no longer matches the last layout. Phones can
   *  settle their width after load (980 → 390 in iPhone emulation) without a
   *  resize event reaching the game, which left the whole HUD drawn at ~47%
   *  scale with 5 px text (UI review 2026-09-26). One comparison per frame. */
  _syncViewportSize(): void {
    const key = `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}`;
    if (key === this._viewportKey) return;
    this._viewportKey = key;
    if (typeof this._resize === 'function') this._resize();
  }

  // ---- The frame ----

  _render(): void {
    this._syncViewportSize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // The arrival card is a full-screen modal; on a phone the settings and help
    // buttons sat on top of its actions in the bottom-right corner.
    const utility = document.getElementById('utility-buttons');
    // Nor while loading: there is nothing yet to configure or explain.
    if (utility) {
      utility.style.display = this.state === GameState.FINISHED || this.state === GameState.LOADING ? 'none' : '';
      // While riding they stay out of the corridor until asked for: a tap on
      // the map (not the stick) or a mouse move brings them up for a moment.
      // Keys G and ? work regardless.
      const riding = this.state === GameState.RACING && !this._utilityOpen;
      const revealed = !riding || performance.now() < (this._utilityRevealUntil || 0);
      utility.classList.toggle('tucked', !revealed);
    }

    if (this.state === GameState.MENU) { this._renderMenu(); return; }
    if (this.state === GameState.MAP_SELECT) {
      // Paper, like the setup it sits between; it flashed black before.
      ctx.fillStyle = '#f4efe5';
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
    // The intro flight changes zoom every frame; that is not the player's zoom.
    if (this._intro) this._lastZoomShown = this.camera.zoom;
    if (this._lastZoomShown !== this.camera.zoom) {
      this._lastZoomShown = this.camera.zoom;
      this._zoomBadgeTimer = ZOOM_BADGE_DURATION;
    }

    // Transparent game world over the live MapLibre vector basemap.
    this.vectorMap.sync(this.camera, this.osmLoader, this.canvas);
    // Both travel modes have a real model now; the canvas glyph stays only as
    // the loading fallback, and is not painted over a mesh that is ready.
    const pitched = this.viewMode === 'chase' || this.viewMode === 'cockpit';
    const byBoat = isBoat(this.travelMode);
    const byTransit = isTransit(this.travelMode);
    const showBike = !byBoat && !byTransit;
    this.vectorMap.setPlayerBike(player, this.osmLoader, pitched && showBike);
    this.vectorMap.setPlayerBoat(player, this.osmLoader, pitched && byBoat);
    if (typeof this.vectorMap.setPlayerTransit === 'function') {
      let underground = false;
      if (byTransit && this.track && typeof this.track.getNearestRoad === 'function') {
        const contact = this.track.getNearestRoad(player.x, player.y, player.angle);
        const seg = contact && this.track.segments ? this.track.segments[contact.segIdx] : null;
        underground = !!(seg && seg.type === 'metro');
      }
      this.vectorMap.setPlayerTransit(player, this.osmLoader, pitched && byTransit, underground);
    }
    this.vectorMap.setRoute(this._liveRoutePath || this.routePath, this.osmLoader, this.routeOptions.line);
    // While a question is open this is the feature being asked about; for the
    // answer hold it is the feature just answered, so a miss shows where the
    // right one runs.
    const reveal = this.quizPromptName ? null : this._answerReveal;
    const litName = this.quizPromptName || reveal?.name || '';
    const litSegment = this.quizPromptName ? this.quizPromptSegmentIndex : (reveal?.segmentIndex ?? -1);
    const litPoint = this.quizPromptName ? this.quizPromptPointIndex : (reveal?.pointIndex ?? 0);
    if (!byBoat) {
      this.vectorMap.setStreetHighlights(
        this.track, this.osmLoader, this.learnedNames,
        litName, litSegment);
    }

    this.renderer.drawTrack(this.camera, this.track);
    if (byBoat) {
      this.renderer.drawQuestionFeature(
        this.camera, this.track, litName,
        litSegment, litPoint, this.raceTime);
    }
    this.renderer.drawSkidMarks(this.particles, this.camera);

    this._renderBridgeLabels();
    const meshReady = pitched && (
      byBoat ? this.vectorMap.isPlayerBoatReady()
        : byTransit
          ? (typeof this.vectorMap.isPlayerTransitReady === 'function' && this.vectorMap.isPlayerTransitReady())
          : this.vectorMap.isPlayerBikeReady()
    );
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
    const teaching = this._teachingGate();
    const showMiniMap = canShowMiniMap(this.showMiniMap, teaching);
    // Hide a new route name from the first candidate frame, not only after the
    // delayed question opens. Otherwise the HUD reveals the answer during the
    // turn-confirmation window. Transit keeps a sticky line plaque after the
    // first answer — stop/street quizzes must not blank it.
    const roadName = this.track.getRoadName(player.x, player.y, player.angle);
    let visibleRouteName = '';
    let routeAnswerHidden = false;
    if (isTransit(this.travelMode) && window.CanalRecallTransit?.transitPlaqueRouteName) {
      const plaque = window.CanalRecallTransit.transitPlaqueRouteName({
        activeLine: this._activeTransitLine || '',
        roadName: roadName || '',
        quizPromptName: this.quizPromptName || '',
        quizPromptSubject: this.quizPromptSubject || '',
        quizCandidateName: this.quizCandidateName || '',
        quizCurrentName: this.quizCurrentName || '',
        transitLegIndex: this._transitLegIndex || 0,
      });
      visibleRouteName = plaque.routeName;
      routeAnswerHidden = plaque.answerHidden;
    } else {
      routeAnswerHidden = !!this.quizPromptName
        || (!!this.quizCandidateName && this.quizCandidateName !== this.quizCurrentName);
      visibleRouteName = routeAnswerHidden ? '' : (roadName || '');
    }
    // One plaque: street, neighbourhood + trip, score. Speed and odometer live
    // here on every viewport; there is no separate trip pill any more.
    const { feedback, restrictionNote } = this._plaqueNotes();
    // The finish arrow sits inside the destination card, so the heading and
    // the distance are one readout instead of two boxes saying "955 m". On a
    // portrait phone that card is folded into the plaque itself.
    const finishAngle = this.routeOptions.arrow
      ? this.hud.finishDirection(player.x, player.y,
        this.track.finishPoint.x, this.track.finishPoint.y, this.camera)
      : null;
    const destinationLabel = this._destinationLabel();
    const distanceToFinish = this.track.getDistanceToFinish(player.x, player.y);
    const merged = this._hudRects().destinationInRecall;
    this.hud.drawPlaque(ctx, {
      routeName: visibleRouteName,
      neighborhood: this.currentNeighborhood,
      answerHidden: routeAnswerHidden,
      correct: this.quizCorrect,
      attempts: this.quizAttempts,
      points: this.quizPoints,
      streak: this.quizStreak,
      gamey: this.gameyFeatures,
      trip: this.hud.tripText(player.speed, this._playerDistancePx()),
      feedback,
      restrictionNote,
      destination: merged ? {
        // "to your destination" says nothing; only a real name earns room.
        name: destinationLabel && destinationLabel !== 'your destination' ? destinationLabel : '',
        distancePx: distanceToFinish,
        arrowAngle: finishAngle,
      } : null,
    });
    if (!merged) {
      this.hud.drawDestination(ctx, destinationLabel, distanceToFinish,
        this._routeLearningPlan?.expectedNovelty ?? null, finishAngle);
    }

    this.hud.drawCompass(ctx, this.camera);
    if (showMiniMap) this.hud.drawCityOverview(ctx, this);
    this.vectorMap.setQuizQuietMap(!canShowPoiLabels(true, teaching));
    this._renderLandmarkNotice();
    this._renderNeighborhoodNotice();
    this._renderZoomBadge();
    this._renderRecenterButton();
    if (this._debugMode) this._renderDebug();
    this._renderControlsHint();
    this._renderIntroOverlay();

    if (this.state === GameState.RACING && !this._overlayOpen() && !this._intro) {
      // Last, so nothing can be drawn over the only way to steer — but not at
      // all while a question or panel owns the screen: the vehicle is stopped,
      // the card covers the stick, and a stick drawn under a card is dead controls.
      this.hud.drawStick(ctx, this.input.stickView);
      if (this.input.showTouchHint) this.hud.drawTouchHint(ctx, this.controlMode);
    }
    if (this.state === GameState.PAUSED) this._renderPaused();
    if (this.state === GameState.FINISHED) this._renderFinish();
  }

  /** The plaque's optional lines: quiz feedback (or the home-ring note) and a
   *  real-world cycling ban on this corridor — which never names the street,
   *  since the headline may still be hidden under a quiz. */
  _plaqueNotes(): { feedback: string; restrictionNote: string } {
    let restrictionNote = '';
    const player = this.player;
    if (isCar(this.travelMode) && player) {
      const road = this.track.getNearestRoad(player.x, player.y, player.angle);
      const segment = road && this.track.segments?.[road.segIdx];
      if (segment?.bicycleRestricted) {
        restrictionNote = bicycleRestrictionNotice({
          bicycleRestricted: 'yes',
          bicycle: segment.bicycle || 'no',
        }) || 'No cycling in real life';
      }
    }
    const homeLearningNote = this.routePattern === 'home'
      && Number.isFinite(this._homeLearningRadiusKm)
      && this._homeLearningRadiusKm > 0
      ? `Learning near home · ~${this._homeLearningRadiusKm.toFixed(1)} km`
      : '';
    return { feedback: this.quizFeedback || homeLearningNote, restrictionNote };
  }

  /** Place the whole HUD for this frame. One call, so every card agrees about
   *  where the others are and the phone layout stays collision-free. */
  _syncHudLayout(): void {
    const ui = window.CanalRecallUi;
    const teaching = this._teachingGate();
    const minimapVisible = canShowMiniMap(this.showMiniMap, teaching);
    this._hudLayoutCache = ui.hudLayout({
      viewport: this.viewport,
      tripWidth: 180,
      landmarkHeight: 130,
      feedbackVisible: !!this.quizFeedback,
      plaqueExtraLines: (() => {
        const notes = this._plaqueNotes();
        return (notes.feedback ? 1 : 0) + (notes.restrictionNote ? 1 : 0);
      })(),
      neighborhoodVisible: !!this.currentNeighborhood,
      minimapVisible,
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
    const surface = window.CanalRecallUi.hudSurface;
    this.hud.paperCard(ctx, rect, { radius: 9 });
    ctx.fillStyle = surface.inkMuted;
    ctx.font = `700 12px ${surface.fontMono}`;
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
    const surface = window.CanalRecallUi.hudSurface;
    this.hud.paperCard(ctx, { x, y, width, height }, { solid: true, radius: compact ? 14 : 8 });
    ctx.fillStyle = surface.accent;
    ctx.font = `700 12px ${surface.fontPlaque}`;
    ctx.textAlign = 'center';
    ctx.fillText(compact ? 'RE-CENTER' : 'RE-CENTER (R)', CANVAS_W / 2, y + height / 2 + 4);
    this._recenterBtnBounds = { x, y, w: width, h: height };
  }

  /** Only while the player is settling in. It used to sit permanently on top
   *  of the recall panel. */
  _renderControlsHint(): void {
    if (this.input.isMobile || this.raceTime >= CONTROLS_HINT_DURATION || this._intro) return;
    const ctx = this.ctx;
    const rect = this._hudRects().controlsHint;
    const surface = window.CanalRecallUi.hudSurface;
    // Bare text over the map was unreadable on white streets; this is the same
    // navy plate as every other readout, sized to the line.
    const text = '?  help   ·   G  settings   ·   M  map   ·   O  north   ·   D  labels   ·   P  pause';
    ctx.save();
    ctx.globalAlpha = Math.min(1, CONTROLS_HINT_DURATION - this.raceTime);
    ctx.font = `600 11px ${surface.fontMono}`;
    const width = Math.min(ctx.measureText(text).width + 24, CANVAS_W - 16);
    const plate = { x: Math.round(rect.x + rect.width / 2 - width / 2), y: rect.y - 6, width, height: 22 };
    this.hud.paperCard(ctx, plate, { radius: 9 });
    ctx.fillStyle = surface.inkMuted;
    ctx.textAlign = 'center';
    ctx.fillText(text, plate.x + plate.width / 2, plate.y + 15);
    ctx.restore();
  }

  // ---- Menu ----

  _renderMenu(): void {
    const ctx = this.ctx;
    // HTML route setup owns the start screen. Drawing the old neon attract
    // menu behind it produced two UIs at once (glow title + enamel rail).
    const setup = document.getElementById('route-setup');
    const setupOpen = !!setup && setup.style.display !== 'none';
    if (setupOpen) {
      ctx.fillStyle = '#f4efe5';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }

    const cx = CANVAS_W / 2;
    ctx.fillStyle = '#071430';
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
    grad.addColorStop(0, 'rgba(7,20,48,0.9)');
    grad.addColorStop(0.4, 'rgba(7,20,48,0.7)');
    grad.addColorStop(0.7, 'rgba(7,20,48,0.8)');
    grad.addColorStop(1, 'rgba(7,20,48,0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('AMSTERDAM CANAL RECALL', cx, 70);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '14px system-ui, sans-serif';
    const tagline = isTransit(this.travelMode)
      ? 'Ride real tram corridors and name the lines and stops'
      : isCar(this.travelMode)
        ? 'Navigate the real street network and name each street after you turn'
        : 'Navigate the real canal network and name each waterway after you turn';
    ctx.fillText(tagline, cx, 100);

    ctx.fillStyle = 'rgba(11,58,140,0.88)';
    roundRect(ctx, cx - 320, 120, 640, 160, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    roundRect(ctx, cx - 320, 120, 640, 160, 10);
    ctx.stroke();

    ctx.textAlign = 'left';
    const rulesX = cx - 290;
    ctx.fillStyle = '#c4a35a';
    ctx.font = 'bold 13px "Barlow Condensed", sans-serif';
    ctx.fillText('HOW TO PLAY', rulesX, 145);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '12px system-ui, sans-serif';
    const rules = isTransit(this.travelMode)
      ? [
        '1. Use WASD or the arrow keys to ride the tram corridor',
        '2. Stay on the mapped line — the guard keeps you on the shape',
        '3. Name the line while moving, and stops as you approach them',
        '4. Line colour and labels stay hidden until you answer',
        '5. TAB toggles the overview map; -/+ changes zoom',
        '6. Transit: tram + metro; change lines at hubs',
      ]
      : isCar(this.travelMode)
        ? [
          '1. Use WASD or the arrow keys to steer the bike',
          '2. Stay on mapped streets; the road guard keeps you on the network',
          '3. After entering a differently named street, type its name',
          '4. Map labels are hidden: navigate from the shape of the city',
          '5. TAB toggles the overview map; -/+ changes zoom',
          '6. This is an early prototype — feedback is the point',
        ]
        : [
          '1. Use WASD or the arrow keys to steer the boat',
          '2. The boat slows dramatically when it leaves mapped water',
          '3. After entering a differently named waterway, type its name',
          '4. Map labels are hidden: navigate from the shape of the city',
          '5. TAB toggles the overview map; -/+ changes zoom',
          '6. This is an early prototype — feedback is the point',
        ];
    rules.forEach((line, index) => ctx.fillText(line, rulesX, 165 + index * 18));

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.input.isMobile
      ? 'Left side: Steer    Right side: Gas/Brake    Double-tap: Drift'
      : 'Arrow Keys / WASD - Drive    SPACE - Drift    TAB - Map    N - Sound    -/+ Zoom', cx, 298);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 22px "Barlow Condensed", sans-serif';
    ctx.fillText(this.input.isMobile ? 'TAP TO START' : 'PRESS ENTER TO START', cx, CANVAS_H / 2 + 55);

    if (!this._menuQuote) {
      this._menuQuote = BANDIT_QUOTES[Math.floor(Math.random() * BANDIT_QUOTES.length)];
    }
    ctx.fillStyle = 'rgba(196,163,90,0.75)';
    ctx.font = 'italic 13px system-ui, sans-serif';
    ctx.fillText(`"${this._menuQuote.text}"`, cx, CANVAS_H / 2 + 90);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px system-ui, sans-serif';
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
    const known = exploration.learnedWaterways.length + exploration.learnedStreets.length
      + exploration.learnedTransitLines.length + exploration.learnedTransitStops.length;
    const parts: string[] = [];
    if (known > 0) parts.push(`${known} names`);
    if (exploration.visitedNeighborhoods.length > 0) parts.push(`${exploration.visitedNeighborhoods.length} hoods`);
    if (exploration.seenLandmarks.length > 0) parts.push(`${exploration.seenLandmarks.length} landmarks`);

    ctx.fillStyle = 'rgba(11,58,140,.55)';
    roundRect(ctx, cx - 200, CANVAS_H / 2 + 120, 400, 28, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${this._cityDisplayName()}: ${parts.join(' · ')} · ${exploration.totalRoutes} routes`,
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
    ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
    ctx.textAlign = 'center';
    ['RICHMOND', 'CHICAGO', 'NEW YORK', 'LONDON', 'PARIS']
      .forEach((name, index) => ctx.fillText(name, 130 + index * 230, CANVAS_H - 50));
  }

  _renderMenuFooter(cx: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
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
    ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
    ctx.textAlign = 'right';
    ctx.fillText(`v${GAME_VERSION}`, CANVAS_W - 10, 15);

    const ghText = 'GitHub';
    ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
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
    const cx = CANVAS_W / 2;
    const compact = this.viewport.mode === 'compact';
    const cardW = Math.min(400, CANVAS_W - 24);
    const padX = compact ? 18 : 28;
    const cardX = cx - cardW / 2;

    ctx.fillStyle = 'rgba(28,24,18,0.34)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    type PauseAction = { id: 'resume' | 'route' | 'copy'; key: string; caption: string };
    const actions: PauseAction[] = [
      { id: 'resume', key: 'P / ESC', caption: 'Resume' },
      { id: 'route', key: 'M', caption: 'Route setup' },
    ];
    if (this._shareUrl) {
      actions.push({
        id: 'copy',
        key: 'C',
        caption: this._copiedTimer > 0 ? 'Link copied' : 'Share this route',
      });
    }

    const BUTTON_H = 44;
    const BUTTON_GAP = 8;
    const titleH = compact ? 56 : 64;
    const statsH = 28;
    const actionsH = compact
      ? actions.length * BUTTON_H + (actions.length - 1) * BUTTON_GAP
      : 28;
    const cardH = 20 + titleH + actionsH + statsH + 18;
    const cardY = (CANVAS_H - cardH) / 2;

    // The same paper plate as the arrival card. This was the last surface of
    // the old arcade skin: 78% black, yellow Courier, and ink captions that
    // vanished on it ("New route" was invisible on a phone).
    this.hud.paperCard(ctx, { x: cardX, y: cardY, width: cardW, height: cardH }, { solid: true, radius: 12 });

    ctx.fillStyle = INK;
    ctx.font = `800 ${compact ? 30 : 36}px ${window.CanalRecallUi.hudSurface.fontPlaque}`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', cx, cardY + (compact ? 40 : 46));

    const pauseButtons: NonNullable<typeof this._pauseButtonBounds> = [];
    this._pauseButtonBounds = pauseButtons;
    let y = cardY + titleH;

    if (compact) {
      for (const action of actions) {
        const primary = action.id === 'resume';
        const bounds = { x: cardX + padX, y, w: cardW - padX * 2, h: BUTTON_H };
        ctx.fillStyle = primary ? COPPER : 'rgba(31,28,23,.05)';
        roundRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, 12);
        ctx.fill();
        if (!primary) {
          ctx.strokeStyle = RULE;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.fillStyle = primary ? '#1f1c17' : (action.caption === 'Link copied' ? GOOD : INK);
        ctx.font = '700 14px system-ui, sans-serif';
        ctx.fillText(action.caption, bounds.x + bounds.w / 2, y + 28);
        pauseButtons.push({ ...bounds, id: action.id });
        y += BUTTON_H + BUTTON_GAP;
      }
    } else {
      ctx.textAlign = 'left';
      let ax = cardX + padX;
      for (const action of actions) {
        ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
        const keyW = ctx.measureText(action.key).width + 14;
        ctx.fillStyle = 'rgba(31,28,23,.08)';
        roundRect(ctx, ax, y + 2, keyW, 20, 5);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.fillText(action.key, ax + 7, y + 16);
        const captionX = ax + keyW + 8;
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = action.caption === 'Link copied' ? GOOD : MUTED;
        ctx.fillText(action.caption, captionX, y + 16);
        const captionW = ctx.measureText(action.caption).width;
        pauseButtons.push({
          x: ax,
          y: y - 4,
          w: keyW + 8 + captionW + 8,
          h: 28,
          id: action.id,
        });
        ax = captionX + captionW + 22;
      }
      y += 28;
    }

    ctx.textAlign = 'center';
    ctx.font = `500 12px ${window.CanalRecallUi.hudSurface.fontUi}`;
    ctx.fillStyle = MUTED;
    // Kilometres, like every other readout, and names rather than an
    // unlabelled percentage: what you learned is the progress.
    const kilometres = this._playerDistancePx() / PIXELS_PER_METER / 1000;
    ctx.fillText(
      `${this.hud.formatTime(this.raceTime)}  ·  ${kilometres.toFixed(2)} km  ·  ${this.quizCorrect} of ${this.quizAttempts} named`,
      cx,
      y + 18,
    );
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
    ctx.fillStyle = 'rgba(28,24,18,.34)';
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
      ctx.strokeStyle = RULE;
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
      ctx.fillStyle = ACCENT; ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
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
        || `A place to remember on your ${this._cityDisplayName()} map.`, textW, hasImage ? 4 : 3);
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
        ctx.fillStyle = MUTED; ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
        const kind = String(landmark.type || 'landmark').toUpperCase();
        ctx.fillText(landmark.wikipediaUrl ? `${kind}  ·  W  WIKIPEDIA` : kind, textX, top + 10);
        ctx.fillStyle = BODY; ctx.font = '12px system-ui, sans-serif';
        blurb.forEach((line, index) => ctx.fillText(line, textX, top + 30 + index * 17));
      } });
    }

    // One stat row instead of four differently coloured boxes.
    const profile = travelProfile(this.travelMode);
    const recallNoun = profile.recallNoun;
    const accuracy = this.quizAttempts > 0 ? Math.round(100 * this.quizCorrect / this.quizAttempts) : 0;
    // A ride with no questions ends on what was covered, not on "0% recall".
    const stats = this.quizAttempts > 0 ? [
      { label: recallNoun, value: `${this.quizCorrect}/${this.quizAttempts}` },
      { label: 'Recall', value: `${accuracy}%` },
    ] : [];
    stats.push(
      { label: 'Time', value: this.hud.formatTime(this.raceTime).slice(0, -2) },
      { label: 'Distance', value: `${(this._playerDistancePx() / PIXELS_PER_METER / 1000).toFixed(2)} km` },
    );
    if (gamey && this.quizAttempts > 0) stats.splice(2, 0, { label: 'Points', value: String(this.quizPoints) });

    const footerBits = [
      this.routeDifficulty.charAt(0).toUpperCase() + this.routeDifficulty.slice(1),
      profile.label,
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
        ctx.fillStyle = INK; ctx.font = `700 ${compact ? 19 : 21}px ${window.CanalRecallUi.hudSurface.fontMono}`;
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
      const known = exploration.learnedWaterways.length + exploration.learnedStreets.length
        + exploration.learnedTransitLines.length + exploration.learnedTransitStops.length;
      const totals: string[] = [];
      if (known > 0) totals.push(`${known} names`);
      if (exploration.visitedNeighborhoods.length > 0) totals.push(`${exploration.visitedNeighborhoods.length} neighborhoods`);
      if (exploration.seenLandmarks.length > 0) totals.push(`${exploration.seenLandmarks.length} landmarks`);
      const gain = this._explorationRouteGain;
      const story = finishStory({
        gain: gain || { newNames: 0, newNeighborhoods: 0, newLandmarks: 0 },
        destinationName: this.routeTo?.name || '',
        cityName: this._cityDisplayName(),
        newPassportStamps: this._finishPassportFresh || [],
        placeStreak: { days: [], current: 0, best: 0 },
        signedIn: !!(this.recall && this.recall.signedIn),
        recallAvailable: !!(this.recall && this.recall.available),
      });
      // Prefer live streak label computed at save time.
      if (this._finishPlaceStreakLabel) story.streak = this._finishPlaceStreakLabel;
      const fresh: string[] = [];
      if (gain && gain.newNames > 0) fresh.push(`${gain.newNames} names`);
      if (gain && gain.newNeighborhoods > 0) fresh.push(`${gain.newNeighborhoods} neighborhoods`);
      if (gain && gain.newLandmarks > 0) fresh.push(`${gain.newLandmarks} landmarks`);
      const knowledgeStacked = compact;
      const storyLines = [story.headline, story.detail, story.passport, story.streak, story.guestTease]
        .filter(Boolean) as string[];
      const knowledgeH = (knowledgeStacked ? 34 : 18)
        + (fresh.length ? 18 : 0)
        + storyLines.length * 16
        + 10;
      blocks.push({ height: knowledgeH, rule: true, draw: (top) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = MUTED; ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
        ctx.fillText('CITY KNOWLEDGE', cardX + padX, top + 12);
        ctx.fillStyle = BODY; ctx.font = '12px system-ui, sans-serif';
        if (knowledgeStacked) {
          ctx.fillText(totals.join('  ·  ') || 'Start exploring', cardX + padX, top + 30);
        } else {
          ctx.textAlign = 'right';
          ctx.fillText(totals.join('  ·  ') || 'Start exploring', cardX + cardW - padX, top + 12);
        }
        let y = top + (knowledgeStacked ? 48 : 30);
        if (fresh.length) {
          ctx.textAlign = 'left';
          ctx.fillStyle = ACCENT;
          ctx.font = '11px system-ui, sans-serif';
          ctx.fillText(`+${fresh.join(', +')} first-time`, cardX + padX, y);
          y += 16;
        }
        ctx.textAlign = 'left';
        ctx.fillStyle = BODY;
        ctx.font = '12px system-ui, sans-serif';
        for (const line of storyLines) {
          ctx.fillText(line, cardX + padX, y);
          y += 16;
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
      // Say what happens: 'again' deals another route with these settings,
      // 'route' goes back to setup. "Continue" / "Finish" said neither.
      { id: 'again', key: 'ENTER', caption: 'Next route' },
    ];
    // Route setup is a tap target on the phone. The desktop card no longer
    // offers it on ESC (user request 2026-09-28); the pause menu keeps it.
    if (compact) actions.push({ id: 'route', key: '', caption: 'Route setup' });
    if (this._shareUrl) {
      actions.push({ id: 'copy', key: 'C', caption: this._copiedTimer > 0 ? 'Link copied' : 'Share this route' });
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
            ctx.fillStyle = primary ? COPPER : 'rgba(31,28,23,.05)';
            roundRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, 12);
            ctx.fill();
            if (!primary) {
              ctx.strokeStyle = RULE; ctx.lineWidth = 1; ctx.stroke();
            }
            ctx.textAlign = 'center';
            ctx.fillStyle = primary ? '#1f1c17' : (action.caption === 'Link copied' ? GOOD : INK);
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
          ctx.font = `700 11px ${window.CanalRecallUi.hudSurface.fontMono}`;
          const keyW = ctx.measureText(action.key).width + 14;
          ctx.fillStyle = 'rgba(31,28,23,.08)';
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
    ctx.font = `700 18px ${window.CanalRecallUi.hudSurface.fontMono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ribbon.id === 'none' ? '·' : ribbon.label[0], medalX, medalY + 1);
    ctx.textBaseline = 'alphabetic';

    const textX = boxX + 76;
    ctx.textAlign = 'left';
    ctx.fillStyle = ribbon.color;
    ctx.font = `700 19px ${window.CanalRecallUi.hudSurface.fontMono}`;
    ctx.fillText(ribbon.label, textX, boxY + 26);
    const labelWidth = ctx.measureText(ribbon.label).width;
    ctx.fillStyle = '#94A3B8';
    ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
    ctx.fillText(`${Math.round(ribbon.score * 100)}%`, textX + labelWidth + 12, boxY + 26);

    const axes = ribbon.axes;
    const trackW = (boxX + boxW - 18 - textX) / axes.length;
    axes.forEach((axis, index) => {
      const x = textX + index * trackW;
      const w = trackW - 14;
      ctx.fillStyle = '#94A3B8';
      ctx.font = `11px ${window.CanalRecallUi.hudSurface.fontMono}`;
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

  /**
   * Punchline for race open / briefing. Names the destination only — never the
   * start corridor under the wheels.
   */
  _composeMissionBrief() {
    const due = this.recall && typeof this.recall.dueReviews === 'function'
      ? this.recall.dueReviews()
      : [];
    const hasCold = due.some((place) => place.cityId === (this.cityId || 'amsterdam')
      && place.dueAt <= Date.now());
    return missionBrief({
      destinationName: this._destinationLabel(),
      travelMode: isBoat(this.travelMode) ? 'boat'
        : isTransit(this.travelMode) ? 'transit' : 'car',
      routePattern: this.routePattern === 'home' ? 'home'
        : this.routePattern === 'here' ? 'here' : 'surprise',
      cityName: this._cityDisplayName(),
      homeLearningRadiusKm: this._homeLearningRadiusKm || 0,
      hasColdOpenReview: COLD_OPEN_ENABLED && hasCold,
      reviewDueNearRoute: this._reviewRoute ? this._reviewRoute.dueNear.length : 0,
    });
  }

  /** Returns the merged collection so the finish card can show both the totals
   *  and what this route added. */
  _saveExploration(): Exploration | null {
    try {
      const before = readExploration(localStorage);
      const after = mergeExploration(before, {
        learnedKind: travelProfile(this.travelMode).learnedKind,
        learnedNames: this.learnedNames,
        learnedStopNames: this.learnedStopNames || [],
        visitedNeighborhoods: this._visitedNeighborhoods,
        seenLandmarkNames: this._seenLandmarkNames,
        correct: this.quizCorrect,
        attempts: this.quizAttempts,
      });
      saveExploration(localStorage, after);
      const gain = explorationGain(before, after);
      this._explorationRouteGain = gain;
      if (gain.newNames > 0) {
        const streak = notePlaceDay(localStorage);
        this._finishPlaceStreakLabel = placeStreakLabel(streak);
      } else {
        this._finishPlaceStreakLabel = placeStreakLabel(readPlaceStreak(localStorage));
      }
      const stamped = stampNewNeighborhoods(
        after,
        this._visitedNeighborhoods,
        readPassport(localStorage),
      );
      if (stamped.fresh.length) savePassport(localStorage, stamped.passport);
      this._finishPassportFresh = stamped.fresh;
      return after;
    } catch (error) {
      console.warn('Could not save exploration:', error);
      return null;
    }
  }

  /** What this route added, for the finish card. */
  _explorationGain(before: Exploration, after: Exploration): ExplorationGain {
    return explorationGain(before, after);
  }
}

window.CanalRecallGameModules = window.CanalRecallGameModules || [];
window.CanalRecallGameModules.push(GamePresentationRuntime);
