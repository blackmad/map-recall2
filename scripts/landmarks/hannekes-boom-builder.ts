import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
import source from './hannekes-boom-footprints.json';
/** Original texture-free surveyed pavilion. Reference pixels and source meshes are not imported. */
export function buildHannekesBoom(_w: number, _d: number, b: BuildingTools) {
  const anchor = source.anchorLatLon, factor = 111320 * Math.cos(anchor[0] * Math.PI / 180);
  const ring = source.mainCandidateFeature.geometry.coordinates[0].slice(0, -1).map(([lng, lat]) => new T.Vector2((lng-anchor[1])*factor, -(lat-anchor[0])*110540));
  const winding = Math.sign(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p.x*q.y-q.x*p.y;},0));
  const emit = (v:number[][], c:Parameters<BuildingTools['add']>[1]) => {const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flat(),3));g.computeVertexNormals();b.add(g,c);};
  const roof = (r:number[][], c:Parameters<BuildingTools['add']>[1]) => {for(const t of T.ShapeUtils.triangulateShape(r.map(p=>new T.Vector2(p[0],p[2])),[])){const p=t.map(i=>r[i]);if(new T.Vector3(...p[1] as [number,number,number]).sub(new T.Vector3(...p[0] as [number,number,number])).cross(new T.Vector3(...p[2] as [number,number,number]).sub(new T.Vector3(...p[0] as [number,number,number]))).y<0)[p[1],p[2]]=[p[2],p[1]];emit(p,c);}};
  const beam=(a:T.Vector3,q:T.Vector3,w:number,c:Parameters<BuildingTools['add']>[1])=>{const d=q.clone().sub(a),g=new T.BoxGeometry(w,w,d.length());g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),d.clone().normalize()));const p=a.clone().add(q).multiplyScalar(.5);b.add(g,c,p.x,p.y,p.z);};
  const shape=new T.Shape(ring);b.add(openTopPrism(shape,0,.16),'dark');b.add(upwardRoofPlane(shape,.16),'dark');
  // Main occupied deck and the distinctly lower north service wing own their tops.
  const main=source.roofPlanes.find(p=>p.sourceSurface===35)!.rings[0], north=source.roofPlanes.find(p=>p.sourceSurface===33)!.rings[0];
  roof(main,'ochre');roof(north,'slate');
  // Close only the surveyed shared roof step: low service annex against deck.
  for(let i=0;i<main.length;i++)for(let j=0;j<north.length;j++){const a=main[i],q=main[(i+1)%main.length],u=north[j],v=north[(j+1)%north.length],same=(p:number[],r:number[])=>Math.hypot(p[0]-r[0],p[2]-r[2])<.015;const pair=same(a,u)&&same(q,v)?[u,v]:same(a,v)&&same(q,u)?[v,u]:null;if(pair){const vertices=[a,pair[0],pair[1],a,pair[1],q];emit(vertices,'ochre');emit(vertices.map(p=>p).reverse(),'ochre');}}
  // Survey canopy is a local covered terrace bay, not a 6m building extrusion.
  const canopy=source.roofPlanes.find(p=>p.sourceSurface===36)!.rings[0];roof(canopy,'green');
  // AHN records the covering roof and inclined windscreen as upper surfaces;
  // the occupied deck continues underneath and physically supports its posts.
  for(const surface of [34,36])roof(source.roofPlanes.find(p=>p.sourceSurface===surface)!.rings[0].map(p=>[p[0],3.76,p[2]]),'ochre');
  const heightAt=(p:T.Vector2)=> {let distance=Infinity,h=3.8;for(const r of [main,north])for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],d=new T.Vector2(q[0]-a[0],q[2]-a[2]);const t=T.MathUtils.clamp(p.clone().sub(new T.Vector2(a[0],a[2])).dot(d)/d.lengthSq(),0,1),near=p.distanceTo(new T.Vector2(a[0]+t*d.x,a[2]+t*d.y));if(near<distance){distance=near;h=a[1]+t*(q[1]-a[1]);}}return h;};
  const inside=(p:T.Vector2,r:number[][])=>{let odd=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],q=r[j];if((a[2]>p.y)!==(q[2]>p.y)&&p.x<(q[0]-a[0])*(p.y-a[2])/(q[2]-a[2])+a[0])odd=!odd;}return odd;};
  const owners=[main,north,...[34,36].map(id=>source.roofPlanes.find(p=>p.sourceSurface===id)!.rings[0].map(p=>[p[0],3.76,p[2]]))];
  // Exact 2D difference of installed shell and occupied surveyed roof cells.
  // Triangulated convex clipping retains only genuine narrow mismatch seams;
  // filling those at the lower adjacent height preserves the surveyed step.
  const clip=(polygon:T.Vector2[],a:T.Vector2,q:T.Vector2,keepInside:boolean)=>{const d=q.clone().sub(a),side=(p:T.Vector2)=>d.x*(p.y-a.y)-d.y*(p.x-a.x),out:T.Vector2[]=[];for(let i=0;i<polygon.length;i++){const p=polygon[i],r=polygon[(i+1)%polygon.length],sp=side(p),sr=side(r),kp=keepInside?sp>=-1e-9:sp<=1e-9,kr=keepInside?sr>=-1e-9:sr<=1e-9;if(kp)out.push(p);if(kp!==kr)out.push(p.clone().lerp(r,sp/(sp-sr)));}return out;};
  let seams=T.ShapeUtils.triangulateShape(ring,[]).map(t=>t.map(i=>ring[i]));
  for(const r of owners){const xy=r.map(p=>new T.Vector2(p[0],p[2]));for(const indices of T.ShapeUtils.triangulateShape(xy,[])){let triangle=indices.map(i=>xy[i]);if(triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0]))<0)triangle.reverse();const next:T.Vector2[][]=[];for(const polygon of seams){let insidePart=polygon;for(let i=0;i<3&&insidePart.length;i++){const outside=clip(insidePart,triangle[i],triangle[(i+1)%3],false);if(outside.length>=3)next.push(outside);insidePart=clip(insidePart,triangle[i],triangle[(i+1)%3],true);}}seams=next;}}
  for(const seam of seams){const area=Math.abs(seam.reduce((sum,p,i)=>{const q=seam[(i+1)%seam.length];return sum+p.x*q.y-q.x*p.y;},0))/2;if(area<1e-5)continue;const h=Math.min(...seam.map(p=>heightAt(p)));roof(seam.map(p=>[p.x,h,p.y]),'ochre');}
  const nearest=(p:T.Vector2,r:number[][])=>{let distance=Infinity,result=new T.Vector3();for(let i=0;i<r.length;i++){const a=new T.Vector3(...r[i] as [number,number,number]),q=new T.Vector3(...r[(i+1)%r.length] as [number,number,number]),v=new T.Vector2(q.x-a.x,q.z-a.z),t=T.MathUtils.clamp(p.clone().sub(new T.Vector2(a.x,a.z)).dot(v)/v.lengthSq(),0,1),point=a.clone().lerp(q,t),d=p.distanceTo(new T.Vector2(point.x,point.z));if(d<distance){distance=d;result=point;}}return result;};
  for(let i=0;i<ring.length;i++){
    const a=ring[i],q=ring[(i+1)%ring.length],d=q.clone().sub(a),len=d.length(),n=new T.Vector2(d.y,-d.x).normalize().multiplyScalar(winding),angle=-Math.atan2(d.y,d.x),m=a.clone().add(q).multiplyScalar(.5),h=i===0?3.83:Math.min(heightAt(a),heightAt(q));
    // Exposed long south/west/east elevations have timber boards, real glazed
    // opening groups and doors. Glazing sits outside the opaque parent wall.
    if(i===0){const split=.964;for(const [lo,hi,top]of [[0,split,3.83],[split,1,heightAt(q)]]){const p=a.clone().lerp(q,(lo+hi)/2);b.box(p.x,.16,p.y,len*(hi-lo),top-.16,.16,'ochre',angle);}const mainA=new T.Vector3(...main.find(p=>p[0]>4&&p[2]>4)! as [number,number,number]),mainQ=new T.Vector3(...main.find(p=>p[0]>3&&p[2]<-4)! as [number,number,number]),outerQ=a.clone().lerp(q,split);roof([[a.x,3.83,a.y],[outerQ.x,3.83,outerQ.y],[mainQ.x,mainQ.y,mainQ.z],[mainA.x,mainA.y,mainA.z]],'ochre');}else b.box(m.x,.16,m.y,len,h-.16,.16,'ochre',angle);
    for(let y=.38;y<h-.15;y+=.25){const trimLength=i===0&&y>heightAt(q)?len*.964:len,trimMid=i===0&&y>heightAt(q)?a.clone().lerp(q,.482):m;b.box(trimMid.x+n.x*.095,y,trimMid.y+n.y*.095,trimLength,.025,.035,'bronze',angle);}
    if(i===12||i===13){
      // Observed minimum groups, not generated equal windows. South facade:
      // two broad assemblies, adjacent narrow glazed door, right-hand aperture.
      const groups=i===13?[[.16,2.3,1.45,.9],[.38,2.35,1.45,.9],[.585,1.05,2.45,.2],[.79,1.8,1.45,.9]]:[[.20,2.15,1.45,.9],[.44,2.15,1.45,.9],[.69,1.0,2.45,.2],[.86,1.4,1.45,.9]];
      for(const [t,width,glassHeight,base]of groups){const p=a.clone().lerp(q,t);b.box(p.x+n.x*.12,base-.07,p.y+n.y*.12,width+.14,glassHeight+.14,.07,'white',angle);
        b.box(p.x+n.x*.165,base,p.y+n.y*.165,width,glassHeight,.07,'glass',angle);
        if(glassHeight<2){b.box(p.x+n.x*.21,base,p.y+n.y*.21,.055,glassHeight,.07,'white',angle);b.box(p.x+n.x*.21,base+glassHeight*.78,p.y+n.y*.21,width,.055,.07,'white',angle);}
      }
    }
    { // Awnings own only photograph-supported southern/western fronts.
    // Native lean-to corrugated front awnings visible in current operator photo.
    // Rear service perimeter stays clear; do not seal the entire terrace parcel.
    if(i===12||i===13){const innerA=a.clone().addScaledVector(n,.12),innerQ=q.clone().addScaledVector(n,.12),outerA=a.clone().addScaledVector(n,.95),outerQ=q.clone().addScaledVector(n,.95);roof([[innerA.x,2.99,innerA.y],[innerQ.x,2.99,innerQ.y],[outerQ.x,2.64,outerQ.y],[outerA.x,2.64,outerA.y]],'slate');
      const outerM=m.clone().addScaledVector(n,.95);b.box(outerM.x,2.54,outerM.y,len,.17,.12,'red',angle);
      const steps=Math.ceil(len/.22);for(let j=0;j<=steps;j++){const p=a.clone().lerp(q,j/steps);beam(new T.Vector3(p.x+n.x*.12,3.005,p.y+n.y*.12),new T.Vector3(p.x+n.x*.95,2.655,p.y+n.y*.95),.025,'stone');}
      for(const t of [.02,.42,.65,.98]){const p=a.clone().lerp(q,t).addScaledVector(n,.86);b.box(p.x,.16,p.y,.14,2.52,.14,'red');}
    }}
    // Installed rounded GeoJSON and current surveyed roof borders differ by
    // ~0.2m at recesses. Keep the lower service top, bridge that narrow seam,
    // and close its riser at the owning surveyed deck edge. Never raise the
    // entire northern annex because a main-deck plane is nearby.
    const spans=Math.max(1,Math.ceil(len/.14));for(let j=0;j<spans;j++){
      const lo=j/spans,hi=(j+1)/spans,p=a.clone().lerp(q,(lo+hi)/2);let owner:number[][]|undefined;
      for(const inset of [.1,.2,.3,.45,.6]){owner=owners.find(r=>inside(p.clone().addScaledVector(n,-inset),r));if(owner)break;}
      if(!owner)continue;const pa=a.clone().lerp(q,lo),pq=a.clone().lerp(q,hi),sa=nearest(pa,owner),sq=nearest(pq,owner),distance=p.distanceTo(new T.Vector2((sa.x+sq.x)/2,(sa.z+sq.z)/2));
      const low=Math.min(h,sa.y,sq.y);if(distance>.65||(distance<.09&&Math.max(sa.y,sq.y)-low<.09))continue;
      if(Math.max(sa.y,sq.y)-low>.09){let triangles=[[sa.x,low,sa.z],[sq.x,low,sq.z],[sq.x,sq.y,sq.z],[sa.x,low,sa.z],[sq.x,sq.y,sq.z],[sa.x,sa.y,sa.z]];const normal=new T.Vector3(...triangles[1] as [number,number,number]).sub(new T.Vector3(...triangles[0] as [number,number,number])).cross(new T.Vector3(...triangles[2] as [number,number,number]).sub(new T.Vector3(...triangles[0] as [number,number,number])));if(normal.x*n.x+normal.z*n.y<0)for(let k=0;k<triangles.length;k+=3)[triangles[k+1],triangles[k+2]]=[triangles[k+2],triangles[k+1]];emit(triangles,'ochre');}
    }
    // Actual roof-terrace perimeter uses differently painted reclaimed boards.
    // Only main-deck edges; northern lower annex is not an occupied terrace.
    if(h>3.55&&len>1.5){const colours=['gold','blue','stone','red','green','ochre'] as const;const count=Math.ceil(len/.28);for(let j=0;j<count;j++){const t=(j+.5)/count;if(i===0&&(t>.964||(t>.68&&t<.82)))continue;const p=a.clone().lerp(q,t);b.box(p.x,h,p.y,len/count-.012,1.05,.105,colours[(j+i)%colours.length],angle);}if(i===0){for(const [lo,hi]of [[0,.68],[.82,.964]]){const p=a.clone().lerp(q,(lo+hi)/2);b.box(p.x,h+1.05,p.y,len*(hi-lo),.12,.18,'dark',angle);}}else b.box(m.x,h+1.05,m.y,len,.12,.18,'dark',angle);
      // Glass windbreaks are separate exposed thin panes, above the parapet.
      if(n.x<-.5){const bays=Math.ceil(len/1.7);for(let j=0;j<bays;j++){const p=a.clone().lerp(q,(j+.5)/bays);b.box(p.x,h+1.17,p.y,len/bays-.08,.86,.035,'glass',angle);}for(let j=0;j<=bays;j++){const p=a.clone().lerp(q,j/bays);b.box(p.x,h,p.y,.065,2.04,.065,'frame');}}
    }
  }
  // Close corner returns on the actual surveyed owning-roof border too.
  // A nearest projection can collapse to a corner and miss the short adjacent
  // return where an installed recess is shifted beyond that surveyed corner.
  for(const r of [main,north]){const sign=Math.sign(r.reduce((sum,p,i)=>{const q=r[(i+1)%r.length];return sum+p[0]*q[2]-q[0]*p[2];},0));for(let i=0;i<r.length;i++){const a=new T.Vector3(...r[i] as [number,number,number]),q=new T.Vector3(...r[(i+1)%r.length] as [number,number,number]),length=Math.hypot(q.x-a.x,q.z-a.z),steps=Math.max(1,Math.ceil(length/.1));for(let j=0;j<steps;j++){const p=a.clone().lerp(q,(j+.5)/steps);let nearestDistance=Infinity,wallHeight=Infinity;for(let k=0;k<ring.length;k++){const u=ring[k],v=ring[(k+1)%ring.length],d=v.clone().sub(u),t=T.MathUtils.clamp(new T.Vector2(p.x,p.z).sub(u).dot(d)/d.lengthSq(),0,1),distance=new T.Vector2(p.x,p.z).distanceTo(u.clone().lerp(v,t));nearestDistance=Math.min(nearestDistance,distance);if(distance<.65)wallHeight=Math.min(wallHeight,k===0?3.83:Math.min(heightAt(u),heightAt(v)));}if(nearestDistance>.65||p.y-wallHeight<.09)continue;const u=a.clone().lerp(q,j/steps),v=a.clone().lerp(q,(j+1)/steps);let vertices=[[u.x,wallHeight,u.z],[v.x,wallHeight,v.z],[v.x,v.y,v.z],[u.x,wallHeight,u.z],[v.x,v.y,v.z],[u.x,u.y,u.z]];if(sign>0)for(let k=0;k<vertices.length;k+=3)[vertices[k+1],vertices[k+2]]=[vertices[k+2],vertices[k+1]];emit(vertices,'ochre');}}}
  const solarA=ring[12],solarQ=ring[13],solarD=solarQ.clone().sub(solarA),solarN=new T.Vector2(solarD.y,-solarD.x).normalize().multiplyScalar(winding),solarAlong=new T.Vector3(solarD.x,0,solarD.y).normalize(),solarSlope=new T.Vector3(solarN.x,-.35/.83,solarN.y).normalize(),solarUp=solarSlope.clone().cross(solarAlong).normalize();if(solarUp.y<0)solarUp.negate();
  for(const t of [.33,.48,.63]){const p=solarA.clone().lerp(solarQ,t).addScaledVector(solarN,.55),g=new T.BoxGeometry(1.35,.025,.65);g.applyMatrix4(new T.Matrix4().makeBasis(solarAlong,solarUp,solarSlope));b.add(g,'blue',p.x,2.99-(.55-.12)*.35/.83+.035,p.y);}
  // Photo-backed roof-terrace picnic tables and small parapet flower boxes.
  for(const [x,z]of [[0,1],[2,4],[-4,4]]){b.box(x,4.49,z,1.7,.08,.85,'ochre');for(const dx of [-.65,.65])b.box(x+dx,3.82,z,.075,.67,.6,'dark');for(const dz of [-.72,.72]){b.box(x,4.13,z+dz,1.7,.075,.24,'ochre');for(const dx of [-.65,.65])b.box(x+dx,3.82,z+dz,.07,.31,.07,'dark');}}
  const frontA=ring[13],frontQ=ring[0],frontT=frontQ.clone().sub(frontA).normalize(),frontAngle=-Math.atan2(frontT.y,frontT.x);for(const t of [.18,.48,.78]){const p=frontA.clone().lerp(frontQ,t);b.box(p.x,4.87,p.y,.95,.18,.27,'dark',frontAngle);b.box(p.x,5.05,p.y,.96,.10,.30,'green',frontAngle);for(let k=0;k<5;k++)b.add(new T.IcosahedronGeometry(.09,0),'red',p.x+frontT.x*(k-2)*.16,5.18,p.y+frontT.y*(k-2)*.16);}
  // Four slender supports under the north-west covered roof bay.
  for(const p of [canopy[0],canopy[2],canopy[4],canopy[6]])b.box(p[0],3.77,p[2],.09,p[1]-3.77,.09,'frame');
  // External east approach to the deck. Current/context views support one
  // straight run; exact tread count is an architectural approximation.
  const eastA=ring[0],eastQ=ring[1],v=eastQ.clone().sub(eastA).normalize(),normal=new T.Vector2(v.y,-v.x).multiplyScalar(winding),start=eastA.clone().lerp(eastQ,.25).addScaledVector(normal,1.4),end=start.clone().addScaledVector(v,5.4);
  const deckExit=eastA.clone().lerp(eastQ,.25+5.4/eastA.distanceTo(eastQ)),landingCenter=deckExit.clone().addScaledVector(normal,.9),landingAngle=-Math.atan2(normal.y,normal.x);b.box(landingCenter.x,3.67,landingCenter.y,2.1,.12,1.15,'ochre',landingAngle);
  for(const side of [-.5,.5]){const p=deckExit.clone().addScaledVector(normal,1.85).addScaledVector(v,side);b.box(p.x,.16,p.y,.12,3.51,.12,'bronze');}
  const outer=deckExit.clone().addScaledVector(normal,1.92);beam(new T.Vector3(outer.x+v.x*.55,4.7,outer.y+v.y*.55),new T.Vector3(outer.x-v.x*.55,4.7,outer.y-v.y*.55),.07,'frame');const farSide=deckExit.clone().addScaledVector(v,.55);beam(new T.Vector3(farSide.x,4.7,farSide.y),new T.Vector3(farSide.x+normal.x*1.92,4.7,farSide.y+normal.y*1.92),.07,'frame');
  for(let j=0;j<17;j++){const p=start.clone().lerp(end,j/16);b.box(p.x,.12+j*.222,p.y,1.0,.12,.4,'ochre',-Math.atan2(v.y,v.x)+Math.PI/2);}
  for(const side of [-.56,.56]){const a=start.clone().addScaledVector(normal,side),q=end.clone().addScaledVector(normal,side);beam(new T.Vector3(a.x,1.12,a.y),new T.Vector3(q.x,4.68,q.y),.07,'frame');beam(new T.Vector3(a.x,.12,a.y),new T.Vector3(q.x,3.79,q.y),.09,'bronze');}
}
