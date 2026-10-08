/** Independent water/bank/deck geometry and a pinned native terrain-mesh adapter. */
import {elevationTile,type LngLat} from './groundElevation.js';
type Chunk={key:string;index:any;meshes:any[];decks:Map<string,any>;bytes:number;land:Float32Array};
/** Some static servers decode .gz through Content-Encoding; others serve bytes. */
export async function decodeSurfacePayload(bytes:ArrayBuffer):Promise<ArrayBuffer>{
 const prefix=new Uint8Array(bytes,0,Math.min(3,bytes.byteLength));
 return prefix[0]===31&&prefix[1]===139&&prefix[2]===8?new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes;
}
export class SurfaceWorld {
 ready=false;enabled=true;errors:string[]=[];debugTriangles=0;debugNativeMeshes=0;
 private THREE:any;private scene:any;private camera:any;private renderer:any;private worker:Worker;
 private root='';private fingerprint='';private version='';private compressed=false;private keys=new Set<string>();private chunks=new Map<string,Chunk>();private pending=new Set<string>();private failed=new Map<string,number>();
 private controller=new AbortController();private generation=0;private meshGeneration=0;private terrain:any;private originalMesh:any;
 private nativeMeshes=new Map<string,any>();private pendingMeshes=new Set<string>();private requests=new Map<number,{key:string;generation:number}>();private requestId=0;private template:any;private disposed=false;
 private timer:any;private onMove=()=>this.schedule();private onStyle=()=>{this.bindTerrain();this.colourWater();this.schedule();};
 constructor(private map:any,private maplibregl:any){
  this.THREE=(window as any).CanalRecallThree.THREE;const T=this.THREE;this.scene=new T.Scene();this.scene.add(new T.HemisphereLight(0xfff7e9,0x596052,2));const sun=new T.DirectionalLight(0xffeed7,1.8);sun.position.set(-2,-1,4);this.scene.add(sun);
  this.worker=new Worker(new URL('./js/surface-topology-worker.js',document.baseURI));this.worker.onmessage=e=>this.installNativeMesh(e.data);
  const before=map.getStyle().layers.find((l:any)=>['custom','fill-extrusion','symbol'].includes(map.getLayer(l.id)?.type||l.type))?.id;
  map.addLayer({id:'canal-water-and-banks',type:'custom',renderingMode:'3d',onAdd:(_:any,gl:any)=>{this.camera=new T.Camera();this.renderer=new T.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});this.renderer.autoClear=false;},render:(_:any,args:any)=>{
   if(!this.enabled||!this.ready)return;
   const origin=maplibregl.MercatorCoordinate.fromLngLat([4.9,52.37],0),scale=origin.meterInMercatorCoordinateUnits();this.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(new T.Matrix4().makeTranslation(origin.x,origin.y,0).scale(new T.Vector3(scale,-scale,scale)));
   const active=map._canalMeasuredBridges?.activeIds;
   for(const chunk of this.chunks.values())for(const[id,mesh]of chunk.decks)mesh.visible=!active?.has(id);
   this.renderer.resetState();this.renderer.render(this.scene,this.camera);
  }} ,before);
  map.on('moveend',this.onMove);map.on('sourcedata',this.onMove);map.on('styledata',this.onStyle);map._canalSurfaces=this;
 }
 async load(extractRoot:string,fingerprint:string){
  const gen=++this.generation;this.controller.abort();this.controller=new AbortController();this.clear();this.ready=false;this.keys.clear();this.errors=[];this.fingerprint=fingerprint;
  if(!extractRoot.replace(/\/$/,'').endsWith('/amsterdam'))return;
  this.root=new URL(`${extractRoot.replace(/\/$/,'')}/surfaces/`,document.baseURI).href;
  try{const response=await fetch(`${this.root}index.json`,{signal:this.controller.signal});if(!response.ok)throw Error(`Surface index HTTP ${response.status}`);const index=await response.json();if(index.version!==1||index.extent!==8192||index.terrainFingerprint!==fingerprint)throw Error('Surface topology and terrain fingerprints differ');if(gen!==this.generation)return;this.compressed=index.compression==='gzip';this.version=index.fingerprint||fingerprint;this.keys=new Set(index.tiles.map((t:any)=>t.key));this.ready=true;this.bindTerrain();this.schedule();}catch(e:any){if(e.name!=='AbortError'&&gen===this.generation){this.errors.push(String(e));console.warn('Water/bank topology unavailable; preserving native terrain.',e);}}
 }
 setEnabled(enabled:boolean){this.enabled=enabled;if(!enabled)this.releaseNative(false);else this.bindTerrain();this.schedule();this.map.triggerRepaint();}
 status(){
  const visible=(this.map.terrain?.tileManager.getRenderableTiles()||[]).map((t:any)=>t.tileID.canonical).filter((t:any)=>t.z>=14&&this.keys.has(`14-${Math.floor(t.x/2**(t.z-14))}-${Math.floor(t.y/2**(t.z-14))}`));
  const complete=visible.filter((t:any)=>this.nativeMeshes.has(`${t.z}/${t.x}/${t.y}`)).length;
  return {ready:this.ready,enabled:this.enabled,chunks:this.chunks.size,pendingChunks:this.pending.size,pendingMeshes:this.pendingMeshes.size,visibleMeshes:visible.length,completeMeshes:complete,geometryReady:this.ready&&complete===visible.length,triangles:this.debugTriangles,errors:this.errors.slice(-8)};
 }
 waterHeight(at:LngLat):number|null {
  const t=elevationTile(...at,14),chunk=this.chunks.get(`14-${t.x}-${t.y}`);if(!this.enabled||!chunk)return null;
  const point=[(at[0]+180)/360,(1-Math.asinh(Math.tan(at[1]*Math.PI/180))/Math.PI)/2];
  const inside=(ring:number[][])=>{if(!ring?.length)return false;let value=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])value=!value;}return value;};
  for(const region of chunk.index.waterRegions){const polygons=region.geometry.type==='Polygon'?[region.geometry.coordinates]:region.geometry.type==='MultiPolygon'?region.geometry.coordinates:[];if(polygons.some((p:any)=>inside(p[0])&&!p.slice(1).some(inside)))return region.heightM;}
  return null;
 }
 private bindTerrain(){
  const terrain=this.map.terrain;if(!terrain){if(this.terrain)this.releaseNative(false);return;}if(!this.enabled||terrain===this.terrain)return;
  this.releaseNative(false);this.terrain=terrain;this.originalMesh=terrain.getTerrainMesh.bind(terrain);
  terrain.getTerrainMesh=(tile:any)=>{
   const regular=this.originalMesh(tile);if(!this.template)this.template={Mesh:regular.constructor,attributes:regular.vertexBuffer.attributes,Segments:regular.segments.constructor};
   if(!this.enabled||!this.ready||tile.canonical.z<14)return regular;
   const {z,x,y}=tile.canonical,factor=2**(z-14),px=Math.floor(x/factor),py=Math.floor(y/factor),parent=`14-${px}-${py}`,key=`${z}/${x}/${y}`;
   const cached=this.nativeMeshes.get(key);if(cached){this.nativeMeshes.delete(key);this.nativeMeshes.set(key,cached);return cached;}
   if(!this.chunks.has(parent)){this.requestChunk(parent);return regular;}
   if(!this.pendingMeshes.has(key)){
    const id=++this.requestId;this.pendingMeshes.add(key);this.requests.set(id,{key,generation:this.meshGeneration});this.worker.postMessage({type:'clip',id,key,parent,parentX:px,parentY:py,z,x,y});
   }
   return regular;
  };
 }
 private installNativeMesh(message:any){
  const request=this.requests.get(message.id);this.requests.delete(message.id);if(!request||request.generation!==this.meshGeneration||this.disposed)return;this.pendingMeshes.delete(request.key);
  if(message.error){this.errors.push(message.error);return;}
  const context=this.map.painter.context,template=this.template;if(!template)return;
  const struct=(array:any,bytesPerElement:number,length:number)=>({arrayBuffer:array.buffer,bytesPerElement,length,freeBufferAfterUpload(){}});
  const vertex=context.createVertexBuffer(struct(message.vertices,6,message.vertices.length/3),template.attributes);
  const index=context.createIndexBuffer(struct(message.indices,6,message.indices.length/3));
  const segments=new template.Segments(message.segments.map((s:any)=>({...s,vaos:{}})));
  const mesh=new template.Mesh(vertex,index,segments);this.nativeMeshes.set(request.key,mesh);this.debugNativeMeshes=this.nativeMeshes.size;
  const visible=new Set((this.map.terrain?.tileManager.getRenderableTiles()||[]).map((t:any)=>`${t.tileID.canonical.z}/${t.tileID.canonical.x}/${t.tileID.canonical.y}`));
  for(const [key,mesh]of this.nativeMeshes){if(this.nativeMeshes.size<=128)break;if(visible.has(key))continue;mesh.destroy();this.nativeMeshes.delete(key);}
  // Topology changes do not change the basemap texture. Invalidating all RTT
  // tiles here repainted the entire style for every arriving/panning land mesh.
  if(this.map.terrain)this.map.terrain.tileManager._lastTilesetChange=performance.now();this.map.triggerRepaint();
 }
 private schedule(){if(this.timer||!this.enabled||!this.ready)return;this.timer=setTimeout(()=>{this.timer=null;this.update();},100);}
 private update(){
  if(!this.enabled||!this.ready||this.map.getZoom()<15)return;
  const bounds=this.map.getBounds(),a=elevationTile(bounds.getWest(),bounds.getNorth(),14),b=elevationTile(bounds.getEast(),bounds.getSouth(),14),center=this.map.getCenter(),c=elevationTile(center.lng,center.lat,14);
  const nearby:string[]=[];for(let x=a.x;x<=b.x;x++)for(let y=a.y;y<=b.y;y++)nearby.push(`14-${x}-${y}`);
  nearby.sort((a,b)=>{const pa=a.split('-').slice(1).map(Number),pb=b.split('-').slice(1).map(Number);return Math.hypot(pa[0]-c.x,pa[1]-c.y)-Math.hypot(pb[0]-c.x,pb[1]-c.y);});
  for(const key of nearby.slice(0,12))this.requestChunk(key);
 }
 private requestChunk(key:string){
  if(!this.enabled||!this.ready||!this.keys.has(key)||this.chunks.has(key)||this.pending.has(key)||this.pending.size>=2||Date.now()<(this.failed.get(key)||0))return;
  const gen=this.generation;this.pending.add(key);
  const compressed=this.compressed;
  void Promise.all([fetch(`${this.root}${key}.json?v=${this.version}`,{signal:this.controller.signal}).then(async r=>{if(!r.ok)throw Error(`Surface metadata HTTP ${r.status}`);return r.json();}),fetch(`${this.root}${key}.bin${compressed?'.gz':''}?v=${this.version}`,{signal:this.controller.signal}).then(async r=>{if(!r.ok)throw Error(`Surface geometry HTTP ${r.status}`);return decodeSurfacePayload(await r.arrayBuffer());})]).then(async([index,bytes])=>{
   if(index.terrainFingerprint!==this.fingerprint||index.version!==1||index.byteLength!==bytes.byteLength)throw Error('Surface chunk metadata mismatch');
   const digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==index.sha256)throw Error('Surface geometry hash mismatch');if(gen!==this.generation)return;
   const T=this.THREE,meshes:any[]=[],decks=new Map<string,any>();
   const add=(positions:Float32Array,material:any)=>{const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,material);this.scene.add(mesh);meshes.push(mesh);this.debugTriangles+=positions.length/9;return mesh;};
   const native=this.map.getStyle().layers.find((l:any)=>l.type==='fill'&&l['source-layer']==='water'),colour=native?this.map.getPaintProperty(native.id,'fill-color'):'#9ebdff';
   const water=index.mesh.water,banks=index.mesh.banks,deck=index.mesh.decks;
   const waterMesh=add(new Float32Array(bytes,water.offset,water.count),new T.MeshBasicMaterial({color:typeof colour==='string'?colour:'#9ebdff',side:T.DoubleSide}));waterMesh.userData.water=true;
   add(new Float32Array(bytes,banks.offset,banks.count),new T.MeshLambertMaterial({color:'#89766a',side:T.DoubleSide}));
   const material=new T.MeshStandardMaterial({color:'#817b70',roughness:.9,side:T.DoubleSide});
   for(const d of index.decks)decks.set(d.id,add(new Float32Array(bytes,deck.offset+d.offset*4,d.count),material));
   const land=index.mesh.land,landData=new Float32Array(bytes.slice(land.offset,land.offset+land.count*4));
   this.chunks.set(key,{key,index,meshes,decks,bytes:bytes.byteLength,land:landData});this.worker.postMessage({type:'install',key,land:landData.slice().buffer});
   const visibleParents=new Set((this.map.terrain?.tileManager.getRenderableTiles()||[]).filter((t:any)=>t.tileID.canonical.z>=14).map((t:any)=>{const {z,x,y}=t.tileID.canonical,f=2**(z-14);return `14-${Math.floor(x/f)}-${Math.floor(y/f)}`;}));
   for(const[oldKey,old]of this.chunks){if(this.chunks.size<=24)break;if(visibleParents.has(oldKey))continue;this.dropChunk(old);this.chunks.delete(oldKey);this.worker.postMessage({type:'remove',key:oldKey});}
   this.map.triggerRepaint();this.map._canalElevation?.surfaceChanged();
  }).catch(e=>{if(gen===this.generation&&e.name!=='AbortError'){this.errors.push(`${key}: ${e}`);this.failed.set(key,Date.now()+15000);}}).finally(()=>{if(gen===this.generation){this.pending.delete(key);this.schedule();}});
 }
 private colourWater(){const native=this.map.getStyle().layers.find((l:any)=>l.type==='fill'&&l['source-layer']==='water'),colour=native?this.map.getPaintProperty(native.id,'fill-color'):null;if(typeof colour==='string')for(const c of this.chunks.values())for(const m of c.meshes)if(m.userData.water)m.material.color.set(colour);}
 private releaseNative(clear=true){
  if(clear){this.meshGeneration++;this.requests.clear();this.pendingMeshes.clear();for(const m of this.nativeMeshes.values())m.destroy();this.nativeMeshes.clear();this.debugNativeMeshes=0;this.template=null;}
  if(this.terrain&&this.originalMesh)this.terrain.getTerrainMesh=this.originalMesh;this.terrain=null;
 }
 private dropChunk(chunk:Chunk){for(const mesh of chunk.meshes){this.debugTriangles-=mesh.geometry.attributes.position.count/3;mesh.parent?.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}}
 private clear(){this.releaseNative();for(const c of this.chunks.values()){this.dropChunk(c);this.worker.postMessage({type:'remove',key:c.key});}this.chunks.clear();this.pending.clear();this.failed.clear();}
 dispose(){if(this.disposed)return;this.disposed=true;this.generation++;clearTimeout(this.timer);this.controller.abort();this.clear();this.worker.terminate();this.map.off('moveend',this.onMove);this.map.off('sourcedata',this.onMove);this.map.off('styledata',this.onStyle);if(this.map.getLayer('canal-water-and-banks'))this.map.removeLayer('canal-water-and-banks');this.renderer?.dispose();delete this.map._canalSurfaces;}
}
