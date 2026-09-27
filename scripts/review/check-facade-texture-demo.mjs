import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out='.cache/facade-assessment/head-on-3d-v1';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const failures=[];const checks=[];
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:1000},deviceScaleFactor:1});
  page.on('pageerror',e=>failures.push(e.message));page.on('console',m=>{if(m.type()==='error')failures.push(m.text());});page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  await page.goto('http://localhost:5195/canal-drive/facade-texture-demo.html');
  await page.waitForFunction(()=>window.facadeTextureDemo?.row && document.getElementById('loading').classList.contains('hidden'),{timeout:60000});
  const n=await page.locator('#row option').count();if(n!==3)throw Error(`Expected3 rows, got${n}`);
  for(let row=0;row<n;row++){
   await page.selectOption('#row',String(row));await page.waitForFunction(()=>!document.getElementById('row').disabled);
   await page.waitForTimeout(500);
   for(const mode of ['bare','texture','relief','frames']){
    await page.click(`[data-mode="${mode}"]`);await page.waitForTimeout(100);
    const result=await page.evaluate(()=>({row:window.facadeTextureDemo.row.id,mode:window.facadeTextureDemo.mode,parts:window.facadeTextureDemo.row.meshes.length,textured:window.facadeTextureDemo.row.meshes.filter(m=>m.textured).length,frames:window.facadeTextureDemo.frames,calls:window.facadeTextureDemo.renderer.info.render.calls,triangles:window.facadeTextureDemo.renderer.info.render.triangles,overflow:document.documentElement.scrollWidth>innerWidth}));
    if(!result.textured||!result.triangles||result.overflow)failures.push(JSON.stringify(result));checks.push({width,...result});
    if(width===1440&&(mode==='texture'||mode==='frames'))await page.screenshot({path:`${out}/${row}-${mode}.png`});
   }
   if(width===1440){await page.click('#front');await page.screenshot({path:`${out}/${row}-front.png`});await page.click('#roof');await page.screenshot({path:`${out}/${row}-roof.png`});await page.click('#oblique');}
  }
  await page.check('#photo');await page.click('#wire');await page.click('#rotate');
  if(width===390)await page.screenshot({path:`${out}/mobile.png`,fullPage:true});await page.close();
 }
}finally{await browser.close();}
await fs.writeFile(out+'/browser-check.json',JSON.stringify({checks,failures},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,failures}));if(failures.length)process.exitCode=1;
