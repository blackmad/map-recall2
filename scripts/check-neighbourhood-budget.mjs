import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const fixture=JSON.parse(await fs.readFile('.cache/da-costa-neighbourhood/manifest.json'));fixture.records=fixture.records.slice(0,2);
async function setup(){const root=await fs.mkdtemp(path.resolve('.cache/neighbourhood-budget-test-'));await fs.mkdir(root+'/images');await fs.writeFile(root+'/no-credentials','');await fs.writeFile(root+'/manifest.json',JSON.stringify(fixture));for(const r of fixture.records)for(const m of Object.values(r.images))await fs.copyFile('.cache/da-costa-neighbourhood/images/'+m.file,root+'/images/'+m.file);return root;}
function run(root,budget,unknown=false,shared={}){return spawnSync(process.execPath,['--import',path.resolve('scripts/fixtures/neighbourhood-provider-mock.mjs'),'scripts/da-costa-block/infer-neighbourhood.mjs','--model=test/model','--mode=full','--limit=2','--env-file='+root+'/no-credentials','--root='+root,'--budget-usd='+budget,'--budget-ledger='+(shared.file??root+'/global-spend.json'),'--legacy-budget-ledger='+(shared.legacy??root+'/spend.json')],{env:{...process.env,OPENROUTER_API_KEY:'mock-not-a-key',NEIGHBOURHOOD_MOCK_LOG:root+'/calls.log',NEIGHBOURHOOD_MOCK_UNKNOWN:unknown?'1':''},encoding:'utf8'});}
const root=await setup();
const rejected=run(root,.02);assert.notEqual(rejected.status,0,'reject unaffordable reservation before call');assert.match(rejected.stderr,/reservation exceeds ceiling/);
await assert.rejects(fs.readFile(root+'/calls.log'),{code:'ENOENT'});
assert.notEqual(run(root,.05).status,0,'stop before second reservation');
let ledger=JSON.parse(await fs.readFile(root+'/spend.json'));assert.equal(ledger.results.length,1);assert.equal(ledger.results[0].status,'ok');
assert.equal(run(root,.1).status,0,'resume skips paid source');
ledger=JSON.parse(await fs.readFile(root+'/spend.json'));assert.equal(ledger.results.length,2);assert.equal((await fs.readFile(root+'/calls.log','utf8')).trim().split('\n').length,2);
const expansion=await setup(), historical=root+'/historical-spend.json';
await fs.writeFile(historical,JSON.stringify({results:ledger.results.map(({key,reservedUsd,usage})=>({key,reservedUsd,usage}))}));
const acrossAreas=run(expansion,.1,false,{file:expansion+'/shared-global.json',legacy:historical});
assert.notEqual(acrossAreas.status,0);assert.match(acrossAreas.stderr,/Global spend reservation exceeds ceiling/);
await assert.rejects(fs.readFile(expansion+'/calls.log'),{code:'ENOENT'});
assert.equal(JSON.parse(await fs.readFile(expansion+'/shared-global.json')).observedOrReservedCostUsd,.068,'new area imports prior cumulative charges');
const uncertain=await setup();assert.notEqual(run(uncertain,5,true).status,0);assert.notEqual(run(uncertain,5,true).status,0);
assert.equal((await fs.readFile(uncertain+'/calls.log','utf8')).trim(),'call','unknown charge blocks further requests and restart');
ledger=JSON.parse(await fs.readFile(uncertain+'/spend.json'));assert.ok(ledger.observedOrReservedCostUsd>0);
console.log('Passed: pre-call reservation, ceiling boundary, paid-result reuse, cross-area cumulative legacy charges and unknown-charge stop/restart. No external requests or real charges.');
