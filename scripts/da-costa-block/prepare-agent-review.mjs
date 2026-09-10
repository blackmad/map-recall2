/** Image-only development sample: never includes model answers, tenant names or addresses. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
const root='.cache/da-costa-neighbourhood';
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json'));
const aerial=JSON.parse(await fs.readFile(root+'/aerial.json')).records;
const records=[5,11,17,23,29,35,41,47,53,59,65,71].map((index,i)=>{
  const r=manifest.records[index],a=aerial.find(a=>a.buildingId===r.buildingId);
  return {case:i+1,id:r.id,derivationKey:r.derivationKey,images:[r.images.full,r.images.ground,r.images.roof,a]};
});
await fs.writeFile(root+'/agent-review-inputs.json',JSON.stringify({policy:'Machine development review, not a human label or independent accuracy test. Selected without inspecting model answers; some source scenes may have appeared earlier in the working session.',records},null,2));
for(let page=0;page<3;page++){
  const composites=[];
  for(let row=0;row<4;row++){
    const r=records[page*4+row];
    composites.push({input:Buffer.from(`<svg width="1120" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="1120" height="32" fill="#edece2"/><text x="10" y="23" font-size="18">Case ${r.case} — full facade | ground floor | street top | aerial target (yellow)</text></svg>`),left:0,top:row*340});
    for(let col=0;col<4;col++){
      const bytes=await sharp(root+'/images/'+r.images[col].file).resize({width:280,height:300,fit:'contain',background:'#293129'}).toBuffer();
      composites.push({input:bytes,left:col*280,top:row*340+32});
    }
  }
  await sharp({create:{width:1120,height:1360,channels:3,background:'#faf9f4'}}).composite(composites).jpeg({quality:94}).toFile(root+`/agent-review-${page+1}.jpg`);
}
console.log('Prepared 12 image-only cases in three sheets; no model suggestions or address hints included.');
