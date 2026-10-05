import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decorateFacade } from './genericFacades.ts';
import { decorateRoof } from './roofMesh.ts';
import { sourceVisualRoof } from './sourceVisualRoof.ts';
import { meshBuildingFor, type Feature } from './threeBuildingFeatures.ts';
import type { StreetAppearanceProfile } from './streetAppearance.ts';
import type { MeshBuilding } from './threeBuildingMesh.ts';
const native=JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz')).toString());
const data={features:native.features.map((f:Feature)=>decorateRoof(decorateFacade({...f,properties:{...f.properties,constructionYear:1992,appearanceStyleSource:'citywide-identity-palette-v3-not-measured'}})))};
const profile:StreetAppearanceProfile={id:'reviewed-pair',streetName:'Bethaniënstraat',revision:'test',segment:[[4.8983,52.37172],[4.8986,52.37162]],side:-1,reachM:12,confidence:.9,assemblyM:6,status:'reviewed',visualClass:{kind:'historic-frontage',constructionYearPolicy:'source-visual',sourceEvidenceIds:['view']},evidence:[{id:'view',kind:'municipal-panorama',sha256:'a'.repeat(64),captureDate:'2018-01-01',panoramaId:'station',url:'https://t1.data.amsterdam.nl/panorama/view.jpg',quality:.9,inference:'agent-visual-review',notes:'Independent observed historical fronts.'}],recipes:['neck','plain'].map(shape=>({weight:1,heightMin:8,heightMax:14,frontageMin:4,frontageMax:6.5,recipe:{family:'masonry',period:'canal',crownShape:shape as 'neck'|'plain',confidence:.9}})),frontages:['2178531','2178209'].map((suffix,recipeIndex)=>({buildingId:'NL.IMBAG.Pand.036310001'+suffix,recipeIndex,frontage:{start:[4.8983,52.3717],end:[4.8984,52.3717],widthM:recipeIndex?5.87:4.65}}))};
test('native retained-front crowns share coherent eaves and preserve factual source/total height in every look',()=>{
 for(const front of profile.frontages!){
  const f:Feature=data.features.find((f:Feature)=>f.properties.id===front.buildingId),original=JSON.stringify(f);
  const result=sourceVisualRoof(f,[profile]);assert.ok(result);
  assert.equal(result.plan.gable,profile.recipes[front.recipeIndex].recipe.crownShape);
  assert.equal(result.feature.properties.constructionYear,1992);assert.equal(result.feature.properties.height,f.properties.height);assert.deepEqual(result.feature.geometry,f.geometry);
  assert.equal(Number(result.feature.properties.roofEavesHeightM)+result.plan.riseM,f.properties.height);
  for(const look of ['photo','procedural','cartoon','storybook','untextured'] as const){const building:MeshBuilding=meshBuildingFor(result.feature,look,false,result.plan)!;assert.equal(building.roof!.plan,result.plan);assert.equal(building.heightM,Number(f.properties.height)-result.plan.riseM);}
  assert.equal(JSON.stringify(f),original);
 }
});
test('source roof prior preserves measured/tagged/curated geometry and modern neighbors',()=>{
 const f:Feature=data.features.find((f:Feature)=>f.properties.id===profile.frontages![0].buildingId);
 for(const props of [{roofPlanned:false,roofEavesHeightM:8},{roofShapeTag:'hipped'},{kitWall:true},{frontCarrier:true},{facadeMappedColour:'#123456'},{height:35}])assert.equal(sourceVisualRoof({...f,properties:{...f.properties,...props}},[profile]),undefined);
 const hole={...f,geometry:{...(f.geometry as object),coordinates:[...(f.geometry as any).coordinates,(f.geometry as any).coordinates[0]]}};assert.equal(sourceVisualRoof(hole,[profile]),undefined);
 const modern:Feature=data.features.find((f:Feature)=>String(f.properties.id).endsWith('2178208'));assert.equal(sourceVisualRoof(modern,[profile]),undefined);
 assert.equal(sourceVisualRoof(f,[{...profile,visualClass:{...profile.visualClass!,sourceEvidenceIds:['missing']}}]),undefined);
});
