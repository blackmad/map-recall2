import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out='.cache/facade-assessment/components-v1/entrance-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const failures=[];const checks=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:width===390?844:1000}});
 page.on('pageerror',e=>failures.push(e.message));page.on('console',m=>{if(m.type()==='error')failures.push(m.text())});
 await page.goto('http://localhost:5195/canal-drive/facade-texture-demo.html?study=components&focus=entrance');
 await page.waitForFunction(()=>window.facadeTextureDemo?.row?.entranceRepair&&document.getElementById('loading').classList.contains('hidden'));
 if(!await page.evaluate(()=>window.facadeTextureDemo.row.entranceRepair.stats.accepted))throw Error('Entrance geometry was rejected');
 await page.waitForTimeout(350);
 for(const view of ['front','oblique','reverse']){
  if(view!=='reverse')await page.click('#'+view);else await page.evaluate(()=>{const d=window.facadeTextureDemo;const delta=d.camera.position.clone().sub(d.controls.target);const a=-.72;const x=delta.x*Math.cos(a)+delta.z*Math.sin(a),z=-delta.x*Math.sin(a)+delta.z*Math.cos(a);delta.x=x;delta.z=z;d.camera.position.copy(d.controls.target.clone().add(delta));d.controls.update();});
  await page.waitForTimeout(150);await page.screenshot({path:`${out}/${width}-${view}-after.png`});
  const before=await page.evaluate(()=>window.facadeTextureDemo.camera.position.toArray());await page.click('#entrance-fit');await page.waitForFunction(()=>!document.getElementById('row').disabled);
  await page.screenshot({path:`${out}/${width}-${view}-before.png`});
  const after=await page.evaluate(()=>({position:window.facadeTextureDemo.camera.position.toArray(),overflow:document.documentElement.scrollWidth>innerWidth}));
  if(after.overflow||before.some((x,i)=>Math.abs(x-after.position[i])>1e-6))failures.push('Toggle drift/overflow '+width+' '+view);
  await page.click('#entrance-fit');await page.waitForFunction(()=>!document.getElementById('row').disabled);checks.push({width,view});
 }
 await page.close();
}}finally{await browser.close();}
await fs.writeFile(out+'/checks.json',JSON.stringify({checks,failures},null,2));console.log({checks:checks.length,failures});if(failures.length)process.exitCode=1;
