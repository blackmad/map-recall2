import {recipeLayoutScale} from './streetFacadeRendering.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { shortBuildingId } from './buildingFacts.ts';
import {
  compileStreetAppearanceAssignments, matchStreetAppearanceProfile, recipeForWall,
  streetAppearanceFrontageRecords, validateStreetAppearanceCatalog,
  type StreetAppearanceFront, type StreetAppearanceProfile, type StreetPoint,
} from './streetAppearance.ts';

const catalog = validateStreetAppearanceCatalog(JSON.parse(readFileSync('public/data/street-appearance/profiles.json','utf8')));
const pilot = catalog.profiles.find(p=>p.id==='jan-evertsen-canopy-candidate-native-pair')!;
const inventory = JSON.parse(readFileSync('docs/references/jan-evertsen-pilot/candidate-inventory.json','utf8'));
const facts = JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-facts/14/8412/5384.json.gz')).toString());
const fronts: StreetAppearanceFront[] = inventory.candidates.map((c:any)=>{
  const [start,end]:[StreetPoint,StreetPoint]=c.frontageVertices;
  const dx=(end[0]-start[0])*111320*Math.cos(start[1]*Math.PI/180),dy=(end[1]-start[1])*110540;
  return {building:{id:c.id,year:facts.buildings[shortBuildingId(c.id)]?.[0] ?? null,heightM:c.properties.height},wall:{start,end,normal:[dy,-dx]}};
});
const representative = fronts.find(f=>f.building.id===pilot.buildingIds![0])!;
const isolated = (p:StreetAppearanceProfile)=>({schemaVersion:1,revision:'scope-test',profiles:[p]});

test('installed pilot compiles and resolves only its two representatives; native heldouts and transition remain excluded',()=>{
  assert.equal(pilot.status,'pilot');
  assert.equal(pilot.visualClass,undefined);
  assert.deepEqual([...pilot.buildingIds!].sort(),pilot.frontages!.map(f=>f.buildingId).sort());
  const assignments=compileStreetAppearanceAssignments([pilot],fronts);
  assert.deepEqual(streetAppearanceFrontageRecords(pilot,assignments).map(f=>f.buildingId).sort(),[...pilot.buildingIds!].sort());
  for(const front of fronts){
    const included=pilot.buildingIds!.includes(front.building.id);
    assert.equal(!!recipeForWall([pilot],front.wall,front.building,assignments)?.shopCanopy,included,front.building.id);
    assert.equal(!!matchStreetAppearanceProfile([pilot],front.wall,front.building.id),included);
  }
  assert.equal(matchStreetAppearanceProfile([pilot],representative.wall),undefined,'scope needs an identity even in spatial lookup');
  const split=fronts.flatMap(f=>{
    const middle:StreetPoint=[(f.wall.start[0]+f.wall.end[0])/2,(f.wall.start[1]+f.wall.end[1])/2];
    return [{...f,wall:{...f.wall,end:middle}},{...f,wall:{...f.wall,start:middle}}];
  });
  assert.deepEqual(streetAppearanceFrontageRecords(pilot,compileStreetAppearanceAssignments([pilot],[...split.reverse(),...split])),streetAppearanceFrontageRecords(pilot,assignments));
});

test('scope retains side, outward normal, year, height, width and source-visual admission gates',()=>{
  const assignments=compileStreetAppearanceAssignments([pilot],fronts);
  const f=representative;
  for(const [wall,building] of [
    [{...f.wall,normal:[-f.wall.normal[0],-f.wall.normal[1]] as const},f.building],
    [f.wall,{...f.building,year:2000}], [f.wall,{...f.building,heightM:30}],
  ] as const)assert.equal(recipeForWall([pilot],wall,building,assignments),undefined);
  assert.equal(recipeForWall([{...pilot,side:-1}],f.wall,f.building,assignments),undefined);
  const unbaked={...pilot,frontages:undefined};
  assert.equal(recipeForWall([unbaked],{...f.wall,frontage:{start:f.wall.start,end:f.wall.end,widthM:12}},f.building),undefined);
  const attemptedVisual={...pilot,visualClass:{kind:'historic-frontage',sourceEvidenceIds:[pilot.evidence[0].id],constructionYearPolicy:'source-visual'}} as StreetAppearanceProfile;
  assert.throws(()=>validateStreetAppearanceCatalog(isolated(attemptedVisual)),/invalid source visual class/);
  assert.equal(compileStreetAppearanceAssignments([attemptedVisual],fronts).size,0);
});

test('excluded identity falls back to eligible general profile in both runtime and compilation',()=>{
  const excluded=fronts.find(f=>f.building.id==='NL.IMBAG.Pand.0363100012072380')!;
  const general:StreetAppearanceProfile={...pilot,id:'general-scope-fallback',buildingIds:undefined,frontages:undefined,confidence:.6,
    recipes:[{weight:1,recipe:{family:'masonry',period:'school',confidence:.8,wallHex:'#998877'}}]};
  const assignments=compileStreetAppearanceAssignments([pilot,general],fronts);
  assert.equal(recipeForWall([pilot,general],excluded.wall,excluded.building,assignments)?.profileId,general.id);
  assert.ok(streetAppearanceFrontageRecords(general,assignments).some(f=>f.buildingId===excluded.building.id));
});

test('scope validator rejects empty, duplicate, malformed identities and out-of-scope baked records',()=>{
  for(const buildingIds of [[],[pilot.buildingIds![0],pilot.buildingIds![0]],[''],[' padded '],[null],42]){
    assert.throws(()=>validateStreetAppearanceCatalog(isolated({...pilot,buildingIds} as StreetAppearanceProfile)),/invalid street building scope/);
  }
  assert.throws(()=>validateStreetAppearanceCatalog(isolated({...pilot,buildingIds:[pilot.buildingIds![0]]})),/baked frontage outside building scope/);
});

test('pilot preserves real mapped shopfront kinds instead of introducing residential ground-floor windows',()=>{
  const shops=JSON.parse(readFileSync('public/data/extracts/amsterdam/shopfronts.json','utf8'));
  assert.equal(shops.kinds[shops.buildings['NL.IMBAG.Pand.0363100012118917']],'groundShop');
  assert.equal(shops.kinds[shops.buildings['NL.IMBAG.Pand.0363100012096187']],'shopWindow');
});

test('continuous canopy rows share a ground height rather than per-building jitter',()=>{
 const recipe=pilot.recipes[0].recipe;
 const a=recipeLayoutScale(recipe,{bay:.88,storey:.93,ground:.92});
 const b=recipeLayoutScale(recipe,{bay:1.18,storey:1.09,ground:1.12});
 assert.equal(a.ground,b.ground);
 assert.notEqual(a.storey,b.storey,'ordinary upper-storey variation remains');
});
