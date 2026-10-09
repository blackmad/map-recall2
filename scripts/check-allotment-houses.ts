import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { allotmentPark, footprintArea, footprintsOverlap, type SourceFeature } from './allotment-house-source.js';
import type { FootprintGeometry, Ring } from '../src/canalRecall/buildingGeometry.js';

const rectangle = (x: number, y: number, w: number, h: number): Ring => [[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
const geometry = (ring: Ring): FootprintGeometry => ({ type: 'Polygon', coordinates: [ring] });
const court: FootprintGeometry = { type: 'Polygon', coordinates: [rectangle(0,0,10,10),rectangle(2,2,6,6)] };
assert(!footprintsOverlap(court, geometry(rectangle(3,3,1,1))), 'Courtyard remains empty');
assert(footprintsOverlap(court, geometry(rectangle(1,3,2,1))), 'House crossing courtyard wall overlaps');
assert(footprintsOverlap(geometry(rectangle(0,0,10,1)), geometry(rectangle(4,-3,1,7))), 'Crossing footprints detected without centroid ownership');
assert(!footprintsOverlap(geometry(rectangle(0,0,1,1)), geometry(rectangle(2,0,1,1))), 'Disjoint neighbors retained');

const report = JSON.parse(await readFile('artifacts/sloterdijkermeer-review/source-report.json','utf8'));
const source = JSON.parse(await readFile('artifacts/sloterdijkermeer-review/mapped-houses.geojson','utf8')).features as SourceFeature[];
const byId = new Map(source.map(f => [f.properties.id, f]));
const counts: Record<string,number> = {};
let retained = 0, added = 0;
for (const change of report.changes) {
  const file = `public/data/extracts/amsterdam/building-tiles/${change.tile}.geojson.gz`;
  const current = JSON.parse(gunzipSync(await readFile(file)).toString()).features as SourceFeature[];
  const previous = current.filter(f => !byId.has(f.properties.id));
  assert.equal(previous.length, change.originalFeaturesCount, 'Original neighbor count retained');
  assert.equal(createHash('sha256').update(JSON.stringify(previous)).digest('hex'), change.originalFeaturesSha256, 'Original geometry and properties retained exactly');
  const priorIds = new Set(previous.map(f=>f.properties.id));
  for (const f of previous) {
    assert.deepEqual(current.find(e=>e.properties.id===f.properties.id), f, `Installed ${f.properties.id} preserved exactly`); retained++;
  }
  for (const f of current.filter(e=>!priorIds.has(e.properties.id))) {
    assert.equal(f.properties.allotmentHouse, 'garden-house-v1');
    assert.equal(f.properties.heightSource, 'approximate-allotment-prior');
    assert.equal(f.properties.height, 3.4); assert.equal(f.properties.roofEavesHeightM,2.4);
    assert(allotmentPark(f), 'House wholly within source park, with eligible area');
    assert(footprintArea(f.geometry)>=6 && footprintArea(f.geometry)<=70);
    assert.deepEqual(f.geometry, byId.get(f.properties.id)!.geometry, 'Mapped footprint retained');
    assert(!previous.some(e=>footprintsOverlap(f.geometry,e.geometry)), 'No overlap with installed geometry');
    counts[String(f.properties.allotmentPark)] = (counts[String(f.properties.allotmentPark)]??0)+1; added++;
  }
}
assert.equal(added,report.added);
// Rebuild a bounded temporary city through both real compiler stages. A broad
// BAG bounding box encloses the house, while actual BAG geometry leaves it free.
const temporary = await mkdtemp(path.join(os.tmpdir(),'allotment-regeneration-'));
const staging = path.join(temporary,'public/data/extracts/amsterdam/staging');
await mkdir(staging,{recursive:true});
const house = source[0];
assert(!allotmentPark({...house,properties:{building:'greenhouse'}}),'Semantic greenhouses excluded');
const housePolygon = house.geometry.type==='Polygon' ? house.geometry.coordinates : house.geometry.coordinates[0];
assert(!allotmentPark({...house,geometry:{type:'Polygon',coordinates:[housePolygon[0],housePolygon[0]]}}),'Courtyard assemblies excluded from bounded house treatment');
assert(!allotmentPark({...house,geometry:geometry(rectangle(4.85,52.38,0.00005,0.00005))}),'Outside park excluded');
const bag = [
  { type:'Feature', properties:{bagId:'test-west',height:4}, geometry:geometry(rectangle(4.84,52.38,0.0001,0.0001)) },
  { type:'Feature', properties:{bagId:'test-east',height:4}, geometry:geometry(rectangle(4.87,52.40,0.0001,0.0001)) }
];
await writeFile(path.join(staging,'bag-buildings.geojson'),`{"type":"FeatureCollection","features":[\n${bag.map(f=>JSON.stringify(f)).join(',\n')}\n]}\n`);
await writeFile(path.join(staging,'buildings-osm.geojson'),JSON.stringify({type:'FeatureCollection',features:[
  {type:'Feature',geometry:house.geometry,properties:{osmId:house.properties.osmId,building:'yes',height:5}},
  {type:'Feature',geometry:geometry(rectangle(4.85,52.3845,0.00005,0.00005)),properties:{osmId:'test-outside-park',building:'yes',height:5}}
]}));
const run = (script:string):void => { execFileSync(process.execPath,['--import',path.resolve('node_modules/tsx/dist/loader.mjs'),path.resolve(script)],{cwd:temporary,stdio:'pipe'}); };
run('scripts/build-lod1-city.ts'); run('scripts/build-lod1-tiles.ts');
const merged = JSON.parse(await readFile(path.join(staging,'lod1-city.geojson'),'utf8')).features;
const regenerated = merged.find((f:SourceFeature)=>f.properties.osmId===house.properties.osmId);
assert.equal(regenerated.properties.allotmentHouse,'garden-house-v1','Scoped unnamed house survives rectangular BAG coverage');
assert.equal(regenerated.properties.heightSource,'approximate-allotment-prior');
assert(!merged.some((f:SourceFeature)=>f.properties.osmId==='test-outside-park'),'Ordinary unnamed buildings still suppressed outside scoped parks');
const index = JSON.parse(await readFile(path.join(staging,'building-tiles/index-z14.json'),'utf8'));
const wire:SourceFeature[]=[];
for(const key of index.tileList) wire.push(...JSON.parse(gunzipSync(await readFile(path.join(staging,'building-tiles',`${key}.geojson.gz`))).toString()).features);
assert.equal(wire.find(f=>f.properties.id===house.properties.osmId)!.properties.roofEavesHeightM,2.4,'Eaves marker survives wire trimming');
const result = { pass: true, originalFeaturesRetainedExactly: retained, sourceFootprintsAdded: added, parkCounts: counts, geometryChecks: ['hole exclusion','crossing-wall overlap','disjoint neighbors','mapped footprint equality','installed-property equality','compiler scoped admission','compiler marker propagation'], visualAcceptance: 'Recorded separately in independent-visual-review.json and game/report.json' };
await writeFile('artifacts/sloterdijkermeer-review/source-validation.json',`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result));
