/** Read-only source QA contact sheets; writes only a new agent-review output directory. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve('.cache/da-costa-neighbourhood'),out=path.join(root,'self-review-2026-09-09');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json')));
const indices=[0,3,8,11,22,28,30,33,36,45,54,56,67,73,76,90];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(s,w=1800,h=48)=>Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f1e9"/><text x="14" y="30" font-family="sans-serif" font-size="23" fill="#17372d">${esc(s)}</text></svg>`);
await fs.mkdir(out,{recursive:true});const records=[];
for(const i of indices){
  const r=manifest.records[i],sources=[],panos=[],parts=[];
  const kinds=['full','context','ground','roof'];
  for(const kind of kinds){const m=r.images[kind],file=path.join(root,'images',m.file),bytes=await fs.readFile(file);if(sha(bytes)!==m.sha256)throw Error('Changed source '+file);sources.push({kind,file,sha256:m.sha256,panoramaId:m.panoramaId,panoramaSha256:m.panoramaSha256,date:m.date});}
  const unique=[...new Set(kinds.map(k=>r.images[k].panoramaId))];
  for(const panoramaId of unique){
    const m=Object.values(r.images).find(m=>m.panoramaId===panoramaId),file=path.join(root,'panoramas',panoramaId+'.jpg'),bytes=await fs.readFile(file);
    if(sha(bytes)!==m.panoramaSha256)throw Error('Changed panorama '+file);
    panos.push({file,sha256:m.panoramaSha256,sourceKinds:kinds.filter(k=>r.images[k].panoramaId===panoramaId),url:m.url});
    parts.push({input:text(`Original 360° panorama · ${panos.at(-1).sourceKinds.join(', ')} · ${m.date.slice(0,10)}`),left:0,top:48+(panos.length-1)*510});
    parts.push({input:await sharp(bytes).resize(1800,900).extract({left:0,top:180,width:1800,height:450}).jpeg({quality:90}).toBuffer(),left:0,top:96+(panos.length-1)*510});
  }
  const top=48+panos.length*510;
  parts.unshift({input:text(`${i} · ${r.address} · ${r.wallWidthM.toFixed(1)} m · ${r.id}`),left:0,top:0});
  const positions={full:[0,0,350,850],context:[350,0,650,850],ground:[1000,0,800,420],roof:[1000,450,800,400]};
  for(const kind of kinds){const [x,y,w,h]=positions[kind];parts.push({input:text(kind,w),left:x,top:top+y});parts.push({input:await sharp(path.join(root,'images',r.images[kind].file)).resize(w,h-48,{fit:'contain',background:'#25342d'}).jpeg({quality:93}).toBuffer(),left:x,top:top+y+48});}
  const sheet=path.join(out,String(i).padStart(3,'0')+'-source-and-crops.jpg');
  await sharp({create:{width:1800,height:top+850,channels:3,background:'#f3f1e9'}}).composite(parts).jpeg({quality:93}).toFile(sheet);
  records.push({index:i,id:r.id,address:r.address,buildingId:r.buildingId,derivationKey:r.derivationKey,wallWidthM:r.wallWidthM,sheet,sources,panoramas:panos});
}
await fs.writeFile(path.join(out,'sample-sources.json'),JSON.stringify({version:1,origin:'agent-review',humanReviewed:false,method:'Purposive 16/103 sample, selected by street, width, complexity and landmark coverage, not by model consensus. Panorama band is original equirectangular pixels resized to 1800 wide then cropped vertically to source y=800..2800; no rectification or generated content. Full, context, ground and roof crops are shown unchanged apart from display resizing.',records},null,2));
console.log(JSON.stringify({out,records:records.map(r=>({index:r.index,address:r.address,sheet:r.sheet}))},null,2));
