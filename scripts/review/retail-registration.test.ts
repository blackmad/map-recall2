import assert from 'node:assert/strict';import {assessCandidate,signedCandidate} from './retail-registration.ts';
const wall={start:{x:10,y:20},end:{x:14,y:20}};const image={width:400,height:200,plane:{start:{x:9.9,y:20},end:{x:14.1,y:20},baseZ:1,topZ:6},obliquity:4,standoff:8,heightInferred:true,datum:'approximate'};
const transform=signedCandidate(image,wall,1.3);assert.ok(transform.imageToWall[0]>0);assert.equal(transform.imageToWall[5],4.7);assert.deepEqual(transform.wallDirection,[1,0]);
const result=assessCandidate(image,wall,1.3,{retail:true});assert.equal(result.status,'ambiguous');assert.equal(result.acceptance.uncertaintyM,null);assert.ok(result.acceptance.blockers.some((v:string)=>v.includes('recessed')));assert.equal(result.contact.status,'unresolved');
console.log('retail registration evidence passed');
