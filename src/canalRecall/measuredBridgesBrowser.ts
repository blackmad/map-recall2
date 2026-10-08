import {bridgeLngLat,bridgeLocalPoint,insideBridgeOutline,validateBridgeSurfaceFile} from './bridgeSurface.js';
import {BridgeSpatialIndex,measuredBridgeHeight,type InstalledBridge} from './measuredBridgeScene.js';
const {THREE}= (window as any).CanalRecallThree;
export class MeasuredBridges {
 ready=false;enabled=true;bridges:InstalledBridge[]=[];activeIds=new Set<string>();debugPaints=0;debugTriangles=0;debugGeometryBytes=0;errors:string[]=[];
 private scene=new THREE.Scene();private camera:any;private renderer:any;private generation=0;private controller=new AbortController();private root='';private terrainFingerprint='';
 private index=new BridgeSpatialIndex([]);private cache=new Map<string,any[]>();private pending=new Set<string>();private wanted=new Set<string>();private filters=new Map<string,{layer:any;original:any;ids?:string}>();private updateTimer:any;
 private onMove=()=>this.schedule();private onGround=()=>this.schedule();
 layer:any;
 constructor(private map:any,private maplibregl:any,private preview=false) {
  map._canalMeasuredBridges=this;
  this.scene.add(new THREE.HemisphereLight(0xfff7e9,0x596052,2));const sun=new THREE.DirectionalLight(0xffeed7,1.8);sun.position.set(-2,-1,4);this.scene.add(sun);
  this.layer={id:'measured-bridges',type:'custom',renderingMode:'3d',onAdd:(_:any,gl:any)=>{this.camera=new THREE.Camera();this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});this.renderer.autoClear=false;},onRemove:()=>this.dispose(),render:(_:any,args:any)=>{
   if(!this.enabled||!this.ready||!this.activeIds.size)return;
   const origin=maplibregl.MercatorCoordinate.fromLngLat([4.9,52.37],0),scale=origin.meterInMercatorCoordinateUnits();
   this.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(new THREE.Matrix4().makeTranslation(origin.x,origin.y,0).scale(new THREE.Vector3(scale,-scale,scale)));
   this.renderer.resetState();this.renderer.render(this.scene,this.camera);this.debugPaints++;
  }};
  map.addLayer(this.layer);map.on('moveend',this.onMove);map.on('canal-ground-changed',this.onGround);map.on('sourcedata',this.onMove);
 }
 async load(extractRoot:string) {
  const gen=++this.generation;this.controller.abort();this.controller=new AbortController();this.clear();this.ready=false;this.errors=[];this.bridges=[];this.index=new BridgeSpatialIndex([]);
  if(!extractRoot.replace(/\/$/,'').endsWith('/amsterdam'))return;
  this.root=new URL(`${extractRoot.replace(/\/$/,'')}/measured-bridges/`,document.baseURI).href;
  try{const r=await fetch(`${this.root}index.json`,{signal:this.controller.signal});if(!r.ok)throw Error(`Bridge index HTTP ${r.status}`);const parsed=await r.json();validateBridgeSurfaceFile(parsed);const value=parsed as typeof parsed & {coordinateSpace:string;terrainFingerprint:string;approvedIds:string[];bridges:InstalledBridge[]};if(value.coordinateSpace!=='east-north-up-metres@4.9,52.37')throw Error('Unsupported bridge mesh coordinates');if(gen!==this.generation)return;
   this.terrainFingerprint=value.terrainFingerprint;this.bridges=(value.bridges as InstalledBridge[]).filter((b:InstalledBridge)=>this.preview||value.approvedIds.includes(b.id));this.index=new BridgeSpatialIndex(this.bridges);this.ready=true;this.schedule();
  }catch(e:any){if(gen===this.generation&&e.name!=='AbortError'){this.errors.push(String(e));console.warn('Measured bridges unavailable; keeping basemap crossings.',e);}}
 }
 heightAt(ll:readonly[number,number]):number|null {
  if(!this.enabled||this.map.getZoom()<15)return null;
  for(const b of this.index.query(ll)){if(!this.activeIds.has(b.id))continue;const h=measuredBridgeHeight(b,ll);if(h!==null)return h;}
  return null;
 }
 setEnabled(value:boolean){this.enabled=value;this.schedule();}
 private schedule(){if(this.updateTimer)return;this.updateTimer=setTimeout(()=>{this.updateTimer=null;this.update();},100);}
 private update(){
  const active=this.enabled&&this.ready&&this.map.getZoom()>=15&&this.map._canalElevation?.enabled&&this.map._canalElevation?.ready&&this.map._canalElevation?.metadata?.fingerprint===this.terrainFingerprint;
  const bounds=this.map.getBounds(),center=this.map.getCenter();let triangles=0;
  const nearby=active?this.bridges.filter(b=>b.origin[0]>bounds.getWest()-.0004&&b.origin[0]<bounds.getEast()+.0004&&b.origin[1]>bounds.getSouth()-.0003&&b.origin[1]<bounds.getNorth()+.0003).sort((a,b)=>Math.hypot(a.origin[0]-center.lng,a.origin[1]-center.lat)-Math.hypot(b.origin[0]-center.lng,b.origin[1]-center.lat)):[];
  this.wanted.clear();for(const b of nearby){if(this.wanted.size>=12||triangles+b.review.triangles>150000)continue;this.wanted.add(b.id);triangles+=b.review.triangles;}
  const previous=[...this.activeIds].sort().join(',');this.activeIds.clear();this.debugTriangles=0;
  for(const [id,meshes]of this.cache){const bridge=this.bridges.find(b=>b.id===id)!;
   const ends=[bridge.samples[0],bridge.samples.at(-1)!].map(s=>bridgeLngLat(bridge,s.point));
   const grounded=ends.every(ll=>{const value=this.map._canalElevation?.sample(ll);return value?.ready&&value.quality!=='unknown';});
   const visible=this.wanted.has(id)&&grounded;for(const mesh of meshes)mesh.visible=visible;if(visible){this.activeIds.add(id);this.debugTriangles+=this.bridges.find(b=>b.id===id)!.review.triangles;}}
  if(previous!==[...this.activeIds].sort().join(',')){this.restoreFilters();}
  // Loading is asynchronous; only GPU-ready identities are suppressed or sampled.
  for(const bridge of nearby)if(this.wanted.has(bridge.id)&&!this.cache.has(bridge.id)&&!this.pending.has(bridge.id)&&this.pending.size<2)void this.loadMesh(bridge);
  this.suppress();this.evict();this.map.triggerRepaint();
 }
 private async loadMesh(b:InstalledBridge){
  const gen=this.generation;this.pending.add(b.id);
  try{const r=await fetch(new URL(b.mesh.url,this.root),{signal:this.controller.signal});if(!r.ok)throw Error(`Bridge mesh HTTP ${r.status}`);const bytes=await r.arrayBuffer();
   const digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==b.mesh.sha256)throw Error('Bridge mesh fingerprint mismatch');
   if(gen!==this.generation)return;const origin=this.maplibregl.MercatorCoordinate.fromLngLat([4.9,52.37],0),scale=origin.meterInMercatorCoordinateUnits(),meshes:any[]=[];
   for(const batch of b.mesh.batches){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(bytes,batch.positionsOffset,batch.positionsCount),3));geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(bytes,batch.normalsOffset,batch.normalsCount),3));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bytes,batch.indicesOffset,batch.indicesCount),1));geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({color:batch.colour,roughness:.9,metalness:batch.kind==='railings'?.2:0,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`${b.id}-${batch.kind}`;mesh.visible=false;this.scene.add(mesh);meshes.push(mesh);
   }
   this.cache.set(b.id,meshes);this.debugGeometryBytes+=b.review.geometryBytes;this.update();
  }catch(e:any){if(gen===this.generation&&e.name!=='AbortError'){this.errors.push(`${b.id}: ${e}`);this.wanted.delete(b.id);this.bridges=this.bridges.filter(candidate=>candidate.id!==b.id);}}
  finally{if(gen===this.generation){this.pending.delete(b.id);this.schedule();}}
 }
 private suppress(){
  if(!this.activeIds.size)return;
  const mask={type:'MultiPolygon',coordinates:this.bridges.filter(b=>this.activeIds.has(b.id)).map(b=>{const ring=b.outline.map(p=>bridgeLngLat(b,p));return [[...ring,ring[0]]];})};
  for(const layer of this.map.getStyle().layers||[]){
   if(layer['source-layer']!=='transportation')continue;
   if(layer.type==='line'&&/^bridge_/.test(layer.id)){
    if(this.filters.has(layer.id))continue;const original=this.map.getFilter(layer.id);this.filters.set(layer.id,{layer:this.map.getLayer(layer.id),original});this.map.setFilter(layer.id,['all',original||true,['!', ['within',mask]]]);
   } else if(layer.type==='fill'){
    const ids=new Set<any>();for(const f of this.map.querySourceFeatures(layer.source,{sourceLayer:'transportation'})){
     if(f.id==null||!['Polygon','MultiPolygon'].includes(f.geometry.type)||!(f.properties?.class==='bridge'||f.properties?.brunnel==='bridge'))continue;
     const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
     if(this.bridges.some(b=>this.activeIds.has(b.id)&&polygons.some((p:any)=>p[0].every((ll:any)=>insideBridgeOutline(bridgeLocalPoint(b,ll),b.outline)))))ids.add(f.id);
    }
    if(!ids.size)continue;const previous=this.filters.get(layer.id),fingerprint=[...ids].sort().join(',');if(previous?.ids===fingerprint)continue;const original=previous?previous.original:this.map.getFilter(layer.id);this.filters.set(layer.id,{layer:this.map.getLayer(layer.id),original,ids:fingerprint});this.map.setFilter(layer.id,['all',original||true,['!', ['in',['id'],['literal',[...ids]]]]]);
   }
  }
 }
 private restoreFilters(){for(const [id,{layer,original}]of this.filters)if(this.map.getLayer(id)===layer)this.map.setFilter(id,original);this.filters.clear();}
 private evict(){for(const[id,meshes]of this.cache){if(this.cache.size<=24&&this.debugGeometryBytes<=16000000)break;if(this.activeIds.has(id))continue;for(const mesh of meshes){mesh.parent?.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}this.cache.delete(id);this.debugGeometryBytes-=this.bridges.find(b=>b.id===id)?.review.geometryBytes||0;}}
 private clear(){this.restoreFilters();for(const meshes of this.cache.values())for(const mesh of meshes){mesh.parent?.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}this.cache.clear();this.pending.clear();this.activeIds.clear();this.debugGeometryBytes=0;this.debugTriangles=0;}
 dispose(){this.generation++;this.controller.abort();clearTimeout(this.updateTimer);this.clear();this.map.off('moveend',this.onMove);this.map.off('sourcedata',this.onMove);this.map.off('canal-ground-changed',this.onGround);this.renderer?.dispose();if(this.map._canalMeasuredBridges===this)delete this.map._canalMeasuredBridges;}
}
(window as any).CanalRecallMeasuredBridges={MeasuredBridges};
