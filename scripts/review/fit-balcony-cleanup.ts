/** Source-bound balcony paint cleanup proposals. The masks are rectangles, not
 * accepted feature geometry; verified gates require both side rails and slab. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

type Feature={id:string;kind:string;bounds:number[];linkedOpeningId?:string;wallColour?:string|null};
type Box={x0:number;y0:number;x1:number;y1:number};
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const px=(bounds:number[],w:number,h:number):Box=>({x0:Math.floor(bounds[0]*w),y0:Math.floor(bounds[1]*h),
  x1:Math.ceil(bounds[2]*w),y1:Math.ceil(bounds[3]*h)});
const norm=(b:Box,w:number,h:number)=>[b.x0/w,b.y0/h,b.x1/w,b.y1/h].map(x=>+x.toFixed(6));
const valid=(f:Feature)=>f.id&&f.bounds.length===4&&f.bounds.every(Number.isFinite)&&
  f.bounds[0]>=0&&f.bounds[1]>=0&&f.bounds[2]<=1&&f.bounds[3]<=1&&
  f.bounds[2]>f.bounds[0]&&f.bounds[3]>f.bounds[1];

export function fitBalconyPaint(balcony:Feature,opening:Feature,dark:Uint8Array,w:number,h:number,
  otherOpenings:Feature[]=[]) {
  if(!valid(balcony)||!valid(opening)||dark.length!==w*h||balcony.linkedOpeningId!==opening.id)
    throw Error('Invalid linked balcony/opening/image contract');
  const b=px(balcony.bounds,w,h),o=px(opening.bounds,w,h),ow=o.x1-o.x0,oh=o.y1-o.y0;
  const nextY=Math.min(h,...otherOpenings.filter(f=>f.id!==opening.id&&f.kind==='window'&&valid(f))
    .map(f=>px(f.bounds,w,h)).filter(q=>q.y0>b.y1+3&&q.x0<o.x1&&q.x1>o.x0).map(q=>q.y0));
  const x0=clamp(Math.floor(b.x0-ow*.20),0,w-1),x1=clamp(Math.ceil(b.x1+ow*.20),x0+1,w);
  const y0=clamp(Math.floor(o.y0+oh*.08),0,h-1),scanBottom=clamp(Math.ceil(b.y1+oh*.45),y0+1,Math.min(h,nextY-3));
  const leftEnd=Math.max(x0+2,Math.min(x1,o.x0-1)),rightStart=Math.min(x1-2,Math.max(x0,o.x1+1));
  const rows={left:[] as number[],right:[] as number[]};
  for(let y=y0;y<scanBottom;y++) {
    let left=0,right=0;
    for(let x=x0;x<leftEnd;x++)left+=dark[y*w+x];
    for(let x=rightStart;x<x1;x++)right+=dark[y*w+x];
    if(left>=2)rows.left.push(y);
    if(right>=2)rows.right.push(y);
  }
  const sideThreshold=Math.max(5,Math.floor(oh*.28));
  const sideEvidence=rows.left.length>=sideThreshold&&rows.right.length>=sideThreshold;
  const firstSide=Math.min(rows.left[0]??o.y0,rows.right[0]??o.y0);
  let slabLast=b.y1-1,slabRows=0;
  for(let y=Math.max(y0,b.y1-5);y<scanBottom;y++) {
    let n=0;for(let x=x0;x<x1;x++)n+=dark[y*w+x];
    if(n/(x1-x0)>.38){slabLast=y;slabRows++;}
  }
  const slabEvidence=slabRows>=1;
  const top=clamp(Math.min(firstSide,o.y0+Math.floor(oh*.12))-2,o.y0-3,b.y0);
  const bottom=clamp(Math.max(slabLast+3,b.y1+2),b.y1+1,scanBottom);
  // Include thin side-return strokes and support tips beyond the dense rail box.
  // Bound the safety margin by neighboring openings instead of erasing them.
  const margin=Math.max(2,Math.round(w*.008));
  const bbox={x0:Math.max(0,x0-margin),y0:top,x1:Math.min(w,x1+margin),y1:Math.min(h,bottom+margin)};
  for(const other of otherOpenings.filter(f=>f.id!==opening.id&&valid(f))){
    const q=px(other.bounds,w,h);
    if(q.y0<bottom&&q.y1>top){
      if(q.x1<=x0)bbox.x0=Math.max(bbox.x0,q.x1+1);
      if(q.x0>=x1)bbox.x1=Math.min(bbox.x1,q.x0-1);
    }
    if(q.x0<bbox.x1&&q.x1>bbox.x0&&q.y0>=bottom)bbox.y1=Math.min(bbox.y1,q.y0-1);
  }
  const overlapsOther=otherOpenings.filter(f=>f.id!==opening.id&&valid(f))
    .filter(f=>{const q=px(f.bounds,w,h);return q.x0<bbox.x1&&q.x1>bbox.x0&&q.y0<bbox.y1&&q.y1>bbox.y0;})
    .map(f=>f.id);
  const reasons=[sideEvidence?'both-side-rails-dark':'side-rail-evidence-insufficient',
    slabEvidence?'lower-slab-dark':'lower-slab-evidence-insufficient',
    overlapsOther.length?'overlaps-unlinked-opening':'no-other-opening-overlap'];
  const verified=sideEvidence&&slabEvidence&&!overlapsOther.length&&Boolean(balcony.wallColour);
  return {id:balcony.id,linkedOpeningId:opening.id,cleanupBounds:norm(bbox,w,h),
    wallColour:balcony.wallColour??null,verified,reasons,
    evidence:{analysisBounds:[bbox.x0,bbox.y0,bbox.x1,bbox.y1],sideDarkRows:{left:rows.left.length,right:rows.right.length},
      slabDarkRows:slabRows,overlapsOther}};
}

export async function run(imagePath:string,featuresPath:string,outDir:string) {
  const image=await fs.readFile(imagePath),featuresBytes=await fs.readFile(featuresPath),record=JSON.parse(featuresBytes.toString());
  const meta=await sharp(image).metadata();
  if(sha(image)!==record.source?.imageSha256||meta.width!==record.source?.width||meta.height!==record.source?.height)
    throw Error('Balcony source image/hash/dimensions mismatch');
  const {data,info}=await sharp(image).resize({width:1024,withoutEnlargement:true}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.channels!==3)throw Error('Expected RGB source');
  const dark=new Uint8Array(info.width*info.height);
  for(let i=0;i<dark.length;i++)dark[i]=(54*data[i*3]+183*data[i*3+1]+19*data[i*3+2])/256<85?1:0;
  const features=record.features as Feature[],byId=new Map(features.map(f=>[f.id,f]));
  if(byId.size!==features.length||features.some(f=>!valid(f)))throw Error('Invalid or duplicate feature contract');
  const openings=features.filter(f=>f.kind==='window'||f.kind==='door');
  const proposals=features.filter(f=>f.kind==='balcony').map(b=>{
    const opening=byId.get(b.linkedOpeningId??'');
    if(!opening||opening.kind!=='window')throw Error(`Missing linked opening: ${b.id}`);
    return fitBalconyPaint(b,opening,dark,info.width,info.height,openings);
  });
  await fs.mkdir(outDir,{recursive:true});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">${proposals.map(p=>{
    const [l,t,r,b]=p.cleanupBounds,colour=p.verified?'#00ff98':'#ff5b4d';
    return `<rect x="${l*info.width}" y="${t*info.height}" width="${(r-l)*info.width}" height="${(b-t)*info.height}" fill="none" stroke="${colour}" stroke-width="2"/><text x="${l*info.width}" y="${t*info.height-3}" font-size="10" fill="${colour}">${p.id}</text>`;
  }).join('')}</svg>`;
  const overlay=await sharp(image).resize({width:info.width}).composite([{input:Buffer.from(svg)}]).png().toBuffer();
  const overlayPath=path.join(outDir,'balcony-cleanup-overlay.png');await fs.writeFile(overlayPath,overlay);
  const mask=new Uint8Array(meta.width!*meta.height!);let maskPixels=0;
  for(const proposal of proposals.filter(p=>p.verified)) {
    const bounds=px(proposal.cleanupBounds,meta.width!,meta.height!);
    for(let y=bounds.y0;y<bounds.y1;y++)for(let x=bounds.x0;x<bounds.x1;x++){
      const i=y*meta.width!+x;if(!mask[i]){mask[i]=255;maskPixels++;}
    }
  }
  const maskBytes=await sharp(Buffer.from(mask),{raw:{width:meta.width!,height:meta.height!,channels:1}}).png().toBuffer();
  const maskPath=path.join(outDir,'verified-cleanup-mask.png');await fs.writeFile(maskPath,maskBytes);
  const output={version:1,policy:'Source-bound paint cleanup proposals only; apply verified boxes after rebuilding linked window and balcony.',
    sourceSha256:sha(image),featuresSha256:sha(featuresBytes),imageSize:[meta.width,meta.height],
    analysisSize:[info.width,info.height],proposals,
    counts:{total:proposals.length,verified:proposals.filter(p=>p.verified).length,withheld:proposals.filter(p=>!p.verified).length},
    overlay:{path:overlayPath,sha256:sha(overlay)},
    verifiedMask:{path:maskPath,sha256:sha(maskBytes),width:meta.width,height:meta.height,
      pixels:maskPixels,semantics:'255 inside verified balcony cleanup rectangles; 0 elsewhere; source-image pixel grid'}};
  await fs.writeFile(path.join(outDir,'balcony-cleanup.json'),JSON.stringify(output,null,2)+'\n');return output;
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const args=new Map(process.argv.slice(2).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
  const image=args.get('--image'),features=args.get('--features'),out=args.get('--out');
  if(!image||!features||!out)throw Error('Usage: --image=strip.png --features=components.json --out=directory');
  run(image,features,out).then(result=>console.log(JSON.stringify(result.counts))).catch(e=>{console.error(e);process.exitCode=1;});
}
