import {test} from 'node:test';
import assert from 'node:assert/strict';
import {surveyRecipe,type NativeRecipeSurvey} from './survey-recipe.ts';

const footprint=[[[[0,0],[2,0],[2,2],[0,2]]]];
const source=():NativeRecipeSurvey=>({attributes:{b3_h_maaiveld:1},roofsRD:[
 {surfaceId:'main',vertices:[[0,0,3],[2,0,3],[2,2,3],[0,2,3]]},
 // A near-collinear, rounded source triangle has a well-defined but unstable
 // fitted plane. It is smaller than the compiler's accepted projected area.
 {surfaceId:'rounded-fragment',vertices:[[0,0,3],[1,1,3.0001],[2,2.00001,3.0002]]},
]});
test('rounded roof fragments are reported without changing native ground or accepted roof planes',()=>{
 const survey=source(),before=structuredClone(survey);
 const result=surveyRecipe(survey,footprint,[[0,0],[2,0]]);
 assert.equal(result.roof.length,2);assert.deepEqual(result.roofOwners,['main','main']);
 assert(result.roof.every(r=>r.plane.heightM===2&&r.plane.slopeX===0&&r.plane.slopeZ===0));
 assert.equal(result.omittedRoofFragments.length,1);
 assert.equal(result.omittedRoofFragments[0].surfaceId,'rounded-fragment');
 assert(Math.abs(result.omittedRoofAreaM2-.000005)<1e-12);
 assert.deepEqual(result.omittedRoofFragments[0].verticesRD.map(v=>JSON.stringify(v)).sort(),survey.roofsRD[1].vertices.map(v=>JSON.stringify(v)).sort());
 const withoutFragment=surveyRecipe({...survey,roofsRD:[survey.roofsRD[0]]},footprint,[[0,0],[2,0]]);
 assert.deepEqual(result.polygons,withoutFragment.polygons);
 assert.deepEqual(result.front,withoutFragment.front);
 result.omittedRoofFragments[0].verticesRD[0][2]=100;
 assert.deepEqual(survey,before);
});
test('many tiny fragments cannot accumulate into an unreported roof simplification',()=>{
 const survey=source();
 survey.roofsRD.push(...Array.from({length:21},(_,i)=>({...structuredClone(survey.roofsRD[1]),surfaceId:`fragment-${i}`})));
 assert.throws(()=>surveyRecipe(survey,footprint,[[0,0],[2,0]]),/precision budget/);
});
test('submillimetre boundary repairs retain raw rings and heights and leave larger mismatches intact',()=>{
 const survey:NativeRecipeSurvey={attributes:{b3_h_maaiveld:1},roofsRD:[{surfaceId:'rounded-boundary',vertices:[[0,0,.97],[2,0,3],[2.0003,1,3],[2,2,3],[0,2,3]]}]};
 const before=structuredClone(survey),result=surveyRecipe(survey,footprint,[[0,0],[2,0]]);
 assert.equal(result.roofBoundarySnaps.length,1);
 assert(Math.abs(result.roofBoundarySnaps[0].distanceM-.0003)<1e-10);
 assert.deepEqual(result.roofBoundarySnaps[0].fromRD,[2.0003,1,3]);
 assert(Math.abs(result.shellTopM+.031)<1e-10);
 assert(result.roof.every(r=>r.polygon.outer.every(p=>p[0]<=1+1e-10)));
 assert.deepEqual(survey,before);
 survey.roofsRD[0].vertices[2][0]=2.001;
 const larger=surveyRecipe(survey,footprint,[[0,0],[2,0]]);
 assert.equal(larger.roofBoundarySnaps.length,0);
 assert(larger.roof.some(r=>r.polygon.outer.some(p=>p[0]>1.0005)));
});
