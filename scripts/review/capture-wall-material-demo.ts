import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import sharp from 'sharp';
const flag=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const isolated=flag('isolated')==='true';
const run=flag('run')??'pass-1';if(!/^[a-z0-9-]+$/.test(run))throw Error('Invalid run name');
const root=`.cache/wall-material-demo/${run}`;await fs.mkdir(root,{recursive:true});
const data=JSON.parse(await fs.readFile('public/data/wall-materials/assignments.json','utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const errors:string[]=[];const results=[];
try{const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));await page.goto(`${flag('base-url')??'http://localhost:4187'}/canal-drive/material-demo.html`);await page.waitForFunction(()=>window.wallMaterialDemo?.ready,{},{timeout:120000});
await page.evaluate(async isolated=>{if(isolated)await window.wallMaterialDemo.setIsolation(true);},isolated);
for(const index of (flag('indices')?.split(',').map(Number)??data.gate)){const e=data.entries[index],captures:any={};
 for(const mode of ['current','preview'])for(const oblique of [false,true]){
 const status=await page.evaluate(async({index,mode,oblique})=>{await window.wallMaterialDemo.setMode(mode);return window.wallMaterialDemo.show(index,oblique);},{index,mode,oblique});
 await page.waitForTimeout(450);
 const name=`${String(index).padStart(3,'0')}-${mode}-${oblique?'oblique':'front'}.png`,bytes=await page.locator('#game').screenshot({path:`${root}/${name}`});captures[`${mode}-${oblique?'oblique':'front'}`]={file:name,sha256:sha(bytes),status};
 }
 for(const oblique of [false,true]){
 await page.evaluate(async({index,oblique})=>{await window.wallMaterialDemo.setMode('preview');await window.wallMaterialDemo.show(index,oblique);await window.wallMaterialDemo.identity(true);},{index,oblique});
 const key=oblique?'identity-oblique':'identity',identityName=`${String(index).padStart(3,'0')}-${key}.png`,identityBytes=await page.locator('#game').screenshot({path:`${root}/${identityName}`});captures[key]={file:identityName,sha256:sha(identityBytes)};
 await page.evaluate(()=>window.wallMaterialDemo.identity(false));
 }
 const items:any[]=[];let x=0;for(const [label,file,width] of [['Reference',`public${e.crop}`,210],['Target identity (magenta)',`${root}/${captures.identity.file}`,420],[isolated?'Isolated diagnostic':'Material trial',`${root}/${captures['preview-front'].file}`,420],['Trial: oblique',`${root}/${captures['preview-oblique'].file}`,420]] as const){const photo=await sharp(file).resize(width,390,{fit:'contain',background:'#eee9df'}).png().toBuffer();items.push({input:photo,left:x,top:60});const escaped=`${label} · ${index} ${e.address}`.replaceAll('&','&amp;').replaceAll('<','&lt;');items.push({input:Buffer.from(`<svg width="${width}" height="60"><rect width="100%" height="100%" fill="#faf7ef"/><text x="6" y="22" font-size="14">${escaped.slice(0,54)}</text><text x="6" y="43" font-size="12">${e.materialId} · pending visual review</text></svg>`),left:x,top:0});x+=width;}
 await sharp({create:{width:1470,height:450,channels:3,background:'#eee9df'}}).composite(items).png().toFile(`${root}/${String(index).padStart(3,'0')}-panel.png`);
 results.push({index,buildingId:e.buildingId,observationId:e.observationId,sourceSha256:e.sourceSha256,materialId:e.materialId,captures});console.log(`Captured ${index} ${e.address}`);
 await fs.writeFile(`${root}/captures.json`,JSON.stringify({version:2,run,isolated,diagnosticOnly:isolated,baselineReleaseId:data.baselineReleaseId,assignmentSha256:sha(await fs.readFile('public/data/wall-materials/assignments.json')),colourTrialsSha256:sha(await fs.readFile('public/data/wall-materials/colour-trials.json')),bundleSha256:sha(await fs.readFile('public/canal-drive/js/wall-material-demo.bundle.js')),results,errors},null,2));
}
}finally{await browser.close();}
if(errors.length)throw Error(errors.join('\n'));
