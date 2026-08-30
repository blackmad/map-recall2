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
    this._lastZoomShown = null;
    this._liveRoutePath = null;
    this._liveRouteIndex = -1;
    this._rerouteTimer = 0;
    this._plannedRouteLengthPx = 0;
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
    this._landmarkNoticeTimer = 0;
    this._landmarkNoticeDuration = 6;
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
    window.addEventListener('resize', () => this._resize());
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
      } else {
        this.canvas.style.cursor = 'default';
      }
    });

    requestAnimationFrame(t => this._loop(t));
    this._checkShareLink();
  }

  _setupCameraGestures() {
    let dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
    this.canvas.addEventListener('wheel', event => {
      if (this.state === GameState.MENU) return;
      event.preventDefault();
      if (event.ctrlKey) {
        this.camera.zoom = clamp(this.camera.zoom * Math.exp(-event.deltaY * 0.002), this.camera.minZoom, this.camera.maxZoom);
      } else {
        this.camera.pan(event.deltaX, event.deltaY);
      }
      this._cameraZoom.value = this._liveZoom.value = String(this.camera.zoom);
    }, { passive: false });
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || this.state === GameState.MENU) return;
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
        this._inspectBuildingAt(event.clientX, event.clientY);
      }
      dragging = false;
    });
  }

  _inspectBuildingAt(clientX, clientY) {
    if (!this.player || this.quizPromptName || this._utilityOpen) return;
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: (clientX - rect.left) * CANVAS_W / rect.width, y: (clientY - rect.top) * CANVAS_H / rect.height };
    const building = this.vectorMap.inspectBuilding(clientX - rect.left, clientY - rect.top, rect);
    let nearest = null, nearestDistance = 120;
    for (const landmark of this.landmarks) {
      const point = this.camera.worldToScreen(landmark.x, landmark.y);
      const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    if (nearest && building && building.featureTarget) {
      // Keep the curated card identity, but highlight the actual extrusion
      // under the click rather than rebuilding its approximate OSM footprint.
      nearest = { ...nearest, featureTarget: building.featureTarget };
    }
    if (!nearest) {
      if (!building) return;
      const buildingName = building.name || '';
      const matchedLandmark = this._matchLandmarkToBuilding(building, buildingName);
      if (matchedLandmark) {
        nearest = { ...matchedLandmark, featureTarget: building.featureTarget };
      } else {
        // A nameless footprint cannot teach the player anything, but swallowing
        // the click makes the map look broken. Acknowledge it without inventing
        // a name or presenting it as encyclopedia content.
        nearest = buildingName ? {
          id: `clicked-${building.id || building.lngLat.join('-')}`,
          name: buildingName,
          detail: 'Mapped building — click nearby landmarks to learn more.',
          lngLat: building.lngLat,
          featureTarget: building.featureTarget,
        } : {
          id: `clicked-${building.id || building.lngLat.join('-')}`,
          name: 'No building details',
          detail: 'This building has no name in the map data.',
          lngLat: building.lngLat,
          featureTarget: building.featureTarget,
        };
      }
    }
    this._ensureLandmarkSummary(nearest);
    this._landmarkNotice = nearest;
    this._landmarkNoticeTimer = 8;
    this._landmarkNoticeDuration = 8;
    this.vectorMap.setActiveLandmark(nearest);
  }

  // Buildings were matched to landmarks by exact name equality, so anything
  // with different punctuation, casing, or a localised OSM name fell through
  // to the generic "Mapped building" card even when the extract had a full
  // Wikipedia entry for it. Compare normalised names, then fall back to the
  // nearest landmark to the clicked footprint.
  // The extract carries a Wikipedia URL for 236 of its 300 landmarks, which
  // the canvas card cannot make clickable — so offer it on a key instead.
  // Only 112 of the 300 landmarks ship an extract, so the rest showed a bare
  // name. Wikipedia's REST summary endpoint sends CORS headers, so the missing
  // text can be fetched on demand — no proxy, one request per landmark, cached
  // for the session.
  // The article OSM tags is nearly always the Dutch one ("nl:Blauwbrug"), so
  // fetching the summary it names filled the card with Dutch. The English
  // article is resolved through the feature's Wikidata id instead, and if
  // English has nothing to say about the place the card keeps its name rather
  // than showing a language the player did not ask for.
  _ensureLandmarkSummary(landmark) {
    if (!landmark || landmark.longDetail || landmark.detail) return;
    if (!landmark.wikidata && !this._englishTitle(landmark)) return;
    this._summaryRequests = this._summaryRequests || new Set();
    if (this._summaryRequests.has(landmark.id)) return;
    this._summaryRequests.add(landmark.id);
    this._fetchEnglishSummary(landmark).catch(() => { /* the card falls back to its name */ });
  }

  // `en:Title` on the feature itself, when the extract builder already found
  // one; otherwise nothing, and the Wikidata lookup does the work.
  _englishTitle(landmark) {
    if (!landmark.wikipedia) return '';
    const separator = landmark.wikipedia.indexOf(':');
    if (separator < 0) return '';
    return landmark.wikipedia.slice(0, separator) === 'en' ? landmark.wikipedia.slice(separator + 1) : '';
  }

  async _fetchEnglishSummary(landmark) {
    let title = this._englishTitle(landmark);
    if (!title && landmark.wikidata) {
      const entity = new URL('https://www.wikidata.org/w/api.php');
      entity.search = new URLSearchParams({
        action: 'wbgetentities', format: 'json', props: 'sitelinks',
        sitefilter: 'enwiki', ids: landmark.wikidata, origin: '*',
      }).toString();
      const response = await fetch(entity, { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      title = data?.entities?.[landmark.wikidata]?.sitelinks?.enwiki?.title || '';
    }
    if (!title) return;
    const summary = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const response = await fetch(summary, { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    const extract = data && data.extract;
    if (!extract) return;
    const sentences = extract.split(/(?<=[.!?])\s/);
    landmark.detail = sentences[0].slice(0, 150);
    landmark.longDetail = sentences.slice(0, 3).join(' ').slice(0, 280);
    landmark.extractLang = 'en';
  }

  _openLandmarkArticle() {
    const url = this._landmarkNotice && this._landmarkNoticeTimer > 0 && this._landmarkNotice.wikipediaUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  _showStreetKnowledge(name) {
    const entry = this.streetKnowledge.get(this._normaliseCanalName(name));
    if (!entry) return;
    const detail = entry.wikipediaExtract || '';
    this._landmarkNotice = {
      id: `street-knowledge:${this._normaliseCanalName(name)}`,
      name: entry.name || name,
      type: 'street',
      detail: detail.split(/(?<=[.!?])\s/)[0].slice(0, 150),
      longDetail: detail.split(/(?<=[.!?])\s/).slice(0, 3).join(' ').slice(0, 280),
      wikipediaUrl: entry.wikipediaUrl || '',
      extractLang: 'en',
    };
    this._landmarkNoticeTimer = 8;
    this._landmarkNoticeDuration = 8;
  }

  _matchLandmarkToBuilding(building, buildingName) {
    if (building.id) {
      const byId = this.landmarks.find(landmark => landmark.id === building.id);
      if (byId) return byId;
    }
    if (buildingName) {
      const wanted = this._normaliseCanalName(buildingName);
      const byName = this.landmarks.find(landmark => this._normaliseCanalName(landmark.name) === wanted);
      if (byName) return byName;
    }
    if (!building.lngLat) return null;
    // 60 m: close enough that the click almost certainly hit this landmark's
    // building, without silently relabelling a neighbour.
    let nearest = null, nearestKm = 0.06;
    for (const landmark of this.landmarks) {
      if (!landmark.lngLat) continue;
      const km = Game._kmBetween({ lat: building.lngLat[1], lng: building.lngLat[0] },
                                 { lat: landmark.lngLat[1], lng: landmark.lngLat[0] });
      if (km < nearestKm) { nearest = landmark; nearestKm = km; }
    }
    return nearest;
  }

  // Spaced repetition: the bundled store shares its schedule and Firestore
  // collections with the main Map Recall app, so progress is one body of
  // knowledge rather than two.
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

  _setupRouteForm() {
    this._routeSetup = document.getElementById('route-setup');
    this._routeForm = document.getElementById('route-card');
    this._routeFrom = document.getElementById('route-from');
    this._routeTo = document.getElementById('route-to');
    this._routeDifficulty = document.getElementById('route-difficulty');
    this._answerMode = document.getElementById('answer-mode');
    this._travelMode = document.getElementById('travel-mode');
    this._controlMode = document.getElementById('control-mode');
    this._viewMode = document.getElementById('view-mode');
    this._themeMode = document.getElementById('theme-mode');
    this._assistLine = document.getElementById('assist-line');
    this._assistArrow = document.getElementById('assist-arrow');
    this._assistMinimap = document.getElementById('assist-minimap');
    this._gameyFeatures = document.getElementById('gamey-features');
    this._soundEnabled = document.getElementById('sound-enabled');
    this._treesEnabled = document.getElementById('trees-enabled');
    this._reducedMotion = document.getElementById('reduced-motion');
    this._detailed3d = document.getElementById('detailed-3d');
    this._cameraZoom = document.getElementById('camera-zoom');
    this._routePattern = document.getElementById('route-pattern');
    this._homeAddressField = document.getElementById('home-address-field');
    this._homeAddress = document.getElementById('home-address');
    this._routeError = document.getElementById('route-error');
    for (const poi of CANAL_ROUTE_POIS) {
      this._routeFrom.add(new Option(poi.name, poi.id));
      this._routeTo.add(new Option(poi.name, poi.id));
    }
    this._routeFrom.value = this.routeFrom.id;
    this._routeTo.value = this.routeTo.id;
    this._applyDifficulty('medium');
    this._loadPreferences();
    this._routeDifficulty.addEventListener('change', () => {
      if (this._routeDifficulty.value !== 'custom') this._applyDifficulty(this._routeDifficulty.value);
    });
    this._routePattern.addEventListener('change', () => this._syncHomeAddressField());
    for (const control of [this._answerMode, this._assistLine, this._assistArrow, this._assistMinimap]) {
      control.addEventListener('change', () => { this._routeDifficulty.value = 'custom'; });
    }
    this._routeForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this._startConfiguredRoute();
    });
  }

  _loadPreferences() {
    try {
      const prefs = JSON.parse(localStorage.getItem(CANAL_PREFS_KEY) || '{}');
      const setValue = (control, value) => {
        if (value != null && [...control.options].some(option => option.value === value && !option.disabled)) control.value = value;
      };
      setValue(this._routeDifficulty, prefs.difficulty);
      if (this._routeDifficulty.value !== 'custom') this._applyDifficulty(this._routeDifficulty.value);
      setValue(this._answerMode, prefs.answerMode);
      setValue(this._travelMode, prefs.travelMode);
      setValue(this._controlMode, prefs.controlMode);
      setValue(this._viewMode, prefs.viewMode);
      setValue(this._themeMode, prefs.themeMode);
      setValue(this._routePattern, prefs.routePattern);
      this._homeAddress.value = prefs.homeAddress || '';
      this._syncHomeAddressField();
      if (typeof prefs.line === 'boolean') this._assistLine.checked = prefs.line;
      if (typeof prefs.arrow === 'boolean') this._assistArrow.checked = prefs.arrow;
      if (typeof prefs.minimap === 'boolean') this._assistMinimap.checked = prefs.minimap;
      this._gameyFeatures.checked = prefs.gamey !== false;
      this.gameyFeatures = this._gameyFeatures.checked;
      this._soundEnabled.checked = prefs.sound === true;
      this._treesEnabled.checked = prefs.trees !== false;
      this._detailed3d.checked = prefs.detailed3d === true;
      this._reducedMotion.checked = prefs.reducedMotion === true;
      if (this._skipMastered) {
        this._skipMastered.checked = prefs.skipMastered !== false;
        if (this.recall) this.recall.enabled = this._skipMastered.checked;
      }
      this.camera.reducedMotion = this._reducedMotion.checked;
      if (Number.isFinite(prefs.zoom)) {
        const migratedZoom = prefs.zoomDefaultVersion !== 2 && prefs.zoom === 0.65 ? CAMERA_ZOOM_INITIAL : prefs.zoom;
        this.camera.zoom = clamp(migratedZoom, this.camera.minZoom, this.camera.maxZoom);
      }
      this._cameraZoom.value = String(this.camera.zoom);
      this.themeMode = this._themeMode.value;
      this.vectorMap.applyTheme(this.themeMode);
    } catch (_) {}
  }

  _savePreferences() {
    localStorage.setItem(CANAL_PREFS_KEY, JSON.stringify({
      difficulty: this.routeDifficulty || this._routeDifficulty.value,
      answerMode: this.routeOptions.answerMode,
      travelMode: this.travelMode,
      controlMode: this.controlMode,
      viewMode: this.viewMode,
      themeMode: this.themeMode,
      routePattern: this.routePattern || this._routePattern.value,
      homeAddress: this._homeAddress ? this._homeAddress.value.trim() : '',
      line: !!this.routeOptions.line,
      arrow: !!this.routeOptions.arrow,
      minimap: !!this.routeOptions.minimap,
      trees: this._treesEnabled ? this._treesEnabled.checked : true,
      detailed3d: this._detailed3d ? this._detailed3d.checked : false,
      reducedMotion: this._reducedMotion ? this._reducedMotion.checked : false,
      skipMastered: this._skipMastered ? this._skipMastered.checked : true,
      gamey: this.gameyFeatures,
      sound: !this.sound.muted,
      zoom: this.camera.zoom,
      zoomDefaultVersion: 2
    }));
  }

  _setupUtilityPanels() {
    this._helpPanel = document.getElementById('help-panel');
    this._settingsPanel = document.getElementById('settings-panel');
    this._liveLine = document.getElementById('live-line');
    this._liveArrow = document.getElementById('live-arrow');
    this._liveMinimap = document.getElementById('live-minimap');
    this._liveGamey = document.getElementById('live-gamey');
    this._liveSound = document.getElementById('live-sound');
    this._liveTrees = document.getElementById('live-trees');
    this._liveReducedMotion = document.getElementById('live-reduced-motion');
    this._liveDetailed3d = document.getElementById('live-detailed-3d');
    this._liveZoom = document.getElementById('live-zoom');
    this._liveControls = document.getElementById('live-controls');
    this._liveView = document.getElementById('live-view');
    this._liveTheme = document.getElementById('live-theme');
    document.getElementById('open-help').addEventListener('click', () => this._toggleUtilityPanel(this._helpPanel));
    document.getElementById('open-settings').addEventListener('click', () => this._toggleUtilityPanel(this._settingsPanel));
    document.querySelectorAll('.utility-close').forEach(button => button.addEventListener('click', () => this._closeUtilityPanels()));
    for (const control of [this._liveLine, this._liveArrow, this._liveMinimap, this._liveGamey, this._liveReducedMotion, this._liveTrees, this._liveDetailed3d, this._liveSound, this._liveZoom]) {
      control.addEventListener('change', () => this._readLiveSettings());
    }
    this._liveControls.addEventListener('change', () => this._readLiveSettings());
    this._liveView.addEventListener('change', () => this._readLiveSettings());
    this._liveTheme.addEventListener('change', () => this._readLiveSettings());
  }

  _syncLiveSettings() {
    this._liveLine.checked = !!this.routeOptions.line;
    this._liveArrow.checked = !!this.routeOptions.arrow;
    this._liveMinimap.checked = !!this.showMiniMap;
    this._liveControls.value = this.controlMode;
    this._liveView.value = this.viewMode;
    this._liveTheme.value = this.themeMode;
    this._liveGamey.checked = this.gameyFeatures;
    this._liveSound.checked = !this.sound.muted;
    this._liveTrees.checked = this._treesEnabled.checked;
    this._liveReducedMotion.checked = !!this.camera.reducedMotion;
    this._liveDetailed3d.checked = this._detailed3d.checked;
    this._liveZoom.value = String(this.camera.zoom);
  }

  _readLiveSettings() {
    this.routeOptions.line = this._liveLine.checked;
    this.routeOptions.arrow = this._liveArrow.checked;
    this.showMiniMap = this._liveMinimap.checked;
    this.routeOptions.minimap = this.showMiniMap;
    this.gameyFeatures = this._liveGamey.checked;
    this._gameyFeatures.checked = this.gameyFeatures;
    this.controlMode = this._liveControls.value;
    if (this.player) this.player.controlMode = this.controlMode;
    this.viewMode = this._liveView.value;
    this.camera.viewMode = this.viewMode;
    this.camera.northUp = this.viewMode === 'north';
    this.themeMode = this._liveTheme.value;
    this.vectorMap.applyTheme(this.themeMode);
    this.camera.zoom = Number(this._liveZoom.value);
    this._setSoundEnabled(this._liveSound.checked);
    this._treesEnabled.checked = this._liveTrees.checked;
    this.vectorMap.setTreesVisible(this._liveTrees.checked && (this.viewMode === 'chase' || this.viewMode === 'cockpit'));
    this.camera.reducedMotion = this._liveReducedMotion.checked;
    this._reducedMotion.checked = this.camera.reducedMotion;
    this._detailed3d.checked = this._liveDetailed3d.checked;
    this.vectorMap.setDetailedBuildingsVisible(this._liveDetailed3d.checked && (this.viewMode === 'chase' || this.viewMode === 'cockpit'));
    this._savePreferences();
  }

  _setSoundEnabled(enabled) {
    if (enabled && !this.soundStarted) {
      this.sound.init();
      this.soundStarted = true;
    }
    this.sound.setEnabled(enabled);
    if (this._soundEnabled) this._soundEnabled.checked = enabled;
    if (this._liveSound) this._liveSound.checked = enabled;
  }

  _toggleDebug() {
    this._debugMode = !this._debugMode;
  }

  _renderDebug() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    const panelW = 300, panelH = CANVAS_H - 40;
    roundRect(ctx, CANVAS_W - panelW - 10, 20, panelW, panelH, 8);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    let y = 42;
    const x = CANVAS_W - panelW;
    ctx.fillText('DEBUG  (` to close)', x, y); y += 20;
    ctx.fillStyle = '#E0F2FE';
    ctx.font = '11px monospace';
    if (this.player) {
      const road = this.track.getNearestRoad(this.player.x, this.player.y);
      ctx.fillText(`Pos: ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`, x, y); y += 14;
      ctx.fillText(`Speed: ${Math.round(this.player.speed)} px/s`, x, y); y += 14;
      ctx.fillText(`Angle: ${(this.player.angle * 180 / Math.PI).toFixed(1)}°`, x, y); y += 14;
      ctx.fillText(`Road dist: ${road ? road.dist.toFixed(0) : 'N/A'}`, x, y); y += 14;
      ctx.fillText(`Road name: ${this.track.getRoadName(this.player.x, this.player.y) || '(none)'}`, x, y); y += 14;
      ctx.fillText(`Surface: ${this.track.getSurface(this.player.x, this.player.y)}`, x, y); y += 14;
      ctx.fillText(`Neighborhood: ${this.currentNeighborhood || '(none)'}`, x, y); y += 14;
      ctx.fillText(`Route path: ${this.routePath ? this.routePath.length + ' pts' : 'none'}`, x, y); y += 14;
      ctx.fillText(`Camera pan: ${Math.round(this.camera.panX)}, ${Math.round(this.camera.panY)}`, x, y); y += 14;
    }
    y += 6;
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('ROUTE', x, y); y += 16;
    ctx.fillStyle = '#E0F2FE';
    ctx.font = '11px monospace';
    if (this.routeFrom) ctx.fillText(`From: ${this.routeFrom.name || '?'}`, x, y);
    y += 14;
    if (this.routeTo) ctx.fillText(`To: ${this.routeTo.name || '?'}`, x, y);
    y += 20;
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`POI DESTINATIONS (${this.routePois.length})`, x, y); y += 14;
    ctx.fillStyle = '#E0F2FE';
    ctx.font = '10px monospace';
    const shownPois = [...CANAL_ROUTE_POIS];
    for (const poi of [this.routeFrom, this.routeTo]) {
      if (poi && !shownPois.some(entry => entry.id === poi.id)) shownPois.push(poi);
    }
    for (const poi of shownPois) {
      const isCurrent = (this.routeFrom?.id === poi.id ? '> ' : this.routeTo?.id === poi.id ? '* ' : '  ');
      ctx.fillText(`${isCurrent}${poi.name}`, x, y); y += 12;
    }
    const hidden = this.routePois.length - CANAL_ROUTE_POIS.length;
    if (hidden > 0) {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`  +${hidden} more from the landmark extract`, x, y); y += 12;
      ctx.fillStyle = '#E0F2FE';
    }
    y += 6;
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 12px monospace';
    const networkNames = new Set();
    if (this.track && this.track.segments) {
      for (const seg of this.track.segments) if (seg.name) networkNames.add(seg.name);
    }
    ctx.fillText(`NETWORK (${networkNames.size} named)`, x, y); y += 14;
    ctx.fillStyle = '#E0F2FE';
    ctx.font = '10px monospace';
    const sorted = [...networkNames].sort();
    const maxShow = Math.floor((CANVAS_H - y - 30) / 12);
    for (let i = 0; i < Math.min(sorted.length, maxShow); i++) {
      ctx.fillText(sorted[i], x, y);
      y += 12;
    }
    if (sorted.length > maxShow) {
      ctx.fillText(`... +${sorted.length - maxShow} more`, x, y);
    }
    ctx.restore();
  }

  _toggleUtilityPanel(panel) {
    const opening = panel.style.display !== 'flex';
    this._closeUtilityPanels();
    if (opening) {
      this._syncLiveSettings();
      panel.style.display = 'flex';
      this._utilityOpen = true;
    }
  }

  _closeUtilityPanels() {
    this._helpPanel.style.display = 'none';
    this._settingsPanel.style.display = 'none';
    this._utilityOpen = false;
  }

  _applyDifficulty(level) {
    const preset = DIFFICULTY_PRESETS[level];
    if (!preset) return;
    this._answerMode.value = preset.answerMode;
    this._assistLine.checked = preset.line;
    this._assistArrow.checked = preset.arrow;
    this._assistMinimap.checked = preset.minimap;
  }

  _syncHomeAddressField() {
    this._homeAddressField.style.display = this._routePattern.value === 'home' ? 'flex' : 'none';
  }

  async _geocodeHomeAddress(address) {
    const rawAddress = address.trim();
    const query = `${rawAddress}, Amsterdam`;
    const key = query.toLocaleLowerCase();
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(HOME_GEOCODE_CACHE_KEY) || '{}'); } catch (_) {}
    if (cache[key]) return cache[key];

    // PDOK searches the Dutch BAG address registry and understands unit
    // suffixes such as 13-3. Nominatim's free-form search can silently discard
    // that number and return an arbitrary point along the entire street.
    const pdokUrl = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(query)}&fq=type%3Aadres&rows=10`;
    let resolved = null;
    try {
      const response = await fetch(pdokUrl);
      if (response.ok) {
        const payload = await response.json();
        const docs = payload.response && payload.response.docs || [];
        const requestedUnit = (rawAddress.match(/\b\d+[a-z]?(?:[-\s][a-z0-9]+)?\b/i) || [''])[0]
          .replace(/\s+/g, '-').toLocaleLowerCase();
        const result = docs.find(doc => String(doc.huis_nlt || '').toLocaleLowerCase() === requestedUnit) || docs[0];
        const point = result && String(result.centroide_ll || '').match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
        if (point) resolved = { lat: Number(point[2]), lng: Number(point[1]), label: result.weergavenaam };
      }
    } catch (_) { /* bounded OSM fallback below */ }

    if (!resolved) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=nl&limit=3&bounded=1&viewbox=4.72,52.43,5.02,52.27&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Address search is unavailable right now');
      const results = await response.json();
      const result = results.find(item => item.type === 'house') || results[0];
      if (result) resolved = { lat: Number(result.lat), lng: Number(result.lon), label: result.display_name };
    }
    if (!resolved || !Number.isFinite(resolved.lat) || !Number.isFinite(resolved.lng)) {
      throw new Error('Could not find that exact Amsterdam address');
    }
    const home = { id: 'home', name: 'Home', address: rawAddress, label: resolved.label, lat: resolved.lat, lng: resolved.lng };
    cache[key] = home;
    localStorage.setItem(HOME_GEOCODE_CACHE_KEY, JSON.stringify(cache));
    return home;
  }

  async _startConfiguredRoute({ isReroll = false } = {}) {
    if (!isReroll) this._routeRerolls = 0;
    this._routeError.textContent = '';
    this.routePattern = this._routePattern.value;
    if (this.routePattern === 'home') {
      const address = this._homeAddress.value.trim();
      if (!address) { this._routeError.textContent = 'Enter a home address first.'; return; }
      try {
        this._routeError.textContent = 'Finding your home base…';
        this.homeBase = await this._geocodeHomeAddress(address);
        this.homeLeg = 'outbound';
      } catch (error) {
        this._routeError.textContent = error.message || 'Could not find that address.';
        return;
      }
    }
    const pool = this.routePois;
    const choices = pool.filter(poi => poi.id !== this.routeFrom?.id || pool.length < 3);
    const from = this.routePattern === 'home' ? this.homeBase : choices[Math.floor(Math.random() * choices.length)];
    this._launchPoiRoute(from, this._pickDestinationNear(from));
  }

  // A destination far enough to be a journey but inside the same fetched map
  // window as the origin. Falls back to any other POI if nothing is in range.
  _pickDestinationNear(from, alsoExcludeId = null) {
    const candidates = this.routePois.filter(poi => poi.id !== from.id && poi.id !== alsoExcludeId);
    const inRange = candidates.filter(poi => Game._kmBetween(poi, from) <= ROUTE_POI_MAX_PAIR_KM);
    const pool = inRange.length > 0 ? inRange : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Nearest POI to `target` that actually snaps onto the mapped network.
  _nearestSnappableDestination(target, segments, centreLat, centreLng, snapLimit, excludeId = null) {
    const ranked = this.routePois
      .filter(poi => poi.id !== excludeId && Number.isFinite(poi.lat))
      .map(poi => ({ poi, km: Game._kmBetween(poi, target) }))
      .sort((a, b) => a.km - b.km);
    for (const entry of ranked.slice(0, RETARGET_ATTEMPTS)) {
      const point = this.osmLoader.latLngToGamePoint(entry.poi.lat, entry.poi.lng, centreLat, centreLng, segments, snapLimit);
      if (point) return { poi: entry.poi, point };
    }
    return null;
  }

  // Closest reachable stand-in for an unroutable destination, chosen from the
  // same POI pool and scored by how near it is to the original.
  _retargetToReachableDestination(start, originalFinish, segments, centreLat, centreLng) {
    const ranked = this.routePois
      .filter(poi => poi.id !== this.routeFrom?.id && Number.isFinite(poi.lat))
      .map(poi => {
        const point = this.osmLoader.latLngToGamePoint(poi.lat, poi.lng, centreLat, centreLng, segments, MAX_SNAP_DIST);
        if (!point) return null;
        return { poi, point, gap: dist(point.x, point.y, originalFinish.x, originalFinish.y) };
      })
      .filter(Boolean)
      .filter(entry => dist(entry.point.x, entry.point.y, start.x, start.y) >= MIN_START_FINISH_DIST)
      .sort((a, b) => a.gap - b.gap);
    // One Dijkstra covers the whole graph, so there is no reason to cap how
    // many candidates are tested for reachability — only the snap-distance
    // search above is expensive per candidate.
    const shortlist = ranked;
    const hit = this.track.findRouteToFirstReachable(start, shortlist.map(entry => entry.point));
    if (!hit) return null;
    const chosen = shortlist[hit.index];
    return { poi: chosen.poi, finish: chosen.point, path: hit.path };
  }

  // A name goes on the map the moment the player has seen it.
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
  _updateLiveRouteLine() {
    if (!this.routeOptions.line || !this.routePath || this.routePath.length < 2) return;
    let bestIndex = 0, bestDistance = Infinity;
    for (let i = 0; i < this.routePath.length; i++) {
      const d = dist(this.routePath[i].x, this.routePath[i].y, this.player.x, this.player.y);
      if (d < bestDistance) { bestDistance = d; bestIndex = i; }
    }
    if (bestDistance > LIVE_ROUTE_OFF_ROUTE_DIST && this._rerouteTimer <= 0) {
      this._rerouteTimer = LIVE_ROUTE_REROUTE_INTERVAL;
      const fresh = this.track.findRoute({ x: this.player.x, y: this.player.y }, this.track.finishPoint);
      if (fresh && fresh.length >= 2) {
        this.routePath = fresh;
        bestIndex = 0;
        this._liveRouteIndex = -1;
      }
    }
    // The line is anchored to route vertices rather than to the player. Giving
    // it a head at the player's exact position meant redrawing every 40 px of
    // travel, which read as a jerk; trimming whole vertices as they are passed
    // only changes the geometry at junctions, where it is invisible.
    if (this._liveRouteIndex === bestIndex && this._liveRoutePath) return;
    this._liveRouteIndex = bestIndex;
    const ahead = this.routePath.slice(bestIndex);
    this._liveRoutePath = ahead.length >= 2 ? ahead : [this.routePath[this.routePath.length - 1], this.track.finishPoint];
  }

  // Great-circle-ish distance in km; fine at city scale.
  static _kmBetween(a, b) {
    const latKm = (a.lat - b.lat) * 111.32;
    const lngKm = (a.lng - b.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180);
    return Math.hypot(latKm, lngKm);
  }

  // Widen the destination pool from the 11 hand-written POIs to the whole
  // prominence-ranked landmark extract. Non-blocking: the curated list stays
  // usable if this fetch fails or is slow.
  async _loadRoutePoiCatalog() {
    try {
      const response = await fetch(new URL(ROUTE_POI_CATALOG_URL, window.location.href));
      if (!response.ok) throw new Error(`landmark catalog ${response.status}`);
      const features = await response.json();
      const seen = new Set(CANAL_ROUTE_POIS.map(poi => this._normaliseCanalName(poi.name)));
      const extras = [];
      for (const feature of features) {
        const centre = feature.center;
        if (!centre || !feature.name) continue;
        const key = this._normaliseCanalName(feature.name);
        if (seen.has(key)) continue;
        const poi = { id: `lm-${feature.id}`, name: feature.name, lat: centre[0], lng: centre[1],
                      prominence: feature.prominenceScore || 0, type: feature.type || 'landmark' };
        if (Game._kmBetween(poi, AMSTERDAM_CENTRE) > ROUTE_POI_MAX_KM_FROM_CENTRE) continue;
        seen.add(key);
        extras.push(poi);
      }
      extras.sort((a, b) => b.prominence - a.prominence);
      this.routePois = [...CANAL_ROUTE_POIS, ...extras];
      for (const poi of extras) {
        this._routeFrom.add(new Option(poi.name, poi.id));
        this._routeTo.add(new Option(poi.name, poi.id));
      }
      console.info(`Route destinations: ${this.routePois.length} (${CANAL_ROUTE_POIS.length} curated + ${extras.length} from the extract)`);
    } catch (error) {
      console.warn('Landmark route catalog unavailable, using the curated list:', error);
    }
  }

  _launchPoiRoute(from, to) {
    this.routeFrom = from;
    this.routeTo = to;
    this.routeOptions = {
      answerMode: this._answerMode.value,
      line: this._assistLine.checked,
      arrow: this._assistArrow.checked,
      minimap: this._assistMinimap.checked
    };
    this.gameyFeatures = this._gameyFeatures.checked;
    this.camera.reducedMotion = this._reducedMotion.checked;
    this.travelMode = this._travelMode.value;
    this.controlMode = this._controlMode.value;
    this.viewMode = this._viewMode.value;
    this.camera.viewMode = this.viewMode;
    this.camera.northUp = this.viewMode === 'north';
    this.themeMode = this._themeMode.value;
    this.vectorMap.applyTheme(this.themeMode);
    this.vectorMap.setTreesVisible(this._treesEnabled.checked && (this.viewMode === 'chase' || this.viewMode === 'cockpit'));
    this.vectorMap.setDetailedBuildingsVisible(this._detailed3d.checked && (this.viewMode === 'chase' || this.viewMode === 'cockpit'));
    document.querySelector('#canal-card p').textContent = this.travelMode === 'car' ? 'Which street are you on now?' : 'Which waterway are you on now?';
    this.routeDifficulty = this._routeDifficulty.value;
    this.showMiniMap = this.routeOptions.minimap;
    this._savePreferences();
    this._routeError.textContent = '';
    this._routeSetup.style.display = 'none';
    this.camera.zoom = Number(this._cameraZoom.value);
    this._setSoundEnabled(this._soundEnabled.checked);
    this._onLocationSelected(
      (from.lat + to.lat) / 2,
      (from.lng + to.lng) / 2,
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng }
    );
  }

  _startNextHomeLeg() {
    if (!this.homeBase) return;
    if (this.homeLeg === 'outbound') {
      this.homeLeg = 'return';
      this._launchPoiRoute(this.routeTo, this.homeBase);
      return;
    }
    this.homeLeg = 'outbound';
    this._launchPoiRoute(this.homeBase, this._pickDestinationNear(this.homeBase, this.routeFrom.id));
  }

  _returnToRouteSetup(message) {
    this.state = GameState.MENU;
    this._routeError.textContent = message || '';
    this._routeSetup.style.display = 'flex';
  }

  _checkShareLink() {
    const hash = window.location.hash;
    if (!hash.startsWith('#race=')) return;
    const parts = hash.slice(6).split(',').map(Number);
    if (parts.length !== 6 || parts.some(n => !isFinite(n))) return;
    const [lat, lng, startLat, startLng, finishLat, finishLng] = parts;
    // Bypass menu and map picker — load directly
    this._onLocationSelected(lat, lng, { lat: startLat, lng: startLng }, { lat: finishLat, lng: finishLng });
  }

  _resize() {
    const ratio = CANVAS_W / CANVAS_H;
    let w = window.innerWidth, h = window.innerHeight;
    if (w / h > ratio) { w = h * ratio; } else { h = w / ratio; }
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    // Keep the game's logical 1280×720 coordinate system, but allocate enough
    // backing pixels for large and Retina displays. CSS scaling a fixed 720p
    // canvas was the source of the visibly blocky waterway overlay.
    const backingScale = Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * w / CANVAS_W));
    const backingWidth = Math.round(CANVAS_W * backingScale);
    const backingHeight = Math.round(CANVAS_H * backingScale);
    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
      this.ctx.setTransform(backingScale, 0, 0, backingScale, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }
    if (this.vectorMap) this.vectorMap.resize(w, h);
  }

  _setupRace() {
    this.cars = [];
    this.raceTime = 0;
    this.particles = new ParticleSystem();

    this._seenLandmarks = new Set();
    this._landmarkNotice = null;
    this._landmarkNoticeTimer = 0;

    const startInfo = this.track.getNearestRoad(this.track.startPoint.x, this.track.startPoint.y);
    const startAngle = startInfo ? startInfo.angle : 0;
    const startX = this.track.startPoint.x;
    const startY = this.track.startPoint.y;

    // Player at start
    this.player = new PlayerCar(startX, startY, startAngle);
    this.player.controlMode = this.controlMode;
    this.player.isBoat = this.travelMode === 'boat';
    if (this.player.isBoat) {
      this.player.turnRate *= 1.18;
    } else {
      this.player.turnRate *= PLAYER_CAR_TURN_MULT;
      this.player.driftFactor = PLAYER_CAR_DRIFT_FACTOR;
      this.player.maxSpeed *= PLAYER_CAR_SPEED_MULT;
      this.player.accel *= PLAYER_CAR_ACCEL_MULT;
      this.player.brakeForce *= PLAYER_CAR_BRAKE_MULT;
      this.player.liftOffBraking = PLAYER_CAR_LIFT_OFF_BRAKING;
    }
    this.cars.push(this.player);

    // Canal Recall intentionally starts with a quiet network: the experiment
    // is navigation and name recall, not traffic avoidance.
    this.quizCurrentName = this.track.getRoadName(startX, startY);
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
    this.quizFeedback = this.quizCurrentName ? `Starting on ${this.quizCurrentName}` : '';
    this.quizPromptKind = 'route';
    this._quizzedCrossings = new Map();
    this._learnedBridges = new Map();
    this._pendingCrossing = null;
    this._refreshMasteredLabels();

    // Ribbon scoring: aids can be toggled mid-route, so grade on whichever
    // ones were switched on at any point rather than on the final state.
    this._assistUsage = { line: false, arrow: false, minimap: false };
    this._ribbon = null;

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this._warmRouteNeighborhoodImages();
  }

  // Fetch postcard images for the neighborhoods at either end of the route so
  // the first and last cards are ready; the rest load on entry. Runs from
  // _setupRace because _loadLandmarks resolves before the track is built.
  _warmRouteNeighborhoodImages() {
    if (!this.track || !this.neighborhoods.length) return;
    for (const point of [this.track.startPoint, this.track.finishPoint]) {
      if (point) this._ensureNeighborhoodImage(this._neighborhoodAt(point.x, point.y));
    }
  }

  // ---- OSM Loading Flow ----

  async _onLocationSelected(lat, lng, startLL, finishLL) {
    this.state = GameState.LOADING;
    this._loadingAborted = false;
    this.loadingProgress = 0.05;
    const networkNoun = this.travelMode === 'car' ? 'streets' : 'waterways';
    this.loadingMessage = `Loading Amsterdam ${networkNoun}...`;

    try {
      // Step 1: Fetch from Overpass API (tries multiple servers)
      this.loadingProgress = 0.1;
      const ways = await this.osmLoader.fetchRoads(lat, lng, OSM_FETCH_RADIUS, this.travelMode);
      if (this._loadingAborted) return;

      if (ways.length === 0) {
        this.loadingMessage = `No named ${networkNoun} found here.`;
        setTimeout(() => this._returnToRouteSetup(this.loadingMessage), 2500);
        return;
      }

      // Step 2: Build road segments
      this.loadingMessage = `Building ${this.travelMode === 'car' ? 'street' : 'canal'} network...`;
      this.loadingProgress = 0.3;
      const segments = this.osmLoader.buildRoadSegments(ways, lat, lng);

      if (segments.length === 0) {
        this.loadingMessage = 'Could not build the canal network.';
        setTimeout(() => this._returnToRouteSetup(this.loadingMessage), 2500);
        return;
      }
      await this._loadLandmarks(lat, lng, segments);

      // Step 3: MapLibre supplies a continuously rendered vector basemap.
      this.loadingMessage = 'Preparing vector map...';
      this.loadingProgress = 0.45;
      const tiles = [];
      if (this._loadingAborted) return;

      // Step 4: Find start/finish — use user-picked points or auto-find
      this.loadingMessage = `Choosing a starting ${this.travelMode === 'car' ? 'street' : 'waterway'}...`;
      this.loadingProgress = 0.6;

      let start, finish;
      if (startLL && finishLL) {
        // Convert user-picked lat/lng to game coordinates
        const startSnapLimit = this.routeFrom && this.routeFrom.id === 'home' ? HOME_MAX_SNAP_DIST : MAX_SNAP_DIST;
        const finishSnapLimit = this.routeTo && this.routeTo.id === 'home' ? HOME_MAX_SNAP_DIST : MAX_SNAP_DIST;
        start = this.osmLoader.latLngToGamePoint(startLL.lat, startLL.lng, lat, lng, segments, startSnapLimit);
        finish = this.osmLoader.latLngToGamePoint(finishLL.lat, finishLL.lng, lat, lng, segments, finishSnapLimit);
        // Not every landmark in the extract sits within snapping range of a
        // mapped waterway or street. Rather than bouncing the player back to
        // the setup screen, swap in the nearest destination that does snap.
        if (!start && this.routeFrom && this.routeFrom.id !== 'home') {
          const swap = this._nearestSnappableDestination(startLL, segments, lat, lng, startSnapLimit, this.routeTo?.id);
          if (swap) {
            start = swap.point;
            this.routeFrom = swap.poi;
            startLL = { lat: swap.poi.lat, lng: swap.poi.lng };
            console.info(`Origin swapped to ${swap.poi.name}: the original did not snap to the network`);
          }
        }
        if (!finish && this.routeTo && this.routeTo.id !== 'home') {
          const swap = this._nearestSnappableDestination(finishLL, segments, lat, lng, finishSnapLimit, this.routeFrom?.id);
          if (swap) {
            finish = swap.point;
            this.routeTo = swap.poi;
            finishLL = { lat: swap.poi.lat, lng: swap.poi.lng };
            console.info(`Destination swapped to ${swap.poi.name}: the original did not snap to the network`);
          }
        }
      } else {
        const result = this.osmLoader.findStartFinish(segments);
        start = result.start;
        finish = result.finish;
        const sfDist = result.distance;
        if (!start || !finish || sfDist < 200) {
          this.loadingMessage = 'Area too small. Try a different area.';
          setTimeout(() => this._returnToRouteSetup(this.loadingMessage), 2500);
          return;
        }
      }

      if (!start || !finish) {
        this.loadingMessage = this.routePattern === 'home'
          ? 'That address is too far from a connected mapped waterway. Try a nearby bridge or canal-side address.'
          : 'Could not place start/finish. Try different points.';
        setTimeout(() => this._returnToRouteSetup(this.loadingMessage), 2500);
        return;
      }

      // Validate minimum distance between start and finish
      const sfDist2 = Math.sqrt((start.x - finish.x) ** 2 + (start.y - finish.y) ** 2);
      if (sfDist2 < MIN_START_FINISH_DIST) {
        this.loadingMessage = 'Start and finish are too close. Try different points.';
        setTimeout(() => this._returnToRouteSetup(this.loadingMessage), 2500);
        return;
      }

      // Step 5: Create the waterway network using Smokey's spatial engine.
      this.loadingMessage = 'Rendering waterways...';
      this.loadingProgress = 0.8;

      // Use a small delay to let the loading screen render
      await new Promise(r => setTimeout(r, 50));
      if (this._loadingAborted) return;

      this.track = new RoadNetwork(segments, start, finish, tiles);
      if (this.travelMode === 'boat') this.track.waterTest = (x, y) => this.vectorMap.isWater(x, y, this.osmLoader);
      this.routePath = this.track.findRoute(start, finish);
      if (!this.routePath || this.routePath.length < 2) {
        // Widening the destination pool to the whole landmark extract means a
        // pair can straddle a gap in the navigable graph — most often the IJ,
        // which boats cannot cross because the open-water polygons are not in
        // the routing network. Retarget to the nearest destination that is
        // actually reachable rather than running a route with no path.
        const retarget = this._retargetToReachableDestination(start, finish, segments, lat, lng);
        if (retarget) {
          finish = retarget.finish;
          this.routeTo = retarget.poi;
          finishLL = { lat: retarget.poi.lat, lng: retarget.poi.lng };
          this.track.finishPoint = finish;
          this.routePath = retarget.path;
          console.info(`Destination retargeted to ${retarget.poi.name}: the original was unreachable from the start`);
        } else if (this.routePattern === 'surprise' && this._routeRerolls < MAX_ROUTE_REROLLS) {
          // Nothing in the pool is reachable, so the *origin* is stranded in a
          // disconnected component — most often a Noord canal cut off from the
          // centre by the IJ. Re-roll the pair rather than play a route with
          // no path.
          this._routeRerolls++;
          console.info(`Re-rolling: ${this.routeFrom.name} is not connected to the rest of the network`);
          this._startConfiguredRoute({ isReroll: true });
          return;
        } else {
          console.warn('Route not found between start and finish — route line will not display');
        }
      }
      this._plannedRouteLengthPx = 0;
      this._plannedRouteLengthPx = this._idealRouteLength();
      this.trackMode = TRACK_MODE_POINT_TO_POINT;
      this.renderer.preRenderTrack(this.track);

      // Step 5: Setup race
      this.loadingMessage = 'Ready!';
      this.loadingProgress = 1.0;
      this._setupRace();

      // Generate leaderboard key from route coordinates
      this._raceKey = (startLL && finishLL)
        ? `${lat.toFixed(3)},${lng.toFixed(3)}_${startLL.lat.toFixed(3)},${startLL.lng.toFixed(3)}_${finishLL.lat.toFixed(3)},${finishLL.lng.toFixed(3)}`
        : null;

      // Generate shareable URL
      if (startLL && finishLL) {
        const raceHash = `#race=${lat.toFixed(4)},${lng.toFixed(4)},${startLL.lat.toFixed(4)},${startLL.lng.toFixed(4)},${finishLL.lat.toFixed(4)},${finishLL.lng.toFixed(4)}`;
        this._shareUrl = `${window.location.origin}${window.location.pathname}${raceHash}`;
        history.replaceState(null, '', raceHash);
      } else {
        this._shareUrl = null;
      }

      await new Promise(r => setTimeout(r, 300));

      this.state = GameState.RACING;

    } catch (err) {
      console.error('OSM loading error:', err);
      this.loadingMessage = 'Error: ' + (err.message || 'Failed to load waterways');
      setTimeout(() => this._returnToRouteSetup(this.loadingMessage), 3000);
    }
  }

  // ---- Main Loop ----

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
    if (this.input.isDown('Minus') || this.input.isDown('NumpadSubtract')) this.camera.zoomOut();
    if (this.input.isDown('Equal') || this.input.isDown('NumpadAdd')) this.camera.zoomIn();
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
        this._landmarkNotice = arrived;
        this._landmarkNoticeTimer = 3600;
        this._landmarkNoticeDuration = 3600;
      }
      this._ribbon = this.gameyFeatures ? this._computeRouteRibbon() : null;
      this._saveBestTime();
      this._explorationSnapshot = this._saveExploration();
    } else {
      this.player.finished = false;
    }
  }

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
    const forwardX = Math.cos(boat.angle), forwardY = Math.sin(boat.angle);
    const rightX = -forwardY, rightY = forwardX;
    const halfLength = boat.length * 0.34;
    const halfWidth = boat.width * 0.34;
    const samples = [
      [boat.x, boat.y],
      [boat.x + forwardX * halfLength, boat.y + forwardY * halfLength],
      [boat.x - forwardX * halfLength, boat.y - forwardY * halfLength],
      [boat.x + rightX * halfWidth, boat.y + rightY * halfWidth],
      [boat.x - rightX * halfWidth, boat.y - rightY * halfWidth]
    ];
    return samples.every(([x, y]) => {
      if (this.vectorMap.isWater(x, y, this.osmLoader)) return true;
      // Bridge decks are rendered above the water fill, so MapLibre reports
      // the canal as dry at exactly the place a boat must pass underneath.
      // Permit only a tight corridor around a mapped navigable centreline;
      // unlike the old full-width fallback this cannot authorize roaming over
      // adjacent blocks or quays.
      const road = this.track.getNearestRoad(x, y);
      return !!road && road.dist <= Math.min(road.width * 0.28, 13);
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
      this.hud.drawMiniMap(ctx, this.track, this.cars, this.cars.indexOf(this.player));
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

  async _loadLandmarks(centerLat, centerLng, segments) {
    try {
      const [landmarkResponse, boundaryResponse, neighborhoodEnrichedResponse, bridgeResponse, crossingResponse, streetKnowledgeResponse] = await Promise.all([
        fetch(new URL('../data/extracts/amsterdam/landmarks.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/boundaries.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/neighborhoods-enriched.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/bridges.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/bridge-crossings.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/street-knowledge.json', window.location.href))
      ]);
      if (!landmarkResponse.ok || !boundaryResponse.ok) throw new Error('Cached place data unavailable');
      const [features, boundaries, neighborhoodEnriched, bridgeFeatures, crossingIndex, streetKnowledge] = await Promise.all([
        landmarkResponse.json(), boundaryResponse.json(),
        neighborhoodEnrichedResponse.ok ? neighborhoodEnrichedResponse.json() : [],
        bridgeResponse.ok ? bridgeResponse.json() : [],
        crossingResponse.ok ? crossingResponse.json() : { bridges: {} },
        streetKnowledgeResponse.ok ? streetKnowledgeResponse.json() : []
      ]);
      this.streetKnowledge = new Map(streetKnowledge.map(entry => [this._normaliseCanalName(entry.name), entry]));
      const neighborhoodData = new Map();
      for (const entry of neighborhoodEnriched) neighborhoodData.set(entry.name, entry);
      this.vectorMap.setPlaces(features, boundaries);
      this.landmarks = features.map(feature => {
        const center = feature.center || (feature.path && feature.path[0]);
        if (!center) return null;
        const point = this.osmLoader.latLngToGamePoint(center[0], center[1], centerLat, centerLng, segments, false);
        if (!point) return null;
        const detail = feature.funFact || feature.wikipediaExtract || '';
        const sourcePaths = feature.paths || (feature.path ? [feature.path] : []);
        const geometryFeatures = sourcePaths.filter(path => path && path.length > 1).map(path => {
          const coordinates = path.map(([lat, lng]) => [lng, lat]);
          const first = coordinates[0], last = coordinates[coordinates.length - 1];
          const closed = coordinates.length > 3 && first[0] === last[0] && first[1] === last[1];
          return { type: 'Feature', properties: {}, geometry: closed ? { type: 'Polygon', coordinates: [coordinates] } : { type: 'LineString', coordinates } };
        });
        if (!geometryFeatures.length) geometryFeatures.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [center[1], center[0]] } });
        const shortDetail = detail.split(/(?<=[.!?])\s/)[0].slice(0, 150);
        const longDetail = detail.split(/(?<=[.!?])\s/).slice(0, 3).join(' ').slice(0, 280);
        return { id: feature.id, name: feature.name, type: feature.type || '', imageUrl: feature.wikipediaImageUrl || '', x: point.x, y: point.y, lngLat: [center[1], center[0]], detail: shortDetail, longDetail, prominenceScore: feature.prominenceScore || 0, wikipediaUrl: feature.wikipediaUrl || '', wikidata: feature.wikidata || '', wikipedia: feature.wikipedia || '', extractLang: feature.wikipediaExtractLang || 'en', geojson: { type: 'FeatureCollection', features: geometryFeatures } };
      }).filter(Boolean);
      // Photos are fetched as the player approaches, not up front. Preloading
      // the 50 most prominent landmarks in the city meant 229 landmarks had a
      // Wikipedia photo and only the top 50 could ever show it: DeLaMar ranks
      // 89th and its card came up bare. It also spent bandwidth on the
      // Rijksmuseum for a route that never goes near it.
      this._landmarkImages = new Map();
      this._landmarkImageRequests = new Set();
      const metersPerDegreeLat = 111320;
      const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
      const toWorld = ([lat, lng]) => ({
        x: (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this.osmLoader._lastOffsetX,
        y: -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this.osmLoader._lastOffsetY
      });
      // Only 42 of the 91 mapped areas are tagged `neighbourhood`, and between
      // them they cover about a tenth of the drivable network — which is why
      // the postcards almost never appeared. Quarters (De Pijp, Grachtengordel)
      // and districts (Centrum, Noord) are places players name too, so they all
      // count; the finest area containing the vehicle wins, with the district
      // as the fallback that covers the rest of the city.
      this.neighborhoods = boundaries
        .filter(boundary => boundary.geometry && NEIGHBORHOOD_KIND_RANK[boundary.kind])
        .map(boundary => {
          const enriched = neighborhoodData.get(boundary.name) || {};
          return {
            name: boundary.name,
            kind: boundary.kind,
            rank: NEIGHBORHOOD_KIND_RANK[boundary.kind],
            rings: boundary.geometry.map(polygon => (polygon[0] || []).map(toWorld)).filter(ring => ring.length > 2),
            wikipediaExtract: enriched.wikipediaExtract || '',
            imageUrl: enriched.imageUrl || '',
            imageAttribution: enriched.imageAttribution || '',
          };
        })
        .filter(hood => hood.rings.length)
        .sort((a, b) => b.rank - a.rank);
      // Most fine-grained quarters do not have their own Wikimedia image yet.
      // Borrow the containing district's photograph rather than showing a flat
      // typographic card; it still depicts the part of Amsterdam being entered.
      for (const hood of this.neighborhoods) {
        if (hood.imageUrl) continue;
        const sample = hood.rings[0] && hood.rings[0][0];
        if (!sample) continue;
        const parent = this.neighborhoods.find(candidate =>
          candidate.rank < hood.rank && candidate.imageUrl
          && candidate.rings.some(ring => this._pointInPolygon(sample.x, sample.y, ring)));
        if (parent) {
          hood.imageUrl = parent.imageUrl;
          hood.imageAttribution = parent.imageAttribution;
          hood.imageArea = parent.name;
        }
      }
      // Bridges carry their own geometry and ready-made distractors, so they
      // can be quizzed the same way waterways and streets are.
      this.bridges = bridgeFeatures.map(feature => {
        const sourcePaths = feature.paths || (feature.path ? [feature.path] : []);
        const lines = sourcePaths.map(path => (path || []).map(toWorld)).filter(line => line.length > 1);
        // 43 of the 300 mapped bridges are called "Brug 117" or similar. That
        // is an asset register number, not a name a player can learn, so they
        // are dropped rather than offered as questions or answers.
        if (!feature.name || lines.length === 0 || GENERIC_BRIDGE_NAME.test(feature.name)) return null;
        // "Gooilijn" and "Westelijke Ringspoorbaan" are railway *lines*, and
        // their viaducts were each asked about separately — 17 questions for
        // the Westelijke Ringspoorbaan alone. Riding under a viaduct is not a
        // bridge you can name, so a rail-only crossing asks nothing. Bridges
        // that carry a road as well as rails keep their question.
        if (feature.carriesRailway && !feature.carriesRoad) return null;
        // Precomputed by scripts/build-bridge-crossings.ts: the physical
        // crossings this named feature is made of, and the water under each.
        // A bridge missing from the index still asks its one question, it just
        // has no water to gate on.
        const published = (crossingIndex.bridges || {})[feature.id];
        const crossings = (published && published.length ? published : [{
          index: 0, center: feature.center, waterway: null, waterwayType: null, waterDistractors: [], spans: lines.length,
        }]).map(crossing => ({ ...crossing, ...toWorld(crossing.center) }));
        return {
          id: feature.id, name: feature.name, lines, crossings,
          distractors: (feature.distractors || []).filter(name => !GENERIC_BRIDGE_NAME.test(name)),
          wikipediaUrl: feature.wikipediaUrl || '',
          detail: (feature.wikipediaExtract || '').split(/(?<=[.!?])\s/)[0].slice(0, 150),
        };
      }).filter(Boolean);

      // Postcard images load on demand — see _warmRouteNeighborhoodImages.
      // Preloading the whole city cost ~26 fetches per route for postcards
      // most trips never reach.
      this._neighborhoodImages = new Map();
      this._neighborhoodLetterArt = new Map();
      this._neighborhoodImageRequests = new Set();
    } catch (error) {
      console.warn('Landmark notes unavailable:', error);
      this.landmarks = [];
    }
  }

  _updateLandmarks(dt) {
    if (this._neighborhoodNoticeTimer > 0) this._neighborhoodNoticeTimer -= dt;
    if (this._landmarkNoticeTimer > 0) {
      this._landmarkNoticeTimer -= dt;
      if (this._landmarkNoticeTimer <= 0) this._landmarkNotice = null;
      if (this._landmarkNoticeTimer <= 0) this.vectorMap.setActiveLandmark(null);
    }
    if (!this.player) return;
    // The list is sorted finest-first, so the first hit is the most specific
    // area containing the vehicle.
    const detectedHood = this._neighborhoodAt(this.player.x, this.player.y);
    const detectedName = detectedHood ? detectedHood.name : '';
    const transition = CanalRecallNeighborhood.advanceNeighborhood({
      current: this.currentNeighborhood,
      candidate: this._neighborhoodCandidate,
      candidateSeconds: this._neighborhoodCandidateTimer,
    }, detectedName, dt);
    this.currentNeighborhood = transition.state.current;
    this._neighborhoodCandidate = transition.state.candidate;
    this._neighborhoodCandidateTimer = transition.state.candidateSeconds;
    const hood = this.neighborhoods.find(area => area.name === this.currentNeighborhood) || detectedHood;
    if (this.currentNeighborhood) this._visitedNeighborhoods.add(this.currentNeighborhood);
    // Arriving somewhere is worth a postcard the first time too. Previously an
    // empty `_previousNeighborhood` swallowed the opening entry, so the card
    // for the neighborhood the route starts in never appeared at all.
    if (this.currentNeighborhood && this.currentNeighborhood !== this._previousNeighborhood) {
      this._previousNeighborhood = this.currentNeighborhood;
      if (!this.quizPromptName && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
        if (hood) this._ensureNeighborhoodImage(hood);
        this._neighborhoodNotice = hood || { name: this.currentNeighborhood };
        this._neighborhoodNoticeTimer = NEIGHBORHOOD_NOTICE_SECONDS;
      }
    }
    let nearest = null;
    let nearestDistance = 300; // 100 m at the current world scale
    for (const landmark of this.landmarks) {
      const distance = Math.hypot(landmark.x - this.player.x, landmark.y - this.player.y);
      if (distance < LANDMARK_IMAGE_PREFETCH_RADIUS) this._ensureLandmarkImage(landmark);
      if (this._seenLandmarks.has(landmark.id)) continue;
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    if (this._landmarkNotice) return;
    if (nearest) {
      this._seenLandmarks.add(nearest.id);
      this._seenLandmarkNames.add(nearest.name);
      this._ensureLandmarkSummary(nearest);
      this._landmarkNotice = nearest;
      this._landmarkNoticeTimer = 6;
      this._landmarkNoticeDuration = 6;
      this.vectorMap.setActiveLandmark(nearest);
    }
  }

  // Finest first: a point inside De Pijp is in De Pijp, not in Zuid.
  _neighborhoodAt(x, y) {
    return this.neighborhoods.find(hood => hood.rings.some(ring => this._pointInPolygon(x, y, ring))) || null;
  }

  // The fallback body for a landmark with no encyclopedia text: what it is and
  // where it is, in a sentence.

  // Fetch a landmark photo once, on demand. Every landmark the extract has a
  // Wikipedia image for can show one; the card falls back to text until it
  // arrives, and a failure is remembered so it is not retried every frame.
  _ensureLandmarkImage(landmark) {
    if (!landmark || !landmark.imageUrl) return;
    if (!this._landmarkImageRequests) this._landmarkImageRequests = new Set();
    if (this._landmarkImageRequests.has(landmark.id)) return;
    this._landmarkImageRequests.add(landmark.id);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => this._landmarkImages.set(landmark.id, img);
    img.onerror = () => console.warn('Landmark image unavailable:', landmark.name, landmark.imageUrl);
    img.src = landmark.imageUrl;
  }

  // Fetch a neighborhood postcard image once, on demand. The postcard renderer
  // already falls back to its typographic composition until the image lands.
  _ensureNeighborhoodImage(hood) {
    if (!hood || !hood.imageUrl) return;
    if (!this._neighborhoodImageRequests) this._neighborhoodImageRequests = new Set();
    if (this._neighborhoodImageRequests.has(hood.name)) return;
    this._neighborhoodImageRequests.add(hood.name);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => this._neighborhoodImages.set(hood.name, img);
    img.onerror = () => console.warn('Neighborhood image unavailable:', hood.name, hood.imageUrl);
    img.src = hood.imageUrl;
  }

  _pointInPolygon(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  _renderLandmarkNotice() {
    if (!this._landmarkNotice) return;
    const ctx = this.ctx;
    const alpha = Math.min(1, this._landmarkNoticeTimer, this._landmarkNoticeDuration - this._landmarkNoticeTimer);
    if (alpha <= 0) return;

    const lm = this._landmarkNotice;
    const img = this._landmarkImages && this._landmarkImages.get(lm.id);
    const hasImage = !!(img && img.complete && img.naturalWidth > 0);
    const cards = window.CanalRecallCards;
    const props = {
      name: lm.name,
      body: lm.longDetail || lm.detail
        || cards.placeOnlyDetail(lm.type, this.currentNeighborhood),
      category: lm.type ? lm.type.toUpperCase() : '',
      extractLang: lm.extractLang,
      hasArticle: !!lm.wikipediaUrl,
      hasImage,
    };
    const measure = (text, font) => { ctx.font = font; return ctx.measureText(text).width; };
    const card = cards.measureLandmarkCard(props, measure);

    // Trivia belongs at the bottom of the screen. Across the top it sat exactly
    // where the player is looking to see what is coming, so a card about a
    // church already passed hid the junction ahead.
    const postcardShowing = !!(this._neighborhoodNotice && this._neighborhoodNoticeTimer > 0);
    const bottomLayout = window.CanalRecallBottomHud?.bottomHudLayout({
      tripWidth: 180, postcardVisible: postcardShowing,
      landmarkWidth: card.width, landmarkHeight: card.height,
      zoomVisible: this._zoomBadgeTimer > 0,
      controlsVisible: !this.input.isMobile && this.raceTime < CONTROLS_HINT_DURATION,
    });
    const cardX = bottomLayout ? bottomLayout.landmark.x : CANVAS_W / 2 - card.width / 2;
    const cardY = bottomLayout ? bottomLayout.landmark.y : CANVAS_H - card.height - 30;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    this.renderer.drawLandmarkCard(ctx, card, cardX, cardY, hasImage ? img : null);
    ctx.restore();
  }

  _renderNeighborhoodNotice() {
    if (!this._neighborhoodNotice || this._neighborhoodNoticeTimer <= 0) return;
    if (this.quizPromptName) return;
    const ctx = this.ctx;
    const duration = NEIGHBORHOOD_NOTICE_SECONDS;
    const alpha = Math.min(1, this._neighborhoodNoticeTimer * 2.5, (duration - this._neighborhoodNoticeTimer) * 2.5);
    if (alpha <= 0) return;

    const hood = this._neighborhoodNotice;
    const img = this._neighborhoodImages && this._neighborhoodImages.get(hood.name);
    const hasImage = !!(img && img.complete && img.naturalWidth > 0);
    const measure = (text, font) => { ctx.font = font; return ctx.measureText(text).width; };
    const card = window.CanalRecallCards.measurePostcard(
      { name: hood.name, kind: hood.kind, imageArea: hood.imageArea, hasImage }, measure);

    const bottomLayout = window.CanalRecallBottomHud?.bottomHudLayout({ tripWidth: 180 });
    const cardX = bottomLayout ? bottomLayout.postcard.x : CANVAS_W - card.width - 20;
    const baseCardY = bottomLayout ? bottomLayout.postcard.y : CANVAS_H - card.height - 76;
    // Slide up into place rather than appearing; the offset is animation, not
    // layout, so it is applied after the band has been arbitrated.
    const slideT = Math.min(1, (duration - this._neighborhoodNoticeTimer) / 0.3);
    const cardY = baseCardY + (1 - (1 - Math.pow(1 - slideT, 3))) * 50;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    this.renderer.drawPostcard(ctx, card, cardX, cardY, hasImage ? img : null);
    ctx.restore();
  }

  // ---- Leaderboard (localStorage) ----

  // ---- Route ribbons ----

  // Length of the graph route the game planned between start and finish, in
  // game pixels. Used as the "no wasted distance" reference for efficiency.
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

// ============================================================
// INITIALIZATION
// ============================================================
// Expose the running instance for the browser smoke-test/debug harness. Game
// state remains owned here; this only avoids brittle DOM-only test hooks.
window.addEventListener('load', () => { window.canalRecallGame = new Game(); });
