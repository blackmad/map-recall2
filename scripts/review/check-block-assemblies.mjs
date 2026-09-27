import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out='.cache/facade-assessment/block-assemblies-v1/browser';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const failures=[],checks=[];
try{for(const width of [1440,390])for(const study of ['block-auto','block-auto-holdout']){
 const page=await browser.newPage({viewport:{width,height:width===390?844:1000}});
 page.on('pageerror',e=>failures.push(e.message));
 await page.goto(`http://localhost:5195/canal-drive/facade-texture-demo.html?study=${study}`);
 await page.waitForFunction(s=>window.facadeTextureDemo?.row?.id===s&&document.getElementById('loading').classList.contains('hidden'),study);
 for(const view of ['front','oblique','roof']){
  await page.click('#'+view);await page.waitForTimeout(150);await page.screenshot({path:`${out}/${study}-${width}-${view}.png`});
  const state=await page.evaluate(()=>({position:window.facadeTextureDemo.camera.position.toArray(),overflow:document.documentElement.scrollWidth>innerWidth}));
  await page.click('#entrance-fit');await page.waitForFunction(()=>!document.getElementById('row').disabled);
  const position=await page.evaluate(()=>window.facadeTextureDemo.camera.position.toArray());
  if(state.overflow||state.position.some((x,i)=>Math.abs(x-position[i])>1e-6))failures.push('toggle/layout '+study+width+view);
  await page.click('#entrance-fit');await page.waitForFunction(()=>!document.getElementById('row').disabled);checks.push({study,width,view});
 }await page.close();
}}finally{await browser.close();}
await fs.writeFile(out+'/checks.json',JSON.stringify({checks,failures},null,2));console.log({checks:checks.length,failures});if(failures.length)process.exitCode=1;
