/** Freeze full/ground evidence for the existing 100-owner colour cohort. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const cohortFile='public/data/wall-materials/assignments.json';
const cohortBytes=await fs.readFile(cohortFile),cohort=JSON.parse(cohortBytes.toString());
const manifestFile=`public/data/city-expansion/releases/${cohort.baselineReleaseId}/manifest.json`;
const manifestBytes=await fs.readFile(manifestFile),manifest=JSON.parse(manifestBytes.toString());
if(manifest.releaseId!==cohort.baselineReleaseId)throw Error('Release binding changed');
const owners=new Map<string,any>();
for(const t of manifest.tiles){const bytes=await fs.readFile(`public${t.url}`);
 if(sha(bytes)!==t.sha256)throw Error('Owner tile hash mismatch');
 for(const o of JSON.parse(gunzipSync(bytes).toString()).owners)owners.set(o.id,o);
}
const entries=[];
for(const c of cohort.entries){
 const owner=owners.get(c.buildingId),observation=owner?.observations.find((o:any)=>o.id===c.observationId),p=observation?.payload;
 if(!p||owner.geometryRevision!==c.geometryRevision||p.images.full.sha256!==c.sourceSha256)throw Error(`Cohort owner/source mismatch ${c.index}`);
 const images=[];
 for(const kind of ['full','ground']){const source=p.images[kind];if(!source)continue;
  const url=source.publicUrl??`/data/city-expansion/evidence/${source.sha256}.jpg`;
  if(!url.startsWith('/data/city-expansion/evidence/')||url.includes('..'))throw Error('Unexpected source path');
  const file=path.resolve(`public${url}`);
  try{const bytes=await fs.readFile(file);if(sha(bytes)!==source.sha256)throw Error('Image hash mismatch');}
  catch(error:any){if(kind==='ground'&&error.code==='ENOENT')continue;throw error;}
  images.push({kind,path:file,url,sha256:source.sha256,width:source.width,height:source.height,plane:source.plane,
   capturedAt:source.date,panoramaId:source.panoramaId,datum:source.datum});
 }
 entries.push({index:c.index,buildingId:c.buildingId,observationId:c.observationId,address:c.address,
  geometryRevision:owner.geometryRevision,wall:p.wall,groundNAP:p.groundNAP,metricEligible:p.metricEligible===true,
  images,sourceIdentity:'not-certified-by-this-packet'});
}
if(entries.length!==100||new Set(entries.map(e=>e.buildingId)).size!==100)throw Error('Expected100 unique owners');
const union=await read('public/data/facade-model-eval/v1/predictions/union-R0.json');
const unionOwners=new Set(union.records.map((r:any)=>r.buildingId?.replace(/^bag:/,'')));
const out=path.resolve('.cache/facade-assessment/cohort.json');await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify({version:1,cohortSha256:sha(cohortBytes),releaseId:manifest.releaseId,
 manifestSha256:sha(manifestBytes),policy:'Read-only evidence; no inferred owner identity or accepted geometry',
 summary:{owners:entries.length,groundSources:entries.filter(e=>e.images.some(i=>i.kind==='ground')).length,
 unionOwnerOverlap:entries.filter(e=>unionOwners.has(e.buildingId)).length},entries},null,2)+'\n');
console.log(out);
