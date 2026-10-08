export function terrainPackKey(z:number,x:number,y:number) {return z<14?'overview':`14-${x>>(z-14)}-${y>>(z-14)}`;}
/** Unchanged PNGs, indexed by byte range. Servers without Range retain one bounded full pack. */
export class TerrainArchive {
 private indices=new Map<string,Promise<any>>();private full=new Map<string,ArrayBuffer>();private fullBytes=0;
 constructor(private root:string,private version:string,private sourceSignal:AbortSignal) {}
 async tile(z:number,x:number,y:number,quality=false,signal=this.sourceSignal):Promise<ArrayBuffer> {
  const pack=terrainPackKey(z,x,y),key=`${z}/${x}/${y}${quality?':quality':''}`;
  if(!this.indices.has(pack)) {
   const promise=fetch(`${this.root}packs/${pack}.json?v=${this.version}`,{signal:this.sourceSignal}).then(async r=>{if(!r.ok)throw Error(`Terrain pack index HTTP ${r.status}`);const value=await r.json();if(value.version!==1||!value.tiles)throw Error('Invalid terrain pack');return value;}).catch(e=>{this.indices.delete(pack);throw e;});
   this.indices.set(pack,promise);
   while(this.indices.size>48)this.indices.delete(this.indices.keys().next().value!);
  }
  const index=await this.indices.get(pack)!,range=index.tiles[key];if(!range)throw Error(`Missing terrain tile ${key}`);
  const [offset,length]=range;if(this.full.has(pack)){const bytes=this.full.get(pack)!;this.full.delete(pack);this.full.set(pack,bytes);return bytes.slice(offset,offset+length);}
  const response=await fetch(`${this.root}packs/${pack}.bin?v=${this.version}`,{headers:{Range:`bytes=${offset}-${offset+length-1}`},signal});
  if(!response.ok)throw Error(`Terrain tile HTTP ${response.status}`);const bytes=await response.arrayBuffer();
  if(response.status===206){if(bytes.byteLength!==length)throw Error('Truncated terrain byte range');return bytes;}
  if(bytes.byteLength!==index.byteLength)throw Error('Truncated terrain pack');
  if(this.full.has(pack))this.fullBytes-=this.full.get(pack)!.byteLength;this.full.set(pack,bytes);this.fullBytes+=bytes.byteLength;while(this.fullBytes>24000000&&this.full.size>1){const oldest=this.full.keys().next().value!,value=this.full.get(oldest)!;this.full.delete(oldest);this.fullBytes-=value.byteLength;}
  return bytes.slice(offset,offset+length);
 }
}
