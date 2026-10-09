/** Decode real GLBs and exercise the exact game consumer, without a live map. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import maplibre from 'maplibre-gl';
import {placementFor} from '../src/canalRecall/landmarks/signaturePlacement';
import {rdProjectedSurvey} from '../src/canalRecall/landmarks/rdProjectionBasis';
import {rdToLngLat} from '../src/canalRecall/facade/rdNew';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
(globalThis as any).window={CanalRecallThree:{THREE,GLTFLoader},CanalRecallSignatureLandmarks:{placementFor},location:{href:'http://localhost/'}};
const code=fs.readFileSync('public/canal-drive/js/signature-landmarks-source.js','utf8').replace('export class SignatureLandmarks','class SignatureLandmarks');
const Consumer=new Function(code+';return SignatureLandmarks;')();
const cases=[['scripts/blender/expansion/recipes/rozengracht-114.json','artifacts/source-massing-review/models/rozengracht-114.glb'],['artifacts/l37-scope-correction/lauriergracht-37.json','artifacts/l37-scope-correction/models/lauriergracht-37.glb']];
const modelRootIndex=process.argv.indexOf('--model-root');
const exported=new Map<string,any>();let modelRoot:string|undefined;
const skipped:Array<{id:string;reason:string}>=[];
if(modelRootIndex>=0){
 const directory=process.argv[modelRootIndex+1];if(!directory)throw new Error('--model-root requires a directory');modelRoot=path.resolve(directory);
 const manifest=read(path.join(modelRoot,'manifest.json'));assert.ok(Array.isArray(manifest.models),'Export manifest must list models');
 cases.length=0;
 for(const model of manifest.models){
  if(model.synthetic){skipped.push({id:model.id,reason:'synthetic'});continue;}
  if(!model.sourceRDFrame){skipped.push({id:model.id,reason:'no exported sourceRDFrame'});continue;}
  assert.match(model.id,/^[A-Za-z0-9][A-Za-z0-9_.-]*$/);assert.ok(!exported.has(model.id),'Duplicate manifest model');
  const filename=(url:string)=>path.posix.basename(new URL(url,'http://fixture.local/').pathname);
  assert.equal(filename(model.recipeUrl),model.id+'.recipe.json');assert.equal(filename(model.modelUrl),model.id+'.glb');
  cases.push([path.join(modelRoot,filename(model.recipeUrl)),path.join(modelRoot,filename(model.modelUrl))]);exported.set(model.id,model);
 }
 assert.ok(cases.length>0,'Manifest has no real models with source RD frames');
}
const results=[];
for(const [recipePath,modelPath] of cases){
 const recipe=read(recipePath),frame=recipe.placement.sourceRDFrame,metadata=exported.get(recipe.id);
 if(modelRoot){
  assert.ok(metadata,'Downloaded recipe ID must match manifest');assert.equal(recipe.synthetic,false);
  assert.equal(recipe.buildingId,metadata.buildingId);assert.equal(recipe.geometryRevision,metadata.geometryRevision);
  assert.deepEqual(frame,metadata.sourceRDFrame,'Manifest/source recipe RD metadata must agree');
  assert.deepEqual(recipe.placement.frontageLocal,metadata.frontageLocal);assert.deepEqual(recipe.placement.anchor,metadata.anchor);
  assert.equal(recipe.massing?.mode,metadata.massingMode,'Exported massing mode must match downloaded recipe');
 }
 assert.equal(frame.buildingId,recipe.buildingId);assert.equal(frame.geometryRevision,recipe.geometryRevision);
 const appearanceRoof=recipe.massing?.appearanceRoof;
 if(metadata)assert.deepEqual(metadata.appearanceRoof??null,appearanceRoof??null,'Exported appearance-roof provenance must match recipe');
 const measuredRoofRequired=(metadata?.massingMode??recipe.massing?.mode)==='source-derived'&&!appearanceRoof;
 const bytes=fs.readFileSync(modelPath);const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const owner=Object.create(Consumer.prototype);Object.assign(owner,{maplibregl:maplibre,_entries:[],shown:new Set(),_applySuppression(){},onModelShown(){}});
 const spec:any={id:recipe.id,name:recipe.name,suppressOsmIds:[],groundAltitudeMetres:3.5,facingOffsetDegrees:0,surveyed:{anchor:recipe.placement.anchor,northOffsetDegrees:recipe.placement.xAxisBearingDegrees-90}};
 const add=(surveyed:any)=>{owner._add(new THREE.Scene(),{...spec,surveyed},gltf.scene.clone(true),{triggerRepaint(){}});return owner._entries.at(-1);};
 const legacy=add(spec.surveyed),surveyed={...spec.surveyed,...rdProjectedSurvey(frame,maplibre.MercatorCoordinate)},entry=add(surveyed);
 assert.equal(entry.placement.scale,1);assert.equal(entry.placement.altitudeMetres,3.5);
 const anchor=maplibre.MercatorCoordinate.fromLngLat(surveyed.anchor,3.5),units=anchor.meterInMercatorCoordinateUnits();

 const legacyCoordinate=maplibre.MercatorCoordinate.fromLngLat(spec.surveyed.anchor,3.5),oldUnits=legacyCoordinate.meterInMercatorCoordinateUnits();
 const oldMatrix=new THREE.Matrix4().makeTranslation(legacyCoordinate.x,legacyCoordinate.y,legacyCoordinate.z).scale(new THREE.Vector3(oldUnits,-oldUnits,oldUnits)).multiply(new THREE.Matrix4().makeRotationZ((90-legacy.placement.modelRotationDegrees)*Math.PI/180)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
 assert.deepEqual(legacy.transform.elements,oldMatrix.elements,'Existing surveyed landmarks must preserve original matrix');
 const base=new THREE.Vector3().applyMatrix4(entry.transform);assert.ok(base.distanceTo(new THREE.Vector3(anchor.x,anchor.y,anchor.z))<1e-15);
 const up=new THREE.Vector3(0,1,0).applyMatrix4(entry.transform).sub(base);assert.ok(Math.abs(up.z/units-1)<1e-8);assert.ok(Math.hypot(up.x,up.y)<1e-15);
 assert.ok(entry.transform.determinant()<0,'Only intended Mercator south-axis reflection');
 const source=(p:number[])=>maplibre.MercatorCoordinate.fromLngLat(rdToLngLat({x:frame.anchorRD[0]+p[0]*frame.xAxisRD[0]+p[1]*frame.yAxisRD[0],y:frame.anchorRD[1]+p[0]*frame.xAxisRD[1]+p[1]*frame.yAxisRD[1]}));
 const residual=(p:number[],matrix:THREE.Matrix4)=>{const actual=new THREE.Vector3(p[0],0,-p[1]).applyMatrix4(matrix),expected=source(p);return Math.hypot(actual.x-expected.x,actual.y-expected.y)/units;};
 const maxFootprintErrorM=Math.max(...recipe.footprint.map((p:number[])=>residual(p,entry.transform)));
 const baselineFootprintErrorM=Math.max(...recipe.footprint.map((p:number[])=>residual(p,legacy.transform)));
 assert.ok(maxFootprintErrorM<.001,`${recipe.id} footprint ${maxFootprintErrorM}m`);
 entry.group.updateMatrixWorld(true);
 let checkedAssetVertices=0,maxAssetVertexMapErrorM=0;
 entry.group.traverse((obj:any)=>{if(!obj.isMesh)return;const attr=obj.geometry.attributes.position;for(let i=0;i<attr.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(obj.matrixWorld);
  const actual=p.clone().applyMatrix4(entry.transform),expected=source([p.x,-p.z]);
  maxAssetVertexMapErrorM=Math.max(maxAssetVertexMapErrorM,Math.hypot(actual.x-expected.x,actual.y-expected.y)/units);checkedAssetVertices++;
 }});
 assert.ok(checkedAssetVertices>0);assert.ok(maxAssetVertexMapErrorM<.001,recipe.id+' exported geometry projection exceeds1mm');
 const patches=recipe.massing?.sourcePatches??[];
 const replaced=new Set<number>(patches.flatMap((patch:any)=>patch.surfaceIndices));
 const retainedRoofIndices=recipe.sourceShell.surfaces.flatMap((s:any,index:number)=>s.type==='roof'&&!replaced.has(index)?[index]:[]);
 const replacedRoofIndices=recipe.sourceShell.surfaces.flatMap((s:any,index:number)=>s.type==='roof'&&replaced.has(index)?[index]:[]);
 const sourceRoof=retainedRoofIndices.flatMap((index:number)=>recipe.sourceShell.surfaces[index].rings.flat());
 const inferredRoofs=patches.flatMap((patch:any)=>patch.replacementSurfaces.filter((s:any)=>s.type==='roof').map((surface:any)=>({patchId:patch.id,mode:patch.mode,provenance:patch.provenance,surface})));
 for(const roof of inferredRoofs){assert.equal(roof.mode,'inferred-appearance');assert.ok(roof.provenance?.basis&&roof.provenance?.note&&roof.provenance?.evidenceKeys?.length,'Inferred roof requires explicit provenance');}
 const inferredRoofVertices=inferredRoofs.flatMap((roof:any)=>roof.surface.rings.flat());
 let checkedInferredRoofVertices=0,maxInferredRoofAxisErrorM=0,maxInferredRoofMapErrorM=0;
 let checked=0,maxAxisErrorM=0,maxRoofMapErrorM=0;
 if(measuredRoofRequired)entry.group.traverse((obj:any)=>{if(!obj.isMesh)return;const attr=obj.geometry.attributes.position;for(let i=0;i<attr.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(obj.matrixWorld);const original=[p.x,-p.z,p.y-entry.group.children[0].position.y];
  let closest:number[]|undefined,dist=Infinity;for(const q of sourceRoof){const d=Math.hypot(original[0]-q[0],original[1]-q[1],original[2]-q[2]);if(d<dist){dist=d;closest=q;}}
  if(inferredRoofVertices.length){
   let inferredClosest:number[]|undefined,inferredDistance=Infinity;
   for(const q of inferredRoofVertices){const d=Math.hypot(original[0]-q[0],original[1]-q[1],original[2]-q[2]);if(d<inferredDistance){inferredDistance=d;inferredClosest=q;}}
   if(inferredDistance<=.001){checkedInferredRoofVertices++;maxInferredRoofAxisErrorM=Math.max(maxInferredRoofAxisErrorM,inferredDistance);const actual=p.clone().applyMatrix4(entry.transform),expected=source(inferredClosest!);maxInferredRoofMapErrorM=Math.max(maxInferredRoofMapErrorM,Math.hypot(actual.x-expected.x,actual.y-expected.y)/units);}
  }
  if(dist>.001)continue;checked++;maxAxisErrorM=Math.max(maxAxisErrorM,dist);
  const actual=p.clone().applyMatrix4(entry.transform),expected=source(closest!);maxRoofMapErrorM=Math.max(maxRoofMapErrorM,Math.hypot(actual.x-expected.x,actual.y-expected.y)/units);
 }});
 if(measuredRoofRequired&&sourceRoof.length){assert.ok(checked>0,recipe.id+' has no matching measured roof vertices');assert.ok(maxAxisErrorM<.001);assert.ok(maxRoofMapErrorM<.001);}
 if(measuredRoofRequired&&inferredRoofVertices.length){assert.ok(checkedInferredRoofVertices>0,recipe.id+' has no matching inferred roof vertices');assert.ok(maxInferredRoofAxisErrorM<.001);assert.ok(maxInferredRoofMapErrorM<.001);}
 for(const invalid of [{x:[0,0],y:[0,0]},{x:[1,0],y:[0,1]},{x:[NaN,0],y:[0,-1]}])assert.throws(()=>placementFor({...spec,surveyed:{...surveyed,horizontalBasis:invalid}},{min:[0,0,0],max:[1,1,1]}));
 for(const invalid of [{...frame,xAxisRD:[2,0]},{...frame,yAxisRD:frame.xAxisRD},{...frame,anchorRD:[NaN,0]}])assert.throws(()=>rdProjectedSurvey(invalid,maplibre.MercatorCoordinate));
 const viewAnchor=maplibre.MercatorCoordinate.fromLngLat(recipe.placement.anchor);const outline=recipe.footprint.map((p:number[])=>{const q=source(p),old=new THREE.Vector3(p[0],0,-p[1]).applyMatrix4(legacy.transform);return {local:p,source:[(q.x-viewAnchor.x)/oldUnits,(q.y-viewAnchor.y)/oldUnits],consumer:[(old.x-viewAnchor.x)/oldUnits,(old.y-viewAnchor.y)/oldUnits]};});
 results.push({checkedAssetVertices,maxAssetVertexMapErrorM,appearanceRoof:appearanceRoof??null,retainedMeasuredRoofSurfaceIndices:retainedRoofIndices,replacedSourceRoofSurfaceIndices:replacedRoofIndices,inferredRoofPatches:inferredRoofs.map(({patchId,mode,provenance}:any)=>({patchId,mode,provenance})),checkedInferredRoofVertices,maxInferredRoofAxisErrorM,maxInferredRoofMapErrorM,measuredRoofRequired,roofCheck:measuredRoofRequired?'retained measured vertices and explicit inferred replacements checked':appearanceRoof?'explicit inferred appearance roof; source-retention comparison inapplicable':'analytic roof: source vertex comparison inapplicable',outline,recipePath,id:recipe.id,modelPath,bearingDegrees:recipe.placement.xAxisBearingDegrees,footprintExtentMetres:recipe.footprint.reduce((r:number[],p:number[])=>[Math.min(r[0],p[0]),Math.max(r[1],p[0]),Math.min(r[2],p[1]),Math.max(r[3],p[1])],[Infinity,-Infinity,Infinity,-Infinity]),baselineFootprintErrorM,maxFootprintErrorM,checkedRoofVertices:checked,maxAxisErrorM,maxRoofMapErrorM,scale:entry.placement.scale,altitudeMetres:entry.placement.altitudeMetres,horizontalBasis:surveyed.horizontalBasis});
}
const outputIndex=process.argv.indexOf('--output');const outputPath=outputIndex>=0?process.argv[outputIndex+1]:(modelRoot?'artifacts/placement-review/public-consumer-checks.json':'artifacts/placement-review/consumer-checks.json');assert.ok(outputPath&&!outputPath.startsWith('--'),'--output requires a file');fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify({consumer:'Actual SignatureLandmarks._add + placementFor + MapLibre; sourceRD via repository converter',modelRoot:modelRoot??null,checked:results.length,skipped,results},null,2)+'\n');console.log(JSON.stringify({checked:results.length,measuredRoofCases:results.filter(r=>r.measuredRoofRequired).length,skipped,results:results.map(({id,baselineFootprintErrorM,maxFootprintErrorM,checkedRoofVertices,maxAxisErrorM,maxRoofMapErrorM,scale,altitudeMetres})=>({id,baselineFootprintErrorM,maxFootprintErrorM,checkedRoofVertices,maxAxisErrorM,maxRoofMapErrorM,scale,altitudeMetres}))},null,2));
