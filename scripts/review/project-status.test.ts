import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectProjectStatus } from './project-status';
export async function runProjectStatusTests(){const root=await mkdtemp(path.join(os.tmpdir(),'project-status-'));try{await mkdir(path.join(root,'public/data/city-expansion'),{recursive:true});await writeFile(path.join(root,'public/data/city-expansion/current.json'),' {"releaseId":"active"}\n');const s=await collectProjectStatus(root);assert.equal(s.releases.active.releaseId,'active');assert.equal(s.artifacts.candidate.present,false);assert.ok(s.findings.some(x=>x.includes('candidate')));assert.equal(s.costs.accountedUsd,null);return 'project status tests passed';}finally{await rm(root,{recursive:true,force:true});}}
if(import.meta.url===`file://${process.argv[1]}`)runProjectStatusTests().then(console.log);
