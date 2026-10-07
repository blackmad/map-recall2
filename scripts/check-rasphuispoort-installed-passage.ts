/** Real installed ordinary chunks + original portal: bounded entrance evidence,
 * not a claim of gallery/game acceptance or a through-route across the complex. */
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {buildFeatureChunk, ORIGIN, type Feature} from '../src/canalRecall/threeBuildingFeatures';
import {type ChunkHostOpeningConfig} from '../src/canalRecall/hostWallOpenings';
import type {Chunk} from '../src/canalRecall/threeBuildingMesh';
import type {BuildingTools} from './landmarks/cultural-builders';
import {buildRasphuispoort} from './landmarks/rasphuispoort-builder';
import source from './landmarks/rasphuispoort-footprints.json';
import spec from './landmarks/rasphuispoort-spec.json';
const features: Feature[]=JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz')).toString()).features;
const retained=features.filter(f=>source.preserveIds.includes(String(f.properties.id)));
const config={...spec.hostWallOpenings[0],additiveModelAvailable:true} as ChunkHostOpeningConfig;
assert.equal(config.hostIdentity,source.hostIdentity);
assert.deepEqual(config.anchorLngLat,source.anchor);
assert.deepEqual(spec.suppressOsmIds,[]);
assert.equal(spec.spatialSuppression,false);
const east=(source.anchor[0]-ORIGIN.lng)*111320*Math.cos(ORIGIN.lat*Math.PI/180),north=(source.anchor[1]-ORIGIN.lat)*110540;
const material=new T.MeshBasicMaterial({side:T.DoubleSide});
const mesh=(g:T.BufferGeometry)=>{const m=new T.Mesh(g,material);m.updateMatrixWorld();return m;};
const chunkMesh=(chunk:Chunk)=>{
 const pos=new Float32Array(chunk.positions.length);
 for(let i=0;i<pos.length;i+=3){pos[i]=chunk.positions[i]-east;pos[i+1]=chunk.positions[i+2];pos[i+2]=north-chunk.positions[i+1];}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setIndex(new T.BufferAttribute(chunk.indices,1));return mesh(g);
};
const portal:T.Mesh[]=[];
const add:BuildingTools['add']=(g,_colour,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);portal.push(mesh(g));};
const tools:BuildingTools={add,box:(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a),prism:()=>{throw Error('unexpected prism');},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{throw Error('unexpected sign');}};
buildRasphuispoort(0,0,tools);
const c=Math.cos(source.authorAngleRadians),s=Math.sin(source.authorAngleRadians);
const native=(x:number,y:number,z:number)=>new T.Vector3(x*c+z*s,y,-x*s+z*c);
const ray=(objects:T.Mesh[],x:number,y:number,far=11)=>new T.Raycaster(native(x,y,4),native(0,0,-1),0,far).intersectObjects(objects)[0];
const records=[];
for(const mode of ['walls','coarse'] as const){
 const original=chunkMesh(buildFeatureChunk(retained,'photo',mode));
 const opened=chunkMesh(buildFeatureChunk(retained,'photo',mode,undefined,[],[],[config]));
 const extras=chunkMesh(buildFeatureChunk(retained,'photo','extras'));
 const scene=[opened,extras,...portal];
 for(const x of [-.7,0,.7])for(const y of [.05,.3,1.5,2.5,3.1]){
  assert(ray([original,...portal],x,y),'baseline installed wall really blocks gate');
  assert(!ray(scene,x,y),`${mode} source-bounded passage clear including gate, retained neighbors and relief extras: ${x},${y}`);
 }
 const distant=ray(scene,0,1.5,100);
 assert(distant && distant.distance>14,'first deeper wall beyond observed passage; not an immediate blocker');
 for(const x of [-1.6,1.6])assert.equal(ray(scene,x,2)?.object.geometry.userData.role,'half-column','portal columns remain visible ahead of host');
 for(const disabled of [{enabled:false},{additiveModelAvailable:false}]){
  const restored=chunkMesh(buildFeatureChunk(retained,'photo',mode,undefined,[],[],[{...config,...disabled}]));
  assert(ray([restored,...portal],0,1.5),'disabled/unavailable exact host fallback blocks original gate edge');
 }
 records.push({mode,passageProbeCount:15,clearBehindAnchorMetres:7,firstDeeperWallDistanceFromAnchorMetres:distant.distance-4,retainedReliefExtrasIncluded:true,firstHitColumns:true,unavailableAndDisabledFallback:true});
}
const result={modelId:spec.id,status:'INSTALLED CPU PASSAGE READY; gallery/live acceptance pending',sourceCommit:'9926aa1',records,scope:'Exact installed entrance edge only. Seven metres of open sightline verified; no distant host wall, roof or neighbor removed. Portal reveal depth remains photo-estimated 0.94 m.',pending:['Root activation/bundles','Three-disabled ordinary extrusion fallback behavior','Independent reference/gallery review','Actual desktop/touch gameplay, POI route/pin/card and performance']};
mkdirSync('artifacts/landmarks/rasphuispoort/host-opening',{recursive:true});writeFileSync('artifacts/landmarks/rasphuispoort/host-opening/installed-passage-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
