import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './max-euwe-footprints.json';
import roofParts from './max-euwe-roof-parts.json';
import passages from './max-euwe-passages.json';
type P=[number,number];
export const paneProbes:any[]=[];
// Original architectural reconstruction; surveyed perimeter, not imported mesh faces.
export function buildMaxEuwe(b:BuildingTools){
 const ring=source.rings[0].slice(0,-1) as P[],angle=source.axisRotation;
 const world=(u:number,v:number):P=>[u*Math.cos(angle)+v*Math.sin(angle),-u*Math.sin(angle)+v*Math.cos(angle)];
 const shape=(r:P[])=>{const s=new T.Shape();r.forEach((p,i)=>i?s.lineTo(...world(...p)):s.moveTo(...world(...p)));s.closePath();return s;};
 const clip=(r:P[],axis:number,value:number,above:boolean):P[]=>{const out:P[]=[];for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],ia=above?a[axis]>=value:a[axis]<=value,ic=above?c[axis]>=value:c[axis]<=value;if(ia)out.push(a);if(ia!==ic){const t=(value-a[axis])/(c[axis]-a[axis]);out.push([a[0]+t*(c[0]-a[0]),a[1]+t*(c[1]-a[1])]);}}return out;};
 const box=(u:number,y:number,v:number,w:number,h:number,d:number,c:any)=>{const p=world(u,v);b.box(p[0],y,p[1],w,h,d,c,angle);};
 const rod=(a:number[],c:number[],radius=.07,colour:any='dark')=>{const aa=new T.Vector3(...a),cc=new T.Vector3(...c),delta=cc.clone().sub(aa),g=new T.CylinderGeometry(radius,radius,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const mid=aa.add(cc).multiplyScalar(.5);b.add(g,colour,mid.x,mid.y,mid.z);};
 const roofUp=(g:T.BufferGeometry)=>{const p=g.getAttribute('position');if(g.index)throw Error('Roofcanopy winding expects explicit triangles');for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),c=new T.Vector3().fromBufferAttribute(p,i+1),d=new T.Vector3().fromBufferAttribute(p,i+2);if(c.clone().sub(a).cross(d.clone().sub(a)).y< -1e-10){p.setXYZ(i+1,d.x,d.y,d.z);p.setXYZ(i+2,c.x,c.y,c.z);}}p.needsUpdate=true;};
 const inside=(u:number,v:number,r:P[])=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],c=r[j];if((a[1]>v)!==(c[1]>v)&&u<(c[0]-a[0])*(v-a[1])/(c[1]-a[1])+a[0])yes=!yes;}return yes;};
 const partHeight=(part:any,u:number,v:number)=>{const f=part.fit;return f.coefficients[0]*(u-f.center[0])+f.coefficients[1]*(v-f.center[1])+f.coefficients[2];};
 const sourceHeight=(u:number,v:number)=>{const matches=roofParts.filter(p=>inside(u,v,p.ringsUV[0] as P[]));return matches.length?Math.max(...matches.map(p=>partHeight(p,u,v))):11.7;};
 const corridorCuts:P[][]=[];
 for(const passage of passages)for(let i=0;i<passage.pathUV.length-1;i++){const a=passage.pathUV[i],c=passage.pathUV[i+1],du=c[0]-a[0],dv=c[1]-a[1],len=Math.hypot(du,dv),tu=du/len,tv=dv/len,nu=-tv,nv=tu,w=passage.widthMetres/2;corridorCuts.push([[a[0]-tu*2+nu*w,a[1]-tv*2+nv*w],[a[0]-tu*2-nu*w,a[1]-tv*2-nv*w],[c[0]+tu*2-nu*w,c[1]+tv*2-nv*w],[c[0]+tu*2+nu*w,c[1]+tv*2+nv*w]]);}
 // 2013front three bays feed one shared north-end entrance space. Its
 // internal depth is bounded/approximate; the public corridor axis is mapped.
 corridorCuts.push([[-8.4,-25.5],[5.5,-25.5],[5.5,-20.5],[-8.4,-20.5]]);
 const lineClip=(rr:P[],a:P,c:P,positive:boolean):P[]=>{const value=(p:P)=>(c[0]-a[0])*(p[1]-a[1])-(c[1]-a[1])*(p[0]-a[0]),out:P[]=[];for(let i=0;i<rr.length;i++){const p=rr[i],q=rr[(i+1)%rr.length],vp=value(p),vq=value(q),ip=positive?vp>=-1e-8:vp<=1e-8,iq=positive?vq>=-1e-8:vq<=1e-8;if(ip)out.push(p);if(ip!==iq){const t=vp/(vp-vq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}return out;};
 const subtract=(rr:P[],cut:P[]):P[][]=>{let remaining=rr;const out:P[][]=[];for(let i=0;i<cut.length&&remaining.length>=3;i++){const a=cut[i],c=cut[(i+1)%cut.length],outside=lineClip(remaining,a,c,false);if(outside.length>=3)out.push(outside);remaining=lineClip(remaining,a,c,true);}return out;};
 const area=(rr:P[])=>Math.abs(rr.reduce((a,p,i)=>{const q=rr[(i+1)%rr.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;
 const boundsOverlap=(a:P[],c:P[])=>[0,1].every(k=>Math.max(...a.map(p=>p[k]))>=Math.min(...c.map(p=>p[k]))&&Math.min(...a.map(p=>p[k]))<=Math.max(...c.map(p=>p[k])));
 // Original source-domain shells. Survey wall matches record actual supported
 // mass heights; low annexes remain ~4/6m, north arm has higher side eaves,
 // east terminal has its own 16m body, and small raised roof equipment stays local.
 for(const part of roofParts){
  const rr=part.ringsUV[0] as P[],base=Math.max(.1,Math.min(...rr.map(p=>partHeight(part,...p))));
  const relevant=corridorCuts.filter(c=>boundsOverlap(rr,c));if(!relevant.length)b.add(openTopPrism(shape(rr),0,base),'green');else{if(base>3.8)b.add(openTopPrism(shape(rr),3.8,base),'green');const tris=T.ShapeUtils.triangulateShape(rr.map(p=>new T.Vector2(...p)),[]);for(const tri of tris){let cells:P[][]=[tri.map(i=>rr[i])];for(const cut of relevant)cells=cells.flatMap(cell=>subtract(cell,cut));for(const cell of cells)if(area(cell)>.002)b.add(openTopPrism(shape(cell),0,Math.min(base,3.8)),'green');}}
  const g=upwardRoofPlane(shape(rr),0),pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,partHeight(part,x*Math.cos(angle)-z*Math.sin(angle),x*Math.sin(angle)+z*Math.cos(angle)));}
  // Remove tiny projected-area slivers before quantization, retaining larger
 // measured roof polygons. The compressed export is checked independently.
  const flat=g.index?g.toNonIndexed():g,pp=flat.getAttribute('position'),values:number[]=[];for(let i=0;i<pp.count;i+=3){const a=new T.Vector3().fromBufferAttribute(pp,i),c=new T.Vector3().fromBufferAttribute(pp,i+1),d=new T.Vector3().fromBufferAttribute(pp,i+2);const projected=Math.abs((c.x-a.x)*(d.z-a.z)-(d.x-a.x)*(c.z-a.z))/2;if(projected<.002)continue;for(let j=0;j<3;j++)values.push(pp.getX(i+j),pp.getY(i+j),pp.getZ(i+j));}const clean=new T.BufferGeometry();clean.setAttribute('position',new T.Float32BufferAttribute(values,3));clean.computeVertexNormals();b.add(clean,[351,363,364].includes(part.sourceRoofIndex)?'glass':'slate');
  // Roof-to-shell side surfaces close each original fitted part, including
  // source-supported height steps. Shared interfaces remain inside the mass.
  const skirt:number[]=[];for(let i=0;i<rr.length;i++){const a=rr[i],c=rr[(i+1)%rr.length],aa=world(...a),cc=world(...c);skirt.push(aa[0],base,aa[1],cc[0],base,cc[1],cc[0],partHeight(part,...c),cc[1],aa[0],base,aa[1],cc[0],partHeight(part,...c),cc[1],aa[0],partHeight(part,...a),aa[1]);}const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(skirt,3));sg.computeVertexNormals();b.add(sg,'slate');
 }
 // Actual higher north street facade, not the old west-end placeholder.
 for(const u of[-7.8,-3.65,.65,4.85])box(u,0,-23.5,.85,3.8,1.35,'green');
 for(const u of[-5.7,-1.5,2.8]){
  box(u,3.8,-24.05,3.15,6.15,.16,'dark');for(const x of[-1.05,0,1.05])box(u+x,3.8,-24.18,.07,6.15,.16,'frame');
  for(const y of[4.35,4.9,5.45,7.3])box(u,y,-24.18,3.15,.075,.16,'frame');
 }
 for(const u of[-7.8,-3.65,.65,4.85]){box(u,3.8,-23.95,.8,6.65,.5,'green');box(u,0,-24.02,1.05,.5,.6,'stone');}
 for(let u=-7.6;u<5.3;u+=.65){box(u,10.6,-24.12,.25,.35,.32,'stone');const p=world(u,-24.15);b.add(new T.CircleGeometry(.09,10),'dark',p[0],10.15,p[1],angle+Math.PI);}
 box(-1.45,10.85,-24.05,13.65,.25,.42,'ochre');box(-1.45,11.25,-24.02,13.4,2,.16,'glass');for(let u=-7.8;u<5.3;u+=1.1)box(u,11.25,-24.15,.08,2.1,.17,'frame');
 const segments:P[][]=[];for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length];if(Math.hypot(c[0]-a[0],c[1]-a[1])>3)segments.push([a,c]);}
 for(const [a,c] of segments){
  const du=c[0]-a[0],dv=c[1]-a[1],len=Math.hypot(du,dv),nu=-dv/len,nv=du/len;const count=Math.max(1,Math.floor(len/3.3));
  const p1=world(a[0],a[1]),p2=world(c[0],c[1]);const faceAngle=Math.atan2(-(p2[1]-p1[1]),p2[0]-p1[0]);
  for(let j=0;j<count;j++){const f=(j+.5)/count,u=a[0]+du*f,v=a[1]+dv*f;
   const roofAtFacade=sourceHeight(u-nu*.2,v-nv*.2);for(const y of [1.1,4.35,7.55]){if(y+1.9>roofAtFacade-.4)continue;if(v<-23)continue;if(y<3.8&&corridorCuts.some(cut=>inside(u-nu*.2,v-nv*.2,cut)||inside(u-nu*.2+du/len*.9,v-nv*.2+dv/len*.9,cut)||inside(u-nu*.2-du/len*.9,v-nv*.2-dv/len*.9,cut)))continue;if(u>2&&u<8&&v>2&&v<8)continue;const p=world(u+nu*.09,v+nv*.09);const arch=new T.Shape();arch.moveTo(-.65,0);arch.lineTo(.65,0);arch.lineTo(.65,1.65);arch.quadraticCurveTo(.65,1.9,0,1.9);arch.quadraticCurveTo(-.65,1.9,-.65,1.65);arch.closePath();b.add(new T.ExtrudeGeometry(arch,{depth:.06,bevelEnabled:false,curveSegments:5}),'dark',p[0],y,p[1],faceAngle);paneProbes.push({center:[p[0],y+.95,p[1]],normal:[...world(nu,nv)],tangent:[(p2[0]-p1[0])/len,(p2[1]-p1[1])/len],width:1.3,height:1.9,material:'dark'});b.box(p[0],y+.82,p[1],1.3,.075,.17,'frame',faceAngle);}
   if(roofAtFacade<11.4||v<-23)continue;const p=world(u+nu*.1,v+nv*.1);b.box(p[0],10.65,p[1],len/count-.16,1.15,.14,'glass',faceAngle);paneProbes.push({center:[p[0],11.225,p[1]],normal:[...world(nu,nv)],tangent:[(p2[0]-p1[0])/len,(p2[1]-p1[1])/len],width:len/count-.16,height:1.15,material:'glass'});
  }
  if([.03,.2,.5,.8,.97].some(f=>sourceHeight(a[0]+du*f-nu*.2,a[1]+dv*f-nv*.2)<11.4))continue;const p=world((a[0]+c[0])/2+nu*.08,(a[1]+c[1])/2+nv*.08);b.box(p[0],10.15,p[1],len,.25,.24,'ochre',faceAngle); // Surveyed roof edge owns its eave; omit unsupported generic slate overhang.
 }
 // Defining source courtyard clerestory sits RECESSED behind the low
 // frieze strips371/361, at their inward measured roof-edge boundaries.
 // Do not sample/raise the outer low strip to manufacture another floor.
 const cp=(p:P,y:number)=>{const q=world(...p);return[q[0],y,q[1]];};
 const strip371=roofParts.find(p=>p.sourceRoofIndex===371)!.ringsUV[0] as P[],strip361=roofParts.find(p=>p.sourceRoofIndex===361)!.ringsUV[0] as P[];
 for(const [a,c,nu,nv]of[[strip371[1],strip371[2],1,0],[strip361[8],strip361[7],0,1]] as [P,P,number,number][]){
  const du=c[0]-a[0],dv=c[1]-a[1],len=Math.hypot(du,dv),aa:P=[a[0]+nu*.075,a[1]+nv*.075],cc:P=[c[0]+nu*.075,c[1]+nv*.075],band=new T.BufferGeometry();
  band.setAttribute('position',new T.Float32BufferAttribute([...cp(aa,10.65),...cp(cc,10.65),...cp(cc,11.76),...cp(aa,10.65),...cp(cc,11.76),...cp(aa,11.76)],3));band.computeVertexNormals();b.add(band,'glass');
  const count=Math.ceil(len/1.6),normal=world(nu,nv),tangent=world(du/len,dv/len);
  for(let j=0;j<=count;j++){const f=j/count,q:P=[aa[0]+du*f,aa[1]+dv*f];rod(cp(q,10.62),cp(q,11.79),.045,'frame');}
  rod(cp(aa,10.62),cp(cc,10.62),.06,'frame');rod(cp(aa,11.79),cp(cc,11.79),.045,'frame');
  for(let j=0;j<count;j++){const f=(j+.5)/count,q=world(aa[0]+du*f,aa[1]+dv*f);paneProbes.push({center:[q[0],11.205,q[1]],normal,tangent,width:len/count-.16,height:1.0,material:'glass',sourceAssembly:'recessed principal courtyard clerestory,371/361 inner strip edge'});}
 }
 // The surveyed north side has sub-metre pilaster jogs, so individual short
 // edges cannot supply its coherent facade rhythm. Photo2013-9701 shows the
 // higher historic wing's four opening tiers; approximate six bay groups are
 // placed on the observed long side planes, not across each footprint tooth.
 for(const [u,normal,faceAngle]of[[5.48,1,angle+Math.PI/2],[-8.52,-1,angle-Math.PI/2]])for(const v of[-22,-19.2,-16.4,-13.6,-10.8,-8])for(const y of[1.1,4.35,7.55,10.75]){
  const p=world(u,v),arch=new T.Shape();arch.moveTo(-.6,0);arch.lineTo(.6,0);arch.lineTo(.6,1.65);arch.quadraticCurveTo(.6,1.9,0,1.9);arch.quadraticCurveTo(-.6,1.9,-.6,1.65);arch.closePath();b.add(new T.ExtrudeGeometry(arch,{depth:.06,bevelEnabled:false,curveSegments:5}),'dark',p[0],y,p[1],faceAngle);paneProbes.push({center:[p[0],y+.95,p[1]],normal:world(normal,0),tangent:world(0,1),width:1.2,height:1.9,material:'dark'});
 }
 // Source courtyard is POSITIVEu/POSITIVEv of the cross in these axes. Photo2025 verifies
 // repeated ground-storey shop doors and pointed glazing canopies on both arms.
 const canopy=(u:number,v:number,along:number)=>{
  const w=3.2,deep=2.1,face=(du:number,dv:number,y:number)=>{const p=world(u+du,v+dv);return[p[0],y,p[1]];};
  let pts:number[][];
  if(along===0)pts=[face(-w/2,0,3.4),face(w/2,0,3.4),face(0,deep,4.25),face(-w/2,deep,3.4),face(w/2,deep,3.4)];
  else pts=[face(0,-w/2,3.4),face(0,w/2,3.4),face(deep,0,4.25),face(deep,-w/2,3.4),face(deep,w/2,3.4)];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,3,2,0,2,1,1,2,4].flatMap(i=>pts[i]),3));roofUp(g);g.computeVertexNormals();b.add(g,'glass');const fascia=new T.BufferGeometry();fascia.setAttribute('position',new T.Float32BufferAttribute([3,4,2].flatMap(i=>pts[i]),3));fascia.computeVertexNormals();b.add(fascia,'white');rod(pts[3],pts[2],.055,'white');rod(pts[2],pts[4],.055,'white');const vent=world(u+(along===1?deep+.03:0),v+(along===0?deep+.03:0));b.add(new T.CircleGeometry(.13,12),'dark',vent[0],3.7,vent[1],angle+(along===1?Math.PI/2:0));
 };
 for(let u=12;u<34;u+=4){box(u,0,5.65,2.7,3,.17,'dark');canopy(u,5.7,0);}
 for(let v=12;v<39;v+=4){box(5.35,0,v,.17,3,2.7,'dark');canopy(5.4,v,1);}
 // Original full-width source portico, facing the actual observed court.
 const left:P=[5.6,12.3],right:P=[12.3,5.6],apex:P=[8.95,8.95];
 const wp=(p:P,y:number)=>{const w=world(...p);return[w[0],y,w[1]];};
 // Current2025PDOKaerial confirms glass central pyramid with pale radial frames.
 for(const part of roofParts.filter(p=>[351,363,364].includes(p.sourceRoofIndex))){const rr=part.ringsUV[0] as P[],apex=rr.reduce((a,p)=>partHeight(part,...p)>partHeight(part,...a)?p:a);let previous:P|undefined;for(const p of rr){if(previous&&Math.hypot(p[0]-previous[0],p[1]-previous[1])<1.8)continue;rod(wp(apex,partHeight(part,...apex)+.04),wp(p,partHeight(part,...p)+.04),.055,'white');previous=p;}for(let i=0;i<rr.length;i++){const a=rr[i],c=rr[(i+1)%rr.length];if(Math.hypot(c[0]-a[0],c[1]-a[1])>1.8)rod(wp(a,partHeight(part,...a)+.035),wp(c,partHeight(part,...c)+.035),.055,'white');}}
 for(const p of[left,right])rod(wp(p,0),wp(p,5.8),.23);
 const span=Math.hypot(right[0]-left[0],right[1]-left[1]),w1=world(...left),w2=world(...right),faceAngle=Math.atan2(-(w2[1]-w1[1]),w2[0]-w1[0]);
 const arch=new T.Shape();arch.moveTo(-span/2,3.8);arch.quadraticCurveTo(-span*.28,5.3,0,5.25);arch.quadraticCurveTo(span*.28,5.3,span/2,3.8);arch.lineTo(span/2,5.85);arch.lineTo(-span/2,5.85);arch.closePath();const archGeo=new T.ExtrudeGeometry(arch,{depth:.36,bevelEnabled:false,curveSegments:8});const center=world(...apex);b.add(archGeo,'dark',center[0],0,center[1],faceAngle);
 const ped=new T.BufferGeometry();ped.setAttribute('position',new T.Float32BufferAttribute([...wp(left,5.85),...wp(right,5.85),...wp(apex,8.2)],3));ped.computeVertexNormals();b.add(ped,'glass');
 for(const [a,c]of[[wp(left,5.85),wp(right,5.85)],[wp(left,5.85),wp(apex,8.2)],[wp(apex,8.2),wp(right,5.85)]])rod(a,c,.1);
 for(let f=.1;f<1;f+=.1){const p:P=[left[0]+(right[0]-left[0])*f,left[1]+(right[1]-left[1])*f];rod(wp(p,5.85),wp(p,5.85+2.35*(1-Math.abs(f*2-1))),.035);}
 const rear:P=[3.6,3.6],roofCorners=[wp(left,5.85),wp(right,5.85),wp(apex,8.2),wp([rear[0]-3.35,rear[1]+3.35],5.85),wp([rear[0]+3.35,rear[1]-3.35],5.85),wp(rear,8.2)],canopyGeo=new T.BufferGeometry();canopyGeo.setAttribute('position',new T.Float32BufferAttribute([0,3,5,0,5,2,1,2,5,1,5,4].flatMap(i=>roofCorners[i]),3));roofUp(canopyGeo);canopyGeo.computeVertexNormals();b.add(canopyGeo,'glass');
 // Source2013 principal entry has dark framing and recessed reveals below
 // the stair glazing. Follow the existing mapped corridor walls, keep its
 // complete clear width, and add no closing door across the public passage.
 const entryPath=passages.find(p=>p.osmId==='w162095711')!,entryA=entryPath.pathUV[1],entryB=entryPath.pathUV[0],edU=entryB[0]-entryA[0],edV=entryB[1]-entryA[1],edL=Math.hypot(edU,edV),et:P=[edU/edL,edV/edL],en:P=[-et[1],et[0]],half=entryPath.widthMetres/2;
 for(const side of[-1,1])for(let t=-4;t<-.1;t+=.5){const a:P=[entryB[0]+et[0]*t+en[0]*half*side,entryB[1]+et[1]*t+en[1]*half*side],c:P=[entryB[0]+et[0]*(t+.5)+en[0]*half*side,entryB[1]+et[1]*(t+.5)+en[1]*half*side],mid:P=[(a[0]+c[0])/2,(a[1]+c[1])/2];if(!inside(...mid,ring))continue;const front=.02;const aa:P=[a[0]-en[0]*side*front,a[1]-en[1]*side*front],cc:P=[c[0]-en[0]*side*front,c[1]-en[1]*side*front],reveal=new T.BufferGeometry();reveal.setAttribute('position',new T.Float32BufferAttribute([...wp(aa,0),...wp(cc,0),...wp(cc,3.12),...wp(aa,0),...wp(cc,3.12),...wp(aa,3.12)],3));reveal.computeVertexNormals();b.add(reveal,'dark');}
 // Dark photo-visible sidelights occupy the adjoining real courtyard walls
 // below the portico; the public opening between them remains unfilled.
 for(const [a,c]of[[[7.6,5.78],[10.8,5.78]],[[5.58,7.8],[5.58,10.8]]] as P[][]){const du=c[0]-a[0],dv=c[1]-a[1],len=Math.hypot(du,dv),aa=world(...a),cc=world(...c),panel=new T.BufferGeometry();if(corridorCuts.some(cut=>inside((a[0]+c[0])/2,(a[1]+c[1])/2,cut)))continue;panel.setAttribute('position',new T.Float32BufferAttribute([...wp(a,0),...wp(c,0),...wp(c,3.2),...wp(a,0),...wp(c,3.2),...wp(a,3.2)],3));panel.computeVertexNormals();b.add(panel,'dark');for(let f=0;f<=1;f+=.25){const q:P=[a[0]+du*f,a[1]+dv*f];rod(wp(q,0),wp(q,3.2),.045,'frame');}rod(wp(a,3.2),wp(c,3.2),.055,'frame');}
 const doorLeft:P=[entryB[0]+en[0]*half,entryB[1]+en[1]*half],doorRight:P=[entryB[0]-en[0]*half,entryB[1]-en[1]*half];rod(wp(doorLeft,0),wp(doorLeft,3.2),.055,'dark');rod(wp(doorRight,0),wp(doorRight,3.2),.055,'dark');rod(wp(doorLeft,3.2),wp(doorRight,3.2),.07,'dark');
 // The actual surveyed central chamfer, not a plane crossing the south-arm wall.
 const stairChain:P[]=[[5.24,7.55],[2.6,4.91],[4.59,2.92],[7.23,5.57]];
 for(let i=0;i<stairChain.length-1;i++){
  const a=stairChain[i],c=stairChain[i+1],du=c[0]-a[0],dv=c[1]-a[1],len=Math.hypot(du,dv),normal:P=[-dv/len,du/len];const aa:P=[a[0]+normal[0]*.18,a[1]+normal[1]*.18],bb:P=[c[0]+normal[0]*.18,c[1]+normal[1]*.18];
  // Photo-supported lower framed side glazing remains outside the mapped
  // public passage. Split exactly where that corridor intersects each facet.
  const fractions=[0,1];for(const cut of corridorCuts)for(let j=0;j<cut.length;j++){const p=cut[j],q=cut[(j+1)%cut.length],cu=q[0]-p[0],cv=q[1]-p[1],den=du*cv-dv*cu;if(Math.abs(den)<1e-9)continue;const t=((p[0]-aa[0])*cv-(p[1]-aa[1])*cu)/den,k=((p[0]-aa[0])*dv-(p[1]-aa[1])*du)/den;if(t>0&&t<1&&k>=0&&k<=1)fractions.push(t);}fractions.sort((a,c)=>a-c);
  for(let j=0;j<fractions.length-1;j++){const f=fractions[j],g=fractions[j+1],mid:P=[aa[0]+du*(f+g)/2,aa[1]+dv*(f+g)/2];if(g-f<.001||corridorCuts.some(cut=>inside(...mid,cut)))continue;const p:P=[aa[0]+du*f,aa[1]+dv*f],q:P=[aa[0]+du*g,aa[1]+dv*g],panel=new T.BufferGeometry();panel.setAttribute('position',new T.Float32BufferAttribute([...wp(p,0),...wp(q,0),...wp(q,3.2),...wp(p,0),...wp(q,3.2),...wp(p,3.2)],3));panel.computeVertexNormals();b.add(panel,'dark');rod(wp(p,0),wp(p,3.2),.045,'frame');rod(wp(q,0),wp(q,3.2),.045,'frame');rod(wp(p,3.2),wp(q,3.2),.045,'frame');}
  const stairs=new T.BufferGeometry();stairs.setAttribute('position',new T.Float32BufferAttribute([...wp(aa,3.2),...wp(bb,3.2),...wp(bb,13.3),...wp(aa,3.2),...wp(bb,13.3),...wp(aa,13.3)],3));stairs.computeVertexNormals();b.add(stairs,'glass');
  for(let f=0;f<=1;f+=.25){const p:P=[aa[0]+(bb[0]-aa[0])*f,aa[1]+(bb[1]-aa[1])*f];rod(wp(p,3.2),wp(p,13.3),.035,'frame');}
  for(const y of[3.2,5.3,7.8,10.2,13.3])rod(wp(aa,y),wp(bb,y),.035,'frame');
 }
}
