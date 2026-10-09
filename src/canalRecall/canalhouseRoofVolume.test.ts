import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canalhouseRoofVolume} from './canalhouseRoofVolume';
import {surveyRecipe} from '../../scripts/canalhouse-recipes/survey-recipe';
import type {CanalHouseRecipe} from './canalhouseRecipes';
type Roof=CanalHouseRecipe['roof']['value'][number];
const front={a:[0,0] as [number,number],normal:[0,-1] as [number,number]};
const flat=(x:number,z:number,w:number,d:number,h:number):Roof=>({polygon:{outer:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]],holes:[]},plane:{heightM:h,slopeX:0,slopeZ:0}});
test('connected main roof continues behind the seed while lower annex and detached volume remain native',()=>{
 const roofs=[flat(0,0,4,4,10),flat(0,4,4,4,12),flat(0,8,4,2,6),flat(8,4,4,4,12)];
 const before=structuredClone(roofs),result=canalhouseRoofVolume(roofs,['front','rear','annex','detached'],front,{seedSurfaceIds:['front'],depthM:[0,10],minHeightM:9,sourceReview:'One continuous main roof; separate lower annex.'});
 assert.deepEqual(result.surfaceIds,['front','rear']);assert.deepEqual(result.preservedSurfaceIds,['annex','detached']);assert.deepEqual(roofs,before);
});
test('short shared segment joins T intersections; a point contact does not merge another volume',()=>{
 const roofs=[flat(0,0,4,4,10),flat(0,4,2,4,10),flat(4,4,2,4,10)];
 assert.deepEqual(canalhouseRoofVolume(roofs,['seed','t','corner'],front,{seedSurfaceIds:['seed'],depthM:[0,8],minHeightM:9,sourceReview:'T roof with separate corner volume.'}).surfaceIds,['seed','t']);
});
test('selection stops at reviewed depth and rejects seeds outside it',()=>{
 const roofs=[flat(0,0,4,4,10),flat(0,4,4,4,10)],s={seedSurfaceIds:['front'],depthM:[0,4] as [number,number],minHeightM:9,sourceReview:'Front scope only'};
 assert.deepEqual(canalhouseRoofVolume(roofs,['front','rear'],front,s).surfaceIds,['front']);
 assert.throws(()=>canalhouseRoofVolume(roofs,['front','rear'],front,{...s,seedSurfaceIds:['rear']}),/exceeds reviewed bounds/);
 assert.throws(()=>canalhouseRoofVolume(roofs,['front','rear'],front,{...s,sourceReview:''}),/reviewed roof volume/);
});
test('actual86 main volume includes the rear backing partitions and preserves every annex',()=>{
 const prefix='docs/references/canalhouse-recipes/bloemgracht-86-',survey=JSON.parse(fs.readFileSync(prefix+'survey.json','utf8')),admission=JSON.parse(fs.readFileSync(prefix+'source-admission.json','utf8'));
 const n=surveyRecipe(survey,admission.native.surveyFootprintPolygonsRD,admission.principalFront.orientedLeftToRightAsSeenFromCanal),id=(i:number)=>`NL.IMBAG.Pand.0363100012169905-0:lod22:roof:${i}`;
 const result=canalhouseRoofVolume(n.roof,n.roofOwners,n.front,{seedSurfaceIds:[id(40),id(41)],depthM:[-.2,12.3],minHeightM:10.65,sourceReview:'Source crown and native side-eaves support an inferred continuous main volume, not separate survey fragments.'});
 assert.deepEqual(new Set(result.surfaceIds),new Set([40,41,43,45].map(id)));
 assert.deepEqual(new Set(result.preservedSurfaceIds),new Set([39,42,44,46].map(id)));
});
