/** Batch original assemblies; candidates stay outside the accepted catalogue. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {type CanalhouseRoofMaterialPreset} from '../../src/canalRecall/canalhouseRoofMaterials.ts';
import {canalhouseGroupToGlb} from './export-glb.ts';
import {compileCanalHouseRecipe, type CanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';

const option=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const input=option('input','docs/references/canalhouse-recipes/recipes.json');
const output=option('output','public/canal-drive/models/canalhouse-recipes');
const modelUrlRoot=option('model-url-root','./models/canalhouse-recipes');
const pack=JSON.parse(await fs.readFile(input,'utf8'));
if(pack.schemaVersion!==1||!Array.isArray(pack.entries)||!pack.entries.length)throw Error('Expected a nonempty recipe pack');
await fs.mkdir(output,{recursive:true});
const results=[];
const assets:{filename:string;bytes:Uint8Array}[]=[];
const ids=new Set<string>();
for(const entry of pack.entries){
 const recipe:CanalHouseRecipe=entry.recipe;
 if(!/^[a-z0-9-]+$/.test(recipe.id)||ids.has(recipe.id))throw Error(`Invalid/duplicate model ID ${recipe.id}`);
 ids.add(recipe.id);
 if(!Array.isArray(entry.anchorRD)||entry.anchorRD.length!==2||!entry.anchorRD.every(Number.isFinite))throw Error(`Missing surveyed anchor: ${recipe.id}`);
 const start=performance.now(),built=compileCanalHouseRecipe(recipe);
 const roofPreset:CanalhouseRoofMaterialPreset|undefined=entry.roofMaterial?.preset;
 const {bytes,triangles}=await canalhouseGroupToGlb(recipe.id,built.group,{roofPreset});
 if(triangles>40000||bytes.length>500000)throw Error(`Asset budget exceeded: ${recipe.id}: ${triangles} triangles, ${bytes.length} bytes`);
 const fingerprint=createHash('sha256').update(bytes).digest('hex').slice(0,16);
 assets.push({filename:`${recipe.id}.glb`,bytes});
 const recipeHash=createHash('sha256').update(built.inputKey).digest('hex');
 assets.push({filename:`${recipe.id}.recipe.json`,bytes:Buffer.from(JSON.stringify(recipe,null,2)+'\n')});
 const assemblyBytes=entry.assemblyInput?Buffer.from(JSON.stringify(entry.assemblyInput,null,2)+'\n'):null;
 const assemblyHash=assemblyBytes?createHash('sha256').update(assemblyBytes).digest('hex'):null;
 if(assemblyBytes)assets.push({filename:`${recipe.id}.assembly.json`,bytes:assemblyBytes});
 const cornice=recipe.elevations[0]?.cornice?.value;
 results.push({id:recipe.id,name:entry.name,pandId:recipe.house.pandId,anchorRD:entry.anchorRD,anchor:entry.anchor,
  sourceUrl:entry.sourceUrl,...(entry.roofMaterial?{roofMaterial:entry.roofMaterial}:{}),...(entry.corniceAssemblyChoice||entry.assemblyInput?.cornice?.assembly?{corniceAssemblyChoice:entry.corniceAssemblyChoice??entry.assemblyInput.cornice.assembly}:{}),...(entry.groundFrontChoice?{groundFrontChoice:entry.groundFrontChoice}:{}),...(entry.openingTemplateChoices?.length?{openingTemplateChoices:entry.openingTemplateChoices}:{}),...(entry.sourceReconciliation?{sourceReconciliation:entry.sourceReconciliation}:{}),...(entry.nativeConversion?{nativeConversion:entry.nativeConversion}:{}),sourceArchive:entry.sourceArchive,sample:entry.sample,lowerFacadeObservation:entry.lowerFacadeObservation,panorama:entry.panorama,basementPanorama:entry.basementPanorama,references:entry.references??[],frontNormal:entry.frontNormal,frontTarget:entry.frontTarget,frontWidthM:entry.frontWidthM,
  ...(cornice&&entry.frontTarget?{corniceTarget:[entry.frontTarget[0],cornice.bottomM+cornice.heightM/2,entry.frontTarget[2]]}:{}),
  modelUrl:`${modelUrlRoot}/${recipe.id}.glb?asset=${fingerprint}`,recipeUrl:`${modelUrlRoot}/${recipe.id}.recipe.json?input=${recipeHash.slice(0,16)}`,...(assemblyHash?{assemblyUrl:`${modelUrlRoot}/${recipe.id}.assembly.json?input=${assemblyHash.slice(0,16)}`,assemblyHash}:{}),fingerprint,triangles,bytes:bytes.length,
  bounds:built.stats.bounds,componentVersions:built.componentVersions,inputHash:recipeHash,
  compileMs:performance.now()-start,simplifications:recipe.simplifications,
  reviewStatus:'unreviewed',timings:entry.timings??{},suppressOsmIds:entry.suppressOsmIds??[`NL.IMBAG.Pand.${recipe.house.pandId}`]});
 built.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();if(!Array.isArray(o.material))o.material.dispose();}});
}
// Validate the complete batch before changing any installed candidate asset.
await Promise.all(assets.map(asset=>fs.writeFile(path.join(output,asset.filename),asset.bytes)));
const manifest={schemaVersion:1,id:pack.id,title:pack.title,generatedAt:new Date().toISOString(),status:'candidate-only',
 ...(pack.reviewStatus?{reviewStatus:pack.reviewStatus}:{}),...(pack.reviewNotes?{reviewNotes:pack.reviewNotes}:{}),sourceArchive:pack.sourceArchive,...(pack.reviewRows?{reviewRows:pack.reviewRows}:{}),acceptance:pack.acceptance??{individual:false,row:false,heldouts:false,independent:false,game:false,performance:false},entries:results};
await fs.writeFile(path.join(output,'pilot.json'),JSON.stringify(manifest,null,2)+'\n');
// Game registration needs placement and exact owners, not the gallery's source
// history and authoring notes. Keep full evidence in pilot.json and the recipes.
const gameReview={schemaVersion:1,status:'candidate-only',reviewRows:pack.reviewRows??[],entries:results.map(({id,name,anchorRD,sourceUrl,modelUrl,suppressOsmIds})=>({id,name,anchorRD,sourceUrl,modelUrl,suppressOsmIds}))};
await fs.writeFile(path.join(output,'game-review.json'),JSON.stringify(gameReview,null,2)+'\n');
console.log(JSON.stringify({output,houses:results.length,triangles:results.reduce((n,e)=>n+e.triangles,0),bytes:results.reduce((n,e)=>n+e.bytes,0),status:manifest.status}));
