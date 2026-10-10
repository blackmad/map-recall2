import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './nemo-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
type Point=[number,number];
/** Every footprint ring in nemo-footprints.json is clockwise in (x,z); the triangles were emitted facing inward, so each triangle is re-wound (b<->c). */
function faceOutward(v:number[]){const o=v.slice();for(let i=0;i+8<o.length;i+=9)for(let k=0;k<3;k++){const t=o[i+3+k];o[i+3+k]=o[i+6+k];o[i+6+k]=t;}return o;}
/** ShapeGeometry faces are CCW in XY; mapping Y onto Z reflects them to face down, so re-wind to face up. */
function flipFaces(g:T.BufferGeometry){const ix=g.index!;for(let i=0;i<ix.count;i+=3){const t=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,t);}}
/** Original copper shell; surveyed outlines and maxima, photo-guided profiles. */
export function buildNemo(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 function mesh(v:number[],colour:Colour){if(!v.length)return;v=faceOutward(v);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,colour);}
 function clipped(ring:number[][],z:number,keepNorth:boolean){const out:Point[]=[];for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],ina=keepNorth?a[1]<=z:a[1]>=z,inq=keepNorth?q[1]<=z:q[1]>=z;if(ina)out.push([a[0],a[1]]);if(ina!==inq){const t=(z-a[1])/(q[1]-a[1]);out.push([a[0]+(q[0]-a[0])*t,z]);}}return out;}
 function roof(ring:number[][],height:(z:number)=>number,colour:Colour,z0:number,z1:number,bands:number,steps=false){
  for(let i=0;i<bands;i++){const lo=z0+(z1-z0)*i/bands,hi=z0+(z1-z0)*(i+1)/bands,p=clipped(clipped(ring,lo,false),hi,true);if(p.length<3)continue;const g=new T.ShapeGeometry(new T.Shape(p.map(q=>new T.Vector2(...q)))),v=g.getAttribute('position'),y=height(lo);for(let j=0;j<v.count;j++){const x=v.getX(j),z=v.getY(j);v.setXYZ(j,x,steps?y:height(z),z);}flipFaces(g);g.computeVertexNormals();add(g,colour);
   if(steps&&i<bands-1){const onEdge=p.filter(q=>Math.abs(q[1]-hi)<1e-5).sort((a,q)=>a[0]-q[0]);if(onEdge.length>=2){const a=onEdge[0],q=onEdge.at(-1)!,next=height(hi);mesh([a[0],y,hi,q[0],y,hi,q[0],next,hi,a[0],y,hi,q[0],next,hi,a[0],next,hi],colour);}}
  }
 }
 for(const part of source.parts){
  const tags=part.properties as Record<string,string>,top=Number(tags.height),[x0,z0,x1,z1]=part.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
  const stairs=part.osmId==='w1390692772',green=tags['roof:material']==='grass',brick=tags['building:material']==='brick',flat=tags['roof:shape']!=='skillion';
  const rise=stairs?19.2:green?10:part.osmId==='w1390692764'?12:Math.min(18,top-2.5);
  const height=(z:number)=>flat?top:top-rise*Math.pow(Math.max(0,Math.min(1,(z-z0)/(z1-z0))),1.28);
  const roofColour:Colour=stairs?'stone':green?'green':tags['roof:colour']==='white'?'white':flat?'frame':'copper';
  for(const poly of part.localPolygons){
   const ring=poly[0].slice(0,-1),upper:number[]=[],lower:number[]=[],base:number[]=[],bands=stairs?110:flat?1:48;
   // Wall top edges share every roof-band crossing. For stair roofs each
   // segment meets its horizontal tread; the roof riser closes the junction.
   const perimeter:Point[]=[];
   for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],cuts=[0,1];if(Math.abs(q[1]-a[1])>1e-8)for(let k=1;k<bands;k++){const t=(z0+(z1-z0)*k/bands-a[1])/(q[1]-a[1]);if(t>1e-8&&t<1-1e-8)cuts.push(t);}cuts.sort((a,b)=>a-b);for(const t of cuts.slice(0,-1))perimeter.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t]);}
   for(let i=0;i<perimeter.length;i++){
    const a=perimeter[i],q=perimeter[(i+1)%perimeter.length],band=Math.min(bands-1,Math.max(0,Math.floor(((a[1]+q[1])/2-z0)/(z1-z0)*bands))),tread=height(z0+(z1-z0)*band/bands),ha=stairs?tread:height(a[1]),hq=stairs?tread:height(q[1]),bottomA=Math.min(5.8,ha),bottomQ=Math.min(5.8,hq),ax=cx+(a[0]-cx)*.94,az=cz+(a[1]-cz)*.94,qx=cx+(q[0]-cx)*.94,qz=cz+(q[1]-cz)*.94;
    upper.push(ax,bottomA,az,qx,bottomQ,qz,q[0],hq,q[1],ax,bottomA,az,q[0],hq,q[1],a[0],ha,a[1]);
    lower.push(ax,1,az,qx,1,qz,qx,bottomQ,qz,ax,1,az,qx,bottomQ,qz,ax,bottomA,az);
    base.push(ax,0,az,qx,0,qz,qx,1,qz,ax,0,az,qx,1,qz,ax,1,az);
   }
   mesh(upper,brick?'brick':'copper');mesh(lower,brick?'brick':'glass');mesh(base,'brick');
   roof(ring,height,roofColour,z0,z1,bands,stairs);
  }
 }
 // Exterior-only sparse vents. Large copper panels remain
 // visually dominant; the museum is not a conventional window-grid block.
 const ring=source.parent.localPolygons[0][0],winding=Math.sign(ring.slice(0,-1).reduce((s,p,i)=>s+p[0]*ring[i+1][1]-ring[i+1][0]*p[1],0))||1;
 for(let i=0;i<ring.length-1;i++){
  const p=ring[i],q=ring[i+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<.7)continue;
  const mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2,part=source.parts.filter(s=>s.localPolygons.some(poly=>poly[0].some(v=>Math.hypot(v[0]-mx,v[1]-mz)<len*.6+.15))).sort((a,b)=>Number(b.properties.height)-Number(a.properties.height))[0];if(!part)continue;
  const [x0,z0,x1,z1]=part.bounds,top=Number(part.properties.height),flat=part.properties['roof:shape']!=='skillion',rise=part.osmId==='w1390692764'?12:Math.min(18,top-2.5),h=flat?top:top-rise*Math.pow(Math.max(0,Math.min(1,(mz-z0)/(z1-z0))),1.28),a=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(a),nz=Math.cos(a);

  if(len>4.5&&h>13){const x=mx+nx*.08,z=mz+nz*.08;for(let u=-1;u<=1;u++)for(let row=0;row<2;row++)box(x+Math.cos(a)*u*.8,Math.min(13,h-3)+row*.65,z-Math.sin(a)*u*.8,.48,.42,.08,'dark',a);}
 }
}
