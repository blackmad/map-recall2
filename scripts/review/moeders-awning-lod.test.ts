import * as THREE from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createCityAppearanceThreeAdapter} from '../../src/canalRecall/cityAppearanceThree.ts';
const report=JSON.parse(fs.readFileSync('scripts/review/neighbourhood-candidate.json','utf8'));
const manifest=JSON.parse(fs.readFileSync(`public/data/city-expansion/releases/${report.candidateReleaseId}/manifest.json`,'utf8'));
const id='0363100012169816',entry=manifest.observationIndex.find((o:any)=>o.buildingId===id),tileInfo=manifest.tiles.find((t:any)=>t.key===entry.tile);
const tile=JSON.parse(gunzipSync(fs.readFileSync('public'+tileInfo.url)).toString());
const owner=tile.owners.find((o:any)=>o.id===id);
// Isolate the source awning: browser canvas text is orthogonal to LOD retention.
for(const observation of owner.observations)for(const source of Object.values(observation.payload.facadeDescription?.sources??{}) as any[])source.features=source.features.filter((f:any)=>f.kind==='awning');
const resource=createCityAppearanceThreeAdapter({parent:new THREE.Group(),targetOriginRD:owner.geometry.frame.originRD,targetOffsetNAP:.65,observedFacades:true,candidateRegistrationPreview:true,proceduralFacades:false,contextualFacades:false})([owner]);
for(const lod of ['facade','detail','facade'] as const){resource.setLod(id,lod);resource.flush();assert.equal(resource.stats.awnings,1,`Reviewed Moeders awning survives ${lod} LOD`);}
resource.setLod(id,'massing');resource.flush();assert.equal(resource.stats.awnings,0);
resource.setLod(id,'facade');resource.flush();assert.equal(resource.stats.awnings,1);assert.ok(resource.stats.geometryBufferBytes>0);resource.dispose();assert.equal(resource.stats.disposed,true);assert.equal(resource.stats.geometryBufferBytes,0);assert.equal(resource.stats.textureBytes,0);
console.log('Moeders source awning survives facade/detail LOD and rehydration; massing omission explicit');
