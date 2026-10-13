import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import s from './allard-pierson-survey.json';
import architectural from './allard-pierson-architectural-parts.json';
import signOutline from './allard-pierson-sign-outline.json';
type C=Parameters<BuildingTools['add']>[1];
export const entrance141Probes:{point:number[];normal:number[];name:string;expectedRole:string;expectedColour:string}[]=[];
export const apertureProbes:{point:number[];normal:number[];name:string}[]=[];
/** Original native architectural assemblies against the current combined BAG parent. */
export function buildAllardPierson(_w:number,_d:number,b:BuildingTools){
 const plinthMasks=new Map<any,number[][]>();
 const {add,box}=b;apertureProbes.length=0;entrance141Probes.length=0;
 const shape=(rings:number[][][])=>{const sh=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));sh.holes=rings.slice(1).map(r=>new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return sh;};
 const role=(g:T.BufferGeometry,r:string)=>{g.userData.role=r;return g;};
 function detail(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0,r='detail'){add(role(g,r),c,x,y,z,a);}
 function wallColour(x:number,z:number):C{const p=uv([x,z]);if(p[0]>-6&&p[0]<28.8&&p[1]<-28.6&&p[1]>-74.5)return 'brick';return z<-31?'stone':z<-8?'brick':z<29?'red':'brick'}
 function mesh(v:number[],c:C,r:string){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(role(g,r),c)}
 // Derive each measured roof plane with a centered least-squares solve using ALL
 // vertices. Native plan cells create independent original open-top wall shells.
 // No imported triangles, textures, fitted whole-parent crests or wall caps.
 const uv=(p:number[])=>[(p[0]-architectural.axisOrigin[0])*architectural.tangent[0]+(p[1]-architectural.axisOrigin[1])*architectural.tangent[1],(p[0]-architectural.axisOrigin[0])*architectural.outwardNormal[0]+(p[1]-architectural.axisOrigin[1])*architectural.outwardNormal[1]];
 const native=(p:number[])=>[architectural.axisOrigin[0]+p[0]*architectural.tangent[0]+p[1]*architectural.outwardNormal[0],architectural.axisOrigin[1]+p[0]*architectural.tangent[1]+p[1]*architectural.outwardNormal[1]];
 function cleanRoof(g:T.BufferGeometry){const p=g.getAttribute('position'),ix=g.index!,out:number[]=[];for(let k=0;k<ix.count;k+=3){const a=new T.Vector3().fromBufferAttribute(p,ix.getX(k)),q=new T.Vector3().fromBufferAttribute(p,ix.getX(k+1)),r=new T.Vector3().fromBufferAttribute(p,ix.getX(k+2)),normal=q.clone().sub(a).cross(r.clone().sub(a));if(Math.abs(normal.y)<.0001)continue;if(normal.y<0)out.push(ix.getX(k),ix.getX(k+2),ix.getX(k+1));else out.push(ix.getX(k),ix.getX(k+1),ix.getX(k+2));}g.setIndex(out);g.computeVertexNormals();}
 function originalBody(rings:number[][][],bottom:number,top:number,col:C){
  const poly=rings[0].map(uv),lo=architectural.corridor.streetU-.92,hi=architectural.corridor.streetU+.92,cut=clip(clip(clip(clip(poly,lo,false,0),hi,true,0),-15.1,false,1),architectural.corridor.frontDepth,true,1);
  if(bottom>=2.65||cut.length<3){add(role(exposedShell(shape(rings),top,bottom),'masonry'),col);return}
  const mid=clip(clip(poly,lo,false,0),hi,true,0),pieces=[clip(poly,lo,true,0),clip(poly,hi,false,0),clip(mid,-15.1,true,1),clip(mid,architectural.corridor.frontDepth,false,1)];
  for(const p of pieces)if(p.length>=3)add(role(exposedShell(shape([p.map(native)]),Math.min(top,2.65),bottom),'portal-masonry'),col);
  if(top>2.65)add(role(exposedShell(shape(rings),top,2.65),'masonry'),col);
 }
 function profile(part:any,u:number,v:number){
  if(part.roof==='flat')return part.eave;
  if(part.roof==='connector-rise')return v<-23.5?11.8+(v+29.4)/5.9*5.2:17+(v+23.5)/9*.8;
  if(part.roof==='cut-angled-wing')return v<-26?9.2+(v+29.4)/3.4*3.3:v<-21.5?12.5+(v+26)/4.5*3.5:16;
  if(part.roof==='bernard-front-pitch-flat-rear')return v<-7.5?17: v<-3.5?17+(v+7.5)/4*3:Math.max(part.eave,20-(v+3.5)/4*(20-part.eave));
  const x=part.roof==='pitch-v'?v:u;
  return Math.max(part.eave,part.eave+(part.ridge-part.eave)*(x<part.ridgeAt?(x-part.rearAt)/(part.ridgeAt-part.rearAt):(part.frontAt-x)/(part.frontAt-part.ridgeAt)));
 }
 for(const part of architectural.parts)for(const polygon of part.polygons){
  if(!part.hollow)originalBody(polygon,0,part.eave,part.colour as C);
  const cuts=part.roof==='connector-rise'?[-100,-29.4,-23.5,-14.5,100]:part.roof==='cut-angled-wing'?[-100,-29.4,-26,-21.5,100]:part.roof==='bernard-front-pitch-flat-rear'?[-100,-7.5,-3.5,.5,100]:part.roof==='pitch-v'?[-100,part.rearAt,part.ridgeAt,part.frontAt,100]:part.roof==='pitch-u'?[-100,part.rearAt,part.ridgeAt,part.frontAt,100]:[-100,100],axis=part.roof==='pitch-u'?0:1;
  for(let k=0;k<cuts.length-1;k++){
   const rings=polygon.map(r=>clip(clip(r.map(uv),cuts[k],false,axis),cuts[k+1],true,axis)).filter(r=>r.length>=3).map(r=>r.map(native));if(!rings.length)continue;
   const g=upwardRoofPlane(shape(rings)),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const q=uv([p.getX(i),p.getZ(i)]);p.setY(i,profile(part,q[0],q[1]))}g.computeVertexNormals();cleanRoof(g);add(role(g,part.hollow?'court-roof':'roof'),part.hollow?'glass':'slate');
  }
  if(!part.hollow){const v:number[]=[];for(const ring of polygon)for(let i=0;i<ring.length;i++){const A=ring[i],Q=ring[(i+1)%ring.length],AU=uv(A),QU=uv(Q),fractions=[0,1];for(const cut of cuts){const t=(cut-AU[axis])/(QU[axis]-AU[axis]);if(t>1e-8&&t<1-1e-8)fractions.push(t)}fractions.sort((a,b)=>a-b);for(let j=0;j<fractions.length-1;j++){const a=A.map((x,k)=>x+(Q[k]-x)*fractions[j]),q=A.map((x,k)=>x+(Q[k]-x)*fractions[j+1]),aa=uv(a),qq=uv(q),ha=profile(part,aa[0],aa[1]),hq=profile(part,qq[0],qq[1]);if(Math.max(ha,hq)<part.eave+.01)continue;v.push(a[0],part.eave,a[1],q[0],hq,q[1],q[0],part.eave,q[1],a[0],part.eave,a[1],a[0],ha,a[1],q[0],hq,q[1]);}}if(v.length)mesh(v,part.colour as C,'roof-support');}
 }
 // Flat-color glazing and thin roof framing model the sourced covered atrium;
 // the ground remains empty and connects to the historic entry at depth14.5m.
 for(const part of architectural.parts.filter(p=>p.hollow)){
  const [u0,u1,v0,v1]=part.rect,h=part.eave;
  if(part.roof==='connector-rise'){for(let v=v0;v<v1;v+=1.2){const pt=native([(u0+u1)/2,v]);box(pt[0],profile(part,(u0+u1)/2,v)-.08,pt[1],u1-u0,.08,.055,'frame',Math.atan2(architectural.outwardNormal[0],architectural.outwardNormal[1]));}continue;}
  for(let u=u0+.35;u<u1;u+=1.3){const p=native([u,(v0+v1)/2]);box(p[0],h-.08,p[1],.055,.08,v1-v0,'frame',Math.atan2(architectural.outwardNormal[0],architectural.outwardNormal[1]));}
  for(const v of [v0,v1]){const p=native([(u0+u1)/2,v]);box(p[0],h-.09,p[1],u1-u0,.09,.07,'frame',Math.atan2(architectural.outwardNormal[0],architectural.outwardNormal[1]));}
 }
 const portalFrame=line(architectural.gatewayStart,s.footprint[0][141]),portalBase=portalFrame.p(portalFrame.L*.5),portalNormal=portalFrame.normal,portalTangent=[Math.cos(portalFrame.angle),-Math.sin(portalFrame.angle)];
 for(const fragment of architectural.remainingMeasuredCells){
  const sourceCell=s.roofs.find(c=>c.index===fragment.sourceIndex)!;
  const cell={...sourceCell,rings:fragment.rings};
  if(cell.index===811)continue; // Invalid AHN plane dips below pavement; source failure retained.
  const points=sourceCell.rings.flat(),cx=points.reduce((a,p)=>a+p[0],0)/points.length,cz=points.reduce((a,p)=>a+p[1],0)/points.length,cy=points.reduce((a,p)=>a+p[2],0)/points.length;
  let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of points){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y}
  const det=xx*zz-xz*xz;if(Math.abs(det)<1e-10)continue;
  const aa=(xy*zz-zy*xz)/det,bb=(zy*xx-xy*xz)/det,height=(x:number,z:number)=>cy+aa*(x-cx)+bb*(z-cz),bottom=Math.max(.15,Math.min(...points.map(p=>height(p[0],p[1]))));
  const wallRings=cell.rings.map(r=>r.map(p=>{const q=clampToParent(p[0],p[1]);return [q[0],q[1],p[2]]}));
  const sh=shape(cell.rings),wallShape=shape(wallRings),col=wallColour(cx,cz);
  // The documented covered crosswise court is hollow beneath its roof.
  // Current AHN flat low roof cells lie between the front/back house rows.
  const lightcourt=bottom<6.5 && cz>-24 && cz<8 && cx>-28 && cx<4;
  if(!lightcourt){
   const local=(p:number[])=>[(p[0]-portalBase[0])*portalTangent[0]+(p[1]-portalBase[1])*portalTangent[1],(p[0]-portalBase[0])*portalNormal[0]+(p[1]-portalBase[1])*portalNormal[2]];
   const native=(p:number[])=>[portalBase[0]+p[0]*portalTangent[0]+p[1]*portalNormal[0],portalBase[1]+p[0]*portalTangent[1]+p[1]*portalNormal[2]];
   const poly=wallRings[0].map(local),cut=clip(clip(clip(clip(poly,-.92,false,0),.92,true,0),-15.1,false,1),.75,true,1);
   if(cut.length<3)add(role(exposedShell(wallShape,Math.max(.2,bottom)),'masonry'),col);
   else{
    const parts=[clip(poly,-.92,true,0),clip(poly,.92,false,0)],mid=clip(clip(poly,-.92,false,0),.92,true,0);parts.push(clip(mid,-15.1,true,1),clip(mid,.75,false,1));
    for(const r of parts){if(r.length<3)continue;add(role(exposedShell(shape([r.map(native)]),Math.min(2.65,Math.max(.2,bottom))),'portal-masonry'),col)}
    if(bottom>2.65)add(role(exposedShell(wallShape,bottom,2.65),'masonry'),col);
   }
  }
  else{
   // Transparent curtain edges; interior ground remains empty.
   for(const r of cell.rings)for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],L=Math.hypot(q[0]-a[0],q[1]-a[1]);if(L<.2)continue;const ang=-Math.atan2(q[1]-a[1],q[0]-a[0]);detail(new T.PlaneGeometry(L,bottom-.2),'glass',(a[0]+q[0])/2,bottom/2,(a[1]+q[1])/2,ang,'lightcourt-glazing');}
  }
  const roof=upwardRoofPlane(sh),pos=roof.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i)));roof.computeVertexNormals();const ix=roof.index!;const clean:number[]=[];for(let k=0;k<ix.count;k+=3){const a=new T.Vector3().fromBufferAttribute(pos,ix.getX(k)),q=new T.Vector3().fromBufferAttribute(pos,ix.getX(k+1)),e=new T.Vector3().fromBufferAttribute(pos,ix.getX(k+2)),area=q.clone().sub(a).cross(e.clone().sub(a));if(Math.abs(area.y)<.00001)continue;if(area.y<0)clean.push(ix.getX(k),ix.getX(k+2),ix.getX(k+1));else clean.push(ix.getX(k),ix.getX(k+1),ix.getX(k+2));}roof.setIndex(clean);roof.computeVertexNormals();add(role(roof,'roof'),lightcourt?'glass':'slate');
  const skirts:number[]=[];for(const r of wallRings)for(let i=0;i<r.length;i++){
   const a=r[i],q=r[(i+1)%r.length],ha=Math.max(bottom,height(a[0],a[1])),hq=Math.max(bottom,height(q[0],q[1]));
   if(Math.max(ha,hq)-bottom<.01)continue;
   // Original vertical support below each sloping edge, explicit roofs own top.
   skirts.push(a[0],bottom,a[1],q[0],hq,q[1],q[0],bottom,q[1],a[0],bottom,a[1],a[0],ha,a[1],q[0],hq,q[1]);
  }if(skirts.length)mesh(skirts,col,'roof-support');
 }
 function clip(r:number[][],v:number,lower:boolean,axis:number){const out:number[][]=[];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],ai=lower?a[axis]<=v:a[axis]>=v,qi=lower?q[axis]<=v:q[axis]>=v;if(ai)out.push(a);if(ai!==qi){const t=(v-a[axis])/(q[axis]-a[axis]);out.push([a[0]+t*(q[0]-a[0]),a[1]+t*(q[1]-a[1])]);}}return out;}
 function exposedShell(sh:T.Shape,h:number,bottom=0){const g=openTopPrism(sh,bottom,h),p=g.getAttribute('position'),n=g.getAttribute('normal'),v:number[]=[];for(let i=0;i<p.count;i+=3){if([0,1,2].every(k=>n.getY(i+k)<-.9))continue;for(let k=0;k<3;k++)v.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));}const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(v,3));out.computeVertexNormals();g.dispose();return out;}
 function line(a:number[],q:number[]){const dx=q[0]-a[0],dz=q[1]-a[1],L=Math.hypot(dx,dz),tx=dx/L,tz=dz/L,nx=-tz,nz=tx,angle=Math.atan2(nx,nz);return{L,angle,p:(u:number,off=0)=>{const q=nearestOuter(a[0]+tx*u,a[1]+tz*u);return [q[0]+nx*off,q[1]+nz*off]},normal:[nx,0,nz]};}
 function strip(f:ReturnType<typeof line>,u:number,y:number,w:number,h:number,col:C,depth=.16,off=.14){
  let ranges=[[u-w/2,u+w/2]];
  // Observed masonry bands surround apertures instead of painting across panes.
  if(w>5&&f===houses&&y<1.45&&y+h>.5){for(let k=0;k<9;k++){const centre=f.L*(k+.5)/9-(k===3?.60:0)-(k===7?.45:0);for(const du of [-.33,.33]){const lo=centre+du-.23,hi=centre+du+.23;ranges=ranges.flatMap(([a,q])=>q<=lo||a>=hi?[[a,q]]:[[a,Math.min(q,lo)],[Math.max(a,hi),q]].filter(r=>r[1]>r[0]+.01));}}}
  if(w>5&&f===bernard){const cut:number[][]=[];for(let k=0;k<12;k++){const centre=f.L*(k+.5)/12;if(y<5.85&&y+h>2.1)cut.push([centre-(k===6?.98:.79),centre+(k===6?.98:.79)]);if(y<10.55&&y+h>7.35)cut.push([centre-.83,centre+.83]);if(y<14.65&&y+h>11.65)for(const du of [-.35,.35])cut.push([centre+du-.35,centre+du+.35]);}for(const [lo,hi]of cut)ranges=ranges.flatMap(([a,q])=>q<=lo||a>=hi?[[a,q]]:[[a,Math.min(q,lo)],[Math.max(a,hi),q]].filter(r=>r[1]>r[0]+.01));}
  if(w>5&&col==='white'&&f!==houses&&f!==bernard&&y<13.5&&Math.abs(f.L-6.68)<.45){for(let k=0;k<3;k++){const centre=f.L*(k+.5)/3;if([1.1,4.8,8.5,12.1].some(v=>y<v+2.5&&y+h>v)){const lo=centre-.68,hi=centre+.68;ranges=ranges.flatMap(([a,q])=>q<=lo||a>=hi?[[a,q]]:[[a,Math.min(q,lo)],[Math.max(a,hi),q]].filter(r=>r[1]>r[0]+.01));}}}
  for(const [lo,hi,bottom,top]of plinthMasks.get(f)??[]){if(y<top&&y+h>bottom)ranges=ranges.flatMap(([a,q])=>q<=lo||a>=hi?[[a,q]]:[[a,Math.min(q,lo)],[Math.max(a,hi),q]].filter(r=>r[1]>r[0]+.01));}
  for(const [a,q] of ranges){if(w<=5){const p=f.p((a+q)/2,off);if(depth<=.065&&off>=.275&&off<=.285){const g=new T.BoxGeometry(q-a,h,depth).toNonIndexed(),pos=g.getAttribute('position'),normal=g.getAttribute('normal'),v:number[]=[];for(let k=0;k<pos.count;k+=3){if([0,1,2].every(j=>normal.getZ(k+j)<-.9))continue;for(let j=0;j<3;j++)v.push(pos.getX(k+j),pos.getY(k+j),pos.getZ(k+j));}const clean=new T.BufferGeometry();clean.setAttribute('position',new T.Float32BufferAttribute(v,3));clean.computeVertexNormals();detail(clean,col,p[0],y+h/2,p[1],f.angle,'detail');g.dispose();}else box(p[0],y,p[1],q-a,h,depth,col,f.angle);continue}
   const count=Math.ceil((q-a)/(h<=.22&&y<15?3:1)),stations:number[]=[],v:number[]=[];for(let k=0;k<=count;k++){stations.push(a+(q-a)*k/count);while(stations.length>2){const A=f.p(stations.at(-3)!,0),B=f.p(stations.at(-2)!,0),C=f.p(stations.at(-1)!,0),L=Math.hypot(C[0]-A[0],C[1]-A[1]),cross=Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]));if(L>1e-7&&cross/L<1e-6)stations.splice(stations.length-2,1);else break;}}function quad(p:number[],q:number[],r:number[],s:number[]){v.push(...p,...q,...r,...p,...r,...s)}
   for(let k=0;k<stations.length-1;k++){const lo=stations[k],hi=stations[k+1],A=f.p(lo,off+depth/2),B=f.p(hi,off+depth/2),C=f.p(hi,-.015),D=f.p(lo,-.015);quad([A[0],y,A[1]],[B[0],y,B[1]],[B[0],y+h,B[1]],[A[0],y+h,A[1]]);if(h<=.22&&y<15)continue;quad([A[0],y+h,A[1]],[B[0],y+h,B[1]],[C[0],y+h,C[1]],[D[0],y+h,D[1]]);quad([D[0],y,D[1]],[C[0],y,C[1]],[B[0],y,B[1]],[A[0],y,A[1]]);if(k===0)quad([D[0],y,D[1]],[A[0],y,A[1]],[A[0],y+h,A[1]],[D[0],y+h,D[1]]);if(k===stations.length-2)quad([B[0],y,B[1]],[C[0],y,C[1]],[C[0],y+h,C[1]],[B[0],y+h,B[1]]);}
   mesh(v,col,y>16.5&&f===houses?'merchant-cornice':y>15&&f===bernard?'bernard-cornice':'detail');
  }
 }
 function pane(f:ReturnType<typeof line>,u:number,y:number,w:number,h:number,name:string,division='sash',frame:C='white'){
  const p=f.p(u,.24);detail(new T.PlaneGeometry(w+.18,h+.18),frame,p[0],y+h/2,p[1],f.angle,'surround');
  const q=f.p(u,.255);detail(new T.PlaneGeometry(w,h),'glass',q[0],y+h/2,q[1],f.angle,'glazing');
  if(['sash','grid','four','six'].includes(division)){
   if(division!=='six')strip(f,u,y+h*.5,w,.045,'white',.055,.28);if(division==='four')strip(f,u,y,.04,h,'white',.05,.28);if(division==='six'){strip(f,u,y,.04,h,'white',.05,.28);strip(f,u,y+h/3,w,.035,'white',.05,.28);strip(f,u,y+h*2/3,w,.035,'white',.05,.28);}if(division==='grid'){strip(f,u,y,.04,h,'white',.05,.28);strip(f,u,y+h*.25,w,.035,'white',.05,.28);strip(f,u,y+h*.75,w,.035,'white',.05,.28);}
  }
  strip(f,u,y-.1,w+.27,.12,frame,.25,.22);
  for(const v of [-.28,.28])for(const yy of [.32,.66]){const p=[q[0]+Math.cos(f.angle)*v*w,q[1]-Math.sin(f.angle)*v*w];apertureProbes.push({point:[p[0],y+yy*h,p[1]],normal:f.normal,name})}
 }
 function pediment(f:ReturnType<typeof line>,u:number,y:number,w:number,h:number,col:C='stone'){
  const sh=new T.Shape().moveTo(-w/2,0).lineTo(w/2,0).lineTo(0,h).closePath(),p=f.p(u,.33);detail(new T.ShapeGeometry(sh),col,p[0],y,p[1],f.angle,'ornament');strip(f,u,y,w+.15,.12,col,.25,.36);
 }
 function arch(f:ReturnType<typeof line>,u:number,y:number,w:number,h:number,name:string,col:C='stone'){
  const sh=new T.Shape().moveTo(-w/2,0).lineTo(w/2,0).lineTo(w/2,h-w/2);sh.absarc(0,h-w/2,w/2,0,Math.PI,false);sh.lineTo(-w/2,0).closePath();
  const p=f.p(u,.28);if(name!=='gasthuishof-gate')detail(new T.ShapeGeometry(sh,12),name==='vingboons-basement'?'glass':'dark',p[0],y,p[1],f.angle,name==='vingboons-basement'?'glazing':'portal');if(name==='vingboons-basement'){strip(f,u,y,.035,h-.15,'white',.04,.35);strip(f,u,y+h*.5,w,.035,'white',.04,.35);for(const fraction of [-.22,.22])for(const yy of [.3,.6]){const q=f.p(u,.28),p=[q[0]+Math.cos(f.angle)*fraction*w,q[1]-Math.sin(f.angle)*fraction*w];apertureProbes.push({point:[p[0],y+yy*h,p[1]],normal:f.normal,name:'merchant-basement'})}}
  const q=f.p(u,.32);detail(new T.TorusGeometry(w/2+.12,.12,4,18,Math.PI),col,q[0],y+h-w/2,q[1],f.angle,'ornament');
  strip(f,u-w/2-.08,y,.13,h-w/2,col,.20,.32);strip(f,u+w/2+.08,y,.13,h-w/2,col,.20,.32);
 }
 const r=s.footprint[0];
 // Recognition-critical principal front intervals follow the actual street edge.
 // Detailed facade heights below are photo-guided; measured cell roofs above.
 const bank=line(r[81],r[105]),houses=line(r[105],architectural.gatewayStart),gate=line(architectural.gatewayStart,r[141]),bernard=line(r[141],native([81.8,-.966]));
 // Raised bank base and classical colossal-order facade.
 for(const y of [0.35,4.5,5.05,17.5,18.25])strip(bank,bank.L/2,y,bank.L,.22,'stone',.38,.25);
 const bn=9;for(let i=0;i<bn;i++){
  const u=bank.L*(i+.5)/bn-(i===bn-1?.55:0);if(i!==1)pane(bank,u,.8,1.5,2.4,'bank-basement','grid','stone');pane(bank,u,5.5,1.65,6.5,'bank-tall-window','grid','stone');pane(bank,u,14.35,1.45,.7,'bank-attic','none','stone');
  strip(bank,u+bank.L/bn*.45,5.05,.34,12.2,'stone',.30,.37);pediment(bank,u,12.6,2.1,.65);
 }pediment(bank,bank.L/2,18.4,9.7,3.2);arch(bank,bank.L*.12,.1,2.7,4.1,'museum-entrance');
 // Three connected merchant houses: 9 axes, 4 complete tiers, arched basement.
 const hn=9;for(let i=0;i<hn;i++){
  const u=houses.L*(i+.5)/hn-(i===3?.60:0);for(const [y,h] of [[2.3,3.05],[6.2,3.05],[10.2,2.55],[13.9,2.10]])pane(houses,u,y,1.36,h,'vingboons-front-'+i,y>=10?'four':'sash');
  // Original visible small arched lower windows stand ABOVE pavement, no blank plinth.
  const basementU=u-(i===7?.45:0);arch(houses,basementU-.33,.5,.42,.95,'vingboons-basement','white');arch(houses,basementU+.33,.5,.42,.95,'vingboons-basement','white');
 }
 for(const y of [0.1,2.15,16.9,18.5])strip(houses,houses.L/2,y,houses.L+.06,y<2?.12:.3,'white',.27,.25);
 for(let u=.35;u<houses.L;u+=.75)strip(houses,u,17.7,.22,.5,'white',.25,.27);
 strip(houses,houses.L/2,0,houses.L,.5,'stone',.12,.24);strip(houses,houses.L/2,.5,houses.L,.95,'stone',.12,.24);strip(houses,houses.L/2,1.45,houses.L,.7,'stone',.12,.24);
 strip(houses,houses.L/2,17.1,houses.L+.1,1.35,'white',.42,.31);
 // The gateway shares the roof with Saint Bernard but has an exposed white portal.
 const gu=gate.L*.5;arch(gate,gu,.05,1.8,2.5,'gasthuishof-gate','white');strip(gate,gu-1.15,0,.33,2.8,'white',.38,.36);strip(gate,gu+1.15,0,.33,2.8,'white',.38,.36);strip(gate,gu,2.8,2.8,.28,'white',.42,.38);pane(gate,gu,3.2,1.15,1.3,'gate-upper','grid');pediment(gate,gu,4.65,2.2,.48,'white');pane(gate,gu,6.0,1.35,3.5,'gate-first','sash');pane(gate,gu,10.6,1.35,3.05,'gate-second','sash');
 for(const y of [5.55,10.0,14.6])strip(gate,gate.L/2,y,gate.L,.18,'white',.25,.20);
 pane(gate,gu,15.0,gate.L-.3,2.7,'gate-glazed-crown','none','frame');
 // Saint Bernard: red/cream striped neo-Renaissance front, 8 bay rhythm.
 const sn=12;for(const y of [.35,1.2,2.1,4.5,6.2,7.3,9.0,10.8,11.65,14.7,15.5])strip(bernard,bernard.L/2,y,bernard.L,.15,'stone',.19,.22);
 for(let i=0;i<sn;i++){
  const u=bernard.L*(i+.5)/sn;if(i!==6)pane(bernard,u,2.1,1.38,3.75,'bernard-ground-'+i,'grid','stone');pane(bernard,u,7.35,1.45,3.2,'bernard-middle-'+i,'grid','stone');
  for(const du of [-.35,.35]){pane(bernard,u+du,11.65,.55,3.0,'bernard-upper-'+i,'grid','stone');const p=bernard.p(u+du,.34);detail(new T.TorusGeometry(.3,.075,4,12,Math.PI),'stone',p[0],14.65,p[1],bernard.angle,'ornament');}
  const p=bernard.p(u,.34);detail(new T.TorusGeometry(.80,.09,4,12,Math.PI),'stone',p[0],10.55,p[1],bernard.angle,'ornament');strip(bernard,u,.18,1.4,.65,'glass',.08,.30);
  strip(bernard,u+bernard.L/sn*.46,1.1,.2,14.6,'stone',.16,.25);
 }arch(bernard,bernard.L*6.5/12,1.15,1.75,4.65,'bernard-door','stone');
 strip(bernard,bernard.L/2,15.55,bernard.L+.1,.65,'stone',.42,.32);for(let u=.6;u<bernard.L;u+=1.0)strip(bernard,u,15.1,.18,.45,'stone',.27,.33);
 // Remaining physical parent houses are preserved with independent native fronts;
 // no fake tenant labels. These surveyed ranges stay part of exact suppression.
 // Six street-side source groups follow native house roof crests, rather than
 // skipping narrow subdivided BAG edges and leaving whole southern fronts blank.
 const southGroups=[{lo:87.5,hi:94.7,axes:3,top:13.3,crown:'neck',sourceId:2},{lo:94.7,hi:101.5,axes:3,top:14.0,crown:'neck',sourceId:3},{lo:101.5,hi:108.2,axes:3,top:14.0,crown:'step',sourceId:4},{lo:108.2,hi:114.3,axes:3,top:15.9,crown:'flat',sourceId:5}];
 for(let k=0;k<southGroups.length;k++){
  const part=southGroups[k],sf=line(native([part.lo,-.6-(part.lo-76.5)*.069]),native([part.hi,-.6-(part.hi-76.5)*.069]));
  for(let n=0;n<part.axes;n++){const u=sf.L*(n+.5)/part.axes,w=Math.min(1.2,sf.L/part.axes*.58);for(const [y,h]of(part.sourceId===3?[[1.8,3.4],[6.0,2.5],[9.6,2.3]]:[[1.1,2.5],[4.8,2.5],[8.5,2.5]])){if(n===2&&((part.sourceId===3&&y===1.8)||([2,5].includes(part.sourceId)&&y===1.1)))continue;pane(sf,u,y,w,h,'southern-source-group-'+k+'-'+n,'six','white');}if(part.top>14.2)pane(sf,u,12.1,w,1.8,'southern-upper-'+k+'-'+n,'four','white');}
  if(part.sourceId===2||part.sourceId===5){const u=sf.L*2.5/3,threshold=part.sourceId===2?.9:.45,p=sf.p(u,.285);detail(new T.PlaneGeometry(.95,2.65),'dark',p[0],threshold+1.325,p[1],sf.angle,'source-main-door');pane(sf,u,threshold+2.7,.95,.65,'source-real-door-transom-'+part.sourceId,'none','white');const rp=sf.p(u,.29),oval=new T.RingGeometry(.16,.19,12);oval.scale(.8,1.2,1);detail(oval,'white',rp[0],threshold+3.0,rp[1],sf.angle,'source-oval-transom');strip(sf,u,threshold-.14,1.15,.14,'stone',.48,.35);if(part.sourceId===2){plinthMasks.set(sf,[[sf.L*.5/3-.65,sf.L*.5/3+.65,.12,.65],[sf.L*1.5/3-.65,sf.L*1.5/3+.65,.12,.65]]);strip(sf,sf.L/2,0,sf.L,.72,'stone',.15,.24);for(const bu of [sf.L*.5/3,sf.L*1.5/3])pane(sf,bu,.12,1.1,.5,'143-exposed-basement','none','white');for(let n=0;n<4;n++){const bp=sf.p(u+1.2-n*.3,.8);box(bp[0],0,bp[1],.32,.225*(n+1),.9,'stone',sf.angle);}}}
  if(part.sourceId===3){
   const uDoor=sf.L*2.5/3,baseDoor=sf.L*.5/3;
   plinthMasks.set(sf,[[baseDoor-.58,baseDoor+.58,.05,1.35],[sf.L*1.5/3-.6,sf.L*1.5/3+.6,.35,1.2],[uDoor-.6,uDoor+.6,.35,1.2]]);
   strip(sf,sf.L/2,0,sf.L,1.6,'white',.16,.23);arch(sf,baseDoor,.05,1.0,1.3,'145-basement-door','white');for(const u of [sf.L*1.5/3,uDoor])pane(sf,u,.35,.85,.85,'145-exposed-basement','grid','white');
   arch(sf,uDoor,1.65,1.05,3.5,'145-raised-main-door','white');
   // Photo-visible side-running stoop; seven visible tread fronts are bounded
   // geometry, not a survey of hidden stair construction. Rail faces original.
   for(let n=0;n<7;n++){const u=uDoor+2.2-n*.31,p=sf.p(u,.85);box(p[0],0,p[1],.34,.22*(n+1),.95,'stone',sf.angle);}
   for(const y of [5.5,8.8,12.35,13.6])strip(sf,sf.L/2,y,sf.L,.25,'white',.26,.28);for(let n=0;n<4;n++)strip(sf,sf.L*n/3,1.65,.16,11.0,'white',.17,.31);
   for(const side of [.4,1.32])for(let n=0;n<4;n++){const u=uDoor+2.2-n*.7,p=sf.p(u,side);box(p[0],.22*(1+n*2)+.12,p[1],.045,.8,.045,'dark',sf.angle);}
  }
  if(part.sourceId===3){for(const side of [.4,1.32]){const a=sf.p(sf.L*2.5/3+2.2,side),q=sf.p(sf.L*2.5/3+.1,side),A=new T.Vector3(a[0],1.12,a[1]),Q=new T.Vector3(q[0],2.46,q[1]),delta=Q.clone().sub(A),g=new T.CylinderGeometry(.025,.025,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const mid=A.clone().add(Q).multiplyScalar(.5);detail(g,'dark',mid.x,mid.y,mid.z,0,'source-stoop-rail');}}
  if(part.sourceId===2||part.sourceId===5){for(let n=0;n<3;n++){const u=sf.L*(n+.5)/3,w=Math.min(1.2,sf.L/3*.58);for(const y of [5.0,8.7]){strip(sf,u,y,w+.1,.045,'dark',.07,.39);strip(sf,u,y+.48,w+.1,.045,'dark',.07,.39);for(const du of [-w/2,0,w/2])strip(sf,u+du,y,.035,.5,'dark',.055,.39);for(const du of [-w*.23,w*.23]){const pt=sf.p(u+du,.42);detail(new T.RingGeometry(.075,.095,10),'dark',pt[0],y+.24,pt[1],sf.angle,'source-iron-guard');}}}}
  if(part.sourceId===4){for(const y of [.7,2.1,3.5,4.65,5.8,7.15,8.2,9.4,10.8,12.2,13.4])strip(sf,sf.L/2,y,sf.L,.13,'white',.18,.2);for(let n=0;n<3;n++){const u=sf.L*(n+.5)/3;for(const y of [4.45,8.15,11.85])strip(sf,u,y,1.5,.22,'stone',.25,.31);}}
  strip(sf,sf.L/2,.3,sf.L,.3,'stone',.3,.24);strip(sf,sf.L/2,part.top-.25,sf.L,.3,'white',.36,.3);
  if(part.crown==='step'){const p=architectural.parts.find(p=>p.id==='southern-family-'+part.sourceId)!,peak=p.ridge;let points:number[][]=[[-sf.L/2,part.top]];for(let n=0;n<4;n++){const x=-sf.L/2+n*sf.L/8,y=part.top+(peak-part.top)*n/4;points.push([x,y],[x+sf.L/8,y]);}points.push([0,peak]);for(let n=3;n>=0;n--){const x=sf.L/2-n*sf.L/8,y=part.top+(peak-part.top)*n/4;points.push([x-sf.L/8,y],[x,y]);}points.push([sf.L/2,part.top]);for(let n=0;n<points.length-1;n++){const a=points[n],q=points[n+1];if(Math.abs(q[1]-a[1])<.001)strip(sf,sf.L/2+(a[0]+q[0])/2,a[1],Math.abs(q[0]-a[0])+.12,.13,'white',.24,.32);else strip(sf,sf.L/2+a[0],Math.min(a[1],q[1]),.13,Math.abs(q[1]-a[1]),'white',.24,.32);}pane(sf,sf.L/2,part.top+.2,.8,1.1,'southern-step-attic-'+k,'four','white');}
  if(part.crown==='bell'||part.crown==='neck'){const p=architectural.parts.find(p=>p.id==='southern-family-'+part.sourceId)!,base=part.top,peak=p.ridge+.2,w=sf.L;let sh=new T.Shape().moveTo(-w/2,base).lineTo(-w/2,base+.35).quadraticCurveTo(-w*.25,base+.3,-w*.16,peak-.8).quadraticCurveTo(-w*.18,peak+.05,0,peak).quadraticCurveTo(w*.18,peak+.05,w*.16,peak-.8).quadraticCurveTo(w*.25,base+.3,w/2,base+.35).lineTo(w/2,base).closePath(),pt=sf.p(sf.L/2,.21);if(part.sourceId===3){sh=new T.Shape().moveTo(-w/2,base).lineTo(-w/2,base+.35).lineTo(-1.65,base+.35).quadraticCurveTo(-1.2,base+.55,-1.2,base+1.15).lineTo(-1.2,peak-.35).lineTo(-1.5,peak-.35).lineTo(0,peak).lineTo(1.5,peak-.35).lineTo(1.2,peak-.35).lineTo(1.2,base+1.15).quadraticCurveTo(1.2,base+.55,1.65,base+.35).lineTo(w/2,base+.35).lineTo(w/2,base).closePath();for(const du of [-.52,.52]){const rp=sf.p(sf.L/2+du,.36);detail(new T.RingGeometry(.13,.19,10),'white',rp[0],peak-1.3,rp[1],sf.angle,'source-floral-relief');for(const dy of [-.22,.22]){const sp=sf.p(sf.L/2+du,.36);detail(new T.CircleGeometry(.12,6),'white',sp[0],peak-1.3+dy,sp[1],sf.angle,'source-floral-relief');}}}detail(new T.ShapeGeometry(sh,12),'brick',pt[0],0,pt[1],sf.angle,'southern-bounded-crown');const points=sh.getPoints(20);for(let n=0;n<points.length-1;n++){const A=points[n],Q=points[n+1],v=new T.Vector3(Math.cos(sf.angle)*(Q.x-A.x),Q.y-A.y,-Math.sin(sf.angle)*(Q.x-A.x)),g=new T.CylinderGeometry(.10,.10,v.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));detail(g,'white',pt[0]+Math.cos(sf.angle)*(A.x+Q.x)/2,(A.y+Q.y)/2,pt[1]-Math.sin(sf.angle)*(A.x+Q.x)/2,0,'southern-bounded-trim');}pane(sf,sf.L/2,base+.2,.65,.9,'southern-neck-attic-'+k,'four','white');}
 }
 // Surveyed garden/north/rear ranges: keep their pane identity, exposing frames
 // along actual edge normals. Photo-specific pale rear library kept at source.
 for(let i=0;i<81;i++){
  if(i===3)continue;
  const a=r[i],q=r[(i+1)%r.length],f=line(a,q);if(f.L<3.5)continue;
  if(i===4){const n=Math.max(1,Math.round(f.L/3.4));for(let k=0;k<n;k++)for(const y of [.8,3.35,5.9])pane(f,f.L*(k+.5)/n,y,1.6,1.9,'angled-brick-wing-'+k,'grid','white');strip(f,f.L/2,8.35,f.L,.25,'stone',.22,.16);continue;}
  const z=(a[1]+q[1])/2,x=(a[0]+q[0])/2,top=Math.min(16,roofHeightAt(x,z)-1.0),n=Math.max(1,Math.round(f.L/3.4));
  if(top<3.5)continue;for(let k=0;k<n;k++)for(let y=1.2;y+1.8<top;y+=3.7)pane(f,f.L*(k+.5)/n,y,1.6,2.2,'rear-native-'+i,'sash',z<-30?'white':'stone');
  strip(f,f.L/2,top+.5,f.L,.20,'stone',.2,.16);
 }
 // Source-corresponding dark3tier angled front is edge3south. d307 placed
 // its pane rhythm on edge4 instead, leaving the photographed face blank.
 const darkStart=r[3],darkEnd=native([33.01,-28.445]),darkFront=line(darkStart,darkEnd);
 for(let k=0;k<7;k++){const u=darkFront.L*(k+.5)/7;for(const y of [.65,3.35,6.05])pane(darkFront,u,y,1.45,1.95,'source-dark-angled-'+k,'six','white');}
 strip(darkFront,darkFront.L/2,8.7,darkFront.L,.3,'stone',.34,.28);
 const glazedStart=native([33.01,-28.445]),glazedEnd=native([28.76,-28.35]),glazedFront=line(glazedStart,glazedEnd);
 pane(glazedFront,glazedFront.L/2,2.75,glazedFront.L-.12,8.65,'rear-tall-glazed-connector','none','frame');
 for(let y=3.0;y<11.45;y+=2.9)strip(glazedFront,glazedFront.L/2,y,glazedFront.L,.075,'frame',.08,.28);
 for(const u of [glazedFront.L/3,glazedFront.L*2/3])strip(glazedFront,u,2.75,.055,8.65,'frame',.08,.28);
 pane(glazedFront,glazedFront.L/2,.15,1.15,2.25,'source-rear-entry-door','four','frame');
 const rearEnd=native([28.76,-28.35]),rearStart=native([4.7,-27.8]),rear=line(rearEnd,rearStart);
 // Pale 3-tier back-house front, source photograph shows six axes before crop;
 // three physical houses retain the full nine-axis native continuation.
 for(let k=0;k<9;k++){const u=rear.L*(k+.5)/9-(k===8?.4:0);for(const [y,h] of [[.9,2.9],[4.9,3.1],[9.1,3.05]])pane(rear,u,y,1.5,h,'merchant-back-'+k,'sash');for(const y of [3.95,8.1,12.25])strip(rear,u,y,1.95,.19,'white',.29,.30);const p=rear.p(u,-.40);box(p[0],14.55,p[1],1.5,1.25,1.1,'slate',rear.angle);pane(rear,u,14.62,1.25,1.0,'merchant-back-dormer-'+k,'sash');}
 for(const y of [.2,4.45,8.75,13.6,14.15])strip(rear,rear.L/2,y,rear.L,.18,'white',.3,.26);
 strip(rear,rear.L/2,13.65,rear.L,.65,'white',.38,.28);
 // Source-registered141 curved front, native5.7m frontage; photo-bounded
 // thin20.05m crown remains independent of measured roof/equipment maxima.
 const neck=line(native([81.8,-.966]),native([87.5,-1.359])),nu=neck.L/2,nw=neck.L-.1;
 const outline=new T.Shape().moveTo(-nw/2,14.45).lineTo(-nw/2,16.25).lineTo(-2.4,16.25).quadraticCurveTo(-1.75,16.4,-1.45,17.2).quadraticCurveTo(-.95,17.7,-1.15,18.65).lineTo(-1.45,19.2).quadraticCurveTo(-.9,20.05,0,20.05).quadraticCurveTo(.9,20.05,1.45,19.2).lineTo(1.15,18.65).quadraticCurveTo(.95,17.7,1.45,17.2).quadraticCurveTo(1.75,16.4,2.4,16.25).lineTo(nw/2,16.25).lineTo(nw/2,14.45).closePath();const np=neck.p(nu,.12);detail(new T.ShapeGeometry(outline,16),'brick',np[0],0,np[1],neck.angle,'curved-gable');
 const edge=outline.getPoints(32);for(let k=0;k<edge.length-2;k++){const a=edge[k],q=edge[k+1];if(a.y<17.8&&q.y<17.8)continue;const d=new T.Vector3(Math.cos(neck.angle)*(q.x-a.x),q.y-a.y,-Math.sin(neck.angle)*(q.x-a.x)),mid=new T.Vector3(np[0]+Math.cos(neck.angle)*(a.x+q.x)/2,(a.y+q.y)/2,np[1]-Math.sin(neck.angle)*(a.x+q.x)/2).add(new T.Vector3(Math.sin(neck.angle),0,Math.cos(neck.angle)).multiplyScalar(.08)),g=new T.CylinderGeometry(.13,.13,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));detail(g,'white',mid.x,mid.y,mid.z,0,'curved-crown');}
 for(const [y,h,w] of [[5.2,2.9,1.6],[8.9,2.8,1.5],[12.5,2.7,1.1]]){pane(neck,nu,y,w,h,'141-central-'+y,'grid','white');strip(neck,nu,y+h+.22,w+.55,.23,'white',.26,.35)}
 plinthMasks.set(neck,[[nu-1.72,nu+1.72,.15,3.3]]);
 for(const u of [nu-1.8,nu+1.8])for(const y of [6.5,10.2,14.0])pane(neck,u,y,.65,1.0,'141-small-'+y,'grid','white');strip(neck,nu,.2,neck.L,1.0,'white',.22,.26);strip(neck,nu,4.8,neck.L,.38,'white',.3,.3);
 // July2025source141 named entrance: broad classical pale jambs and
 // dark paneled double leaves below fascia, not a turquoise gridded window.
 const doorBottom=.15,doorTop=3.30,doorWidth=3.20,leafWidth=doorWidth/2;
 function entryBox(u:number,y:number,w:number,h:number,depth:number,off:number,col:C,r:string){const p=neck.p(u,off);detail(new T.BoxGeometry(w,h,depth),col,p[0],y+h/2,p[1],neck.angle,r);}
 const entryFrame=neck.angle,entryNormal=neck.normal;
 function entryProbe(u:number,y:number,off:number,name:string,r:string,c:string){const p=neck.p(u,off);entrance141Probes.push({point:[p[0],y,p[1]],normal:entryNormal,name,expectedRole:r,expectedColour:c});}
 for(const side of [-1,1]){
  const jambU=nu+side*(doorWidth/2+.39);
  entryBox(jambU,.15,.64,3.15,.38,.36,'white','entry141-surround');
  entryBox(jambU,.10,.83,.22,.46,.38,'white','entry141-surround');
  entryBox(jambU,3.14,.85,.22,.46,.38,'white','entry141-surround');
  for(const y of [.50,1.65,2.80])entryProbe(jambU,y,.55,'141-source-pale-jamb','entry141-surround','white');
  for(const delta of [-.17,.17])entryBox(jambU+delta,.39,.045,2.62,.045,.56,'white','entry141-surround');
 }
 entryBox(nu,3.29,doorWidth+.20,.15,.32,.39,'white','entry141-surround');
 entryBox(nu,.05,doorWidth+.32,.14,.40,.34,'stone','entry141-threshold');
 for(let leaf=0;leaf<2;leaf++){
  const u=nu+(leaf-.5)*leafWidth,p=neck.p(u,.30);
  detail(new T.PlaneGeometry(leafWidth,doorTop-doorBottom),'dark',p[0],(doorTop+doorBottom)/2,p[1],entryFrame,'entry141-door-panel');
  for(const du of [-leafWidth/2+.06,leafWidth/2-.06])entryBox(u+du,doorBottom,.10,doorTop-doorBottom,.045,.34,'frame','entry141-door-rail');
  for(const y of [doorBottom,1.15,2.18,doorTop-.08])entryBox(u,y,leafWidth-.12,.085,.045,.34,'frame','entry141-door-rail');
  for(const [y,h]of [[.35,.65],[1.33,.65],[2.36,.67]]){
   entryBox(u,y,leafWidth-.32,h,.025,.315,'dark','entry141-door-panel');
   for(const fraction of [-.28,.28]){const pos=[p[0]+Math.cos(entryFrame)*fraction*leafWidth,p[1]-Math.sin(entryFrame)*fraction*leafWidth];entrance141Probes.push({point:[pos[0],y+h/2,pos[1]],normal:entryNormal,name:'141-source-dark-paneled-leaf-'+leaf,expectedRole:'entry141-door-panel',expectedColour:'dark'});}
  }
 }
 entryBox(nu,doorBottom,.065,doorTop-doorBottom,.055,.355,'frame','entry141-door-rail');
 // Real ALLARD PIERSON fascia from July2025near-bank photograph at141.
 // ArialNarrowRegular is a recorded condensed-sans approximation, no pixel font.
 strip(neck,nu,3.45,neck.L-.35,.85,'white',.24,.33);
 const path=new T.ShapePath();for(const command of signOutline.commands){const c=command as any;if(c.type==='M')path.moveTo(c.x,-c.y);else if(c.type==='L')path.lineTo(c.x,-c.y);else if(c.type==='Q')path.quadraticCurveTo(c.x1,-c.y1,c.x,-c.y);else if(c.type==='C')path.bezierCurveTo(c.x1,-c.y1,c.x2,-c.y2,c.x,-c.y);else if(c.type==='Z')path.currentPath!.closePath();}
 const letters=new T.ShapeGeometry(path.toShapes(false),4);letters.computeBoundingBox();const bb=letters.boundingBox!,size=bb.getSize(new T.Vector3());letters.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);letters.scale((neck.L-.85)/size.x,.52/size.y,1);const sp=neck.p(nu,.46);detail(letters,'dark',sp[0],3.78,sp[1],neck.angle,'real-sign');
 function nearestOuter(x:number,z:number){let best=[x,z],dist=Infinity;const r=s.footprint[0];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],dx=q[0]-a[0],dz=q[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),px=a[0]+t*dx,pz=a[1]+t*dz,d=Math.hypot(x-px,z-pz);if(d<dist){dist=d;best=[px,pz]}}return best;}
 function clampToParent(x:number,z:number){if(inring(x,z,s.footprint[0])&&!s.footprint.slice(1).some(r=>inring(x,z,r)))return [x,z];let best=[x,z],dist=Infinity;for(const r of s.footprint)for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],dx=q[0]-a[0],dz=q[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),px=a[0]+t*dx,pz=a[1]+t*dz,d=Math.hypot(x-px,z-pz);if(d<dist){dist=d;best=[px,pz]}}return best;}
 function inring(x:number,z:number,ring:number[][]){let b=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],q=ring[j];if((a[1]>z)!==(q[1]>z)&&x<(q[0]-a[0])*(z-a[1])/(q[1]-a[1])+a[0])b=!b}return b}
 function roofHeightAt(x:number,z:number){const c=s.roofs.find(c=>inring(x,z,c.rings[0])&&!c.rings.slice(1).some(r=>inring(x,z,r)));return c?Math.min(...c.rings.flat().map(p=>p[2])):14}
}
