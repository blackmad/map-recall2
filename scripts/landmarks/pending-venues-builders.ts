import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import sources from './pending-venues-footprints.json';
import specs from './pending-venues-specs.json';
/** Original native-scale Venustempel houses and the skewed Lutheran hall.
 * BAG court holes and separate neighbours remain physical open space. */
export function buildPendingVenueLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 type P=[number,number];type C=Parameters<BuildingTools['add']>[1];
 const f=sources.find(f=>f.id===id)!,s=specs.find(s=>s.id===id)!;if(!f||!s)throw new Error(`No pending venue builder for ${id}`);
 const anchor=s.surveyed.anchor,h=(s.surveyed.northOffsetDegrees+90)*Math.PI/180;
 const coord=([lng,lat]:number[]):P=>{const e=(lng-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),n=(lat-anchor[1])*110540;return[e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h)];};
 const rings=f.geometry.coordinates.map(r=>r.map(coord)),ring=rings[0],holes=rings.slice(1);
 const clip=(poly:P[],axis:0|1,value:number,above:boolean)=>{const out:P[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],q=poly[(i+1)%poly.length],ia=above?a[axis]>=value:a[axis]<=value,iq=above?q[axis]>=value:q[axis]<=value;if(ia)out.push(a);if(ia!==iq){const t=(value-a[axis])/(q[axis]-a[axis]);out.push([a[0]+t*(q[0]-a[0]),a[1]+t*(q[1]-a[1])]);}}return out;};
 const section=(r:P[],x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(r,0,x0,true),0,x1,false),1,z0,true),1,z1,false);
 function mass(x0:number,x1:number,z0:number,z1:number,base:number,top:number,c:C){const p=section(ring,x0,x1,z0,z1);if(p.length<3)return;const shape=new T.Shape(p.map(v=>new T.Vector2(...v)));for(const hole of holes){const q=section(hole,x0,x1,z0,z1);if(q.length>=3)shape.holes.push(new T.Path(q.map(v=>new T.Vector2(...v))));}const g=new T.ExtrudeGeometry(shape,{depth:top-base,bevelEnabled:false});g.rotateX(Math.PI/2);b.add(g,c,0,top,0);}
 function quad(p:number[][],c:C){const a=new T.Vector3(...p[0]),q=new T.Vector3(...p[1]),r=new T.Vector3(...p[2]);if(q.clone().sub(a).cross(r.clone().sub(a)).y<0)p.reverse();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>p[i]),3));g.computeVertexNormals();b.add(g,c);}
 function roofZ(x0:number,x1:number,z0:number,z1:number,eave:number,ridge:number){const x=(x0+x1)/2;quad([[x0,eave,z0],[x,eave+(ridge-eave),z0],[x,ridge,z1],[x0,eave,z1]],'slate');quad([[x,ridge,z0],[x1,eave,z0],[x1,eave,z1],[x,ridge,z1]],'slate');}
 function arch(x:number,y:number,z:number,w:number,h:number,c:C,depth=.12){const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-w/2);sh.absarc(0,h-w/2,w/2,0,Math.PI,false);sh.lineTo(-w/2,0);sh.closePath();b.add(new T.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:8}),'stone'===c?'stone':c,x,y,z);}
 function window(x:number,y:number,z:number,w:number,hh:number){b.box(x,y-.12,z,w+.24,hh+.24,.12,'stone');b.box(x,y,z+.10,w,hh,.1,'dark');b.box(x,y,z+.20,.10,hh,.08,'frame');b.box(x,y+hh*.68,z+.20,w,.07,.08,'frame');}
 const frontZ=(x:number)=>{const hits:number[]=[];for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length];if((a[0]<=x&&q[0]>=x)||(q[0]<=x&&a[0]>=x)){if(Math.abs(a[0]-q[0])>.001)hits.push(a[1]+(x-a[0])*(q[1]-a[1])/(q[0]-a[0]));}}return Math.max(...hits);};
 if(id==='sexmuseum-venustempel'){
  // Owner describes a front house and two rear houses joined by stairs.
  // Their measured roof heights differ; the low rear service bay stays low.
  mass(-20,20,3.35,25,0,13.9,'brick');mass(-20,20,-6.2,3.35,0,9.2,'brick');mass(-20,20,-13.6,-6.2,0,7.6,'brick');mass(-20,20,-22,-13.6,0,4.1,'stone');
  roofZ(-4.9,2.0,-6.0,3.25,9.2,15.7);roofZ(-7.05,5.35,-13.4,-6.25,7.6,11.95);
  quad([[-.55,13.95,3.4],[6.45,13.95,3.4],[6.45,13.95,17.1],[-.55,13.95,17.1]],'slate');
  mass(1.6,7.4,16.65,25,13.9,15.6,'brick');
  const x=4.40,z=frontZ(x)+.03,width=5.65;
  // Current grey stone surround and brown wood doors, as photographed by
  // Commons' own photographer; ornate historic raised cornice retained.
  b.box(x,0,z-.07,width,4.65,.27,'slate');b.box(x,0,z+.10,width*.92,4.35,.23,'brick');
  for(const u of [-1.72,-.28,1.20]){b.box(x+u,.24,z+.26,1.17,3.22,.11,'glass');b.box(x+u,.15,z+.38,.12,4.12,.12,'brick');}
  b.box(x+2.28,.18,z+.35,.80,4.1,.15,'brick');b.sign('18',x+2.28,2.8,z+.45,.06,'gold');
  b.box(x,3.60,z+.29,width,.88,.22,'slate');b.sign('SEXMUSEUM',x,3.73,z+.45,.10,'gold');b.sign('VENUSTEMPEL',x,4.20,z+.40,.065,'gold');
  for(const y of [5.15,8.65,12.05])for(const u of [-1.87,0,1.87])window(x+u,y,frontZ(x+u)+.06,1.40,2.66);
  b.box(x,15.0,z+.14,width+.18,.35,.58,'stone');b.box(x,15.35,z+.13,width+.27,.35,.66,'stone');
  for(const u of [-1.80,1.80])window(x+u,15.9,z+.26,1.40,1.03);
  arch(x,15.95,z+.25,1.7,1.83,'stone',.24);arch(x,16.10,z+.52,1.12,1.4,'dark');
  const crown=new T.Shape();crown.moveTo(-2.9,0);crown.lineTo(-1.15,0);crown.quadraticCurveTo(-.9,1.30,0,1.55);crown.quadraticCurveTo(.9,1.30,1.15,0);crown.lineTo(2.9,0);crown.lineTo(2.9,.27);crown.lineTo(1.26,.27);crown.quadraticCurveTo(.9,1.57,0,1.8);crown.quadraticCurveTo(-.9,1.57,-1.26,.27);crown.lineTo(-2.9,.27);crown.closePath();b.add(new T.ExtrudeGeometry(crown,{depth:.4,bevelEnabled:false,curveSegments:9}),'stone',x,16.15,z+.44);
  b.box(x,17.95,z+.53,.56,.27,.6,'stone');for(const u of [-2.60,2.60]){b.box(x+u,15.75,z+.38,.45,1.5,.5,'stone');b.box(x+u,17.25,z+.4,.65,.23,.65,'stone');}
 }else if(id==='oude-lutherse-kerk'){
  // Skewed three-aisled gallery church. Main nave roof is21.93m above ground;
  // no invented tower/dome. The1884annex preserves allthree mapped court holes.
  mass(-22,12.8,-8.2,35,0,12.35,'brick');mass(-22,26,-35,-8.2,0,14.8,'brick');
  mass(0,26,-35,-20.4,14.8,17.5,'brick');
  roofZ(-17.5,-10.55,-8.0,24.4,12.35,18.52);roofZ(-10.55,2.5,-7.7,28.6,12.35,21.93);roofZ(2.5,11.65,-5.5,28.6,12.35,19.10);
  // Actual annex flat caps are generated with the same holes as its walls.
  mass(-22,26,-20.4,-8.2,14.8,14.88,'slate');mass(0,26,-35,-20.4,17.5,17.58,'slate');
  function gable(cx:number,ww:number,height:number){const z=frontZ(cx)+.02;b.prism(cx,12.35,z-.1,ww,.4,height-12.35,'brick');for(let y=13.1;y<height-.8;y+=2.0){const span=ww*(1-(y-12.35)/(height-12.35));b.box(cx,y,z+.19,span,.085,.13,'stone');}b.box(cx,height-.05,z+.04,1.05,.4,.48,'brick');b.box(cx,height+.35,z+.06,1.36,.18,.66,'slate');const eye=new T.CylinderGeometry(.44,.44,.12,14);eye.rotateX(Math.PI/2);b.add(eye,'dark',cx,height-2.55,z+.36);}
  gable(-4.0,13.05,21.93);gable(6.8,9.4,19.1);gable(-14.0,6.8,18.52);
  function tracery(x:number,y:number,ww:number,hh:number){const z=frontZ(x)+.14;arch(x,y-.13,z,ww+.28,hh+.28,'stone');arch(x,y,z+.14,ww,hh,'dark');for(let i=0;i<4;i++){const u=x-ww/2+ww*(i+.5)/4;arch(u,y+hh-ww*.60,z+.28,ww/4*.91,ww*.46,'white',.05);arch(u,y+hh-ww*.56,z+.36,ww/4*.75,ww*.36,'dark',.05);}for(let i=0;i<=4;i++)b.box(x-ww/2+ww*i/4,y,z+.30,.1,hh-ww/2+.35,.09,'white');for(let y0=y+.62;y0<y+hh-ww/2;y0+=.63)b.box(x,y0,z+.30,ww,.065,.09,'white');b.box(x,y-.20,z+.15,ww+.48,.2,.38,'stone');}
  tracery(-4.0,4.8,5.1,9.5);tracery(6.8,4.8,3.5,8.6);tracery(-14.0,5.0,2.05,7.3);
  for(const x of [-8.3,-.5,9.0])tracery(x,.70,2.15,2.28);
  const door=2.3,z=frontZ(door)+.22;arch(door,.12,z,2.65,3.4,'stone',.30);arch(door,.12,z+.34,2.1,2.9,'dark');b.box(door,3.5,z+.30,4.0,.24,1.2,'stone');for(const u of [-1.65,1.65]){b.box(door+u,0,z+.18,.46,3.7,.65,'stone');b.box(door+u,3.7,z+.18,.7,.22,.88,'stone');}
  // Spui's pair of transept-like side elevations; white lattice glazing and
  // shallow buttresses echo the primary exterior photograph.
  const side=11.75;for(const zz of [1.5,17.4]){b.box(side,2.1,zz,.15,8.35,3.1,'dark');b.box(side+.15,2.1,zz,.09,8.35,.11,'white');for(let y=2.7;y<10.5;y+=.65)b.box(side+.16,y,zz,.09,.06,3.1,'white');}
  for(const zz of [-3,7.6,23.3])b.box(side,0,zz,.45,12.8,.58,'brick');
  const fenceZ=frontZ(0)+2.0;for(const x of [-11.6,12.0])b.box(x,0,fenceZ,.36,2.2,.36,'stone');for(let x=-11.5;x<12;x+=.42){if(Math.abs(x-door)<1.35)continue;b.box(x,0,fenceZ,.08,1.65,.08,'frame');}b.box(0,1.22,fenceZ,23.5,.08,.12,'frame');
  // Annex street windows face Handboogstraat, far behind the church nave.
  for(let x=2.7;x<21;x+=4.7)for(const y of [1.4,5.7,10.0,14.1])window(x,y,-26.24,2.0,2.6);
 }else throw new Error(`No pending venue builder for ${id}`);
}
