import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { selectCompatibleSourceRoof, sourceRoofUpAboveGroundNAP, SOURCE_ROOF_SCENE_TO_NAP_OFFSET_M, SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M, SOURCE_ROOF_MIN_EAVE_RATIO, SOURCE_ROOF_MIN_RELIEF_M, SOURCE_ROOF_SELECTION_POLICY } from '../src/canalRecall/cityAppearanceRoofs.js';

const surface=(low:number,high:number)=>({type:'roof',rings:[[[0,low,0],[0,low,2],[2,high,2],[2,high,0],[0,low,0]]]});
const fixture={roofType:'slanted',groundNAP:1,height:10,surfaces:[surface(7.5,11.5),surface(2,4),surface(8,13.4),surface(8,8.2)]},before=JSON.stringify(fixture);
const selected=selectCompatibleSourceRoof(fixture as any);
assert.equal(SOURCE_ROOF_SELECTION_POLICY,'per-source-surface-compatible-v3-nap-corrected');
assert.equal(SOURCE_ROOF_SCENE_TO_NAP_OFFSET_M,0.65);
assert.equal(sourceRoofUpAboveGroundNAP(7.5,1),7.15,'scene-local source height is raised to NAP before subtracting ground NAP');
assert.equal(selected?.surfaces.length,1,'valid main roof survives low annex, newly over-height ridge and near-flat component');
assert.equal(selected?.eaves,7.15,'published height is ground-relative NAP after the explicit scene-to-NAP correction');
assert.equal(Math.min(...selected!.surfaces[0][0].map(point=>point[2])),7.15,'published eave carries the corrected datum');
assert.equal(Math.max(...selected!.surfaces[0][0].map(point=>point[2])),11.15,'published ridge carries the same correction');
assert.ok(13.4-1<=10+SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M,'the high fixture passes the old uncorrected ridge gate');
assert.ok(sourceRoofUpAboveGroundNAP(13.4,1)>10+SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M,'the same component is withheld after correcting the datum');
assert.equal(JSON.stringify(fixture),before,'roof selection never mutates canonical 3DBAG geometry');
assert.equal(selectCompatibleSourceRoof({...fixture,roofType:'horizontal'} as any),null);
assert.equal(selectCompatibleSourceRoof({...fixture,groundNAP:null} as any),null);

const manifest=JSON.parse(await fs.readFile('public/data/city-expansion/current.json','utf8')),realBuildings=[];
assert.equal(manifest.studyRoofs.selectionPolicy,SOURCE_ROOF_SELECTION_POLICY,'study-roof policy version matches the compiler that generated the release');
if(manifest.sourceHashes.block==='e7a51599312c472206b3f4e202f9196166aae1584b579df1ba26f43a46cbbfa7'){
  assert.deepEqual({buildings:manifest.studyRoofs.buildings,surfaces:manifest.studyRoofs.surfaces,withheld:manifest.studyRoofs.withheldSlantedBuildings,tiles:manifest.studyRoofs.tiles.length},
    {buildings:6036,surfaces:19973,withheld:626,tiles:26},'Da Costa–Jordaan v3 datum regeneration stays pinned to its source block');
}
for(const tile of manifest.tiles){const payload=JSON.parse(gunzipSync(await fs.readFile(`public${tile.url}`)).toString());for(const owner of payload.owners)realBuildings.push(owner.geometry.building);}
assert.equal(realBuildings.length,manifest.buildings);assert.equal(new Set(realBuildings.map(building=>building.id)).size,manifest.buildings,'published owner tiles contain each source building once');
let buildings=0,surfaces=0;
for(const building of realBuildings){const roof=selectCompatibleSourceRoof(building);if(!roof)continue;buildings++;surfaces+=roof.surfaces.length;for(const polygon of roof.surfaces){const heights=polygon.flat().map(point=>point[2]),eaves=Math.min(...heights),ridge=Math.max(...heights);assert.ok(eaves>=building.height*SOURCE_ROOF_MIN_EAVE_RATIO);assert.ok(ridge<=building.height+SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M);assert.ok(ridge>eaves+SOURCE_ROOF_MIN_RELIEF_M);}}
assert.deepEqual({buildings,surfaces},{buildings:manifest.studyRoofs.buildings,surfaces:manifest.studyRoofs.surfaces},'source-compatible roof coverage matches the immutable release');
console.log(`Source roof compiler: ${surfaces} compatible LoD2.2 surfaces across ${buildings} buildings; per-component gates and immutability passed.`);
