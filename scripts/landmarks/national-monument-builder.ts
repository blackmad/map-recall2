import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './national-monument-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original travertine monument; podium and separate lions retain native positions. */
export function buildNationalMonument(_w:number,_d:number,b:BuildingTools){
 const {add}=b,[nx,nz]=source.frontUnit,rx=nz,rz=-nx;
 const pos=(x:number,y:number,z:number)=>new T.Vector3(rx*x+nx*z,y,rz*x+nz*z);
 const angle=Math.atan2(nx,nz);
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour){const p=pos(x,y+h/2,z);add(new T.BoxGeometry(w,h,d),c,p.x,p.y,p.z,angle);}
 function ellipsoid(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour='white'){const g=new T.SphereGeometry(1,8,5);g.scale(w,h,d);const p=pos(x,y,z);add(g,c,p.x,p.y,p.z,angle);}
 function rod(a:T.Vector3,z:T.Vector3,r:number,c:Colour='white'){const delta=z.clone().sub(a),g=new T.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const p=a.clone().add(z).multiplyScalar(.5);add(g,c,p.x,p.y,p.z);}
 function human(x:number,base:number,z:number,h:number,raised=false){
  // Faceted original silhouettes express the relief arrangement at game scale;
  // these are deliberately not replicas of the sculptor's detailed figures.
  ellipsoid(x,base+h*.88,z,.2*h,.14*h,.15*h);
  ellipsoid(x,base+h*.55,z,.2*h,.29*h,.12*h);
  rod(pos(x-h*.1,base+h*.37,z),pos(x-h*.11,base,z+h*.06),h*.065);
  rod(pos(x+h*.1,base+h*.37,z),pos(x+h*.12,base,z+h*.07),h*.065);
  rod(pos(x-h*.17,base+h*.7,z),pos(x-h*.3,base+h*(raised?1:.44),z+h*.06),h*.055);
  rod(pos(x+h*.17,base+h*.7,z),pos(x+h*.3,base+h*(raised?.86:.44),z+h*.06),h*.055);
 }
 // All six steps stay within the mapped 86-vertex circular podium. Only the
 // first outline is surveyed; upper concentric tread offsets are approximate.
 const ring=source.podium.ring,radius=ring.slice(0,-1).reduce((sum,p)=>sum+Math.hypot(p[0],p[1])/(ring.length-1),0);
 for(let i=0;i<6;i++){
  const factor=(radius-i*1.5)/radius;
  const s=new T.Shape(ring.map(p=>new T.Vector2(p[0]*factor,p[1]*factor)));
  const g=new T.ExtrudeGeometry(s,{depth:.18,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,(i+1)*.18,0);add(g,'slate');
  // The lighter basalt 'runner' described by RCE remains on the real podium.
  box(0,(i+1)*.18+.006,radius-i*1.5-.82,3.1,.025,1.3,'stone');
 }
 add(new T.CylinderGeometry(1.2,2.65,20.92,16),'white',0,11.54,0);
 // Preserve the actual mapped curved urn wall and pylon/relief base; neither
 // the wall's interior nor the surrounding square receives a filled disc.
 const wallBase=1.08,wallHeight=4.15;
 for(const [ring,h] of [[source.urnWall.ring,wallHeight],[source.pylonBase.ring,1.95]] as const){const s=new T.Shape(ring.map(q=>new T.Vector2(q[0],q[1]))),g=new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,wallBase+h,0);add(g,'white');}
 // Fourteen shallow rear niches, including the two historically empty spaces.
 // Recess panels are visual reliefs rather than invented passages through wall.
 for(let i=0;i<14;i++){
  // OSM's outer curve is vertices 1..19, between the two wall end caps.
  const t=(i+.5)/14*18,j=Math.floor(t),a=source.urnWall.ring[1+j],z=source.urnWall.ring[Math.min(19,2+j)],f=t-j,x=a[0]+(z[0]-a[0])*f,v=a[1]+(z[1]-a[1])*f,r=Math.hypot(x,v),ux=x/r,uz=v/r,face=Math.atan2(ux,uz);
  add(new T.BoxGeometry(.82,1.38,.06),'stone',x+ux*.03,wallBase+1.19,v+uz*.03,face);
  add(new T.BoxGeometry(.56,1,.055),'dark',x+ux*.08,wallBase+1.19,v+uz*.08,face);
  add(new T.BoxGeometry(.68,.72,.08),'stone',x+ux*.08,wallBase+2.5,v+uz*.08,face);
 }
 // The suffering group and flanking resistance figures occupy their own low
 // plinths; the mother-and-child relief rises above them on the pylon front.
 for(let i=0;i<4;i++)human((i-1.5)*1.02,3.03,3.02,3.5,i===0||i===3);
 for(const x of [-4.05,4.05]){box(x,1.08,1.35,2.15,.6,2.2,'white');human(x,1.68,1.35,3.4,true);ellipsoid(x+.48,2.05,2.15,.4,.34,.8);}
 box(0,8.45,2.05,2.1,.3,1.25,'white');human(0,8.75,2.15,3,true);human(.45,10.25,2.62,1.35);
 // Separate lions are centred on actual mapped nodes, outside the podium.
 for(const lion of source.lions){const [x,z]=lion.localPosition;
  add(new T.CylinderGeometry(1.65,1.65,.48,16),'white',x,.24,z);
  const local=(u:number,y:number,v:number)=>new T.Vector3(x+rx*u+nx*v,y,z+rz*u+nz*v);
  function volume(u:number,y:number,v:number,w:number,h:number,d:number){const p=local(u,y,v),g=new T.SphereGeometry(1,8,5);g.scale(w,h,d);add(g,'white',p.x,p.y,p.z,angle);}
  volume(0,1.55,-.17,.85,1.25,.78);volume(0,3.05,.16,.82,.94,.8);volume(0,3.72,.44,.61,.55,.62);volume(0,3.58,.93,.52,.28,.35);
  for(const u of [-.48,.48]){rod(local(u,2.35,.62),local(u,.61,.87),.21);volume(u,.6,1.03,.29,.17,.45);}
  volume(0,.98,-.62,.85,.44,.87);
  rod(local(.82,.7,-.45),local(.86,.6,.35),.15);rod(local(.86,.6,.35),local(.63,.64,.92),.15);
 }
}
