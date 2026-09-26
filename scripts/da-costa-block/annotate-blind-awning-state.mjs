/** Post-freeze schema clarification, not a new blind review or image observation. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const root='.cache/da-costa-neighbourhood/blind-storefront-2026-09-09/';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=await fs.readFile(root+'frozen-blind-decisions.json');
if(hash(bytes)!=='fb174ea28cf46b5d5003fd054582b3d116bfd3f1de19d6ef485e92c47e711c50')throw Error('Blind decisions changed');
const findings=JSON.parse(await fs.readFile(root+'findings.json'));
// presence concerns the feature identified by kind, not exclusively fabric.
const states={
  '01':['no','not-observed','none','no'],
  '02':['no','not-observed','none','no'],
  '03':['no','not-observed','none','no'],
  '04':['yes','deployed','fabric','yes'],
  '05':['unknown','unknown','unknown','unknown'],
  '06':['no','not-observed','none','no'],
  '07':['yes','retracted','fabric','yes'],
  '08':['yes','unknown','rigid-canopy','no'],
  '09':['yes','deployed','fabric','yes'],
  '10':['unknown','unknown','unknown','unknown'],
};
const rows=findings.map(r=>{
  const [presence,observedDeployment,kind,fabricAwningPresence]=states[r.blindNumber];
  return {id:r.id,buildingId:r.buildingId,derivationKey:r.derivationKey,origin:'agent-visual-review',reviewer:'Codex render_qa post-freeze schema annotation',humanReviewed:false,metricEligible:false,blindNumber:r.blindNumber,sourceDecisionSha256:hash(bytes),buildingMatch:r.buildingMatch,appearanceEligible:r.appearanceEligible,
    awningObservation:{presence,observedDeployment,kind,fabricAwningPresence,fixed:kind==='rigid-canopy'?true:null,colourObserved:kind==='fabric'&&observedDeployment==='deployed'?(r.blindNumber==='04'?'yellow/cream stripes':'burgundy/maroon'):null,renderDeployedFabricEligible:kind==='fabric'&&observedDeployment==='deployed',evidence:r.awningType,scope:'Target physical ground frontage only. Masonry balconies, whole-building roofs, neighbours and unattached street objects excluded. Eligibility is an agent observation, never human render approval.'},
    images:r.images.filter(m=>m.kind==='ground'||m.kind==='full'||m.kind==='context')};
});
const output={version:1,stage:'post-freeze structured annotation; baseline identities and outputs already revealed',origin:'agent-visual-review',humanReviewed:false,metricEligible:false,sourceDecisionsSha256:hash(bytes),definitions:{presence:'Presence of the physical feature identified by kind. A rigid canopy can be present while fabricAwningPresence is no.',observedDeployment:'Observed fabric state only. unknown for rigid fixed canopy: deployed/retracted does not apply. not-observed means no target fabric/canopy seen in the inspected source, not a timeless absence claim.',renderDeployedFabricEligible:'Source supports deployed fabric geometry only; this is not permission to bypass the separate human/machine rendering gates.'},roofScope:'No full roof geometry was inspected. Street-only roofShape unknown / eligibility false is an abstention about unseen roof volume, not a rejection of independently supported aerial geometry.',records:rows};
await fs.writeFile(root+'awning-observations-v1.json',JSON.stringify(output,null,2),{flag:'wx'});
console.log(JSON.stringify({file:root+'awning-observations-v1.json',records:rows.length,deployedFabric:rows.filter(r=>r.awningObservation.renderDeployedFabricEligible).map(r=>r.blindNumber),retracted:rows.filter(r=>r.awningObservation.observedDeployment==='retracted').map(r=>r.blindNumber),rigid:rows.filter(r=>r.awningObservation.kind==='rigid-canopy').map(r=>r.blindNumber)}));
