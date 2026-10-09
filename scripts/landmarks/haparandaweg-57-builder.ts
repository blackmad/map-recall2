import * as T from 'three';import type {BuildingTools} from './cultural-builders';import data from './haparandaweg-57-footprints.json';import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original surveyed warehouse. Photo-supported visible apertures are inventoried in research. */
export function buildHaparandaweg57(_w:number,_d:number,b:BuildingTools){
 const add=(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a),outline=data.outline[0].slice(0,-1),shape=(p:number[][])=>new T.Shape(p.map(q=>new T.Vector2(q[0],q[1])));
 function fit(r:number[][]){const cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length,cy=r.reduce((s,p)=>s+p[2],0)/r.length;let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of r){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,c=(zy*xx-xy*xz)/det;return(x:number,z:number)=>cy+a*(x-cx)+c*(z-cz);}
 const base=data.roofs[2].rings[0],height=fit(base),wall=openTopPrism(shape(outline),0,7.24),wp=wall.getAttribute('position');for(let i=0;i<wp.count;i++)if(wp.getY(i)>7)wp.setY(i,height(wp.getX(i),wp.getZ(i)));wall.computeVertexNormals();add(wall,'dark');
 const strips=data.roofs.slice(0,2),sr=strips.map(r=>r.rings[0]),stripRing=[sr[0][3],sr[0][2],sr[0][1],sr[1][0],sr[1][3],sr[0][0]],main=shape(base);main.holes.push(new T.Path(stripRing.map(q=>new T.Vector2(q[0],q[1]))));
 const cap=upwardRoofPlane(main),cp=cap.getAttribute('position');for(let i=0;i<cp.count;i++)cp.setY(i,height(cp.getX(i),cp.getZ(i)));cap.computeVertexNormals();add(cap,'slate');
 // Surveyed raised narrow roof monitor, not the building's overall eave datum.
 for(const r of sr){const f=fit(r),g=upwardRoofPlane(shape(r)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,f(p.getX(i),p.getZ(i)));g.computeVertexNormals();add(g,'stone');}
 for(let i=0;i<stripRing.length;i++){const p=stripRing[i],q=stripRing[(i+1)%stripRing.length],vs=[p[0],height(p[0],p[1]),p[1],q[0],height(q[0],q[1]),q[1],q[0],q[2],q[1],p[0],p[2],p[1]],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();add(g,'stone');}
 function face(i:number,j:number){const[ax,az]=outline[i],[bx,bz]=outline[j],L=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/L,uz=(bz-az)/L,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux);
  const panel=(u:number,y:number,w:number,h:number,d:number,c:Colour,out=.08)=>add(new T.BoxGeometry(w,h,d),c,ax+ux*u+nx*out,y+h/2,az+uz*u+nz*out,angle);
  panel(L/2,0,L,2.45,.055,'brick',.055);panel(L/2,2.43,L,.10,.06,'frame',.09);
  for(let u=.12;u<L;u+=.20)panel(u,2.52,.026,4.65,.028,'copper',.035);
  panel(L/2,7.17,L,.08,.10,'frame',.055);
  function opening(u:number,y:number,w:number,h:number,shutter=0,mullions=1){
   const glassH=h*(1-shutter);if(glassH>.01)for(let k=0;k<=mullions;k++){const pw=w/(mullions+1)-.045,pu=u-w/2+w*(k+.5)/(mullions+1);add(new T.PlaneGeometry(pw,glassH),'glass',ax+ux*pu+nx*.145,y+glassH/2,az+uz*pu+nz*.145,angle);}
   if(shutter)panel(u,y+glassH,w,h*shutter,.028,'white',.147);
   for(const q of [-1,1]){panel(u+q*(w/2+.045),y-.07,.09,h+.14,.045,'frame',.185);panel(u,y+(q===1?h:-.07),w+.18,.07,.045,'frame',.185);}
   for(let k=1;k<=mullions;k++)panel(u-w/2+w*k/(mullions+1),y,.036,glassH,.04,'frame',.182);
   if(shutter)for(let sy=y+glassH+.12;sy<y+h;sy+=.16)panel(u,sy,w,.012,.01,'concrete',.17);
  }
  return {L,panel,opening,ax,az,ux,uz,nx,nz,angle};
 }
 const front=face(1,2),side=face(2,3);face(0,1);face(3,0);
 // Two adjoining upper and two lower front apertures, entrance and loading door.
 front.opening(23.33,4.36,2.8,1.12,.46,1);front.opening(26.17,4.35,2.62,1.14,0,2);
 front.opening(23.03,1.20,2.75,1.05,0,1);front.opening(26.45,1.20,2.75,1.08,1,0);
 front.opening(18.90,.86,.96,1.57,0,0);front.panel(18.90,.06,.85,.8,.025,'dark',.19);
 front.panel(18.58,1.00,.06,.32,.04,'white',.22);
 // Leaf-off south2021 shows two rows of small light/glazed panels in the
 // loading door; divisions are approximate where the foreground fence occludes.
 front.panel(14.9,.05,4.9,4.20,.045,'copper',.11);
 for(let y=.15;y<4.2;y+=.22)if(y<1.22||y>2.06)front.panel(14.9,y,4.85,.025,.025,'frame',.145);
 front.opening(14.9,1.29,4.30,.30,0,5);
 front.opening(14.9,1.73,4.30,.30,0,5);
 // South/east union: two upper apertures, three low windows; blind rears unknown.
 side.opening(3.63,4.26,2.62,1.10,.50,1);side.opening(9.80,4.21,3.05,1.16,1,0);
 for(const [u,w]of [[4.39,2.50],[7.32,2.40],[10.99,1.35]])side.opening(u,1.22,w,.90,0,1);
 for(let u=5.7;u<side.L;u+=6.5)side.panel(u,2.4,.065,4.68,.065,'concrete',.105);
 // Photo-supported projecting cantilever loading canopy; approximate 17.8x4.0m.
 const start=.9,end=18.7,out=2.0;front.panel((start+end)/2,5.45,end-start,.55,4.0,'dark',out);
 front.panel((start+end)/2,5.44,end-start,.08,4.0,'frame',out);
 for(const u of [2.0,7.0,12.0,17.8]){
  // Horizontal and diagonal braces kept below the canopy and above loading access.
  front.panel(u,5.27,.09,.12,3.75,'frame',1.85);
  const p=new T.Vector3(front.ax+front.ux*u,4.6,front.az+front.uz*u),q=p.clone().add(new T.Vector3(front.nx*3.5,.7,front.nz*3.5)),d=q.clone().sub(p),g=new T.CylinderGeometry(.038,.038,d.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));const c=p.add(q).multiplyScalar(.5);add(g,'frame',c.x,c.y,c.z);
 }
}
