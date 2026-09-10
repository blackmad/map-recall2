/** Context lifecycle, including Three's separate instanced-buffer disposal event. */
import assert from 'node:assert/strict';
import { createAppearanceContext } from '../src/canalRecall/cityAppearanceContext.js';

const input={bounds:[0,0,30,30],layers:{waterdeel:[{geometry:{type:'Polygon',coordinates:[[[1,1],[1,8],[8,8],[8,1],[1,1]]]}}],overbruggingsdeel:[{geometry:{type:'Polygon',coordinates:[[[4,0],[4,3],[7,3],[7,0],[4,0]]]}}],scheiding_lijn:[{kind:'kademuur',geometry:{type:'LineString',coordinates:[[1,1],[8,1]]}},{kind:'muur',geometry:{type:'LineString',coordinates:[[2,2],[3,2]]}}]},trees:[{id:1,position:[10,10],height:13.5,heightClass:'d. 12 tot 15 m.',species:"Platanus hispanica 'Tremonia'",type:'Boom niet vrij uitgroeiend',year:1998}]};
const before=JSON.stringify(input),resource=createAppearanceContext(input);
const children=[...resource.group.children],instances=children.filter((m:any)=>m.isInstancedMesh);
assert.equal(resource.stats.trees,1);assert.equal(resource.stats.bridges,1);assert.equal(resource.stats.boundaries,1,'only classified canal-edge boundaries render');assert.equal(instances.length,4);
const water=children.find((mesh:any)=>mesh.material?.isMeshPhysicalMaterial);assert.ok(water,'source water receives a distinct reflective material');assert.equal(water.material.transparent,false);
const bridgeSide=children.find((mesh:any)=>mesh.material?.color.getHexString()==='8f9188');assert.ok(bridgeSide,'source bridge footprint receives a separately batched edge');const bridgeYs=[];for(let i=1;i<bridgeSide.geometry.attributes.position.array.length;i+=3)bridgeYs.push(bridgeSide.geometry.attributes.position.array[i]);assert.ok(Math.abs(Math.min(...bridgeYs)+.18)<1e-5&&Math.abs(Math.max(...bridgeYs)-.12)<1e-5,'bridge edge has a shallow, explicitly illustrative vertical profile');
const quay=children.find((mesh:any)=>mesh.material?.color.getHexString()==='817a6b');assert.ok(quay,'classified quay alignment receives its own material batch');const quayYs=[];for(let i=1;i<quay.geometry.attributes.position.array.length;i+=3)quayYs.push(quay.geometry.attributes.position.array[i]);assert.ok(Math.abs(Math.min(...quayYs)-.02)<1e-6&&Math.abs(Math.max(...quayYs)-.55)<1e-6,'quay wall height is the bounded illustrative profile');
let instanceDisposals=0,geometryDisposals=0,materialDisposals=0;
for(const mesh of children){
  mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);
  if(mesh.isInstancedMesh)mesh.addEventListener('dispose',()=>instanceDisposals++);
}
const materials=new Set(children.map((m:any)=>m.material));
for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++);
resource.dispose();resource.dispose();
assert.equal(instanceDisposals,4,'instanceMatrix GPU buffers require mesh disposal, not only geometry disposal');
assert.equal(geometryDisposals,children.length);assert.equal(materialDisposals,materials.size);
assert.equal(resource.group.children.length,0);assert.equal(JSON.stringify(input),before);
assert.throws(()=>createAppearanceContext({bounds:[0,0,NaN,3]}),/bounds/);
console.log('City context: inventory trees, source immutability, instance-buffer disposal, palette/geometry disposal and idempotence passed.');
