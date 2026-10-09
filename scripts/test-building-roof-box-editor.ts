/** Real offset upper-box edit: keep authored placement/windows when changing height. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {quickEdit} from './buildingBatchQuickEdits';
const r=JSON.parse(fs.readFileSync('artifacts/building-batch-scale-200/recipes/bag-0363100012243113.recipe.json','utf8'));
const c={id:r.id,width:r.frontages[0].width,eaves:r.roof.eaves,peak:r.roof.top,primaryTop:r.roof.top,ownedTop:r.roof.top,front:r.frontages[0],storeys:r.storeys,rowCount:2,provenance:r.massing.appearanceRoof.provenance,geometryRevision:r.geometryRevision,appearanceRoof:r.massing.appearanceRoof,details:r.details};
const s={rows:2,bays:4,groundTop:3.1,widthRatio:.65,heightRatio:.70,wallColour:r.materials.wallColour,groundColour:r.frontages[0].storefront.finishColour,form:'straight',groundPattern:'center-entry',atticWindow:false,priority:'ordinary',notes:'',roofShape:'flat-with-dormers',roofPeak:r.roof.top+.5,dormer:'roof-box'};
const before=structuredClone(c),edit=quickEdit(c,s,new Set(['roofPeak']));
assert.deepEqual(c,before);
const box=edit.recipe.details.appearanceDormers[0],original=r.details.appearanceDormers[0];
assert.equal(box.x,original.x);
assert.deepEqual(box.frontWindows,original.frontWindows);
assert.equal(box.baseZ,original.baseZ);
assert.ok(Math.abs(box.height-original.height-.5)<1e-8);
assert.deepEqual(edit.recipe.frontages[0].openingRows,r.frontages[0].openingRows);
assert.throws(()=>quickEdit(c,{...s,roofShape:'mansard'},new Set(['roofShape'])));
console.log('Offset, window schedule and body rows survive height edits; incompatible roof choice rejects.');
