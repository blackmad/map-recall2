/** Slice model output using original input coordinates; never implies registration acceptance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';

const root=path.resolve('.cache/facade-assessment/banana-pro-pack-v1');
const out=path.resolve('public/data/facade-review-galleries/banana-pro-pack-v1');
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const esc=(s:unknown)=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const manifest=JSON.parse(await fs.readFile(root+'/inputs/manifest.json','utf8'));
await fs.mkdir(out,{recursive:true});
const jobs=['single0','single80','sheet1k','sheet2k','panorama1k'];
const records:Record<string,any>={};
const inputBytes:Record<string,Buffer>={};
const outputBytes:Record<string,Buffer>={};
let html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nano Banana Pro packed facades</title><style>body{font:16px system-ui;margin:24px;color:#26322e;background:#f7f4ec}article{background:white;padding:18px;margin:24px 0;border-radius:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cuts{grid-template-columns:repeat(4,minmax(0,1fr))}figure{margin:0;min-width:0}img{width:100%;height:550px;object-fit:contain;background:#eeeae1}p,figcaption{overflow-wrap:anywhere}a{color:#285c48}table{border-collapse:collapse;width:100%}th,td{padding:8px;border:1px solid #bbb;text-align:left}@media(max-width:700px){body{margin:10px}.grid,.cuts{grid-template-columns:1fr 1fr}img{height:380px}th,td{padding:4px;font-size:12px}}@media(max-width:420px){.grid,.cuts{grid-template-columns:1fr}}</style><h1>Nano Banana Pro: packed facade experiment</h1><p>Same generic transformation prompt, five independent standard API requests. Sources0 and80 have single-image controls; sources3 and4 occur only in sheets. Both sheet resolutions use identical 1024px input bytes. Output size changes, and the single-image framing instruction differs from the sheet instruction.</p><p>Slices below use the original input cell coordinates, scaled to returned image size. This tests whether slicing is useful; it does not certify that the model preserved geometry, building ownership or texture coordinates. Costs per facade are nominal divisions across four requested panels, not costs per accepted result.</p>';
const panel=(src:string,label:string)=>`<figure><a href="${src}"><img src="${src}" alt="${esc(label)}" loading="lazy"></a><figcaption>${esc(label)}</figcaption></figure>`;
for(const job of jobs){
 const receipt=JSON.parse(await fs.readFile(root+`/${job}.json`,'utf8'));
 if(receipt.status!=='ok')throw Error(`Unfinished job ${job}`);
 const input=manifest.inputs[job];
 const bytes=await fs.readFile(path.resolve(root+'/inputs',input.path));
 if(hash(bytes)!==input.sha256)throw Error(`Input changed ${job}`);
 const png=await fs.readFile(path.resolve(root,receipt.pngPath));
 if(hash(png)!==receipt.pngSha256)throw Error(`Output changed ${job}`);
 inputBytes[job]=bytes;outputBytes[job]=png;
 await sharp(bytes).png().toFile(out+`/${job}-input.png`);
 await fs.writeFile(out+`/${job}-output.png`,png);
 await fs.writeFile(out+`/${job}-prompt.txt`,receipt.prompt);
 records[job]={...receipt,input};
}
html+='<table><tr><th>Request</th><th>Actual USD</th><th>Seconds</th><th>Output size</th></tr>';
for(const job of jobs){const r=records[job];html+=`<tr><td>${job}</td><td>$${r.actualCostUsd.toFixed(5)}</td><td>${(r.clientLatencyMs/1000).toFixed(1)}</td><td>${r.width} × ${r.height}</td></tr>`;}
html+='</table>';
try{const b=await fs.readFile(root+'/review.json');await fs.writeFile(out+'/review.json',b);html+=`<p><strong>Review:</strong> ${esc(JSON.parse(b.toString()).summary)} <a href="review.json">Full findings</a></p>`;}catch(e:any){if(e.code!=='ENOENT')throw e;}
for(const job of ['sheet1k','sheet2k','panorama1k']){
 html+=`<article><h2>${job}</h2><p><a href="${job}-prompt.txt">Exact prompt</a></p><div class="grid">${panel(`${job}-input.png`,'Input')}${panel(`${job}-output.png`,'Pro output')}</div></article>`;
}
const slices:any[]=[];
const gutterDiagnostics:any[]=[];
function scaledRect(bounds:number[],inW:number,inH:number,outW:number,outH:number){
 const left=Math.round(bounds[0]*outW/inW),top=Math.round(bounds[1]*outH/inH);
 return {left,top,width:Math.round(bounds[2]*outW/inW)-left,height:Math.round(bounds[3]*outH/inH)-top};
}
for(const binding of manifest.inputs.sheet1k.sourceBindings){
 const index=binding.index,frames:Buffer[]=[];
 const srcName=`source-${index}-cell.png`;
 await sharp(inputBytes.sheet1k).extract(scaledRect(binding.cellBounds,1024,1024,1024,1024)).png().toFile(out+'/'+srcName);
 let panels=panel(srcName,`Source ${index} in its original cell`);
 frames.push(await sharp(out+'/'+srcName).resize(300,600,{fit:'contain',background:'#eeeae1'}).png().toBuffer());
 const single=records[`single${index}`];
 if(single){panels+=panel(`single${index}-output.png`,'Single-image Pro control');frames.push(await sharp(outputBytes[`single${index}`]).resize(300,600,{fit:'contain',background:'#eeeae1'}).png().toBuffer());}
 else{panels+='<figure><p>No separate control requested</p></figure>';frames.push(await sharp({create:{width:300,height:600,channels:3,background:'#eeeae1'}}).png().toBuffer());}
 for(const job of ['sheet1k','sheet2k']){
  const r=records[job],input=manifest.inputs[job],b=input.sourceBindings.find((v:any)=>v.index===index);
  const rect=scaledRect(b.cellBounds,input.width,input.height,r.width,r.height),filename=`${job}-source-${index}.png`;
  const png=await sharp(outputBytes[job]).extract(rect).png().toBuffer();await fs.writeFile(out+'/'+filename,png);
  slices.push({job,index,cellBounds:b.cellBounds,outputCrop:rect,sha256:hash(png),nominalCostUsd:r.actualCostUsd/input.sourceBindings.length});
  panels+=panel(filename,`${job} fixed-coordinate slice`);
  frames.push(await sharp(png).resize(300,600,{fit:'contain',background:'#eeeae1'}).png().toBuffer());
 }
 html+=`<article><h2>Source ${index}: single versus packed</h2><div class="grid cuts">${panels}</div></article>`;
 await sharp({create:{width:1200,height:600,channels:3,background:'#fff'}}).composite(frames.map((input,i)=>({input,left:i*300,top:0}))).png().toFile(out+`/source-${index}-contact.png`);
}
for(const job of ['sheet1k','sheet2k']){
 const r=records[job],input=manifest.inputs[job];
 for(const [left,right] of [[252,268],[504,520],[756,772]]){
  const rect=scaledRect([left,16,right,1008],1024,1024,r.width,r.height);
  const raw=await sharp(outputBytes[job]).extract(rect).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let white=0;for(let i=0;i<raw.data.length;i+=raw.info.channels)if(raw.data[i]>245&&raw.data[i+1]>245&&raw.data[i+2]>245)white++;
  gutterDiagnostics.push({job,inputX:[left,right],outputRect:rect,whiteFraction:white/(raw.info.width*raw.info.height),note:'Background diagnostic only; not facade registration accuracy'});
 }
}
// Visually selected CONTEXT zones, not cadastral building boundaries or accepted ownership.
const zones=[{label:'Oblique street context',bounds:[0,0,300,576]},{label:'Main frontage context',bounds:[300,0,795,576]},{label:'Right frontage context',bounds:[795,0,1024,576]}];
html+='<article><h2>Continuous panorama: fixed-coordinate context cuts</h2><p>These three visual zones demonstrate slicing only. They are not verified building footprints; the left zone contains several receding frontages. Source coordinates are reused without correcting model movement.</p>';
for(let i=0;i<zones.length;i++){
 const zone=zones[i],r=records.panorama1k;
 const source=await sharp(inputBytes.panorama1k).extract(scaledRect(zone.bounds,1024,576,1024,576)).png().toBuffer();
 const result=await sharp(outputBytes.panorama1k).extract(scaledRect(zone.bounds,1024,576,r.width,r.height)).png().toBuffer();
 await fs.writeFile(out+`/panorama-zone-${i}-source.png`,source);await fs.writeFile(out+`/panorama-zone-${i}-output.png`,result);
 html+=`<h3>${esc(zone.label)}</h3><div class="grid">${panel(`panorama-zone-${i}-source.png`,'Source zone')}${panel(`panorama-zone-${i}-output.png`,'Output at same coordinates')}</div>`;
}
html+='</article>';
await fs.writeFile(out+'/summary.json',JSON.stringify({records,slices,panoramaZones:zones,gutterDiagnostics,totalActualCostUsd:Object.values(records).reduce((sum:number,r:any)=>sum+r.actualCostUsd,0)},null,2)+'\n');
html+='<p><a href="summary.json">Receipts, hashes and slice coordinates</a></p></html>';
await fs.writeFile(out+'/index.html',html);
console.log(JSON.stringify({out,jobs:jobs.length,slices:slices.length}));
