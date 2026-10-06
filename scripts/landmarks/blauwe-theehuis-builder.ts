import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './blauwe-theehuis-footprints.json';
/** Native east/south original pavilion; the circular terrace remains open under its slab. */
export function buildBlauweTheehuis(_w:number,_d:number,b:BuildingTools){
 const [lng0,lat0]=source.anchor;
 const local=([lng,lat]:number[])=>new T.Vector2((lng-lng0)*111320*Math.cos(lat0*Math.PI/180),-(lat-lat0)*110540);
 const core=source.bag.geometry.coordinates[0].slice(0,-1).map(local);
 const terrace=source.terraceRing.slice(0,-1).map(local);
 const winding=Math.sign(core.reduce((sum,p,i)=>{const q=core[(i+1)%core.length];return sum+p.x*q.y-q.x*p.y;},0));
 const shape=(ring:T.Vector2[])=>new T.Shape(ring);
 const slab=(ring:T.Vector2[],y:number,h:number,c:Parameters<BuildingTools['add']>[1])=>{b.add(openTopPrism(shape(ring),y,y+h),c);b.add(upwardRoofPlane(shape(ring),y+h),c);};
 const circle=(r:number,n=64)=>Array.from({length:n},(_,i)=>new T.Vector2(r*Math.cos(i*2*Math.PI/n),r*Math.sin(i*2*Math.PI/n)));
 const beam=(a:T.Vector3,q:T.Vector3,r:number,c:Parameters<BuildingTools['add']>[1])=>{const d=q.clone().sub(a),g=new T.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()));const m=a.clone().add(q).multiplyScalar(.5);b.add(g,c,m.x,m.y,m.z);};
 slab(terrace,0,.18,'concrete'); // two low podium steps, no opaque terrace extrusion
 slab(circle(9.9),.18,.16,'concrete');
 b.add(openTopPrism(shape(core),.34,3.25),'white');
 slab(terrace,3.25,.22,'white');
 // 12 blue steel columns, outboard of the star's peaks; no wall in the open annulus.
 for(let i=0;i<12;i++){const a=i*Math.PI/6,x=8.1*Math.cos(a),z=8.1*Math.sin(a);b.add(new T.CylinderGeometry(.095,.095,2.91,8),'blue',x,1.795,z);for(let j=0;j<4;j++){const t=j*Math.PI/2;b.add(new T.SphereGeometry(.105,6,4),'white',x+.2*Math.cos(t),3.1,z+.2*Math.sin(t));}}
 // Current perimeter glazing is attached to surveyed star segments, never to a box.
 for(let i=0;i<core.length;i++){const a=core[i],q=core[(i+1)%core.length],len=a.distanceTo(q);if(len<.6)continue;const m=a.clone().add(q).multiplyScalar(.5),normal=new T.Vector2(q.y-a.y,a.x-q.x).normalize().multiplyScalar(.065*winding),angle=-Math.atan2(q.y-a.y,q.x-a.x);if(len>1){b.box(m.x+normal.x,.82,m.y+normal.y,len*.78,2.15,.09,'glass',angle);for(const y of [.78,2.75])b.box(m.x+normal.x,y,m.y+normal.y,len*.84,.09,.13,'blue',angle);for(const t of [.13,.5,.87]){const p=a.clone().lerp(q,t).add(normal);b.box(p.x,.78,p.y,.09,2.17,.12,'blue',angle);}}}
 const upper=circle(4.6,12);slab(upper,3.47,.45,'white');
 // Upper wall is glazing between genuine blue frames; the pane is the wall first-hit.
 for(let i=0;i<12;i++){const a=upper[i],q=upper[(i+1)%12],m=a.clone().add(q).multiplyScalar(.5),len=a.distanceTo(q),angle=-Math.atan2(q.y-a.y,q.x-a.x);b.box(m.x,3.92,m.y,len,2.12,.12,'glass',angle);for(const t of [0,1/3,2/3]){const p=a.clone().lerp(q,t);b.box(p.x,3.86,p.y,.11,2.31,.14,'blue',angle);}for(const y of [3.87,5.68,6.12])b.box(m.x,y,m.y,len,.11,.15,'blue',angle);}
 slab(circle(6.1),6.15,.23,'white');
 // The roof crown is a thin OPEN ring, not a solid roof plate above a hidden cap.
 const crown=shape(circle(6));crown.holes.push(new T.Path(circle(5.63).reverse()));b.add(openTopPrism(crown,7.12,7.3),'blue');b.add(upwardRoofPlane(crown,7.3),'blue');
 for(let i=0;i<12;i++){const a=i*Math.PI/6;b.box(5.43*Math.cos(a),6.38,5.43*Math.sin(a),.17,.74,.17,'white');}
 // Fine blue circular terrace rail with vertical bars; gates omitted at stair landing.
 for(let i=0;i<64;i++){const a=i*2*Math.PI/64,q=(i+1)*2*Math.PI/64;if(i>=23&&i<=26)continue;const p=(t:number,y:number)=>new T.Vector3(9.8*Math.cos(t),y,9.8*Math.sin(t));beam(p(a,4.53),p(q,4.53),.055,'blue');beam(p(a,3.61),p(a,4.53),.035,'blue');}
 // Pond-side northwest tangential stair, thin treads leave open space underneath.
 const rot=-3*Math.PI/4,origin=new T.Vector3(-7.6,0,-7.6),dir=new T.Vector3(Math.cos(rot),0,-Math.sin(rot));
 for(let i=0;i<18;i++){const m=origin.clone().addScaledVector(dir,(17-i)*.25);b.box(m.x,.34+i*.174,m.z,1.4,.09,.29,'slate',rot+Math.PI/2);}
 for(const s of [-1,1]){const side=new T.Vector3(-dir.z,0,dir.x).multiplyScalar(s*.66);const a=origin.clone().addScaledVector(dir,4.35).add(side);a.y=1.32;const q=origin.clone().add(side);q.y=4.46;beam(a,q,.047,'blue');}
}
