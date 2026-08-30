// ============================================================
// VECTOR BASEMAP — MapLibre + OpenFreeMap, synchronized to Smokey's camera
// ============================================================
class VectorBasemap {
  constructor(container) {
    this.container = container;
    this.map = null;
    this.ready = false;
    this.theme = 'clean';
    this._basePaint = new Map();
    this._highlightedBuilding = null;
    this._pendingTrees = [];
    this._pendingPlaces = { landmarks: [], boundaries: [] };
    this._treesVisible = false;
    this._detailedBuildings = null;
    this._detailedBuildingsVisible = false;
    this._activeLandmark = null;
    this._playerBike = null;
    this._playerBoat = null;
    this._labelsVisible = false;
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
      this._ensureTreeLayers();
      this._ensureBuildingAppearanceLayers();
      this._ensurePlaceLayers();
      this.setPlaces(this._pendingPlaces.landmarks, this._pendingPlaces.boundaries);
      this.setTrees(this._pendingTrees);
      this._ensureLandmarkLayers();
      this._styleLandmarks();
      if (window.CanalRecallDetailed3D && window.CanalRecallDetailed3D.DetailedBuildings) {
        this._detailedBuildings = new window.CanalRecallDetailed3D.DetailedBuildings(this.map, maplibregl, () => {
          this._syncDetailedBuildingLayers();
          this.setActiveLandmark(this._activeLandmark);
        });
        this._detailedBuildings.setEnabled(this._detailedBuildingsVisible);
      }
      if (window.CanalRecallVehicles) {
        const { PlayerBike3D, PlayerBoat3D } = window.CanalRecallVehicles;
        if (PlayerBike3D) this._playerBike = new PlayerBike3D(this.map, maplibregl);
        if (PlayerBoat3D) this._playerBoat = new PlayerBoat3D(this.map, maplibregl);
      }
      this.ready = true;
      // Theme setup can run before the asynchronous style load. Reapply it
      // now so OSM building colours replace Liberty's uniform gray default.
      this.applyTheme(this.theme);
    });
  }

  _ensureRouteLayer() {
    if (this.map.getSource('navigation-route')) return;
    this.map.addSource('navigation-route', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    this.map.addLayer({ id: 'navigation-route-casing', type: 'line', source: 'navigation-route', layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': 'rgba(3,18,28,.75)', 'line-width': 10 } }, before);
    this.map.addLayer({ id: 'navigation-route-line', type: 'line', source: 'navigation-route', layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#38BDF8', 'line-width': 6, 'line-opacity': 0.9 } }, before);
  }

  _ensureStreetOverlayLayers() {
    if (this.map.getSource('active-street') || !window.CanalRecallStreets) return;
    const empty = { type: 'FeatureCollection', features: [] };
    this.map.addSource('active-street', { type: 'geojson', data: empty });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    for (const layer of window.CanalRecallStreets.streetOverlayLayers()) {
      this.map.addLayer(layer, layer.type === 'symbol' ? undefined : before);
    }
  }

  _ensureTreeLayers() {
    if (this.map.getSource('amsterdam-trees')) return;
    this.map.addSource('amsterdam-trees', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      attribution: 'Trees © OpenStreetMap contributors'
    });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
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
    this.map.addSource('osm-building-appearance', {
      type: 'geojson', data: '../data/extracts/amsterdam/buildings-colored.geojson',
      attribution: 'Building appearance © OpenStreetMap contributors'
    });
    this.map.addLayer({
      id: 'osm-colored-buildings', type: 'fill-extrusion', source: 'osm-building-appearance', minzoom: 14,
      paint: {
        'fill-extrusion-color': ['get', 'colour'],
        'fill-extrusion-base': ['get', 'minHeight'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-opacity': 0.96
      }
    });
    this.map.addLayer({
      id: 'osm-colored-building-roofs', type: 'fill-extrusion', source: 'osm-building-appearance', minzoom: 14,
      paint: {
        'fill-extrusion-color': ['get', 'roofColour'],
        'fill-extrusion-base': ['get', 'height'],
        'fill-extrusion-height': ['+', ['get', 'height'], 0.35],
        'fill-extrusion-opacity': 1
      }
    });
  }

  _ensurePlaceLayers() {
    if (this.map.getSource('amsterdam-pois')) return;
    this.map.addSource('amsterdam-neighborhoods', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    this.map.addSource('amsterdam-neighborhood-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    this.map.addSource('amsterdam-pois', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    this.map.addLayer({ id: 'neighborhood-boundaries', type: 'line', source: 'amsterdam-neighborhoods', minzoom: 13, paint: { 'line-color': '#8B5CF6', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 2.5], 'line-opacity': 0.48, 'line-dasharray': [3, 3] } }, before);
    this.map.addLayer({ id: 'poi-dots', type: 'circle', source: 'amsterdam-pois', minzoom: 14.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 14.5, 3, 18, 6], 'circle-color': '#FACC15', 'circle-stroke-color': '#071E2B', 'circle-stroke-width': 1.5, 'circle-opacity': 0.9 } });
    this.map.addLayer({ id: 'poi-labels', type: 'symbol', source: 'amsterdam-pois', minzoom: 16, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false }, paint: { 'text-color': '#FFF7CC', 'text-halo-color': '#071E2B', 'text-halo-width': 2 } });
    this.map.addLayer({ id: 'neighborhood-labels', type: 'symbol', source: 'amsterdam-neighborhood-labels', minzoom: 13, maxzoom: 18.5, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 17, 16], 'text-letter-spacing': 0.12, 'text-allow-overlap': false }, paint: { 'text-color': '#6D28D9', 'text-halo-color': 'rgba(255,255,255,.9)', 'text-halo-width': 2 } });
  }

  setPlaces(landmarks, boundaries) {
    this._pendingPlaces = { landmarks: landmarks || [], boundaries: boundaries || [] };
    if (!this.map || !this.map.getSource('amsterdam-pois')) return;
    const pois = this._pendingPlaces.landmarks.filter(item => item.center && (item.prominenceScore || 0) >= 220).map(item => ({ type: 'Feature', properties: { id: item.id, name: item.name }, geometry: { type: 'Point', coordinates: [item.center[1], item.center[0]] } }));
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
    source.setData({
      type: 'FeatureCollection',
      features: this._pendingTrees.map(tree => ({ type: 'Feature', properties: { id: tree.id, species: tree.species || '' }, geometry: { type: 'Point', coordinates: [tree.lng, tree.lat] } }))
    });
  }

  setTreesVisible(visible) {
    this._treesVisible = !!visible;
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

  _syncDetailedBuildingLayers() {
    if (!this.map) return;
    const detailed = !!(this._detailedBuildingsVisible && this._detailedBuildings && this._detailedBuildings.ready);
    for (const id of ['building-3d', 'osm-colored-buildings', 'osm-colored-building-roofs']) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', detailed ? 'none' : 'visible');
    }
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

  isPlayerBikeReady() {
    return !!(this._playerBike && this._playerBike.ready);
  }

  isPlayerBoatReady() {
    return !!(this._playerBoat && this._playerBoat.ready);
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
    const poiLayers = ['poi-labels', 'poi-dots'].filter(id => this.map.getLayer(id));
    if (poiLayers.length) {
      const hitRadius = 28;
      const poi = this.map.queryRenderedFeatures([
        [pixel.x - hitRadius, pixel.y - hitRadius],
        [pixel.x + hitRadius, pixel.y + hitRadius]
      ], { layers: poiLayers }).find(candidate => candidate.properties && candidate.properties.name);
      if (poi) {
        const lngLat = this.map.unproject(pixel);
        const coordinates = poi.geometry && poi.geometry.type === 'Point' ? poi.geometry.coordinates : [lngLat.lng, lngLat.lat];
        return { id: poi.properties.id, name: poi.properties.name, lngLat: coordinates, poi: true };
      }
    }
    const layers = this.map.getStyle().layers.filter(layer => layer.type === 'fill-extrusion' && !layer.id.startsWith('active-landmark')).map(layer => layer.id);
    const feature = this.map.queryRenderedFeatures(pixel, layers.length ? { layers } : undefined)
      .find(candidate => candidate.layer && candidate.layer.type === 'fill-extrusion');
    if (!feature) return null;
    const lngLat = this.map.unproject(pixel);
    const properties = feature.properties || {};
    const geometry = feature.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: feature.geometry }] }
      : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] } }] };
    return { id: feature.id, name: properties.name || properties['name:en'] || '', lngLat: [lngLat.lng, lngLat.lat], geojson: geometry };
  }

  setRoute(routePath, loader, visible) {
    if (!this.map || !loader || !this.map.getSource('navigation-route')) return;
    const visibility = visible ? 'visible' : 'none';
    for (const id of ['navigation-route-casing', 'navigation-route-line']) {
      if (this.map.getLayer(id) && this.map.getLayoutProperty(id, 'visibility') !== visibility) this.map.setLayoutProperty(id, 'visibility', visibility);
    }
    if (!visible || !routePath || routePath.length < 2 || this._routePathRef === routePath) return;
    this._routePathRef = routePath;
    const coordinates = routePath.map(point => this.worldToLngLat(point.x, point.y, loader));
    this.map.getSource('navigation-route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
  }

  setStreetHighlights(track, loader, learnedNames, activeName, activeSegmentIndex) {
    if (!this.ready || !track || !loader || !this.map.getSource('active-street')) return;
    const toFeature = segment => ({
      type: 'Feature',
      properties: { name: segment.name || '' },
      geometry: { type: 'LineString', coordinates: segment.points.map(point => this.worldToLngLat(point.x, point.y, loader)) }
    });
    const activeKey = `${activeName || ''}:${activeSegmentIndex}`;
    if (activeKey !== this._activeStreetKey) {
      this._activeStreetKey = activeKey;
      const seed = track.segments[activeSegmentIndex];
      const connected = activeName && seed && seed.name === activeName
        ? (track.getConnectedNamedSegments ? track.getConnectedNamedSegments(activeSegmentIndex) : [seed])
        : [];
      // Keep every OSM fragment as its own feature. Combining disconnected
      // paths into one LineString creates the giant diagonal chord artifact.
      this.map.getSource('active-street').setData({
        type: 'FeatureCollection', features: connected.filter(segment => segment.points.length > 1).map(toFeature)
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
    // Fully opaque and matched to the building's own height. A translucent
    // fixed-height box let the building's OSM colour bleed through and stopped
    // short of taller landmarks, so the highlight fought the building instead
    // of replacing it. The ground fill is gone: its outline traced the whole
    // footprint while the extrusion covered only part of it.
    this.map.addLayer({ id: 'active-landmark-extrusion', type: 'fill-extrusion', source: 'active-landmark', filter: ['==', '$type', 'Polygon'], paint: {
      'fill-extrusion-color': '#FFD21F',
      'fill-extrusion-height': ['coalesce', ['get', 'renderHeight'], 38],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 1,
    } });
    this.map.addLayer({ id: 'active-landmark-line', type: 'line', source: 'active-landmark', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#FACC15', 'line-width': 6, 'line-opacity': 0.95 } });
    this.map.addLayer({ id: 'active-landmark-point', type: 'circle', source: 'active-landmark', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 16, 'circle-color': '#FACC15', 'circle-opacity': 0.72, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  }

  setActiveLandmark(landmark) {
    if (!this.map) return;
    this._activeLandmark = landmark || null;
    const source = this.map.getSource('active-landmark');
    if (!source) return;
    if (this._highlightedBuilding) {
      try { this.map.setFeatureState(this._highlightedBuilding, { highlighted: false }); } catch (_) {}
      this._highlightedBuilding = null;
    }
    const detailed = !!(this._detailedBuildingsVisible && this._detailedBuildings && this._detailedBuildings.ready);
    if (this._detailedBuildings) this._detailedBuildings.setActiveLandmark(detailed ? landmark : null);
    // The detailed renderer highlights its own per-building mesh feature. Its
    // OSM footprint is deliberately not drawn on top: those geometries differ
    // around roof parts and produce the giant yellow slab and z-fighting.
    source.setData(!detailed && landmark && landmark.geojson
      ? landmark.geojson
      : { type: 'FeatureCollection', features: [] });
  }

  _styleLandmarks() {
    if (!this.map || !this.map.getLayer('building-3d')) return;
    this.applyTheme(this.theme);
  }

  _hideLabels() {
    if (!this.map || !this.map.getStyle()) return;
    this._labelsVisible = false;
    for (const layer of this.map.getStyle().layers || []) {
      if (layer.type !== 'symbol') continue;
      try { this.map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (_) {}
    }
  }

  _showLabels() {
    if (!this.map || !this.map.getStyle()) return;
    this._labelsVisible = true;
    for (const layer of this.map.getStyle().layers || []) {
      if (layer.type !== 'symbol') continue;
      try { this.map.setLayoutProperty(layer.id, 'visibility', 'visible'); } catch (_) {}
    }
  }

  toggleLabels() {
    if (this._labelsVisible) this._hideLabels();
    else this._showLabels();
    return this._labelsVisible;
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
    const chase = camera.viewMode === 'chase';
    const cockpit = camera.viewMode === 'cockpit';
    const bearing = camera.rotation * 180 / Math.PI;
    // Even the flat map gets a few degrees of tilt. It is not enough to make
    // the plan view hard to read, and it is enough for buildings to acquire
    // sides, which is what makes a top-down city look like a place rather than
    // a diagram. The canvas overlay then has to project through MapLibre so it
    // keeps sitting exactly on the basemap.
    const pitch = cockpit ? 72 : chase ? 58 : TOPDOWN_TILT_DEGREES;
    this.map.jumpTo({ center: [lon, lat], zoom: cockpit ? zoom + 0.9 : chase ? zoom + 0.35 : zoom, bearing, pitch });
    camera.projector = pitch > 0
      ? (worldX, worldY) => this.projectWorld(worldX, worldY, loader, canvas)
      : null;
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
          if (layer.id.startsWith('active-landmark') || layer.id.startsWith('active-street') || layer.id.startsWith('learned-street') || layer.id.startsWith('navigation-route') || layer.id.startsWith('osm-colored-building') || layer.id.startsWith('tree-') || layer.id.startsWith('poi-') || layer.id.startsWith('neighborhood-')) continue;
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
      const buildingColor = window.CanalRecallBuildings
        ? window.CanalRecallBuildings.buildingColorExpression(this.theme)
        : (palette ? palette.building : '#D8D3CA');
      this.map.setPaintProperty('building-3d', 'fill-extrusion-color', buildingColor);
      this.map.setPaintProperty('building-3d', 'fill-extrusion-height', [
        'case', ['boolean', ['feature-state', 'highlighted'], false], ['+', ['coalesce', ['get', 'render_height'], ['get', 'height'], 18], 12], ['coalesce', ['get', 'render_height'], ['get', 'height'], 5]
      ]);
      this.map.setPaintProperty('building-3d', 'fill-extrusion-opacity', window.CanalRecallBuildings
        ? window.CanalRecallBuildings.buildingOpacity(this.theme)
        : (this.theme === 'cyberpunk' ? 0.98 : 0.9));
      const treeColors = this.theme === 'cyberpunk' ? ['#6A167A', '#FF2DAA'] : this.theme === 'psx' ? ['#4A4335', '#646B45'] : ['#315D31', '#4F8A48'];
      if (this.map.getLayer('tree-crowns')) {
        this.map.setPaintProperty('tree-crowns', 'circle-stroke-color', treeColors[0]);
        this.map.setPaintProperty('tree-crowns', 'circle-color', treeColors[1]);
      }
    } catch (_) {}
  }
}
