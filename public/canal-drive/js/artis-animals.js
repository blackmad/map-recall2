/* A quiet zoo easter egg. Assets load only when the camera approaches ARTIS. */
(() => {
  const {THREE, GLTFLoader, MeshoptDecoder} = window.CanalRecallThree;
  class ArtisAnimals {
    constructor(map, maplibregl, extractRoot, options = {}) {
      this.map = map;
      this.maplibregl = maplibregl;
      this.active = extractRoot.endsWith('/amsterdam');
      this.root = new URL('models/artis-animals/', location.href);
      // `?sharedFrame=1`: a root in the page's one three.js frame, lit by its rig.
      this.sharedFrame = options.sharedFrame || null;
      this.scene = this.sharedFrame ? new THREE.Group() : new THREE.Scene();
      if (!this.sharedFrame) {
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x657054, 2.1));
        const sun = new THREE.DirectionalLight(0xffefd9, 2);
        sun.position.set(-50, 80, 30); this.scene.add(sun);
      }
      this.origin = maplibregl.MercatorCoordinate.fromLngLat([4.915,52.366], .12);
      this.unit = this.origin.meterInMercatorCoordinateUnits();
      this.transform = new THREE.Matrix4().makeTranslation(this.origin.x,this.origin.y,this.origin.z)
        .scale(new THREE.Vector3(this.unit,-this.unit,this.unit))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
      this.entries = []; this.pending = new Map(); this.failures = new Map();
      this.loader = new GLTFLoader(); this.loader.setMeshoptDecoder(MeshoptDecoder);
      this.layer = {id:'artis-animals', type:'custom', renderingMode:'3d',
        onAdd:(_map,gl) => {
          this.camera = new THREE.Camera();
          this.renderer = new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl});
          this.renderer.autoClear = false;
        },
        render:(_gl,args) => {
          if (!this.nearby() || !this.entries.some(e=>e.group.visible)) return;
          const transform = new THREE.Matrix4().makeTranslation(this.origin.x,this.origin.y,this.origin.z)
            .scale(new THREE.Vector3(this.unit,-this.unit,this.unit))
            .multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
          this.camera.projectionMatrix.fromArray(args.defaultProjectionData?.mainMatrix || args).multiply(transform);
          this.renderer.resetState(); this.renderer.render(this.scene,this.camera);
        },
        onRemove:() => {
          this.removed = true; map.off('moveend',this.move);
          const geometries = new Set(), materials = new Set(), textures = new Set();
          this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material ? (Array.isArray(o.material)?o.material:[o.material]) : []){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
          for(const x of [...geometries,...materials,...textures])x.dispose();
          this.renderer?.dispose();
        }};
      this.move = () => this.update();
      if (this.sharedFrame) this.sharedFrame.register('artis', {
        root: this.scene,
        mercatorFromLocal: () => this.transform.elements,
        beforeRender: () => this.nearby() && this.entries.some(e=>e.group.visible),
      }, {order: options.sharedOrder ?? 10});
      else map.addLayer(this.layer);
      map.on('moveend',this.move); this.update();
    }
    setExtractRoot(root) {this.active=root.endsWith('/amsterdam');this.update();}
    nearby() {
      if (!this.active || this.removed || this.map.getZoom()<16) return false;
      const b=this.map.getBounds();
      return b.getWest()<4.920 && b.getEast()>4.910 && b.getSouth()<52.369 && b.getNorth()>52.362;
    }
    async update() {
      const nearby=this.nearby();
      for(const e of this.entries)e.group.visible=nearby && this.map.getBounds().contains(e.spec.anchor);
      if(!nearby)return;
      if(!this.index) {
        if(this.indexPending || Date.now()<(this.indexRetryAt||0))return;
        this.indexPending=true;
        try {
          const r=await fetch(new URL('index.json',this.root));if(!r.ok)throw Error(`HTTP ${r.status}`);
          const index=await r.json();if(index.version!==1 || !Array.isArray(index.animals))throw Error('Invalid zoo manifest');
          this.index=index;
        } catch(e) {this.indexRetryAt=Date.now()+30000;console.warn('ARTIS animals unavailable',e);}
        finally {this.indexPending=false;}
        if(!this.index || !this.nearby())return;
      }
      const bounds=this.map.getBounds();
      for(const spec of this.index.animals) {
        if(!bounds.contains(spec.anchor) || this.entries.some(e=>e.spec.id===spec.id) || this.pending.has(spec.id) || Date.now()<(this.failures.get(spec.id)||0))continue;
        const url=new URL(spec.file,this.root);url.searchParams.set('asset',spec.version);
        const promise=this.loader.loadAsync(url.href).then(gltf=>{
          if(this.removed){gltf.scene.traverse(o=>{o.geometry?.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]) {for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});return;}
          const model=gltf.scene, box=new THREE.Box3().setFromObject(model), size=box.getSize(new THREE.Vector3());
          if(!Number.isFinite(size.y) || size.y<=0)throw Error('Empty zoo model');
          const scale=spec.heightMetres/size.y, center=box.getCenter(new THREE.Vector3());
          model.scale.multiplyScalar(scale);model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
          const group=new THREE.Group();group.add(model);group.rotation.y=spec.headingDegrees*Math.PI/180;
          const coord=this.maplibregl.MercatorCoordinate.fromLngLat(spec.anchor,0);
          group.position.set((coord.x-this.origin.x)/this.unit+spec.offsetMetres[0],0,(coord.y-this.origin.y)/this.unit+spec.offsetMetres[1]);
          group.visible=this.nearby() && this.map.getBounds().contains(spec.anchor);
          if(this.sharedFrame)this.sharedFrame.constructor.setShadows(group,true,true);
          this.scene.add(group);this.entries.push({spec,group});this.failures.delete(spec.id);this.map.triggerRepaint();
        }).catch(e=>{this.failures.set(spec.id,Date.now()+30000);console.warn(`ARTIS ${spec.name} unavailable`,e);})
          .finally(()=>this.pending.delete(spec.id));
        this.pending.set(spec.id,promise);
      }
      this.map.triggerRepaint();
    }
  }
  window.CanalRecallArtisAnimals={ArtisAnimals};
})();
