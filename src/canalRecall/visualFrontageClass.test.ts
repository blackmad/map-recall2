import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import {
  admittedStreetAppearanceVisualClass, compileStreetAppearanceAssignments, matchStreetAppearanceProfile,
  profileLocation, recipeForWall, streetAppearanceFrontageRecords, validateStreetAppearanceCatalog,
  type StreetAppearanceProfile, type StreetAppearanceFront, type StreetAppearanceWall, type StreetPoint,
} from './streetAppearance.ts';

const segment: StreetAppearanceProfile['segment'] = [[4.89819,52.371758],[4.898948,52.371522]];
const base: StreetAppearanceProfile = {
  id:'general',revision:'native-test',streetName:'Bethaniënstraat',segment,side:-1,reachM:12,confidence:.8,assemblyM:12,status:'reviewed',
  evidence:[{id:'neck-view',kind:'municipal-panorama',captureDate:'2017-03-29',sha256:'a'.repeat(64),url:'https://t1.data.amsterdam.nl/panorama/2017/neck.jpg',panoramaId:'neck-station',inference:'agent-visual-review',quality:.9,notes:'Independent historic-looking front observation'}],
  recipes:[{weight:1,yearMin:1970,recipe:{family:'punched',period:'modern',confidence:.8,wallHex:'#dedbd1',facadeAssembly:'stacked-open-balcony'}}],
};
const segmentPoint=(along:number,depth=0):StreetPoint=>{
  const loc=profileLocation(base,segment[0])!,kx=111320*Math.cos(segment[0][1]*Math.PI/180);
  return [segment[0][0]+(along*loc.dx/loc.lengthM-depth*loc.dy/loc.lengthM)/kx,segment[0][1]+(along*loc.dy/loc.lengthM+depth*loc.dx/loc.lengthM)/110540];
};
const visual: StreetAppearanceProfile={...base,id:'observed-pair',segment:[segmentPoint(10),segmentPoint(27)],confidence:.7,
  visualClass:{kind:'historic-frontage',sourceEvidenceIds:['neck-view'],constructionYearPolicy:'source-visual'},
  recipes:['neck','plain'].map(crownShape=>({weight:1,yearMax:1900,heightMin:8,heightMax:14,frontageMin:4,frontageMax:6.5,priority:1,recipe:{family:'masonry',period:'canal',confidence:.8,wallHex:'#654438',sash:'paired-transom',crownShape:crownShape as 'neck'|'plain'}})),
};
const catalog=(profiles:StreetAppearanceProfile[])=>({schemaVersion:1,revision:'native-test',profiles});
const normal=()=>{const loc=profileLocation(base,segment[0])!;return [-loc.dy/loc.lengthM,loc.dx/loc.lengthM] as const;};
const front=(id:string,start:number,width:number,heightM=11,depth=-3):StreetAppearanceFront=>({building:{id,year:1992,heightM},wall:{start:segmentPoint(start,depth),end:segmentPoint(start+width,depth),normal:normal()}});
const complete=(wall:StreetAppearanceWall,widthM:number):StreetAppearanceWall=>({...wall,frontage:{start:wall.start,end:wall.end,widthM}});

test('reviewed source class admits appearance without mutating genuine construction facts; defaults retain dates',()=>{
  assert.equal(admittedStreetAppearanceVisualClass(visual),true);
  validateStreetAppearanceCatalog(catalog([base,visual]));
  const f=front('observed',14,4.7),original=structuredClone(f);
  assert.equal(recipeForWall([base,visual],complete(f.wall,4.7),f.building)?.period,'canal');
  assert.deepEqual(f,original);
  assert.equal(recipeForWall([{...visual,visualClass:undefined,recipes:visual.recipes.map(r=>({...r,recipe:{...r.recipe,crownShape:undefined}}))}],complete(f.wall,4.7),f.building),undefined);
});

test('spatially stronger general profile yields to eligible class; rejection falls through for width, height, side and missing full run',()=>{
  const narrow=front('observed',14,4.7);
  assert.equal(recipeForWall([base,visual],complete(narrow.wall,4.7),narrow.building)?.profileId,visual.id);
  const broad=front('modern',12,9.47);
  for(const [wall,building] of [[complete(broad.wall,9.47),broad.building],[complete(narrow.wall,4.7),{...narrow.building,heightM:18}],[narrow.wall,narrow.building]] as const)
    assert.equal(recipeForWall([visual,base],wall,building)?.profileId,base.id);
  const opposite=front('modern-opposite',14,4.7,11,3);opposite.wall.normal=[-normal()[0],-normal()[1]];
  const oppositeProfile={...base,id:'opposite',side:1 as const};
  assert.equal(recipeForWall([visual,base,oppositeProfile],complete(opposite.wall,4.7),opposite.building)?.profileId,'opposite');
  assert.equal(recipeForWall([visual,base],{...complete(narrow.wall,4.7),normal:[-normal()[0],-normal()[1]]},narrow.building),undefined);
});

test('complete broad modern run spanning the short boundary cannot pass via tessellated narrow edges',()=>{
  const parts=[front('broad',7,4.7),front('broad',11.7,4.7),front('broad',16.4,4.7)];
  const assignments=compileStreetAppearanceAssignments([visual,base],parts);
  assert.equal(streetAppearanceFrontageRecords(visual,assignments).length,0);
  assert.equal(streetAppearanceFrontageRecords(base,assignments).length,1);
  for(const p of parts)assert.equal(recipeForWall([visual,base],p.wall,p.building,assignments)?.profileId,base.id);
  // The overlap inside the short source class is only 6.1m; full run remains 14.1m.
  const outside=[front('broad-boundary',23,5),front('broad-boundary',28,5)];
  assert.equal(streetAppearanceFrontageRecords(visual,compileStreetAppearanceAssignments([visual,base],outside)).length,0);
});


test('oblique exposed runs retain their actual broad width rather than a narrow street projection',()=>{
  // 8m real length projects to 5.6m along the observed source segment. Its
  // outward normal still meets the 0.65 facing gate, but its width must reject.
  const start=segmentPoint(15,-3),end=segmentPoint(20.6,-3-Math.sqrt(8*8-5.6*5.6));
  const kx=111320*Math.cos(segment[0][1]*Math.PI/180),dx=(end[0]-start[0])*kx,dy=(end[1]-start[1])*110540;
  const f:StreetAppearanceFront={building:{id:'oblique-modern',year:1992,heightM:11},wall:{start,end,normal:[-dy,dx]}};
  const assignments=compileStreetAppearanceAssignments([visual,base],[f]);
  assert.equal(streetAppearanceFrontageRecords(visual,assignments).length,0);
  assert.equal(recipeForWall([visual,base],f.wall,f.building,assignments)?.profileId,base.id);
});

const nativeTile=JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz')).toString());
const nativeIds=['NL.IMBAG.Pand.0363100012178208','NL.IMBAG.Pand.0363100012178531','NL.IMBAG.Pand.0363100012178209','NL.IMBAG.Pand.0363100012178532'];
function nativeFronts(rotation:number,split=false):StreetAppearanceFront[]{
  const fronts:StreetAppearanceFront[]=[];
  for(const id of nativeIds){
    const feature=nativeTile.features.find((f:any)=>f.properties.id===id);assert.ok(feature,`native footprint ${id}`);
    const ring:StreetPoint[]=feature.geometry.coordinates[0].slice(0,-1),rotated=[...ring.slice(rotation%ring.length),...ring.slice(0,rotation%ring.length)];
    const kx=111320*Math.cos(segment[0][1]*Math.PI/180);
    for(let i=0;i<rotated.length;i++){
      const start=rotated[i],end=rotated[(i+1)%rotated.length],dx=(end[0]-start[0])*kx,dy=(end[1]-start[1])*110540;
      const wall:StreetAppearanceWall={start,end,normal:[dy,-dx]};
      if(!matchStreetAppearanceProfile([base],wall))continue;
      const building={id,year:1992,heightM:feature.properties.height};
      if(split){const middle:StreetPoint=[(start[0]+end[0])/2,(start[1]+end[1])/2];fronts.push({building,wall:{...wall,end:middle}},{building,wall:{...wall,start:middle}});}
      else fronts.push({building,wall});
    }
  }
  return fronts;
}

test('native stepped outlines retain pair/modern boundary under ring rotation, duplicated parts and full-cohort bake',()=>{
  const original=nativeFronts(0),snapshot=structuredClone(original),assignments=compileStreetAppearanceAssignments([visual,base],original);
  const pair=streetAppearanceFrontageRecords(visual,assignments);
  assert.deepEqual(pair.map(f=>f.buildingId),nativeIds.slice(1,3).sort());
  assert.deepEqual(pair.map(f=>f.recipeIndex).sort(),[0,1]);
  assert.ok(pair.every(f=>f.frontage!.widthM>=4&&f.frontage!.widthM<=6.5));
  assert.deepEqual(original,snapshot);
  for(const rotation of [1,3,5]){
    const split=nativeFronts(rotation,true).reverse();
    const replay=compileStreetAppearanceAssignments([base,visual],[...split,...split]);
    assert.deepEqual(streetAppearanceFrontageRecords(visual,replay),pair);
  }
  const baked=[{...visual,frontages:pair},{...base,frontages:streetAppearanceFrontageRecords(base,assignments)}];
  validateStreetAppearanceCatalog(catalog(baked));
  for(const f of nativeFronts(4,true)){
    // Independently streamed tessellation supplies only half a native run.
    const kx=111320*Math.cos(segment[0][1]*Math.PI/180),width=Math.hypot((f.wall.end[0]-f.wall.start[0])*kx,(f.wall.end[1]-f.wall.start[1])*110540);
    const recipe=recipeForWall(structuredClone(baked),complete(f.wall,width),f.building);
    assert.equal(recipe?.profileId,nativeIds.slice(1,3).includes(f.building.id)?visual.id:base.id);
    assert.deepEqual(recipe,recipeForWall([visual,base],f.wall,f.building,assignments));
    assert.equal(f.building.year,1992);
  }
});

test('visual-class provenance rejects unreviewed, model-only, missing, foreign or forged source admission and unbounded recipes',()=>{
  const invalid=[{...visual,status:'pilot'}, {...visual,holdout:true},{...visual,learnedFrom:base.id},
    {...visual,visualClass:{...visual.visualClass,sourceEvidenceIds:['missing']}},
    {...visual,visualClass:{...visual.visualClass,sourceEvidenceIds:['neck-view','neck-view']}},
    ...[{kind:'user-reference'},{inference:'model'},{captureDate:undefined},{panoramaId:undefined},{sha256:'bad'},{quality:.3},{url:'broken'},{url:'https://data.amsterdam.nl.evil.test/photo'}].map(change=>({...visual,evidence:[{...visual.evidence[0],...change}]})),
    {...visual,recipes:visual.recipes.map(r=>({...r,frontageMax:undefined}))},
    {...visual,recipes:visual.recipes.map(r=>({...r,frontageMin:8,frontageMax:4}))},
    {...visual,frontages:[{buildingId:'x',recipeIndex:0}]},
  ];
  for(const p of invalid)assert.throws(()=>validateStreetAppearanceCatalog(catalog([p as StreetAppearanceProfile])));
  assert.throws(()=>validateStreetAppearanceCatalog(catalog([{...base,recipes:[{...base.recipes[0],recipe:{...base.recipes[0].recipe,crownShape:'neck'}}]}])));
  const f=front('observed',14,4.7);
  assert.equal(recipeForWall([invalid[10] as StreetAppearanceProfile,base],complete(f.wall,4.7),f.building)?.profileId,base.id);
});
