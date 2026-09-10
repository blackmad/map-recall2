/** Strict opt-in text-preview gate. This never creates a reviewed landmark. */
export const MACHINE_SIGN_PROVENANCE='Agent-extracted sign preview — unreviewed';
const normalized=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function machineSignCandidate(record,anchors=[]){
  const review=record.visualReview,proposal=record.effectiveProposal;
  const reject=reason=>({id:record.id,buildingId:record.renderBuildingId,eligible:false,reason});
  if(['rejected','uncertain','crop-repair'].includes(record.review?.placement))return reject('placement-withheld');
  if(!review||review.origin!=='agent-visual-review'||review.buildingMatch!=='yes'||review.appearanceEligible!==true||review.cropQuality==='unusable')return reject('no-eligible-direct-review');
  const sources=[...Object.values(record.images||{}),record.images?.aerial?.context].filter(Boolean);
  if(review.derivationKey!==record.derivationKey||!Array.isArray(review.images)||!review.images.length||!review.images.every(image=>sources.some(source=>source.file===image.file&&source.sha256===image.sha256&&(!image.panoramaSha256||image.panoramaSha256===source.panoramaSha256))))return reject('stale-or-missing-image-binding');
  if(review.fieldEligibility?.shopfront!==true||review.fieldEligibility?.visibleSignText!==true||proposal?.shopfront!=='yes'||proposal.wholeUsable==='no'||record.proposalSources?.visibleSignText!=='agent-visual-review')return reject('shop-or-sign-not-supported');
  const text=String(proposal.visibleSignText||'').trim();
  if(!text||text.length>96||/[\u0000-\u001f\u007f]/.test(text))return reject('empty-or-unreadable-text');
  const buildingIds=new Set(anchors.flatMap(a=>[a.buildingId,...(a.frontages||[]).map(f=>f.buildingId)]));
  if(buildingIds.has(record.renderBuildingId))return reject('authored-building');
  const normalizedText=' '+normalized(text)+' ';
  if(anchors.some(a=>[a.sign,a.name].some(name=>normalized(name).length>=3&&normalizedText.includes(' '+normalized(name)+' '))))return reject('authored-business');
  return {id:record.id,buildingId:record.renderBuildingId,eligible:true,text,provenance:MACHINE_SIGN_PROVENANCE,sourceDerivationKey:record.derivationKey};
}
