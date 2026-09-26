/** Independent image-first review packets. Never writes active evidence or reviews. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve('.cache/da-costa-neighbourhood');
const out=path.join(root,'blind-storefront-2026-09-09');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifestBytes=await fs.readFile(path.join(root,'manifest.json'));
const publishedBytes=await fs.readFile('public/data/da-costa-block/neighbourhood.json');
const manifest=JSON.parse(manifestBytes), published=JSON.parse(publishedBytes);
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
const authored=new Set(block.anchors.flatMap(a=>[a.buildingId,...(a.frontages??[]).map(f=>f.buildingId)]));
const reviewed=new Set(published.records.filter(r=>r.visualReview||r.review).map(r=>r.buildingId));
const candidates=published.records.filter(r=>!authored.has(r.buildingId)&&!reviewed.has(r.buildingId)&&['yes','unknown'].includes(r.proposal?.shopfront));
const selected=[],seen=new Set();
for(const [stratum,count] of [['yes',6],['unknown',4]]){
  const rows=candidates.filter(r=>r.proposal.shopfront===stratum).sort((a,b)=>hash('blind-storefront-v1:'+a.id).localeCompare(hash('blind-storefront-v1:'+b.id)));
  let n=0;for(const r of rows){if(seen.has(r.buildingId))continue;selected.push(r);seen.add(r.buildingId);if(++n===count)break;}
}
selected.sort((a,b)=>hash('blind-order-v1:'+a.id).localeCompare(hash('blind-order-v1:'+b.id)));
await fs.mkdir(out); // Refuse accidental overwrite of frozen packets.
const packets=[],mapping=[];
const label=(s,w=1800)=>Buffer.from(`<svg width="${w}" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f1e9"/><text x="12" y="29" font-family="sans-serif" font-size="22">${s}</text></svg>`);
for(let i=0;i<selected.length;i++){
  const p=selected[i],r=manifest.records.find(r=>r.id===p.id),number=String(i+1).padStart(2,'0'),images=[],parts=[{input:label(`Blind sample ${number} — full/context target crops; ground/roof details`),left:0,top:0}];
  const positions={full:[0,44,350,856],context:[350,44,650,856],ground:[1000,44,800,428],roof:[1000,472,800,428]};
  for(const [kind,[x,y,w,h]] of Object.entries(positions)){
    const m=r.images[kind],bytes=await fs.readFile(path.join(root,'images',m.file));if(hash(bytes)!==m.sha256)throw Error('Source hash mismatch');
    const frozenFile=`${number}-${kind}.jpg`;await fs.writeFile(path.join(out,frozenFile),bytes);
    images.push({kind,file:m.file,sha256:m.sha256,panoramaId:m.panoramaId,panoramaSha256:m.panoramaSha256,date:m.date,frozenFile});
    parts.push({input:label(`${kind} · ${m.date.slice(0,10)}`,w),left:x,top:y});
    parts.push({input:await sharp(bytes).resize(w,h-44,{fit:'contain',background:'#25342d'}).toBuffer(),left:x,top:y+44});
  }
  const sheet=`${number}-blind.jpg`;await sharp({create:{width:1800,height:900,channels:3,background:'#f3f1e9'}}).composite(parts).jpeg({quality:95}).toFile(path.join(out,sheet));
  packets.push({number,sheet,images});mapping.push({number,id:r.id,buildingId:r.buildingId,derivationKey:r.derivationKey,address:r.address,baseline:p.proposal,proposalModel:p.proposalModel,images});
}
const sources={version:1,manifestSha256:hash(manifestBytes),publishedSha256:hash(publishedBytes),method:'Deterministic SHA256 ordering; six baseline-positive and four uncertain; unique buildings; excludes every authored anchor building and every previously agent/human reviewed building. Packet numbering reshuffled independently. Reviewer sees numbered images and source dates before reading mapping or model fields.',packets};
const bytes=Buffer.from(JSON.stringify(sources,null,2));await fs.writeFile(path.join(out,'frozen-packets.json'),bytes);
await fs.writeFile(path.join(out,'sealed-baseline-mapping.json'),JSON.stringify(mapping,null,2));
console.log(JSON.stringify({out,count:packets.length,packetSha256:hash(bytes),pool:candidates.length}));
