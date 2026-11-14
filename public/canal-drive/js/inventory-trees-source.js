import {treeTypology,setTreeShaper} from '../da-costa-block/tree-typology.js';
// `?treeShape=1` (lane T-shape #371): measured crown silhouettes with per-tree jitter; off, the typology is unchanged.
import {treeShaper} from '../../../src/canalRecall/trees/treeShape.ts';
setTreeShaper(treeShaper);
import {allotmentCanopyTrees,scopeAllotmentCrown} from './allotment-canopy.js';
import {ViewResidency} from '../../../src/canalRecall/viewResidency.ts';
import {foliageDisplayHex} from '../../../src/canalRecall/look/palette.ts';
import {calmFoliage,treeCalmFlag} from '../../../src/canalRecall/look/calmTones.ts';
// `?realLook=trees` (look/realLook.ts, default off): crowns in the sampled species colour with a per-tree spread, smooth-shaded.
import {realLookOn,realFoliageHex} from '../../../src/canalRecall/look/realLook.ts';
import {roseBushInstances,roseBushVertexColours} from '../../../src/canalRecall/roseBeds.ts';
import roseGardens from './rose-garden-data.js';
// The view comes from the WorldCamera (engine/worldCameraOf.ts, P5 B6), not the CameraMap shim (#129: ~220 calls/s).
import {worldCameraOf} from '../../../src/canalRecall/engine/worldCameraOf.ts';
import {InstanceCull,treeCullFlag} from '../../../src/canalRecall/rendererShared/instanceCull.ts';
import {trunkGeometry,treeCapsFlag} from '../../../src/canalRecall/rendererShared/trunkGeometry.ts';
import {RebuildCoalescer,extrasRebuildSync} from '../../../src/canalRecall/rendererShared/rebuildCoalescer.ts';
import {treeRebuildGap} from '../../../src/canalRecall/engine/arrivalPace.ts';
import {isAerialView} from '../../../src/canalRecall/rendererShared/aerialView.ts';
import {TreeInstanceCache,groupOf,treesIncrementalFlag} from '../../../src/canalRecall/rendererShared/treeInstances.ts';
import {TREE_FADE_MS,treeFadeFlag,fadeClock,diffGroup,leavingArrays,patchTreeFadeMaterial,fadeGeometry,releaseFadeGeometry} from '../../../src/canalRecall/rendererShared/treeFade.ts';
const {THREE} = window.CanalRecallThree;
const MIN_ZOOM = 15.5;
const BUDGET = 12;
// Rose bushes are ~0.7 m wide: draw them only once a bed reads as more than a speck.
const ROSE_MIN_ZOOM = 16.5;
// Include crowns whose trunks sit just beyond the viewport (max proxy radius <24m).
function crownBounds(camera) {
  const bounds=camera.bounds(),lat=(bounds.getNorth()+bounds.getSouth())/2;
  const dy=24/111320,dx=dy/Math.max(.1,Math.cos(lat*Math.PI/180));
  return {west:bounds.getWest()-dx,east:bounds.getEast()+dx,south:bounds.getSouth()-dy,north:bounds.getNorth()+dy};
}

// realLook trees: a crown's normals point out from its centre, so the 20/80-triangle icosahedron shades as a soft round
// crown instead of flat facets (same triangles, same draws).
function sphereNormals(geometry){const p=geometry.attributes.position,n=geometry.attributes.normal;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),l=Math.hypot(x,y,z)||1;n.setXYZ(i,x/l,y/l,z/l);}n.needsUpdate=true;return geometry;}
// One 20-triangle shrub; its upper faces take the instance (bed) bloom colour,
// the rest a foliage green, so a rose bush costs no extra flower geometry.
function roseBushGeometry() {
  const geometry=new THREE.IcosahedronGeometry(1,0);
  geometry.setAttribute('color',new THREE.BufferAttribute(roseBushVertexColours(geometry.attributes.position.array),3));
  return geometry;
}
function roseBushMaterial() {
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.85,flatShading:true,vertexColors:true});
  // color.r masks bloom faces, color.g shades foliage (linear #4a7a3a).
  material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',
    '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n vColor.rgb = mix(vec3(0.07,0.19,0.045)*color.g, instanceColor.rgb, color.r);\n#endif');};
  material.customProgramCacheKey=()=>'canal-rose-bush';
  return material;
}

/** Stream real municipal tree positions; at most seven instanced draws for the visible canopy. */
export class InventoryTrees {
  constructor(map, maplibregl, onReady = () => {}, options = {}) {
    this.map=map; this.camera=options.camera||worldCameraOf(map); this.maplibregl=maplibregl; this.onReady=onReady;
    this.enabled=false; this.allotmentCanopyEnabled=true; this.ready=false; this.generation=0;
    this.tiles=new Map(); this.pending=new Map(); this.meshes=[]; this.theme='clean';
    // `moveend` fires every riding frame (jumpTo); rebuild instances only when
    // the view leaves the padded area last built, or the inputs change.
    this.residency=new ViewResidency(.25,60);
    // Tile arrivals, the ground hook and relief re-bases share one rebuild, in its own task after a frame (lane E6
    // #219, rendererShared/rebuildCoalescer.ts; `?extrasRebuild=sync` rebuilds at once). rebuild() itself stays synchronous.
    // `?arrivalPace=trees` (lane R4-E #248): from the air at most one rebuild a second (engine/arrivalPace.ts).
    this.rebuilds=new RebuildCoalescer(()=>{if(this.enabled&&this.ready)this.rebuild();},undefined,extrasRebuildSync(),treeRebuildGap(this.camera));
    // Keep GPU geometry and shaders warm while streamed instance buffers change.
    this.geometries=new Map();this.materials=new Map();
    // `?treesIncremental=1` (lane R4-F #249, rendererShared/treeInstances.ts): from the air a rebuild assembles per-tile
    // compiled instance arrays instead of walking every tree (`=all`: everywhere); off, the rebuild below is unchanged.
    this.incremental=treesIncrementalFlag();this.groundRevision=0;
    if(this.incremental!=='off'){this.instanceCache=new TreeInstanceCache();this.treeEmit=(tree,push)=>{const shape=this.shapeOf(tree);if(!shape.t)return null;this.appendTree(shape,0,push);return {archetype:shape.t.archetype,authored:tree.source==='allotment-prior'};};}
    // A root in the page's one three.js frame, lit by its rig (no frame: headless checks build instances only).
    this.sharedFrame=options.sharedFrame||null;
    // `?treeCull=0`: every resident instance drawn and casting, as before. `?treeCull=twin` (diagnostic): the shadow
    // twins without the culling, to tell the two halves apart in a pixel A/B.
    this.cullOn=!!this.sharedFrame&&treeCullFlag();this.cullTwinOnly=new URLSearchParams(location.search).get('treeCull')==='twin';this.culls=[];this.clipFromLocal=new THREE.Matrix4();this.cullFrustum=new THREE.Frustum();
    this.scene=new THREE.Group();
    // `?treeFade` (lane P5 #332, rendererShared/treeFade.ts): trees a rebuild adds dissolve in, trees it drops dissolve
    // out on a leaving mesh; kept trees are untouched. Off (`=0`, or `?popFade=0`): the one-frame swap as before.
    this.fadeOn=!!this.sharedFrame&&treeFadeFlag();this.fadeNow={value:fadeClock()};this.leaving=[];this.fadeUntil=0;this.debugFade={rebuilds:0,entered:0,kept:0,left:0};
    this.origin=maplibregl.MercatorCoordinate.fromLngLat([4.9,52.37],0);
    this.scale=this.origin.meterInMercatorCoordinateUnits();
    this.transform=new THREE.Matrix4().makeTranslation(this.origin.x,this.origin.y,this.origin.z).scale(new THREE.Vector3(this.scale,-this.scale,this.scale));
    this._unregister=this.sharedFrame?.register('trees',{
      root:this.scene,
      mercatorFromLocal:()=>this.transform.elements,
      beforeRender:ctx=>{
        if(this.fadeOn)this.stepFades();
        const on=this.enabled&&this.ready&&ctx.zoom>=MIN_ZOOM&&(this.meshes.length>0||this.leaving.length>0);
        // Only the instances on screen are drawn (rendererShared/instanceCull.ts); the shadow twins keep every one.
        if(on&&this.culls.length&&!this.cullTwinOnly){this.clipFromLocal.multiplyMatrices(ctx.clipFromWorld,ctx.worldFromMercator).multiply(this.transform);for(const c of this.culls)c.update(this.clipFromLocal,this.cullFrustum);}
        return on;
      },
    },{order:options.sharedOrder??30});
    this.move=()=>this.update();map.on('moveend',this.move);
  }
  /** Leave the frame and free every geometry and material (what the legacy layer's onRemove did). */
  remove() {
    this._unregister?.();this._unregister=null;
    this.generation++;this.enabled=false;this.ready=false;
    this.clear();this.flushFades();this.map.off('moveend',this.move);
    for(const geometry of this.geometries.values())geometry.dispose();
    for(const material of this.materials.values())material.dispose();
    this.geometries.clear();this.materials.clear();
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
  refreshGroundBases() {this.groundRevision++;this.residency.invalidate();if(this.enabled&&this.ready&&(this.meshes.length||this.rebuilds.pending))this.rebuilds.request();this.map.triggerRepaint();}
  setAllotmentCanopyEnabled(value) {this.allotmentCanopyEnabled=!!value;this.residency.invalidate();if(this.enabled&&this.ready)this.rebuilds.request();this.map.triggerRepaint();}
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
    this.pending.clear();this.tiles.clear();this.queue=[];this.residency.invalidate();this.rebuilds.cancel();this.disposeMeshes();this.flushFades();
  }
  disposeMeshes() {
    for(const m of this.meshes){this.scene.remove(m);m.dispose?.();if(m.geometry?.userData?.treeFadeShared)releaseFadeGeometry(m.geometry);}
    for(const c of this.culls)if(c.shadow){this.scene.remove(c.shadow);c.shadow.dispose?.();}
    this.meshes=[];this.culls=[];this.debugTrees=0;
  }
  // The start-of-ride flight holds the trees where it will land: its overview
  // is below MIN_ZOOM (nothing draws), and planning each frame of the flight
  // cleared the landing's trees, then rebuilt them as it touched down.
  setSuspended(value) {if(this.suspended===!!value)return;this.suspended=!!value;if(!this.suspended)this.update();}
  update() {
    if (!this.enabled || !this.ready || this.suspended) return;
    if (this.camera.zoom()<MIN_ZOOM) {this.clear();return;}
    const b=crownBounds(this.camera),c=this.camera.center();
    const tile=(lng,lat)=>[Math.floor((lng+180)/360*32768),Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*32768)];
    const [x0,y1]=tile(b.west,b.south),[x1,y0]=tile(b.east,b.north),[cx,cy]=tile(c.lng,c.lat);
    const wanted=[];
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=`15/${x}/${y}`;if(this.meta.has(key))wanted.push({key,d:(x-cx)**2+(y-cy)**2});}
    wanted.sort((a,b)=>a.d-b.d);const keys=new Set(wanted.slice(0,BUDGET).map(t=>t.key));
    for(const key of this.tiles.keys())if(!keys.has(key)){this.tiles.delete(key);this.residency.invalidate();}
    for(const [key,c] of this.pending)if(!keys.has(key)){c.abort();this.pending.delete(key);}
    this.queue=[...keys].filter(k=>!this.tiles.has(k)&&!this.pending.has(k));
    if(this.residency.needsRebuild(b,this.buildKey()))this.rebuilds.request();
    this.pump();
  }
  buildKey() {const z=this.camera.zoom();return `${z>=18}|${z>=ROSE_MIN_ZOOM}|${this.allotmentCanopyEnabled}`;}
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
      if(!controller.signal.aborted&&generation===this.generation){this.tiles.set(key,data.trees);this.residency.invalidate();this.rebuilds.request();}
    } catch(error){if(error.name!=='AbortError')console.warn(`Tree tile ${key} unavailable`,error);}
    finally{if(this.pending.get(key)===controller)this.pending.delete(key);this.pump();}
  }
  // A tree's scene position, typology and lobe colours depend only on the record and the allotment-canopy switch
  // (treeTypology, scopeAllotmentCrown and foliageDisplayHex are pure): kept per record, so a rebuild for a ground
  // revision or a residency step does not redo them for every resident tree (#129 hand-back 17: the trees' rebuild
  // was the 33-74 ms moveend and ground-bases frames at 4x). The colours are copied into the instance buffer.
  shapeOf(tree) {
    const variant=this.allotmentCanopyEnabled?1:0;
    let shapes=this.shapes?.get(tree);
    if(!shapes){(this.shapes??=new WeakMap()).set(tree,shapes=[]);}
    if(shapes[variant])return shapes[variant];
    const point=this.maplibregl.MercatorCoordinate.fromLngLat([tree.lng,tree.lat],0);
    const x=(point.x-this.origin.x)/this.scale,south=(point.y-this.origin.y)/this.scale;
    const native=treeTypology({...tree,position:[x,south]});const t=variant?scopeAllotmentCrown(tree,native):native;
    const crownHex=t?(realLookOn('trees')?realFoliageHex(t.foliage,tree.id??`${tree.lng},${tree.lat}`):foliageDisplayHex(t.foliage)):null;
    const lobeColours=t?t.lobes.map(l=>new THREE.Color().set(treeCalmFlag()?calmFoliage(crownHex):crownHex).multiplyScalar([1,1.10,.86][l.tone])):null;
    return shapes[variant]={x,south,t,lobeColours,bark:t?new THREE.Color(t.bark):null};
  }
  rebuild() {
    if(this.incremental!=='off'&&(this.incremental==='all'||this.aerial()))return this.rebuildIncremental();
    this.beginFade();this.disposeMeshes();
    const b=this.residency.built(crownBounds(this.camera),this.buildKey()),groups=new Map();let trees=0,authoredTrees=0;
    const archetypes=new Set();
    const append=(key,item)=>{if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);};
    for(const tile of [...this.tiles.values(),...(this.allotmentCanopyEnabled?[allotmentCanopyTrees]:[])])for(const tree of tile){
      if(!Number.isFinite(tree.lng)||!Number.isFinite(tree.lat)||tree.lng<b.west||tree.lng>b.east||tree.lat<b.south||tree.lat>b.north)continue;
      const shape=this.shapeOf(tree),{t}=shape;if(!t)continue;
      trees++;if(tree.source==='allotment-prior')authoredTrees++;archetypes.add(t.archetype);
      // A few centimetres into the relief, so a trunk never shows a gap on a slope.
      const z0=this.groundBase?(this.groundBase([tree.lng,tree.lat])??0)-.05:0;
      this.appendTree(shape,z0,append);
    }
    // Mapped rose gardens: every visible bush in one instanced draw.
    let roses=0;
    if(this.camera.zoom()>=ROSE_MIN_ZOOM)for(const garden of roseGardens.gardens)for(const r of roseBushInstances(garden,b)){roses++;append('rose-bush',this.roseItem(r));}
    const dummy=new THREE.Object3D(),scratch=new THREE.Color();
    for(const [key,items] of groups)this.addMesh(key,items.length,m=>{
      items.forEach((v,j)=>{
        dummy.position.set(...v.p);dummy.scale.set(...v.s);dummy.quaternion.identity();
        if(v.q)dummy.quaternion.copy(v.q);else if(v.rotation)dummy.rotation.z=v.rotation;
        dummy.updateMatrix();m.setMatrixAt(j,dummy.matrix);m.setColorAt(j,v.color?.isColor?v.color:scratch.set(v.color));
      });
    });
    this.debugRoses=roses;this.debugRoseTriangles=roses*20;
    this.endFade();
    this.debugTrees=trees;this.debugAuthoredTrees=authoredTrees;this.debugTiles=this.tiles.size;this.debugArchetypes=[...archetypes];this.debugDraws=this.meshes.length;this.setTheme(this.theme);
  }
  aerial() {try{const c=this.camera.center();return isAerialView(this.camera.zoom(),this.camera.pitch(),c.lat);}catch(_){return false;}}
  // One tree's instances (trunk, crown lobes, forks) at ground lift z0, as the rebuild appends them.
  appendTree({x,south,t,lobeColours,bark},z0,append) {
    append('wood',{p:[x,-south,z0+t.trunkHeight/2],s:[t.trunkWidth*2,t.trunkWidth*2,t.trunkHeight],color:bark});
    const co=Math.cos(t.rotation),si=Math.sin(t.rotation);
    for(let li=0;li<t.lobes.length;li++){const l=t.lobes[li];
      const dx=l.offset[0]*co-l.offset[2]*si,dz=l.offset[0]*si+l.offset[2]*co;
      // The map-to-scene south-axis flip also reverses crown yaw.
      append(`${t.crownGeometry}-${l.tone}`,{p:[x+dx,-(south+dz),z0+l.offset[1]],s:[l.scale[0],l.scale[2],l.scale[1]],rotation:-(t.rotation+(l.rotation??0)),color:lobeColours[li]});
      // A short fork connects each offset crown to the recorded trunk position.
      // All forks share the trunk draw call; no per-tree meshes or materials.
      if(t.crownGeometry==='faceted'&&t.archetype!=='fan-palm'&&Math.hypot(dx,dz)>.1){
        const from=new THREE.Vector3(x,-south,z0+t.trunkHeight*.72);
        const to=new THREE.Vector3(x+dx*.75,-(south+dz*.75),z0+l.offset[1]);
        const delta=to.clone().sub(from),length=delta.length(),seg=[from.x,from.y,from.z,to.x,to.y,to.z];
        append('wood',{p:from.add(to).multiplyScalar(.5).toArray(),s:[t.trunkWidth,t.trunkWidth,length],q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.divideScalar(length)),color:bark,seg});
      }
    }
  }
  // One rose bush's instance (roseBeds.ts roseBushInstances record).
  roseItem(r) {
    const point=this.maplibregl.MercatorCoordinate.fromLngLat([r.lng,r.lat],0);
    const x=(point.x-this.origin.x)/this.scale,north=-(point.y-this.origin.y)/this.scale;
    const z0=this.groundBase?(this.groundBase([r.lng,r.lat])??0):0;
    // An icosahedron sunk a third into the bed reads as a rounded shrub.
    return {p:[x,north,z0+r.height*.3],s:[r.radius,r.radius*.92,r.height*.7],rotation:r.rotation,color:r.bloom};
  }
  // The incremental rebuild (`?treesIncremental=1`): the same meshes, from per-tile compiled arrays.
  rebuildIncremental() {
    this.beginFade();this.disposeMeshes();
    const b=this.residency.built(crownBounds(this.camera),this.buildKey());
    const sources=[...this.tiles.values(),...(this.allotmentCanopyEnabled?[allotmentCanopyTrees]:[])];
    const roseItems=[];
    if(this.camera.zoom()>=ROSE_MIN_ZOOM)for(const garden of roseGardens.gardens)for(const r of roseBushInstances(garden,b)){const v=this.roseItem(r);v.color=new THREE.Color().set(v.color);roseItems.push(v);}
    // The lift is cached per tree per ground revision; a new ground function is a new revision too.
    if(this.groundBase!==this.liftedBy){this.liftedBy=this.groundBase;this.groundRevision++;}
    const z0=this.groundBase?(lng,lat)=>(this.groundBase([lng,lat])??0)-.05:null;
    const a=this.instanceCache.assemble(sources,this.allotmentCanopyEnabled?'canopy':'native',this.treeEmit,b,z0,this.groundRevision,roseItems.length?[groupOf('rose-bush',roseItems)]:[]);
    for(const g of a.groups)this.addMesh(g.key,g.count,m=>{m.instanceMatrix.array.set(g.matrices);m.instanceColor=new THREE.InstancedBufferAttribute(g.colours,3);});
    this.assembleStats=a.stats;this.endFade();
    this.debugRoses=roseItems.length;this.debugRoseTriangles=roseItems.length*20;
    this.debugTrees=a.trees;this.debugAuthoredTrees=a.authoredTrees;this.debugTiles=this.tiles.size;this.debugArchetypes=a.archetypes;this.debugDraws=this.meshes.length;this.setTheme(this.theme);
  }
  // Lane P5 (#332): the previous build's full arrays per group, taken before its meshes go.
  beginFade() {
    if(!this.fadeOn){this.fadePrev=null;return;}
    const prev=new Map();
    for(const m of this.meshes){
      const c=this.culls.find(x=>x.mesh===m),full=c?.full();
      prev.set(m.userData.groupKey,{matrices:full?full.matrices:m.instanceMatrix.array,colours:full?full.colours:(m.instanceColor?.array??null),fades:full?(full.extras.treeFade??null):(m.geometry.attributes.treeFade?.array??null),count:full?full.matrices.length/16:m.count,geometryKey:m.userData.geometryKey,material:m.material,wood:m.userData.wood});
    }
    this.fadePrev=prev;this.fadeLeft=new Map();this.fadeT=fadeClock();this.fadeTally={entered:0,kept:0,left:0};
  }
  // Give `m` its own fade attribute: new trees enter now, kept ones keep any running fade-in.
  fadeMesh(m,key) {
    const prev=this.fadePrev.get(key)??null,d=diffGroup(prev,m.instanceMatrix.array,m.count,this.fadeT,TREE_FADE_MS);
    m.geometry=fadeGeometry(THREE,m.geometry,d.fades);
    this.fadeTally.entered+=d.entered;this.fadeTally.kept+=d.kept;
    if(prev)this.fadeLeft.set(key,d.leaving);
  }
  // Trees the new build dropped are drawn once more, dissolving out, then leave.
  endFade() {
    const prev=this.fadePrev;this.fadePrev=null;if(!prev)return;
    const now=this.fadeT;
    for(const [key,g] of prev){
      const leaving=this.fadeLeft.get(key)??[...Array(g.count).keys()].filter(i=>!(g.fades&&g.fades[i]<0));
      if(!leaving.length)continue;
      const a=leavingArrays(g,leaving,now),shared=this.geometries.get(g.geometryKey);if(!shared)continue;
      const m=new THREE.InstancedMesh(fadeGeometry(THREE,shared,a.fades),g.material,leaving.length);
      m.instanceMatrix.array.set(a.matrices);if(a.colours)m.instanceColor=new THREE.InstancedBufferAttribute(a.colours,3);
      m.frustumCulled=false;m.castShadow=false;m.receiveShadow=!!this.sharedFrame;m.userData.wood=g.wood;m.userData.leaving=true;
      this.scene.add(m);this.leaving.push({mesh:m,end:performance.now()+TREE_FADE_MS+50});
      this.fadeTally.left+=leaving.length;
    }
    const t=this.fadeTally;this.debugFade.rebuilds++;this.debugFade.entered+=t.entered;this.debugFade.kept+=t.kept;this.debugFade.left+=t.left;
    this.lastFade={dissolved:true,entered:t.entered,left:t.left,kept:t.kept};
    if(t.entered||t.left)this.fadeUntil=performance.now()+TREE_FADE_MS+50;
    this.map.triggerRepaint();
  }
  stepFades(now=performance.now()) {
    this.fadeNow.value=fadeClock(now);
    if(this.leaving.length){const keep=[];for(const l of this.leaving){if(now<l.end)keep.push(l);else this.dropLeaving(l.mesh);}this.leaving=keep;}
    if(this.leaving.length||now<this.fadeUntil)this.map.triggerRepaint();
  }
  dropLeaving(m){this.scene.remove(m);m.dispose?.();releaseFadeGeometry(m.geometry);}
  flushFades(){for(const l of this.leaving??[])this.dropLeaving(l.mesh);this.leaving=[];this.fadeUntil=0;}
  // One instanced draw for group `key` of `count` instances; `fill(mesh)` writes its matrices and colours.
  addMesh(key,count,fill) {
    const wood=key==='wood',cone=key.startsWith('cone-'),rose=key.startsWith('rose-');
    const geometryKey=wood?'wood':cone?'cone':rose?key:this.camera.zoom()>=18?'faceted-detail':'faceted';
    if(!this.geometries.has(geometryKey))this.geometries.set(geometryKey,
      wood?trunkGeometry(THREE,{bottomCap:treeCapsFlag()})
        :cone?new THREE.ConeGeometry(1,2,8).rotateX(Math.PI/2)
        :rose?roseBushGeometry()
        :realLookOn('trees')?sphereNormals(new THREE.IcosahedronGeometry(1,this.camera.zoom()>=18?1:0)):new THREE.IcosahedronGeometry(1,this.camera.zoom()>=18?1:0));
    const materialKey=wood?'wood':rose?'rose':'foliage';
    if(!this.materials.has(materialKey)){const mat=rose?roseBushMaterial():new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.93,flatShading:!(materialKey==='foliage'&&realLookOn('trees'))});this.materials.set(materialKey,this.fadeOn?patchTreeFadeMaterial(mat,this.fadeNow,TREE_FADE_MS):mat);}
    const m=new THREE.InstancedMesh(this.geometries.get(geometryKey),this.materials.get(materialKey),count);
    m.userData.wood=wood;m.userData.groupKey=key;m.userData.geometryKey=geometryKey;
    fill(m);
    if(this.fadePrev)this.fadeMesh(m,key);
    m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;m.frustumCulled=false;
    if(this.sharedFrame){m.castShadow=true;m.receiveShadow=true;}
    this.scene.add(m);this.meshes.push(m);
    if(this.cullOn){const c=new InstanceCull(THREE,m,{castShadow:m.castShadow});if(c.shadow)this.scene.add(c.shadow);this.culls.push(c);}
  }
}
