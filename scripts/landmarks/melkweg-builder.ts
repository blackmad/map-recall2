import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import survey from './melkweg-footprints.json';
import ownership from './melkweg-top-ownership.json';
type P=[number,number];type C=Parameters<BuildingTools['add']>[1];
/** Original measured-outline reconstruction; no source mesh triangles/photo pixels. Native east/south metres. */
export function buildMelkweg(_w:number,_d:number,b:BuildingTools){
 const put=(g:T.BufferGeometry,c:C,name:string)=>{g.name=name;b.add(g,c)};
 const shape=(ring:number[][],holes:number[][][]=[])=>{const s=new T.Shape(ring.map(p=>new T.Vector2(...p as P)));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(...p as P))));return s;};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:C,name:string,angle=0)=>{const g=new T.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y+h/2,z);put(g,c,name);};
 const frontBasis=(a:number[],bb:number[])=>{const dx=bb[0]-a[0],dz=bb[1]-a[1],L=Math.hypot(dx,dz);return{L,u:[dx/L,dz/L]as P,n:[-dz/L,dx/L]as P,angle:Math.atan2(-dz,dx)};};
 const facade=(a:number[],bb:number[],tag:string)=>{const f=frontBasis(a,bb);const pos=(u:number,o=0):P=>{let x=a[0]+f.u[0]*u,z=a[1]+f.u[1]*u;if(['canal-low','canal-left'].includes(tag)){const chain=tag==='canal-low'?survey.exactBagRing.slice(23,25):tag==='canal-entry'?survey.exactBagRing.slice(21,23):survey.exactBagRing.slice(17,21);for(let i=0;i<chain.length-1;i++){const A=chain[i],B=chain[i+1],ua=(A[0]-a[0])*f.u[0]+(A[1]-a[1])*f.u[1],ub=(B[0]-a[0])*f.u[0]+(B[1]-a[1])*f.u[1];if(u>=Math.min(ua,ub)&&u<=Math.max(ua,ub)){const t=(u-ua)/(ub-ua);x=A[0]+t*(B[0]-A[0]);z=A[1]+t*(B[1]-A[1]);break;}}}return[x+f.n[0]*o,z+f.n[1]*o];};return{...f,pos,box:(u:number,y:number,w:number,h:number,dep:number,c:C,name:string,o=.12)=>{const[x,z]=pos(u,o);box(x,y,z,w,h,dep,c,tag+'-'+name,f.angle);}};};
 for(const part of survey.parts){
  const s=shape(part.ring,part.holes),pts=part.ring;
  let a=pts[0],bb=pts[1];if(part.id.startsWith('marnix-house')){const f=survey.marnixFront.find(f=>part.id.includes(String(f.id)))!;a=f.a;bb=f.b;}
  if(part.id.startsWith('canal')){const f=survey.canalFront.find(f=>part.id.startsWith(f.id));if(f){a=f.a;bb=f.b;}}
  if(part.id==='central-pitched-hall'){a=[-9,1];bb=[8,-5];}
  const f=frontBasis(a,bb),uv=pts.map(p=>[(p[0]-a[0])*f.u[0]+(p[1]-a[1])*f.u[1],(p[0]-a[0])*(-f.n[0])+(p[1]-a[1])*(-f.n[1])]);
  const mn=Math.min(...uv.map(p=>p[0])),mx=Math.max(...uv.map(p=>p[0])),dn=Math.min(...uv.map(p=>p[1])),dx=Math.max(...uv.map(p=>p[1]));
  const crest=part.crest??part.eave,roofY=(x:number,z:number)=>{const u=(x-a[0])*f.u[0]+(z-a[1])*f.u[1],v=(x-a[0])*(-f.n[0])+(z-a[1])*(-f.n[1]);if('roofPlane'in part){const q=part.roofPlane as number[];return q[0]*x+q[1]*z+q[2];}let k=0;if(part.roof==='gable')k=1-Math.abs(2*(u-mn)/(mx-mn)-1);if(part.roof==='side-gable')k=1-Math.abs(2*(v-dn)/(dx-dn)-1);if(part.roof==='hip')k=Math.min(1-Math.abs(2*(u-mn)/(mx-mn)-1),1-Math.abs(2*(v-dn)/(dx-dn)-1));return part.eave+Math.max(0,k)*(crest-part.eave);};
  let wall=openTopPrism(s,part.bottom,part.eave);
  // Explicit source-plan foyer ceiling owns these caps; the hall extrusion retains walls only.
  if(ownership.shellBottomOwnedByCeiling.includes(part.id)){const p=wall.getAttribute('position'),n=wall.getAttribute('normal'),values:number[]=[];for(let i=0;i<p.count;i+=3){if([0,1,2].every(j=>n.getY(i+j)<-.9))continue;for(let j=0;j<3;j++)values.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));}wall.dispose();wall=new T.BufferGeometry();wall.setAttribute('position',new T.Float32BufferAttribute(values,3));}
  const wp=wall.getAttribute('position');for(let i=0;i<wp.count;i++)if(Math.abs(wp.getY(i)-part.eave)<.001)wp.setY(i,roofY(wp.getX(i),wp.getZ(i)));wall.computeVertexNormals();
  put(wall,('wallColour'in part?part.wallColour:'brick') as C,part.id+'-shell');
  for(const facet of ((ownership.roofOverrides as Record<string,{ring:number[][],holes:number[][][]}[]>)[part.id]??part.roofFacets)){const roof=upwardRoofPlane(shape(facet.ring,facet.holes),part.eave),rp=roof.getAttribute('position');for(let i=0;i<rp.count;i++)rp.setY(i,roofY(rp.getX(i),rp.getZ(i)));const flat=roof.toNonIndexed(),fp=flat.getAttribute('position'),values:number[]=[];for(let i=0;i<fp.count;i+=3){const ps=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(fp,i+j));const cross=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0]));if(cross.y<.02)continue;for(const p of ps)values.push(...p.toArray());}const clean=new T.BufferGeometry();clean.setAttribute('position',new T.Float32BufferAttribute(values,3));clean.computeVertexNormals();put(clean,'slate',part.id+'-roof');flat.dispose();roof.dispose();}
 }
 const pane=(f:ReturnType<typeof facade>,u:number,y:number,w:number,h:number,cols=2,rows=2,white=false)=>{f.box(u,y,w,h,.05,'glass','glazing');const frame:C=white?'white':'dark';f.box(u,y-.055,w+.14,.11,.11,frame,'sill');f.box(u,y+h-.02,w+.12,.1,.11,frame,'head');for(let c=0;c<=cols;c++)f.box(u-w/2+c*w/cols,y,.065,h,.11,frame,'mullion');for(let r=1;r<rows;r++)f.box(u,y+r*h/rows,w,.055,.11,frame,'transom');};
 const arch=(f:ReturnType<typeof facade>,u:number,y:number,w:number,h:number,c:C='stone',infill=false)=>{const rad=w/2;if(infill){const s=new T.Shape();s.moveTo(-rad,0);s.lineTo(rad,0);s.lineTo(rad,h-rad);s.absarc(0,h-rad,rad,0,Math.PI,false);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.04,bevelEnabled:false});g.rotateY(f.angle);const[x,z]=f.pos(u,.04);g.translate(x,y,z);put(g,'greyBrick','brick-arch-infill');}for(let i=0;i<13;i++){const an=Math.PI*i/12;const[x,z]=f.pos(u+Math.cos(an)*rad,.065);const g=new T.BoxGeometry(.19,.19,.11);g.rotateZ(an-Math.PI/2);g.rotateY(f.angle);g.translate(x,y+h-rad+Math.sin(an)*rad,z);put(g,c,'arched-keystone-band');}};
 // Canal low industrial wing: actual bricked-up round arches, dark doors and shallow brick frieze.
 const low=survey.canalFront[0],lf=facade(low.a,low.b,'canal-low');
 for(const[u,w,door]of [[1.3,1.15,true],[2.9,1.15,false],[5.45,1.8,true],[8.5,1.15,true],[10.0,1.15,false],[13.2,1.8,true],[16.05,1.15,false],[17.5,1.15,false]]as[number,number,boolean][]){arch(lf,u,.3,w,3.9,'stone',true);if(door)lf.box(u,.1,w*.87,1.9,.09,'dark','door');lf.box(u,4.12,.28,.42,.13,'stone','keystone');}
 lf.box(lf.L/2,4.73,lf.L,.12,.17,'brick','frieze');lf.box(lf.L/2,5.58,lf.L+.05,.13,.19,'stone','eaves');
 for(let u=2;u<lf.L;u+=3.2){lf.box(u,4.9,.07,.46,.13,'dark','iron-tie');lf.box(u,5.05,.35,.06,.13,'dark','iron-tie-crossbar');}
 // Main entrance gable: three exposed industrial windows, flat multi-point stars and oculus.
 const ent=survey.canalFront[1],ef=facade(ent.a,ent.b,'canal-entry');
 const gs=new T.Shape([new T.Vector2(-ef.L/2,10.28),new T.Vector2((survey.canalVestibule.ridgePoint[0]-ent.a[0])*ef.u[0]+(survey.canalVestibule.ridgePoint[1]-ent.a[1])*ef.u[1]-ef.L/2,16.02),new T.Vector2(ef.L/2,10.28)]);const gg=new T.ExtrudeGeometry(gs,{depth:.07,bevelEnabled:false});gg.rotateY(ef.angle);const[ggx,ggz]=ef.pos(ef.L/2,-.06);gg.translate(ggx,0,ggz);put(gg,'brick','entrance-solid-triangular-gable');
 for(const u of[ef.L*.18,ef.L*.5,ef.L*.82])pane(ef,u,5.3,ef.L*.225,3.15,4,4);
 const[xo,zo]=ef.pos(ef.L/2,.25),oc=new T.RingGeometry(.44,.59,32);oc.rotateY(ef.angle);oc.translate(xo,11.22,zo);put(oc,'stone','entrance-oculus-ring');const disk=new T.CircleGeometry(.44,32);disk.rotateY(ef.angle);disk.translate(xo,11.22,zo);put(disk,'glass','entrance-oculus-glass');
 for(const[u,y]of [[.75,9.5],[2.1,10.4],[2.5,12.4],[3.75,13.25],[4.5,14.6],[5.8,13.3],[6.8,12.4],[7.3,10.4],[8.25,9.5]]){const s=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.095:.25;const p=[Math.cos(a)*r,Math.sin(a)*r];i?s.lineTo(...p as P):s.moveTo(...p as P);}s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.025,bevelEnabled:false});g.rotateY(ef.angle);const[x,z]=ef.pos(u*ef.L/9,.25);g.translate(x,y,z);put(g,'stone','flat-five-point-gable-star');}
 // Thin approximate connected script follows observed real wall sign, no invented block label.
 const script:number[][][]=[[[0,0],[.15,1],[.35,.12],[.7,1],[.75,.1]],[[.8,.15],[1,.5],[1.25,.55],[1.15,.3],[.9,.25],[1,.08],[1.3,.2]],[[1.35,.2],[1.65,1.2],[1.45,.55],[1.4,.1],[1.7,.15]],[[1.72,.15],[1.9,1.15],[1.8,.45],[2.18,.75],[1.8,.4],[2.1,.12]],[[2.1,.18],[2.3,.6],[2.3,.1],[2.5,.55],[2.55,.12],[2.8,.6],[2.9,.17]],[[2.88,.18],[3.1,.55],[3.35,.55],[3.22,.3],[2.99,.3],[3.15,.1],[3.45,.18]],[[3.44,.16],[3.65,.6],[3.92,.6],[3.75,.15],[3.52,.2],[3.8,.55],[3.65,-.5],[3.4,-.35],[3.95,-.1]]];
 for(const points of script){const curve=new T.CatmullRomCurve3(points.map(([u,y])=>{const[x,z]=ef.pos(ef.L*.30+u*1.05,.27);return new T.Vector3(x,10+y*1.05,z);}));put(new T.TubeGeometry(curve,24,.025,4,false),'white','source-supported-approximate-script-sign');}
 // Glass vestibule fitted to entrance frontage; no parcel-wide canopy.
 const vf=facade(survey.canalVestibule.a,survey.canalVestibule.b,'canal-vestibule');for(const u of[vf.L*.18,vf.L*.5,vf.L*.82])pane(vf,u,.10,vf.L*.30,4.30,3,3);vf.box(vf.L/2,4.45,vf.L*.98,.20,.25,'dark','vestibule-header',.15);
 const flat=survey.canalFront[2],ff=facade(flat.a,flat.b,'canal-left');for(const u of[ff.L*.18,ff.L*.5,ff.L*.82])pane(ff,u,5.05,ff.L*.245,3.3,4,4);ff.box(ff.L/2,9.9,ff.L,.16,.2,'stone','cornice');for(let u=1.3;u<ff.L;u+=2.7){arch(ff,u,.3,1.65,3.65);pane(ff,u,.25,1.5,2.5,2,2);}
 // Marnix critical attic assemblies checked against municipal July2025 panorama.
 const profile=(f:ReturnType<typeof facade>,center:number,points:number[][],name:string,c:C='brick',offset=-.045)=>{const s=new T.Shape(points.map(p=>new T.Vector2(...p as P))),g=new T.ExtrudeGeometry(s,{depth:.10,bevelEnabled:false});g.rotateY(f.angle);const[x,z]=f.pos(center,offset);g.translate(x,0,z);put(g,c,name);};
 const pediment=(f:ReturnType<typeof facade>,u:number,y:number,w:number,h:number,name:string)=>{profile(f,u,[[-w/2,y],[0,y+h],[w/2,y]],name+'-stone-pediment','stone',.025);profile(f,u,[[-w*.39,y+.10],[0,y+h-.16],[w*.39,y+.10]],name+'-brick-pediment','brick',.14);f.box(u,y-.10,w+.18,.17,.19,'stone',name+'-cornice',.14);};
 const segmentHead=(f:ReturnType<typeof facade>,u:number,y:number,w:number,rise:number,name:string)=>{const R=w*w/(8*rise)+rise/2,edge=Math.sqrt(R*R-w*w/4);for(let i=0;i<=10;i++){const x=-w/2+w*i/10,h=Math.sqrt(Math.max(0,R*R-x*x))-edge,angle=Math.atan2(-x,Math.sqrt(Math.max(0,R*R-x*x)));const g=new T.BoxGeometry(.19,.16,.13);g.rotateZ(angle);g.rotateY(f.angle);const[X,Z]=f.pos(u+x,.11);g.translate(X,y+h,Z);put(g,i%3?'brick':'stone',name+'-segmented-head');}f.box(u,y+rise-.07,.23,.24,.16,'stone',name+'-keystone');};
 for(const front of survey.marnixFront){const f=facade(front.a,front.b,'marnix-'+front.id),wide=front.id===411,cols=wide?[f.L*.13,f.L*.375,f.L*.625,f.L*.87]:[f.L*.19,f.L*.5,f.L*.81];
  for(const [floor,y]of[4.8,8.6,12.4].entries())for(const u of cols){
   pane(f,u,y,1.35,2.7,2,2,true);
   if(wide){
    f.box(u,y+2.69,1.61,.25,.16,'stone','411-413-flat-lintel');
    for(const side of[-1,1])for(let row=0;row<5;row++)f.box(u+side*.79,y+.32+row*.48,.27,.17,.15,'stone','411-413-alternating-side-block');
   }else if(front.id===405&&floor===0){segmentHead(f,u,y+2.73,1.54,.28,'405-low');pediment(f,u,y+3.01,1.64,.25,'405-low-head');}
   else if(floor===1)segmentHead(f,u,y+2.72,1.55,.35,'marnix-'+front.id+'-middle');
   else{
    // Current405/407/409 upper round heads and407/409 lowest ornamental fan heads.
    arch(f,u,y+2.66,1.57,.85,'stone');
    if(floor===0&&front.id!==405){for(let k=0;k<5;k++){const an=(k+.5)*Math.PI/5;f.box(u+Math.cos(an)*.43,y+2.76+Math.sin(an)*.40,.11,.25,.13,'stone','carved-fan-simplification');}}
   }
   if(front.id===405&&Math.abs(u-f.L/2)<.05){
    // Three shallow source-supported iron balconies on the centre bay.
    f.box(u,y-.09,1.79,.11,.66,'stone','405-balcony-sill',.34);
    f.box(u,y+.85,1.78,.045,.055,'dark','405-balcony-top-rail',.66);
    for(let k=0;k<=8;k++)f.box(u-.84+k*.21,y,.04,.88,.045,'dark','405-balcony-baluster',.66);
    for(const side of[-1,1])f.box(u+side*.86,y,.045,.88,.64,'dark','405-balcony-return',.34);
   }
  }
  for(const y of[4.28,8.15,11.94,15.94,18.25])f.box(f.L/2,y,f.L,.12,.13,'stone','stringcourse');
  for(const u of cols)pane(f,u,.08,1.6,3.05,2,2,true);
  f.box(f.L/2,18.4,f.L+.05,.23,.2,'stone','cornice');
  if(front.id===405){
   // Narrow pedimented dormer stands in the tall mansard-like source roof, not a full-width step gable.
   f.box(f.L/2,18.55,1.95,3.20,1.4,'brick','405-dormer-shell',-.74);
   profile(f,f.L/2,[[-1.06,18.5],[-1.06,21.65],[1.06,21.65],[1.06,18.5]],'405-narrow-dormer-face');
   pane(f,f.L/2,18.86,1.20,2.18,2,2,true);arch(f,f.L/2,18.86,1.36,2.70,'stone');
   pediment(f,f.L/2,21.64,2.40,.88,'405');
   for(const u of[f.L/2-1.03,f.L/2+1.03])f.box(u,18.53,.18,3.0,.15,'stone','405-dormer-pilaster');
  }else if(front.id===407){
   // Three-window lower attic, stepped shoulders and a separate narrow pedimented upper pavilion.
   const w=f.L*.93;
   profile(f,f.L/2,[[-w/2,18.55],[-w/2,19.02],[-w*.40,19.02],[-w*.34,20.43],[-1.13,20.82],[-1.13,22.07],[1.13,22.07],[1.13,20.82],[w*.34,20.43],[w*.40,19.02],[w/2,19.02],[w/2,18.55]],'407-three-attic-upper-pavilion');
   for(const u of[f.L*.28,f.L*.5,f.L*.72])pane(f,u,18.86,.94,1.44,2,2,true);
   f.box(f.L/2,20.41,3.95,.20,.16,'stone','407-lower-attic-head');
   pane(f,f.L/2,21.0,.92,1.15,2,2,true);arch(f,f.L/2,21.0,1.10,1.47);
   pediment(f,f.L/2,22.08,2.63,.89,'407');
   for(const y of[20.73,21.81])f.box(f.L/2,y,2.28,.12,.17,'stone','407-upper-pavilion-band');
  }else if(front.id===409){
   // Richer staircase crown, grouped lower attic and a small arched upper opening.
   const w=f.L*.98;
   profile(f,f.L/2,[[-w/2,18.55],[-w/2,19.07],[-w*.42,19.07],[-w*.42,19.64],[-w*.34,19.64],[-w*.34,20.21],[-w*.27,20.21],[-w*.27,20.83],[-w*.20,20.83],[-w*.20,21.55],[-w*.13,21.55],[-w*.13,22.39],[-w*.065,22.39],[-w*.065,23.16],[w*.065,23.16],[w*.065,22.39],[w*.13,22.39],[w*.13,21.55],[w*.20,21.55],[w*.20,20.83],[w*.27,20.83],[w*.27,20.21],[w*.34,20.21],[w*.34,19.64],[w*.42,19.64],[w*.42,19.07],[w/2,19.07],[w/2,18.55]],'409-source-stepped-attic-crown');
   for(const[u,pw]of[[f.L/2-1.23,.68],[f.L/2,1.22],[f.L/2+1.23,.68]])pane(f,u,18.9,pw,1.52,2,2,true);
   pane(f,f.L/2,21.28,.72,1.05,1,2,true);arch(f,f.L/2,21.28,.87,1.41);
   for(const[y,wid]of[[19.06,w],[19.65,w*.83],[20.22,w*.67],[20.83,w*.52],[21.55,w*.40],[22.39,w*.26]]){f.box(f.L/2-wid/2+.14,y,.30,.105,.14,'stone','409-step-cap');f.box(f.L/2+wid/2-.14,y,.30,.105,.14,'stone','409-step-cap');}
   pediment(f,f.L/2,23.13,1.08,.37,'409-crown');
   for(const u of[f.L*.16,f.L*.84]){f.box(u,18.82,.06,.42,.11,'dark','409-iron-tie');f.box(u,18.96,.25,.05,.11,'dark','409-iron-tie-arm');}
  }else{
   // Shared411/413wide central two-window attic pavilion plus two flanking dormers.
   profile(f,f.L/2,[[-3.20,18.55],[-2.62,20.40],[-1.28,22.61],[-.42,23.57],[.42,23.57],[1.28,22.61],[2.62,20.40],[3.20,18.55]],'411-413-wide-paired-attic-pavilion');
   for(const u of[f.L/2-.76,f.L/2+.76]){pane(f,u,19.05,1.13,1.90,2,2,true);arch(f,u,19.05,1.30,2.26);}
   pediment(f,f.L/2,23.38,1.38,.44,'411-413-central-top');
   for(const[y,wid]of[[18.66,6.42],[20.42,5.22],[21.20,4.20],[21.98,3.22],[22.63,2.55]])f.box(f.L/2,y,wid,.115,.16,'stone','411-413-pavilion-band');
   for(const u of[f.L*.18,f.L*.82]){
    f.box(u,18.60,1.65,1.95,1.10,'stone','411-413-flank-dormer-body',-.59);
    profile(f,u,[[-.85,18.55],[-.85,20.46],[.85,20.46],[.85,18.55]],'411-413-flank-dormer-face','stone');
    pane(f,u,18.77,1.04,1.39,2,2,true);pediment(f,u,20.48,1.95,.51,'411-413-flank');
   }
  }
 }
 // Original source-supported shared-hall portion: raised metal volume over an inset glazed core.
 for(const part of survey.parts.filter(p=>p.id.startsWith('east-high-hall'))){
  const s=shape(part.ring,part.holes);put(openTopPrism(s,14.78,15.0),'dark',part.id+'-cantilever-floor-underside');
  put(upwardRoofPlane(s,15.0),'dark',part.id+'-cantilever-floor-top');
  put(upwardRoofPlane(s,18.3),'dark',part.id+'-foyer-ceiling');
 }
 for(const part of survey.parts.filter(p=>p.id.startsWith('modern-glazed-lower-core'))){
  for(let i=0;i<part.ring.length;i++){const A=part.ring[i],B=part.ring[(i+1)%part.ring.length],f=facade(A,B,'modern-core-'+i),bayCount=Math.max(1,Math.round(f.L/1.5));if(f.L<.75)continue;
   // The observed rehearsal/corridor glass has steel-framedtiers at the documented8m datum.
   for(const[y,h]of[[.12,3.78],[4.08,3.75],[10.35,.82],[11.38,3.37]])for(let bay=0;bay<bayCount;bay++)pane(f,(bay+.5)*f.L/bayCount,y,f.L/bayCount-.09,h,1,1);
   for(const y of[0,3.93,7.91,11.23,14.83])f.box(f.L/2,y,f.L,.16,.16,'dark','steel-floor-line');
  }
 }
 for(const edge of survey.modernHall.facadeEdges.filter(edge=>edge.id==='modern-canalside')){const f=facade(edge.a,edge.b,edge.id),bays=Math.max(2,Math.round(f.L/1.30));
  // The15m foyer outer glazing belongs to the adjoining73457 perimeter; this is its internal seam.
  f.box(f.L/2,14.84,f.L,.18,.25,'dark','foyer-under-edge');f.box(f.L/2,18.16,f.L,.13,.20,'dark','foyer-upper-edge');
  for(let u=.50;u<f.L;u+=.92)f.box(u,18.32,.055,13.67,.10,'dark','metal-corrugation-rib',.075);
  // Narrow photographed upper window strip, with approximateplacement within the measured hall height.
  for(let u=.78;u<f.L-.4;u+=.91)pane(f,u,20.40,.35,1.30,1,1);
 }
 // The photographed metal connection occupies the real step between low wing and entrance.
 const connector=facade(survey.exactBagRing[22],survey.exactBagRing[23],'canal-metal-connector');connector.box(connector.L/2,5.5,connector.L,5.77,.10,'frame','metal-panel');for(let u=.7;u<connector.L;u+=1.2)connector.box(u,5.5,.045,5.77,.13,'dark','panel-joint');

}
