/** Actual runtime atlas colour/mask regression, not architectural acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createCanvas,Image} from '@napi-rs/canvas';
import * as THREE from 'three';
import {buildLookTextures} from '../../src/canalRecall/threeBuildingsBrowser.ts';
import {buildFeatureChunk} from '../../src/canalRecall/threeBuildingFeatures.ts';
import {compoundStreets as streets} from '../../src/canalRecall/compoundNativeFrontage.fixture.ts';
import {compoundSourceFeature as feature,compoundSourceRecipe as recipe,compoundSourceProfile as profile} from '../../src/canalRecall/compoundSourceCandidate.fixture.ts';
import {bayLookFor} from '../../src/canalRecall/bayLook.ts';
import {recipeBayOpenings} from '../../src/canalRecall/facadeOpenings.ts';
import {PROCEDURAL_RECIPE_LAYER_OFFSET} from '../../src/canalRecall/streetFacadeRendering.ts';

const output='artifacts/street-appearance/compound-native/material-sampling-repair';
fs.mkdirSync(output,{recursive:true});
class LocalImage extends Image {
 set src(value:string){super.src=fs.readFileSync(fileURLToPath(value));}
 async decode(){assert.ok(this.complete&&this.width);}
}
(globalThis as any).document={baseURI:pathToFileURL(path.resolve('public/canal-drive')+'/').href,createElement(){return createCanvas(1,1);}};
(globalThis as any).Image=LocalImage;
const rows:any[]=[];
for(const look of ['photo','storybook','cartoon','procedural'] as const){
 const bayLook=look==='procedural'?'photo':look,chosen=bayLookFor(String(feature.properties.id),1650,22.99,bayLook,'quiet',recipe);
 const offset=look==='procedural'?PROCEDURAL_RECIPE_LAYER_OFFSET:0;
 const o=recipeBayOpenings(String(feature.properties.id),recipe,bayLook),width=o.upper.widths?.[0]??o.upper.width,axis=o.upper.axes[0];
 const chunk=buildFeatureChunk([feature],look,'walls',streets,[profile]);
 // Read repaired crop from the actual native vertices, not duplicate new UV constants.
 const rectFromMesh=(door:boolean)=>{
  const layer=chosen.layers[door?'door':'upper']+offset,tint=door?[53,65,61]:[255,255,255];
  const ids=Array.from(chunk.layers.keys()).filter(i=>chunk.layers[i]===layer&&tint.every((v,c)=>chunk.tints[i*4+c]===v));
  assert.ok(ids.length>0,`${look}: missing textured ${door?'door':'glass'}`);
  const us=ids.map(i=>chunk.uvs[i*2]),vs=ids.map(i=>chunk.uvs[i*2+1]);
  return [Math.min(...us),Math.min(...vs),Math.max(...us)-Math.min(...us),Math.max(...vs)-Math.min(...vs)];
 };
 const glass=rectFromMesh(false),door=rectFromMesh(true);
 const oldGlass=[axis-width*.21,o.upper.sill+(o.upper.head-o.upper.sill)*.10,width*.08,(o.upper.head-o.upper.sill)*.09];
 const oldDoor=[o.door.axis-o.door.width/2+.008,o.door.bottom+.015,o.door.width-.016,(o.door.top-o.door.bottom)*.78];
 for(const size of [256,128]){
  const textures=await buildLookTextures(THREE,look,1,size),colour=textures.colour.image.data as Uint8Array,mask=textures.mask.image.data as Uint8Array;
  const swatch=createCanvas(256,128),ctx=swatch.getContext('2d'),im=ctx.createImageData(256,128);
  const sample=(layer:number,u:number,v:number)=>{
   // WebGL linear filtering uses texel centres. Include both neighbours of each crop edge.
   const x=u*size-.5,y=v*size-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,out=[0,0,0,0,0];
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const i=layer*size*size+((y0+dy+size)%size)*size+(x0+dx+size)%size,w=(dx?fx:1-fx)*(dy?fy:1-fy);
    for(let c=0;c<3;c++)out[c]+=colour[i*4+c]*w;
    out[3]+=mask[i*2]*w;out[4]+=mask[i*2+1]*w;
   }return out;
  };
  const stats=(rect:number[],isDoor:boolean,column:number)=>{
   const layer=chosen.layers[isDoor?'door':'upper']+offset,mins=[255,255,255],maxs=[0,0,0];let pale=0,maxWall=0,maxAccent=0;
   for(let y=0;y<128;y++)for(let x=0;x<64;x++){
    const c=sample(layer,rect[0]+rect[2]*x/63,rect[1]+rect[3]*(1-y/127));
    maxWall=Math.max(maxWall,c[3]);maxAccent=Math.max(maxAccent,c[4]);
    for(let k=0;k<3;k++){
     // Production tint and accent multiplication; shade omitted uniformly for readable swatches.
     c[k]*=(1-c[3]/255+c[3]/255*(isDoor?[53,65,61][k]:255)/255)*(1-c[4]/255+c[4]/255*(isDoor?[53,65,61][k]:[229,229,216][k])/255);
     mins[k]=Math.min(mins[k],c[k]);maxs[k]=Math.max(maxs[k],c[k]);
    }
    if(Math.min(...c.slice(0,3))>120&&Math.max(...c.slice(0,3))-Math.min(...c.slice(0,3))<28)pale++;
    im.data.set([...c.slice(0,3).map(Math.round),255],(y*256+column*64+x)*4);
   }
   return {paleFraction:pale/(64*128),maxWall,maxAccent,minRGB:mins,maxRGB:maxs};
  };
  const beforeGlass=stats(oldGlass,false,0),afterGlass=stats(glass,false,1),beforeDoor=stats(oldDoor,true,2),afterDoor=stats(door,true,3);
  ctx.putImageData(im,0,0);const file=`${output}/${look}-${size}.png`;fs.writeFileSync(file,swatch.toBuffer('image/png'));
  rows.push({look,size,layerOffset:offset,glass,door,beforeGlass,afterGlass,beforeDoor,afterDoor,file});
  textures.colour.dispose();textures.mask.dispose();
 }
}
fs.writeFileSync(`${output}/report.json`,JSON.stringify({scope:'Primary compound material sampling only; zero admissions; no heldout, architectural, gameplay or GPU acceptance',swatchColumns:['failed glass','repaired glass','failed door','repaired door'],rows},null,2)+'\n');
for(const row of rows){
 assert.equal(row.afterGlass.paleFraction,0,`${row.look}/${row.size}: pale glass bar remains`);
 assert.ok(row.afterGlass.maxWall<1&&row.afterGlass.maxAccent<1,`${row.look}/${row.size}: glazing mask contaminated`);
 assert.ok(row.afterGlass.minRGB[2]-row.afterGlass.maxRGB[0]>5,`${row.look}/${row.size}: not a blue glass field`);
 assert.ok(row.afterGlass.maxRGB[2]-row.afterGlass.minRGB[2]>1,`${row.look}/${row.size}: glass gradient lost`);
 assert.equal(row.afterDoor.paleFraction,0,`${row.look}/${row.size}: pale door-head content remains`);
 assert.ok(Math.max(...row.afterDoor.maxRGB)<100,`${row.look}/${row.size}: leaf is not dark`);
}
console.log(JSON.stringify(rows.map(r=>({look:r.look,size:r.size,beforePale:r.beforeGlass.paleFraction,afterPale:r.afterGlass.paleFraction,glassMask:[r.afterGlass.maxWall,r.afterGlass.maxAccent],doorMax:r.afterDoor.maxRGB}))));
