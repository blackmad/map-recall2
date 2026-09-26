/** Cache-only component diagnostics. Does not mutate extraction outputs or image labels. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {roofFrontageComponents,ROOF_COMPONENT_VERSION} from './roof-components.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const out=path.resolve('.cache/da-costa-roof-components');
const files={block:'public/data/da-costa-block/block.json',manifest:'.cache/da-costa-neighbourhood/manifest.json',module:'scripts/da-costa-block/roof-components.mjs',comparison:'.cache/da-costa-neighbourhood/roof-mesh-experiment-2026-09-09/comparison.json'};
const bytes=Object.fromEntries(await Promise.all(Object.entries(files).map(async([k,file])=>[k,await fs.readFile(file)])));
const block=JSON.parse(bytes.block),manifest=JSON.parse(bytes.manifest),comparison=JSON.parse(bytes.comparison);
const sourceFiles=Object.fromEntries(Object.entries(files).map(([k,file])=>[k,{file,sha256:sha(bytes[k])}]));
const start=performance.now();
const records=manifest.records.map(r=>{const building=block.buildings.find(b=>b.id===r.buildingId),frontage={localStart:r.localStart,localEnd:r.localEnd};return {id:r.id,buildingId:r.buildingId,address:r.address,derivationKey:r.derivationKey,source:{buildingSurfacesSha256:sha(JSON.stringify(building.surfaces)),frontageSha256:sha(JSON.stringify(frontage))},frontage,diagnostic:roofFrontageComponents(building,frontage)};});
const elapsedMs=performance.now()-start;
const byId=id=>records.find(r=>r.id===id).diagnostic;
assert.deepEqual(byId('0363100012236681_e_0f0740u').facts.mainDeckAdjoiningFrontPitchFaceIndices,[41,43]);
assert.deepEqual(byId('0363100012157075_e_0udbbkk').facts.lowerLevelPitchFaceIndices,[8]);
assert.deepEqual(byId('0363100012157075_e_0udbbkk').facts.frontageLinkedPitchFaceIndices,[]);
assert.deepEqual(byId('0363100012236521_e_030nf28').facts.frontageLinkedPitchFaceIndices,[23]);
assert.deepEqual(byId('0363100012236521_e_030nf28').facts.mainDeckAdjoiningFrontPitchFaceIndices,[]);
for(const id of ['0363100012081167_e_0c21yw2','0363100012165505_e_1m7zwfn','0363100012236141_e_041dz1t','0363100012157068_e_1j6rs7l'])assert.equal(byId(id).facts.noPitchObservedInMesh,true);
assert.equal(byId('0363100012077314_e_14o9326').pitchedFaces.length,8);
const amsta=byId('0363100012237064_e_0aws3g3');assert.deepEqual(amsta.pitchedFaces.map(f=>f.surfaceIndex),[102,104]);assert.ok(amsta.pitchedFaces.every(f=>f.geometryQuality.subSquareMetre));assert.equal(amsta.pitchedFaces[0].geometryQuality.subHalfSquareMetre,true);
assert.deepEqual(amsta.facts.substantiveFrontagePitchFaceIndices,[]);
// Assertions verify reproducible diagnostics, not human truth or accuracy.
const caseRecords=[];
for(const c of comparison.records){
  const record=records.find(r=>r.id===c.id),evidence=[];
  for(const image of c.visual.images){const file=image.absolutePath||path.resolve('.cache/da-costa-neighbourhood/images',image.file),actual=sha(await fs.readFile(file));assert.equal(actual,image.sha256,'Frozen comparison image changed: '+file);evidence.push({...image,absolutePath:file});}
  caseRecords.push({id:c.id,index:c.index,address:c.address,diagnostic:record.diagnostic,source:record.source,visualComparisonOnly:{frozenProposal:c.visual.streetAerialProposal,expandedProposal:c.visual.expandedProposal??null,images:evidence,note:'Existing agent proposals are context, not human truth. Diagnostic does not consume their classes.'}});
}
await fs.mkdir(out,{recursive:true});
const report={version:ROOF_COMPONENT_VERSION,createdAt:new Date().toISOString(),origin:'source-labelled-mesh-component-experiment',humanReviewed:false,metricEligible:false,inferenceCostUsd:0,downloads:0,sourceFiles,summary:{frontages:records.length,buildings:new Set(records.map(r=>r.buildingId)).size,elapsedMs:Math.round(elapsedMs),selectedRealCases:caseRecords.length,frontagesWithPitchInMesh:records.filter(r=>!r.diagnostic.facts.noPitchObservedInMesh).length,frontagesWithLinkedPitch:records.filter(r=>r.diagnostic.facts.frontageLinkedPitchFaceIndices.length).length,frontagesWithMainDeckAdjoiningFrontPitch:records.filter(r=>r.diagnostic.facts.mainDeckAdjoiningFrontPitchFaceIndices.length).length},policy:'Review-only facts. No authoritative class, geometry update, active proposal or human label. Absence of mesh pitch cannot refute positive image evidence. Source indices reference the frozen block surfaces.',records};
await fs.writeFile(path.join(out,'diagnostics.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(out,'real-cases.json'),JSON.stringify({...report,records:caseRecords},null,2));
console.log(JSON.stringify(report.summary));
