import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildFeatureChunk, meshBuildingFor, ORIGIN, type Feature } from '../src/canalRecall/threeBuildingFeatures.ts';
import { decorateRoof } from '../src/canalRecall/roofMesh.ts';
import { BuildingTileStreamer } from '../src/canalRecall/buildingTilesBrowser.ts';

const kx = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const ll = (x: number, y: number) => [ORIGIN.lng + x / kx, ORIGIN.lat + y / 110540];
const f: Feature = { type: 'Feature', properties: { id: 'court', height: 18, roofEavesHeightM: 14, minHeight: 0, facade: 'c19-priorBrickRed', facadeStyle: 'c19', constructionYear: 1890 }, geometry: { type: 'Polygon', coordinates: [
  [[0,0],[20,0],[20,20],[0,20],[0,0]].map(([x,y]) => ll(x,y)),
  [[5,5],[5,15],[15,15],[15,5],[5,5]].map(([x,y]) => ll(x,y)),
] } };
const coarse = buildFeatureChunk([f], 'photo', 'coarse');
assert.equal(coarse.ranges[0].id, 'court', 'coarse shell retains inspection identity');
assert.ok(coarse.vertexCount <= buildFeatureChunk([f], 'photo').vertexCount, 'an already simple courtyard shell does not grow');
for (const look of ['photo', 'storybook', 'cartoon'] as const) {
  const shell = buildFeatureChunk([f], look, 'coarse');
  const appearance = meshBuildingFor(f, look, true)!;
  assert.ok(shell.layers.includes(appearance.layers!.upper), `${look}: distant walls retain their window atlas`);
  assert.ok(shell.layers.includes(appearance.layers!.door), `${look}: distant ground floors retain their door atlas`);
}
assert.equal(Math.max(...coarse.positions.filter((_,i) => i % 3 === 2)), 18, 'coarse shell keeps the total building height, not just the eaves');
let lidArea = 0;
for (let i=0; i<coarse.indices.length; i+=3) {
  const p = Array.from(coarse.indices.slice(i,i+3), v => Array.from(coarse.positions.slice(v*3,v*3+3)));
  if (!p.every(v => v[2] === 18)) continue;
  const area = Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]))/2;
  lidArea += area;
  const x = p.reduce((s,v) => s+v[0],0)/3, y = p.reduce((s,v) => s+v[1],0)/3;
  assert.ok(!(x>5 && x<15 && y>5 && y<15), 'coarse roof leaves the courtyard open');
}
assert.ok(Math.abs(lidArea-300)<0.01, 'coarse roof area equals footprint minus courtyard');
const tile = JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8413/5384.geojson.gz')).toString());
const features = tile.features.map((f: Feature) => decorateRoof({ ...f, properties: { ...f.properties, facade: 'c19-priorBrickRed', facadeStyle: 'c19', constructionYear: 1890 } }));
const full = buildFeatureChunk(features, 'photo'), low = buildFeatureChunk(features, 'photo', 'coarse');
assert.deepEqual(low.ranges.map(r=>r.id), full.ranges.map(r=>r.id), 'real tile retains every building identity');
assert.ok(low.vertexCount < full.vertexCount * .5, 'real tile geometry falls by at least half');
console.log(JSON.stringify({ buildings: low.buildingCount, fullVertices: full.vertexCount, coarseVertices: low.vertexCount, reduction: 1-low.vertexCount/full.vertexCount }));

// The intro follows a fixed landing area while its visible camera sweeps the city.
const oldFetch = globalThis.fetch;
let requests = 0, writes = 0;
const map = { getSource: () => ({ setData: () => { writes++; } }), getCenter: () => ({lng:0,lat:0}), getZoom: () => 13,
  getBounds: () => ({ getWest:()=>0, getEast:()=>1, getSouth:()=>0, getNorth:()=>1 }), on:()=>{} };
const streamer = new BuildingTileStreamer(map, 'buildings', '/test');
try {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes('index-z')) return Response.json({zoom:14,tileList:['test']});
    requests++;
    assert.ok(!String(input).includes('/8192/'), 'preload targets Amsterdam, not the overview camera at 0,0');
    return Response.json({ type:'FeatureCollection', features:[f] });
  }) as typeof fetch;
  await streamer.probe(); streamer.attach(); streamer.setSuspended(true); streamer.preloadAt(4.8737,52.3728);
  for(let i=0;i<30 && !writes;i++) await new Promise(r=>setTimeout(r,0));
  assert.ok(writes>0, 'landing buildings flush while intro camera planning is suspended');
  const before=requests;
  streamer.preloadAt(4.8737,52.3728); streamer.followCamera();
  await new Promise(r=>setTimeout(r,0));
  assert.equal(requests,before,'intro camera ticks do not replan or refetch');
} finally { streamer.dispose(); globalThis.fetch=oldFetch; }
console.log('building LOD and intro preload: ok');
