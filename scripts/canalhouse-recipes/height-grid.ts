import fs from 'node:fs/promises';
import sharp from 'sharp';
export interface HeightGrid {width:number;height:number;origin:[number,number];step:[number,number];values:Float32Array;noData:number;epsg:28992}
/** The bounded PDOK WCS tiles use classic TIFF, north-up PixelIsArea and RD.
 * Reject other georeferencing instead of silently treating requested bounds as pixels. */
export function heightGridReference(bytes:Buffer){
 const order=bytes.toString('ascii',0,2),little=order==='II';
 if(!['II','MM'].includes(order))throw Error('Not TIFF');
 const u16=(n:number)=>little?bytes.readUInt16LE(n):bytes.readUInt16BE(n),u32=(n:number)=>little?bytes.readUInt32LE(n):bytes.readUInt32BE(n),double=(n:number)=>little?bytes.readDoubleLE(n):bytes.readDoubleBE(n);
 if(u16(2)!==42)throw Error('Height grid requires classic TIFF');
 const offset=u32(4),count=u16(offset),tags=new Map<number,number[]|string>();
 for(let i=0;i<count;i++){
  const p=offset+2+12*i,tag=u16(p),type=u16(p+2),n=u32(p+4);
  if(![33550,33922,34735,42113].includes(tag))continue;
  const size=({2:1,3:2,12:8} as Record<number,number>)[type];if(!size||n>256)throw Error('Unsupported height grid tag');
  const at=n*size<=4?p+8:u32(p+8);
  tags.set(tag,type===2?bytes.toString('ascii',at,at+n).replace(/\0/g,''):Array.from({length:n},(_,j)=>type===12?double(at+j*8):u16(at+j*2)));
 }
 const scale=tags.get(33550) as number[]|undefined,tie=tags.get(33922) as number[]|undefined,keys=tags.get(34735) as number[]|undefined;
 if(!scale||!tie||!keys||scale.length!==3||tie.length!==6||tie.slice(0,3).some(n=>n!==0)||!scale.every(Number.isFinite)||scale[0]<=0||scale[1]<=0||!tie.every(Number.isFinite))throw Error('Height grid lacks north-up scale/tiepoint');
 const key=(id:number)=>{for(let i=4;i<keys.length;i+=4)if(keys[i]===id&&keys[i+1]===0&&keys[i+2]===1)return keys[i+3];};
 if(key(3072)!==28992||key(1025)!==1)throw Error('Height grid must be EPSG28992 PixelIsArea');
 return {origin:[tie[3],tie[4]] as [number,number],step:[scale[0],scale[1]] as [number,number],epsg:28992 as const,noData:Number(tags.get(42113))};
}
export async function readHeightGrid(file:string):Promise<HeightGrid>{
 const bytes=await fs.readFile(file),reference=heightGridReference(bytes),meta=await sharp(bytes).metadata();
 if(meta.format!=='tiff'||meta.depth!=='float'||meta.bitsPerSample!==32||meta.channels!==1||meta.orientation!==1)throw Error('Height grid requires upright float32 grayscale TIFF');
 const {data,info}=await sharp(bytes).raw({depth:'float'}).toBuffer({resolveWithObject:true});
 const raw=new Float32Array(data.buffer,data.byteOffset,data.length/4),values=new Float32Array(info.width*info.height);
 for(let i=0;i<values.length;i++)values[i]=raw[i*info.channels];
 return {...reference,width:info.width,height:info.height,values};
}
export function heightGridSamples(grid:HeightGrid,ring:number[][],minDepth?:{origin:number[];back:number[];afterM:number},holes:number[][][]=[]){
 if(ring.length<3||ring.some(p=>p.length<2||!p.slice(0,2).every(Number.isFinite)))throw Error('Invalid sampled native ring');
 const inside=(p:number[],polygon:number[][])=>{let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }return yes;};
 const samples:{rd:number[];heightNapM:number|null;valid:boolean;column:number;row:number}[]=[];
 for(let y=0;y<grid.height;y++)for(let x=0;x<grid.width;x++){
  const rd=[grid.origin[0]+(x+.5)*grid.step[0],grid.origin[1]-(y+.5)*grid.step[1]];
  if(!inside(rd,ring)||holes.some(h=>inside(rd,h))||minDepth&&(rd[0]-minDepth.origin[0])*minDepth.back[0]+(rd[1]-minDepth.origin[1])*minDepth.back[1]<=minDepth.afterM)continue;
  const h=grid.values[y*grid.width+x],valid=Number.isFinite(h)&&h!==grid.noData&&h>=-20&&h<=100;
  samples.push({rd,heightNapM:valid?h:null,valid,column:x,row:y});
 }
 return samples;
}
