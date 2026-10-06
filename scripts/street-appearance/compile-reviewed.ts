/** Compile explicitly reviewed street priors; never silently promotes model proposals.
 * node --import tsx scripts/street-appearance/compile-reviewed.ts
 */
import fs from 'node:fs/promises';
import { sha256, aggregateObservations, type Observation } from './pipeline.ts';
import { validateStreetAppearanceCatalog, type StreetAppearanceCatalog, type ArchitecturalRecipe } from '../../src/canalRecall/streetAppearance.ts';
const seeds:StreetAppearanceCatalog=JSON.parse(await fs.readFile('public/data/street-appearance/pilot-segments.json','utf8'));
const manifest=JSON.parse(await fs.readFile('.cache/street-appearance/manifest.json','utf8'));
const reviews:Record<string,{quality:number;notes:string;recipes:Array<{weight:number;recipe:ArchitecturalRecipe;yearMin?:number;yearMax?:number}>}>=JSON.parse(await fs.readFile('public/data/street-appearance/reviewed-recipes.json','utf8'));
const observations:Observation[]=[];
for(const image of manifest.images){
 if(sha256(await fs.readFile(image.file))!==image.sha256)throw Error(`crop hash mismatch: ${image.id}`);
 if(image.sourceFile && sha256(await fs.readFile(image.sourceFile))!==image.panoramaSha256)throw Error(`panorama hash mismatch: ${image.id}`);
 const review=reviews[image.profileId];if(!review||image.holdout)continue;
 const evidence={id:image.id,kind:'municipal-panorama' as const,captureDate:image.captureDate,sha256:image.sha256,url:image.url,panoramaId:image.panoramaId,inference:'agent-visual-review' as const,quality:review.quality,notes:review.notes+' Recipes are approximate procedural priors, not measured per-building colours/proportions. Original panorama remains municipal CC BY 4.0. Perspective crop hash and source link identify inspected evidence.'};
 observations.push({profileId:image.profileId,startM:Math.max(0,image.alongM-12.5),endM:image.alongM+12.5,quality:review.quality,evidence,recipes:review.recipes});
}
const profiles=seeds.profiles.filter(p=>!p.holdout).map(p=>aggregateObservations(p,observations)).filter(p=>p.recipes.length);
// Reserve the neighboring photographs for validation; transfer training recipes unchanged.
for(const h of seeds.profiles.filter(p=>p.holdout)){
 const trainId=h.id.startsWith('overtoom')?'overtoom-gerard-brandt-anna-vondel':'bethaniendwarsstraat';
 const training=profiles.find(p=>p.id===trainId+(h.side===-1?'-right':'-left'));if(!training)continue;
 profiles.push({...h,confidence:training.confidence,recipes:training.recipes,evidence:training.evidence,revision:training.revision,learnedFrom:training.id});
}
try {
 const visual=JSON.parse(await fs.readFile('public/data/street-appearance/source-visual-profiles.json','utf8'));
 profiles.push(...visual.profiles);
} catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error; }
// Explicitly accepted whole-row recipes survive routine recompilation.
// No candidate or heldout catalog is read here.
let rowProfiles:StreetAppearanceCatalog['profiles']=[];
try {
 const rows=validateStreetAppearanceCatalog(JSON.parse(await fs.readFile('public/data/street-appearance/reviewed-row-profiles.json','utf8')));
 if(rows.profiles.some(p=>p.status!=='reviewed'||p.holdout||p.learnedFrom))throw Error('Unaccepted row publication');
 rowProfiles=rows.profiles;profiles.push(...rowProfiles);
} catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error; }
// Explicitly installed, identity-bounded pilots remain pilots on recompilation.
// This list is separate from reviewed rows and never expands to neighboring houses.
const installedPilots = validateStreetAppearanceCatalog(JSON.parse(await fs.readFile('public/data/street-appearance/installed-pilot-profiles.json','utf8'))).profiles;
if(installedPilots.some(p=>p.status!=='pilot'||p.holdout||p.learnedFrom||!p.buildingIds?.length))throw Error('Unbounded installed pilot');
profiles.push(...installedPilots);
// Full pilot compilation is research-only and must be requested explicitly.
// The routine command must not silently republish rejected transfer coverage.
const scopeIds=process.argv.includes('--research-pilot')?undefined:
 (process.argv.find(arg=>arg.startsWith('--profile-ids='))?.slice('--profile-ids='.length).split(',')??['bethanienstraat-transition-context','bethanienstraat-observed-historic-pair',...rowProfiles.map(p=>p.id)]);
// The original transfer remains a holdout in the research catalog. Publication
// uses a separately named, explicitly reviewed extent; its recipes still come
// unchanged from training, while the three independent stations are evaluation.
if(scopeIds?.includes('bethanienstraat-transition-context')){
 const transfer=profiles.find(p=>p.id==='bethanienstraat-holdout-1');
 if(!transfer)throw Error('Missing reviewed transition context');
 const {holdout,learnedFrom,...context}=transfer;
 profiles.push({...context,id:'bethanienstraat-transition-context',streetName:'Bethaniënstraat',status:'reviewed',evidence:context.evidence.map(e=>({...e,notes:(e.notes??'')+' Bounded publication extent: Bethanienstraat transition, independently reviewed in retry14. Recipes transferred unchanged from '+learnedFrom+'; original holdout and failed reviews retained in research artifacts.'}))});
}
if(scopeIds){
 scopeIds.push(...installedPilots.map(p=>p.id).filter(id=>!scopeIds.includes(id)));
 for(const id of scopeIds)if(!profiles.some(profile=>profile.id===id))throw Error(`Unknown reviewed scope ${id}`);
 profiles.splice(0,profiles.length,...profiles.filter(profile=>scopeIds.includes(profile.id)));
}
const catalog={schemaVersion:1 as const,revision:sha256(JSON.stringify(profiles)).slice(0,16),profiles};validateStreetAppearanceCatalog(catalog);
await fs.writeFile('public/data/street-appearance/profiles.json',JSON.stringify(catalog,null,2)+'\n');
// Registered row evidence remains reproducible from the private source pack.
for(const profile of rowProfiles)for(const e of profile.evidence)if(!manifest.images.some((image:any)=>image.id===e.id))manifest.images.push({...e,profileId:profile.id,file:`../map-recall2-source-data/streets/${profile.id}/artifacts/street-appearance/register-transition/next-canal-source/processed/${e.id}.jpg`,holdout:false,appearanceReview:'agent-visual-review'});
const coverage=seeds.profiles.map(p=>{const images=manifest.images.filter((i:any)=>i.profileId===p.id),lengthM=Math.hypot((p.segment[1][0]-p.segment[0][0])*111320*Math.cos(p.segment[0][1]*Math.PI/180),(p.segment[1][1]-p.segment[0][1])*110540);return {profileId:p.id,lengthM,samples:images.length,stationIntervalM:25,endGapM:images.length?Math.max(0,lengthM-Math.max(...images.map((i:any)=>i.alongM))-12.5):lengthM,admitted:profiles.some(x=>x.id===p.id),holdout:!!p.holdout};});
for(const p of profiles.filter(p=>!seeds.profiles.some(seed=>seed.id===p.id))){
 const lengthM=Math.hypot((p.segment[1][0]-p.segment[0][0])*111320*Math.cos(p.segment[0][1]*Math.PI/180),(p.segment[1][1]-p.segment[0][1])*110540);
 coverage.push({profileId:p.id,lengthM,samples:p.evidence.length,stationIntervalM:0,endGapM:0,admitted:true,holdout:false});
}
await fs.writeFile('public/data/street-appearance/evidence-manifest.json',JSON.stringify({...manifest,images:manifest.images.map(({sourceFile,...image}:any)=>({...image,appearanceReview:image.holdout?'withheld-for-validation':reviews[image.profileId]?.quality>=.45?'agent-visual-review':'uncertain-withheld'})),coverage,runtimeRevision:catalog.revision,reviewMode:'agent-visual-review; model proposals retained separately',trainedProfiles:profiles.filter(p=>!p.holdout).map(p=>p.id),holdoutPriorTransfer:profiles.filter(p=>p.holdout).map(p=>({id:p.id,learnedFrom:p.learnedFrom}))},null,2)+'\n');
console.log(`Compiled ${profiles.length} profiles, ${observations.length} inspected observations; ${catalog.revision}`);
