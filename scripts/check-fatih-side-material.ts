import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { KITS, decorateKitRoof, kitGeometry } from '../src/canalRecall/landmarkKits.ts';
import { meshBuildingFor, buildFeatureChunk, ORIGIN } from '../src/canalRecall/threeBuildingFeatures.ts';
import { buildKitChunk } from '../src/canalRecall/threeBuildingMesh.ts';
import { kitLayersFor } from '../src/canalRecall/galleryLayers.ts';
import { BAY_ENTRIES, BAY_LAYER_COUNT, FATIH_MASONRY_LAYER, bayLookFor } from '../src/canalRecall/bayLook.ts';
import { paintFatihMasonryCell, CELL_PX } from '../src/canalRecall/facadeCells.ts';
import { PROCEDURAL_RECIPE_LAYER_OFFSET } from '../src/canalRecall/streetFacadeRendering.ts';
const id='NL.IMBAG.Pand.0363100012167944';
const tile=JSON.parse(gunzipSync(fs.readFileSync('public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz')).toString());
const raw=tile.features.find((f:any)=>f.properties.id===id);
assert(raw); assert.equal(raw.properties.constructionYear,undefined);
assert.equal(bayLookFor(id,null,raw.properties.height,'photo').archetype,'modern','test reproduces missing-year smooth fallback');
const feature=decorateKitRoof(raw), b=meshBuildingFor(feature,'photo')!;
assert.equal(b.plainLayer,FATIH_MASONRY_LAYER);
assert.equal(b.wallHex,'#6a3a2e');
for(const look of ['photo','cartoon','procedural','untextured'] as const){
 const building=meshBuildingFor(feature,look)!;
 assert.equal(building.heightM,16,'material does not raise nave to tower height');
 if(look!=='photo')assert.notEqual(building.plainLayer,FATIH_MASONRY_LAYER);
}
for(const mode of ['walls','coarse'] as const){const shell=buildFeatureChunk([feature],'photo',mode);const tops=Array.from(shell.positions).filter((_,i)=>i%3===2);assert(Math.max(...tops)<=16.001,'coarse kit shell preserves semantic nave eaves, never tower maximum');}
const neighbour={...feature,properties:{...feature.properties,id:'retained-neighbour'}};
assert.notEqual(meshBuildingFor(neighbour,'photo')!.plainLayer,FATIH_MASONRY_LAYER,'override is exact identity');
const kx=111320*Math.cos(ORIGIN.lat*Math.PI/180), local=([x,y]:number[]):[number,number]=>[(x-ORIGIN.lng)*kx,(y-ORIGIN.lat)*110540];
const part={id,ring:raw.geometry.coordinates[0].map(local),minHeightM:0,heightM:raw.properties.height};
const kit=KITS.find(k=>k.name==='Fatih')!, geometry=kitGeometry(kit,new Map([[id,part]]));
const chunk=buildKitChunk(geometry,kitLayersFor('photo'));
for(let i=0;i<geometry[0].tris.length;i++) {
 const tri=geometry[0].tris[i];
 assert.equal(chunk.layers[i*3],tri.layer==='plain'?FATIH_MASONRY_LAYER:kitLayersFor('photo')[tri.layer],'roofs/glass/trim retain existing materials');
 if(tri.layer==='plain')assert(Math.abs((tri.uv[1][0]-tri.uv[0][0])*(tri.uv[2][1]-tri.uv[0][1])-(tri.uv[2][0]-tri.uv[0][0])*(tri.uv[1][1]-tri.uv[0][1]))>0,'masonry UV triangles have area');
}
const pixels=paintFatihMasonryCell();assert.equal(pixels.length,CELL_PX*CELL_PX*4);
assert.deepEqual(pixels,paintFatihMasonryCell(),'reproducible original pixels');
assert(new Set(pixels.filter((_,i)=>i%4===0)).size>20,'material has actual brick variation');
assert(BAY_ENTRIES[FATIH_MASONRY_LAYER].originalMasonry);
assert(PROCEDURAL_RECIPE_LAYER_OFFSET+BAY_LAYER_COUNT+1<=256,'all atlas indices fit Uint8');
// The sourced Bloemstraat rear runs between these two source vertices.
const [a,c]=[[4.878668,52.373503],[4.878271,52.373411]].map(local), length=Math.hypot(c[0]-a[0],c[1]-a[1]);
const rearGlass=geometry[0].tris.filter(t=>t.hex===kit.halls![0].windows!.glassHex&&t.p.every(p=>Math.abs(((p[0]-a[0])*(c[1]-a[1])-(p[1]-a[1])*(c[0]-a[0]))/length)<.3));
assert.equal(rearGlass.length,0,'nearly blind registered rear gets no guessed nave glass');
console.log(JSON.stringify({status:'pass',triangles:geometry[0].tris.length,atlasLayers:PROCEDURAL_RECIPE_LAYER_OFFSET+BAY_LAYER_COUNT+1,textureBytes:CELL_PX*CELL_PX*6,scope:'Fatih photo masonry + sourced blind rear only'}));
