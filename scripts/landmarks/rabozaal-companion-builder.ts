import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import coupled from './melkweg-coupled-footprints.json';
type P=[number,number];type C=Parameters<BuildingTools['add']>[1];
export function buildRabozaalCompanion(_w:number,_d:number,b:BuildingTools){
 const put=(g:T.BufferGeometry,c:C,name:string)=>{g.name=name;b.add(g,c)};
 const shape=(ring:number[][],holes:number[][][]=[])=>{const s=new T.Shape(ring.map(p=>new T.Vector2(...p as P)));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(...p as P))));return s;};
 const roof=(s:T.Shape,y:number)=>{const source=upwardRoofPlane(s,y),flat=source.toNonIndexed(),a=flat.getAttribute('position'),values:number[]=[];for(let i=0;i<a.count;i+=3){const vs=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(a,i+j));if(vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).y<.02)continue;for(const v of vs)values.push(...v.toArray());}const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(values,3));out.computeVertexNormals();flat.dispose();source.dispose();return out;};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:C,name:string,angle=0)=>{const g=new T.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y+h/2,z);put(g,c,name);};
 const frontBasis=(a:number[],bb:number[])=>{const dx=bb[0]-a[0],dz=bb[1]-a[1],L=Math.hypot(dx,dz);return{L,u:[dx/L,dz/L]as P,n:[-dz/L,dx/L]as P,angle:Math.atan2(-dz,dx)};};
 const facade=(a:number[],bb:number[],tag:string)=>{const f=frontBasis(a,bb);const pos=(u:number,o=0):P=>{let x=a[0]+f.u[0]*u,z=a[1]+f.u[1]*u;return[x+f.n[0]*o,z+f.n[1]*o];};return{...f,pos,box:(u:number,y:number,w:number,h:number,dep:number,c:C,name:string,o=.12)=>{const[x,z]=pos(u,o);box(x,y,z,w,h,dep,c,tag+'-'+name,f.angle);}};};
 const pane=(f:ReturnType<typeof facade>,u:number,y:number,w:number,h:number,cols=2,rows=2,white=false)=>{f.box(u,y,w,h,.05,'glass','glazing');const frame:C=white?'white':'dark';f.box(u,y-.055,w+.14,.11,.11,frame,'sill');f.box(u,y+h-.02,w+.12,.1,.11,frame,'head');for(let c=0;c<=cols;c++)f.box(u-w/2+c*w/cols,y,.065,h,.11,frame,'mullion');for(let r=1;r<rows;r++)f.box(u,y+r*h/rows,w,.055,.11,frame,'transom');};
 // Exact adjoining73457: survey-separated lower connectors and raised hall, never a pavement-to-maximum block.
 for(const part of [...coupled.upperParts,...coupled.lowerParts,...coupled.insetCores]){
  const s=shape(part.ring,part.holes),core=part.id.includes('inset-core');
  put(openTopPrism(s,part.bottom,part.top),part.id.includes('floor-edge')?'dark':core||part.id.includes('low-connector')&&part.bottom>0?'glass':part.bottom>0?'bronze':'brick',part.id+'-shell');
  put(roof(s,part.top),'slate',part.id+'-roof');
  if(part.bottom>0){put(openTopPrism(s,part.bottom-.2,part.bottom),'dark',part.id+'-underside');put(roof(s,part.bottom),'dark',part.id+'-floor');}
  if(part.bottom>=18.3)for(let i=0;i<part.ring.length;i++){
   const f=facade(part.ring[i],part.ring[(i+1)%part.ring.length],part.id+'-metal-edge'+i);
   for(let u=.5;u<f.L-.2;u+=.92){f.box(u,part.bottom+.05,.055,Math.max(.01,20.35-part.bottom-.05),.10,'dark','corrugation-lower-rib',.075);f.box(u,21.75,.055,part.top-21.8,.10,'dark','corrugation-upper-rib',.075);}
  }
  if(part.id.includes('low-connector')&&part.bottom===15)for(let i=0;i<part.ring.length;i++){
   if(i===13)continue; // Internal seam against Melk366/raised2;23 fractional bronze occlusions preserved.
   const A=part.ring[i],B=part.ring[(i+1)%part.ring.length],f=facade(A,B,'rabozaal-outer-foyer-'+i);
   if(f.L<.8)continue;const bays=Math.max(1,Math.round(f.L/1.4));
   for(let bay=0;bay<bays;bay++)pane(f,(bay+.5)*f.L/bays,15.12,f.L/bays-.1,part.top-15.25,1,1);
   for(const y of[15.02,part.top-.10])f.box(f.L/2,y,f.L,.16,.16,'dark','floor-line');
  }
  if(core)for(let i=0;i<part.ring.length;i++){
   const f=facade(part.ring[i],part.ring[(i+1)%part.ring.length],part.id+'-edge'+i),bays=Math.max(1,Math.round(f.L/1.5));
   for(const[y,h]of[[.12,3.75],[4.08,3.7],[10.35,.82],[11.38,3.37]])for(let bay=0;bay<bays;bay++)pane(f,(bay+.5)*f.L/bays,y,f.L/bays-.10,h,1,1);
   for(const y of[0,3.93,7.91,11.23,14.83])f.box(f.L/2,y,f.L,.16,.16,'dark','floor-line');
  }
 }

 // Defining8m projecting blue ribbon, distinct from repeated core-window tiers.
 for(const part of coupled.corridorParts){
  const s=shape(part.ring,part.holes);put(openTopPrism(s,part.bottom,part.top),'blue',part.id+'-blue-glass-ribbon');
  put(roof(s,part.top),'dark',part.id+'-upper-edge');put(roof(s,part.bottom),'dark',part.id+'-floor');
  for(let i=0;i<part.ring.length;i++){
   const f=facade(part.ring[i],part.ring[(i+1)%part.ring.length],part.id+'-perimeter'+i);
   for(const y of[8.0,10.15])f.box(f.L/2,y,f.L,.08,.10,'dark','continuous-ribbon-edge',.035);
   for(let u=2.5;u<f.L;u+=2.5)f.box(u,8.05,.045,2.1,.08,'dark','restrained-ribbon-mullion',.035);
  }
 }

}
