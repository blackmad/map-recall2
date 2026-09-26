import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
let base='.cache/da-costa-neighbourhood';const stage='.cache/da-costa-visibility-stage';
const audit=JSON.parse(await fs.readFile(stage+'/visibility-audit.json'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(hash(await fs.readFile(base+'/manifest.json'))!==audit.sourceManifestFileHash){
  const candidates=(await fs.readdir(base)).filter(name=>name.startsWith('before-visibility-'));
  for(const name of candidates){const folder=base+'/'+name;if(hash(await fs.readFile(folder+'/manifest.json'))===audit.sourceManifestFileHash){base=folder;break;}}
}
const root=await fs.mkdtemp(path.resolve('.cache/neighbourhood-promotion-test-'));
const bytes=await fs.readFile(base+'/manifest.json'),before=JSON.parse(bytes);
await fs.mkdir(root+'/images');await fs.mkdir(root+'/panoramas');await fs.writeFile(root+'/manifest.json',bytes);
const ids=audit.records.filter(r=>r.views.full.rejected||r.views.ground.rejected).map(r=>r.id);
for(const r of before.records.filter(r=>ids.includes(r.id)))for(const image of Object.values(r.images))await fs.copyFile(base+'/images/'+image.file,root+'/images/'+image.file);
await fs.writeFile(root+'/reviews.json','{"events":[]}');await fs.writeFile(root+'/spend.json','{"untouched":true}');
const command=['scripts/da-costa-block/promote-visibility-crops.mjs','--root='+root,'--stage='+stage];
const dry=JSON.parse(execFileSync(process.execPath,command,{encoding:'utf8'}));assert.equal(dry.dryRun,true);assert.equal(dry.replacements.length,3);
assert.throws(()=>execFileSync(process.execPath,[...command,'--apply'],{stdio:'pipe'}),/Command failed/);
assert.deepEqual(await fs.readFile(root+'/manifest.json'),bytes,'missing stopped-server flag never mutates manifest');
const applied=JSON.parse(execFileSync(process.execPath,[...command,'--apply','--review-server-stopped'],{encoding:'utf8'}));
const after=JSON.parse(await fs.readFile(root+'/manifest.json'));
assert.equal(after.records.length,before.records.length);
for(const r of before.records){const next=after.records.find(n=>n.id===r.id);if(ids.includes(r.id)){assert.notEqual(next.derivationKey,r.derivationKey);assert.equal(next.images.ground.sha256,r.images.ground.sha256);}else assert.deepEqual(next,r);}
assert.equal(await fs.readFile(root+'/reviews.json','utf8'),'{"events":[]}');assert.equal(await fs.readFile(root+'/spend.json','utf8'),'{"untouched":true}');
assert.deepEqual(await fs.readFile(applied.backup+'/manifest.json'),bytes,'recoverable original manifest');
assert.throws(()=>execFileSync(process.execPath,command,{stdio:'pipe'}),/Command failed/,'stale audit cannot promote twice');
console.log('Passed: dry-run, stopped-server guard, three replacements, 100 unchanged records, preserved ground pixels and ledgers, backup, stale-audit rejection. '+root);
