/** Immutable full-crop inputs for a three-arm façade vector experiment.
 * The cohort association is not proof that every pixel belongs to its BAG owner. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const DEFAULT_INDICES=[0,3,4,11,13,17,30,64,80,93];
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const args=new Map<string,string>();
for(const arg of process.argv.slice(2)){
  const match=/^--(cohort|occ|out|indices)=(.+)$/.exec(arg);
  if(!match||args.has(match[1]))throw Error(`Unknown or duplicate argument: ${arg}`);
  args.set(match[1],match[2]);
}
const cohortPath=path.resolve(args.get('cohort')??'.cache/facade-assessment/cohort.json');
const occDir=path.resolve(args.get('occ')??'.cache/facade-assessment/occfacade-full100-v1');
const output=path.resolve(args.get('out')??'.cache/facade-assessment/vector-inputs-v1');
const indices=args.has('indices')?args.get('indices')!.split(',').map(Number):DEFAULT_INDICES;
if(!indices.length||indices.some(i=>!Number.isSafeInteger(i)||i<0)||new Set(indices).size!==indices.length)
  throw Error('Indices must be unique nonnegative integers');
const cohortBytes=await fs.readFile(cohortPath),receiptBytes=await fs.readFile(path.join(occDir,'receipt.json'));
const cohort=JSON.parse(cohortBytes.toString()),receipt=JSON.parse(receiptBytes.toString());
if(!Array.isArray(cohort.entries)||!Array.isArray(receipt.records)||receipt.manifestSha256!==sha(cohortBytes)||
  !Array.isArray(receipt.palette)||!Array.isArray(receipt.classes)||receipt.classes.join(',')!=='background,door,shop,balcony,window,wall,sky,roof'||
  receipt.palette.length!==receipt.classes.length||receipt.palette.some((rgb:unknown)=>!Array.isArray(rgb)||(rgb as unknown[]).length!==3||(rgb as unknown[]).some(v=>!Number.isInteger(v)||Number(v)<0||Number(v)>255)))
  throw Error('OccFacade receipt is not bound to this cohort or has unknown classes');
const checked=async(file:string,expected:string)=>{
  if(!/^[a-f0-9]{64}$/.test(expected))throw Error(`Missing SHA-256 for ${file}`);
  const bytes=await fs.readFile(file);if(sha(bytes)!==expected)throw Error(`SHA-256 mismatch: ${file}`);return bytes;
};
const plans=[] as {index:number;owner:any;source:any;prediction:any;sourceBytes:Buffer;labels:Buffer;mask:Uint8Array}[];
for(const index of indices){
  const owners=cohort.entries.filter((e:any)=>e.index===index);
  if(owners.length!==1)throw Error(`Missing or duplicate cohort index ${index}`);
  const owner=owners[0],full=owner.images?.filter((image:any)=>image.kind==='full');
  if(full?.length!==1)throw Error(`Index ${index} has no unique full photo`);
  const source=full[0],predictions=receipt.records.filter((r:any)=>r.index===index&&r.kind==='full');
  if(predictions.length!==1)throw Error(`Index ${index} has no unique full-view prediction`);
  const prediction=predictions[0],name=String(index).padStart(3,'0');
  if(!/^\d+$/.test(owner.buildingId)||prediction.sourceSha256!==source.sha256||
    prediction.buildingId!==owner.buildingId||prediction.observationId!==owner.observationId||
    prediction.sourcePath!==source.path||prediction.size?.[0]!==source.width||prediction.size?.[1]!==source.height)
    throw Error(`Index ${index} source/owner/model binding mismatch`);
  const sourceBytes=await checked(source.path,source.sha256),labels=await checked(path.join(occDir,`${name}-full-labels.png`),prediction.labelsSha256);
  const imageMeta=await sharp(sourceBytes).metadata(),labelMeta=await sharp(labels).metadata();
  if(imageMeta.width!==source.width||imageMeta.height!==source.height||imageMeta.format!=='jpeg'||
    labelMeta.width!==source.width||labelMeta.height!==source.height||labelMeta.channels!==1||labelMeta.hasAlpha||labelMeta.format!=='png')
    throw Error(`Index ${index} source or label dimensions/channel format changed`);
  const decoded=await sharp(labels).toColourspace('b-w').raw().toBuffer({resolveWithObject:true});
  if(decoded.info.channels!==1||decoded.data.length!==source.width*source.height||
    decoded.data.some((label:number)=>label>=receipt.classes.length))throw Error(`Index ${index} has invalid class labels`);
  plans.push({index,owner,source,prediction,sourceBytes,labels,mask:decoded.data});
}
try{await fs.access(output);throw Error(`Output already exists: ${output}`);}catch(error:any){if(error.code!=='ENOENT')throw error;}
await fs.mkdir(path.dirname(output),{recursive:true});
const stage=await fs.mkdtemp(path.join(path.dirname(output),`.${path.basename(output)}-stage-${os.userInfo().uid}-`));
try{
  const entries=[] as any[];
  for(const plan of plans){
    const {index,owner,source,prediction,sourceBytes,labels}=plan,name=String(index).padStart(3,'0');
    const image=await sharp(sourceBytes).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true})
      .jpeg({quality:90,mozjpeg:true}).toBuffer();
    const info=await sharp(image).metadata();
    if(!info.width||!info.height||Math.max(info.width,info.height)>1024)throw Error(`Index ${index} prepared image is invalid`);
    const resized=await sharp(labels).resize(info.width,info.height,{kernel:'nearest'})
      .toColourspace('b-w').raw().toBuffer({resolveWithObject:true});
    if(resized.info.channels!==1||resized.data.length!==info.width*info.height)
      throw Error(`Index ${index} resized label layout changed`);
    const resizedMask=resized.data;
    const rgba=Buffer.alloc(info.width*info.height*4);
    for(let pixel=0;pixel<resizedMask.length;pixel++){
      const label=resizedMask[pixel],colour=receipt.palette[label],offset=pixel*4;
      rgba[offset]=colour[0];rgba[offset+1]=colour[1];rgba[offset+2]=colour[2];
      rgba[offset+3]=label===0?0:105;
    }
    const overlay=await sharp(image).composite([{input:rgba,raw:{width:info.width,height:info.height,channels:4}}]).png().toBuffer();
    const imageName=`${name}-image.jpg`,overlayName=`${name}-occ-overlay.png`;
    await Promise.all([fs.writeFile(path.join(stage,imageName),image),fs.writeFile(path.join(stage,overlayName),overlay)]);
    entries.push({index,buildingId:owner.buildingId,observationId:owner.observationId,
      sourceSha256:source.sha256,originalWidth:source.width,originalHeight:source.height,
      preparedWidth:info.width,preparedHeight:info.height,
      imagePath:imageName,imageSha256:sha(image),overlayPath:overlayName,overlaySha256:sha(overlay),
      image:{path:imageName,sha256:sha(image),mimeType:'image/jpeg'},
      overlay:{path:overlayName,sha256:sha(overlay),mimeType:'image/png',derivedFromLabelsSha256:prediction.labelsSha256},
      sourceIdentity:'unresolved-cohort-association',target:'entire rectified full crop',ownerOutline:'not provided'});
  }
  const manifest={version:1,policy:'Full crop only; cohort owner association and outline are not visually verified. No guessed building outline or accepted geometry. All model responses use x/y coordinates normalized 0–1000 over the entire prepared image.',
    coordinateContract:{frame:'entire prepared image',range:[0,1000],origin:'top-left',xRight:true,yDown:true},
    cohortSha256:sha(cohortBytes),occReceiptSha256:sha(receiptBytes),occCheckpointSha256:receipt.checkpointSha256,
    occClasses:receipt.classes,occPalette:receipt.palette,entries};
  await fs.writeFile(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  try{await fs.access(output);throw Error(`Output appeared during build: ${output}`);}catch(error:any){if(error.code!=='ENOENT')throw error;}
  await fs.rename(stage,output);
  console.log(JSON.stringify({output,entries:entries.length,manifestSha256:sha(await fs.readFile(path.join(output,'manifest.json')))}));
}catch(error){await fs.rm(stage,{recursive:true,force:true});throw error;}
