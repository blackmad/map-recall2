/** Cache-only discovery sheet. Does not stage recipes or change the first batch. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root='.worktrees/amsterdam-facade-rebuild';
const cases=JSON.parse(await fs.readFile(path.join(root,'public/data/facade-repair-preview/cases.json'),'utf8')).cases;
const selected=new Set(['case-02','case-06','case-13','case-15','case-27','case-29','case-30']);
const rows=cases.filter(c=>selected.has(c.caseId));
const cells=[],audit=[];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for(const [i,c] of rows.entries()){
 const x=i%4*360,y=Math.floor(i/4)*850;
 const source=c.source.full;
 const image=await sharp(path.join(root,source.path)).resize({width:340,height:700,fit:'inside'}).toBuffer({resolveWithObject:true});
 cells.push({input:image.data,left:x+Math.floor((360-image.info.width)/2),top:y+100});
 const label=Buffer.from(`<svg width="360" height="100"><text x="10" y="25" font-size="15">${esc(c.caseId+' '+c.address.slice(0,37))}</text><text x="10" y="50" font-size="14">${source.captureDate.slice(0,10)} · source crop, unregistered</text><text x="10" y="75" font-size="14">${c.frame?.width.toFixed(2)??'unbound'} m selected frontage</text></svg>`);
 cells.push({input:label,left:x,top:y});
 const b=c.owner?.geometry?.building;
 const f=c.frame,origin=b?.coordinateFrame?.originRD;
 const endpoints=f&&origin?[f.a,f.a.map((v,j)=>v+f.u[j]*f.width)].map(p=>({x:origin.x+p[0],y:origin.y-p[1]})):null;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const binding=(c.owner?.observations??[]).flatMap(o=>{
  const p=o.payload.images?.full?.plane;if(!p||!endpoints)return [];
  const direct=Math.max(distance(endpoints[0],p.start),distance(endpoints[1],p.end));
  const reverse=Math.max(distance(endpoints[1],p.start),distance(endpoints[0],p.end));
  return [{observationId:o.id,endpointErrorM:Math.min(direct,reverse),photoOrientationReversed:reverse<direct,sourceWidthM:distance(p.start,p.end)}];
 }).sort((a,b)=>a.endpointErrorM-b.endpointErrorM)[0]??null;
 audit.push({caseId:c.caseId,address:c.address,ownerId:c.owner?.id,geometryRevision:c.owner?.geometryRevision,source,
             frontageWidthM:c.frame?.width,hasFrame:!!c.frame,hasSourceShell:!!b,
             originalCropBinding:binding,originalMetricTransferStatus:binding&&binding.endpointErrorM<=.3?'unregistered':'held-plane-disagreement',
             existingLibraryDuplicate:c.caseId==='case-30',
             sourceSurfaceCount:b?.surfaces?.length,
             nextStep:'Review primary frontage identity and dated panorama availability before staging; this is discovery only.'});
}
const out='artifacts/building-library/expansion';
await sharp({create:{width:1440,height:Math.ceil(rows.length/4)*850,channels:3,background:'#eee'}}).composite(cells).jpeg({quality:94}).toFile(path.join(out,'next-candidate-contact-sheet.jpg'));
await fs.writeFile(path.join(out,'next-candidate-discovery.json'),JSON.stringify({reviewDate:'2026-10-01',stagedRecipes:0,candidates:audit},null,2)+'\n');
console.log(JSON.stringify({candidates:rows.length,stagedRecipes:0,sheet:path.join(out,'next-candidate-contact-sheet.jpg')}));
