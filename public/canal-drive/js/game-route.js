// Methods in this file are installed on Game.prototype by game.js.
// Keeping each subsystem in a class preserves private runtime state on the Game instance
// while making ownership and review boundaries explicit.
class GameRouteRuntime {
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

  _setupRace() {
    this.cars = [];
    this.raceTime = 0;
    this.particles = new ParticleSystem();

    this._seenLandmarks = new Set();
    this._clearLandmarkNotice();

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
}

window.CanalRecallGameModules = window.CanalRecallGameModules || [];
window.CanalRecallGameModules.push(GameRouteRuntime);
