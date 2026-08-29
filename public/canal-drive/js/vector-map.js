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
      this._ensureLandmarkLayers();
      this._styleLandmarks();
      this.ready = true;
    });
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
    this.map.addLayer({ id: 'active-landmark-fill', type: 'fill', source: 'active-landmark', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#FACC15', 'fill-opacity': 0.48, 'fill-outline-color': '#FFFFFF' } });
    this.map.addLayer({ id: 'active-landmark-line', type: 'line', source: 'active-landmark', filter: ['in', '$type', 'Polygon', 'LineString'], paint: { 'line-color': '#FACC15', 'line-width': 6, 'line-opacity': 0.95 } });
    this.map.addLayer({ id: 'active-landmark-point', type: 'circle', source: 'active-landmark', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 16, 'circle-color': '#FACC15', 'circle-opacity': 0.72, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
  }

  setActiveLandmark(landmark) {
    if (!this.map) return;
    const source = this.map.getSource('active-landmark');
    if (!source) return;
    source.setData(landmark && landmark.geojson ? landmark.geojson : { type: 'FeatureCollection', features: [] });
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
          if (layer.id.startsWith('active-landmark')) continue;
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
        'case', ['in', ['coalesce', ['get', 'name'], ''], ['literal', names]], palette ? palette.accent : '#F59E0B', palette ? palette.building : '#D8D3CA'
      ]);
      this.map.setPaintProperty('building-3d', 'fill-extrusion-opacity', this.theme === 'cyberpunk' ? 0.98 : 0.9);
    } catch (_) {}
  }
}
