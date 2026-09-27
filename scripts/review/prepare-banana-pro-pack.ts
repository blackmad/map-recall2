/** SHA-bound, source-space image inputs for the five-call Banana Pro pilot. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const arg=(name:string,fallback:string)=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const read=async(file:string)=>fs.readFile(file);
const verified=async(file:string,expected:string)=>{
 const bytes=await read(file);
 if(digest(bytes)!==expected)throw Error(`Source SHA mismatch: ${file}`);
 return bytes;
};
type Bounds=[number,number,number,number];
type Binding={index:number;buildingId:string;observationId:string;sourcePath:string;sourceSha256:string;
 originalSourceSha256:string;cellBounds:Bounds;photoBounds:Bounds;originalSize:[number,number];scale:number};
const input=(file:string,bytes:Buffer,width:number,height:number,aspectRatio:'1:1'|'9:16'|'16:9',resolution:'1K'|'2K',sourceBindings:Binding[])=>({
 path:file,sha256:digest(bytes),width,height,aspectRatio,resolution,sourceBindings,
});

const root=path.resolve(arg('root',process.cwd()));
const sourceManifest=path.resolve(arg('source-manifest',path.join(root,'.cache/facade-assessment/vector-inputs-v1/manifest.json')));
const panoramaManifest=path.resolve(arg('panorama-manifest',path.join(root,'.cache/da-costa-height-stage/followup/evidence/manifest.json')));
const out=path.resolve(arg('out',path.join(root,'.cache/facade-assessment/banana-pro-pack-v1/inputs')));
const sourceBytes=await read(sourceManifest),source=JSON.parse(sourceBytes.toString());
const panoramaBytes=await read(panoramaManifest),panorama=JSON.parse(panoramaBytes.toString());
const indices=[0,3,4,80];
const sources=await Promise.all(indices.map(async index=>{
 const entry=source.entries.find((item:any)=>item.index===index);
 if(!entry)throw Error(`Missing prepared source ${index}`);
 const file=path.resolve(path.dirname(sourceManifest),entry.imagePath);
 const bytes=await verified(file,entry.imageSha256);
 const dimensions=await sharp(bytes).metadata();
 if(dimensions.width!==entry.preparedWidth||dimensions.height!==entry.preparedHeight)
  throw Error(`Prepared source dimensions changed: ${index}`);
 return {entry,file,bytes,width:dimensions.width,height:dimensions.height};
}));

const panoramaRecord=panorama.records.find((item:any)=>item.id==='0363100012077314_e_14o9326');
if(!panoramaRecord?.images?.context)throw Error('Missing verified rectilinear context record');
const context=panoramaRecord.images.context;
const contextPath=path.resolve(path.dirname(panoramaManifest),'images',context.file);
const contextBytes=await verified(contextPath,context.sha256);
const contextSize=await sharp(contextBytes).metadata();
if(contextSize.width!==context.width||contextSize.height!==context.height)throw Error('Context dimensions changed');
// A genuine, single rectified panorama-context image. This slice contains
// adjacent old-brick frontages; it is not a montage of independent buildings.
const panoramaCrop={left:450,top:0,width:720,height:405};
if(panoramaCrop.left+panoramaCrop.width>contextSize.width||panoramaCrop.top+panoramaCrop.height>contextSize.height)
 throw Error('Panorama crop leaves source image');

if(await fs.stat(out).then(()=>true,()=>false))throw Error(`Output already exists: ${out}`);
const staging=out+`.tmp-${process.pid}`;
await fs.mkdir(staging,{recursive:true});
try{
 const singleInputs:any={};
 for(const index of [0,80]){
  const item=sources.find(value=>value.entry.index===index)!;
  const filename=`single${index}.jpg`;
  await fs.writeFile(path.join(staging,filename),item.bytes);
  const bounds:[number,number,number,number]=[0,0,item.width,item.height];
  const binding:Binding={index,buildingId:item.entry.buildingId,observationId:item.entry.observationId,
   sourcePath:item.file,sourceSha256:item.entry.imageSha256,originalSourceSha256:item.entry.sourceSha256,
   cellBounds:bounds,photoBounds:bounds,originalSize:[item.width,item.height],scale:1};
  singleInputs[`single${index}`]=input(filename,item.bytes,item.width,item.height,'9:16','1K',[binding]);
 }

 const sheetSize=1024,outer=16,gutter=16,cellWidth=(sheetSize-2*outer-3*gutter)/4;
 if(!Number.isInteger(cellWidth))throw Error('Noninteger sheet layout');
 const cellHeight=sheetSize-2*outer;
 const layers:{input:Buffer;left:number;top:number}[]=[];
 const bindings:Binding[]=[];
 for(const [column,item] of sources.entries()){
  const x0=outer+column*(cellWidth+gutter),y0=outer;
  const scaled=await sharp(item.bytes).resize({width:cellWidth,height:cellHeight,fit:'inside'}).png().toBuffer();
  const meta=await sharp(scaled).metadata();
  const photoX=x0+Math.floor((cellWidth-meta.width!)/2);
  const photoY=y0+Math.floor((cellHeight-meta.height!)/2);
  const photoBounds:Bounds=[photoX,photoY,photoX+meta.width!,photoY+meta.height!];
  layers.push({input:scaled,left:photoX,top:photoY});
  bindings.push({index:item.entry.index,buildingId:item.entry.buildingId,observationId:item.entry.observationId,
   sourcePath:item.file,sourceSha256:item.entry.imageSha256,originalSourceSha256:item.entry.sourceSha256,
   cellBounds:[x0,y0,x0+cellWidth,y0+cellHeight],photoBounds,
   originalSize:[item.width,item.height],scale:meta.width!/item.width});
 }
 const sheet=await sharp({create:{width:sheetSize,height:sheetSize,channels:3,background:'#ffffff'}})
  .composite(layers).png().toBuffer();
 await fs.writeFile(path.join(staging,'sheet1k.png'),sheet);
 const panoramaImage=await sharp(contextBytes).extract(panoramaCrop).resize(1024,576,{fit:'fill'}).png().toBuffer();
 await fs.writeFile(path.join(staging,'panorama1k.png'),panoramaImage);
 const panoramaBinding={recordId:panoramaRecord.id,buildingId:panoramaRecord.buildingId,
  sourcePath:contextPath,sourceSha256:context.sha256,sourceManifestPath:panoramaManifest,
  sourceManifestSha256:digest(panoramaBytes),panoramaId:context.panoramaId,panoramaSha256:context.panoramaSha256,
  capturedAt:context.date,sourceDimensions:[contextSize.width,contextSize.height],sourceCropBounds:[450,0,1170,405],
  outputBounds:[0,0,1024,576],projection:'existing single rectified panorama context; no image concatenation',
  identity:'source record is one target elevation; neighbouring facades remain unregistered context'};
 const manifest={version:1,kind:'banana-pro-five-input-pack',policy:'Diagnostic images; source-owner identity and generated geometry unaccepted.',
  sourceManifestPath:sourceManifest,sourceManifestSha256:digest(sourceBytes),
  panoramaSourceManifestPath:panoramaManifest,panoramaSourceManifestSha256:digest(panoramaBytes),
  layout:{sheetSize,columns:4,outerGutterPixels:outer,betweenColumnGutterPixels:gutter,background:'#ffffff',bounds:'half-open source pixels'},
  inputs:{
   ...singleInputs,
   sheet1k:input('sheet1k.png',sheet,1024,1024,'1:1','1K',bindings),
   sheet2k:input('sheet1k.png',sheet,1024,1024,'1:1','2K',bindings),
   panorama1k:{...input('panorama1k.png',panoramaImage,1024,576,'16:9','1K',[]),panoramaBinding},
  }};
 await fs.writeFile(path.join(staging,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await fs.mkdir(path.dirname(out),{recursive:true});
 await fs.rename(staging,out);
 console.log(path.join(out,'manifest.json'));
}catch(error){await fs.rm(staging,{recursive:true,force:true});throw error;}
