/** Node diagnostic adapter for the actual production atlas, without a browser. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createCanvas,Image} from '@napi-rs/canvas';
import * as THREE from 'three';
import {buildLookTextures} from '../../src/canalRecall/threeBuildingsBrowser.js';

export async function runtimePhotoAtlas(){
 const previousDocument=(globalThis as any).document,previousImage=(globalThis as any).Image;
 class LocalImage extends Image {
  set src(value:string){super.src=fs.readFileSync(fileURLToPath(value));}
  async decode(){if(!this.complete||!this.width)throw Error('Local renderer texture did not decode');}
 }
 try{
  (globalThis as any).document={baseURI:pathToFileURL(path.resolve('public/canal-drive')+'/').href,createElement(tag:string){if(tag!=='canvas')throw Error('Unsupported atlas element '+tag);return createCanvas(1,1);}};
  (globalThis as any).Image=LocalImage;
  const textures=await buildLookTextures(THREE,'photo',1);
  const {width:size,depth:layers,data:colour}=textures.colour.image,mask=textures.mask.image.data;
  textures.colour.dispose();textures.mask.dispose();
  return {size,layers,colour:colour as Uint8Array,mask:mask as Uint8Array};
 }finally{
  if(previousDocument===undefined)delete (globalThis as any).document;else (globalThis as any).document=previousDocument;
  if(previousImage===undefined)delete (globalThis as any).Image;else (globalThis as any).Image=previousImage;
 }
}
