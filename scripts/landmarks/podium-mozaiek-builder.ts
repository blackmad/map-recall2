import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import f from './podium-mozaiek-footprints.json';
/** Original native-scale Pniëlkerk reconstruction, based on current surveyed scope and dated photos. */
export function buildPodiumMozaiek(_w:number,_d:number,b:BuildingTools){
 type C=Parameters<BuildingTools['add']>[1];const v=f.surveyVertices.map(p=>new T.Vector3(...p));
 const pt=(id:number)=>new T.Vector2(v[id].x,v[id].z),shape=(r:T.Vector2[])=>new T.Shape(r);
 const pending:{g:T.BufferGeometry,c:C}[]=[];const add=(g:T.BufferGeometry,c:C,role:string)=>{g.userData.role=role;pending.push({g,c});};
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:C,role='detail'){add(new T.BoxGeometry(w,h,d).translate(x,y+h/2,z),c,role);}
 const church=[76,89,105,108].map(pt);
 add(openTopPrism(shape(f.localRing.map(p=>new T.Vector2(...p))),0,7.70),'white','full-native-scope-wall');
 add(openTopPrism(shape(church),7.70,9.0),'white','church-raised-wall');
 // Actual lower sloped roofs and eastern service-wing flat roof, from measured roof planes.
 for(const id of [3,4,5,8]){
  const r=f.surveyRoofs.find(p=>p.semantic===id)!.rings[0],ring=r.map(pt),g=upwardRoofPlane(shape(ring));
  const pos=g.getAttribute('position');const a=v[r[0]];let normal=new T.Vector3();for(let j=1;j<r.length-1;j++){const candidate=new T.Vector3().crossVectors(v[r[j]].clone().sub(a),v[r[j+1]].clone().sub(a));if(Math.abs(candidate.y)>Math.abs(normal.y))normal=candidate;}
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,a.y-(normal.x*(x-a.x)+normal.z*(z-a.z))/normal.y+.035);}
  g.computeVertexNormals();add(g,'slate','measured-lower-roof');
 }
 // Higher hall: retain characteristic shallow curved roof rather than a fabricated tower-height slab.
 const upper=[118,92,97,112,122,134].map(pt);// Continuous bounded central-hall walls begin at the annex roof datum. The lower aisle
 // roofs hide their lower portions; this closes the unsupported 9–11m eastern joining strips.
 add(openTopPrism(shape(upper),7.70,12.95),'white','clerestory-wall');
 const ridgeA=pt(118).lerp(pt(92),.5),ridgeB=pt(134).lerp(pt(122),.5),u=ridgeB.clone().sub(ridgeA).normalize(),n=new T.Vector2(-u.y,u.x),project=(p:T.Vector2)=>p.clone().sub(ridgeA).dot(n);
 const offsets=upper.map(project),lo=Math.min(...offsets),hi=Math.max(...offsets);const y=(p:T.Vector2)=>12.95+1.98*Math.sin(Math.PI*(project(p)-lo)/(hi-lo));
 // Triangulate bounded slices of the real higher footprint. Original curve follows photo silhouette.
 const clipped=(poly:T.Vector2[],value:number,keepHigh:boolean)=>{let out:T.Vector2[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],aa=project(a)-value,cc=project(c)-value,inside=(t:number)=>keepHigh?t>=-1e-8:t<=1e-8;if(inside(aa))out.push(a.clone());if(inside(aa)!==inside(cc))out.push(a.clone().lerp(c,aa/(aa-cc)));}return out;};
 for(let i=0;i<14;i++){const poly=clipped(clipped(upper,lo+(hi-lo)*i/14,true),lo+(hi-lo)*(i+1)/14,false);if(poly.length<3)continue;const g=upwardRoofPlane(shape(poly)),p=g.getAttribute('position');for(let j=0;j<p.count;j++)p.setY(j,y(new T.Vector2(p.getX(j),p.getZ(j))));g.computeVertexNormals();add(g,'slate','original-segmented-barrel-roof');}
 for(let edge=0;edge<upper.length;edge++){const a=upper[edge],c=upper[(edge+1)%upper.length];for(let i=0;i<18;i++){const p=a.clone().lerp(c,i/18),q=a.clone().lerp(c,(i+1)/18),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([p.x,12.95,p.y,q.x,12.95,q.y,q.x,y(q),q.y,p.x,y(p),p.y],3));g.setIndex([0,1,2,0,2,3,2,1,0,3,2,0]);g.computeVertexNormals();add(g,'white','curved-roof-support-endwall');}}
 // End-wall tympana directly support the curved roof; narrow vertical ribs match visible corrugation.
 for(const ids of [[118,92],[134,122]]){const a=pt(ids[0]),c=pt(ids[1]),delta=c.clone().sub(a),length=delta.length(),axis=delta.clone().normalize();for(let i=0;i<48;i++){const p=a.clone().addScaledVector(axis,(i+.5)*length/48),h=Math.max(.03,y(p)-12.93);const g=new T.BoxGeometry(length/48+.002,h,.11);g.rotateY(-Math.atan2(axis.y,axis.x));g.translate(p.x,12.93+h/2,p.y);add(g,i%2?'white':'frame','curved-end-vertical-rib');}}
 function facade(a:T.Vector2,c:T.Vector2,base:number,height:number,kind:'diamond'|'annex'|'upper'|'bare'){
  const axis=c.clone().sub(a).normalize(),len=a.distanceTo(c),normal=new T.Vector2(-axis.y,axis.x),centre=a.clone().lerp(c,.5),overall=new T.Vector2();const normalRing=kind==='upper'?upper:church;normalRing.forEach(p=>overall.add(p));overall.multiplyScalar(1/normalRing.length);if(normal.dot(centre.clone().sub(overall))<0)normal.negate();
  const angle=-Math.atan2(axis.y,axis.x);
  const tile=(t:number,yy:number,w:number,h:number,col:C,offset=.055,depth=.045,roll=0,role='facade-panel')=>{const p=a.clone().addScaledVector(axis,t).addScaledVector(normal,offset);const g=new T.BoxGeometry(w,h,depth);g.rotateZ(roll);g.rotateY(angle);g.translate(p.x,yy+h/2,p.y);g.userData.facadeFacing=normal.toArray();add(g,col,role);};
  if(kind==='diamond'||kind==='upper'){
   const step=kind==='upper'?1.05:1.12,rows=kind==='upper'?1:7,bottom=kind==='upper'?base+.25:1.6;
   for(let j=0;j<rows;j++)for(let i=0;i<Math.floor(len/step);i++){
    const t=(i+.5)*len/Math.floor(len/step),yy=bottom+j*step;
    if(kind==='diamond'&&j>1&&j<5&&i%4!==0&&i%4!==3)continue;
    for(const [dx,dy] of [[-.24,.24],[.24,.24],[-.24,-.24],[.24,-.24]])tile(t+dx,yy+dy,.25,.25,'glass',.09,.045,Math.PI/4,'exposed-diamond-glass');
   }
   if(kind==='diamond')for(let i=1;i<len/1.12;i++)tile(i*1.12,0,.018,height,'frame',.015,.014,0,'panel-joint');
   if(kind==='diamond')for(let yy=1.6;yy<height;yy+=1.12)tile(len/2,yy,len,.018,'frame',.015,.014,0,'panel-joint');
   tile(len/2,height-.12,len+.15,.17,'white',.055,.24,0,'eaves-trim');
  }
  if(kind==='annex')for(let i=0;i<Math.floor(len/3.5);i++){const t=(i+.5)*len/Math.floor(len/3.5);for(const yy of [1.0,4.5]){tile(t,yy,2.65,1.7,'glass',.10,.06,0,'annex-exposed-window');for(const dx of [-1.32,-.65,.65,1.32])tile(t+dx,yy,.07,1.7,'white',.15,.055);tile(t,yy+.85,2.65,.07,'white',.15,.055);}}
  return tile;
 }
 // Three exposed church elevations only. The east service-wing join stays inside the native scope.
 for(const [a,c] of [[76,89],[108,76],[105,108]])facade(pt(a),pt(c),0,9,'diamond');
 for(let i=0;i<upper.length;i++)facade(upper[i],upper[(i+1)%upper.length],11,1.95,'upper');
 const north=facade(pt(76),pt(89),0,9,'bare'),northLength=pt(76).distanceTo(pt(89));for(let i=1;i<6;i++){const t=(i+.2)*northLength/6;north(t,.35,2.3,2.45,'glass',.11,.07,0,'current-lower-rectangular-glazing');for(const dx of [-1.15,0,1.15])north(t+dx,.35,.065,2.45,'white',.17,.06);for(const yy of [1.16,1.98])north(t,yy,2.3,.065,'white',.17,.06);}
 // Exact BAG east/northeast annex fronts remain lower and use rectangular openings.
 const r=f.localRing.map(p=>new T.Vector2(...p));facade(pt(89),r[3],0,7.7,'annex');for(const [a,c] of [[10,0],[0,3]])if(r[a].distanceTo(r[c])>5)facade(r[a],r[c],0,7.7,'annex');
 // Source-confirmed entrances: glass panels, white divisions, projecting concrete canopies.
 for(const [ia,ic,fraction] of [[76,89,.22],[76,89,.77],[108,76,.22],[105,108,.63]]){
  const a=pt(ia),c=pt(ic),tile=facade(a,c,0,9,'bare');const t=a.distanceTo(c)*fraction;
  tile(t,0,1.75,2.65,'dark',.12,.08,0,'entrance-door');tile(t,2.75,2.5,.16,'slate',.55,1.15,0,'entrance-canopy');tile(t,0,.065,2.65,'white',.20,.05);
 }
 function strut(a:T.Vector3,c:T.Vector3,r:number,col:C){const delta=c.clone().sub(a),g=new T.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()));g.translate(...a.clone().lerp(c,.5).toArray());add(g,col,'open-belfry-strut');}
 // Two tower positions follow measured square bases; keep every upper steel opening physically open.
 for(const [ids,clock] of [[[136,141,82,85,138],true],[[127,123,109,113,115,125],false]] as [number[],boolean][]){
  const points=ids.map(pt),centre=points.reduce((a,p)=>a.add(p),new T.Vector2()).multiplyScalar(1/points.length),width=2.45,angle=-Math.atan2(u.y,u.x);
  const transform=(x:number,yy:number,z:number)=>new T.Vector3(centre.x+u.x*x+n.x*z,yy,centre.y+u.y*x+n.y*z);
  const g=new T.BoxGeometry(width,9.15,width);g.rotateY(angle);g.translate(centre.x,7.7+9.15/2,centre.y);add(g,'white','tower-square-base');
  const cap=new T.BoxGeometry(2.75,.30,2.75);cap.rotateY(angle);cap.translate(centre.x,17.0,centre.y);add(cap,'slate','tower-base-cap');
  for(const x of [-1.05,1.05])for(const z of [-1.05,1.05])strut(transform(x,17.1,z),transform(x,21.85,z),.055,'frame');
  for(const yy of [17.4,18.7,20.1,21.5])for(const s of [-1,1]){strut(transform(-1.05,yy,s*1.05),transform(1.05,yy,s*1.05),.035,'frame');strut(transform(s*1.05,yy,-1.05),transform(s*1.05,yy,1.05),.035,'frame');}
  for(const yy of [17.5,18.85])for(const s of [-1,1]){strut(transform(-1.05,yy,s*1.05),transform(1.05,yy+1.35,s*1.05),.032,'frame');strut(transform(1.05,yy,s*1.05),transform(-1.05,yy+1.35,s*1.05),.032,'frame');}
  const bell=new T.CylinderGeometry(.35,.63,.85,12);bell.translate(centre.x,20.55,centre.y);add(bell,'dark','suspended-bell');
  for(const s of [-1,1]){strut(transform(-1.1,21.5,s*1.05),transform(0,22.1,s*1.05),.035,'frame');strut(transform(0,22.1,s*1.05),transform(1.1,21.5,s*1.05),.035,'frame');}
  if(clock)for(const s of [-1,1]){const disc=new T.CylinderGeometry(.75,.75,.08,24);disc.rotateX(Math.PI/2);disc.rotateY(angle);disc.translate(...transform(0,20.7,s*1.09).toArray());add(disc,'dark','real-clock-disc');strut(transform(-.40,20.7,s*1.16),transform(.15,20.7,s*1.16),.025,'white');strut(transform(0,20.65,s*1.16),transform(0,21.2,s*1.16),.025,'white');}
 }
 // Small real roof cross, subordinate to the open towers.
 const cross=pt(92).clone().lerp(pt(118),.7);box(cross.x,13.05,cross.y,.14,1.35,.14,'white','roof-cross');box(cross.x,13.85,cross.y,.75,.14,.14,'white','roof-cross');
 // Clip diamonds covered by actual current facade replacements or structural solids.
 // This preserves visible source patterns and avoids claiming hidden panels are exposed glazing.
 const meshes=pending.map(({g})=>{g.computeBoundingBox();const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));m.updateMatrixWorld();return m;}),ray=new T.Raycaster();ray.far=3.5;
 const masks=new Set(['current-lower-rectangular-glazing','entrance-door','tower-square-base','measured-lower-roof']);
 for(let i=0;i<pending.length;i++){
  const {g,c}=pending[i];if(g.userData.role==='exposed-diamond-glass'){
   const center=g.boundingBox!.getCenter(new T.Vector3()),normal=g.userData.facadeFacing,direction=new T.Vector3(-normal[0],0,-normal[1]);ray.set(center.clone().addScaledVector(direction,-3),direction);const hit=ray.intersectObjects(meshes,false)[0];
   if(hit?.object!==meshes[i]&&masks.has((hit?.object as T.Mesh)?.geometry.userData.role))continue;
  }
  b.add(g,c);
 }
 for(const m of meshes)(m.material as T.Material).dispose();

}
