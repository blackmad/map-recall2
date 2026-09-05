// Methods in this file are installed on Game.prototype by game.js.
// Keeping each subsystem in a class preserves private runtime state on the Game instance
// while making ownership and review boundaries explicit.
class GameRouteRuntime {
  _overlayZoom() {
    return { min: this.camera.minZoom, max: this.camera.maxZoom, defaultZoom: CAMERA_ZOOM_INITIAL };
  }

  _prefs() {
    return this._overlay.store.getState().prefs;
  }

  _setRouteError(message) {
    this._overlay.store.setRouteError(message || '');
  }

  _setupRouteForm() {
    this._overlay = window.CanalRecallOverlay.install(document.getElementById('canal-overlay-root'));
    this._overlay.callbacks.zoom = this._overlayZoom();
    this._overlay.callbacks.onStart = () => this._startConfiguredRoute();
    this._overlay.callbacks.onLiveChange = () => this._readLiveSettings();
    this._overlay.callbacks.onCloseSettings = () => this._closeUtilityPanels();
    this._routeFrom = document.getElementById('route-from');
    this._routeTo = document.getElementById('route-to');
    this._settingsPanel = 'settings';
    for (const poi of CANAL_ROUTE_POIS) {
      this._routeFrom.add(new Option(poi.name, poi.id));
      this._routeTo.add(new Option(poi.name, poi.id));
    }
    this._routeFrom.value = this.routeFrom.id;
    this._routeTo.value = this.routeTo.id;
    this._loadPreferences();
  }

  _loadPreferences() {
    const Prefs = window.CanalRecallPreferences;
    if (!Prefs || !this._overlay) return;
    const prefs = Prefs.readPreferences(localStorage, this._overlayZoom());
    this._overlay.callbacks.zoom = this._overlayZoom();
    this._overlay.store.replacePrefs(prefs);
    this._pendingSkipMastered = prefs.skipMastered;
    if (this.recall) this.recall.enabled = prefs.skipMastered;
    this._applyPrefsToRuntime(prefs, { persist: false });
  }

  _savePreferences() {
    const Prefs = window.CanalRecallPreferences;
    if (!Prefs || !this._overlay) return;
    const zoom = this._overlayZoom();
    const current = this._prefs();
    const prefs = Prefs.coercePreferences({
      ...current,
      line: !!this.routeOptions.line,
      arrow: !!this.routeOptions.arrow,
      minimap: this.showMiniMap,
      gamey: this.gameyFeatures,
      sound: !this.sound.muted,
      zoom: this.camera.zoom,
      reducedMotion: !!this.camera.reducedMotion,
      travelMode: this.travelMode || current.travelMode,
      controlMode: this.controlMode || current.controlMode,
      viewMode: this.viewMode || current.viewMode,
      themeMode: this.themeMode || current.themeMode,
      routePattern: this.routePattern || current.routePattern,
      difficulty: this.routeDifficulty || current.difficulty,
      answerMode: this.routeOptions.answerMode || current.answerMode,
    }, zoom);
    this._overlay.store.replacePrefs(prefs);
    Prefs.writePreferences(localStorage, prefs);
  }

  _setupUtilityPanels() {
    this._helpPanel = document.getElementById('help-panel');
    this._landmarkPanel = document.getElementById('landmark-panel');
    document.getElementById('open-help').addEventListener('click', () => this._toggleUtilityPanel(this._helpPanel));
    document.getElementById('open-settings').addEventListener('click', () => this._toggleUtilityPanel('settings'));
    document.querySelectorAll('#help-panel .utility-close, #landmark-panel .utility-close').forEach(button => {
      button.addEventListener('click', () => this._closeUtilityPanels());
    });
  }

  _applyPrefsToRuntime(prefs, { persist = true, applySound = persist } = {}) {
    this.routeOptions = {
      answerMode: prefs.answerMode,
      line: prefs.line,
      arrow: prefs.arrow,
      minimap: prefs.minimap
    };
    this.gameyFeatures = prefs.gamey;
    this.camera.reducedMotion = prefs.reducedMotion;
    this.travelMode = prefs.travelMode;
    this.controlMode = prefs.controlMode;
    if (this.player) this.player.controlMode = this.controlMode;
    this.viewMode = prefs.viewMode;
    this.camera.viewMode = this.viewMode;
    this.camera.northUp = this.viewMode === 'north';
    this.themeMode = prefs.themeMode;
    this.vectorMap.applyTheme(this.themeMode);
    this.camera.zoom = prefs.zoom;
    this.showMiniMap = prefs.minimap;
    this.routeDifficulty = prefs.difficulty;
    this.routePattern = prefs.routePattern;
    this.vectorMap.setTreesVisible(prefs.trees && (this.viewMode === 'chase' || this.viewMode === 'cockpit'));
    this.vectorMap.setDetailedBuildingsVisible(prefs.detailed3d && (this.viewMode === 'chase' || this.viewMode === 'cockpit'));
    this.vectorMap.setGoogleTilesEnabled(!!prefs.googleTiles);
    if (applySound) this._setSoundEnabled(prefs.sound);
    if (persist) this._savePreferences();
  }

  _syncLiveSettings() {
    const current = this._prefs();
    this._overlay.store.replacePrefs({
      ...current,
      line: !!this.routeOptions.line,
      arrow: !!this.routeOptions.arrow,
      minimap: !!this.showMiniMap,
      controlMode: this.controlMode,
      viewMode: this.viewMode,
      themeMode: this.themeMode,
      gamey: this.gameyFeatures,
      sound: !this.sound.muted,
      reducedMotion: !!this.camera.reducedMotion,
      zoom: this.camera.zoom
    });
  }

  _readLiveSettings() {
    this._applyPrefsToRuntime(this._prefs());
    if (this.routePath) this.vectorMap.setRoute(this.routePath, this.osmLoader, this.routeOptions.line);
  }

  _setSoundEnabled(enabled) {
    if (enabled && !this.soundStarted) {
      this.sound.init();
      this.soundStarted = true;
    }
    this.sound.setEnabled(enabled);
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
      const road = this.track.getNearestRoad(this.player.x, this.player.y, this.player.angle);
      ctx.fillText(`Pos: ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`, x, y); y += 14;
      ctx.fillText(`Speed: ${Math.round(this.player.speed)} px/s`, x, y); y += 14;
      ctx.fillText(`Angle: ${(this.player.angle * 180 / Math.PI).toFixed(1)}°`, x, y); y += 14;
      ctx.fillText(`Road dist: ${road ? road.dist.toFixed(0) : 'N/A'}`, x, y); y += 14;
      ctx.fillText(`Road name: ${this.track.getRoadName(this.player.x, this.player.y, this.player.angle) || '(none)'}`, x, y); y += 14;
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
    const isSettings = panel === 'settings' || panel === this._settingsPanel;
    const opening = isSettings
      ? !this._overlay.store.getState().settingsOpen
      : panel.style.display !== 'flex';
    this._closeUtilityPanels();
    if (opening) {
      if (isSettings) {
        this._syncLiveSettings();
        this._overlay.store.setSettingsOpen(true);
      } else {
        panel.style.display = 'flex';
      }
      this._utilityOpen = true;
    }
  }

  _closeUtilityPanels() {
    this._helpPanel.style.display = 'none';
    if (this._overlay) this._overlay.store.setSettingsOpen(false);
    this._landmarkPanel.style.display = 'none';
    this._utilityOpen = false;
  }

  _applyDifficulty(level) {
    this._overlay.store.patchPrefs({ difficulty: level }, this._overlayZoom());
  }

  _syncHomeAddressField() {}

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
    this._setRouteError('');
    const prefs = this._prefs();
    this.routePattern = prefs.routePattern;
    if (this.routePattern === 'home') {
      const address = (prefs.homeAddress || '').trim();
      if (!address) { this._setRouteError('Enter a home address first.'); return; }
      try {
        this._setRouteError('Finding your home base…');
        this.homeBase = await this._geocodeHomeAddress(address);
        this.homeLeg = 'outbound';
      } catch (error) {
        this._setRouteError(error.message || 'Could not find that address.');
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

  // The geographic rules live in game/routeSelection.ts, where they are tested
  // without generating routes until one looks wrong.
  _pickDestinationNear(from, alsoExcludeId = null) {
    return CanalRecallRoute.pickDestinationNear(this.routePois, from, undefined, alsoExcludeId);
  }

  // Nearest POI to `target` that actually snaps onto the mapped network.

  _nearestSnappableDestination(target, segments, centreLat, centreLng, snapLimit, excludeId = null) {
    return CanalRecallRoute.nearestSnappableDestination(this.routePois, target,
      poi => this.osmLoader.latLngToGamePoint(poi.lat, poi.lng, centreLat, centreLng, segments, snapLimit),
      excludeId);
  }

  // Closest reachable stand-in for an unroutable destination, chosen from the
  // same POI pool and scored by how near it is to the original.

  _retargetToReachableDestination(start, originalFinish, segments, centreLat, centreLng) {
    const shortlist = CanalRecallRoute.rankRetargetCandidates(
      this.routePois, start, originalFinish,
      poi => this.osmLoader.latLngToGamePoint(poi.lat, poi.lng, centreLat, centreLng, segments, MAX_SNAP_DIST),
      MIN_START_FINISH_DIST, this.routeFrom?.id ?? null);
    // One Dijkstra covers the whole graph, so there is no reason to cap how
    // many candidates are tested for reachability — only the snap-distance
    // search above is expensive per candidate.
    const hit = this.track.findRouteToFirstReachable(start, shortlist.map(entry => entry.point));
    if (!hit) return null;
    const chosen = shortlist[hit.index];
    return { poi: chosen.poi, finish: chosen.point, path: hit.path };
  }

  // A name goes on the map the moment the player has seen it.

  _updateLiveRouteLine() {
    if (!this.routeOptions.line || !this.routePath || this.routePath.length < 2) return;
    const decision = CanalRecallRoute.advanceLiveRoute(
      { index: this._liveRouteIndex, rerouteTimer: this._rerouteTimer },
      this.routePath, this.player, 0);
    this._rerouteTimer = decision.state.rerouteTimer;
    let bestIndex = decision.nearestIndex;
    if (decision.shouldReroute) {
      const fresh = this.track.findRoute({ x: this.player.x, y: this.player.y }, this.track.finishPoint);
      if (fresh && fresh.length >= 2) {
        this.routePath = fresh;
        bestIndex = 0;
        this._liveRouteIndex = -1;
      }
    }
    if (this._liveRouteIndex === bestIndex && this._liveRoutePath) return;
    this._liveRouteIndex = bestIndex;
    this._liveRoutePath = CanalRecallRoute.routeAhead(this.routePath, bestIndex, this.track.finishPoint);
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
    this._applyPrefsToRuntime(this._prefs());
    document.querySelector('#canal-card p').textContent = this.travelMode === 'car' ? 'Which street are you on now?' : 'Which waterway are you on now?';
    this._setRouteError('');
    this._overlay.store.setSetupOpen(false);
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
    this._setRouteError(message || '');
    this._overlay.store.setSetupOpen(true);
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

  _setupRace() {
    this.cars = [];
    this.raceTime = 0;
    this.particles = new ParticleSystem();

    this._seenLandmarks = new Set();
    this._seenStreetKnowledge = new Set();
    this._clearLandmarkNotice();

    // No heading yet: this is the call that produces one. The explicit null is
    // what `check-road-name-heading.ts` accepts in place of `player.angle`.
    const startInfo = this.track.getNearestRoad(this.track.startPoint.x, this.track.startPoint.y, null);
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
    this.quizCurrentName = this.track.getRoadName(startX, startY, this.player.angle);
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
    this.camera._lookahead = 0;
    this.camera.resetPan();
    // Snap the basemap onto the boat before the first paint — sync only runs
    // once RACING draws, and without this the map can still show Damrak for a
    // frame (or sit off-centre until camera smoothing catches up).
    if (this.vectorMap && typeof this.vectorMap.aimAtWorld === 'function') {
      const bearing = this.camera.northUp ? 0 : (this.player.angle + Math.PI / 2) * 180 / Math.PI;
      this.vectorMap.aimAtWorld(this.player.x, this.player.y, this.osmLoader, { bearing });
    }
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
      this._routeMastery = this.recall ? this.recall.routeMastery('amsterdam') : {};
      this.track.setRouteMastery(this._routeMastery);
      if (this.travelMode === 'boat') this.track.waterTest = (x, y) => this.vectorMap.isWater(x, y, this.osmLoader);
      // Aim the basemap at the start while the loading overlay is still up so
      // LoD1 tiles download under the spawn — not on Damrak, and not as a hitch
      // on the first racing frame.
      if (this.vectorMap && typeof this.vectorMap.aimAtWorld === 'function') {
        this.vectorMap.aimAtWorld(start.x, start.y, this.osmLoader);
      }
      this._routeLearningPlan = this.track.planRoute(start, finish);
      this.routePath = this._routeLearningPlan ? this._routeLearningPlan.path : [];
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
          this._routeLearningPlan = this.track.planRoute(start, finish);
          if (this._routeLearningPlan) this.routePath = this._routeLearningPlan.path;
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
}

window.CanalRecallGameModules = window.CanalRecallGameModules || [];
window.CanalRecallGameModules.push(GameRouteRuntime);
