import assert from 'node:assert/strict';
import { compileFacadePatches } from '../../../src/canalRecall/cityAppearanceFacadeRecipes.js';
import { fitFacadeFeature } from '../../../src/canalRecall/facadeDescription.js';
import { openingProfile, profileHorizontalSpans, profileVerticalSpan } from '../../../src/canalRecall/facadeOpeningLayout.js';
import { owner, record, source, image, opening } from './synthetic-fixture.js';

const wall = owner.geometry.building.surfaces[0];
const mirroredSource:any=structuredClone(source);mirroredSource.registration.imageToWall=[-.01,0,10,0,-.01,4,0,0,1];
const mirroredFeature:any={...opening,mullions:[.18,.63]};
const mirroredFit=fitFacadeFeature(mirroredFeature,mirroredSource,record);
assert.ok(mirroredFit?.mullions?.every((value,index)=>Math.abs(value-[.37,.82][index])<1e-8),'signed source axis reverses asymmetric mullion fractions after fitted bounds are normalised');
const shallow=openingProfile(3,4,'segmental',.115),tall=openingProfile(3,4,'rounded',.4),corners=openingProfile(3,4,'rectangular',undefined,.071);
assert.ok(profileVerticalSpan(shallow,1.2)![1]>profileVerticalSpan(tall,1.2)![1], 'numeric arch rise distinguishes shallow source segmentals from tall arches');
assert.ok(profileHorizontalSpans(tall,1.8)[0][1]<1.5, 'transom bars clip inside the curved glazing outline');
assert.ok(profileVerticalSpan(corners,1.4)![1]<2, 'rounded top corners do not become a full semicircular opening');
const render = (value: any) => compileFacadePatches(owner, wall, 0, [value], [owner], { observed: true, contextual: true });
const ground = structuredClone(source);
const upper = structuredClone(source);
upper.cropSha256 = 'c'.repeat(64);
upper.features = [{ ...opening, id: 'upper-window', kind: 'window', bounds: [400, 40, 550, 180], head: 'rectangular' }];
const value: any = structuredClone(record);
value.images.full = { ...image, sha256: upper.cropSha256 };
value.facadeDescription.sources = { full: upper, ground };
const independent = render(value);
assert.ok(independent.some(p => p.featureKind === 'observed-door'), 'ground source survives an independently registered full tier');
assert.ok(independent.some(p => p.featureKind === 'observed-window'), 'full source compiles alongside ground evidence');
assert.ok(independent.every(p => !p.featureKind.endsWith('-prior')), 'described tiers never add guessed grids');

const finishes:any=structuredClone(record);
finishes.facadeDescription.sources.ground.features=[
  {...opening,id:'white-door',kind:'door',colour:'#f4f1e8',bounds:[100,100,200,350],head:'rectangular'},
  {...opening,id:'black-window',kind:'window',colour:'#151515',surroundColour:'#d7d0bf',head:'segmental',archRise:.42,lintelHead:'segmental',lintelRise:.05,bounds:[350,100,500,350]}
];
const finishPatches=render(finishes);
assert.ok(finishPatches.some(p=>p.featureId.endsWith('white-door')&&p.colour==='#f4f1e8'),'observed door infill retains its inspected white finish');
assert.ok(finishPatches.some(p=>p.featureId.endsWith('black-window')&&p.colour==='#151515'),'observed window infill retains its inspected black finish');
const highLintel:any=structuredClone(finishes);highLintel.facadeDescription.sources.ground.features[1].lintelRise=.42;
const shallowTrim=finishPatches.filter(p=>p.featureId.endsWith('black-window')&&p.colour==='#d7d0bf').flatMap(p=>p.triangles);
const tallTrim=render(highLintel).filter(p=>p.featureId.endsWith('black-window')&&p.colour==='#d7d0bf').flatMap(p=>p.triangles);
assert.notDeepEqual(shallowTrim,tallTrim,'masonry lintel rise changes independently of the curved glazing rise');

const signedSign:any=structuredClone(record);
signedSign.facadeDescription.sources.ground.registration.imageToWall=[-.01,0,8,0,-.01,4,0,0,1];
signedSign.facadeDescription.sources.ground.features=[{id:'moeders-sign',kind:'fascia',bounds:[100,40,300,90],colour:'#263330',text:'MOEDERS',textColour:'#f4f1e8',signFont:'serif',physicalSignId:'moeders-physical-01',disposition:'agent-inspected'}];
const signPatch=render(signedSign).find(p=>p.featureKind==='observed-fascia');
assert.deepEqual(signPatch?.sign&&{text:signPatch.sign.text,background:signPatch.sign.background,colour:signPatch.sign.colour,font:signPatch.sign.font,physicalSignId:signPatch.sign.physicalSignId},{text:'MOEDERS',background:'#263330',colour:'#f4f1e8',font:'serif',physicalSignId:'moeders-physical-01'});
assert.equal(signPatch?.sign?.uv.length,(signPatch?.triangles.length??0)/3*2,'sign UVs match every emitted triangle vertex');
const minX=Math.min(...signPatch!.triangles.filter((_:number,index:number)=>index%3===0));
const minXUs=signPatch!.triangles.reduce((out:number[],_:number,index:number)=>index%3===0&&Math.abs(signPatch!.triangles[index]-minX)<1e-8?[...out,signPatch!.sign!.uv[(index/3)*2]]:out,[]);
assert.ok(minXUs.some(u=>u>.99),'negative signed wall axis keeps source pixel-right at the sign screen/right UV edge');
const unsigned:any=structuredClone(signedSign);delete unsigned.facadeDescription.sources.ground.features[0].physicalSignId;
assert.equal(render(unsigned).find(p=>p.featureKind==='observed-fascia')?.sign,undefined,'fascia text without a physical sign identity emits no sign metadata');

const marginMaterial:any=structuredClone(record);
marginMaterial.facadeDescription.sources.ground.features.push({id:'paint-to-crop-edge',kind:'material',region:'ground-floor',colour:'#aa9988',bounds:[0,0,1000,500],disposition:'agent-inspected'});
const materialPatches=render(marginMaterial).filter(p=>p.featureId.endsWith('paint-to-crop-edge'));
assert.ok(materialPatches.length>0,'a material region touching the source crop margin is clipped instead of being dropped');
assert.ok(materialPatches.flatMap(p=>p.triangles.filter((_:number,index:number)=>index%3===1)).every((y:number)=>y>=-1e-8),'clipped material stays within the wall face');

const withheld: any = structuredClone(value);
withheld.facadeDescription.sources.full.features = [];
withheld.facadeDescription.sources.full.openingsComplete = false;
const noResurrection = render(withheld);
assert.ok(noResurrection.some(p => p.featureKind === 'observed-door'));
assert.ok(noResurrection.every(p => p.featureKind !== 'window-prior' && p.featureKind !== 'contextual-window-prior'), 'withheld full features stay withheld');

const mismatch: any = structuredClone(value);
mismatch.facadeDescription.sources.ground.imageDimensions.width = 999;
const abstained = render(mismatch);
assert.ok(abstained.some(p => p.featureKind === 'observed-window'));
assert.ok(abstained.every(p => p.featureKind !== 'observed-door' && !p.featureKind.endsWith('-prior')), 'a bad ground tier abstains without erasing the independent full tier or inventing a ground grid');
const raised: any = structuredClone(owner);
raised.geometry.building.surfaces[0].rings[0] = raised.geometry.building.surfaces[0].rings[0].map((point: number[]) => [point[0], point[1] + 3, point[2]]);
const raisedPatches = compileFacadePatches(raised, raised.geometry.building.surfaces[0], 0, [value], [raised], { observed: true });
const doorHeights = raisedPatches.filter(p => p.featureKind === 'observed-door').flatMap(p => p.triangles.filter((_: number, index: number) => index % 3 === 1));
assert.ok(Math.min(...doorHeights) >= 3.42, `surface-base heights are translated at the renderer boundary into the unchanged source mesh datum (${Math.min(...doorHeights)})`);

const half = (id: string, start: number, end: number) => {
  const value: any = structuredClone(record), halfSource: any = structuredClone(source);
  const sha = id === 'left' ? 'd'.repeat(64) : 'e'.repeat(64);
  halfSource.cropSha256 = sha;
  halfSource.registration.imageToWall = [(end - start) / 1000, 0, start, 0, -.01, 4, 0, 0, 1];
  halfSource.features = [{ ...opening, id: `${id}-door`, bounds: [350, 100, 650, 350] }];
  value.id = id; value.images = { ground: { ...image, sha256: sha } }; value.localStart = [start, 0]; value.localEnd = [end, 0];
  value.facadeDescription.frontage = [value.localStart, value.localEnd]; value.facadeDescription.sources = { ground: halfSource };
  return value;
};
const left = half('left', 0, 4), right = half('right', 4, 8);
const twoHalves = compileFacadePatches(owner, wall, 0, [left, right], [owner], { observed: true, contextual: true });
assert.equal(twoHalves.filter(p => p.featureKind === 'observed-door').length > 0, true, 'left registered interval renders');
assert.equal(twoHalves.filter(p => p.featureKind === 'observed-door' && p.observationId === 'right').length > 0, true, 'right registered interval renders independently');
assert.ok(twoHalves.every(p => !p.featureKind.startsWith('contextual-')), 'two described halves leave no contextual spillover');
left.featureRevocations = { 'left-door': true };
const revokedLeft = compileFacadePatches(owner, wall, 0, [left], [owner], { observed: true, contextual: true });
assert.equal(revokedLeft.filter(p => p.featureKind === 'observed-door').length, 0, 'revoked left feature does not return');
const contextualRight = revokedLeft.filter(p => p.featureKind.startsWith('contextual-'));
assert.ok(contextualRight.length > 0, 'unclaimed neighboring interval retains contextual detail');
assert.ok(contextualRight.every(p => p.triangles.filter((_: number, index: number) => index % 3 === 0).every((x: number) => x >= 4 - 1e-8)), 'contextual geometry is clipped outside the revoked described interval');
const legacy: any = structuredClone(record); delete legacy.facadeDescription;
const legacyPatches = compileFacadePatches(owner, wall, 0, [legacy], [owner], { observed: true, contextual: true, procedural: true });
assert.ok(legacyPatches.some(p => p.featureKind === 'window-prior' || p.featureKind === 'contextual-door-prior'));
assert.ok(legacyPatches.every(p => p.observationId !== null), `legacy supported frontage claims its full interval before contextual compilation (${legacyPatches.map(p=>`${p.featureKind}/${p.observationId}`).join(',')})`);

const candidate:any=structuredClone(record);
candidate.facadeDescription.sources.ground.registration.status='ambiguous';
candidate.facadeDescription.sources.ground.registration.uncertaintyM=Number.NaN;
candidate.facadeDescription.sources.ground.registration.preview={kind:'native-crop-plane',cropSha256:image.sha256,imageDimensions:{width:image.width,height:image.height},imageToWall:source.registration.imageToWall,note:'native plane candidate; alignment unverified'};
const defaultCandidate=compileFacadePatches(owner,wall,0,[candidate],[owner],{observed:true});
assert.equal(defaultCandidate.filter(p=>p.featureKind==='observed-door').length,0,'ambiguous registration is absent from normal compilation');
const previewCandidate=compileFacadePatches(owner,wall,0,[candidate],[owner],{observed:true,candidateRegistrationPreview:true});
assert.ok(previewCandidate.some(p=>p.featureKind==='observed-door'&&p.previewOnly===true),'explicit preview compiles candidate geometry with preview-only provenance');
const seamCandidate:any=structuredClone(candidate);
seamCandidate.facadeDescription.sources.ground.registration.preview.imageToWall=[.01,0,-1.5,0,-.01,4,0,0,1];
const seamPatches=compileFacadePatches(owner,wall,0,[seamCandidate],[owner],{observed:true,candidateRegistrationPreview:true});
assert.ok(seamPatches.some(p=>p.featureKind==='observed-door'&&p.partialAtFace===true),'candidate-only seam clipping retains the visible part of an opening');
console.log('Facade renderer composition: independent tiers, withheld features and tier-local dimension-mismatch abstention passed.');
