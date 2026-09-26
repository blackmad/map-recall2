import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const base='.cache/da-costa-neighbourhood',stage=base+'/aerial-expanded-2026-09-09',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const staged=JSON.parse(await fs.readFile(stage+'/aerial.json'));
let bytes=await fs.readFile(base+'/aerial.json');
if(hash(bytes)!==staged.activeManifestSha256)for(const name of (await fs.readdir(base)).filter(name=>name.startsWith('before-aerial-'))){const candidate=await fs.readFile(base+'/'+name+'/aerial.json');if(hash(candidate)===staged.activeManifestSha256){bytes=candidate;break;}}
const before=JSON.parse(bytes),root=await fs.mkdtemp(path.resolve('.cache/aerial-promotion-test-'));
await fs.mkdir(root+'/images');await fs.writeFile(root+'/aerial.json',bytes);await fs.writeFile(root+'/images/unrelated.jpg','untouched');await fs.writeFile(root+'/reviews.json','{"events":[]}');await fs.writeFile(root+'/spend.json','{"untouched":true}');
const args=['scripts/da-costa-block/promote-expanded-aerial.mjs','--root='+root,'--stage='+stage];
const dry=JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8'}));assert.equal(dry.buildings,5);assert.equal(dry.afterClipped,0);assert.deepEqual(await fs.readFile(root+'/aerial.json'),bytes);
const applied=JSON.parse(execFileSync(process.execPath,[...args,'--apply'],{encoding:'utf8'}));
const after=JSON.parse(await fs.readFile(root+'/aerial.json'));assert.equal(after.records.length,before.records.length);
for(const r of before.records){const next=after.records.find(n=>n.buildingId===r.buildingId),changed=staged.records.some(s=>s.buildingId===r.buildingId);if(!changed)assert.deepEqual(next,r);else{assert.equal(next.coverageComplete,true);assert.equal(next.roofColour,null);for(const image of [next,next.context])assert.equal(hash(await fs.readFile(root+'/images/'+image.file)),image.sha256);}}
assert.deepEqual(await fs.readFile(applied.backup+'/aerial.json'),bytes);assert.equal(await fs.readFile(root+'/images/unrelated.jpg','utf8'),'untouched');assert.equal(await fs.readFile(root+'/reviews.json','utf8'),'{"events":[]}');assert.equal(await fs.readFile(root+'/spend.json','utf8'),'{"untouched":true}');
assert.throws(()=>execFileSync(process.execPath,args,{stdio:'pipe'}),/Command failed/);
console.log('Passed: expanded georeference/hash validation, dry-run, five complete replacements, unchanged other records, no painting, backup, preserved old files/ledgers and stale-source guard. '+root);
