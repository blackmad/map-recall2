// ============================================================
// GAME
// ============================================================
const GameState = { MENU: 0, MAP_SELECT: 1, LOADING: 2, RACING: 4, FINISHED: 5, PAUSED: 6 };
Object.freeze(GameState);

const CANAL_ROUTE_POIS = [
  { id: 'central', name: 'Central Station', lat: 52.3784943, lng: 4.899843 },
  { id: 'anne-frank', name: 'Anne Frank House', lat: 52.3753446, lng: 4.8840669 },
  { id: 'rijksmuseum', name: 'Rijksmuseum', lat: 52.3598672, lng: 4.8864162 },
  { id: 'maritime', name: 'National Maritime Museum', lat: 52.371493, lng: 4.9151332 },
  { id: 'nemo', name: 'NEMO Science Museum', lat: 52.3738532, lng: 4.9121113 },
  { id: 'palace', name: 'Royal Palace', lat: 52.373258, lng: 4.8918222 },
  { id: 'red-light', name: 'Red Light District', lat: 52.3719371, lng: 4.8956406 },
  { id: 'rembrandt', name: 'Rembrandt House', lat: 52.3693692, lng: 4.9012497 },
  { id: 'hart', name: 'H’ART Museum', lat: 52.3656522, lng: 4.9022137 },
  { id: 'westerkerk', name: 'Westerkerk', lat: 52.3743736, lng: 4.8837289 },
  { id: 'mint', name: 'Mint Tower', lat: 52.3670418, lng: 4.8932804 }
];

const DIFFICULTY_PRESETS = {
  easy: { answerMode: 'multiple', line: true, arrow: true, minimap: true },
  medium: { answerMode: 'multiple', line: false, arrow: true, minimap: true },
  hard: { answerMode: 'typing', line: false, arrow: true, minimap: false },
  expert: { answerMode: 'typing', line: false, arrow: false, minimap: false }
};
const DIFFICULTY_SCORE_MULTIPLIERS = { easy: 0.5, medium: 0.75, hard: 1, expert: 1.25, custom: 0.85 };
// Route ribbons grade the trip on what the game is trying to teach — name
// recall, navigating without aids, and choosing an efficient route — rather
// than on raw speed. Ordered best-first; the first tier the score clears wins.
// `minRecall` gates each tier independently of the blended score: this is a
// recall game, so a spotless efficient run that never named a canal correctly
// must not out-rank a slower player who knew where they were.
const ROUTE_RIBBON_TIERS = [
  { id: 'gold',   label: 'GOLD RIBBON',   min: 0.85, minRecall: 0.80, color: '#FACC15', dim: 'rgba(250,204,21,.16)' },
  { id: 'silver', label: 'SILVER RIBBON', min: 0.68, minRecall: 0.55, color: '#CBD5E1', dim: 'rgba(203,213,225,.14)' },
  { id: 'bronze', label: 'BRONZE RIBBON', min: 0.50, minRecall: 0.25, color: '#D8964A', dim: 'rgba(216,150,74,.16)' },
  { id: 'none',   label: 'ROUTE COMPLETE', min: -Infinity, minRecall: -Infinity, color: '#7DD3FC', dim: 'rgba(56,189,248,.12)' }
];
// Weight of each aid when scoring self-reliance. The route line removes the
// navigation problem entirely, so it costs the most.
const RIBBON_AID_COST = { line: 0.5, arrow: 0.25, minimap: 0.25 };
// Route destinations start from the curated list below, then grow with the
// prominence-ranked landmarks in the city extract. Both ends of a route must
// sit inside the single OSM_FETCH_RADIUS window fetched around their midpoint,
// so candidates are capped by distance from the city centre and from each
// other — otherwise a Weesp fort could be paired with Westerpark and half the
// route would fall outside the loaded network.
const AMSTERDAM_CENTRE = { lat: 52.3676, lng: 4.9041 };
const ROUTE_POI_MAX_KM_FROM_CENTRE = 4;
const ROUTE_POI_MAX_PAIR_KM = 6;
const ROUTE_POI_CATALOG_URL = '../data/extracts/amsterdam/landmarks.json';
// Both modes require an actual traversal, never proximity. A boat crosses the
// span's centreline. A car drives along it, so it is tested against a gate
// drawn perpendicular through the span's midpoint: sitting at the kerb aligned
// with a bridge no longer counts, only passing its middle does.
const BRIDGE_GATE_HALF_WIDTH = 26; // px — gate reaches this far either side
const BRIDGE_LABEL_RANGE = 900; // px — keep named bridges labelled while nearby
// How far a traversal may be from a crossing's centroid and still be that
// crossing. Crossings of one bridge are clustered at least 70 m apart, and a
// wide multi-span deck puts its centroid a span-length from the wheels.
const CROSSING_MATCH_RANGE = 900; // px — 300 m
// How many nearby stand-in destinations to try before giving up on routing.
const RETARGET_ATTEMPTS = 25;
// A stranded origin is re-rolled at most this many times before we accept it.
const MAX_ROUTE_REROLLS = 2;
const CONTROLS_HINT_DURATION = 12;   // seconds the keyboard hint stays on screen
const ZOOM_BADGE_DURATION = 1.4;     // seconds the zoom percentage lingers
const LIVE_ROUTE_OFF_ROUTE_DIST = 140; // px off the path before a full reroute
const LIVE_ROUTE_REROUTE_INTERVAL = 2; // seconds between reroute attempts

const CANAL_PREFS_KEY = 'canalRecall.preferences.v1';
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
    this.controlMode = 'relative';
    this.viewMode = 'north';
    this.themeMode = 'clean';
    this.learnedNames = new Set();
    // Every name the player has been shown this route, right or wrong.
    // `learnedNames` is the score; this feeds the map.
    this.revealedNames = new Set();
    // What is actually written on the map: the names revealed this route plus
    // every name the spaced-repetition store considers known. A street you
    // know well enough that the game has stopped asking is exactly the one
    // whose label you still want to see while driving past it.
    this._mapLabelNames = new Set();
    this.routeFrom = CANAL_ROUTE_POIS[1];
    this.routeTo = CANAL_ROUTE_POIS[2];
    // Grows once the landmark extract loads; see _loadRoutePoiCatalog.
    this.routePois = [...CANAL_ROUTE_POIS];
    this.bridges = [];
    this._routeRerolls = 0;
    this._zoomBadgeTimer = 0;
    // Once the player picks a zoom, a rotation or resize must not overrule it.
    this._zoomTouchedByPlayer = false;
    // Filled by _resize before the first frame; the design space until then.
    this.viewport = window.CanalRecallUi.resolveViewport({ windowWidth: CANVAS_W, windowHeight: CANVAS_H });
    this._lastZoomShown = null;
    this._liveRoutePath = null;
    this._liveRouteIndex = -1;
    this._rerouteTimer = 0;
    this._plannedRouteLengthPx = 0;
    this._routeLearningPlan = null;
    this._routeMastery = {};
    this.quizPromptKind = 'route';
    // Keyed per crossing, not per bridge: one OSM feature named "Zuiderzeeweg"
    // is four separate bridges over three different waters.
    this._quizzedCrossings = new Map();
    this._learnedBridges = new Map();
    this._pendingCrossing = null;
    this._lastBridgeQuizAt = -Infinity;
    // name -> world points where the store says this name is already known.
    // Rebuilt per race so the label test stays a short local loop.
    this._knownPlaces = new Map();
    this.routePattern = 'surprise';
    this.homeBase = null;
    this.homeLeg = 'outbound';

    // OSM components
    this.osmLoader = new OSMLoader();
    this.mapPicker = new MapPicker();
    this.loadingScreen = new LoadingScreen();
    this.vectorMap = new VectorBasemap(document.getElementById('vector-map'));
    this.loadingMessage = '';
    this.loadingProgress = 0;
    this.trackMode = TRACK_MODE_POINT_TO_POINT;
    this._loadingAborted = false;
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
    this._visitedNeighborhoods = new Set();
    this._seenLandmarkNames = new Set();
    // Generated trivia, filled by _loadLandmarks from facts.json. Empty until
    // then, and empty for good if no batch has been published, in which case
    // every card falls back to its Wikipedia lede.
    this._facts = new Map();
    this._factRotation = { history: {}, shown: 0, recentKinds: [] };
    this._explorationSnapshot = null;
    this._assistUsage = { line: false, arrow: false, minimap: false };
    this._ribbon = null;
    // Master switch for the arcade layer. On by default so existing players
    // keep the game they have; off produces a calm navigation-and-recall trip
    // with no streaks, multipliers, points, or ribbons. Difficulty and
    // navigation aids stay independent of it.
    this.gameyFeatures = true;
    this._debugMode = false;
    this._recenterBtnBounds = null;
    this._landmarkNotice = null;
    this._landmarkCardBounds = null;
    // Why the card is up decides when it comes down; see game/landmarkNotice.ts.
    this._landmarkNoticeHold = { kind: 'timed', seconds: 0 };
    this._landmarkNoticeState = { elapsed: 0, fadeRemaining: null };
    this._landmarkNoticeAlpha = 0;
    this._landmarkImages = new Map();
    this.streetKnowledge = new Map();
    this._blockedBoatFrames = 0;
    this._blockedCarFrames = 0;

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
      if (this.state === GameState.MENU) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
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
      if (this.state === GameState.MENU) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        let hovering = false;
        if (this._alanLinkBounds) {
          const b = this._alanLinkBounds;
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) hovering = true;
        }
        if (this._githubLinkBounds) {
          const b = this._githubLinkBounds;
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) hovering = true;
        }
        this.canvas.style.cursor = hovering ? 'pointer' : 'default';
      } else if (this._landmarkCardBounds) {
        const rect = this.canvas.getBoundingClientRect();
        const b = this._landmarkCardBounds;
        const x = (e.clientX - rect.left) * CANVAS_W / rect.width;
        const y = (e.clientY - rect.top) * CANVAS_H / rect.height;
        const over = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
        this.canvas.style.cursor = over ? 'pointer' : 'default';
      } else {
        this.canvas.style.cursor = 'default';
      }
    });

    requestAnimationFrame(t => this._loop(t));
    this._checkShareLink();
  }

  /** Logical canvas coordinates for a pointer/mouse event. */
  _eventPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left) * CANVAS_W / rect.width,
      y: (event.clientY - rect.top) * CANVAS_H / rect.height,
    };
  }

  _setupCameraGestures() {
    let dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
    this.canvas.addEventListener('wheel', event => {
      if (this.state === GameState.MENU) return;
      event.preventDefault();
      if (event.ctrlKey) {
        this.camera.zoom = clamp(this.camera.zoom * Math.exp(-event.deltaY * 0.002), this.camera.minZoom, this.camera.maxZoom);
        this._zoomTouchedByPlayer = true;
      } else {
        this.camera.pan(event.deltaX, event.deltaY);
      }
      this._cameraZoom.value = this._liveZoom.value = String(this.camera.zoom);
    }, { passive: false });
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || this.state === GameState.MENU) return;
      if (window.CanalRecallUi.isInsideDpad(this._eventPoint(event), this.input.dpad)) return;
      dragging = true; moved = false; downX = lastX = event.clientX; downY = lastY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!dragging) return;
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) moved = true;
      this.camera.pan(lastX - event.clientX, lastY - event.clientY);
      lastX = event.clientX; lastY = event.clientY;
    });
    this.canvas.addEventListener('pointerup', event => {
      if (dragging && !moved) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = (event.clientX - rect.left) * CANVAS_W / rect.width;
        const sy = (event.clientY - rect.top) * CANVAS_H / rect.height;
        if (this._recenterBtnBounds) {
          const b = this._recenterBtnBounds;
          if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
            this.camera.resetPan();
            dragging = false;
            return;
          }
        }
        // The landmark card sits over the map, so it has to claim the click
        // before it reaches the buildings underneath it.
        if (this._landmarkCardBounds) {
          const b = this._landmarkCardBounds;
          if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
            this._expandLandmarkNotice();
            dragging = false;
            return;
          }
        }
        this._inspectBuildingAt(event.clientX, event.clientY);
      }
      dragging = false;
    });
  }

  // The logical drawing space follows the window rather than being fixed at
  // 1280×720 and letterboxed into it. On a phone that letterbox was the whole
  // portrait bug: a 390×844 window produced a 390×219 canvas floating in the
  // middle of the screen, while the MapLibre layer underneath kept its own
  // size — so the HUD and the map showed different parts of the city.
  _resize() {
    const viewport = window.CanalRecallUi.readWindowViewport(window);
    this.viewport = viewport;
    // Everything that draws reads these at call time, so reassigning them here
    // moves the whole HUD into the new coordinate space.
    CANVAS_W = viewport.width;
    CANVAS_H = viewport.height;
    // In compact mode the canvas is pinned to the viewport by CSS rather than
    // sized in pixels, so it can never be wider than the screen and cannot
    // start the overflow -> shrink-to-fit -> wider-innerWidth loop that used to
    // latch the desktop layout onto a phone.
    const compact = viewport.mode === 'compact';
    document.body.classList.toggle('compact-layout', compact);
    this.canvas.style.width = compact ? '100%' : viewport.cssWidth + 'px';
    this.canvas.style.height = compact ? '100%' : viewport.cssHeight + 'px';
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
    if (this.input.wasPressed('KeyG')) this._toggleUtilityPanel(this._settingsPanel);
    if (this.input.wasPressed('Escape') && this._utilityOpen) { this._closeUtilityPanels(); return; }
    if (this._utilityOpen) return;
    if (this.input.wasPressed('Tab') || this.input.wasPressed('KeyM')) this.showMiniMap = !this.showMiniMap;
    if (this.input.wasPressed('KeyL')) {
      this.routeOptions.line = !this.routeOptions.line;
      this._assistLine.checked = this.routeOptions.line;
      this._liveLine.checked = this.routeOptions.line;
      this.vectorMap.setRoute(this.routePath, this.osmLoader, this.routeOptions.line);
      this._savePreferences();
    }
    if (this.input.wasPressed('KeyF')) this.routeOptions.arrow = !this.routeOptions.arrow;
    if (this.input.wasPressed('KeyO')) this.camera.northUp = !this.camera.northUp;
    if (this.input.wasPressed('KeyN')) { this._setSoundEnabled(this.sound.muted); this._savePreferences(); }
    if (this.input.wasPressed('KeyD')) this.vectorMap.toggleLabels();
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
          this._loadingAborted = true;
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
          this.state = GameState.RACING;
          this.sound.resume();
        }
        if (this.input.wasPressed('KeyM')) {
          this.state = GameState.MENU;
          this._routeSetup.style.display = 'flex';
          this.sound.silence();
          history.replaceState(null, '', window.location.pathname);
        }
        if (this.input.wasPressed('KeyC') && this._shareUrl) {
          navigator.clipboard.writeText(this._shareUrl).catch(() => {});
          this._copiedTimer = 2;
        }
        break;

      case GameState.FINISHED:
        if (this._copiedTimer > 0) this._copiedTimer -= dt;
        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyM')) {
          if (this.routePattern === 'home') { this._startNextHomeLeg(); break; }
          // Restart same track
          this._setupRace();
          this.state = GameState.RACING;
        }
        if (this.input.wasPressed('Escape')) {
          this.state = GameState.MENU;
          this._routeSetup.style.display = 'flex';
          history.replaceState(null, '', window.location.pathname);
        }
        if (this.input.wasPressed('KeyC') && this._shareUrl) {
          navigator.clipboard.writeText(this._shareUrl).catch(() => {});
          this._copiedTimer = 2;
        }
        break;
    }
  }

  // ---- Racing sub-updates (extracted for readability) ----

  _updateRacing(dt) {
    this.raceTime += dt;
    for (const car of this.cars) car.totalTime = this.raceTime;
    if (this.routeOptions.line) this._assistUsage.line = true;
    if (this.routeOptions.arrow) this._assistUsage.arrow = true;
    if (this.showMiniMap) this._assistUsage.minimap = true;

    if (this.quizPromptName) {
      this.camera.update(this.player, dt);
      return;
    }

    // Player boat update (Smokey's original vehicle controller)
    const previousPlayerPosition = { x: this.player.x, y: this.player.y };
    this.sound.resume();
    this.player.handleInput(this.input);
    this.player.update(dt, this.track);
    if (this.travelMode === 'car') {
      const road = this.track.getNearestRoad(this.player.x, this.player.y, this.player.angle);
      const previousRoad = this.track.getNearestRoad(previousPlayerPosition.x, previousPlayerPosition.y, this.player.angle);
      const guard = CanalRecallCar.constrainCarToRoad(
        this.player,
        previousPlayerPosition,
        road,
        previousRoad,
        { edgeTolerance: CAR_ROAD_EDGE_TOLERANCE, blockedFrames: this._blockedCarFrames }
      );
      this._blockedCarFrames = guard === 'rolled-back' ? this._blockedCarFrames + 1 : 0;
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
      this.state = GameState.FINISHED;
      this.sound.silence();
      const arrived = this._finishLandmark();
      if (arrived) {
        // The arrival card belongs to the finish screen and stays until
        // something replaces it, rather than pretending to be an hour-long timer.
        this._showLandmarkNotice(arrived, { kind: 'sticky' });
        this._landmarkNoticeAlpha = 1;
      }
      this._ribbon = this.gameyFeatures ? this._computeRouteRibbon() : null;
      this._saveBestTime();
      this._explorationSnapshot = this._saveExploration();
    } else {
      this.player.finished = false;
    }
  }

  _updateBoundaryCollisions() {
    if (this.travelMode === 'car') return;
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
