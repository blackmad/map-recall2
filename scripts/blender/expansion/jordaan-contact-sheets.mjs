/** Cache-only evidence task sheets. Source crops retain original provenance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const root='artifacts/jordaan-building-library';
const cohort=JSON.parse(await fs.readFile(path.join(root,'next-cohort.json'),'utf8')).entries;
await fs.mkdir(path.join(root,'contact-sheets'),{recursive:true});
const esc=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;');
for(const entry of cohort.slice(0,10)){
 const facade=entry.selectedFacade;
 const images=facade.images.filter(i=>['full','ground','roof'].includes(i.tier));
 const selected=[];
 for(const year of facade.years)for(const tier of ['full','ground','roof']){
  const candidates=images.filter(i=>i.captureDate.startsWith(year)&&i.tier===tier).sort((a,b)=>(b.nativeDimensions?.[0]??0)-(a.nativeDimensions?.[0]??0));
  if(candidates[0])selected.push(candidates[0]);
 }
 const cells=[];
 for(const [index,source] of selected.entries()){
  const x=index%3*360,y=Math.floor(index/3)*580;
  const im=await sharp(source.path).resize({width:340,height:490,fit:'inside'}).toBuffer({resolveWithObject:true});
  cells.push({input:im.data,left:x+Math.floor((360-im.info.width)/2),top:y+80});
  const label=Buffer.from(`<svg width="360" height="80"><text x="10" y="22" font-size="13">${esc(source.captureDate.slice(0,10))} · ${esc(source.tier)}</text><text x="10" y="44" font-size="12">native ${esc(source.nativeDimensions?.join('×')??'unknown')} · unregistered</text><text x="10" y="66" font-size="11">${esc(source.panoramaId?.slice(-42)??'unknown')}</text></svg>`);
  cells.push({input:label,left:x,top:y});
 }
 const sheet=path.join(root,'contact-sheets',entry.ownerId+'.jpg');
 await sharp({create:{width:1080,height:Math.ceil(selected.length/3)*580,channels:3,background:'#eeeee7'}}).composite(cells).jpeg({quality:90}).toFile(sheet);
 await fs.writeFile(path.join(root,'contact-sheets',entry.ownerId+'.json'),JSON.stringify({ownerId:entry.ownerId,sheet,orderedFrontageRD:facade.orderedFrontageRD,selectedWallHeight:facade.selectedWallHeight,sources:selected,warning:'Crops may be padded; crop plane endpoints differ from exact physical frontage. Preserve each plane and map to selected endpoints, never use padded crop width as facade width.'},null,2)+'\n');
}
console.log('Prepared dated contact sheets for first 10 evidence tasks.');
