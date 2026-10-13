import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import src from './fire-station-zebra-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
export function buildFireStationZebra(_w:number,_d:number,b:BuildingTools){
 const angle=src.localRotationRadians;
 const add=(g:T.BufferGeometry,c:C)=>{g.rotateY(angle);b.add(g,c)};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:C,a=0)=>{const p=new T.Vector3(x,0,z).applyAxisAngle(new T.Vector3(0,1,0),angle);b.box(p.x,y,p.z,w,h,d,c,angle+a)};
 const shape=(p:number[][])=>new T.Shape(p.map(v=>new T.Vector2(v[0],v[1])));
 const shell=(p:number[][],h:number,c:C)=>add(openTopPrism(shape(p),0,h),c);
 const roof=(p:number[][],h:number)=>{const indexed=upwardRoofPlane(shape(p),h),g=indexed.toNonIndexed();const pos=g.getAttribute('position'),values:number[]=[];for(let i=0;i<pos.count;i+=3){const a=new T.Vector3().fromBufferAttribute(pos,i),c=new T.Vector3().fromBufferAttribute(pos,i+1),d=new T.Vector3().fromBufferAttribute(pos,i+2);const n=c.clone().sub(a).cross(d.clone().sub(a));if(n.length()/2<.004)continue;if(n.y<0){const tmp=c.clone();c.copy(d);d.copy(tmp);}values.push(...a.toArray(),...c.toArray(),...d.toArray());}g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.tag='roof';add(g,'slate')};
 // Native BAG union: main house, tall narrow hose tower and low connection. No parcel fill.
 const body=[...src.nativeRing.slice(0,6),...src.nativeRing.slice(12,25)];
 shell(body,6.2,'brick');
 // The shallow right-front strip is visibly lower in current photographs; the AHN fitted
 // main roof merges this setback. Keep a bounded photo-derived step rather than fill the front to 9m.
 const upper=[...src.nativeRing.slice(0,6),...src.nativeRing.slice(12,21),[8.06,5.0],[17.36,5.0]];
 const upperShell=openTopPrism(shape(upper),6.2,9.12);add(upperShell,'brick');roof(upper,9.12);
 const lowerFront=[src.nativeRing[20],src.nativeRing[21],src.nativeRing[22],src.nativeRing[23],src.nativeRing[24],[17.36,5],[8.06,5]];roof(lowerFront,6.2);
 const tower=[src.nativeRing[8],src.nativeRing[9],src.nativeRing[10],src.nativeRing[11],src.nativeRing[7]];shell(tower,17.4,'brick');roof(tower,17.4);
 const neck=[src.nativeRing[5],src.nativeRing[6],src.nativeRing[7],src.nativeRing[11],src.nativeRing[12]];shell(neck,3.5,'brick');roof(neck,3.5);
 function pane(x:number,y:number,z:number,w:number,h:number,a=0,tag='window-pane'){
  const g=new T.BoxGeometry(w,h,.055);g.rotateY(a);g.translate(x,y+h/2,z);g.userData={tag,probe:{x,y:y+h/2,z,w,h,a}};add(g,'glass');
  const frame=h<.5?.025:.09;const nx=Math.sin(a),nz=Math.cos(a);for(const dx of[-w/2,w/2])box(x+Math.cos(a)*dx+nx*.055,y,z-Math.sin(a)*dx+nz*.055,frame,h,.13,'white',a);for(const yy of[0,h])box(x+nx*.055,y+yy,z+nz*.055,w,frame,.13,'white',a);
 }
 function ribbon(x:number,z:number,length:number,a=0,y=6.12,h=1.65,count=8){
  const nx=Math.sin(a),nz=Math.cos(a),dx=Math.cos(a),dz=-Math.sin(a);
  // Gray metal strips above and between exposed pane faces, with no masonry covers.
  box(x+nx*.13,y+h+.08,z+nz*.13,length,9.12-y-h-.08,.24,'greyBrick',a);
  for(let i=0;i<count;i++){const u=-length/2+(i+.5)*length/count,w=length/count-.38;pane(x+dx*u+nx*.28,y,z+dz*u+nz*.28,w,h,a);if(i<count-1)box(x+dx*(-length/2+(i+1)*length/count)+nx*.14,y,z+dz*(-length/2+(i+1)*length/count)+nz*.14,.33,h,.25,'greyBrick',a);}
  box(x+nx*.26,y-.13,z+nz*.26,length,.12,.27,'dark',a);box(x+nx*.29,y+h,z+nz*.29,length,.08,.16,'white',a);
 }
 const frontZ=(x:number)=>10.89-(x+17.72)*.005;
 ribbon(-4.82,frontZ(-4.82),25.75,0,6.12,1.64,9);
 ribbon(-17.74,3.66,14.25,-Math.PI/2,6.12,1.64,5);
 ribbon(-4.98,-3.55,25.36,Math.PI,6.12,1.64,9);
 ribbon(17.37,-3.4,16.8,Math.PI/2,6.12,1.64,6);
 ribbon(12.58,-11.81,9.16,Math.PI,6.12,1.64,3);
 // Lower front right annex has its own parapet and clerestory, matching current street views.
 const lowZ=8.32;box(12.64,5.84,lowZ,9.27,.36,.22,'greyBrick');
 for(const x of[9.36,12.45,15.54])pane(x,4.48,lowZ+.18,2.68,1.32);
 box(12.64,4.35,lowZ+.12,9.27,.12,.22,'dark');
 // Original projecting office bay, gray corrugated lower apron, three broad glazing groups.
 const bayX=-12.15,bayZ=11.42,bayW=10.84;
 box(bayX,.65,bayZ,bayW,1.05,.65,'greyBrick');box(bayX,3.5,bayZ,bayW,.73,.65,'greyBrick');
 for(let i=0;i<6;i++)pane(bayX-bayW/2+(i+.5)*bayW/6,1.72,bayZ+.34,bayW/6-.16,1.77);
 pane(-17.89,1.72,11.09,.64,1.77,-Math.PI/2);
 for(let x=bayX-bayW/2+.09;x<bayX+bayW/2;x+=.19){box(x,.69,bayZ+.355,.035,.96,.035,'stone');box(x,3.54,bayZ+.355,.035,.65,.035,'stone');}
 // Three real red sectional truck doors; glass bands sit ahead of shutter surfaces.
 for(const x of[-3.43,1.0,5.34]){
  const z=frontZ(x)+.1,w=3.43;box(x,.16,z,w,4.46,.15,'copper');box(x,.16,z+.09,w,.53,.12,'stone');
  for(let y=.92;y<4.28;y+=.44)box(x,y,z+.091,w,.025,.022,'bronze');
  for(const yy of[.72,4.18])for(let i=0;i<4;i++)pane(x-w/2+(i+.5)*w/4,yy,z+.2,w/4-.12,.28,0,'vehicle-pane');
  box(x,4.65,z+.06,w+.3,.14,.28,'white');for(const xx of[x-w/2-.09,x+w/2+.09])box(xx,.13,z,.15,4.53,.2,'dark');
 }
 // Real personnel entrance and lower west window; no painted building name.
 pane(-17.84,.12,6.05,1.25,2.3,-Math.PI/2);box(-17.86,2.6,6.05,.9,.13,1.7,'white');
 pane(-17.88,2.9,-.18,1.75,1.14,-Math.PI/2);
 // Tower front slot: metal infill intervals and exposed glazing, traced from source photographs.
 const tx=-14.34,tz=-5.48;
 for(let y=4.2;y<16.6;y+=2.15){box(tx,y,tz+.11,1.02,.8,.18,'greyBrick');pane(tx,y+.84,tz+.23,1.02,1.22);}
 // Roof vent rings and slender aerial are supported by current source views.
 for(const y of[17.63,17.91,18.19]){const g=new T.CylinderGeometry(.42,.42,.12,14);g.translate(tx,y,-8.28);add(g,'stone');}
 box(tx,17.4,-8.28,.09,1.08,.09,'frame');box(-13.01,17.4,-9.81,.04,2.2,.04,'frame');
 // Source-visible upper facade ribs and rain pipes, restrained enough for the native house style.
 for(let x=-17.5;x<8;x+=.24)box(x,7.92,frontZ(x)+.27,.028,1.12,.025,'stone');
 for(const x of[-5.4,6.91])box(x,0,frontZ(x)+.31,.10,9.04,.11,'white');
 // Source-supported fire-service shield, red face and original simplified gold flame.
 const shield=new T.Shape();shield.moveTo(-.53,1.45);shield.lineTo(.53,1.45);shield.quadraticCurveTo(.82,.51,0,0);shield.quadraticCurveTo(-.82,.51,-.53,1.45);
 const sg=new T.ExtrudeGeometry(shield,{depth:.1,bevelEnabled:false,curveSegments:8});sg.translate(-16.3,7.86,frontZ(-16.3)+.33);add(sg,'copper');
 const flame=new T.Shape();flame.moveTo(-.17,.24);flame.bezierCurveTo(-.72,.8,.13,.81,-.13,1.33);flame.bezierCurveTo(.7,1.05,.48,.56,.16,.38);flame.bezierCurveTo(.23,.76,-.17,.79,-.17,.24);const fg=new T.ExtrudeGeometry(flame,{depth:.018,bevelEnabled:false,curveSegments:8});fg.translate(-16.3,7.95,frontZ(-16.3)+.44);add(fg,'bronze');
}
