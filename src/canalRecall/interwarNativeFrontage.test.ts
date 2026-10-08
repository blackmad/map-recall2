import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {decorateFacade} from './genericFacades.js';
import {decorateRoof} from './roofMesh.js';
import {buildFeatureChunk,ORIGIN,type Feature} from './threeBuildingFeatures.js';
import {streetSegments} from './streetFronts.js';
import {sourceVisualRoof} from './sourceVisualRoof.js';
import {validateStreetAppearanceCatalog} from './streetAppearance.js';
const catalog=validateStreetAppearanceCatalog(JSON.parse(readFileSync('public/data/street-appearance/profiles.json','utf8')));
const profile=catalog.profiles.find(p=>p.id==='jan-evertsen-canopy-candidate-native-pair')!;
const raw=JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8412/5384.geojson.gz')).toString()).features as Feature[];
const features:Feature[]=raw.filter(f=>profile.buildingIds!.includes(String(f.properties.id))).map(f=>decorateRoof(decorateFacade({...f,properties:{...f.properties,constructionYear:1925,appearanceStyleSource:'citywide-identity-palette-v3-not-measured'}})));
const streets=streetSegments(catalog.streetFrontPaths!,ORIGIN);
test('native pilot windows occupy wall chunk with all three physical rows and texture layers',()=>{
 for(const look of ['photo','storybook','procedural'] as const){
  const chunk=buildFeatureChunk(features,look,'walls',streets,[profile]);
  assert.equal(chunk.ranges.length,2);
  for(const range of chunk.ranges){
   const vertices=Array.from({length:range.count},(_,i)=>range.start+i);
   const source=features.find(f=>f.properties.id===range.id)!;
   assert.ok(vertices.every(i=>Number.isFinite(chunk.positions[i*3+2])&&chunk.positions[i*3+2]<=Number(source.properties.height)+.001));
   const frame=vertices.filter(i=>Math.abs(chunk.tints[i*4]-229)<2&&Math.abs(chunk.tints[i*4+1]-229)<2&&Math.abs(chunk.tints[i*4+2]-216)<2);
   assert.ok(frame.length>=100,'defining pale frame geometry survives without extras');
   assert.ok(new Set(frame.map(i=>Math.round(chunk.positions[i*3+2]*10))).size>=12,'physical three-row frames/transoms are not a repeated blank wall');
   assert.ok(new Set(vertices.map(i=>chunk.layers[i])).size>=4,'glass, ground, bare masonry and flat frames retained');
  }
 }
});
test('quiet source roof stays in native envelope; explicit survey and unscoped neighbor retain fallback',()=>{
 for(const f of features){
  const result=sourceVisualRoof(f,[profile]);assert.ok(result);assert.equal(result.plan.kind,'parapet');
  assert.deepEqual(result.feature.geometry,f.geometry);assert.equal(result.feature.properties.height,f.properties.height);
  assert.equal(Number(result.feature.properties.roofEavesHeightM)+result.plan.riseM,Number(f.properties.height));
  assert.equal(sourceVisualRoof({...f,properties:{...f.properties,roofShapeTag:'hipped'}},[profile]),undefined);
  assert.equal(sourceVisualRoof({...f,properties:{...f.properties,id:'unscoped-neighbor'}},[profile]),undefined);
  assert.equal(sourceVisualRoof(f,[{...profile,evidence:profile.evidence.filter(e=>e.kind!=='municipal-panorama')}]),undefined);
 }
});

test('rejected ground assembly preserves the same textured facade and door allocation as opt-out',()=>{
 const without={...profile,recipes:profile.recipes.map(p=>({...p,recipe:{...p.recipe,interwarGround:undefined}}))};
 const rejected={...profile,recipes:profile.recipes.map(p=>({...p,recipe:{...p.recipe,interwarGround:{...p.recipe.interwarGround!,openingHeadM:3.6}}}))};
 for(const look of ['photo','storybook','procedural'] as const)for(const mode of ['walls','extras'] as const){
  const expected=buildFeatureChunk(features,look,mode,streets,[without]);
  const actual=buildFeatureChunk(features,look,mode,streets,[rejected]);
  for(const key of ['positions','uvs','layers','tints','accents','indices'] as const)assert.deepEqual(actual[key],expected[key],`${look}/${mode}/${key}: fallback changed ordinary facade`);
 }
});
