import * as T from 'three';import type {BuildingTools} from './cultural-builders';import {openTopPrism} from './house-geometry';import s from './ruysdael-petrus-pauluskerk-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** Original native-scale complex. Survey footprint/roof measurements, photo-guided relief.
 * Source AHN merged chapel into nave: corrected as separate photo-supported low faceted roof. */
export function buildRuysdaelPetrusPauluskerk(_w:number,_d:number,b:BuildingTools){
 const angle=s.authorAngleRadians,co=Math.cos(angle),si=Math.sin(angle),at=(x:number,z:number)=>[co*x+si*z,-si*x+co*z];
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0,role='detail')=>{const q=at(x,z);g.userData.role=role;b.add(g,c,q[0],y,q[1],angle+a)};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:C,a=0,role='detail')=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a,role);
 const shell=(r:number[][],h:number,c:C='brick',role='shell',base=0)=>add(openTopPrism(new T.Shape(r.map(q=>new T.Vector2(q[0],q[1]))),base,h),c,0,0,0,0,role);
 function roof(r:number[][],c:C='red'){
  const g=new T.ShapeGeometry(new T.Shape(r.map(q=>new T.Vector2(q[0],q[2]))));const p=g.getAttribute('position');
  // Centered least squares across the original survey face; avoid first-three-vertex fins.
  const m=r.reduce((a,q)=>a.map((v,i)=>v+q[i]/r.length),[0,0,0]);let xx=0,xz=0,zz=0,xy=0,zy=0;for(const q of r){const x=q[0]-m[0],z=q[2]-m[2],y=q[1]-m[1];xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y}const det=xx*zz-xz*xz,ax=(xy*zz-zy*xz)/det,az=(zy*xx-xy*xz)/det;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,m[1]+ax*(x-m[0])+az*(z-m[2]),z)}const ix=g.index!,kept:number[]=[],removed:{indices:number[],altitudeMetres:number,areaSquareMetres:number,longestEdgeMetres:number}[]=[];
  for(let i=0;i<ix.count;i+=3){const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)],v=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j)),cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])),area=cross.length()/2,longest=Math.max(v[0].distanceTo(v[1]),v[1].distanceTo(v[2]),v[2].distanceTo(v[0])),altitude=longest?2*area/longest:0;
   // Source rounding creates millimetre-wide, metre-long top slivers. Production
   // quantization reversed one sacristie triangle. Drop only numerical remnants
   // below3mm altitude; original surveyed rings remain unchanged and archived.
   if(altitude<.003){removed.push({indices:ids,altitudeMetres:altitude,areaSquareMetres:area,longestEdgeMetres:longest});continue}
   if(cross.y<0)[ids[1],ids[2]]=[ids[2],ids[1]];kept.push(...ids);
  }g.setIndex(kept);g.userData.roofNumericalCleanup={thresholdAltitudeMetres:.003,removed};g.computeVertexNormals();add(g,c,0,0,0,0,'roof');
 }
 function triangle(r:number[][],c:C='brick',role='gable'){const p=r.flat(),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();add(g,c,0,0,0,0,role)}
 function face(x:number,z:number,a=0){const ca=Math.cos(a),sa=Math.sin(a),pos=(u:number,v:number)=>[x+ca*u+sa*v,z-sa*u+ca*v];const fb=(u:number,y:number,v:number,w:number,h:number,d:number,c:C,role='detail')=>{const q=pos(u,v);box(q[0],y,q[1],w,h,d,c,a,role)},fa=(g:T.BufferGeometry,c:C,u=0,y=0,v=0,role='detail')=>{const q=pos(u,v);add(g,c,q[0],y,q[1],a,role)};
  const pane=(u:number,y:number,w:number,h:number,white=false)=>{fb(u,y,.10,w,h,.05,'glass','glazing');const c:C=white?'white':'brick';for(const du of [-w/2,w/2])fb(u+du,y,.17,.07,h,.07,c);for(const dy of [0,h])fb(u,y+dy-.04,.17,w+.1,.08,.09,white?'white':'stone');return{u,y,w,h}};
  function grouped(u:number,y:number,w:number,h:number,n=2,tiers=3,white=false){for(let i=0;i<n;i++){const pw=(w-(n-1)*.14)/n,p= pane(u-w/2+pw/2+i*(pw+.14),y,pw,h,white);for(let j=1;j<tiers;j++)fb(p.u,y+j*h/tiers,.18,pw,.07,.08,white?'white':'frame');for(const du of [-pw/2,pw/2])fb(p.u+du,y+h-.12,.2,.13,.30,.12,'stone')}fb(u,y-.16,.14,w+.28,.18,.26,'stone')}
  function arch(u:number,y:number,w:number,h:number,c:C,v:number,role='detail'){const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-w/2);sh.absarc(0,h-w/2,w/2,0,Math.PI,false);sh.closePath();fa(new T.ExtrudeGeometry(sh,{depth:.045,bevelEnabled:false,curveSegments:16}),c,u,y,v,role)}
  return {fb,fa,pane,grouped,arch,pos};
 }
 // BAG L-shaped boundary leaves garden behind pastorie open. Native nave/tower/chapel split.
 const nave=[[-4.20,11.65],[5.79,10.56],[8.45,9.15],[5.80,-12.10],[-6.85,-10.44]];shell(nave,9.25);
 const ridgeFront=[2.18,15.75,11.24],ridgeRear=[-.67,15.75,-11.25];
 roof([[-4.2,9.52,11.65],ridgeFront,ridgeRear,[-6.85,9.61,-10.44]]);
 roof([ridgeFront,[5.79,12.11,10.56],[8.45,9.30,9.15],[5.80,9.25,-12.10],ridgeRear]);
 // Close explicit roof perimeter to uncapped walls; no overlapping wall-colored top.
 const topRing=[[-4.2,9.52,11.65],ridgeFront,[5.79,12.11,10.56],[8.45,9.30,9.15],[5.80,9.25,-12.10],ridgeRear,[-6.85,9.61,-10.44]];
 for(let i=0;i<topRing.length;i++){const a=topRing[i],q=topRing[(i+1)%topRing.length];triangle([[a[0],9.25,a[2]],[q[0],9.25,q[2]],[q[0],q[1],q[2]]]);triangle([[a[0],9.25,a[2]],[q[0],q[1],q[2]],[a[0],a[1],a[2]]]);}
 // Sacristie roof64 is genuinely low, flat; no parish-wide19m extrusion.
 const sac=s.roofPlanes.find(p=>p.sourceSurface===64)!.rings[0];shell(sac.map(q=>[q[0],q[2]]),4.82);roof(sac,'slate');
 // Pastorie remains a separate three-storey rationalist house, with red hip/gable roofs.
 const pr=s.parts.find(p=>p.properties['ref:rce']==='504683')!.rings[0];shell(pr,9.39);
 for(const p of s.roofPlanes.filter(p=>[59,60,61,63].includes(p.sourceSurface))){roof(p.rings[0]);const r=p.rings[0];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length];triangle([[a[0],9.39,a[2]],[q[0],9.39,q[2]],[q[0],q[1],q[2]]]);triangle([[a[0],9.39,a[2]],[q[0],q[1],q[2]],[a[0],a[1],a[2]]])}}
 const pf=face(-9.0,13.555,.122);
 // Each principal frame contains two sashlights, not a single wide pane.
 function whiteCross(f:ReturnType<typeof face>,u:number,y:number,w:number,h:number,fine=false){f.pane(u,y,w,h,true);f.fb(u,y,.20,.075,h,.06,'white');const transom=y+h*.65;f.fb(u,transom,.20,w,.10,.07,'white');for(const du of [-w/4,w/4]){f.fb(u+du,transom,.21,.026,h*.35,.035,'white');f.fb(u+du,transom+h*.175,.21,w/2,.026,.035,'white')}if(fine)for(const du of [-w*.375,-w*.125,w*.125,w*.375])f.fb(u+du,transom,.215,.014,h*.35,.025,'white');}
 for(const y of [1.1,4.3])for(const u of [-1.13,1.13])whiteCross(pf,u,y,1.63,2.6,y===1.1);
 for(const u of [-.69,.69])pf.pane(u,8.1,.88,1.9,true);
 const pe=face(-5.56,12.02,.124);whiteCross(pe,0,4.3,1.15,2.5);pe.fb(0,.5,.16,1.3,2.6,.08,'bronze');whiteCross(pe,0,3.1,1.2,.62);for(let i=0;i<3;i++)pe.fb(0,i*.15,.4+(2-i)*.25,1.6,.15,.30,'stone');
 // Front gable and two paired tall windows; native facade normal from surveyed chain.
 const front=face(0,11.31,.124);face(.4,11.65+4.6/6.38*(-.41),Math.atan2(.41,6.38)).grouped(0,6.12,1.8,5.08);face(3.45,11.24+1.27/3.61*(-.68),Math.atan2(.68,3.61)).grouped(0,6.12,1.8,5.08);face(2.15,11.242,.124).grouped(0,12.88,.92,1.14,2,1);
 for(const u of [-4.7,-.2,5.4])front.grouped(u,1.65,.84,1.40,2,1);
 // Photo-defined stone edge of pointed gable and cross; no unsupported text label.
 for(const [a,q]of [[[-4.2,9.6],[2.18,15.8]],[[2.18,15.8],[5.8,12.15]]] as number[][][]){const dx=q[0]-a[0],dy=q[1]-a[1],g=new T.BoxGeometry(Math.hypot(dx,dy),.14,.18);g.rotateZ(Math.atan2(dy,dx));front.fa(g,'stone',(q[0]+a[0])/2,(q[1]+a[1])/2,.18)}front.fb(2.18,15.65,.13,.20,1.13,.20,'stone');front.fb(2.18,16.34,.13,.74,.18,.20,'stone');
 // Five current September2026 triple windows on street longwall, attached by native tangent.
 const A=nave[2],B=nave[3],dx=B[0]-A[0],dz=B[1]-A[1],len=Math.hypot(dx,dz),a=Math.atan2(-dz,dx);
 for(const t of [.18,.36,.54,.72,.9]){const f=face(A[0]+dx*t,A[1]+dz*t,a);f.grouped(0,2.42,2.5,5.00,3,3)}
 const side=face((A[0]+B[0])/2,(A[1]+B[1])/2,a);side.fb(0,9.0,.15,len,.18,.22,'white');for(let u=-len/2+.3;u<len/2;u+=.85)side.fb(u,8.58,.14,.22,.3,.20,'brick');
 // Low faceted chapel: merged AHN roof67 incorrectly projected nave slope onto it.
 const chapel=[[-4.15,11.28],[-4.17,11.85],[-3.97,11.83],[-3.90,12.34],[-3.13,12.94],[-2.15,12.79],[-1.45,12.08],[-1.5,11.28]];shell(chapel,6.04);const cp=[-2.8,6.82,11.6];for(let i=0;i<chapel.length;i++){const p=chapel[i],q=chapel[(i+1)%chapel.length];roof([[p[0],6.04,p[1]],[q[0],6.04,q[1]],cp])}
 for(let i=3;i<6;i++){const p=chapel[i],q=chapel[i+1],x=(p[0]+q[0])/2,z=(p[1]+q[1])/2,aa=Math.atan2(-(q[1]-p[1]),q[0]-p[0]);const f=face(x,z,aa);f.pane(0,1.66,.43,1.38);f.pane(0,4.75,.46,1.12);f.fb(0,5.92,.15,Math.hypot(q[0]-p[0],q[1]-p[1]),.15,.2,'white')}
 // Tower: original source footprint and separately corbelled chamfered clock stage.
 const tower=[[5.18,9.13],[8.45,9.15],[8.75,11.60],[7.4,11.76],[6.09,11.92],[5.96,10.54],[5.79,10.56]];shell(tower,15.42);const top=tower.map(q=>[7+(q[0]-7)*1.16,10.5+(q[1]-10.5)*1.16]);shell(top,19.35,'brick','clock-stage',15.42);
 // Upper shell lower part duplicates tower only; windows remain on outer exposed face.
 const tf=face(7.27,11.87,.1),ts=face(8.62,10.4,Math.PI/2-.12);
 for(const f of [tf,ts]){f.grouped(0,3.5,1.16,1.85,2,1);f.grouped(0,7.4,1.16,1.85,2,1);f.grouped(0,12.24,1.16,2.0,2,5);}
 const cf=face(7.27,12.11,.1),cw=face(8.93,10.4,Math.PI/2-.12),ce=face(4.95,10.4,-Math.PI/2+.12),south=face(7,8.78,Math.PI);
 for(const f of [cf,cw,ce]){
  // Widened clock stage is supported on visible corbel brackets with real inset throats.
  for(const u of [-.90,-.30,.30,.90]){f.fb(u,15.22,-.02,.18,.25,.42,'brick');f.fb(u,15.47,.06,.25,.18,.52,'brick');f.fb(u,15.65,.14,.32,.12,.60,'stone')}
  f.fb(0,16.1,.13,2.28,2.30,.10,'stone');f.fb(0,16.18,.20,2.1,2.12,.035,'brick');const g=new T.CylinderGeometry(.70,.70,.04,36).rotateX(Math.PI/2);f.fa(g,'stone',0,17.25,.27,'clock');for(let i=0;i<12;i++){const theta=i*Math.PI/6,gg=new T.BoxGeometry(.05,.12,.04);gg.rotateZ(-theta);f.fa(gg,'dark',.58*Math.sin(theta),17.25+.58*Math.cos(theta),.32)}f.fb(0,17.25,.34,.04,.42,.04,'dark');f.fb(.15,17.25,.34,.32,.045,.04,'dark');f.fb(0,18.4,.14,2.6,.16,.28,'stone');
 }
 south.grouped(0,16.68,1.15,1.30,2,1);
 // Roof uses the actual widened/chamfered stage boundary, not separately rounded
 // corners. Preserve crest heights20.68/20.70; intersect the original ridge axis
 // with the modeled boundary to close millimetre perimeter exposure.
 //15mm eave projection follows the actual stage polygon. Exact coincident
 // boundaries alone left onequantized corner exposed underDoubleSide; this
 // small physical roof lip covers the observed<=3.1mm quantization discrepancy.
 const roofStage=top.map((q,i)=>{const p=top[(i+top.length-1)%top.length],n=top[(i+1)%top.length],l1=dist2(p,q),l2=dist2(q,n),a=[(q[1]-p[1])/l1,-(q[0]-p[0])/l1],c=[(n[1]-q[1])/l2,-(n[0]-q[0])/l2],den=1+a[0]*c[0]+a[1]*c[1];return[q[0]+.015*(a[0]+c[0])/den,q[1]+.015*(a[1]+c[1])/den]});
 function dist2(a:number[],q:number[]){return Math.hypot(a[0]-q[0],a[1]-q[1])}
 const ridgeA=[7.4,11.98],ridgeB=[7.03,8.92],rx=ridgeA[0]-ridgeB[0],rz=ridgeA[1]-ridgeB[1],ridgeSide=(q:number[])=>rx*(q[1]-ridgeB[1])-rz*(q[0]-ridgeB[0]);
 const intersections:{point:number[],edge:number,t:number}[]=[];
 for(let i=0;i<roofStage.length;i++){const q=roofStage[i],n=roofStage[(i+1)%roofStage.length],sq=ridgeSide(q),sn=ridgeSide(n);if(sq*sn<0){const t=sq/(sq-sn);intersections.push({point:[q[0]+t*(n[0]-q[0]),q[1]+t*(n[1]-q[1])],edge:i,t})}}
 intersections.sort((a,q)=>a.point[1]-q.point[1]);const back=intersections[0],frontTip=intersections[1];
 // A surveyed intermediate point on the front chain lies just right of the
 // ridge. It follows the front gable line rather than dipping to the eave.
 const elevations=roofStage.map(()=>19.35),frontEdge=roofStage[2],mid=roofStage[3],dist=(a:number[],q:number[])=>Math.hypot(a[0]-q[0],a[1]-q[1]);
 elevations[3]=19.35+(20.68-19.35)*dist(frontEdge,mid)/(dist(frontEdge,mid)+dist(mid,frontTip.point));
 function clipped(sign:number){const ring:number[][]=[];for(let i=0;i<roofStage.length;i++){const a=roofStage[i],q=roofStage[(i+1)%roofStage.length],sa=ridgeSide(a)*sign,sq=ridgeSide(q)*sign;if(sa>=0)ring.push([a[0],elevations[i],a[1]]);if(sa*sq<0){const t=sa/(sa-sq),x=a[0]+t*(q[0]-a[0]),z=a[1]+t*(q[1]-a[1]);ring.push([x,i===back.edge?20.70:20.68,z])}}return ring}
 for(const half of [clipped(-1),clipped(1)]){const g=new T.ShapeGeometry(new T.Shape(half.map(q=>new T.Vector2(q[0],q[2])))),ix=g.index!;for(let i=0;i<ix.count;i+=3)roof([half[ix.getX(i)],half[ix.getX(i+1)],half[ix.getX(i+2)]],'slate')}
 // The gable skirts follow exactly the same perimeter/elevation vertices.
 const rim:number[][]=[];for(let i=0;i<roofStage.length;i++){rim.push([roofStage[i][0],elevations[i],roofStage[i][1]]);for(const q of intersections.filter(q=>q.edge===i))rim.push([q.point[0],q===back?20.70:20.68,q.point[1]])}
 for(let i=0;i<rim.length;i++){const a=rim[i],q=rim[(i+1)%rim.length];if(a[1]<=19.35&&q[1]<=19.35)continue;triangle([[a[0],19.35,a[2]],q,[q[0],19.35,q[2]]]);triangle([[a[0],19.35,a[2]],a,q])}cf.fb(0,19.32,.22,.24,.35,.12,'stone');
 // Neo-Roman portal: actual recessed three-tier archivolts and exposed glazing.
 const port=face(2.25,11.35);port.fb(0,.43,.10,2.15,2.63,.06,'bronze','door');port.arch(0,3.06,2.15,1.15,'glass',.15,'glazing');port.fb(0,.43,.20,.07,2.63,.04,'frame');for(const u of [-.36,.36])port.fb(u,3.06,.25,.09,1.05,.05,'brick');
 for(let j=0;j<4;j++){const rad=1.22+j*.25,z=.21+j*.26,g=new T.TorusGeometry(rad,.095,5,36,Math.PI);port.fa(g,j===3?'stone':'brick',0,3.00,z,'archivolt');for(const u of [-rad,rad])port.fb(u,.3,z,.20,2.75,.26,'brick')}
 port.fb(0,2.96,.28,2.36,.14,.16,'stone');for(let i=0;i<3;i++)port.fb(0,i*.14,.44+(2-i)*.28,3.45,.14,.43,'stone');
 const porchR=[[-.08,4.75,12.64],[2.18,6.47,12.31],[4.57,4.75,12.07]],porchBack=porchR.map(q=>[q[0],q[1],q[2]-1.02]);roof([porchR[0],porchR[1],porchBack[1],porchBack[0]],'slate');roof([porchR[1],porchR[2],porchBack[2],porchBack[1]],'slate');triangle(porchR);
 port.fb(0,6.35,1.1,.12,.56,.13,'stone');port.fb(0,6.71,1.1,.44,.10,.13,'stone');
 for(const u of [-4.5,5.04]){front.fb(u,.6,.35,1.18,.075,.1,'frame');front.fb(u,1.5,.35,1.18,.075,.1,'frame');for(let x=-.53;x<=.53;x+=.13)front.fb(u+x,.6,.35,.026,1.08,.026,'frame')}
 // Sacristie preserved3-window/arched-door facade and ajour parapet on native street edge.
 const SA=[5.8,-12.1],SB=[4.84,-18.99],sdx=SB[0]-SA[0],sdz=SB[1]-SA[1],sf=face((SA[0]+SB[0])/2,(SA[1]+SB[1])/2,Math.atan2(-sdz,sdx));
 for(const u of [-1.7,-.3,1.1])whiteCross(sf,u,1.55,1.03,2.67);sf.arch(2.5,.45,1.1,2.92,'bronze',.12,'door');sf.arch(2.5,2.81,1.05,.6,'glass',.18,'glazing');sf.grouped(2.5,3.52,1.15,.73,3,1);sf.fb(0,4.55,.10,6.82,.15,.13,'brick');sf.fb(0,5.48,.12,6.85,.12,.20,'stone');sf.fb(0,5.25,.12,6.85,.23,.24,'brick');const holes=[-3,-2.25,-1.5,-.75,0,.75,1.75,2.5],edges=[-3.42,...holes.flatMap(u=>[u-.17,u+.17]),3.42];for(let i=0;i<edges.length;i+=2){const a=edges[i],q=edges[i+1];sf.fb((a+q)/2,4.82,.12,q-a,.43,.24,'brick','ajour-pier')}for(const u of [-3.25,-1.0,1.6,3.15])sf.arch(u,5.57,.34,.24,'stone',.12);
 // Rear garden probe must stay empty. No rectangular parcel slab or padded suppression.
}
