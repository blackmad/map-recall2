import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SharedAssetCache} from '../src/canalRecall/landmarks/sharedAssetCache.ts';
const requests=[];
const asyncRequests=[];
class Loader {setMeshoptDecoder(){}load(url,done,_progress,fail){requests.push({url,done,fail});}loadAsync(url){return new Promise((resolve,reject)=>asyncRequests.push({url,resolve,reject}));}}
class Renderer {dispose(){this.disposed=true;}}
globalThis.window={location:{href:'http://localhost/canal-drive/'},CanalRecallThree:{THREE:{...THREE,WebGLRenderer:Renderer},GLTFLoader:Loader},CanalRecallSignatureLandmarks:{SharedAssetCache,SIGNATURE_MODELS:[],placementFor:spec=>{if(spec.failPlacement)throw Error('Bad placement');return {anchor:spec.surveyed?.anchor||spec.footprint.centre,altitudeMetres:0,scale:1,modelRotationDegrees:0,...(spec.mirror?{mirror:true}:{})};},basemapBuildingFilter:ids=>ids}};
const {SignatureLandmarks}=await import('../public/canal-drive/js/signature-landmarks-source.js');
let lng=4.9;
const listeners=new Map(),filters=[],callbacks=[];
const map={addLayer(layer){layer.onAdd(this,null);},getCanvas(){},getBounds:()=>({getWest:()=>lng-.001,getEast:()=>lng+.001,getNorth:()=>52.371,getSouth:()=>52.369}),getCenter:()=>({lng,lat:52.37}),on:(event,fn)=>listeners.set(event,fn),off:event=>listeners.delete(event),getLayer:()=>true,getFilter:()=>null,setFilter:(_id,filter)=>filters.push(filter),triggerRepaint(){}};
const projection={MercatorCoordinate:{fromLngLat:([x,y],z)=>({x,y,z,meterInMercatorCoordinateUnits:()=>1})}};
const spec=(id,x,length=20)=>({id,name:id,modelUrl:`./models/${id}.glb`,landmarkId:id,footprint:{centre:[x,52.37],lengthMetres:length,widthMetres:20},suppressOsmIds:[`w${id}`]});
const models=[spec('a',4.9),spec('b',4.901),spec('c',4.902),spec('large',4.907,1000),spec('far',5.1)];
const layer=new SignatureLandmarks(map,projection,{models:[...models,models[0]],loadVisibleOnly:true,onModelShown:s=>callbacks.push(s.id)});
assert.equal(requests.length,2);assert.equal(layer._pending.size,2);assert.deepEqual(layer.shownSuppressOsmIds(),[],'pending models must not hide footprints');
const boundsFn=map.getBounds;map.getBounds=()=>{throw Error('Saturated queue must not scan viewport');};
listeners.get('moveend')();assert.equal(requests.length,2,'no duplicate requests on movement');map.getBounds=boundsFn;
const imported=()=>new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));
requests[0].done({scene:imported()});assert.equal(requests.length,3);assert.deepEqual(layer.shownSuppressOsmIds(),['wa']);assert.deepEqual(callbacks,['a']);
layer.setEnabled(false);requests[1].done({scene:imported()});assert.equal(requests.length,3,'hidden layers pause new loads');assert.deepEqual(layer.shownSuppressOsmIds(),[]);
layer.setEnabled(true);assert.equal(requests.length,4,'re-enable resumes queued nearby models');assert.ok(requests[3].url.includes('large.glb'),'large footprint intersects loading envelope');
const warn=console.warn;console.warn=()=>{};
requests[2].fail(Error('404'));console.warn=warn;
assert.equal(layer.shown.has('c'),false);assert.ok(!layer.shownSuppressOsmIds().includes('wc'),'failed decode keeps basemap');
listeners.get('moveend')();assert.equal(requests.length,4,'failed models do not cause repeated network requests');
requests[3].done({scene:imported()});assert.equal(requests.length,4,'distant model not fetched');
lng=5.1;listeners.get('moveend')();assert.equal(requests.length,5);assert.ok(requests[4].url.includes('far.glb'));
const late=imported();let disposed=0;late.children[0].geometry.addEventListener('dispose',()=>disposed++);
const before=callbacks.length;layer.layer.onRemove(map);requests[4].done({scene:late});
assert.equal(disposed,1);assert.equal(callbacks.length,before,'removed layer receives no late callbacks');assert.equal(layer.describe().length,0);assert.deepEqual(filters.at(-1),[]);assert.equal(listeners.size,0);
// The default demo still queues every model without any movement.
requests.length=0;lng=4.9;
const eager=new SignatureLandmarks(map,projection,{models});
assert.equal(requests.length,2);
for(let i=0;i<models.length;i++)requests[i].done({scene:imported()});
assert.equal(requests.length,models.length);assert.equal(eager.describe().length,models.length);eager.layer.onRemove(map);
requests.length=0;
const broken=new SignatureLandmarks(map,projection,{models:[spec('host-failure',4.9),{...spec('placement-failure',4.9),failPlacement:true}],onModelShown:()=>{throw Error('Host callback failed');}});
console.warn=()=>{};
requests[0].done({scene:imported()});requests[1].done({scene:imported()});console.warn=warn;
assert.equal(broken.describe().length,0,'failed insertion is rolled back');assert.equal(broken.shown.size,0);assert.deepEqual(broken.shownSuppressOsmIds(),[]);assert.deepEqual(filters.at(-1),[],'failed placement and host callbacks restore extrusion');
broken.layer.onRemove(map);
// Shared meshes (recipe-pipeline houses): one decode per URL, a clone per instance, mirror flips X, resources freed with the last instance.
{
  const shared=(id,x,mirror)=>({...spec(id,x),modelUrl:'./models/ordinary-buildings/recipe-shared.glb',sharedModel:true,...(mirror?{mirror:true}:{})});
  const group=new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));
  let geometryDisposed=0;group.children[0].geometry.addEventListener('dispose',()=>geometryDisposed++);
  const instanced=new SignatureLandmarks(map,projection,{models:[shared('s1',4.9),shared('s2',4.9005,true)],loadVisibleOnly:true});
  assert.equal(asyncRequests.length,1,'two instances of one shared GLB decode it once');
  asyncRequests[0].resolve({scene:group});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(instanced.shown.size,2,'both instances are placed from the one decode');
  assert.equal(instanced._sharedAssets.size,1);
  const entries=instanced._entries;
  assert.equal(entries[0].group.scale.x>0,true,'plain instance keeps handedness');
  assert.equal(entries[1].group.scale.x<0,true,'mirrored instance negates X so three.js flips triangle winding');
  assert.notEqual(entries[0].group.children[0],entries[1].group.children[0],'each instance has its own scene graph');
  assert.equal(entries[0].group.children[0].children[0].geometry,entries[1].group.children[0].children[0].geometry,'instances share geometry');
  instanced._disposeModel(entries[0].group,entries[0].spec,entries[0].url);
  assert.equal(geometryDisposed,0,'shared geometry survives while another instance uses it');
  instanced._disposeModel(entries[1].group,entries[1].spec,entries[1].url);
  assert.equal(geometryDisposed,1,'the last instance frees the shared geometry');
  instanced._entries=[];instanced.layer.onRemove(map);
}
console.log('Passed: opt-in nearby loading, footprint extent, two concurrent loads, no duplicate/failure loops, loaded-only suppression, toggles, late disposal and eager demos.');
