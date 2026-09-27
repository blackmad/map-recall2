/** Publish continuous-strip inputs, generated outputs and source-bound receipts. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve('.cache/facade-assessment/banana-head-on-v1');
const out=path.resolve('public/data/facade-review-galleries/banana-head-on-v1');
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const esc=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const manifest=JSON.parse(await fs.readFile(root+'/inputs/manifest.json','utf8'));
await fs.mkdir(out,{recursive:true});
let html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Continuous head-on facade strips</title><style>body{font:17px system-ui;background:#f7f4ec;color:#26322e;margin:24px}article{background:white;padding:18px;border-radius:12px;margin:24px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{min-width:0;margin:0}img{width:100%;height:500px;object-fit:contain;background:#eeeae1}a{color:#285c48}p,h2{overflow-wrap:anywhere}@media(max-width:700px){body{margin:10px}.pair{grid-template-columns:1fr}img{height:auto}}</style><h1>Continuous head-on facade strips</h1><p>Three single-source photographic strips, not stitched facade crops. Nano Banana Pro, 2K output, same prompt across all three. Foreground occlusions are filled with plausible facade continuation; reconstructed details are hypotheses, not observations. No generated geometry or colours accepted into game data.</p>';
const receipts:any[]=[];
let review:any;
try{review=JSON.parse(await fs.readFile(root+'/review.json','utf8'));await fs.writeFile(out+'/review.json',JSON.stringify(review,null,2)+'\n');html+=`<p><strong>Review:</strong> ${esc(review.summary)}</p>`;}catch(e:any){if(e.code!=='ENOENT')throw e;}
for(const job of ['strip1','strip2','strip3']){
 const input=manifest.inputs[job];const bytes=await fs.readFile(path.resolve(root+'/inputs',input.path));
 if(sha(bytes)!==input.sha256)throw Error(`${job} input changed`);
 const r=JSON.parse(await fs.readFile(root+`/${job}.json`,'utf8'));if(r.status!=='ok')throw Error(`${job} unfinished`);
 const output=await fs.readFile(path.resolve(root,r.pngPath));if(sha(output)!==r.pngSha256)throw Error(`${job} output changed`);
 await sharp(bytes).png().toFile(out+`/${job}-input.png`);await fs.writeFile(out+`/${job}-output.png`,output);await fs.writeFile(out+`/${job}-prompt.txt`,r.prompt);
 receipts.push(r);
 html+=`<article><h2>${esc(job)} · ${esc(input.label??input.panoramaBinding?.panoramaId)}</h2><p>$${r.actualCostUsd.toFixed(6)} · ${(r.clientLatencyMs/1000).toFixed(1)} seconds · ${r.width} × ${r.height} output · <a href="${job}-prompt.txt">Exact prompt</a></p><div class="pair">`;
 for(const side of ['input','output'])html+=`<figure><a href="${job}-${side}.png"><img src="${job}-${side}.png" alt="${job} ${side}"></a><figcaption>${side==='input'?'Continuous photograph':'Pro drawing with inferred occlusion fills'}</figcaption></figure>`;
 html+=`</div><p>${esc(review?.findings?.[job]??'Visual review pending.')}</p></article>`;
}
const total=receipts.reduce((sum,r)=>sum+r.actualCostUsd,0);
html+=`<p>Total actual API cost: $${total.toFixed(6)}. <a href="summary.json">Receipts and provenance</a></p></html>`;
await fs.writeFile(out+'/summary.json',JSON.stringify({manifest,receipts,totalActualCostUsd:total},null,2)+'\n');await fs.writeFile(out+'/index.html',html);console.log(JSON.stringify({out,total}));
