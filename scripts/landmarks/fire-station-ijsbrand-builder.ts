import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import src from './fire-station-ijsbrand-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
export function buildFireStationIJsbrand(_w:number,_d:number,b:BuildingTools){
 const angle=src.localRotationRadians,c=Math.cos(angle),s=Math.sin(angle);
 const world=(x:number,z:number)=>new T.Vector2(c*x+s*z,-s*x+c*z);
 const shape=(ps:number[][])=>new T.Shape(ps.map(p=>world(p[0],p[1])));
 const add=(g:T.BufferGeometry,col:C)=>{g.rotateY(angle);b.add(g,col)};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,col:C,a=0)=>{const p=world(x,z);b.box(p.x,y,p.y,w,h,d,col,angle+a)};
 // Survey-derived roof partitions own their roof surfaces. The exact stepped BAG perimeter is retained.
 for(const p of src.surveyRoofParts){const ring=p.localRings[0],h=ring.reduce((n,v)=>n+v[1],0)/ring.length;
  const ps=ring.map(v=>[v[0],v[2]]),sh=shape(ps),col:C=p.index===62?'red':p.index===61?'frame':p.index===60?'stone':'greyBrick';
  if(p.index===62){
   // Photos show red cladding only above the glazed band, with a recessed gray support under its eastern return.
   const upperBase=9.20,closedUpper=openTopPrism(sh,upperBase,h),flatUpper=closedUpper.index?closedUpper.toNonIndexed():closedUpper,up=flatUpper.getAttribute('position'),walls:number[]=[];for(let i=0;i<up.count;i+=3){if([0,1,2].every(j=>Math.abs(up.getY(i+j)-upperBase)<.001))continue;for(let j=0;j<3;j++)walls.push(up.getX(i+j),up.getY(i+j),up.getZ(i+j));}const upper=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(walls,3));upper.computeVertexNormals();upper.userData.tag='red-upper-shell';b.add(upper,'red');
   const support=[[-11.43,5.06],[10.74,5.11],[10.89,9.69],[14.10,10.13],[14.10,16.23],[-12.09,16.23],[-12.12,9.74],[-13.39,9.74],[-13.31,9.49]];
   b.add(openTopPrism(shape(support),0,upperBase),'greyBrick');
   const soffit=upwardRoofPlane(sh,upperBase),flatSoffit=soffit.index?soffit.toNonIndexed():soffit,sp=flatSoffit.getAttribute('position');
   for(let i=0;i<sp.count;i+=3){const a=new T.Vector3().fromBufferAttribute(sp,i+1),bb=new T.Vector3().fromBufferAttribute(sp,i+2);sp.setXYZ(i+1,bb.x,bb.y,bb.z);sp.setXYZ(i+2,a.x,a.y,a.z);}flatSoffit.computeVertexNormals();flatSoffit.userData.tag='cantilever-soffit';b.add(flatSoffit,'stone');
  }else b.add(openTopPrism(sh,0,h),col);const roof=upwardRoofPlane(sh,h+.015);const flat=roof.index?roof.toNonIndexed():roof;const pos=flat.getAttribute('position'),keep:number[]=[];for(let i=0;i<pos.count;i+=3){const a=new T.Vector3().fromBufferAttribute(pos,i),bb=new T.Vector3().fromBufferAttribute(pos,i+1),cc=new T.Vector3().fromBufferAttribute(pos,i+2);if(bb.clone().sub(a).cross(cc.clone().sub(a)).length()/2>.01)keep.push(...a.toArray(),...bb.toArray(),...cc.toArray());}const cleaned=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(keep,3));cleaned.computeVertexNormals();cleaned.userData.tag='roof';b.add(cleaned,'slate');
 }
 function pane(x:number,y:number,z:number,w:number,h:number,a=0,tag='pane'){
  const n=[Math.sin(a),Math.cos(a)],t=[Math.cos(a),-Math.sin(a)];
  const g=new T.BoxGeometry(w,h,.06);g.rotateY(a);g.translate(x,y+h/2,z);g.userData={tag,probe:{x,y:y+h/2,z,a,w,h}};add(g,'glass');
  const detail=(dx:number,yy:number,ww:number,hh:number)=>box(x+t[0]*dx+n[0]*.06,yy,z+t[1]*dx+n[1]*.06,ww,hh,.10,'dark',a);
  for(const dx of[-w/2,w/2])detail(dx,y,.07,h);for(const yy of[y,y+h])detail(0,yy,w,.07);
 }
 // Main Displaystraat frontage: six ground bays and continuous projecting upper glazing with sun louvres.
 for(let x=-8.5;x<14;x+=3.8){pane(x,1.0,17.57,2.9,1.5);pane(x,3.0,17.57,3.65,.4);}
 box(2.7,3.5,17.59,24.4,1.05,.13,'frame');
 for(let x=-8.9;x<14.3;x+=1.6){pane(x,4.75,17.61,1.48,3.6);box(x,8.6,17.64,1.58,.09,.16,'dark');for(let y=6.4;y<8.25;y+=.18)box(x,y,17.76,1.5,.06,.12,'frame');}
 // Thin red folded-cladding bands and paired clerestories in the upper block.
 for(const y of[9.4,10.45,11.45,12.48])box(1.4,y,16.25,26.4,.10,.13,'dark');
 for(const x of[-9,-3,3,9]){pane(x,10.65,16.27,.9,.58);pane(x+1.1,10.65,16.27,.9,.58);pane(x+.5,9.55,16.27,1.5,.48);}
 for(const x of[-13.45,14.86])for(const z of[6.0,9.5,13]){pane(x+(x<0?-.08:.08),9.55,z,2.3,.6,x<0?-Math.PI/2:Math.PI/2);box(x,11.45,z,.12,.1,3.5,'dark');}
 // Tall stair core at east corner: full-height narrow glass slot, square windows on its front face.
 pane(18.77,.8,7.7,1.02,12.7,Math.PI/2);for(let y=1.6;y<13.4;y+=1.1)box(18.85,y,7.7,.10,.07,1.0,'frame');
 for(const y of[1,5.3,10.8])pane(16.3,y,10.16,1.3,1.8);
 box(14.7,15.5,7.5,7.7,.12,5.0,'dark');
 for(const z of[5.2,9.9]){box(14.7,15.65,z,7.9,.04,.05,'frame');for(const x of[11,14.8,18.5])box(x,15.5,z,.05,.6,.05,'frame');box(14.7,16.09,z,7.9,.045,.05,'frame');}
 // Lower light-colored vehicle wing: three sectional apparatus bays, exposed glazing and red frames.
 for(const [z,w,h] of [[-8.4,4.35,4.7],[-3.55,4.35,4.7],[1.4,2.7,3.15]]){
  box(15.19,0.15,z,.16,h,w,'bronze');
  for(const zz of[z-w/2,z+w/2])box(15.3,.05,zz,.23,h+.15,.15,'red');box(15.3,h+.1,z,.23,.16,w+.2,'red');
  if(h>4){for(const dz of[-1.6,-.52,.52,1.6])for(const y of[1.95,2.62])pane(15.34,y,z+dz,.94,.57,Math.PI/2,'vehicle-pane');}
  for(let y=.5;y<h;y+=.66)box(15.39,y,z,.06,.035,w,'stone');
 }
 pane(15.22,5.0,1.1,3.4,1.15,Math.PI/2);pane(15.26,.2,3.5,1.0,3.1,Math.PI/2,'entrance-pane');
 // Restrained source-supported side/rear windows; do not invent inscriptions.
 for(const z of[-16.7,-12.7,-8.7,-4.7])for(const y of[1,5.0])pane(-16.97,y,z,2.15,1.4,-Math.PI/2);
 for(const x of[-14,-10,-7])for(const y of[1,5])pane(x,y,-20.37,1.4,1.6,Math.PI);
 for(const z of[-9,-5,-1])pane(15.18,6.2,z,1.45,1.35,Math.PI/2);
}
