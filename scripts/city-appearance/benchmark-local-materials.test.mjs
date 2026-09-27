import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import sharp from 'sharp';
import { recordsFromEvidenceManifest, recordsFromReference, runBenchmark, speedSummary, validateLabel } from './benchmark-local-materials.mjs';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
assert.deepEqual(validateLabel({materialFamily:'brick',colourFamily:'red',visibility:'clear',abstain:false}),{valid:true,reason:null});
assert.equal(validateLabel({materialFamily:'brick',colourFamily:'red',visibility:'occluded',abstain:false}).valid,false);
assert.equal(validateLabel({materialFamily:'brick',colourFamily:'unknown',visibility:'partial',abstain:true}).valid,false);
assert.deepEqual(validateLabel({materialFamily:'brick',colourFamily:'unknown',visibility:'partial',abstain:false}),{valid:false,reason:'unknown-must-abstain'});
assert.deepEqual(validateLabel({materialFamily:'unknown',colourFamily:'brown',visibility:'partial',abstain:false}),{valid:false,reason:'unknown-must-abstain'});
assert.deepEqual(speedSummary([{status:'dry-run'},{status:'error',clientLatencyMs:300},{status:'ok',schema:{valid:true},clientLatencyMs:100,server:{loadDurationMs:10}}]).excludedErrors,1);

const root=await fs.mkdtemp(path.join(os.tmpdir(),'local-material-benchmark-'));
let server;
try {
  const evidence=path.join(root,'evidence'),images=path.join(evidence,'images');await fs.mkdir(images,{recursive:true});
  const bytes=await sharp({create:{width:80,height:40,channels:3,background:'#8a6550'}}).jpeg().toBuffer();
  const imageName='owner_e_1-full.jpg';await fs.writeFile(path.join(images,imageName),bytes);
  const manifest={sourceHash:'a'.repeat(64),sourceProfile:'material-4000',records:[{buildingId:'owner',id:'owner_e_1',elevationId:'owner:e:1',images:{full:{file:imageName,sha256:sha256(bytes),panoramaSha256:'b'.repeat(64),sourceProfile:'material-4000',sourceDimensions:[4000,2000]}}}]};
  const manifestFile=path.join(evidence,'manifest.json');await fs.writeFile(manifestFile,JSON.stringify(manifest));
  assert.equal(recordsFromEvidenceManifest(manifest,manifestFile)[0].elevationId,'owner:e:1');
  assert.throws(()=>recordsFromEvidenceManifest({...manifest,records:[...manifest.records,...manifest.records]},manifestFile),/duplicate/i);
  const reference={sourceIdentityUnverified:true,entries:[{source:{path:'.cache/city-appearance/areas/a/panorama-audit/b/evidence/images/owner_e_1-full.jpg',sha256:sha256(bytes),buildingId:'owner',elevationId:'owner:e:1',imageKind:'full',sourceDimensions:[4000,2000]},label:{materialFamily:'brick',colourFamily:'brown',visibility:'clear'}}]};
  const referenceSource=recordsFromReference(reference,'reference.json')[0];
  assert.equal(referenceSource.sourceSha256,sha256(bytes));assert(!('label' in referenceSource),'review label must never enter model source binding');
  let chats=0,request;
  server=http.createServer(async(req,res)=>{
    res.setHeader('content-type','application/json');
    if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:'qwen3.5:9b',digest:'c'.repeat(64)}]}));return;}
    if(req.url==='/api/chat'){
      chats++;let body='';for await(const chunk of req)body+=chunk;request=JSON.parse(body);
      res.end(JSON.stringify({message:{content:JSON.stringify({materialFamily:'brick',colourFamily:'brown',visibility:'clear',abstain:false}),
        ...(request.think?{thinking:'Checked whether a representative wall is visible.'}:{})},
        total_duration:120000000,load_duration:20000000,prompt_eval_duration:30000000,eval_duration:70000000,prompt_eval_count:90,eval_count:18,done_reason:'stop'}));return;
    }
    res.statusCode=404;res.end('{}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const args=[`--manifest=${manifestFile}`,`--out=${path.join(root,'out')}`,`--base-url=http://127.0.0.1:${server.address().port}`,'--limit=1'];
  const first=await runBenchmark(args),second=await runBenchmark(args);
  assert.equal(chats,1,'valid receipt must be reused');
  assert.equal(request.think,false);assert.equal(request.stream,false);assert.equal(request.options.temperature,0);
  assert.equal(first.receipts[0].label.materialFamily,'brick');assert.equal(second.receipts[0].reused,true);
  assert.equal(first.speed.successfulSamples,1);assert.equal(first.speed.excludedErrors,0);
  const receipt=JSON.parse(await fs.readFile(path.join(root,'out','receipts',`${first.receipts[0].key}.json`)));
  assert.equal(receipt.binding.sourceSha256,sha256(bytes));assert.equal(receipt.modelDigest,'c'.repeat(64));
  assert.equal(receipt.server.loadDurationMs,20);assert.equal(receipt.response.message.content,receipt.rawOutput);
  await runBenchmark([...args,'--rerun']);
  assert.equal(chats,2);const rerun=JSON.parse(await fs.readFile(path.join(root,'out','receipts',`${first.receipts[0].key}.json`)));
  assert.equal(rerun.attempt,2);assert.equal(rerun.previousAttempts[0].rawOutput,receipt.rawOutput);
  const baselineDry=await runBenchmark([...args,'--dry-run','--image-size=512']);
  assert.equal(baselineDry.experimentHash,'1e9b3196ff736ce7474d16717f6963ad77ce98168802858da93227c40478f278',
    'the original base profile must keep its exact experiment hash');
  const variantArgs=[...args.filter(arg=>!arg.startsWith('--out=')),`--out=${path.join(root,'variant')}`,'--prompt-profile=conservative','--think=true','--max-output-tokens=512'];
  const variant=await runBenchmark(variantArgs);
  assert.equal(chats,3);assert.equal(request.think,true);assert.equal(request.options.num_ctx,4096);
  assert.equal(request.options.num_predict,512);assert.match(request.messages[0].content,/representative field/);
  assert.notEqual(variant.experimentHash,first.experimentHash);
  const variantReceipt=JSON.parse(await fs.readFile(path.join(root,'variant','receipts',`${variant.receipts[0].key}.json`)));
  assert.equal(variantReceipt.rawReasoning,'Checked whether a representative wall is visible.');
  assert.equal(variantReceipt.rawOutput,variantReceipt.response.message.content);
  await assert.rejects(runBenchmark([...variantArgs.filter(arg=>!arg.startsWith('--out=')),`--out=${path.join(root,'out')}`]),/different benchmark experiment/);
  await fs.writeFile(path.join(images,imageName),'changed');
  await assert.rejects(runBenchmark(args),/Source image hash changed/);
  console.log('Local material benchmark: bindings, local request, timing, response and resume passed');
} finally {
  if(server)await new Promise(resolve=>server.close(resolve));
  await fs.rm(root,{recursive:true,force:true});
}
