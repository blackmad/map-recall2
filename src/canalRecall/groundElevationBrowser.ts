import {TerrainArchive} from './terrainArchive.js';
import {SurfaceWorld} from './surfaceWorldBrowser.js';
import { elevationTile, sampleElevationPixels, footprintGround, groundVehiclePose, UNKNOWN_GROUND, type ElevationPixels, type LngLat, type GroundSample } from './groundElevation.js';
async function pixels(url: string, signal: AbortSignal): Promise<Uint8ClampedArray> {
  const r=await fetch(url,{signal});if(!r.ok)throw Error(`Elevation HTTP ${r.status}`);
  return pixelBytes(await r.arrayBuffer());
}
async function pixelBytes(bytes:ArrayBuffer):Promise<Uint8ClampedArray> {
  const bitmap=await createImageBitmap(new Blob([bytes],{type:"image/png"}));
  try {const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);return ctx.getImageData(0,0,256,256).data;} finally {bitmap.close();}
}
export class GroundElevation {
  enabled: boolean; ready=false; revision=0; error: string|null=null; metadata:any=null;
  private root=''; private generation=0; private controller=new AbortController();
  private tiles=new Map<string,ElevationPixels>(); private pending=new Set<string>();private queue=new Map<string,{x:number;y:number}>();
  private failed=new Map<string,number>(); private notification:any;
  private objectCache=new WeakMap<object,{generation:number;revision:number;complete:boolean;height:number}>();
  private style=()=>this.attach();
  private layerOrder:string[]=[];private orderTimer:any;
  private onStyleData=()=>{if(!this.enabled||!this.ready||this.orderTimer)return;this.orderTimer=setTimeout(()=>{this.orderTimer=null;this.groupDrapedLayers();},50);};
  private archive:TerrainArchive|null=null;
  surfaces:SurfaceWorld|null=null;
  private protocol="canal-ground-"+Math.random().toString(36).slice(2);
  constructor(private map:any,enabled=true,private loadPixels:typeof pixels=pixels) {this.enabled=enabled;map._canalElevation=this;map.on('style.load',this.style);map.on('styledata',this.onStyleData);
    if(typeof window!=='undefined') (window as any).maplibregl?.addProtocol(this.protocol,async(params:any,abort:AbortController)=>{
      const parts=params.url.slice(params.url.indexOf('://')+3).split('/').map(Number);
      if(!this.archive)throw Error('Elevation archive unavailable');return {data:await this.archive.tile(parts[0],parts[1],parts[2],false,abort.signal)};
    });
  }
  async load(extractRoot:string) {
    const gen=++this.generation;this.controller.abort();this.controller=new AbortController();
    this.tiles.clear();this.queue.clear();this.pending.clear();this.failed.clear();this.metadata=null;this.ready=false;this.error=null;this.archive=null;this.detach();this.changed();
    if(!extractRoot.replace(/\/$/,'').endsWith('/amsterdam')){void this.surfaces?.load(extractRoot,'');return;}
    this.root=new URL(`${extractRoot.replace(/\/$/,'')}/terrain/`,document.baseURI).href;
    try {const r=await fetch(new URL('tilejson.json',this.root),{signal:this.controller.signal});if(!r.ok)throw Error(`Elevation metadata HTTP ${r.status}`);const meta=await r.json();
      if(meta.version!==1||meta.datum!=='NAP'||meta.encoding!=='mapbox'||meta.tileSize!==256||!Array.isArray(meta.bounds))throw Error('Unsupported terrain metadata');
      if(gen!==this.generation)return;this.metadata=meta;this.archive=meta.delivery==='indexed-png-pack-v1'?new TerrainArchive(this.root,meta.fingerprint,this.controller.signal):null;this.ready=true;this.attach();
      if(typeof window!=='undefined'&&(window as any).CanalRecallThree){if(!this.surfaces)this.surfaces=new SurfaceWorld(this.map,(window as any).maplibregl);this.surfaces.setEnabled(this.enabled);void this.surfaces.load(extractRoot,meta.fingerprint);}
      this.changed();
    } catch(e:any) {if(gen===this.generation&&e.name!=='AbortError'){this.error=String(e);console.warn('Amsterdam elevation unavailable; retaining flat scene.',e);}}
  }
  private attach() {
    if(!this.ready||!this.enabled||!this.map.getStyle())return;
    if(!this.map.getSource('amsterdam-ground-dem'))this.map.addSource('amsterdam-ground-dem',{type:'raster-dem',tiles:[this.archive?`${this.protocol}://{z}/{x}/{y}`:`${this.root}{z}/{x}/{y}.png?v=${this.metadata.fingerprint}`],tileSize:256,minzoom:this.metadata.minzoom,maxzoom:this.metadata.maxzoom,bounds:this.metadata.bounds,encoding:'mapbox',attribution:this.metadata.attribution});
    this.map.setTerrain({source:'amsterdam-ground-dem',exaggeration:1});
    this.groupDrapedLayers();
    // Pinned MapLibre 5.24: this changes only terrain's basemap texture size.
    // Custom facade textures and bridge geometry retain their existing detail.
    if(this.map.terrain && typeof this.map.terrain.qualityFactor==='number'){
      this.map.terrain.qualityFactor=1;this.map.terrain.meshSize=32;
      const rtt=this.map.painter?.renderToTexture;
      if(rtt?.pool){const Pool=rtt.pool.constructor;rtt.pool.destruct();rtt.pool=new Pool(this.map.painter.context,30,this.map.terrain.tileManager.tileSize);}
    }
  }
  private groupDrapedLayers() {
    if(!this.enabled||!this.ready||!this.map.moveLayer)return;
    const layers=this.map.getStyle()?.layers||[];
    for(let i=0;i<layers.length;i++)if(!this.layerOrder.includes(layers[i].id)){
      const next=layers.slice(i+1).find((l:any)=>this.layerOrder.includes(l.id));
      const at=next?this.layerOrder.indexOf(next.id):this.layerOrder.length;this.layerOrder.splice(at,0,layers[i].id);
    }
    // MapLibre 5.24 renders every separated group of fills/lines as another
    // coplanar terrain mesh. Custom layers between these groups caused both
    // striped depth conflicts and repeated full terrain passes in this scene.
    const draped=new Set(['background','fill','line','raster','hillshade','color-relief']);
    const target=[...layers.filter((l:any)=>draped.has(l.type)),...layers.filter((l:any)=>!draped.has(l.type))].map((l:any)=>l.id);
    const current=layers.map((l:any)=>l.id);
    if(target.every((id:string,i:number)=>id===current[i]))return;
    for(const id of target)this.map.moveLayer(id);
  }
  private detach() {clearTimeout(this.orderTimer);this.orderTimer=null;if(this.map.getTerrain?.()?.source==='amsterdam-ground-dem')this.map.setTerrain(null);if(this.map.getSource('amsterdam-ground-dem'))this.map.removeSource('amsterdam-ground-dem');if(this.map.moveLayer){const present=new Set((this.map.getStyle()?.layers||[]).map((l:any)=>l.id));for(const id of this.layerOrder)if(present.has(id))this.map.moveLayer(id);}this.layerOrder=[];}
  setEnabled(enabled:boolean) {if(this.enabled===enabled)return;this.enabled=enabled;enabled?this.attach():this.detach();this.surfaces?.setEnabled(enabled);this.changed();}
  sample(at:LngLat):GroundSample {
    if(!this.enabled||!this.ready)return UNKNOWN_GROUND;
    const [w,s,e,n]=this.metadata.bounds;
    if(at[0]<w||at[0]>e||at[1]<s||at[1]>n)return UNKNOWN_GROUND;
    const t=elevationTile(...at),key=`${t.x}/${t.y}`,tile=this.tiles.get(key);
    if(tile){this.tiles.delete(key);this.tiles.set(key,tile);const value=sampleElevationPixels(tile,t.u,t.v);if(value.quality==='water')value.heightM=this.surfaces?.waterHeight(at)??value.heightM;return value;}
    if(!this.pending.has(key)&&!this.queue.has(key)&&Date.now()>(this.failed.get(key)||0)){this.queue.set(key,t);this.pump();}
    return UNKNOWN_GROUND;
  }
  heightAt(at:LngLat) {
    const value=this.sample(at);
    // Map.queryTerrainElevation runs coveringTiles to choose a sampling zoom.
    // Repeating that for every tree and vehicle contact dominated frame time.
    // The native terrain and this bounded sampler read the same NAP raster.
    return value.heightM;
  }
  objectGround(geometry:any) {
    if(!this.enabled||!this.ready||!geometry)return 0;
    const cached=this.objectCache.get(geometry);
    if(cached?.generation===this.generation&&(cached.complete||cached.revision===this.revision))return cached.height;
    let complete=true;
    const height=footprintGround(geometry,p=>{const value=this.sample(p);if(!value.ready)complete=false;return value;});
    this.objectCache.set(geometry,{generation:this.generation,revision:this.revision,complete,height});return height;
  }
  private pump() {
    while(this.pending.size<4&&this.queue.size) {
      const [key,t]=this.queue.entries().next().value!;this.queue.delete(key);this.pending.add(key);
      const gen=this.generation,signal=this.controller.signal,version=`?v=${this.metadata.fingerprint}`;
      Promise.all(this.archive?[this.archive.tile(16,t.x,t.y,false,signal).then(pixelBytes),this.archive.tile(16,t.x,t.y,true,signal).then(pixelBytes)]:[this.loadPixels(`${this.root}16/${t.x}/${t.y}.png${version}`,signal),this.loadPixels(`${this.root}16/${t.x}/${t.y}.quality.png${version}`,signal)]).then(([rgb,quality])=>{
        if(gen!==this.generation)return;this.tiles.set(key,{rgb,quality});while(this.tiles.size>64)this.tiles.delete(this.tiles.keys().next().value!);this.changed();
      }).catch(e=>{if(gen===this.generation&&e.name!=='AbortError')this.failed.set(key,Date.now()+15000);}).finally(()=>{if(gen===this.generation){this.pending.delete(key);this.pump();}});
    }
  }
  private changed() {if(this.notification)return;this.notification=setTimeout(()=>{this.notification=null;this.revision++;this.map.fire('canal-ground-changed',{revision:this.revision});this.map.triggerRepaint();},100);}
  status() {return {enabled:this.enabled,ready:this.ready,revision:this.revision,error:this.error,datum:'NAP',tiles:this.tiles.size,pending:this.pending.size,queued:this.queue.size};}
  surfaceChanged(){this.changed();}
  dispose() {this.generation++;this.controller.abort();clearTimeout(this.notification);this.surfaces?.dispose();this.map.off('style.load',this.style);this.map.off('styledata',this.onStyleData);this.detach();delete this.map._canalElevation;if(typeof window!=='undefined')(window as any).maplibregl?.removeProtocol(this.protocol);}
}
declare global {interface Window {CanalRecallElevation:{GroundElevation:typeof GroundElevation;groundVehiclePose:typeof groundVehiclePose}}}
if(typeof window!=='undefined') window.CanalRecallElevation={GroundElevation,groundVehiclePose};
