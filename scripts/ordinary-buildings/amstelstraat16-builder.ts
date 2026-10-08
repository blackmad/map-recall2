import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import spec from './amstelstraat16-spec.json';
import lower from './amstelstraat16-lower-front.json';
import {openTopPrism,upwardRoofPlane} from '../landmarks/house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
export const openingProbes:{label:string;point:number[];normal:number[];kind:string}[]=[];
/** Original texture-free native reconstruction. Contemporary municipal photographs
 * own facade assemblies; centered survey planes own bounded roof surfaces. */
export function buildAmstelstraat16(_w:number,_d:number,b:BuildingTools){
 openingProbes.length=0;
 const add=(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const shape=(r:number[][])=>new T.Shape(r.map(p=>new T.Vector2(...p)));
 add(openTopPrism(shape(spec.nativeRing),0,spec.lowerRoofHeight),'brick');
 add(openTopPrism(shape(spec.mainRing),spec.lowerRoofHeight,spec.masonryEave),'brick');
 // A low dark layer covers only survey/native boundary uncertainty. High roofs
 // are individual source planes; there is no whole-building16.3m wall cap.
 add(upwardRoofPlane(shape(spec.nativeRing),6.335),'slate');
 for(const roof of spec.roofs){
  const height=(x:number,z:number)=>roof.plane[0]*x+roof.plane[1]*z+roof.plane[2];
  const g=upwardRoofPlane(shape(roof.ring),0),p=g.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i)));g.computeVertexNormals();add(g,roof.surface===133?'slate':'concrete');
  if(roof.surface===133)continue;
  // Metal roof skins sit on supported walls/skirt surfaces, bounded to each
  // original survey ring. They do not turn upper metal into whole-front brick.
  const v:number[]=[];for(let i=0;i<roof.ring.length;i++){const a=roof.ring[i],c=roof.ring[(i+1)%roof.ring.length],ha=height(a[0],a[1]),hc=height(c[0],c[1]);if(Math.max(ha,hc)<=12.05)continue;v.push(a[0],12.05,a[1],c[0],12.05,c[1],c[0],hc,c[1],a[0],12.05,a[1],c[0],hc,c[1],a[0],ha,a[1]);}
  const sides=new T.BufferGeometry();sides.setAttribute('position',new T.Float32BufferAttribute(v,3));sides.computeVertexNormals();add(sides,'concrete');
 }
 const ring=spec.nativeRing;
 // Front edge0 is EAST→WEST, outward north. All face geometry derives from its
 // native tangent. West return is edge1 and terminates before the low rear.
 for(const edge of [0,1]){
  const a=ring[edge],c=ring[edge+1],L=Math.hypot(c[0]-a[0],c[1]-a[1]),ux=(c[0]-a[0])/L,uz=(c[1]-a[1])/L,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux);
  const len=edge===0?L:Math.min(L,17.65);
  const panel=(u:number,y:number,w:number,h:number,d:number,col:Colour,out=.14)=>add(new T.BoxGeometry(w,h,d),col,a[0]+ux*u+nx*out,y+h/2,a[1]+uz*u+nz*out,angle);
  const probe=(label:string,u:number,y:number,out:number,kind:string)=>openingProbes.push({label,point:[a[0]+ux*u+nx*out,y,a[1]+uz*u+nz*out],normal:[nx,0,nz],kind});
  function glazed(label:string,u:number,y:number,w:number,h:number,split=true){
   panel(u,y,w,h,.07,'glass',.15);
   for(const s of[-1,1])panel(u+s*(w/2-.035),y,.07,h,.09,'white',.21);
   panel(u,y,w,.08,.11,'white',.21);panel(u,y+h-.08,w,.08,.11,'white',.21);
   if(split)panel(u,y,.065,h,.08,'frame',.22);
   for(const f of [.12,.32,.68,.88])for(const t of [.2,.55,.85])probe(`${label}-${f}-${t}`,u+(f-.5)*w,y+t*h,.186,'glass');
  }
  if(edge===0){let last=0;for(const bay of lower.floorGlazing.filter(b=>b.groundDoor)){const [dl,dr]=bay.groundDoor!;if(dl>last)panel((last+dl)/2,.05,dl-last,.66,.13,'dark',.17);last=dr;}if(last<len)panel((last+len)/2,.05,len-last,.66,.13,'dark',.17);}
  else panel(len/2,.05,len,.66,.13,'dark',.17);
  panel(len/2,edge===0?6.78:7.03,len,edge===0?.87:.62,.23,'white',.19);
  panel(len/2,3.75,len,.17,.32,'dark',.27);
  for(const y of[11.68,11.92])panel(len/2,y,len,.10,.27,'dark',.19);
  panel(len/2,11.79,len,.065,.30,'white',.21);
  // Twelve uppergroups on street and six on exposed west return; chunky heads
  // remain outside the brick shell. Dimensions approximate from dated photos.
  const count=edge===0?12:6,pitch=len/count;
  for(let k=0;k<count;k++){
   const u=(k+.5)*pitch,w=edge===0?1.18:1.05;
   glazed(`upper-${edge}-${k}`,u,8.10,w,1.75);
   panel(u,9.85,w+.10,.66,.54,'white',.37);
   panel(u,9.83,w+.10,.055,.56,'concrete',.39);
   probe(`head-${edge}-${k}`,u,10.20,.641,'head');
  }
  if(edge===0){
   // v03: independent source traces replace the mirrored semantic prototype.
   // BasicFit is EAST nextAIR; plain service door/louver WEST nextfence. Every
   // firstfloor/ground interval follows the recorded native-u source trace.
   let previous=0;
   for(const bay of lower.floorGlazing){
    const [left,right]=bay.interval,u=(left+right)/2,w=right-left;
    if(left>previous){panel((left+previous)/2,.20,left-previous,6.83,.31,'white',.22);panel((left+previous)/2,.20,left-previous,.92,.33,'concrete',.23);}
    previous=right;glazed(`firstfloor-${bay.id}`,u,4.00,w,2.80,w>2.2);
    if(bay.ground==='plain-service-door-louver'){
     const [dl,dr]=bay.groundDoor!,du=(dl+dr)/2,dw=dr-dl;
     panel(du,bay.doorBottom!,dw,bay.doorTop!-bay.doorBottom!,.08,'dark',.17);
     for(const off of[-dw/2+.04,dw/2-.04])panel(du+off,bay.doorBottom!,.08,bay.doorTop!-bay.doorBottom!,.09,'concrete',.23);
     panel(du,bay.doorBottom!,.07,bay.doorTop!-bay.doorBottom!,.09,'concrete',.23);
     panel(u,bay.louverBottom!,w,bay.louverTop!-bay.louverBottom!,.08,'dark',.19);
     for(let y=bay.louverBottom!+.06;y<bay.louverTop!;y+=.12)panel(u,y,w,.035,.10,'frame',.235);
     probe('west-service-door',du-.25,1.70,.214,'door');
    }else if(bay.groundDoor){
     const [dl,dr]=bay.groundDoor,du=(dl+dr)/2,dw=dr-dl;
     glazed(`ground-${bay.id}-door`,du,.20,dw,bay.transomBottom!-.20,false);
     glazed(`ground-${bay.id}-transom`,u,bay.transomBottom!,w,3.72-bay.transomBottom!,w>2.2);
     panel(du+dw*.30,1.30,.028,.40,.11,'concrete',.27);
     for(const [l,r] of [[left,dl],[dr,right]])if(r-l>.10){panel((l+r)/2,.20,r-l,bay.transomBottom!-.20,.08,'concrete',.17);}
    }else glazed(`ground-${bay.id}`,u,.69,w,3.03,w>2.2);
   }
   if(previous<len){panel((previous+len)/2,.20,len-previous,6.83,.31,'white',.22);panel((previous+len)/2,.20,len-previous,.92,.33,'concrete',.23);}
   // Four real front roof opening/vent clusters at evenly separated source
   // groups. Steep silver sides extend down into measured slope, not float.
   for(const u of[6.15,12.55,19.15,25.55]){
    panel(u,12.06,1.12,2.43,.62,'concrete',-.39);
    panel(u,12.45,.79,1.84,.04,'dark',-.055);
    for(let y=12.58;y<14.27;y+=.22)panel(u,y,.84,.07,.07,'concrete',-.008);
   }
  }else{
   // Open west gap remains outside this exact footprint. Ground glazing is
   // deliberately restricted to observable side bays, with no added fence.
   for(const u of[2.0,5.0,8.0,11.0,14.2]){glazed(`west-lower-${u}`,u,1.05,1.4,2.37);glazed(`west-first-${u}`,u,4.12,1.4,2.59);}
   panel(.14,.65,.28,6.38,.31,'white',.22);
  }
 }
}
