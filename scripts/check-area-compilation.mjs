/** Real cached municipal inputs; isolated outputs; no network or human-history writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { loadAreaConfig,AREA_PRESETS } from './da-costa-block/area-config.mjs';
const run=promisify(execFile),dir=await fs.mkdtemp(path.join(os.tmpdir(),'area-compile-'));
const raw=path.join(dir,'raw'),out=path.join(dir,'compiled'),config=path.join(dir,'area.json');
await fs.mkdir(raw);
for(const name of await fs.readdir('.cache/da-costa-block'))if(name.endsWith('.json')&&name!=='acquisition.json')await fs.symlink(path.resolve('.cache/da-costa-block',name),path.join(raw,name));
await fs.writeFile(config,JSON.stringify({...AREA_PRESETS['da-costa-block'],id:'cache-only-generic-area',cacheRoot:raw,outputRoot:out}));
const area=await loadAreaConfig(['--area-config='+config]);
const acquisition=JSON.parse(await fs.readFile('.cache/da-costa-block/acquisition.json'));
await fs.writeFile(path.join(raw,'acquisition.json'),JSON.stringify({...acquisition,areaConfigHash:area.configHash}));
// Poison an unreferenced old page: compilation must use the current manifest, not a directory scan.
await fs.writeFile(path.join(raw,'3dbag-9999.json'),'not a current source page');
await run(process.execPath,['--import','tsx','scripts/da-costa-block/compile.mjs','--area-config='+config],{maxBuffer:1024*1024});
const block=JSON.parse(await fs.readFile(path.join(out,'block.json'))),legacy=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
assert.equal(block.geometryPolicy,'unclipped-source-features');assert.equal(block.areaConfigHash,area.configHash);
assert.equal(block.anchors.length,0);assert.equal(block.focusRing.length,0);assert.equal(block.references.length,0,'authored landmark reference hints excluded');
assert.equal(block.buildings.length,legacy.buildings.length);
for(const b of block.buildings){assert.deepEqual(b.surfaces,legacy.buildings.find(x=>x.id===b.id).surfaces,'canonical wall and roof geometry unchanged');assert.ok(!b.anchorIds?.length);assert.notEqual(b.family,'shopping-row');}
assert.ok(block.layers.wegdeel.some(f=>f.geometry.coordinates.flat(2).some(p=>p[0]<block.bounds[0]||p[0]>block.bounds[2]||p[1]<block.bounds[1]||p[1]>block.bounds[3])),'full BGT geometry retained outside rendering bounds');
const result=await run(process.execPath,['--import','tsx','scripts/da-costa-block/prepare-neighbourhood.ts','--area-config='+config,'--inventory','--limit=1000'],{maxBuffer:8*1024*1024});
const inventory=JSON.parse(result.stdout);
assert.ok(inventory.candidateFrontages>0);assert.equal(inventory.downloads,0);assert.equal(inventory.paidCalls,0);
assert.equal(inventory.areaConfigHash,area.configHash);assert.equal(new Set(inventory.records.map(r=>r.id)).size,inventory.records.length);
assert.ok(inventory.records.some(r=>!['Da Costakade','Da Costastraat','De Clercqstraat','Nassaukade'].includes(r.street)),'generic selection does not whitelist study streets');
assert.ok(!await fs.stat(`.cache/city-appearance/areas/${area.id}/evidence`).catch(()=>null),'inventory must not create evidence directories');
await fs.writeFile(path.join(raw,'acquisition.json'),JSON.stringify({...acquisition,areaConfigHash:'stale'}));
await assert.rejects(run(process.execPath,['--import','tsx','scripts/da-costa-block/compile.mjs','--area-config='+config]),/config hash mismatch/);
console.log(JSON.stringify({passed:true,buildings:block.buildings.length,genericCandidateFrontages:inventory.candidateFrontages,selectedFacadeLengthM:inventory.selectedFacadeLengthM,staging:dir}));
