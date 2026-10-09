import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {assembleReference} from './assemble-reference.ts';
import {selectFrame,expandContour} from './compact-authoring.ts';
import {canalhouseOpeningTemplate} from '../../src/canalRecall/canalhouseOpeningTemplates.ts';

test('named frame exceptions replace sash bars without mutating shared joinery',()=>{
 const sets={sash:{template:'plain-frame',overrides:{verticalBars:[.5],trimWidthM:.09}}};
 const picked=selectFrame({use:'sash',overrides:{verticalBars:[],paneSurface:'door'}},sets);
 assert.ok('template' in picked);
 const resolved=canalhouseOpeningTemplate(picked);
 assert.deepEqual(resolved.verticalBars,[]);assert.equal(resolved.paneSurface,'door');assert.equal(resolved.trimWidthM,.09);
 assert.deepEqual(sets.sash.overrides.verticalBars,[.5]);
 const plain={trimWidthM:.06,verticalBars:[.5]};
 assert.deepEqual(selectFrame({use:'plain',overrides:{verticalBars:[]}}, {plain}),{trimWidthM:.06,verticalBars:[]});
});
test('coarse polyline subdivision retains source anchors and exact straight spans',()=>{
 const points:[[number,number],[number,number],[number,number]]=[[.1,-1],[.25,-.37],[.395,0]];
 const sampled=expandContour({points,segmentsPerSpan:6})!;
 assert.equal(sampled.length,13);assert.deepEqual(sampled[0],points[0]);assert.deepEqual(sampled[6],points[1]);assert.deepEqual(sampled[12],points[2]);
 for(let i=0;i<12;i++){const a=points[i<6?0:1],b=points[i<6?1:2],p=sampled[i];assert.ok(Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))<1e-12);}
 assert.throws(()=>expandContour({points,segmentsPerSpan:0}),/polyline contour/);
});

test('compact house choices expand identically without aliasing frame definitions',async()=>{
 const compact=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/herengracht-491-recipe-input.json','utf8'));
 const explicit=structuredClone(compact);
 for(const o of [...explicit.windowGroups,...explicit.openings])o.frame=selectFrame(o.frame,explicit.frameSets);
 delete explicit.frameSets;
 for(const a of explicit.approaches??[])a.input.topProfile=expandContour(a.input.topProfile);
 assert.deepEqual((await assembleReference(compact)).entry.recipe,(await assembleReference(explicit)).entry.recipe);
 const sets={main:{template:'plain-frame'}};
 const picked=selectFrame({use:'main'},sets) as {template:string};picked.template='changed';
 assert.deepEqual(selectFrame({use:'main'},sets),{template:'plain-frame'});
 assert.throws(()=>selectFrame({use:'missing'},{}),/Unknown house frame/);
 assert.throws(()=>expandContour({from:[0,0],to:[1,-1],segments:0}),/linear contour/);
});

test('compact step drawings preserve observed endpoints and direction while tread count stays unknown',async()=>{
 for(const [from,to] of [[[.1,0],[.6,-1]],[[.1,-1],[.6,0]]] as const){
  const points=expandContour({from,to,segments:5,mode:'steps'})!;
  assert.deepEqual(points[0],from);assert.deepEqual(points.at(-1),to);assert.equal(points.length,11);
  for(let i=1;i<points.length;i+=2){assert.equal(points[i][1],points[i-1][1]);assert.equal(points[i][0],points[i+1][0]);assert.ok((points[i+1][1]-points[i][1])*(to[1]-from[1])>0);}
 }
 const plain={from:[0,0] as const,to:[1,-1] as const,segments:5};assert.deepEqual(expandContour(plain),expandContour({...plain,mode:'linear'}));
 assert.throws(()=>expandContour({...plain,to:[1,0],mode:'steps'}),/requires an observed rise/);
 assert.throws(()=>expandContour({...plain,mode:'unsupported' as any}),/drawing mode/);
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-174-recipe-input.json','utf8'));
 const compact=await assembleReference(input),explicit=structuredClone(input);
 for(const a of explicit.approaches)a.input.topProfile=expandContour(a.input.topProfile);
 assert.deepEqual((await assembleReference(explicit)).entry.recipe,compact.entry.recipe);
 assert.equal(compact.entry.lowerFacadeObservation.exactCurrentTreadCount,null);
 const flight=compact.entry.recipe.elevations[0].approaches![0].assembly.value;
 assert.equal(flight.topProfile![0][1],compact.entry.recipe.elevations[0].landing!.value.topM);assert.equal(flight.topProfile!.at(-1)![1],0);
});
