import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import source from './el-tawheed-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
export const elTawheedFront=(()=>{const r=source.surveyRoofParts.find(p=>p.index===67)!.localRing,a=r[3],z=r[4],dx=z[0]-a[0],dz=z[1]-a[1],length=Math.hypot(dx,dz);return {a,z,length,u:[dx/length,dz/length],n:[-dz/length,dx/length]};})();
export const elTawheedOpenings=[...Array.from({length:6},(_,i)=>({u:1.2+i*2.61,y:4.50,w:1.72,h:2.37,tier:'middle'})),...Array.from({length:6},(_,i)=>({u:1.2+i*2.61,y:8.18,w:1.72,h:2.03,tier:'upper'})),...Array.from({length:6},(_,i)=>({u:i===0?.77:1.2+i*2.61,y:1.39,w:i===0?.74:1.72,h:2.15,tier:'lower'})).filter((_,i)=>i!==2),{u:6.42,y:.05,w:1.77,h:3.46,tier:'door'},{u:3.81,y:.24,w:2.15,h:.70,tier:'basement'}];
/** Original reconstruction. Survey rings define bounded roof regions, never imported mesh faces. */
export function buildElTawheed(_w:number,_d:number,b:BuildingTools){
 const {a,u,n,length}=elTawheedFront,angle=Math.atan2(-u[1],u[0]);
 const at=(t:number,offset=0)=>[a[0]+u[0]*t+n[0]*offset,a[1]+u[1]*t+n[1]*offset];
 const box=(t:number,y:number,w:number,h:number,d:number,c:Colour,offset=0)=>{const p=at(t,offset);b.box(p[0],y,p[1],w,h,d,c,angle);};
 // Least squares uses centred source vertices; this avoids unstable near-collinear triples.
 for(const part of source.surveyRoofParts){const r=part.localRing,cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length,cy=r.reduce((s,p)=>s+p[2],0)/r.length;
  let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of r){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}const det=xx*zz-xz*xz,sx=(xy*zz-zy*xz)/det,sz=(zy*xx-xy*xz)/det,top=(x:number,z:number)=>cy+sx*(x-cx)+sz*(z-cz);
  const sh=new T.Shape(r.map(p=>new T.Vector2(p[0],p[1]))),roof=upwardRoofPlane(sh);const p=roof.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,top(p.getX(i),p.getZ(i)));roof.computeVertexNormals();const raw=roof.toNonIndexed(),rp=raw.attributes.position,clean:number[]=[];for(let i=0;i<rp.count;i+=3){const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(rp,i+k)),area=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).y,maxEdge=Math.max(...[0,1,2].map(k=>Math.hypot(v[k].x-v[(k+1)%3].x,v[k].z-v[(k+1)%3].z)));if(area/maxEdge<.004)continue;for(const p of v)clean.push(...p.toArray());}const bounded=new T.BufferGeometry();bounded.setAttribute('position',new T.Float32BufferAttribute(clean,3));bounded.computeVertexNormals();bounded.userData.explicitRoof=true;bounded.userData.sourceZone=part.index;b.add(bounded,'slate');raw.dispose();roof.dispose();
  const vs:number[]=[];for(let i=0;i<r.length;i++){if(part.index===67&&i===3)continue;const p=r[i],q=r[(i+1)%r.length],ph=top(p[0],p[1]),qh=top(q[0],q[1]);vs.push(p[0],0,p[1],q[0],0,q[1],q[0],qh,q[1],p[0],0,p[1],q[0],qh,q[1],p[0],ph,p[1]);}const wall=new T.BufferGeometry();wall.setAttribute('position',new T.Float32BufferAttribute(vs,3));wall.computeVertexNormals();b.add(wall,'brick');
 }
 // Aperture-aware principal wall. Basement grille and flush double door cut the plinth;
 // the pale masonry base never blankets them. Ground tier's far-left narrow pair stays distinct.
 const ops=[...elTawheedOpenings,{u:1.63,y:1.39,w:.74,h:2.15,tier:'lower'}];
 const xs=[0,length,...ops.flatMap(p=>[Math.max(0,p.u-p.w/2),Math.min(length,p.u+p.w/2)])].sort((a,z)=>a-z),ys=[0,1.08,11.63,...ops.flatMap(p=>[p.y,p.y+p.h])].sort((a,z)=>a-z);
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;if(ops.some(p=>Math.abs(x-p.u)<p.w/2&&y>p.y&&y<p.y+p.h))continue;if(xs[i+1]-xs[i]<.001||ys[j+1]-ys[j]<.001)continue;box(x,ys[j],xs[i+1]-xs[i],ys[j+1]-ys[j],.19,y<1.08?'stone':'brick',-.075);}
 for(const o of ops){if(o.tier==='door'){box(o.u,o.y,o.w,o.h,.10,'dark',-.03);box(o.u,o.y,o.w-.12,2.25,.09,'brick',.035);box(o.u,2.34,o.w-.12,1.05,.08,'glass',.045);for(const x of [-.4,0,.4])box(o.u+x,2.34,.05,1.05,.06,'white',.10);box(o.u,2.25,o.w,.12,.13,'white',.10);for(const x of [-o.w/2,o.w/2])box(o.u+x,.05,.09,o.h,.16,'stone',.10);box(o.u,.02,.07,2.25,.07,'dark',.10);continue;}
  box(o.u,o.y,o.w,o.h,.08,o.tier==='basement'?'dark':'glass',-.015);
  const frame=o.tier==='basement'?'frame':'white';for(const x of [-o.w/2,o.w/2])box(o.u+x,o.y,.085,o.h,.14,frame,.065);for(const y of [o.y,o.y+o.h])box(o.u,y,o.w,.085,.14,frame,.065);
  if(o.w>1){
   // Source2025 and leaf-off2023: substantial centre divides two lights. Upper
   // storey has a short top transom; middle/ground main cross-bars differ.
   const cross=o.tier==='upper'?.77:o.tier==='middle'?.58:o.tier==='lower'?.69:.52;
   box(o.u,o.y,.105,o.h,.13,frame,.065);box(o.u,o.y+o.h*cross,o.w,.10,.14,frame,.065);
   if(o.tier!=='basement'){
    for(const x of [-o.w/4,o.w/4])box(o.u+x,o.y,.031,o.h,.095,'white',.09);
    const fine=o.tier==='upper'?[.29]:o.tier==='middle'?[.27,.80]:[.34];
    for(const y of fine)box(o.u,o.y+o.h*y,o.w,.035,.095,'white',.09);
   }
  }
  if(o.tier!=='basement')box(o.u,o.y-.12,o.w+.16,.13,.24,'stone',.08);
 }
 // Factory name panel is genuinely whitewashed. No invented identifying lettering.
 const panelLeft=2.10,panelRight=13.05;box((panelLeft+panelRight)/2,3.71,panelRight-panelLeft,.67,.07,'white',.07);
 // Projecting straight cornice with square modillions, upper pilaster strips and parapet teeth.
 box(length/2,10.70,length,.19,.24,'dark',.075);box(length/2,11.02,length+.06,.24,.32,'stone',.10);box(length/2,11.28,length+.11,.16,.40,'stone',.13);box(length/2,11.50,length,.13,.25,'dark',.08);
 for(let x=.20;x<length;x+=.48)box(x,10.90,.14,.24,.34,'stone',.18);
 // Source upper-pier strips are shallow brick relief. The previous .12m deep box
 // projected .14m beyond the wall and produced unsupported long dark game-view seams.
 // Retain strip phase/width, with photo-guided 17.5mm outward relief and buried backs.
 for(let i=0;i<7;i++){const x=.05+i*(length-.1)/6;box(x,7.85,.13,2.92,.025,'brick',.025);}
 for(let x=.3;x<length;x+=.85){const sh=new T.Shape();sh.moveTo(-.20,0);sh.lineTo(.20,0);sh.lineTo(.08,.18);sh.lineTo(-.08,.18);sh.closePath();const g=new T.ExtrudeGeometry(sh,{depth:.17,bevelEnabled:false});g.translate(0,11.63,-.085);g.rotateY(angle);const p=at(x,-.08);b.add(g,'brick',p[0],0,p[1]);}
 for(const x of [.12,length-.12])box(x,11.63,.29,.42,.32,'brick',-.06);
 // 2025 municipal view supports a shallow grey approach, not a full stair.
 // Preserve surveyed facade pavement datum y=0 and existing threshold y=.05.
 // Width/depth and 5cm rise are bounded photo-guided approximations; no tread count asserted.
 const approach:number[]=[];const p=[at(6.42-1.04,.11),at(6.42+1.04,.11),at(6.42+1.04,.90),at(6.42-1.04,.90)],approachYs=[.05,.05,0,0];
 for(const i of [0,2,1,0,3,2])approach.push(p[i][0],approachYs[i],p[i][1]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(approach,3));g.computeVertexNormals();b.add(g,'concrete');
 // Native rear is lower shed/factory roofs, not another three-storey facade.
}
