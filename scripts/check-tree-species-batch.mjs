import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from'node:zlib';import{execFileSync}from'node:child_process';
import{treeTypology,normalizedTreeName}from'../public/canal-drive/da-costa-block/tree-typology.js';
const oldSource=execFileSync('git',['show','041726e9:public/canal-drive/da-costa-block/tree-typology.js'],{encoding:'utf8'});
const old=(await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'))).treeTypology;
const targets=new Map([["ulmus hollandica 'commelin'",'upright-oval'],['quercus cerris','rounded'],["ulmus 'plantijn'",'vase'],['styphnolobium japonicum','domed'],['taxus baccata','irregular-spreading'],['pinus nigra','domed'],["prunus avium 'plena'",'rounded'],['acer platanoides','domed']]);
const fixture={id:'check',position:[0,0],height:15,heightClass:'15m',type:'Boom'};
for(const [species,archetype] of targets){const p=treeTypology({...fixture,species});assert.equal(p.archetype,archetype);assert.ok(p.provenance.reference);for(const type of ['Knotboom','Leiboom','Gekandelaberde boom'])assert.deepEqual(treeTypology({...fixture,species,type}),old({...fixture,species,type}));assert.equal(treeTypology({...fixture,species:species+' cv.'}).provenance.crownBasis,'authored-fallback');}
for(const species of ['',null,'Onbekend','Quercus','Pinus nigra subsp. nigra','Fraxinus excelsior cv.'])assert.deepEqual(treeTypology({...fixture,species}),old({...fixture,species}));
const root='public/data/extracts/amsterdam/municipal-trees/',index=JSON.parse(fs.readFileSync(root+'index.json'));let checked=0,matched=0,geometryChanged=0;const counts={};
for(const tile of index.tiles)for(const record of JSON.parse(gunzipSync(fs.readFileSync(root+tile.url))).trees){
 const tree={...record,position:[record.lng,record.lat]},a=treeTypology(tree),b=old(tree);checked++;
 if(!targets.has(normalizedTreeName(tree.species))||a.provenance.crownBasis==='explicit-inventory-management'){assert.deepEqual(a,b);continue;}
 matched++;counts[tree.species]=(counts[tree.species]||0)+1;if(JSON.stringify(a.lobes)!==JSON.stringify(b.lobes))geometryChanged++;
 const normalized={...a,archetype:b.archetype,lobes:b.lobes,provenance:{...a.provenance,crownBasis:b.provenance.crownBasis,reference:b.provenance.reference}};assert.deepEqual(normalized,b,'only crown selection and its reference change');
}
assert.equal(checked,311544);assert.equal(matched,9331);console.log(JSON.stringify({checked,matched,geometryChanged,counts}));
