/** Read-only byte audit of every active crop and every referenced original panorama. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='.cache/da-costa-neighbourhood';
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json')),aerial=JSON.parse(await fs.readFile(root+'/aerial.json'));
const sources=new Map();let crops=0;
function add(file,expected){assert.match(expected,/^[a-f0-9]{64}$/);if(sources.has(file))assert.equal(sources.get(file),expected,'same file must not claim two source hashes');sources.set(file,expected);}
for(const record of manifest.records)for(const image of Object.values(record.images)){
  assert.equal(path.basename(image.file),image.file);add(root+'/images/'+image.file,image.sha256);crops++;
  assert.equal(path.basename(image.panoramaId),image.panoramaId);add(root+'/panoramas/'+image.panoramaId+'.jpg',image.panoramaSha256);
}
for(const image of aerial.records.flatMap(r=>[r,r.context].filter(Boolean))){assert.equal(path.basename(image.file),image.file);add(root+'/images/'+image.file,image.sha256);crops++;}
for(const [file,expected]of sources){const actual=createHash('sha256').update(await fs.readFile(file)).digest('hex');assert.equal(actual,expected,'Source bytes changed: '+file);}
console.log(JSON.stringify({passed:true,frontages:manifest.records.length,buildings:aerial.records.length,crops,uniqueOriginalPanoramas:[...sources.keys()].filter(file=>file.includes('/panoramas/')).length,hashedFiles:sources.size,writes:0}));
