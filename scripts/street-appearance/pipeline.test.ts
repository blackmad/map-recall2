import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateObservations, type Observation } from './pipeline.ts';
import { compileStreetAppearanceAssignments, streetAppearanceFrontageRecords, recipeForWall, validateStreetAppearanceCatalog, type StreetAppearanceProfile, type StreetAppearanceFront } from '../../src/canalRecall/streetAppearance.ts';
import jpeg from 'jpeg-js';
import { perspectiveCrop } from './perspective.ts';
const evidence = {id:'a',kind:'municipal-panorama' as const,sha256:'a'.repeat(64),inference:'model' as const,quality:.7,notes:'fixture'};
const profile:StreetAppearanceProfile={id:'north',streetName:'fixture',revision:'1',segment:[[4.8,52.3],[4.802,52.3]],side:1,reachM:25,confidence:.7,assemblyM:18,status:'pilot',evidence:[evidence],recipes:[{weight:1,yearMax:1945,recipe:{family:'masonry',period:'c19',confidence:.7,wallHex:'#885544'}}]};
const wall={start:[4.8005,52.3001] as const,end:[4.8006,52.3001] as const,normal:[0,-1] as const};
const building={id:'b1',year:1890,heightM:15};
test('street side, inward facing wall, segment ends and year filter',()=>{
 assert.equal(recipeForWall([profile],wall,building)?.family,'masonry');
 assert.equal(recipeForWall([profile],{...wall,normal:[0,1]},building),undefined);
 assert.equal(recipeForWall([profile],{...wall,start:[4.8005,52.2999],end:[4.8006,52.2999]},building),undefined);
 assert.equal(recipeForWall([profile],{...wall,start:[4.805,52.3001],end:[4.806,52.3001]},building),undefined);
 assert.equal(recipeForWall([profile],wall,{...building,year:2000}),undefined);
 assert.equal(recipeForWall([profile],wall,{...building,year:null,heightM:45}),undefined);
});
test('holdout photographs withheld while explicit unchanged training transfer applies',()=>{
 const holdout={...profile,id:'holdout',holdout:true};
 assert.equal(recipeForWall([holdout],wall,building),undefined);
 assert.equal(recipeForWall([{...holdout,learnedFrom:profile.id}],wall,building)?.family,'masonry');
});
test('deterministic selection across order and workers; uncertainty withheld',()=>{
 assert.deepEqual(recipeForWall([profile],wall,building),recipeForWall(structuredClone([profile]),wall,building));
 assert.equal(recipeForWall([{...profile,confidence:.2}],wall,building),undefined);
 assert.equal(recipeForWall([{...profile,evidence:[{...evidence,quality:.2}]}],wall,building),undefined);
});
test('short blocks preserve their palette mixture instead of randomly repeating a minority colour',()=>{
 const kx=111320*Math.cos(52.3*Math.PI/180);
 const block:StreetAppearanceProfile={...profile,id:'short-block',segment:[[4.8,52.3],[4.8+72/kx,52.3]],recipes:[
  {weight:1,recipe:{family:'masonry',period:'canal',confidence:.7,wallHex:'#333333'}},
  {weight:2,recipe:{family:'masonry',period:'canal',confidence:.7,wallHex:'#884433'}},
  {weight:1,recipe:{family:'masonry',period:'canal',confidence:.7,wallHex:'#ddddcc'}},
 ]};
 const colours=[9,27,45,63].map(x=>recipeForWall([block],{start:[4.8+x/kx,52.3001],end:[4.8+x/kx,52.3001],normal:[0,-1]},building)?.wallHex).sort();
 assert.deepEqual(colours,['#333333','#884433','#884433','#ddddcc']);
});
test('corner fronts choose independent side profiles',()=>{
 const east:StreetAppearanceProfile={...profile,id:'east',segment:[[4.8007,52.299],[4.8007,52.301]],side:-1,recipes:[{weight:1,recipe:{family:'punched',period:'modern',confidence:.7}}]};
 assert.equal(recipeForWall([east,profile],wall,building)?.family,'masonry');
 const corner={start:[4.8008,52.3001] as const,end:[4.8008,52.3002] as const,normal:[-1,0] as const};
 assert.equal(recipeForWall([profile,east],corner,building)?.family,'punched');
});
test('actual eligible frontage cohort realizes charcoal without gaps, modern infill, or duplicated mesh parts consuming its slot',()=>{
 const kx=111320*Math.cos(52.3*Math.PI/180);
 const street:StreetAppearanceProfile={...profile,recipes:[
  {weight:3,yearMax:1945,recipe:{family:'masonry',period:'canal',confidence:.7,wallHex:'#774433'}},
  {weight:2,yearMax:1945,recipe:{family:'masonry',period:'canal',confidence:.7,wallHex:'#333333'}},
  {weight:1,yearMax:1945,recipe:{family:'masonry',period:'canal',confidence:.7,wallHex:'#ddddbb'}},
  {weight:1,yearMin:1946,recipe:{family:'punched',period:'modern',confidence:.7,wallHex:'#999988'}},
 ]};
 const front=(id:string,start:number,width:number,year=1890):StreetAppearanceFront=>({building:{id,year,heightM:15},wall:{start:[4.8+start/kx,52.3001],end:[4.8+(start+width)/kx,52.3001],normal:[0,-1]}});
 // Unequal surveyed fronts with gaps do not line up with an 18m assembly grid.
 const fronts=[front('a',3,5),front('b',11,9),front('c',24,4),front('d',37,12),front('e',60,6),front('f',91,8),front('modern',75,10,1990)];
 const duplicated=[...fronts,front('a',3,5),front('a',4,3),{...front('curated',105,8),eligible:false}];
 const map=compileStreetAppearanceAssignments([street],duplicated);
 assert.equal(map.size,7);
 const historical=fronts.slice(0,6).map(f=>recipeForWall([street],f.wall,f.building,map)!.wallHex);
 assert.equal(historical.filter(c=>c==='#774433').length,3);
 assert.equal(historical.filter(c=>c==='#333333').length,2);
 assert.equal(historical.filter(c=>c==='#ddddbb').length,1);
 assert.equal(recipeForWall([street],fronts[6].wall,fronts[6].building,map)?.family,'punched');
 const records=streetAppearanceFrontageRecords(street,map);
 assert.deepEqual(records,streetAppearanceFrontageRecords(street,compileStreetAppearanceAssignments([street],duplicated.slice().reverse())));
 assert.deepEqual(records,streetAppearanceFrontageRecords(street,compileStreetAppearanceAssignments([street],fronts)));
 const baked={...street,frontages:records};validateStreetAppearanceCatalog({schemaVersion:1,revision:'baked',profiles:[baked]});
 // Streaming a single building uses the frozen full-cohort allocation unchanged.
 for(const f of fronts)assert.deepEqual(recipeForWall([baked],f.wall,f.building),recipeForWall([street],f.wall,f.building,map));
 assert.equal(recipeForWall([baked],fronts[0].wall,{...fronts[0].building,year:2000}),undefined);
});
test('cohort allocation retains separate corner sides and rejects unsupported towers',()=>{
 const east:StreetAppearanceProfile={...profile,id:'east',segment:[[4.8007,52.299],[4.8007,52.301]],side:-1,recipes:[{weight:1,recipe:{family:'punched',period:'modern',confidence:.7}}]};
 const corner={start:[4.8008,52.3001] as const,end:[4.8008,52.3002] as const,normal:[-1,0] as const};
 const map=compileStreetAppearanceAssignments([profile,east],[{building,wall},{building,wall:corner},{building:{...building,id:'tower',heightM:45},wall}]);
 assert.equal(map.size,2);
 assert.equal(recipeForWall([profile,east],wall,building,map)?.family,'masonry');
 assert.equal(recipeForWall([profile,east],corner,building,map)?.family,'punched');
});
test('overlap supplies one vote per spatial cell and lower quality duplicates cannot dominate',()=>{
 const a:Observation={profileId:'north',startM:0,endM:25,quality:.7,evidence,recipes:profile.recipes};
 const b:Observation={...a,quality:.5,evidence:{...evidence,id:'b',sha256:'b'.repeat(64)},recipes:[{weight:1,recipe:{family:'ribbon',period:'modern',confidence:.7}}]};
 const x=aggregateObservations(profile,[a,b,b]);
 assert.equal(x.recipes.length,1);assert.equal(x.recipes[0].weight,5);assert.equal(x.evidence.length,1);
 assert.deepEqual(x,aggregateObservations(profile,[b,a]));
});
test('catalog rejects malformed inference and degenerate geometry',()=>{
 const catalog={schemaVersion:1,revision:'1',profiles:[profile]};assert.equal(validateStreetAppearanceCatalog(catalog),catalog);
 assert.throws(()=>validateStreetAppearanceCatalog({...catalog,profiles:[{...profile,recipes:[{weight:1,recipe:{family:'invented',period:'c19',confidence:.7}}]}]}));
 assert.throws(()=>validateStreetAppearanceCatalog({...catalog,profiles:[{...profile,segment:[profile.segment[0],profile.segment[0]]}]}));
 assert.throws(()=>validateStreetAppearanceCatalog({...catalog,profiles:[{...profile,evidence:[{...evidence,sha256:'unknown'}]}]}));
 for(const invalid of [{windowProportions:'round'},{frameColor:'neon'},{lintel:'invented'},{paleAccents:'yes'},{trim:{frames:.5}}])assert.throws(()=>validateStreetAppearanceCatalog({...catalog,profiles:[{...profile,recipes:[{weight:1,recipe:{...profile.recipes[0].recipe,...invalid}}]}]}));
 assert.throws(()=>validateStreetAppearanceCatalog({...catalog,profiles:[{...profile,learnedFrom:'missing',holdout:true}]}));
 for(const frontages of [[{buildingId:'a',recipeIndex:99}],[{buildingId:'a',recipeIndex:0},{buildingId:'a',recipeIndex:0}],[{buildingId:'',recipeIndex:0}]])assert.throws(()=>validateStreetAppearanceCatalog({...catalog,profiles:[{...profile,frontages}]}));
 for(const invalid of [{sash:'round'},{trimDensity:'unknown'},{wallMaterial:'glass'},{atticWindows:'yes'}])assert.throws(()=>validateStreetAppearanceCatalog({...catalog,profiles:[{...profile,recipes:[{weight:1,recipe:{...profile.recipes[0].recipe,...invalid}}]}]}));
 assert.equal(validateStreetAppearanceCatalog({...catalog,streetFrontPaths:[{highway:'pedestrian',points:[[4.8,52.3],[4.801,52.3]]}]}).streetFrontPaths?.length,1);
 for(const streetFrontPaths of [[{points:[[4.8,52.3]]}],[{points:[[4.8,52.3],[NaN,52.3]]}],[{highway:42,points:[[4.8,52.3],[4.801,52.3]]}]])assert.throws(()=>validateStreetAppearanceCatalog({...catalog,streetFrontPaths}));
});
test('local perspective actually separates opposite headings using municipal north-center convention',()=>{
 const width=400,height=200,data=Buffer.alloc(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;data[i]=Math.abs(x-width/2)<50?0:240;data[i+1]=Math.abs(x-width/2)<50?240:0;data[i+3]=255;}
 const source=jpeg.encode({data,width,height},95).data;
 const north=jpeg.decode(perspectiveCrop(source,0,32,20,60,0));const south=jpeg.decode(perspectiveCrop(source,180,32,20,60,0));
 const center=(10*32+16)*4;
 assert.ok(north.data[center+1]>200&&north.data[center]<30);
 assert.ok(south.data[center]>200&&south.data[center+1]<30);
});

test('positive character classes stay inside observed height/date bounds and retain ordinary defaults',()=>{
 const p:StreetAppearanceProfile={...profile,recipes:[...profile.recipes,{weight:1,priority:1,cornerOnly:true,heightMin:15,heightMax:22,yearMax:1918,recipe:{family:'masonry',period:'c19',confidence:.8,wallHex:'#947768',facadeAssembly:'stacked-iron-balcony'}}]};
 for(const [year,height,expected] of [[1906,17.08,true],[1906,12.06,false],[1928,17.6,false],[1939,20,false],[1906,23,false],[null,17.08,false]] as const){
  const b={id:`${year}-${height}`,year,heightM:height,streetCorner:true};
  assert.equal(recipeForWall([p],wall,b)?.facadeAssembly==='stacked-iron-balcony',expected);
  const assignments=compileStreetAppearanceAssignments([p],[{building:b,wall}]);
  assert.equal([...assignments.values()][0]?.facadeAssembly==='stacked-iron-balcony',expected,'baked cohorts share native dimensional admission');
 }
 assert.notEqual(recipeForWall([p],wall,{id:'non-corner',year:1906,heightM:17.08,streetCorner:false})?.facadeAssembly,'stacked-iron-balcony');
 assert.equal(recipeForWall([p],{...wall,normal:[0,1]}, {id:'rear',year:1906,heightM:17.08}),undefined);
 for(const change of [{heightMin:23,heightMax:15},{heightMin:NaN},{priority:1.5},{priority:11}])assert.throws(()=>validateStreetAppearanceCatalog({schemaVersion:1,revision:'x',profiles:[{...p,recipes:[{...p.recipes[1],...change}]}]}));
});
