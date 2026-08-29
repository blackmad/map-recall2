// ============================================================
// GAME
// ============================================================
const GameState = { MENU: 0, MAP_SELECT: 1, LOADING: 2, COUNTDOWN: 3, RACING: 4, FINISHED: 5, PAUSED: 6 };
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
    this.countdownTimer = 0;
    this.countdownNum = 0;
    this.raceTime = 0;
    this.showMiniMap = true;
    this.cars = [];
    this.policeCars = [];
    this.trafficCars = [];
    this.player = null;
    this.lastTime = 0;
    this.soundStarted = false;
    this.arrested = false;
    this.warnings = 0;
    this.warningPopupTimer = 0;
    this.warningCooldown = 0;
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
    this.routeFrom = CANAL_ROUTE_POIS[1];
    this.routeTo = CANAL_ROUTE_POIS[2];
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

    // CB Radio state
    this._cbMessage = null;
    this._cbTimer = 0;
    this._cbCooldown = 0;
    this._cbTriggered = new Set();
    this._cbHighSpeedTimer = 0;
    this._cbPoliceAlerted = false;
    this.landmarks = [];
    this.neighborhoods = [];
    this.currentNeighborhood = '';
    this._previousNeighborhood = '';
    this._neighborhoodNotice = null;
    this._neighborhoodNoticeTimer = 0;
    this._neighborhoodImages = new Map();
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
    this._blockedBoatFrames = 0;

    this._alanLinkBounds = null;
    this._githubLinkBounds = null;
    this._prompt = document.getElementById('canal-prompt');
    this._promptForm = document.getElementById('canal-card');
    this._promptInput = document.getElementById('canal-answer');
    this._promptFeedback = document.getElementById('canal-feedback');
    this._promptChoices = document.getElementById('canal-choices');
    this._promptForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this._submitCanalAnswer();
    });
    this._setupRouteForm();
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
    let nearest = null, nearestDistance = 120;
    for (const landmark of this.landmarks) {
      const point = this.camera.worldToScreen(landmark.x, landmark.y);
      const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    if (!nearest) {
      const building = this.vectorMap.inspectBuilding(clientX - rect.left, clientY - rect.top, rect);
      if (!building) return;
      const buildingName = building.name || '';
      const matchedLandmark = this.landmarks.find(l =>
        (building.id && l.id === building.id) || (buildingName && l.name === buildingName)
      );
      if (matchedLandmark) {
        nearest = matchedLandmark;
      } else {
        nearest = {
          id: `clicked-${building.id || building.lngLat.join('-')}`,
          name: buildingName || 'Unnamed building',
          detail: buildingName ? 'Mapped building — click nearby landmarks to learn more.' : 'This building has no name in OpenStreetMap yet.',
          lngLat: building.lngLat,
        };
      }
    }
    this._landmarkNotice = nearest;
    this._landmarkNoticeTimer = 8;
    this._landmarkNoticeDuration = 8;
    this.vectorMap.setActiveLandmark(nearest);
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
    this._liveDetailed3d = document.getElementById('live-detailed-3d');
    this._liveZoom = document.getElementById('live-zoom');
    this._liveControls = document.getElementById('live-controls');
    this._liveView = document.getElementById('live-view');
    this._liveTheme = document.getElementById('live-theme');
    document.getElementById('open-help').addEventListener('click', () => this._toggleUtilityPanel(this._helpPanel));
    document.getElementById('open-settings').addEventListener('click', () => this._toggleUtilityPanel(this._settingsPanel));
    document.querySelectorAll('.utility-close').forEach(button => button.addEventListener('click', () => this._closeUtilityPanels()));
    for (const control of [this._liveLine, this._liveArrow, this._liveMinimap, this._liveGamey, this._liveTrees, this._liveDetailed3d, this._liveSound, this._liveZoom]) {
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
    ctx.fillText(`POI DESTINATIONS (${CANAL_ROUTE_POIS.length})`, x, y); y += 14;
    ctx.fillStyle = '#E0F2FE';
    ctx.font = '10px monospace';
    for (const poi of CANAL_ROUTE_POIS) {
      const isCurrent = (this.routeFrom?.id === poi.id ? '> ' : this.routeTo?.id === poi.id ? '* ' : '  ');
      ctx.fillText(`${isCurrent}${poi.name}`, x, y); y += 12;
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

  async _startConfiguredRoute() {
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
    const choices = CANAL_ROUTE_POIS.filter(poi => poi.id !== this.routeFrom?.id || CANAL_ROUTE_POIS.length < 3);
    const from = this.routePattern === 'home' ? this.homeBase : choices[Math.floor(Math.random() * choices.length)];
    const destinations = CANAL_ROUTE_POIS.filter(poi => poi.id !== from.id);
    const to = destinations[Math.floor(Math.random() * destinations.length)];
    this._launchPoiRoute(from, to);
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
    const destinations = CANAL_ROUTE_POIS.filter(poi => poi.id !== this.routeFrom.id);
    this._launchPoiRoute(this.homeBase, destinations[Math.floor(Math.random() * destinations.length)]);
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
    this.policeCars = [];
    this.trafficCars = [];
    this.raceTime = 0;
    this.arrested = false;
    this.warnings = 0;
    this.warningPopupTimer = 0;
    this.warningCooldown = 0;
    this.particles = new ParticleSystem();

    this._seenLandmarks = new Set();
    this._landmarkNotice = null;
    this._landmarkNoticeTimer = 0;

    // Point-to-point: player at start, police along the route
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

    // Ribbon scoring: aids can be toggled mid-route, so grade on whichever
    // ones were switched on at any point rather than on the final state.
    this._assistUsage = { line: false, arrow: false, minimap: false };
    this._ribbon = null;

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
  }

  _spawnPolice() {
    const numPolice = NUM_POLICE;
    const startX = this.track.startPoint.x;
    const startY = this.track.startPoint.y;
    const finishX = this.track.finishPoint.x;
    const finishY = this.track.finishPoint.y;

    // Compute start→finish line for route-biased placement
    const lineDx = finishX - startX;
    const lineDy = finishY - startY;
    const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy) || 1;

    // Collect candidate positions from road segments
    const candidates = [];
    for (const seg of this.track.segments) {
      if (seg.points.length < 2) continue;
      // Sample midpoint-ish positions along each segment
      const step = Math.max(1, Math.floor(seg.points.length / 3));
      for (let i = step; i < seg.points.length - 1; i += step) {
        const p = seg.points[i];
        const dStart = Math.sqrt((p.x - startX) * (p.x - startX) + (p.y - startY) * (p.y - startY));
        if (dStart < MIN_DIST_FROM_START) continue;

        // Perpendicular distance from candidate to start→finish line
        const apx = p.x - startX, apy = p.y - startY;
        const perpDist = Math.abs(apx * lineDy - apy * lineDx) / lineLen;
        if (perpDist > POLICE_CORRIDOR_MAX) continue;

        // Compute angle from adjacent points
        const prev = seg.points[i - 1], next = seg.points[Math.min(i + 1, seg.points.length - 1)];
        const angle = Math.atan2(next.y - prev.y, next.x - prev.x);

        // Add jitter for run-to-run variety
        const routeDist = perpDist + (Math.random() - 0.5) * 300;
        candidates.push({ x: p.x, y: p.y, angle, routeDist });
      }
    }

    // Sort by distance to route corridor (closest first)
    candidates.sort((a, b) => a.routeDist - b.routeDist);

    // Pick up to NUM_POLICE, ensuring they're spread apart
    const chosen = [];
    for (const c of candidates) {
      if (chosen.length >= numPolice) break;
      let tooClose = false;
      for (const p of chosen) {
        const d = Math.sqrt((c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y));
        if (d < MIN_POLICE_SPACING) { tooClose = true; break; }
      }
      if (!tooClose) {
        chosen.push(c);
      }
    }

    for (const c of chosen) {
      const cop = new PoliceCar(c.x, c.y, c.angle);
      this.policeCars.push(cop);
      this.cars.push(cop);
    }
  }

  _spawnTraffic() {
    const startX = this.track.startPoint.x;
    const startY = this.track.startPoint.y;
    const finishX = this.track.finishPoint.x;
    const finishY = this.track.finishPoint.y;

    const lineDx = finishX - startX;
    const lineDy = finishY - startY;
    const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy) || 1;

    const candidates = [];
    for (const seg of this.track.segments) {
      if (seg.points.length < 2) continue;
      const step = Math.max(1, Math.floor(seg.points.length / 4));
      for (let i = step; i < seg.points.length - 1; i += step) {
        const p = seg.points[i];
        const dStart = Math.sqrt((p.x - startX) ** 2 + (p.y - startY) ** 2);
        if (dStart < MIN_DIST_FROM_START * 0.5) continue;

        const apx = p.x - startX, apy = p.y - startY;
        const perpDist = Math.abs(apx * lineDy - apy * lineDx) / lineLen;
        if (perpDist > POLICE_CORRIDOR_MAX * 1.5) continue;

        const prev = seg.points[i - 1];
        const next = seg.points[Math.min(i + 1, seg.points.length - 1)];
        const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
        candidates.push({ x: p.x, y: p.y, angle });
      }
    }

    // Shuffle for variety (unlike police which sort by route distance)
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const chosen = [];
    for (const c of candidates) {
      if (chosen.length >= NUM_TRAFFIC) break;
      let tooClose = false;
      for (const p of chosen) {
        if (dist(c.x, c.y, p.x, p.y) < MIN_TRAFFIC_SPACING) { tooClose = true; break; }
      }
      if (!tooClose) {
        for (const cop of this.policeCars) {
          if (dist(c.x, c.y, cop.x, cop.y) < 80) { tooClose = true; break; }
        }
      }
      if (!tooClose) chosen.push(c);
    }

    for (const c of chosen) {
      const color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
      const car = new TrafficCar(c.x, c.y, c.angle, color);
      this.trafficCars.push(car);
      this.cars.push(car);
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
      if (!this.routePath || this.routePath.length < 2) console.warn('Route not found between start and finish — route line will not display');
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

      this.state = GameState.COUNTDOWN;
      this.countdownTimer = COUNTDOWN_TIME;
      this.countdownNum = 3;

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

      case GameState.COUNTDOWN:
        this.countdownTimer -= dt;
        const newNum = Math.ceil(this.countdownTimer);
        if (newNum !== this.countdownNum && newNum >= 1) {
          this.countdownNum = newNum;
          this.sound.playBeep(440, 0.15);
        }
        if (this.countdownTimer <= 0) {
          this.state = GameState.RACING;
          this.sound.playBeep(880, 0.3);
        }
        this.camera.update(this.player, dt);
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
          this.state = GameState.COUNTDOWN;
          this.countdownTimer = COUNTDOWN_TIME;
          this.countdownNum = 3;
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
    if (this.warningPopupTimer > 0) this.warningPopupTimer -= dt;
    if (this.warningCooldown > 0) this.warningCooldown -= dt;

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
      const road = this.track.getNearestRoad(this.player.x, this.player.y);
      const previousRoad = this.track.getNearestRoad(previousPlayerPosition.x, previousPlayerPosition.y);
      CanalRecallCar.constrainCarToRoad(
        this.player,
        previousPlayerPosition,
        road,
        previousRoad,
        { edgeTolerance: CAR_ROAD_EDGE_TOLERANCE }
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
    this._updateCanalQuiz(dt);

    for (const car of this.cars) {
      if (car instanceof PoliceCar) {
        car.updatePolice(dt, this.track, this.player, this.cars);
        car.update(dt, this.track);
      } else if (car instanceof AICar) {
        car.updateAI(dt, this.track, this.cars);
        car.update(dt, this.track);
      } else if (car instanceof TrafficCar) {
        car.updateTraffic(dt, this.track);
        car.update(dt, this.track);
      }
    }

    // Warning check — 3 strikes and you're out
    this._checkWarnings();
    this._updateLandmarks(dt);

    // Physics: boundary corrections + car-to-car collisions
    this._updateBoundaryCollisions();
    this._updateCarCollisions();

    // Particles + camera + sound
    this._emitCarParticles();
    this.particles.update(dt);
    this.camera.update(this.player, dt);
    this.sound.update(this.player.speed, this.player.throttle, this.player.maxSpeed);

    if (this.track.getDistanceToFinish(this.player.x, this.player.y) < FINISH_RADIUS) {
      this.state = GameState.FINISHED;
      this.sound.silence();
      this._ribbon = this.gameyFeatures ? this._computeRouteRibbon() : null;
      this._saveBestTime();
      this._explorationSnapshot = this._saveExploration();
    } else {
      this.player.finished = false;
    }
  }

  _updateCanalQuiz(dt) {
    const name = this.track.getRoadName(this.player.x, this.player.y);
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
    if (this.quizCandidateTimer < 0.65 || Math.abs(this.player.speed) < 5) return;

    this.quizPromptName = name;
    const quizRoad = this.track.getNearestRoad(this.player.x, this.player.y);
    this.quizPromptSegmentIndex = quizRoad ? quizRoad.segIdx : -1;
    this.quizPromptPointIndex = quizRoad ? quizRoad.ptIdx : 0;
    this.player.speed = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this._prompt.style.display = 'flex';
    const playerScreen = this.camera.worldToScreen(this.player.x, this.player.y);
    this._prompt.classList.toggle('dock-left', playerScreen.x > CANVAS_W / 2);
    this._promptInput.value = '';
    this._promptFeedback.textContent = '';
    if (this.routeOptions.answerMode === 'multiple') {
      this._promptInput.style.display = 'none';
      document.getElementById('canal-submit').style.display = 'none';
      this._promptChoices.style.display = 'grid';
      this._renderCanalChoices(name);
    } else {
      this._promptChoices.style.display = 'none';
      this._promptInput.style.display = 'block';
      document.getElementById('canal-submit').style.display = 'block';
      requestAnimationFrame(() => this._promptInput.focus());
    }
  }

  _renderCanalChoices(correctName) {
    const nearbyNames = this.track.segments
      .filter(segment => segment.points.some(point => dist(point.x, point.y, this.player.x, this.player.y) < 1500))
      .map(segment => segment.name)
      .filter(Boolean);
    const alternatives = [...new Set(nearbyNames)]
      .filter(name => name !== correctName)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const choices = [correctName, ...alternatives].sort(() => Math.random() - 0.5);
    this._promptChoices.replaceChildren(...choices.map(name => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'canal-choice';
      button.textContent = name;
      button.addEventListener('click', () => this._submitCanalAnswer(name));
      return button;
    }));
  }

  _normaliseCanalName(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  _submitCanalAnswer(selectedAnswer) {
    if (!this.quizPromptName) return;
    const correctName = this.quizPromptName;
    const answer = selectedAnswer == null ? this._promptInput.value : selectedAnswer;
    const correct = this._normaliseCanalName(answer) === this._normaliseCanalName(correctName);
    this.quizAttempts++;
    if (correct) {
      this.quizCorrect++;
      this.quizStreak++;
      if (this.quizStreak > this.quizBestStreak) this.quizBestStreak = this.quizStreak;
      const base = Math.round(100 * (DIFFICULTY_SCORE_MULTIPLIERS[this.routeDifficulty] || 0.85));
      // The combo multiplier is arcade scoring; calm mode still scores the
      // answer so a mid-route toggle does not leave a hole in the tally.
      const streakMultiplier = this.gameyFeatures ? 1 + 0.1 * Math.min(this.quizStreak - 1, 9) : 1;
      const earned = Math.round(base * streakMultiplier);
      this.quizPoints += earned;
      this.learnedNames.add(correctName);
      if (!this.gameyFeatures) {
        this.quizFeedback = `Correct — ${correctName}`;
      } else if (this.quizStreak >= 2) {
        this.quizFeedback = `Correct — ${correctName}  (+${earned} pts, ${this.quizStreak}× streak)`;
      } else {
        this.quizFeedback = `Correct — ${correctName}  (+${earned} pts)`;
      }
    } else {
      this.quizStreak = 0;
      this.quizFeedback = `That was ${correctName}`;
    }
    this._promptFeedback.textContent = this.quizFeedback;
    this._promptFeedback.style.color = correct ? '#4ade80' : '#fbbf24';
    this.quizCurrentName = correctName;
    this.quizCandidateName = '';
    this.quizCandidateTimer = 0;
    this.quizPromptName = '';
    this.quizPromptSegmentIndex = -1;
    this.quizPromptPointIndex = 0;
    setTimeout(() => {
      this._prompt.style.display = 'none';
      this.canvas.focus();
    }, 650);
  }

  _checkWarnings() {
    if (this.warningCooldown > 0) return;
    for (const cop of this.policeCars) {
      if (cop.checkArrest(this.player)) {
        this.warnings++;
        cop.freeze();
        this.warningPopupTimer = WARNING_POPUP_DURATION;
        this.warningCooldown = WARNING_COOLDOWN;
        if (this.warnings >= MAX_WARNINGS) {
          this.arrested = true;
          this.state = GameState.FINISHED;
          this.sound.silence();
        }
        break; // only one warning per frame
      }
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

  _updateCarCollisions() {
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i], b = this.cars[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const minDist = 28;
        if (d < minDist && d > 0) {
          const nx = dx / d, ny = dy / d;
          const overlap = (minDist - d) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          const relV = dot(b.vx - a.vx, b.vy - a.vy, nx, ny);
          if (relV < 0) {
            a.vx += nx * relV * 0.5; a.vy += ny * relV * 0.5;
            b.vx -= nx * relV * 0.5; b.vy -= ny * relV * 0.5;
            a.speed *= 0.92; b.speed *= 0.92;
          }
        }
      }
    }
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

  _getPositions() {
    // Exclude police and traffic from race positions
    const racers = this.cars.filter(c => !(c instanceof PoliceCar) && !(c instanceof TrafficCar));
    const sorted = [...racers].sort((a, b) => b.raceProgress - a.raceProgress);
    const playerPos = sorted.indexOf(this.player) + 1;
    return { sorted, playerPos };
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
    // Transparent game world over the live MapLibre vector basemap.
    this.vectorMap.sync(this.camera, this.osmLoader, this.canvas);
    this.vectorMap.setRoute(this.routePath, this.osmLoader, this.routeOptions.line);

    this.renderer.drawTrack(this.camera, this.track);
    this.renderer.drawQuestionFeature(
      this.camera, this.track, this.quizPromptName,
      this.quizPromptSegmentIndex, this.quizPromptPointIndex, this.raceTime
    );
    this.renderer.drawSkidMarks(this.particles, this.camera);

    const sortedCars = [...this.cars].sort((a, b) => a.y - b.y);
    for (const car of sortedCars) {
      if (car instanceof PoliceCar) {
        this.renderer.drawPoliceCar(car, this.camera, this.raceTime);
      } else if (car instanceof TrafficCar) {
        this.renderer.drawTrafficCar(car, this.camera);
      } else {
        if (this.travelMode === 'car') this.renderer.drawPlayerCar(car, this.camera);
        else this.renderer.drawCar(car, this.camera);
      }
    }
    this.renderer.drawParticles(this.particles, this.camera);
    this.track.drawLabels(ctx, this.camera, this.learnedNames);

    // Results replace the live HUD rather than competing with it.
    if (this.state === GameState.FINISHED) {
      this._renderFinish([]);
      return;
    }

    // HUD
    const { sorted, playerPos } = this._getPositions();
    this.hud.drawSpeedometer(ctx, this.player.speed, this.player.maxSpeed);
    this.hud.drawOdometer(ctx, this.player.distancePx);
    this.hud.drawCanalScore(ctx, this.quizCorrect, this.quizAttempts, this.quizPoints, this.quizFeedback, this.quizStreak, this.gameyFeatures);
    const visibleRouteName = this.quizPromptName ? '' : this.track.getRoadName(this.player.x, this.player.y);
    this.hud.drawCurrentLocation(ctx, visibleRouteName, this.currentNeighborhood, this.travelMode, !!this.quizPromptName);
    this.hud.drawDestination(ctx, this.routeTo.name, this.track.getDistanceToFinish(this.player.x, this.player.y));

    if (this.routeOptions.arrow) {
      this.hud.drawFinishDirection(ctx, this.player.x, this.player.y, this.track.finishPoint.x, this.track.finishPoint.y, this.camera);
    }

    if (this.policeCars && this.policeCars.length > 0) {
      this.hud.drawPoliceWarning(ctx, this.policeCars, this.player.x, this.player.y);
    }

    this.hud.drawTimer(ctx, this.raceTime, this.player.bestLap, true);
    if (this.showMiniMap) {
      this.hud.drawMiniMap(ctx, this.track, this.cars, this.cars.indexOf(this.player));
    }
    this._renderLandmarkNotice();
    this._renderNeighborhoodNotice();

    // zoom indicator
    const zoomPct = Math.round(this.camera.zoom * 100);
    if (Math.abs(this.camera.zoom - 1.0) > 0.02) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, CANVAS_W/2 - 35, CANVAS_H - 35, 70, 22, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${zoomPct}%`, CANVAS_W/2, CANVAS_H - 20);
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

    // controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    if (!this.input.isMobile) {
      ctx.fillText('?: help  G: settings  M: map  O: north  D: labels  P: pause', 10, 20);
    }

    // Touch control zones hint (mobile, first 5 seconds of race)
    if (this.input.isMobile && this.input.showTouchHint && this.state === GameState.RACING) {
      this.hud.drawTouchHint(ctx);
    }

    // countdown overlay
    if (this.state === GameState.COUNTDOWN) {
      this._renderCountdown();
    }

    // pause overlay
    if (this.state === GameState.PAUSED) {
      this._renderPaused();
    }

    // finish overlay
    if (this.state === GameState.FINISHED) {
      this._renderFinish(sorted);
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

  _renderCountdown() {
    const ctx = this.ctx;
    const num = Math.ceil(this.countdownTimer);
    if (num >= 1 && num <= 3) {
      const frac = this.countdownTimer % 1;
      const scale = 1 + frac * 0.3;
      ctx.save();
      ctx.translate(CANVAS_W/2, CANVAS_H/2);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#E53935';
      ctx.font = 'bold 120px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.5 + frac * 0.5;
      ctx.fillText(num + '', 0, 0);
      ctx.restore();
    } else if (num <= 0) {
      ctx.fillStyle = '#4CAF50';
      ctx.font = 'bold 80px monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = clamp(this.countdownTimer + 1, 0, 1);
      ctx.fillText('GO!', CANVAS_W/2, CANVAS_H/2);
      ctx.globalAlpha = 1;
    }
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

  _renderFinish(sorted) {
    const ctx = this.ctx;

    if (this.arrested) {
      this._renderArrested();
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const cx = CANVAS_W / 2;
    const gamey = this.gameyFeatures;
    const hasExploration = this._explorationSnapshot && this._explorationSnapshot.totalRoutes > 0;
    const hasRibbon = gamey && !!this._ribbon;

    let bestText = '';
    if (this._raceKey) {
      const stored = this._getBestTime(this._raceKey);
      if (stored && this.raceTime <= stored.time) {
        bestText = '★ NEW PERSONAL BEST';
      } else if (stored) {
        bestText = `Personal best: ${this.hud.formatTime(stored.time)}`;
      }
    }

    // The card grows and shrinks with the arcade layer, the personal-best
    // line, and the exploration box, so lay it out from a running cursor
    // rather than fixed offsets. Keep these increments in step with the
    // cursor advances below.
    const recallBoxH = gamey ? 105 : 78;
    const ribbonBoxH = 74;
    let cardH = 235 + recallBoxH + 40 + 34;
    if (hasRibbon) cardH += ribbonBoxH + 12;
    if (bestText) cardH += 36;
    if (hasExploration) cardH += 58 + 13;
    if (this._shareUrl) cardH += 30;
    const cardY = clamp(Math.round((CANVAS_H - cardH) / 2), 20, CANVAS_H - cardH - 20);
    const cardX = cx - 300, cardW = 600;

    ctx.fillStyle = 'rgba(3,18,28,.94)';
    roundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56,189,248,.65)';
    ctx.lineWidth = 2;
    ctx.stroke();

    let y = cardY + 60;
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DESTINATION REACHED', cx, y);
    y += 35;
    ctx.fillStyle = '#7DD3FC';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${this.routeFrom.name}  →  ${this.routeTo.name}`, cx, y);

    y += 38;
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('TIME', cx, y);
    y += 40;
    ctx.font = 'bold 38px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(this.hud.formatTime(this.raceTime), cx, y);

    y += 34;
    const kilometres = this.player.distancePx / PIXELS_PER_METER / 1000;
    ctx.font = '14px monospace';
    ctx.fillStyle = '#E0F2FE';
    ctx.fillText(`${kilometres.toFixed(2)} km travelled`, cx, y);

    // Recall summary. Points and the best-streak tally are arcade scoring and
    // drop out in calm mode; the accuracy that measures learning stays.
    y += 28;
    const recallNoun = this.travelMode === 'car' ? 'Street recall' : 'Canal recall';
    ctx.fillStyle = 'rgba(14,116,144,.28)';
    roundRect(ctx, cx - 235, y, 470, recallBoxH, 10);
    ctx.fill();
    let inner = y + 28;
    ctx.fillStyle = '#E0F2FE';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(`${recallNoun}: ${this.quizCorrect} / ${this.quizAttempts}`, cx, inner);
    if (gamey) {
      inner += 32;
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`${this.quizPoints} points`, cx, inner);
    }
    inner += 20;
    const accuracy = this.quizAttempts > 0 ? Math.round(100 * this.quizCorrect / this.quizAttempts) : 0;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px monospace';
    const streakText = gamey && this.quizBestStreak >= 2 ? ` · Best streak: ${this.quizBestStreak}` : '';
    ctx.fillText(`${accuracy}% accuracy${streakText}`, cx, inner);
    inner += 18;
    ctx.fillText(`${this.routeDifficulty.toUpperCase()} · ${this.travelMode.toUpperCase()} · ${this.viewMode.replace('-', ' ').toUpperCase()}`, cx, inner);
    y += recallBoxH;

    if (hasRibbon) {
      y += 12;
      this._renderRouteRibbon(ctx, cx - 235, y, 470, ribbonBoxH);
      y += ribbonBoxH;
    }

    if (bestText) {
      y += 36;
      ctx.fillStyle = bestText.startsWith('★') ? '#4ADE80' : '#7DD3FC';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(bestText, cx, y);
    }

    // Exploration collection summary — learning progress, not arcade scoring,
    // so it survives the calm mode.
    if (hasExploration) {
      y += 13;
      const exp = this._explorationSnapshot;
      const totalKnown = exp.learnedWaterways.length + exp.learnedStreets.length;
      ctx.fillStyle = 'rgba(88,28,135,.25)';
      roundRect(ctx, cx - 235, y, 470, 58, 8);
      ctx.fill();
      ctx.fillStyle = '#C4B5FD';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('CITY KNOWLEDGE', cx, y + 19);
      ctx.fillStyle = '#E0E7FF';
      ctx.font = '12px monospace';
      const parts = [];
      if (totalKnown > 0) parts.push(`${totalKnown} waterways`);
      if (exp.visitedNeighborhoods.length > 0) parts.push(`${exp.visitedNeighborhoods.length} neighborhoods`);
      if (exp.seenLandmarks.length > 0) parts.push(`${exp.seenLandmarks.length} landmarks`);
      ctx.fillText(parts.join(' · ') || 'Start exploring!', cx, y + 41);
      const newThisRoute = [];
      if (this.learnedNames.size > 0) newThisRoute.push(`${this.learnedNames.size} names`);
      if (this._visitedNeighborhoods.size > 0) newThisRoute.push(`${this._visitedNeighborhoods.size} neighborhoods`);
      if (this._seenLandmarkNames.size > 0) newThisRoute.push(`${this._seenLandmarkNames.size} landmarks`);
      if (newThisRoute.length > 0) {
        ctx.fillStyle = '#A78BFA';
        ctx.font = '11px monospace';
        ctx.fillText(`+${newThisRoute.join(', +')} this route`, cx, y + 55);
      }
      y += 58;
    }

    y += 40;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('ENTER  Try again     ESC  Choose route', cx, y);
    if (this._shareUrl) {
      y += 30;
      ctx.fillStyle = this._copiedTimer > 0 ? '#4ADE80' : '#94A3B8';
      ctx.font = '13px monospace';
      ctx.fillText(this._copiedTimer > 0 ? 'Race link copied' : 'C  Copy race link', cx, y);
    }
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
      const [landmarkResponse, boundaryResponse, neighborhoodEnrichedResponse] = await Promise.all([
        fetch(new URL('../data/extracts/amsterdam/landmarks.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/boundaries.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/neighborhoods-enriched.json', window.location.href))
      ]);
      if (!landmarkResponse.ok || !boundaryResponse.ok) throw new Error('Cached place data unavailable');
      const [features, boundaries, neighborhoodEnriched] = await Promise.all([
        landmarkResponse.json(), boundaryResponse.json(),
        neighborhoodEnrichedResponse.ok ? neighborhoodEnrichedResponse.json() : []
      ]);
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
        return { id: feature.id, name: feature.name, type: feature.type || '', imageUrl: feature.wikipediaImageUrl || '', x: point.x, y: point.y, lngLat: [center[1], center[0]], detail: shortDetail, longDetail, prominenceScore: feature.prominenceScore || 0, geojson: { type: 'FeatureCollection', features: geometryFeatures } };
      }).filter(Boolean);
      // Preload images for top landmarks by prominence (non-blocking)
      this._landmarkImages = new Map();
      const topLandmarks = [...this.landmarks].sort((a, b) => b.prominenceScore - a.prominenceScore).slice(0, 50);
      for (const lm of topLandmarks) {
        if (!lm.imageUrl) continue;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => this._landmarkImages.set(lm.id, img);
        img.src = lm.imageUrl;
      }
      const metersPerDegreeLat = 111320;
      const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
      const toWorld = ([lat, lng]) => ({
        x: (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this.osmLoader._lastOffsetX,
        y: -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this.osmLoader._lastOffsetY
      });
      this.neighborhoods = boundaries.filter(boundary => boundary.kind === 'neighbourhood' && boundary.geometry).map(boundary => {
        const enriched = neighborhoodData.get(boundary.name) || {};
        return {
          name: boundary.name,
          rings: boundary.geometry.map(polygon => (polygon[0] || []).map(toWorld)).filter(ring => ring.length > 2),
          wikipediaExtract: enriched.wikipediaExtract || '',
          imageUrl: enriched.imageUrl || '',
          imageAttribution: enriched.imageAttribution || '',
        };
      });
      // Preload neighborhood images (non-blocking)
      this._neighborhoodImages = new Map();
      this._neighborhoodLetterArt = new Map();
      for (const hood of this.neighborhoods) {
        if (!hood.imageUrl) continue;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => this._neighborhoodImages.set(hood.name, img);
        img.src = hood.imageUrl;
      }
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
    this.currentNeighborhood = '';
    for (const neighborhood of this.neighborhoods) {
      if (neighborhood.rings.some(ring => this._pointInPolygon(this.player.x, this.player.y, ring))) {
        this.currentNeighborhood = neighborhood.name;
        break;
      }
    }
    if (this.currentNeighborhood) this._visitedNeighborhoods.add(this.currentNeighborhood);
    if (!this._previousNeighborhood) {
      this._previousNeighborhood = this.currentNeighborhood;
    } else if (this.currentNeighborhood && this.currentNeighborhood !== this._previousNeighborhood) {
      this._previousNeighborhood = this.currentNeighborhood;
      if (!this.quizPromptName) {
        const hoodData = this.neighborhoods.find(n => n.name === this.currentNeighborhood);
        this._neighborhoodNotice = hoodData || { name: this.currentNeighborhood };
        this._neighborhoodNoticeTimer = 5.5;
      }
    }
    if (this._landmarkNotice) return;
    let nearest = null;
    let nearestDistance = 300; // 100 m at the current world scale
    for (const landmark of this.landmarks) {
      if (this._seenLandmarks.has(landmark.id)) continue;
      const distance = Math.hypot(landmark.x - this.player.x, landmark.y - this.player.y);
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    if (nearest) {
      this._seenLandmarks.add(nearest.id);
      this._seenLandmarkNames.add(nearest.name);
      this._landmarkNotice = nearest;
      this._landmarkNoticeTimer = 6;
      this._landmarkNoticeDuration = 6;
      this.vectorMap.setActiveLandmark(nearest);
    }
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
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    const lm = this._landmarkNotice;
    const img = this._landmarkImages && this._landmarkImages.get(lm.id);
    const hasImage = img && img.complete && img.naturalWidth > 0;
    const text = lm.longDetail || lm.detail || '';
    const category = lm.type ? lm.type.toUpperCase() : '';

    // Card dimensions
    const cardW = 480, imgW = hasImage ? 90 : 0, imgH = 110;
    const textPadL = hasImage ? imgW + 20 : 16;
    const cardH = hasImage ? Math.max(130, imgH + 20) : (text ? 80 : 50);
    const cardX = CANVAS_W / 2 - cardW / 2, cardY = 70;

    // Background
    ctx.fillStyle = 'rgba(3,18,28,.92)';
    roundRect(ctx, cardX, cardY, cardW, cardH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,204,21,.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Image thumbnail (left side, cover-cropped)
    if (hasImage) {
      const ix = cardX + 10, iy = cardY + 10, iw = imgW, ih = imgH;
      ctx.save();
      roundRect(ctx, ix, iy, iw, ih, 6);
      ctx.clip();
      const aspect = img.naturalWidth / img.naturalHeight;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      const targetAspect = iw / ih;
      if (aspect > targetAspect) {
        sw = img.naturalHeight * targetAspect;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = img.naturalWidth / targetAspect;
        sy = (img.naturalHeight - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, ix, iy, iw, ih);
      ctx.restore();
    }

    // Category badge
    const textX = cardX + textPadL;
    let textY = cardY + 22;
    if (category) {
      ctx.font = 'bold 9px monospace';
      const badgeW = ctx.measureText(category).width + 10;
      ctx.fillStyle = 'rgba(250,204,21,.2)';
      roundRect(ctx, textX, textY - 9, badgeW, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'left';
      ctx.fillText(category, textX + 5, textY);
      textY += 17;
    }

    // Name
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    const maxNameW = cardW - textPadL - 16;
    let displayName = lm.name;
    if (ctx.measureText(displayName).width > maxNameW) {
      while (ctx.measureText(displayName + '…').width > maxNameW && displayName.length > 10) displayName = displayName.slice(0, -1);
      displayName += '…';
    }
    ctx.fillText(displayName, textX, textY);
    textY += 18;

    // Multi-line detail text
    if (text) {
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '11px monospace';
      const maxW = cardW - textPadL - 16;
      const words = text.split(' ');
      let line = '';
      let lines = 0;
      const maxLines = hasImage ? 4 : 2;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, textX, textY);
          textY += 14;
          lines++;
          if (lines >= maxLines) { line = ''; break; }
          line = word;
        } else {
          line = test;
        }
      }
      if (line && lines < maxLines) ctx.fillText(line, textX, textY);
    }

    ctx.restore();
  }

  _renderNeighborhoodNotice() {
    if (!this._neighborhoodNotice || this._neighborhoodNoticeTimer <= 0) return;
    if (this.quizPromptName) return;
    const ctx = this.ctx;
    const duration = 5.5;
    const alpha = Math.min(1, this._neighborhoodNoticeTimer * 2.5, (duration - this._neighborhoodNoticeTimer) * 2.5);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    const hood = this._neighborhoodNotice;
    const img = this._neighborhoodImages && this._neighborhoodImages.get(hood.name);
    const hasImage = img && img.complete && img.naturalWidth > 0;

    const slideT = Math.min(1, (duration - this._neighborhoodNoticeTimer) / 0.3);
    const eased = 1 - Math.pow(1 - slideT, 3);
    const slideOffset = (1 - eased) * 50;

    const cardW = 520;
    const cardH = 180;
    const cardX = CANVAS_W / 2 - cardW / 2;
    const cardY = CANVAS_H - cardH - 30 + slideOffset;

    ctx.beginPath();
    roundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.clip();

    // Sun-faded linen stock and simple travel-poster horizon bands. The photo
    // belongs inside the giant letters, not underneath a generic dark card.
    const paper = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    paper.addColorStop(0, '#F3C06B');
    paper.addColorStop(0.57, '#EAA45F');
    paper.addColorStop(0.58, '#70A6A2');
    paper.addColorStop(1, '#2F7078');
    ctx.fillStyle = paper;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.fillStyle = 'rgba(255,244,211,.18)';
    for (let i = 0; i < 90; i++) {
      const seed = (i * 7919 + hood.name.length * 1049) % 9973;
      ctx.fillRect(cardX + seed % cardW, cardY + (seed * 17) % cardH, 1, 1);
    }

    ctx.strokeStyle = '#F7E6B8';
    ctx.lineWidth = 5;
    roundRect(ctx, cardX + 4, cardY + 4, cardW - 8, cardH - 8, 7);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(85,49,37,.55)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, cardX + 9, cardY + 9, cardW - 18, cardH - 18, 4);
    ctx.stroke();

    const name = hood.name.toUpperCase();
    let fontSize = 82;
    ctx.font = `bold ${fontSize}px "Impact", "Arial Black", sans-serif`;
    while (ctx.measureText(name).width > cardW - 38 && fontSize > 34) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px "Impact", "Arial Black", sans-serif`;
    }
    ctx.textAlign = 'center';
    const nameY = cardY + 132;

    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#713A2C';
    ctx.lineWidth = 12;
    ctx.strokeText(name, CANVAS_W / 2 + 6, nameY + 7);
    ctx.strokeStyle = '#F8EDCE';
    ctx.lineWidth = 7;
    ctx.strokeText(name, CANVAS_W / 2, nameY);
    if (hasImage) {
      if (!this._neighborhoodLetterArt) this._neighborhoodLetterArt = new Map();
      let letters = this._neighborhoodLetterArt.get(hood.name);
      if (!letters) {
        letters = document.createElement('canvas');
        letters.width = cardW; letters.height = cardH;
        const letterCtx = letters.getContext('2d');
        letterCtx.font = ctx.font;
        letterCtx.textAlign = 'center';
        letterCtx.fillStyle = '#fff';
        letterCtx.fillText(name, cardW / 2, 132);
        letterCtx.globalCompositeOperation = 'source-in';
        const aspect = img.naturalWidth / img.naturalHeight;
        let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        if (aspect > cardW / cardH) { sw = sh * cardW / cardH; sx = (img.naturalWidth - sw) / 2; }
        else { sh = sw * cardH / cardW; sy = (img.naturalHeight - sh) / 2; }
        letterCtx.drawImage(img, sx, sy, sw, sh, 0, 0, cardW, cardH);
        this._neighborhoodLetterArt.set(hood.name, letters);
      }
      ctx.drawImage(letters, cardX, cardY);
    } else {
      ctx.fillStyle = '#F4D96B';
      ctx.fillText(name, CANVAS_W / 2, nameY);
    }
    ctx.strokeStyle = '#263D45';
    ctx.lineWidth = 2;
    ctx.strokeText(name, CANVAS_W / 2, nameY);

    ctx.fillStyle = '#5F3328';
    ctx.font = 'italic bold 24px Georgia, serif';
    ctx.fillText('Greetings from', CANVAS_W / 2, cardY + 39);
    ctx.fillStyle = '#F8EDCE';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText('AMSTERDAM · NEDERLAND', CANVAS_W / 2, cardY + 160);

    ctx.restore();
  }

  // ---- Legacy CB helpers (not invoked by Canal Recall) ----

  _updateCBRadio(dt) {
    // Advance display timer for current message
    if (this._cbMessage) {
      this._cbTimer += dt;
      const totalDuration = CB_FADE_IN + CB_DISPLAY + CB_FADE_OUT;
      if (this._cbTimer >= totalDuration) {
        this._cbMessage = null;
        this._cbTimer = 0;
      }
    }

    // Advance cooldown
    if (this._cbCooldown > 0) {
      this._cbCooldown -= dt;
      return;
    }

    // Don't queue another while one is showing
    if (this._cbMessage) return;

    // --- Check triggers in priority order ---

    // 1. Race start (one-shot)
    if (!this._cbTriggered.has('race_start') && this.raceTime < 1.5) {
      this._fireCB('race_start');
      return;
    }

    // 2. Warning received (fires when popup is fresh)
    if (this.warningPopupTimer > WARNING_POPUP_DURATION - 0.1 && this.warningPopupTimer > 0) {
      this._fireCB('warning_received');
      return;
    }

    // 3. Police approaching (first time any cop starts chasing)
    if (!this._cbPoliceAlerted) {
      for (const cop of this.policeCars) {
        if (cop.isChasing) {
          this._cbPoliceAlerted = true;
          this._fireCB('police_approaching');
          return;
        }
      }
    }

    // 4. Halfway point (one-shot)
    if (!this._cbTriggered.has('halfway') && this.player.raceProgress >= 0.5) {
      this._fireCB('halfway');
      return;
    }

    // 5. Near finish (one-shot)
    if (!this._cbTriggered.has('near_finish') && this.player.raceProgress >= 0.9) {
      this._fireCB('near_finish');
      return;
    }

    // 6. High speed (repeatable, respects cooldown)
    if (Math.abs(this.player.speed) > this.player.maxSpeed * CB_HIGH_SPEED_THRESHOLD) {
      this._cbHighSpeedTimer += dt;
      if (this._cbHighSpeedTimer >= CB_HIGH_SPEED_DURATION) {
        this._cbHighSpeedTimer = 0;
        this._fireCB('high_speed');
        return;
      }
    } else {
      this._cbHighSpeedTimer = 0;
    }
  }

  _fireCB(eventType) {
    const messages = CB_MESSAGES[eventType];
    if (!messages || messages.length === 0) return;
    this._cbMessage = messages[Math.floor(Math.random() * messages.length)];
    this._cbTimer = 0;
    this._cbCooldown = CB_COOLDOWN;
    if (eventType === 'race_start' || eventType === 'halfway' || eventType === 'near_finish') {
      this._cbTriggered.add(eventType);
    }
  }

  _renderCBRadio() {
    if (!this._cbMessage) return;
    const ctx = this.ctx;

    // Compute alpha for fade in/out
    const totalDuration = CB_FADE_IN + CB_DISPLAY + CB_FADE_OUT;
    let alpha;
    if (this._cbTimer < CB_FADE_IN) {
      alpha = this._cbTimer / CB_FADE_IN;
    } else if (this._cbTimer < CB_FADE_IN + CB_DISPLAY) {
      alpha = 1;
    } else {
      alpha = 1 - (this._cbTimer - CB_FADE_IN - CB_DISPLAY) / CB_FADE_OUT;
    }
    alpha = clamp(alpha, 0, 1);
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Text dimensions
    ctx.font = 'bold 13px monospace';
    const prefix = 'CB: ';
    const fullText = prefix + this._cbMessage;
    const tw = ctx.measureText(fullText).width;
    const pad = 12;
    const boxW = tw + pad * 2;
    const boxH = 28;
    const boxX = 15;
    const boxY = CANVAS_H - 185;

    // Background box
    ctx.fillStyle = 'rgba(20, 15, 0, 0.75)';
    roundRect(ctx, boxX, boxY, boxW, boxH, 5);
    ctx.fill();

    // Amber border
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // "CB:" prefix in gold
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'left';
    ctx.fillText(prefix, boxX + pad, boxY + boxH / 2 + 5);

    // Message text in amber
    const prefixWidth = ctx.measureText(prefix).width;
    ctx.fillStyle = '#FFCA28';
    ctx.fillText(this._cbMessage, boxX + pad + prefixWidth, boxY + boxH / 2 + 5);

    ctx.restore();
  }

  _renderArrested() {
    const ctx = this.ctx;

    // Flashing red/blue overlay
    const flash = Math.floor(Date.now() / 300) % 2;
    ctx.fillStyle = flash === 0 ? 'rgba(33,80,200,0.4)' : 'rgba(200,30,30,0.4)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Dark center panel
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, CANVAS_W/2 - 300, 80, 600, 340, 16);
    ctx.fill();

    // BUSTED title
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
    ctx.fillStyle = `rgba(244,67,54,${pulse})`;
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED!', CANVAS_W/2, 170);

    // Subtitle
    ctx.fillStyle = '#CCC';
    ctx.font = '18px monospace';
    ctx.fillText('3 warnings — the police got you!', CANVAS_W/2, 220);

    // Stats
    ctx.font = '15px monospace';
    ctx.fillStyle = '#AAA';
    const meters = this.player.distancePx / PIXELS_PER_METER;
    const miles = meters / 1609.344;
    const pct = Math.round(this.player.raceProgress * 100);
    ctx.fillText(`Distance: ${miles.toFixed(2)} mi`, CANVAS_W/2, 270);
    ctx.fillText(`Progress: ${pct}%`, CANVAS_W/2, 295);
    ctx.fillText(`Time: ${this.hud.formatTime(this.raceTime)}`, CANVAS_W/2, 320);

    // Hint
    ctx.fillStyle = '#F44336';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('3 STRIKES AND YOU\'RE OUT! Avoid police radar zones.', CANVAS_W/2, 365);

    // Restart prompt
    const p2 = 0.5 + 0.5 * Math.sin(Date.now() / 400);
    ctx.fillStyle = `rgba(255,255,255,${0.4 + p2 * 0.6})`;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('ENTER - Race Again    ESC - Menu', CANVAS_W/2, CANVAS_H - 70);
  }

  // ---- Leaderboard (localStorage) ----

  // ---- Route ribbons ----

  // Length of the graph route the game planned between start and finish, in
  // game pixels. Used as the "no wasted distance" reference for efficiency.
  _idealRouteLength() {
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
