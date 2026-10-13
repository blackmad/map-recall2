import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import lettering from './voormalige-schouwburgpoort-letter-contours.json';
/** Original source-guided gate only. Metres; +Z faces street. Draft sizes are photo/gap estimates, NOT a surveyed gate footprint. */
export const gate={width:7.8345600221156095,depth:.66,wallTop:4.65,corniceTop:5.24,pedimentTop:6.43,arches:[{x:-2.69,r:.89,spring:2.43},{x:0,r:1.11,spring:2.56},{x:2.69,r:.89,spring:2.43}]};
function buildFacadeSchouwburgpoort(b:BuildingTools){
 const {add,box}=b,w=gate.width,d=gate.depth;
 function text(index:number,y:number,height:number,maxWidth:number,z:number){const contours=new T.ShapePath();for(const c of lettering.texts[index].commands){if(c.type==='M')contours.moveTo(c.x!,-c.y!);else if(c.type==='L')contours.lineTo(c.x!,-c.y!);else if(c.type==='Q')contours.quadraticCurveTo(c.x1!,-c.y1!,c.x!,-c.y!);else if(c.type==='C')contours.bezierCurveTo(c.x1!,-c.y1!,c.x2!,-c.y2!,c.x!,-c.y!);else if(c.type==='Z')contours.currentPath?.closePath();}const g=new T.ShapeGeometry(contours.toShapes(),6);g.computeBoundingBox();const bound=g.boundingBox!,size=bound.getSize(new T.Vector3()),scale=Math.min(height/size.y,maxWidth/size.x);g.translate(-(bound.min.x+bound.max.x)/2,-bound.min.y,0);g.scale(scale,scale,1);add(g,'gold',0,y,z);}
 // One connected arched wall with three bottom-open contours. No filled slab or fake dark doorway.
 const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(-w/2,gate.wallTop);shape.lineTo(w/2,gate.wallTop);shape.lineTo(w/2,0);
 for(const a of [...gate.arches].reverse()){shape.lineTo(a.x+a.r,0);shape.lineTo(a.x+a.r,a.spring);for(let j=1;j<=24;j++){const t=j*Math.PI/24;shape.lineTo(a.x+a.r*Math.cos(t),a.spring+a.r*Math.sin(t));}shape.lineTo(a.x-a.r,0);}shape.closePath();
 const wall=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,curveSegments:24});wall.translate(0,0,-d/2);add(wall,'stone');
 function frontShape(s:T.Shape,depth:number,z:number){const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false});add(g,'stone',0,0,z);}
 // Curved exposed archivolts, with radial joints. Outer ring follows actual void contour.
 for(const a of gate.arches){const ring=new T.Shape(),ro=a.r+.18;ring.moveTo(a.x+a.r,a.spring);for(let j=1;j<=24;j++){const t=j*Math.PI/24;ring.lineTo(a.x+a.r*Math.cos(t),a.spring+a.r*Math.sin(t));}ring.lineTo(a.x-ro,a.spring);for(let j=23;j>=0;j--){const t=j*Math.PI/24;ring.lineTo(a.x+ro*Math.cos(t),a.spring+ro*Math.sin(t));}ring.closePath();frontShape(ring,.075,d/2+.012);
 for(const x of [a.x-a.r-.09,a.x+a.r+.09]){box(x,0,d/2+.035,.18,a.spring,.08,'stone');box(x,a.spring-.08,d/2+.07,.27,.13,.16,'stone');}
 for(let j=1;j<9;j++){const t=j*Math.PI/9,x=a.x+(a.r+.09)*Math.cos(t),y=a.spring+(a.r+.09)*Math.sin(t);const g=new T.BoxGeometry(.011,.18,.011);g.rotateZ(t-Math.PI/2);add(g,'greyBrick',x,y,d/2+.096);}
 }
 // Tall Ionic pilasters divide the three bays. Bases remain beside, never across, the passages.
 for(const x of [-1.52,1.52]){box(x,0,d/2+.07,.59,4.18,.19,'stone');box(x,0,d/2+.09,.72,.2,.27,'stone');box(x,.2,d/2+.08,.65,.14,.23,'stone');box(x,4.12,d/2+.16,.81,.17,.32,'stone');box(x,4.33,d/2+.16,1.02,.12,.34,'stone');
  // Split-volute assemblies: photo-guided spirals on both front and angled return.
  for(const side of [-1,1]){const points:T.Vector3[]=[];for(let j=0;j<=40;j++){const t=j/40*Math.PI*3.8,r=.175*(1-j/48);points.push(new T.Vector3(x+side*.3+side*r*Math.cos(t),4.17+r*Math.sin(t),d/2+.335));}add(new T.TubeGeometry(new T.CatmullRomCurve3(points),40,.027,5,false),'stone');const returnG=new T.TorusGeometry(.15,.035,5,16);returnG.rotateY(side*.9);add(returnG,'stone',x+side*.38,4.17,d/2+.20);}
 }
 // Continuous tapered/fluted stone console: one connected volume, broad enough to read at native distance.
 const rows=[[4.35,.54,.19],[4.19,.48,.30],[3.98,.38,.34],[3.79,.30,.29],[3.66,.26,.18]],v:number[]=[];
 const segments=20,front=(row:number,k:number)=>{const[y,width,depth]=rows[row],u=k/segments;return new T.Vector3((u-.5)*width,y,d/2+depth+.026*Math.cos(u*Math.PI*8));};
 const tri=(a:T.Vector3,b:T.Vector3,c:T.Vector3)=>v.push(...a.toArray(),...b.toArray(),...c.toArray());
 for(let r=0;r<rows.length-1;r++)for(let k=0;k<segments;k++){const a=front(r,k),b0=front(r,k+1),c=front(r+1,k+1),e=front(r+1,k);tri(a,e,c);tri(a,c,b0);}
 for(const k of [0,segments])for(let r=0;r<rows.length-1;r++){const a=front(r,k),b0=front(r+1,k),c=b0.clone().setZ(d/2+.012),e=a.clone().setZ(d/2+.012);if(k===0){tri(a,c,b0);tri(a,e,c);}else{tri(a,b0,c);tri(a,c,e);}}
 for(const r of [0,rows.length-1])for(let k=0;k<segments;k++){const a=front(r,k),b0=front(r,k+1),c=b0.clone().setZ(d/2+.012),e=a.clone().setZ(d/2+.012);if(r===rows.length-1){tri(a,c,b0);tri(a,e,c);}else{tri(a,b0,c);tri(a,c,e);}}
 const console=new T.BufferGeometry();console.setAttribute('position',new T.Float32BufferAttribute(v,3));console.computeVertexNormals();add(console,'stone');box(0,4.33,d/2+.1,.62,.1,.26,'stone');
 // Full entablature: layered stone, no label painted for identification.
 box(0,4.5,0,w+.09,.12,d+.12,'stone');box(0,4.62,0,w,.40,d+.08,'stone');box(0,5.02,0,w+.18,.11,d+.25,'stone');
 const plan=new T.Shape();plan.moveTo(-(w+.28)/2,-(d+.32)/2);plan.lineTo((w+.28)/2,-(d+.32)/2);plan.lineTo((w+.28)/2,(d+.32)/2);plan.lineTo(-(w+.28)/2,(d+.32)/2);plan.closePath();add(openTopPrism(plan,5.13,5.24),'stone');add(upwardRoofPlane(plan,5.24),'stone');
 const pediment=new T.Shape();pediment.moveTo(-2.5,5.24);pediment.lineTo(2.5,5.24);pediment.lineTo(0,6.43);pediment.closePath();frontShape(pediment,d,-d/2);
 // Pitched stone edge mouldings track the actual triangular silhouette.
 for(const side of [-1,1]){const p=new T.Vector3(side*2.53,5.24,d/2+.05),q=new T.Vector3(0,6.43,d/2+.05),delta=q.clone().sub(p),g=new T.BoxGeometry(delta.length(),.14,d+.14);g.rotateZ(Math.atan2(delta.y,delta.x));add(g,'stone',...p.clone().add(q).multiplyScalar(.5).toArray() as [number,number,number]);}
 // Connected thick C-scroll cartouche, original source-guided silhouette; panel sits physically in front.
 const ornament=new T.Shape();ornament.moveTo(0,5.32);
 ornament.bezierCurveTo(.11,5.28,.21,5.27,.27,5.35);ornament.bezierCurveTo(.42,5.24,.57,5.34,.47,5.47);ornament.bezierCurveTo(.62,5.43,.74,5.48,.59,5.59);ornament.bezierCurveTo(.70,5.74,.78,5.99,.66,6.08);ornament.bezierCurveTo(.54,6.16,.44,6.13,.39,6.05);ornament.bezierCurveTo(.31,6.29,.11,6.30,0,6.16);
 ornament.bezierCurveTo(-.11,6.30,-.31,6.29,-.39,6.05);ornament.bezierCurveTo(-.44,6.13,-.54,6.16,-.66,6.08);ornament.bezierCurveTo(-.78,5.99,-.70,5.74,-.59,5.59);ornament.bezierCurveTo(-.74,5.48,-.62,5.43,-.47,5.47);ornament.bezierCurveTo(-.57,5.34,-.42,5.24,-.27,5.35);ornament.bezierCurveTo(-.21,5.27,-.11,5.28,0,5.32);ornament.closePath();frontShape(ornament,.19,d/2+.025);
 // Large connected curled ridges follow the broad C-scroll arms; no isolated decorative rings.
 for(const side of [-1,1]){for(const points of [[[.49,5.46],[.61,5.51],[.63,5.66],[.66,5.81],[.67,5.99],[.57,6.06],[.50,6.00],[.56,5.96]],[[.08,6.13],[.17,6.21],[.29,6.17],[.32,6.05],[.24,5.99]],[[.08,5.40],[.18,5.32],[.34,5.34],[.37,5.43],[.27,5.45]]]){const curve=new T.CatmullRomCurve3(points.map(([x,y])=>new T.Vector3(side*x,y,d/2+.225)));add(new T.TubeGeometry(curve,32,.065,8,false),'stone');}}
 const plaque=new T.Shape();plaque.absellipse(0,5.76,.46,.23,0,Math.PI*2,false,0);frontShape(plaque,.075,d/2+.235);
 const rimPts=Array.from({length:49},(_,i)=>{const t=i/48*Math.PI*2;return new T.Vector3(.465*Math.cos(t),5.76+.235*Math.sin(t),d/2+.32);});add(new T.TubeGeometry(new T.CatmullRomCurve3(rimPts),48,.025,6,true),'stone');
 text(0,5.695,.13,.78,d/2+.316);text(1,4.85,.105,4.6,d/2+.051);text(2,4.69,.105,4.6,d/2+.051);
 // Open grilles in side passages. Central opening intentionally remains walk-through to forecourt.
 for(const a of [gate.arches[0],gate.arches[2]]){for(let x=a.x-a.r+.14;x<a.x+a.r-.05;x+=.18){const h=a.spring+Math.sqrt(a.r*a.r-(x-a.x)**2)-.05;box(x,0,-.1,.022,h,.028,'dark');}for(const y of [.95,2.15])box(a.x,y,-.1,a.r*2-.05,.028,.035,'dark');}
 // Modern pale entrance frame visible in both2011 and2018, set behind stone arch.
 // Its exact setback/door-leaf state is unmeasured; retain clear passage and avoid an opaque invented door.
 for(const x of [-1.035,1.035])box(x,0,-.17,.06,2.45,.12,'white');
 box(0,2.39,-.17,2.13,.10,.15,'white');box(0,2.49,-.17,2.13,.055,.16,'white');
 // Pair of source-visible pier lanterns with exposed dark brackets and warm lenses.
 for(const x of [-1.52,1.52]){box(x,2.58,d/2+.42,.035,.10,.44,'dark');box(x,2.63,d/2+.6,.20,.32,.20,'gold');box(x,2.60,d/2+.6,.27,.035,.27,'dark');for(const a of [-.11,.11])for(const z of [-.11,.11])box(x+a,2.62,d/2+.6+z,.025,.36,.025,'dark');const roof=new T.ConeGeometry(.21,.18,4);roof.rotateY(Math.PI/4);add(roof,'dark',x,3.02,d/2+.6);}
}

/** Native glTF +X east,+Z south; preserve local metre geometry and baked frontage. */
export const nativePose={frontBearingDegrees:92.45823764540219,bakedRotationYDegrees:87.54176235459781,anchor:[4.88423070093718,52.36927737255137] as [number,number]};
export function buildSchouwburgpoort(b:BuildingTools){
 const yaw=nativePose.bakedRotationYDegrees*Math.PI/180;
 const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.rotateY(yaw);b.add(g,c);};
 const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 buildFacadeSchouwburgpoort({...b,add,box});
}
