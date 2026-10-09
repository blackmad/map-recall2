import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './fire-station-nico-footprints.json';
import letters from './fire-station-nico-lettering.json';
type C=Parameters<BuildingTools['add']>[1];
/**Original native surveyed reconstruction, no photo pixels/thirdparty meshes.*/
export function buildFireStationNico(_w:number,_d:number,b:BuildingTools){
 const c=.678,s=-.735,norm=Math.hypot(c,s),cc=c/norm,ss=s/norm,ang=-Math.atan2(ss,cc);
 const world=(u:number,v:number)=>new T.Vector2(cc*u-ss*v,ss*u+cc*v);
 const box=(u:number,y:number,v:number,w:number,h:number,d:number,col:C,a=0)=>{const p=world(u,v);b.box(p.x,y,p.y,w,h,d,col,ang+a)};
 const add=(g:T.BufferGeometry,col:C)=>b.add(g,col);
 //Each surveyed roof owns its top. High small equipment volumes begin on main roof.
 for(const part of source.surveyRoofParts){const ring=part.rings[0],h=ring.reduce((a,p)=>a+p[1],0)/ring.length;const sh=new T.Shape(ring.map(p=>new T.Vector2(p[0],p[2])));for(const hole of part.rings.slice(1))sh.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],p[2]))));const bottom=[102,103,104].includes(part.index)?19.75:0;b.add(openTopPrism(sh,bottom,h),'greyBrick');const rawRoof=upwardRoofPlane(sh,h).toNonIndexed(),rp=rawRoof.getAttribute('position'),rv:number[]=[];for(let k=0;k<rp.count;k+=3){const A=new T.Vector3().fromBufferAttribute(rp,k),B=new T.Vector3().fromBufferAttribute(rp,k+1),C=new T.Vector3().fromBufferAttribute(rp,k+2);const area=B.clone().sub(A).cross(C.clone().sub(A)).length()/2,longest=Math.max(A.distanceTo(B),B.distanceTo(C),C.distanceTo(A));if(2*area/longest<.001)continue; /*Only submillimetre triangle altitudes below the source's1mmvertexresolution.*/for(let j=0;j<3;j++)rv.push(rp.getX(k+j),rp.getY(k+j),rp.getZ(k+j));}const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(rv,3));roof.computeVertexNormals();roof.userData={tag:'roof'};b.add(roof,'stone');
  //Roof copings on perimeter, with equipment tops distinct from occupied volumes.
  for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],dx=q[0]-p[0],dz=q[2]-p[2],len=Math.hypot(dx,dz);if(len<1)continue;b.box((p[0]+q[0])/2,h,(p[2]+q[2])/2,len,.12,.16,'frame',-Math.atan2(dz,dx));}
 }
 function pane(u:number,y:number,v:number,w:number,h:number,a=0){const p=world(u,v),na=ang+a;const g=new T.BoxGeometry(w,h,.08);g.rotateY(na);g.translate(p.x,y+h/2,p.y);g.userData={tag:'pane',sample:{x:p.x,y,z:p.y,w,h,a:na}};add(g,'glass');}
 function win(u:number,y:number,v:number,w:number,h:number,a=0,div=2){const shift=(dx:number,dz:number)=>[u+Math.cos(a)*dx+Math.sin(a)*dz,v-Math.sin(a)*dx+Math.cos(a)*dz];const f=(dx:number,yy:number,dz:number,ww:number,hh:number,dd:number,col:C)=>{const p=shift(dx,dz);box(p[0],yy,p[1],ww,hh,dd,col,a)};f(0,y,0,w+.18,h+.18,.1,'white');const p=shift(0,.11);pane(p[0],y,p[1],w,h,a);for(const dx of[-w/2,w/2])f(dx,y,.18,.065,h,.1,'white');for(let i=1;i<div;i++)f(-w/2+w*i/div,y,.18,.045,h,.1,'white');for(const yy of[0,h*.45,h])f(0,y+yy,.18,w,.055,.1,'white');f(0,y-.08,.13,w+.2,.1,.24,'white');}
 //Northwest IJtunnel facade, surveyed main edge28→29. Sourcephoto left = increasingu.
 const front=-3.73;
 for(let i=0;i<9;i++){const u=16.2+4.05*i;box(u,.03,front,3.82,4.8,.13,'white');for(const y of[.7,3.62])win(u,y,front-.18,3.4,.76,Math.PI,4);for(const y of[1.8,2.56,3.45,4.56])box(u,y,front-.22,3.72,.045,.06,'frame');box(u-1.99,0,front-.2,.12,5.02,.15,'white');}
 //Tier abovegarage: photoLEFT narrowverticals, photoRIGHT widehorizontalglazing.
 for(let u=15;u<38;u+=3.1)win(u,6.08,front-.04,2.67,2.13,Math.PI,2);
 for(let u=39;u<61;u+=2.0)win(u,6.1,front-.04,.68,1.84,Math.PI,1);
 //Nexttier: photoLEFT long horizontal band, photoRIGHT six narrow uprightlights.
 for(let u=29.5;u<62;u+=3.1)win(u,10.18,front-.04,2.76,2.06,Math.PI,2);
 for(let u=13;u<28;u+=2.5)win(u,10.18,front-.06,.68,1.9,Math.PI,1);
 //Defining upperwhiteassembly is exposed on photographedwall, below sixwindowgroups.
 box(25.5,14.5,front-.04,23.6,3.05,.15,'white');for(let i=0;i<6;i++)win(15.2+i*4.0,17.55,front-.12,3.75,1.65,Math.PI,2);
 //PhotoLEFT raised outerblock (u49..62) with whiteframedupperglazing.
 for(let u=50;u<62;u+=3)win(u,13.52,front-.09,2.58,2.0,Math.PI,2);
 //Near street-end stairblock left of nativeanchor follows true lowerreturnedge.
 for(const y of[2.0,6.1,10.2,14.15])for(const u of[-.8,2.4,5.6,8.7])win(u,y,16.22,2.66,2.0,0,2);
 //Returned facades attach to actual survey perimeter. Exclude principalfront28..34 and explicit staircaseface20..21; restore bounded rear23..26 rhythm.
 const ring=source.nativeRing;for(let i=0;i<ring.length-1;i++){const p=ring[i],q=ring[i+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<7||[20,21,28,29,30,31,32,33,34].includes(i))continue;const tangent=new T.Vector2(dx/len,dz/len),normal=new T.Vector2(-tangent.y,tangent.x),angle=Math.atan2(normal.x,normal.y);const signed=ring.slice(0,-1).reduce((v,p,k)=>{const q=ring[(k+1)%(ring.length-1)];return v+p[0]*q[1]-q[0]*p[1]},0);if(signed>0)normal.negate();const a=Math.atan2(normal.x,normal.y),count=Math.floor(len/3.2);for(let j=0;j<count;j++){const x=p[0]+dx*(j+.5)/count+normal.x*.1,z=p[1]+dz*(j+.5)/count+normal.y*.1;const u=cc*x+ss*z,v=-ss*x+cc*z;const relative=a-ang;for(const y of[2.1,6.2,10.25]){ //Find own highestsupported roof via vertical plan point, do not put windows in thinlowannex.
  const inside=(ps:number[][])=>{let yes=false;for(let k=0,l=ps.length-1;k<ps.length;l=k++){const A=ps[k],B=ps[l];if((A[2]>z-normal.y*.2)!==(B[2]>z-normal.y*.2)&&(x-normal.x*.2)<(B[0]-A[0])*(z-normal.y*.2-A[2])/(B[2]-A[2])+A[0])yes=!yes}return yes};const hh=Math.max(0,...source.surveyRoofParts.filter(r=>inside(r.rings[0])).map(r=>r.rings[0].reduce((s,p)=>s+p[1],0)/r.rings[0].length));if(y+1.9<hh-.3)win(u,y,v,2.2,1.9,relative,2);}}
 }
 //Source-supported currentfascia BRANDWEER: boldsansapproximation, fitted to actualfasciaplane.
 const path=new T.ShapePath();for(const cmd of letters.commands as any[]){if(cmd.type==='M')path.moveTo(cmd.x,-cmd.y);else if(cmd.type==='L')path.lineTo(cmd.x,-cmd.y);else if(cmd.type==='Q')path.quadraticCurveTo(cmd.x1,-cmd.y1,cmd.x,-cmd.y);else if(cmd.type==='C')path.bezierCurveTo(cmd.x1,-cmd.y1,cmd.x2,-cmd.y2,cmd.x,-cmd.y);else if(cmd.type==='Z')path.currentPath?.closePath();}const g=new T.ExtrudeGeometry(path.toShapes(),{depth:.05,bevelEnabled:false,curveSegments:3});g.computeBoundingBox();const bb=g.boundingBox!,size=bb.getSize(new T.Vector3());g.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);g.scale(10.4/size.x,.85/size.y,1);g.rotateY(ang+Math.PI);const sp=world(26,-4.02);g.translate(sp.x,5.14,sp.y);add(g,'red');
 //Bounded rooftop aerialmasts, roofequipmentmax is distinct from masonryheights.
 for(const u of[7,34]){box(u,20.1,7.8,.13,4.8,.13,'frame');for(const y of[21,22.1,23.2])box(u,y,7.8,1.2,.065,.065,'frame');}
}
