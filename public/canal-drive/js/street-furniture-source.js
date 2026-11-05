// Street furniture in the ride (lane #170): the city's underground-container tops, lamp posts, bike hoops, abris and
// reclamezuilen from the open registers (public/data/extracts/amsterdam/street-furniture/, scripts/street-furniture/).
// Thin adapter: the models (src/canalRecall/streetFurniture/models.ts) and the record → instance rules (placement.ts)
// are typed; this file streams z15 tiles by view (ViewResidency), fills one InstancedMesh per kind with one shared
// vertex-colour material, and culls each with rendererShared/instanceCull.ts. Draws from zoom 16 within 220 m of the
// view centre. `?furniture=0` turns it off. No shadows (the budget is six instanced draws, not twelve).
import {ViewResidency} from '../../../src/canalRecall/viewResidency.ts';
import {worldCameraOf} from '../../../src/canalRecall/engine/worldCameraOf.ts';
import {InstanceCull} from '../../../src/canalRecall/rendererShared/instanceCull.ts';
import {RebuildCoalescer,extrasRebuildSync} from '../../../src/canalRecall/rendererShared/rebuildCoalescer.ts';
import {FURNITURE_MODELS} from '../../../src/canalRecall/streetFurniture/models.ts';
import {instancesOf} from '../../../src/canalRecall/streetFurniture/placement.ts';
const {THREE} = window.CanalRecallThree;

export const MIN_ZOOM = 16;
export const RADIUS_M = 220;
const BUDGET = 9;

export function furnitureFlag() {
  try { return new URLSearchParams(location.search).get('furniture') !== '0'; } catch { return true; }
}

/** The view box clipped to RADIUS_M round the view centre. */
function viewBox(camera) {
  const b=camera.bounds(),c=camera.center(),dy=RADIUS_M/110540,dx=RADIUS_M/(111320*Math.cos(c.lat*Math.PI/180));
  return {west:Math.max(b.getWest(),c.lng-dx),east:Math.min(b.getEast(),c.lng+dx),south:Math.max(b.getSouth(),c.lat-dy),north:Math.min(b.getNorth(),c.lat+dy)};
}

/** One material for every kind: vertex colours, and magenta (1,0,1) faces take the instance colour (fraction lid, poster). */
export function furnitureMaterial() {
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.82,metalness:0,flatShading:true,vertexColors:true});
  material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',
    '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n float sfSlot = step(0.98, color.r) * step(color.g, 0.02) * step(0.98, color.b);\n vColor.rgb = mix(color.rgb, instanceColor.rgb, sfSlot);\n#endif');};
  material.customProgramCacheKey=()=>'canal-street-furniture';
  return material;
}

export function furnitureGeometry(id) {
  const m=FURNITURE_MODELS[id](),g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(m.positions,3));
  g.setAttribute('color',new THREE.BufferAttribute(m.colours,3));
  g.computeVertexNormals();g.computeBoundingSphere();
  g.userData.triangles=m.triangles;
  return g;
}

export class StreetFurniture {
  constructor(map, maplibregl, options = {}) {
    this.map=map;this.camera=options.camera||worldCameraOf(map);this.maplibregl=maplibregl;
    this.enabled=furnitureFlag();this.ready=false;this.generation=0;
    this.tiles=new Map();this.pending=new Map();this.meshes=[];this.culls=[];this.queue=[];
    this.residency=new ViewResidency(.25,60);
    // One rebuild per burst of tile arrivals / ground re-bases, after a frame (lane E6 #219, rendererShared/rebuildCoalescer.ts;
    // `?extrasRebuild=sync` rebuilds at once).
    this.rebuilds=new RebuildCoalescer(()=>{if(this.enabled&&this.ready)this.rebuild();},undefined,extrasRebuildSync());
    this.geometries=new Map();this.material=null;
    this.sharedFrame=options.sharedFrame||null;
    this.scene=new THREE.Group();this.scene.name='street-furniture';
    this.origin=maplibregl.MercatorCoordinate.fromLngLat([4.9,52.37],0);
    this.scale=this.origin.meterInMercatorCoordinateUnits();
    this.transform=new THREE.Matrix4().makeTranslation(this.origin.x,this.origin.y,this.origin.z).scale(new THREE.Vector3(this.scale,-this.scale,this.scale));
    this.clipFromLocal=new THREE.Matrix4();this.cullFrustum=new THREE.Frustum();
    this.debug={draws:0,instances:0,triangles:0,tiles:0,byModel:{}};
    this._unregister=this.sharedFrame?.register('street-furniture',{
      root:this.scene,
      mercatorFromLocal:()=>this.transform.elements,
      beforeRender:ctx=>{
        const on=this.enabled&&this.ready&&ctx.zoom>=MIN_ZOOM&&this.meshes.length>0;
        if(!on){this.debug.draws=0;this.debug.triangles=0;return false;}
        this.clipFromLocal.multiplyMatrices(ctx.clipFromWorld,ctx.worldFromMercator).multiply(this.transform);
        let draws=0,triangles=0;
        for(const c of this.culls){c.update(this.clipFromLocal,this.cullFrustum);const n=c.mesh.count;c.mesh.visible=n>0;if(n>0){draws++;triangles+=n*c.mesh.geometry.userData.triangles;}}
        this.debug.draws=draws;this.debug.triangles=triangles;
        return true;
      },
    },{order:options.sharedOrder??32});
    this.move=()=>this.update();map.on('moveend',this.move);
  }
  remove() {
    this._unregister?.();this._unregister=null;this.generation++;this.ready=false;
    this.clear();this.map.off('moveend',this.move);
    for(const g of this.geometries.values())g.dispose();this.geometries.clear();this.material?.dispose();this.material=null;
  }
  async load(root) {
    const generation=++this.generation;
    this.clear();this.ready=false;this.index=null;
    if(!root.endsWith('/amsterdam'))return;
    this.root=new URL(`${root}/street-furniture/`,location.href);
    try {
      const response=await fetch(new URL('index.json',this.root));
      if(!response.ok)return;
      const index=await response.json();
      if(generation!==this.generation)return;
      if(index.version!==1||index.zoom!==15||!Array.isArray(index.tiles))throw Error('Invalid street-furniture index');
      this.index=index;this.meta=new Map(index.tiles.map(t=>[t.key,t]));
      this.ready=true;this.update();
    } catch(error){console.warn('Street furniture unavailable.',error);}
  }
  setGroundBase(fn){this.groundBase=fn||null;this.refreshGroundBases();}
  refreshGroundBases(){this.residency.invalidate();if(this.enabled&&this.ready&&(this.meshes.length||this.rebuilds.pending))this.rebuilds.request();this.map.triggerRepaint?.();}
  setEnabled(value){this.enabled=!!value&&furnitureFlag();if(this.enabled)this.update();else this.clear();this.map.triggerRepaint?.();}
  setSuspended(value){if(this.suspended===!!value)return;this.suspended=!!value;if(!this.suspended)this.update();}
  clear(){
    for(const c of this.pending.values())c.abort();
    this.pending.clear();this.tiles.clear();this.queue=[];this.residency.invalidate();this.rebuilds.cancel();this.disposeMeshes();
  }
  disposeMeshes(){
    for(const m of this.meshes){this.scene.remove(m);m.dispose?.();}
    this.meshes=[];this.culls=[];this.debug.draws=0;this.debug.instances=0;this.debug.triangles=0;
  }
  update(){
    if(!this.enabled||!this.ready||this.suspended)return;
    if(this.camera.zoom()<MIN_ZOOM){if(this.meshes.length||this.tiles.size)this.clear();return;}
    const b=viewBox(this.camera),c=this.camera.center();
    const tile=(lng,lat)=>[Math.floor((lng+180)/360*32768),Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*32768)];
    const [x0,y1]=tile(b.west,b.south),[x1,y0]=tile(b.east,b.north),[cx,cy]=tile(c.lng,c.lat);
    const wanted=[];
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=`15/${x}/${y}`;if(this.meta.has(key))wanted.push({key,d:(x-cx)**2+(y-cy)**2});}
    wanted.sort((a,b)=>a.d-b.d);const keys=new Set(wanted.slice(0,BUDGET).map(t=>t.key));
    for(const key of this.tiles.keys())if(!keys.has(key)){this.tiles.delete(key);this.residency.invalidate();}
    for(const [key,ctl] of this.pending)if(!keys.has(key)){ctl.abort();this.pending.delete(key);}
    this.queue=[...keys].filter(k=>!this.tiles.has(k)&&!this.pending.has(k));
    if(this.residency.needsRebuild(b,'f'))this.rebuilds.request();
    this.pump();
  }
  pump(){while(this.pending.size<2&&this.queue.length){const key=this.queue.shift();void this.fetchTile(key);}}
  async fetchTile(key){
    const controller=new AbortController(),generation=this.generation;this.pending.set(key,controller);
    try {
      const response=await fetch(new URL(this.meta.get(key).url,this.root),{signal:controller.signal});
      if(!response.ok)throw Error('Missing street-furniture tile');
      const bytes=new Uint8Array(await response.arrayBuffer());
      const text=bytes[0]===0x1f&&bytes[1]===0x8b?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
      const data=JSON.parse(text);
      if(data.version!==1||data.key!==key||!Array.isArray(data.items))throw Error('Invalid street-furniture tile');
      if(!controller.signal.aborted&&generation===this.generation){
        // Instances depend only on the record: expand once per tile, keep them with it.
        const instances=[];for(const r of data.items)for(const i of instancesOf(r))instances.push(i);
        this.tiles.set(key,instances);this.residency.invalidate();this.rebuilds.request();
      }
    } catch(error){if(error.name!=='AbortError')console.warn(`Street-furniture tile ${key} unavailable`,error);}
    finally{if(this.pending.get(key)===controller)this.pending.delete(key);this.pump();}
  }
  rebuild(){
    this.disposeMeshes();
    const b=this.residency.built(viewBox(this.camera),'f'),groups=new Map();
    for(const list of this.tiles.values())for(const i of list){
      if(i.lng<b.west||i.lng>b.east||i.lat<b.south||i.lat>b.north)continue;
      (groups.get(i.model)??groups.set(i.model,[]).get(i.model)).push(i);
    }
    this.material??=furnitureMaterial();
    const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),z=new THREE.Vector3(0,0,1),pos=new THREE.Vector3(),scl=new THREE.Vector3(),white=new THREE.Color(1,1,1),col=new THREE.Color();
    let instances=0;const byModel={};
    for(const [id,items] of groups){
      if(!this.geometries.has(id))this.geometries.set(id,furnitureGeometry(id));
      const mesh=new THREE.InstancedMesh(this.geometries.get(id),this.material,items.length);
      mesh.name=`street-furniture/${id}`;
      items.forEach((v,j)=>{
        const p=this.maplibregl.MercatorCoordinate.fromLngLat([v.lng,v.lat],0);
        const x=(p.x-this.origin.x)/this.scale,north=-(p.y-this.origin.y)/this.scale;
        const z0=this.groundBase?(this.groundBase([v.lng,v.lat])??0):0;
        pos.set(x,north,z0);q.setFromAxisAngle(z,v.yaw);scl.set(v.scale,v.scale,v.scale);
        m4.compose(pos,q,scl);mesh.setMatrixAt(j,m4);
        mesh.setColorAt(j,v.slotHex?col.set(v.slotHex):white);
      });
      mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;
      mesh.castShadow=false;mesh.receiveShadow=!!this.sharedFrame;
      this.scene.add(mesh);this.meshes.push(mesh);
      if(this.sharedFrame)this.culls.push(new InstanceCull(THREE,mesh,{castShadow:false}));
      instances+=items.length;byModel[id]=items.length;
    }
    this.debug.instances=instances;this.debug.byModel=byModel;this.debug.tiles=this.tiles.size;this.debug.meshes=this.meshes.length;
    this.map.triggerRepaint?.();
  }
}

if(typeof window!=='undefined')window.CanalRecallStreetFurnitureDebug=()=>window.__canalStreetFurniture?.debug??null;
