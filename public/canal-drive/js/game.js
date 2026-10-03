// ============================================================
// GAME
// ============================================================
const GameState = { MENU: 0, MAP_SELECT: 1, LOADING: 2, RACING: 4, FINISHED: 5, PAUSED: 6 };
Object.freeze(GameState);

const DIFFICULTY_PRESETS = window.CanalRecallPreferences.DIFFICULTY_PRESETS;
const DIFFICULTY_SCORE_MULTIPLIERS = { easy: 0.5, medium: 0.75, hard: 1, expert: 1.25, custom: 0.85 };
// Ribbon tiers / aid costs live in routeRibbon.ts (bundled with presentation).
// Pair-distance / live-reroute numbers come from the typed route module so
// game-route.js and the unit checks cannot drift.
const Route = window.CanalRecallRoute;
const ROUTE_POI_MAX_KM_FROM_CENTRE = 4;
const ROUTE_POI_MAX_PAIR_KM = Route.ROUTE_POI_MAX_PAIR_KM;
const BRIDGE_GATE_HALF_WIDTH = 26;
const BRIDGE_LABEL_RANGE = 900;
const CROSSING_MATCH_RANGE = 900;
const RETARGET_ATTEMPTS = Route.RETARGET_ATTEMPTS;
const MAX_ROUTE_REROLLS = 2;
const CONTROLS_HINT_DURATION = 12;
const ZOOM_BADGE_DURATION = 1.4;
const LIVE_ROUTE_OFF_ROUTE_DIST = Route.LIVE_ROUTE_OFF_ROUTE_DIST;
const LIVE_ROUTE_REROUTE_INTERVAL = Route.LIVE_ROUTE_REROUTE_INTERVAL;
const HOME_GEOCODE_CACHE_KEY = 'canalRecall.homeGeocodes.v2';

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) throw new Error('gameCanvas element not found');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.ctx = this.canvas.getContext('2d');
    this.input = new InputManager();
    this.track = null;
    this.camera = new Camera();
    this.renderer = new Renderer(this.canvas, this.ctx);
    this.hud = new HUD();
    this.particles = new ParticleSystem();
    this.sound = new SoundManager();
    this.state = GameState.MENU;
    this.raceTime = 0;
    this.showMiniMap = true;
    this.cars = [];
    this.player = null;
    this.lastTime = 0;
    this.soundStarted = false;
    this.quizCurrentName = '';
    this.quizCandidateName = '';
    this.quizCandidateTimer = 0;
    this.quizPromptName = '';
    this.quizPromptSegmentIndex = -1;
    this.quizPromptPointIndex = 0;
    this.quizCorrect = 0;
    this.quizAttempts = 0;
    this.quizPoints = 0;
    this.quizStreak = 0;
    this.quizBestStreak = 0;
    this.quizFeedback = '';
    this.routeOptions = { ...DIFFICULTY_PRESETS.medium };
    this.travelMode = 'boat';
    this.cityId = (window.CanalRecallPreferences && window.CanalRecallPreferences.DEFAULT_CITY_ID) || 'amsterdam';
    this.controlMode = 'relative';
    this.viewMode = 'north';
    this.themeMode = 'clean';
    this.learnedNames = new Set();
    // Names shown this route (right or wrong); feeds the map, not the score.
    this.revealedNames = new Set();
    // Route reveals plus SRS-known names — still labelled while driving past.
    this._mapLabelNames = new Set();
    const starterPois = this._curatedRoutePois();
    this.routeFrom = starterPois[1] || starterPois[0] || { id: 'start', name: 'Start', lat: 52.37, lng: 4.89 };
    this.routeTo = starterPois[2] || starterPois[1] || starterPois[0] || this.routeFrom;
    // Grows once the landmark extract loads; see _loadRoutePoiCatalog.
    this.routePois = [...starterPois];
    this.bridges = [];
    this._routeRerolls = 0;
    this._zoomBadgeTimer = 0;
    this._zoomTouchedByPlayer = false; // player zoom wins over resize/rotation
    this.viewport = window.CanalRecallUi.resolveViewport({ windowWidth: CANVAS_W, windowHeight: CANVAS_H });
    this._lastZoomShown = null;
    this._liveRoutePath = null;
    this._liveRouteIndex = -1;
    this._rerouteTimer = 0;
    this._plannedRouteLengthPx = 0;
    this._routeLearningPlan = null;
    this._routeMastery = {};
    this._routeReviewDue = {};
    this.quizPromptKind = 'route';
    // Per crossing, not per bridge (one OSM name can span several waters).
    this._quizzedCrossings = new Map();
    this._learnedBridges = new Map();
    this._pendingCrossing = null;
    this._lastBridgeQuizAt = -Infinity;
    this._knownPlaces = new Map(); // name -> world points the store already knows
    this.routePattern = 'surprise';
    this.homeBase = null;
    this.homeLeg = 'outbound';
    this._homeLearningRadiusKm = null;

    // OSM components
    this.osmLoader = new OSMLoader();
    this.mapPicker = new MapPicker();
    this.loadingScreen = new LoadingScreen();
    this.vectorMap = new VectorBasemap(document.getElementById('vector-map'));
    this.loadingMessage = '';
    this.loadingProgress = 0;
    this.trackMode = TRACK_MODE_POINT_TO_POINT;
    this._reviewRoute = null;        // set by _pickReviewRide for a review ride
    this._loadToken = 0;             // bumped per route load; see _onLocationSelected
    this._raceKey = null;
    this._shareUrl = null;
    this._copiedTimer = 0;
    this._menuQuote = BANDIT_QUOTES[Math.floor(Math.random() * BANDIT_QUOTES.length)];

    this.landmarks = [];
    this.neighborhoods = [];
    this.currentNeighborhood = '';
    this._previousNeighborhood = '';
    this._neighborhoodCandidate = '';
    this._neighborhoodCandidateTimer = 0;
    this._neighborhoodNotice = null;
    this._neighborhoodNoticeTimer = 0;
    this._neighborhoodImages = new Map();
    this._neighborhoodImageRequests = new Set();
    this._postcardCanvas = null;
    this._seenLandmarks = new Set();
    this._seenStreetKnowledge = new Set();
    this._visitedNeighborhoods = new Set();
    this._seenLandmarkNames = new Set();
    // Generated trivia from facts.json; empty until _loadLandmarks (or forever).
    this._facts = new Map();
    this._factRotation = { history: {}, shown: 0, recentKinds: [] };
    this._explorationSnapshot = null;
    this._assistUsage = { line: false, arrow: false, minimap: false };
    this._ribbon = null;
    // Arcade layer (streaks/points/ribbons); aids and difficulty stay independent.
    this.gameyFeatures = true;
    this._debugMode = false;
    this._debugLinkBounds = null;
    this._recenterBtnBounds = null;
    this._landmarkNotice = null;
    this._landmarkCardBounds = null;
    this._landmarkNoticeHold = { kind: 'timed', seconds: 0 }; // see game/landmarkNotice.ts
    this._landmarkNoticeSource = null;
    this._landmarkNoticeState = { elapsed: 0, fadeRemaining: null };
    this._landmarkNoticeAlpha = 0;
    this._landmarkImages = new Map();
    this.streetKnowledge = new Map();
    this._blockedBoatFrames = 0;
    this._blockedCarFrames = 0;
    this._activeTransitLine = '';
    this.quizPromptSubject = '';
    this._lastTransitStreetQuizAt = -Infinity;
    this._lastTransitTransferQuizAt = -Infinity;
    this._quizzedTransitStreets = new Set();
    this._quizzedTransitTransfers = new Set();
    this._transitConnectionPlan = null;
    this._transitLegIndex = 0;
    this._transitFinalFinish = null;
    this._corridorStreetIndex = null;

    this._alanLinkBounds = null;
    this._githubLinkBounds = null;
    this._prompt = document.getElementById('canal-prompt');
    this._promptForm = document.getElementById('canal-card');
    this._promptInput = document.getElementById('canal-answer');
    this._promptFeedback = document.getElementById('canal-feedback');
    this._promptChoices = document.getElementById('canal-choices');
    this._promptHeading = document.querySelector('#canal-card h2');
    this._promptQuestion = document.querySelector('#canal-card p');
    this._promptKind = document.getElementById('canal-kind');
    this._promptKindLabel = document.getElementById('canal-kind-label');
    this._promptForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this._submitCanalAnswer();
    });
    this._promptNoIdea = document.getElementById('canal-no-idea');
    if (this._promptNoIdea) {
      this._promptNoIdea.addEventListener('click', () => this._submitCanalAnswer(null, true));
    }
    this._setupRouteForm();
    this._loadRoutePoiCatalog();
    this._setupRecallStore();
    this._setupUtilityPanels();
    this._resize();
    // `resize` alone is not enough on a phone. Rotating fires `orientationchange`
    // before the new dimensions settle, and mobile Safari's URL bar collapsing
    // only moves `visualViewport`. Missing any of these leaves the game drawing
    // into a stale coordinate space — which is how a phone latched the desktop
    // layout at load and kept it.
    const onViewportChange = () => this._resize();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', () => {
      onViewportChange();
      // The post-rotation dimensions are not final on the event itself.
      setTimeout(onViewportChange, 120);
      setTimeout(onViewportChange, 400);
    });
    window.visualViewport?.addEventListener('resize', onViewportChange);
    this._setupCameraGestures();

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      // The debug overlay's tool links are canvas pixels, not DOM anchors.
      if (this._debugMode && this._debugLinkBounds) {
        const link = this._debugLinkBounds.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (link) { window.open(link.href, '_blank'); return; }
      }
      if (this.state === GameState.MENU) {
        if (this._alanLinkBounds) {
          const b = this._alanLinkBounds;
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            window.open('https://alan.is', '_blank');
          }
        }
        if (this._githubLinkBounds) {
          const b = this._githubLinkBounds;
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            window.open('https://github.com/a1anw2/smokeysandthebandit', '_blank');
          }
        }
      }
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * CANVAS_W / rect.width;
      const y = (e.clientY - rect.top) * CANVAS_H / rect.height;
      const hit = (b) => !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      let hovering = false;
      if (this._debugMode && (this._debugLinkBounds || []).some(hit)) hovering = true;
      else if (this.state === GameState.MENU) hovering = hit(this._alanLinkBounds) || hit(this._githubLinkBounds);
      else if (this._landmarkCardBounds) hovering = hit(this._landmarkCardBounds);
      this.canvas.style.cursor = hovering ? 'pointer' : 'default';
    });

    requestAnimationFrame(t => this._loop(t));
    this._checkShareLink();
  }

  /** The finish card's tappable actions, for touch. Keyboard keeps ENTER/ESC/C. */
  _runFinishAction(id) {
    if (id === 'again') {
      if (this.routePattern === 'home') { this._startNextHomeLeg(); return; }
      this._startNextRouteFromArrival();
    } else if (id === 'route') {
      this._openRouteSetup();
    } else if (id === 'copy' && this._shareUrl) {
      navigator.clipboard.writeText(this._shareUrl).catch(() => {});
      this._copiedTimer = 2;
    }
  }

  /** Pause card actions — same targets for keyboard and touch. */
  _runPauseAction(id) {
    if (id === 'resume') {
      this.state = GameState.RACING;
      this.sound.resume();
      return;
    }
    if (id === 'route') {
      this._openRouteSetup();
      return;
    }
    if (id === 'copy' && this._shareUrl) {
      navigator.clipboard.writeText(this._shareUrl).catch(() => {});
      this._copiedTimer = 2;
    }
  }

  // The logical drawing space fills the window. It used to be fixed at 1280×720
  // and letterboxed into whatever was given, so a tall desktop window and a
  // portrait phone both got a landscape strip floating in white paper while
  // the MapLibre layer underneath kept its own size.
  _resize() {
    const viewport = window.CanalRecallUi.readWindowViewport(window);
    this.viewport = viewport;
    // Everything that draws reads these at call time, so reassigning them here
    // moves the whole HUD into the new coordinate space.
    CANVAS_W = viewport.width;
    CANVAS_H = viewport.height;
    // Pin the canvas to the viewport by CSS rather than sizing it in pixels, so
    // it always fills the window and cannot start the overflow -> shrink-to-fit
    // -> wider-innerWidth loop that used to latch the desktop layout onto a
    // phone. `compact-layout` still marks the phone HUD path for CSS that
    // needs to know; `fill-viewport` is what actually kills the letterbox.
    const compact = viewport.mode === 'compact';
    document.body.classList.toggle('compact-layout', compact);
    document.body.classList.add('fill-viewport');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    // Allocate enough backing pixels for large and Retina displays. CSS scaling
    // a fixed 720p canvas was the source of the blocky waterway overlay.
    const backingWidth = Math.round(viewport.width * viewport.backingScale);
    const backingHeight = Math.round(viewport.height * viewport.backingScale);
    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }
    // Set unconditionally: a resize that leaves the backing store the same size
    // but changes the logical space still needs the transform rebuilt.
    this.ctx.setTransform(viewport.backingScale, 0, 0, viewport.backingScale, 0, 0);
    this.input.setViewport(viewport);
    if (this.vectorMap) this.vectorMap.resizeToViewport(viewport);
    // A phone shows a narrower strip of city than a 1280 px window, so the
    // default zoom would frame far less of the route. Scale it to keep roughly
    // the same span of Amsterdam on screen.
    if (!this._zoomTouchedByPlayer) {
      this.camera.zoom = clamp(
        CAMERA_ZOOM_INITIAL * (viewport.width / 1280),
        this.camera.minZoom, this.camera.maxZoom);
    }
  }

  _loop(timestamp) {
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    dt = Math.min(dt, 0.05);
    if (dt <= 0) dt = 1/60;

    // Clear per-frame caches for road network queries
    if (this.track && this.track.clearFrameCache) {
      this.track.clearFrameCache();
    }

    this._update(dt);
    this._render();
    this.input.clear();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    // A tap outside the d-pad means "restart" on the finish screen, but while
    // driving it used to press Enter on every touch of the map.
    this.input.setTapRestartEnabled(this.state !== GameState.RACING);
    if (this.input.wasPressed('Slash') && (this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight'))) this._toggleUtilityPanel(this._helpPanel);
    if (this.input.wasPressed('KeyG')) this._toggleUtilityPanel('settings');
    // Finish owns Esc/Enter; do not let a stale utility flag swallow them.
    if (this.state !== GameState.FINISHED) {
      if (this.input.wasPressed('Escape') && this._utilityOpen) { this._closeUtilityPanels(); return; }
      if (this._utilityOpen) return;
    }
    if (this.state !== GameState.FINISHED && this.state !== GameState.PAUSED) {
      if (this.input.wasPressed('Tab') || this.input.wasPressed('KeyM')) this.showMiniMap = !this.showMiniMap;
    }
    if (this.input.wasPressed('KeyL')) {
      this.routeOptions.line = !this.routeOptions.line;
      this._overlay.store.patchPrefs({ line: this.routeOptions.line }, this._overlayZoom());
      this.vectorMap.setRoute(this.routePath, this.osmLoader, this.routeOptions.line);
      this._savePreferences();
    }
    if (this.input.wasPressed('KeyF')) this.routeOptions.arrow = !this.routeOptions.arrow;
    if (this.input.wasPressed('KeyO')) this.camera.northUp = !this.camera.northUp;
    const shiftDown = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
    const tiltStep = Number.isFinite(window.CanalRecallPreferences?.CAMERA_TILT_KEY_STEP)
      ? window.CanalRecallPreferences.CAMERA_TILT_KEY_STEP
      : 6;
    const bearingStep = Number.isFinite(window.CanalRecallPreferences?.CAMERA_BEARING_KEY_STEP)
      ? window.CanalRecallPreferences.CAMERA_BEARING_KEY_STEP
      : 15;
    if (this.input.wasPressed('BracketLeft')) {
      if (shiftDown) this._nudgeCameraBearing(-bearingStep);
      else this._nudgeCameraTilt(-tiltStep);
    }
    if (this.input.wasPressed('BracketRight')) {
      if (shiftDown) this._nudgeCameraBearing(bearingStep);
      else this._nudgeCameraTilt(tiltStep);
    }
    if (this.input.wasPressed('KeyD')) this.vectorMap.toggleLabels();
    if (this.input.wasPressed('KeyB')) this._cycleBuildingLook();
    if (this.input.wasPressed('KeyW')) this._openLandmarkArticle();
    this._handleChoiceShortcut();
    if (this.input.wasPressed('Backquote')) this._toggleDebug();
    if (this.input.isDown('Minus') || this.input.isDown('NumpadSubtract')) { this.camera.zoomOut(); this._zoomTouchedByPlayer = true; }
    if (this.input.isDown('Equal') || this.input.isDown('NumpadAdd')) { this.camera.zoomIn(); this._zoomTouchedByPlayer = true; }
    if (this.input.isDown('KeyI')) this.camera.pan(0, -8);
    if (this.input.isDown('KeyK')) this.camera.pan(0, 8);
    if (this.input.isDown('KeyJ')) this.camera.pan(-8, 0);
    if (this.input.isDown('KeyU')) this.camera.pan(8, 0);
    if (this.input.wasPressed('KeyR')) this.camera.resetPan();

    switch (this.state) {
      case GameState.MENU:
        // Route setup is a DOM form layered above the canvas.
        break;

      case GameState.MAP_SELECT:
        // Map picker handles its own UI via DOM
        if (this.input.wasPressed('Escape')) {
          this.mapPicker.hide();
          this.state = GameState.MENU;
        }
        break;

      case GameState.LOADING:
        if (this.input.wasPressed('Escape')) {
          this._loadToken++;           // abandon the load in flight
          this.state = GameState.MENU;
        }
        break;

      case GameState.RACING:
        if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
          this.state = GameState.PAUSED;
          this.sound.silence();
          break;
        }
        this._updateRacing(dt);
        break;

      case GameState.PAUSED:
        if (this._copiedTimer > 0) this._copiedTimer -= dt;
        if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape') || this.input.wasPressed('Space')) {
          this._runPauseAction('resume');
        }
        if (this.input.wasPressed('KeyM')) {
          this._runPauseAction('route');
        }
        if (this.input.wasPressed('KeyC') && this._shareUrl) {
          this._runPauseAction('copy');
        }
        break;

      case GameState.FINISHED:
        if (this._copiedTimer > 0) this._copiedTimer -= dt;
        // If a utility somehow stayed marked open (e.g. settings opened mid-race
        // and the finish card hid its chrome), Esc must finish the trip — not
        // only dismiss an invisible panel and return early.
        if (this._utilityOpen) {
          this._closeUtilityPanels();
          this._reclaimKeyboardFocus();
        }
        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyM')) {
          this._runFinishAction('again');
        }
        if (this.input.wasPressed('KeyC')) this._runFinishAction('copy');
        break;
    }
  }

  // ---- Racing sub-updates (extracted for readability) ----

  _updateRacing(dt) {
    // The start-of-ride orientation flight owns the camera and holds the
    // vehicle until it lands or the player does anything.
    if (this._intro && this._updateIntro(dt)) return;

    this.raceTime += dt;
    for (const car of this.cars) car.totalTime = this.raceTime;
    if (this.routeOptions.line) this._assistUsage.line = true;
    if (this.routeOptions.arrow) this._assistUsage.arrow = true;
    if (this.showMiniMap) this._assistUsage.minimap = true;

    if (this.quizPromptName) {
      // The bike waits for the answer, so the question must be on screen. If
      // anything hid its card, show it again rather than freeze the bike
      // behind an invisible question (user reports 2026-10-01).
      if (this._prompt && this._prompt.style.display === 'none') this._prompt.style.display = 'flex';
      this.camera.update(this.player, dt);
      return;
    }

    // Player boat update (Smokey's original vehicle controller)
    const previousPlayerPosition = { x: this.player.x, y: this.player.y };
    this.sound.resume();
    this.player.handleInput(this.input);
    this.player.update(dt, this.track);
    if (this.travelMode === 'car' || this.travelMode === 'transit') {
      const guardRoad = (x, y) => (this.track.getGuardRoad
        ? this.track.getGuardRoad(x, y, this.player.angle)
        : this.track.getNearestRoad(x, y, this.player.angle));
      const road = guardRoad(this.player.x, this.player.y);
      const previousRoad = guardRoad(previousPlayerPosition.x, previousPlayerPosition.y);
      const excessAt = (x, y) => {
        const contact = guardRoad(x, y);
        return contact ? contact.dist - contact.width : Infinity;
      };
      const guardOpts = this.travelMode === 'transit'
        ? {
          edgeTolerance: CAR_ROAD_EDGE_TOLERANCE,
          softPullFactor: 0.36,
          softPullLimit: 5.5,
          blockedFrames: this._blockedCarFrames,
          unwedgeAfter: 4,
          excessAt,
        }
        : {
          edgeTolerance: CAR_ROAD_EDGE_TOLERANCE,
          blockedFrames: this._blockedCarFrames,
          // A hard stick steer (or a turn-around in progress) is the rider's
          // call; the guard still keeps the bike on the road. Keyboard steering
          // is always full lock and keeps the kerb-gliding heading ease.
          // Stalled at the edge with the arrows held: the shoulder's heading
          // ease (12% a frame) exactly cancelled keyboard steering, so a bike
          // nosed into the end of Zanddwarsstraat by Sint Antoniessluis could
          // neither turn nor move (keyboard-ride.spec.ts, 2026-10-01). After
          // 0.2 s of that, steering wins.
          holdHeading: !!this.player._stickHardSteer || this.player._uTurnHeading != null
            || (this._edgeStallFrames || 0) > 12,
          excessAt,
        };
      const guard = CanalRecallCar.constrainCarToRoad(
        this.player,
        previousPlayerPosition,
        road,
        previousRoad,
        guardOpts,
      );
      this._blockedCarFrames = guard === 'rolled-back' ? this._blockedCarFrames + 1 : 0;
      // Judged on net movement since the stall began: on the shoulder the bike
      // can shuffle ~1 px a frame and go nowhere (Melkwegbrug's dead end).
      if (!this._edgeStall) this._edgeStall = { frames: 0, anchorX: 0, anchorY: 0 };
      this._edgeStallFrames = CanalRecallCar.trackEdgeStall(
        this._edgeStall, guard, this.player.steerInput, this.player.x, this.player.y,
      );
    } else if (this.travelMode === 'boat' && !this._boatFitsRenderedWater(this.player)) {
      this._blockedBoatFrames++;
      // Do not let a fast frame step carry the boat across a quay. The old
      // surface correction merely nudged it back toward a centreline, which
      // could leave it visibly embedded in a block.
      this.player.x = previousPlayerPosition.x;
      this.player.y = previousPlayerPosition.y;
      const road = this.track.getNearestRoad(this.player.x, this.player.y);
      if (road) {
        const inwardX = road.x - this.player.x;
        const inwardY = road.y - this.player.y;
        const inwardDistance = Math.hypot(inwardX, inwardY) || 1;
        const recovering = this._blockedBoatFrames > 10;
        const correction = recovering ? inwardDistance : Math.min(3, inwardDistance);
        this.player.x += inwardX / inwardDistance * correction;
        this.player.y += inwardY / inwardDistance * correction;
        const tangentX = Math.cos(road.angle), tangentY = Math.sin(road.angle);
        const inwardUnitX = inwardX / inwardDistance, inwardUnitY = inwardY / inwardDistance;
        const tangentVelocity = (this.player.vx * tangentX + this.player.vy * tangentY) * 0.92;
        const inwardVelocity = this.player.vx * inwardUnitX + this.player.vy * inwardUnitY;
        const reflectedInward = inwardVelocity < 0 ? -inwardVelocity * 0.32 : inwardVelocity;
        this.player.vx = tangentX * tangentVelocity + inwardUnitX * reflectedInward;
        this.player.vy = tangentY * tangentVelocity + inwardUnitY * reflectedInward;
        const reflectedSpeed = Math.hypot(this.player.vx, this.player.vy);
        if (recovering) {
          const forwardDot = Math.cos(this.player.angle) * tangentX + Math.sin(this.player.angle) * tangentY;
          this.player.angle = road.angle + (forwardDot < 0 ? Math.PI : 0);
          this.player.vx = Math.cos(this.player.angle) * Math.min(reflectedSpeed, 35);
          this.player.vy = Math.sin(this.player.angle) * Math.min(reflectedSpeed, 35);
          this._blockedBoatFrames = 0;
        } else if (reflectedSpeed > 0.1) {
          const reflectedAngle = Math.atan2(this.player.vy, this.player.vx);
          const angleDelta = normalizeAngle(reflectedAngle - this.player.angle);
          const maxDeflection = Math.abs(this.player.speed) > this.player.maxSpeed * 0.6 ? 0.08 : 0.16;
          this.player.angle += clamp(angleDelta, -maxDeflection, maxDeflection);
        }
        this.player.speed = Math.min(this.player.maxSpeed, reflectedSpeed);
      } else {
        this.player.speed = 0;
        this.player.vx = 0;
        this.player.vy = 0;
      }
    } else {
      this._blockedBoatFrames = 0;
    }
    if (this._zoomBadgeTimer > 0) this._zoomBadgeTimer -= dt;
    if (this._rerouteTimer > 0) this._rerouteTimer -= dt;
    this._updateLiveRouteLine();
    this._updateBridgeQuiz(previousPlayerPosition);
    this._updateCanalQuiz(dt);

    this._updateLandmarks(dt);
    this._updateBoundaryCollisions();

    // Particles + camera + sound
    this._emitCarParticles();
    this.particles.update(dt);
    this.camera.update(this.player, dt);
    this.sound.update(this.player.speed, this.player.throttle, this.player.maxSpeed);

    if (this.track.getDistanceToFinish(this.player.x, this.player.y) < FINISH_RADIUS) {
      if (typeof this._tryAdvanceTransitLeg === 'function' && this._tryAdvanceTransitLeg()) {
        this.player.finished = false;
        return;
      }
      if (this._reviewStopHoldsArrival(dt)) {
        this.player.finished = false;
        return;
      }
      // A review stop's name was held back for the ride; arrival reveals it.
      if (this.routeTo && this.routeTo.reviewStop) this.routeTo = { ...this.routeTo, name: this.routeTo.reviewStop };
      this.state = GameState.FINISHED;
      this.sound.silence();
      // Settings/help may still be "open" in state even though the finish card
      // hides their buttons; clear that so Esc chooses a route instead of only
      // closing an invisible panel. Also reclaim focus from any quiz field.
      if (typeof this._closeUtilityPanels === 'function') this._closeUtilityPanels();
      this._reclaimKeyboardFocus();
      const arrived = this._finishLandmark();
      if (arrived) {
        // The arrival card belongs to the finish screen and stays until
        // something replaces it, rather than pretending to be an hour-long timer.
        this._showLandmarkNotice(arrived, { kind: 'sticky' }, 'arrival');
        this._landmarkNoticeAlpha = 1;
      }
      this._ribbon = this.gameyFeatures ? this._computeRouteRibbon() : null;
      this._saveBestTime();
      this._explorationSnapshot = this._saveExploration();
    } else {
      this.player.finished = false;
      this._reviewStopWait = 0;
    }
  }

  _updateBoundaryCollisions() {
    if (this.travelMode === 'car' || this.travelMode === 'transit') return;
    for (const car of this.cars) {
      const surface = this.track.getSurface(car.x, car.y);
      if (surface === 'grass') {
        const roadInfo = this.track.getNearestRoad(car.x, car.y);
        if (roadInfo) {
          const dx = roadInfo.x - car.x, dy = roadInfo.y - car.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / d, ny = dy / d;
          const pushStr = Math.min(d * COLLISION_PUSH_FACTOR, COLLISION_PUSH_MAX);
          car.x += nx * pushStr;
          car.y += ny * pushStr;
          car.speed *= COLLISION_SPEED_DECAY;
          const rx = -Math.sin(car.angle), ry = Math.cos(car.angle);
          const latComp = car.vx * rx + car.vy * ry;
          car.vx -= rx * latComp * 0.5;
          car.vy -= ry * latComp * 0.5;
          const toRoadAngle = Math.atan2(dy, dx);
          const norm = normalizeAngle(toRoadAngle - car.angle);
          car.angle += norm * OFF_ROAD_CORRECTION;
        }
      } else if (surface === 'curb') {
        const roadInfo = this.track.getNearestRoad(car.x, car.y);
        if (roadInfo) {
          const dx = roadInfo.x - car.x, dy = roadInfo.y - car.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          car.x += (dx / d) * OFF_ROAD_PUSH_SPEED;
          car.y += (dy / d) * OFF_ROAD_PUSH_SPEED;
          car.speed *= OFF_ROAD_SPEED_DECAY;
        }
      }
    }
  }

  _boatFitsRenderedWater(boat) {
    if (!this.vectorMap || !this.vectorMap.ready) return true;
    // The rule lives in game/boatCorridor.ts, where it is driven through every
    // named lock in the extract. It used to strand the boat in fifteen of them.
    return CanalRecallBoat.boatFitsWater(boat, {
      isWater: (x, y) => this.vectorMap.isWater(x, y, this.osmLoader),
      nearestCentreline: (x, y) => this.track.getNearestRoad(x, y),
    });
  }

  _emitCarParticles() {
    for (const car of this.cars) {
      const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
      if (car.isDrifting) {
        const rx = -sin, ry = cos;
        for (const s of [-1, 1]) {
          const wx = car.x - cos * car.length * 0.35 + rx * s * car.width * 0.4;
          const wy = car.y - sin * car.length * 0.35 + ry * s * car.width * 0.4;
          this.particles.emit(wx, wy, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20 - 10, 'smoke');
          this.particles.addSkidMark(wx, wy, 0.6);
        }
      }
      if (car.throttle > 0.5 && Math.abs(car.speed) > 50) {
        const ex = car.x - cos * car.length * 0.5;
        const ey = car.y - sin * car.length * 0.5;
        this.particles.emit(ex, ey, -cos * 15 + (Math.random() - 0.5) * 5, -sin * 15 + (Math.random() - 0.5) * 5, 'exhaust');
      }
      if (car.surfaceType === 'grass' && Math.abs(car.speed) > 30) {
        this.particles.emit(car.x, car.y, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 'dirt');
      }
    }
  }


}

// Runtime subsystems are authored in separate files and retain the Game instance
// as their state boundary. Copy descriptors because class methods are non-enumerable.
for (const RuntimeModule of window.CanalRecallGameModules || []) {
  for (const name of Object.getOwnPropertyNames(RuntimeModule.prototype)) {
    if (name === 'constructor') continue;
    Object.defineProperty(Game.prototype, name,
      Object.getOwnPropertyDescriptor(RuntimeModule.prototype, name));
  }
  for (const name of Object.getOwnPropertyNames(RuntimeModule)) {
    if (['length', 'name', 'prototype'].includes(name)) continue;
    Object.defineProperty(Game, name, Object.getOwnPropertyDescriptor(RuntimeModule, name));
  }
}

// ============================================================
// INITIALIZATION
// ============================================================
// Expose the running instance for the browser smoke-test/debug harness. Game
// state remains owned here; this only avoids brittle DOM-only test hooks.
window.addEventListener('load', () => { window.canalRecallGame = new Game(); });
