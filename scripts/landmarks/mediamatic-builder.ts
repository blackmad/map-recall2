import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './mediamatic-footprints.json';
import lettering from './mediamatic-sign-outlines.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original flat-colour geometry. Native X east/Z south; no photographs or imported mesh. */
export function buildMediamatic(_w:number,_d:number,b:BuildingTools){
 const origin=new T.Vector2(-5.898,-11.716),s=.164,c=Math.sqrt(1-s*s),angle=Math.asin(s);
 const point=(u:number,v:number)=>new T.Vector2(origin.x+c*u+s*v,origin.y-s*u+c*v);
 const ring=source.parts[0].localOuter.slice(0,-1).map(p=>new T.Vector2(p[0],p[1]));
 const shape=new T.Shape(ring);b.add(openTopPrism(shape,0,.12),'concrete');b.add(upwardRoofPlane(shape,.12),'concrete');
 const box=(u:number,y:number,v:number,w:number,h:number,d:number,col:Colour)=>{const p=point(u,v);b.box(p.x,y,p.y,w,h,d,col,angle);};
 const beam=(a:number[],z:number[],width:number,col:Colour='frame')=>{const pa=point(a[0],a[2]),pz=point(z[0],z[2]),aa=new T.Vector3(pa.x,a[1],pa.y),zz=new T.Vector3(pz.x,z[1],pz.y),delta=zz.clone().sub(aa);const g=new T.BoxGeometry(width,width,delta.length());g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),delta.normalize()));const m=aa.add(zz).multiplyScalar(.5);b.add(g,col,m.x,m.y,m.z);};
 const surface=(vertices:number[][],col:Colour,up=false)=>{const p=vertices.map(a=>{const q=point(a[0],a[2]);return new T.Vector3(q.x,a[1],q.y);});const g=new T.BufferGeometry();const tris:T.Vector3[]=[];for(let i=1;i<p.length-1;i++){let tri=[p[0],p[i],p[i+1]];if(up&&tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).y<0)tri=[tri[0],tri[2],tri[1]];tris.push(...tri);}g.setAttribute('position',new T.Float32BufferAttribute(tris.flatMap(p=>[p.x,p.y,p.z]),3));g.computeVertexNormals();if(up)g.userData.role='roof';b.add(g,col);};
 const flatRoof=(shape:T.Shape,height:number)=>{const g=upwardRoofPlane(shape,height).toNonIndexed();g.userData.role='roof';b.add(g,'slate');};
 const wall=(u1:number,v1:number,u2:number,v2:number,y:number,h:number,col:Colour)=>{const len=Math.hypot(u2-u1,v2-v1),p=point((u1+u2)/2,(v1+v2)/2);b.box(p.x,y,p.y,len,h,col==='glass'?.035:.10,col,angle-Math.atan2(v2-v1,u2-u1));};
 // Survey main roof ~10.65 m above ground; current 2025 photographs retain
 // brick lower body, five north windows and fully glazed added roof storey.
 const main=new T.Shape([[0,0],[12,0],[12,22.2],[.18,22.2],[.13,6.37],[0,6.37]].map(p=>point(p[0],p[1])));
 b.add(openTopPrism(main,.12,7.9),'ochre');
 box(6,7.9,11.1,12.1,.25,22.3,'concrete');
 box(6,8.15,11.1,11.95,2.27,22.12,'glass');
 const mainRoof=new T.Shape([[-.525,-.45],[12.525,-.45],[12.525,22.65],[-.525,22.65]].map(p=>point(p[0],p[1])));
 b.add(openTopPrism(mainRoof,10.42,10.65),'concrete');flatRoof(mainRoof,10.65);
 for(const v of [-.05,22.25]){
  for(let u=.18;u<12;u+=1.19)box(u,8.13,v,.065,2.32,.12,'dark');
  box(6,8.20,v+Math.sign(v-11)*.4,12.6,.065,.065,'dark');box(6,9.2,v+Math.sign(v-11)*.4,12.6,.065,.065,'dark');
  for(let u=.2;u<12.5;u+=2.4)box(u,8.18,v+Math.sign(v-11)*.4,.06,1.03,.065,'dark');
 }
 for(const u of [-.04,12.05]){
  for(let v=.25;v<22.2;v+=1.67)box(u,8.13,v,.12,2.32,.065,'dark');
  box(u+Math.sign(u-6)*.35,8.2,11.1,.065,.065,22.8,'dark');box(u+Math.sign(u-6)*.35,9.2,11.1,.065,.065,22.8,'dark');
  for(let v=.4;v<22.2;v+=2.4)box(u+Math.sign(u-6)*.35,8.18,v,.065,1.03,.065,'dark');
 }
 // North brick wall deliberately remains broad masonry; observed minimum
 // five ground apertures and two ventilation slots, no invented window tier.
 for(const u of [1.5,3.6,5.7,8.2,10.3]){box(u,1.1,-.095,1.43,1.38,.12,'white');box(u,1.2,-.17,1.19,1.13,.055,'dark');}
 for(const u of [4.8,6.6])box(u,6.55,-.09,.12,.8,.055,'dark');
 // East/west long facades: exposed glazing and pale horizontal divisions.
 for(const u of [-.085,12.085])for(const y of [1.1,4.75]){
  for(let v=1.1;v<(u<0?17.8:21.7);v+=2.15){box(u,y,v,.12,2.0,1.8,'glass');box(u,y,v-.92,.16,2.13,.11,'white');}
  box(u,y+2.05,u<0?8.9:11.1,.16,.17,u<0?17.8:22.1,'white');
 }
 // Waterfront end is different from the north: masonry sign face and
 // glazed corner return; do not mirror the five northern low apertures.
 const realSign=(text:string,u:number,y:number,v:number,width:number,height:number,north=false,west=false)=>{
  const sign=lettering.signs.find(s=>s.text===text)!;const sp=new T.ShapePath();
  for(const command of sign.commands){const k=command as {type:string,x?:number,y?:number,x1?:number,y1?:number,x2?:number,y2?:number};
   if(k.type==='M')sp.moveTo(k.x!,-k.y!);else if(k.type==='L')sp.lineTo(k.x!,-k.y!);else if(k.type==='C')sp.bezierCurveTo(k.x1!,-k.y1!,k.x2!,-k.y2!,k.x!,-k.y!);else if(k.type==='Q')sp.quadraticCurveTo(k.x1!,-k.y1!,k.x!,-k.y!);else if(k.type==='Z')sp.currentPath!.closePath();
  }
  const g=new T.ExtrudeGeometry(sp.toShapes(),{depth:.012,bevelEnabled:false,curveSegments:5});g.computeBoundingBox();const bb=g.boundingBox!,sx=width/(bb.max.x-bb.min.x),sy=height/(bb.max.y-bb.min.y);g.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);g.scale(sx,sy,1);const p=point(u,v);g.userData.role='source-supported-lettering';b.add(g,'white',p.x,y,p.y,angle+(north?Math.PI:west?-Math.PI/2:0));
 };
 realSign('Mediamatic',6,8.26,-.085,10.8,1.38,true);
 // Current PDOK aerial proves the south greenhouse wrap and west terrace.
 // Waterfront2019 photograph faces east: the stacked sign belongs to the
 // last western wall pier, not to the southern short end behind greenhouse.
 realSign('Med',.145,5.88,19.93,3.7,1.69,false,true);realSign('iam',.145,3.55,19.93,3.6,1.73,false,true);realSign('atic',.145,1.20,19.93,3.75,1.75,false,true);
 // Rear glazed ribbon above greenhouse follows the office band treatment;
 // source-hidden lower rear openings are left unasserted.
 for(const u of [1.25,3.5,5.75,8.0,10.25]){box(u,4.62,22.30,1.8,2.25,.12,'glass');box(u-.99,4.62,22.37,.11,2.34,.17,'white');}
 box(6,6.87,22.37,11.9,.25,.17,'white');
 // Portakabin is a distinct low, two-storey light panel/glass wing. The older
 // red blinds are neutral in the June2025 panorama; no historical red wall.
 const port=new T.Shape([[17.45,2.16],[23.19,2.07],[23.25,23.89],[17.46,24.31],[15.96,5.35],[15.7,5.06]].map(p=>point(p[0],p[1])));
 b.add(openTopPrism(port,.12,6.4),'white');flatRoof(port,6.4);
 // Place panes on each actual surveyed perimeter tangent; the western
 // wall kinks and slopes, so a fixed u coordinate would bury its windows.
 const portRing=[[17.45,2.16],[23.19,2.07],[23.25,23.89],[17.46,24.31],[15.96,5.35],[15.7,5.06]];
 for(let i=0;i<portRing.length;i++){
  const a=portRing[i],q=portRing[(i+1)%portRing.length],du=q[0]-a[0],dv=q[1]-a[1],len=Math.hypot(du,dv);
  if(len<2)continue;
  const n=[dv/len,-du/len],panes=Math.max(2,Math.floor(len/1.8)),rotation=angle-Math.atan2(dv,du);
  const placed=(t:number,y:number,w:number,h:number,d:number,col:Colour,offset=.13)=>{const p=point(a[0]+du*t+n[0]*offset,a[1]+dv*t+n[1]*offset);b.box(p.x,y,p.y,w,h,d,col,rotation);};
  for(const y of [.75,3.6]){
   for(let k=0;k<panes;k++)placed((k+.5)/panes,y,len/panes-.14,2.18,.12,'glass');
   for(let k=0;k<=panes;k++)placed(k/panes,y-.02,.075,2.38,.17,'dark',.17);
   placed(.5,y+2.20,len,.24,.16,'white');
  }
 }
 // Greenhouse zones from the operator's 1:500 plan, reconciled to the native
 // outline. Gable bays are a photo-guided 3.05m eave/4.02m crest approximation.
 const greenhouse=(u0:number,v0:number,u1:number,v1:number,axis:'u'|'v',bays=1)=>{
  const across=axis==='u'?v1-v0:u1-u0,span=across/bays;
  wall(u0,v0,u1,v0,.12,2.93,'glass');wall(u1,v0,u1,v1,.12,2.93,'glass');wall(u1,v1,u0,v1,.12,2.93,'glass');wall(u0,v1,u0,v0,.12,2.93,'glass');
  for(const y of [.18,1.18,2.4,3.05]){wall(u0,v0,u1,v0,y,.065,'frame');wall(u1,v0,u1,v1,y,.065,'frame');wall(u1,v1,u0,v1,y,.065,'frame');wall(u0,v1,u0,v0,y,.065,'frame');}
  for(let k=0;k<bays;k++){
   const a=(axis==='u'?v0:u0)+k*span,m=a+span/2,z=a+span;
   const coords=(along:number,across:number,h:number)=>axis==='u'?[along,h,across]:[across,h,along];
   const start=axis==='u'?u0:v0,end=axis==='u'?u1:v1;
   surface([coords(start,a,3.05),coords(end,a,3.05),coords(end,m,4.02),coords(start,m,4.02)],'glass',true);
   surface([coords(start,m,4.02),coords(end,m,4.02),coords(end,z,3.05),coords(start,z,3.05)],'glass',true);
   for(const along of [start,end]){let tri=[coords(along,a,3.05),coords(along,m,4.02),coords(along,z,3.05)];if((axis==='u'&&along===start)||(axis==='v'&&along===end))tri=tri.reverse();surface(tri,'glass');beam(coords(along,a,3.05),coords(along,m,4.02),.07);beam(coords(along,m,4.02),coords(along,z,3.05),.07);}
   beam(coords(start,m,4.02),coords(end,m,4.02),.07);
   const panes=Math.ceil((end-start)/1.1);for(let i=0;i<=panes;i++){const along=start+(end-start)*i/panes;for(const x of [a,z]){beam(coords(along,x,.12),coords(along,x,3.05),.055);beam(coords(along,x,3.05),coords(along,m,4.02),.055);}}
  }
 };
 greenhouse(-15.05,.08,-.08,3.02,'u');greenhouse(-17.35,3.14,.05,6.25,'u');
 greenhouse(12.10,.02,24.02,2.02,'u');greenhouse(12.10,2.10,17.24,5.05,'v');
 greenhouse(12.12,11.75,17.25,24.05,'v');
 greenhouse(.79,24.42,24.07,27.98,'u');
 greenhouse(.79,22.40,11.92,24.38,'u');
 // Small photographed greenhouse entrance at northwest return.
 box(-.01,.15,4.63,.11,2.70,1.5,'glass');box(-.16,.15,4.63,.075,2.75,.075,'frame');
 // Rain pipes are slender and supported, not arbitrary rooftop machinery.
 for(const u of [.2,11.8])box(u,.3,-.18,.085,7.6,.085,'dark');
}
