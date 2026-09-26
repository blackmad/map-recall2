import assert from 'node:assert/strict';
import { ShapeUtils, Vector2 } from 'three';
import { photoToRecipe, type PhotoRecord } from '../src/canalRecall/facade/photoRecipe.ts';
import { compileRecipe, type Triangulate } from '../src/canalRecall/facade/recipe.ts';

const triangulate: Triangulate = (o, h) => ShapeUtils.triangulateShape(o.map(p => new Vector2(...p)), h.map(r => r.map(p => new Vector2(...p))));
const record: PhotoRecord = {
  id: 'test', sourceSha256: 'a'.repeat(64), source: { address: 'Test', pandId: '0363100012164991', panoramaId: 'pano', capturedAt: '2023-03-06' },
  width: 106, height: 200, registration: 'unreviewed', status: 'proposed',
  frame: { metresPerPixelX: 0.1, metresPerPixelY: 0.1, leftM: -0.3, topM: 19.2, wallWidthM: 10, note: 'Test metric frame' },
  openings: [{ id: 'a', kind: 'window', box: [13, 20, 23, 40], state: 'proposed', reasons: [] }],
};
const h = 'b'.repeat(64), first = await photoToRecipe(record, h);
const opening = first.recipe.elevations[0].openings.value[0];
assert.deepEqual(opening, { id: 'a', kind: 'window', leftM: 1, bottomM: 16, widthM: 1, heightM: 2 });
assert.deepEqual(first.recipe.aliases, [], 'Unreviewed image labels must not suppress real BAG buildings');
assert.match(first.recipe.buildingId, /^fixture:photo-/);
assert.equal(first.recipe.identity.state, 'proposed');
assert.match(first.recipe.identity.note, /Unreviewed source label/);
assert.equal(first.recipe.elevations[0].openings.state, 'proposed');
const fitted = structuredClone(record);
fitted.openings[0].basis='inferred';
fitted.openings[0].fit={applied:true,rawBox:[12,20,23,40],candidateBox:[13,20,23,40]};
assert.equal((await photoToRecipe(fitted,h)).recipe.elevations[0].openings.basis,'inferred','Fitting must not promote inferred positions to observed evidence');
const registered = structuredClone(record); registered.registration='reviewed-development';
const registeredRecipe=await photoToRecipe(registered,h);
assert.match(registeredRecipe.recipe.identity.note,/Development-reviewed panorama registration/);
assert.match(registeredRecipe.recipe.simplifications.at(-1)!,/camera mapping come from/);
assert.doesNotMatch(registeredRecipe.recipe.identity.note,/Unreviewed source label/);
const asset = await compileRecipe(first.recipe, triangulate);
assert.equal(asset.disposition, 'diagnostic-only');
const cropped = structuredClone(record); cropped.visibleRows = [10, 180];
const crop = await photoToRecipe(cropped, h);
assert.equal(crop.recipe.wallTopM.value, 17);
assert.equal(crop.recipe.elevations[0].openings.value[0].bottomM, 14, 'Pixel crop shifts local origin without inventing NAP ground');
const overlap = structuredClone(record);
overlap.openings.push({ ...record.openings[0], id: 'overlap' });
assert.equal((await photoToRecipe(overlap, h)).omitted[0].id, 'overlap');
const margin = structuredClone(record); margin.openings[0].box = [0, 20, 10, 40];
assert.match((await photoToRecipe(margin, h)).omitted[0].reason, /Outside/);
const rejected = structuredClone(record); rejected.openings[0].state = 'rejected';
assert.equal((await photoToRecipe(rejected, h)).included.length, 0);
for (const status of ['rejected', 'needs-review'] as const) await assert.rejects(() => photoToRecipe({ ...record, status }, h));
for (const box of [[23, 20, 13, 40], [13, -1, 23, 40], [13, 20, 200, 40], [13, NaN, 23, 40]]) {
  const invalid = structuredClone(record); invalid.openings[0].box = box as [number, number, number, number];
  await assert.rejects(() => photoToRecipe(invalid, h), /Invalid pixel box/);
}
const changed = structuredClone(record); changed.openings[0].box[2] += 2;
const second = await photoToRecipe(changed, h);
assert.notEqual(first.revisionHash, second.revisionHash);
assert.notEqual(asset.meshHash, (await compileRecipe(second.recipe, triangulate)).meshHash);
assert.notEqual(first.revisionHash, (await photoToRecipe(record, 'c'.repeat(64))).revisionHash);
assert.notEqual(first.revisionHash, (await photoToRecipe({ ...record, sourceSha256: 'd'.repeat(64) }, h)).revisionHash);
assert.equal(first.revisionHash, (await photoToRecipe(structuredClone(record), h)).revisionHash);
const detailed = structuredClone(record);
detailed.openings[0].appearance = {
  boundBox: [...detailed.openings[0].box], trimColour: {hex:'#ffffff'}, glassColour:{hex:'#123456'},
  bars: [{axis:'horizontal',fraction:.3,sourceLine:[13,26,23,26],colour:{hex:'#223344'},basis:'observed',state:'proposed'}],
  style:{value:null,basis:'unknown',state:'proposed',confidence:null},note:'Independent line coordinate fixture',unknown:['mechanism'],
};
const detailRecipe = await photoToRecipe(detailed,h);
assert.deepEqual(detailRecipe.recipe.elevations[0].openings.value[0].appearance?.value.horizontalBars,[.7], 'Photo y down becomes local height up');
const detailMesh = await compileRecipe(detailRecipe.recipe,triangulate);
assert.equal(detailMesh.triangleCount,asset.triangleCount+2,'One measured bar adds two triangles');
assert.ok(detailMesh.meshes.every(m=>m.colours.length===m.positions.length),'Merged meshes retain a colour for every vertex');
const withoutDetails = await photoToRecipe(detailed,h,{details:false});
assert.equal(withoutDetails.recipe.elevations[0].openings.value[0].appearance,undefined);
const movedBox=structuredClone(detailed); movedBox.openings[0].box[0]++;
const stale=await photoToRecipe(movedBox,h);
assert.deepEqual(stale.staleDetails,['a']);
assert.equal(stale.recipe.elevations[0].openings.value[0].appearance,undefined,'Moving a box cannot reuse measured bars');
const omittedBar=structuredClone(detailed); omittedBar.openings[0].appearance!.bars[0].state='rejected';
assert.deepEqual((await photoToRecipe(omittedBar,h)).recipe.elevations[0].openings.value[0].appearance?.value.horizontalBars,[]);
const door=structuredClone(detailed); door.openings[0].kind='door'; door.openings[0].appearance!.glassColour=null;
door.openings[0].appearance!.panelColour={hex:'#8b2017'};
assert.equal((await photoToRecipe(door,h)).recipe.elevations[0].openings.value[0].appearance?.value.glassColour,'#8b2017',
  'Door panel evidence colours the door without calling it glazing');
const badDetail=structuredClone(detailRecipe.recipe);
badDetail.elevations[0].openings.value[0].appearance!.value.horizontalBars=[-.1];
await assert.rejects(()=>compileRecipe(badDetail,triangulate),/appearance/);
console.log('Photo recipe: metric border/origin, evidence lineage, omissions, invalid boxes, rejection and deterministic compilation passed.');
