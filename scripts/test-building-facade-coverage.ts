import assert from 'node:assert/strict';
import fs from 'node:fs';
import {facadeCoverage} from './buildingFacadeCoverage.ts';
const real=JSON.parse(fs.readFileSync('artifacts/building-batch-scale-200/recipes/bag-0363100012176384.recipe.json','utf8'));
const before=JSON.stringify(real),coverage=facadeCoverage(real);
assert.equal(coverage.status,'partial-frontage-suspected');
assert.equal(coverage.uncoveredStreetWalls.find((w:any)=>w.surfaceIndex===20)?.scope,'low-extension');
assert.equal(coverage.uncoveredStreetWalls.find((w:any)=>w.surfaceIndex===24)?.scope,'upper-wall');
assert.equal(JSON.stringify(real),before);
function recipe(span:number,angle:number,offset:number,top=8){
 const end=offset+span*Math.tan(angle*Math.PI/180);
 return {frontages:[{width:4}],footprint:[[0,0],[4+span,0],[4+span,8],[0,8]],sourceShell:{surfaces:[{type:'wall',rings:[[[4,offset,0],[4+span,end,0],[4+span,end,top],[4,offset,top]]]}]}};
}
for(const span of [1.1,2,4]){
 assert.equal(facadeCoverage(recipe(span,7,-.3)).status,'partial-frontage-suspected');
 assert.equal(facadeCoverage(recipe(span,40,-.3)).status,'no-partial-frontage-signal');
 assert.equal(facadeCoverage(recipe(span,0,7)).status,'no-partial-frontage-signal');
 assert.equal(facadeCoverage(recipe(span,0,-.7,2)).uncoveredStreetWalls[0].scope,'low-extension');
}
console.log('Coverage contracts passed: real offset upper/low walls, width-independent angle, party/rear exclusion and immutable input.');
