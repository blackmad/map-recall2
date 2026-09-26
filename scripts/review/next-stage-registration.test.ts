import assert from 'node:assert/strict';
import {endpointComparison,nativeCandidate,MAX_UNCERTAINTY_M} from './next-stage-registration.ts';
const direct=endpointComparison([[0,0],[2,0]],[[.04,0],[2.03,0]]);assert.equal(direct.signedDirection,1);assert.ok(direct.bestEndpointErrorM<MAX_UNCERTAINTY_M);
const reverse=endpointComparison([[0,0],[2,0]],[[2.02,0],[.01,0]]);assert.equal(reverse.signedDirection,-1);
const c=nativeCandidate({tier:'ground',sha256:'a'.repeat(64),width:100,height:50,captureDate:'2025-01-01'},{groundNAP:1,wall:{start:{x:10,y:20},end:{x:12,y:20}},images:{ground:{width:100,height:50,plane:{start:{x:9.9,y:20},end:{x:12.1,y:20},baseZ:.7,topZ:5.7},pose:{},datum:'approximate',heightInferred:true}}},{frontage:[[0,0],[2,0]],surfaceIndex:0,originRD:{x:10,y:20}},1);
assert.equal(c.registration.status,'ambiguous');assert.equal(c.registration.abstention,'registration-uncertainty');assert.ok(c.missingEvidence.includes('independent pixel boundary correspondences'));
console.log('next-stage registration diagnostics passed');
