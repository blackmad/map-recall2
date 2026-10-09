import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './nieuwendammerkerk-footprints.json';
/** Original surveyed metre-scale church; adjacent Kosterij/cemetery remain independent. */
export function buildNieuwendammerkerk(_w:number,_d:number,b:BuildingTools){
 type C=Parameters<BuildingTools['add']>[1];const rotation=source.localRotationDegrees*Math.PI/180;
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.rotateY(rotation);b.add(g,c);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:C,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const shape=(r:number[][])=>new T.Shape(r.map(q=>new T.Vector2(q[0],q[1])));
 function surface(points:number[][],c:C,roof=false){const p=points.map(q=>new T.Vector3(...q as [number,number,number]));if(roof&&p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).y<0)p.reverse();const a:number[]=[];for(let i=1;i<p.length-1;i++)a.push(...p[0].toArray(),...p[i].toArray(),...p[i+1].toArray());const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));g.computeVertexNormals();g.userData.role=roof?'roof':'wall';add(g,c);}
 function beam(p:number[],q:number[],width:number,c:C){const a=new T.Vector3(...p as [number,number,number]),z=new T.Vector3(...q as [number,number,number]),delta=z.clone().sub(a);const g=new T.CylinderGeometry(width/2,width/2,delta.length(),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const mid=a.add(z).multiplyScalar(.5);add(g,c,...mid.toArray() as [number,number,number]);}
 const ring=source.parts[0].localRing.slice(0,-1),base=shape(ring);
 add(openTopPrism(base,0,.40),'stone');add(upwardRoofPlane(base,.40),'stone');
 // BAG shell includes the actual central east-end projection, never a padded parcel.
 add(openTopPrism(base,.40,8.10),'ochre');
 const x0=2.22,x1=20.947,half=5.88,eave=8.12,ridge=11.85;
 for(const s of [-1,1])surface([[x0,eave,s*(half+.14)],[x1,eave,s*(half+.14)],[x1,ridge,0],[x0,ridge,0]],'red',true);
 for(const x of [x0,x1])surface([[x,eave,-half],[x,eave,half],[x,ridge,0]],'ochre');
 // Small east projection shares a bounded extension of the same gable, not a full-height roof plate.
 for(const s of [-1,1]){const ze=s*2.76,h=ridge-Math.abs(ze)*(ridge-eave)/half;surface([[x1,h,ze],[21.85,h,ze],[21.85,ridge,0],[x1,ridge,0]],'red',true);}
 surface([[21.85,8.1,-2.76],[21.85,8.1,2.76],[21.85,ridge-(ridge-eave)*2.76/half,2.76],[21.85,ridge,0],[21.85,ridge-(ridge-eave)*2.76/half,-2.76]],'ochre');
 const outward=(x:number,z:number,a:number,d:number,u=0)=>[x+Math.sin(a)*d+Math.cos(a)*u,z+Math.cos(a)*d-Math.sin(a)*u];
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:C){const q=new T.Shape();q.moveTo(-w/2,0);q.lineTo(w/2,0);q.lineTo(w/2,h-w/2);q.absarc(0,h-w/2,w/2,0,Math.PI,false);q.closePath();const g=new T.ExtrudeGeometry(q,{depth:.06,bevelEnabled:false,curveSegments:10});if(c==='glass')g.userData.pane={x,y,z,w,h,a};add(g,c,x,y,z,a);}
 function window(x:number,y:number,z:number,w:number,h:number,a:number){arch(x,y-.12,z,w+.32,h+.27,a,'brick');const q=outward(x,z,a,.08);arch(q[0],y,q[1],w,h,a,'glass');const m=outward(x,z,a,.17);box(m[0],y,m[1],.045,h-w/2,.055,'frame',a);for(let v=.58;v<h-w/2;v+=.62)box(m[0],y+v,m[1],w,.042,.055,'frame',a);const cy=y+h-w/2;for(const t of [-Math.PI/3,0,Math.PI/3]){const start=outward(x,z,a,.18),end=outward(x,z,a,.18,Math.sin(t)*w/2);beam([start[0],cy,start[1]],[end[0],cy+Math.cos(t)*w/2,end[1]],.045,'frame');}box(x,y-.19,z,w+.42,.14,.34,'stone',a);}
 // Current side facades: three broad arched windows, yellow IJssel brick infill,
 // pale yellow bay lisenes and continuous red cordon course.
 for(const s of [-1,1]){const a=s>0?0:Math.PI,z=s*5.99;box((x0+x1)/2,3.62,s*6.03,x1-x0,.21,.20,'brick');box((x0+x1)/2,7.87,z,x1-x0,.22,.22,'brick');box((x0+x1)/2,8.05,s*6.05,x1-x0+.28,.16,.40,'white');
  for(const x of [x0+.28,8.52,14.77,x1-.28])box(x,.40,z,.40,7.40,.21,'ochre');
  for(const x of [5.35,11.59,17.81])window(x,2.05,s*5.995,1.90,4.55,a);
 }
 // West shoulder round-headed blind plaster panels are not glazing.
 for(const s of [-1,1]){arch(2.12,3.9,s*4.10,1.85,3.0,-Math.PI/2,'brick');arch(2.02,4.00,s*4.10,1.61,2.78,-Math.PI/2,'stone');}
 // Secondary south doorway is documented by register; position follows historic/current context,
 // partially screened by retained Kosterij. No surrounding courtyard is filled.
 const doorX=15.16;box(doorX,.40,6.04,1.32,2.25,.10,'white');box(doorX,.47,6.13,1.09,2.08,.08,'green');box(doorX,.47,6.21,.045,2.08,.035,'frame');
 // Three observed shallow stone entrance treads, wholly against the west tower.
 for(let i=0;i<3;i++)box(-2.58-i*.31,.04,0,.35,.14*(3-i),2.30,'stone');
 const towerShape=shape([[-2.25,-2.48],[2.25,-2.48],[2.25,2.48],[-2.25,2.48]]);
 add(openTopPrism(towerShape,.4,13.55),'ochre');
 const directions=[0,Math.PI/2,Math.PI,-Math.PI/2];
 for(const a of directions){const side=Math.abs(Math.sin(a))>.5?2.26:2.50,w=Math.abs(Math.sin(a))>.5?4.96:4.5;const q=outward(0,0,a,side);
  // Red corner pilasters and broad arched yellow recess above the paired lights.
  for(const u of [-w/2+.19,w/2-.19]){const p=outward(q[0],q[1],a,.035,u);box(p[0],.40,p[1],.38,13.15,.18,'brick',a);}
  arch(q[0],5.80,q[1],w-.70,7.25,a,'brick');const face=outward(q[0],q[1],a,.075);arch(face[0],5.94,face[1],w-.94,6.99,a,'ochre');
  for(const y of [3.79,6.17,9.68])box(q[0],y,q[1],w,.15,.24,'brick',a);
  const paired=outward(q[0],q[1],a,.12);arch(paired[0],6.08,paired[1],2.29,3.44,a,'brick');const inset=outward(q[0],q[1],a,.20);arch(inset[0],6.20,inset[1],2.06,3.18,a,'ochre');
  for(const u of [-.52,.52]){const p=outward(q[0],q[1],a,.29,u);window(p[0],6.25,p[1],.74,2.74,a);}
  const vent=outward(q[0],q[1],a,.17);arch(vent[0],10.15,vent[1],1.26,2.25,a,'brick');const v=outward(vent[0],vent[1],a,.08);arch(v[0],10.22,v[1],1.03,2.08,a,'dark');for(let y=10.36;y<12.05;y+=.30){const p=outward(v[0],v[1],a,.10);box(p[0],y,p[1],1.04,.12,.15,'frame',a);}
  // Ground semicircular transoms on sides; front door gets a tall arched head below.
  if(Math.abs(a+Math.PI/2)>.01&&Math.abs(a-Math.PI/2)>.01){const p=outward(q[0],q[1],a,.13);arch(p[0],2.93,p[1],1.78,1.08,a,'brick');const r=outward(p[0],p[1],a,.08);arch(r[0],3.02,r[1],1.56,.84,a,'glass');box(r[0],3.00,r[1],1.64,.12,.20,'brick',a);}
  for(const u of [-w/2+.5,w/2-.5]){const p=outward(q[0],q[1],a,.18,u);box(p[0],12.4,p[1],.045,.50,.045,'dark');box(p[0],12.60,p[1],.28,.045,.045,'dark',a);}
 }
 // Main public entrance faces west onto Brede Kerkepad, not the nearby address centroid.
 const west=-Math.PI/2;arch(-2.37,.40,0,2.10,4.35,west,'brick');arch(-2.46,3.70,0,1.77,.89,west,'glass');box(-2.56,.53,0,1.77,3.17,.10,'green',west);box(-2.64,.53,0,.045,3.17,.05,'frame',west);box(-2.64,3.64,0,1.81,.12,.09,'white',west);
 for(const z of [-.43,.43])for(const y of [.77,1.85,2.75]){box(-2.66,y,z,.66,.68,.04,'green',west);for(const dz of [-.33,.33])box(-2.70,y,z+dz,.035,.68,.035,'frame',west);for(const dy of [0,.65])box(-2.70,y+dy,z,.66,.035,.035,'frame',west);}
 // Four peaked cornices on each tower stage. Horizontal AHN fitted tower plates
 // are intentionally replaced by source-observed gables and an original needle spire.
 function crown(hw:number,hd:number,e:number,peak:number,inner:number){const corners=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]];for(let i=0;i<4;i++){const a=corners[i],z=corners[(i+1)%4],mid=[(a[0]+z[0])/2,(a[1]+z[1])/2];surface([[a[0],e,a[1]],[z[0],e,z[1]],[mid[0],peak,mid[1]]],'brick');beam([a[0],e,a[1]],[mid[0],peak,mid[1]],.17,'white');beam([mid[0],peak,mid[1]],[z[0],e,z[1]],.17,'white');const ia=[a[0]/hw*inner,a[1]/hd*inner],iz=[z[0]/hw*inner,z[1]/hd*inner];surface([[a[0],e,a[1]],[mid[0],peak,mid[1]],[ia[0],peak,ia[1]]],'slate',true);surface([[mid[0],peak,mid[1]],[z[0],e,z[1]],[iz[0],peak,iz[1]],[ia[0],peak,ia[1]]],'slate',true);}}
 crown(2.39,2.62,13.55,14.50,1.63);
 const upper=shape([[-1.67,-1.67],[1.67,-1.67],[1.67,1.67],[-1.67,1.67]]);add(openTopPrism(upper,13.5,17.55),'brick');
 for(const a of directions){const p=outward(0,0,a,1.69);arch(p[0],14.45,p[1],1.75,2.76,a,'stone');const c=outward(p[0],p[1],a,.09);add(new T.CircleGeometry(.60,32),'dark',c[0],16.31,c[1],a);for(let i=0;i<12;i++){const t=i*Math.PI/6,q=outward(c[0],c[1],a,.03,Math.sin(t)*.48);box(q[0],16.31+Math.cos(t)*.48-.065,q[1],.055,.13,.035,'gold',a);}const h=outward(c[0],c[1],a,.05);box(h[0],16.29,h[1],.045,.42,.035,'gold',a);const h2=outward(h[0],h[1],a,.012,.12);box(h2[0],16.31,h2[1],.28,.045,.035,'gold',a);const v=outward(p[0],p[1],a,.10);box(v[0],14.6,v[1],.24,.72,.06,'dark',a);}
 crown(1.79,1.79,17.55,18.60,1.02);
 // Slender eight-sided slate needle, with visible ribs and modest wrought-iron finial.
 const bottom=18.22,tip=26.65,r=1.29;const points=Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4+Math.PI/8)*r,bottom,Math.sin(i*Math.PI/4+Math.PI/8)*r]);
 for(let i=0;i<8;i++){surface([points[i],points[(i+1)%8],[0,tip,0]],'slate',true);beam(points[i],[0,tip,0],.035,'frame');}
 add(new T.SphereGeometry(.10,8,6),'gold',0,26.67,0);box(0,26.72,0,.035,.82,.035,'dark');box(0,27.08,0,.53,.035,.035,'dark');beam([-.2,27.1,0],[.28,27.38,0],.028,'dark');
 // Continuous roof-edge bargeboards and ridge define the weathered clay-tile nave roof family.
 for(const x of [x0,x1])for(const s of [-1,1])beam([x,eave,s*(half+.14)],[x,ridge,0],.15,'white');beam([x0,ridge,0],[x1+.90,ridge,0],.12,'brick');
}
