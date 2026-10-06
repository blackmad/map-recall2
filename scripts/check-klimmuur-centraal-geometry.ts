import assert from 'node:assert/strict';
import * as T from 'three';
import {buildKlimmuurCentraal} from './landmarks/klimmuur-centraal-builder';
import source from './landmarks/klimmuur-centraal-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const meshes:T.Mesh[]=[];const mat=new T.MeshBasicMaterial({side:T.DoubleSide});
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.userData.palette=c;meshes.push(new T.Mesh(g,mat))};const unused=()=>{throw Error('unexpected primitive')};
buildKlimmuurCentraal(0,0,{add,box:unused,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
const bounds=new T.Box3();let triangles=0,roofFaces=0;for(const m of meshes){const g=m.geometry,p=g.getAttribute('position');triangles+=(g.index?.count??p.count)/3;for(const n of p.array)assert(Number.isFinite(n));g.computeBoundingBox();bounds.union(g.boundingBox!);if(g.userData.part==='roof'){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>0,'upward compressed-export precursor roof');roofFaces++}}
assert(bounds.min.y>=-.001,'negative fitted ends must be clipped at pavement');assert(bounds.max.y>15.8&&bounds.max.y<16.2,'native measured crown');assert(triangles<40000);assert(roofFaces===3);assert(bounds.max.x-bounds.min.x<36,'separate bridge/ventilation structures excluded');
// Long shell surfaces must meet the sloping crown and remain continuous at lower facade stations.
let wallProbes=0;for(const x of[-12,-4,3])for(const y of[1,5,8]){const hit=new T.Raycaster(new T.Vector3(x,y,28),new T.Vector3(0,0,-1)).intersectObjects(meshes)[0];assert(hit,`open unintended south shell x${x} y${y}`);wallProbes++}
// Actual south wall plane, independently read from surveyed endpoints. Every glyph
// must sit in the upper band and be first-hit visible from outside the facade.
const ring=source.roofs.find(r=>r.surface===5)!.rings[0],west=ring[5],east=ring[6];
const tangent=new T.Vector3(east[0]-west[0],0,east[1]-west[1]).normalize(),outward=new T.Vector3(-tangent.z,0,tangent.x),origin=new T.Vector3(west[0],west[2],west[1]),length=Math.hypot(east[0]-west[0],east[1]-west[1]);
const lettering=meshes.filter(m=>m.geometry.userData.part==='south-real-lettering'),glyphIndices=new Set<number>();
assert(lettering.length>0,'photographed real lettering must be present');
let glyphProbes=0,minStation=Infinity,maxStation=-Infinity;
for(const mesh of lettering){
 const g=mesh.geometry,positions=g.getAttribute('position');glyphIndices.add(g.userData.glyphIndex);
 assert.equal(g.userData.text,'KLIM MUUR CENTRAAL');assert.equal(g.userData.palette,'dark');
 for(let i=0;i<positions.count;i++){
  const vertex=new T.Vector3().fromBufferAttribute(positions,i),local=vertex.clone().sub(origin),station=local.dot(tangent),depth=local.dot(outward),top=west[2]+(east[2]-west[2])*station/length;
  minStation=Math.min(minStation,station);maxStation=Math.max(maxStation,station);
  assert(station>.3&&station<length-.3,'sign must fit inside actual facade ends');
  assert(vertex.y>top*.61+.1&&vertex.y<top-.5,'glyph must stay inside photographed pale upper band');
  assert(depth>.055&&depth<.09,'paint geometry must clear corrugation without floating away from wall');
 }
 // Select an outward face, avoiding hollow glyph centers and arbitrary bounds probes.
 let probe:T.Vector3|undefined;
 for(let i=0;i<positions.count;i+=3){const vertices=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(positions,i+j));if(vertices.every(v=>v.clone().sub(origin).dot(outward)>.073)){probe=vertices.reduce((sum,v)=>sum.add(v),new T.Vector3()).multiplyScalar(1/3);break;}}
 assert(probe,'glyph stroke must have an exposed outward face');
 const hit=new T.Raycaster(probe.clone().addScaledVector(outward,2),outward.clone().negate()).intersectObjects(meshes)[0];
 assert(hit&&(hit.object as T.Mesh).geometry.userData.part==='south-real-lettering',`letter ${g.userData.glyph} must be first-hit visible`);glyphProbes++;
}
assert.equal(glyphIndices.size,16,'all sixteen real letters must be modeled');
assert(maxStation-minStation>length*.85&&maxStation-minStation<length*.95,'reference lettering spans most of long facade');
console.log(JSON.stringify({id:'klimmuur-centraal',triangles,roofFaces,wallProbes,glyphProbes,glyphCount:glyphIndices.size,signSpan:maxStation-minStation,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'geometry only; native gallery/live-game acceptance pending'}));
