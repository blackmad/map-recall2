import assert from 'node:assert/strict';
import test from 'node:test';
import { streetWallBuilding, PROCEDURAL_RECIPE_LAYER_OFFSET } from './streetFacadeRendering.js';
import { ThreeBuildings, calmBayLayers } from './threeBuildingsBrowser.js';
import { CELL_PX } from './facadeCells.js';
import { buildFeatureChunk, type Feature } from './threeBuildingFeatures.js';
import type { MeshBuilding } from './threeBuildingMesh.js';
import type { StreetAppearanceProfile } from './streetAppearance.js';

const origin = { lng: 4.9, lat: 52.37 }, kx = 111320 * Math.cos(origin.lat * Math.PI / 180);
const ll = (x: number, y: number): [number, number] => [origin.lng + x / kx, origin.lat + y / 110540];
const profile = (id = 'south', segment = [ll(-20, 0), ll(30, 0)], side: -1 | 1 = 1, wallHex = '#713d30'): StreetAppearanceProfile => ({
  id, segment: segment as [[number, number], [number, number]], side, streetName: id, revision: id, confidence: .8, assemblyM: 18, reachM: 25, status: 'pilot',
  evidence: [{ id: 'test-evidence', kind: 'user-reference', sha256: 'a'.repeat(64), inference: 'agent-visual-review', quality: .8, notes: 'Synthetic test fixture' }],
  recipes: [{ weight: 1, recipe: { family: 'masonry', period: 'c19', confidence: .8, wallHex, bayScale: .85, trim: { frames: .9, lintels: .8, cornice: .9, courses: .8, quoins: .7, arches: .1 } } }],
});
const base = (look: 'photo' | 'storybook' | 'cartoon' | 'procedural' = 'photo'): MeshBuilding => ({
  id: 'fixture', polygons: [[[ll(0, 5), ll(10, 5), ll(10, 15), ll(0, 15), ll(0, 5)]]],
  heightM: 12, minHeightM: 0, style: 'modern', wallHex: '#bbbbbb',
  streetAppearance: { profiles: [profile(), profile('west', [ll(-5, -20), ll(-5, 30)], -1, '#302c2b')], year: 1900, look },
});
const south = { x0: 0, y0: 5, x1: 10, y1: 5, nx: 0, ny: -1, hole: false };

test('Photo brick keeps relief while source tint owns its hue and glass stays untinted', () => {
  const pixels = CELL_PX * CELL_PX, colour = new Uint8Array(pixels * 4), mask = new Uint8Array(pixels * 2);
  for (let i = 0; i < pixels; i++) { colour.set([180,90,60,255],i*4);mask.set([255,0],i*2); }
  // One pale frame / glass pixel belongs to neither colour role.
  colour.set([160,180,200,255],4); mask.set([0,0],2);
  // A darker brick contributes real luminance variation, not red chroma.
  colour.set([120,60,40,255],8);
  calmBayLayers(colour,mask,1,'photo');
  assert.equal(colour[0],colour[1]);assert.equal(colour[1],colour[2]);
  assert.equal(colour[8],colour[9]);assert.equal(colour[9],colour[10]);
  assert.ok(colour[8]<colour[0]);assert.deepEqual([...colour.slice(4,8)],[160,180,200,255]);
});

test('corner fronts independently inherit street sides without changing surveyed geometry', () => {
  const b = base(), a = streetWallBuilding(b, south, origin, true);
  const west = streetWallBuilding(b, { x0: 0, y0: 15, x1: 0, y1: 5, nx: -1, ny: 0, hole: false }, origin, true);
  assert.equal(a.recipe?.profileId, 'south'); assert.equal(west.recipe?.profileId, 'west');
  assert.equal(a.wallHex, '#713d30'); assert.equal(west.wallHex, '#302c2b');
  assert.equal(a.polygons, b.polygons); assert.equal(a.heightM, b.heightM); assert.equal(a.id, b.id);
  assert.equal(b.recipe, undefined);
});

test('back walls, courtyards, bare walls and landmark walls retain existing appearance', () => {
  const b = base();
  assert.equal(streetWallBuilding(b, south, origin, false), b);
  assert.equal(streetWallBuilding(b, { ...south, hole: true }, origin, true), b);
  assert.equal(streetWallBuilding(b, { ...south, ny: 1 }, origin, true), b);
  for (const flag of ['bare', 'plainWalls'] as const) { const held = { ...b, [flag]: true }; assert.equal(streetWallBuilding(held, south, origin, true), held); }
});

test('same profile choices survive look changes and procedural indices do not collide with roofs', () => {
  for (const look of ['photo', 'storybook', 'cartoon', 'procedural'] as const) {
    const a = streetWallBuilding(base(look), south, origin, true);
    assert.equal(a.recipe?.profileId, 'south'); assert.equal(a.style, 'c19');
    assert.deepEqual(a, streetWallBuilding(base(look), south, origin, true));
    if (look === 'procedural') assert.ok(a.layers!.upper >= PROCEDURAL_RECIPE_LAYER_OFFSET && a.layers!.upper < 256);
  }
  const b = base(); b.streetAppearance!.mappedWallHex = '#112233';
  assert.equal(streetWallBuilding(b, south, origin, true).wallHex, '#112233');
});

test('profile-aware chunks remain deterministic and preserve feature data and identity', () => {
  const b = base();
  const f: Feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: b.polygons[0] }, properties: { id: b.id, height: 12, facade: 'c19-priorBrickRed', facadeStyle: 'c19', constructionYear: 1900, sideColour: '#a4523b' } };
  const original = JSON.stringify(f), streets = new Float32Array([-20, 0, 30, 0]);
  for (const look of ['photo', 'storybook', 'cartoon', 'procedural', 'untextured'] as const) {
    const a = buildFeatureChunk([f], look, 'walls', streets, [profile()]);
    assert.deepEqual(a, buildFeatureChunk([f], look, 'walls', streets, [profile()]));
    assert.equal(a.ranges[0].id, b.id); assert.ok(a.vertexCount > 0);
    assert.ok([...a.positions].every(Number.isFinite));
    const without = buildFeatureChunk([f], look, 'walls', streets);
    if (look === 'untextured') assert.deepEqual(a, without);
    else assert.notDeepEqual(a.tints, without.tints, 'street evidence must actually reach the rendered wall');
  }
  assert.equal(JSON.stringify(f), original);
});

test('profile revision invalidates pending worker results and detaches caller inputs', () => {
  const map = { triggerRepaint() {}, getZoom: () => 18, getCanvas: () => ({}) };
  const renderer = new ThreeBuildings(map as never, {} as never) as any;
  renderer.sourceGroups.set('tile', []); renderer.gens.set('tile', 1);
  renderer.inflight.set('tile', []); renderer.inflightOptions.set('tile', { appearanceRevision: 'old' });
  renderer.pending.push(() => { throw Error('obsolete build ran'); });
  const catalog = { schemaVersion: 1 as const, revision: 'new', profiles: [profile()] };
  renderer.setStreetAppearance(catalog);
  assert.equal(renderer.inflight.size, 0); assert.equal(renderer.inflightOptions.size, 0);
  assert.equal(renderer.gens.get('tile'), 2); assert.equal(renderer.pending.length, 1);
  catalog.profiles[0].recipes[0].recipe.wallHex = '#ffffff';
  assert.equal(renderer.appearanceProfiles[0].recipes[0].recipe.wallHex, '#713d30');
  renderer.setStreetAppearance(catalog); assert.equal(renderer.gens.get('tile'), 2);
  // An independently returned stale revision cannot install a mesh.
  renderer.THREE = {}; renderer.look = renderer.requestedLook = 'photo';
  renderer.install('tile', renderer.sourceGroups.get('tile'), {}, 0, { look: 'photo', appearanceRevision: 'old', profiles: [] });
  assert.equal(renderer.chunks.size, 0);
});

test('architectural street fronts survive an empty navigation network and detach input coordinates', () => {
  const renderer = new ThreeBuildings({ triggerRepaint() {}, getZoom: () => 18, getCanvas: () => ({}) } as never, {} as never) as any;
  const catalog = { schemaVersion: 1 as const, revision: 'architecture-streets', profiles: [profile()], streetFrontPaths: [{ highway: 'residential', points: [ll(-20,0),ll(30,0)] }] };
  renderer.setStreetAppearance(catalog);
  const feature: Feature = { type:'Feature', geometry:{type:'Polygon',coordinates:base().polygons[0]},properties:{id:'fixture',height:12} };
  const first = renderer.streetsFor([feature]); assert.ok(first.length>=4);
  renderer.setStreets([]); assert.deepEqual(renderer.streetsFor([feature]),first);
  catalog.streetFrontPaths[0].points[0][0] = 0;
  assert.deepEqual(renderer.streetsFor([feature]),first);
});

test('short exposed native returns inherit only their exact admitted frontage color and quiet single-column openings',async()=>{
  const {readFileSync}=await import('node:fs');
  const catalog=JSON.parse(readFileSync(new URL('../../public/data/street-appearance/profiles.json',import.meta.url),'utf8')) as {profiles:StreetAppearanceProfile[]};
  const profiles=catalog.profiles.filter(p=>p.id==='oudezijds-voorburgwal-east-39-71-discovery');
  const samples=[
    {id:'NL.IMBAG.Pand.0363100012177971',a:[4.899194,52.374276],b:[4.899181,52.374265]},
    {id:'NL.IMBAG.Pand.0363100012177969',a:[4.899326,52.374393],b:[4.899315,52.374381]},
    {id:'NL.IMBAG.Pand.0363100012172010',a:[4.898855,52.374016],b:[4.898869,52.37401]},
  ];
  for(const sample of samples)for(const look of ['photo','cartoon','procedural'] as const){
    const building:MeshBuilding={...base(look),id:sample.id,shop:true,shopfront:true,accentHex:'#e58c35',groundHex:'#34974d',streetAppearance:{profiles,year:1994,look}};
    const wall={x0:(sample.a[0]-origin.lng)*kx,y0:(sample.a[1]-origin.lat)*110540,x1:(sample.b[0]-origin.lng)*kx,y1:(sample.b[1]-origin.lat)*110540,nx:1,ny:0,hole:false};
    const inherited=streetWallBuilding(building,wall,origin,false);
    assert.notEqual(inherited,building,`${sample.id}: native shallow return inherits even outside doorAllowed`);
    assert.deepEqual(streetWallBuilding(building,wall,origin,true),inherited,'short street returns keep one quiet column rather than squeezed frontage groups');
    assert.equal(inherited.plainWalls,false);assert.equal(inherited.recipe,undefined,'return gains no facade/roof source class');
    assert.notEqual(inherited.layers!.upper,inherited.plainLayer);assert.notEqual(inherited.layers!.ground,inherited.plainLayer);assert.equal(inherited.layers!.door,inherited.layers!.ground);
    const {BAY_ENTRIES,bayVariant}=await import('./bayLook.js');
    const offset=look==='procedural'?PROCEDURAL_RECIPE_LAYER_OFFSET:0;
    const variant=bayVariant(BAY_ENTRIES[inherited.layers!.upper-offset]);
    assert.equal(variant.windows,1);assert.equal(variant.openingGroup,'canal-return');
    assert.equal(inherited.groundHex,undefined,'stock shop paint cannot interrupt masonry');
    assert.equal(inherited.polygons,building.polygons);assert.equal(inherited.heightM,building.heightM);
    assert.equal(streetWallBuilding(building,{...wall,hole:true},origin,false),building);
    assert.equal(streetWallBuilding(building,{...wall,x0:wall.x0+10,x1:wall.x1+10,y0:wall.y0+10,y1:wall.y1+10},origin,false),building,'rear returns excluded');
    assert.equal(streetWallBuilding(building,{...wall,x1:wall.x0+3,y1:wall.y0},origin,false),building,'long side walls excluded');
    const neighbor={...building,id:'unadmitted-neighbor'};assert.equal(streetWallBuilding(neighbor,wall,origin,false),neighbor,'nearby identity never borrows baked admission');
    const unbaked={...building,streetAppearance:{...building.streetAppearance!,profiles:profiles.map(p=>({...p,frontages:undefined}))}};
    assert.equal(streetWallBuilding(unbaked,wall,origin,false),unbaked,'unbaked profiles cannot color a return');
    const mapped={...building,streetAppearance:{...building.streetAppearance!,mappedWallHex:'#54321f'}};
    assert.equal(streetWallBuilding(mapped,wall,origin,false).wallHex,'#54321f','mapped source colors retain authority');
  }
});
