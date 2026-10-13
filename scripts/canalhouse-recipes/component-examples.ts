/** Synthetic library examples, never surveyed houses or game admissions. */
import fs from 'node:fs/promises';
import {measured,type Observation} from '../../src/canalRecall/facade/evidence.ts';
import {unobservedHouse} from '../../src/canalRecall/facade/houseRecord.ts';
import {canalhouseWindowGroup} from '../../src/canalRecall/canalhouseOpeningGroups.ts';
import {canalhouseCrownProfile,type CanalHouseRecipe,type CanalhouseApproach,type CanalhousePoint} from '../../src/canalRecall/canalhouseRecipes.ts';

const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'docs/references/canalhouse-recipes/component-examples.json';
const observation:Observation={id:'synthetic-library-example',pandId:'0000000000000001',kind:'human-review',elevation:'front',capturedAt:'2026-10-06',sourceUrl:null,license:null};
const m=<V>(value:V)=>measured(value,'reviewed',1,observation);
const polygon={outer:[[0,0],[6,0],[6,10],[0,10]] as CanalhousePoint[],holes:[]};
const house=unobservedHouse(observation.pandId);house.eavesHeightM=m(8);house.gable=m('punt');
const windowGroup={id:'front-sashes',bays:[{id:'left',leftM:.45,widthM:1.3},{id:'right',leftM:4.25,widthM:1.3}],tiers:[{id:'bel-etage',bottomM:2,heightM:2.5},{id:'upper',bottomM:5.15,heightM:1.85}],frame:{trimWidthM:.075,mullionWidthM:.035,verticalBars:[.5],horizontalBars:[.25,.5,.75]}};
const base:CanalHouseRecipe={schemaVersion:1,id:'library-single-flight',house,observations:[observation],footprint:m([polygon]),palette:m({wall:'#62493d',roof:'#484440',trim:'#e2ddca',stone:'#aca79b',glass:'#263f43',door:'#26352d'}),roof:m([{polygon,plane:{heightM:8,slopeX:0,slopeZ:0}}]),elevations:[{
 id:'front',polygonIndex:0,edgeIndex:0,openings:m([...canalhouseWindowGroup(windowGroup),
 {id:'raised-door',kind:'door',leftM:2.5,bottomM:1.2,widthM:1,heightM:2.5,trimWidthM:.075},
 {id:'basement-door',kind:'door',leftM:2.5,bottomM:.05,widthM:1,heightM:1,trimWidthM:.05},
 {id:'basement-left',kind:'window',leftM:.45,bottomM:.1,widthM:1.3,heightM:.8,trimWidthM:.05,verticalBars:[.25,.5,.75],horizontalBars:[.333,.667]},
 {id:'basement-right',kind:'window',leftM:4.25,bottomM:.1,widthM:1.3,heightM:.8,trimWidthM:.05,verticalBars:[.25,.5,.75],horizontalBars:[.333,.667]}]),
 landing:m({leftM:2.5,widthM:1,topM:1.2,depthM:.9,thicknessM:.06}),
 crown:m({profile:canalhouseCrownProfile('punt',6,8,10,1.5,9,4),depthM:.2,trimWidthM:.09}),
}],simplifications:['Synthetic dimensions for component inspection; no real address, survey or facade fidelity claim.','Basement-window overlap is deliberately acknowledged in this synthetic demonstration.']};
const right:CanalhouseApproach={topProfile:[[3.5,1.2],[3.8,1.2],[3.8,.95],[4.15,.95],[4.15,.7],[4.5,.7],[4.5,.45],[4.85,.45],[4.85,.2],[5.2,.2],[5.2,0]],groundM:0,backM:.02,depthM:.88,railProfile:[[3.5,2.1],[5.2,.9]],posts:[{xM:3.55,bottomM:1.2,topM:2.065},{xM:5.2,bottomM:0,topM:.9}],railWidthM:.035,postWidthM:.045,occludedOpeningIds:['basement-right']};
base.elevations[0].approaches=[{id:'right',assembly:m(right)}];
const opposed=structuredClone(base);opposed.id='library-opposed-flights';
const left:CanalhouseApproach={...structuredClone(right),topProfile:right.topProfile!.map(([x,y])=>[6-x,y] as CanalhousePoint).reverse(),railProfile:right.railProfile.map(([x,y])=>[6-x,y] as CanalhousePoint).reverse(),posts:right.posts.map(p=>({...p,xM:6-p.xM})),occludedOpeningIds:['basement-left']};
opposed.elevations[0].approaches!.unshift({id:'left',assembly:m(left)});
const neck=structuredClone(opposed);neck.id='library-neck-opposed';neck.house.gable=m('hals');
neck.elevations[0].crown!.value.profile=canalhouseCrownProfile('hals',6,8,10,1.6,8.6,4);
const classical=structuredClone(opposed);classical.id='library-classical-frieze';classical.house.gable=m('lijst');
classical.elevations[0].crown!.value.profile=[[0,8],[6,8]];
classical.elevations[0].cornice=m({bottomM:7.5,heightM:.5,depthM:.3,brackets:0,
 layers:[{bottomM:7.5,heightM:.08,depthM:.14},{bottomM:7.58,heightM:.28,depthM:.12},{bottomM:7.86,heightM:.14,depthM:.3}],
 accents:[
  ...[.4,5.35].map((leftM,i)=>({id:`support-${i}`,leftM,bottomM:7.62,widthM:.25,heightM:.32,depthM:.38,profile:'console' as const})),
  ...[.4,2.8,5.35].map((leftM,i)=>({id:`glyph-${i}`,leftM,bottomM:7.54,widthM:.25,heightM:.22,depthM:.2,profile:'triglyph' as const})),
  ...[1.6,2.9,4.2].map((leftM,i)=>({id:`pendant-${i}`,leftM,bottomM:7.8,widthM:.16,heightM:.13,depthM:.37})),
 ]});
const attic=structuredClone(classical);attic.id='library-grouped-attic';
attic.elevations[0].dormers=m([{id:'left',leftM:1,widthM:1.1,bottomM:8.3,heightM:1.2,depthM:.65,roofRiseM:0},{id:'right',leftM:3.5,widthM:1.3,bottomM:8.4,heightM:1.4,depthM:.65,roofRiseM:0}]);
attic.elevations[0].dormerFront=m({profile:[[.25,8],[.7,9.7],[2.5,9.7],[2.8,10],[5.2,10],[5.75,8]],depthM:.08,surface:'roof',trimWidthM:.055});
// The same hollow bay assembly changes plan and face joinery through data.
// Host apertures reuse the ordinary window groups; no example-specific mesh.
const bayExample=(splayed:boolean):CanalHouseRecipe=>{
 const recipe=structuredClone(classical);recipe.id=splayed?'library-splayed-bays':'library-rectangular-bays';
 const elevation=recipe.elevations[0];delete elevation.approaches;delete elevation.landing;
 elevation.glazedBays=m(windowGroup.tiers.map(tier=>({
  id:`bay-${tier.id}`,leftM:.35,bottomM:tier.bottomM-.1,widthM:1.5,
  heightM:tier.heightM+.2,frontWidthM:splayed?1.05:1.5,depthM:.65,
  lowerPanelM:.1,upperPanelM:.1,frameWidthM:.045,frameDepthM:.06,glassDepthM:.015,
  capM:.04,verticalBars:[.5],horizontalBars:[.65],
  faces:{left:{verticalBars:[]},right:{verticalBars:[]}},
 })));
 return recipe;
};
// One shared crown component: broad low cap, narrower taller cap, and pediment neck.
const crownExamples=[
 {id:'library-clock-broad',family:'klok' as const,neck:2.8,shoulder:9.4,options:{crestWidthM:2.6,cap:'rounded' as const,capRiseM:.4,shoulderCurve:2.4}},
 {id:'library-clock-narrow',family:'klok' as const,neck:1.8,shoulder:8.7,options:{crestWidthM:1.4,cap:'rounded' as const,capRiseM:.7,shoulderCurve:.7}},
 {id:'library-neck-pediment',family:'hals' as const,neck:2.6,shoulder:8.6,options:{crestWidthM:2.4,cap:'pediment' as const,capRiseM:.5}},
].map(config=>{
 const recipe=structuredClone(base);recipe.id=config.id;recipe.house.gable=m(config.family);
 recipe.elevations[0].crown!.value.profile=canalhouseCrownProfile(config.family,6,8,10,config.neck,config.shoulder,1,config.options);
 return recipe;
});
const crownFacings=[
 {source:crownExamples[0],id:'library-clock-faced',bottomM:9.45,depthM:.04,surface:'trim' as const},
 {source:crownExamples[2],id:'library-neck-faced',bottomM:9.25,depthM:.05,surface:'stone' as const},
].map(({source,id,...capFacing})=>{
 const recipe=structuredClone(source);recipe.id=id;recipe.elevations[0].crown!.value.capFacing=capFacing;
 return recipe;
});
const crownWings=[
 {source:crownExamples[0],id:'library-clock-wings',thicknessM:.28,bulgeM:.15},
 {source:crownExamples[2],id:'library-neck-wings',thicknessM:.38,bulgeM:.18},
].map(({source,id,thicknessM,bulgeM})=>{
 const recipe=structuredClone(source);recipe.id=id;
 recipe.elevations[0].crown!.value.wings={leftM:.1,widthM:1.4,thicknessM,bulgeM,segments:2,gapM:.1,depthM:.09,surface:'trim'};
 return recipe;
});
const entries=[base,opposed,neck,classical,attic,bayExample(false),bayExample(true),...crownExamples,...crownFacings,...crownWings].map(recipe=>({name:recipe.id,id:recipe.id,recipe,suppressOsmIds:[],anchorRD:[0,0],anchor:[0,0],frontNormal:[0,-1],frontTarget:[3,4,0],frontWidthM:6,sample:'synthetic-library-example'}));
await fs.writeFile(output,JSON.stringify({schemaVersion:1,status:'synthetic-component-examples-not-buildings',windowGroupInput:windowGroup,entries},null,2)+'\n');
console.log(JSON.stringify({output,examples:entries.length,sharedWindowGroup:true,customGeometryBuilders:0}));
