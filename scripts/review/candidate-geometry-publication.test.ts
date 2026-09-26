import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {publishAreaGeometryDemo} from '../city-appearance/publish-area-geometry-demo.ts';
const pointer=await fs.readFile('public/data/city-expansion/current.json');
await assert.rejects(publishAreaGeometryDemo({candidateBlockPath:'unused',stageOnly:false,developmentCandidate:true}),/restricted to staged/);
await assert.rejects(publishAreaGeometryDemo({candidateBlockPath:'unused',stageOnly:true,developmentCandidate:false}),/restricted to staged/);
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'candidate-geometry-'));
try{
 const blockPath=path.join(temporary,'block.json');await fs.writeFile(blockPath,JSON.stringify({areaConfigHash:'fixture',origin:{x:1,y:2},buildings:[]}));
 await assert.rejects(publishAreaGeometryDemo({stageOnly:true,developmentCandidate:true,candidateBlockPath:blockPath,candidateBlockSha256:'0'.repeat(64),area:{id:'fixture',configHash:'fixture'},run:{state:{jobs:{compile:{output:{blockPath}}}}}}),/geometry hash mismatch/);
}finally{await fs.rm(temporary,{recursive:true,force:true});}
assert.deepEqual(await fs.readFile('public/data/city-expansion/current.json'),pointer);
console.log('Supplemental geometry rejects activation and corrupt hashes without changing current release.');
