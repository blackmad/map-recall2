import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {prepareTemporalPreviewEvidence} from './temporal-preview-evidence.ts';
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'temporal-preview-'));
try{
 const bytes=await sharp({create:{width:7,height:5,channels:3,background:'#888888'}}).jpeg().toBuffer(),file=path.join(directory,'source.jpg');await fs.writeFile(file,bytes);
 const source={path:file,cropSha256:crypto.createHash('sha256').update(bytes).digest('hex'),width:7,height:5,captureDate:'2023-01-10T10:44:05Z',tier:'ground',registration:{status:'ambiguous'}};
 const binding={buildingId:'b',frontage:[[1,2],[3,4]]},entry={...binding,candidates:[source,source]},out=path.join(directory,'published');
 const result=await prepareTemporalPreviewEvidence(entry,binding,out);assert.equal(result.candidates.length,1);assert.equal(result.recoveredFeatureCount,0);assert.equal(result.candidates[0].registration.status,'ambiguous');
 await assert.rejects(prepareTemporalPreviewEvidence(entry,{...binding,buildingId:'other'},out),/mismatch/);
 await assert.rejects(prepareTemporalPreviewEvidence({...entry,candidates:[{...source,width:8}]},binding,out),/dimensions/);
 await fs.writeFile(file,'broken');await assert.rejects(prepareTemporalPreviewEvidence(entry,binding,out),/Corrupt temporal/);
 await fs.writeFile(file,bytes);await fs.writeFile(path.join(out,`${source.cropSha256}.jpg`),'broken');await assert.rejects(prepareTemporalPreviewEvidence(entry,binding,out),/Corrupt published/);
 console.log('Temporal preview: exact source identity, dimensions, immutable bytes, deduplication, and no implied recovery passed.');
}finally{await fs.rm(directory,{recursive:true,force:true});}
