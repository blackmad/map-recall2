// ============================================================
// VECTOR BASEMAP — MapLibre + OpenFreeMap, synchronized to Smokey's camera
// ============================================================
// Degrees the building-clearance guard may lower the camera pitch.
const CLEARANCE_MAX_DROP = 10;
// Streamed buildings start at zoom 14 and used to switch on in a single frame
// part-way through the start flight (the phone overview sits at ~12.9). At
// the desktop overview (~14.1) the tile budget covers only the tiles around
// the rider, so half the view had buildings and the rest filled in during the
// flight. Both read as jumps in zoom level (user report 2026-09-29). The
// overview is now a flat map and the city grows in from zoom 15, where the
// budget covers the view; the 10% zoom floor sits right at 15.
const BUILDING_FADE_IN = ['interpolate', ['linear'], ['zoom'], 15, 0, 15.6, 1];
// Experiment (2026-10-01): generic period facades on the streamed city and
// stylised 3D trees at OSM tree positions. Both default on; `?facades=0` /
// `?trees3d=0` (or window.__canalRecallFacades / __canalRecallTrees3d = false
// before load) bring back the old flat look for A/B comparison.
const GENERIC_FACADES_DEFAULT = true;
const STYLISED_TREES_DEFAULT = true;
function canalRecallLookFlag(param, global, fallback) {
  try {
    if (typeof window !== 'undefined' && typeof window[global] === 'boolean') return window[global];
    const value = new URLSearchParams(window.location.search).get(param);
    if (value === '0' || value === 'false' || value === 'off') return false;
    if (value === '1' || value === 'true' || value === 'on') return true;
  } catch (_) { /* no window */ }
  return fallback;
}

// `?buildings3d=1` (procedural cells), `=cartoon` or `=photo` (the rendering
// spike's bay drawings). window.__canalRecallBuildings3d takes the same values.
function canalRecallBuildings3dLook() {
  try {
    const raw = typeof window.__canalRecallBuildings3d !== 'undefined' ? window.__canalRecallBuildings3d : new URLSearchParams(window.location.search).get('buildings3d');
    if (raw === true || raw === '1' || raw === 'true' || raw === 'on' || raw === 'procedural') return 'procedural';
    if (raw === 'cartoon' || raw === 'photo' || raw === 'storybook') return raw;
  } catch (_) { /* no window */ }
  return null;
}

class VectorBasemap {
  constructor(container) {
    this.container = container;
    this.map = null;
    this.ready = false;
    this.theme = 'clean';
    this._basePaint = new Map();
    this._highlightedBuilding = null;
    this._highlightedBuildings = [];
    this._pendingTrees = [];
    this._pendingPlaces = { landmarks: [], boundaries: [] };
    this._pendingBrandedPois = [];
    // Prefs apply during Game construction, before MapLibre's style load.
    // Stash corridor paint until `load` so addSource does not throw and kill boot.
    this._pendingTransitNetwork = null;
    this._treesVisible = false;
    this._facadesEnabled = canalRecallLookFlag('facades', '__canalRecallFacades', GENERIC_FACADES_DEFAULT);
    this._trees3dEnabled = canalRecallLookFlag('trees3d', '__canalRecallTrees3d', STYLISED_TREES_DEFAULT);
    this._rawTrees = null;
    this._treeRoute = null;
    this._facadeImages = null;
    this._facadeTileZoom = null;
    // Spike (2026-10-02): facade walls as a three.js custom layer instead of the
    // fill-extrusion pattern. Off by default; `?buildings3d=1`. See
    // RENDERING_STACK_OPTIONS.md.
    this._buildingLookLocked = !!canalRecallBuildings3dLook(); // a URL/global look beats the saved preference
    this._buildings3dLook = canalRecallBuildings3dLook() || 'default';
    this._buildings3dEnabled = this._buildings3dLook !== 'default';
    this._tileFeatures = [];
    this._threeBuildings = null;
    this._detailedBuildings = null;
    this._completeCity = null;
    this._detailedBuildingsVisible = false;
    this._signatureLandmarks = null;
    this._pyramidalRoofs = null;
    this._studyRoofs = null;
    this._studyFacades = null;
    this._studyTrees = null;
    this._studyPublicRealm = null;
    this._studyRoofAreas = [];
    this._studyFacadeAreas = [];
    this._studyTreeAreas = [];
    this._studyPublicRealmAreas = [];
    this._activeAppearanceAreaId = null;
    this._studyLayersAllowed = true;
    this._studyResidencyListener = null;
    this._appearanceAreas = [];
    this._appearanceAreaFailures = [];
    this._appearanceOsmIds = [];
    this._appearanceFeatures = [];
    this._appearanceCentroidGrid = null;
    this._preencodedBasemapHideIds = [];
    this._basemapProximityHideIds = [];
    this._basemapDuplicateScanQueued = false;
    this._buildingsFromTiles = false;
    this._googleTiles = null;
    this._googleTilesEnabled = false;
    this._googleTilesActive = false;
    this._lastCameraZoom = null;
    this._quizQuietMap = false;
    this._activeLandmark = null;
    this._playerBike = null;
    this._playerBoat = null;
    this._labelsVisible = false;
    this._lastCameraClearance = { constrained: false, reason: 'not-synchronised' };
    this._cameraClearanceCheck = null;
    this._cameraClearanceRequest = null;
    this._extractPath = '../data/extracts/amsterdam';
    this._cameraTilt = 0;
    this._pitchSmoothed = null;
    if (!container || typeof maplibregl === 'undefined') return;

    this.map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [4.9041, 52.3676],
      zoom: 17,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0
    });

    this.map.on('load', () => {
      this._hideLabels();
      this._captureBasePaint();
      this._ensureRouteLayer();
      this._ensureStreetOverlayLayers();
      this._ensureTransitOverlayLayers();
      this._ensureTreeLayers();
      this._ensureBuildingAppearanceLayers();
      this._ensurePlaceLayers();
      this._ensureOwnPoiLayers();
      this.setPlaces(this._pendingPlaces.landmarks, this._pendingPlaces.boundaries);
      this.setBrandedPois(this._rawBrandedPois || this._pendingBrandedPois);
      this._applyBasemapSpoilerFilter();
      this.setTrees(this._pendingTrees);
      this._ensureLandmarkLayers();
      this._styleLandmarks();
      this._raisePoiLayers();
      if (window.CanalRecallDetailed3D && window.CanalRecallDetailed3D.DetailedBuildings) {
        this._detailedBuildings = new window.CanalRecallDetailed3D.DetailedBuildings(this.map, maplibregl, () => {
          this._syncDetailedBuildingLayers();
          this._raisePoiLayers();
          this.setActiveLandmark(this._activeLandmark);
        });
        this._detailedBuildings.onLandmarkHighlighted = (landmark) => {
          if (!landmark || landmark !== this._activeLandmark) return;
          const source = this.map.getSource('active-landmark');
          if (source) source.setData({ type: 'FeatureCollection', features: [] });
        };
        this._detailedBuildings.setEnabled(this._detailedBuildingsVisible);
      }
      // Signature landmark GLBs are built and demoable, but disabled in the
      // live game: thirteen meshopt models were too expensive on the shared
      // MapLibre/Three canvas (see TODO item 22).
      if (window.CanalRecallVehicles) {
        const { PlayerBike3D, PlayerBoat3D, PlayerTransit3D } = window.CanalRecallVehicles;
        if (PlayerBike3D) this._playerBike = new PlayerBike3D(this.map, maplibregl);
        if (PlayerBoat3D) this._playerBoat = new PlayerBoat3D(this.map, maplibregl);
        if (PlayerTransit3D) this._playerTransit = new PlayerTransit3D(this.map, maplibregl);
      }
      this.ready = true;
      // Theme setup can run before the asynchronous style load. Reapply it
      // now so OSM building colours replace Liberty's uniform gray default.
      this.applyTheme(this.theme);
      if (this._pendingTransitNetwork) {
        const pending = this._pendingTransitNetwork;
        this._pendingTransitNetwork = null;
        this.setTransitNetwork(pending.load, pending.visible);
      }
    });
  }

  /** Point building / tile fetches at the active city's extract root. */
  setExtractRoot(path) {
    if (!path || path === this._extractPath) return;
    this._extractPath = path;
    if (this.map && this.map.getSource('own-pois')) this._loadOwnPois();
    // Drop the previous city's tile streamer so the next probe uses the new root.
    if (this._completeCity && typeof this._completeCity.dispose === 'function') {
      try { this._completeCity.dispose(); } catch (_) { /* ignore */ }
    }
    this._completeCity = null;
    this._buildingsFromTiles = false;
  }

  _extractFile(name) {
    return `${this._extractPath || '../data/extracts/amsterdam'}/${name}`;
  }

  _ensureRouteLayer() {
    if (this.map.getSource('navigation-route')) return;
    this.map.addSource('navigation-route', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    // Separated cycle tracks sit just under the route, so a route along one
    // lies on something drawn (see cycleTracks.ts).
    const lib = window.CanalRecallOrientationPois;
    if (lib && lib.cycleTrackFeatures) {
      this.map.addSource('cycle-tracks', { type: 'geojson', data: this._cycleTracks || { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({ id: 'cycle-tracks', type: 'line', source: 'cycle-tracks', minzoom: 12,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': lib.CYCLE_TRACK_COLOUR, 'line-width': lib.CYCLE_TRACK_WIDTH, 'line-opacity': lib.CYCLE_TRACK_OPACITY } }, before);
    }
    this.map.addLayer({ id: 'navigation-route-casing', type: 'line', source: 'navigation-route', layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': 'rgba(3,18,28,.75)', 'line-width': 10 } }, before);
    this.map.addLayer({ id: 'navigation-route-line', type: 'line', source: 'navigation-route', layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#38BDF8', 'line-width': 6, 'line-opacity': 0.9 } }, before);
  }

  /** The routing ways of the current network; only separated cycle tracks
   *  are drawn, and only when cycling (`ways` empty otherwise). */
  setCycleTracks(ways) {
    const lib = window.CanalRecallOrientationPois;
    this._cycleTracks = lib && lib.cycleTrackFeatures ? lib.cycleTrackFeatures(ways || []) : null;
    const source = this.map && this.map.getSource('cycle-tracks');
    if (source && this._cycleTracks) source.setData(this._cycleTracks);
  }

  _ensureStreetOverlayLayers() {
    if (this.map.getSource('active-street') || !window.CanalRecallStreets) return;
    const empty = { type: 'FeatureCollection', features: [] };
    this.map.addSource('active-street', { type: 'geojson', data: empty });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    for (const layer of window.CanalRecallStreets.streetOverlayLayers()) {
      this.map.addLayer(layer, layer.type === 'symbol' ? undefined : before);
    }
    // The just-answered name, painted on the road; its own source, filled only
    // after an answer (see answeredStreetNameLayer).
    if (window.CanalRecallStreets.answeredStreetNameLayer) {
      this.map.addSource(window.CanalRecallStreets.ANSWERED_STREET_SOURCE_ID, { type: 'geojson', data: empty });
      this.map.addLayer(window.CanalRecallStreets.answeredStreetNameLayer());
    }
  }

  _ensureTransitOverlayLayers() {
    const Transit = window.CanalRecallTransit;
    // MapLibre throws "Style is not done loading" on addSource before `load`.
    if (!this.map || !Transit || typeof this.map.isStyleLoaded === 'function' && !this.map.isStyleLoaded()) return;
    if (this.map.getSource(Transit.TRANSIT_OVERLAY_SOURCE_ID || 'transit-network')) return;
    const sourceId = Transit.TRANSIT_OVERLAY_SOURCE_ID || 'transit-network';
    this.map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    const under = typeof Transit.transitOverlayUnderBuildingLayers === 'function'
      ? Transit.transitOverlayUnderBuildingLayers()
      : [];
    for (const layer of under) this.map.addLayer(layer, before);
    const above = typeof Transit.transitOverlayAboveBuildingLayers === 'function'
      ? Transit.transitOverlayAboveBuildingLayers()
      : [];
    // Tunnel callouts sit above extrusions so metro through buildings stays legible.
    for (const layer of above) this.map.addLayer(layer);
  }

  /**
   * Paint every driveable GTFS corridor. Metro is treated as underground
   * (dashed, above buildings); tram stays a bold surface ribbon.
   */
  setTransitNetwork(load, visible) {
    const Transit = window.CanalRecallTransit;
    if (!this.map || !Transit) return;
    // Called from prefs during Game construction — before style `load`. Defer
    // rather than throw; blank boot was "Style is not done loading" here.
    if (!this.ready) {
      this._pendingTransitNetwork = { load, visible: !!visible };
      return;
    }
    this._pendingTransitNetwork = null;
    this._ensureTransitOverlayLayers();
    const sourceId = Transit.TRANSIT_OVERLAY_SOURCE_ID || 'transit-network';
    const source = this.map.getSource(sourceId);
    if (!source) return;
    const lines = [];
    if (load && load.ways && load.ways.length) {
      for (const way of load.ways) {
        if (!way.nodes || way.nodes.length < 2) continue;
        const meta = load.featureMeta && way.tags && way.tags.name
          ? load.featureMeta.get(way.tags.name)
          : null;
        lines.push({
          name: (way.tags && way.tags.name) || way.id || 'line',
          mode: way.highway || (meta && meta.mode) || 'tram',
          color: meta && meta.color,
          coordinates: way.nodes.map(node => [node.lon, node.lat]),
        });
      }
    }
    const collection = typeof Transit.transitOverlayCollection === 'function'
      ? Transit.transitOverlayCollection(lines)
      : { type: 'FeatureCollection', features: [] };
    source.setData(collection);
    const show = visible ? 'visible' : 'none';
    for (const id of (Transit.TRANSIT_OVERLAY_LAYER_IDS || [])) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', show);
    }
    this._emphasizeTransitBasemap(!!visible);
  }

  /** Widen / recolour Liberty rail layers while transit mode is active. */
  _emphasizeTransitBasemap(on) {
    if (!this.map) return;
    try {
      for (const layer of this.map.getStyle().layers || []) {
        if (layer.type !== 'line') continue;
        const identity = `${layer.id} ${layer['source-layer'] || ''}`.toLowerCase();
        if (!/rail|transit|subway|tram/.test(identity) && !/transportation/.test(identity)) continue;
        // Only touch layers that look like rails, not every road.
        const isRail = /rail|transit|subway|tram|railway/.test(identity);
        if (!isRail) continue;
        if (!this._basePaint.has(`${layer.id}:line-width`)) {
          try {
            this._basePaint.set(`${layer.id}:line-width`, this.map.getPaintProperty(layer.id, 'line-width'));
            this._basePaint.set(`${layer.id}:line-color`, this.map.getPaintProperty(layer.id, 'line-color'));
            this._basePaint.set(`${layer.id}:line-opacity`, this.map.getPaintProperty(layer.id, 'line-opacity'));
          } catch (_) { /* ignore */ }
        }
        if (on) {
          this.map.setPaintProperty(layer.id, 'line-color', '#F59E0B');
          this.map.setPaintProperty(layer.id, 'line-opacity', 0.55);
          this.map.setPaintProperty(layer.id, 'line-width', [
            'interpolate', ['linear'], ['zoom'], 13, 2.5, 18, 7,
          ]);
        } else {
          const width = this._basePaint.get(`${layer.id}:line-width`);
          const color = this._basePaint.get(`${layer.id}:line-color`);
          const opacity = this._basePaint.get(`${layer.id}:line-opacity`);
          if (width != null) this.map.setPaintProperty(layer.id, 'line-width', width);
          if (color != null) this.map.setPaintProperty(layer.id, 'line-color', color);
          if (opacity != null) this.map.setPaintProperty(layer.id, 'line-opacity', opacity);
        }
      }
    } catch (_) { /* style may still be loading */ }
  }

  setCameraTilt(degrees) {
    const value = Number(degrees);
    const prefs = window.CanalRecallPreferences;
    const min = prefs && Number.isFinite(prefs.CAMERA_TILT_MIN) ? prefs.CAMERA_TILT_MIN : -36;
    const max = prefs && Number.isFinite(prefs.CAMERA_TILT_MAX) ? prefs.CAMERA_TILT_MAX : 36;
    this._cameraTilt = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0;
  }

  pitchForViewMode(viewMode) {
    const chase = viewMode === 'chase';
    const cockpit = viewMode === 'cockpit';
    const base = cockpit
      ? (typeof COCKPIT_PITCH_DEGREES === 'number' ? COCKPIT_PITCH_DEGREES : 84)
      : chase
        ? (typeof CHASE_PITCH_DEGREES === 'number' ? CHASE_PITCH_DEGREES : 48)
        : (typeof TOPDOWN_TILT_DEGREES === 'number' ? TOPDOWN_TILT_DEGREES : 14);
    if (!chase && !cockpit) return base;
    return Math.max(0, Math.min(85, base + (this._cameraTilt || 0)));
  }

  zoomOffsetForViewMode(viewMode) {
    if (viewMode === 'cockpit') {
      return typeof COCKPIT_ZOOM_OFFSET === 'number' ? COCKPIT_ZOOM_OFFSET : 1.45;
    }
    if (viewMode === 'chase') {
      return typeof CHASE_ZOOM_OFFSET === 'number' ? CHASE_ZOOM_OFFSET : 0.7;
    }
    return 0;
  }

  _treesLib() {
    const lib = window.CanalRecallBuildings;
    return this._trees3dEnabled && lib && lib.Trees ? lib.Trees : null;
  }

  _ensureTreeLayers() {
    if (this.map.getSource('amsterdam-trees')) return;
    this.map.addSource('amsterdam-trees', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      // Trees are small fixed shapes: cut tiles once at z16 and overscale,
      // rather than re-tiling them at every zoom the camera passes.
      maxzoom: 16,
      attribution: 'Trees © OpenStreetMap contributors'
    });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    const Trees = this._treesLib();
    if (Trees) {
      for (const layer of Trees.treeLayers('amsterdam-trees', this.theme, this._treesVisible)) this.map.addLayer(layer, before);
      return;
    }
    const shared = { 'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'map' };
    this.map.addLayer({
      id: 'tree-trunks', type: 'circle', source: 'amsterdam-trees', minzoom: 15,
      layout: { visibility: this._treesVisible ? 'visible' : 'none' },
      paint: { ...shared, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 1, 19, 4], 'circle-color': '#775438', 'circle-opacity': 0.9 }
    }, before);
    this.map.addLayer({
      id: 'tree-crowns', type: 'circle', source: 'amsterdam-trees', minzoom: 15,
      layout: { visibility: this._treesVisible ? 'visible' : 'none' },
      paint: { ...shared, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 2.4, 19, 11], 'circle-color': '#4F8A48', 'circle-stroke-color': '#315D31', 'circle-stroke-width': 1, 'circle-opacity': 0.86 }
    }, before);
  }

  _ensureBuildingAppearanceLayers() {
    if (this.map.getSource('osm-building-appearance')) return;
    // The source starts empty. `_bootstrapBuildings` fills it from streamed
    // LoD1 tiles when published, otherwise from `_loadBuildingAppearance`, so
    // these two layers still land in their place in the stack: everything
    // added after them expects to sit above the building extrusions.
    this.map.addSource('osm-building-appearance', {
      type: 'geojson', data: { type: 'FeatureCollection', features: [] },
      generateId: true,
      attribution: 'Building appearance © OpenStreetMap contributors'
    });
    // Three extrusions can describe one building here: the basemap's own
    // `building-3d`, our measured-colour walls, and the roof cap. Any two faces
    // that occupy the same plane z-fight, which is the striping that appeared
    // across roofs and facades — two surfaces at the same depth, the renderer
    // picking a different winner per pixel.
    //
    // Height offsets only ever separate *horizontal* faces. A wall is coplanar
    // with itself no matter how tall either box is, so the basemap's copy of a
    // building has to go entirely — see `_hideDuplicatedBasemapBuildings`.
    //
    // Between the two layers that remain, the roof cap is a 0.40 m slab whose
    // base sits 0.15 m above the wall top, so its top face is 0.55 m clear of
    // the roof it covers and its side faces never share a plane with the
    // wall's. MapLibre draws no underside on an extrusion, so the gap is not
    // visible from above. Opacity is 1 on both: a translucent extrusion blends
    // with whatever it overlaps, which turns a depth tie into a visible stripe.
    // The cap is drawn only for flat roofs with a distinct colour — see
    // `_coloredBuildingBaseFilter`; a cap on every building z-fights citywide.
    // Walls stop at the eaves when a procedural pyramidal roof will take over
    // above — otherwise the flat prism fights the cone on the Waag's turrets.
    const helpers = window.CanalRecallBuildings;
    const WALL_TOP = helpers && helpers.wallTopHeightExpression
      ? helpers.wallTopHeightExpression()
      : ['coalesce', ['get', 'height'], 5];
    const MIN_HEIGHT = ['coalesce', ['get', 'minHeight'], 0];
    const GROUND_TOP = ['min', WALL_TOP, ['+', MIN_HEIGHT, ['coalesce', ['get', 'groundFloorHeightM'], 3.2]]];
    const flatRoofFilter = this._coloredBuildingBaseFilter('osm-colored-building-roofs');
    this.map.addLayer({
      id: 'osm-colored-building-ground-floors', type: 'fill-extrusion', source: 'osm-building-appearance', minzoom: 14,
      filter: this._coloredBuildingBaseFilter('osm-colored-building-ground-floors'),
      paint: {
        'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FFD21F', ['get', 'groundColour']],
        'fill-extrusion-base': MIN_HEIGHT,
        'fill-extrusion-height': GROUND_TOP,
        'fill-extrusion-opacity': BUILDING_FADE_IN
      }
    });
    this.map.addLayer({
      id: 'osm-colored-buildings', type: 'fill-extrusion', source: 'osm-building-appearance', minzoom: 14,
      paint: {
        'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FFD21F', ['coalesce', ['get', 'sideColour'], ['get', 'colour']]],
        'fill-extrusion-base': this._wallBaseExpression(GROUND_TOP, MIN_HEIGHT, WALL_TOP),
        'fill-extrusion-height': WALL_TOP,
        'fill-extrusion-opacity': BUILDING_FADE_IN
      }
    });
    const facadeLayer = this._facadeLayerSpec(MIN_HEIGHT, WALL_TOP);
    if (facadeLayer) this.map.addLayer(facadeLayer);
    else this._addThreeBuildingsLayer();
    this.map.addLayer({
      id: 'osm-colored-building-roofs', type: 'fill-extrusion', source: 'osm-building-appearance', minzoom: 14,
      filter: flatRoofFilter,
      paint: {
        'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlighted'], false], '#FFD21F', ['get', 'roofColour']],
        // The lid sits on the wall: its sides start where the wall's end, so
        // nothing is coplanar. Floating it 0.15 m up drew a light gap line and
        // a dark band round every roof (user report 2026-09-29, "weird lip").
        'fill-extrusion-base': WALL_TOP,
        'fill-extrusion-height': ['+', WALL_TOP, 0.4],
        'fill-extrusion-opacity': BUILDING_FADE_IN
      }
    });
    // Prefer streamed LoD1 tiles when published; only then fall back to the
    // 5.6 MB static extract (and its basemap de-dupe work). Running both used
    // to hitch the first turn: parse + setData the extract, install a 10k-id
    // filter, then tear it down for tiles.
    void this._bootstrapBuildings();
  }

  async _bootstrapBuildings() {
    const usedTiles = await this._ensureCompleteCity();
    if (usedTiles) return;
    await this._loadBuildingAppearance();
  }

  // Fetched here rather than handed to MapLibre as a source URL because the
  // same features are needed twice: once as the extrusion geometry, and once to
  // name the basemap buildings this layer replaces. Skipped entirely when the
  // complete-city tile index is published.
  async _loadBuildingAppearance() {
    if (this._buildingsFromTiles) return;
    // Hide-id sidecar can filter `building-3d` before the GeoJSON finishes.
    const hideIdsPromise = this._loadBasemapHideIds();
    let data;
    try {
      const response = await fetch(this._extractFile('buildings-colored.geojson'));
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      data = await response.json();
    } catch (error) {
      console.warn('Building appearance extract unavailable; keeping basemap extrusions.', error);
      await hideIdsPromise;
      return;
    }
    await hideIdsPromise;
    if (this._buildingsFromTiles) return;
    const source = this.map && this.map.getStyle() && this.map.getSource('osm-building-appearance');
    if (!source) return;
    // Drop parent outlines from hand-mapped compositions so Oude Kerk / Waag
    // stop z-fighting their own parts. Falls back to the raw extract when the
    // typed helper is not on the page yet.
    const dedupe = window.CanalRecallBuildings && window.CanalRecallBuildings.dedupeAppearanceFeatures;
    const features = (data && data.features) || [];
    const cleaned = {
      type: 'FeatureCollection',
      features: dedupe ? dedupe(features) : features,
    };
    source.setData(cleaned);
    this._hideDuplicatedBasemapBuildings(cleaned);
    this._syncPyramidalRoofs(cleaned.features);
  }

  async _loadBasemapHideIds() {
    try {
      const response = await fetch(this._extractFile('basemap-hide-ids.json'));
      if (!response.ok) return;
      const payload = await response.json();
      const ids = payload && Array.isArray(payload.encodedIds) ? payload.encodedIds : [];
      this._preencodedBasemapHideIds = ids.filter(
        (id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
      );
      if (this._preencodedBasemapHideIds.length) this._refreshBuildingSuppression();
    } catch (_) {
      // Sidecar is optional; encoding from the extract still works.
    }
  }

  _syncPyramidalRoofs(features) {
    const api = window.CanalRecallPyramidalRoofs;
    if (!api || !api.PyramidalRoofs || !this.map) return;
    if (!this._pyramidalRoofs) {
      this._pyramidalRoofs = new api.PyramidalRoofs(this.map, maplibregl);
    }
    this._pyramidalRoofs.setFeatures(features || []);
  }

  // The basemap keeps only the buildings the extract does not carry. Its ids
  // arrive encoded in the vector-tile feature id, so `basemapBuildingFilter`
  // does the decoding and documents which id types are safe to match.
  //
  // OpenFreeMap's z14 building layer is sparse — 113 features in the tile over
  // the centre against 10,578 in the extract — so this removes the double-drawn
  // minority and leaves the rest of the city standing. An id match alone cut
  // co-located pairs from 145 to 47; the remainder are held under different
  // OSM ids by the two pipelines, so `_scanBasemapDuplicates` measures
  // proximity against the extract and feeds those feature ids in too.
  //
  // This path is the no-tiles fallback only. When LoD1 tiles are published,
  // `_bootstrapBuildings` skips it and hides `building-3d` wholesale once the
  // first tile lands.
  _hideDuplicatedBasemapBuildings(data) {
    if (this._buildingsFromTiles) return;
    this._appearanceFeatures = (data && data.features) || [];
    this._appearanceOsmIds = this._appearanceFeatures
      .map(feature => feature.properties && feature.properties.osmId)
      .filter(Boolean);
    this._appearanceCentroidGrid = this._buildAppearanceCentroidGrid(this._appearanceFeatures);
    this._basemapProximityHideIds = [];
    this._refreshBuildingSuppression();
    this._queueBasemapDuplicateScan();
    if (!this._basemapDuplicateScanBound) {
      this._basemapDuplicateScanBound = true;
      // Tiles stream in after the extract; rescan whenever more buildings
      // arrive so a late basemap copy cannot reappear under a coloured roof.
      this.map.on('sourcedata', (event) => {
        if (this._buildingsFromTiles) return;
        if (event.sourceId !== 'openmaptiles' || !event.isSourceLoaded) return;
        this._queueBasemapDuplicateScan();
      });
      this.map.on('moveend', () => {
        if (this._buildingsFromTiles) return;
        this._queueBasemapDuplicateScan();
      });
    }
  }

  // One owner per building: hide the basemap copy of every coloured-extract
  // building (by id and by measured proximity), and hide coloured extrusions
  // under any signature model that has loaded.
  _refreshBuildingSuppression() {
    if (this._buildingsFromTiles) return;
    if (!this.map || !this.map.getStyle()) return;
    if (this.map.getLayer('building-3d') && window.CanalRecallBuildings) {
      const { basemapBuildingFilter } = window.CanalRecallBuildings;
      if (basemapBuildingFilter) {
        if (this._baseBuildingFilter === undefined) {
          this._baseBuildingFilter = this.map.getFilter('building-3d') || null;
        }
        // Prefer the published hide-id sidecar (already encoded). Fall back to
        // encoding extract osmIds when the sidecar is missing.
        const runtimeOsmIds = this._preencodedBasemapHideIds.length
          ? this._signatureSuppressOsmIds()
          : [...this._appearanceOsmIds, ...this._signatureSuppressOsmIds()];
        const extraEncoded = this._preencodedBasemapHideIds.length
          ? [...this._preencodedBasemapHideIds, ...this._basemapProximityHideIds]
          : this._basemapProximityHideIds;
        try {
          this.map.setFilter(
            'building-3d',
            basemapBuildingFilter(runtimeOsmIds, this._baseBuildingFilter, extraEncoded),
          );
        } catch (error) {
          console.warn('Could not de-duplicate basemap buildings; extrusions may z-fight.', error);
        }
      }
    }
    this._refreshColoredBuildingFilter();
  }

  _queueBasemapDuplicateScan() {
    if (this._buildingsFromTiles) return;
    if (this._basemapDuplicateScanQueued || !this._appearanceCentroidGrid) return;
    this._basemapDuplicateScanQueued = true;
    requestAnimationFrame(() => {
      this._basemapDuplicateScanQueued = false;
      this._scanBasemapDuplicates();
    });
  }

  // The id filter cannot see buildings the two pipelines hold under different
  // OSM ids. For every loaded basemap building, if any of its ring centroids
  // sits within 3 m of an extract building, hide it — same tolerance the
  // earlier audit used when it counted the residual 47 pairs. Ring-by-ring
  // matters because OpenFreeMap sometimes batches many footprints into one
  // multipolygon feature; a single feature centroid would miss the overlap.
  _scanBasemapDuplicates() {
    if (this._buildingsFromTiles) return;
    if (!this.map || !this._appearanceCentroidGrid) return;
    let features;
    try {
      features = this.map.querySourceFeatures('openmaptiles', { sourceLayer: 'building' });
    } catch (_) {
      return;
    }
    if (!features || !features.length) return;
    const { encodeBasemapBuildingId } = window.CanalRecallBuildings || {};
    const known = new Set();
    if (encodeBasemapBuildingId) {
      for (const osmId of this._appearanceOsmIds) {
        const encoded = encodeBasemapBuildingId(osmId);
        if (encoded !== null) known.add(encoded);
      }
    }
    for (const id of this._basemapProximityHideIds) known.add(id);
    const found = [];
    for (const feature of features) {
      const id = feature.id;
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || known.has(id)) continue;
      const centres = this._featureRingCentres(feature);
      if (!centres.some(centre => this._appearanceNear(centre, 3))) continue;
      known.add(id);
      found.push(id);
    }
    if (!found.length) return;
    this._basemapProximityHideIds = this._basemapProximityHideIds.concat(found);
    this._refreshBuildingSuppression();
  }

  _buildAppearanceCentroidGrid(features) {
    // ~25 m cells at Amsterdam latitude — large enough that a 3 m search only
    // touches the home cell and its neighbours.
    const cellDeg = 0.00025;
    const grid = new Map();
    for (const feature of features) {
      const centre = this._featureCentreLngLat(feature);
      if (!centre) continue;
      const key = `${Math.floor(centre[0] / cellDeg)}:${Math.floor(centre[1] / cellDeg)}`;
      let bucket = grid.get(key);
      if (!bucket) { bucket = []; grid.set(key, bucket); }
      bucket.push(centre);
    }
    return { cellDeg, grid };
  }

  _appearanceNear(lngLat, metres) {
    const index = this._appearanceCentroidGrid;
    if (!index) return false;
    const [lng, lat] = lngLat;
    const metresPerDegLat = 110540;
    const metresPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
    const cellLng = Math.floor(lng / index.cellDeg);
    const cellLat = Math.floor(lat / index.cellDeg);
    const limit2 = metres * metres;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = index.grid.get(`${cellLng + dx}:${cellLat + dy}`);
        if (!bucket) continue;
        for (const [olng, olat] of bucket) {
          const east = (olng - lng) * metresPerDegLng;
          const north = (olat - lat) * metresPerDegLat;
          if (east * east + north * north <= limit2) return true;
        }
      }
    }
    return false;
  }

  _signatureSuppressOsmIds() {
    if (!this._signatureLandmarks) return [];
    const ids = new Set(this._signatureLandmarks.shownSuppressOsmIds());
    const helpers = window.CanalRecallSignatureLandmarks;
    if (!helpers || !helpers.footprintPolygon || !helpers.pointInRing) return [...ids];
    for (const footprint of this._signatureLandmarks.shownFootprints()) {
      const ring = helpers.footprintPolygon(footprint, 4);
      for (const feature of this._appearanceFeatures) {
        const osmId = feature.properties && feature.properties.osmId;
        if (!osmId || ids.has(osmId)) continue;
        const centre = this._featureCentreLngLat(feature);
        if (centre && helpers.pointInRing(centre, ring)) ids.add(osmId);
      }
    }
    return [...ids];
  }

  _featureCentreLngLat(feature) {
    const centres = this._featureRingCentres(feature);
    if (!centres.length) return null;
    let sumLng = 0;
    let sumLat = 0;
    for (const point of centres) { sumLng += point[0]; sumLat += point[1]; }
    return [sumLng / centres.length, sumLat / centres.length];
  }

  _featureRingCentres(feature) {
    const geometry = feature && feature.geometry;
    if (!geometry || !geometry.coordinates) return [];
    const rings = geometry.type === 'Polygon'
      ? [geometry.coordinates[0]]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates.map(polygon => polygon[0])
        : [];
    const centres = [];
    for (const ring of rings) {
      if (!Array.isArray(ring) || !ring.length) continue;
      let sumLng = 0;
      let sumLat = 0;
      let count = 0;
      for (const point of ring) {
        if (!Array.isArray(point) || typeof point[0] !== 'number') continue;
        sumLng += point[0];
        sumLat += point[1];
        count += 1;
      }
      if (count) centres.push([sumLng / count, sumLat / count]);
    }
    return centres;
  }

  // The cap layer's own filter (flat roofs with a distinct colour) must survive
  // every refresh: setting the signature suppression on its own replaced it
  // with `null`, capped every building in the city, and the lid z-fought the
  // roof under it. Both layers therefore always go through one composer.
  _coloredBuildingBaseFilter(id) {
    if (id === 'osm-colored-building-facades') return ['has', 'facade'];
    if (id === 'osm-colored-building-ground-floors') return ['all', ['has', 'groundColour'], ['!=', ['get', 'groundAppearanceStyleSource'], 'wall-inherited-not-independently-measured']];
    if (id !== 'osm-colored-building-roofs') return null;
    const helpers = window.CanalRecallBuildings;
    return helpers && helpers.flatRoofFilter ? helpers.flatRoofFilter() : ['has', 'roofColour'];
  }

  _facadesLib() {
    const lib = window.CanalRecallBuildings;
    return this._facadesEnabled && lib && lib.Facades ? lib.Facades : null;
  }

  /** Facades draw only in the clean theme (a pattern bakes in its colours),
   *  and never under measured-colours-only review or detailed/photoreal 3D. */
  _facadesActive() {
    return !!this._facadesLib() && this.theme === 'clean' && !this._measuredColoursOnly && !this._facadesHiddenByDetail
      && !this._facadesOutOfZoom;
  }

  /**
   * The plain wall layer's base. With facades on, a patterned building's plain
   * wall shrinks to a cornice band above the pattern layer — its top face is
   * then the roof, and the pattern's own top face (which samples the facade
   * image) is hidden inside it. A highlighted building drops back to a plain
   * full-height yellow wall while the pattern layer collapses (feature-state,
   * so highlighting never re-lays out tiles).
   */
  _wallBaseExpression(groundTop, minHeight, wallTop) {
    const ground = ['case', this._coloredBuildingBaseFilter('osm-colored-building-ground-floors'), groundTop, minHeight];
    const Facades = this._facadesLib();
    if (!Facades || !this._facadesActive()) return ground;
    return ['case',
      ['all', ['has', 'facade'], ['!', ['boolean', ['feature-state', 'highlighted'], false]]],
      ['max', minHeight, ['-', wallTop, Facades.FACADE_CORNICE_M]],
      ground];
  }

  /** The three.js facade layer, when `?buildings3d=1` and the bundle is present. */
  _addThreeBuildingsLayer() {
    const api = window.CanalRecallThreeBuildings;
    if (!this._buildings3dEnabled || !this._facadesLib() || !api || !api.ThreeBuildings) return;
    if (!this._threeBuildings) this._threeBuildings = new api.ThreeBuildings(this.map, window.maplibregl, this._buildings3dLook);
    if (!this.map.getLayer(this._threeBuildings.layer.id)) {
      this.map.addLayer(this._threeBuildings.layer, this.map.getLayer('osm-colored-building-roofs') ? 'osm-colored-building-roofs' : undefined);
      if (this._tileFeatures.length) this._threeBuildings.setFeatures(this._tileFeatures);
    }
    this._threeBuildings.setVisible(this._facadesActive() && this._buildings3dEnabled);
  }

  /**
   * Tile decorator: period facades, plus (in the three.js looks) real roofs, which
   * lower the plain wall to the eaves. Changing it resends the resident tiles once.
   */
  _applyFeatureDecorator() {
    const Facades = this._facadesLib();
    if (!Facades || !this._completeCity || !this._completeCity.setFeatureDecorator) return;
    const api = window.CanalRecallThreeBuildings;
    const withRoofs = this._buildings3dEnabled && api && api.decorateRoof;
    this._completeCity.setFeatureDecorator(withRoofs ? (feature) => api.decorateRoof(Facades.decorateFacade(feature)) : Facades.decorateFacade);
  }

  /** The look the saved preference asks for, unless a URL look is in force. */
  setBuildingLookPreference(look) {
    if (this._buildingLookLocked) return;
    this.setBuildingLook(look);
  }

  /**
   * Live switch: 'default' (the stock pattern layer), 'procedural', 'cartoon'
   * or 'photo'. Both layers exist side by side once used; only one is visible.
   */
  setBuildingLook(look) {
    if (!['default', 'procedural', 'storybook', 'cartoon', 'photo'].includes(look) || look === this._buildings3dLook) return;
    this._buildings3dLook = look;
    this._buildings3dEnabled = look !== 'default';
    if (!this.map || !this.map.getLayer('osm-colored-buildings')) return; // layers are created from these flags on load
    this._applyFeatureDecorator();
    if (this._buildings3dEnabled) {
      this._addThreeBuildingsLayer();
      if (this._threeBuildings) this._threeBuildings.setLook(look);
    } else {
      if (this._threeBuildings) this._threeBuildings.setFeatures([]); // free the wall meshes
      this._ensurePatternLayer();
    }
    this._facadeStateApplied = undefined;
    this._applyFacadeState();
  }

  /** Create the stock pattern layer late, when the session started on a three.js look. */
  _ensurePatternLayer() {
    if (this.map.getLayer('osm-colored-building-facades')) return;
    const helpers = window.CanalRecallBuildings;
    const wallTop = helpers && helpers.wallTopHeightExpression ? helpers.wallTopHeightExpression() : ['coalesce', ['get', 'height'], 5];
    const spec = this._facadeLayerSpec(['coalesce', ['get', 'minHeight'], 0], wallTop);
    if (spec) this.map.addLayer(spec, this.map.getLayer('osm-colored-building-roofs') ? 'osm-colored-building-roofs' : undefined);
  }

  /** Switch the three.js wall look live: 'procedural' | 'cartoon' | 'photo'. Console: `canalRecallGame.vectorMap.setBuildingsLook('cartoon')`. */
  setBuildingsLook(look) {
    this._buildings3dLook = look;
    return this._threeBuildings ? this._threeBuildings.setLook(look) : undefined;
  }

  _syncThreeBuildings(features) {
    this._tileFeatures = features;
    if (this._threeBuildings && this._buildings3dEnabled) this._threeBuildings.setFeatures(features);
  }

  _facadeLayerSpec(minHeight, wallTop) {
    const Facades = this._facadesLib();
    if (!Facades) return null;
    // Three mode draws walls itself: no pattern layer, and no 48 pattern images.
    if (this._buildings3dEnabled && window.CanalRecallThreeBuildings) return null;
    const tileZoom = this._facadeTileZoom || Facades.facadeTileZoom(this.map.getZoom()) || Facades.FACADE_MAX_TILE_ZOOM;
    this._facadeTileZoom = tileZoom;
    if (!this._facadeImages) this._facadeImages = new Facades.FacadeImageSet(this.map, 52.37);
    this._facadeImages.ensure(tileZoom);
    return {
      id: 'osm-colored-building-facades', type: 'fill-extrusion', source: 'osm-building-appearance', minzoom: 14,
      filter: ['has', 'facade'],
      layout: { visibility: this._facadesActive() ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-pattern': Facades.facadePatternExpression(tileZoom),
        'fill-extrusion-base': minHeight,
        'fill-extrusion-height': ['case', ['boolean', ['feature-state', 'highlighted'], false], minHeight,
          ['max', minHeight, ['-', wallTop, Facades.FACADE_CORNICE_M]]],
        'fill-extrusion-opacity': BUILDING_FADE_IN
      }
    };
  }

  /** Show/hide the pattern layer and keep the plain wall base in step. */
  _applyFacadeState() {
    if (!this.map) return;
    const hasPattern = !!this.map.getLayer('osm-colored-building-facades');
    if (!this._threeBuildings && !hasPattern) return;
    const active = this._facadesActive();
    const three = !!this._threeBuildings && this._buildings3dEnabled;
    const key = `${active}|${three}`;
    if (this._facadeStateApplied === key) return;
    this._facadeStateApplied = key;
    if (this._threeBuildings) this._threeBuildings.setVisible(active && three);
    if (hasPattern) this.map.setLayoutProperty('osm-colored-building-facades', 'visibility', active && !three ? 'visible' : 'none');
    const helpers = window.CanalRecallBuildings;
    const wallTop = helpers && helpers.wallTopHeightExpression ? helpers.wallTopHeightExpression() : ['coalesce', ['get', 'height'], 5];
    const minHeight = ['coalesce', ['get', 'minHeight'], 0];
    const groundTop = ['min', wallTop, ['+', minHeight, ['coalesce', ['get', 'groundFloorHeightM'], 3.2]]];
    if (this.map.getLayer('osm-colored-buildings')) {
      this.map.setPaintProperty('osm-colored-buildings', 'fill-extrusion-base', this._wallBaseExpression(groundTop, minHeight, wallTop));
    }
  }

  /**
   * A pattern's size in metres halves at every integer tile zoom, so the
   * images are re-registered per zoom with a pixel ratio that keeps a storey
   * a storey. Swapping the expression re-lays out the building tiles, which
   * happens only when the integer zoom changes.
   */
  _syncFacadeZoom(mapZoom) {
    const Facades = this._facadesLib();
    if (!Facades || !this._facadeImages || !this.map.getLayer('osm-colored-building-facades')) return;
    const tileZoom = Facades.facadeTileZoom(mapZoom, this._facadeTileZoom);
    // Past the pattern's zoom range the plain walls come back.
    const outOfZoom = tileZoom === null;
    if (outOfZoom !== !!this._facadesOutOfZoom) { this._facadesOutOfZoom = outOfZoom; this._applyFacadeState(); }
    if (outOfZoom || tileZoom === this._facadeTileZoom) return;
    this._facadeTileZoom = tileZoom;
    this._facadeImages.ensure(tileZoom);
    this.map.setPaintProperty('osm-colored-building-facades', 'fill-extrusion-pattern', Facades.facadePatternExpression(tileZoom));
    clearTimeout(this._facadePruneTimer);
    this._facadePruneTimer = setTimeout(() => { if (this._facadeImages) this._facadeImages.prune(this._facadeTileZoom); }, 4000);
  }

  _refreshColoredBuildingFilter() {
    if (!this.map) return;
    const hide = this._measuredColoursOnly ? [] : this._signatureSuppressOsmIds();
    if (this._threeBuildings) this._threeBuildings.setHidden('signature', hide);
    const helpers = window.CanalRecallBuildings;
    for (const id of ['osm-colored-building-ground-floors', 'osm-colored-buildings', 'osm-colored-building-facades', 'osm-colored-building-roofs']) {
      if (!this.map.getLayer(id)) continue;
      const original = this._coloredBuildingBaseFilter(id);
      const measured = ['==', ['get', 'sideColourSource'], 'measured-accepted'];
      const base = this._measuredColoursOnly ? (original ? ['all', original, measured] : measured) : original;
      const filter = helpers && helpers.coloredBuildingLayerFilter
        ? helpers.coloredBuildingLayerFilter(base, hide)
        : base;
      try { this.map.setFilter(id, filter); } catch (error) {
        console.warn(`Could not filter ${id} under signature models.`, error);
      }
    }
  }

  /**
   * Swap the OSM-only appearance source for the complete BAG-keyed city, when
   * that city has been published.
   *
   * Until it is, this does nothing at all and the map keeps the source it
   * already had. The complete city is 15 MB of generated data that lands in the
   * versioned extract as a reviewed decision, so "the tiles are not there" is
   * the normal state, not a failure — `probe()` is one HEAD request for the
   * index and everything else is gated on it.
   *
   * When it is present, three things change together, and they have to change
   * together. The source stops being one 5.5 MB file describing a tenth of the
   * city and becomes a streamed working set describing all of it. The basemap's
   * own `building-3d` extrusion is hidden, because it is pure redundancy once
   * every building is described locally. And the height offsets that keep three
   * coplanar extrusions from z-fighting stop being needed for the walls, since
   * there is now exactly one description per building — the roof cap still sits
   * inside the wall, because two horizontal faces at one height still fight.
   *
   * Returns true when the tile path owns buildings (static extract must not
   * load). Returns false when the caller should fall back to the GeoJSON.
   */
  async _ensureCompleteCity() {
    const runtime = window.CanalRecallBuildingTiles;
    if (!runtime || !runtime.BuildingTileStreamer) return false;
    this._completeCity = new runtime.BuildingTileStreamer(
      this.map, 'osm-building-appearance', this._extractPath || '../data/extracts/amsterdam'
    );
    const Facades = this._facadesLib();
    if (Facades && this._completeCity.setTileEnricher && this._completeCity.setFeatureDecorator) {
      // Construction years ride in from the building-facts tiles cut on the
      // same z14 grid; the decorator turns year + size into a facade key.
      this._completeCity.setTileEnricher(Facades.constructionYearEnricher(this._extractPath || '../data/extracts/amsterdam'));
      this._applyFeatureDecorator();
    }
    let available = false;
    try {
      available = await this._completeCity.probe();
    } catch (_) {
      available = false;
    }
    if (!available || !this.map.getSource('osm-building-appearance')) return false;

    // The Da Costa appearance study (city-expansion) was retired on 2026-10-01;
    // the game no longer loads the appearance catalog, so _appearanceAreas stays
    // empty and none of the optional study renderers start.

    // Hand the verified priors to the complete-city source before optional
    // roofs, facades, trees and water start their independent loads. Waiting
    // for every decorative layer here left the old static neutral source on
    // screen for several seconds even though the colour sidecar had already
    // passed verification.
    this._buildingsFromTiles = true;
    this._appearanceFeatures = [];
    this._appearanceOsmIds = [];
    this._appearanceCentroidGrid = null;
    this._preencodedBasemapHideIds = [];
    this._basemapProximityHideIds = [];
    this._recreateBuildingSourceWithStableIds();
    this._styleCompleteCity();
    this._completeCity.attach(() => {
      // A streamed tile becomes the render owner. Keep this state so later
      // settings synchronisation cannot revive the overlapping basemap copy.
      this._completeCityHasBuildings = true;
      this._syncDetailedBuildingLayers();
      // A camera check made before the newly requested z14 tile arrived only
      // saw the previous district's footprints. Re-run the same request after
      // every streamed collection update so a late opaque mass cannot appear
      // between the physical camera and the route centre.
      if (this._cameraClearanceRequest) this._clearCameraFromBuildingFootprints(
        this._cameraClearanceRequest.center, this._cameraClearanceRequest.view,
        this._cameraClearanceRequest.subject,
      );
    }, (features) => {
      this._syncPyramidalRoofs(features);
      // The streamer sends tiles to MapLibre after this callback, so an error here
      // would leave buildings without roofs. Never let the wall layer throw into it.
      try { this._syncThreeBuildings(features); } catch (error) { console.warn('three.js facade layer: feature sync failed', error); }
    });
    // Loading may already have aimed at the route start before the probe
    // finished; apply that aim now so tiles stream under the overlay.
    this._applyPendingAim();

    if (this._appearanceAreas.length && this._completeCity.setAppearancePriors) {
      const optional = [
        { api: window.CanalRecallStudyRoofs, ctor: 'StudyRoofs', list: this._studyRoofAreas, alias: '_studyRoofs', label: 'roof geometry' },
        { api: window.CanalRecallStudyFacades, ctor: 'StudyFacades', list: this._studyFacadeAreas, alias: '_studyFacades', label: 'facade geometry' },
        { api: window.CanalRecallStudyTrees, ctor: 'StudyTrees', list: this._studyTreeAreas, alias: '_studyTrees', label: 'tree geometry' },
        { api: window.CanalRecallStudyPublicRealm, ctor: 'StudyPublicRealm', list: this._studyPublicRealmAreas, alias: '_studyPublicRealm', label: 'public-realm geometry' },
      ];
      for (const area of this._appearanceAreas) for (const kind of optional) {
        const Constructor = kind.api && kind.api[kind.ctor];
        if (!Constructor) continue;
        const renderer = new Constructor(this.map, maplibregl, area.id);
        // Loading an index normally starts its tile requests immediately. Keep
        // every catalog entry cold until the viewport-wide selector chooses
        // one area, otherwise N overlapping areas each claim their own 12-tile
        // cache during startup.
        renderer.setEnabled(false);
        try {
          await renderer.load(area.pointerUrl);
          kind.list.push(renderer);
          if (!this[kind.alias]) this[kind.alias] = renderer;
        } catch (error) {
          renderer.dispose();
          this._appearanceAreaFailures.push({ id: area.id, layer: kind.ctor, message: String(error && error.message || error) });
          console.warn(`Optional ${kind.label} unavailable for ${area.id}.`, error);
        }
      }
      this._updateStudyAreaResidency();
      if (!this._studyResidencyListener) {
        this._studyResidencyListener = () => this._updateStudyAreaResidency();
        this.map.on('moveend', this._studyResidencyListener);
      }
    }
    return true;
  }

  /**
   * Rebuild the source so feature ids are the building's own identity.
   *
   * The static source uses `generateId`, which numbers features by their index
   * in the array. That is fine for one file loaded once, and wrong the moment
   * the array is rebuilt: the streamer rewrites it every time a tile lands or
   * is evicted, so the index that identified a highlighted building comes back
   * pointing at a different one, and the yellow highlight jumps to an unrelated
   * house as the player drives.
   *
   * `promoteId` takes the id out of the feature instead — the BAG pand id, or
   * the OSM id at tier 4 — so feature state survives a reload and picking
   * returns something stable enough to key a `BuildingHit` on. It can only be
   * set when the source is created, hence the teardown. This runs during load,
   * before anything has been highlighted, so nothing is lost with it.
   */
  _recreateBuildingSourceWithStableIds() {
    const layers = ['osm-colored-building-ground-floors', 'osm-colored-buildings', 'osm-colored-building-facades', 'osm-colored-building-roofs']
      .map(id => this.map.getLayer(id) && this.map.getStyle().layers.find(layer => layer.id === id))
      .filter(Boolean)
      .map(layer => JSON.parse(JSON.stringify(layer)));
    for (const layer of layers) if (this.map.getLayer(layer.id)) this.map.removeLayer(layer.id);
    if (this.map.getSource('osm-building-appearance')) this.map.removeSource('osm-building-appearance');
    this.map.addSource('osm-building-appearance', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      promoteId: 'id',
      attribution: 'Buildings © 3DBAG (CC BY 4.0) / © OpenStreetMap contributors'
    });
    for (const layer of layers) this.map.addLayer(layer);
  }

  /**
   * Repaint the two extrusion layers for the merged schema.
   *
   * Most of the city is a measured pand with no OSM appearance at all, so
   * `colour` is absent for it and the theme's own height ramp fills in — that
   * is the controlled neutral fallback, not a bug. The roof cap is filtered to
   * buildings that actually have a roof colour, because a `fill-extrusion-color`
   * that resolves to nothing drops every building in the layer back to the
   * style default rather than skipping the one feature.
   */
  _styleCompleteCity() {
    const themeColor = window.CanalRecallBuildings
      ? window.CanalRecallBuildings.buildingColorExpression(this.theme)
      : '#D8D3CA';
    const helpers = window.CanalRecallBuildings;
    const height = helpers && helpers.wallTopHeightExpression
      ? helpers.wallTopHeightExpression()
      : ['coalesce', ['get', 'height'], 5];
    const minHeight = ['coalesce', ['get', 'minHeight'], 0];
    const groundTop = ['min', height, ['+', minHeight, ['coalesce', ['get', 'groundFloorHeightM'], 3.2]]];
    this.map.setPaintProperty('osm-colored-building-ground-floors', 'fill-extrusion-color', [
      'case', ['boolean', ['feature-state', 'highlighted'], false], '#FFD21F', ['to-color', ['get', 'groundColour'], '#806451']
    ]);
    this.map.setPaintProperty('osm-colored-building-ground-floors', 'fill-extrusion-base', minHeight);
    this.map.setPaintProperty('osm-colored-building-ground-floors', 'fill-extrusion-height', groundTop);
    this.map.setPaintProperty('osm-colored-buildings', 'fill-extrusion-color', [
      'case', ['boolean', ['feature-state', 'highlighted'], false], '#FFD21F', themeColor
    ]);
    this.map.setPaintProperty('osm-colored-buildings', 'fill-extrusion-height', height);
    this._facadeStateApplied = null;
    this.map.setPaintProperty('osm-colored-buildings', 'fill-extrusion-base', this._wallBaseExpression(groundTop, minHeight, height));
    this._refreshColoredBuildingFilter();
    this._applyFacadeState();
    this.map.setPaintProperty('osm-colored-building-roofs', 'fill-extrusion-color', [
      'case', ['boolean', ['feature-state', 'highlighted'], false], '#FFD21F', ['to-color', ['get', 'roofColour'], '#B09999']
    ]);
    this.map.setPaintProperty('osm-colored-building-roofs', 'fill-extrusion-base', height);
    this.map.setPaintProperty('osm-colored-building-roofs', 'fill-extrusion-height', ['+', height, 0.4]);
  }

  _ensurePlaceLayers() {
    if (this.map.getSource('amsterdam-pois')) return;
    this.map.addSource('amsterdam-neighborhoods', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    this.map.addSource('amsterdam-neighborhood-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    this.map.addSource('amsterdam-pois', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    this.map.addSource('branded-pois', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'POIs © OpenStreetMap contributors' });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    this.map.addLayer({ id: 'neighborhood-boundaries', type: 'line', source: 'amsterdam-neighborhoods', minzoom: 13, paint: { 'line-color': '#8B5CF6', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 2.5], 'line-opacity': 0.48, 'line-dasharray': [3, 3] } }, before);
    // No landmark or shop dots: bare dots crowded the map ("why so many yellow
    // dots", 2026-09-29; "still seeing yellow dots", 2026-10-01). Names only.
    this.map.addLayer({ id: 'poi-labels', type: 'symbol', source: 'amsterdam-pois', minzoom: 16, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, -0.7], 'text-anchor': 'bottom', 'text-allow-overlap': false }, paint: { 'text-color': '#FFF7CC', 'text-halo-color': '#071E2B', 'text-halo-width': 2, 'text-translate-anchor': 'viewport' } });
    this._loadBrandIcon('albert-heijn', './brand-icons/albert-heijn.svg');
    this.map.addLayer({ id: 'brand-poi-icons', type: 'symbol', source: 'branded-pois', minzoom: 15.5, filter: ['all', ['==', ['get', 'kind'], 'albert-heijn'], ['has', 'icon']], layout: { 'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 15.5, 0.62, 18, 0.9], 'icon-allow-overlap': false, 'icon-ignore-placement': false }, paint: { 'icon-translate-anchor': 'viewport' } });
    this.map.addLayer({ id: 'brand-poi-labels', type: 'symbol', source: 'branded-pois', minzoom: 17, filter: ['==', ['get', 'kind'], 'albert-heijn'], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 10, 'text-offset': [0, -1.7], 'text-anchor': 'bottom', 'text-allow-overlap': false }, paint: { 'text-color': '#E0F2FE', 'text-halo-color': '#071E2B', 'text-halo-width': 2, 'text-translate-anchor': 'viewport' } });
    this.map.addLayer({ id: 'local-food-labels', type: 'symbol', source: 'branded-pois', minzoom: 16, filter: ['==', ['get', 'kind'], 'local-food'], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 18, 12], 'text-letter-spacing': 0.02, 'text-allow-overlap': false, 'symbol-sort-key': ['-', 20, ['get', 'orientationScore']] }, paint: { 'text-color': '#C9DDE5', 'text-halo-color': '#071E2B', 'text-halo-width': 2, 'text-translate-anchor': 'viewport' } });
    this.map.addLayer({ id: 'neighborhood-labels', type: 'symbol', source: 'amsterdam-neighborhood-labels', minzoom: 13, maxzoom: 18.5, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 17, 16], 'text-letter-spacing': 0.12, 'text-allow-overlap': false }, paint: { 'text-color': '#6D28D9', 'text-halo-color': 'rgba(255,255,255,.9)', 'text-halo-width': 2 } });
  }

  /** Business and landmark labels draw above every building layer. The
   *  basemap's shop and café layers sit low in its style, under the building
   *  extrusions added later, so lifting them onto the facades only slid them
   *  behind the walls (user report 2026-09-29, "Café De Jo…" cut off by the
   *  building beside it). Moved to the top whenever buildings are (re)added. */
  _raisePoiLayers() {
    const lib = window.CanalRecallOrientationPois;
    if (!this.map || !this.map.getStyle()) return;
    if (!this._poiLayerIds) {
      const basemap = lib && lib.basemapOrientationPoiLayerIds
        ? lib.basemapOrientationPoiLayerIds(this.map.getStyle().layers || []) : [];
      this._poiLayerIds = [...basemap, 'poi-labels', 'brand-poi-icons', 'brand-poi-labels', 'local-food-labels',
        // The active landmark's locator too: under the extrusions, the dot
        // for a tree beside a building was hidden by that building.
        'active-landmark-line', 'active-landmark-point',
        // The answered street name stands above the facades, not cut by them.
        'answered-street-name',
        ...((lib && lib.OWN_POI_BANDS) || []).flatMap(band => Object.values(lib.ownPoiLayerIds(band)))];
      // Building layers are re-created later (themes, detailed buildings), so
      // keep checking. Once the order is right the check moves nothing, so
      // the styledata its own moves fire cannot loop.
      this.map.on('styledata', () => this._raisePoiLayersIfBuried());
    }
    this._raisePoiLayersIfBuried();
  }

  _raisePoiLayersIfBuried() {
    if (!this.map || !this._poiLayerIds || typeof this.map.getLayersOrder !== 'function') return;
    const order = this.map.getLayersOrder();
    let topBuilding = -1;
    order.forEach((id, index) => { if (/^osm-colored-building|^building-3d|^three-building|detailed|signature/.test(id)) topBuilding = index; });
    if (topBuilding < 0) return;
    const buried = this._poiLayerIds.filter(id => { const index = order.indexOf(id); return index >= 0 && index < topBuilding; });
    for (const id of buried) this.map.moveLayer(id);
  }

  /** Lift landmark and venue markers onto the buildings (see
   *  orientationPois.roofLiftTranslate). Pitch changes every frame while the
   *  sightline eases, so only a degree's change repaints. */
  _liftPoiMarkers(pitch, latitude) {
    const lib = window.CanalRecallOrientationPois;
    if (!lib || !lib.roofLiftTranslate || !this.map.getLayer('poi-labels')) return;
    if (this._poiLiftPitch != null && Math.abs(pitch - this._poiLiftPitch) < 1) return;
    this._poiLiftPitch = pitch;
    const translate = lib.roofLiftTranslate(pitch, latitude);
    // Our landmark dots stay on the ground: landmarks include trees, statues
    // and memorials, and a lifted dot floated beside the Bevrijdingslinde
    // instead of marking it (user report 2026-09-29). Shops, cafés and
    // supermarkets are nearly always in a building, so they are lifted.
    const properties = {
      'brand-poi-icons': ['icon-translate'],
      'brand-poi-labels': ['text-translate'], 'local-food-labels': ['text-translate'],
    };
    // The basemap's own shop and café labels too: those were the grey names
    // on the pavement in the report. Stations and tram stops stand in the
    // street, so they stay on the ground.
    for (const id of lib.basemapOrientationPoiLayerIds(this.map.getStyle().layers || [])) {
      if (!/transit/.test(id)) properties[id] = ['icon-translate', 'text-translate'];
    }
    for (const [id, names] of Object.entries(properties)) {
      if (!this.map.getLayer(id)) continue;
      for (const name of names) {
        this.map.setPaintProperty(id, `${name}-anchor`, 'viewport');
        this.map.setPaintProperty(id, name, translate);
      }
    }
    // Our own POIs know their building's height band: each band is lifted to
    // its own roofline, and parks, markets and places outdoors stay down.
    for (const band of lib.OWN_POI_BANDS || []) {
      const { dots, labels } = lib.ownPoiLayerIds(band);
      const lift = lib.roofLiftTranslate(pitch, latitude, lib.HEIGHT_BAND_METRES[band]);
      if (this.map.getLayer(dots)) this.map.setPaintProperty(dots, 'circle-translate', lift);
      if (this.map.getLayer(labels)) this.map.setPaintProperty(labels, 'text-translate', lift);
    }
  }

  _loadBrandIcon(id, url) {
    if (!this.map || this.map.hasImage(id)) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (this.map.hasImage(id)) return;
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 48;
      const context = canvas.getContext('2d');
      context.fillStyle = '#FFFFFF';
      context.beginPath(); context.arc(24, 24, 22, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#0F3040'; context.lineWidth = 2; context.stroke();
      context.drawImage(image, 9, 9, 30, 30);
      this.map.addImage(id, context.getImageData(0, 0, 48, 48), { pixelRatio: 2 });
    };
    image.onerror = () => console.warn('Brand icon unavailable:', id, url);
    image.src = url;
  }

  /** Names the game may ask about. Orientation labels that would say one of
   *  them are dropped: a tram stop called "Nassaukade" on Nassaukade answers
   *  the question before it is asked. See `orientationPois.ts`. */
  setSpoilerNames(names, source = 'extract') {
    const lib = window.CanalRecallOrientationPois;
    if (!lib || !lib.buildSpoilerIndex) return;
    // Keyed by source: the extract's knowledge files, and the route's own
    // track (every street a bike ride can ask, not only the curated subset).
    this._spoilerSources = this._spoilerSources || new Map();
    this._spoilerSources.set(source, names || []);
    this._spoilerIndex = lib.buildSpoilerIndex([].concat(...this._spoilerSources.values()));
    this._applyBasemapSpoilerFilter();
    if (this._pendingPlaces) this.setPlaces(this._pendingPlaces.landmarks, this._pendingPlaces.boundaries);
    if (this._rawBrandedPois) this.setBrandedPois(this._rawBrandedPois);
    this._applyOwnPois();
  }

  /** The game's own POI layer (`orientation-pois.json`, built by
   *  `scripts/build-orientation-pois.ts`): categories and density we choose,
   *  names screened for spoilers before they draw, and each label on its
   *  building's roofline band. Where a city has no file, the basemap's POI
   *  layer stays (user requests 2026-09-29). */
  _ensureOwnPoiLayers() {
    const lib = window.CanalRecallOrientationPois;
    if (!lib || !lib.ownPoiFeatures || this.map.getSource('own-pois')) return;
    this.map.addSource('own-pois', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'POIs © OpenStreetMap contributors' });
    for (const band of lib.OWN_POI_BANDS) {
      // Names only, no dots. A dot drew for every POI from zoom 16 while the
      // names, collision-thinned, drew for few of them: the facades were
      // freckled with coloured dots that said nothing ("these dots everywhere
      // are ugly and not helpful", user report 2026-09-30).
      const { labels } = lib.ownPoiLayerIds(band);
      const filter = ['==', ['get', 'band'], band];
      this.map.addLayer({ id: labels, type: 'symbol', source: 'own-pois', minzoom: 16.5, filter, layout: {
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 16.5, 10, 18, 12], 'text-anchor': 'top', 'text-offset': [0, 0.45],
        'text-max-width': 8, 'text-allow-overlap': false, 'symbol-sort-key': ['-', 200, ['get', 'rank']] }, paint: {
        'text-color': '#34424d', 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.6, 'text-translate-anchor': 'viewport' } });
    }
    this._loadOwnPois();
  }

  async _loadOwnPois() {
    const url = this._extractFile('orientation-pois.json');
    if (this._ownPoiUrl === url) return;
    this._ownPoiUrl = url;
    let file = null;
    try {
      const response = await fetch(url);
      // A history fallback can answer a missing file with index.html and 200.
      if (response.ok) file = await response.json().catch(() => null);
    } catch (_) { /* no file: the basemap keeps the job */ }
    if (this._ownPoiUrl !== url) return;
    this._ownPoiFile = file && Array.isArray(file.pois) ? file : null;
    this._applyOwnPois();
  }

  _applyOwnPois() {
    const lib = window.CanalRecallOrientationPois;
    const source = this.map && this.map.getSource('own-pois');
    if (!lib || !lib.ownPoiFeatures || !source) return;
    const data = lib.ownPoiFeatures(this._ownPoiFile, name => this._spoils(name));
    source.setData(data);
    this._ownPoiData = data;
    this._ownPoisActive = data.features.length > 0;
    this._poiLiftPitch = null;
    this._setBasemapOrientationPoisVisible(!this._quizQuietMap);
  }

  _spoils(name) {
    const lib = window.CanalRecallOrientationPois;
    return !!(this._spoilerIndex && lib && lib.poiNameSpoils(name, this._spoilerIndex));
  }

  _applyBasemapSpoilerFilter() {
    const lib = window.CanalRecallOrientationPois;
    if (!this.map || !this.map.getStyle() || !this._spoilerIndex || !lib || !lib.basemapSpoilerFilter) return;
    this._basemapPoiFilters = this._basemapPoiFilters || new Map();
    for (const id of lib.basemapOrientationPoiLayerIds(this.map.getStyle().layers || [])) {
      if (!this._basemapPoiFilters.has(id)) this._basemapPoiFilters.set(id, this.map.getFilter(id) || null);
      try { this.map.setFilter(id, lib.basemapSpoilerFilter(this._basemapPoiFilters.get(id), this._spoilerIndex)); } catch (_) {}
    }
  }

  setBrandedPois(pois) {
    this._rawBrandedPois = pois || [];
    // The extract carries every named food venue in the city. Drawn all at
    // once they bury the driving corridor, so only the best cue on each patch
    // of ground is handed to the map.
    const thin = window.CanalRecallOrientationPois
      && window.CanalRecallOrientationPois.thinOrientationPois;
    const safe = (pois || []).filter(poi => !this._spoils(poi.name));
    this._pendingBrandedPois = thin ? thin(safe) : safe;
    if (!this.map) return;
    const source = this.map.getSource('branded-pois');
    if (!source) return;
    for (const poi of this._pendingBrandedPois) {
      if (poi.icon && poi.iconUrl) this._loadBrandIcon(poi.icon, poi.iconUrl);
    }
    source.setData({
      type: 'FeatureCollection',
      features: this._pendingBrandedPois.map(poi => ({
        type: 'Feature', properties: { id: poi.id, name: poi.name, kind: poi.kind, brand: poi.brand || '', amenity: poi.amenity || '', orientationScore: poi.orientationScore || 0, ...(poi.icon ? { icon: poi.icon } : {}) },
        geometry: { type: 'Point', coordinates: [poi.center[1], poi.center[0]] }
      }))
    });
  }

  setPlaces(landmarks, boundaries) {
    this._pendingPlaces = { landmarks: landmarks || [], boundaries: boundaries || [] };
    if (!this.map || !this.map.getSource('amsterdam-pois')) return;
    const pois = this._pendingPlaces.landmarks.filter(item => item.center && (item.prominenceScore || 0) >= 220 && !this._spoils(item.name)).map(item => ({ type: 'Feature', properties: { id: item.id, name: item.name }, geometry: { type: 'Point', coordinates: [item.center[1], item.center[0]] } }));
    const polygons = [], labels = [];
    for (const boundary of this._pendingPlaces.boundaries.filter(item => item.kind === 'neighbourhood' && item.geometry)) {
      for (const polygon of boundary.geometry) {
        const rings = polygon.map(ring => ring.map(([lat, lng]) => [lng, lat]));
        if (!rings[0] || rings[0].length < 3) continue;
        polygons.push({ type: 'Feature', properties: { name: boundary.name }, geometry: { type: 'Polygon', coordinates: rings } });
        const exterior = rings[0];
        const center = exterior.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map(value => value / exterior.length);
        labels.push({ type: 'Feature', properties: { name: boundary.name }, geometry: { type: 'Point', coordinates: center } });
      }
    }
    this.map.getSource('amsterdam-pois').setData({ type: 'FeatureCollection', features: pois });
    this.map.getSource('amsterdam-neighborhoods').setData({ type: 'FeatureCollection', features: polygons });
    this.map.getSource('amsterdam-neighborhood-labels').setData({ type: 'FeatureCollection', features: labels });
  }

  setTrees(trees) {
    this._pendingTrees = trees || [];
    if (!this.map) return;
    const source = this.map.getSource('amsterdam-trees');
    if (!source) return;
    const Trees = this._treesLib();
    if (Trees) {
      source.setData({ type: 'FeatureCollection', features: Trees.treeFeatures(this._pendingTrees) });
      return;
    }
    source.setData({
      type: 'FeatureCollection',
      features: this._pendingTrees.map(tree => ({ type: 'Feature', properties: { id: tree.id, species: tree.species || '' }, geometry: { type: 'Point', coordinates: [tree.lng, tree.lat] } }))
    });
  }

  /** The extract's OSM trees, fetched once the first time trees are shown. */
  _loadTrees() {
    if (this._rawTrees || this._treesLoading || !this.map) return;
    this._treesLoading = true;
    fetch(this._extractFile('trees.json'))
      .then(response => response.ok ? response.json() : [])
      .then(trees => { this._rawTrees = Array.isArray(trees) ? trees : []; this._refreshTreeData(); })
      .catch(() => { this._rawTrees = []; })
      .finally(() => { this._treesLoading = false; });
  }

  /** Trees around the current route (the extract spans the whole region),
   *  minus any whose crown would overhang the route corridor. */
  _refreshTreeData() {
    if (!this._rawTrees || !this.map || !this.map.getSource('amsterdam-trees')) return;
    const Trees = this._treesLib();
    let subset = this._rawTrees;
    const route = this._treeRoute;
    if (Trees) {
      if (route && route.length > 1) {
        let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
        for (const [lng, lat] of route) { west = Math.min(west, lng); east = Math.max(east, lng); south = Math.min(south, lat); north = Math.max(north, lat); }
        subset = Trees.thinTreesNearRoute(Trees.treesInBounds(subset, west - 0.02, south - 0.012, east + 0.02, north + 0.012), route);
      } else {
        const centre = this.map.getCenter();
        subset = Trees.treesInBounds(subset, centre.lng - 0.03, centre.lat - 0.018, centre.lng + 0.03, centre.lat + 0.018);
      }
    }
    this._treeCount = subset.length;
    this.setTrees(subset);
  }

  setTreesVisible(visible) {
    this._treesVisible = !!visible;
    // The old flat look never loaded tree data; keep it that way for A/B.
    if (visible && this._treesLib()) this._loadTrees();
    if (!this.map) return;
    for (const id of ['tree-trunks', 'tree-crowns']) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }

  setDetailedBuildingsVisible(visible) {
    this._detailedBuildingsVisible = !!visible;
    if (this._detailedBuildings) this._detailedBuildings.setEnabled(this._detailedBuildingsVisible);
    this._syncDetailedBuildingLayers();
    this.setActiveLandmark(this._activeLandmark);
  }

  setGoogleTilesEnabled(enabled) {
    this._googleTilesEnabled = !!enabled;
    if (!this._googleTilesEnabled && this._googleTiles) this._googleTiles.setEnabled(false);
    this._updateGoogleTiles();
  }

  /**
   * Camera height above the ground, in metres.
   *
   * MapLibre has no `getFreeCameraOptions()` — that is Mapbox GL JS 2.x, added
   * after the fork — so asking for it silently disabled this whole feature.
   * The transform is where MapLibre keeps the real camera height.
   */
  _cameraAltitudeMeters() {
    const transform = this.map && this.map.transform;
    if (!transform || typeof transform.getCameraAltitude !== 'function') return null;
    try {
      const altitude = transform.getCameraAltitude();
      return Number.isFinite(altitude) ? altitude : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Google's mesh earns its place only from the overview camera: at street
   * zoom it is a smear without building identity. The player-facing quantity
   * is `camera.zoom` (default 0.50 stays on 3DBAG); MapLibre altitude never
   * drops to the spike's 25 m cycling height.
   *
   * The zoom rule itself, including its hysteresis band, is
   * `src/canalRecall/building/photorealGate.ts` and is covered by
   * `npm run test:photoreal-gate`.
   */
  _updateGoogleTiles() {
    if (!this.map) return;
    const api = window.CanalRecallGoogleTiles;
    const gate = window.CanalRecallPhotorealGate;
    if (!gate) return;
    const want = gate.shouldShowPhotoreal({
      enabled: this._googleTilesEnabled,
      cameraZoom: this._lastCameraZoom ?? null,
      active: this._googleTilesActive,
    });

    if (want && !this._googleTiles && api && api.GooglePhotorealTiles) {
      // Built on first use, so a player who never turns it on never pays for
      // the tileset session, and never sends a request Google would bill.
      this._googleTiles = new api.GooglePhotorealTiles(this.map, maplibregl, text => this.setGoogleAttribution(text));
    }
    if (this._googleTiles) this._googleTiles.setEnabled(want);

    const active = !!(want && this._googleTiles && this._googleTiles.ready);
    if (active === this._googleTilesActive) return;
    this._googleTilesActive = active;
    if (!active) this.setGoogleAttribution('');
    this._syncDetailedBuildingLayers();
  }

  setGoogleAttribution(text) {
    const el = document.getElementById('google-tiles-attribution');
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
  }

  setMeasuredColoursOnly(enabled) {
    this._measuredColoursOnly = !!enabled;
    this._refreshColoredBuildingFilter();
    this._applyFacadeState();
    this._syncDetailedBuildingLayers();
  }

  _syncDetailedBuildingLayers() {
    if (!this.map) return;
    const google = this._googleTilesActive;
    // 3DBAG and Google must never draw together: they are the same buildings
    // twice, z-fighting into a shimmer.
    if (this._detailedBuildings) this._detailedBuildings.setEnabled(this._detailedBuildingsVisible && !google && !this._measuredColoursOnly);
    const detailed = !this._measuredColoursOnly && !google && !!(this._detailedBuildingsVisible && this._detailedBuildings && this._detailedBuildings.ready);
    // The streamed complete city owns every building once its first real tile
    // lands. Never resurrect the basemap copy during a later settings/readiness
    // sync; before that first tile, keep it as the no-empty-city fallback.
    const hideBasemap = this._measuredColoursOnly || detailed || google || !!this._completeCityHasBuildings;
    if (this.map.getLayer('building-3d')) {
      this.map.setLayoutProperty('building-3d', 'visibility', hideBasemap ? 'none' : 'visible');
    }
    for (const id of ['osm-colored-building-ground-floors', 'osm-colored-buildings', 'osm-colored-building-roofs']) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', (detailed || google) ? 'none' : 'visible');
    }
    this._facadesHiddenByDetail = detailed || google;
    this._applyFacadeState();
    // Signature models are the LoD1 replacement for a handful of landmarks.
    // Hide them under photoreal/3DBAG the same way the extrusions hide, so two
    // representations of Centraal never occupy the same air.
    if (this._signatureLandmarks) {
      this._signatureLandmarks.setEnabled(!detailed && !google && !this._measuredColoursOnly);
      this._refreshBuildingSuppression();
    }
    if (this._pyramidalRoofs) this._pyramidalRoofs.setEnabled(!detailed && !google && !this._measuredColoursOnly);
    this._studyLayersAllowed = !detailed && !google;
    this._updateStudyAreaResidency();
  }

  /**
   * Keep one catalog area's detail streams resident for the whole viewport.
   *
   * Every area publishes the same z16 owner/context tile keys. Selecting from
   * those keys is stricter than selecting the nearest area origin: outside all
   * published coverage every optional stream is cleared and the complete-city
   * building source remains the visual fallback. At overlaps, distance to the
   * viewport centre gives a deterministic owner and prevents four independent
   * renderers per area from multiplying their cache budgets.
   */
  _updateStudyAreaResidency() {
    if (!this.map) return;
    const groups = [this._studyRoofAreas, this._studyFacadeAreas, this._studyTreeAreas, this._studyPublicRealmAreas];
    const layers = groups.flat();
    if (!layers.length) return;
    const bounds = this.map.getBounds();
    const zoom = 16, scale = 2 ** zoom;
    const x = lng => Math.floor((lng + 180) / 360 * scale);
    const y = lat => {
      const clipped = Math.max(-85.05112878, Math.min(85.05112878, lat));
      const radians = clipped * Math.PI / 180;
      return Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * scale);
    };
    const west = x(bounds.getWest()), east = x(bounds.getEast());
    const north = y(bounds.getNorth()), south = y(bounds.getSouth());
    const wanted = new Set();
    for (let tileX = west - 1; tileX <= east + 1; tileX++) for (let tileY = north - 1; tileY <= south + 1; tileY++) wanted.add(`${zoom}/${tileX}/${tileY}`);
    const center = this.map.getCenter(), centerX = x(center.lng), centerY = y(center.lat);
    const candidates = new Map();
    for (const layer of layers) {
      const areaId = layer.areaId || '';
      if (!areaId || !layer.metas) continue;
      let distance = Infinity;
      for (const key of layer.metas.keys()) {
        if (!wanted.has(key)) continue;
        const [, tileX, tileY] = key.split('/').map(Number);
        distance = Math.min(distance, (tileX - centerX) ** 2 + (tileY - centerY) ** 2);
      }
      if (Number.isFinite(distance)) candidates.set(areaId, Math.min(candidates.get(areaId) ?? Infinity, distance));
    }
    const active = this._studyLayersAllowed
      ? [...candidates].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]?.[0] || null
      : null;
    this._activeAppearanceAreaId = active;
    for (const layer of layers) {
      if (typeof layer.setTileBudget === 'function') layer.setTileBudget(6);
      const buildingDetail = this._studyRoofAreas.includes(layer) || this._studyFacadeAreas.includes(layer);
      const enabled = Boolean(active && layer.areaId === active && !(this._measuredColoursOnly && buildingDetail));
      // Resident streamers already update and evict on moveend. Re-enabling an
      // active layer here clears every mesh on every camera sync, even when the
      // viewport and selected area have not changed.
      if (layer.enabled !== enabled) layer.setEnabled(enabled);
    }
    for (const [list, alias] of [
      [this._studyRoofAreas, '_studyRoofs'],
      [this._studyFacadeAreas, '_studyFacades'],
      [this._studyTreeAreas, '_studyTrees'],
      [this._studyPublicRealmAreas, '_studyPublicRealm'],
    ]) this[alias] = list.find(layer => layer.areaId === active) || list[0] || null;
  }

  setPlayerBike(player, loader, visible) {
    if (!this._playerBike || !player || !loader) return;
    this._playerBike.update(
      this.worldToLngLat(player.x, player.y, loader), player.angle, visible,
      player.steerInput || 0, player.distancePx || 0
    );
  }

  setPlayerBoat(player, loader, visible) {
    if (!this._playerBoat || !player || !loader) return;
    this._playerBoat.update(
      this.worldToLngLat(player.x, player.y, loader), player.angle, visible,
      player.steerInput || 0
    );
  }

  setPlayerTransit(player, loader, visible, underground = false) {
    if (!this._playerTransit || !player || !loader) return;
    if (typeof this._playerTransit.setAltitude === 'function') {
      // Metro GTFS shapes are ground projections of tunnels — drop the mesh so
      // it does not sit inside extruded buildings along the corridor.
      this._playerTransit.setAltitude(underground ? -9 : 0.22);
    }
    this._playerTransit.update(
      this.worldToLngLat(player.x, player.y, loader), player.angle, visible
    );
  }

  isPlayerBikeReady() {
    return !!(this._playerBike && this._playerBike.ready);
  }

  isPlayerBoatReady() {
    return !!(this._playerBoat && this._playerBoat.ready);
  }

  isPlayerTransitReady() {
    return !!(this._playerTransit && this._playerTransit.ready);
  }

  inspectBuilding(cssX, cssY, canvasRect) {
    if (!this.ready || !this.map || !canvasRect) return null;
    const mapCanvas = this.map.getCanvas();
    const pixel = {
      x: cssX * mapCanvas.clientWidth / canvasRect.width,
      y: cssY * mapCanvas.clientHeight / canvasRect.height
    };
    // Curated POIs must win over the much larger building extrusion under the
    // pointer. The hit box is forgiving because dots are intentionally small.
    let poiResult = null;
    const poiLayers = ['poi-labels'].filter(id => this.map.getLayer(id));
    if (poiLayers.length) {
      const hitRadius = 28;
      const poi = this.map.queryRenderedFeatures([
        [pixel.x - hitRadius, pixel.y - hitRadius],
        [pixel.x + hitRadius, pixel.y + hitRadius]
      ], { layers: poiLayers }).find(candidate => candidate.properties && candidate.properties.name);
      if (poi) {
        const lngLat = this.map.unproject(pixel);
        const coordinates = poi.geometry && poi.geometry.type === 'Point' ? poi.geometry.coordinates : [lngLat.lng, lngLat.lat];
        poiResult = { id: poi.properties.id, name: poi.properties.name, lngLat: coordinates, poi: true };
      }
  }
    const layers = this.map.getStyle().layers.filter(layer => layer.type === 'fill-extrusion' && !layer.id.startsWith('active-landmark')).map(layer => layer.id);
    const feature = this.map.queryRenderedFeatures(pixel, layers.length ? { layers } : undefined)
      .find(candidate => candidate.layer && candidate.layer.type === 'fill-extrusion');
    if (!feature) return poiResult;
    const lngLat = this.map.unproject(pixel);
    const properties = feature.properties || {};
    const geometry = feature.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: feature.geometry }] }
      : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] } }] };
    // Generated IDs on our single GeoJSON source are unique. IDs from the
    // third-party vector basemap repeat between tiles; setting state on one of
    // those IDs recolors dozens of unrelated buildings across the viewport.
    const featureTarget = feature.id == null || feature.source !== 'osm-building-appearance' ? null : {
      source: feature.source,
      ...(feature.sourceLayer ? { sourceLayer: feature.sourceLayer } : {}),
      id: feature.id,
    };
    if (poiResult) return { ...poiResult, featureTarget };
    return { id: feature.id, name: properties.name || properties['name:en'] || '', height: Number(properties.height) || undefined, lngLat: [lngLat.lng, lngLat.lat], geojson: geometry, featureTarget };
  }

  setRoute(routePath, loader, visible) {
    if (!this.map || !loader || !this.map.getSource('navigation-route')) return;
    // Trees are thinned against the route whether or not its line is drawn.
    if (routePath && routePath.length > 1 && routePath !== this._treeRouteRef) {
      this._treeRouteRef = routePath;
      this._treeRoute = routePath.map(point => this.worldToLngLat(point.x, point.y, loader));
      this._refreshTreeData();
    }
    const visibility = visible ? 'visible' : 'none';
    for (const id of ['navigation-route-casing', 'navigation-route-line']) {
      if (this.map.getLayer(id) && this.map.getLayoutProperty(id, 'visibility') !== visibility) this.map.setLayoutProperty(id, 'visibility', visibility);
    }
    if (!visible || !routePath || routePath.length < 2 || this._routePathRef === routePath) return;
    this._routePathRef = routePath;
    const coordinates = routePath.map(point => this.worldToLngLat(point.x, point.y, loader));
    this.map.getSource('navigation-route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
  }

  /** Polylines for the named street through `segmentIndex`, its same-name
   *  fragments joined and parallel copies collapsed onto `seed`. */
  _namedStreetChains(track, name, segmentIndex, seed) {
    const ridden = track.segments[segmentIndex];
    const connected = name && ridden && ridden.name === name
      ? (track.getConnectedNamedSegments ? track.getConnectedNamedSegments(segmentIndex) : [ridden])
      : [];
    const collapse = window.CanalRecallStreets && window.CanalRecallStreets.collapseParallelFragments;
    const paths = collapse
      ? collapse(connected, seed || ridden)
      : connected.map(segment => segment.points).filter(points => points && points.length > 1);
    const stitch = window.CanalRecallStreets && window.CanalRecallStreets.stitchOverlayPaths;
    return stitch ? stitch(paths) : paths;
  }

  /** Paint the just-answered street's name on the road; null clears it. */
  setAnsweredStreetName(track, loader, stamp, rider = null) {
    const sourceId = window.CanalRecallStreets && window.CanalRecallStreets.ANSWERED_STREET_SOURCE_ID;
    if (!this.ready || !track || !loader || !sourceId || !this.map.getSource(sourceId)) return;
    const key = stamp ? `${stamp.name}:${stamp.segmentIndex}:${stamp.correct}` : '';
    if (key === this._answeredStreetKey) return;
    this._answeredStreetKey = key;
    // Placed once, at the answer: on the street ahead of the rider, who then
    // rides past them.
    const chains = stamp ? this._namedStreetChains(track, stamp.name, stamp.segmentIndex, null) : [];
    const ahead = window.CanalRecallStreets.pointsAheadOnChains;
    const points = stamp && rider && ahead ? ahead(chains, rider) : [];
    // Last in the style: the detailed-building renderer draws above the raised
    // POI layers and cut the name off behind the nearest facade.
    if (points.length && this.map.getLayer('answered-street-name')) this.map.moveLayer('answered-street-name');
    this.map.getSource(sourceId).setData({
      type: 'FeatureCollection',
      features: points.map(point => ({
        type: 'Feature',
        // Bearing of travel, clockwise from north (world y points south).
        properties: { name: stamp.name, correct: !!stamp.correct, bearing: Math.atan2(Math.cos(point.angle), -Math.sin(point.angle)) * 180 / Math.PI },
        geometry: { type: 'Point', coordinates: this.worldToLngLat(point.x, point.y, loader) },
      })),
    });
  }

  setStreetHighlights(track, loader, learnedNames, activeName, activeSegmentIndex, routePath = null) {
    if (!this.ready || !track || !loader || !this.map.getSource('active-street')) return;
    const activeKey = `${activeName || ''}:${activeSegmentIndex}`;
    if (activeKey !== this._activeStreetKey || routePath !== this._activeStreetRoute) {
      this._activeStreetKey = activeKey;
      this._activeStreetRoute = routePath;
      const ridden = track.segments[activeSegmentIndex];
      const connected = activeName && ridden && ridden.name === activeName
        ? (track.getConnectedNamedSegments ? track.getConnectedNamedSegments(activeSegmentIndex) : [ridden])
        : [];
      // With the route line on, draw the same-name way the route runs along
      // (seedNearestRoute), so the highlight lies on the line, not beside it.
      const nearestRoute = window.CanalRecallStreets && window.CanalRecallStreets.seedNearestRoute;
      const seed = nearestRoute ? nearestRoute(connected, ridden, routePath) : ridden;
      // A named waterway or street is stored as several OSM ways — Grimburgwal
      // is three, laid end to end — and drawing each as its own round-capped
      // line leaves a seam at every join, so one canal reads as several. Join
      // only the fragments whose endpoints actually meet: concatenating blindly
      // is what draws the giant diagonal chord across the map.
      // Parallel same-name ways (both carriageways, the named cycle track)
      // collapse to the ridden one first; see `collapseParallelFragments`.
      const collapse = window.CanalRecallStreets && window.CanalRecallStreets.collapseParallelFragments;
      const paths = collapse
        ? collapse(connected, seed)
        : connected.map(segment => segment.points).filter(points => points && points.length > 1);
      const stitch = window.CanalRecallStreets && window.CanalRecallStreets.stitchOverlayPaths;
      const chains = stitch ? stitch(paths) : paths;
      this.map.getSource('active-street').setData({
        type: 'FeatureCollection',
        features: chains.map(points => ({
          type: 'Feature',
          properties: { name: activeName || '' },
          geometry: {
            type: 'LineString',
            coordinates: points.map(point => this.worldToLngLat(point.x, point.y, loader)),
          },
        })),
      });
    }
  }

  worldToLngLat(worldX, worldY, loader) {
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
    return [
      loader._lastCenterLng + (worldX - loader._lastOffsetX) / (metersPerDegreeLng * PIXELS_PER_METER),
      loader._lastCenterLat - (worldY - loader._lastOffsetY) / (metersPerDegreeLat * PIXELS_PER_METER)
    ];
  }

  _captureBasePaint() {
    const properties = {
      background: ['background-color', 'background-opacity'],
      fill: ['fill-color', 'fill-outline-color', 'fill-opacity'],
      line: ['line-color', 'line-opacity'],
      'fill-extrusion': ['fill-extrusion-color', 'fill-extrusion-opacity'],
      circle: ['circle-color', 'circle-opacity']
    };
    for (const layer of this.map.getStyle().layers || []) {
      for (const property of properties[layer.type] || []) {
        const value = this.map.getPaintProperty(layer.id, property);
        if (value !== undefined) this._basePaint.set(`${layer.id}:${property}`, value);
      }
    }
  }

  _restoreBasePaint() {
    for (const [key, value] of this._basePaint) {
      const separator = key.lastIndexOf(':');
      try { this.map.setPaintProperty(key.slice(0, separator), key.slice(separator + 1), value); } catch (_) {}
    }
  }

  _ensureLandmarkLayers() {
    if (this.map.getSource('active-landmark')) return;
    this.map.addSource('active-landmark', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    this.map.addLayer({ id: 'active-landmark-line', type: 'line', source: 'active-landmark', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#FACC15', 'line-width': 6, 'line-opacity': 0.95 } });
    this.map.addLayer({ id: 'active-landmark-point', type: 'circle', source: 'active-landmark', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 16, 'circle-color': '#FACC15', 'circle-opacity': 0.72, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  }

  setActiveLandmark(landmark) {
    if (!this.map) return;
    this._activeLandmark = landmark || null;
    const source = this.map.getSource('active-landmark');
    if (!source) return;
    for (const previous of this._highlightedBuildings || []) {
      try { this.map.setFeatureState(previous, { highlighted: false }); } catch (_) {}
    }
    this._highlightedBuildings = [];
    this._highlightedBuilding = null;
    if (this._threeBuildings) this._threeBuildings.setHidden('answer', []);
    const detailed = !!(this._detailedBuildingsVisible && this._detailedBuildings && this._detailedBuildings.ready);
    if (this._detailedBuildings) this._detailedBuildings.setActiveLandmark(detailed ? landmark : null);
    if (this._signatureLandmarks) this._signatureLandmarks.setActiveLandmark(detailed ? null : landmark);
    // The streamed building(s) a card is about, so its subject lights up on the
    // map rather than a dot the surrounding buildings hide (user report
    // 2026-09-28). `buildingIds` is resolved at extract time from OSM
    // `ref:bag` and Wikidata (`scripts/resolve-landmark-buildings.ts`); an
    // empty list means the landmark is a tree, statue or plaque and keeps its
    // dot. The distance guess is only for a city without that file — it lit a
    // shed beside the Bevrijdingslinde (user report 2026-09-29).
    let targets = landmark && landmark.featureTarget ? [landmark.featureTarget] : [];
    if (!targets.length && landmark && Array.isArray(landmark.buildingIds)) {
      targets = landmark.buildingIds.map(id => ({ source: 'osm-building-appearance', id }));
    } else if (!targets.length && landmark && Array.isArray(landmark.lngLat) && this._completeCityHasBuildings
      && this._completeCity && typeof this._completeCity.buildingForLandmark === 'function') {
      const id = this._completeCity.buildingForLandmark({ lng: landmark.lngLat[0], lat: landmark.lngLat[1] });
      if (id) targets = [{ source: 'osm-building-appearance', id }];
    }
    if (!detailed) {
      for (const target of targets) {
        try {
          this.map.setFeatureState(target, { highlighted: true });
          this._highlightedBuildings.push(target);
        } catch (_) {}
      }
      this._highlightedBuilding = this._highlightedBuildings[0] || null;
      if (this._threeBuildings) this._threeBuildings.setHidden('answer', this._highlightedBuildings.map(target => target.id));
    }
    // Never fabricate an extrusion from an OSM footprint. If no renderer can
    // identify the actual building, a point acknowledges the selection without
    // turning a whole block into a fixed-height yellow box.
    //
    // The point is drawn in detailed mode too. The 3D highlight raycasts
    // straight down at the landmark and finds nothing whenever the place is not
    // its own extruded building — a theatre inside a block, anything outside the
    // loaded tiles — and suppressing the dot there left a card naming a landmark
    // with nothing on the map pointing at it, which is the opposite of a
    // geography game. A dot beside a highlighted mesh or a lit signature model
    // is redundant (user report 2026-09-29, "both the yellow dot and the
    // yellow building").
    const modelLit = !detailed && !!(this._signatureLandmarks && this._signatureLandmarks.highlights
      && this._signatureLandmarks.highlights(landmark));
    const point = landmark && !this._highlightedBuilding && !modelLit && landmark.lngLat
      ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: landmark.lngLat } }]
      : [];
    source.setData({ type: 'FeatureCollection', features: point });
  }

  _styleLandmarks() {
    if (!this.map || !this.map.getLayer('building-3d')) return;
    this.applyTheme(this.theme);
  }

  _setBasemapOrientationPoisVisible(visible) {
    if (!this.map || !this.map.getStyle()) return;
    const pickLayers = window.CanalRecallOrientationPois
      && window.CanalRecallOrientationPois.basemapOrientationPoiLayerIds;
    if (!pickLayers) return;
    const ids = pickLayers(this.map.getStyle().layers || []);
    // Our own layer replaces the basemap's where it loaded; its dots stay up
    // through a quiz like the landmark dots, its names do not.
    const own = !!this._ownPoisActive;
    for (const id of ids) {
      try { this.map.setLayoutProperty(id, 'visibility', visible && !own ? 'visible' : 'none'); } catch (_) {}
    }
    const lib = window.CanalRecallOrientationPois;
    for (const band of (lib && lib.OWN_POI_BANDS) || []) {
      const { dots, labels } = lib.ownPoiLayerIds(band);
      try {
        if (this.map.getLayer(dots)) this.map.setLayoutProperty(dots, 'visibility', own ? 'visible' : 'none');
        if (this.map.getLayer(labels)) this.map.setLayoutProperty(labels, 'visibility', visible && own ? 'visible' : 'none');
      } catch (_) {}
    }
  }

  _hideLabels() {
    if (!this.map || !this.map.getStyle()) return;
    this._quietApplied = null;
    this._labelsVisible = false;
    for (const layer of this.map.getStyle().layers || []) {
      if (layer.type !== 'symbol') continue;
      try { this.map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (_) {}
    }
    // Liberty already carries ranked, icon-backed OSM places. Keep that sparse
    // orientation layer while hiding roads and waterways that can spoil recall.
    this._setBasemapOrientationPoisVisible(!this._quizQuietMap);
  }

  _showLabels() {
    if (!this.map || !this.map.getStyle()) return;
    this._quietApplied = null;
    this._labelsVisible = true;
    for (const layer of this.map.getStyle().layers || []) {
      if (layer.type !== 'symbol') continue;
      try { this.map.setLayoutProperty(layer.id, 'visibility', 'visible'); } catch (_) {}
    }
    // Showing every label must not bring the basemap's POIs back over ours.
    this._setBasemapOrientationPoisVisible(!this._quizQuietMap);
  }

  toggleLabels() {
    if (this._labelsVisible) this._hideLabels();
    else this._showLabels();
    return this._labelsVisible;
  }

  /**
   * During a place quiz, hide dense POI / neighbourhood names so the map does
   * not answer “where am I?”. Dots stay; the player’s D-toggle still owns the
   * resting state via `_labelsVisible`.
   */
  setQuizQuietMap(quiet) {
    // Called every frame. Re-applying serialised the whole style (getStyle)
    // three times a frame; only act when the answer actually changes.
    const key = `${!!quiet}|${!!this._labelsVisible}`;
    if (key === this._quietApplied) return;
    if (!this.map || !this.map.getStyle()) return;
    this._quietApplied = key;
    this._quizQuietMap = !!quiet;
    this._setBasemapOrientationPoisVisible(!this._quizQuietMap);
    const ids = ['poi-labels', 'brand-poi-labels', 'local-food-labels', 'neighborhood-labels'];
    for (const id of ids) {
      if (!this.map.getLayer(id)) continue;
      try {
        this.map.setLayoutProperty(id, 'visibility',
          this._quizQuietMap ? 'none' : (this._labelsVisible ? 'visible' : 'none'));
      } catch (_) {}
    }
  }

  // The map is simply the screen. It used to be centred with
  // `left = (innerWidth - width) / 2`, which letterboxed a tall desktop window
  // and fed a phone loop: a stale width left the container hanging off the
  // right edge, the document grew, the browser shrank the page to fit,
  // `innerWidth` grew with it, and the next resize made the container wider
  // still. Pinning it to the viewport breaks both.
  resizeToViewport(_viewport) {
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.left = '0px';
    this.container.style.top = '0px';
    if (this.map) this.map.resize();
  }

  resize(width, height) {
    if (!this.container) return;
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;
    this.container.style.left = `${(window.innerWidth - width) / 2}px`;
    this.container.style.top = `${(window.innerHeight - height) / 2}px`;
    if (this.map) this.map.resize();
  }

  sync(camera, loader, canvas) {
    if (!this.ready || !camera || !loader || !canvas || loader._lastCenterLat == null) return;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
    const lon = loader._lastCenterLng + (camera.x - loader._lastOffsetX) / (metersPerDegreeLng * PIXELS_PER_METER);
    const lat = loader._lastCenterLat - (camera.y - loader._lastOffsetY) / (metersPerDegreeLat * PIXELS_PER_METER);
    const displayScale = canvas.getBoundingClientRect().width / CANVAS_W;
    const pixelsPerMeter = PIXELS_PER_METER * camera.zoom * displayScale;
    const zoom = Math.log2(Math.cos(lat * Math.PI / 180) * 156543.03392 * pixelsPerMeter);
    const viewMode = camera.viewMode || 'north';
    const bearing = camera.rotation * 180 / Math.PI;
    // Even the flat map gets a few degrees of tilt. It is not enough to make
    // the plan view hard to read, and it is enough for buildings to acquire
    // sides, which is what makes a top-down city look like a place rather than
    // a diagram. The canvas overlay then has to project through MapLibre so it
    // keeps sitting exactly on the basemap.
    // The start-of-ride flight opens flat and tilts down into the street as it
    // lands (`introOverview` 1 → 0), so the overview is a true plan view and
    // its framing matches the flat camera maths exactly.
    const introFlat = Math.max(0, Math.min(1, camera.introOverview || 0));
    const targetPitch = this.pitchForViewMode(viewMode) * (1 - introFlat);
    // Ease pitch when entering chase/cockpit so the load-to-race handoff is
    // not a hard snap, then apply the appearance branch's clearance guard.
    if (this._pitchSmoothed == null || camera.reducedMotion || introFlat > 0) this._pitchSmoothed = targetPitch;
    else {
      this._pitchSmoothed += (targetPitch - this._pitchSmoothed) * 0.12;
      if (Math.abs(targetPitch - this._pitchSmoothed) < 0.15) this._pitchSmoothed = targetPitch;
    }
    const pitch = this._pitchSmoothed;
    const mapZoom = zoom + this.zoomOffsetForViewMode(viewMode) * (1 - introFlat);
    const previousCheck = this._cameraClearanceCheck;
    const movedMetres = previousCheck ? Math.hypot(
      (lon - previousCheck.center[0]) * metersPerDegreeLng,
      (lat - previousCheck.center[1]) * metersPerDegreeLat,
    ) : Infinity;
    const bearingChange = previousCheck ? Math.abs(Math.atan2(
      Math.sin((bearing - previousCheck.bearing) * Math.PI / 180),
      Math.cos((bearing - previousCheck.bearing) * Math.PI / 180),
    ) * 180 / Math.PI) : Infinity;
    // The clearance guard keeps the *rider* in sight. A panned view is centred
    // on wherever the player dragged it, so there is no rider to protect, and
    // checking the sightline to an arbitrary point dropped the pitch toward
    // plan view on every drag frame and restored it when the drag stopped.
    const detached = !!camera.detached;
    // The start flight sweeps zoom every frame; clearance and tile planning
    // wait for it to land (see below).
    const needsClearanceCheck = pitch > 0 && !detached && introFlat === 0 && (!previousCheck || movedMetres > 8 || bearingChange > 8
      || Math.abs(mapZoom - previousCheck.zoom) > 0.05 || performance.now() - previousCheck.at > 1000);
    // The sightline protects the rider, not the view centre: chase and
    // cockpit lead the camera ahead of the vehicle, and aiming at that lead
    // point swung it behind buildings on every turn or reverse, cutting the
    // pitch toward plan view (user report 2026-09-28).
    const subject = Number.isFinite(camera.targetX) && Number.isFinite(camera.targetY)
      ? [
        loader._lastCenterLng + (camera.targetX - loader._lastOffsetX) / (metersPerDegreeLng * PIXELS_PER_METER),
        loader._lastCenterLat - (camera.targetY - loader._lastOffsetY) / (metersPerDegreeLat * PIXELS_PER_METER),
      ]
      : [lon, lat];
    if (needsClearanceCheck) {
      this._clearCameraFromBuildingFootprints([lon, lat], { zoom: mapZoom, bearing, pitch }, subject);
      this._cameraClearanceCheck = { center: [lon, lat], zoom: mapZoom, bearing, at: performance.now() };
    }
    // Ease toward the safe pitch rather than snapping to it: down over a few
    // frames (a building really is in the way), back up slowly, so a check
    // that flips between blocked and clear never reads as a jump.
    // The slow climb applies only to recovering from a building: when nothing
    // limits the view and the cap was already following the view mode's own
    // pitch, it keeps following, so a north-to-chase toggle tilts at the view
    // mode's pace instead of this one.
    const safePitch = detached || introFlat > 0 ? pitch : Math.min(pitch, this._lastCameraClearance.safePitch ?? pitch);
    const followingView = safePitch >= pitch && this._clearancePitch != null
      && this._clearancePitch >= (this._clearancePitchRequested ?? pitch) - 0.1;
    if (this._clearancePitch == null || detached || introFlat > 0 || camera.reducedMotion || followingView) this._clearancePitch = safePitch;
    else {
      const rate = safePitch < this._clearancePitch ? 0.25 : 0.05;
      this._clearancePitch += (safePitch - this._clearancePitch) * rate;
      if (Math.abs(safePitch - this._clearancePitch) < 0.1) this._clearancePitch = safePitch;
    }
    this._clearancePitchRequested = pitch;
    const appliedPitch = Math.min(pitch, this._clearancePitch);
    this.map.jumpTo({ center: [lon, lat], zoom: mapZoom, bearing, pitch: appliedPitch });
    this._syncFacadeZoom(mapZoom);
    this._liftPoiMarkers(appliedPitch, lat);
    this._lastCameraZoom = camera.zoom;
    // Building tiles follow the driving camera, not the style's Damrak default.
    // followCamera no-ops until the centre tile / zoom bucket changes.
    // Not during the start flight: every half-step of zoom re-planned and
    // re-flushed the building tiles, which is where the flight stuttered. The
    // first frame after landing plans once for the driving view.
    if (this._completeCity && typeof this._completeCity.setSuspended === 'function') {
      this._completeCity.setSuspended(introFlat > 0);
    }
    if (introFlat === 0 && this._completeCity && typeof this._completeCity.followCamera === 'function') {
      this._completeCity.followCamera();
    }
    this._updateGoogleTiles();
    // The start flight's overview is flat, but its pins must still go through
    // MapLibre's projection: the flat camera maths drew them at half the map's
    // scale on a retina desktop, so START sat mid-way along the route line and
    // jumped into place on landing (user report 2026-09-28).
    camera.projector = pitch > 0 || introFlat > 0
      ? (worldX, worldY) => this.projectWorld(worldX, worldY, loader, canvas)
      : null;
  }

  _pointInRing(point, ring) {
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const a = ring[index], b = ring[previous];
      if (!Array.isArray(a) || !Array.isArray(b)) continue;
      const crosses = (a[1] > point[1]) !== (b[1] > point[1]);
      if (crosses && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  _pointInBuildingGeometry(point, geometry) {
    const polygons = geometry && geometry.type === 'Polygon' ? [geometry.coordinates]
      : geometry && geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    return polygons.some(rings => Array.isArray(rings) && rings.length && this._pointInRing(point, rings[0])
      && !rings.slice(1).some(ring => this._pointInRing(point, ring)));
  }

  /** [west, south, east, north] of a footprint's outer rings, cached per
   *  feature object (resident features are reused until their tile drops). */
  _featureBox(feature) {
    if (!this._featureBoxes) this._featureBoxes = new WeakMap();
    let box = this._featureBoxes.get(feature);
    if (box !== undefined) return box;
    const geometry = feature && feature.geometry;
    const polygons = geometry && geometry.type === 'Polygon' ? [geometry.coordinates]
      : geometry && geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const rings of polygons) {
      const outer = Array.isArray(rings) && rings[0];
      if (!Array.isArray(outer)) continue;
      for (const vertex of outer) {
        if (!Array.isArray(vertex)) continue;
        if (vertex[0] < w) w = vertex[0];
        if (vertex[0] > e) e = vertex[0];
        if (vertex[1] < s) s = vertex[1];
        if (vertex[1] > n) n = vertex[1];
      }
    }
    box = Number.isFinite(w) ? [w, s, e, n] : null;
    this._featureBoxes.set(feature, box);
    return box;
  }

  _cameraBlockingFeature(point, altitude, residentFeatures) {
    if (!this._completeCity || typeof this._completeCity.sampleFeatures !== 'function') return null;
    const features = residentFeatures || this._completeCity.sampleFeatures(20_000);
    return features.find(feature => {
      const properties = feature.properties || {};
      const top = Number(properties.roofEavesHeightM ?? properties.height ?? 5);
      return Number.isFinite(top) && altitude < top + 0.75
        && this._pointInBuildingGeometry(point, feature.geometry);
    }) || null;
  }

  _cameraSightlineBlocker(from, center, cameraAltitude) {
    const metresPerDegreeLat = 111320;
    const metresPerDegreeLng = 111320 * Math.cos(center[1] * Math.PI / 180);
    const east = (center[0] - from[0]) * metresPerDegreeLng;
    const north = (center[1] - from[1]) * metresPerDegreeLat;
    const distance = Math.hypot(east, north);
    if (!distance) return null;
    const residentFeatures = this._completeCity && this._completeCity.sampleFeatures
      ? this._completeCity.sampleFeatures(20_000) : [];
    // Only footprints whose box touches the sightline's box can block it. The
    // walk below used to point-in-polygon every resident footprint (up to
    // 20 000) at every metre of the line, on every 8 m of travel — the largest
    // single cost in a phone frame profile, and most of the start flight's
    // stutter.
    const west = Math.min(from[0], center[0]), eastEdge = Math.max(from[0], center[0]);
    const south = Math.min(from[1], center[1]), northEdge = Math.max(from[1], center[1]);
    const candidates = [];
    for (const feature of residentFeatures) {
      const box = this._featureBox(feature);
      if (box && box[0] <= eastEdge && box[2] >= west && box[1] <= northEdge && box[3] >= south) candidates.push(feature);
    }
    if (!candidates.length) return null;
    // Ignore the final 2 m around the route centre: the player is on the road
    // and rounding differences at a kerb must not make the camera oscillate.
    for (let travelled = 1; travelled < distance - 2; travelled += 1) {
      const t = travelled / distance;
      const point = [from[0] + east * t / metresPerDegreeLng, from[1] + north * t / metresPerDegreeLat];
      const rayAltitude = cameraAltitude * (1 - t);
      const here = candidates.filter(feature => {
        const box = this._featureBox(feature);
        return point[0] >= box[0] && point[0] <= box[2] && point[1] >= box[1] && point[1] <= box[3];
      });
      if (!here.length) continue;
      const blocker = this._cameraBlockingFeature(point, rayAltitude, here);
      if (blocker) return blocker;
    }
    return null;
  }

  /**
   * MapLibre's pitched camera sits behind the route centre. On a narrow street
   * that physical camera can land inside a building even though the player is
   * correctly on the road, turning the opaque mass into a full-screen cutaway
   * (especially in a portrait viewport). Reduce pitch until the complete
   * camera-to-road sightline clears resident measured footprints. Keeping the
   * route centre fixed also keeps the canvas overlays registered.
   */
  _clearCameraFromBuildingFootprints(center, view, subject = center) {
    this._cameraClearanceRequest = { center: [...center], view: { ...view }, subject: [...subject] };
    // This MapLibre release predates Mapbox's public free-camera API. Its
    // transform exposes the same calculated camera location and altitude.
    const transform = this.map && this.map.transform;
    // Measure from the camera this request asks for, at full pitch. The map
    // still holds the previous frame's centre, bearing and (eased, possibly
    // lowered) pitch, which could read a building as clear and let the pitch
    // pump back up into it.
    if (this.map && typeof this.map.jumpTo === 'function') this.map.jumpTo({ ...view, center });
    const cameraLngLat = transform && transform.getCameraLngLat && transform.getCameraLngLat();
    const altitude = transform && transform.getCameraAltitude && transform.getCameraAltitude();
    if (!cameraLngLat || !Number.isFinite(altitude)) return;
    const before = [cameraLngLat.lng, cameraLngLat.lat];
    let finalCamera = before, finalAltitude = altitude;
    let blocker = this._cameraSightlineBlocker(finalCamera, subject, finalAltitude);
    let safePitch = view.pitch;
    // Lower pitch raises the physical camera and its sightline without moving
    // the route centre. The drop is capped at CLEARANCE_MAX_DROP below the
    // view's pitch: it used to fall to a 17° floor, which read as the chase
    // view randomly switching to overhead (user report 2026-09-28). The bike's
    // x-ray silhouette keeps the rider visible behind a building the capped
    // drop cannot clear.
    const floor = Math.max(17, view.pitch - CLEARANCE_MAX_DROP);
    while (blocker && safePitch > floor) {
      safePitch = Math.max(floor, safePitch - 4);
      this.map.jumpTo({ ...view, center, pitch: safePitch });
      const nextCamera = transform.getCameraLngLat();
      finalCamera = [nextCamera.lng, nextCamera.lat];
      finalAltitude = transform.getCameraAltitude();
      blocker = this._cameraSightlineBlocker(finalCamera, subject, finalAltitude);
    }
    this._lastCameraClearance = {
      constrained: safePitch !== view.pitch,
      requestedPitch: view.pitch,
      safePitch,
      cameraBefore: before,
      cameraAfter: finalCamera,
      altitudeBefore: altitude,
      altitudeAfter: finalAltitude,
      center,
      clear: !blocker,
      blockingBuildingId: blocker && blocker.properties && blocker.properties.id || null,
    };
  }

  appearanceRenderStatus() {
    const groups = {
      roofs: this._studyRoofAreas,
      facades: this._studyFacadeAreas,
      trees: this._studyTreeAreas,
      publicRealm: this._studyPublicRealmAreas,
    };
    const layers = Object.values(groups).flat();
    const city = this._completeCity && this._completeCity.status ? this._completeCity.status() : null;
    const pending = (city ? city.inFlight + city.queued : 0) + layers.reduce(
      (sum, layer) => sum + (layer.inFlight || 0) + (layer.queue ? layer.queue.length : 0), 0,
    );
    const detailBytes = layers.reduce((sum, layer) => sum + (layer.debugGeometryBytes || 0), 0);
    const residents = Object.fromEntries(Object.entries(groups).map(([name, entries]) => [
      name, entries.reduce((sum, layer) => sum + (layer.debugResident || 0), 0),
    ]));
    const painted = layers.every(layer => !layer.debugRenderable || (layer.debugResident > 0 && layer.debugPaints > 0));
    const mapReady = Boolean(this.map && this.map.loaded && this.map.loaded() && (!this.map.isMoving || !this.map.isMoving()));
    return {
      ready: Boolean(city && city.features > 0 && pending === 0 && painted && mapReady && detailBytes <= 11_000_000),
      mapReady, pending, painted, detailBytes, residents,
      withinBudget: detailBytes <= 11_000_000,
      cameraClearance: this._lastCameraClearance,
    };
  }

  whenAppearanceRenderReady(timeoutMs = 30_000) {
    const layers = [this._studyRoofAreas, this._studyFacadeAreas, this._studyTreeAreas, this._studyPublicRealmAreas].flat();
    const baseline = new Map(layers.map(layer => [layer, layer.debugPaints || 0]));
    return new Promise((resolve, reject) => {
      // Game updates dirty the style before MapLibre paints. Sampling in an
      // independent RAF can therefore miss every ready frame indefinitely.
      // Keep the same readiness gates, evaluated after the actual map render.
      const cleanup = () => {
        clearTimeout(timer);
        this.map.off('render', check);
      };
      const check = () => {
        const status = this.appearanceRenderStatus();
        const paintedAfterCall = layers.every(layer => !layer.debugRenderable || (layer.debugPaints || 0) > (baseline.get(layer) || 0));
        if (status.ready && paintedAfterCall) {
          cleanup();
          resolve(status);
          return;
        }
        this.map.triggerRepaint();
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Appearance render readiness timed out: ${JSON.stringify(this.appearanceRenderStatus())}`));
      }, timeoutMs);
      this.map.on('render', check);
      this.map.triggerRepaint();
    });
  }
  /**
   * Jump the basemap to a world point and start loading building tiles there.
   * Call during loading once the route start is known — otherwise the map sits
   * on Damrak until the first racing frame, and the spawn neighbourhood only
   * begins downloading after the player can already see the hitch.
   *
   * Safe to call before the tile streamer has probed: the aim is remembered
   * and applied again when `_ensureCompleteCity` finishes attach.
   */
  aimAtWorld(worldX, worldY, loader, options = {}) {
    this._pendingAim = { worldX, worldY, loader, options };
    this._applyPendingAim();
  }

  _applyPendingAim() {
    const pending = this._pendingAim;
    if (!pending || !this.ready || !this.map) return;
    const { worldX, worldY, loader, options } = pending;
    if (!loader || loader._lastCenterLat == null) return;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
    const lon = loader._lastCenterLng + (worldX - loader._lastOffsetX) / (metersPerDegreeLng * PIXELS_PER_METER);
    const lat = loader._lastCenterLat - (worldY - loader._lastOffsetY) / (metersPerDegreeLat * PIXELS_PER_METER);
    const zoom = Number.isFinite(options.zoom) ? options.zoom : (this.map.getZoom() || 17);
    const bearing = Number.isFinite(options.bearing) ? options.bearing : 0;
    const pitch = Number.isFinite(options.pitch) ? options.pitch : TOPDOWN_TILT_DEGREES;
    this.map.jumpTo({ center: [lon, lat], zoom, bearing, pitch });
    if (this._completeCity && typeof this._completeCity.followCamera === 'function') {
      this._completeCity.followCamera();
    }
  }

  projectWorld(worldX, worldY, loader, canvas) {
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
    const lon = loader._lastCenterLng + (worldX - loader._lastOffsetX) / (metersPerDegreeLng * PIXELS_PER_METER);
    const lat = loader._lastCenterLat - (worldY - loader._lastOffsetY) / (metersPerDegreeLat * PIXELS_PER_METER);
    const projected = this.map.project([lon, lat]);
    const rect = canvas.getBoundingClientRect();
    return { x: projected.x * CANVAS_W / rect.width, y: projected.y * CANVAS_H / rect.height };
  }

  isWater(worldX, worldY, loader) {
    if (!this.ready || !loader || loader._lastCenterLat == null) return false;
    try {
      const pixel = this.map.project(this.worldToLngLat(worldX, worldY, loader));
      return this.map.queryRenderedFeatures(pixel).some(feature => {
        const identity = `${feature.layer && feature.layer.id || ''} ${feature.sourceLayer || ''}`.toLowerCase();
        return feature.layer && feature.layer.type === 'fill' && /water|ocean|river|canal/.test(identity);
      });
    } catch (_) { return false; }
  }

  applyTheme(theme) {
    this.theme = theme || 'clean';
    document.body.classList.remove('theme-8bit', 'theme-16bit', 'theme-psx', 'theme-cyberpunk');
    if (this.theme !== 'clean') document.body.classList.add(`theme-${this.theme}`);
    if (!this.map || !this.map.getLayer('building-3d')) return;
    this._restoreBasePaint();
    if (window.CanalRecallBuildings && window.CanalRecallBuildings.buildingLight && this.map.setLight) {
      this.map.setLight(window.CanalRecallBuildings.buildingLight(this.theme));
    }
    const palettes = {
      '8bit': { ground: '#E8D878', land: '#88B058', water: '#2898D0', road: '#F8F0C8', outline: '#385078', building: '#B8A060', accent: '#F8D830' },
      '16bit': { ground: '#C9B8D9', land: '#74B57A', water: '#4878C8', road: '#EFE7D0', outline: '#463C70', building: '#A98A9E', accent: '#FFD35A' },
      psx: { ground: '#928C79', land: '#6D765B', water: '#526E83', road: '#B8AA91', outline: '#34333C', building: '#777169', accent: '#D5A84B' },
      cyberpunk: { ground: '#100A24', land: '#17143A', water: '#071B3E', road: '#452160', outline: '#00E5FF', building: '#281147', accent: '#FF2DAA' }
    };
    const palette = palettes[this.theme];
    try {
      if (palette) {
        for (const layer of this.map.getStyle().layers || []) {
          if (layer.id.startsWith('active-landmark') || layer.id.startsWith('active-street') || layer.id.startsWith('learned-street') || layer.id.startsWith('navigation-route') || layer.id.startsWith('transit-network') || layer.id.startsWith('osm-colored-building') || layer.id.startsWith('tree-') || layer.id.startsWith('poi-') || layer.id.startsWith('neighborhood-')) continue;
          const identity = `${layer.id} ${layer['source-layer'] || ''}`.toLowerCase();
          const isWater = /water|ocean|river|canal/.test(identity);
          const isRoad = /road|street|transportation|bridge|tunnel|path/.test(identity);
          const isBuilding = /building/.test(identity);
          const isLand = /park|landcover|landuse|grass|wood|vegetation/.test(identity);
          if (layer.type === 'background') this.map.setPaintProperty(layer.id, 'background-color', palette.ground);
          if (layer.type === 'fill') {
            this.map.setPaintProperty(layer.id, 'fill-color', isWater ? palette.water : isBuilding ? palette.building : isLand ? palette.land : palette.ground);
            this.map.setPaintProperty(layer.id, 'fill-outline-color', isWater || isBuilding ? palette.outline : palette.land);
          }
          if (layer.type === 'line') {
            this.map.setPaintProperty(layer.id, 'line-color', isWater ? palette.water : isRoad ? palette.road : palette.outline);
          }
        }
      }
      if (this._completeCity && this._completeCity.status().available) this._styleCompleteCity();
      const buildingColor = window.CanalRecallBuildings
        ? window.CanalRecallBuildings.buildingColorExpression(this.theme)
        : (palette ? palette.building : '#D8D3CA');
      this.map.setPaintProperty('building-3d', 'fill-extrusion-color', [
        'case', ['boolean', ['feature-state', 'highlighted'], false], '#FFD21F', buildingColor,
      ]);
      this.map.setPaintProperty('building-3d', 'fill-extrusion-height', [
        'case', ['boolean', ['feature-state', 'highlighted'], false], ['+', ['coalesce', ['get', 'render_height'], ['get', 'height'], 18], 12], ['coalesce', ['get', 'render_height'], ['get', 'height'], 5]
      ]);
      this.map.setPaintProperty('building-3d', 'fill-extrusion-opacity', window.CanalRecallBuildings
        ? window.CanalRecallBuildings.buildingOpacity(this.theme)
        : (this.theme === 'cyberpunk' ? 0.98 : 0.9));
      const treeColors = this.theme === 'cyberpunk' ? ['#6A167A', '#FF2DAA'] : this.theme === 'psx' ? ['#4A4335', '#646B45'] : ['#315D31', '#4F8A48'];
      const Trees = this._treesLib();
      if (Trees && this.map.getLayer('tree-crowns')) {
        this.map.setPaintProperty('tree-crowns', 'fill-extrusion-color', Trees.treeCrownColour(this.theme));
        this.map.setPaintProperty('tree-trunks', 'fill-extrusion-color', Trees.treePalette(this.theme).trunk);
      } else if (this.map.getLayer('tree-crowns')) {
        this.map.setPaintProperty('tree-crowns', 'circle-stroke-color', treeColors[0]);
        this.map.setPaintProperty('tree-crowns', 'circle-color', treeColors[1]);
      }
      this._applyFacadeState();
    } catch (_) {}
  }
}
