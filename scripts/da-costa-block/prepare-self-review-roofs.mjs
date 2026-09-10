/** Source-only roof inspection packets. Does not read any model proposal. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve('.cache/da-costa-neighbourhood'),out=path.join(root,'self-review-2026-09-09');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'))),aerial=JSON.parse(await fs.readFile(path.join(root,'aerial.json')));
const indices=[1,8,11,12,28,29,34,45,54,56,73,90],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const text=(s,w=1600,h=45)=>Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f1e9"/><text x="12" y="28" font-family="sans-serif" font-size="20" fill="#17372d">${String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')}</text></svg>`);
await fs.mkdir(out,{recursive:true});const records=[];
for(const index of indices){
  const r=manifest.records[index],a=aerial.records.find(a=>a.buildingId===r.buildingId);
  const sources=[...['full','roof'].map(kind=>({kind,...r.images[kind]})),{kind:'aerial',...a},{kind:'aerial-context',...a.context,layer:a.layer,date:a.date,sourceSha256:a.sourceSha256}];
  const parts=[{input:text(`${index} · ${r.address} · ${r.buildingId}`),left:0,top:0}];
  const positions=[[0,45,400,710],[400,45,1200,710],[0,755,800,800],[800,755,800,800]];
  for(let i=0;i<sources.length;i++){
    const m=sources[i],bytes=await fs.readFile(path.join(root,'images',m.file));if(sha(bytes)!==m.sha256)throw Error('Changed pixels '+m.file);
    const [x,y,w,h]=positions[i];parts.push({input:text(`${m.kind} · ${String(m.date).slice(0,28)}${i>=2?' · yellow target outline':''}`,w),left:x,top:y});parts.push({input:await sharp(bytes).resize(w,h-45,{fit:'contain',background:'#26372f'}).jpeg({quality:96}).toBuffer(),left:x,top:y+45});
  }
  const file=path.join(out,String(index).padStart(3,'0')+'-roof-packet.jpg');await sharp({create:{width:1600,height:1555,channels:3,background:'#f3f1e9'}}).composite(parts).jpeg({quality:96}).toFile(file);
  records.push({index,id:r.id,buildingId:r.buildingId,address:r.address,derivationKey:r.derivationKey,coverageComplete:a.coverageComplete,sheet:file,images:sources,originalPanoramas:[...new Map(['full','roof'].map(k=>[r.images[k].panoramaId,{file:path.join(root,'panoramas',r.images[k].panoramaId+'.jpg'),sha256:r.images[k].panoramaSha256,url:r.images[k].url}])).values()]});
}
await fs.writeFile(path.join(out,'roof-sources.json'),JSON.stringify({version:1,origin:'agent-review',humanReviewed:false,selection:'Twelve distinct buildings from the roof-conflict queue, preferring broad street faces. No model answers are included.',records},null,2));console.log(records.map(r=>({index:r.index,address:r.address,coverageComplete:r.coverageComplete,sheet:r.sheet})));
