import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './lekstraat-synagoge-footprints.json';
import lettering from './lekstraat-synagoge-sign-outlines.json';
type P=number[];type C=Parameters<BuildingTools['add']>[1];
/** Original surveyed east/south geometry, metres. Roofs own tops; gardens remain open. */
export function buildLekstraatSynagoge(_w:number,_d:number,b:BuildingTools){
 const shape=(r:P[])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
 const surface=(rings:P[][],height:number,c:C,role:string)=>{const sh=shape(rings[0]);for(const h of rings.slice(1))sh.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[1]))));const g=upwardRoofPlane(sh,height);g.userData={role};b.add(g,c);};
 // AHN median plane levels are the flat-roof authority. Small slanted junction
 // fits69/76 are flattened to adjoining architectural roof levels, not copied as fins.
 for(const r of source.roofs){if(r.index===66||r.index===73||r.index===67)continue;const h=r.index===69?14.8677:r.index===76?8.9565:r.medianHeight;const sh=shape(r.rings[0]);for(const ring of r.rings.slice(1))sh.holes.push(new T.Path(ring.map(p=>new T.Vector2(p[0],p[1]))));b.add(openTopPrism(sh,0,h),[69,70,71,72].includes(r.index)?'stone':'ochre');surface(r.rings,h,'slate','explicit-roof');}
 const outline=source.outline[0],frontA=outline[11],frontB=outline[10],sideB=outline[12];
 const facade=(a:P,z:P,outside:number)=>{const len=Math.hypot(z[0]-a[0],z[1]-a[1]),ux=(z[0]-a[0])/len,uz=(z[1]-a[1])/len,nx=-uz*outside,nz=ux*outside,angle=Math.atan2(-uz,ux);return{len,ux,uz,nx,nz,angle,point:(u:number,v=0)=>[a[0]+ux*u+nx*v,a[1]+uz*u+nz*v],box:(u:number,y:number,v:number,w:number,h:number,d:number,c:C)=>{const p=[a[0]+ux*u+nx*v,a[1]+uz*u+nz*v];b.box(p[0],y,p[1],w,h,d,c,angle);}}};
 const front=facade(frontA,frontB,-1),side=facade(frontA,sideB,1);
 const pane=(f:ReturnType<typeof facade>,u:number,y:number,w:number,h:number,id:string,paired=false)=>{f.box(u,y,.085,w,h,.10,'glass');const at=f.point(u,.14); // Full-face samples are checked against first-hit masonry.
  for(const dx of [-w/2,w/2])f.box(u+dx,y-.07,.14,.09,h+.14,.16,'stone');for(const yy of [y-.07,y+h])f.box(u,yy,.14,w+.10,.09,.16,'stone');
  f.box(u,y,.15,.045,h,.05,'dark');if(paired){for(const dx of [-w/4,w/4])f.box(u+dx,y,.15,.035,h,.05,'dark');f.box(u,y+h*.46,.15,w,.035,.05,'dark');}
 };
 // Lekstraat: five square steel windows, recessed wooden doors and thin canopy.
 for(const t of [.10,.30,.50,.70,.90])pane(front,front.len*t,2.35,1.45,1.45,'front');
 const doorU=front.len*.50;front.box(doorU,0,.085,1.90,2.35,.13,'dark');front.box(doorU,0,.17,1.75,2.30,.10,'bronze');front.box(doorU,0,.235,.06,2.30,.08,'dark');front.box(doorU,2.28,.7,2.65,.10,1.50,'copper');
 // Kinderdijkstraat: source-confirmed seven ground squares and seven paired tall windows.
 for(let i=0;i<7;i++){const u=side.len*(i+.5)/7;pane(side,u,2.35,1.45,1.45,`side-low-${i}`);pane(side,u,10.10,2.50,3.85,`side-high-${i}`,true);}
 const ne=facade(outline[10],source.roofs.find(r=>r.index===71)!.rings[0][1],-1);for(let i=0;i<7;i++)pane(ne,ne.len*(i+.5)/7,10.10,2.50,3.85,`ne-high-${i}`,true);
 // Copper-clad overhangs, modeled from the two actual exposed main hall edges.
 for(const f of [front,side])f.box(f.len/2,14.78,.28,f.len+.30,.16,.70,'copper');
 // Restrained natural-stone panel joints; flush exposed relief, not photo texture.
 for(const f of [front,side]){for(let u=1.12;u<f.len;u+=1.12)f.box(u,0,.022,.012,14.78,.014,'concrete');for(let y=1.0;y<14.7;y+=1.02)f.box(f.len/2,y,.022,f.len,.012,.014,'concrete');}
 // Defining Hebrew metal inscription, actualfourline Bible quotation. Arial Hebrew
 // bold outlines are an explicitly approximate sans match; no invented POI-name words.
 for(const line of lettering.lines){const shapes:T.Shape[]=[];for(const commands of line.paths){let sh:T.Shape|undefined;for(const c of commands){if(c.type==='M'){sh=new T.Shape();sh.moveTo(c.x,c.y);shapes.push(sh);}else if(c.type==='L')sh!.lineTo(c.x,c.y);else if(c.type==='Q')sh!.quadraticCurveTo(c.x1,c.y1,c.x,c.y);else if(c.type==='C'&&'x2' in c&&'y2' in c)sh!.bezierCurveTo(c.x1,c.y1,Number(c.x2),Number(c.y2),c.x,c.y);else if(c.type==='Z')sh!.closePath();}}const g=new T.ExtrudeGeometry(shapes,{depth:.025,bevelEnabled:false,curveSegments:4});g.rotateY(front.angle+Math.PI);const p=front.point(front.len*.51,.085);g.translate(p[0],line.y,p[1]);b.add(g,'copper');}
 // Lower synagogue / residence wing: side entrance61 and long exposed window strips.
 const wing=facade(outline[8],outline[7],-1);for(const y of [3.2,6.2]){pane(wing,wing.len*.72,y,4.2,1.6,'wing');}wing.box(wing.len*.84,0,.10,1.05,2.75,.12,'white');wing.box(wing.len*.84,2.90,.50,1.80,.12,1.05,'copper');
 const wingFront=facade(outline[9],outline[8],-1);for(const t of [.22,.53])for(const y of [3.2,6.2]){pane(wingFront,wingFront.len*t,y,3.55,1.85,'wingfront');for(let j=-2;j<=2;j++)wingFront.box(wingFront.len*t+j*.59,y,.15,.035,1.85,.05,'dark');}for(const t of [.21,.52]){wingFront.box(wingFront.len*t,0,.09,1.40,2.8,.14,'bronze');wingFront.box(wingFront.len*t,2.85,.44,2.05,.10,1.0,'copper');}
 // L terrace follows surveyed lower roof68 boundary, retained unobstructed.
 const terrace=source.roofs.find(r=>r.index===68)!.rings[0];for(let i=0;i<terrace.length;i++){const a=terrace[i],z=terrace[(i+1)%terrace.length],f=facade(a,z,1);if(f.len<.5)continue;f.box(f.len/2,9.86,0,f.len,.06,.06,'dark');for(let u=.15;u<f.len;u+=.42)f.box(u,8.96,0,.035,.96,.035,'dark');}
 const rearWing=facade(outline[7],outline[0],1);pane(rearWing,rearWing.len/2,3.5,rearWing.len*.90,1.20,'rearwing');for(let u=1;u<rearWing.len;u+=1)rearWing.box(u,3.5,.15,.035,1.2,.05,'dark');const resident=source.roofs.find(r=>r.index===75)!.rings[0];const residenceFront=facade(resident[6],resident[3],-1);for(const t of [.14,.30,.80,.94])pane(residenceFront,residenceFront.len*t,9.6,1.32,1.8,'residence-front');const rearFace=facade(resident[0],resident[2],1);for(const t of [.23,.50,.77])pane(rearFace,rearFace.len*t,9.6,1.65,1.8,'residence');rearFace.box(rearFace.len/2,8.96,.5,rearFace.len,.15,1.1,'copper');for(let u=.2;u<rearFace.len;u+=.5)rearFace.box(u,9.11,.95,.035,.95,.035,'dark');rearFace.box(rearFace.len/2,10.03,.95,rearFace.len,.05,.05,'dark');
 // Round high lantern/vent pipe behind the terrace, explicit register assertion
 // confirmed inother.jpg. Photo-guided14m top; not anAHNequipment maximum.
 const chimney=front.point(22.2,-8.3);b.add(new T.CylinderGeometry(.43,.43,3.8,20),'ochre',chimney[0],10.9,chimney[1]);b.add(new T.CylinderGeometry(.19,.19,.85,16),'concrete',chimney[0],13.225,chimney[1]);b.add(new T.CylinderGeometry(.33,.33,.10,16),'dark',chimney[0],13.70,chimney[1]);
 // Oval glass residence bay at the source semicircular-front roof67 footprint.
 const control=source.roofs.find(r=>r.index===67)!.rings[0];const oval:P[]=[];for(let i=0;i<control.length;i++){const prev=control[(i+control.length-1)%control.length],p=control[i],next=control[(i+1)%control.length];const a=[p[0]*.70+prev[0]*.30,p[1]*.70+prev[1]*.30],z=[p[0]*.70+next[0]*.30,p[1]*.70+next[1]*.30];for(let j=0;j<=4;j++){const t=j/4;oval.push([(1-t)*(1-t)*a[0]+2*(1-t)*t*p[0]+t*t*z[0],(1-t)*(1-t)*a[1]+2*(1-t)*t*p[1]+t*t*z[1]]);}}b.add(openTopPrism(shape(oval),8.9565,11.3935),'glass');surface([oval],11.3935,'copper','explicit-roof');for(let i=0;i<oval.length;i++){const f=facade(oval[i],oval[(i+1)%oval.length],1);if(f.len<.10)continue;pane(f,f.len/2,9.0,f.len-.04,2.32,'oval');}
}
