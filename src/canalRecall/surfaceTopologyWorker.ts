import {clipLandTriangles} from './surfaceTopology.js';
const chunks=new Map<string,{land:Float32Array;bins:Map<number,number[]>}>();
self.onmessage=(event:MessageEvent)=>{
 const message=event.data;
 if(message.type==='install'){
  const land=new Float32Array(message.land),bins=new Map<number,number[]>();
  for(let at=0;at<land.length;at+=6){
   const x0=Math.max(0,Math.min(63,Math.floor(Math.min(land[at],land[at+2],land[at+4])/128))),x1=Math.max(0,Math.min(63,Math.floor(Math.max(land[at],land[at+2],land[at+4])/128)));
   const y0=Math.max(0,Math.min(63,Math.floor(Math.min(land[at+1],land[at+3],land[at+5])/128))),y1=Math.max(0,Math.min(63,Math.floor(Math.max(land[at+1],land[at+3],land[at+5])/128)));
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=x+y*64;if(!bins.has(key))bins.set(key,[]);bins.get(key)!.push(at);}
  }
  chunks.delete(message.key);chunks.set(message.key,{land,bins});return;
 }
 if(message.type==='remove'){chunks.delete(message.key);return;}
 try{
  const chunk=chunks.get(message.parent);if(!chunk)throw Error('Surface chunk evicted');
  const factor=2**(message.z-14),x=message.x-message.parentX*factor,y=message.y-message.parentY*factor,selected=new Set<number>();
  for(let bx=Math.max(0,Math.floor(x/factor*64));bx<=Math.min(63,Math.floor((x+1)/factor*64));bx++)for(let by=Math.max(0,Math.floor(y/factor*64));by<=Math.min(63,Math.floor((y+1)/factor*64));by++)for(const at of chunk.bins.get(bx+by*64)||[])selected.add(at);
  const local=new Float32Array(selected.size*6);let offset=0;for(const at of selected){local.set(chunk.land.subarray(at,at+6),offset);offset+=6;}
  const result=clipLandTriangles(local,message.parentX,message.parentY,message.z,message.x,message.y);
  (self as any).postMessage({id:message.id,key:message.key,...result},[result.vertices.buffer,result.indices.buffer]);
 }catch(error){(self as any).postMessage({id:message.id,key:message.key,error:String(error)});}
};
