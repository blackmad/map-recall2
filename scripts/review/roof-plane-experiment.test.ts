import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildCase20RoofPlaneExperiment,makeCase20RoofStudyView} from './roof-plane-experiment.ts';
import {readFileSync} from 'node:fs';

const cases=JSON.parse(readFileSync(new URL('../../public/data/facade-repair-preview/cases.json',import.meta.url),'utf8')).cases;
const sample=cases.find((item:{caseId:string})=>item.caseId==='case-20');

test('case 20 roof surfaces are separate and source bound',()=>{
  const hypothesis=buildCase20RoofPlaneExperiment(sample.source.full,sample.shapeStudy.full.sourceSilhouette);
  assert.equal(hypothesis.mode,'source-space-provisional-roof-planes');
  assert.deepEqual(new Set(hypothesis.surfaces.map(s=>s.role)),new Set(['main-roof','dormer-front','dormer-side','dormer-cap','dormer-opening']));
  assert.equal(hypothesis.surfaces.filter(s=>s.role==='main-roof').length,1);
  assert.ok(hypothesis.surfaces.filter(s=>s.role==='dormer-side').every(s=>new Set(s.vertices.map(p=>p[2])).size>1));
  assert.ok(hypothesis.surfaces.every(s=>s.vertices.every(p=>p.every(Number.isFinite))));
  const front=hypothesis.surfaces.find(s=>s.role==='dormer-front')!;
  assert.equal(front.vertices[0][1],front.vertices[1][1],'bottom edge is horizontal');
  assert.equal(front.vertices[2][1],front.vertices[4][1],'gable shoulders share one level');
  assert.equal(front.vertices[3][0],(front.vertices[2][0]+front.vertices[4][0])/2,'gable apex is centred');
  const opening=hypothesis.surfaces.find(s=>s.role==='dormer-opening')!;
  assert.equal(opening.vertices[0][0],opening.vertices[3][0],'opening jamb is vertical');
  assert.equal(opening.vertices[1][0],opening.vertices[2][0],'opening jamb is vertical');
  assert.throws(()=>buildCase20RoofPlaneExperiment({...sample.source.full,sha256:'0'.repeat(64)},sample.shapeStudy.full.sourceSilhouette),/reviewed source/);
  assert.throws(()=>buildCase20RoofPlaneExperiment(sample.source.full,{polygonPx:[[0,0]]}),/reviewed source/);
});

test('opt-in view preserves lower openings and original source candidate',()=>{
  const original=sample.shapeStudy.full;
  const before=JSON.stringify(original);
  const hypothesis=buildCase20RoofPlaneExperiment(sample.source.full,original.sourceSilhouette);
  const view=makeCase20RoofStudyView(original,hypothesis);
  const doorIds=(study:typeof original)=>new Set(study.patches.filter((p:{featureKind:string})=>p.featureKind==='observed-door').map((p:{featureId:string})=>p.featureId));
  assert.deepEqual(doorIds(view),doorIds(original));
  assert.equal(doorIds(view).size,4);
  assert.deepEqual(view.patches.filter((p:{featureKind:string})=>p.featureKind==='observed-door'),original.patches.filter((p:{featureKind:string})=>p.featureKind==='observed-door'),'retained door triangle geometry stays byte-identical');
  assert.ok(!view.patches.some((p:{featureId:string})=>p.featureId.endsWith('full:review:dormer')||p.featureId.endsWith('full:review:roof-slate')));
  assert.ok(view.patches.filter((p:{featureId:string})=>p.featureId.endsWith('full:material-1')).every((p:{triangles:number[]})=>p.triangles.filter((_,i)=>i%3===1).every(y=>y<=hypothesis.wallTopY+1e-9)));
  assert.equal(JSON.stringify(original),before);
  assert.equal(view.owner.geometry.building.surfaces[0].rings[0].length,4);
});
