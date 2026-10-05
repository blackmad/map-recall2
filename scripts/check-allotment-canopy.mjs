import assert from 'node:assert/strict';
import fs from 'node:fs';
import data from '../public/canal-drive/js/allotment-canopy-data.js';
import {isAllotmentCanopyPosition,scopeAllotmentCrown} from '../public/canal-drive/js/allotment-canopy.js';
import {treeTypology} from '../public/canal-drive/da-costa-block/tree-typology.js';
const mapped=JSON.parse(fs.readFileSync('artifacts/sloterdijkermeer-review/tree-coverage-audit.json')).flatMap(p=>p.trees);
const distance=(a,b)=>Math.hypot((a.lng-b.lng)*111320*Math.cos(a.lat*Math.PI/180),(a.lat-b.lat)*110540);
assert.equal(mapped.length,1003);assert.equal(new Set(data.trees.map(t=>t.id)).size,data.trees.length);
for(const [i,t] of data.trees.entries()){
 assert.ok(t.source==='allotment-prior'&&t.id.startsWith('allotment-canopy:'));
 assert.ok(isAllotmentCanopyPosition(t));assert.ok(t.height>=8&&t.height<=13);
 assert.ok(!mapped.some(m=>distance(t,m)<4.499));assert.ok(!data.trees.slice(0,i).some(m=>distance(t,m)<4.999));
 const native=treeTypology({...t,position:[0,0]}),derived=scopeAllotmentCrown(t,native);assert.equal(derived.height,t.height);assert.match(derived.provenance.position,/authored/);assert.match(derived.provenance.height,/approximate/);
}
const original=JSON.stringify(mapped);
for(const t of mapped){const native=treeTypology({...t,position:[0,0]}),derived=scopeAllotmentCrown(t,native);assert.equal(derived.height,native.height);assert.equal(derived.archetype,native.archetype);assert.equal(derived.provenance.position,native.provenance.position);}
assert.equal(JSON.stringify(mapped),original,'mapped source records unchanged');
const outside={id:'outside',lng:4.9,lat:52.37,height:12,source:'osm'},native=treeTypology({...outside,position:[0,0]});assert.equal(scopeAllotmentCrown(outside,native),native,'no transfer outside the two parks');
console.log(JSON.stringify({mappedTrees:mapped.length,approximatePrivateTrees:data.trees.length,scopedProvenanceAndSpacing:true}));
