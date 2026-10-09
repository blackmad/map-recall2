import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './wester-tours-neighbor-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Native surveyed ordinary neighbor. East/north axes, no church parent or padded mask. */
export function buildWesterToursNeighbor(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 const ex=.878900381,ez=.477005367; // observed ridge, derived from surveyed endpoints
 const xy=(u:number,v:number)=>[u*ex-v*ez,u*ez+v*ex];
 function cub(u:number,y:number,v:number,w:number,h:number,d:number,c:Colour){const p=xy(u,v);box(p[0],y,p[1],w,h,d,c,-Math.atan2(ez,ex));}
 function role(g:T.BufferGeometry,r:string){g.userData.role=r;return g;}
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[2])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[2]))));return s;}
 function mesh(values:number[],c:Colour,r:string){const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();add(role(g,r),c);}
 for(const plane of source.roofs){
  const ring=plane.rings[0],floor=Math.min(...ring.map(v=>v[1]));
  add(role(openTopPrism(shape(plane.rings),0,floor),'survey-shell'),'greyBrick');
  const roof=upwardRoofPlane(shape(plane.rings));const p=roof.getAttribute('position');
  // Retain every original survey boundary vertex; triangulation owns the sole top.
  for(let i=0;i<p.count;i++){const q=ring.reduce((a,b)=>Math.hypot(b[0]-p.getX(i),b[2]-p.getZ(i))<Math.hypot(a[0]-p.getX(i),a[2]-p.getZ(i))?b:a);p.setY(i,q[1]);}
  // Source-rounded collinear boundary slivers can reverse after meshopt quantization.
  const indices=roof.index!,kept:number[]=[];for(let i=0;i<indices.count;i+=3){const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2),area=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a)))/2;if(area>=.001)kept.push(a,b,c);}
  roof.setIndex(kept);roof.computeVertexNormals();add(role(roof,'survey-roof-'+plane.index),'slate');
  const skirts:number[]=[];for(const r of plane.rings)for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length];skirts.push(a[0],floor,a[2],q[0],floor,q[2],q[0],q[1],q[2],a[0],floor,a[2],q[0],q[1],q[2],a[0],a[1],a[2]);}mesh(skirts,'greyBrick','roof-support');
 }
 // Source north wall: six paired shop windows and a narrow rear door, not a regular apartment grid.
 function northWindow(u:number,width=1.3){
  cub(u,.98,-5.77,width+.18,2.25,.13,'white');cub(u,1.08,-5.86,width,2.04,.1,'glass');cub(u,1.08,-5.93,.07,2.04,.06,'white');cub(u,2.65,-5.94,width,.07,.06,'white');cub(u,.89,-5.83,width+.28,.13,.23,'stone');
 }
 for(const u of [-15.4,-11.4,-7.4,-3.4,.6,4.6]){northWindow(u-.73,1.2);northWindow(u+.73,1.2);}
 cub(7.55,.12,-5.8,1.16,2.95,.13,'white');cub(7.55,.23,-5.9,.94,2.72,.08,'glass');cub(7.55,1.35,-5.98,.94,.08,.05,'white');
 cub(-4.7,4.74,-5.76,28.2,.22,.24,'white');
 // Lower church-side lean-to: pale joinery, low eaves; keep it distinct from main ridge.
 for(const u of [-16,-12,-8,-4,0,4,7]){cub(u,.88,6.8,1.36,1.7,.12,'white');cub(u,.99,6.89,1.18,1.48,.08,'glass');cub(u,.99,6.95,.06,1.48,.06,'white');}
 cub(-4.7,3.05,6.8,28.1,.15,.19,'white');
 // East glazed porch has lower solid spandrels, a central door, narrow mullions and a sloping roof.
 const frontU=14.62,angle=Math.PI/2-Math.atan2(ez,ex),front=(v:number,y:number,w:number,h:number,c:Colour,offset=0)=>{const p=xy(frontU+offset,v);box(p[0],y,p[1],w,h,.1,c,angle);};
 for(let i=0;i<8;i++){const v=-4.95+i*1.47;front(v,.22,1.4,.65,'frame');front(v,.91,1.32,1.72,'glass',.07);front(v,2.37,1.32,.06,'white',.14);front(v,.22,.065,2.65,'white',.15);}
 front(.17,.12,1.18,2.68,'white',.16);front(.17,.23,1.02,2.48,'glass',.22);front(.17,1.52,1.02,.07,'white',.28);
 front(.5,2.82,12.45,.14,'white',.18);front(.5,.04,12.42,.15,'greyBrick');
 // Porch end glazing follows the exact surveyed slope rather than disappearing into a slab.
 for(const side of [-5.73,6.79])for(let i=0;i<3;i++){
  const u=10.25+i*1.55,top=5.08-(u-9.36)*.398;
  cub(u,.92,side+(side<0?-.08:.08),1.42,top-1.12,.08,'glass');cub(u,.82,side+(side<0?-.15:.15),.075,top-.87,.07,'white');
 }
 // Round east-gable aperture. Thin glazing lies in front of masonry, white ring and cross stay exposed.
 const circleP=xy(9.48,-1.7),circleY=6.64;
 const disk=new T.CircleGeometry(1.03,40);add(role(disk,'round-attic-glazing'),'glass',circleP[0],circleY,circleP[1],angle);
 const ring=new T.RingGeometry(1.03,1.14,40);const rp=xy(9.5,-1.7);add(role(ring,'round-attic-frame'),'white',rp[0],circleY,rp[1],angle);
 frontGableBar(-1.7,circleY-1.03,.075,2.06);frontGableBar(-1.7,circleY-.035,2.06,.07);
 function frontGableBar(v:number,y:number,w:number,h:number){const p=xy(9.53,v);box(p[0],y,p[1],w,h,.05,'white',angle);}
 // Gable coping follows the roof end; capped ridge and small rear flue match visible source details.
 function beam(a:number[],q:number[],r:number,c:Colour){const aa=new T.Vector3(...a),qq=new T.Vector3(...q),delta=qq.clone().sub(aa);const g=new T.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const m=aa.add(qq).multiplyScalar(.5);add(g,c,m.x,m.y,m.z);}
 const p0=xy(9.43,-5.67),p1=xy(9.43,-1.65),p2=xy(9.43,2.21);beam([p0[0],4.87,p0[1]],[p1[0],8.94,p1[1]],.105,'stone');beam([p1[0],8.94,p1[1]],[p2[0],5.04,p2[1]],.105,'stone');
 const rr=xy(-18.9,-1.8),rf=xy(9.3,-1.65);beam([rr[0],8.91,rr[1]],[rf[0],8.94,rf[1]],.11,'slate');cub(-10,7.23,.35,.68,1.64,.7,'greyBrick');cub(-10,8.87,.35,.87,.15,.91,'slate');
}
