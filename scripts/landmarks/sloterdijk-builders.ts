import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './sloterdijk-specs.json';
import sources from './sloterdijk-footprints.json';
import {buildSloterdijkStation} from './sloterdijk-station-builder';

/** Hall floor and the viaduct deck under the vaults. The hall glass stands on the Orlyplein ground in panorama w03 and the game ground is flat there, so the floor is 0 (OSM min_height 8 is the concourse over the low tracks, left the hall floating in the ride). */
export const STATION_LEVELS={hallFloor:0,deck:8.0};

/** Raised, open transport hall and a separate white pronged office building. */
export function buildSloterdijkLandmark(id:string,_width:number,_depth:number,b:BuildingTools):void{
 type P=[number,number];type C=Parameters<BuildingTools['add']>[1];
 const spec=specs.find(s=>s.id===id),source=sources.find(s=>s.id===id);if(!spec||!source)throw Error('Unknown Sloterdijk asset '+id);
 const [lng,lat]=spec.surveyed.anchor;
 const local=([x,y]:number[]):P=>[(x-lng)*111320*Math.cos(lat*Math.PI/180),-(y-lat)*110540];
 const r=source.geometry.coordinates[0].map(local);r.pop();
 // Remove only centimetric redundant survey vertices, preserving the real
 // concave wing bays and the curved office entrance.
 let changed=true;while(changed&&r.length>4){changed=false;for(let i=0;i<r.length;i++){const a=r[(i+r.length-1)%r.length],p=r[i],q=r[(i+1)%r.length],l=Math.hypot(q[0]-a[0],q[1]-a[1]);if(l&&Math.abs((p[0]-a[0])*(q[1]-a[1])-(p[1]-a[1])*(q[0]-a[0]))/l<.075&&Math.hypot(p[0]-a[0],p[1]-a[1])+Math.hypot(p[0]-q[0],p[1]-q[1])<l+.075){r.splice(i,1);changed=true;break}}}
 const shape=new T.Shape(r.map(p=>new T.Vector2(...p)));
 function layer(base:number,top:number,c:C){const g=new T.ExtrudeGeometry(shape,{depth:top-base,bevelEnabled:false});g.rotateX(Math.PI/2);b.add(g,c,0,top,0)}
 function strut(a:number[],q:number[],radius:number,c:C='white'){const v=new T.Vector3(...q).sub(new T.Vector3(...a)),g=new T.CylinderGeometry(radius,radius,v.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));b.add(g,c,(a[0]+q[0])/2,(a[1]+q[1])/2,(a[2]+q[2])/2)}
 if(id==='sloterdijk-station'){
  // Rebuilt 2026-11-10 (user: "needs to be modeled", the old model read as a glass box and a truss): both vaults,
  // their viaducts, the wedge concourse, the Regenboogpad and the low-level canopies (sloterdijk-station-builder.ts).
  buildSloterdijkStation(b,STATION_LEVELS);
 }else{
  layer(0,36.66,'white');layer(36.66,36.85,'slate');
  const area=r.reduce((s,p,i)=>s+p[0]*r[(i+1)%r.length][1]-r[(i+1)%r.length][0]*p[1],0);
  for(let i=0;i<r.length;i++){
   const a=r[i],q=r[(i+1)%r.length],dx=q[0]-a[0],dz=q[1]-a[1],l=Math.hypot(dx,dz);if(l<.9)continue;const nx=(area>0?dz:-dz)/l,nz=(area>0?-dx:dx)/l,angle=-Math.atan2(dz,dx),count=Math.max(1,Math.floor(l/3.15));
   for(let floor=0;floor<8;floor++){const y=floor?5.0+(floor-1)*4.45:1.1;for(let j=0;j<count;j++){const t=(j+.5)/count,x=a[0]+dx*t+nx*.08,z=a[1]+dz*t+nz*.08;b.box(x,y,z,1.9,floor===7?3.4:1.85,.13,'frame',angle);b.box(x+nx*.08,y+.09,z+nz*.08,1.7,floor===7?3.18:1.62,.08,'glass',angle)}}
  }
  // The measured tall central plant follows a narrow spine. It is not a
  // ninth floor across all three white wings.
  b.box(1.6,36.85,-5.2,9.0,5.25,38.0,'white');b.box(1.6,42.1,-5.2,9.4,.46,38.4,'slate');
  for(const x of[0,5.5])b.box(x,36.85,-28.0,4.4,2.75,3.0,'slate');
  // Exterior stairs are thin open flights and landing rails, not new blocks.
  for(const[x,z,angle]of[[20.6,-27.4,Math.PI/2],[-20.6,1.7,-1.268],[-14.4,29.3,-.969]]){
   const place=(dx:number,dz:number):P=>[x+dx*Math.cos(angle)+dz*Math.sin(angle),z-dx*Math.sin(angle)+dz*Math.cos(angle)];
   for(let floor=1;floor<=7;floor++){const y=5.0+(floor-1)*4.45;b.box(x,y,z,2.7,.16,3.0,'frame',angle);for(const side of[-1,1]){const p=place(side*1.28,0);b.box(p[0],y+.16,p[1],.075,1.0,3.0,'frame',angle)}const a=place(-1.1,-1.35),q=place(1.1,1.35);strut([a[0],y,a[1]],[q[0],y+4.45,q[1]],.08,'frame');for(let j=0;j<9;j++){const p=place(-1.1+2.2*j/9,-1.35+2.7*j/9);b.box(p[0],y+4.45*j/9,p[1],1.2,.11,.37,'frame',angle)}}
  }
  b.box(17.7,3.75,-6,7.0,.24,4.5,'white');b.sign('HNK',17.7,4.15,-3.65,.32,'dark');
 }
}
