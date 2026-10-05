/** Assemble a reviewed row-wide candidate from reusable groups; never publish it.
 * npx tsx scripts/street-appearance/compile-row.ts --row-plan=... --source-manifest=... --output=...
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256 } from './pipeline.ts';
import { validateStreetAppearanceCatalog, type ArchitecturalRecipe, type StreetAppearanceProfile } from '../../src/canalRecall/streetAppearance.ts';
const option=(n:string,d='')=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)??d;
const planPath=option('row-plan','artifacts/street-appearance/register-transition/next-canal-row.json');
const manifestPath=option('source-manifest','artifacts/street-appearance/register-transition/next-canal-source/manifest.json');
const output=option('output');if(!output||output.startsWith('public/'))throw Error('Required nonpublic candidate output');
const planBytes=await fs.readFile(planPath),plan=JSON.parse(planBytes.toString()),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
if(manifest.planSha256!==sha256(planBytes))throw Error('Source manifest/frozen row mismatch');
if(manifest.sourceRole==='evaluation-heldout'||plan.sourceRole==='evaluation-heldout'||!manifest.evidence?.length)throw Error('Evaluation or empty source manifest cannot enter recipe inference');
const evidence=[];
for(const e of manifest.evidence){
 if(!e.role.startsWith('training-'))throw Error('Evaluation source cannot enter recipe inference');
 if(sha256(await fs.readFile(e.sourceFile))!==e.sourceSha256||sha256(await fs.readFile(e.cropFile))!==e.cropSha256)throw Error(`Source checksum mismatch: ${e.id}`);
 evidence.push({id:e.id,kind:'municipal-panorama' as const,captureDate:e.captureDate,sha256:e.cropSha256,url:e.sourceUrl,panoramaId:e.panoramaId,inference:'agent-visual-review' as const,quality:.9,notes:'Current primary-row observation: narrow two/three-column glazing, dark masonry+pale surrounds with pale-front exception, cornice/neck/bell mixture, tall ground glazing/side entries, low balcony frequency. Qualitative joint priors, not measured per-building appearance. Sources archived1b32bd4; heldout untouched.'});
}
const palettes:Array<{weight:number;wallHex:string;frameHex:string;crownShape:ArchitecturalRecipe['crownShape'];groundAssembly:ArchitecturalRecipe['groundAssembly'];windowHead?:ArchitecturalRecipe['windowHead'];crownWindows?:ArchitecturalRecipe['crownWindows']}>=[
 {weight:3,wallHex:'#3c3531',frameHex:'#e4dfce',crownShape:'cornice',groundAssembly:'tall-side-entry'},
 {weight:3,wallHex:'#554039',frameHex:'#e4dfce',crownShape:'neck',groundAssembly:'tall-side-entry'},
 {weight:2,wallHex:'#373638',frameHex:'#e2dfd2',crownShape:'neck',groundAssembly:'tall-commercial'},
 {weight:2,wallHex:'#59443a',frameHex:'#ddd5c4',crownShape:'cornice',groundAssembly:'tall-commercial',windowHead:'segmental'},
 {weight:1,wallHex:'#dad5c5',frameHex:'#373734',crownShape:'cornice',groundAssembly:'tall-side-entry'},
 {weight:1,wallHex:'#393738',frameHex:'#e4dfce',crownShape:'bell',groundAssembly:'tall-side-entry',crownWindows:'paired-oculi'},
];
const registerCrowns:NonNullable<StreetAppearanceProfile['registerCrowns']>=[];
if(sha256(await fs.readFile(plan.archiveInput.file))!==plan.archiveInput.sha256)throw Error('Register snapshot changed');
for(const building of plan.inventory){
 const assertion=building.sourceAssertions.find((a:any)=>a.part==='crown'&&['neck','plain','bell','cornice'].includes(a.trait));
 if(!assertion||building.nativeId===plan.fixedSamples.heldout.sharedBoundaryBuilding)continue;
 registerCrowns.push({buildingId:building.nativeId,shape:assertion.trait,windows:building.sourceAssertions.some((a:any)=>a.trait==='oculi')?'paired-oculi':undefined,sourceUrl:assertion.sourceUrl,sourceSnapshotSha256:plan.archiveInput.sha256});
}
const recipes:StreetAppearanceProfile['recipes']=[];
for(const group of ['canal-two','canal-three'] as const)for(const p of palettes){
 const three=group==='canal-three';
 recipes.push({weight:p.weight,heightMin:7,heightMax:26,frontageMin:three?5.5:2.5,frontageMax:three?9:5.499999,recipe:{family:'masonry',period:'canal',wallHex:p.wallHex,frameHex:p.frameHex,groundWallHex:p.wallHex,openingGroup:group,groundAssembly:p.groundAssembly,crownShape:p.crownShape,crownWindows:'paired-oculi',crownTrim:true,balconyPolicy:'assembly-only',detailPolicy:'architectural',windowWidth:.62,windowHeight:.70,windowProportions:'tall',windowHead:p.windowHead??'flat',frameColor:'pale',lintel:'none',paleAccents:false,sash:'paired-transom',trimDensity:'restrained',wallMaterial:'brick',atticWindows:true,bayScale:1,storeyScale:1,groundScale:1.2,trim:{frames:.75,lintels:.08,cornice:.8,courses:0,quoins:0,arches:0},confidence:.88}});
}
const profile:StreetAppearanceProfile={id:plan.proposalId,streetName:'Oudezijds Voorburgwal',revision:'',segment:plan.segment,side:plan.side,registerCrowns,reachM:20,confidence:.9,assemblyM:8,status:'reviewed',visualClass:{kind:'historic-frontage',constructionYearPolicy:'source-visual',sourceEvidenceIds:evidence.map(e=>e.id)},recipes,evidence};
profile.revision=sha256(JSON.stringify(profile)).slice(0,16);
const base=JSON.parse(await fs.readFile('public/data/street-appearance/profiles.json','utf8'));
const profiles=[...base.profiles.filter((p:any)=>p.id!==profile.id),profile];
const catalog=validateStreetAppearanceCatalog({schemaVersion:1,revision:sha256(JSON.stringify(profiles)).slice(0,16),profiles});
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({output,profiles:profiles.length,rowRecipes:recipes.length,sourceObservations:evidence.length,publication:'candidate only'}));
