import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import sharp from 'sharp';
import source from './landmarks/uva-roeterseiland-footprints.json';
import {openTopPrism,upwardRoofPlane} from './landmarks/house-geometry';
import {buildUvaRoeterseiland,campusNative,roeterseilandMassing} from './landmarks/uva-roeterseiland-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
const meshes:T.Mesh[]=[];
const palette={bronze:'#3d5148',glass:'#527787',dark:'#303b43',frame:'#9daaa8',concrete:'#d4d5d0',slate:'#4a525d',greyBrick:'#7d7871',stone:'#cfc2a6'};
const add:BuildingTools['add']=(g,col,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.userData.palette=col;meshes.push(new T.Mesh(g,new T.MeshBasicMaterial({color:palette[col as keyof typeof palette]??'#9a5240',side:T.DoubleSide})))};
const b:BuildingTools={add,box:(x,y,z,w,h,d,col,a=0)=>add(new T.BoxGeometry(w,h,d),col,x,y+h/2,z,a),prism:()=>{},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{}};
buildUvaRoeterseiland(0,0,b);
const bounds=new T.Box3();let triangles=0;for(const m of meshes){m.geometry.computeBoundingBox();bounds.union(m.geometry.boundingBox!);triangles+=(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3;assert([...m.geometry.getAttribute('position').array].every(Number.isFinite));}
assert(triangles<40000);assert(bounds.max.y<52&&bounds.max.y>45);assert(bounds.min.x>-83&&bounds.max.x<63);assert(bounds.min.z>-106&&bounds.max.z<108);
const hits=(u:number,y:number,v:number,du:number,dv:number)=>{const [x,z]=campusNative(u,v),[dx,dz]=campusNative(du,dv);return new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(dx,0,dz).normalize()).intersectObjects(meshes)};
for(const v of [-8,2,15,22]) for(const y of [2,7,13]) {const near=hits(-18,y,v,1,0).filter(h=>h.distance<21);if(near.length)console.log('void failure',v,y,near.map(h=>[h.distance,(h.object as T.Mesh).geometry.userData.role]));assert(!near.length,'canal and bank void crosses bar without ground wall');}
for(const side of [-1,1])for(const v of [-8,2,15,22]) {
 const first=hits(side<0?-25:12,18,v,side<0?1:-1,0)[0];assert(first,'cityroom glazing visible');assert.equal((first.object as T.Mesh).geometry.userData.palette,'glass','first-hit cityroom glazing');
}
// Real risk checks: surveyed roofs face up, and the ray through the opening
// meets a genuine underside rather than a wall at pavement level.
for(const m of meshes.filter(m=>String(m.geometry.userData.role).endsWith('-roof'))) {
 const normals=m.geometry.getAttribute('normal');for(let i=0;i<normals.count;i++)assert(normals.getY(i)>.99,'roof must face upward');
}
for(const v of [-8,2,15,22]) {const [x,z]=campusNative(-5.5,v);const top=new T.Raycaster(new T.Vector3(x,2,z),new T.Vector3(0,1,0)).intersectObjects(meshes)[0];assert(top&&top.point.y>=15&&top.point.y<=15.3,'source-semantic raised underside');}
for(const [x,z,expected] of [[38.42255,-60.62964,false],[37.91181,55.4316,true],[-20.39809,79.79266,true]] as [number,number,boolean][]) {const hit=new T.Raycaster(new T.Vector3(x,70,z),new T.Vector3(0,-1,0)).intersectObjects(meshes)[0];assert.equal(Boolean(hit),expected,'open north court / currently roofed southern atria');}
// Back glazing must sit behind an8m+ pale reveal; columns stand in front of it.
for(const u of [-31,-28,-24,-21,-18.8])for(const y of [3,7,10]){const h=hits(u,y,20,0,1)[0];assert(h);assert.equal((h.object as T.Mesh).geometry.userData.role,'entry-glazing','exposed inset portal glass');assert(h.distance>18&&h.distance<19,'deep portal glass setback');}
for(const u of [-29.6,-19.1]){const h=hits(u,7,20,0,1)[0];assert.equal((h.object as T.Mesh).geometry.userData.role,'entry-support','exposed slender portal support');assert(h.distance>8&&h.distance<10,'supports visibly forward of back glass');}
const [sx,sz]=campusNative(-24,32);const soffit=new T.Raycaster(new T.Vector3(sx,8,sz),new T.Vector3(0,1,0)).intersectObjects(meshes)[0];assert.equal((soffit.object as T.Mesh).geometry.userData.role,'entry-pale-soffit');
// Photograph's adjacent glazed pavilion: sample exposed pane fractions on
// its real north/east corner, with first-hit tests to catch parent-shell burial.
for(const u of [-80,-71.6,-63.2,-51.2,-45.6,-40])for(const fraction of [-.35,.35])for(const y of [2,6,10]) {
 const h=hits(u+fraction*2.6,y,15,0,1)[0];assert(h);assert.equal((h.object as T.Mesh).geometry.userData.role,'entry-pavilion-north-glazing','north pavilion pane fractions exposed');
}
for(const v of [20.3,23.1,26.5])for(const fraction of [-.35,.35])for(const y of [2,6,10]) {
 const h=hits(v>25?-34:-28,y,v+fraction*2.5,-1,0)[0];assert(h);assert.equal((h.object as T.Mesh).geometry.userData.role,'entry-pavilion-east-glazing','east pavilion pane fractions exposed');
}
// West street pane fractions sample the actual exposed708 boundary at several
// native positions; these rays detect nearby shell burial without hiding neighbors.
for(const v of [23.1,31.5,42.7,56.7,70.7,79.1])for(const fraction of [-.35,.35])for(const y of [2,6,10]){
 const h=hits(-95,y,v+fraction*2.5,1,0)[0];assert(h);assert.equal((h.object as T.Mesh).geometry.userData.role,'entry-pavilion-west-glazing','west pavilion observed return first-hit');
}
// Source399/401 west bank stair curtain panes must be ahead of narrow slots.
for(const v of [-28,-25.6,-23.2,28,30.4,32.8])for(const fraction of [-.35,.35])for(const y of v>0?[14,18,30,42]:[2,18,30,42]){
 const h=hits(-20,y,v+fraction*2.28,1,0)[0];assert(h);if((h.object as T.Mesh).geometry.userData.role!=='west-bank-stair-glazing')console.log('stair-failed-probe',v,fraction,y,(h.object as T.Mesh).geometry.userData.role,h.distance);assert.equal((h.object as T.Mesh).geometry.userData.role,'west-bank-stair-glazing','west bank broad stair curtain panes first-hit');
}
// Actual exposed B terminal windowgrid lies on its surveyed south boundary.
for(const u of [-11.5,-6.5,-1.5,1])for(const fraction of [-.35,.35])for(const y of [10,22,38]){
 const h=hits(u+fraction*1.25,y,90,0,-1)[0];assert(h);if((h.object as T.Mesh).geometry.userData.role!=='b-south-end-office-glazing')console.log('end-pane-failure',u,fraction,y,h.point.toArray(),(h.object as T.Mesh).geometry.userData.role);assert.equal((h.object as T.Mesh).geometry.userData.role,'b-south-end-office-glazing','B operator-sourced terminalpane first-hit');
}
// Independent review found Aclerestory/trim above its actual surveyed roof.
// Every authored ribbon primitive must clear its supporting pavilion and stay
// beneath A roof, independent of wholecampus51m equipment boundingbox.
const aRoof=source.roofs.find(r=>r.index===748)!;const aTop=(aRoof.minHeight+aRoof.maxHeight)/2;
const pavilionRoof=source.roofs.find(r=>r.index===708)!;const pavilionTop=(pavilionRoof.minHeight+pavilionRoof.maxHeight)/2;
for(const m of meshes.filter(m=>/^a-(north-)?(ribbon|clerestory)/.test(String(m.geometry.userData.role)))){
 const box=m.geometry.boundingBox!;assert(box.min.y>pavilionTop,'A first broad ribbon starts above actualpavilion');assert(box.max.y<aTop-.4,'A glazing andtrim retain opaquecap below actualroof');
}
// Source734westfacade: actualsurveyedge fractionalwindow positionsmust be
// exposed, with genuineparent retained. Citycontext is still a separatecheck.
const annex=source.roofs.find(r=>r.index===734)!,edgeA=annex.rings[0][11],edgeB=annex.rings[0][12];
const edgeLength=Math.hypot(edgeB[0]-edgeA[0],edgeB[1]-edgeA[1]),edgeX=(edgeB[0]-edgeA[0])/edgeLength,edgeZ=(edgeB[1]-edgeA[1])/edgeLength;
function annexRay(at:number,y:number){const x=edgeA[0]+at*edgeX-3*edgeZ,z=edgeA[1]+at*edgeZ+3*edgeX;return new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(edgeZ,0,-edgeX)).intersectObjects(meshes)[0];}
for(const at of [3.5,12.5,35,48.5,57.5])for(const f of [-.35,.35])for(const y of [2,5,10]){const h=annexRay(at+f*3.15,y);assert(h);assert.equal((h.object as T.Mesh).geometry.userData.role,'north-annex-west-window','actual734 broadpanesexposed');}
for(const at of [20.1,24.6]){const h=annexRay(at,5.2);assert(h);assert.equal((h.object as T.Mesh).geometry.userData.role,'north-annex-west-glassblock','originalpaleglassblockexposed');}
// Independentreview's missingprincipalmullion/floordivider must now be
// firsthits on734's actualnativeface, ratherthan buriedbehind finejointgrid.
for(const [at,y,role] of [[22.5,5.2,'north-annex-glassblock-central-mullion'],[20.1,7.7,'north-annex-glassblock-storey-divider'],[12.5,5.0,'north-annex-upper-vertical-mullion'],[12.5,1.5,'north-annex-ground-door-stile'],[12.1,2.8,'north-annex-ground-door-head']] as [number,number,string][]){
 const h=annexRay(at,y);assert(h);assert.equal((h.object as T.Mesh).geometry.userData.role,role,'734principalframingexposed');
}
// Rooftop plant remains supported by A roof, with dark opaque source family.
const [rx,rz]=campusNative(-53,44);const plant=new T.Raycaster(new T.Vector3(rx,60,rz),new T.Vector3(0,-1,0)).intersectObjects(meshes)[0];
assert.equal((plant.object as T.Mesh).geometry.userData.role,'survey-681-roof');
const plantSide=hits(-80,47,44,1,0)[0];assert.equal((plantSide.object as T.Mesh).geometry.userData.role,'survey-681');assert.equal((plantSide.object as T.Mesh).geometry.userData.palette,'dark');
const report={model:'uva-roeterseiland',phase:'ninth-cycle-independent-734-framing-correction',triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},void:roeterseilandMassing,status:'CPU-only; gallery/live/suppression/full-parent acceptance pending'};
const out='artifacts/uva-roeterseiland-massing-20261006';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/geometry-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
// CPU z-buffer of the exact native builder, without export or shared GPU state.
if(process.argv.includes('--render')) {
 // Context only: exact retained CREA footprint, median AHN roof elevation.
 // This coarse surrogate never enters authored builder/export or its budgets.
 const creaShape=new T.Shape(source.excludedNeighbour.outline[0].map(p=>new T.Vector2(p[0],p[1])));
 const creaMat=new T.MeshBasicMaterial({color:'#9a5240',side:T.DoubleSide});
 const context=[new T.Mesh(openTopPrism(creaShape,0,18.019),creaMat),new T.Mesh(upwardRoofPlane(creaShape,18.019),creaMat)];
 const W=1000,H=760,tris:{p:T.Vector3[],rgb:number[]}[]=[];
 for(const m of [...meshes,...context]){const g=m.geometry,pos=g.getAttribute('position'),ix=g.index,col=(m.material as T.MeshBasicMaterial).color;for(let i=0;i<(ix?.count??pos.count);i+=3)tris.push({p:[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pos,ix?ix.getX(i+k):i+k)),rgb:col.toArray()});}
 for(const [name,angle,elevation,focus,extent] of [['west-canal',-Math.PI/2+roeterseilandMassing.axesRadians,.09,[-4,25,12],120],['east-promenade',Math.PI/2+roeterseilandMassing.axesRadians,.07,[-4,24,12],112],['native-overview',-.9,.7,[-11,20,0],240],['north-annex-framing-close',Math.atan2(-.98363,-.18021),-.558,[-75.948,10,-32.047],20.2],['north-annex-street',-Math.PI/2,.12,[-75.948,9,-32.047],85],['b-south-end',roeterseilandMassing.axesRadians,.20,[...(() => {const[x,z]=campusNative(0,54);return[x,24,z]})()],112],['west-pavilion-street',-Math.PI/2+roeterseilandMassing.axesRadians,.10,[...(() => {const[x,z]=campusNative(-74,49);return[x,22,z]})()],110],['a-pavilion-canal-front',Math.PI+roeterseilandMassing.axesRadians,-.52,[...(() => {const[x,z]=campusNative(-60,28);return[x,20,z]})()],104],['east-crea-approach',Math.PI/2+roeterseilandMassing.axesRadians,-.28,[...(() => {const[x,z]=campusNative(-5.8,15);return[x,18,z]})()],95],['north-bank-entry',Math.PI+roeterseilandMassing.axesRadians,-.23,[...(() => {const[x,z]=campusNative(-24.2,34);return[x,7,z]})()],55]] as [string,number,number,number[],number][]) {
  const eye=new T.Vector3(Math.sin(angle),elevation,Math.cos(angle)).normalize(),right=new T.Vector3(0,1,0).cross(eye).normalize(),up=eye.clone().cross(right),center=new T.Vector3(...focus),scale=.86*Math.min(W,H)/extent;
  const rgba=new Uint8Array(W*H*4),depth=new Float64Array(W*H).fill(-Infinity);for(let i=0;i<W*H;i++)rgba.set([232,229,217,255],i*4);
  const cameraDistance=name==='north-annex-framing-close'?15.43:name==='a-pavilion-canal-front'?40:name==='north-bank-entry'?22:name==='east-crea-approach'?58:Infinity;
  const visibleTris=Number.isFinite(cameraDistance)?tris.flatMap(t=>{const pts:T.Vector3[]=[];for(let i=0;i<3;i++){const a=t.p[i],b=t.p[(i+1)%3],ad=a.clone().sub(center).dot(eye),bd=b.clone().sub(center).dot(eye);if(ad<=cameraDistance-.3)pts.push(a);if((ad<=cameraDistance-.3)!==(bd<=cameraDistance-.3))pts.push(a.clone().lerp(b,(cameraDistance-.3-ad)/(bd-ad)));}return pts.length<3?[]:Array.from({length:pts.length-2},(_,i)=>({p:[pts[0],pts[i+1],pts[i+2]],rgb:t.rgb}));}):tris;
  for(const t of visibleTris){const q=t.p.map(p=>{const a=p.clone().sub(center);const z=a.dot(eye),perspective=Number.isFinite(cameraDistance)?cameraDistance/(cameraDistance-z):1;return[W/2+a.dot(right)*scale*perspective,H/2-a.dot(up)*scale*perspective,z]});const[a,b,c]=q,area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(area)<1e-9)continue;const x0=Math.max(0,Math.floor(Math.min(...q.map(p=>p[0])))),x1=Math.min(W-1,Math.ceil(Math.max(...q.map(p=>p[0])))),y0=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1])))),y1=Math.min(H-1,Math.ceil(Math.max(...q.map(p=>p[1]))));const n=t.p[1].clone().sub(t.p[0]).cross(t.p[2].clone().sub(t.p[0])).normalize();if(n.dot(eye)<0)n.negate();const shade=.7+.3*Math.max(0,n.dot(new T.Vector3(-.5,.9,.6).normalize())),color=t.rgb.map(v=>{v*=shade;return Math.round(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055))});
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/area,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/area,w=1-u-v;if(u<0||v<0||w<0)continue;const z=u*a[2]+v*b[2]+w*c[2],j=y*W+x;if(z>depth[j]+1e-8){depth[j]=z;rgba.set([...color,255],j*4);}}
  }
  await sharp(rgba,{raw:{width:W,height:H,channels:4}}).png().toFile(out+'/'+name+'.png');
 }
}
