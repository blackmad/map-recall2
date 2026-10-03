import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {treeTypology} from '../public/canal-drive/da-costa-block/tree-typology.js';
import {municipalGrid,nearMunicipal,inBoundary,sourceFiles,buildOsmSupplement} from './osm-tree-supplement.mjs';
const root='public/data/extracts/amsterdam/municipal-trees';
const index=JSON.parse(fs.readFileSync(`${root}/index.json`));
const ids=new Set(),shapes={},municipal=[],osm=[];let knownHeights=0;
assert.equal(index.zoom,15);assert.ok(index.trees>250000);
for(const tile of index.tiles){
  const file=fs.readFileSync(`${root}/${tile.url}`),data=JSON.parse(gunzipSync(file));
  assert.equal(file.length,tile.bytes);assert.equal(data.key,tile.key);assert.equal(data.trees.length,tile.trees);
  for(const t of data.trees){
    assert.ok(!ids.has(t.id));ids.add(t.id);
    if(t.id.startsWith('ams-'))municipal.push(t);
    else {assert.match(t.id,/^osm-n\d+$/);assert.equal(t.source,'osm');osm.push(t);}
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
assert.equal(municipal.length,index.sources.municipal.trees);
assert.equal(osm.length,index.sources.osm.trees);
assert.equal(index.sources.osm.licence,'ODbL');
assert.equal(index.sources.osm.treeRowsAdded,0);
const sources=sourceFiles(),grid=municipalGrid(municipal);
for(const t of osm){
  assert.ok(inBoundary([t.lng,t.lat],sources.boundary.geometry),'supplement stays within Amsterdam');
  assert.ok(!nearMunicipal([t.lng,t.lat],grid),'municipal trunk takes priority within 12 metres');
  const p=treeTypology({...t,position:[0,0]});
  assert.equal(p.provenance.position,'explicit OSM tree node');
  assert.equal(p.provenance.height,t.height===null?'authored-height-fallback':'osm-recorded-height');
}
const expected=buildOsmSupplement(municipal,sources).trees;
assert.equal(expected.length,osm.length);
const actual=new Map(osm.map(t=>[t.id,t]));
for(const t of expected)assert.deepEqual(actual.get(t.id),t,'actual OSM identity, species and height preserved');
console.log(JSON.stringify({trees:ids.size,municipal:municipal.length,osm:osm.length,knownHeights,tiles:index.tiles.length,shapes},null,2));
