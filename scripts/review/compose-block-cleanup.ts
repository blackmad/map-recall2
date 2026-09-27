/** Replace only reviewed balcony projection regions; retain every pixel outside the union. */
import fs from 'node:fs/promises';import sharp from 'sharp';import {createHash} from 'node:crypto';
const root='.cache/facade-assessment/block-assemblies-v1',base='public/data/facade-review-galleries/head-on-3d-v1/';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const sourceBytes=await fs.readFile(base+'strip1-texture.png');
const cleanBytes=await fs.readFile(root+'/banana-clean.png');
const cleanReceipt=await read(root+'/banana-clean.json');if(sha(cleanBytes)!==cleanReceipt.pngSha256)throw Error('Clean source changed');
const alignment=await read(root+'/layer-alignment.json');if(!alignment.geometricGate)throw Error('Alignment not sufficient');
const regions=await read(root+'/balcony-cleanup/balcony-cleanup.json');
const generatedBytes=await fs.readFile('.cache/facade-assessment/banana-head-on-v1/strip1.png');
if(regions.sourceSha256!==sha(generatedBytes))throw Error('Mask source changed');
const report=await read(root+'/geometry-report.json');const accepted=new Set(report.strips[0].balconies.acceptedBalconies);
const {data:original,info}=await sharp(sourceBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const clean=await sharp(cleanBytes).resize(info.width,info.height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
const output=Buffer.from(original),mask=Buffer.alloc(info.width*info.height);let changed=0;
for(const region of regions.proposals){if(!region.verified||!accepted.has(region.id))continue;const [l,t,r,b]=region.cleanupBounds;
 for(let y=Math.floor(t*info.height);y<Math.ceil(b*info.height);y++)for(let x=Math.floor(l*info.width);x<Math.ceil(r*info.width);x++){
 if(x<0||x>=info.width||y<0||y>=info.height)throw Error('Out of image mask');const i=y*info.width+x;mask[i]=255;for(let k=0;k<3;k++)output[i*4+k]=clean[i*4+k];
 }}
for(let i=0;i<mask.length;i++)for(let k=0;k<4;k++){if(!mask[i]&&output[i*4+k]!==original[i*4+k])throw Error('Outside mask changed');if(output[i*4+k]!==original[i*4+k])changed++;}
await sharp(output,{raw:info}).png().toFile(base+'block-auto-texture.png');
await fs.copyFile(base+'strip1-bump.png',base+'block-auto-bump.png');
await sharp(mask,{raw:{width:info.width,height:info.height,channels:1}}).png().toFile(root+'/cleanup-mask.png');
const result={outputTextureSha256:sha(await fs.readFile(base+'block-auto-texture.png')),sourceTextureSha256:sha(sourceBytes),generatedSourceSha256:sha(generatedBytes),cleanSha256:sha(cleanBytes),maskSha256:sha(mask),outsideMaskUnchanged:true,changedChannels:changed,regions:regions.proposals.filter((m:any)=>m.verified&&accepted.has(m.id)),policy:'Inferred local inpaint; original alpha and all pixels outside accepted masks preserved; not measured albedo'};
await fs.writeFile(root+'/cleanup-composite.json',JSON.stringify(result,null,2));console.log({changed,regions:result.regions.length});
