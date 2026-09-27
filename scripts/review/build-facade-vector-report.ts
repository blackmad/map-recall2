/** Publish inert PNG comparisons and usage receipts; no game appearance writes. */
import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';import {createHash} from 'node:crypto';
const arg=(n:string,d:string)=>process.argv.find(v=>v.startsWith(`--${n}=`))?.slice(n.length+3)??d;
const root=path.resolve(arg('root','.cache/facade-assessment/vector-pilot'));
const inputRoot=path.resolve(arg('inputs','.cache/facade-assessment/vector-inputs-v1'));
const out=path.resolve(arg('out','public/data/facade-review-galleries/vector-pilot-v1'));
const manifest=JSON.parse(await fs.readFile(inputRoot+'/manifest.json','utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const esc=(s:any)=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
await fs.mkdir(out,{recursive:true});await fs.mkdir(root+'/contacts',{recursive:true});
const reports:any[]=[];
for(const d of await fs.readdir(root,{withFileTypes:true})){if(!d.isDirectory())continue;try{const r=JSON.parse(await fs.readFile(path.join(root,d.name,'report.json'),'utf8'));if(r.receipts){const receipts=[];for(const file of await fs.readdir(path.join(root,d.name))){if(!/^\d+-(svg|structured|assisted)\.json$/.test(file))continue;const receipt=JSON.parse(await fs.readFile(path.join(root,d.name,file),'utf8'));if(receipt.status!=='requesting')receipts.push(receipt);}reports.push({...r,receipts,directory:d.name});}}catch(e:any){if(e.code!=='ENOENT')throw e;}}
let html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facade vector pilot</title><style>body{font:16px system-ui;margin:20px;background:#f7f4ec;color:#23302a}h1{font-size:26px}section{border-top:2px solid #bbc5ba;margin:30px 0}article{margin:20px 0;padding:15px;background:white;border-radius:10px}.panels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}figure{margin:0;min-width:0}img{width:100%;height:430px;object-fit:contain;background:#eae8e1}figcaption,small,p,h2{overflow-wrap:anywhere}table{border-collapse:collapse}td,th{padding:8px;border:1px solid #ccc}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:700px){.panels{grid-template-columns:1fr 1fr}img{height:300px}body{margin:10px}table{font-size:12px}td,th{padding:4px}}</style><h1>Photo → facade vector pilot</h1><p>Source-space studies only. Building identity, metric registration and hidden geometry are unresolved. Rendered output is not visual acceptance. Same original image in every arm; assisted adds a fallible OccFacade overlay. Local model has no API fee.</p>';
html+='<table><tr><th>Model</th><th>Technically rendered / attempted</th><th>Recorded API USD</th><th>Median seconds</th></tr>';
const summary=[];
for(const r of reports){const times=r.receipts.map((x:any)=>x.clientLatencyMs).filter(Number.isFinite).sort((a:number,b:number)=>a-b),cost=r.receipts.reduce((s:number,x:any)=>s+(x.actualCostUsd??x.usage?.cost??0),0),unknown=r.model.startsWith('local/')?0:r.receipts.filter((x:any)=>!Number.isFinite(x.actualCostUsd??x.usage?.cost)).length;const row={model:r.model,rendered:r.receipts.filter((x:any)=>x.status==='rendered').length,attempted:r.receipts.length,costUsd:cost,unresolvedCosts:unknown,medianSeconds:times.length?times[Math.floor(times.length/2)]/1000:null};summary.push(row);html+=`<tr><td>${esc(r.model)}</td><td>${row.rendered}/${row.attempted}</td><td>${cost.toFixed(5)}${unknown?' + unresolved':''}</td><td>${row.medianSeconds?.toFixed(1)??'—'}</td></tr>`;}
html+='</table>';
html+='<p><strong>Technical rendering is not facade accuracy.</strong> Development failures and current outputs are retained. Broad material colours may be plausible while opening geometry is wrong. The structured schema has no explicit balcony assembly and simplifies curved heads; this limits the comparison.</p>';
const baselineFile=path.resolve('.cache/facade-assessment/vector-pilot/occ-baseline-v1/manifest.json');
try{const baseline=JSON.parse(await fs.readFile(baselineFile,'utf8'));html+='<section><h2>Local OccFacade pixel-component baseline</h2><p>Raw class proposals, not accepted openings. Components can fragment a window; the shop class can cover a whole ground-floor zone and occluders. No new inference charge.</p>';
for(const r of baseline.records){html+=`<article><h3>Source ${r.index} · ${r.proposalCount} component proposals</h3><div class="panels">`;for(const [field,hash,label] of [['sourcePath','sourceSha256','Photograph'],['overlayPath','overlaySha256','Raw mask and retained boxes'],['rectanglesPath','rectanglesSha256','Component rectangles']]){const bytes=await fs.readFile(r[field]);if(sha(bytes)!==r[hash])throw Error('Baseline artifact changed');const ext=field==='sourcePath'?'jpg':'png',name=`occ-${r.index}-${field}.${ext}`;await fs.writeFile(out+'/'+name,bytes);html+=`<figure><img src="${name}" alt="${label} ${r.index}" loading="lazy"><figcaption>${label}</figcaption></figure>`;}html+='</div></article>';}html+='</section>';
}catch(e:any){if(e.code!=='ENOENT')throw e;}

for(const r of reports){
 const mi=r.directory;
 html+=`<section><h2>${esc(r.model)}</h2>`;
 for(const index of [...new Set<number>(r.receipts.map((x:any)=>x.index))]){
  const e=manifest.entries.find((x:any)=>x.index===index),source=await fs.readFile(path.resolve(inputRoot,e.imagePath));if(sha(source)!==e.imageSha256)throw Error('Source changed');const sourceFile=`source-${index}.jpg`;await fs.writeFile(out+'/'+sourceFile,source);
  html+=`<article><h3>Source ${index} · ${esc(e.buildingId)}</h3><div class="panels"><figure><img src="${sourceFile}" alt="Source ${index}" loading="lazy"><figcaption>Photograph · identity unresolved</figcaption></figure>`;
  const frames:Buffer[]=[await sharp(source).resize(400,500,{fit:'contain',background:'#eae8e1'}).png().toBuffer()];
  for(const arm of ['svg','structured','assisted']){
   const receipt=r.receipts.find((x:any)=>x.index===index&&x.arm===arm),label={svg:'Direct SVG',structured:'Structured',assisted:'Structured + OccFacade'}[arm];
   if(receipt?.pngPath){const image=await fs.readFile(receipt.pngPath);if(sha(image)!==receipt.pngSha256)throw Error('Render changed');const filename=`model${mi}-${index}-${arm}.png`;await fs.writeFile(out+'/'+filename,image);frames.push(await sharp(image).resize(400,500,{fit:'contain',background:'#eae8e1'}).png().toBuffer());html+=`<figure><img src="${filename}" alt="${label} source ${index}" loading="lazy"><figcaption>${label} · ${(receipt.clientLatencyMs/1000).toFixed(1)}s · $${(receipt.actualCostUsd??receipt.usage?.cost??0).toFixed(5)}</figcaption></figure>`;}
   else{frames.push(await sharp({create:{width:400,height:500,channels:3,background:'#dddddd'}}).png().toBuffer());html+=`<figure><p>${label}: ${esc(receipt?.error??'pending')}</p></figure>`;}
  }
  html+='</div></article>';
  await sharp({create:{width:1600,height:500,channels:3,background:'#fff'}}).composite(frames.map((input,i)=>({input,left:i*400,top:0}))).png().toFile(root+`/contacts/model${mi}-${index}.png`);
 }
 html+='</section>';
}
await fs.writeFile(out+'/index.html',html);await fs.writeFile(out+'/summary.json',JSON.stringify(summary,null,2)+'\n');await fs.writeFile(root+'/contacts/key.json',JSON.stringify(reports.map((r)=>({blindLabel:`model${r.directory}`,model:r.model,directory:r.directory,columns:['source','svg','structured','assisted']})),null,2));
console.log(JSON.stringify({out,summary},null,2));
