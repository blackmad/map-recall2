/** Reproducible scope/failure report. No requests, publication or review claims. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.resolve(here,'../../..');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
async function read(file,fallback=null){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
const baseline=await read(path.join(here,'baseline.json')),pointerBytes=await fs.readFile(path.join(root,'public/data/city-expansion/current.json'));
const active=await read(path.join(here,'active-development-manifest.json'));
const held=await read(path.join(here,'heldout-source-inspection.json'));
const registration=await read(path.join(here,'registration-artifact.json'));
const ledger=await read(path.join(root,'.cache/city-appearance/spend.json'));
const independent=await read(path.join(here,'independent-reference-measurements.json'));
const analyses=await read(path.join(root,'.cache/city-appearance/fidelity-extraction/analysis-results.json'));
const failures=[],sourceChecks=[];
for(const item of active?.cases??[])for(const tier of ['full','ground']){
 const source=item.sources?.[tier];if(!source){sourceChecks.push({id:item.id,tier,status:'missing-tier'});continue;}
 try{const bytes=await fs.readFile(path.resolve(here,source.path)),metadata=await sharp(bytes).metadata(),expected=source.actualDimensions??source.dimensions??source;
 const valid=hash(bytes)===source.cropSha256&&metadata.width===expected.width&&metadata.height===expected.height;
 sourceChecks.push({id:item.id,tier,status:valid?'hash-and-dimensions-verified':'stale-source'});if(!valid)failures.push(`stale-source:${item.id}/${tier}`);
 }catch(error){failures.push(`source-unavailable:${item.id}/${tier}`);sourceChecks.push({id:item.id,tier,status:'unavailable',reason:String(error)});}
}
const devBuildings=new Set((active?.cases??[]).map(c=>c.buildingId));
const named=await read(path.join(here,'named-compatibility.json'),[]),namedBuildings=new Set(named.flatMap(c=>c.buildingIds));
const overlaps=(held?.cases??[]).filter(c=>devBuildings.has(c.buildingId)||namedBuildings.has(c.buildingId)).map(c=>c.id??c.observationId);
const registrations=(registration?.cases??[]).flatMap(c=>Object.entries(c.sources??{}).map(([tier,s])=>({id:c.id,tier,status:s.registration?.status,reason:s.registration?.abstention??s.registration?.abstentionReason??null,candidateTransform:s.registration?.imageToWall?.length===9})));
const settled=(ledger?.entries??[]).filter(e=>e.status==='settled'),unresolved=(ledger?.entries??[]).filter(e=>e.status!=='settled');
const total=settled.reduce((n,e)=>n+e.actualUsd,0),additional=Math.max(0,total-baseline.inferenceBaselineUsd);
const current=JSON.parse(pointerBytes.toString()),preserved=current.releaseId===baseline.releaseId&&hash(pointerBytes)===baseline.pointerSha256;
if(!preserved)failures.push('baseline-pointer-changed');
if(overlaps.length)failures.push('held-out-exclusion-overlap');
if(!['certified','validated'].includes(held?.certificationStatus))failures.push('held-out-not-certified');
if(!registrations.length||registrations.some(r=>r.status!=='registered'))failures.push('registration-acceptance-incomplete');
if(registration?.sourceManifestSha256!==hash(JSON.stringify(active)))failures.push('registration-artifact-stale');
if(unresolved.length)failures.push('unresolved-costs');
if(total>5||additional>3)failures.push('cost-ceiling');
// Missing measured evidence is not a passing zero or inferred fidelity score.
failures.push('photographic-opening-fidelity-not-measured','dated-contact-measurements-incomplete','development-source-render-comparisons-incomplete','new-candidate-runtime-not-measured','named-shop-restoration-unverified');
const report={version:2,publication:'preserved-release-no-activation',preservedRelease:{releaseId:current.releaseId,pointerSha256:hash(pointerBytes),matchesBaseline:preserved},
 processingCoverage:{priorReportedPercent:96.4,meaning:'Previously processed route coverage; not reconstruction fidelity',activeDevelopmentCases:active?.cases?.length??0,verifiedDevelopmentSourceTiers:sourceChecks.filter(s=>s.status==='hash-and-dimensions-verified').length,completedRichImageAnalyses:analyses?.results?.filter(r=>r.status==='complete').length??0},
 renderedFeatureCoverage:{newAcceptedPhotographicFrontages:0,status:'No newly verified photographic assembly published'},
 measuredReconstructionFidelity:{precision:null,recall:null,status:'not-evaluated',registrationFailures:registrations.filter(r=>r.status!=='registered').length,abstentions:registrations.filter(r=>r.status!=='registered').length},
 independentReferences:{manifest:'independent-reference-measurements.json',groundCases:independent?.entries?.length??0,completeOpeningBoxes:independent?.entries?.reduce((n,e)=>n+e.openings.filter(o=>o.visible).length,0)??0,partialOpeningExtents:independent?.entries?.reduce((n,e)=>n+e.openings.filter(o=>!o.visible).length,0)??0,fullTierReferences:0,disposition:'agent-inspected; partial source references only'},
 development:{manifest:'active-development-manifest.json',status:active?.developmentSetStatus??active?.status??'missing',cases:active?.cases?.length??0,sourceChecks},
 heldOut:{manifest:'heldout-source-inspection.json',cases:held?.cases?.length??0,certificationStatus:held?.certificationStatus??'missing',districtCounts:Object.fromEntries([...new Set((held?.cases??[]).map(c=>c.district))].map(d=>[d,held.cases.filter(c=>c.district===d).length])),overlaps},
 registration:{artifact:'registration-artifact.json',candidateTransforms:registrations.filter(r=>r.candidateTransform).length,accepted:registrations.filter(r=>r.status==='registered').length,tiers:registrations},
 cost:{settledEntries:settled.length,unresolvedCharges:unresolved.length,cumulativeUsd:total,additionalUsd:additional,additionalAuthorizedUsd:3,cumulativeCeilingUsd:5,phaseLimitsUsd:{development:1,unseen:.5,expansion:1.5}},
 originalTwelve:{manifest:'development-examples.json',status:'outstanding',resolved:0,count:12,note:'Cached replacement cases do not reproduce the original image-numbered examples.'},
 routeExpansion:false,gatesPassed:false,failures:[...new Set(failures)]};
await fs.writeFile(path.join(here,'repair-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({preserved,cases:report.development.cases,heldOut:report.heldOut.cases,candidateTransforms:report.registration.candidateTransforms,registered:report.registration.accepted,cumulativeUsd:total,additionalUsd:additional,gatesPassed:false,failures:report.failures},null,2));
