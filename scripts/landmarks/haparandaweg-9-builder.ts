import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './haparandaweg-9-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original surveyed physical Pand9 only. Neighbor11 owns right roller door/window group.
 * 2021 leaf-off/2025 panoramas establish three office windows, tall glazing and
 * short pale workshop bay. Dimensions of apertures are photo-guided approximations. */
export function buildHaparandaweg9(_w:number,_d:number,b:BuildingTools){
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
  function glazed(u:number,y:number,w:number,h:number){add(new T.PlaneGeometry(w,h),'glass',ax+ux*u+nx*.16,y+h/2,az+uz*u+nz*.16,angle);for(const s of [-1,1]){panel(u+s*(w/2+.045),y-.08,.09,h+.16,.07,'frame',.19);panel(u,y+(s===1?h:-.08),w+.16,.08,.07,'frame',.19);}}
  if(i===5){ //3upper narrow,2lower narrow; left stair aperture spans both levels.
   for(const u of [L*.38,L*.59,L*.81])glazed(u,4.43,.87,1.7);
   for(const u of [L*.59,L*.81])glazed(u,.92,.84,1.78);
   glazed(L*.105,3.08,1.20,3.0);glazed(L*.105-.335,.12,.53,2.22);glazed(L*.105+.335,.12,.53,2.22);panel(L*.105,2.35,1.36,.72,.08,'stone',.20);
   // Front stair door leaf, threshold, vertical stile and small handle.
   panel(L*.105,.12,.065,2.22,.075,'frame',.235);panel(L*.105+.64,.99,.035,.30,.08,'white',.245);panel(L*.105,.05,1.45,.07,.35,'concrete',.20);
  }
  if(i===6){glazed(L*.51,3.18,1.13,2.9);glazed(L*.51,.22,1.1,2.14);panel(L*.51,2.36,1.27,.79,.07,'stone',.205);panel(L*.51,.09,1.36,.10,.32,'concrete',.20);}
  if(i===3){ //Oblique return visible in leaf-off2021; lower row partly occluded.
   for(const u of [L*.22,L*.49,L*.76]){glazed(u-.37,4.55,.58,1.45);glazed(u+.37,4.55,.58,1.45);glazed(u,.75,1.24,1.55);panel(u,4.55,.06,1.45,.075,'frame',.235);}
  }
  if(i===7){ //Only9left blue workshop door. Right garage/upper group are11.
   const u=L*.47,w=L*.76,h=3.25;panel(u,.06,w,h,.065,'bronze',.15);
   for(let y=.22;y<h-.08;y+=.36)panel(u,y,w-.1,.025,.025,'copper',.205);
   for(const s of [-1,1])panel(u+s*(w/2+.095),0,.19,h+.22,.16,'white',.205);
   panel(u,h+.07,w+.38,.15,.17,'white',.205);panel(u,.03,w+.3,.05,.35,'concrete',.19);
   //Current2025 top band is blue with tiny dark inset opening; preserve closed
   //roller leaf rather than importing transient open2021 workshop interiors.
   panel(u-w*.30,2.84,.23,.11,.035,'dark',.235);
   for(const s of [-.5,.5])panel(u+s*.72,3.68,.17,.13,.24,'frame',.26);
  }
 }
 facade(3,4,'white');facade(4,5,'dark');facade(5,6,'dark');facade(6,7,'dark');facade(7,0,'white');
 // Other faces abut independently retained Pand neighbors. No speculative
 //rear openings or whole-parcel court fill is added.
}
