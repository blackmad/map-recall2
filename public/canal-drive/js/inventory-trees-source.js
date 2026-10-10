import {treeTypology} from '../da-costa-block/tree-typology.js';
import {allotmentCanopyTrees,scopeAllotmentCrown} from './allotment-canopy.js';
import {ViewResidency} from '../../../src/canalRecall/viewResidency.ts';
const {THREE} = window.CanalRecallThree;
const MIN_ZOOM = 15.5;
const BUDGET = 12;
// Include crowns whose trunks sit just beyond the viewport (max proxy radius <24m).
function crownBounds(map) {
  const bounds=map.getBounds(),lat=(bounds.getNorth()+bounds.getSouth())/2;
  const dy=24/111320,dx=dy/Math.max(.1,Math.cos(lat*Math.PI/180));
  return {west:bounds.getWest()-dx,east:bounds.getEast()+dx,south:bounds.getSouth()-dy,north:bounds.getNorth()+dy};
}

/** Stream real municipal tree positions; at most seven instanced draws for the visible canopy. */
export class InventoryTrees {
  constructor(map, maplibregl, onReady = () => {}, options = {}) {
    this.map=map; this.maplibregl=maplibregl; this.onReady=onReady;
    this.enabled=false; this.allotmentCanopyEnabled=true; this.ready=false; this.generation=0;
    this.tiles=new Map(); this.pending=new Map(); this.meshes=[]; this.theme='clean';
    // `moveend` fires every riding frame (jumpTo); rebuild instances only when
    // the view leaves the padded area last built, or the inputs change.
    this.residency=new ViewResidency(.25,60);
    // Keep GPU geometry and shaders warm while streamed instance buffers change.
    this.geometries=new Map();this.materials=new Map();
    // `?sharedFrame=1`: a root in the page's one three.js frame, lit by its rig.
    this.sharedFrame=options.sharedFrame||null;
    this.scene=this.sharedFrame?new THREE.Group():new THREE.Scene();
    if(!this.sharedFrame){
      this.scene.add(new THREE.HemisphereLight(0xffffff,0x526048,2.15));
      const sun=new THREE.DirectionalLight(0xfff0d5,1.7);sun.position.set(-2,-1,4);this.scene.add(sun);
    }
    this.origin=maplibregl.MercatorCoordinate.fromLngLat([4.9,52.37],0);
    this.scale=this.origin.meterInMercatorCoordinateUnits();
    this.transform=new THREE.Matrix4().makeTranslation(this.origin.x,this.origin.y,this.origin.z).scale(new THREE.Vector3(this.scale,-this.scale,this.scale));
    this.layer={id:'municipal-inventory-trees',type:'custom',renderingMode:'3d',
      onAdd:(_map,gl)=>{this.camera=new THREE.Camera();this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});this.renderer.autoClear=false;},
      onRemove:()=>{
        this.generation++;this.enabled=false;this.ready=false;
        this.clear();map.off('moveend',this.move);
        for(const geometry of this.geometries.values())geometry.dispose();
        for(const material of this.materials.values())material.dispose();
        this.geometries.clear();this.materials.clear();this.renderer?.dispose();
      },
      render:(_gl,args)=>{
        if (!this.enabled || !this.ready || map.getZoom()<MIN_ZOOM || !this.meshes.length) return;
        const transform=new THREE.Matrix4().makeTranslation(this.origin.x,this.origin.y,this.origin.z).scale(new THREE.Vector3(this.scale,-this.scale,this.scale));
        this.camera.projectionMatrix.fromArray(args.defaultProjectionData?.mainMatrix || args).multiply(transform);
        this.renderer.resetState();this.renderer.render(this.scene,this.camera);
      }};
    if(this.sharedFrame)this.sharedFrame.register('trees',{
      root:this.scene,
      mercatorFromLocal:()=>this.transform.elements,
      beforeRender:()=>this.enabled&&this.ready&&map.getZoom()>=MIN_ZOOM&&this.meshes.length>0,
    },{order:options.sharedOrder??30});
    else map.addLayer(this.layer);
    this.move=()=>this.update();map.on('moveend',this.move);
  }
  async load(root) {
    const generation=++this.generation;
    this.clear();this.ready=false;this.index=null;this.onReady(false);
    if (!root.endsWith('/amsterdam')) return;
    this.root=new URL(`${root}/municipal-trees/`,location.href);
    try {
      const response=await fetch(new URL('index.json',this.root));
      if (!response.ok) return;
      const index=await response.json();
      if (generation!==this.generation) return;
      if (index.version!==1 || index.zoom!==15 || !Array.isArray(index.tiles) || !index.sourceUrl?.startsWith('https://maps.amsterdam.nl/')) throw Error('Invalid municipal tree index');
      this.index=index;this.meta=new Map(index.tiles.map(t=>[t.key,t]));
      this.ready=true;this.onReady(true);this.update();
    } catch (error) {console.warn('Municipal trees unavailable; retaining OSM trees.',error);}
  }
  // Own ground (`?ownGround=1`): trees stand on the relief under the trunk.
  // `fn([lng, lat])` → metres, or undefined while that relief is not resident.
  setGroundBase(fn) {this.groundBase=fn||null;this.refreshGroundBases();}
  refreshGroundBases() {this.residency.invalidate();if(this.enabled&&this.ready&&this.meshes.length)this.rebuild();this.map.triggerRepaint();}
  setAllotmentCanopyEnabled(value) {this.allotmentCanopyEnabled=!!value;this.residency.invalidate();if(this.enabled&&this.ready)this.rebuild();this.map.triggerRepaint();}
  setEnabled(value) {this.enabled=!!value;if(this.enabled)this.update();else this.clear();this.map.triggerRepaint();}
  setTheme(value) {
    this.theme=value;
    for(const mesh of this.meshes) {
      mesh.material.color.set(value==='cyberpunk'?(mesh.userData.wood?'#a066bd':'#cf86ed'):'#ffffff');
    }
    this.map.triggerRepaint();
  }
  clear() {
    for (const c of this.pending.values()) c.abort();
    this.pending.clear();this.tiles.clear();this.queue=[];this.residency.invalidate();this.disposeMeshes();
  }
  disposeMeshes() {
    for(const m of this.meshes){this.scene.remove(m);m.dispose?.();}
    this.meshes=[];this.debugTrees=0;
  }
  // The start-of-ride flight holds the trees where it will land: its overview
  // is below MIN_ZOOM (nothing draws), and planning each frame of the flight
  // cleared the landing's trees, then rebuilt them as it touched down.
  setSuspended(value) {if(this.suspended===!!value)return;this.suspended=!!value;if(!this.suspended)this.update();}
  update() {
    if (!this.enabled || !this.ready || this.suspended) return;
    if (this.map.getZoom()<MIN_ZOOM) {this.clear();return;}
    const b=crownBounds(this.map),c=this.map.getCenter();
    const tile=(lng,lat)=>[Math.floor((lng+180)/360*32768),Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*32768)];
    const [x0,y1]=tile(b.west,b.south),[x1,y0]=tile(b.east,b.north),[cx,cy]=tile(c.lng,c.lat);
    const wanted=[];
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=`15/${x}/${y}`;if(this.meta.has(key))wanted.push({key,d:(x-cx)**2+(y-cy)**2});}
    wanted.sort((a,b)=>a.d-b.d);const keys=new Set(wanted.slice(0,BUDGET).map(t=>t.key));
    for(const key of this.tiles.keys())if(!keys.has(key)){this.tiles.delete(key);this.residency.invalidate();}
    for(const [key,c] of this.pending)if(!keys.has(key)){c.abort();this.pending.delete(key);}
    this.queue=[...keys].filter(k=>!this.tiles.has(k)&&!this.pending.has(k));
    if(this.residency.needsRebuild(b,this.buildKey()))this.rebuild();
    this.pump();
  }
  buildKey() {return `${this.map.getZoom()>=18}|${this.allotmentCanopyEnabled}`;}
  pump() {
    while(this.pending.size<2&&this.queue?.length){const key=this.queue.shift();void this.fetchTile(key);}
  }
  async fetchTile(key) {
    const controller=new AbortController(),generation=this.generation;this.pending.set(key,controller);
    try {
      const response=await fetch(new URL(this.meta.get(key).url,this.root),{signal:controller.signal});
      if(!response.ok)throw Error('Missing municipal tree tile');
      const bytes=new Uint8Array(await response.arrayBuffer());
      const text=bytes[0]===0x1f&&bytes[1]===0x8b ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(bytes);
      const data=JSON.parse(text);
      if(data.version!==1||data.key!==key||!Array.isArray(data.trees))throw Error('Invalid municipal tree tile');
      if(!controller.signal.aborted&&generation===this.generation){this.tiles.set(key,data.trees);this.residency.invalidate();this.rebuild();}
    } catch(error){if(error.name!=='AbortError')console.warn(`Tree tile ${key} unavailable`,error);}
    finally{if(this.pending.get(key)===controller)this.pending.delete(key);this.pump();}
  }
  rebuild() {
    this.disposeMeshes();
    const b=this.residency.built(crownBounds(this.map),this.buildKey()),groups=new Map();let trees=0,authoredTrees=0;
    const archetypes=new Set(), color=new THREE.Color();
    const append=(key,item)=>{if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);};
    for(const tile of [...this.tiles.values(),...(this.allotmentCanopyEnabled?[allotmentCanopyTrees]:[])])for(const tree of tile){
      if(!Number.isFinite(tree.lng)||!Number.isFinite(tree.lat)||tree.lng<b.west||tree.lng>b.east||tree.lat<b.south||tree.lat>b.north)continue;
      const point=this.maplibregl.MercatorCoordinate.fromLngLat([tree.lng,tree.lat],0);
      const x=(point.x-this.origin.x)/this.scale,south=(point.y-this.origin.y)/this.scale;
      const native=treeTypology({...tree,position:[x,south]});const t=this.allotmentCanopyEnabled?scopeAllotmentCrown(tree,native):native;if(!t)continue;
      trees++;if(tree.source==='allotment-prior')authoredTrees++;archetypes.add(t.archetype);
      // A few centimetres into the relief, so a trunk never shows a gap on a slope.
      const z0=this.groundBase?(this.groundBase([tree.lng,tree.lat])??0)-.05:0;
      append('wood',{p:[x,-south,z0+t.trunkHeight/2],s:[t.trunkWidth*2,t.trunkWidth*2,t.trunkHeight],color:t.bark});
      const co=Math.cos(t.rotation),si=Math.sin(t.rotation);
      for(const l of t.lobes){
        const dx=l.offset[0]*co-l.offset[2]*si,dz=l.offset[0]*si+l.offset[2]*co;
        color.set(t.foliage).multiplyScalar([1,1.10,.86][l.tone]);
        // The map-to-scene south-axis flip also reverses crown yaw.
        append(`${t.crownGeometry}-${l.tone}`,{p:[x+dx,-(south+dz),z0+l.offset[1]],s:[l.scale[0],l.scale[2],l.scale[1]],rotation:-(t.rotation+(l.rotation??0)),color:color.clone()});
        // A short fork connects each offset crown to the recorded trunk position.
        // All forks share the trunk draw call; no per-tree meshes or materials.
        if(t.crownGeometry==='faceted'&&t.archetype!=='fan-palm'&&Math.hypot(dx,dz)>.1){
          const from=new THREE.Vector3(x,-south,z0+t.trunkHeight*.72);
          const to=new THREE.Vector3(x+dx*.75,-(south+dz*.75),z0+l.offset[1]);
          const delta=to.clone().sub(from),length=delta.length();
          append('wood',{p:from.add(to).multiplyScalar(.5).toArray(),s:[t.trunkWidth,t.trunkWidth,length],q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.divideScalar(length)),color:t.bark});
        }
      }
    }
    const dummy=new THREE.Object3D();
    for(const [key,items] of groups){
      const wood=key==='wood',cone=key.startsWith('cone-');
      const geometryKey=wood?'wood':cone?'cone':this.map.getZoom()>=18?'faceted-detail':'faceted';
      if(!this.geometries.has(geometryKey))this.geometries.set(geometryKey,
        wood?new THREE.CylinderGeometry(.22,.28,1,7).rotateX(Math.PI/2)
          :cone?new THREE.ConeGeometry(1,2,8).rotateX(Math.PI/2)
          :new THREE.IcosahedronGeometry(1,this.map.getZoom()>=18?1:0));
      const materialKey=wood?'wood':'foliage';
      if(!this.materials.has(materialKey))this.materials.set(materialKey,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.93,flatShading:true}));
      const m=new THREE.InstancedMesh(this.geometries.get(geometryKey),this.materials.get(materialKey),items.length);
      m.userData.wood=wood;
      items.forEach((v,j)=>{
        dummy.position.set(...v.p);dummy.scale.set(...v.s);dummy.quaternion.identity();
        if(v.q)dummy.quaternion.copy(v.q);else if(v.rotation)dummy.rotation.z=v.rotation;
        dummy.updateMatrix();m.setMatrixAt(j,dummy.matrix);m.setColorAt(j,new THREE.Color(v.color));
      });
      m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;m.frustumCulled=false;
      if(this.sharedFrame){m.castShadow=true;m.receiveShadow=true;}
      this.scene.add(m);this.meshes.push(m);
    }
    this.debugTrees=trees;this.debugAuthoredTrees=authoredTrees;this.debugTiles=this.tiles.size;this.debugArchetypes=[...archetypes];this.debugDraws=this.meshes.length;this.setTheme(this.theme);
  }
}
