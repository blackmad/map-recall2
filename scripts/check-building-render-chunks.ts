/** Canonical ownership, whole-owner chunks and enforced resident triangle limits. */
import fs from 'node:fs';import assert from 'node:assert/strict';import * as THREE from 'three';
import {planBuildingRenderChunks} from '../src/canalRecall/buildingLibraryRenderChunks';
import {BuildingLibraryTileStore,decodeBuildingLibraryTile} from '../src/canalRecall/buildingLibraryTileLoader';
const root='artifacts/district-render-chunks',read=(p:string)=>JSON.parse(fs.readFileSync(root+'/'+p,'utf8'));
const coarse=read('coarse/tiles.json'),fine=read('fine/tiles.json'),coarseReport=read('coarse/report.json'),fineReport=read('fine/report.json');
assert.equal(coarse.owners.length,20);assert.equal(fine.owners.length,20);
const canonical=new Map(coarse.owners.map((o:any)=>[o.id,o]));
for(const owner of fine.owners){const previous:any=canonical.get(owner.id);assert.equal(owner.canonicalOwnershipKey,previous.canonicalOwnershipKey);assert.equal(owner.sourceModelHash,previous.sourceModelHash);assert.deepEqual(owner.consumerTransform,previous.consumerTransform);}
assert.equal(fineReport.batchTriangles,coarseReport.batchTriangles);assert.ok(fineReport.maxChunkTriangles<coarseReport.maxChunkTriangles);assert.ok(fineReport.maxChunkGeometryBytes<coarseReport.maxChunkGeometryBytes);
const ids=fine.tiles.flatMap((t:any)=>t.owners);assert.equal(ids.length,new Set(ids).size);assert.equal(ids.length,20);
const owners=new Map<string,any>(fine.owners.map((o:any)=>[o.id,o]));
const bytes=(tile:any)=>{const b=fs.readFileSync(root+'/fine/'+tile.binaryUrl);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
for(const tile of fine.tiles){const resource=decodeBuildingLibraryTile(tile,bytes(tile),owners);assert.equal(resource.triangles,tile.triangles);assert.equal(resource.geometryBytes,tile.geometryBytes);resource.dispose();assert.equal(resource.disposed,true);}
// One large footprint crossing finer grid boundaries is never fragmented.
const crossing={id:'crossing-owner',geometryRevision:'immutable',footprint:{type:'Polygon' as const,coordinates:[[[4.87,52.36],[4.91,52.36],[4.91,52.39],[4.87,52.39],[4.87,52.36]]]},geometry:{original:true}};
const a=planBuildingRenderChunks([crossing],14),b=planBuildingRenderChunks([crossing],18);
assert.equal(a.canonicalOwnerTiles.get(crossing.id),b.canonicalOwnerTiles.get(crossing.id));assert.equal(b.tiles.length,1);assert.equal(b.tiles[0].owners[0].footprint,crossing.footprint);assert.equal(b.tiles[0].owners[0].geometry,crossing.geometry);
for(const zoom of [13,21,18.5,NaN])assert.throws(()=>planBuildingRenderChunks([crossing],zoom),/Render zoom/);
const parent=new THREE.Group();let fetches=0,maxTriangles=0,maxBytes=0;
const store=new BuildingLibraryTileStore(fine,{parent,maxTiles:50,maxConcurrent:2,maxResidentGeometryBytes:2_000_000,maxResidentTriangles:20_000,fetchBinary:async tile=>{fetches++;return bytes(tile);}});
for(const tile of fine.tiles){await store.load(tile.key);maxTriangles=Math.max(maxTriangles,store.stats.residentTriangles);maxBytes=Math.max(maxBytes,store.stats.residentGeometryBytes);assert.ok(store.stats.residentTriangles<=20_000);assert.ok(store.stats.residentGeometryBytes<=2_000_000);assert.equal(store.stats.owners.length,new Set(store.stats.owners).size);}
assert.ok(store.stats.residentTiles<fine.tiles.length);store.dispose();assert.equal(parent.children.length,0);assert.equal(store.stats.residentTriangles,0);
const small=fine.tiles.find((t:any)=>t.triangles<5000),large=fine.tiles.find((t:any)=>t.triangles>10000);assert.ok(small&&large);fetches=0;
const bounded=new BuildingLibraryTileStore(fine,{parent,maxTiles:50,maxResidentTriangles:5000,fetchBinary:async tile=>{fetches++;return bytes(tile);}});
const good=await bounded.load(small.key);const priorFetches=fetches;await assert.rejects(bounded.load(large.key),/triangle budget/);assert.equal(fetches,priorFetches);assert.equal(good!.disposed,false);
const malicious=JSON.parse(JSON.stringify(large));malicious.triangles=1;assert.throws(()=>decodeBuildingLibraryTile(malicious,bytes(large),owners),/triangle total/);bounded.dispose();
const report={passed:true,realOwners:20,canonicalOwnersUnchanged:true,wholeOwnerCrossingPreserved:true,originalHashesAndTransformsUnchanged:true,coarseChunks:coarse.tiles.length,fineChunks:fine.tiles.length,coarseMaxChunkTriangles:coarseReport.maxChunkTriangles,fineMaxChunkTriangles:fineReport.maxChunkTriangles,coarseMaxChunkBytes:coarseReport.maxChunkGeometryBytes,fineMaxChunkBytes:fineReport.maxChunkGeometryBytes,originalTriangles:fineReport.batchTriangles,coarseDraws:coarseReport.batchMaterialDraws,fineDraws:fineReport.batchMaterialDraws,residentTriangleBudget:20000,maxResidentTriangles:maxTriangles,residentByteBudget:2000000,maxResidentBytes:maxBytes,oversizedChunkRejectedBeforeFetch:true,invalidTriangleMetadataRejected:true,gpuResourcesDisposed:true};
fs.writeFileSync(root+'/chunk-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
