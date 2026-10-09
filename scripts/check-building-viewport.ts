/** Full exported bounds, distance hysteresis and real 20-owner budget selection. */
import fs from 'node:fs';import assert from 'node:assert/strict';import * as THREE from 'three';
import {BuildingViewportPlanner,type ViewportManifest} from '../src/canalRecall/buildingLibraryViewport';
const root='artifacts/district-render-chunks',manifest=JSON.parse(fs.readFileSync(root+'/fine/tiles.json','utf8'));
const budgets={maxChunks:8,maxTriangles:20000,maxGeometryBytes:2000000};
const planner=new BuildingViewportPlanner({detail:manifest},budgets);
const camera=new THREE.PerspectiveCamera(70,1.3,.1,1600);camera.up.set(0,0,1);
const cases=[];
for(const tile of manifest.tiles){const centre=new THREE.Vector3(...tile.bounds.min).add(new THREE.Vector3(...tile.bounds.max)).multiplyScalar(.5).add(new THREE.Vector3(...tile.offset));camera.position.copy(centre).add(new THREE.Vector3(0,-35,20));camera.lookAt(centre);const plan=planner.plan(camera);
 assert.ok(plan.selected.some(s=>s.key===tile.key),'Near visible owner must receive priority');assert.ok(plan.triangles<=budgets.maxTriangles);assert.ok(plan.geometryBytes<=budgets.maxGeometryBytes);assert.ok(plan.selected.length<=budgets.maxChunks);assert.equal(new Set(plan.selected.flatMap(s=>s.tile.owners)).size,plan.selected.flatMap(s=>s.tile.owners).length);cases.push({target:tile.key,visible:plan.visibleCandidates,selected:plan.selected.length,triangles:plan.triangles,bytes:plan.geometryBytes});}
const owner={id:'crossing',buildingId:'BAG-crossing',geometryRevision:'source',canonicalOwnershipKey:'14/1/1'};
const detail:ViewportManifest={version:1,binaryEndianness:'little',owners:[owner],tiles:[{key:'18/1/1',offset:[1000,0,0],bounds:{min:[-1010,-2,-2],max:[10,2,2]},binaryUrl:'detail.bin',geometryBytes:1000,triangles:100,owners:['crossing'],batches:[]}]};
const variant=(triangles:number,bytes:number):ViewportManifest=>({...detail,tiles:detail.tiles.map(t=>({...t,triangles,geometryBytes:bytes}))});
const lod=new BuildingViewportPlanner({detail,facade:variant(50,500),massing:variant(10,100)},{maxChunks:1,maxTriangles:100,maxGeometryBytes:1000});
const ortho=new THREE.OrthographicCamera(-5,5,5,-5,.1,2000);ortho.position.set(0,-40,0);ortho.up.set(0,0,1);ortho.lookAt(0,0,0);
assert.equal(lod.plan(ortho).selected[0].level,'detail','Use full bounds crossing nominal chunk origin');
ortho.position.set(0,-130,0);ortho.lookAt(0,0,0);assert.equal(lod.plan(ortho).selected[0].level,'facade');
ortho.position.set(0,-300,0);ortho.lookAt(0,0,0);assert.equal(lod.plan(ortho).selected[0].level,'massing');
ortho.position.set(0,-240,0);ortho.lookAt(0,0,0);assert.equal(lod.plan(ortho).selected[0].level,'massing','Retain far LOD within hysteresis band');
ortho.position.set(0,-220,0);ortho.lookAt(0,0,0);assert.equal(lod.plan(ortho).selected[0].level,'facade');
const constrained=new BuildingViewportPlanner({detail,facade:variant(50,500),massing:variant(10,100)},{maxChunks:1,maxTriangles:20,maxGeometryBytes:200});ortho.position.set(0,-40,0);ortho.lookAt(0,0,0);assert.equal(constrained.plan(ortho).selected[0].level,'massing','Admission may use actual lighter geometry when near detail exceeds budget');
const mismatch=variant(10,100);mismatch.owners=[{...owner,geometryRevision:'changed'}];assert.throws(()=>new BuildingViewportPlanner({detail,massing:mismatch},budgets),/identity/);
const bounds=variant(10,100);bounds.tiles[0].bounds={min:[NaN,0,0],max:[1,1,1]};assert.throws(()=>new BuildingViewportPlanner({detail:bounds},budgets),/bounds/);
const report={passed:true,realOwnerCount:20,realChunkCases:cases,completeBoundsUsed:true,nominalBoundaryCrossingOwnerSelected:true,nearestVisibleChunksPrioritized:true,residentBudgetsRespected:true,oneRepresentationPerOwner:true,lodHysteresisMathVerified:true,lighterAvailableGeometryUsedWhenBudgetRequires:true,actualAvailableAssets:['detail'],unbuiltLodAssetsNotClaimed:true};fs.writeFileSync(root+'/viewport-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,cases:cases.length,maxTriangles:Math.max(...cases.map(c=>c.triangles)),maxBytes:Math.max(...cases.map(c=>c.bytes)),actualAvailableAssets:['detail']}));
