import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './ndsm-warehouse-complex-footprints.json';
import {upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
export interface NdsmPane {a:number[];b:number[];normal:number[];bottom:number;height:number;kind:'glass'|'entry';zone?:string;}
export const ndsmPaneProbes:NdsmPane[]=[];
/** Native original industrial reconstruction; six longitudinal bays, transverse
 * high mallenzolder and low east wing stay within their surveyed Pand. */
export function buildNdsmWarehouseComplex(_w:number,_d:number,{add,box}:BuildingTools){
 ndsmPaneProbes.length=0;
 const perimeter=data.outline[0].slice(0,-1).map(p=>new T.Vector2(...p as [number,number]));
 // Collapse survey-collinear vertices only, preserving the three real projecting
 // south office/entry volumes. These are facade chains rather than parcel bounds.
 let change=true;while(change){change=false;for(let i=0;i<perimeter.length;i++){const a=perimeter[(i-1+perimeter.length)%perimeter.length],p=perimeter[i],b=perimeter[(i+1)%perimeter.length],d=b.clone().sub(a),cross=Math.abs(d.x*(p.y-a.y)-d.y*(p.x-a.x))/d.length();if(cross<.055&&p.clone().sub(a).dot(b.clone().sub(p))>0){perimeter.splice(i,1);change=true;break;}}}
 function makeShape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 const roofEdges=data.roofs.flatMap(r=>r.rings.flatMap(r=>r.map((p,i)=>({p,q:r[(i+1)%r.length]}))));
 function height(p:T.Vector2){let best=Infinity,h=14.5;for(const e of roofEdges){const a=new T.Vector2(e.p[0],e.p[1]),d=new T.Vector2(e.q[0]-e.p[0],e.q[1]-e.p[1]),t=Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/d.lengthSq())),distance=p.distanceTo(a.addScaledVector(d,t));if(distance<best){best=distance;h=e.p[2]+t*(e.q[2]-e.p[2]);}}return h;}
 function surface(points:number[][],c:Colour,role:string){const values:number[]=[];for(let i=1;i<points.length-1;i++)values.push(...points[0],...points[i],...points[i+1]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.role=role;add(g,c);}
 const roofPlanes=new Map<number,(x:number,z:number)=>number>();
 // Each roof is freshly triangulated from a measured planar footprint. Centered
 // least squares uses all outer/hole vertices; no surveyed mesh is imported.
 for(const roof of data.roofs){const all=roof.rings.flat(),cx=all.reduce((s,p)=>s+p[0],0)/all.length,cz=all.reduce((s,p)=>s+p[1],0)/all.length,cy=all.reduce((s,p)=>s+p[2],0)/all.length;let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of all){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}const det=xx*zz-xz*xz;if(Math.abs(det)<1e-7)continue;const a=(xy*zz-zy*xz)/det,b=(zy*xx-xy*xz)/det,y=(x:number,z:number)=>cy+a*(x-cx)+b*(z-cz);
  roofPlanes.set(roof.index,y);
  const g=upwardRoofPlane(makeShape(roof.rings)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,y(p.getX(i),p.getZ(i)));g.computeVertexNormals();g.userData.role='roof';g.userData.surveyIndex=roof.index;const low=Math.min(...all.map(p=>p[2])),sloped=Math.hypot(a,b)>.13;
  add(g,sloped?'frame':'slate');
 }
 // Audit every shared native boundary, including hole rings occupied by other
 // roof regions. Join the actual two fitted roof datums, never a guessed common
 // skirt base. Exact coplanar/sloping joins remain roof surfaces. Empty source
 // holes and exterior boundaries have no partner and acquire no invented cap.
 const edges=data.roofs.flatMap(roof=>roof.rings.flatMap(ring=>ring.map((p,i)=>({index:roof.index,a:new T.Vector2(p[0],p[1]),b:new T.Vector2(ring[(i+1)%ring.length][0],ring[(i+1)%ring.length][1])}))));
 for(let i=0;i<edges.length;i++){
  const e=edges[i],d=e.b.clone().sub(e.a),length=d.length();if(length<.02)continue;const t=d.clone().normalize();
  for(const other of edges.slice(i+1)){
   if(e.index===other.index)continue;
   const c=other.a.clone().sub(e.a),v=other.b.clone().sub(e.a);
   if(Math.max(Math.abs(t.x*c.y-t.y*c.x),Math.abs(t.x*v.y-t.y*v.x))>.015)continue;
   const start=Math.max(0,Math.min(c.dot(t),v.dot(t))),end=Math.min(length,Math.max(c.dot(t),v.dot(t)));if(end-start<.03)continue;
   const a=e.a.clone().addScaledVector(t,start),b=e.a.clone().addScaledVector(t,end),p=roofPlanes.get(e.index)!,q=roofPlanes.get(other.index)!;
   const ap=p(a.x,a.y),bp=p(b.x,b.y),aq=q(a.x,a.y),bq=q(b.x,b.y);
   if(Math.max(Math.abs(ap-aq),Math.abs(bp-bq))<.03)continue;
   // Office bands already have source-photo glazing/crown assemblies just in
   // front of their surveyed rounded inside edges; keep those panes exposed.
   if((e.index===512&&other.index===544)||(e.index===513&&other.index===592))continue;
   const high=Math.max(ap,bp,aq,bq),jump=Math.max(Math.abs(ap-aq),Math.abs(bp-bq));
   const points=[[a.x,ap,a.y],[b.x,bp,b.y],[b.x,bq,b.y],[a.x,aq,a.y]];
   // Fitted datums can cross on a shared sloping edge. Split there rather than
   // emit a bow-tie quad; every piece is a vertical closure with roofs on top.
   const da=ap-aq,db=bp-bq;
   if(da*db<0){const f=da/(da-db),mid=a.clone().lerp(b,f),y=ap+f*(bp-ap);surface([points[0],points[3],[mid.x,y,mid.y]],jump>3?'greyBrick':'frame','roof-interface');surface([points[1],points[2],[mid.x,y,mid.y]],jump>3?'greyBrick':'frame','roof-interface');}
   else surface(points,jump>3||high>19?'greyBrick':'frame','roof-interface');
  }
 }
 // Projecting office outlines are exterior low walls. Their recessed high hall
 // backing lies INSIDE the Pand, so perimeter shells and 14.45m rooflight skirts
 // cannot close it. Current west/south panoramas show glass/steel between the
 // office roof and historic masonry band; surveyed roof planes own both datums.
 for(const backdrop of data.frontageRepair20261006.officeBackdrops.assemblies){
  const [a,b]=backdrop.endpointsXZ.map(p=>new T.Vector2(...p as [number,number])),d=b.clone().sub(a),length=d.length(),t=d.clone().normalize(),n=new T.Vector2(-t.y,t.x),rot=Math.atan2(-d.y,d.x);
  const low=roofPlanes.get(backdrop.officeRoofIndex)!,high=roofPlanes.get(backdrop.hallRoofIndex)!,band=data.frontageRepair20261006.officeBackdrops.glazingTopMetres;
  const at=(u:number,y:number,offset=0)=>{const q=a.clone().addScaledVector(t,u).addScaledVector(n,offset);return[q.x,y,q.y];},datum=(u:number,plane:(x:number,z:number)=>number)=>{const q=a.clone().addScaledVector(t,u);return plane(q.x,q.y);};
  surface([at(0,datum(0,low)),at(length,datum(length,low)),at(length,band),at(0,band)],'glass','facade-glass');
  surface([at(0,band),at(length,band),at(length,datum(length,high)),at(0,datum(0,high))],'greyBrick','office-backdrop-crown');
  // Thin glass-face frames remain exposed, with no wall slab hiding the strip.
  for(let u=0;u<length+.001;u+=.85){const q=at(Math.min(u,length),datum(Math.min(u,length),low),.09);box(q[0],q[1],q[2],.065,band-q[1],.08,'frame');}
  const end=at(length,datum(length,low),.09);box(end[0],end[1],end[2],.12,band-end[1],.12,'frame');
  for(const y of[band]){const q=at(length/2,y,.08);box(q[0],y,q[2],length,.12,.12,'frame',rot);}
  ndsmPaneProbes.push({a:at(0,0),b:at(length,0),normal:[n.x,n.y],bottom:Math.max(datum(0,low),datum(length,low))+.08,height:band-Math.max(datum(0,low),datum(length,low))-.16,kind:'glass',zone:backdrop.id});
 }
 // Split observed roof families at surveyed shared boundary vertices. Sampling
 // one endpoint of a 161 m facade cannot describe its high hall and low wing.
 for(let i=0;i<perimeter.length;i++){
  const a=perimeter[i],b=perimeter[(i+1)%perimeter.length],delta=b.clone().sub(a),len=delta.length(),tangent=delta.clone().normalize(),normal=new T.Vector2(-tangent.y,tangent.x),rot=Math.atan2(-delta.y,delta.x);
  const south=normal.y>.5,west=normal.x<-.5;
  const breaks=i===0?[0,47.97,len]:i===2?[0,20.32,len]:[0,len];
  const local=(u:number,y:number,offset=0)=>{const p=a.clone().addScaledVector(tangent,u).addScaledVector(normal,offset);return[p.x,y,p.y];};
  for(let section=0;section<breaks.length-1;section++){
   const left=breaks[section],right=breaks[section+1],sectionLength=right-left;
   // One-sided edge heights preserve the discontinuous roof-family junction.
   const wallTop=(u:number)=>height(a.clone().addScaledVector(tangent,Math.max(left+.035,Math.min(right-.035,u))));
   const hmid=wallTop((left+right)/2),tall=hmid>12,northHigh=i===2&&tall;
   const zone=i===0?(tall?'south-main':'south-low-wing'):i===2?(tall?'north-high':'north-low-wing'):i===8?'southwest-main-portal':`edge-${i}`;
   const count=sectionLength>20?Math.max(1,Math.round(sectionLength/(south?8.0:9.8))):0,step=sectionLength/(count||1);
   const openings:{l:number;r:number;y:number;h:number;kind:'glass'|'entry'|'door'|'blue-screen'}[]=[];
   for(let j=0;j<count;j++){
    const mid=left+(j+.5)*step,width=step*(south?.73:.64);
    // Only retain the established secondary NW entry here. The observed main
    // expedition entrance is placed explicitly on the southwest frontage below.
    const entry=i===3&&j===Math.floor(count/2),blue=tall&&i===3&&!entry&&j%3===0;
    const blueScreen=northHigh&&(j===3||j===8||j===count-1);
    openings.push({l:mid-width/2,r:mid+width/2,y:entry?0:blueScreen?0:tall?2.6:1.0,h:entry?7.2:blueScreen?15.8:tall?Math.max(7,Math.min(14.8,hmid-6.4)):Math.min(5.5,hmid-1.4),kind:entry?'entry':blue?'door':blueScreen?'blue-screen':'glass'});
   }
   if(i===8){
    // Current 2024 panorama 01820 shows this portal beyond the projecting
    // office, with blue sliding leaves parked on both sides. Width/position
    // are photo-guided; 10.5 m leaf/opening height is stated by the architect.
    const portal={l:22.55,r:30.05,y:0,h:10.5,kind:'entry' as const};
    // Parked leaf bays own their footprint so no ordinary pane lies beneath.
    for(let j=openings.length-1;j>=0;j--)if(openings[j].r>18.8&&openings[j].l<33.8)openings.splice(j,1);
    openings.push({l:18.8,r:22.4,y:0,h:10.5,kind:'door'},portal,{l:30.2,r:33.8,y:0,h:10.5,kind:'door'});
    openings.sort((x,y)=>x.l-y.l);
   }
   function wall(l:number,r:number,bottom:number,topL:number,topR=topL){if(r-l<.001||topL<=bottom||topR<=bottom)return;surface([local(l,bottom),local(r,bottom),local(r,topR),local(l,topL)],'greyBrick','facade-wall');}
   let last=left;
   for(const o of openings){
    wall(last,o.l,0,wallTop(last),wallTop(o.l));wall(o.l,o.r,0,o.y);wall(o.l,o.r,o.y+o.h,wallTop(o.l),wallTop(o.r));last=o.r;
    const center=(o.l+o.r)/2,width=o.r-o.l,point=a.clone().addScaledVector(tangent,center).addScaledVector(normal,.06);
    if(o.kind!=='entry'){
     const g=new T.PlaneGeometry(width,o.h);g.userData.role=o.kind==='door'?'blue-door':'facade-glass';g.userData.frontageZone=zone;
     add(g,o.kind==='door'?'blue':'glass',point.x,o.y+o.h/2,point.y,rot);
     if(o.kind==='blue-screen'){const lower=new T.PlaneGeometry(width,2.6);lower.userData.role='blue-door';const p=a.clone().addScaledVector(tangent,center).addScaledVector(normal,.075);add(lower,'blue',p.x,1.3,p.y,rot);}
    }
    const frameColour=o.kind==='door'||o.kind==='blue-screen'?'blue':'frame';
    for(const u of[o.l,o.r]){const p=a.clone().addScaledVector(tangent,u).addScaledVector(normal,.09);box(p.x,o.y,p.y,.14,o.h,.14,frameColour);}
    // A portal has only jambs and a lintel: no mid-height beam or sill may
    // obstruct its sourced 10.5 m clear opening.
    for(const v of o.kind==='entry'?[o.y+o.h+.08]:[o.y,o.y+o.h,o.y+o.h*.5]){const p=a.clone().addScaledVector(tangent,center).addScaledVector(normal,.11);box(p.x,v,p.y,width,.12,.14,frameColour,rot);}
    if(o.kind!=='entry')for(let u=o.l+.85;u<o.r-.4;u+=.85){const p=a.clone().addScaledVector(tangent,u).addScaledVector(normal,.12);box(p.x,o.y,p.y,.065,o.h,.08,frameColour);}
    if(o.kind!=='door')ndsmPaneProbes.push({a:local(o.l,0),b:local(o.r,0),normal:[normal.x,normal.y],bottom:o.kind==='blue-screen'?2.6:o.y,height:o.kind==='blue-screen'?o.h-2.6:o.h,kind:o.kind==='entry'?'entry':'glass',zone});
   }
   wall(last,right,0,wallTop(last),wallTop(right));
   for(let u=left;u<right;u+=step||sectionLength){
    // Preserve portal clearance when the nominal steel-grid pitch crosses it.
    if(openings.some(o=>o.kind==='entry'&&u>o.l&&u<o.r))continue;
    const p=a.clone().addScaledVector(tangent,u).addScaledVector(normal,.055);box(p.x,0,p.y,.16,wallTop(u),.14,'frame');
   }
   // Horizontal grid is clipped around openings. Continuous beams used to
   // cross the portal and can hide upper glazing at the source probe heights.
   for(const y of[tall?10.0:6.9,tall?13.9:8.8]){
    let from=left;
    const gaps=openings.filter(o=>y>=o.y&&y<o.y+o.h).sort((x,y)=>x.l-y.l);
    for(const gap of[...gaps,{l:right,r:right}]){if(gap.l>from){const l=from,r=gap.l;if(y<Math.min(wallTop(l),wallTop(r))){const p=a.clone().addScaledVector(tangent,(l+r)/2).addScaledVector(normal,.06);box(p.x,y,p.y,r-l,.12,.12,'frame',rot);}}from=gap.r;}
   }
  }
 }
}
