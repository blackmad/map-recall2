/** Source-bound roof coverage repair for the local shape-study viewer.
 * It deliberately carries no transform or registration assertion. */
import reviewData from './roof-coverage-corrections.json' with {type:'json'};
import {applySourceSilhouette} from './apply-source-silhouette.ts';

type SourceInput={cropSha256:string;captureDate:string;width:number;height:number;features:any[]};
type Review=typeof reviewData.cases[number];
const validHash=(value:any)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
function reviewFor(caseId:string):Review{
 const review=reviewData.cases.find(entry=>entry.caseId===caseId);
 if(!review)throw Error(`No roof coverage review for ${caseId}`);
 return review;
}
function validate(input:SourceInput,review:Review){
 const source=review.source;
 if(!validHash(input?.cropSha256)||input.cropSha256!==source.sha256||input.captureDate!==source.captureDate||input.width!==source.width||input.height!==source.height)throw Error('Stale roof coverage source review');
 if(!Array.isArray(input.features))throw Error('Roof coverage input requires source features');
}
/** Applies only pixel-inspected roof edits and returns the silhouette for the
 * existing source-study adapter. It is not a metric façade registration. */
export function prepareRoofCoverageStudy(caseId:string,input:SourceInput){
 const review=reviewFor(caseId);validate(input,review);
 const removed=new Set(review.remove??[]);
 const features=input.features.filter(feature=>!removed.has(feature.id)).map(feature=>({...feature}));
 for(const feature of review.add) {
  if(features.some(existing=>existing.id===feature.id))throw Error(`Duplicate roof coverage feature ${feature.id}`);
  features.push({...feature});
 }
 const polygon=[...review.silhouettePolygonPx,[review.silhouettePolygonPx.at(-1)![0],input.height],[review.silhouettePolygonPx[0][0],input.height]];
 return {mode:'source-space-roof-coverage-study' as const,caseId,input:{...input,features},polygon,source:{...review.source},occlusionUncertainty:review.occlusionUncertainty};
}
/** Convenience adapter retained separately from metric building compilation. */
export function applyRoofCoverageStudy(study:any,prepared:ReturnType<typeof prepareRoofCoverageStudy>){
 return applySourceSilhouette(study,prepared.input,prepared.polygon);
}
