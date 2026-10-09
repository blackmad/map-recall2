import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {upwardRoofPlane} from '../landmarks/house-geometry';
import {nativeRoofEnvelope,roofStepSupport} from './roof-step-support.mjs';
import spec from './keizers575-spec.json';
type C=Parameters<BuildingTools['add']>[1];
export const probes:{label:string;point:number[];normal:number[];kind:string}[]=[];
export const roofGeometries:T.BufferGeometry[]=[];export const glassUndersideGeometries:T.BufferGeometry[]=[];export const roofAssemblyProbes:{label:string;point:number[];normal:number[];kind:string}[]=[];
/** Original texture-free sculpture/architecture guided by archived photographs.
 * Exact native roof cells own tops. Unobserved rear gaps remain unresolved. */
export function buildKeizers575(_w:number,_d:number,b:BuildingTools,includeSourceWalls=true,includeNativeProfiles=true){
 probes.length=0;roofGeometries.length=0;glassUndersideGeometries.length=0;roofAssemblyProbes.length=0;
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const shape=(r:number[][],holes:number[][][]=[])=>{const s=new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[1]))));return s;};
 const structuralRoofs=[...spec.roofs.filter(r=>!spec.chimneyProxyDecision.excludeSupportSurfaces.includes(r.surface)),...spec.chimneyRoofReplacements];
 for(const raw of structuralRoofs){const override=spec.roofGlazing.visibleProfileOverrides.find(p=>p.surface===raw.surface),r=override?{...raw,plane:override.plane}:raw;const cut=spec.roofGlazing.opaqueTopCutouts.find(c=>c.roofRecordIndex===spec.roofs.indexOf(raw as any)),pieces=cut?cut.fragments:[r];for(const piece of pieces){const g=upwardRoofPlane(shape(piece.ring,piece.holes)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,r.plane[0]*p.getX(i)+r.plane[1]*p.getZ(i)+r.plane[2]);g.computeVertexNormals();roofGeometries.push(g);const range=(r as any).sourceHeightRange??(r as any).observedHeightRange??[18,23];add(g,spec.roofGlazing.directSurveySurfaceIds.includes(r.surface)?'glass':range[1]-range[0]>.5&&range[1]>18?'slate':'roof');}}
 const regions=structuralRoofs.map((r,i)=>({sourceRegionIndex:i,ring:r.ring.map(p=>[p[0],r.plane[0]*p[0]+r.plane[1]*p[1]+r.plane[2],p[1]])}));
 const perimeter=nativeRoofEnvelope(regions,spec.nativeRing,spec.nativeRing.map((_,i)=>i),'brick',{boundedHeights:true});for(let i=0;i<perimeter.groups.length;i++){const item=perimeter.groups[i],normal=perimeter.report[i].outwardNormalXZ;item.geometry.translate(-normal[0]*.018,0,-normal[1]*.018);add(item.geometry,item.color);}
 const steps=roofStepSupport(regions,spec.nativeRing,{intervalMetres:1,adjacencyToleranceMetres:.15,color:'brick'});for(const g of steps.groups)add(g.geometry,g.color);
 if(includeSourceWalls)for(const wall of spec.sourceInteriorWalls){if(!wall.triangles.length)continue;const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(wall.triangles.flat(),3));g.computeVertexNormals();add(g,[25,37,38,120,121,123,124,169,176,183,194,202].includes(wall.rawWallIndex)?'slate':'brick');}
if(includeSourceWalls&&includeNativeProfiles)for(const wall of spec.nativeSourceWallProfiles){const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(wall.triangles.flat(),3));g.computeVertexNormals();add(g,wall.nativeEdge>=8&&wall.nativeEdge<=12?'slate':'brick');if(wall.rawWallIndex===20&&wall.nativeEdge===3){const vertices:number[]=[];for(let i=0;i<wall.triangles.length;i+=3)for(const j of[0,2,1]){const p=wall.triangles[i+j];vertices.push(p[0]-wall.normal[0]*.01,p[1],p[2]-wall.normal[2]*.01);}const backing=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3));backing.computeVertexNormals();add(backing,'brick');}}
// Visible229roof raised from laser-penetrated interior toe to measured rim.
 // Close only its sourcefield edge interval with glass/support posts; retain
 // original lower profiles inside. No opaque plate or footprint expansion.
 for(const profile of spec.roofGlazing.visibleProfileOverrides){const owner=spec.roofs.find(r=>r.surface===profile.surface&&r.role==='survey-roof-owner')!,ring=owner.ring,area=ring.reduce((s,a,i)=>s+a[0]*ring[(i+1)%ring.length][1]-a[1]*ring[(i+1)%ring.length][0],0),at=(plane:number[],p:number[])=>plane[0]*p[0]+plane[1]*p[1]+plane[2];for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],L=Math.hypot(q[0]-a[0],q[1]-a[1]);if(L<.02)continue;const loA=at(profile.originalPlane,a),loB=at(profile.originalPlane,q),hiA=at(profile.plane,a),hiB=at(profile.plane,q);if(hiA-loA<.01&&hiB-loB<.01)continue;const n=area>0?[(q[1]-a[1])/L,-(q[0]-a[0])/L]:[-(q[1]-a[1])/L,(q[0]-a[0])/L],points=[[a[0],loA,a[1]],[q[0],loB,q[1]],[q[0],hiB,q[1]],[a[0],hiA,a[1]]],normal=new T.Vector3(...points[1] as[number,number,number]).sub(new T.Vector3(...points[0] as[number,number,number])).cross(new T.Vector3(...points[2] as[number,number,number]).sub(new T.Vector3(...points[0] as[number,number,number]))),order=normal.x*n[0]+normal.z*n[1]>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],values=order.flatMap(j=>points[j]),g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();add(g,'glass');const count=Math.max(1,Math.ceil(L/.95));for(let k=0;k<=count;k++){const f=k/count,p=[a[0]+(q[0]-a[0])*f,a[1]+(q[1]-a[1])*f],low=at(profile.originalPlane,p),high=at(profile.plane,p);if(high-low<.12)continue;add(new T.CylinderGeometry(.025,.025,high-low,4),'white',p[0]+n[0]*.025,(low+high)/2,p[1]+n[1]*.025);}}}
 for(const field of spec.roofGlazing.assemblies){const at=(x:number,z:number)=>field.plane[0]*x+field.plane[1]*z+field.plane[2],normal=new T.Vector3(-field.plane[0],1,-field.plane[1]).normalize();
  // Model-local12mm glass thickness. Explicit downward undersides remain
  // inside observed pane footprints; exporter/global culling defaults stay.
  const underside=upwardRoofPlane(shape(field.ring,field.holes)),bottom=underside.getAttribute('position');for(let i=0;i<bottom.count;i++)bottom.setY(i,at(bottom.getX(i),bottom.getZ(i))-.012);const ids=underside.index!;for(let i=0;i<ids.count;i+=3){const j=ids.getX(i+1);ids.setX(i+1,ids.getX(i+2));ids.setX(i+2,j);}underside.computeVertexNormals();glassUndersideGeometries.push(underside);add(underside,'glass');
  for(const ring of[field.ring,...field.holes]){const area=ring.reduce((s,a,i)=>s+a[0]*ring[(i+1)%ring.length][1]-a[1]*ring[(i+1)%ring.length][0],0),values:number[]=[];for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],ha=at(a[0],a[1]),hq=at(q[0],q[1]),points=[[a[0],ha-.012,a[1]],[q[0],hq-.012,q[1]],[q[0],hq,q[1]],[a[0],ha,a[1]]],order=area>0?[0,2,1,0,3,2]:[0,1,2,0,2,3];values.push(...order.flatMap(j=>points[j]));}const edge=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(values,3));edge.computeVertexNormals();add(edge,'glass');}
  if(field.id.startsWith('west-')){const g=upwardRoofPlane(shape(field.ring,field.holes)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,at(p.getX(i),p.getZ(i)));g.computeVertexNormals();roofGeometries.push(g);add(g,'glass');}
  // Original 45mm structural relief: closed pale frame extrusions own their
  // surfaces above pane planes. Every plan vertex remains in its source field.
  for(const frame of field.frames){const g=new T.ExtrudeGeometry(shape(frame.ring,frame.holes),{depth:.045,bevelEnabled:false});g.rotateX(Math.PI/2);const original=g.index?g.toNonIndexed():g,p=original.getAttribute('position'),n=original.getAttribute('normal'),values:number[]=[],normals:number[]=[];for(let i=0;i<p.count;i+=3){if(n.getY(i)<-.9)continue;for(let j=0;j<3;j++){values.push(p.getX(i+j),at(p.getX(i+j),p.getZ(i+j))+.085+p.getY(i+j),p.getZ(i+j));normals.push(...(n.getY(i+j)>.9?normal.toArray():[n.getX(i+j),n.getY(i+j),n.getZ(i+j)]));}}const relief=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(values,3));relief.setAttribute('normal',new T.Float32BufferAttribute(normals,3));add(relief,'white');}
  for(const[k,pp]of field.paneProbes.entries())roofAssemblyProbes.push({label:field.id+'-pane-'+k,point:[pp[0],at(pp[0],pp[1]),pp[1]],normal:normal.toArray(),kind:'glass'});
  for(const[k,pp]of field.frameProbes.entries())roofAssemblyProbes.push({label:field.id+'-frame-'+k,point:[pp[0],at(pp[0],pp[1])+.085,pp[1]],normal:normal.toArray(),kind:'white'});
 }
 function facade(start:number,end:number){
  const a=spec.nativeRing[start],q=spec.nativeRing[end],L=Math.hypot(q[0]-a[0],q[1]-a[1]),t=[(q[0]-a[0])/L,(q[1]-a[1])/L],n=[-t[1],t[0]],angle=Math.atan2(-t[1],t[0]);
  const offset=(u:number)=>{for(let e=start;e<end;e++){const p=spec.nativeRing[e],q=spec.nativeRing[e+1],u0=(p[0]-a[0])*t[0]+(p[1]-a[1])*t[1],u1=(q[0]-a[0])*t[0]+(q[1]-a[1])*t[1];if(u>=Math.min(u0,u1)-.001&&u<=Math.max(u0,u1)+.001&&Math.abs(u1-u0)>.02){const f=(u-u0)/(u1-u0);return(p[0]+(q[0]-p[0])*f-a[0])*n[0]+(p[1]+(q[1]-p[1])*f-a[1])*n[1];}}return 0;};
  let overrideOffset:number|undefined;
  const pt=(u:number,y:number,d:number)=>[a[0]+t[0]*u+n[0]*(d+(overrideOffset??offset(u))),y,a[1]+t[1]*u+n[1]*(d+(overrideOffset??offset(u)))];
  const box=(u:number,y:number,w:number,h:number,dep:number,c:C,d=.22)=>add(new T.BoxGeometry(w,h,dep),c,...pt(u,y+h/2,d) as[number,number,number],angle);
  const poly=(vs:number[][],c:C,d=.24)=>{const indices=T.ShapeUtils.triangulateShape(vs.map(p=>new T.Vector2(...p as[number,number])),[]),points=vs.map(([u,y])=>pt(u,y,d)),g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(indices.flatMap(ids=>ids.flatMap(i=>points[i])),3));g.computeVertexNormals();if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(new T.Vector3(n[0],0,n[1]))<0){const p=g.getAttribute('position');for(let i=0;i<p.count;i+=3){const x=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)];p.setXYZ(i+1,p.getX(i+2),p.getY(i+2),p.getZ(i+2));p.setXYZ(i+2,...x as[number,number,number]);}g.computeVertexNormals();}add(g,c);};
  const panel=(u:number,y:number,w:number,h:number,c:C,d=.23)=>poly([[u-w/2,y],[u+w/2,y],[u+w/2,y+h],[u-w/2,y+h]],c,d);
  const line=(ps:number[][],c:C,r=.045,d=.36)=>{const curve=new T.CatmullRomCurve3(ps.map(([u,y])=>new T.Vector3(...pt(u,y,d) as[number,number,number])));add(new T.TubeGeometry(curve,Math.max(3,ps.length*2),r,4,false),c);};
  const probe=(label:string,u:number,y:number,d:number,kind='glass')=>probes.push({label,point:pt(u,y,d),normal:[n[0],0,n[1]],kind});
  function window(label:string,u:number,y:number,w:number,h:number,cols=2,rows=4,d=.27){overrideOffset=Math.max(offset(u-w/2-.1),offset(u),offset(u+w/2+.1));panel(u,y,w+.20,h+.17,'stone',d);panel(u,y+.07,w,h-.01,'glass',d+.025);for(const x of[-1,1])panel(u+x*(w/2-.04),y+.05,.08,h,'white',d+.055);for(const yy of[y+.07,y+h-.07])panel(u,yy,w,.08,'white',d+.055);for(let c=1;c<cols;c++)panel(u-w/2+w*c/cols,y+.07,c===cols/2?.075:.038,h-.02,'white',d+.055);for(let row=1;row<rows;row++)panel(u,y+h*row/rows,w,row===Math.round(rows*.7)?.08:.034,'white',d+.055);for(const frac of[.17,.83])probe(label+'-'+frac,u+(frac-.5)*w,y+h*.47,d+.026);overrideOffset=undefined;}
  function arch(label:string,u:number,y:number,w:number,h:number,d=.27){const rad=w/2,base=y+h-rad,outer:number[][]=[[u-w/2,y],[u+w/2,y]];for(let k=0;k<=12;k++){const an=Math.PI*k/12;outer.push([u+rad*Math.cos(an),base+rad*Math.sin(an)]);}poly(outer,'glass',d);line(Array.from({length:13},(_,k)=>{const an=Math.PI*k/12;return[u+rad*Math.cos(an),base+rad*Math.sin(an)];}),'stone',.075,d+.065);for(const x of[-1,1])panel(u+x*(w/2-.035),y,.07,h-rad,'white',d+.052);panel(u,y,w,.085,'white',d+.05);panel(u,base,w,.07,'white',d+.05);panel(u,y,.05,h-rad,'white',d+.05);panel(u,y+(h-rad)/2,w,.04,'white',d+.05);probe(label,u-w*.19,y+(h-rad)*.39,d+.006);}
  const cornice=(y:number,w=L,u=L/2)=>{box(u,y,w,.17,.40,'stone',.25);box(u,y+.18,w,.13,.56,'stone',.30);};
  const relief=(u:number,y:number,w:number,h:number)=>{panel(u,y,w,h,'stone',.31);line([[u-w*.35,y+h*.70],[u-w*.2,y+h*.30],[u,y+h*.16],[u+w*.2,y+h*.30],[u+w*.35,y+h*.70]],'relief',.085,.37);for(const x of[-.34,.34]){line([[u+x*w,y+h*.78],[u+x*w-.10,y+h*.51],[u+x*w+.08,y+h*.32]],'relief',.075,.38);}};
  const pediment=(u:number,y:number,w:number,h:number,d=.4)=>{poly([[u-w/2,y],[u+w/2,y],[u,y+h]],'stone',d);line([[u-w/2,y],[u,y+h],[u+w/2,y]],'stone',.16,d+.10);box(u,y-.08,w,.17,.5,'stone',d);};
  const nativeBacking=(y:number,h:number,c:C,d=.13)=>{for(let e=start;e<end;e++){const p=spec.nativeRing[e],q=spec.nativeRing[e+1],u0=(p[0]-a[0])*t[0]+(p[1]-a[1])*t[1],u1=(q[0]-a[0])*t[0]+(q[1]-a[1])*t[1],points=[[p[0]+n[0]*d,y,p[1]+n[1]*d],[q[0]+n[0]*d,y,q[1]+n[1]*d],[q[0]+n[0]*d,y+h,q[1]+n[1]*d],[p[0]+n[0]*d,y+h,p[1]+n[1]*d]],g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>points[i]),3));g.computeVertexNormals();if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(new T.Vector3(n[0],0,n[1]))<0){g.setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>points[i]),3));g.computeVertexNormals();}add(g,c);}};
  return{L,pt,box,panel,line,probe,window,arch,cornice,relief,pediment,nativeBacking};
 }
 const west=facade(7,8),W=west.L,p=W/5;
 // Venetian facade: one recessed central strip; four distinct levels, five bays.
 west.panel(W/2,.1,p-.1,15.65,'insetBrick',.075);
 for(const y of[.35,3.77,5.14,9.53,12.50,15.58])west.cornice(y);
 for(let i=0;i<5;i++){const u=(i+.5)*p;
  if(i===2){west.window('west-ground-entry',u,.30,1.6,3.10,2,3,.28);for(const dx of[-1,1]){west.box(u+dx*.94,.22,.16,3.45,.2,'stone',.38);west.box(u+dx*.94,3.35,.32,.20,.29,'stone',.4);}}
  else west.window('west-ground-'+i,u,.67,1.9,2.72,3,3);
  west.window('west-ogee-'+i,u,5.55,i===2?1.82:1.92,3.51,2,5,i===2?.18:.27);
  const z=i===2?.23:.36;west.line([[u-1.03,9.17],[u-.72,9.24],[u-.38,9.30],[u,9.68],[u+.38,9.30],[u+.72,9.24],[u+1.03,9.17]],'stone',.08,z);
  if(i===2)west.arch('west-mid-center',u,10.0,1.80,2.03,.19);else for(const dx of[-.50,.50])west.arch('west-mid-pair-'+i+'-'+dx,u+dx,10.0,.88,2.10);
  for(const dx of[-.50,.50])west.arch('west-top-pair-'+i+'-'+dx,u+dx,13.04,.88,2.12,i===2?.18:.27);
  // Shallow tracery frieze survives as pierced dark field and pale linked arches.
  west.panel(u,4.16,p-.23,.69,'insetBrick',.25);for(let k=-1;k<=1;k++){const x=u+k*.64;west.line([[x-.26,4.21],[x-.26,4.55],[x,4.78],[x+.26,4.55],[x+.26,4.21]],'stone',.035,.32);west.line([[x-.20,4.60],[x,4.29],[x+.20,4.60]],'stone',.032,.33);}
 }
 west.line([[W/2-1.1,3.43],[W/2-.73,3.57],[W/2,4.04],[W/2+.73,3.57],[W/2+1.1,3.43]],'stone',.1,.40);
 west.panel(W/2,15.98,W,.54,'stone',.26);for(let u=.25;u<W;u+=.67){west.line([[u-.25,16.07],[u,16.41],[u+.25,16.07]],'relief',.038,.34);}
 for(const u of[.12,p*2,p*3,W-.12]){west.box(u,15.7,.30,1.14,.34,'stone',.32);const g=new T.ConeGeometry(.25,.3,4);add(g,'stone',...west.pt(u,16.97,.32) as[number,number,number]);}
 const east=facade(8,13),E=east.L;
 const axes=[2.76,7.32,11.10,14.90,19.58],levels=[[4.46,4.17,7],[10.10,3.10,5],[14.56,2.74,4]];
 east.nativeBacking(.05,4.15,'stone',.14);for(const u of[.25,2.08,5.66,6.4,9.82,12.46,16.04,17.0,18.05,21.85])for(const y of[.45,3.8])east.probe('east-continuous-stone-'+u+'-'+y,u,y,.141,'stone');east.cornice(4.17);east.cornice(17.69);east.panel(E/2,18.0,E,.97,'stone',.26);east.cornice(19.02);
 for(let row=0;row<3;row++){const[y,h,rows]=levels[row];for(let i=0;i<5;i++){const u=axes[i];if(i===0||i===4){const ww=4.43;east.panel(u,y-.12,ww+.28,h+.28,'stone',.22);for(let k=0;k<4;k++){const off=(k-1.5)*ww/4,d=k===0||k===3?.34:.52;east.window('east-broad-'+row+'-'+i+'-'+k,u+off,y,ww/4-.04,h,2,rows,d);}east.box(u,y-.15,ww+.40,.12,.74,'stone',.30);}
   else east.window('east-single-'+row+'-'+i,u,y,2.05,h,2,rows,.37);
  }}
 // Four giant Ionic pilasters with stone backing and brick shafts.
 for(const u of[5.40,9.25,13.02,16.78]){east.box(u,4.44,.67,12.87,.20,'stone',.31);east.box(u,4.75,.49,12.45,.19,'brick',.45);east.box(u,4.41,.87,.27,.43,'stone',.37);east.box(u,17.16,.98,.33,.41,'stone',.4);for(const dx of[-.38,.38]){east.line(Array.from({length:17},(_,k)=>{const a=k*Math.PI/6,r=.14*(1-k/22);return[u+dx+r*Math.cos(a),17.37+r*Math.sin(a)];}),'relief',.027,.64);}}
 for(const u of[7.32,11.10,14.90])for(const y of[9.12,13.58])east.relief(u,y,2.14,.64);
 for(let k=0;k<7;k++){const u=5.45+k*1.86;east.box(u,18.14,.46,.59,.18,'stone',.43);for(const dx of[-.13,0,.13])east.panel(u+dx,18.19,.025,.48,'relief',.54);}
 east.pediment(11.10,19.27,13.25,2.53,.48);
 // Native low-relief floral/scrolled pediment, approximate carving detail.
 for(const off of[-1,1]){const u=11.1+off*.63;east.line(Array.from({length:25},(_,k)=>{const a=k*Math.PI/12;return[u+.53*Math.cos(a),20.10+.41*Math.sin(a)];}),'relief',.075,.61);east.line([[u,20.09],[u+off*.9,20.39],[u+off*1.6,20.05],[u+off*2.8,19.8],[u+off*4,19.65]],'relief',.078,.61);for(let k=0;k<6;k++)east.line([[u+off*(1+k*.48),19.78],[u+off*(1.13+k*.48),20.08-k*.045],[u+off*(1.36+k*.48),19.78]],'relief',.055,.62);}
 // Ground current reference: three doors and three barred groups, offset bays.
 for(const [i,u]of[4.05,8.24,14.30].entries()){const probeStart=probes.length;east.window('east-ground-barred-'+i,u,.86,2.66,2.42,4,4,.28);probes.splice(probeStart);east.probe('east-ground-barred-'+i,u+.15,1.87,.306);for(let x=-1.2;x<=1.21;x+=.3)east.box(u+x,.86,.045,2.55,.07,'iron',.55);for(const y of[1.12,2.45])east.box(u,y,2.72,.055,.08,'iron',.56);}
 for(const [i,u]of[1.03,11.12,20.08].entries()){east.panel(u,.13,i===2?3.02:i===1?2.04:1.16,3.47,'dark',.29);east.probe('east-door-'+i,u+.16,1.43,.292,'dark');if(i!==2)east.box(u,.21,.06,3.24,.10,'iron',.37);}
 // Two current dormers on the actual short steep front roof, behind facade.
 for(const u of[2.64,19.57]){east.box(u,19.33,2.20,2.10,.85,'stone',-.35);east.window('east-dormer-'+u,u,19.56,1.72,1.63,4,3,.08);east.cornice(21.35,2.35,u);east.line([[u-1,21.56],[u-.7,22.14],[u,22.35],[u+.7,22.14],[u+1,21.56]],'stone',.10,.12);}
 // Four distinct finial stacks: photo spacing; elevations bounded by source.
 // Tiny surveyed chimney roofs remain explicit source tops, never tall slabs.
 for(const u of[.63,6.80,14.07,21.74]){east.box(u,23.1,.77,1.0,.73,'brick',-2.83);east.box(u,24.05,1.04,.32,1.04,'stone',-2.83);for(const dx of[-.36,.36])east.box(u+dx,24.39,.12,.40,.74,'stone',-2.83);east.box(u,24.8,1.23,.17,1.20,'copper',-2.83);const g=new T.ConeGeometry(.68,.20,4);g.rotateY(Math.PI/4);add(g,'copper',...east.pt(u,25.07,-2.83) as[number,number,number]);const fin=new T.SphereGeometry(.12,6,4);fin.scale(1,1.8,1);add(fin,'copper',...east.pt(u,25.43,-2.83) as[number,number,number]);}
 // Current commercial sign omitted pending faithful native font outlines.
 // Rear apertures are unknown; no invented hidden window grid.
}
