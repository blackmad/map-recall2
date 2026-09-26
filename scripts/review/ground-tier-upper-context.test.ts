import assert from 'node:assert/strict';
import {compileFacadePatches} from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';
import {owner, record, source, image} from '../city-appearance/fidelity/synthetic-fixture.ts';

const wall=owner.geometry.building.surfaces[0];
const render=(value:any)=>compileFacadePatches(owner,wall,0,[value],[owner],{observed:true,contextual:true});

// A valid ground-only crop owns only its observed lower architecture.  It must
// not wipe the independent contextual rhythm above it.
const groundOnly:any=structuredClone(record);
delete groundOnly.images.full;
groundOnly.facadeDescription.sources={ground:structuredClone(source)};
const visible=render(groundOnly);
assert.ok(visible.some(p=>p.featureKind==='observed-door'),'ground observation still renders');
assert.ok(visible.some(p=>p.featureKind==='window-prior'),'ground-only observation leaves an upper contextual pattern');
assert.ok(visible.filter(p=>p.featureKind==='window-prior').every(p=>Math.min(...p.triangles.filter((_:number,i:number)=>i%3===1))>=3.4),'upper contextual windows begin above the ground-storey band');

// An explicit full crop can deliberately withhold openings.  Its reservation
// remains stronger than a ground observation and must not resurrect a grid.
const withheld:any=structuredClone(groundOnly);
const full:any=structuredClone(source);
full.cropSha256='c'.repeat(64);
full.features=[];
full.openingsComplete=false;
withheld.images.full={...image,sha256:full.cropSha256};
withheld.facadeDescription.sources.full=full;
const withheldPatches=render(withheld);
assert.ok(withheldPatches.some(p=>p.featureKind==='observed-door'),'ground evidence survives a withheld full tier');
assert.equal(withheldPatches.some(p=>p.featureKind==='window-prior'||p.featureKind==='contextual-window-prior'),false,'explicitly withheld full openings remain absent');
console.log('Ground-only facade evidence retains upper context without reviving explicitly withheld full-tier openings.');
