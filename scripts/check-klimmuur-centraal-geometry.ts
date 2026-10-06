import assert from 'node:assert/strict';
import * as T from 'three';
import {buildKlimmuurCentraal} from './landmarks/klimmuur-centraal-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
const meshes:T.Mesh[]=[];const mat=new T.MeshBasicMaterial({side:T.DoubleSide});
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.userData.palette=c;meshes.push(new T.Mesh(g,mat))};const unused=()=>{throw Error('unexpected primitive')};
buildKlimmuurCentraal(0,0,{add,box:unused,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
const bounds=new T.Box3();let triangles=0,roofFaces=0;for(const m of meshes){const g=m.geometry,p=g.getAttribute('position');triangles+=(g.index?.count??p.count)/3;for(const n of p.array)assert(Number.isFinite(n));g.computeBoundingBox();bounds.union(g.boundingBox!);if(g.userData.part==='roof'){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>0,'upward compressed-export precursor roof');roofFaces++}}
assert(bounds.min.y>=-.001,'negative fitted ends must be clipped at pavement');assert(bounds.max.y>15.8&&bounds.max.y<16.2,'native measured crown');assert(triangles<40000);assert(roofFaces===3);assert(bounds.max.x-bounds.min.x<36,'separate bridge/ventilation structures excluded');
// Long shell surfaces must meet the sloping crown and remain continuous at lower facade stations.
let wallProbes=0;for(const x of[-12,-4,3])for(const y of[1,5,8]){const hit=new T.Raycaster(new T.Vector3(x,y,28),new T.Vector3(0,0,-1)).intersectObjects(meshes)[0];assert(hit,`open unintended south shell x${x} y${y}`);wallProbes++}
console.log(JSON.stringify({id:'klimmuur-centraal',triangles,roofFaces,wallProbes,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'geometry only; native gallery/live-game acceptance pending'}));
