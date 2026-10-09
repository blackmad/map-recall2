/** Entry style edits retain separate facade, frame and display choices. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {quickEdit} from './buildingBatchQuickEdits';
const r=JSON.parse(fs.readFileSync('artifacts/building-batch-scale-200/recipes/bag-0363100012174735.recipe.json','utf8')),front=r.frontages[0];
const c={id:r.id,width:front.width,eaves:r.roof.eaves,peak:r.roof.top,primaryTop:r.roof.top,ownedTop:r.roof.top,front,storeys:r.storeys,rowCount:3,provenance:r.massing.appearanceRoof.provenance};
const s={rows:3,bays:3,groundTop:3.2,widthRatio:.6,heightRatio:.6,wallColour:r.materials.wallColour,groundColour:front.storefront.finishColour,form:'straight',groundPattern:'four-doors',atticWindow:false,priority:'ordinary',notes:'',doorStyle:'plain'};
const before=structuredClone(c),edit=quickEdit(c,s,new Set(['doorStyle']));assert.deepEqual(c,before);
const pattern=edit.recipe.frontages[0].openingPatterns[0];assert.equal(pattern.doorTemplate.doorLeaf.style,'plain');assert.equal(pattern.doorTemplate.doorLeaf.colour,'#293c32');assert.equal(pattern.template.frameColour,'#deddd1');assert.equal(edit.recipe.frontages[0].storefront,undefined);
assert.equal(quickEdit(c,{...s,doorStyle:'preserve'},new Set(['doorStyle'])).recipe.frontages,undefined);
const layout=quickEdit(c,{...s,groundPattern:'right-entry'},new Set(['groundPattern']));assert.deepEqual(layout.recipe.frontages[0].openingPatterns[0].doorTemplate,front.openingPatterns[0].doorTemplate);
// A warehouse conversion must not turn pale masonry into the upper brick colour.
const paleContext={...c,front:{...front,storefront:{...front.storefront,finishColour:'#deddd1'}}};
const assembly=quickEdit(paleContext,{...s,openingAssembly:'warehouse-single'},new Set(['openingAssembly']));
assert.equal(assembly.recipe.frontages[0].storefront,undefined);
const colouredAssembly=quickEdit(paleContext,{...s,openingAssembly:'warehouse-single',groundColour:'#aabbcc'},new Set(['openingAssembly','groundColour']));
assert.equal(colouredAssembly.recipe.frontages[0].storefront.finishColour,'#aabbcc');
console.log('Door style and layout edits preserve timber/frame finishes; preserve emits no patch.');
