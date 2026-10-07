import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './haparandaweg-11-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native Pand 11. Exact survey shell and roof; photographed right white
 * workshop plus charcoal street wing. Neighbor 9's left workshop is excluded. */
export function buildHaparandaweg11(_w:number,_d:number,b:BuildingTools){
 const add=(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const outline=data.outline[0].slice(0,-1),shape=new T.Shape(outline.map(p=>new T.Vector2(p[0],p[1])));
 const r=data.roofs[0].rings[0],cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length,cy=r.reduce((s,p)=>s+p[2],0)/r.length;
 let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of r){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
 const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,c=(zy*xx-xy*xz)/det,height=(x:number,z:number)=>cy+a*(x-cx)+c*(z-cz);
 // Open shell is trimmed to the surveyed roof, whose bounded top alone owns cap.
 const wall=openTopPrism(shape,0,cy),wp=wall.getAttribute('position');for(let i=0;i<wp.count;i++)if(wp.getY(i)>cy-.001)wp.setY(i,height(wp.getX(i),wp.getZ(i)));wall.computeVertexNormals();add(wall,'dark');
 const top=upwardRoofPlane(new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])))),tp=top.getAttribute('position');for(let i=0;i<tp.count;i++)tp.setY(i,height(tp.getX(i),tp.getZ(i)));top.computeVertexNormals();add(top,'slate');
 function facade(i:number,j:number,colour:Colour){const [ax,az]=outline[i],[bx,bz]=outline[j],L=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/L,uz=(bz-az)/L,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux),H=height((ax+bx)/2,(az+bz)/2);
  function panel(u:number,y:number,w:number,h:number,d:number,c:Colour,out=.10){add(new T.BoxGeometry(w,h,d),c,ax+ux*u+nx*out,y+h/2,az+uz*u+nz*out,angle);}
  // The horizontal metal-board character is original geometry, not photo pixels.
  panel(L/2,.42,L,H-.42,.04,colour,.032);panel(L/2,.02,L,.40,.07,'brick',.065);
  for(let y=.55;y<H-.08;y+=.24){const g=new T.PlaneGeometry(L,.025);add(g,'frame',ax+ux*L/2+nx*.064,y,az+uz*L/2+nz*.064,angle);}
  panel(L/2,H-.045,L,.09,.11,'frame',.10);
  function glazed(u:number,y:number,w:number,h:number){add(new T.PlaneGeometry(w,h),'glass',ax+ux*u+nx*.29,y+h/2,az+uz*u+nz*.29,angle);for(const s of [-1,1]){panel(u+s*(w/2+.045),y-.08,.09,h+.16,.07,'frame',.32);panel(u,y+(s===1?h:-.08),w+.16,.08,.07,'frame',.32);}}
  if(i===2){ // Only 11's RIGHT pale workshop bay, exact surveyed 4.85 m edge.
   const u=L*.5,w=L*.84,h=3.36;panel(u,.04,w,h,.07,'bronze',.15);
   for(let y=.18;y<h;y+=.20)panel(u,y,w-.07,.022,.022,'copper',.20);
   for(const side of [-1,1])panel(u+side*(w/2+.075),0,.15,h+.17,.12,'white',.23);
   panel(u,h+.05,w+.3,.14,.12,'white',.23);panel(u,.02,w+.3,.04,.32,'concrete',.20);
   // Four permanent small roller-door lights, visible in 2021/2025.
   for(const f of [-.31,-.105,.105,.31]){glazed(u+w*f,1.57,.55,.29);}
   const upperW=L*.82,gap=.07,pw=(upperW-3*gap)/4;
   for(let k=0;k<4;k++)glazed(u-upperW/2+pw/2+k*(pw+gap),4.65,pw,1.52);
  }
  if(i===3){ // Long dark street wing: six observed narrow uppers: first four west2025 + last four east2025.
   for(const f of [0.115243,0.272172,0.443164,0.612146,0.745786,0.919396])glazed(L*f,4.52,.88,1.60);
   // Lower glazing near workshop; tree-obscured centre remains unembellished.
   for(const f of [.065,.17])glazed(L*f,.56,1.20,1.68);
   // Recessed entrance at right is source-supported; metric subdivision approximate.
   panel(L*.83,.20,2.4,2.62,.08,'white',.12);
   glazed(L*.80,.24,.68,2.32);glazed(L*.89,.72,.84,1.54);
   panel(L*.80,.15,.87,.08,.34,'concrete',.20);
  }
 }
 facade(2,3,'white');facade(3,4,'dark');
 // Rear/party-wall faces retain surveyed shell; no invented hidden openings.
}
