import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canalhouseOpeningBays,canalhouseWindowGroup,canalhouseOpeningGroup,canalhouseGrilleSegments,type CanalhouseWindowGroup} from './canalhouseOpeningGroups.ts';
import {canalhouseOpeningTemplate,canalhouseOpeningTemplateDefinitions} from './canalhouseOpeningTemplates.ts';
import {canalhouseFacadeGroup} from './canalhouseFacadeGroups.ts';
import {canalhouseGroundFront} from './canalhouseGroundFront.ts';

const sample=():CanalhouseWindowGroup=>({id:'front-sashes',bays:[{id:'left',leftM:.4,widthM:1.3},{id:'right',leftM:2.7,widthM:1.4}],tiers:[{id:'bel-etage',bottomM:1.9,heightM:2.6},{id:'upper',bottomM:5.1,heightM:1.8}],frame:{trimWidthM:.07,mullionWidthM:.03,verticalBars:[.5],horizontalBars:[.25,.5,.75]}});
test('semantic camel-case names remain usable across grouped openings, masonry and fields',()=>{
 const group=sample();group.id='frontSashes';group.bays[0].id='leftAxis';group.tiers[0].id='belEtage';
 const openings=canalhouseWindowGroup(group);assert.equal(openings[0].id,'frontSashes/belEtage/leftAxis');
 const masonry=canalhouseFacadeGroup({id:'upperSills',columns:[{id:'leftAxis',leftM:0,widthM:1}],rows:[{id:'firstFloor',bottomM:1,heightM:.1}],depthM:.1,surface:'trim'});
 assert.equal(masonry[0].id,'upperSills/firstFloor/leftAxis');
 assert.equal(canalhouseGroundFront({id:'groundFacing',leftM:0,bottomM:0,widthM:5,heightM:8,depthM:.1,surface:'stone',openingIds:openings.map(o=>o.id)},openings)[0].id,'groundFacing/field');
 group.bays[1].id='leftAxis';assert.throws(()=>canalhouseWindowGroup(group),/Duplicate/);
 for(const id of ['bad/path','bad name','1axis']){group.bays[1].id=id;assert.throws(()=>canalhouseWindowGroup(group),/invalid/);}
});
test('shared source axes retain asymmetric dimensions and floor-specific omissions without aliasing',()=>{
 const group=sample(),sets={principal:group.bays};
 const named=canalhouseWindowGroup({...group,bays:canalhouseOpeningBays({baySet:'principal'},sets),omit:[{bay:'right',tier:'bel-etage'}]});
 const inline=canalhouseWindowGroup({...group,omit:[{bay:'right',tier:'bel-etage'}]});
 assert.deepEqual(named,inline);
 const otherFloor=canalhouseOpeningBays({baySet:'principal'},sets);otherFloor[0].widthM=9;
 assert.equal(sets.principal[0].widthM,1.3);
 assert.throws(()=>canalhouseOpeningBays({baySet:'missing'},sets),/Unknown/);
 assert.throws(()=>canalhouseOpeningBays({baySet:'toString'},sets),/Unknown/);
 assert.throws(()=>canalhouseOpeningBays({bays:group.bays,baySet:'principal'},sets),/exactly one/);
 assert.throws(()=>canalhouseOpeningBays({},sets),/exactly one/);
 assert.throws(()=>canalhouseOpeningBays({baySet:'empty'},{empty:[]}),/Empty/);
});
test('template exceptions replace arrays without mutating another house or exported definitions',()=>{
 const selection={template:'sash-four-by-four',overrides:{horizontalBars:[.33,.67]}};
 const frame=canalhouseOpeningTemplate(selection);
 const leaves=canalhouseWindowGroup({...sample(),frame});
 leaves[0].verticalBars!.push(.9);leaves[0].horizontalBars!.push(.8);
 assert.deepEqual(leaves[1].verticalBars,[.25,.5,.75]);
 assert.deepEqual(leaves[1].horizontalBars,[.33,.67]);
 assert.deepEqual(selection.overrides.horizontalBars,[.33,.67]);
 assert.deepEqual(canalhouseOpeningTemplate({template:selection.template}).horizontalBars,[.25,.5,.75]);
 const definitions=canalhouseOpeningTemplateDefinitions([selection.template,selection.template]);
 assert.equal(Object.keys(definitions).length,1);
 definitions[selection.template].verticalBars!.push(.1);
 assert.deepEqual(canalhouseOpeningTemplate({template:selection.template}).verticalBars,[.25,.5,.75]);
 assert.throws(()=>canalhouseOpeningTemplate({template:'unknown'}),/Unknown/);
 assert.throws(()=>canalhouseOpeningTemplate({template:'toString'}),/Unknown/);
 assert.throws(()=>canalhouseOpeningTemplate({template:'plain-frame',overrides:{widthM:3} as never}),/Unsupported/);
});
test('cellar template expands independently sized leaves while retaining dark panel and grille joinery',()=>{
 const frame=canalhouseOpeningTemplate({template:'paneled-cellar-leaf'});
 const leaves=canalhouseOpeningGroup({...sample(),kind:'door',frame,grille:{rect:[.18,.32,.64,.58],columns:4,rows:7}});
 assert.equal(leaves[0].frameSurface,'door');assert.equal(leaves[0].barSurface,'door');
 assert(leaves.every(o=>o.panels!.length===2&&o.diagonalBars!.length===20));
 leaves[0].panels![0].rect[0]=.2;
 assert.equal(leaves[1].panels![0].rect[0],.14);
 assert.equal(canalhouseOpeningTemplate({template:'paneled-cellar-leaf'}).panels![0].rect[0],.14);
 assert.notDeepEqual(leaves[0].diagonalBars,leaves[1].diagonalBars);
});
test('explicit bays and tiers expand source dimensions without shared mutable pane arrays',()=>{
 const g=sample(),before=structuredClone(g),windows=canalhouseWindowGroup(g);
 assert.equal(windows.length,4);
 assert.equal(windows[3].id,'front-sashes/upper/right');
 assert.deepEqual([windows[3].leftM,windows[3].bottomM,windows[3].widthM,windows[3].heightM],[2.7,5.1,1.4,1.8]);
 windows[0].horizontalBars!.push(.9);
 assert.deepEqual(windows[1].horizontalBars,[.25,.5,.75]);assert.deepEqual(g,before);
});
test('paired doors reuse one panel and bounded grille recipe without mutable shared leaves',()=>{
 const group={...sample(),kind:'door' as const,grille:{rect:[.14,.3,.72,.62] as [number,number,number,number],columns:3,rows:5}};
 group.frame.panels=[{rect:[.14,.07,.72,.16],frameWidthM:.025,reliefM:.02,fieldReliefM:.005,frameSurface:'door'}];
 const leaves=canalhouseOpeningGroup(group);
 assert(leaves.every(o=>o.kind==='door'&&o.diagonalBars!.length===14));
 const opening=leaves[0],t=opening.trimWidthM;
 const [l,b,w,h]=group.grille.rect;
 for(const segment of opening.diagonalBars!)for(const [x,y] of segment){
  const u=(x*opening.widthM-t)/(opening.widthM-2*t),v=(y*opening.heightM-t)/(opening.heightM-2*t);
  assert(u>=l-1e-9&&u<=l+w+1e-9&&v>=b-1e-9&&v<=b+h+1e-9);
 }
 leaves[0].panels![0].rect[0]=.2;assert.equal(leaves[1].panels![0].rect[0],.14);
 assert.throws(()=>canalhouseGrilleSegments({...group.grille,columns:0},opening),/divisions/);
 assert.throws(()=>canalhouseGrilleSegments({...group.grille,rect:[.8,.3,.4,.5]},opening),/field/);
});
test('source omission removes only its named bay and tier; invalid omissions fail',()=>{
 const g=sample();g.omit=[{bay:'right',tier:'bel-etage'}];
 assert.deepEqual(canalhouseWindowGroup(g).map(o=>o.id),['front-sashes/bel-etage/left','front-sashes/upper/left','front-sashes/upper/right']);
 g.omit.push(g.omit[0]);assert.throws(()=>canalhouseWindowGroup(g),/duplicate omitted/);
 g.omit=[{bay:'missing',tier:'upper'}];assert.throws(()=>canalhouseWindowGroup(g),/Unknown/);
 g.omit=[];g.bays[1].id='left';assert.throws(()=>canalhouseWindowGroup(g),/Duplicate/);
});
