import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

/** Publish photographs for inspection, never as accepted geometry evidence. */
export async function prepareTemporalPreviewEvidence(entry:any, binding:any, outputDirectory='public/data/facade-repair-preview/temporal') {
  if (!entry || entry.buildingId !== binding.buildingId || JSON.stringify(entry.frontage)!==JSON.stringify(binding.frontage)) throw Error('Temporal evidence building/frontage mismatch');
  const seen=new Set<string>(),candidates=[];
  for(const candidate of entry.candidates){
    if(!/^[a-f0-9]{64}$/.test(candidate.cropSha256)||!Number.isFinite(Date.parse(candidate.captureDate)))throw Error('Invalid temporal source identity');
    if(seen.has(candidate.cropSha256))continue;
    const bytes=await fs.readFile(candidate.path);
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==candidate.cropSha256)throw Error('Corrupt temporal photograph');
    const metadata=await sharp(bytes).metadata();
    if(metadata.width!==candidate.width||metadata.height!==candidate.height)throw Error('Temporal image dimensions mismatch');
    if(metadata.format!=='jpeg')throw Error('Unsupported temporal photograph format');
    seen.add(candidate.cropSha256);
    await fs.mkdir(outputDirectory,{recursive:true});
    const file=path.join(outputDirectory,`${candidate.cropSha256}.jpg`);
    try { await fs.writeFile(file,bytes,{flag:'wx'}); }
    catch(error:any){if(error.code!=='EEXIST')throw error;if(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')!==candidate.cropSha256)throw Error('Corrupt published temporal photograph');}
    candidates.push({url:`/data/facade-repair-preview/temporal/${candidate.cropSha256}.jpg`,cropSha256:candidate.cropSha256,captureDate:candidate.captureDate,tier:candidate.tier,width:candidate.width,height:candidate.height,observationId:candidate.observationId,geometryCandidate:candidate.geometryCandidate,registration:candidate.registration});
  }
  return {candidates,recoveredFeatureCount:0,status:'Photographs available for comparison; cross-date reconstruction awaits verified alignment and structural continuity.'};
}
