/** Source images stay in the private archive; intercept only explicit review requests. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const opt=(n,d)=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)??d;
if(process.argv.includes('--help')){console.log('node scripts/canalhouse-recipes/capture.mjs --output=artifacts/canalhouse-recipes/UNIQUE-CYCLE [--base-url=http://127.0.0.1:5196]');process.exit(0);}
const base=opt('base-url','http://127.0.0.1:5196'),output=opt('output','artifacts/canalhouse-recipes/cycle-1');
const archive=path.resolve('../map-recall2-source-data');
const manifestFile=opt('manifest','public/canal-drive/models/canalhouse-recipes/pilot.json'),chunk=opt('chunk','');
if(!manifestFile.startsWith('public/canal-drive/models/')||manifestFile.includes('..'))throw Error('Use an installed local candidate manifest');
if(manifestFile!=='public/canal-drive/models/canalhouse-recipes/pilot.json'&&!chunk)throw Error('A candidate manifest requires its gallery --chunk key');
const manifestBytes=await fs.readFile(manifestFile),manifest=JSON.parse(manifestBytes);
if(!manifest.entries.length)throw Error('No compiled pilot entries');
try{await fs.access(path.join(output,'report.json'));throw Error(`Review evidence already exists at ${output}; choose a new --output.`);}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1600,height:1050},deviceScaleFactor:1});const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const images=new Map();
for(const entry of manifest.entries)for(const [i,r]of(entry.references??[]).entries())if(r.privatePath){
 const resolved=path.resolve(archive,r.privatePath);if(!resolved.startsWith(archive+path.sep))throw Error('Reference escapes private archive');
 const url=`${entry.id}-${i}.jpg`;images.set(url,resolved);r.previewUrl=`./canalhouse-reference/${url}`;
}
await page.route('**/'+manifestFile.slice('public/'.length),route=>route.fulfill({contentType:'application/json',body:JSON.stringify(manifest)}));
await page.route('**/canalhouse-reference/*',async route=>{const file=images.get(new URL(route.request().url()).pathname.split('/').at(-1));if(!file)return route.abort();await route.fulfill({contentType:'image/jpeg',body:await fs.readFile(file)});});
const views=opt('views','front,oblique,reverse,roof').split(',');
if(!views.length||views.some(v=>!['front','oblique','reverse','roof','basement','cornice','reference'].includes(v)))throw Error('Unknown review view');
const results=[];
try{
 await page.goto(`${base}/canal-drive/canalhouse-recipes.html${chunk?'?chunk='+encodeURIComponent(chunk):''}`);await page.waitForFunction(()=>window.canalhousePreview?.ready,null,{timeout:60000});
 for(const id of ['row',...manifest.entries.map(e=>e.id)])for(const view of views){
  await page.evaluate(async({id,view})=>{document.querySelector('#house').value=id;await window.canalhousePreview.frame(id,view);}, {id,view});
  await page.waitForFunction(()=>!document.querySelector('#panorama-caption')?.textContent?.startsWith('Loading street panorama'),null,{timeout:30000});await page.waitForTimeout(180);await page.screenshot({path:path.join(output,`${id}-${view}.png`)});
  results.push({id,view,image:`${id}-${view}.png`});
 }
 const renderer=await page.evaluate(()=>{const r=window.canalhousePreview.renderer;return{calls:r.info.render.calls,triangles:r.info.render.triangles,geometries:r.info.memory.geometries,textures:r.info.memory.textures};});
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify({generatedAt:new Date().toISOString(),manifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),results,renderer,errors,acceptance:'unreviewed',limits:['Standalone gallery measurements are not actual-game or GPU acceptance.','Source images are served through a bounded private-file interception for local review only.']},null,2));
 console.log(JSON.stringify({output,captures:results.length,renderer,errors}));
}finally{await browser.close();}
