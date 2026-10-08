/** Bake the production texture-array shader into portable GLB base-color maps. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createCanvas,Image} from '@napi-rs/canvas';
import * as THREE from 'three';
import {buildLookTextures} from '../../src/canalRecall/threeBuildingsBrowser.ts';

export async function runtimePhotoAtlas(){
 const previousDocument=(globalThis as any).document,previousImage=(globalThis as any).Image;
 class LocalImage extends Image {
  set src(value:string){super.src=fs.readFileSync(fileURLToPath(value));}
  async decode(){if(!this.complete||!this.width)throw Error('Local renderer texture did not decode');}
 }
 try{
  (globalThis as any).document={baseURI:pathToFileURL(path.resolve('public/canal-drive')+'/').href,createElement(tag:string){if(tag!=='canvas')throw Error(`Unsupported atlas element ${tag}`);return createCanvas(1,1);}};
  (globalThis as any).Image=LocalImage;
  const textures=await buildLookTextures(THREE,'photo',1);
  const {width:size,depth:layers,data:colour}=textures.colour.image;
  const mask=textures.mask.image.data;
  textures.colour.dispose();textures.mask.dispose();
  return {size,layers,colour:colour as Uint8Array,mask:mask as Uint8Array};
 }finally{
  if(previousDocument===undefined)delete (globalThis as any).document;else (globalThis as any).document=previousDocument;
  if(previousImage===undefined)delete (globalThis as any).Image;else (globalThis as any).Image=previousImage;
 }
}
export type RuntimeAtlas=Awaited<ReturnType<typeof runtimePhotoAtlas>>;
/** The runtime samples unconverted byte textures and normalized tint/accents.
 * Its final RGB is baked with face shade; KHR_materials_unlit avoids double lighting.
 * Array rows are bottom-up; PNG and glTF UVs use a top-left origin. */
export function bakeRuntimeMaterial(atlas:RuntimeAtlas,layer:number,tint:readonly number[],accent:readonly number[]):Buffer {
 if(layer<0||layer>=atlas.layers)throw Error(`Missing runtime atlas layer ${layer}`);
 const {size,colour,mask}=atlas,canvas=createCanvas(size,size),ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const source=layer*size*size+(size-1-y)*size+x,target=(y*size+x)*4;
  const wall=mask[source*2]/255,accentWeight=mask[source*2+1]/255,shade=tint[3]/255;
  for(let c=0;c<3;c++)image.data[target+c]=Math.round(colour[source*4+c]*((1-wall)+wall*tint[c]/255)*((1-accentWeight)+accentWeight*accent[c]/255)*shade);
  image.data[target+3]=255;
 }
 ctx.putImageData(image,0,0);return canvas.toBuffer('image/png');
}
