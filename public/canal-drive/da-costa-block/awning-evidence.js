/** Installation/presence is not observed deployment; source binding survives publication. */
export function sourceBoundAwning(record){
  const evidence=record.awningEvidence;
  if(!evidence||evidence.origin!=='agent-visual-review'||evidence.derivationKey!==record.derivationKey||evidence.buildingMatch!=='yes'||evidence.appearanceEligible!==true)return null;
  const sources=Object.values(record.images||{});
  if(!Array.isArray(evidence.images)||!evidence.images.length||!evidence.images.every(m=>sources.some(s=>m.file===s.file&&m.sha256===s.sha256&&(!m.panoramaSha256||m.panoramaSha256===s.panoramaSha256))))return null;
  return evidence.awningObservation||null;
}
export function mayRenderReviewedAwning(record){
  const review=record.review;
  if(review?.placement!=='accepted'||review.targetId!==record.id||record.effectiveProposal?.awning!=='yes'||record.effectiveProposal?.wholeUsable==='no')return false;
  // New explicit human judgments take precedence over dated machine observations.
  // Unknown/retracted/mixed must not resurrect an older deployed-fabric proposal.
  if(review.awningKind!==undefined||review.awningDeployment!==undefined)
    return review.awningKind==='fabric'&&review.awningDeployment==='deployed';
  const observation=sourceBoundAwning(record);
  return observation?.presence==='yes'&&observation.fabricAwningPresence==='yes'&&observation.kind==='fabric'&&observation.observedDeployment==='deployed';
}
export function awningEvidenceSummary(record){
  const a=sourceBoundAwning(record);if(!a)return 'Awning presence alone does not establish deployment; extended fabric is withheld without source evidence.';
  return `Observed feature: ${a.kind}; fabric awning ${a.fabricAwningPresence}; deployment ${a.observedDeployment}. ${a.evidence} Installation does not imply deployed fabric; source dates are shown with the photos.`;
}
