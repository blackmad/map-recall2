/** Read-only audit of admitted124/126 native chunks and the actual runtime atlas. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createCanvas,Image} from '@napi-rs/canvas';
import * as THREE from 'three';
import {buildLookTextures} from '../../src/canalRecall/threeBuildingsBrowser.ts';
import {buildFeatureChunk,ORIGIN,type Feature} from '../../src/canalRecall/threeBuildingFeatures.ts';
import {decorateFacade} from '../../src/canalRecall/genericFacades.ts';
import {shortBuildingId} from '../../src/canalRecall/buildingFacts.ts';
import {streetSegments} from '../../src/canalRecall/streetFronts.ts';
import {bayLookFor} from '../../src/canalRecall/bayLook.ts';
import {recipeBayOpenings} from '../../src/canalRecall/facadeOpenings.ts';
import {PROCEDURAL_RECIPE_LAYER_OFFSET} from '../../src/canalRecall/streetFacadeRendering.ts';
const repaired=process.argv.includes('--after');
const output='artifacts/jan-evertsen-pilot/material-audit-20261006'+(repaired?'/after':'');fs.mkdirSync(output,{recursive:true});
const catalog=JSON.parse(fs.readFileSync('public/data/street-appearance/profiles.json','utf8'));
const profile=catalog.profiles.find((p:any)=>p.id==='jan-evertsen-canopy-candidate-native-pair');assert.ok(profile);
const recipe=profile.recipes[0].recipe,specs=JSON.parse(fs.readFileSync('scripts/jan-evertsen-pilot/native-specs.json','utf8'));
const tile=JSON.parse(gunzipSync(fs.readFileSync('public/data/extracts/amsterdam/building-tiles/14/8412/5384.geojson.gz')).toString());
const facts=JSON.parse(gunzipSync(fs.readFileSync('public/data/extracts/amsterdam/building-facts/14/8412/5384.json.gz')).toString());
const native:Feature[]=specs.map((s:any)=>{
 const f=tile.features.find((f:any)=>f.properties.id===s.sourceBuildingId);assert.ok(f);
 return decorateFacade({...f,properties:{...f.properties,appearanceStyleSource:'citywide-identity-palette-v3-not-measured',constructionYear:facts.buildings[shortBuildingId(s.sourceBuildingId)]?.[0]??null}});
});
const streets=streetSegments([{highway:'tertiary',points:profile.segment}],ORIGIN);
class LocalImage extends Image {set src(value:string){super.src=fs.readFileSync(fileURLToPath(value));}async decode(){assert.ok(this.complete&&this.width);}}
(globalThis as any).document={baseURI:pathToFileURL(path.resolve('public/canal-drive')+'/').href,createElement(){return createCanvas(1,1);}};
(globalThis as any).Image=LocalImage;
const rows:any[]=[];
for(const look of ['photo','storybook','cartoon','procedural'] as const)for(const size of [256,128]){
 const textures=await buildLookTextures(THREE,look,1,size),colour=textures.colour.image.data as Uint8Array,mask=textures.mask.image.data as Uint8Array;
 const bilinear=(layer:number,u:number,v:number)=>{
  const x=u*size-.5,y=v*size-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,c=[0,0,0,0,0];
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const i=layer*size*size+((y0+dy+size)%size)*size+(x0+dx+size)%size,w=(dx?fx:1-fx)*(dy?fy:1-fy);
   for(let k=0;k<3;k++)c[k]+=colour[i*4+k]*w;c[3]+=mask[i*2]*w;c[4]+=mask[i*2+1]*w;
  }return c;
 };
 for(const feature of native){
  const id=String(feature.properties.id),bayLook=look==='procedural'?'photo':look,bay=bayLookFor(id,Number(feature.properties.constructionYear),Number(feature.properties.height),bayLook,'quiet',recipe);
  const openings=recipeBayOpenings(id,recipe,bayLook),o=openings.upper,width=o.widths?.[0]??o.width,axis=o.axes[0],offset=look==='procedural'?PROCEDURAL_RECIPE_LAYER_OFFSET:0;
  const expected=[{role:'upper-glass',layer:bay.layers.upper+offset,rect:[axis-width*(repaired?.24:.21),o.sill+(o.head-o.sill)*.10,width*(repaired?.02:.08),(o.head-o.sill)*.09]},
   {role:'residential-leaf',layer:bay.layers.door+offset,rect:repaired?[openings.door.axis-openings.door.width/2+14/520,openings.door.top-148/340,openings.door.width-28/520,66/340]:[openings.door.axis-openings.door.width/2+.008,openings.door.bottom+.015,openings.door.width-.016,openings.door.top-openings.door.bottom-.03]},
   {role:'shop-glass-and-customer-leaf',layer:bayLookFor(id,Number(feature.properties.constructionYear),Number(feature.properties.height),bayLook,'shopWindow',recipe).layers.ground+offset,rect:repaired?[.42,.24,.06,.31]:[.42,.12,.06,.38]}];
  const chunk=buildFeatureChunk([feature],look,'walls',streets,[profile]),swatch=createCanvas(192,128),ctx=swatch.getContext('2d'),im=ctx.createImageData(192,128),slots:any[]=[];
  for(const [column,slot] of expected.entries()){
   const triangles:number[][]=[];
   for(let k=0;k<chunk.indices.length;k+=3){const ids=Array.from(chunk.indices.slice(k,k+3));
    const expectedTint=repaired&&slot.role==='residential-leaf'?[53,65,61]:[255,255,255];
    if(ids.every(i=>chunk.layers[i]===slot.layer&&expectedTint.every((v,c)=>chunk.tints[i*4+c]===v)&&[0,1].every(a=>chunk.uvs[i*2+a]>=slot.rect[a]-1e-6&&chunk.uvs[i*2+a]<=slot.rect[a]+slot.rect[a+2]+1e-6)))triangles.push(ids);
   }
   assert.ok(triangles.length,`${look}/${id}/${slot.role}: native texture crop absent`);
   const indices=[...new Set(triangles.flat())],us=indices.map(i=>chunk.uvs[i*2]),vs=indices.map(i=>chunk.uvs[i*2+1]),rect=[Math.min(...us),Math.min(...vs),Math.max(...us)-Math.min(...us),Math.max(...vs)-Math.min(...vs)];
   const tint=Array.from(chunk.tints.slice(indices[0]*4,indices[0]*4+3)),accent=Array.from(chunk.accents.slice(indices[0]*4,indices[0]*4+3));
   let pale=0,rawPale=0,blue=0,wallSamples=0,accentSamples=0,maxWall=0,maxAccent=0;const minRGB=[255,255,255],maxRGB=[0,0,0],rawMinRGB=[255,255,255],rawMaxRGB=[0,0,0];
   for(let y=0;y<128;y++)for(let x=0;x<64;x++){
    const c=bilinear(slot.layer,rect[0]+rect[2]*x/63,rect[1]+rect[3]*(1-y/127));maxWall=Math.max(maxWall,c[3]);maxAccent=Math.max(maxAccent,c[4]);if(c[3]>1)wallSamples++;if(c[4]>1)accentSamples++;
    if(Math.min(...c.slice(0,3))>120&&Math.max(...c.slice(0,3))-Math.min(...c.slice(0,3))<28)rawPale++;
    for(let k=0;k<3;k++){rawMinRGB[k]=Math.min(rawMinRGB[k],c[k]);rawMaxRGB[k]=Math.max(rawMaxRGB[k],c[k]);c[k]*=(1-c[3]/255+c[3]/255*tint[k]/255)*(1-c[4]/255+c[4]/255*accent[k]/255);minRGB[k]=Math.min(minRGB[k],c[k]);maxRGB[k]=Math.max(maxRGB[k],c[k]);}
    if(Math.min(...c.slice(0,3))>120&&Math.max(...c.slice(0,3))-Math.min(...c.slice(0,3))<28)pale++;
    if(c[2]-c[0]>10)blue++;im.data.set([...c.slice(0,3).map(Math.round),255],(y*192+column*64+x)*4);
   }
   slots.push({...slot,rect,triangleCount:triangles.length,sampleCount:8192,paleSamples:pale,rawPaleSamples:rawPale,blueSamples:blue,wallSamples,accentSamples,maxWall,maxAccent,rawMinRGB,rawMaxRGB,minRGB,maxRGB,tint,accent});
  }
  const file=`${output}/${shortBuildingId(id)}-${look}-${size}.png`;ctx.putImageData(im,0,0);fs.writeFileSync(file,swatch.toBuffer('image/png'));
  rows.push({id,look,size,archetype:bay.archetype,style:bay.style,variant:bay.variant,layerOffset:offset,slots,file});
 }
 textures.colour.dispose();textures.mask.dispose();
}
const passing=rows.every(r=>r.slots.every((s:any)=>s.paleSamples===0&&(s.role==='residential-leaf'?Math.max(...s.maxRGB)<100:s.maxWall<1&&s.maxAccent<1&&s.blueSamples===s.sampleCount&&s.maxRGB[2]-s.minRGB[2]>1)));
fs.writeFileSync(`${output}/report.json`,JSON.stringify({decision:passing?'PASS bounded material sampling only':'FAIL: upper school muntin, stock residential fanlight and school floor-band content survive material composition',scope:'Admitted124/126 exact native material audit only;119/122 andcompound99 unseen; UV/door accent repair only; no profile/layout/public/bundle edits',profileId:profile.id,profileRevision:profile.revision,swatchColumns:['upper glass','residential portico leaf','shop glass/customer leaf'],thresholds:{pale:'All RGB>120 and channel range<28; smeared pale content may not reach this threshold at128, so raw RGB/UV and swatch evidence also matter',blue:'B-R>10',maskSample:'Mask byte>1'},sourceLimit:'Primarypilot-north current source inspected; residential back is underexposed, exact leaf relief not established. No fresh heldout inspection.',rows},null,2)+'\n');
if(repaired)assert.ok(passing,'Actual composed material sampling still fails; inspect saved report/swatches');
console.log(JSON.stringify(rows.map(r=>({id:r.id,look:r.look,size:r.size,style:r.style,slots:r.slots.map((s:any)=>({role:s.role,layer:s.layer,triangles:s.triangleCount,pale:s.paleSamples,blue:s.blueSamples,mask:[s.maxWall,s.maxAccent]}))}))));
