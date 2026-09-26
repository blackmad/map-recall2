/** Development-only preview: native crop planes are candidates, never registrations. */
import fs from 'node:fs/promises';
import {prepareRoofCoverageStudy,applyRoofCoverageStudy} from './roof-coverage-corrections.ts';
import {buildTemporalCandidate} from './next-stage-temporal.ts';
import {prepareRoofStudy} from './next-stage-roofs.ts';
import {applySourceSilhouette} from './apply-source-silhouette.ts';
import {prepareTemporalPreviewEvidence} from './temporal-preview-evidence.ts';
import {applySourceAssemblies} from './apply-source-assemblies.ts';
import {prepareSourceGeometryCorrection,applyPreparedSourceGeometry} from './source-geometry-corrections.ts';
import {reviewUpperFloorDoors} from './facade-feature-self-review.ts';
import {publishPreviewRevision} from './publish-preview-revision.ts';
import {compileSourceShapePreview} from './source-shape-preview.ts';
import {buildCaseCandidate} from './case-candidate.ts';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const sha=(b:any)=>crypto.createHash('sha256').update(b).digest('hex');
const previewPath='public/data/facade-repair-preview/cases.json';
const currentPreview=await fs.readFile(previewPath).catch((error:any)=>{if(error?.code==='ENOENT')return null;throw error;});
const expectedCurrentPreviewSha=currentPreview?sha(currentPreview):null;
const regressions=await read('scripts/review/facade-regressions.json');
const references=await read('scripts/review/window-shape-reference.json');
const corrections=await read('scripts/review/development-photo-corrections.json');
const signReferences=await read('scripts/review/roof-sign-corrections.json');
const temporal=await read('scripts/review/temporal-evidence-inventory.json');
const nextSourceReview=await read('scripts/review/next-stage-source-review.json');
const retailReview=await read('scripts/review/retail-priority-source-review.json');
const spatial=await read('scripts/review/spatial-source-corrections.json');
const floorRows=await read('scripts/review/floor-row-corrections.json');
const openingFrames=await read('scripts/review/opening-frame-corrections.json');
const sourceGeometry=await read('scripts/review/source-geometry-corrections.json');
const case25SourceGeometry=await read('scripts/review/case25-source-corrections.json');
sourceGeometry.cases.push(...case25SourceGeometry.cases);
const cache=await read('.cache/city-appearance/fidelity-extraction/analysis-results.json').catch(()=>({results:[]}));
const index=await read('.cache/city-appearance/fidelity-extraction/development-analysis-index.json');
if(index.manifestSha256!==sha(await fs.readFile('scripts/review/facade-regression-analysis-manifest.json')))throw Error('Stale analysis manifest');
const currentKeys=new Set(index.cases.map((c:any)=>c.key));
const complete=cache.results.filter((r:any)=>currentKeys.has(r.key)&&r.status==='complete'&&r.proposal);
const cases=[];
for(const c of regressions.cases){
 for(const tier of ['full','ground']){if(sha(await fs.readFile(c.source[tier].path))!==c.source[tier].sha256)throw Error('Stale photograph');}
 const tileBytes=await fs.readFile(c.binding.tile.path);if(sha(tileBytes)!==c.binding.tile.sha256)throw Error('Stale tile');
 const tile=JSON.parse(gunzipSync(tileBytes).toString());
 const owner=tile.owners.find((o:any)=>o.id===c.binding.buildingId);
 const original=owner.observations.find((o:any)=>o.id===c.binding.observationId).payload;
  const {frame,candidateObservations,patches,omissions,analyzedTiers,shapeFeatures}=buildCaseCandidate({caseId:c.caseId,owner,original,bindingSurfaceIndices:c.binding?.surfaceIndices,complete,references,corrections,spatial,signReferences,retailReview,floorRows,openingFrames});
  const roofReview=nextSourceReview.cases.find((review:any)=>review.caseId===c.caseId&&review.roofStudy);
 const roof=roofReview&&shapeFeatures.full?prepareRoofStudy(shapeFeatures.full,roofReview):null;
 if(roof)shapeFeatures.full=roof.input;
 const coverageRoof=['case-01','case-04','case-09','case-27'].includes(c.caseId)&&shapeFeatures.full?prepareRoofCoverageStudy(c.caseId,shapeFeatures.full):null;
 if(coverageRoof)shapeFeatures.full=coverageRoof.input;
 const sourceGeometryPrepared:any={};
 for(const tier of ['full','ground'])if(shapeFeatures[tier]){
  const prepared=prepareSourceGeometryCorrection(c.caseId,tier,shapeFeatures[tier],sourceGeometry.cases);
  if(prepared){shapeFeatures[tier]=prepared.input;sourceGeometryPrepared[tier]=prepared;}
 }
 const shapeStudy=Object.fromEntries(Object.entries(shapeFeatures).map(([tier,input])=>[tier,applySourceAssemblies(compileSourceShapePreview(input as any),input,spatial.cases[c.caseId]?.[tier]?.entranceAssemblies)]));
 if(coverageRoof)applyRoofCoverageStudy(shapeStudy.full,coverageRoof);
 if(roof)applySourceSilhouette(shapeStudy.full,shapeFeatures.full,roof.polygon);
 for(const tier of Object.keys(sourceGeometryPrepared))applyPreparedSourceGeometry(shapeStudy[tier],sourceGeometryPrepared[tier]);
 const counts=Object.fromEntries(['door','window','awning','material'].map(kind=>[kind,new Set(patches.filter(p=>p.featureKind===`observed-${kind}`).map(p=>p.featureId)).size]));
 const temporalEvidence=await prepareTemporalPreviewEvidence(temporal.cases.find((entry:any)=>entry.caseId===c.caseId),c.binding);
 const featureSelfReview={upperFloorDoors:shapeFeatures.full?reviewUpperFloorDoors(shapeFeatures.full.features):[]};
 cases.push({caseId:c.caseId,candidateObservations,roofReview:coverageRoof?{status:"source-outline-reviewed",uncertainty:coverageRoof.occlusionUncertainty}:sourceGeometryPrepared.full?.polygon?{status:"source-outline-reviewed",uncertainty:sourceGeometryPrepared.full.reason}:roof?{status:"source-outline-reviewed"}:{status:"source-outline-not-reviewed"},address:spatial.cases[c.caseId]?.address??original.address??c.binding.buildingId,temporalEvidence,note:c.userNote.text,source:Object.fromEntries(['full','ground'].map(t=>[t,{...c.source[t],url:'/'+c.source[t].path.replace(/^public\//,'')}])),previousRenderUrl:'/'+c.render.path.replace(/^public\//,''),status:c.caseId==='case-26'?'Source identity unresolved: no inferred repair':`Development preview · alignment unverified · ${analyzedTiers}/2 image tiers analyzed`,frame,owner,patches,counts,omissions,shapeFeatures,shapeStudy,featureSelfReview,shapeReferenceUsedForDevelopmentRepair:references.entries.some((e:any)=>e.caseId===c.caseId)});
}
for(const c of cases)if(c.caseId==='case-17'){const candidate=buildTemporalCandidate(c);(c as any).architectureComposite={study:compileSourceShapePreview(candidate as any),provenance:candidate.provenance,omissions:candidate.omissions};}
await fs.mkdir('public/data/facade-repair-preview',{recursive:true});
const proposedPreview=JSON.stringify({version:1,releaseId:regressions.releaseId,previewOnly:true,originalTwelveOutstanding:true,createdAt:new Date().toISOString(),cases});
if(expectedCurrentPreviewSha)await publishPreviewRevision(process.cwd(),expectedCurrentPreviewSha,Buffer.from(proposedPreview));
else await fs.writeFile(previewPath,proposedPreview,{flag:'wx'});
console.log(JSON.stringify(cases.map(c=>({id:c.caseId,counts:c.counts,patches:c.patches.length,omissions:c.omissions}))));
