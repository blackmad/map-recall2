import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './fire-station-hendrik-footprints.json';
import letters from './fire-station-hendrik-lettering.json';
type C=Parameters<BuildingTools['add']>[1];
/** Original surveyed native-plan station, current2025 renovated front. No imported meshes/textures. */
export function buildFireStationHendrik(_w:number,_d:number,b:BuildingTools){
 const currentRidge=[[-17.6579,15.4585,17.0372],[-14.4161,15.7335,14.5220],[-14.0201,15.7665,14.2150],[-1.6305,15.6955,-2.1700],[-1.0659,15.6905,-2.9174],[.8069,16.0235,-5.3929],[3.7426,15.8635,-19.9221]];
 const ring=source.nativeRing.slice(0,-1),shape=(r:number[][])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
 // Each measured roof polygon owns its upper face. Shells use the minimum eave,
 // with a vertical skirt to the measured plane, avoiding wall-coloured top caps.
 for(const part of source.surveyRoofParts){
  const ps=part.rings[0].map(p=>{const ridge=currentRidge.find(q=>Math.hypot(q[0]-p[0],q[2]-p[2])<.015);return ridge&&[117,120,121].includes(part.index)?[p[0],ridge[1]-1.42,p[2]]:p;}),rr=ps.map(p=>[p[0],p[2]]),sh=shape(rr),lo=Math.min(...ps.map(p=>p[1]));
  b.add(openTopPrism(sh,0,lo),'brick');
  const origin=ps.reduce((v,p)=>v.add(new T.Vector3(...p)),new T.Vector3()).multiplyScalar(1/ps.length);
  let xx=0,zz=0,xz=0,xy=0,zy=0;for(const p of ps){const x=p[0]-origin.x,z=p[2]-origin.z,y=p[1]-origin.y;xx+=x*x;zz+=z*z;xz+=x*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz,sx=(xy*zz-zy*xz)/det,sz=(zy*xx-xy*xz)/det,at=(x:number,z:number)=>origin.y+sx*(x-origin.x)+sz*(z-origin.z);
  const g=upwardRoofPlane(sh);const pos=g.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,ps.reduce((best,p)=>Math.hypot(p[0]-pos.getX(i),p[2]-pos.getZ(i))<Math.hypot(best[0]-pos.getX(i),best[2]-pos.getZ(i))?p:best,ps[0])[1]);g.computeVertexNormals();g.userData={role:'source-roof',sourceIndex:part.index};b.add(g,part.index===114?'stone':'slate');
  const skirt:number[]=[];for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length];for(const v of [[p[0],lo,p[2]],[q[0],lo,q[2]],[q[0],q[1],q[2]],[p[0],lo,p[2]],[q[0],q[1],q[2]],[p[0],p[1],p[2]]])skirt.push(...v);}
  const walls=new T.BufferGeometry();walls.setAttribute('position',new T.Float32BufferAttribute(skirt,3));walls.computeVertexNormals();b.add(walls,'brick');
 }
 const front=[...source.frontage,[9.69,-15.95],[10.23,-18.71],[11.21,-18.49],[13.49,-31.07]],segments=front.slice(1).map((p,i)=>({a:front[i],p,len:Math.hypot(p[0]-front[i][0],p[1]-front[i][1])}));
 const length=segments.reduce((n,s)=>n+s.len,0);
 // The front is a surveyed curved chain, SW toward NE. Its right-hand normal faces Rozengracht.
 const frame=(s:number,inset=0)=>{s=Math.max(0,Math.min(length-.001,s));let run=0;for(const e of segments){if(run+e.len>=s){const t=(s-run)/e.len,ux=(e.p[0]-e.a[0])/e.len,uz=(e.p[1]-e.a[1])/e.len,nx=-uz,nz=ux;return {x:e.a[0]+t*(e.p[0]-e.a[0])+nx*inset,z:e.a[1]+t*(e.p[1]-e.a[1])+nz*inset,angle:Math.atan2(-uz,ux),nx,nz};}run+=e.len;}throw Error('front chain');};
 const box=(s:number,y:number,w:number,h:number,d:number,c:C,inset=.10)=>{const q=frame(s,inset);b.box(q.x,y,q.z,w,h,d,c,q.angle);};
 const win=(s:number,y:number,w:number,h:number,cols=3,inset=.16)=>{box(s,y-.08,w+.17,h+.16,.10,'white',inset);box(s,y,w,h,.08,'glass',inset+.08);for(let i=1;i<cols;i++){const q=frame(s,inset+.15),u=-w/2+i*w/cols; b.box(q.x+Math.cos(q.angle)*u,y,q.z-Math.sin(q.angle)*u,.07,h,.055,'white',q.angle);}box(s,y,w,.065,.08,'white',inset+.15);};
 // Five doors use contemporary black steel glazing; observed upper red panels remain.
 const doors=[4.4,10.8,17.2,23.6,30.0];for(const s of doors){box(s,.08,5.10,4.85,.10,'red',.15);for(const y of [1.0,1.77,2.54]){box(s,y,5.01,.66,.075,'glass',.23);box(s,y-.065,5.1,.07,.075,'dark',.29);}for(const u of [-1.7,0,1.7]){const q=frame(s,.29);b.box(q.x+Math.cos(q.angle)*u,.95,q.z-Math.sin(q.angle)*u,.065,2.4,.055,'dark',q.angle);}box(s,4.94,5.42,.25,.19,'white',.16);win(s,7.0,5.0,2.50,4);}
 for(let s=0;s<length;s+=1){box(s,s<49?9.85:11.30,1.04,.25,.38,'white',.18);box(s,0,1.03,.34,.16,'stone',.08);}
 // The clerestory occupies the actual vertical step between front and rear roof
 // surfaces121/122and117/119. Use shared surveyed ridge vertices, not a parallel
 // facade inset: that earlier draft floated southwest windows beyond the roof.
 const ridge=currentRidge.map(p=>[p[0],p[1]-1.42,p[2]]);
 for(let i=0;i<ridge.length-1;i++){const p=ridge[i],q=ridge[i+1],dx=q[0]-p[0],dz=q[2]-p[2],l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux),count=Math.max(1,Math.round(l/2.1));
  for(let j=0;j<count;j++){const t=(j+.5)/count,x=p[0]+t*dx+nx*.13,z=p[2]+t*dz+nz*.13,y=p[1]+t*(q[1]-p[1])+.08,w=l/count;
   b.box(x,y,z,w+.015,1.20,.18,'white',angle);b.box(x+nx*.11,y+.10,z+nz*.11,w-.13,.96,.08,'glass',angle);b.box(x+nx*.16,y+.10,z+nz*.16,.065,.96,.05,'white',angle);b.box(x,y+1.20,z,w+.025,.28,.23,'white',angle);
  }
 }
 // Reconstructed post-renovation polygon bay: exposed glazing at both levels.
 for(const [s,w] of [[35.0,2.8],[38.0,2.8]]){box(s,6.6,w+.35,3.3,1.20,'brick',.63);box(s,9.55,w+.4,.28,1.4,'white',.69);win(s,6.95,w,2.6,3,1.33);win(s,.7,w,2.3,3,.22);}
 // New rightwing infill is visible in municipal July2025renovation frame:
 // two three-pane groups at middle and ground tier, retained small upper lights.
 for(const ss of [43.8,48.3])for(const yy of [.70,4.10])win(ss,yy,3.45,1.92,3);
 for(const ss of [43.6,45.7,47.8,50.5,52.6,54.7,56.8,58.9,61.0])win(ss,8.2,.65,.82,1);
 for(const ss of [52.6,54.7,56.8,58.9,61.0])for(const yy of [1.20,4.60])win(ss,yy,.62,.78,1);
 box(40.7,.10,1.05,2.9,.10,'red',.15);win(40.7,.3,.80,2.45,1,.25);
 // Third return of projecting bay and source-supported red flame relief.
 const bay=frame(39.95,.72);b.box(bay.x,6.95,bay.z,1.14,2.58,.09,'white',bay.angle+.48);b.box(bay.x+Math.sin(bay.angle+.48)*.09,7.05,bay.z+Math.cos(bay.angle+.48)*.09,.96,2.38,.08,'glass',bay.angle+.48);
 const flame=frame(36.9,1.36);const fp=new T.Shape();fp.moveTo(-.32,0);fp.bezierCurveTo(-.94,.55,-.75,1.25,-.25,1.78);fp.bezierCurveTo(-.23,1.05,.37,1.06,.28,2.04);fp.bezierCurveTo(1.11,1.39,.98,.48,.28,.04);fp.lineTo(0,-.26);fp.closePath();const fg=new T.ExtrudeGeometry(fp,{depth:.05,bevelEnabled:false,curveSegments:5});fg.rotateY(flame.angle);fg.translate(flame.x,5.03,flame.z);b.add(fg,'red');
 
 // Main real fascia sign: source opening photograph red bold sans lettering,
 // not proposed gold rendering. Outlines approximate Arial Narrow Bold, native curves.
 const lettering=(data:typeof letters[number],s:number,y:number,w:number,h:number,c:C)=>{const p=new T.ShapePath();for(const cmd of data.commands as any[]){if(cmd.type==='M')p.moveTo(cmd.x,-cmd.y);else if(cmd.type==='L')p.lineTo(cmd.x,-cmd.y);else if(cmd.type==='Q')p.quadraticCurveTo(cmd.x1,-cmd.y1,cmd.x,-cmd.y);else if(cmd.type==='C')p.bezierCurveTo(cmd.x1,-cmd.y1,cmd.x2,-cmd.y2,cmd.x,-cmd.y);else if(cmd.type==='Z')p.currentPath?.closePath();}const g=new T.ExtrudeGeometry(p.toShapes(),{depth:.026,bevelEnabled:false,curveSegments:3});g.computeBoundingBox();const bb=g.boundingBox!,size=bb.getSize(new T.Vector3());g.translate(-(bb.max.x+bb.min.x)/2,-bb.min.y,0);g.scale(w/size.x,h/size.y,1);const q=frame(s,.18);g.rotateY(q.angle);g.translate(q.x,y,q.z);g.userData={role:'source-sign',text:data.text,fontApproximation:data.fontApproximation};b.add(g,c);};
 lettering(letters[0],19.8,5.67,13.1,.92,'red');lettering(letters[1],19.8,5.18,10.4,.36,'white');
 // St.Victor commemorative plaque at southwest end; abstract native relief,
 // no invented lettering or copied pixels. Actual1685 stone retained in current station.
 box(1.0,2.30,1.15,2.1,.10,'stone',.16);box(1.0,2.83,.57,1.08,.05,'red',.24);box(1.0,3.15,.19,.56,.065,'white',.28);
 // Solar arrays physically follow the principal surveyed roof117 rather than float horizontally.
 const solar=source.surveyRoofParts.find(p=>p.index===117)!;const rp=solar.rings[0];const n=new T.Vector3(...rp[1]).sub(new T.Vector3(...rp[0])).cross(new T.Vector3(...rp[2]).sub(new T.Vector3(...rp[0]))).normalize();if(n.y<0)n.negate();
 for(const s of [17.5,23.0,28.5,34.0]){const q=frame(s,-2.5),p0=new T.Vector3(...rp[0]),y=p0.y-(n.x*(q.x-p0.x)+n.z*(q.z-p0.z))/n.y+.09;const g=new T.BoxGeometry(4.2,.08,2.2);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),n));g.translate(q.x,y,q.z);b.add(g,'blue');}
 // Current opening photo shows southwest end mostly blank, with only two
 // paired small lights and one low narrow grille. No generic party-wall wrap.
 const a=ring.reduce((best,p)=>Math.abs(p[0]+23.5)+Math.abs(p[1]-10.7)<Math.abs(best[0]+23.5)+Math.abs(best[1]-10.7)?p:best,ring[0]);
 const end=[[-23.5,10.8],[-12.8,22.1]],dx=end[1][0]-end[0][0],dz=end[1][1]-end[0][1],l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l,angle=Math.atan2(-dz,dx);
 for(const y of [2.4,7.0])for(const t of [.73,.79]){const x=end[0][0]+t*dx+nx*.14,z=end[0][1]+t*dz+nz*.14;b.box(x,y,z,.50,.65,.08,'white',angle);b.box(x+nx*.08,y+.07,z+nz*.08,.37,.51,.07,'glass',angle);}
}
