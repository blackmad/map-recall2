import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { selectCompatibleSourceRoof, sourceRoofUpAboveGroundNAP, SOURCE_ROOF_SCENE_TO_NAP_OFFSET_M, SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M, SOURCE_ROOF_MIN_CLEARANCE_ABOVE_LOD1_M, SOURCE_ROOF_MIN_RELIEF_M, SOURCE_ROOF_SELECTION_POLICY } from '../src/canalRecall/cityAppearanceRoofs.js';

const surface=(low:number,high:number)=>({type:'roof',rings:[[[0,low,0],[0,low,2],[2,high,2],[2,high,0],[0,low,0]]]});
const fixture={roofType:'slanted',groundNAP:1,height:10,surfaces:[surface(10.35,12),surface(2,4),surface(10.5,13.4),surface(10.45,10.6)]},before=JSON.stringify(fixture);
const selected=selectCompatibleSourceRoof(fixture as any);
assert.equal(SOURCE_ROOF_SELECTION_POLICY,'whole-source-roof-above-uncut-lod1-v4-nap-corrected');
assert.equal(SOURCE_ROOF_SCENE_TO_NAP_OFFSET_M,0.65);
assert.equal(sourceRoofUpAboveGroundNAP(10.35,1),10,'scene-local source height is raised to NAP before subtracting ground NAP');
assert.equal(selected,null,'one low, over-height, or near-flat source component withholds the complete roof instead of publishing shards');
assert.ok(13.4-1<=10+SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M,'the high fixture passes the old uncorrected ridge gate');
assert.ok(sourceRoofUpAboveGroundNAP(13.4,1)>10+SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M,'the same component is withheld after correcting the datum');
assert.equal(JSON.stringify(fixture),before,'roof selection never mutates canonical 3DBAG geometry');
assert.equal(selectCompatibleSourceRoof({...fixture,roofType:'horizontal'} as any),null);
assert.equal(selectCompatibleSourceRoof({...fixture,groundNAP:null} as any),null);

const complete={roofType:'slanted',groundNAP:1,height:10,surfaces:[surface(10.35,11.7),surface(10.4,11.8)]};
const completeRoof=selectCompatibleSourceRoof(complete as any);
assert.equal(completeRoof?.surfaces.length,2,'every source roof component is retained together once the full set clears the LoD1 top');
assert.equal(completeRoof?.eaves,10,'the lowest admitted source eave sits at the uncut LoD1 height before the renderer safety lift');
for (const malformed of [
  { ...complete, surfaces: [{ type:'roof', rings:[[[0,10.35,0],[0,Number.NaN,2],[2,11.7,2]]] }] },
  { ...complete, surfaces: [{ type:'roof', rings:[] }] },
  { ...complete, surfaces: [{ type:'roof', rings:[[[0,10.35,0],[2,11.7,2]]] }] },
]) assert.equal(selectCompatibleSourceRoof(malformed as any),null,'non-finite, empty, and short source roof rings are withheld before numeric admission');

const manifest=JSON.parse(await fs.readFile('public/data/city-expansion/current.json','utf8')),realBuildings=[];
assert.equal(manifest.studyRoofs.selectionPolicy,SOURCE_ROOF_SELECTION_POLICY,'study-roof policy version matches the compiler that generated the release');
if(manifest.sourceHashes.block==='e7a51599312c472206b3f4e202f9196166aae1584b579df1ba26f43a46cbbfa7') assert.deepEqual([manifest.studyRoofs.buildings,manifest.studyRoofs.surfaces,manifest.studyRoofs.withheldSlantedBuildings,manifest.studyRoofs.tiles.length],[1,1,6661,1],'Da Costa–Jordaan v4 withholds intersecting source roofs instead of rendering shards');
for(const tile of manifest.tiles){const payload=JSON.parse(gunzipSync(await fs.readFile(`public${tile.url}`)).toString());for(const owner of payload.owners)realBuildings.push(owner.geometry.building);}
assert.equal(realBuildings.length,manifest.buildings);assert.equal(new Set(realBuildings.map(building=>building.id)).size,manifest.buildings,'published owner tiles contain each source building once');
let buildings=0,surfaces=0;
for(const building of realBuildings){const roof=selectCompatibleSourceRoof(building);if(!roof)continue;buildings++;surfaces+=roof.surfaces.length;const heights=roof.surfaces.flat(2).map(point=>point[2]),eaves=Math.min(...heights),ridge=Math.max(...heights);assert.ok(eaves>=building.height+SOURCE_ROOF_MIN_CLEARANCE_ABOVE_LOD1_M,'an admitted roof never intersects the uncut LoD1 top');assert.ok(ridge<=building.height+SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M);assert.ok(ridge>eaves+SOURCE_ROOF_MIN_RELIEF_M);assert.equal(roof.surfaces.length,(building.surfaces??[]).filter((surface:any)=>surface.type==='roof').length,'admission is all-or-nothing across source roof components');}
assert.deepEqual({buildings,surfaces},{buildings:manifest.studyRoofs.buildings,surfaces:manifest.studyRoofs.surfaces},'source-compatible roof coverage matches the immutable release');
console.log(`Source roof compiler: ${surfaces} whole-source LoD2.2 roof surfaces across ${buildings} buildings; uncut-LoD1 clearance and immutability passed.`);
