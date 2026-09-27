/** Build exact-source patch diagnostics; no game assignments or calibrated RGB. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {measureWallPatch,type PatchBounds} from '../../src/canalRecall/facade/wallPatchMeasurement.ts';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const flag=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const input=flag('input','review-data/facade-assessment/wall-patch-controls.json');
const output=path.resolve(flag('out','.cache/facade-assessment/wall-patch-controls-v1'));
const cohortFile='.cache/facade-assessment/cohort.json';
const pilotDir='.cache/facade-assessment/occfacade-full100-v1';
const vistasDir='.cache/facade-assessment/occfacade-visible100-v1/segmentation';
const comparisonDir='.cache/facade-assessment/occfacade-wall100-reviewed-v3';
const annotations=await read(input),cohort=await read(cohortFile),pilot=await read(`${pilotDir}/receipt.json`),vistas=await read(`${vistasDir}/s1.provenance.json`),comparison=await read(`${comparisonDir}/comparison.json`);
if(new Set(annotations.records.map((r:any)=>r.index)).size!==annotations.records.length)throw Error('Duplicate patch owner');
try{await fs.access(output);throw Error('Use a fresh output directory');}catch(e:any){if(e.code!=='ENOENT')throw e;}
await fs.mkdir(output,{recursive:true});
const checked=async(file:string,hash:string)=>{const b=await fs.readFile(file);if(sha(b)!==hash)throw Error(`Evidence changed: ${file}`);return b;};
const decodeMask=async(file:string,hash:string,width:number,height:number,label:number)=>{
 const bytes=await checked(file,hash),meta=await sharp(bytes).metadata();
 if(meta.channels!==1||meta.width!==width||meta.height!==height||meta.hasAlpha)throw Error('Expected exact-size opaque label mask');
 const data=await sharp(bytes).toColourspace('b-w').raw().toBuffer();
 if(data.length!==width*height)throw Error('Unexpected label layout');
 return Uint8Array.from(data,x=>Number(x===label));
};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const records:any[]=[],cards:string[]=[];
for(const entry of annotations.records){
 const source=cohort.entries.find((e:any)=>e.index===entry.index)?.images.find((s:any)=>s.kind==='full');
 if(!source||source.sha256!==entry.sourceSha256)throw Error('Patch source binding changed');
 const bytes=await checked(source.path,entry.sourceSha256),decoded=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height,channels}=decoded.info;if(channels!==3)throw Error('Expected RGB source');
 const name=String(entry.index).padStart(3,'0'),pr=pilot.records.find((x:any)=>x.index===entry.index&&x.kind==='full'),vr=vistas.records.find((x:any)=>x.stem===entry.sourceSha256),cr=comparison.records.find((x:any)=>x.index===entry.index);
 if(pr?.sourceSha256!==entry.sourceSha256||cr?.sourceSha256!==entry.sourceSha256||!vr)throw Error('Unbound model masks');
 const masks={occWall:await decodeMask(`${pilotDir}/${name}-full-labels.png`,pr.labelsSha256,width,height,5),vistasBuilding:await decodeMask(path.join(vistasDir,vr.mask),vr.maskSha256,width,height,2),intersection:await decodeMask(`${comparisonDir}/${name}-combined.png`,cr.combinedMaskSha256,width,height,255)};
 const regions:any[]=[],figures:string[]=[],rects:string[]=[];
 if(new Set(entry.regions.map((r:any)=>r.id)).size!==entry.regions.length)throw Error('Duplicate region ID');
 for(const [i,r] of entry.regions.entries()){
  if(!['upper-wall','base-wall','exclude-window','exclude-occluder'].includes(r.role)||!Array.isArray(r.bounds)||r.bounds.length!==4)throw Error('Invalid region');
  const measurement=measureWallPatch({width,height,data:decoded.data},r.bounds as PatchBounds,masks);
  const [x0,y0,x1,y1]=r.bounds,filename=`${name}-patch-${i}.png`,crop=await sharp(bytes).extract({left:x0,top:y0,width:x1-x0,height:y1-y0}).png().toBuffer();
  await fs.writeFile(path.join(output,filename),crop);
  const rgb=measurement.medianRGB.map(Math.round),hex='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
  regions.push({...r,...measurement,photoMedianHex:hex,cropSha256:sha(crop),file:filename});
  const colour=r.role.startsWith('exclude')?'#ff00bb':'#00e5ff';
  rects.push(`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" stroke="${colour}" stroke-width="2"/><text x="${x0}" y="${Math.max(12,y0-3)}" font-size="12" fill="${colour}" stroke="#000" stroke-width=".2">${i+1}</text>`);
  figures.push(`<figure><img class="patch" src="${filename}"><figcaption>${i+1}. ${escape(r.role)} · ${escape(r.material)} · ${escape(r.colourFamily)}<br><i style="background:${hex}"></i>${hex} photographed median<br>Intersection includes ${(measurement.maskCoverage.intersection*100).toFixed(1)}%<br>${escape(r.note??'')}</figcaption></figure>`);
 }
 const overlay=await sharp(bytes).composite([{input:Buffer.from(`<svg width="${width}" height="${height}">${rects.join('')}</svg>`)}]).png().toBuffer();
 await fs.writeFile(path.join(output,`${name}-regions.png`),overlay);
 const owner=cohort.entries.find((x:any)=>x.index===entry.index);
 records.push({...entry,address:owner.address,regions,ownerIdentityAccepted:false,gameColourAccepted:false});
 cards.push(`<article><h2>${entry.index}: ${escape(owner.address)}</h2><div class="row"><img class="source" src="${name}-regions.png"><div class="patches">${figures.join('')}</div></div></article>`);
}
const report={version:1,policy:'Model-reviewed source-pixel controls, not independent human ground truth or calibrated albedo. Mask coverage on selected patches is not whole-image accuracy. Negative controls must not enter colour estimates.',inputSha256:sha(await fs.readFile(input)),cohortSha256:sha(await fs.readFile(cohortFile)),pilotReceiptSha256:sha(await fs.readFile(`${pilotDir}/receipt.json`)),vistasReceiptSha256:sha(await fs.readFile(`${vistasDir}/s1.provenance.json`)),comparisonSha256:sha(await fs.readFile(`${comparisonDir}/comparison.json`)),measurementCodeSha256:sha(await fs.readFile('src/canalRecall/facade/wallPatchMeasurement.ts')),records};
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Reviewed wall patch controls</title><style>body{font:16px system-ui;background:#f7f5ef;color:#242923;margin:24px}article{background:white;border:1px solid #ddd;padding:16px;margin:24px 0}.row{display:flex;gap:24px}.source{width:32%;object-fit:contain;align-self:flex-start;max-height:850px}.patches{flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}figure{margin:0}.patch{width:100%;height:120px;object-fit:contain;background:#eee;image-rendering:pixelated}figcaption{font-size:13px}i{display:inline-block;width:18px;height:18px;margin:3px;vertical-align:middle}@media(max-width:750px){body{margin:10px}.row{display:block}.source{width:100%;max-height:500px}.patches{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><h1>Reviewed wall patches and negative controls</h1><p>Cyan: candidate wall samples. Magenta: glass/occluder controls. Each region is bound to original source pixels. Displayed RGB is photographed colour, affected by lighting; it is not a new game material.</p><p><a href="report.json">Measurements and source bindings</a></p>${cards.join('')}</html>`);
console.log(JSON.stringify({output,owners:records.length,regions:records.reduce((n,r)=>n+r.regions.length,0)}));
