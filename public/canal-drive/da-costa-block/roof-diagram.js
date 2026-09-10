/** A north-up source-mesh plan, not generated replacement roof geometry. */
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function roofComponentSummary(components){
  if(!components)return 'No component diagnostic available.';
  const facts=components.facts,reference=components.mainDeckCandidate;
  const ids=values=>values?.length?values.join(', '):'none';
  return [
    `Projected street-linked pitch faces: ${ids(facts.frontageLinkedPitchFaceIndices)}. Nearby projection alone does not prove ownership.`,
    `Street-edge pitch physically adjoining the provisional reference deck: ${ids(facts.mainDeckAdjoiningFrontPitchFaceIndices)}.`,
    `Pitched faces at a lower level than that reference: ${ids(facts.lowerLevelPitchFaceIndices)}. These are not automatically front aprons.`,
    reference?`Provisional reference deck: faces ${ids(reference.sourceFaceIndices)}, height ${reference.heightRange.map(v=>v.toFixed(1)).join('–')} m in source mesh coordinates. The largest connected flat component can be a low annex, not the main roof.`:'No flat reference deck found in the mesh.',
    facts.noPitchObservedInMesh?'No pitch is represented in this mesh. This does not refute pitch visible in the photos.':'Small pitched faces are retained instead of discarded by a building-wide area threshold.',
    'Mesh evidence only. Decorative facade tops and roof material remain separate; the 3D roof is unchanged.',
  ].join('\n\n');
}
export function roofPlanSvg(plan,components){
  if(!plan?.faces?.length)return '';
  const points=[...plan.faces.flatMap(f=>f.rings.flat()),...plan.wall];
  if(points.some(p=>p.length!==2||!p.every(Number.isFinite)))return '';
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),minY=Math.min(...ys),span=Math.max(1,Math.max(...xs)-minX,Math.max(...ys)-minY),pad=span*.08;
  const box=[minX-pad,minY-pad,Math.max(...xs)-minX+2*pad,Math.max(...ys)-minY+2*pad];
  const links=new Set(components?.facts.frontageLinkedPitchFaceIndices||[]),decks=new Set(components?.mainDeckCandidate?.sourceFaceIndices||[]);
  const path=rings=>rings.map(r=>r.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ')+' Z').join(' ');
  return `<svg class="roof-plan" role="img" aria-label="North-up simplified roof components and selected source wall" viewBox="${box.join(' ')}"><title>Source roof mesh: blue provisional reference deck, pale grey other flat faces, orange street-linked pitches, violet other pitches. North up.</title>${plan.faces.map(f=>{
    const fill=f.pitched?(links.has(f.surfaceIndex)?'#c96b37':'#80669d'):(decks.has(f.surfaceIndex)?'#769aab':'#d5d8d0');
    return `<path data-face="${f.surfaceIndex}" d="${path(f.rings)}" fill="${fill}" fill-rule="evenodd" stroke="#34433c" stroke-width=".7" vector-effect="non-scaling-stroke"><title>${escape(`Source face ${f.surfaceIndex}: ${f.pitched?'pitched':'flat-family'}, mesh height ${f.heightRange.map(h=>h.toFixed(1)).join('–')} m`)}</title></path>`;
  }).join('')}<line class="roof-source-wall" x1="${plan.wall[0][0]}" y1="${plan.wall[0][1]}" x2="${plan.wall[1][0]}" y2="${plan.wall[1][1]}" stroke="#152c25" stroke-width="5" vector-effect="non-scaling-stroke"/><line x1="${plan.wall[0][0]}" y1="${plan.wall[0][1]}" x2="${plan.wall[1][0]}" y2="${plan.wall[1][1]}" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/></svg>`;
}
