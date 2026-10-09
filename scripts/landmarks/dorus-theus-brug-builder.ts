import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import footprints from './dorus-theus-brug-footprints.json';
type P=[number,number];type C=Parameters<BuildingTools['add']>[1];
/** Original surveyed water garden. X=east,Z=south; water/land beyond exact islands remain open. */
export function buildDorusTheusBrug(_w:number,_d:number,b:BuildingTools):void {
 const features=footprints.selectedFeatures;
 const paths=features.filter(f=>f.tags.highway==='footway').map(f=>f.localEastSouthMetres as P[]);
 const shape=(ps:P[])=>new T.Shape(ps.map(p=>new T.Vector2(...p)));
 const add=(g:T.BufferGeometry,c:C,role:string)=>{g.userData.role=role;b.add(g,c)};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:C,role:string)=>{const g=new T.BoxGeometry(w,h,d);g.translate(x,y+h/2,z);add(g,c,role)};
 const beam=(a:[number,number,number],q:[number,number,number],w:number,c:C,role:string)=>{const start=new T.Vector3(...a),end=new T.Vector3(...q),v=end.clone().sub(start),g=new T.BoxGeometry(w,v.length(),w);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray() as [number,number,number]);add(g,c,role)};
 const inside=(p:P,ps:P[])=>{let hit=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],q=ps[j];if((a[1]>p[1])!==(q[1]>p[1])&&p[0]<(q[0]-a[0])*(p[1]-a[1])/(q[1]-a[1])+a[0])hit=!hit}return hit};
 const distance=(p:P,a:P,q:P)=>{const vx=q[0]-a[0],vz=q[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vz)/(vx*vx+vz*vz)));return Math.hypot(p[0]-a[0]-t*vx,p[1]-a[1]-t*vz)};
 const pathDistance=(p:P)=>Math.min(...paths.flatMap(ps=>ps.slice(1).map((q,i)=>distance(p,ps[i],q))));
 let seed=71;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(const f of features.filter(f=>f.tags.landuse==='grass')){
  const outer=f.localEastSouthMetres.slice(0,-1) as P[],centre=outer.reduce((a,p)=>[a[0]+p[0]/outer.length,a[1]+p[1]/outer.length],[0,0] as P),inner=outer.map(p=>[centre[0]+(p[0]-centre[0])*.88,centre[1]+(p[1]-centre[1])*.78] as P);
  // Thin source-shaped stone cage, with the filter bed owning its top. No rectangular foundation.
  const s=shape(outer);add(openTopPrism(s,-.58,.02),'stone','gabion-side');const rim=shape(outer);rim.holes.push(new T.Path(inner.map(p=>new T.Vector2(...p))));add(upwardRoofPlane(rim,.025),'stone','gabion-rim');add(upwardRoofPlane(shape(inner),.035),'green','filter-soil');
  for(let i=0;i<outer.length;i++){
   const a=outer[i],q=outer[(i+1)%outer.length],l=Math.hypot(q[0]-a[0],q[1]-a[1]),nx=(q[1]-a[1])/l,nz=-(q[0]-a[0])/l;
   for(const y of[-.40,-.18,.035])beam([a[0],y,a[1]],[q[0],y,q[1]],.018,'frame','gabion-wire');
   for(let u=0;u<l;u+=.6){const x=a[0]+(q[0]-a[0])*u/l,z=a[1]+(q[1]-a[1])*u/l;beam([x,-.56,z],[x,.04,z],.018,'frame','gabion-wire');for(const y of[-.37,-.12]){const g=new T.DodecahedronGeometry(.11+rand()*.035,0);g.scale(1.5,.8,.7);g.translate(x+nx*.015,y,z+nz*.015);add(g,rand()<.5?'concrete':'stone','gabion-stone')}}
  }
  const xs=inner.map(p=>p[0]),zs=inner.map(p=>p[1]);
  for(let x=Math.min(...xs)+.2;x<Math.max(...xs);x+=.62)for(let z=Math.min(...zs)+.2;z<Math.max(...zs);z+=.62){const p:[number,number]=[x+(rand()-.5)*.23,z+(rand()-.5)*.23];if(!inside(p,inner)||pathDistance(p)<1.0)continue;
   // Sparse flat leaf fans retain slender reed character without textures or opaque tree blobs.
   for(let k=0;k<4;k++){const a=rand()*Math.PI*2,h=.50+rand()*.85,c:C=rand()<.25?'ochre':'green',dx=Math.cos(a),dz=Math.sin(a),wx=-dz*.04,wz=dx*.04;const base=[p[0],.04,p[1]],tip=[p[0]+dx*.38,h,p[1]+dz*.38],left=[p[0]+dx*.20-wx*2.3,h*.43,p[1]+dz*.20-wz*2.3],right=[p[0]+dx*.20+wx*2.3,h*.43,p[1]+dz*.20+wz*2.3];const vertices=[...base,...right,...left,...left,...right,...tip,...left,...right,...base,...tip,...right,...left];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,c,'reed-leaf')}
  }
 }
 // Wooden route follows mapped centreline, including all three over-water segments. No speculative rails.
 for(const ps of paths)for(let i=1;i<ps.length;i++){
  const a=ps[i-1],q=ps[i],l=Math.hypot(q[0]-a[0],q[1]-a[1]),dx=(q[0]-a[0])/l,dz=(q[1]-a[1])/l,nx=-dz,nz=dx;
  for(let u=0;u<l;u+=.25){const span=Math.min(.247,l-u),g=new T.BoxGeometry(span,.10,1.05);g.rotateY(-Math.atan2(dz,dx));g.translate(a[0]+dx*(u+span/2),.09,a[1]+dz*(u+span/2));add(g,'bronze','deck-plank')}
  for(const side of[-1,1])beam([a[0]+nx*.38,-.015,a[1]+nz*.38],[q[0]+nx*.38,-.015,q[1]+nz*.38],.12,'dark','deck-stringer');
  for(let u=.35;u<l;u+=2.6)for(const side of[-1,1])box(a[0]+dx*u+nx*side*.37,-.62,a[1]+dz*u+nz*side*.37,.14,.60,.14,'dark','deck-support');
 }
 const pier=features.find(f=>f.id==='w626223371')!;const ps=pier.localEastSouthMetres as P[],s=shape(ps);add(openTopPrism(s,-.02,.14),'bronze','pier-edge');add(upwardRoofPlane(s,.14),'bronze','pier-top');
 // Plank seams are bounded to the surveyed little polygonal pier.
 const xs=ps.map(p=>p[0]);for(let x=Math.min(...xs)+.1;x<Math.max(...xs);x+=.25){const hits:number[]=[];for(let i=1;i<ps.length;i++){const a=ps[i-1],q=ps[i];if((a[0]>x)!==(q[0]>x))hits.push(a[1]+(q[1]-a[1])*(x-a[0])/(q[0]-a[0]))}hits.sort((a,q)=>a-q);for(let i=1;i<hits.length;i+=2)box(x,.141,(hits[i-1]+hits[i])/2,.014,.008,hits[i]-hits[i-1],'dark','pier-seam');}
}
