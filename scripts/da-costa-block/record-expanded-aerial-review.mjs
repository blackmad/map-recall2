/** Frozen visual observations from the isolated expanded-aerial experiment. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {readFrozenJson,REVIEW_INPUT_PINS} from './review-input-pins.mjs';
const active=path.resolve('.cache/da-costa-neighbourhood');
const stage=path.join(active,'aerial-expanded-2026-09-09');
const aerial=await readFrozenJson(path.join(stage,'aerial.json'),REVIEW_INPUT_PINS.expandedAerial);
const source=await readFrozenJson(path.join(active,'self-review-2026-09-09/roof-sources.json'),REVIEW_INPUT_PINS.roofPackets);
const current=JSON.parse(await fs.readFile(path.join(active,'manifest.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const frozen=[
  [28,'complex','unknown',
    'Complete overhead coverage now shows both long outer wings with broad level roof surfaces and solar panels/terraces, plus differently oriented raised central roof volumes beside the rectangular gridded court/deck. The central rounded-looking roof sections are visibly not one continuous plane with the two long wings. Mixed volumes therefore support complex rather than a single flat, gable or hipped solid. The street clock and repeated raised curved caps are decorative facade elements, not evidence for the entire roof volume.',
    'The exact curved-versus-shallow-pitched geometry of the central sections remains uncertain, and the gridded central surface is not confidently identified as glazing versus paving. The broad street crop combines multiple raised decorative elements, so no single facadeTop is assigned. Whole-roof material remains unknown.',
    'Whole-building roof family changes from unknown to complex because newly complete overhead evidence exposes a mixed multi-wing composition. This is a coarse positive proposal, not a reconstructed roof mesh.'],
  [73,'unknown','straight',
    'The previously clipped end of the short perpendicular wing is now fully visible. It has an extensive level-looking roof surface with a solar array and rooftop equipment, matching the flat-deck family already visible on the long canal-side wing. The street wall has a straight parapet/cornice profile. Expanded context confirms both main exposed wings and their relationship within the same outline.',
    'A substantial central connecting section remains in deep cast shadow. Its roof plane and possible raised structures are not resolved. Complete source extent therefore does not justify upgrading the strict whole-building roof label to flat. Retain flat as a local observation for the two visible wings only; whole-roof material remains unknown.',
    'Coverage repair resolves the missing short-wing extent, but does not resolve whole-building roofShape. This is an explicit continuing abstention, not evidence that the roof is non-flat.'],
];
const records=[];
for(const [index,roofShape,facadeTop,observations,limitations,resolution] of frozen){
  const s=source.records.find(r=>r.index===index),a=aerial.records.find(r=>r.buildingId===s.buildingId);
  assert.equal(current.records.find(r=>r.id===s.id)?.derivationKey,s.derivationKey,'Street derivation changed');
  const street=s.images.filter(m=>['full','roof'].includes(m.kind)).map(m=>({...m,absolutePath:path.join(active,'images',m.file)}));
  const overhead=[{kind:'aerial',file:a.file,absolutePath:path.join(stage,'images',a.file),sha256:a.sha256},{kind:'aerial-context',file:a.context.file,absolutePath:path.join(stage,'images',a.context.file),sha256:a.context.sha256}].map(m=>({...m,date:a.date,layer:a.layer,sourceSha256:a.sourceSha256,sourceUrl:a.url}));
  for(const m of [...street,...overhead])assert.equal(sha(await fs.readFile(m.absolutePath)),m.sha256,'Reviewed image changed');
  for(const p of s.originalPanoramas)assert.equal(sha(await fs.readFile(p.file)),p.sha256,'Original street panorama changed');
  assert.equal(sha(await fs.readFile(a.sourceFile)),a.sourceSha256,'Source tile changed');
  records.push({id:s.id,buildingId:s.buildingId,address:s.address,derivationKey:s.derivationKey,origin:'agent-visual-review',reviewer:'Codex / review_hardening / direct expanded-aerial image inspection',humanReviewed:false,metricEligible:false,buildingMatch:'yes',cropQuality:'usable',appearanceEligible:true,needsReview:roofShape==='unknown',proposal:{roofShape,facadeTop,roofMaterial:'unknown'},fieldEligibility:{roofShape:roofShape!=='unknown',facadeTop:facadeTop!=='unknown',roofMaterial:false},evidence:observations+' '+limitations,observations,limitations,resolution,scope:{roofShape:'Whole-building coarse roof-volume family; local flat-wing observations are not automatically whole-building flat labels.',facadeTop:'Only the photographed street wall, independent of roof volume.',roofMaterial:'Whole-roof material, withheld. No ground-floor fields assessed.'},quality:{aerialCoverageComplete:true,contextCoverageComplete:true,previousAerialCoverageComplete:false,roofRecropBeforeHuman:false,roofShadowUnresolved:true,footprintAlignment:'Complete XY footprint extent checked; footprint is not independently surveyed against elevated roof edges and relief displacement may remain.'},images:[...street,...overhead],originalPanoramas:s.originalPanoramas,aerialSource:{sha256:a.sourceSha256,url:a.url,layer:a.layer,file:a.sourceFile,bbox:a.bbox,crs:'EPSG:28992',scalePxPerM:a.scalePxPerM,width:a.sourceWidth,height:a.sourceHeight,footprintSha256:a.footprintSha256},sourceBinding:{staged:true,sourceRoot:path.join(stage,'images'),integration:'New overhead hashes belong to isolated staged images, not current active aerial images. Bind these hashes before consuming; do not overwrite prior observations or ground fields.'}});
}
const output={version:1,createdAt:new Date().toISOString(),origin:'agent-visual-review',humanReviewed:false,metricEligible:false,costUsd:0,method:'Direct native image inspection of expanded tight/context aerials plus reopened full/upper street crops. Prior frozen street/aerial findings are known; this is an evidence-acquisition follow-up, not a blinded accuracy benchmark. No paid model calls or human decisions. Original panorama files are provenance-hashed but were not reopened in this follow-up.',integration:'Roof-only separate source-bound findings. No active images, active aerial manifest, old findings or human labels are modified. Unknown fields abstain rather than erase earlier proposals.',summary:{packets:2,coverageRepaired:2,newlySupportedRoofFamilies:1,stillUnresolved:1,supportedMaterialLabels:0},records};
assert.equal(sha(await fs.readFile(path.join(active,'aerial.json'))),aerial.activeManifestSha256,'Active aerial manifest changed since staging; re-evaluate integration');
await fs.writeFile(path.join(stage,'roof-findings.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(output.summary));
