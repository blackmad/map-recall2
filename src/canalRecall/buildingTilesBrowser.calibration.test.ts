import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decorateBuildingFeature, loadVerifiedAppearanceRelease } from './buildingTilesBrowser.js';

const hash = (value:string) => createHash('sha256').update(value).digest('hex');
const H='a'.repeat(64),R='b'.repeat(64),C='c'.repeat(64);
const building={id:'NL.IMBAG.Pand.0363100012166570',sourceId:'0363100012166570',geometryRevision:H,constructionYear:1900,sideColour:'#6d5e55',sideColourSource:'measured-accepted',sideColourObservationId:'obs-13',sideColourSourceSha256:H,sideColourReviewOrigin:'model-visual-review',sideColourReviewer:'gpt-6-sol',renderSideColour:'#a88c78',renderSideColourCalibration:{baselineReleaseId:R,observationId:'obs-13',referenceSha256:H,gameCaptureSha256:C,reviewer:'gpt-6-sol',reviewOrigin:'model-visual-review',gradedAt:'2026-09-26T10:00:00Z',reason:'Reference and captured game wall differ.'},roofColour:'#665544',groundColour:'#6d5e55',groundFloorHeightM:3.2,roofShape:null,roofEavesHeightM:null,roofGeometrySource:null};
const route={id:'study',distanceM:200,source:'guided-route-source-graph',from:{id:'a',name:'a',lat:52,lng:4},to:{id:'b',name:'b',lat:52,lng:4}};
async function load(item:Record<string,unknown>){
  const body=JSON.stringify({version:1,releaseId:R,areaId:'area',styleSource:'per-building-wall-colour-provenance-v1',sourceBlockSha256:H,buildings:[item],studyRoute:route});
  const pointer={version:1,releaseId:R,areaId:'area',sourceHashes:{block:H},maplibreAppearance:{url:'/sidecar.json',sha256:hash(body),buildings:1}};
  return loadVerifiedAppearanceRelease('/pointer.json',async(url)=>new Response(url==='/pointer.json'?JSON.stringify(pointer):body,{status:200}));
}
const result=await load(building);
const prior=result.priors.get(building.id);
assert.equal(prior?.sideColour,'#6d5e55');
assert.equal(prior?.renderSideColour,'#a88c78');
const decorated=decorateBuildingFeature({type:'Feature',properties:{id:building.id},geometry:{type:'Polygon',coordinates:[]}} as any,result.priors);
assert.equal(decorated.properties?.sideColour,'#6d5e55');
assert.equal(decorated.properties?.renderSideColour,'#a88c78');
assert.deepEqual(decorated.properties?.renderSideColourCalibration,building.renderSideColourCalibration);
await assert.rejects(load({...building,renderSideColourCalibration:{...building.renderSideColourCalibration,observationId:'stale'}}),/Invalid appearance sidecar building/);
await assert.rejects(load({...building,renderSideColourCalibration:undefined}),/Invalid appearance sidecar building/);
await assert.rejects(load({...building,renderSideColour:undefined}),/Invalid appearance sidecar building/);
await assert.rejects(load({...building,sideColourSource:'procedural-prior-not-measured'}),/Invalid appearance sidecar building/);
console.log('buildingTilesBrowser calibration: source/render separation and fail-closed binding passed');
