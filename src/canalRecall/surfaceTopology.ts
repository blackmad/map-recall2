/** Clip already constrained land triangles to a native terrain tile. */
export function clipLandTriangles(land:Float32Array,parentX:number,parentY:number,z:number,x:number,y:number,extent=8192) {
 const factor=2**(z-14),dx=(x-parentX*factor)*extent,dy=(y-parentY*factor)*extent;
 const vertices:number[]=[],indices:number[]=[],segments:Array<{vertexOffset:number;primitiveOffset:number;vertexLength:number;primitiveLength:number}>=[];
 let segment={vertexOffset:0,primitiveOffset:0,vertexLength:0,primitiveLength:0};
 for(let at=0;at<land.length;at+=6){
  let ring:number[][]=Array.from({length:3},(_,i)=>[land[at+i*2]*factor-dx,land[at+i*2+1]*factor-dy]);
  if(Math.max(...ring.map(p=>p[0]))<0||Math.min(...ring.map(p=>p[0]))>extent||Math.max(...ring.map(p=>p[1]))<0||Math.min(...ring.map(p=>p[1]))>extent)continue;
  for(const [axis,edge,sign] of [[0,0,1],[0,extent,-1],[1,0,1],[1,extent,-1]]){
   const clipped:number[][]=[];
   for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],insideA=(a[axis]-edge)*sign>=0,insideB=(b[axis]-edge)*sign>=0;
    if(insideA)clipped.push(a);
    if(insideA!==insideB){const t=(edge-a[axis])/(b[axis]-a[axis]);clipped.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
   }
   ring=clipped;if(!ring.length)break;
  }
  const start=vertices.length/3;
  if(start-segment.vertexOffset+ring.length>65535){segments.push(segment);segment={vertexOffset:start,primitiveOffset:indices.length/3,vertexLength:0,primitiveLength:0};}
  const base=start-segment.vertexOffset;
  const rounded=ring.map(p=>[Math.round(p[0]),Math.round(p[1])]);
  for(const p of rounded)vertices.push(p[0],p[1],0);
  for(let i=1;i<ring.length-1;i++){
   const a=rounded[0],b=rounded[i],c=rounded[i+1];
   // Mercator y points down; native terrain triangles use this winding.
   const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(!area)continue;
   indices.push(base,base+(area<0?i:i+1),base+(area<0?i+1:i));
   segment.primitiveLength++;
  }
  segment.vertexLength=vertices.length/3-segment.vertexOffset;
 }
 segments.push(segment);
 return {vertices:new Int16Array(vertices),indices:new Uint16Array(indices),segments};
}
