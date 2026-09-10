/** Agent proposals are source-bound machine observations, never human decisions. */
const choices={shopfront:['yes','no','unknown'],awning:['yes','no','unknown'],facadeTop:['unknown','straight','stepped','bell','neck','pointed'],roofShape:['unknown','flat','flat-with-front-pitch','pitched-gable','hipped','mansard','complex']};
export function matchingVisualReview(rows,record,aerial){
  const sources=[...Object.values(record.images),aerial,aerial?.context].filter(Boolean);
  const matches=rows.filter(row=>row.id===record.id&&row.derivationKey===record.derivationKey&&row.origin==='agent-visual-review'&&
    Array.isArray(row.images)&&row.images.length>0&&row.images.every(image=>sources.some(source=>source.file===image.file&&source.sha256===image.sha256&&(!image.panoramaSha256||image.panoramaSha256===source.panoramaSha256))))||null;
  if(!matches.length)return null;if(matches.length===1)return matches[0];
  return {...matches[0],reviewer:matches.map(r=>r.reviewer).join(' + '),sourceReviewCount:matches.length,
    evidence:matches.map(r=>r.evidence).join('\n\n'),images:matches.flatMap(r=>r.images),
    proposal:Object.assign({},...matches.map(r=>r.proposal)),fieldEligibility:Object.assign({},...matches.map(r=>r.fieldEligibility)),
    appearanceEligible:matches.every(r=>r.appearanceEligible!==false),buildingMatch:matches.some(r=>r.buildingMatch==='no')?'no':matches[0].buildingMatch,
    cropQuality:matches.some(r=>r.cropQuality==='unusable')?'unusable':matches.some(r=>r.cropQuality==='partial')?'partial':'usable',
    needsReview:matches.some(r=>r.needsReview)};
}
export function applyVisualProposal(baseline,review){
  if(!review)return {proposal:baseline?{...baseline}:null,sources:{}};
  if(review.appearanceEligible===false||review.cropQuality==='unusable'||review.buildingMatch==='no')return {proposal:null,sources:{}};
  const usableBaseline=baseline?.wholeUsable==='no'?null:baseline;
  const proposal=usableBaseline?{...usableBaseline}:{wholeUsable:'unknown',shopfront:'unknown',awning:'unknown',roofShape:'unknown',facadeTop:'unknown',visibleSignText:''},sources={};
  for(const [key,allowed] of Object.entries(choices)){
    if(review.fieldEligibility?.[key]===true&&allowed.includes(review.proposal?.[key])){proposal[key]=review.proposal[key];sources[key]='agent-visual-review';}
    else if(review.fieldEligibility?.[key]===false&&review.proposal?.[key]==='unknown'){proposal[key]='unknown';sources[key]='agent-withheld';}
  }
  if(review.fieldEligibility?.visibleSignText===true&&typeof review.proposal?.visibleSignText==='string'){
    proposal.visibleSignText=review.proposal.visibleSignText.slice(0,500);sources.visibleSignText='agent-visual-review';
  }
  else if(review.fieldEligibility?.visibleSignText===false&&review.proposal?.visibleSignText===''){proposal.visibleSignText='';sources.visibleSignText='agent-withheld';}
  if(!usableBaseline&&!Object.keys(sources).length)return {proposal:null,sources:{}};
  return {proposal,sources};
}
export function applyHumanAppearance(proposal,decision){
  if(decision?.placement!=='accepted')return proposal;
  const result=proposal&&proposal.wholeUsable!=='no'?{...proposal}:{wholeUsable:'unknown',visibleSignText:''};
  for(const key of ['shopfront','awning','roofShape','facadeTop'])result[key]=decision[key]??'unknown';
  return result;
}
export function roofSourceEligible(aerial,visualReview){
  return !!aerial&&aerial.coverageComplete!==false&&visualReview?.appearanceEligible!==false&&visualReview?.cropQuality!=='unusable'&&visualReview?.buildingMatch!=='no';
}
