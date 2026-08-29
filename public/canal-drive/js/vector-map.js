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
      this._ensureTreeLayers();
      this.setTrees(this._pendingTrees);
      this._ensureLandmarkLayers();
      this._styleLandmarks();
      this.ready = true;
    });
  }

  _ensureRouteLayer() {
    if (this.map.getSource('navigation-route')) return;
    this.map.addSource('navigation-route', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });
    const before = this.map.getLayer('building-3d') ? 'building-3d' : undefined;
    this.map.addLayer({ id: 'navigation-route-casing', type: 'line', source: 'navigation-route', layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': 'rgba(3,18,28,.75)', 'line-width': 10 } }, before);
    this.map.addLayer({ id: 'navigation-route-line', type: 'line', source: 'navigation-route', layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#38BDF8', 'line-width': 6, 'line-opacity': 0.9 } }, before);
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
      paint: { ...shared, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 1, 19, 4], 'circle-color': '#775438', 'circle-opacity': 0.9 }
    }, before);
    this.map.addLayer({
      id: 'tree-crowns', type: 'circle', source: 'amsterdam-trees', minzoom: 15,
      paint: { ...shared, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 2.4, 19, 11], 'circle-color': '#4F8A48', 'circle-stroke-color': '#315D31', 'circle-stroke-width': 1, 'circle-opacity': 0.86 }
    }, before);
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
    if (!this.map) return;
    for (const id of ['tree-trunks', 'tree-crowns']) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
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
    this.map.addLayer({ id: 'active-landmark-extrusion', type: 'fill-extrusion', source: 'active-landmark', filter: ['==', '$type', 'Polygon'], paint: { 'fill-extrusion-color': '#FFD21F', 'fill-extrusion-height': 38, 'fill-extrusion-base': 1, 'fill-extrusion-opacity': 0.92 } });
    this.map.addLayer({ id: 'active-landmark-fill', type: 'fill', source: 'active-landmark', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#FACC15', 'fill-opacity': 0.24, 'fill-outline-color': '#FFFFFF' } });
    this.map.addLayer({ id: 'active-landmark-line', type: 'line', source: 'active-landmark', filter: ['in', '$type', 'Polygon', 'LineString'], paint: { 'line-color': '#FACC15', 'line-width': 6, 'line-opacity': 0.95 } });
    this.map.addLayer({ id: 'active-landmark-point', type: 'circle', source: 'active-landmark', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 16, 'circle-color': '#FACC15', 'circle-opacity': 0.72, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  }

  setActiveLandmark(landmark) {
    if (!this.map) return;
    const source = this.map.getSource('active-landmark');
    if (!source) return;
    if (this._highlightedBuilding) {
      try { this.map.setFeatureState(this._highlightedBuilding, { highlighted: false }); } catch (_) {}
      this._highlightedBuilding = null;
    }
    let matchedBuilding = false;
    if (landmark && landmark.lngLat && this.ready) {
      const pixel = this.map.project(landmark.lngLat);
      const candidates = this.map.queryRenderedFeatures([[pixel.x - 28, pixel.y - 28], [pixel.x + 28, pixel.y + 28]], { layers: ['building-3d'] });
      const feature = candidates.find(candidate => candidate.id != null);
      if (feature) {
        this._highlightedBuilding = { source: feature.source, sourceLayer: feature.sourceLayer, id: feature.id };
        try { this.map.setFeatureState(this._highlightedBuilding, { highlighted: true }); matchedBuilding = true; } catch (_) {}
      }
    }
    // The extrusion is a geometry-changing fallback for tiles without stable
    // feature IDs; it also makes non-building monuments spatially explicit.
    source.setData(!matchedBuilding && landmark && landmark.geojson ? landmark.geojson : { type: 'FeatureCollection', features: [] });
  }

  _styleLandmarks() {
    if (!this.map || !this.map.getLayer('building-3d')) return;
    this.applyTheme(this.theme);
  }

  _hideLabels() {
    if (!this.map || !this.map.getStyle()) return;
    for (const layer of this.map.getStyle().layers || []) {
      if (layer.type !== 'symbol') continue;
      try { this.map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (_) {}
    }
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
    const bearing = camera.rotation * 180 / Math.PI;
    this.map.jumpTo({ center: [lon, lat], zoom: chase ? zoom + 0.35 : zoom, bearing, pitch: chase ? 58 : 0 });
    if (chase) {
      camera.projector = (worldX, worldY) => this.projectWorld(worldX, worldY, loader, canvas);
    } else {
      camera.projector = null;
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
    const palettes = {
      '8bit': { ground: '#E8D878', land: '#88B058', water: '#2898D0', road: '#F8F0C8', outline: '#385078', building: '#B8A060', accent: '#F8D830' },
      '16bit': { ground: '#C9B8D9', land: '#74B57A', water: '#4878C8', road: '#EFE7D0', outline: '#463C70', building: '#A98A9E', accent: '#FFD35A' },
      psx: { ground: '#928C79', land: '#6D765B', water: '#526E83', road: '#B8AA91', outline: '#34333C', building: '#777169', accent: '#D5A84B' },
      cyberpunk: { ground: '#100A24', land: '#17143A', water: '#071B3E', road: '#452160', outline: '#00E5FF', building: '#281147', accent: '#FF2DAA' }
    };
    const names = ['Rijksmuseum', 'Koninklijk Paleis Amsterdam', 'NEMO', 'Het Scheepvaartmuseum', 'Westerkerk', 'Museum Het Rembrandthuis', 'H’ART Museum'];
    const palette = palettes[this.theme];
    try {
      if (palette) {
        for (const layer of this.map.getStyle().layers || []) {
          if (layer.id.startsWith('active-landmark') || layer.id.startsWith('navigation-route') || layer.id.startsWith('tree-')) continue;
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
      this.map.setPaintProperty('building-3d', 'fill-extrusion-color', [
        'case',
        ['boolean', ['feature-state', 'highlighted'], false], '#FFE12B',
        ['in', ['coalesce', ['get', 'name'], ''], ['literal', names]], palette ? palette.accent : '#F59E0B',
        palette ? palette.building : '#D8D3CA'
      ]);
      this.map.setPaintProperty('building-3d', 'fill-extrusion-height', [
        'case', ['boolean', ['feature-state', 'highlighted'], false], ['+', ['coalesce', ['get', 'render_height'], ['get', 'height'], 18], 12], ['coalesce', ['get', 'render_height'], ['get', 'height'], 5]
      ]);
      this.map.setPaintProperty('building-3d', 'fill-extrusion-opacity', this.theme === 'cyberpunk' ? 0.98 : 0.9);
      const treeColors = this.theme === 'cyberpunk' ? ['#6A167A', '#FF2DAA'] : this.theme === 'psx' ? ['#4A4335', '#646B45'] : ['#315D31', '#4F8A48'];
      if (this.map.getLayer('tree-crowns')) {
        this.map.setPaintProperty('tree-crowns', 'circle-stroke-color', treeColors[0]);
        this.map.setPaintProperty('tree-crowns', 'circle-color', treeColors[1]);
      }
    } catch (_) {}
  }
}
