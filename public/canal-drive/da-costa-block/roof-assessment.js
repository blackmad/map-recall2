/** Review routing for already source-validated evidence; never an inferred roof label. */
const shapes=new Set(['flat','flat-with-front-pitch','pitched-gable','hipped','mansard','complex']);
export function assessRoofEvidence(record){
  const candidates=[],abstentions=[];
  const add=(source,value,sourceId=record.id,visible)=>{
    if(!value)return;
    const shape=value.roofShape??value.shape;
    if(!shapes.has(shape)||visible==='no')abstentions.push({source,sourceId,reason:visible==='no'?'roof-not-visible':'unknown-shape'});
    else if(!candidates.some(c=>c.source===source&&c.sourceId===sourceId&&c.shape===shape))candidates.push({source,sourceId,shape});
  };
  const primarySource=record.proposalSources?.roofShape||'street-model';
  const primaryBound=['agent-visual-review','human-review'].includes(primarySource);
  const appearanceSuppressed=['crop-repair','rejected','uncertain'].includes(record.review?.placement)||!record.effectiveProposal||record.effectiveProposal.wholeUsable==='no';
  if(!appearanceSuppressed)add(primarySource,record.effectiveProposal,record.id,primaryBound?undefined:record.effectiveProposal.roofVisible);
  const roofSourceBlocked=record.images?.aerial?.coverageComplete===false||record.visualReview?.appearanceEligible===false||record.visualReview?.buildingMatch==='no'||record.visualReview?.cropQuality==='unusable';
  if(!roofSourceBlocked){
    add('aerial-model',record.roofAerialProposal,record.roofAerialProposal?.sourceId,record.roofAerialProposal?.visible);
    add('focused-roof-model',record.roofOracleProposal,record.roofOracleProposal?.sourceId,record.roofOracleProposal?.roofVisible);
    for(const c of record.roofOracleCandidates||[]){
      const selected=record.roofOracleProposal;
      const sameSource=selected?.sourceId===c.sourceId&&(selected.roofShape??selected.shape)===(c.roofShape??c.shape);
      // Older public projections omitted visibility. A shortened duplicate may
      // not revive a full source's explicit visibility abstention.
      add('focused-roof-model',c,c.sourceId,sameSource&&selected.roofVisible==='no'?'no':c.roofVisible??(sameSource?selected?.roofVisible:undefined));
    }
    add('gpt-roof-model',record.roofGptProposal,record.roofGptProposal?.sourceId,record.roofGptProposal?.roofVisible);
  }
  const distinctShapes=[...new Set(candidates.map(c=>c.shape))];
  const imageDisagreement=distinctShapes.length>1;
  // These geometry labels have different granularity. A missing mesh apron is
  // not a vote that the visible apron is absent, nor is generic "complex" a
  // contradicting image class. Keep differences as representation questions.
  const mesh=record.roofEvidence?.shape;
  const meshDetailDifference=candidates.some(c=>mesh==='flat'&&c.shape!=='flat'||mesh==='pitched-gable'&&c.shape!=='pitched-gable');
  const components=record.roofComponents?.facts;
  const componentQuestion=!!components?.substantiveMainDeckHeightFrontagePitchFaceIndices?.length&&distinctShapes.includes('flat');
  const reasons=[imageDisagreement?'image-shape-disagreement':null,meshDetailDifference?'mesh-image-detail-difference':null,componentQuestion?'small-frontage-pitch':null,roofSourceBlocked?'source-limited':null,!candidates.length?'no-eligible-image-shape':null].filter(Boolean);
  const placementReviewed=record.review?.placement==='accepted';
  const reviewed=placementReviewed&&shapes.has(record.review.roofShape);
  const status=roofSourceBlocked?'source-limited':imageDisagreement?'image-disagreement':meshDetailDifference||componentQuestion?'mesh-detail-question':!candidates.length?'insufficient-evidence':'candidate-only';
  const summary={
    'source-limited':'Source coverage or crop quality limits this roof assessment; do not infer unseen parts.',
    'image-disagreement':`Image proposals differ: ${distinctShapes.join(' / ')}. This is not a majority vote.`,
    'mesh-detail-question':componentQuestion?'The mesh contains a substantial street-edge pitch at the reference-deck height, while an image proposal says flat. Inspect that component; neither source is ground truth.':'Image and mesh detail differ. Simplified roof geometry can omit a visible front pitch.',
    'insufficient-evidence':'No eligible image proposal establishes the whole roof shape. Unknown is not a disagreement.',
    'candidate-only':`Image evidence proposes ${distinctShapes[0]}; agreement is not verification.`,
  }[status];
  return {version:1,status,summary,candidates,abstentions,distinctShapes,imageDisagreement,meshDetailDifference,componentQuestion,sourceLimited:roofSourceBlocked,reasons,needsReview:!reviewed&&reasons.length>0,placementReviewed,humanReviewed:reviewed,humanAbstained:placementReviewed&&!reviewed,authoritativeShape:null};
}
