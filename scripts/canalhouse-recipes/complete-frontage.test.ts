import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {discoverCompleteFrontage} from './complete-frontage.ts';

test('discovers adjacent facade across a jog while preserving selected front and native holes',()=>{
 const polygons=[[[[0,0],[3,0],[3,.15],[6,.15],[6,10],[0,10]],[[1,3],[2,3],[2,4],[1,4]]]],before=structuredClone(polygons),front=[[3,.15],[6,.15]];
 const r=discoverCompleteFrontage(polygons,front,{streetNormalRD:[0,-1]});
 assert.deepEqual(r.selectedEndpointsRD,front);assert.equal(r.selectedWidthM,3);
 assert.equal(r.candidate?.widthM,6);assert.equal(r.candidate?.extendsSelectedFront,true);
 assert.deepEqual(r.candidate?.edges.map(e=>[e.edgeIndex,e.role]),[[0,'outward-facade'],[1,'short-jog'],[2,'outward-facade']]);
 assert.deepEqual(r.candidate?.orderedVerticesRD,[[0,0],[3,0],[3,.15],[6,.15]]);
 assert.deepEqual(r.candidate?.edges[0].offPlaneDistancesM,[.15,.15]);
 assert(r.uncertainty.some(s=>s.includes('not a single planar')));
 assert.deepEqual(polygons,before);
});
test('long returns, inward facing edges, excessive offsets and bounds do not become frontage',()=>{
 const p=[[[[0,0],[3,0],[3,2],[6,2],[6,8],[0,8]]]];
 const r=discoverCompleteFrontage(p,[[0,0],[3,0]],{streetNormalRD:[0,-1]});
 assert.deepEqual(r.candidate?.edges.map(e=>e.edgeIndex),[0]);
 assert.equal(r.candidate?.extendsSelectedFront,false);
 const jog=[[[[0,0],[3,0],[3,.2],[6,.2],[6,8],[0,8]]]];
 assert.equal(discoverCompleteFrontage(jog,[[0,0],[3,0]],{maxOffPlaneM:.1}).candidate?.edges.length,1);
 assert.equal(discoverCompleteFrontage(jog,[[0,0],[3,0]],{maxAddedWidthM:2}).candidate?.edges.length,1);
 assert.equal(discoverCompleteFrontage(jog,[[0,0],[3,0]],{streetNormalRD:[0,1]}).candidate,null);
});
test('ring orientation and explicit closure preserve outward candidate; foreign or ambiguous endpoints fail',()=>{
 const ring=[[0,0],[3,0],[3,.2],[6,.2],[6,8],[0,8]],front=[[0,0],[3,0]];
 for(const r of [ring,[...ring].reverse(),[...ring,ring[0]]])assert.equal(discoverCompleteFrontage([[r]],front).candidate?.widthM,6);
 assert.throws(()=>discoverCompleteFrontage([[ring]],[[0,0],[2,0]]),/one native/);
 assert.throws(()=>discoverCompleteFrontage([[ring],[ring]],front),/one native/);
});
test('0.37m native jog stays rejected by default but warns of a partial front; explicit bounded override exposes its facade',()=>{
 const p=[[[[0,0],[3,0],[3,.37],[6,.37],[6,8],[0,8]]]],front=[[0,0],[3,0]],before=structuredClone(p);
 const r=discoverCompleteFrontage(p,front);
 assert.equal(r.limits.maxJogM,.35);assert.equal(r.candidate?.widthM,3);
 assert.equal(r.possiblePartialFront,true);
 const stop=r.stops.find(s=>s.nearParallelFacadeBeyondRejectedJog)!;
 assert.equal(stop.lengthM,.37);assert.equal(stop.streetNormalAngleDeg,90);assert.equal(stop.maxOffPlaneM,.37);
 const expanded=discoverCompleteFrontage(p,front,{maxJogM:.5});
 assert.equal(expanded.limits.maxJogM,.5);assert.equal(expanded.candidate?.widthM,6);
 assert.equal(expanded.candidate?.extendsSelectedFront,true);assert.equal(expanded.possiblePartialFront,false);
 assert.deepEqual(expanded.selectedEndpointsRD,front);assert.deepEqual(p,before);
 for(const maxJogM of [0,-.1,1.01,NaN,Infinity])assert.throws(()=>discoverCompleteFrontage(p,front,{maxJogM}));
});
test('Bloemgracht 88 reports both real native facade parts and its 0.166m jog, without changing its selected half',()=>{
 const survey=JSON.parse(fs.readFileSync(new URL('../../docs/references/canalhouse-recipes/bloemgracht-88-survey.json',import.meta.url),'utf8'));
 const trial=JSON.parse(fs.readFileSync(new URL('../../docs/references/canalhouse-recipes/bloemgracht-88-trial.json',import.meta.url),'utf8'));
 const front=trial.entries[0].orderedFrontageRD.map((p:{x:number;y:number})=>[p.x,p.y]),before=structuredClone(survey.surveyFootprintPolygonsRD);
 const r=discoverCompleteFrontage(survey.surveyFootprintPolygonsRD,front);
 assert.deepEqual(r.selectedEndpointsRD,front);assert(Math.abs(r.selectedWidthM-2.755771)<.00001);
 assert.deepEqual(r.candidate?.edges.map(e=>[e.edgeIndex,e.role]),[[11,'outward-facade'],[10,'short-jog'],[9,'outward-facade']]);
 assert.deepEqual(r.candidate?.orderedVerticesRD,[12,11,10,9].map(i=>survey.surveyFootprintPolygonsRD[0][0][i]));
 assert(r.candidate!.widthM>5&&r.candidate!.widthM<5.1);
 assert(Math.abs(r.candidate!.edges[1].lengthM-.165747)<.00001);
 assert(r.candidate!.edges[0].offPlaneDistancesM.some(v=>Math.abs(v)>.7));
 assert.deepEqual(survey.surveyFootprintPolygonsRD,before);
});
