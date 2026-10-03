/* Mapped park grounds and furniture, below buildings and the existing tree inventory. */
(() => {
  const EMPTY = {type:'FeatureCollection',features:[]};
  class ParkLandscape {
    constructor(map, root, theme) {
      this.map = map;
      this.generation = 0;
      map.addSource('park-landscape', {type:'geojson',data:EMPTY,maxzoom:17,
        attribution:'Park landscape © OpenStreetMap contributors (ODbL)'});
      const before = map.getStyle().layers.find(l => l.type === 'fill-extrusion' || l.id.startsWith('tree-'))?.id;
      map.addLayer({id:'park-landscape-ground',type:'fill',source:'park-landscape',minzoom:13,
        filter:['in',['get','role'],['literal',['park','lawn','wood','scrub','garden','playground','water']]],
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
    async load(root) {
      const generation = ++this.generation;
      this.debugFeatures = 0;
      this.map.getSource('park-landscape').setData(EMPTY);
      // Other cities retain their own basemap vegetation.
      if (!root.endsWith('/amsterdam')) return;
      try {
        const response = await fetch(`${root}/park-landscape.geojson`);
        if (!response.ok) return;
        const data = await response.json();
        if (generation === this.generation) {
          this.map.getSource('park-landscape')?.setData(data);
          this.debugFeatures = data.features.length;
        }
      } catch (_) { /* Basemap remains available if the optional extract cannot load. */ }
    }
    setTheme(theme) {
      const p = theme === 'cyberpunk' ? ['#20243b','#283747','#16332e','#304438','#554547','#19364a','#63597a','#3c4658']
        : theme === 'psx' ? ['#899477','#91a17b','#657c61','#728265','#aa9479','#526e83','#b6ad94','#7a8069']
        : ['#a9bd89','#b5c991','#72956b','#8fa775','#c0ad89','#80b8c3','#e0d2b2','#94a67b'];
      this.map.setPaintProperty('park-landscape-ground','fill-color',['match',['get','role'],
        'park',p[0],'lawn',p[1],'wood',p[2],'scrub',p[3],'garden',p[3],'playground',p[4],'water',p[5],p[0]]);
      this.map.setPaintProperty('park-landscape-path','line-color',p[6]);
      this.map.setPaintProperty('park-landscape-path-edge','line-color',p[7]);
      this.map.setPaintProperty('park-landscape-benches','fill-extrusion-color',theme === 'cyberpunk' ? '#9e7499' : '#81684e');
    }
  }
  window.CanalRecallParks = {ParkLandscape};
})();
