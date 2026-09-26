/** Captures the candidate page, not the preserved release. Engineering smoke only. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const dataPath='public/data/facade-repair-preview/cases.json',bytes=await fs.readFile(dataPath),data=JSON.parse(bytes);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const output='public/data/facade-repair-preview/captures';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});const errors=[],captures=[];
try{
 const page=await browser.newPage({viewport:{width:1500,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5195/canal-drive/facade-repair-preview.html');await page.waitForFunction(()=>window.previewReady);
 for(let i=0;i<data.cases.length;i++){
  const c=data.cases[i];await page.locator('[data-role=case-select]').selectOption(String(i));
  for(const mode of ['ground','full','oblique']){
   await page.locator(`[data-camera=${mode}]`).click();await page.locator('[data-role=source]').evaluate(async im=>{if(!im.complete)await new Promise(resolve=>{im.onload=resolve;im.onerror=resolve;});}).catch(()=>{});
   const name=`${c.caseId}-${mode}-desktop.png`;await page.screenshot({path:`${output}/${name}`});captures.push({caseId:c.caseId,mode,layout:'desktop',path:`${output}/${name}`,sha256:hash(await fs.readFile(`${output}/${name}`))});
  }
  assert.equal(await page.evaluate(()=>window.previewSelectedCaseId),c.caseId);
 }
 await page.setViewportSize({width:390,height:844});
 for(const id of ['case-04','case-11','case-19','case-22','case-25','case-30']){
  await page.locator('[data-role=case-select]').selectOption(String(data.cases.findIndex(c=>c.caseId===id)));await page.locator('[data-camera=ground]').click();
  const name=`${id}-ground-phone.png`;await page.screenshot({path:`${output}/${name}`,fullPage:true});captures.push({caseId:id,mode:'ground',layout:'phone',path:`${output}/${name}`,sha256:hash(await fs.readFile(`${output}/${name}`))});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Phone horizontal overflow');
 }
 await page.locator('[data-role=case-select]').selectOption(String(data.cases.findIndex(c=>c.caseId==='case-17')));
 await page.locator('[data-display-mode=architecture-composite]').click();
 assert.equal(await page.locator('[data-camera=full]').getAttribute('class'),'active');
 for(const layout of ['desktop','phone']){
  await page.setViewportSize(layout==='desktop'?{width:1500,height:900}:{width:390,height:844});
  for(const mode of ['full','oblique']){
   await page.locator(`[data-camera=${mode}]`).click();
   const name=`case-17-composite-${mode}-${layout}.png`;
   await page.screenshot({path:`${output}/${name}`,fullPage:layout==='phone'});
   captures.push({caseId:'case-17',displayMode:'architecture-composite',mode,layout,path:`${output}/${name}`,sha256:hash(await fs.readFile(`${output}/${name}`))});
  }
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile('public/data/facade-repair-preview/captures.json',JSON.stringify({version:1,candidateDataSha256:hash(bytes),scope:'local-development-preview; not photographic acceptance or fourteen-camera release runtime gate',captures,errors},null,2));
 console.log(JSON.stringify({captures:captures.length,errors}));
}finally{await browser.close();}
