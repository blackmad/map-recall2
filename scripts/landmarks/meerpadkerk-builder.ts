import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './meerpadkerk-footprints.json';
import sign from './meerpadkerk-sign.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Exact BAG parent, metre-scale local east/south coordinates. 9A/9B are retained. */
export function buildMeerpadkerk(_w:number,_d:number,b:BuildingTools){
 const r=source.localRing.slice(0,-1).map(p=>new T.Vector2(p[0],p[1]));
 const front=r[0].clone().lerp(r[7],.5),u=r[7].clone().sub(r[0]).normalize(),n=new T.Vector2(u.y,-u.x),a=Math.atan2(n.x,n.y),width=r[0].distanceTo(r[7]);
 u.negate(); // local +X must match Three.js rotateY tangent (n.z,-n.x).
 const eave=source.heights.mainEaveAboveGround,ridge=source.heights.ridgeAboveGround;
 const at=(x:number,z:number)=>front.clone().addScaledVector(u,x).addScaledVector(n,z);
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour){const q=at(x,z);b.box(q.x,y,q.y,w,h,d,c,a);}
 function geometry(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0){const q=at(x,z);b.add(g,c,q.x,y,q.y,a);}
 function surface(points:T.Vector3[],c:Colour,up=false){const verts:number[]=[];for(let i=1;i<points.length-1;i++){const v=[points[0],points[i],points[i+1]];if(up&&v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).y<0)[v[1],v[2]]=[v[2],v[1]];for(const p of v)verts.push(p.x,p.y,p.z);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();b.add(g,c);}
 const point=(p:T.Vector2,y:number)=>new T.Vector3(p.x,y,p.y);
 // No wall-colored top caps beneath the explicit roof.
 b.add(openTopPrism(new T.Shape([r[0],r[1],r[2],r[5],r[6],r[7]]),0,eave),'white');
 const annex=new T.Shape([r[2],r[3],r[4],r[5]]);
 b.add(openTopPrism(annex,0,source.heights.annexEaveAboveGround),'white');
 b.add(upwardRoofPlane(annex,source.heights.annexEaveAboveGround),'slate');
 const rear=r[1].clone().lerp(r[6],.5),frontPeak=point(front,ridge),backPeak=point(rear,ridge);
 surface([point(r[0],eave),point(r[1],eave),backPeak,frontPeak],'slate',true);
 surface([frontPeak,backPeak,point(r[6],eave),point(r[7],eave)],'slate',true);
 surface([point(r[0],eave),frontPeak,point(r[7],eave)],'white');
 surface([point(r[6],eave),backPeak,point(r[1],eave)],'white');
 // Wall base and shallow boarding seams, below exposed glazing/trim layers.
 for(let i=0;i<r.length;i++){
  const p=r[i],q=r[(i+1)%r.length],v=q.clone().sub(p),L=v.length(),out=new T.Vector2(-v.y,v.x).normalize();
  // BAG outer ring is clockwise in east/south coordinates; left-side normal is outward.
  const angle=Math.atan2(out.x,out.y),mid=p.clone().lerp(q,.5),height=i>=2&&i<=4?4.03:eave;
  b.box(mid.x,0,mid.y,L,.52,.09,'concrete',angle);
  for(let y=.65;y<height-.12;y+=.23)b.box(mid.x+out.x*.035,y,mid.y+out.y*.035,L,.018,.032,'frame',angle);
  b.box(mid.x+out.x*.035,height-.16,mid.y+out.y*.035,L,.16,.13,'white',angle);
 }
 // Original fanlight assembly: arch within a rectangular dark surround.
 const probes:{center:number[];normal:number[];width:number;height:number;bottom:number;assemblyBottom:number;assemblyHeight:number;archBase:number;radius:number;facade:'front'|'side'}[]=[];
 function opening(center:T.Vector2,out:T.Vector2,w:number,h:number,bottom:number,facade:'front'|'side'){
  const angle=Math.atan2(out.x,out.y),axis=new T.Vector2(out.y,-out.x);
  const localBox=(x:number,y:number,z:number,ww:number,hh:number,dd:number,c:Colour)=>{const p=center.clone().addScaledVector(axis,x).addScaledVector(out,z);b.box(p.x,y,p.y,ww,hh,dd,c,angle);};
  localBox(0,bottom-.08,.09,w+.18,h+.16,.12,'white');
  localBox(0,bottom,.17,w,h,.12,'dark');
  const rad=w/2-.085,archBase=h-rad-.07;
  const arch=new T.Shape();arch.moveTo(-rad,.06);arch.lineTo(rad,.06);arch.lineTo(rad,archBase);arch.absarc(0,archBase,rad,0,Math.PI,false);arch.lineTo(-rad,.06);arch.closePath();
  const g=new T.ShapeGeometry(arch,12);b.add(g,'glass',center.x+out.x*.245,bottom,center.y+out.y*.245,angle);
  localBox(0,bottom+.06,.275,.065,archBase-.01,.07,'dark');
  for(const h0 of [archBase/3,archBase*2/3,archBase])localBox(0,bottom+h0,.275,w-.12,.065,.07,'dark');
  for(let k=0;k<=6;k++){
   const theta=k*Math.PI/6,dx=Math.cos(theta)*rad,dy=Math.sin(theta)*rad;
   const tube=new T.CylinderGeometry(.018,.018,rad,5);tube.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(dx,dy,0).normalize()));
   const p=center.clone().addScaledVector(axis,dx/2).addScaledVector(out,.29);b.add(tube,'dark',p.x,bottom+archBase+dy/2,p.y,angle);
  }
  // Arch outline stays crisp against the rectangular dark corner pieces.
  const arc=new T.Shape();arc.absarc(0,archBase,rad+.035,0,Math.PI,false);arc.absarc(0,archBase,rad-.025,Math.PI,0,true);arc.closePath();b.add(new T.ShapeGeometry(arc,12),'dark',center.x+out.x*.29,bottom,center.y+out.y*.29,angle);
  localBox(0,bottom-.12,.20,w+.26,.07,.30,'white');
  probes.push({center:[center.x,center.y],normal:[out.x,out.y],width:w,height:archBase-.06,bottom:bottom+.06,assemblyBottom:bottom,assemblyHeight:h,archBase,radius:rad,facade});
 }
 // Photo-estimated proportions: 2025 front / operator view; not measured joinery.
 // Heads at 4.93m leave .65m to the surveyed eave; lower sills stay at 1.65m.
 for(const x of [-width*.315,width*.315])opening(at(x,0),n,1.40,3.28,1.65,'front');
 for(const edge of [[0,1],[6,7]]){
  const [p,q]=edge.map(i=>r[i]),v=q.clone().sub(p),normal=new T.Vector2(-v.y,v.x).normalize();
  for(const t of [.20,.50,.80])opening(p.clone().lerp(q,t),normal,1.05,3.25,1.68,'side');
 }
 // Entrance: central raised double panel doors and curved wooden upper panels.
 box(0,.68,.16,1.72,3.48,.18,'dark');
 for(const x of [-.43,.43]){
  box(x,.76,.275,.78,2.10,.11,'dark');
  for(const [y,h] of [[.84,.42],[1.42,1.04],[2.60,.16]]){box(x,y,.345,.58,h,.035,'frame');box(x,y+.04,.368,.51,h-.08,.038,'dark');}
 }
 for(const side of [-1,1]){const curve=new T.Shape();curve.moveTo(side*.05,3.99);curve.quadraticCurveTo(side*.66,3.93,side*.75,3.13);curve.lineTo(side*.68,3.13);curve.quadraticCurveTo(side*.60,3.85,side*.05,3.90);curve.closePath();geometry(new T.ShapeGeometry(curve,10),'frame',0,0,.268);}
 box(0,.75,.375,.045,3.20,.04,'dark');box(0,2.95,.32,1.75,.09,.10,'white');
 for(const x of [-.97,.97]){box(x,.63,.21,.29,3.50,.33,'white');box(x,4.08,.23,.38,.09,.40,'white');box(x,.59,.24,.38,.14,.40,'white');}
 // Photographed painted serif fascia, subordinate to entrance, not building-name lettering.
 box(0,4.16,.20,2.32,.31,.20,'white');
 box(0,4.45,.23,2.62,.09,.34,'white');box(0,4.54,.21,2.72,.07,.37,'white');
 const path=new T.ShapePath();for(const c of sign.commands as {type:string;x:number;y:number;x1?:number;y1?:number;x2?:number;y2?:number}[]){if(c.type==='M')path.moveTo(c.x,-c.y);else if(c.type==='L')path.lineTo(c.x,-c.y);else if(c.type==='Q')path.quadraticCurveTo(c.x1!,-c.y1!,c.x,-c.y);else if(c.type==='C')path.bezierCurveTo(c.x1!,-c.y1!,c.x2!,-c.y2!,c.x,-c.y);else if(c.type==='Z')path.currentPath?.closePath();}
 const text=new T.ShapeGeometry(path.toShapes(),4);text.computeBoundingBox();const bounds=text.boundingBox!,sz=bounds.getSize(new T.Vector3()),scale=Math.min(.13/sz.y,2.12/sz.x);text.translate(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,0);text.scale(scale,scale,1);text.userData={role:'source-sign',text:sign.text,font:sign.font};geometry(text,'dark',0,4.23,.306);
 // Three visible risers plus threshold; tread count photo-supported, dimensions approximate.
 for(let i=0;i<3;i++)box(0,i*.19,.45+(3-i)*.24,2.15,.19,.48,'concrete');box(0,.57,.36,2.03,.11,.48,'concrete');
 function rod(points:T.Vector3[],radius:number,c:Colour){const curve=new T.CatmullRomCurve3(points);geometry(new T.TubeGeometry(curve,16,radius,5,false),c);}
 for(const x of [-1.03,1.03])rod([new T.Vector3(x,.22,1.18),new T.Vector3(x,.54,1.1),new T.Vector3(x,1.00,.73),new T.Vector3(x,1.52,.40)],.019,'dark');
 // Plain framed noticeboard and tiny real wall lamp; no invented poster content.
 box(-width*.315,.70,.14,1.08,.71,.10,'white');box(-width*.315,.75,.205,.97,.61,.03,'frame');
 rod([new T.Vector3(0,4.81,.20),new T.Vector3(0,5.27,.23),new T.Vector3(0,5.34,.40),new T.Vector3(0,5.18,.61)],.018,'dark');box(0,5.02,.61,.11,.18,.09,'glass');
 // Pediment molding follows the real triangle and boarded tympanum.
 box(0,eave-.05,.10,width+.18,.13,.25,'white');box(0,eave+.09,.11,width+.30,.09,.30,'white');
 for(let y=eave+.25;y<ridge-.12;y+=.23){const w=width*(1-(y-eave)/(ridge-eave));box(0,y,.05,w,.018,.025,'frame');}
 for(const side of [-1,1]){
  const p=new T.Vector3(side*width/2,eave,.12),q=new T.Vector3(0,ridge,.12),v=q.clone().sub(p),mid=p.clone().lerp(q,.5);
  const trim=new T.BoxGeometry(v.length()+.12,.14,.23);trim.rotateZ(Math.atan2(v.y,v.x));geometry(trim,'white',mid.x,mid.y,mid.z);
 }
 // Deliberately simple rear annex: survey controls footprint and flat roof, openings unknown.
 const rearEdge=r[3].clone().lerp(r[4],.5);b.box(rearEdge.x,3.90,rearEdge.y,r[3].distanceTo(r[4]),.14,.20,'white',Math.atan2(-n.x,-n.y));
 return {glazingProbes:probes,front:[front.x,front.y],frontNormal:[n.x,n.y],mainRidge:ridge,mainEave:eave};
}
