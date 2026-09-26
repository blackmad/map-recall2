import assert from 'node:assert/strict';
import {mergeSupplementalBlock} from './prepare-supplemental-geometry.ts';
const datum={offsetNAP:.65,source:'fixture'};
const building=(id:string,x:number,y:number)=>({id,center:[x+1,y+1],footprint:{type:'Polygon',coordinates:[[[x,y],[x+2,y],[x+2,y+2],[x,y+2],[x,y]]]},surfaces:[{type:'wall',rings:[[[x,0,y],[x+2,0,y],[x+2,3,y],[x,3,y]]]}],groundNAP:.65,height:3});
const baseBuilding=building('base',0,0),base:any={origin:{x:100,y:200},verticalDatum:datum,buildings:[baseBuilding],stats:{buildings:1},sources:[]};
const source:any={origin:{x:110,y:220},verticalDatum:datum,buildings:[building('import',10,10),building('overlap',-10,20)]};
const merged=mergeSupplementalBlock(base,source,['import','overlap']);
assert.strictEqual(merged.block.buildings[0],baseBuilding,'base building object is retained without cloning or geometry replacement');
assert.equal(merged.imports.length,1,'one non-overlapping supplemental building imports');
assert.deepEqual(merged.imports[0].center,[21,-9],'supplemental center rebases into the base common frame');
assert.deepEqual(merged.imports[0].surfaces[0].rings[0][1],[22,0,-10],'wall coordinates retain height while rebasing east/south');
assert.equal(merged.rejected[0].reason,'different-id-physical-footprint-overlap','different IDs with the same physical footprint are rejected');
assert.deepEqual(base.buildings,[baseBuilding],'merge does not mutate the base block');
assert.throws(()=>mergeSupplementalBlock(base,{...source,verticalDatum:{offsetNAP:1}},['import']),/height datum mismatch/,'mixed vertical datum cannot enter candidate geometry');
console.log('Supplemental geometry merge: common-frame rebase, base preservation, overlap rejection and datum guard passed.');

// Integration regression: previous staging reports must never drive the next
// import set; staging twice used to alternate between 185 imports and zero.
const {prepareSupplementalGeometry}=await import('./prepare-supplemental-geometry.ts');
const first=await prepareSupplementalGeometry({reportPath:'/nonexistent/previous-output.json'});
const second=await prepareSupplementalGeometry({reportPath:'/another/nonexistent/output.json'});
assert.equal(first.importedOwners.length,185);
assert.equal(first.blockSha256,second.blockSha256);
assert.deepEqual(first.geometryBinding.importedOwnerIds,second.geometryBinding.importedOwnerIds);
console.log('Supplemental staging is repeatable without a previous output report.');
