import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './rai-europahal-footprints.json';
/** Native complete BAG-parent treatment plus exact source-supported projecting physical parts.
 * Periods remain distinct: Europacomplex1961, Westhal1963, Amstelhal1969.
 * The broad installed compoundw807090334 is not a whole-owned replacement alias.
 */
export function buildRaiEuropahal(_w:number,_d:number,b:BuildingTools):void {
  function add(g:T.BufferGeometry,c:Parameters<BuildingTools['add']>[1]) {g.rotateY(source.rotationY);b.add(g,c)}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Parameters<BuildingTools['add']>[1]) {const g=new T.BoxGeometry(w,h,d);g.translate(x,y+h/2,z);add(g,c)}
  function beam(a:T.Vector3,q:T.Vector3,w:number,c:Parameters<BuildingTools['add']>[1]) {const delta=q.clone().sub(a),g=new T.BoxGeometry(w,delta.length(),w);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const mid=a.clone().add(q).multiplyScalar(.5);g.translate(mid.x,mid.y,mid.z);add(g,c)}
  function shape(rings:number[][][]):T.Shape {const s=new T.Shape(rings[0].map(([x,z])=>new T.Vector2(x,z)));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(([x,z])=>new T.Vector2(x,z))));return s}
  for(const zone of source.zones) {
    // Named halls/Amstel glazing own their exact rings; parent cannot bury them.
    for(const rings of zone.modeledSections){const s=shape(rings);add(openTopPrism(s,0,zone.height),'concrete');add(upwardRoofPlane(s,zone.height),'greyBrick')}
    for(const rings of zone.roofBandSections)add(upwardRoofPlane(shape(rings),zone.height+.10),'concrete');
  }
  for(const hall of source.namedFlatHalls) {
    const s=shape(hall.rings);add(openTopPrism(s,0,hall.height),'concrete');add(upwardRoofPlane(s,hall.height),'greyBrick');
    for(const rings of hall.roofBandSections)add(upwardRoofPlane(shape(rings),hall.height+.10),'concrete');
  }
  for(const strip of source.westernRoofStrips) {
    function top(z:number){return strip.eaves+(strip.crest-strip.eaves)*(1-Math.abs(z-strip.ridgeZ)/((strip.zMax-strip.zMin)/2))}
    add(openTopPrism(shape(strip.modeledRings),0,strip.eaves),'glass');
    // Native clipped half-planes give each gable an upward roof and a supported perimeter.
    for(const rings of strip.roofSections){const g=upwardRoofPlane(shape(rings),0),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,top(p.getZ(i)));g.computeVertexNormals();add(g,'white')}
    const ring:number[][]=[];
    const original=strip.modeledRings[0];
    for(let i=0;i<original.length-1;i++){const a=original[i],q=original[i+1];ring.push(a);if((a[1]-strip.ridgeZ)*(q[1]-strip.ridgeZ)<0){const t=(strip.ridgeZ-a[1])/(q[1]-a[1]);ring.push([a[0]+t*(q[0]-a[0]),strip.ridgeZ])}}ring.push(ring[0]);
    for(let i=0;i<ring.length-1;i++) {
      const a=ring[i],q=ring[i+1],ya=top(a[1]),yq=top(q[1]);
      const v=[a[0],strip.eaves,a[1],q[0],strip.eaves,q[1],q[0],yq,q[1],a[0],strip.eaves,a[1],q[0],yq,q[1],a[0],ya,a[1]];
      // Clockwise intersection rings put their exterior on the left of each edge.
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,'glass');
      beam(new T.Vector3(a[0],ya+.06,a[1]),new T.Vector3(q[0],yq+.06,q[1]),.15,'frame');
    }
    // Aerial-supported repeat glazing bays; spacing is a bounded original approximation.
    for(const {x,zMin,zMax} of strip.frameProfiles) {
      for(const z of[zMin,zMax])box(x,strip.eaves,z,.12,top(z)-strip.eaves,.12,'frame');
      beam(new T.Vector3(x,top(zMin)+.05,zMin),new T.Vector3(x,15.05,strip.ridgeZ),.10,'frame');
      beam(new T.Vector3(x,15.05,strip.ridgeZ),new T.Vector3(x,top(zMax)+.05,zMax),.10,'frame');
    }
  }
  const q=source.barrel,x0=q.xMin,x1=q.xMax,zc=(q.zMin+q.zMax)/2,half=(q.zMax-q.zMin)/2;
  // Circular segment derived from real 67.5m span and explicitly approximate exterior rise.
  const rise=q.crest-q.eaves,R=(half*half+rise*rise)/(2*rise),yc=q.crest-R;
  function roof(z:number):number {return yc+Math.sqrt(R*R-(z-zc)*(z-zc))}
  const steps=24,profile=Array.from({length:steps+1},(_,i)=>{const z=q.zMin+i*(2*half/steps);return new T.Vector3(0,roof(z),z)});
  function roofStrip(a:number,c:number,material:Parameters<BuildingTools['add']>[1],lift=0) {
    const v:number[]=[];for(let i=0;i<steps;i++){const p=profile[i],r=profile[i+1];v.push(a,p.y+lift,p.z,a,r.y+lift,r.z,c,r.y+lift,r.z,a,p.y+lift,p.z,c,r.y+lift,r.z,c,p.y+lift,p.z)}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,material);
  }
  roofStrip(x0,x1,'concrete');
  // Repeated exposed arch-ribs are the hall's recognition feature; bounded original simplification.
  for(let x=x0;x<x1+.1;x+=6.7)roofStrip(x-.12,Math.min(x+.12,x1+.15),'white',.12);
  for(const z of[q.zMin,q.zMax])box((x0+x1)/2,0,z,x1-x0,q.eaves,.3,'concrete');
  for(const side of[-1,1]) {
    const x=side<0?x0:x1;
    const s=new T.Shape();s.moveTo(q.zMin,0);s.lineTo(q.zMax,0);for(let i=steps;i>=0;i--)s.lineTo(profile[i].z,profile[i].y);s.closePath();
    // Shape plane (z,y) converted to (x,y,z), retaining correct exterior winding.
    const g=new T.ShapeGeometry(s),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const z=p.getX(i),y=p.getY(i);p.setXYZ(i,x+side*.02,y,z)}
    if(side>0){const ix=g.index!;for(let i=0;i<ix.count;i+=3){const a=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,a)}}g.computeVertexNormals();add(g,'glass');
    for(let z=q.zMin+1.1;z<q.zMax;z+=2.7)box(x+side*.12,0,z,.18,roof(z)-.3,.12,'frame');
    for(const y of[3.1,6.3,9.5,12.7]) {
      const span=Math.sqrt(Math.max(0,R*R-(y-yc)*(y-yc))),h=Math.min(half-.5,span-.3);
      if(h>0)box(x+side*.14,y,zc,.20,.12,2*h,'frame');
    }
    for(let i=0;i<steps;i++)beam(new T.Vector3(x+side*.22,profile[i].y,profile[i].z),new T.Vector3(x+side*.22,profile[i+1].y,profile[i+1].z),.42,'white');
    // Source-supported outward inclined concrete constructive feet, no opaque entrance slab.
    for(const z of[q.zMin,q.zMax])beam(new T.Vector3(x+side*.5,0,z+(z<zc?-2.8:2.8)),new T.Vector3(x+side*.5,q.eaves,z),.65,'white');
  }
  // Surveyed eastern boundary chains own their panes, including the stepped northern frontage.
  const perimeter=source.localParentRings[0];
  for(let i=0;i<perimeter.length-1;i++) {
    const a=perimeter[i],q=perimeter[i+1],dz=q[1]-a[1],dx=q[0]-a[0];
    if(Math.abs(dz)<8||Math.abs(dx)>1||Math.min(a[0],q[0])<-55)continue;
    const lo=Math.min(a[1],q[1]),hi=Math.max(a[1],q[1]);
    for(let z=lo+1.8;z<hi-1;z+=3.4) {
      if(z>source.barrel.zMin&&z<source.barrel.zMax)continue;
      const x=a[0]+(z-a[1])*dx/dz;
      const top=z<-207?9.6:z<-79.4?9.4:7.3;
      box(x+.12,1,z,.16,top-1,2.9,'glass');
      for(const y of[3.2,6.2])box(x+.22,y,z,.18,.16,3.35,'white');
    }
  }
  // Entrance K's projecting canopy uses repeated shallow folded panels, no identification paint.
  for(let z=-77;z<-45;z+=6.7){const v=[5.8,8.6,z,11,8.4,z,11,9.1,z+3.35,5.8,8.6,z,11,9.1,z+3.35,5.8,9.3,z+3.35,5.8,9.3,z+3.35,11,9.1,z+3.35,11,8.4,z+6.7,5.8,9.3,z+3.35,11,8.4,z+6.7,5.8,8.6,z+6.7];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));const ix=Array.from({length:v.length/3},(_,i)=>i);for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];g.setIndex(ix);g.computeVertexNormals();add(g,'white')}
  // Het Signaal, original open triangular island structure. Operator's documented height51m.
  const [sx,sz]=source.signaal.center;add(openTopPrism(shape(source.signaal.rings),0,1.2),'concrete');add(upwardRoofPlane(shape(source.signaal.rings),1.2),'concrete');
  for(const [dx,dz]of[[-1.3,-.75],[1.3,-.75],[0,1.5]])box(sx+dx,1.2,sz+dz,.35,49.8,.35,'frame');
  for(let y=4;y<49;y+=5.5){
    const points=[new T.Vector3(sx-3.8,y,sz-2.2),new T.Vector3(sx+3.8,y,sz-2.2),new T.Vector3(sx,y,sz+4.3)];
    for(let i=0;i<3;i++)beam(points[i],points[(i+1)%3],.4,'frame');
    const s=new T.Shape(points.map(p=>new T.Vector2(p.x,p.z)));add(upwardRoofPlane(s,y),'concrete');
    // Panels remain subordinate architectural dark faces;2026 LED content/layout unconfirmed.
    if(y>9)for(let i=0;i<3;i++) {
      const a=points[i],q=points[(i+1)%3];beam(a.clone().add(new T.Vector3(0,1.1,0)),q.clone().add(new T.Vector3(0,1.1,0)),1.15,'dark');
    }
  }
}
