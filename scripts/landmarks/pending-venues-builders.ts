import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import sources from './pending-venues-footprints.json';
import specs from './pending-venues-specs.json';
import {archSlab,archWindows,disc,getSink,poly,ringFrame,sashWindows,setSink,slab} from './nearbar-kit';
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
  // NW aisle roof: the inner (SE) slope is the plain plane; the outer slope is the same plane clipped to the
  // skewed NW wall, so it no longer overhangs the wall by up to 1.5 m near the Spui end and swallow the
  // dormer gable there. The wall is raised to meet it further down (knee wall in the NW side block).
  {const ridgeX=(-17.5-10.55)/2,ridgeY=18.52,slope=(ridgeY-12.35)/(ridgeX+17.5);
   const wallX=(z:number)=>{const pts=[[-18.01,-8.26],[-17.75,-3.81],[-17.61,-1.81],[-16.29,18.02],[-14.28,25.41]];for(let i=0;i+1<pts.length;i++){const [x0,z0]=pts[i],[x1,z1]=pts[i+1];if(z<=z1)return x0+(x1-x0)*Math.max(0,(z-z0)/(z1-z0));}return pts[pts.length-1][0];};
   const ze=[-8.0,-3.81,-1.81,18.02,24.4];
   for(let i=0;i+1<ze.length;i++){const a=Math.max(-17.5,wallX(ze[i])),c=Math.max(-17.5,wallX(ze[i+1]));quad([[a,12.35+slope*(a+17.5),ze[i]],[ridgeX,ridgeY,ze[i]],[ridgeX,ridgeY,ze[i+1]],[c,12.35+slope*(c+17.5),ze[i+1]]],'slate');}
   quad([[ridgeX,ridgeY,-8.0],[-10.55,12.35,-8.0],[-10.55,12.35,24.4],[ridgeX,ridgeY,24.4]],'slate');}
  roofZ(-10.55,2.5,-7.7,28.6,12.35,21.93);roofZ(2.5,11.65,-5.5,28.6,12.35,19.10);
  // Actual annex flat caps are generated with the same holes as its walls.
  mass(-22,26,-20.4,-8.2,14.8,14.88,'slate');mass(0,26,-35,-20.4,17.5,17.58,'slate');
  function gable(cx:number,ww:number,height:number){const z=frontZ(cx)+.02;b.prism(cx,12.35,z-.1,ww,.4,height-12.35,'brick');for(let y=13.1;y<height-.8;y+=2.0){const span=ww*(1-(y-12.35)/(height-12.35));b.box(cx,y,z+.19,span,.085,.13,'stone');}b.box(cx,height-.05,z+.04,1.05,.4,.48,'brick');b.box(cx,height+.35,z+.06,1.36,.18,.66,'slate');const eye=new T.CylinderGeometry(.44,.44,.12,14);eye.rotateX(Math.PI/2);b.add(eye,'dark',cx,height-2.55,z+.36);}
  gable(-4.0,13.05,21.93);gable(6.8,9.4,19.1);gable(-14.0,6.8,18.52);
  function tracery(x:number,y:number,ww:number,hh:number){const z=frontZ(x)+.14;arch(x,y-.13,z,ww+.28,hh+.28,'stone');arch(x,y,z+.14,ww,hh,'dark');for(let i=0;i<4;i++){const u=x-ww/2+ww*(i+.5)/4;arch(u,y+hh-ww*.60,z+.28,ww/4*.91,ww*.46,'white',.05);arch(u,y+hh-ww*.56,z+.36,ww/4*.75,ww*.36,'dark',.05);}for(let i=0;i<=4;i++)b.box(x-ww/2+ww*i/4,y,z+.30,.1,hh-ww/2+.35,.09,'white');for(let y0=y+.62;y0<y+hh-ww/2;y0+=.63)b.box(x,y0,z+.30,ww,.065,.09,'white');b.box(x,y-.20,z+.15,ww+.48,.2,.38,'stone');}
  tracery(-4.0,4.8,5.1,9.5);tracery(6.8,4.8,3.5,8.6);tracery(-14.0,5.0,2.05,7.3);
  for(const x of [-8.3,-.5,9.0])tracery(x,.70,2.15,2.28);
  const door=2.3,z=frontZ(door)+.22;arch(door,.12,z,2.65,3.4,'stone',.30);arch(door,.12,z+.34,2.1,2.9,'dark');b.box(door,3.5,z+.30,4.0,.24,1.2,'stone');for(const u of [-1.65,1.65]){b.box(door+u,0,z+.18,.46,3.7,.65,'stone');b.box(door+u,3.7,z+.18,.7,.22,.88,'stone');}
  // Every side detail is authored in the frame of a real ring edge (nearbar-kit), so it lies on the
  // skewed BAG walls. Until 2026-10-10 these were axis-aligned boxes at a fixed x/z: the south-court
  // lattice windows floated up to 0.45 m off (or sank into) the 3-degree-skewed wall, and the
  // Handboogstraat windows sat 1.3 m inside the annex facing inwards, showing as loose grey slabs.
  const sink0=getSink();setSink(0.05);
  /** Height of the NW aisle roof plane roofZ(-17.5,-10.55,..,12.35,18.52) at model x. */
  const aisleRoofY=(x:number)=>12.35+Math.min(Math.max(x+17.5,0),3.475)*(18.52-12.35)/3.475;
  const ringOpen=ring.slice(0,-1);
  /** Arc-length walk along consecutive ring edges in ring order; returns the edge frame and its local t. */
  const walk=(edges:number[])=>{const fs=edges.map(i=>{const {f,len}=ringFrame(ringOpen,i);const a=ringOpen[i];const fwd=Math.hypot(f.origin[0]-a[0],f.origin[1]-a[1])<1e-6;return{f,len,fwd};});
   const total=fs.reduce((t,e)=>t+e.len,0);
   return{total,at(u:number){let acc=0;for(const e of fs){if(u<=acc+e.len||e===fs[fs.length-1]){const l=Math.min(Math.max(u-acc,0),e.len);return{f:e.f,t:e.fwd?l:e.len-l};}acc+=e.len;}throw new Error('empty walk');}};};
  // ---- NW side (bearing ~339; edges 24-28 from the annex corner to the Spui front). Spec from the
  // 2025-01-09 panorama b_20250109_1300_Track09_Sphere_00006 (22 m out, square-on): eight window axes,
  // mirror-symmetric m m T m | m T m m. Axes 3 and 6 are tall round-arched windows rising into curved
  // dormer gables with an oculus; the others are medium round-arched windows. Ground row: small
  // segmental-headed pairs under axes 1,3,4,5,6,8 and an arched stone-framed door under axes 2 and 7.
  {
   const p=walk([24,25,26,27,28]),axes=[.04,.15,.29,.42,.56,.69,.84,.93].map(k=>k*p.total);
   axes.forEach((u,k)=>{const {f,t}=p.at(u),tall=k===2||k===5;
    if(tall)archWindows(b,f,[t],{y:4.7,w:2.35,h:8.6,bars:3,rows:7,frame:'white',glass:'dark',sill:'stone'});
    else archWindows(b,f,[t],{y:5.6,w:1.95,h:4.9,bars:2,rows:4,frame:'white',glass:'dark',sill:'stone'});
    if(k===1||k===6){archSlab(b,f,t,0,1.9,3.3,.12,'stone');archSlab(b,f,t,.05,1.3,2.9,.18,'dark');}
    else sashWindows(b,f,[t],{y:1.15,w:1.9,h:1.75,cols:2,rows:2,frame:'white',glass:'dark',sill:'stone'});
    if(tall){// both gables are the same size on the photo; the axis-aligned aisle roof sits higher over the skewed wall
     // near the Spui end, so the gable is lifted with it rather than drowning in the roof plane.
     const xw=f.origin[0]+f.tangent[0]*t,lift=Math.max(0,aisleRoofY(xw+1.2)-12.35-1.2),y0=12.3+lift;
     const g:[number,number][]=[[-2.05,-lift],[2.05,-lift],[2.05,.9],[1.35,1.45],[1.1,2.55],[.65,2.95],[.65,3.55],[-.65,3.55],[-.65,2.95],[-1.1,2.55],[-1.35,1.45],[-2.05,.9]];
     poly(b,f,t,y0,g,2.7,'brick',-2.75);
     slab(b,f,t,y0+3.55,1.5,.18,.3,'stone',.02);
     disc(b,f,t,y0+2.15,.42,.14,'stone',.12);disc(b,f,t,y0+2.15,.3,.1,'dark',.2);}
   });
   for(let u=.4;u<p.total-.3;u+=1.0){const {f,t}=p.at(u);
    if(!axes.some((a,k)=>(k===2||k===5)&&Math.abs(a-u)<1.4))slab(b,f,t,12.05,1.02,.3,.18,'stone');
    slab(b,f,t,0,1.02,.45,.12,'stone');
   }
   // knee wall: raise the skewed wall to meet the aisle roof plane where it runs inside the roof's eave line
   for(const i of [25,26,27]){const {f,len}=ringFrame(ringOpen,i),g=(t:number)=>{const x=f.origin[0]+f.tangent[0]*t,z=f.origin[1]+f.tangent[1]*t;return z<24.4?Math.max(0,aisleRoofY(x)-12.35-.03):0;};
    const g0=g(0),g1=g(len);if(g0+g1>.05)poly(b,f,len/2,12.3,[[-len/2,0],[len/2,0],[len/2,g1+.05],[-len/2,g0+.05]],.3,'brick',-.3);}
  }
  // ---- south court side (edge 3, bearing ~163): the pair of tall lattice windows between three
  // shallow buttresses, now on the wall plane. Inferred: no panorama sees this court square-on.
  {
   const p=walk([3]);
   const tAtZ=(z:number)=>{const a=ringOpen[3],c=ringOpen[4];return p.total*(z-a[1])/(c[1]-a[1]);};
   for(const z of [1.5,17.4]){const {f,t}=p.at(tAtZ(z));slab(b,f,t,2.1,3.1,8.35,.12,'dark');slab(b,f,t,2.1,.11,8.35,.16,'white');for(let y=2.7;y<10.5;y+=.65)slab(b,f,t,y,3.1,.06,.16,'white');}
   for(const z of [-1.9,7.6,23.0]){const {f,t}=p.at(tAtZ(z));slab(b,f,t,0,.58,11.6,.45,'brick');}
  }
  const fenceZ=frontZ(0)+2.0;for(const x of [-11.6,12.0])b.box(x,0,fenceZ,.36,2.2,.36,'stone');for(let x=-11.5;x<12;x+=.42){if(Math.abs(x-door)<1.35)continue;b.box(x,0,fenceZ,.08,1.65,.08,'frame');}b.box(0,1.22,fenceZ,23.5,.08,.12,'frame');
  // ---- Handboogstraat annex (edges 8-18, bearing ~70; 1884 neo-Renaissance). Four storeys of tall
  // white-framed windows on five axes, the ground storey taller with a transom (2019-01 panoramas
  // TMX7316010203-001050_pano_0000_000517/000518, 5-9 m out in the 5 m wide street).
  {
   const p=walk([8,9,10,11,12,13,14,15,16,17,18]);
   for(let k=0;k<5;k++){const {f,t}=p.at(p.total*(k+.5)/5);
    sashWindows(b,f,[t],{y:1.0,w:2.1,h:3.3,cols:2,rows:3,frame:'white',glass:'dark',sill:'stone',lintel:'stone'});
    for(const y of [5.6,9.6,13.4])sashWindows(b,f,[t],{y,w:1.8,h:2.7,cols:2,rows:3,frame:'white',glass:'dark',sill:'stone',lintel:'stone'});}
   for(const y of [4.85,8.95,12.85]){for(let u=.3;u<p.total;u+=1.0){const {f,t}=p.at(u);slab(b,f,t,y,1.02,.22,.12,'stone');}}
  }
  setSink(sink0);
 }else throw new Error(`No pending venue builder for ${id}`);
}
