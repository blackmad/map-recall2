import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
if (process.argv.includes('--gable-block')) {
  await import('./capture-gable-block.mjs');
} else {
const output='artifacts/building-library';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
let context,page,currentId=null,stage='navigation';const errors=[],results=[];
try{
 context=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:output+'/video',size:{width:960,height:720}}});
 page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto((process.env.BUILDING_PREVIEW_ORIGIN||'http://127.0.0.1:3000')+'/canal-drive/building-library.html');
 stage='initial load';await page.waitForFunction(()=>window.buildingLibraryPreview?.loaded);
 const ids=await page.locator('#building option').evaluateAll(os=>os.map(o=>o.value));const manifest=JSON.parse(await fs.readFile('public/canal-drive/models/building-library/manifest.json','utf8'));assert.equal(ids.length,manifest.models.length+(manifest.gallery?1:0));
 for(const id of ids){
  currentId=id;stage='load model';await page.selectOption('#building',id);await page.waitForFunction(id=>window.buildingLibraryPreview?.loaded&&window.buildingLibraryPreview.id===id,id);
  const result=await page.evaluate(()=>window.buildingLibraryPreview);assert(result.bounds.every(n=>n>0));results.push(result);
  for(const view of ['front','oblique','roof','ground']){stage='capture '+view;await page.click('#'+view);await page.screenshot({path:`${output}/${id}-browser-${view}.png`});}
 }
 currentId='elandsgracht-96';stage='motion/mobile';await page.selectOption('#building','elandsgracht-96');await page.waitForFunction(()=>window.buildingLibraryPreview?.loaded&&window.buildingLibraryPreview.id==='elandsgracht-96');await page.click('#front');await page.click('#motion');
 for(let n=0;n<4;n++){await page.waitForTimeout(350);await page.screenshot({path:`${output}/key-color-motion-${n}.png`});}
 await page.click('#motion');await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/browser-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const keyBundle=JSON.parse(await fs.readFile('public/canal-drive/models/building-library/evidence/elandsgracht-96.json','utf8'));assert.equal(await page.locator('#photos figure').count(),keyBundle.derived.length);assert.equal(await page.locator('#coverage tr').count(),keyBundle.coverage.length+1);
 currentId='material-gallery';stage='material gallery';await page.selectOption('#building','material-gallery');await page.waitForFunction(()=>window.buildingLibraryPreview?.loaded&&window.buildingLibraryPreview.id==='material-gallery');await page.click('#front');await page.click('#lighting');await page.screenshot({path:output+'/gallery-neutral-mobile.png',fullPage:true});const catalog=JSON.parse(await fs.readFile('public/canal-drive/models/building-library/material-catalog.json','utf8'));assert.equal(await page.locator('#catalog > div').count(),catalog.materials.length);
 assert.deepEqual(errors,[]);await context.close();await fs.writeFile(output+'/browser-checks.json',JSON.stringify({passed:true,models:results,errors,mobileOverflow:false,keyColorDatedCrops:keyBundle.derived.length},null,2)+'\n');console.log(JSON.stringify({models:results.length,errors,mobileOverflow:false}));
}catch(error){
 const failure={passed:false,failedId:currentId,stage,failure:error.message,models:results,errors};
 try{failure.preview=await page?.evaluate(()=>window.buildingLibraryPreview);failure.pageError=await page?.locator('#error').textContent();failure.selectedId=await page?.locator('#building').inputValue();}catch(diagnosticError){failure.diagnosticError=diagnosticError.message;}
 failure.failedId||=failure.preview?.id||failure.selectedId||null;
 await fs.writeFile(output+'/browser-checks.json',JSON.stringify(failure,null,2)+'\n');
 console.error(JSON.stringify({failedId:failure.failedId,stage,failure:error.message,errors}));throw error;
}finally{if(context)await context.close().catch(()=>{});await browser.close();}

}
