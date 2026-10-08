import * as T from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import source from './landmarks/collectie-six-footprints.json';
import {reconcileCollectieSixBoundary} from './landmarks/collectie-six-boundary';
const surfaces=reconcileCollectieSixBoundary(source.surfaces,source.bagPolygons),ground=surfaces.find(s=>s.type==='GroundSurface')!.rings[0].map(p=>[p[0],p[2]]),bag=source.bagPolygons[0].slice(0,-1);
const dist=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function boundaryDistance(p:number[],ring:number[][]){return Math.min(...ring.map((a,i)=>{const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return dist(p,[a[0]+t*dx,a[1]+t*dz]);}));}
const area=(ring:number[][])=>Math.abs(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-p[1]*q[0];},0)/2);
const maxBoundaryError=Math.max(...ground.map(p=>boundaryDistance(p,bag)),...bag.map(p=>boundaryDistance(p,ground)),...ground.map((p,i)=>boundaryDistance([(p[0]+ground[(i+1)%ground.length][0])/2,(p[1]+ground[(i+1)%ground.length][1])/2],bag)),...bag.map((p,i)=>boundaryDistance([(p[0]+bag[(i+1)%bag.length][0])/2,(p[1]+bag[(i+1)%bag.length][1])/2],ground)));
assert(maxBoundaryError<1e-8,'Reconciled perimeter must coincide exactly with native BAG');
assert(Math.abs(area(ground)-area(bag))<1e-8,'No missing wedge or filled rear recess');
for(const p of bag)assert(ground.some(q=>dist(p,q)<1e-8),'Every BAG corner must be represented, including rear jogs');
const originalGround=source.surfaces[0].rings[0].map(p=>[p[0],p[2]]);
let interiorVertices=0,originalHeights=0;
for(const s of source.surfaces){const target=surfaces.filter(t=>t.index===s.index);for(const p of s.rings.flat()){
 assert(target.some(t=>t.rings.flat().some(q=>Math.abs(p[1]-q[1])<1e-9)),`source height lost at ${s.index}`);originalHeights++;
 if(boundaryDistance([p[0],p[2]],originalGround)>1e-7){assert(target.some(t=>t.rings.flat().some(q=>dist([p[0],p[2]],[q[0],q[2]])<1e-9&&Math.abs(p[1]-q[1])<1e-9)),`internal ridge/chimney changed at ${s.index}`);interiorVertices++;}
}}
const roofs:T.Mesh[]=[];let triangles=0;
for(const s of surfaces.filter(s=>s.type==='RoofSurface')){const flat=(p:number[])=>new T.Vector2(p[0],p[2]),points=s.rings.flat(),tris=T.ShapeUtils.triangulateShape(s.rings[0].map(flat),s.rings.slice(1).map(r=>r.map(flat))),positions:number[]=[];for(const tri of tris){const p=tri.map(i=>new T.Vector3(...points[i] as [number,number,number])),n=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));if(n.lengthSq()<1e-12)continue;if(n.y<0)[p[1],p[2]]=[p[2],p[1]];assert(p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).y>0,'roof must face upward');positions.push(...p.flatMap(v=>v.toArray()));triangles++;}const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)),mesh=new T.Mesh(g,new T.MeshBasicMaterial());mesh.updateMatrixWorld();roofs.push(mesh);}
function inside(p:number[],ring:number[][]){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
const ray=new T.Raycaster(),missing:number[][]=[],spill:number[][]=[];let samples=0;for(let x=-26.037;x<6;x+=.1)for(let z=-9.043;z<15;z+=.1){const p=[x,z];if(boundaryDistance(p,bag)<.02)continue;ray.set(new T.Vector3(x,30,z),new T.Vector3(0,-1,0));const hit=ray.intersectObjects(roofs,false)[0];if(inside(p,bag)){samples++;if(!hit)missing.push(p);}else if(hit)spill.push([...p,hit.point.y]);}
const wedgeCorners=surfaces.filter(s=>s.index===104).flatMap(s=>s.rings.flat()).filter(p=>[4,5].some(i=>dist([p[0],p[2]],bag[i])<1e-8));
assert.equal(wedgeCorners.length,2);
// Independent plane calculation from surveyed NW roof edge and neighboring eave.
const edge=source.surfaces.find(s=>s.index===104)!.rings[0],a=edge[5],b=edge[6],c=edge[7],u=new T.Vector3(...b as [number,number,number]).sub(new T.Vector3(...a as [number,number,number])),v=new T.Vector3(...c as [number,number,number]).sub(new T.Vector3(...a as [number,number,number])),normal=u.cross(v);
for(const p of wedgeCorners){const planeHeight=a[1]-(normal.x*(p[0]-a[0])+normal.z*(p[2]-a[2]))/normal.y;assert(Math.abs(p[1]-planeHeight)<1e-9,'inferred NW corner must follow surveyed local roof slope');assert(p[1]>12&&p[1]<13);const wallTops=surfaces.filter(s=>s.index===13).flatMap(s=>s.rings.flat()).filter(q=>dist([q[0],q[2]],[p[0],p[2]])<1e-8&&q[1]>1);assert(wallTops.length>0&&wallTops.every(q=>Math.abs(q[1]-p[1])<1e-9),'added wall and roof must meet at identical heights');}
const result={checkedAt:new Date().toISOString(),bagArea:area(bag),reconciledArea:area(ground),maxBoundaryError,originalHeights,interiorVertices,roofTriangles:triangles,roofInteriorSamples:samples,missingRoofSamples:missing,roofSpillSamples:spill,wedgeCorners,wall13Panels:surfaces.filter(s=>s.index===13).map(s=>s.rings),originalGlbSha256:crypto.createHash('sha256').update(fs.readFileSync('artifacts/collectie-six-cpu/collectie-six.glb')).digest('hex')};
fs.writeFileSync('artifacts/collectie-six-cpu/boundary-checks.json',JSON.stringify(result,null,2));console.log({...result,missingRoofSamples:missing.length,roofSpillSamples:spill.length,wall13Panels:result.wall13Panels.length});
assert.equal(missing.length,0,'Full-height native BAG interior requires complete roof cover');assert.equal(spill.length,0,'Source shell must not occupy separate neighbor/rear recess');
