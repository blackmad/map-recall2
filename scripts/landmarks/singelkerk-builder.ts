import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './singelkerk-footprints.json';

/** Centered least-squares height fit uses every measured ring observation.
 * Rounded outline triples can be nearly collinear despite a large valid polygon;
 * fitting those first triples amplifies millimetre survey rounding into metre fins.
 */
export function fitSingelkerkSurveyPlane(rings:number[][][]){
 const points=rings.flat(),count=points.length;
 const centre=points.reduce((sum,p)=>sum.map((v,i)=>v+p[i]),[0,0,0]).map(v=>v/count);
 let xx=0,xz=0,zz=0,xy=0,zy=0;
 for(const p of points){const x=p[0]-centre[0],y=p[1]-centre[1],z=p[2]-centre[2];xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
 const determinant=xx*zz-xz*xz;
 if(!(determinant>1e-12*xx*zz))throw Error('Singelkerk survey roof has no stable projected plane');
 const slopeX=(xy*zz-zy*xz)/determinant,slopeZ=(zy*xx-xy*xz)/determinant;
 const height=(x:number,z:number)=>centre[1]+slopeX*(x-centre[0])+slopeZ*(z-centre[2]);
 const residual=Math.max(...points.map(p=>Math.abs(height(p[0],p[2])-p[1])));
 if(residual>.01)throw Error(`Singelkerk source roof is not planar within1cm: ${residual}m`);
 return {height,residual};
}

/** Original surveyed hidden-church complex: two genuine BAG parents, open forecourt. */
export function buildSingelkerk(_w:number,_d:number,b:BuildingTools){
 type Colour=Parameters<BuildingTools['add']>[1];const angle=source.authorAngleRadians;
 const at=(x:number,z:number)=>[x*Math.cos(angle)+z*Math.sin(angle),-x*Math.sin(angle)+z*Math.cos(angle)];
 function add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0){const q=at(x,z);b.add(g,c,q[0],y,q[1],angle+a);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,a=0){const q=at(x,z);b.box(q[0],y,q[1],w,h,d,c,angle+a);}
 // The raw AHN roof survey informs original footprint-region shells and bounded
 // planar roof surfaces. No source render meshes, walls, textures or pixels are imported.
 for(const part of source.parts)for(const plane of part.roofPlanes){
  const ring=plane.rings[0],shape=new T.Shape(ring.map(p=>new T.Vector2(p[0],p[2])));
  for(const h of plane.rings.slice(1))shape.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[2]))));
  const base=Math.min(...ring.map(p=>p[1])),colour:Colour=part.name==='church'?'stone':'brick';
  const shell=openTopPrism(shape,0,base);shell.userData.role='survey-shell';add(shell,colour);
  const {height,residual}=fitSingelkerkSurveyPlane(plane.rings);
  const top=new T.ShapeGeometry(shape),positions=top.getAttribute('position');
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getY(i);positions.setXYZ(i,x,height(x,z),z);}
  const ix=top.index!;for(let i=0;i<ix.count;i+=3){const a=new T.Vector3().fromBufferAttribute(positions,ix.getX(i)),q=new T.Vector3().fromBufferAttribute(positions,ix.getX(i+1)),r=new T.Vector3().fromBufferAttribute(positions,ix.getX(i+2));if(q.sub(a).cross(r.sub(a)).y<0){const j=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,j);}}
  top.computeVertexNormals();top.userData.role='roof';top.userData.sourceRings=plane.rings;top.userData.sourceResidualMetres=residual;add(top,'slate');
  const sides:number[]=[];for(const points of plane.rings)for(let i=0;i<points.length;i++){const a=points[i],q=points[(i+1)%points.length];sides.push(a[0],base,a[2],q[0],base,q[2],q[0],q[1],q[2],a[0],base,a[2],q[0],q[1],q[2],a[0],a[1],a[2]);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(sides,3));g.computeVertexNormals();add(g,colour);
 }
 function archPanel(x:number,y:number,z:number,w:number,h:number,c:Colour,back=false){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.065,bevelEnabled:false,curveSegments:12}),c,x,y,z,back?Math.PI:0);}
 // Main Herengracht front: pale plaster, three round-headed axes on two levels.
 // Projected wings and the lower central entrance are already in the survey shells.
 function churchWindow(x:number,y:number,z:number,w:number,h:number){
  archPanel(x,y-.10,z,w+.20,h+.20,'white',true);archPanel(x,y,z-.09,w,h,'glass',true);
  for(const u of [-w/6,w/6])box(x+u,y+.1,z-.19,.065,h-w*.52,.07,'white');
  for(let v=.72;v<h-w*.58;v+=.76)box(x,y+v,z-.19,w,.065,.07,'white');
  // Pointed intersecting tracery lives inside the round-headed opening.
  for(const side of [-1,1]){const pts=[new T.Vector3(x+side*w/3,y+h-w*.55,z-.20),new T.Vector3(x,y+h-.08,z-.20),new T.Vector3(x-side*w/3,y+h-w*.55,z-.20)];for(let i=0;i<2;i++){const delta=pts[i+1].clone().sub(pts[i]),g=new T.CylinderGeometry(.035,.035,delta.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const mid=pts[i].clone().add(pts[i+1]).multiplyScalar(.5);add(g,'white',mid.x,mid.y,mid.z);}}
 }
 for(const x of [-10.15,-3.25,3.65]){churchWindow(x,4.25,-19.82,2.4,4.45);churchWindow(x,10.4,-19.82,1.55,2.75);}
 for(const [y,h,d] of [[3.85,.14,.22],[9.05,.20,.32],[14.2,.22,.34],[14.62,.20,.52],[14.92,.16,.70]])box(-3.25,y,-19.70,20.9,h,d,'white');
 for(let x=-13.35;x<7.1;x+=.78)box(x,14.38,-19.99,.24,.23,.22,'white');
 for(const x of [-13.45,7.04])box(x,.15,-19.67,.55,14.4,.37,'stone');
 box(-4.75,.12,-21.48,2.4,3.30,.18,'dark');for(const x of [-6.05,-3.45])box(x,.12,-21.57,.20,3.46,.28,'white');box(-4.75,3.58,-21.57,2.84,.24,.36,'white');
 // Bronze flying-bird sculpture over the public door, simplified from the current photo.
 for(const side of [-1,1]){const wing=new T.BoxGeometry(1.0,.09,.22);wing.rotateZ(side*.4);add(wing,'bronze',-4.75+side*.38,4.13,-21.48);}add(new T.IcosahedronGeometry(.14,0),'bronze',-4.75,4.10,-21.48);
 // Open forecourt iron rail: no opaque ground slab, no padded parcel extrusion.
 const railZ=-29.6;for(const y of [.6,2.55])box(-3.2,y,railZ,22.4,.085,.08,'dark');
 for(let x=-14.3;x<=8;x+=.37){if(x>-6.3&&x<-3.1)continue;box(x,.18,railZ,.055,2.65,.06,'dark');add(new T.ConeGeometry(.065,.2,4),'dark',x,2.91,railZ);}
 for(const x of [-6.35,-3.05]){box(x,0,railZ,.13,3.14,.13,'dark');add(new T.SphereGeometry(.14,8,4),'dark',x,3.2,railZ);}
 // Singel452 is a domestic straight-cornice frontage, not neighboring454's gable.
 const front=31.69;for(const x of [-1.63,2.08])for(const [y,h] of [[.60,3.75],[5.15,4.10],[10.03,3.04],[14.06,1.55]]){
  box(x,y-.10,front,2.54,h+.2,.14,'white');box(x,y,front+.10,2.27,h,.09,'glass');
  for(const dx of [-.38,.38])box(x+dx,y+.07,front+.2,.06,h-.12,.055,'white');
  for(let v=.83;v<h-.2;v+=.87)box(x,y+v,front+.2,2.25,.06,.055,'white');box(x,y-.15,front+.04,2.73,.12,.30,'frame');
 }
 for(const [y,h,w,d] of [[16.06,.20,8.06,.33],[16.35,.22,8.30,.57],[16.65,.16,8.49,.71]])box(.25,y,31.54,w,h,d,'white');
 // The real stone rebus tablet is geometry only, with no painted invented lettering.
 box(.25,4.36,front+.18,1.05,.66,.11,'stone');add(new T.IcosahedronGeometry(.17,0),'stone',.25,4.65,front+.31);
 for(const x of [-3.25,3.75]){box(x,0,32.5,.17,.81,.17,'stone');add(new T.SphereGeometry(.11,6,4),'stone',x,.84,32.5);}
 // Small white roof dormer from the dated2024 roof view; restrained native dimensions.
 box(-12.20,14.0,-3.4,.85,1.85,1.35,'white');box(-12.69,14.19,-3.4,.06,1.39,.99,'glass');box(-12.74,14.19,-3.4,.075,1.40,.06,'white');box(-12.74,14.85,-3.4,.075,.06,1.0,'white');box(-12.2,15.85,-3.4,1.05,.14,1.60,'white');
}
