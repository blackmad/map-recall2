import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './haparandaweg-13-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Pand13 is the rear/east box, not neighboring white warehouse or Pand11 street wing. */
export function buildHaparandaweg13(_w:number,_d:number,b:BuildingTools){
 const add=(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const outline=data.outline[0].slice(0,-1),shape=new T.Shape(outline.map(p=>new T.Vector2(p[0],p[1])));
 const r=data.roofs[0].rings[0],cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length,cy=r.reduce((s,p)=>s+p[2],0)/r.length;
 let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of r){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
 const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,c=(zy*xx-xy*xz)/det,height=(x:number,z:number)=>cy+a*(x-cx)+c*(z-cz);
 // Open shell is trimmed to the surveyed roof, whose bounded top alone owns cap.
 const wall=openTopPrism(shape,0,cy),wp=wall.getAttribute('position');for(let i=0;i<wp.count;i++)if(wp.getY(i)>cy-.001)wp.setY(i,height(wp.getX(i),wp.getZ(i)));wall.computeVertexNormals();add(wall,'dark');
 const top=upwardRoofPlane(new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])))),tp=top.getAttribute('position');for(let i=0;i<tp.count;i++)tp.setY(i,height(tp.getX(i),tp.getZ(i)));top.computeVertexNormals();add(top,'slate');

 // Only the independently exposed southeast face is observed. Other walls abut
 // retained parents; no invented windows appear on those faces.
 const [ax,az]=outline[2],[bx,bz]=outline[4],L=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/L,uz=(bz-az)/L,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux),H=height((ax+bx)/2,(az+bz)/2);
 function panel(u:number,y:number,w:number,h:number,d:number,c:Colour,out=.08){add(new T.BoxGeometry(w,h,d),c,ax+ux*u+nx*out,y+h/2,az+uz*u+nz*out,angle);}
 for(let y=.5;y<H-.08;y+=.24)panel(L/2,y,L,.025,.02,'frame',.042);
 panel(L/2,.02,L,.36,.05,'brick',.065);panel(L/2,H-.04,L,.08,.08,'frame',.065);
 function glazed(u:number,y:number,w:number,h:number){add(new T.PlaneGeometry(w,h),'glass',ax+ux*u+nx*.14,y+h/2,az+uz*u+nz*.14,angle);for(const q of [-1,1]){panel(u+q*(w/2+.04),y-.06,.08,h+.12,.05,'frame',.17);panel(u,y+(q===1?h:-.06),w+.16,.06,.05,'frame',.17);}}
 // Leaf-off2021 shows a broad upper pane and narrower right light above a dark
 // spandrel. Lower glazing/door tier is partly fenced; subdivisions approximate.
 const end=L-.22,w=L*.47,start=end-w,split=start+w*.72;
 glazed((start+split)/2,3.72,split-start-.10,2.48);glazed((split+end)/2,3.72,end-split-.10,2.48);
 panel((start+end)/2,2.81,w+.12,.84,.06,'stone',.11);
 for(let i=0;i<3;i++)glazed(start+w*(i+.5)/3,.35,w/3-.09,2.40);
 panel((start+end)/2,.12,w+.22,.12,.30,'concrete',.14);
 panel(end-.10,1.13,.04,.25,.06,'white',.205);
}
