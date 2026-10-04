/* Mapped park grounds and furniture, below buildings and the existing tree inventory. */
(() => {
  const EMPTY = {type:'FeatureCollection',features:[]};
  class ParkLandscape {
    constructor(map, root, theme) {
      this.map = map;
      this.generation = 0;
      this.enabled = true;
      this.cache = new Map();
      this.pending = new Map();
      this.base = EMPTY;
      this.active = '';
      this.moveHandler = () => this.updateViewport();
      this.visibilityHandler = () => {
        if (!map.getLayer('park-landscape-ground')) return;
        const visible = map.getLayoutProperty('park-landscape-ground','visibility') !== 'none';
        if (visible !== this.enabled) this.setEnabled(visible);
      };
      this.removeHandler = () => this.destroy();
      map.on('moveend',this.moveHandler);
      map.on('styledata',this.visibilityHandler);
      map.on('remove',this.removeHandler);
      map.addSource('park-landscape', {type:'geojson',data:EMPTY,maxzoom:17,
        attribution:'Park landscape © OpenStreetMap contributors (ODbL)'});
      const before = map.getStyle().layers.find(l => l.type === 'fill-extrusion' || l.id.startsWith('tree-'))?.id;
      map.addLayer({id:'park-landscape-ground',type:'fill',source:'park-landscape',minzoom:13,
        filter:['in',['get','role'],['literal',['park','lawn','wood','scrub','garden','playground','water','paved-area']]],
        paint:{'fill-opacity':1}},before);
      map.addLayer({id:'park-landscape-path-edge',type:'line',source:'park-landscape',minzoom:15,
        filter:['==',['get','role'],'path'],layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-width':['interpolate',['exponential',2],['zoom'],13,['*',['+', ['get','width'],.5],.17],22,['*',['+', ['get','width'],.5],88]]}},before);
      map.addLayer({id:'park-landscape-path',type:'line',source:'park-landscape',minzoom:15,
        filter:['==',['get','role'],'path'],layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-width':['interpolate',['exponential',2],['zoom'],13,['*',['get','width'],.17],22,['*',['get','width'],88]]}},before);
      map.addLayer({id:'park-landscape-benches',type:'fill-extrusion',source:'park-landscape',minzoom:17,
        filter:['==',['get','role'],'bench'],paint:{'fill-extrusion-base':['get','base'],
          'fill-extrusion-height':['get','height'],'fill-extrusion-opacity':1}},before);
      this.setTheme(theme);
      this.load(root);
    }
    cancel() {
      this.baseController?.abort();
      for (const request of this.pending.values()) request.controller.abort();
      this.pending.clear();
    }
    async load(root) {
      const generation = ++this.generation;
      this.cancel();
      this.root = root;
      this.cache.clear();
      this.base = EMPTY;
      this.active = '';
      this.publish([]);
      if (this.destroyed || !root.endsWith('/amsterdam')) return;
      const controller = this.baseController = new AbortController();
      try {
        const response = await fetch(`${root}/park-landscape.geojson`,{signal:controller.signal});
        if (!response.ok) return;
        const data = await response.json();
        if (generation !== this.generation || controller.signal.aborted || this.destroyed) return;
        this.base = data;
        this.publish([]);
        this.updateViewport();
      } catch (_) { /* The basemap remains available. */ }
    }
    publish(chunks) {
      const features = [...this.base.features,...chunks.flatMap(data=>data.features)];
      this.map.getSource('park-landscape')?.setData({type:'FeatureCollection',features});
      this.debugFeatures = features.length;
    }
    updateViewport() {
      if (this.destroyed) return;
      const b = this.map.getBounds(), zoom = this.map.getZoom();
      const wanted = this.enabled ? (this.base.optionalChunks || []).filter(c =>
        zoom >= c.minzoom && b.getWest() <= c.bounds[2] && b.getEast() >= c.bounds[0]
        && b.getSouth() <= c.bounds[3] && b.getNorth() >= c.bounds[1]).slice(0,1) : [];
      const ids = new Set(wanted.map(c=>c.id));
      for (const [id,request] of this.pending) if (!ids.has(id)) {
        request.controller.abort();
        this.pending.delete(id);
      }
      const ready = wanted.filter(c=>this.cache.has(c.id));
      const active = ready.map(c=>c.id).join(',');
      if (active !== this.active) {
        this.active = active;
        this.publish(ready.map(c=>this.cache.get(c.id)));
      }
      for (const c of wanted) {
        if (this.cache.has(c.id) || this.pending.has(c.id)) continue;
        const generation = this.generation, controller = new AbortController();
        const request = {controller};
        this.pending.set(c.id,request);
        fetch(`${this.root}/${c.url}`,{signal:controller.signal}).then(async response => {
          if (!response.ok) throw Error('Optional park chunk unavailable');
          const data = await response.json();
          if (this.destroyed || generation !== this.generation || controller.signal.aborted
              || this.pending.get(c.id) !== request) return;
          if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)
              || data.features.length !== c.features) throw Error('Invalid optional park chunk');
          this.cache.clear(); // One optional chunk retained at most.
          this.cache.set(c.id,data);
          this.pending.delete(c.id);
          this.updateViewport();
        }).catch(()=>{
          if (this.pending.get(c.id) === request) this.pending.delete(c.id);
        });
      }
    }
    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      for (const layer of this.map.getStyle().layers) if (layer.id.startsWith('park-landscape-'))
        this.map.setLayoutProperty(layer.id,'visibility',this.enabled?'visible':'none');
      this.updateViewport();
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      ++this.generation;
      this.cancel();
      this.cache.clear();
      this.base = EMPTY;
      this.active = '';
      this.debugFeatures = 0;
      this.map.off('moveend',this.moveHandler);
      this.map.off('styledata',this.visibilityHandler);
      this.map.off('remove',this.removeHandler);
    }
    setTheme(theme) {
      const p = theme === 'cyberpunk' ? ['#20243b','#283747','#16332e','#304438','#554547','#19364a','#63597a','#3c4658']
        : theme === 'psx' ? ['#899477','#91a17b','#657c61','#728265','#aa9479','#526e83','#b6ad94','#7a8069']
        : ['#a9bd89','#b5c991','#72956b','#8fa775','#c0ad89','#80b8c3','#e0d2b2','#94a67b'];
      this.map.setPaintProperty('park-landscape-ground','fill-color',['match',['get','role'],
        'park',p[0],'lawn',p[1],'wood',p[2],'scrub',p[3],'garden',p[3],'playground',p[4],'water',p[5],
        'paved-area',theme==='cyberpunk'?'#3b4054':theme==='psx'?'#aaa596':'#bcb8ab',p[0]]);
      this.map.setPaintProperty('park-landscape-path','line-color',p[6]);
      this.map.setPaintProperty('park-landscape-path-edge','line-color',p[7]);
      this.map.setPaintProperty('park-landscape-benches','fill-extrusion-color',theme === 'cyberpunk' ? '#9e7499' : '#81684e');
    }
  }
  window.CanalRecallParks = {ParkLandscape};
})();
