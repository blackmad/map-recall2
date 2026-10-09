import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {assembleReference} from './assemble-reference.ts';
import {canalhouseCrownProfile,compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';
import {assembleCompoundReference} from './compound-reference.ts';
import {surveyRecipe} from './survey-recipe.ts';

test('source-sided ground openings reject the actual82 mirrored shop and entry layout',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-82-recipe-input.json','utf8'));
 const result=await assembleReference(input),openings=result.entry.recipe.elevations[0].openings.value;
 const entry=openings.find(o=>o.id==='right-entry')!,shop=openings.find(o=>o.id==='left-shop')!;
 assert.ok(entry.leftM>shop.leftM+shop.widthM);
 const failed=structuredClone(input);
 for(const o of failed.openings)if(['right-entry','left-shop','shop-transom'].includes(o.id))o.left=1-o.left-o.width;
 await assert.rejects(()=>assembleReference(failed),/contradicts observed opening side/);
});

test('roof volume applies one profile behind the source crown and retains actual86 annex planes and footprint',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-86-volume-recipe-input-20261007.json','utf8'));
 const result=await assembleReference(input),survey=JSON.parse(await fs.readFile(input.surveyFile,'utf8')),admission=JSON.parse(await fs.readFile(input.admissionFile,'utf8'));
 const native=surveyRecipe(survey,admission.native.surveyFootprintPolygonsRD,admission.principalFront.orientedLeftToRightAsSeenFromCanal);
 assert.deepEqual(result.entry.recipe.footprint.value,native.polygons);
 assert.equal(result.entry.nativeConversion.roofVolume!.surfaceIds.length,4);
 for(const [i,roof] of native.roof.entries())if(result.entry.nativeConversion.roofVolume!.preservedSurfaceIds.includes(native.roofOwners[i]))assert.ok(result.entry.recipe.roof.value.some(r=>JSON.stringify(r)===JSON.stringify(roof)),'Lower annex plane and plan must stay exact');
 const max=Math.max(...result.entry.recipe.roof.value.flatMap(r=>r.polygon.outer.map(p=>r.plane.heightM+p[0]*r.plane.slopeX+p[1]*r.plane.slopeZ)));
 assert.ok(max<=14.62+1e-5,'Rear native ridge must not survive above the selected continuous crest');
 const conflict=structuredClone(input);delete conflict.roofAssembly;
 await assert.rejects(()=>assembleReference(conflict),/requires one explicit roof assembly/);
});

test('explicit drawing body datum separates observed attic fronts without replacing native ownership',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-104-recipe-input.json','utf8'));
 const result=await assembleReference(input),without=structuredClone(input);delete without.bodyDatum;
 const baseline=await assembleReference(without);
 assert.equal(result.entry.assemblyInput.normalization.bodyEavesM,12.05);
 assert.notEqual(result.entry.assemblyInput.normalization.bodyEavesM,baseline.entry.assemblyInput.normalization.bodyEavesM);
 assert.deepEqual(result.entry.recipe.footprint,baseline.entry.recipe.footprint);
 assert.deepEqual(result.entry.recipe.roof,baseline.entry.recipe.roof);
 const panel=compileCanalHouseRecipe(result.entry.recipe).group.getObjectByName('opening/leftLowerPanel/pane');
 assert.equal(panel?.userData.surface,'trim','Pale lower panel remains opaque semantic trim, not invented glass');
 const tinted=structuredClone(input);tinted.frameSets.lowerPanel.overrides.paneTint='#aaaaaa';await assert.rejects(()=>assembleReference(tinted),/glazed color/);
 for(const bad of [{heightM:0,sourceReview:'review'},{heightM:12,sourceReview:''},{heightM:NaN,sourceReview:'review'}])await assert.rejects(()=>assembleReference({...input,bodyDatum:bad}),/body datum/);
 const missing=structuredClone(input);missing.dormers.pop();await assert.rejects(()=>assembleReference(missing),/observed attic fronts/);
});

test('distinct source facets can share one selected roof basis without changing native ownership',async()=>{
 const load=async(name:string)=>JSON.parse(await fs.readFile(`docs/references/canalhouse-recipes/${name}.json`,'utf8'));
 const main=await load('bloemgracht-152-main-recipe-input'),jog=await load('bloemgracht-152-jog-recipe-input');
 const [a,b]=await Promise.all([assembleReference(main),assembleReference(jog)]);
 assert.deepEqual(a.entry.recipe.roof.value,b.entry.recipe.roof.value);
 assert.deepEqual(a.entry.recipe.footprint.value,b.entry.recipe.footprint.value);
 assert.notEqual(a.entry.frontWidthM,b.entry.frontWidthM);
 const compound=await assembleCompoundReference(await load('bloemgracht-152-compound-input'),assembleReference);
 assert.equal(compound.entry.recipe.elevations.length,2);
 assert.equal(compound.entry.recipe.house.pandId,'0363100012174830');
 assert.deepEqual(compound.entry.recipe.roof.value,a.entry.recipe.roof.value);
 assert.deepEqual(compound.entry.recipe.footprint.value,a.entry.recipe.footprint.value);
 const separate=structuredClone(jog);delete separate.roofFrontageRD;
 assert.notDeepEqual((await assembleReference(separate)).entry.recipe.roof.value,a.entry.recipe.roof.value);
 jog.roofFrontageRD[0][0]+=1;await assert.rejects(()=>assembleReference(jog),/surveyed polygon/);
 main.roofFrontageRD=[[0,NaN],[0,0]];await assert.rejects(()=>assembleReference(main),/finite source endpoints/);
 delete main.roofAssembly;await assert.rejects(()=>assembleReference(main),/requires a selected roof assembly/);
});

test('aligned entry transom retains independent joinery and rejects overlap or a window parent',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-106-recipe-input.json','utf8'));
 const result=await assembleReference(input),entry=result.entry.recipe.elevations[0].openings.value.find(o=>o.id==='entry')!,transom=result.entry.recipe.elevations[0].openings.value.find(o=>o.id==='entry-transom')!;
 assert.equal(transom.kind,'window');assert.equal(transom.leftM,entry.leftM);assert.equal(transom.widthM,entry.widthM);
 const door=input.openings.find((o:{id:string})=>o.id==='entry');
 const explicit=structuredClone(input),explicitDoor=explicit.openings.find((o:{id:string})=>o.id==='entry');
 delete explicitDoor.transom;explicit.openings.splice(explicit.openings.indexOf(explicitDoor)+1,0,{id:'entry-transom',kind:'window',left:door.left,width:door.width,...door.transom});
 assert.deepEqual((await assembleReference(explicit)).entry.recipe,result.entry.recipe);
 door.transom.bottom=door.bottom;await assert.rejects(()=>assembleReference(input),/overlapping entry transom/);
 door.transom.bottom=.305;door.kind='window';await assert.rejects(()=>assembleReference(input),/requires a door/);
});

test('a compact crown selection drives the source assembler without changing native footprint or roof',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-110-recipe-input.json','utf8'));
 const result=await assembleReference(input),explicit=structuredClone(input);delete explicit.crown.shape;
 const legacy=await assembleReference(explicit);
 assert.deepEqual(result.entry.recipe.footprint,legacy.entry.recipe.footprint);
 assert.deepEqual(result.entry.recipe.roof,legacy.entry.recipe.roof);
 const shape=input.crown.shape,{frontWidthM:width,bodyEavesM:body}=result.entry.assemblyInput.normalization;
 assert.deepEqual(result.entry.recipe.elevations[0].crown!.value.profile,canalhouseCrownProfile('klok',width,body,shape.top*body,shape.neckWidth*width,shape.shoulder*body,1,{crestWidthM:shape.crestWidth*width,cap:shape.cap,capRiseM:shape.capRise*body,shoulderCurve:shape.shoulderCurve}));
 input.crown.shape.family='hals';await assert.rejects(()=>assembleReference(input),/contradicts observed family/);
});

test('optional landing preserves omission and refuses a flight without a supported landing',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/herengracht-429-recipe-input.json','utf8'));
 const supported=await assembleReference(input),without=structuredClone(input);
 delete without.landing;delete without.approaches;
 const result=await assembleReference(without);
 assert.equal(result.entry.recipe.elevations[0].landing,undefined);
 assert.deepEqual(result.entry.recipe.elevations[0].approaches,[]);
 assert.deepEqual(result.entry.recipe.footprint,supported.entry.recipe.footprint);
 assert.deepEqual(result.entry.recipe.roof,supported.entry.recipe.roof);
 without.approaches=input.approaches;
 await assert.rejects(()=>assembleReference(without),/require their source-selected landing/);
});
test('shared authoring extensions preserve both existing expanded recipes byte for byte',async()=>{
 const pack=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/next-chunk-recipes.json','utf8'));
 for(const id of ['herengracht-429','herengracht-433']){
  const input=JSON.parse(await fs.readFile(`docs/references/canalhouse-recipes/${id}-recipe-input.json`,'utf8'));
  const result=await assembleReference(input);
  assert.equal(JSON.stringify(result.entry.recipe),JSON.stringify(pack.entries.find((e:{recipe:{id:string}})=>e.recipe.id===id).recipe));
 }
});


test('source-reviewed window counts reject an extra tier, missing bay and omitted critical aperture',async()=>{
 for(const [number,groupId,count] of [[170,'upperPaired',4],[172,'upperThree',6]] as const){
 const input=JSON.parse(await fs.readFile(`docs/references/canalhouse-recipes/bloemgracht-${number}-recipe-input.json`,'utf8'));
 const original=await assembleReference(input);
 assert.equal(original.entry.recipe.elevations[0].openings.value.filter(o=>o.id.startsWith(groupId+'/')).length,count);
 const extra=structuredClone(input);extra.windowGroups[0].tiers.push({id:'unsupportedThird',bottom:.92,height:.04});
 await assert.rejects(()=>assembleReference(extra),/contradicts observed window group/);
 const missing=structuredClone(input);missing.baySets[missing.windowGroups[0].baySet].pop();await assert.rejects(()=>assembleReference(missing),/contradicts observed window group/);
 const omitted=structuredClone(input);omitted.windowGroups[0].omit=[{bay:'left',tier:'first'}];await assert.rejects(()=>assembleReference(omitted),/contradicts observed window group/);
 assert.deepEqual((await assembleReference(input)).entry.recipe,original.entry.recipe);
 }
});


test('source assembly rejects the actual80 null-camera failure before admitting a comparison',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-80-recipe-input.json','utf8'));
 const admission=JSON.parse(await fs.readFile(input.admissionFile,'utf8'));
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'canalhouse-camera-regression-'));
 try{
  admission.houses[0].sources.projection.camera.geometry.coordinates=[null,null];
  input.admissionFile=path.join(temporary,'admission.json');
  await fs.writeFile(input.admissionFile,JSON.stringify(admission));
  await assert.rejects(()=>assembleReference(input),/Principal source requires finite WGS84 camera coordinates/);
 }finally{await fs.rm(temporary,{recursive:true,force:true});}
});
