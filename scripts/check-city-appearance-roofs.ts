import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { selectCompatibleSourceRoof, SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M, SOURCE_ROOF_MIN_EAVE_RATIO, SOURCE_ROOF_MIN_RELIEF_M, SOURCE_ROOF_SELECTION_POLICY } from '../src/canalRecall/cityAppearanceRoofs.js';

const surface=(low:number,high:number)=>({type:'roof',rings:[[[0,low,0],[0,low,2],[2,high,2],[2,high,0],[0,low,0]]]});
const fixture={roofType:'slanted',groundNAP:1,height:10,surfaces:[surface(7.5,11.5),surface(2,4),surface(7,14.1),surface(8,8.2)]},before=JSON.stringify(fixture);
const selected=selectCompatibleSourceRoof(fixture as any);
assert.equal(SOURCE_ROOF_SELECTION_POLICY,'per-source-surface-compatible-v2');
assert.equal(selected?.surfaces.length,1,'valid main roof survives low annex, high outlier and near-flat component');
assert.equal(selected?.eaves,6.5,'published height is explicitly relative to source ground NAP');
assert.equal(JSON.stringify(fixture),before,'roof selection never mutates canonical 3DBAG geometry');
assert.equal(selectCompatibleSourceRoof({...fixture,roofType:'horizontal'} as any),null);
assert.equal(selectCompatibleSourceRoof({...fixture,groundNAP:null} as any),null);

const manifest=JSON.parse(await fs.readFile('public/data/city-expansion/current.json','utf8')),realBuildings=[];
for(const tile of manifest.tiles){const payload=JSON.parse(gunzipSync(await fs.readFile(`public${tile.url}`)).toString());for(const owner of payload.owners)realBuildings.push(owner.geometry.building);}
assert.equal(realBuildings.length,825);assert.equal(new Set(realBuildings.map(building=>building.id)).size,825,'published owner tiles contain each source building once');
let buildings=0,surfaces=0;
for(const building of realBuildings){const roof=selectCompatibleSourceRoof(building);if(!roof)continue;buildings++;surfaces+=roof.surfaces.length;for(const polygon of roof.surfaces){const heights=polygon.flat().map(point=>point[2]),eaves=Math.min(...heights),ridge=Math.max(...heights);assert.ok(eaves>=building.height*SOURCE_ROOF_MIN_EAVE_RATIO);assert.ok(ridge<=building.height+SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M);assert.ok(ridge>eaves+SOURCE_ROOF_MIN_RELIEF_M);}}
assert.deepEqual({buildings,surfaces},{buildings:645,surfaces:1717},'real-area coverage is deterministic');
console.log(`Source roof compiler: ${surfaces} compatible LoD2.2 surfaces across ${buildings} buildings; per-component gates and immutability passed.`);
