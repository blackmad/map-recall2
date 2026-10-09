import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const base='artifacts/building-library/expansion',evidence=path.join(base,'evidence');
for(const file of (await fs.readdir(evidence)).filter(f=>f.endsWith('.json')&&f!=='audit.json')){
 const bundle=JSON.parse(await fs.readFile(path.join(evidence,file),'utf8'));
 const photos=bundle.derived.filter(e=>e.tier==='full');const cells=[];
 for(const [i,e]of photos.entries()){
  const x=i%4*375,y=Math.floor(i/4)*645;
  const im=await sharp(e.path).resize({width:360,height:590,fit:'inside'}).toBuffer({resolveWithObject:true});
  cells.push({input:im.data,left:x+Math.floor((360-im.info.width)/2),top:y+47});
  cells.push({input:Buffer.from(`<svg width="375" height="45"><text x="5" y="15" font-size="13">${bundle.id} ${e.captureDate.slice(0,10)}</text><text x="5" y="34" font-size="11">angle ${e.cameraFit.angle.toFixed(1)}° distance ${e.cameraFit.distance.toFixed(1)}m | ambiguous</text></svg>`),left:x,top:y});
 }
 await sharp({create:{width:1500,height:Math.ceil(photos.length/4)*645,channels:3,background:'#eee'}}).composite(cells).jpeg({quality:94}).toFile(path.join(base,bundle.id+'-dated-full.jpg'));
}
