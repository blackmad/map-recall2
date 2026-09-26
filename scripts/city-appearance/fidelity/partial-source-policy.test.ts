import assert from 'node:assert/strict';
import { compileFacadePatches, facadeRecipePatches } from '../../../src/canalRecall/cityAppearanceFacadeRecipes.js';
import { image, opening, owner, record, source } from './synthetic-fixture.js';

const wall=owner.geometry.building.surfaces[0];
const ys=(patches:any[],kind:string)=>patches.filter(p=>p.featureKind===kind).flatMap(p=>p.triangles.filter((_:number,index:number)=>index%3===1));
const patches=(value:any,options:any={})=>compileFacadePatches(owner,wall,0,[value],[owner],{observed:true,...options});
const fullSource=(id='upper-window')=>{
  const full:any=structuredClone(source);
  full.cropSha256='c'.repeat(64);
  full.features=[{...opening,id,kind:'window',head:'rectangular',bounds:[400,40,550,180]}];
  return full;
};

// A registered ground observation owns only the lower tier. It remains an
// observation; an explicitly labelled upper prior is permitted above it while
// no full source exists.
const groundOnly:any=structuredClone(record);
const groundOnlyPatches=facadeRecipePatches(owner,wall,0,[groundOnly],[owner]);
assert.ok(groundOnlyPatches.some(p=>p.featureKind==='observed-door'));
const groundYs=ys(groundOnlyPatches,'observed-door'),upperYs=ys(groundOnlyPatches,'window-prior');
assert.ok(groundYs.length>0&&upperYs.length>0,'ground-only fixture must contain observed lower and procedural upper geometry');
const groundTop=Math.max(...groundYs);
const upperBottom=Math.min(...upperYs);
assert.ok(upperBottom>groundTop,'ground evidence is never overwritten by the unobserved-upper prior');
assert.ok(groundOnlyPatches.filter(p=>p.featureKind==='window-prior').every(p=>p.styleSource==='procedural-prior-not-measured'));

// A full source has complete tier ownership. Its actual observed identity wins
// even when there is no separate ground source.
const fullOnly:any=structuredClone(record);
const full=fullSource();
fullOnly.images={full:{...image,sha256:full.cropSha256}};
fullOnly.facadeDescription.sources={full};
const fullOnlyPatches=patches(fullOnly);
assert.ok(fullOnlyPatches.some(p=>p.featureKind==='observed-window'));
assert.ok(fullOnlyPatches.every(p=>!p.featureKind.endsWith('-prior')),'registered full evidence leaves no guessed tier detail');

// Independently registered tiers can coexist. A full-tier lower feature that
// overlaps ground geometry is suppressed, while its distinct upper observation
// preserves its source identity.
const both:any=structuredClone(record);
full.features.push({...opening,id:'full-lower-duplicate',kind:'window',head:'rectangular'});
both.images.full={...image,sha256:full.cropSha256};
both.facadeDescription.sources={ground:structuredClone(source),full};
const bothPatches=patches(both);
assert.ok(bothPatches.some(p=>p.featureKind==='observed-door'));
assert.ok(bothPatches.some(p=>p.featureId.endsWith('upper-window')),'distinct full-tier upper feature survives');
assert.equal(bothPatches.filter(p=>p.featureId.endsWith('full-lower-duplicate')).length,0,'overlapping full lower feature yields to registered ground geometry');
assert.ok(bothPatches.every(p=>!p.featureKind.endsWith('-prior')));

// A present but failed/stale tier reserves that tier. It must not resurrect a
// generic grid, but independently bound evidence in the other tier survives.
const failedFull:any=structuredClone(both);
failedFull.facadeDescription.sources.full.registration.status='failed';
assert.ok(patches(failedFull).some(p=>p.featureKind==='observed-door'));
assert.ok(patches(failedFull).every(p=>p.featureKind!=='window-prior'));
const ambiguousFull:any=structuredClone(both);
ambiguousFull.facadeDescription.sources.full.registration.status='ambiguous';
assert.ok(patches(ambiguousFull).some(p=>p.featureKind==='observed-door'),'ambiguous full tier does not erase independently registered ground');
assert.ok(patches(ambiguousFull).every(p=>p.featureKind!=='window-prior'),'ambiguous supplied full tier cannot resurrect upper guesses');
const staleGround:any=structuredClone(groundOnly);
staleGround.facadeDescription.sources.ground.imageDimensions.width=999;
assert.equal(patches(staleGround,{contextual:true}).length,0,'stale described ground stays unknown rather than becoming a procedural shopfront or window grid');

// Feature and source revocations remain abstentions. A revoked ground feature
// cannot come back as a lower prior; source revocation also blocks context.
const revokedFeature:any=structuredClone(groundOnly);
revokedFeature.featureRevocations={door:true};
const revokedFeaturePatches=patches(revokedFeature);
assert.equal(revokedFeaturePatches.filter(p=>p.featureKind==='observed-door').length,0);
assert.ok(ys(revokedFeaturePatches,'window-prior').every(y=>y>3.5),'feature revocation cannot recreate lower guessed detail');
const revokedSource:any=structuredClone(groundOnly);
revokedSource.machineRevocation={revoked:true};
assert.equal(patches(revokedSource,{contextual:true}).length,0,'source revocation withholds its claimed frontage');

// Source claims cover only their own frontage intervals. This deliberately
// synthetic gap proves compiler ownership geometry without asserting anything
// about a photographed building.
const half=(id:string,start:number,end:number)=>{
  const value:any=structuredClone(record),halfSource:any=structuredClone(source);
  const sha=id==='left'?'d'.repeat(64):'e'.repeat(64);
  halfSource.cropSha256=sha;
  halfSource.registration.imageToWall=[(end-start)/1000,0,start,0,-.01,4,0,0,1];
  halfSource.features=[{...opening,id:`${id}-door`,bounds:[350,100,650,350]}];
  value.id=id; value.images={ground:{...image,sha256:sha}}; value.localStart=[start,0]; value.localEnd=[end,0];
  value.facadeDescription.frontage=[value.localStart,value.localEnd]; value.facadeDescription.sources={ground:halfSource};
  return value;
};
const left=half('left',0,3),right=half('right',5,8);
const separated=compileFacadePatches(owner,wall,0,[left,right],[owner],{observed:true,contextual:true});
assert.ok(separated.some(p=>p.featureKind==='observed-door'&&p.observationId==='left'));
assert.ok(separated.some(p=>p.featureKind==='observed-door'&&p.observationId==='right'));
const gapContext=separated.filter(p=>p.featureKind.startsWith('contextual-'));
assert.ok(gapContext.length>0,'unclaimed frontage retains contextual fallback');
assert.ok(gapContext.flatMap(p=>p.triangles.filter((_:number,index:number)=>index%3===0)).every(x=>x>=3-1e-8&&x<=5+1e-8),'contextual geometry is clipped to the unclaimed interval');

console.log('Partial facade source policy: tier ownership, stale/revoked abstention, and independent frontage claims passed.');
