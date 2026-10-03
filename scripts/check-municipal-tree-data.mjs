import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {treeTypology} from '../public/canal-drive/da-costa-block/tree-typology.js';
const root='public/data/extracts/amsterdam/municipal-trees';
const index=JSON.parse(fs.readFileSync(`${root}/index.json`));
const ids=new Set(),shapes={};let knownHeights=0;
assert.equal(index.zoom,15);assert.ok(index.trees>250000);
for(const tile of index.tiles){
  const file=fs.readFileSync(`${root}/${tile.url}`),data=JSON.parse(gunzipSync(file));
  assert.equal(file.length,tile.bytes);assert.equal(data.key,tile.key);assert.equal(data.trees.length,tile.trees);
  for(const t of data.trees){
    assert.ok(!ids.has(t.id));ids.add(t.id);
    assert.ok(t.lng>4.5&&t.lng<5.4&&t.lat>52.1&&t.lat<52.6);
    const x=Math.floor((t.lng+180)/360*32768),y=Math.floor((1-Math.asinh(Math.tan(t.lat*Math.PI/180))/Math.PI)/2*32768);
    assert.equal(`15/${x}/${y}`,tile.key,'tree must stream from its actual location');
    const p=treeTypology({...t,position:[0,0]});assert.ok(p,'standing inventory trees only');
    assert.equal(p.lobes.length,3);assert.ok(p.height>=1&&p.height<=60);
    if(t.height!==null){assert.equal(p.height,t.height);knownHeights++;}
    for(const l of p.lobes){assert.ok([...l.offset,...l.scale].every(Number.isFinite));assert.ok(l.scale.every(v=>v>0));assert.ok(l.offset[1]+l.scale[1]<=p.height+1e-8);}
    shapes[p.archetype]=(shapes[p.archetype]||0)+1;
  }
}
assert.equal(ids.size,index.trees);
console.log(JSON.stringify({trees:ids.size,knownHeights,tiles:index.tiles.length,shapes},null,2));
