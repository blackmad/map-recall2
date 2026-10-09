import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './fire-station-willem-footprints.json';
import lettering from './fire-station-willem-lettering.json';
type C=Parameters<BuildingTools['add']>[1];
export function buildFireStationWillem(_w:number,_d:number,b:BuildingTools){
 const origin=source.nativeRing[111],a=.6256042816734996,c=Math.cos(a),s=Math.sin(a),world=(u:number,v:number)=>new T.Vector2(origin[0]+c*u+s*v,origin[1]-s*u+c*v);
 const box=(u:number,y:number,v:number,w:number,h:number,d:number,col:C,aa=0)=>{const p=world(u,v);b.box(p.x,y,p.y,w,h,d,col,a+aa)};
 const shape=(r:number[][])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[2])));
 function cleanRoof(g:T.BufferGeometry){const f=g.index?g.toNonIndexed():g,p=f.getAttribute('position'),values:number[]=[];for(let i=0;i<p.count;i+=3){const vs=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j)),cross=vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])),longest=Math.max(vs[0].distanceTo(vs[1]),vs[1].distanceTo(vs[2]),vs[2].distanceTo(vs[0]));if(cross.length()/longest<.025)continue;for(const v of vs)values.push(v.x,v.y,v.z)}const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(values,3));out.computeVertexNormals();out.userData.tag='roof';return out;}
 function cap(sh:T.Shape,h:number,col:C){b.add(cleanRoof(upwardRoofPlane(sh,h)),col)}
 // Survey principal roof outer ring follows the real inward court. Equipment holes
 // describe rooftop apparatus, not ground-level courtyards, and get a supported base.
 const main=source.surveyRoofParts.find(r=>r.index===563)!;const sh=shape(main.rings[0]);
 // The survey outline includes the projecting red lobby at ground level.
 // Current street photographs show the two office storeys continuing on the
 // main facade plane above it; do not extrude the lobby through the sign.
 const upperRing=main.rings[0].map(p=>{const u=c*(p[0]-origin[0])-s*(p[2]-origin[1]),v=s*(p[0]-origin[0])+c*(p[2]-origin[1]);if(u>51.6&&u<55.4&&v<-.5){const q=world(u,-.015);return[q.x,p[1],q.y];}return p;});
 const rooflightIds=new Set([492,493,495,505,508,509,515,517,518,521,522,523,530,533,534,537,544,545,546,551,552,559,561,562]);
 const upper=shape(upperRing);b.add(openTopPrism(sh,0,11.12),'brick');b.add(openTopPrism(upper,11.12,17.89),'brick');const top=shape(upperRing);for(const r of source.surveyRoofParts)if(rooflightIds.has(r.index))top.holes.push(new T.Path(r.rings[0].map(p=>new T.Vector2(p[0],p[2]))));cap(top,17.89,'slate');
 for(const r of source.surveyRoofParts){if(r.index===563||rooflightIds.has(r.index))continue;const ps=r.rings[0],h=ps.reduce((s,p)=>s+p[1],0)/ps.length;
  if([504,556].includes(r.index))continue; // Atrium slope fitted separately below.
  const ss=shape(ps);if(r.index===557){b.add(openTopPrism(ss,0,7.42),'brick');cap(ss,7.42,'glass');continue;}
  if(h<17.89)continue;b.add(openTopPrism(ss,17.89,h),'stone');cap(ss,h,'slate');
 }
 // The rear white grid is glazed rooflighting, not photovoltaic panels. Preserve
 // original surveyed sloping vertices rather than replacing each slope with an
 // opaque extrusion at its average height. White framing follows the 3D surface.
 function beam(p:T.Vector3,q:T.Vector3,width:number,col:C){const d=q.clone().sub(p),side=new T.Vector3(-d.z,0,d.x).normalize().multiplyScalar(width/2),vs=[p.clone().add(side),q.clone().add(side),q.clone().sub(side),p.clone().sub(side)],values:number[]=[];for(const ids of[[0,1,2],[0,2,3]]){let tri=ids.map(i=>vs[i]);if(tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).y<0)tri=[tri[0],tri[2],tri[1]];for(const v of tri)values.push(v.x,v.y,v.z);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.tag='roof-frame';b.add(g,col);}
 function glazedRoof(index:number){const part=source.surveyRoofParts.find(r=>r.index===index)!,ps=part.rings[0],ring=ps.map(p=>new T.Vector2(p[0],p[2])),tri=T.ShapeUtils.triangulateShape(ring,[]),values:number[]=[];
  for(const t of tri){let vs=t.map(i=>new T.Vector3(ps[i][0],ps[i][1]+.035,ps[i][2]));if(vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).y<0)vs=[vs[0],vs[2],vs[1]];for(const v of vs)values.push(v.x,v.y,v.z);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();const cleaned=cleanRoof(g);cleaned.userData={tag:'roof',rooflight:index};b.add(cleaned,'glass');
  for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length],P=new T.Vector3(p[0],p[1]+.09,p[2]),Q=new T.Vector3(q[0],q[1]+.09,q[2]);if(P.distanceTo(Q)>.65)beam(P,Q,.08,'white');}
  // Repeated cross-bars on the actual triangle planes, clipped to their polygons.
  // A vertical first-hit intersection finds the precise supported height.
  const mesh=new T.Mesh(cleaned,new T.MeshBasicMaterial({side:T.DoubleSide})),ray=new T.Raycaster();mesh.updateMatrixWorld();const sample=(x:number,z:number)=>{ray.set(new T.Vector3(x,30,z),new T.Vector3(0,-1,0));return ray.intersectObject(mesh)[0]?.point;};
  const ang=.303,cc=Math.cos(ang),ss=Math.sin(ang),uv=ps.map(p=>[cc*p[0]-ss*p[2],ss*p[0]+cc*p[2]]),umin=Math.min(...uv.map(p=>p[0])),umax=Math.max(...uv.map(p=>p[0])),vmin=Math.min(...uv.map(p=>p[1])),vmax=Math.max(...uv.map(p=>p[1]));
  for(let u=Math.ceil(umin/.9)*.9;u<umax;u+=.9){let first:T.Vector3|undefined,last:T.Vector3|undefined;const flush=()=>{if(first&&last&&first.distanceTo(last)>.4)beam(first,last,.055,'white');first=last=undefined;};for(let v=vmin+.08;v<vmax;v+=.18){const hit=sample(cc*u+ss*v,-ss*u+cc*v);if(hit){hit.y+=.055;first??=hit;last=hit;}else flush();}flush();}
  for(let v=Math.ceil(vmin/1.15)*1.15;v<vmax;v+=1.15){let first:T.Vector3|undefined,last:T.Vector3|undefined;const flush=()=>{if(first&&last&&first.distanceTo(last)>.4)beam(first,last,.055,'white');first=last=undefined;};for(let u=umin+.08;u<umax;u+=.18){const hit=sample(cc*u+ss*v,-ss*u+cc*v);if(hit){hit.y+=.058;first??=hit;last=hit;}else flush();}flush();}
 }
 for(const index of rooflightIds)glazedRoof(index);
 // Real low atrium at the notch; tilted glazed roof, no whole-building high slab.
 for(const index of[504,556]){const r=source.surveyRoofParts.find(q=>q.index===index)!,ps=r.rings[0],rr=ps.map(p=>new T.Vector2(p[0],p[2])),tri=T.ShapeUtils.triangulateShape(rr,[]),values:number[]=[];for(const t of tri){let vs=t.map(i=>new T.Vector3(...ps[i] as [number,number,number]));if(vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).y<0)vs=[vs[0],vs[2],vs[1]];for(const v of vs)values.push(v.x,v.y,v.z)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();b.add(cleanRoof(g),'glass');}
 function pane(u:number,y:number,v:number,w:number,h:number,aa=Math.PI,div=3,rows=1){const na=a+aa,nx=Math.sin(aa),nz=Math.cos(aa),f=(dx:number,yy:number,off:number,ww:number,hh:number,dd:number,col:C)=>box(u+Math.cos(aa)*dx+nx*off,yy,v-Math.sin(aa)*dx+nz*off,ww,hh,dd,col,aa);f(0,y-.06,.04,w+.12,h+.12,.08,'frame');const p=world(u+nx*.13,v+nz*.13);const g=new T.PlaneGeometry(w,h);g.rotateY(na);g.translate(p.x,y+h/2,p.y);g.userData={tag:'pane',sample:{x:p.x,y,z:p.y,w,h,a:na}};b.add(g,'glass');for(let i=0;i<=div;i++)f(-w/2+i*w/div,y,.21,.055,h,.075,'frame');for(let i=0;i<=rows;i++)f(0,y+i*h/rows,.21,w,.055,.075,'frame');}
 // Seven observed garage bays: native survey frontage contains the seven 3.6m
 // setbacks and 0.6m pale piers. Charred timber is above, not across the glazing.
 for(let i=0;i<7;i++){const u=24.12+i*4.195;box(u,.05,.35,3.59,.65,.12,'dark');pane(u,.72,.35,3.49,3.85,Math.PI,3,5);box(u,4.65,.24,3.6,4.7,.16,'dark');for(let x=-1.74;x<1.8;x+=.17)box(u+x,4.65,.12,.07,4.7,.05,'greyBrick');pane(u,9.38,.28,3.5,1.65,Math.PI,4,1);box(u,6.38,-.1,.35,.23,.25,'stone');box(u,6.32,-.3,.46,.32,.18,'white');}
 // Three office rows, tallest at the middle; uppermost horizontal lights.
 for(let i=0;i<15;i++){const u=2.6+i*4.18;const ww=u>52?2.75:3.5;if(u<51.5)pane(u,12.25,-.035,ww,2.22,Math.PI,ww<3?2:3);pane(u,15.82,-.035,ww,1.14,Math.PI,ww<3?2:3);}
 // West end has two large 2-storey glazed curtain-wall assemblies and a
 // narrow tall glazed slit; present pavement entrances sit below those panels.
 pane(3.5,4.8,-.03,5.05,5.6,Math.PI,3,5);pane(13.2,4.8,-.03,5.35,5.6,Math.PI,3,5);pane(19.0,4.8,-.03,2.6,5.6,Math.PI,2,5);pane(3.5,.25,-.03,5.05,2.9,Math.PI,3,2);pane(13.2,.25,-.03,5.3,2.9,Math.PI,3,2);pane(19.0,.25,-.03,2.6,2.9,Math.PI,2,2);
 // East lobby red recessed bay with source-supported real operator sign above.
 box(53.5,0,-1.32,3.59,11.12,.10,'red');pane(53.5,.15,-1.4,3.3,4.4,Math.PI,2,3);pane(53.5,5.9,-1.4,3.3,2.8,Math.PI,2,2);pane(59.7,1.25,-.045,2,2.6,Math.PI,1);pane(59.7,6.1,-.045,2,2.05,Math.PI,1);
 const path=new T.ShapePath();for(const cmd of lettering.commands as any[]){if(cmd.type==='M')path.moveTo(cmd.x,-cmd.y);else if(cmd.type==='L')path.lineTo(cmd.x,-cmd.y);else if(cmd.type==='Q')path.quadraticCurveTo(cmd.x1,-cmd.y1,cmd.x,-cmd.y);else if(cmd.type==='C')path.bezierCurveTo(cmd.x1,-cmd.y1,cmd.x2,-cmd.y2,cmd.x,-cmd.y);else if(cmd.type==='Z')path.currentPath?.closePath();}const text=new T.ExtrudeGeometry(path.toShapes(),{depth:.03,bevelEnabled:false,curveSegments:3});text.computeBoundingBox();const bb=text.boundingBox!,size=bb.getSize(new T.Vector3());text.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);text.scale(7.6/size.x,.72/size.y,1);text.rotateY(a+Math.PI);const sp=world(56.3,-.22);text.translate(sp.x,13.28,sp.y);b.add(text,'red');
 // Rear HQ has a repetitive concrete frame, seen in the 2024 orthophoto.
 // Follow surveyed perimeter; keep the inward courtyard unfilled.
 const rr=main.rings[0],area=rr.reduce((sum,p,i)=>{const q=rr[(i+1)%rr.length];return sum+p[0]*q[2]-q[0]*p[2]},0);for(let i=0;i<rr.length;i++){const p=rr[i],q=rr[(i+1)%rr.length],dx=q[0]-p[0],dz=q[2]-p[2],len=Math.hypot(dx,dz);if(len<6)continue;const midU=c*((p[0]+q[0])/2-origin[0])-s*((p[2]+q[2])/2-origin[1]),midV=s*((p[0]+q[0])/2-origin[0])+c*((p[2]+q[2])/2-origin[1]);if(Math.abs(midV)<2&&midU>=0&&midU<=65)continue;let nx=-dz/len,nz=dx/len;if(area>0){nx=-nx;nz=-nz;}const aa=Math.atan2(nx,nz)-a,count=Math.floor(len/4.0);for(let j=0;j<count;j++){const xx=p[0]+dx*(j+.5)/count+nx*.08,zz=p[2]+dz*(j+.5)/count+nz*.08,uu=c*(xx-origin[0])-s*(zz-origin[1]),vv=s*(xx-origin[0])+c*(zz-origin[1]);for(const y of[1.2,5.2,9.2,13.2])pane(uu,y,vv,Math.min(3,len/count-.55),2.55,aa,2);}}
 // Contractor Sampre photos identify PV only on the long front station wing,
 // around its roof plant/court. The rear sawtooth rooflight grid is never PV.
 const insideRing=(x:number,z:number,rr:number[][])=>{let hit=false;for(let i=0,j=rr.length-1;i<rr.length;j=i++){const p=rr[i],q=rr[j];if((p[2]>z)!==(q[2]>z)&&x<(q[0]-p[0])*(z-p[2])/(q[2]-p[2])+p[0])hit=!hit;}return hit;};
 const obstacles=source.surveyRoofParts.filter(r=>r.index!==563&&Math.max(...r.rings[0].map(p=>p[1]))>17.9);
 let panelCount=0;for(const [u0,v0,cols,rows]of [[2,2,14,3],[2,8,11,3],[2,14,9,2],[42,2,7,3],[55,2,5,2],[55,17,5,2]] as number[][]){for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){if(panelCount>=125)continue;const u=u0+i*1.5,v=v0+j*1.9,corners=[[-.64,-.85],[.64,-.85],[.64,.85],[-.64,.85]].map(([du,dv])=>world(u+du,v+dv));if(!corners.every(p=>insideRing(p.x,p.y,upperRing)))continue;const ctr=world(u,v);if(obstacles.some(r=>corners.some(p=>insideRing(p.x,p.y,r.rings[0]))||insideRing(ctr.x,ctr.y,r.rings[0])||r.rings[0].some(p=>{const uu=c*(p[0]-origin[0])-s*(p[2]-origin[1]),vv=s*(p[0]-origin[0])+c*(p[2]-origin[1]);return Math.abs(uu-u)<.7&&Math.abs(vv-v)<.9;})))continue;const g=new T.BoxGeometry(1.28,.08,1.7);g.rotateY(a);g.translate(ctr.x,18.03,ctr.y);g.userData={tag:'solar',sample:{x:ctr.x,y:18.07,z:ctr.y,corners:corners.map(p=>[p.x,p.y])}};b.add(g,'blue');panelCount++;}}
}
