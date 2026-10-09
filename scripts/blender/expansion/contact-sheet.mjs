import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const cacheRoot='.worktrees/amsterdam-facade-rebuild';
const cases=JSON.parse(await fs.readFile(path.join(cacheRoot,'public/data/facade-repair-preview/cases.json'),'utf8')).cases;
const ids=new Set(process.argv.slice(2).length?process.argv.slice(2):['case-05','case-08','case-09','case-10','case-14','case-16','case-18','case-19','case-23','case-25','case-26']);
const cells=[];
for(const [i,c] of cases.filter(c=>ids.has(c.caseId)).entries()){
 const x=i%6*275,y=Math.floor(i/6)*590;
 const data=await sharp(path.join(cacheRoot,c.source.full.path)).resize({width:260,height:525,fit:'inside'}).toBuffer({resolveWithObject:true});
 cells.push({input:data.data,left:x+Math.floor((260-data.info.width)/2),top:y+48});
 const label=`${c.caseId} ${c.address.slice(0,31)}`.replaceAll('&','&amp;');
 cells.push({input:Buffer.from(`<svg width="275" height="48"><text x="5" y="15" font-size="12">${label}</text><text x="5" y="33" font-size="12">${c.source.full.captureDate.slice(0,10)}</text></svg>`),left:x,top:y});
}
await sharp({create:{width:1650,height:Math.ceil(ids.size/6)*590,channels:3,background:'#e7e7e7'}}).composite(cells).jpeg({quality:94}).toFile('artifacts/building-library/expansion/candidate-contact-sheet.jpg');
