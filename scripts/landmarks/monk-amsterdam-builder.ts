import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import data from './monk-amsterdam-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
type Point=[number,number,number];
/** Whole shared industrial host, not a fabricated standalone Monk warehouse.
 * Survey polygons inform original planar geometry. All tenants share the host. */
export function buildMonkAmsterdam(_w:number,_d:number,{add}:BuildingTools){
 const outline=data.outline[0].map(p=>new T.Vector2(p[0],p[1]));
 // Register the generalized LoD2.2 exterior to the current BAG boundary.
 // Only submetre perimeter discrepancies are snapped; internal faces stay native.
 const registered=(p:number[])=>{const q=new T.Vector2(p[0],p[1]);let best=q,dist=.9;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],t=b.clone().sub(a),f=T.MathUtils.clamp(q.clone().sub(a).dot(t)/t.lengthSq(),0,1),c=a.clone().addScaledVector(t,f),d=c.distanceTo(q);if(d<dist){best=c;dist=d;}}return [best.x,best.y,p[2]];};
 const shape=(rings:number[][][],project:(p:number[])=>T.Vector2)=>{const s=new T.Shape(rings[0].map(project));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(project)));return s;};
 // Explicit surveyed roofs own their tops. Fit every vertex using a centered
 // least-squares plane; rounded first vertices must never create tall roof fins.
 for(const [roofIndex,sourceRoof] of data.roofs.entries()){
  const roof={rings:sourceRoof.rings.map((r,i)=>i===0?r.map(registered):r)};
  const points=roof.rings.flat(),cx=points.reduce((a,p)=>a+p[0],0)/points.length,cz=points.reduce((a,p)=>a+p[1],0)/points.length,cy=points.reduce((a,p)=>a+p[2],0)/points.length;
  let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of points){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,b=(zy*xx-xy*xz)/det;
  const g=upwardRoofPlane(shape(roof.rings,p=>new T.Vector2(p[0],p[1]))),positions=g.getAttribute('position');
  for(let i=0;i<positions.count;i++)positions.setY(i,cy+a*(positions.getX(i)-cx)+b*(positions.getZ(i)-cz));const indices=g.index!;for(let i=0;i<indices.count;i+=3){const a=new T.Vector3().fromBufferAttribute(positions,indices.getX(i)),b=new T.Vector3().fromBufferAttribute(positions,indices.getX(i+1)),c=new T.Vector3().fromBufferAttribute(positions,indices.getX(i+2));if(b.sub(a).cross(c.sub(a)).y<0){const j=indices.getX(i+1);indices.setX(i+1,indices.getX(i+2));indices.setX(i+2,j);}}g.computeVertexNormals();g.userData.assembly='survey-roof';g.userData.roofIndex=roofIndex;add(g,(data.currentRooflights.measuredNortheastRooflightIndices as number[]).includes(roofIndex)?'white':'slate');
  // Current aerial rooflights are thin flush sheets, projected onto native
  // measured slopes. Clip against actual triangulated roofs, preserving holes.
  for(const light of data.currentRooflights.strips.filter(l=>l.roofIndex===roofIndex)){
   const a=new T.Vector2(...light.a as [number,number]),b=new T.Vector2(...light.b as [number,number]),t=b.clone().sub(a).normalize(),n=new T.Vector2(-t.y,t.x).multiplyScalar(light.widthMetres/2),clip=[a.clone().sub(n),b.clone().sub(n),b.clone().add(n),a.clone().add(n)];
   const values:number[]=[];
   for(let i=0;i<indices.count;i+=3){let polygon=[0,1,2].map(k=>{const j=indices.getX(i+k);return new T.Vector2(positions.getX(j),positions.getZ(j));});
    for(let e=0;e<4&&polygon.length;e++){const p=clip[e],q=clip[(e+1)%4],edge=q.clone().sub(p),side=(v:T.Vector2)=>edge.x*(v.y-p.y)-edge.y*(v.x-p.x),next:T.Vector2[]=[];for(let j=0;j<polygon.length;j++){const u=polygon[j],v=polygon[(j+1)%polygon.length],su=side(u),sv=side(v);if(su>=-1e-8)next.push(u);if((su>=0)!==(sv>=0))next.push(u.clone().lerp(v,su/(su-sv)));}polygon=next;}
    for(let j=1;j+1<polygon.length;j++)for(const p of[polygon[0],polygon[j],polygon[j+1]])values.push(p.x,cy+aRoof(p.x,p.y)+.035,p.y);
   }
   function aRoof(x:number,z:number){return (xy*zz-zy*xz)/det*(x-cx)+(zy*xx-xy*xz)/det*(z-cz);}
   if(values.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.assembly='current-rooflight';g.userData.sourceRoofIndex=roofIndex;g.userData.sourceLightId=light.id;add(g,'white');}
  }

 }
 for(const sourceWall of data.surveyWalls){
  const wall={...sourceWall,rings:sourceWall.rings.map(r=>r.map(registered))};
  const pts=wall.rings[0] as Point[],p=pts[0];let q=p;
  for(const v of pts)if(Math.hypot(v[0]-p[0],v[1]-p[1])>Math.hypot(q[0]-p[0],q[1]-p[1]))q=v;
  const len=Math.hypot(q[0]-p[0],q[1]-p[1]);if(len<.01)continue;
  const t=new T.Vector2((q[0]-p[0])/len,(q[1]-p[1])/len),g=new T.ShapeGeometry(shape(wall.rings,v=>new T.Vector2((v[0]-p[0])*t.x+(v[1]-p[1])*t.y,v[2]))),pos=g.getAttribute('position');
  for(let i=0;i<pos.count;i++){const d=pos.getX(i),y=pos.getY(i);pos.setXYZ(i,p[0]+t.x*d,y,p[1]+t.y*d);}g.computeVertexNormals();g.userData.assembly='survey-wall';g.userData.onFootprintEdge=wall.onFootprintEdge;add(g,'dark');
 }
 // The source-photographed raised strip end remains a black ribbed steel wall.
 const strip=data.roofs[14].rings[0],endA=strip[strip.length-1],endB=strip[0],a=new T.Vector2(endA[0],endA[1]),b=new T.Vector2(endB[0],endB[1]),t=b.clone().sub(a).normalize(),n=new T.Vector2(-t.y,t.x),endLength=a.distanceTo(b);
 for(let d=.1;d<endLength-.15;d+=.28){const at=(along:number,out:number)=>a.clone().addScaledVector(t,along).addScaledVector(n,out),u=at(d,.05),v=at(d+.11,.12),w=at(d+.22,.05),positions:number[]=[];for(const [p,q]of[[u,v],[v,w]])positions.push(p.x,5.3,p.y,q.x,5.3,q.y,q.x,14.63,q.y,p.x,5.3,p.y,q.x,14.63,q.y,p.x,14.63,p.y);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.userData.assembly='high-strip-corrugation';add(g,'dark');}
 const v=(i:number)=>new T.Vector2(...data.outline[0][i] as [number,number]);
 function facade(p:T.Vector2,q:T.Vector2,height:number){
  const t=q.clone().sub(p).normalize(),n=new T.Vector2(-t.y,t.x),len=p.distanceTo(q),yaw=Math.atan2(-t.y,t.x);
  const at=(distance:number,offset:number)=>p.clone().addScaledVector(t,distance).addScaledVector(n,offset);
  const panel=(a:number,b:number,y:number,h:number,c:Colour,offset=.12)=>{const m=at((a+b)/2,offset);add(new T.PlaneGeometry(b-a,h),c,m.x,y+h/2,m.y,yaw)};
  panel(0,len,.03,5.24,'dark');
  // Folded vertical steel sheets, with black recesses and lit charcoal ridges.
  for(let d=.08;d<len-.08;d+=.24){const a=at(d,.13),b=at(Math.min(d+.12,len),.2),c=at(Math.min(d+.24,len),.13);const positions:number[]=[];for(const [u,v]of[[a,b],[b,c]])positions.push(u.x,.04,u.y,v.x,.04,v.y,v.x,5.27,v.y,u.x,.04,u.y,v.x,5.27,v.y,u.x,5.27,u.y);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.userData.assembly='corrugated-steel';add(g,'dark');}
  panel(0,len,5.27,height-5.27,'dark',.23);panel(.13,len-.13,5.4,height-5.57,'glass',.27);
  const bays=Math.ceil(len/2.1);for(let i=0;i<=bays;i++)panel(Math.max(0,i*len/bays-.05),Math.min(len,i*len/bays+.05),5.27,height-5.27,'dark',.3);
  panel(0,len,6.78,.06,'dark',.31);panel(0,len,height-.16,.18,'dark',.32);
  return {len,panel};
 }
 // Native waterfront facade and factory west wall, measured and photographed.
 const front=facade(v(19),v(20),8.1),west=facade(v(12),v(13),7.85);
 function opening(f:ReturnType<typeof facade>,a:number,width:number,height:number,glass:boolean){
  f.panel(a,a+width,.12,height,'frame',.34);f.panel(a+.1,a+width-.1,.22,height-.2,glass?'glass':'frame',.38);
  for(let y=.8;y<height;y+=.65)f.panel(a+.1,a+width-.1,y,.045,'dark',.42);
 }
 // The tall loading door, short roller shutter, then separate glazed pedestrian
 // doorway are defining Monk assemblies; widths/positions remain photo-inferred.
 opening(front,18,5.2,4.8,false);front.panel(18.12,23.08,1.7,1.65,'glass',.44);
 // Operator photos show the glazing sill stepped up directly above loading
 // portal. Metal infill sits before the continuous backing ribbon.
 front.panel(18,23.2,5.27,.95,'dark',.35);front.panel(18,23.2,6.2,.09,'dark',.39);
 opening(front,25.2,2.5,2.9,false);
 front.panel(29.3,31.7,.12,2.85,'frame',.45);front.panel(29.43,31.57,.24,2.61,'glass',.49);front.panel(30.45,30.55,.24,2.61,'dark',.52);
 // Neighboring businesses remain distinct: low grouped windows and loading bays,
 // rather than repeating the Monk doorway down the entire shared front.
 opening(front,7,4.8,4.3,true);
 for(const a of[37,44,56,67,78]){front.panel(a,a+4.4,.85,1.85,'frame',.34);front.panel(a+.1,a+4.3,.95,1.65,'glass',.38);for(let x=a+1.1;x<a+4.3;x+=1.1)front.panel(x-.04,x+.04,.95,1.65,'frame',.42);}
 for(const a of[8,23,42,58])opening(west,a,4,3.4,true);
}
