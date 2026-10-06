import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type { BuildingTools } from './landmarks/cultural-builders';
import { buildPulitzerAmsterdam, pulitzerPanes } from './landmarks/pulitzer-amsterdam-builder';
import data from './landmarks/pulitzer-amsterdam-footprints.json';
const meshes:T.Mesh[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=g.name;m.userData.colour=c;meshes.push(m);};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,angle=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,angle);
const unused=()=>{throw Error('Unexpected helper');};
buildPulitzerAmsterdam(1,1,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
let triangles=0,downward=0,small=0;
const bounds=new T.Box3();
for(const m of meshes){
 const g=m.geometry,p=g.getAttribute('position'),ix=g.index;
 for(let i=0;i<p.count;i++)for(const v of [p.getX(i),p.getY(i),p.getZ(i)])assert(Number.isFinite(v),'nonfinite vertex');
 g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(ix?.count??p.count)/3;
 if(!m.name.startsWith('pulitzer-roof:'))continue;
 for(let i=0;i<(ix?.count??p.count);i+=3){const vs=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j));const n=vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0]));if(n.y<-.000001)downward++;if(n.length()<1e-6)small++;}
}
assert(triangles<40000,`triangle budget ${triangles}`);assert.equal(downward,0,'downward roof faces');assert(bounds.getSize(new T.Vector3()).x<92&&bounds.getSize(new T.Vector3()).z<82,'native scope');assert(bounds.max.y<22,'unsupported whole-building height');
const failures:{id:string;u:number;v:number;hit:string;colour:string}[]=[];let paneSamples=0,joinerySamples=0;
for(const pane of pulitzerPanes){
 if(pane.id.includes('door'))continue; // Original opaque door leaf owns its lower area.
 const normal=new T.Vector3(pane.normal[0],0,pane.normal[1]),tangent=new T.Vector3(pane.tangent[0],0,pane.tangent[1]);
 for(const u of [.06,.18,.37,.63,.82,.94])for(const v of [.08,.28,.48,.78,.92]){
  const target=new T.Vector3(...pane.centre).addScaledVector(tangent,(u-.5)*pane.width);target.y+=(v-.5)*pane.height;
  const hits=new T.Raycaster(target.clone().addScaledVector(normal,2),normal.clone().negate(),0,2.02).intersectObjects(meshes);
  paneSamples++;const first=hits[0]?.object;if(first?.userData.colour==='glass')continue;
  if(first&&['white','stone','frame',...(pane.id.startsWith('garden-conservatory:')?['dark']:[])].includes(first.userData.colour)&&hits.some(h=>h.object.name===`pulitzer-pane:${pane.id}`)){joinerySamples++;continue;}
  failures.push({id:pane.id,u,v,hit:first?.name??'none',colour:first?.userData.colour??'none'});
 }
}
const courtFailures=[];
for(const court of data.courtVoids){
 const [x,z]=court.probe;const hits=new T.Raycaster(new T.Vector3(x,25,z),new T.Vector3(0,-1,0),0,24.95).intersectObjects(meshes);if(hits.length)courtFailures.push({id:court.id,hit:hits[0].object.name,point:hits[0].point.toArray()});
}
// Probe the photo-observed columns directly in the surveyed facade frame. This
// catches a missing whole column even if the builder exports no pane metadata
// for it; the general pane checks above cannot detect that omission.
const front=data.facades.find(f=>f.id==='prinsengracht-323')!;
const a=new T.Vector2(...front.a as [number,number]),b=new T.Vector2(...front.b as [number,number]),tangent=b.clone().sub(a).normalize(),normal=new T.Vector3(-tangent.y,0,tangent.x);
const sourceColumnFailures:{row:number;column:number;u:number;v:number;hit:string}[]=[];let sourceColumnSamples=0;
for(const [row,[bottom,height]]of [[6.3,2.40],[9.45,2.18],[12.9,1.95]].entries())for(const [column,centreFraction]of [.265,.735].entries())for(const u of [.06,.25,.5,.75,.94])for(const v of [.08,.28,.48,.78,.92]){
 const fraction=centreFraction+(u-.5)*.205;
 const target=new T.Vector3(a.x+(b.x-a.x)*fraction,bottom+height*v,a.y+(b.y-a.y)*fraction).addScaledVector(normal,.165);
 const first=new T.Raycaster(target.clone().addScaledVector(normal,2),normal.clone().negate(),0,2.02).intersectObjects(meshes)[0]?.object;
 sourceColumnSamples++;
 if(first?.userData.colour!=='glass'||!first.name.startsWith('pulitzer-pane:prinsengracht-323:modern-window-'))sourceColumnFailures.push({row,column,u,v,hit:first?.name??'none'});
}
const doorwayFront=data.facades.find(f=>f.id==='keizersgracht-234')!;
const doorwayTangent=new T.Vector2(doorwayFront.b[0]-doorwayFront.a[0],doorwayFront.b[1]-doorwayFront.a[1]).normalize(),doorwayNormal=new T.Vector3(-doorwayTangent.y,0,doorwayTangent.x);
let sourceDoorwaySamples=0;
for(const [fraction,expected]of [[.285,'glass'],[.535,'glass'],[.75,'dark']] as const)for(const y of [1.9,2.15]){
 const target=new T.Vector3(doorwayFront.a[0]+(doorwayFront.b[0]-doorwayFront.a[0])*fraction,y,doorwayFront.a[1]+(doorwayFront.b[1]-doorwayFront.a[1])*fraction);
 const first=new T.Raycaster(target.clone().addScaledVector(doorwayNormal,2),doorwayNormal.clone().negate(),0,2.02).intersectObjects(meshes)[0]?.object;
 sourceDoorwaySamples++;
 assert.equal(first?.userData.colour,expected,`Source-observed Keizersgracht234 door/window bay fraction=${fraction}, y=${y}`);
}
// Independent source-facing samples across the surveyed boundary catch a
// missing broad assembly even if pane metadata is omitted or narrowed.
const gardenBoundary=data.gardenConservatory;
const gardenDirection=new T.Vector2(gardenBoundary.b[0]-gardenBoundary.a[0],gardenBoundary.b[1]-gardenBoundary.a[1]).normalize();
const gardenNormal=new T.Vector3(gardenDirection.y,0,-gardenDirection.x);
let sourceGardenSamples=0;const sourceGardenFailures:{fraction:number;y:number;hit:string;colour:string}[]=[];
for(const fraction of [.09,.22,.36,.64,.78,.91])for(const y of [.35,1.2,2.7,3.2,4.4]){
 const target=new T.Vector3(gardenBoundary.a[0]+(gardenBoundary.b[0]-gardenBoundary.a[0])*fraction,y,gardenBoundary.a[1]+(gardenBoundary.b[1]-gardenBoundary.a[1])*fraction);
 const first=new T.Raycaster(target.clone().addScaledVector(gardenNormal,2),gardenNormal.clone().negate(),0,2.02).intersectObjects(meshes)[0]?.object;sourceGardenSamples++;
 const expected=y>3.5?'white':'glass';
 if(first?.userData.colour!==expected)sourceGardenFailures.push({fraction,y,hit:first?.name??'none',colour:first?.userData.colour??'none'});
}
if(sourceGardenFailures.length)console.log(JSON.stringify(sourceGardenFailures));
assert.equal(sourceGardenFailures.length,0,'Source broad garden glazing/white upper wall missing or occluded');
const report={modelId:'pulitzer-amsterdam',triangles,bounds:[bounds.min.toArray(),bounds.max.toArray()],roofRegions:data.roofRegions.length,downwardRoofFaces:downward,numericalRoofFaces:small,maxSourcePlaneResidual:Math.max(...data.roofRegions.map(r=>r.sourceResidual)),paneSamples,joinerySamples,paneFailures:failures,sourceColumnSamples,sourceColumnFailures,sourceDoorwaySamples,courtProbes:data.courtVoids.length,courtFailures,sourceGardenSamples,sourceGardenFailures,limitations:'Draft geometry preflight only; compressed export, gallery and live-game acceptance remain coordinator checks. Conservatory localized topologically on existing Pand9022 west edge of main central garden; glass dimensions/bay count approximate, roof unchanged. Court1/3/4 window coverage remains unresolved; open-space rays do not certify courtyard facades.'};
fs.writeFileSync(process.env.PULITZER_GEOMETRY_REPORT??'scripts/landmarks/pulitzer-amsterdam-geometry-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,paneFailures:failures.slice(0,12)}));assert.equal(failures.length,0,'fractional pane first-hit failures');assert.equal(sourceColumnFailures.length,0,'photo-observed paired upper columns missing or occluded');assert.equal(courtFailures.length,0,'source courtyard covered');
