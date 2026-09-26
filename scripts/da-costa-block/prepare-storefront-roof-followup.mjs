/** Copy source-only roof review packets without reading any prior roof model answers. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=path.resolve('.cache/da-costa-neighbourhood'),out=path.resolve('.cache/da-costa-storefront-roofs-2026-09-09');
const ids=['0363100012162168_e_04g3jtu','0363100012166975_e_1bab2bg','0363100012158909_e_0u03o2h','0363100012166189_e_0b6kngg','0363100012164219_e_0xe584t','0363100012157005_e_1xvojnu'];
const sourceFiles={manifest:path.join(root,'manifest.json'),aerial:path.join(root,'aerial.json'),block:'public/data/da-costa-block/block.json',previousPacketSources:path.join(root,'self-review-2026-09-09/roof-sources.json')};
const bytes=Object.fromEntries(await Promise.all(Object.entries(sourceFiles).map(async([k,file])=>[k,await fs.readFile(file)])));
const manifest=JSON.parse(bytes.manifest),aerial=JSON.parse(bytes.aerial),block=JSON.parse(bytes.block),prior=JSON.parse(bytes.previousPacketSources);
await fs.mkdir(path.join(out,'images'),{recursive:true});const records=[];
for(const [index,id] of ids.entries()){
  const record=manifest.records.find(r=>r.id===id),building=block.buildings.find(b=>b.id===record.buildingId),air=aerial.records.find(a=>a.buildingId===record.buildingId);
  assert.ok(!prior.records.some(r=>r.buildingId===record.buildingId),'Must be outside prior 12-roof sample');assert.equal(air.coverageComplete,true);
  const inputs=[...['full','roof','context'].map(kind=>({kind,...record.images[kind]})),{kind:'aerial',...air},{kind:'aerial-context',...air.context,date:air.date,sourceSha256:air.sourceSha256}],images=[];
  for(const input of inputs){const sourcePath=path.join(root,'images',input.file),raw=await fs.readFile(sourcePath);assert.equal(sha(raw),input.sha256);const file=String(index+1).padStart(2,'0')+'-'+input.kind+'.jpg';await fs.copyFile(sourcePath,path.join(out,'images',file));images.push({kind:input.kind,file:'images/'+file,absolutePath:path.join(out,'images',file),sha256:input.sha256,sourcePath,panoramaId:input.panoramaId??null,panoramaSha256:input.panoramaSha256??null,date:input.date??air.date,sourceSha256:input.sourceSha256??null});}
  records.push({index:index+1,id,buildingId:record.buildingId,address:record.address,derivationKey:record.derivationKey,frontage:{localStart:record.localStart,localEnd:record.localEnd,wallWidthM:record.wallWidthM},footprint:building.footprint,footprintSha256:sha(JSON.stringify(building.footprint)),footprintCoordinateSystem:'scene horizontal [x,z], metres; north is negative z',aerialCoverageComplete:air.coverageComplete,aerialSource:{url:air.url,layer:air.layer,sourceSha256:air.sourceSha256,crop:air.crop},images});
}
const packet={version:'source-only-storefront-roof-followup/v1',createdAt:new Date().toISOString(),origin:'agent-visual-review-source-packets',humanReviewed:false,paidCalls:0,downloads:0,policy:'Source-only packets selected from new storefront sample; no prior roof model answers read. Identity is not blinded. Freeze image-only roof fields before consulting mesh components. Complete aerial bounds do not guarantee visible roof detail. Preserve ground-field reviews.',sourceFiles:Object.fromEntries(Object.entries(sourceFiles).map(([k,file])=>[k,{file,sha256:sha(bytes[k])}])),records};
await fs.writeFile(path.join(out,'sources.json'),JSON.stringify(packet,null,2));console.log(JSON.stringify(records.map(r=>({index:r.index,id:r.id,address:r.address,images:r.images.length}))));
