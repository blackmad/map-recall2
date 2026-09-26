/** Stage the source-space case30 correction without publishing cases.json. */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { compileSourceShapePreview } from './source-shape-preview.js';
import { reviewUpperFloorDoors } from './facade-feature-self-review.js';

const sha256=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const featureHash=(value:unknown)=>sha256(JSON.stringify(value));
export async function stageCase30GlazedBalconyDoorCorrection(root='.'){
  const inputPath='public/data/facade-repair-preview/cases.json',correctionPath='scripts/review/case30-glazed-balcony-door-correction.json';
  const [inputBytes,correctionBytes]=await Promise.all([fs.readFile(path.join(root,inputPath)),fs.readFile(path.join(root,correctionPath))]);
  const input=JSON.parse(inputBytes.toString()),correction=JSON.parse(correctionBytes.toString()),staged=structuredClone(input);
  const original=input.cases.find((item:any)=>item.caseId===correction.caseId),candidate=staged.cases.find((item:any)=>item.caseId===correction.caseId);
  if(!original||!candidate||candidate.source.full.sha256!==correction.source.cropSha256||candidate.source.full.captureDate!==correction.source.captureDate)throw Error('Case30 source binding unavailable');
  const full=candidate.shapeFeatures.full,groundBefore=JSON.stringify(candidate.shapeFeatures.ground),applied:any[]=[],repairs:any[]=[];
  for(const override of correction.sourceFeatureOverrides){
    if(override.source!=='full'||override.sourceCropSha256!==full.cropSha256)throw Error('Case30 override source mismatch');
    const index=full.features.findIndex((feature:any)=>feature.id===override.featureId),before=full.features[index];
    if(index<0||featureHash(before)!==override.expectedFeatureSha256)throw Error(`Case30 stale feature: ${override.featureId}`);
    full.features[index]={...before,...override.set};applied.push({featureId:override.featureId,beforeSha256:override.expectedFeatureSha256,afterSha256:featureHash(full.features[index]),basis:override.basis});
  }
  for(const repair of correction.sourceGeometryRepair??[]){
    const index=full.features.findIndex((feature:any)=>feature.id===repair.featureId),before=full.features[index];
    if(index<0||featureHash(before)!==repair.expectedStyledFeatureSha256)throw Error(`Case30 stale repair input: ${repair.featureId}`);
    full.features[index]={...before,...repair.set};const afterSha256=featureHash(full.features[index]);
    if(afterSha256!==repair.expectedResultFeatureSha256)throw Error(`Case30 repair result mismatch: ${repair.featureId}`);
    repairs.push({featureId:repair.featureId,beforeSha256:repair.expectedStyledFeatureSha256,afterSha256,basis:repair.basis});
  }
  candidate.shapeStudy.full=compileSourceShapePreview(full);
  candidate.featureSelfReview={...(candidate.featureSelfReview??{}),upperFloorDoors:reviewUpperFloorDoors(full.features)};
  for(const observation of candidate.candidateObservations??[]){const source=observation.facadeDescription?.sources?.full;if(source?.cropSha256===full.cropSha256)source.features=structuredClone(full.features);}
  if(JSON.stringify(candidate.shapeFeatures.ground)!==groundBefore)throw Error('Case30 ground tier changed');
  for(const source of input.cases)if(source.caseId!==correction.caseId&&JSON.stringify(source)!==JSON.stringify(staged.cases.find((item:any)=>item.caseId===source.caseId)))throw Error(`Unrelated case changed: ${source.caseId}`);
  const output=JSON.stringify(staged,null,2)+'\n',outputSha256=sha256(output),relativeFolder=`review-data/visual-audits/2026-09-20-day-pass12/staged-case30-source-correction/${outputSha256}`,folder=path.join(root,relativeFolder);
  await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'staged-cases.json'),output,{flag:'wx'}).catch(async(error:any)=>{if(error?.code!=='EEXIST')throw error;if(sha256(await fs.readFile(path.join(folder,'staged-cases.json')))!==outputSha256)throw Error('Conflicting immutable case30 stage');});
  const report={version:1,kind:'staged-case30-source-correction',caseId:correction.caseId,sourcePacket:{path:inputPath,sha256:sha256(inputBytes)},correction:{path:correctionPath,sha256:sha256(correctionBytes)},stagedPacket:{path:`${relativeFolder}/staged-cases.json`,sha256:outputSha256},source:{cropSha256:full.cropSha256,captureDate:full.captureDate},applied,repairs,preserved:{otherCases:input.cases.length-1,groundTier:true,currentRelease:true,published:false,priorStages:true}};
  await fs.writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))stageCase30GlazedBalconyDoorCorrection().then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1;});
