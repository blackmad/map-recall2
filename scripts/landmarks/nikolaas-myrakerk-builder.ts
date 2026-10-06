import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './nikolaas-myrakerk-footprints.json';
export function fitNikolaasMyrakerkSurveyPlane(rings:number[][][]){
 const points=rings.flat(),count=points.length;
 const centre=points.reduce((sum,p)=>sum.map((v,i)=>v+p[i]),[0,0,0]).map(v=>v/count);
 let xx=0,xz=0,zz=0,xy=0,zy=0;
 for(const p of points){const x=p[0]-centre[0],y=p[1]-centre[1],z=p[2]-centre[2];xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
 const determinant=xx*zz-xz*xz;
 if(!(determinant>1e-12*xx*zz))throw Error('NikolaasMyrakerk survey roof has no stable projected plane');
 const slopeX=(xy*zz-zy*xz)/determinant,slopeZ=(zy*xx-xy*xz)/determinant;
 const height=(x:number,z:number)=>centre[1]+slopeX*(x-centre[0])+slopeZ*(z-centre[2]);
 const residual=Math.max(...points.map(p=>Math.abs(height(p[0],p[2])-p[1])));
 if(residual>.01)throw Error(`NikolaasMyrakerk source roof is not planar within1cm: ${residual}m`);
 return {height,residual};
}

/** Original surveyed hidden-church complex: two genuine BAG parents, open forecourt. */
export function buildNikolaasMyrakerk(_w:number,_d:number,b:BuildingTools){
 type Colour=Parameters<BuildingTools['add']>[1];const angle=source.authorAngleRadians;
 const backing:T.Mesh[]=[];let windowProbe:object|undefined;
 const backingMaterial=new T.MeshBasicMaterial({side:T.DoubleSide});
 const at=(x:number,z:number)=>[x*Math.cos(angle)+z*Math.sin(angle),-x*Math.sin(angle)+z*Math.cos(angle)];
 function add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0){if(c==='glass'&&windowProbe)g.userData.windowProbe=windowProbe;const q=at(x,z);b.add(g,c,q[0],y,q[1],angle+a);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,a=0){if(c==='glass'){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);return;}const q=at(x,z);b.box(q[0],y,q[1],w,h,d,c,angle+a);}
 // The raw AHN roof survey informs original footprint-region shells and bounded
 // planar roof surfaces. No source render meshes, walls, textures or pixels are imported.
 for(const part of source.parts)for(const plane of part.roofPlanes){
  const ring=plane.rings[0],shape=new T.Shape(ring.map(p=>new T.Vector2(p[0],p[2])));
  for(const h of plane.rings.slice(1))shape.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[2]))));
  const base=Math.min(...ring.map(p=>p[1])),colour:Colour='brick';
  const shell=openTopPrism(shape,0,base);shell.userData.role='survey-shell';backing.push(new T.Mesh(shell.clone(),backingMaterial));add(shell,colour);
  const {height,residual}=fitNikolaasMyrakerkSurveyPlane(plane.rings);
  const top=new T.ShapeGeometry(shape),positions=top.getAttribute('position');
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getY(i);positions.setXYZ(i,x,height(x,z),z);}
  const ix=top.index!;for(let i=0;i<ix.count;i+=3){const a=new T.Vector3().fromBufferAttribute(positions,ix.getX(i)),q=new T.Vector3().fromBufferAttribute(positions,ix.getX(i+1)),r=new T.Vector3().fromBufferAttribute(positions,ix.getX(i+2));if(q.sub(a).cross(r.sub(a)).y<0){const j=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,j);}}
  top.computeVertexNormals();top.userData.role='roof';top.userData.sourceRings=plane.rings;top.userData.sourceResidualMetres=residual;add(top,'slate');
  const sides:number[]=[];for(const points of plane.rings)for(let i=0;i<points.length;i++){const a=points[i],q=points[(i+1)%points.length];sides.push(a[0],base,a[2],q[0],base,q[2],q[0],q[1],q[2],a[0],base,a[2],q[0],q[1],q[2],a[0],a[1],a[2]);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(sides,3));g.computeVertexNormals();g.userData.role='survey-side';backing.push(new T.Mesh(g.clone(),backingMaterial));add(g,colour);
 }
 // Details follow the surveyed perimeter. Three round-headed lights occupy each
 // Tichelstraat bay; the upper nave has smaller clerestory openings.
 function arch(x:number,y:number,z:number,w:number,h:number,c:Colour,a:number){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.065,bevelEnabled:false,curveSegments:10}),c,x,y,z,a);}
 function window(x:number,y:number,z:number,w:number,h:number,a:number,round=true){
  const n=[Math.sin(a),Math.cos(a)],t=[Math.cos(a),-Math.sin(a)];
  windowProbe={x,y,z,w,h,a,round};
  if(round){arch(x,y-.09,z,w+.18,h+.18,'frame',a);arch(x+n[0]*.09,y,z+n[1]*.09,w,h,'glass',a);}else{box(x,y-.09,z,w+.18,h+.18,.12,'white',a);box(x+n[0]*.10,y,z+n[1]*.10,w,h,.08,'glass',a);}
  box(x+n[0]*.20,y+.1,z+n[1]*.20,.045,h-w*.55,.05,'frame',a);
  for(let v=.55;v<h-w*.6;v+=.55)box(x+n[0]*.20,y+v,z+n[1]*.20,w,.035,.05,'frame',a);
  box(x+n[0]*.1,y-.18,z+n[1]*.1,w+.35,.15,.36,'stone',a);
  windowProbe=undefined;return {n,t};
 }
 const poly=source.parts[0].localPolygon;
 function wall(i:number,j:number){return wallPoints(poly[i],poly[j]);}
 function wallPoints(p:number[],q:number[]){const len=Math.hypot(q[0]-p[0],q[1]-p[1]),t=[(q[0]-p[0])/len,(q[1]-p[1])/len],n=[-t[1],t[0]],a=Math.atan2(n[0],n[1]);return{p,q,len,t,n,a,point:(u:number,off=.16)=>[p[0]+t[0]*u+n[0]*off,p[1]+t[1]*u+n[1]*off]};}
 // East street wall runs from the north end to the south end. Native polygon
 // is clockwise in east/south coordinates; this edge's outward side is east.
 const street=wall(28,0);
 for(let bay=0;bay<6;bay++){const u=3+bay*5.48;
  for(const [dx,w,h] of [[-1.12,.83,2.35],[0,.94,2.95],[1.12,.83,2.35]]){const p=street.point(u+dx);window(p[0],1.90,p[1],w,h,street.a);}
  if(bay>0){const p=street.point(u);const ray=new T.Raycaster(new T.Vector3(p[0],10,p[1]),new T.Vector3(-street.n[0],0,-street.n[1]));const face=ray.intersectObjects(backing)[0];if(!face)throw Error('Missing surveyed nave backing for clerestory');window(face.point.x+street.n[0]*.16,9.25,face.point.z+street.n[1]*.16,.9,1.6,street.a,false);}
 }
 for(const y of [5.60,6.05]){const p=street.point(street.len/2);box(p[0],y,p[1],street.len,.16,.26,'brick',street.a);}
 for(let u=.6;u<street.len;u+=.76){const p=street.point(u);box(p[0],5.73,p[1],.19,.27,.27,'brick',street.a);}
 // Oculus is on the northern gable, visible above the lower adjoining aisle.
 const north=wall(0,3),oc=north.point(8.5,.23);add(new T.CylinderGeometry(.84,.84,.1,24).rotateX(Math.PI/2),'stone',oc[0],14.2,oc[1],north.a);add(new T.CylinderGeometry(.68,.68,.1,24).rotateX(Math.PI/2),'glass',oc[0]+north.n[0]*.10,14.2,oc[1]+north.n[1]*.10,north.a);
 // Monastery courtyard-facing two domestic upper levels and low arched hall.
 // The upper monastery follows roof-plane12's actual wall perimeter; the BAG
 // parcel outline also encloses low boundary walls and cannot own upper panes.
 const upper=source.parts[0].roofPlanes[12].rings[0].map(p=>[p[0],p[2]]);
 for(const [i,j,count] of [[0,1,3],[1,2,4],[3,4,2],[4,5,1],[5,6,3]]){const f=wallPoints(upper[i],upper[j]);for(let k=0;k<count;k++){const p=f.point((k+.5)*f.len/count,.16);for(const y of [4.8,8.5])window(p[0],y,p[1],1.04,1.8,f.a,false);}}
 // Photographed northern street end: small doorway beneath a round light.
 const entry=street.point(street.len-1.48);box(entry[0],.28,entry[1],1.48,2.20,.12,'stone',street.a);
 box(entry[0]+street.n[0]*.10,.38,entry[1]+street.n[1]*.10,1.22,1.94,.08,'dark',street.a);
 box(entry[0]+street.n[0]*.15,2.30,entry[1]+street.n[1]*.15,1.22,.10,.055,'frame',street.a);
 add(new T.CylinderGeometry(.85,.85,.11,24).rotateX(Math.PI/2),'frame',entry[0],4.07,entry[1],street.a);
 add(new T.CylinderGeometry(.70,.70,.10,24).rotateX(Math.PI/2),'glass',entry[0]+street.n[0]*.10,4.07,entry[1]+street.n[1]*.10,street.a);

 // Original small open timber/slate bell lantern: four corner posts, no opaque
 // cube across the apertures. Dimensions estimated from the2017 photographs.
 const tx=4.9,tz=-10.8;
 box(tx,19.3,tz,2.1,.65,2.1,'slate');
 for(const dx of [-.86,.86])for(const dz of [-.86,.86])box(tx+dx,19.9,tz+dz,.16,2.5,.16,'white');
 for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const nx=Math.sin(a),nz=Math.cos(a);box(tx+nx*.87,22.1,tz+nz*.87,1.85,.18,.17,'white',a);box(tx+nx*.87,20.10,tz+nz*.87,1.85,.1,.13,'white',a);}
 add(new T.ConeGeometry(1.65,4.05,4).rotateY(Math.PI/4),'slate',tx,24.24,tz);
 box(tx,26.20,tz,.07,1.06,.07,'dark');box(tx,26.90,tz,.65,.07,.07,'dark');
 add(new T.SphereGeometry(.11,8,4),'gold',tx,26.12,tz);
 // Canal boundary wall with open entrance; it is independently thin rather
 // than filling the forecourt notch with a parcel extrusion.
 const entrance=wall(5,17),gateU=entrance.len*.60;
 for(const [u,len] of [[gateU/2-.7,gateU-1.4],[(gateU+entrance.len)/2+.7,entrance.len-gateU-1.4]]){const p=entrance.point(u,0);box(p[0],0,p[1],len,2.8,.24,'brick',entrance.a);box(p[0],0,p[1],len,1.3,.28,'stone',entrance.a);box(p[0],2.8,p[1],len,.15,.40,'red',entrance.a);}
 for(let u=gateU-1.2;u<=gateU+1.2;u+=.23){const p=entrance.point(u);box(p[0],.12,p[1],.045,2.7,.045,'dark');}for(const y of [.5,2.5]){const p=entrance.point(gateU);box(p[0],y,p[1],2.5,.07,.07,'dark',entrance.a);}
 // Source-supported1930s heating chimney, approximate position in courtyard.
 box(-6.8,0,-4.8,.75,14.6,.8,'brick');box(-6.8,14.6,-4.8,.91,.18,.96,'stone');
}
