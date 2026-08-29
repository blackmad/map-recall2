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
const CANAL_PREFS_KEY = 'canalRecall.preferences.v1';

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
    this.quizCorrect = 0;
    this.quizAttempts = 0;
    this.quizPoints = 0;
    this.quizFeedback = '';
    this.routeOptions = { ...DIFFICULTY_PRESETS.medium };
    this.travelMode = 'boat';
    this.controlMode = 'relative';
    this.viewMode = 'north';
    this.themeMode = 'clean';
    this.learnedNames = new Set();
    this.routeFrom = CANAL_ROUTE_POIS[1];
    this.routeTo = CANAL_ROUTE_POIS[2];

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
    this._seenLandmarks = new Set();
    this._landmarkNotice = null;
    this._landmarkNoticeTimer = 0;

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
      if (typeof prefs.line === 'boolean') this._assistLine.checked = prefs.line;
      if (typeof prefs.arrow === 'boolean') this._assistArrow.checked = prefs.arrow;
      if (typeof prefs.minimap === 'boolean') this._assistMinimap.checked = prefs.minimap;
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
      line: !!this.routeOptions.line,
      arrow: !!this.routeOptions.arrow,
      minimap: !!this.routeOptions.minimap
    }));
  }

  _setupUtilityPanels() {
    this._helpPanel = document.getElementById('help-panel');
    this._settingsPanel = document.getElementById('settings-panel');
    this._liveLine = document.getElementById('live-line');
    this._liveArrow = document.getElementById('live-arrow');
    this._liveMinimap = document.getElementById('live-minimap');
    this._liveControls = document.getElementById('live-controls');
    this._liveView = document.getElementById('live-view');
    this._liveTheme = document.getElementById('live-theme');
    document.getElementById('open-help').addEventListener('click', () => this._toggleUtilityPanel(this._helpPanel));
    document.getElementById('open-settings').addEventListener('click', () => this._toggleUtilityPanel(this._settingsPanel));
    document.querySelectorAll('.utility-close').forEach(button => button.addEventListener('click', () => this._closeUtilityPanels()));
    for (const control of [this._liveLine, this._liveArrow, this._liveMinimap]) {
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
  }

  _readLiveSettings() {
    this.routeOptions.line = this._liveLine.checked;
    this.routeOptions.arrow = this._liveArrow.checked;
    this.showMiniMap = this._liveMinimap.checked;
    this.routeOptions.minimap = this.showMiniMap;
    this.controlMode = this._liveControls.value;
    if (this.player) this.player.controlMode = this.controlMode;
    this.viewMode = this._liveView.value;
    this.camera.viewMode = this.viewMode;
    this.camera.northUp = this.viewMode === 'north';
    this.themeMode = this._liveTheme.value;
    this.vectorMap.applyTheme(this.themeMode);
    this._savePreferences();
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

  _startConfiguredRoute() {
    const choices = CANAL_ROUTE_POIS.filter(poi => poi.id !== this.routeFrom?.id || CANAL_ROUTE_POIS.length < 3);
    const from = choices[Math.floor(Math.random() * choices.length)];
    const destinations = CANAL_ROUTE_POIS.filter(poi => poi.id !== from.id);
    const to = destinations[Math.floor(Math.random() * destinations.length)];
    this.routeFrom = from;
    this.routeTo = to;
    this.routeOptions = {
      answerMode: this._answerMode.value,
      line: this._assistLine.checked,
      arrow: this._assistArrow.checked,
      minimap: this._assistMinimap.checked
    };
    this.travelMode = this._travelMode.value;
    this.controlMode = this._controlMode.value;
    this.viewMode = this._viewMode.value;
    this.camera.viewMode = this.viewMode;
    this.camera.northUp = this.viewMode === 'north';
    this.themeMode = this._themeMode.value;
    this.vectorMap.applyTheme(this.themeMode);
    try {
      this.learnedNames = new Set(JSON.parse(localStorage.getItem(`canalRecall.learned.${this.travelMode}`) || '[]'));
    } catch (_) { this.learnedNames = new Set(); }
    document.querySelector('#canal-card p').textContent = this.travelMode === 'car' ? 'Which street are you on now?' : 'Which waterway are you on now?';
    this.routeDifficulty = this._routeDifficulty.value;
    this.showMiniMap = this.routeOptions.minimap;
    this._savePreferences();
    this._routeError.textContent = '';
    this._routeSetup.style.display = 'none';
    if (!this.soundStarted) { this.sound.init(); this.soundStarted = true; }
    this._onLocationSelected(
      (from.lat + to.lat) / 2,
      (from.lng + to.lng) / 2,
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng }
    );
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
    this.cars.push(this.player);

    // Canal Recall intentionally starts with a quiet network: the experiment
    // is navigation and name recall, not traffic avoidance.
    this.quizCurrentName = this.track.getRoadName(startX, startY);
    this.quizCandidateName = '';
    this.quizCandidateTimer = 0;
    this.quizPromptName = '';
    this.quizCorrect = 0;
    this.quizAttempts = 0;
    this.quizPoints = 0;
    this.quizFeedback = this.quizCurrentName ? `Starting on ${this.quizCurrentName}` : '';

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
        start = this.osmLoader.latLngToGamePoint(startLL.lat, startLL.lng, lat, lng, segments);
        finish = this.osmLoader.latLngToGamePoint(finishLL.lat, finishLL.lng, lat, lng, segments);
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
        this.loadingMessage = 'Could not place start/finish. Try different points.';
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
      this.routePath = this.track.findRoute(start, finish);
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
    if (this.input.wasPressed('KeyL')) this.routeOptions.line = !this.routeOptions.line;
    if (this.input.wasPressed('KeyF')) this.routeOptions.arrow = !this.routeOptions.arrow;
    if (this.input.wasPressed('KeyO')) this.camera.northUp = !this.camera.northUp;
    if (this.input.wasPressed('KeyN')) this.sound.toggle();
    if (this.input.isDown('Minus') || this.input.isDown('NumpadSubtract')) this.camera.zoomOut();
    if (this.input.isDown('Equal') || this.input.isDown('NumpadAdd')) this.camera.zoomIn();

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
    if (this.warningPopupTimer > 0) this.warningPopupTimer -= dt;
    if (this.warningCooldown > 0) this.warningCooldown -= dt;

    if (this.quizPromptName) {
      this.camera.update(this.player, dt);
      return;
    }

    // Player boat update (Smokey's original vehicle controller)
    this.sound.resume();
    this.player.handleInput(this.input);
    this.player.update(dt, this.track);
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
      this._saveBestTime();
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
    if (name !== this.quizCandidateName) {
      this.quizCandidateName = name;
      this.quizCandidateTimer = 0;
      return;
    }
    this.quizCandidateTimer += dt;
    if (this.quizCandidateTimer < 0.65 || Math.abs(this.player.speed) < 5) return;

    this.quizPromptName = name;
    this.player.speed = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this._prompt.style.display = 'flex';
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
      this.quizPoints += Math.round(100 * (DIFFICULTY_SCORE_MULTIPLIERS[this.routeDifficulty] || 0.85));
      this.learnedNames.add(correctName);
      localStorage.setItem(`canalRecall.learned.${this.travelMode}`, JSON.stringify([...this.learnedNames]));
    }
    this.quizFeedback = correct ? `Correct — ${correctName}` : `That was ${correctName}`;
    this._promptFeedback.textContent = this.quizFeedback;
    this._promptFeedback.style.color = correct ? '#4ade80' : '#fbbf24';
    this.quizCurrentName = correctName;
    this.quizCandidateName = '';
    this.quizCandidateTimer = 0;
    this.quizPromptName = '';
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

    this.renderer.drawTrack(this.camera, this.track);
    this.renderer.drawQuestionFeature(this.camera, this.track, this.quizPromptName, this.raceTime);
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
    if (this.routeOptions.line) this.hud.drawRouteLine(ctx, this.player, this.track.finishPoint, this.camera, this.routePath);
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
    this.hud.drawCanalScore(ctx, this.quizCorrect, this.quizAttempts, this.quizPoints, this.quizFeedback);
    this.hud.drawCurrentLocation(ctx, this.track.getRoadName(this.player.x, this.player.y), this.currentNeighborhood, this.travelMode);
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

    // controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    if (!this.input.isMobile) {
      ctx.fillText('?: help  G: settings  M: map  O: north  P: pause', 10, 20);
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
    const cardX = cx - 300, cardY = 90, cardW = 600, cardH = 500;
    ctx.fillStyle = 'rgba(3,18,28,.94)';
    roundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56,189,248,.65)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DESTINATION REACHED', cx, 145);
    ctx.fillStyle = '#7DD3FC';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${this.routeFrom.name}  →  ${this.routeTo.name}`, cx, 180);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('TIME', cx, 218);
    ctx.font = 'bold 38px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(this.hud.formatTime(this.raceTime), cx, 258);

    const meters = this.player.distancePx / PIXELS_PER_METER;
    const kilometres = meters / 1000;
    ctx.font = '14px monospace';
    ctx.fillStyle = '#E0F2FE';
    ctx.fillText(`${kilometres.toFixed(2)} km travelled`, cx, 292);

    const recallNoun = this.travelMode === 'car' ? 'Street recall' : 'Canal recall';
    ctx.fillStyle = 'rgba(14,116,144,.28)';
    roundRect(ctx, cx - 235, 320, 470, 105, 10);
    ctx.fill();
    ctx.fillStyle = '#E0F2FE';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(`${recallNoun}: ${this.quizCorrect} / ${this.quizAttempts}`, cx, 352);
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${this.quizPoints} points`, cx, 385);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px monospace';
    ctx.fillText(`${this.routeDifficulty.toUpperCase()} · ${this.travelMode.toUpperCase()} · ${this.viewMode.replace('-', ' ').toUpperCase()}`, cx, 411);

    let bestText = '';
    if (this._raceKey) {
      const stored = this._getBestTime(this._raceKey);
      if (stored && this.raceTime <= stored.time) {
        bestText = '★ NEW PERSONAL BEST';
      } else if (stored) {
        bestText = `Personal best: ${this.hud.formatTime(stored.time)}`;
      }
    }
    ctx.fillStyle = bestText.startsWith('★') ? '#4ADE80' : '#7DD3FC';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(bestText, cx, 458);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('ENTER  Try again     ESC  Choose route', cx, 515);
    if (this._shareUrl) {
      ctx.fillStyle = this._copiedTimer > 0 ? '#4ADE80' : '#94A3B8';
      ctx.font = '13px monospace';
      ctx.fillText(this._copiedTimer > 0 ? 'Race link copied' : 'C  Copy race link', cx, 550);
    }
  }

  // ---- Nearby landmark learning cues ----

  async _loadLandmarks(centerLat, centerLng, segments) {
    try {
      const [landmarkResponse, boundaryResponse] = await Promise.all([
        fetch(new URL('../data/extracts/amsterdam/landmarks.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/boundaries.json', window.location.href))
      ]);
      if (!landmarkResponse.ok || !boundaryResponse.ok) throw new Error('Cached place data unavailable');
      const [features, boundaries] = await Promise.all([landmarkResponse.json(), boundaryResponse.json()]);
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
        return { id: feature.id, name: feature.name, x: point.x, y: point.y, detail: detail.split(/(?<=[.!?])\s/)[0].slice(0, 150), geojson: { type: 'FeatureCollection', features: geometryFeatures } };
      }).filter(Boolean);
      const metersPerDegreeLat = 111320;
      const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
      const toWorld = ([lat, lng]) => ({
        x: (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this.osmLoader._lastOffsetX,
        y: -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this.osmLoader._lastOffsetY
      });
      this.neighborhoods = boundaries.filter(boundary => boundary.kind === 'neighbourhood' && boundary.geometry).map(boundary => ({
        name: boundary.name,
        rings: boundary.geometry.map(polygon => (polygon[0] || []).map(toWorld)).filter(ring => ring.length > 2)
      }));
    } catch (error) {
      console.warn('Landmark notes unavailable:', error);
      this.landmarks = [];
    }
  }

  _updateLandmarks(dt) {
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
      this._landmarkNotice = nearest;
      this._landmarkNoticeTimer = 6;
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
    const alpha = Math.min(1, this._landmarkNoticeTimer, 6 - this._landmarkNoticeTimer);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = 'rgba(3,18,28,.88)';
    roundRect(ctx, CANVAS_W / 2 - 245, 78, 490, this._landmarkNotice.detail ? 58 : 40, 8);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`LANDMARK: ${this._landmarkNotice.name}`, CANVAS_W / 2, 101);
    if (this._landmarkNotice.detail) {
      ctx.fillStyle = '#E0F2FE';
      ctx.font = '11px monospace';
      const note = this._landmarkNotice.detail.length > 72 ? `${this._landmarkNotice.detail.slice(0, 69)}…` : this._landmarkNotice.detail;
      ctx.fillText(note, CANVAS_W / 2, 122);
    }
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
}

// ============================================================
// INITIALIZATION
// ============================================================
window.addEventListener('load', () => { new Game(); });
