/** Source-photo wall colour diagnostics from exact rectification crops and S1 masks.
 * The segmentation's building label includes windows; no output is a wall-grade
 * or render albedo. Missing/invalid masks never fall back to unmasked colour. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { dominantWallColour, type DominantWallColour } from '../../src/canalRecall/facade/dominantWallColour.ts';
import { sampleWallColour, type RgbImage, type WallColourSample } from '../../src/canalRecall/facade/wallColourSample.ts';

const sha256=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const flag=(args:string[],name:string)=>args.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const flags=(args:string[],name:string)=>args.filter(value=>value.startsWith(`--${name}=`)).map(value=>value.slice(name.length+3));
const hashOk=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const BUILDING_LABEL=2;
type Source={buildingId:string;elevationId:string;sourceSha256:string;sourceManifestPath:string;sourceManifestSha256:string;
  imagePath:string;groundNAP:number|null;plane:{baseZ:number;topZ:number}|null;captureDate:string|null;panoramaProfile:string};
type MaskRecord={stem:string;file:string;mask:string;maskSha256:string;width:number;height:number;pandId?:string};
const colour=(value:DominantWallColour|null)=>value?{hex:value.hex,rgb:value.rgb,pixels:value.pixels,fraction:value.fraction,
  usablePixels:value.usablePixels,reliable:value.reliable,review:value.review,runnerUp:value.runnerUp&&{
    hex:value.runnerUp.hex,pixels:value.runnerUp.pixels,fraction:value.runnerUp.fraction},rejected:value.rejected,
  basis:value.basis}:null;
const percentile=(value:WallColourSample|null)=>value?{hex:value.hex,rgb:value.rgb,sampledPixels:value.sampledPixels,
  wallFraction:value.wallFraction,lumaSpread:value.lumaSpread,basis:value.basis}:null;

export async function loadRectifiedSources(manifestFiles:string[]):Promise<Source[]>{
  if(!manifestFiles.length)throw Error('At least one --manifest=<evidence/manifest.json> is required');
  const sources:Source[]=[],seen=new Set<string>();
  for(const name of manifestFiles){const file=path.resolve(name),bytes=await fs.readFile(file),manifest=JSON.parse(bytes.toString('utf8'));
    if(!Array.isArray(manifest.records)||!hashOk(manifest.sourceHash))throw Error(`Invalid rectification manifest: ${file}`);
    for(const record of manifest.records){const image=record.images?.full,elevationId=record.elevationId;
      if(!record.buildingId||typeof elevationId!=='string'||record.id!==elevationId.replaceAll(':','_')||
        !image||!hashOk(image.sha256)||typeof image.file!=='string'||image.file!==path.basename(image.file)||
        !/^[a-zA-Z0-9_.-]+\.jpg$/.test(image.file))throw Error(`Unbound rectification record: ${record.id}`);
      const key=`${record.buildingId}:${elevationId}:${image.sha256}`;if(seen.has(key))continue;seen.add(key);
      const plane=image.plane,metric=plane&&Number.isFinite(plane.baseZ)&&Number.isFinite(plane.topZ)&&plane.topZ>plane.baseZ
        ?{baseZ:plane.baseZ,topZ:plane.topZ}:null;
      sources.push({buildingId:String(record.buildingId),elevationId,sourceSha256:image.sha256,
        sourceManifestPath:file,sourceManifestSha256:sha256(bytes),imagePath:path.join(path.dirname(file),'images',image.file),
        groundNAP:Number.isFinite(record.groundNAP)?record.groundNAP:null,plane:metric,
        captureDate:image.date??null,panoramaProfile:manifest.sourceProfile??'full'});
    }
  }
  return sources.sort((a,b)=>a.buildingId.localeCompare(b.buildingId)||a.elevationId.localeCompare(b.elevationId)||a.sourceSha256.localeCompare(b.sourceSha256));
}

export function upperWallCutoffRow(height:number,plane:{baseZ:number;topZ:number}|null,groundNAP:number|null):number|null{
  if(!Number.isInteger(height)||height<1||!plane||!Number.isFinite(groundNAP)||plane.topZ<=plane.baseZ)return null;
  const row=Math.floor(height*(plane.topZ-(groundNAP!+4))/(plane.topZ-plane.baseZ));
  return Math.max(0,Math.min(height,row));
}

export async function measureLocalWallColours(args:string[]=process.argv.slice(2)){
  const manifests=flags(args,'manifest'),masksDir=path.resolve(flag(args,'masks')??''),out=path.resolve(flag(args,'out')??'.cache/city-appearance/local-material-benchmark/wall-colour-measurements.json');
  if(!flag(args,'masks'))throw Error('--masks=<segmentation-root/masks/s1> is required');
  if(out.startsWith(path.resolve('public')+path.sep))throw Error('Diagnostic measurements cannot be written under public/');
  const provenanceFile=path.resolve(flag(args,'provenance')??path.join(masksDir,'..','..','s1.provenance.json'));
  const provenanceBytes=await fs.readFile(provenanceFile),provenance=JSON.parse(provenanceBytes.toString('utf8'));
  if(provenance.schemaVersion!==1||provenance.method!=='s1'||provenance.classMapping?.contract?.['2']!=='building'||!Array.isArray(provenance.records))
    throw Error('Mask provenance does not bind S1 building label 2');
  const maskBySource=new Map<string,MaskRecord>();
  for(const record of provenance.records as MaskRecord[]){if(!hashOk(record.stem)||!hashOk(record.maskSha256)||maskBySource.has(record.stem))
    throw Error('Invalid or duplicate S1 mask provenance');maskBySource.set(record.stem,record);}
  const sources=await loadRectifiedSources(manifests),rows=[] as any[];
  for(const source of sources){
    const imageBytes=await fs.readFile(source.imagePath);
    if(sha256(imageBytes)!==source.sourceSha256)throw Error(`Source crop hash mismatch: ${source.imagePath}`);
    const base={buildingId:source.buildingId,elevationId:source.elevationId,sourceSha256:source.sourceSha256,
      sourceManifestPath:source.sourceManifestPath,sourceManifestSha256:source.sourceManifestSha256,
      imagePath:source.imagePath,captureDate:source.captureDate,panoramaProfile:source.panoramaProfile,
      sourceIdentityUnverified:true};
    const withheld=(reason:string,maskSha256:string|null=null)=>{rows.push({...base,status:'withheld',reason,maskSha256,
      photoHex:null,upper:null,full:null});};
    const evidence=maskBySource.get(source.sourceSha256);
    if(!evidence){withheld('missing-mask-provenance');continue;}
    const maskFile=path.join(masksDir,`${source.sourceSha256}.mask.png`);
    if(evidence.stem!==source.sourceSha256||evidence.file!==`${source.sourceSha256}.jpg`||
      path.resolve(path.dirname(provenanceFile),evidence.mask)!==maskFile||evidence.pandId!==source.buildingId){
      withheld('mask-source-binding-mismatch',evidence.maskSha256);continue;}
    let maskBytes:Buffer;try{maskBytes=await fs.readFile(maskFile);}catch(error:any){if(error.code!=='ENOENT')throw error;withheld('missing-mask',evidence.maskSha256);continue;}
    if(sha256(maskBytes)!==evidence.maskSha256){withheld('mask-hash-mismatch',evidence.maskSha256);continue;}
    const imageRaw=await sharp(imageBytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const {width,height,channels}=imageRaw.info;
    if(channels!==3)throw Error(`Unexpected source crop channels: ${source.imagePath}`);
    const maskMeta=await sharp(maskBytes).metadata();
    if(maskMeta.hasAlpha||maskMeta.channels!==1||maskMeta.depth!=='uchar'){
      withheld('mask-must-be-opaque-single-channel',evidence.maskSha256);continue;}
    if(maskMeta.width!==width||maskMeta.height!==height||evidence.width!==width||evidence.height!==height){
      withheld('mask-dimensions-mismatch',evidence.maskSha256);continue;}
    const labels=(await sharp(maskBytes).raw().toBuffer()),fullMask=new Uint8Array(width*height);
    let fullPixels=0;for(let i=0;i<fullMask.length;i++)if(labels[i]===BUILDING_LABEL){fullMask[i]=1;fullPixels++;}
    if(!fullPixels){withheld('no-building-label-2-pixels',evidence.maskSha256);continue;}
    const rgb:RgbImage={data:imageRaw.data,width,height,channels:3};
    const fullDominant=dominantWallColour(rgb,fullMask),fullSample=sampleWallColour(rgb,[]);
    const cutoff=upperWallCutoffRow(height,source.plane,source.groundNAP);
    if(cutoff===null||cutoff<1){rows.push({...base,status:'withheld',reason:'no-upper-wall-metric-frame',maskSha256:evidence.maskSha256,
      maskFile,photoHex:null,upper:null,full:{buildingPixels:fullPixels,buildingFraction:fullPixels/fullMask.length,
        dominant:colour(fullDominant),unmaskedPercentile:percentile(fullSample)}});continue;}
    const upperMask=fullMask.slice(0,width*cutoff),upperImage:RgbImage={data:imageRaw.data.subarray(0,width*cutoff*3),width,height:cutoff,channels:3};
    let upperPixels=0;for(const value of upperMask)upperPixels+=value;
    if(!upperPixels){rows.push({...base,status:'withheld',reason:'no-upper-building-pixels',maskSha256:evidence.maskSha256,
      maskFile,photoHex:null,upper:{cutoffRow:cutoff,buildingPixels:0,buildingFraction:0,dominant:null,unmaskedPercentile:null},
      full:{buildingPixels:fullPixels,buildingFraction:fullPixels/fullMask.length,dominant:colour(fullDominant),unmaskedPercentile:percentile(fullSample)}});continue;}
    const upperDominant=dominantWallColour(upperImage,upperMask),upperSample=sampleWallColour(upperImage,[]),fraction=upperPixels/upperMask.length;
    const sufficient=upperPixels>=500&&fraction>=.15;
    // S1's building class also retains window recesses and dark glass. A
    // coherent dark cluster can therefore be the openings, not the brick.
    const darkAmbiguity=!!upperDominant&&upperDominant.rgb.reduce((sum,channel)=>sum+channel,0)/3<85;
    const status=upperDominant&&sufficient&&upperDominant.reliable&&!darkAmbiguity?'measured-provisional':'needs-review';
    rows.push({...base,status,reason:status==='needs-review'?(darkAmbiguity?'dark-cluster-may-be-window-or-shadow':upperDominant?'insufficient-or-ambiguous-upper-wall-cluster':'no-upper-dominant-cluster'):null,
      maskFile,maskSha256:evidence.maskSha256,photoHex:upperDominant?.hex??null,
      metricFrame:{...source.plane,groundNAP:source.groundNAP,cropHeightPx:height,upperWallStartsMAboveGround:4},
      upper:{cutoffRow:cutoff,buildingPixels:upperPixels,buildingFraction:fraction,dominant:colour(upperDominant),
        unmaskedPercentile:percentile(upperSample)},
      full:{buildingPixels:fullPixels,buildingFraction:fullPixels/fullMask.length,dominant:colour(fullDominant),
        unmaskedPercentile:percentile(fullSample)}});
  }
  const report={version:1,kind:'source-photo-wall-colour-diagnostic',generatedAt:new Date().toISOString(),
    provenanceFile,provenanceSha256:sha256(provenanceBytes),segmentationModel:provenance.model?.id??null,
    maskPolicy:'Exact SHA-bound opaque grayscale S1 label 2; building class includes windows and roof, not a wall-only segmentation; clusters below mean RGB 85 need review as possible glass or shadow',
    upperPolicy:'Only source-image rows at least 4 m above recorded ground NAP; no estimate without metric frame and mask',
    sourcePolicy:'Measured crop RGB cluster, not inferred hue-to-hex, calibrated albedo, accepted wall colour or game publication',
    counts:{sources:rows.length,provisional:rows.filter(row=>row.status==='measured-provisional').length,
      needsReview:rows.filter(row=>row.status==='needs-review').length,withheld:rows.filter(row=>row.status==='withheld').length},rows};
  await fs.mkdir(path.dirname(out),{recursive:true});const temporary=`${out}.${process.pid}.${randomUUID()}.tmp`;
  try{await fs.writeFile(temporary,JSON.stringify(report,null,2));await fs.rename(temporary,out);}finally{await fs.rm(temporary,{force:true});}
  return {output:out,...report};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  measureLocalWallColours().then(result=>console.log(JSON.stringify({output:result.output,counts:result.counts,provenanceSha256:result.provenanceSha256})))
    .catch(error=>{process.stderr.write(`${error.stack??error.message}\n`);process.exitCode=1;});
