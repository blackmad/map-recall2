import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {contextFeatures,rowFeatures,rowIds,parents,profiles,streets,xy,catalog} from './marnixstraat-pilot.ts';
import {buildFeatureChunk,meshBuildingFor,ORIGIN} from '../../src/canalRecall/threeBuildingFeatures.ts';
import {streetWallBuilding} from '../../src/canalRecall/streetFacadeRendering.ts';
import {planRepeatedTerraceFrontage} from '../../src/canalRecall/repeatedTerraceFrontage.ts';
import {sourceVisualRoof} from '../../src/canalRecall/sourceVisualRoof.ts';
import {recipeForWall,validateStreetAppearanceCatalog} from '../../src/canalRecall/streetAppearance.ts';

test('eight exact source parents get one alternating crown; rear/opposite identities and facts retain fallback',()=>{
 assert.equal(rowIds.length,8);
 for(const [i,f]of rowFeatures.entries()){
  const snapshot=JSON.stringify(f),roof=sourceVisualRoof(f,profiles);assert(roof);
  assert.equal(JSON.stringify(f),snapshot);assert.equal(roof.feature.geometry,f.geometry);
  assert.equal(roof.feature.properties.height,f.properties.height);assert.equal(roof.feature.properties.constructionYear,f.properties.constructionYear);
  assert.equal(roof.plan.repeatedTerrace!.gable,i%2?'spout':'step');
  assert.equal(Number(roof.feature.properties.roofEavesHeightM)+roof.plan.riseM,Number(f.properties.height));
  const v=parents[i].marnixstraatFrontage,front=v.vertices;
  assert(recipeForWall(profiles,{start:front[0] as [number,number],end:front[1] as [number,number],normal:v.outwardNormalEastNorth as [number,number]},{id:String(f.properties.id),year:1878,heightM:Number(f.properties.height)}));
  assert.equal(recipeForWall(profiles,{start:front[0] as [number,number],end:front[1] as [number,number],normal:v.outwardNormalEastNorth.map(n=>-n) as [number,number]},{id:String(f.properties.id),year:1878,heightM:Number(f.properties.height)}),undefined);
 }
 for(const f of contextFeatures.filter(f=>!rowIds.includes(String(f.properties.id))))assert.equal(sourceVisualRoof(f,profiles),undefined);
});

test('native merged wall chunk exposes both halves of every principal window; roof and neighbor geometry cannot bury glazing',()=>{
 const chunk=buildFeatureChunk(rowFeatures,'photo','walls',streets,profiles,contextFeatures);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(chunk.positions,3));geometry.setIndex(new T.BufferAttribute(chunk.indices,1));
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.FrontSide}));mesh.updateMatrixWorld(true);
 let samples=0;
 for(const [i,f]of rowFeatures.entries()){
  const source=parents[i].marnixstraatFrontage,[a,b]=source.vertices.map(xy),L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=source.outwardNormalEastNorth;
  const r=profiles[0].recipes[i].recipe.repeatedTerraceFrontage!;
  const plan=planRepeatedTerraceFrontage({lengthM:L,baseM:0,topM:Number(f.properties.height)-2.4,recipe:r});assert(plan);
  // The same parent is also in resident context at its old eave; its solid pier must remain.
  const pier=new T.Vector3(a[0]+u[0]+n[0]*2,a[1]+u[1]+n[1]*2,5);
  const wall=new T.Raycaster(pier,new T.Vector3(-n[0],-n[1],0),0,3).intersectObject(mesh,false)[0];assert(wall,'Self-context must not erase the parent masonry');
  assert(Math.abs(wall.distance-2)<.01);
  for(const row of r.upperRows)for(const axis of plan.axes){
   const from=new T.Vector3(a[0]+u[0]*axis+n[0]*2,a[1]+u[1]*axis+n[1]*2,row.bottomM+row.heightM*.35);
   const divider=new T.Raycaster(from,new T.Vector3(-n[0],-n[1],0),0,3).intersectObject(mesh,false)[0];assert(divider);
   const vertex=chunk.indices[divider.faceIndex!*3],tint=chunk.tints.slice(vertex*4,vertex*4+4);
   assert(tint[0]>200&&tint[1]>200&&tint[2]>180,'Every paired divider must retain the pale frame material');
  }
  for(const w of plan.windows.filter(w=>w.part!=='entrance-transom'))for(const fraction of [.24,.76]){
   const along=w.left+w.width*fraction,z=w.bottom+w.height*.35;
   const origin=new T.Vector3(a[0]+u[0]*along+n[0]*2,a[1]+u[1]*along+n[1]*2,z);
   const hit=new T.Raycaster(origin,new T.Vector3(-n[0],-n[1],0),0,3).intersectObject(mesh,false)[0];assert(hit,'Visible pane '+f.properties.id);
   const depth=(hit.point.x-a[0]-u[0]*along)*n[0]+(hit.point.y-a[1]-u[1]*along)*n[1];
   assert(depth<-.09&&depth>-.20,`Pane must be recessed glazing, not a parent wall/frame (${f.properties.id}, ${depth})`);samples++;
  }
 }
 assert.equal(samples,8*11*2);geometry.dispose();
});

test('source assembly survives coarse/detail and look switches; controls remain identical and malformed registrations reject',()=>{
 for(const look of ['photo','storybook','cartoon','procedural'] as const)for(const mode of ['walls','coarse'] as const){
  const candidate=buildFeatureChunk(rowFeatures,look,mode,streets,profiles,contextFeatures);
  assert.equal(candidate.buildingCount,8);assert(candidate.indices.length/3>5000,'Source openings remain in wall chunk at coarse LOD');
 }
 const controls=contextFeatures.filter(f=>!rowIds.includes(String(f.properties.id))),a=buildFeatureChunk(controls,'photo','walls',streets,[]),b=buildFeatureChunk(controls,'photo','walls',streets,profiles);
 assert.deepEqual(a,b,'Neighbor geometry/color/roofs must remain exact fallback');
 const bad=structuredClone(catalog);bad.profiles[0].recipes[0].recipe.repeatedTerraceRoof!.riseM=NaN;assert.throws(()=>validateStreetAppearanceCatalog(bad),/terrace roof/);
 const wide=structuredClone(catalog);delete wide.profiles[0].buildingIds;assert.throws(()=>validateStreetAppearanceCatalog(wide),/terrace frontage/);
 assert.equal(ORIGIN.lng,4.9);
});

test('source-described blind end walls omit invented windows without applying that rule to rear walls',()=>{
 for(const [i,sign]of [[0,-1],[7,1]]){
  const f=rowFeatures[i],roof=sourceVisualRoof(f,profiles)!;
  const building=meshBuildingFor(roof.feature,'photo',false,roof.plan)!;
  building.streetAppearance={profiles,look:'photo',year:1878,sourceHeightM:Number(f.properties.height)};
  const [a,b]=parents[i].marnixstraatFrontage.vertices.map(xy),l=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/l,(b[1]-a[1])/l],n=parents[i].marnixstraatFrontage.outwardNormalEastNorth;
  const wall={x0:a[0],y0:a[1],x1:a[0]-n[0]*8,y1:a[1]-n[1]*8,nx:u[0]*sign,ny:u[1]*sign,hole:false};
  assert.equal(streetWallBuilding(building,wall,ORIGIN,true).bare,true);
  assert.notEqual(streetWallBuilding(building,{...wall,nx:-n[0],ny:-n[1]},ORIGIN,false).bare,true);
 }
});
