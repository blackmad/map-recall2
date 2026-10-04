import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {treeTypology,normalizedTreeName} from '../public/canal-drive/da-costa-block/tree-typology.js';
const source=execFileSync('git',['show','ce56ef9f:public/canal-drive/da-costa-block/tree-typology.js'],{encoding:'utf8'});
const old=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).treeTypology;
const targets=new Map([["alnus spaethii 'spaeth'",'pyramidal'],["quercus robur 'fastigiate koster'",'columnar'],["prunus serrulata 'amanogawa'",'columnar'],["betula utilis 'doorenbos'",'upright-oval'],['alnus incana','upright-oval'],["ilex aquifolium 'j.c. van tol'",'upright-oval']]);
const fixture={id:'fixture',position:[4.9,52.37],height:15,heightClass:'15m',type:'Boom'};
for(const [species,shape] of targets){assert.equal(treeTypology({...fixture,species}).archetype,shape);for(const type of ['Knotboom','Leiboom','Gekandelaberde boom'])assert.deepEqual(treeTypology({...fixture,species,type}),old({...fixture,species,type}));assert.deepEqual(treeTypology({...fixture,species:species+' cv.'}),old({...fixture,species:species+' cv.'}));}
assert.equal(treeTypology({...fixture,species:'Betula nigra'}).bark,'#805b46');
for(const type of ['Knotboom','Leiboom','Gekandelaberde boom'])assert.deepEqual(treeTypology({...fixture,species:'Betula nigra',type}),old({...fixture,species:'Betula nigra',type}),'pruned river birch retains bark and all model fields');
const root='public/data/extracts/amsterdam/municipal-trees/',index=JSON.parse(fs.readFileSync(root+'index.json'));
let checked=0,crownChanged=0,barkChanged=0,prunedCrownsPreserved=0,prunedRiverBirchPreserved=0;const counts={};
for(const tile of index.tiles)for(const r of JSON.parse(gunzipSync(fs.readFileSync(root+tile.url))).trees){
 const tree={...r,position:[r.lng,r.lat]},a=treeTypology(tree),b=old(tree),name=normalizedTreeName(r.species);checked++;
 if(a.provenance.crownBasis==='explicit-inventory-management'){if(targets.has(name))prunedCrownsPreserved++;if(name==='betula nigra')prunedRiverBirchPreserved++;assert.deepEqual(a,b);continue;}
 if(targets.has(name)){assert.equal(a.archetype,targets.get(name));assert.ok(a.provenance.reference);assert.notDeepEqual(a.lobes,b.lobes);crownChanged++;counts[name]=(counts[name]||0)+1;assert.deepEqual({...a,archetype:b.archetype,lobes:b.lobes,provenance:{...a.provenance,crownBasis:b.provenance.crownBasis,reference:b.provenance.reference}},b);}
 else if(name==='betula nigra'){barkChanged++;assert.equal(a.bark,'#805b46');assert.deepEqual({...a,bark:b.bark},b,'river birch only changes bark');}
 else assert.deepEqual(a,b,'unmatched model remains unchanged');
}
assert.equal(checked,311544);assert.equal(crownChanged,4673);assert.equal(barkChanged,789);assert.equal(prunedCrownsPreserved,28);assert.equal(prunedRiverBirchPreserved,1);
console.log(JSON.stringify({checked,crownChanged,barkChanged,prunedCrownsPreserved,prunedRiverBirchPreserved,counts}));
