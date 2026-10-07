import * as T from 'three';
import { rdToLngLat } from '../../src/canalRecall/facade/rdNew';
import type { BuildingTools } from './cultural-builders';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
import survey from './kriterion-front-roof-zones.json';
import specs from './retail-cinema-specs.json';
type P=[number,number];
/** Full current front Pand2253901 physical shell, including middle link.
 * Roof/currentBAG surveyed polygons, original native shell construction.
 * Existing Roetersstraat authoring should retain facade details only: this helper
 * owns the street-house body/roof, so its legacy box/cap must be removed.
 * Small raised rooftop zone is local to its observed footprint, never a Pand height. */
export function buildKcriterionFrontNative(b:BuildingTools){
 const s=specs.find(s=>s.id==='kriterion')!,a=s.footprint.centre,h=(s.footprint.headingDegrees+180)*Math.PI/180;
 const local=([rdx,rdy]:number[]):P=>{const [lng,lat]=rdToLngLat({x:rdx,y:rdy});const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*111320;return[e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h)];};
 for(const zone of survey.zones)for(const polygon of zone.rdPolygons){
  const points=polygon[0].map(p=>[...local(p),p[2]-survey.sharedGroundNap]),cx=points.reduce((v,p)=>v+p[0],0)/points.length,cz=points.reduce((v,p)=>v+p[1],0)/points.length,cy=points.reduce((v,p)=>v+p[2],0)/points.length;
  let xx=0,zz=0,xz=0,xy=0,zy=0;for(const p of points){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;zz+=z*z;xz+=x*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz;if(Math.abs(det)<1e-8)throw new Error('Front roof degeneracy');const sx=(xy*zz-zy*xz)/det,sz=(zy*xx-xy*xz)/det,height=([x,z]:P)=>cy+sx*(x-cx)+sz*(z-cz);
  const rings=polygon.map(r=>r.map(local)),shape=new T.Shape(rings[0].map(p=>new T.Vector2(...p)));for(const ring of rings.slice(1))shape.holes.push(new T.Path(ring.map(p=>new T.Vector2(...p))));
  const bottom=Math.min(...points.map(p=>p[2]));b.add(openTopPrism(shape,0,bottom),'greyBrick');
  const roof=upwardRoofPlane(shape),pos=roof.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,height([pos.getX(i),pos.getZ(i)]));roof.computeVertexNormals();b.add(roof,'slate');
  const verts:number[]=[];
  for(let j=0;j<rings.length;j++){const ring=rings[j],area=ring.reduce((v,p,i)=>{const q=ring[(i+1)%ring.length];return v+p[0]*q[1]-q[0]*p[1];},0);for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],v=[p[0],bottom,p[1],q[0],bottom,q[1],q[0],height(q),q[1],p[0],bottom,p[1],q[0],height(q),q[1],p[0],height(p),p[1]];if((area>0)===(j===0))for(let k=0;k<v.length;k+=9)for(let n=0;n<3;n++){const t=v[k+3+n];v[k+3+n]=v[k+6+n];v[k+6+n]=t;}verts.push(...v);}}
  const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(verts,3));skirt.computeVertexNormals();b.add(skirt,'greyBrick');
 }
}
