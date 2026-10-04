import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {treeTypology,normalizedTreeName} from '../public/canal-drive/da-costa-block/tree-typology.js';
const source=execFileSync('git',['show','354f6ee204d5b84ec0639ca1b0aca24ad10fe659:public/canal-drive/da-costa-block/tree-typology.js'],{encoding:'utf8'});
const old=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).treeTypology;
const targets=new Map([["alnus spaethii","pyramidal"],["gleditsia triacanthos","airy-oval"],["gleditsia triacanthos 'inermis'","airy-oval"],["gleditsia triacanthos 'skyline'","pyramidal"],["ilex aquifolium","upright-oval"],["tilia cordata 'greenspire'","upright-oval"]]);
const fixture={id:'fixture',position:[4.9,52.37],height:15,heightClass:'15m',type:'Boom'};
for(const [species,shape] of targets){assert.equal(treeTypology({...fixture,species}).archetype,shape);for(const type of ['Knotboom','Leiboom','Gekandelaberde boom'])assert.deepEqual(treeTypology({...fixture,species,type}),old({...fixture,species,type}));assert.deepEqual(treeTypology({...fixture,species:species+' cv.'}),old({...fixture,species:species+' cv.'}));}
const root='public/data/extracts/amsterdam/municipal-trees/',index=JSON.parse(fs.readFileSync(root+'index.json'));
let checked=0,crownChanged=0,prunedCrownsPreserved=0;const counts={};
for(const tile of index.tiles)for(const r of JSON.parse(gunzipSync(fs.readFileSync(root+tile.url))).trees){
 const tree={...r,position:[r.lng,r.lat]},a=treeTypology(tree),b=old(tree),name=normalizedTreeName(r.species);checked++;
 if(a.provenance.crownBasis==='explicit-inventory-management'){if(targets.has(name))prunedCrownsPreserved++;assert.deepEqual(a,b);continue;}
 if(targets.has(name)){assert.equal(a.archetype,targets.get(name));assert.ok(a.provenance.reference);assert.notDeepEqual(a.lobes,b.lobes);crownChanged++;counts[name]=(counts[name]||0)+1;assert.deepEqual({...a,archetype:b.archetype,lobes:b.lobes,provenance:{...a.provenance,crownBasis:b.provenance.crownBasis,reference:b.provenance.reference}},b);}
 else if(["betula nigra", "acer saccharinum", "ailanthus altissima", "liriodendron tulipifera"].includes(name))assert.deepEqual({...a,archetype:b.archetype,lobes:b.lobes,provenance:{...a.provenance,crownBasis:b.provenance.crownBasis,reference:b.provenance.reference}},b,'subsequent approved spreading species only');
 else if(["tilia europaea 'koningslinde'", "ulmus hollandica 'belgica'", "ulmus laevis", "fraxinus excelsior 'atlas'", "fraxinus angustifolia"].includes(name))assert.deepEqual({...a,archetype:b.archetype,lobes:b.lobes,provenance:{...a.provenance,crownBasis:b.provenance.crownBasis,reference:b.provenance.reference}},b,'subsequent approved elm/ash/lime priors only');
 else assert.deepEqual(a,b,'unmatched model remains unchanged');
}
assert.equal(checked,311544);assert.equal(crownChanged,4968);assert.equal(prunedCrownsPreserved,10);
console.log(JSON.stringify({checked,crownChanged,prunedCrownsPreserved,counts}));
