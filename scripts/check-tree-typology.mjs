import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {treeTypology,normalizedTreeName,TREE_TYPOLOGY_VERSION} from '../public/canal-drive/da-costa-block/tree-typology.js';
const fixture={id:1,position:[7,-3],height:13.5,heightClass:'12 tot 15 m.',type:'Boom niet vrij uitgroeiend'};
assert.equal(normalizedTreeName('Platanus ×hispanica ‘Tremonia’'),"platanus hispanica 'tremonia'");
assert.equal(treeTypology({...fixture,species:"Platanus x hispanica 'Tremonia'"}).archetype,'pyramidal');
assert.equal(treeTypology({...fixture,species:'Platanus hispanica'}).archetype,'rounded');
assert.equal(treeTypology({...fixture,species:"Ulmus 'Clusius'"}).archetype,'upright-oval');
assert.equal(treeTypology({...fixture,species:'Cupressocyparis leylandii'}).archetype,'conical-evergreen');
assert.equal(treeTypology({...fixture,species:"Prunus serrulata 'Kanzan'"}).archetype,'vase');
for(const species of [null,'Unknown sp.',"Ulmus 'Unverified Cultivar'",'Ulmus cv.'])assert.equal(treeTypology({...fixture,species}).provenance.crownBasis,'authored-fallback');
assert.equal(treeTypology({...fixture,type:'Gekandelaberde boom'}).archetype,'candelabra-pruned');
assert.notEqual(treeTypology(fixture).archetype,'candelabra-pruned','restricted growth is not evidence of pollarding');
assert.equal(treeTypology({...fixture,type:'Stobbe'}),null);
for(const height of [null,undefined,0,-1,NaN,Infinity,1000,'15']){
  const p=treeTypology({...fixture,height});assert.equal(p.height,9);assert.equal(p.provenance.height,'authored-height-fallback');
}
assert.equal(treeTypology({...fixture,height:6,heightClass:'a. tot 6 m.'}).height,6,'do not replace inventory estimate with botanical maturity height');
assert.equal(treeTypology({...fixture,heightClass:null}).provenance.height,'authored-height-fallback');

const data=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json')),original=JSON.stringify(data.trees);
const proxies=data.trees.map(treeTypology).filter(Boolean);
assert.equal(JSON.stringify(data.trees),original,'do not modify inventory records');
for(const [i,p] of proxies.entries()){
  const tree=data.trees[i];assert.deepEqual(p,treeTypology(tree),'deterministic');
  assert.deepEqual(p.position,tree.position);assert.equal(p.height,tree.height);
  assert.equal(p.lobes.length,3,'keep shared instance count bounded');
  const maxRadius=Math.max(1.3,p.height*.22)*1.13;
  for(const l of p.lobes){
    assert.ok([...l.offset,...l.scale].every(Number.isFinite));assert.ok(l.scale.every(n=>n>0));
    assert.ok(l.offset[1]+l.scale[1]<=p.height+1e-8,'crown does not exceed inventory height proxy');
    assert.ok(Math.abs(l.offset[0])+l.scale[0]<=maxRadius+1e-8,'no wider than prior scene envelope');
    assert.ok(Math.abs(l.offset[2])+l.scale[2]<=maxRadius+1e-8);
    assert.ok([0,1,2].includes(l.tone),'bounded material palette');
  }
}
const count=key=>proxies.reduce((a,p)=>{const v=key(p);a[v]=(a[v]||0)+1;return a;},{});
const report={version:TREE_TYPOLOGY_VERSION,at:new Date().toISOString(),trees:proxies.length,archetypes:count(p=>p.archetype),crownSources:count(p=>p.provenance.crownBasis),heightSources:count(p=>p.provenance.height),proxies};
await fs.writeFile('.cache/da-costa-neighbourhood/tree-typology-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,proxies:undefined},null,2));
console.log('Passed: species/cultivar fallbacks, explicit pruning only, missing heights, stump exclusion, preserved inventory, deterministic three-lobe palette and bounded crowns.');
