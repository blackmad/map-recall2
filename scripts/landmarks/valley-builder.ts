import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './valley-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';

/** Original native-scale survey-contour reconstruction. Photos guide exposed
 * glass/limestone assemblies; source mesh triangles and pixels are never used. */
export function buildValley(_width:number,_depth:number,b:BuildingTools):void {
 type P=number[]; type C=Parameters<BuildingTools['add']>[1];
 const boundary=source.localFootprint[0][0];
 const path=source.publicApproach.path,turnSetback=1.4;
 const direction=(a:P,q:P)=>{const run=Math.hypot(q[0]-a[0],q[1]-a[1]);return [(q[0]-a[0])/run,(q[1]-a[1])/run];};
 const hull=(points:P[])=>{
  const sorted=points.slice().sort((a,q)=>a[0]-q[0]||a[1]-q[1]);
  const cross=(a:P,q:P,r:P)=>(q[0]-a[0])*(r[1]-a[1])-(q[1]-a[1])*(r[0]-a[0]);
  const half=(pts:P[])=>{const out:P[]=[];for(const p of pts){while(out.length>1&&cross(out.at(-2)!,out.at(-1)!,p)<=0)out.pop();out.push(p);}return out;};
  return [...half(sorted).slice(0,-1),...half(sorted.slice().reverse()).slice(0,-1)];
 };
 const landings=path.slice(1).map((q,i)=>{
  const incoming=direction(path[i],q),outgoing=i<path.length-2?direction(q,path[i+2]):incoming,points:P[]=[];
  for(const [t,sign]of [[incoming,-1],[outgoing,1]] as [number[],number][])
   for(const side of [-1,1])points.push([q[0]+t[0]*turnSetback*sign-t[1]*source.publicApproach.width/2*side,q[1]+t[1]*turnSetback*sign+t[0]*source.publicApproach.width/2*side]);
  // Include both full-width turn-centre cross-sections; otherwise the
  // inner shoulder of the outgoing walk cuts outside a four-corner hull.
  for(const t of [incoming,outgoing])for(const side of [-1,1])points.push([q[0]-t[1]*source.publicApproach.width/2*side,q[1]+t[0]*source.publicApproach.width/2*side]);
  return hull(points);
 });
 const distance=(p:P,a:P,q:P)=>{const dx=q[0]-a[0],dz=q[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz)};
 const outer=(p:P)=>Math.min(...boundary.map((a,i)=>distance(p,a,boundary[(i+1)%boundary.length])))<1.05;
 function shape(rings:P[][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 // Plane aperture: exposed glazing without an opaque decorative back-box.
 function pane(x:number,y:number,z:number,w:number,h:number,angle:number,c:C='glass',outward?:number[]) {const g=new T.PlaneGeometry(w,h);g.userData.outward=outward;g.userData.facade=!!outward;b.add(g,c,x,y+h/2,z,angle);}
 function edges(r:P[],hole=false){const area=r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1]},0);return r.map((a,i)=>{const q=r[(i+1)%r.length],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz),sign=(area>0?1:-1)*(hole?-1:1);return {a,q,dx,dz,len,nx:sign*dz/len,nz:-sign*dx/len,angle:-Math.atan2(dz,dx)}});}
 // Cut rail spans against the actual pedestrian solid: individual treads
 // and turning landings, not a blanket terrace/approach exclusion. Vertical
 // overlap matters: a rail beside a lower flight remains a valid safety edge.
 function railSpans(a:P,q:P,bottom:number,top:number){
  const cuts:number[][]=[],steps=source.publicApproach.treadsPerFlight;
  function corridor(cx:number,cz:number,tx:number,tz:number,halfRun:number,halfWidth:number,walkTop:number){
   if(top<walkTop+.08||bottom>walkTop+2.05)return;
   let lo=0,hi=1;
   for(const [ux,uz,half] of [[tx,tz,halfRun],[-tz,tx,halfWidth]]){
    const start=(a[0]-cx)*ux+(a[1]-cz)*uz,delta=(q[0]-a[0])*ux+(q[1]-a[1])*uz;
    if(Math.abs(delta)<1e-9){if(Math.abs(start)>half)return;continue;}
    const v=[(-half-start)/delta,(half-start)/delta].sort((x,y)=>x-y);
    lo=Math.max(lo,v[0]);hi=Math.min(hi,v[1]);if(lo>=hi)return;
   }
   cuts.push([lo,hi]);
  }
  for(let f=0;f<path.length-1;f++){
   const p=path[f],r=path[f+1],dx=r[0]-p[0],dz=r[1]-p[1],run=Math.hypot(dx,dz),tx=dx/run,tz=dz/run;
   for(let k=0;k<steps;k++){
    const start=f===0?0:turnSetback,flightRun=run-start-turnSetback,t=(k+.5)/steps,walkTop=p[2]+(k+1)*(r[2]-p[2])/steps;
    corridor(p[0]+tx*(start+flightRun*t),p[1]+tz*(start+flightRun*t),tx,tz,flightRun/steps/2+.06,source.publicApproach.width/2+.10,walkTop);
   }
   // Convex turn platform; clip directly to its true polygon halfplanes.
   if(top>=r[2]+.08&&bottom<=r[2]+2.05){
    let lo=0,hi=1;for(const e of edges(landings[f])){
     const start=(a[0]-e.a[0])*e.nx+(a[1]-e.a[1])*e.nz,delta=(q[0]-a[0])*e.nx+(q[1]-a[1])*e.nz;
     if(Math.abs(delta)<1e-9){if(start>.10){hi=-1;break;}continue;}
     const t=(.10-start)/delta;if(delta>0)hi=Math.min(hi,t);else lo=Math.max(lo,t);
    }if(lo<hi)cuts.push([lo,hi]);
   }
  }
  cuts.sort((x,y)=>x[0]-y[0]);const spans:number[][]=[];let start=0;
  for(const [lo,hi]of cuts){if(lo>start)spans.push([start,lo]);start=Math.max(start,hi);}
  if(start<1)spans.push([start,1]);return spans;
 }
 for(const [index,l] of source.layers.entries()) {
  for(const polygon of l.polygons) {
   const s=shape(polygon);
   // Preserve the shared native shell's floor, then author aperture-aware
   // vertical faces so real balcony cavities have no buried glazing.
   const shell=openTopPrism(s,l.base,l.top),sp=shell.getAttribute('position'),sn=shell.getAttribute('normal'),bottom:number[]=[];
   for(let v=0;v<sp.count;v+=3)if([0,1,2].every(k=>sn.getY(v+k)<-.9))for(let k=0;k<3;k++)bottom.push(sp.getX(v+k),sp.getY(v+k),sp.getZ(v+k));
   if(bottom.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(bottom,3));g.computeVertexNormals();b.add(g,'stone');}shell.dispose();const roof=upwardRoofPlane(s,l.top);roof.userData.role='explicit-roof';b.add(roof,'stone');
   for(const [ri,r] of polygon.entries())for(const e of edges(r,ri>0)) {
    if(e.len<.10)continue;
    const mx=(e.a[0]+e.q[0])/2,mz=(e.a[1]+e.q[1])/2;
    // Smooth outer skin contrasts with exposed rocky inner facades. The
    // uppermost apartments retain stone, as in the aerial completion photo.
    const glassSkin=outer([mx,mz])&&l.top<92&&!(l.base>60&&mz>52)&&!(l.base>52&&Math.abs(mz)<20);
    const point=(t:number,off:number)=>[e.a[0]+e.dx*t+e.nx*off,e.a[1]+e.dz*t+e.nz*off];
    const entry=index===0&&distance(path[0],e.a,e.q)<.02&&e.len<5.0;
    // The original corridor cut left a vertical cap across the street entry.
    // Open only its pedestrian portal; retain masonry beside/above it.
    const entryHalf=source.publicApproach.width/2+.10,entryHead=2.30;
    const wall=new T.Shape((entry?
     [[-e.len/2,0],[-entryHalf,0],[-entryHalf,entryHead],[entryHalf,entryHead],[entryHalf,0],[e.len/2,0],[e.len/2,l.top-l.base],[-e.len/2,l.top-l.base]]:
     [[-e.len/2,0],[e.len/2,0],[e.len/2,l.top-l.base],[-e.len/2,l.top-l.base]]).map(p=>new T.Vector2(p[0],p[1])));
    const wallHoles:{t:number,w:number,h:number,kind:string,depth:number,sill:number}[]=[];
    // Approximate source-group schedules, not a randomized window field:
    // photo1 north/west rocky front; photo24 south inner and middle courtyard.
    const sourceGroup=mz < -25 ? 'north-rocky' : mz > 23 ? 'south-rocky' : 'middle-rocky';
    const sequence=(index+Math.floor((mx+29)/8)+(sourceGroup==='south-rocky'?2:0))%6;
    const sill=[.48,.62,.52,.70,.54,.46][sequence];
    const onApproach=index<5&&mx>-29&&mx<6&&mz>-37&&mz<-21;
    if(!glassSkin&&!onApproach&&e.len>4.8&&index>4&&index<26&&Math.min(...boundary.map((a,i)=>distance([mx,mz],a,boundary[(i+1)%boundary.length])))>1.7) {
     // Source photo24: alternating shadowed recesses and multi-pane projecting
     // rooms. Short return facets get a light below instead of a blank shaft.
     // Maintain full original assemblies; additional smaller rooms occur at
     // two of the six levels on each observed stone-frontage group.
     const broad=e.len>9;
     if(broad||sequence===1||sequence===4){
      let kind=sequence===1||sequence===3||sequence===4?'cantilever':'recess';
      const insideRing=(p:P,r:P[])=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],q=r[j];if((a[1]>p[1])!==(q[1]>p[1])&&p[0]<(q[0]-a[0])*(p[1]-a[1])/(q[1]-a[1])+a[0])yes=!yes;}return yes;};
      const depth=broad?(sequence===3?1.65:2.25):1.05;
      const lower=source.layers[index-1];
      const hasLowerSupport=[-.32,0,.32].some(f=>[.35,.75,1.05].some(df=>{const below=point(.5+f*Math.min(e.len-2.5,7.4)/e.len,depth*df);return lower.polygons.some(poly=>insideRing(below,poly[0])&&!poly.slice(1).some(r=>insideRing(below,r)));}));
      if(kind==='cantilever'&&hasLowerSupport)kind='recess';
      const h=Math.min(l.top-l.base-sill-.48,2.65),project=kind==='recess'?-(broad?1.6:1.0):depth;
      const neighbours=edges(r,ri>0).filter(q=>q.a!==e.a);
      // Shrink the assembly within its actual angled face instead of rejecting
      // the whole facade. End returns are retained and checked fractionally.
      for(const margin of [1.25,1.65,2.0]){
       const w=Math.min(e.len-2*margin,broad?7.4:4.9);
       if(w<2.2)continue;
       const clear=[-.5,-.25,0,.25,.5].every(f=>{const p=point(.5+f*w/e.len,project);return Math.min(...neighbours.map(q=>distance(p,q.a,q.q)))>.9;});
       if(!clear)continue;
       wallHoles.push({t:.5,w,h,kind,depth:project,sill});
       const hole=new T.Path([new T.Vector2(-w/2,sill),new T.Vector2(-w/2,sill+h),new T.Vector2(w/2,sill+h),new T.Vector2(w/2,sill)]);wall.holes.push(hole);break;
      }
     }
    }
    const wallMesh=new T.ShapeGeometry(wall);wallMesh.userData.role='aperture-wall';
    wallMesh.userData.sourceFace={layer:index,sourceGroup,a:e.a,q:e.q,len:e.len,glassSkin,onApproach,outward:[e.nx,0,e.nz]};
    b.add(wallMesh,'stone',mx,l.base,mz,e.angle);
    if(onApproach)continue;
    if(glassSkin) {
     if(e.len<1.7)continue;
     const p=point(.5,.055);pane(p[0],l.base+.06,p[1],e.len-.28,l.top-l.base-.10,e.angle,'glass',[e.nx,0,e.nz]);
     pane(p[0],l.base,p[1],e.len,.14,e.angle,'frame');
     const n=Math.max(1,Math.round(e.len/2.3));
     for(let k=0;k<=n;k++){const p=point(k/n,.13);pane(p[0],l.base,p[1],.09,l.top-l.base,e.angle,'frame');}
    } else {
     if(wallHoles.length) {
      const a=wallHoles[0],project=a.depth,p=point(.5,project+.055),h=a.h,y=l.base+a.sill;
      // Large multi-pane room windows alternate with actual recessed
      // balconies. Original wall apertures stay open all the way to glazing.
      const g=new T.PlaneGeometry(a.w,h);g.userData.outward=[e.nx,0,e.nz];g.userData.facade=true;g.userData.role=a.kind;g.userData.openingCentre=[mx,y+h/2,mz];g.userData.recessDepth=a.kind==='recess'?-project:0;g.userData.sourceGroup=sourceGroup;
      b.add(g,'glass',p[0],y+h/2,p[1],e.angle);
      const panels=a.w>5.5?4:3;for(let k=1;k<panels;k++){const t=.5+(k/panels-.5)*a.w/e.len,q=point(t,project+.12);pane(q[0],y,q[1],.075,h,e.angle,'bronze');}
      const depth=Math.abs(project),middle=point(.5,project/2),slabY=y-.26;
      const slab=new T.BoxGeometry(a.w+.45,.52,depth+.12);slab.userData.role=a.kind==='cantilever'?'cantilever-slab':'balcony-floor';slab.userData.front=[mx+e.nx*project,slabY,mz+e.nz*project];slab.userData.projectionDepth=depth;slab.userData.outward=[e.nx,0,e.nz];b.add(slab,'stone',middle[0],slabY,middle[1],e.angle);
      b.box(middle[0],y+h,middle[1],a.w+.35,.32,depth+.12,'stone',e.angle);
      for(const sign of [-1,1]){const q=point(.5+sign*(a.w/2+.1)/e.len,project/2);b.box(q[0],y,q[1],.2,h,depth+.1,'stone',e.angle);}
      if(a.kind==='recess'){const q=point(.5,.04);pane(q[0],y+.03,q[1],a.w,.88,e.angle);pane(q[0],y+.91,q[1],a.w,.075,e.angle,'bronze');}
      continue;
     }
     if(e.len<1.55)continue;
     // photo1/photo24 show single and twin tall lights on stone corner
     // returns, including facets too short for a broad apartment group.
     // Width/sill variation follows the six-level group schedule above.
     const narrow=e.len<4.5;
     const n=narrow?1:Math.max(1,Math.round(e.len/[6.8,7.8,6.1,8.2,6.5,7.2][sequence]));
     for(let k=0;k<n;k++) {
      const cell=e.len/n,margin=narrow?.38:[.72,.60,.86,.66,.58,.78][sequence];
      let w=narrow?Math.min(e.len-2*margin,sequence===2||sequence===5?1.35:2.55):Math.min(cell-2*margin,[5.8,4.1,4.8,6.3,5.3,4.6][sequence]);
      const shift=narrow?0:[-.18,.23,-.10,.18,.0,-.24][sequence];
      const t=(k+.5)/n+shift/e.len,p=point(t,.085),h=Math.min(l.top-l.base-sill-.48,narrow?2.5:[2.65,2.5,2.65,2.8,2.45,2.65][sequence]);
      // At acute source-contour joins neighboring windows can intercept a
      // grazing view. Bound each light to the face's genuinely exposed span.
      const neighbours=edges(r,ri>0).filter(q=>q.a!==e.a);
      const clear=(width:number)=>[-.5,-.33,0,.33,.5].every(f=>[.085,.25,.425].every(off=>{const q=point(t+f*width/e.len,off);return Math.min(...neighbours.map(edge=>distance(q,edge.a,edge.q)))>.22;}));
      for(let trim=0;trim<5&&!clear(w);trim++)w-=.30;
      if(w<.6||h<.6||!clear(w))continue;
      const g=new T.PlaneGeometry(w,h);g.userData.outward=[e.nx,0,e.nz];g.userData.facade=true;g.userData.role=narrow?'corner-light':'grouped-light';g.userData.sourceGroup=sourceGroup;
      b.add(g,'glass',p[0],l.base+sill+h/2,p[1],e.angle);
      const mid=point(t,.13);pane(mid[0],l.base+sill-.045,mid[1],w+.12,.09,e.angle,'stone');
      const panels=w>5.1?4:w>3.2?3:w>1.75?2:1;for(let j=1;j<panels;j++){const q=point(t+(j/panels-.5)*w/e.len,.13);pane(q[0],l.base+sill,q[1],.075,h,e.angle,'bronze');}
     }
    }
   }
  }
  // Glass balustrades follow actual exposed roof terrace fragments. They
  // sit on slabs and leave the jagged apartment profile readable from below.
  for(const terrace of l.terraces) {
   const rs=edges(terrace),area=Math.abs(terrace.reduce((s,p,i)=>{const q=terrace[(i+1)%terrace.length];return s+p[0]*q[1]-q[0]*p[1]},0))/2;
   for(const e of rs){
    if(e.len<2||e.len>22||outer([(e.a[0]+e.q[0])/2,(e.a[1]+e.q[1])/2]))continue;
    for(const [start,end]of railSpans(e.a,e.q,l.top+.06,l.top+.94)){
     const length=e.len*(end-start);if(length<.03)continue;
     const t=(start+end)/2,x=e.a[0]+e.dx*t,z=e.a[1]+e.dz*t;
     pane(x,l.top+.06,z,length,.78,e.angle);pane(x,l.top+.87,z,length,.07,e.angle,'bronze');
    }
   }
   // Sparse native terrace planting, geometry-only. Photographs establish
   // planting frequency, not exact tree positions or species counts.
   if(index>3&&area>13) {
    let x=0,z=0;for(const p of terrace){x+=p[0]/terrace.length;z+=p[1]/terrace.length;}
    const inside=(p:P)=>{let yes=false;for(let i=0,j=terrace.length-1;i<terrace.length;j=i++){const a=terrace[i],q=terrace[j];if((a[1]>p[1])!==(q[1]>p[1])&&p[0]<(q[0]-a[0])*(p[1]-a[1])/(q[1]-a[1])+a[0])yes=!yes;}return yes;};
    if(inside([x,z])&&Math.min(...terrace.map((a,i)=>distance([x,z],a,terrace[(i+1)%terrace.length])))>1.35){b.box(x,l.top,z,1.7,.38,1.4,'stone');b.add(new T.IcosahedronGeometry(.95,0),'green',x,l.top+1.0,z);}
   }
  }
 }
 // Photo1's prominent west approach zigzags between north and middle towers.
 // The lower survey/basement envelope is cut at this bounded corridor before
 // these walkable flights are added; stairs are not buried on a solid podium.
 for(let f=0;f<path.length-1;f++) {
  const a=path[f],q=path[f+1],dx=q[0]-a[0],dz=q[1]-a[1],run=Math.hypot(dx,dz),tx=dx/run,tz=dz/run,angle=-Math.atan2(tz,tx),steps=source.publicApproach.treadsPerFlight;
  // Approach flights stop at full-width turn platforms. The previous
  // centred 3.7m boxes buried their final seven treads behind tall risers.
  const start=f===0?0:turnSetback,flightRun=run-start-turnSetback;
  for(let k=0;k<steps;k++){const t=(k+.5)/steps,top=a[2]+(k+1)*(q[2]-a[2])/steps,g=new T.BoxGeometry(flightRun/steps+.012,top+.05,source.publicApproach.width);g.userData.role='public-stair-tread';g.userData.walkTop=top;b.add(g,'stone',a[0]+tx*(start+flightRun*t),(top-.05)/2,a[1]+tz*(start+flightRun*t),angle);}
  const landingShape=shape([landings[f]]),landing=openTopPrism(landingShape,0,q[2]),landingTop=upwardRoofPlane(landingShape,q[2]);
  landing.userData.role=landingTop.userData.role='public-stair-landing';b.add(landing,'stone');b.add(landingTop,'stone');
  // Substantial limestone planter/parapet beds, following each sloping
  // public flight as stepped groups rather than isolated shrub markers.
  for(let k=1;k<2;k++)for(const side of [-1,1]){const t=(k+.5)/3,y=a[2]+t*(q[2]-a[2]),x=a[0]+dx*t-side*tz*2.18,z=a[1]+dz*t+side*tx*2.18;
   const bed=new T.BoxGeometry(run/3+.05,.88,.90);bed.userData.role='public-planted-parapet';b.add(bed,'stone',x,y+.44,z,angle);b.box(x,y+.87,z,run/3-.12,.40,.73,'green',angle);
  }
 }
 // Photo24's long planted limestone beds frame the upper public valley.
 for(const [x,z,w,d] of [[0,-22,6,1.8],[-6,-29,6,1.4]]){const g=new T.BoxGeometry(w,.95,d);g.userData.role='public-planted-parapet';b.add(g,'stone',x,22.975,z);b.box(x,23.45,z,w-.28,.55,d-.25,'green');}

}
