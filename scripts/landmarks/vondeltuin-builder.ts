import * as T from 'three';import type{BuildingTools}from './cultural-builders';import{upwardRoofPlane,openTopPrism}from './house-geometry';import source from './vondeltuin-footprints.json';
/** Original native pavilion. Survey rings are height evidence; all surfaces/details are newly triangulated. */
export function buildVondeltuin(_w:number,_d:number,b:BuildingTools){
 const [lng0,lat0]=source.anchor;const ring=source.bag.geometry.coordinates[0].slice(0,-1).map(([lng,lat])=>new T.Vector2((lng-lng0)*111320*Math.cos(lat0*Math.PI/180),-(lat-lat0)*110540));const area=ring.reduce((v,p,i)=>{const q=ring[(i+1)%ring.length];return v+p.x*q.y-q.x*p.y;},0),out=Math.sign(area);
 const surfaces=source.roofPlanes.map(s=>s.rings[0]);
 const emit=(v:number[][],c:Parameters<BuildingTools['add']>[1])=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flat(),3));g.computeVertexNormals();b.add(g,c);};

 // Keep every original ring vertex height; no three-point extrapolation on near-collinear points.
 for(const r of surfaces){const xy=r.map(p=>new T.Vector2(p[0],p[2]));for(const t of T.ShapeUtils.triangulateShape(xy,[])){let pts=t.map(i=>r[i]);if(new T.Vector3(...pts[1] as[number,number,number]).sub(new T.Vector3(...pts[0] as[number,number,number])).cross(new T.Vector3(...pts[2] as[number,number,number]).sub(new T.Vector3(...pts[0] as[number,number,number]))).y<0)pts=[pts[0],pts[2],pts[1]];emit(pts,'ochre');}}
 const heightAt=(p:T.Vector2)=>{let nearest=Infinity,h=3.8;for(const r of surfaces)for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],v=new T.Vector2(q[0]-a[0],q[2]-a[2]);const t=T.MathUtils.clamp(p.clone().sub(new T.Vector2(a[0],a[2])).dot(v)/v.lengthSq(),0,1);const d=p.distanceTo(new T.Vector2(a[0]+t*v.x,a[2]+t*v.y));if(d<nearest){nearest=d;h=a[1]+t*(q[1]-a[1]);}}return h;};
 const beam=(a:T.Vector3,q:T.Vector3,w:number,c:Parameters<BuildingTools['add']>[1])=>{const d=q.clone().sub(a),g=new T.BoxGeometry(w,w,d.length());g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),d.clone().normalize()));const p=a.clone().add(q).multiplyScalar(.5);b.add(g,c,p.x,p.y,p.z);};
 // Context-7/9 show a closed glazed upper gable and shingle side return
 // above the lower roof; the section also shows the vertical volume step.
 // These internal roof boundaries are absent from the BAG perimeter. Match
 // surveyed plan endpoints to retain both original roof heights exactly.
 const samePlan=(a:number[],q:number[])=>Math.hypot(a[0]-q[0],a[2]-q[2])<.001;
 for(let k=0;k<surfaces.length;k++)for(let l=k+1;l<surfaces.length;l++){
  const r=surfaces[k],s=surfaces[l];
  for(let i=0;i<r.length;i++)for(let j=0;j<s.length;j++){
   const a=r[i],q=r[(i+1)%r.length],u=s[j],v=s[(j+1)%s.length];
   const paired=samePlan(a,u)&&samePlan(q,v)?[u,v]:samePlan(a,v)&&samePlan(q,u)?[v,u]:null;
   if(!paired||Math.abs(a[1]-paired[0][1])<.1||Math.abs(q[1]-paired[1][1])<.1)continue;
   const high=a[1]>paired[0][1]?r:s,lowA=a[1]<paired[0][1]?a:paired[0],lowQ=q[1]<paired[1][1]?q:paired[1],highA=a[1]>paired[0][1]?a:paired[0],highQ=q[1]>paired[1][1]?q:paired[1];
   const winding=Math.sign(high.reduce((sum,p,n)=>{const t=high[(n+1)%high.length];return sum+p[0]*t[2]-t[0]*p[2];},0));
   // The second ring traverses the matched edge in the opposite direction.
   const edgeSign=high===r?winding:-winding;
   const vertices=[lowA,lowQ,highQ,lowA,highQ,highA];
   if(edgeSign>0)for(let n=0;n<vertices.length;n+=3)[vertices[n+1],vertices[n+2]]=[vertices[n+2],vertices[n+1]];
   emit(vertices,Math.abs(q[2]-a[2])/Math.hypot(q[0]-a[0],q[2]-a[2])<.55?'glass':'ochre');
  }
 }
 const shape=new T.Shape(ring);b.add(openTopPrism(shape,0,.17),'stone');b.add(upwardRoofPlane(shape,.17),'stone');
 // Glass sliding fronts form the actual walls; no opaque parent hides them.
 for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],d=q.clone().sub(a),len=d.length(),n=new T.Vector2(d.y,-d.x).normalize().multiplyScalar(out),angle=-Math.atan2(d.y,d.x),m=a.clone().add(q).multiplyScalar(.5),gable=Math.abs(d.y)/len<.55;
  const steps=Math.max(1,Math.ceil(len/.45));for(let j=0;j<steps;j++){const p=a.clone().lerp(q,j/steps),s=a.clone().lerp(q,(j+1)/steps),hp=heightAt(p),hs=heightAt(s);const positions=[[p.x,.17,p.y],[s.x,.17,s.y],[s.x,hs,s.y],[p.x,.17,p.y],[s.x,hs,s.y],[p.x,hp,p.y]];if(out>0){for(let k=0;k<positions.length;k+=3)[positions[k+1],positions[k+2]]=[positions[k+2],positions[k+1]];}emit(positions,gable?'glass':'ochre');
   if(!gable){const p2=p.clone().addScaledVector(n,.05),s2=s.clone().addScaledVector(n,.05);const glass=[[p2.x,.17,p2.y],[s2.x,.17,s2.y],[s2.x,2.45,s2.y],[p2.x,.17,p2.y],[s2.x,2.45,s2.y],[p2.x,2.45,p2.y]];if(out>0)for(let k=0;k<glass.length;k+=3)[glass[k+1],glass[k+2]]=[glass[k+2],glass[k+1]];emit(glass,'glass');}}
  // Timber posts and charcoal rails follow exact perimeter tangent.
  for(const y of [.18,2.45])b.box(m.x+n.x*.09,y,m.y+n.y*.09,len,.095,.15,'dark',angle);const panes=Math.max(1,Math.round(len/1.8));for(let j=0;j<=panes;j++){const p=a.clone().lerp(q,j/panes);b.box(p.x+n.x*.10,.17,p.y+n.y*.10,.12,Math.min(heightAt(p)-.17,2.4),.18,'dark',angle);}
  if(len>5.5&&gable){const slope=Math.abs(heightAt(a)-heightAt(m))/Math.max(len/2,.1);const full=(u:number,y:number)=>{const p=a.clone().lerp(q,u).addScaledVector(n,.48);return new T.Vector3(p.x,y,p.y);};// DOOR facade/side photos show straight crossing diagonals, not kinked chevrons.
  for(const direction of [-1,1])for(let base=2.8;base<7.4;base+=.47){const path:T.Vector3[]=[];for(let j=0;j<=48;j++){const u=j/48,p=a.clone().lerp(q,u),y=base+direction*(2*u-1)*Math.max(slope*len/2,1.55);if(y>=1.2&&y<heightAt(p)-.08)path.push(full(u,y));else if(path.length>1){beam(path[0],path[path.length-1],.075,'stone');path.length=0;}}if(path.length>1)beam(path[0],path[path.length-1],.075,'stone');}for(let u=.06;u<1;u+=.16){const p=a.clone().lerp(q,u),h=heightAt(p);beam(full(u,h-.04),new T.Vector3(p.x+n.x*.04,h-.04,p.y+n.y*.04),.07,'stone');}}
  // Original shingle course relief, bounded to each opaque side wall; no photo texture.
  if(!gable&&len>3){for(let y=2.75;y<Math.min(heightAt(a),heightAt(q))-.08;y+=.38)b.box(m.x+n.x*.022,y,m.y+n.y*.022,len,.027,.045,'stone',angle);}
 }
 // A narrow photo-backed stone plinth on the eastern high-volume wall.
 for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],d=q.clone().sub(a),len=d.length();if(len<5||Math.abs(d.y)/len<.7||a.x+q.x<2)continue;const m=a.clone().add(q).multiplyScalar(.5);b.box(m.x,.17,m.y,len,.8,.2,'stone',-Math.atan2(d.y,d.x));}
 // Context-7/9 show a bank parallel to the lower roof, inset from its gable.
 // Use stable ridge/eave vectors instead of a global-axis tilt that leaves
 // corners airborne or buried on this rotated surveyed building.
 const lower=surfaces[1],ridgeA=new T.Vector3(...lower[4] as[number,number,number]),ridgeB=new T.Vector3(...lower[5] as[number,number,number]),eave=new T.Vector3(...lower[6] as[number,number,number]);
 const along=ridgeB.clone().sub(ridgeA).normalize(),across=eave.clone().sub(ridgeB);across.addScaledVector(along,-across.dot(along));
 const slope=across.clone().normalize(),normal=along.clone().cross(slope).normalize();if(normal.y<0)normal.negate();
 const centre=ridgeA.clone().lerp(ridgeB,.55).addScaledVector(across,.40).addScaledVector(normal,.065);
 const panel=new T.BoxGeometry(2,.07,2.8),basis=new T.Matrix4().makeBasis(slope,normal,along);panel.applyMatrix4(basis);b.add(panel,'slate',centre.x,centre.y,centre.z);
}
