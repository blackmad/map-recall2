import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {chromium} from 'playwright';
import {districtNotesRouter} from './district-notes.js';
const root=process.cwd(),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'district-notes-test-'));
const app=express();app.use(express.json());app.use('/api/district-evaluation/notes',districtNotesRouter(root,temporary));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.on('listening',resolve));
const apiBase=`http://127.0.0.1:${(server.address() as any).port}`,base='http://127.0.0.1:5195';
const manifest=JSON.parse(await fs.readFile('public/data/city-expansion/current.json','utf8')),url=`${apiBase}/api/district-evaluation/notes/${manifest.releaseId}`;
let browser:any;
try{
 const initial=await (await fetch(url)).json();const headers={'content-type':'application/json','x-review-token':initial.token};
 const post=(body:any)=>fetch(url,{method:'POST',headers,body:JSON.stringify({packetSha256:initial.packetSha256,...body})});
 assert.equal((await post({caseId:'invented',text:'x',status:'needs-work',issues:[],expectedRevision:0})).status,400);
 assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,403);
 assert.equal((await post({action:'ready'})).status,400);
 const launch:any={headless:true};try{await fs.access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');launch.executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';}catch{}
 browser=await chromium.launch(launch);
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors:string[]=[];page.on('pageerror',(e:any)=>errors.push(e.message));
  await page.route('**/api/district-evaluation/notes/**',async(route:any)=>{const incoming=route.request();const response=await route.fetch({url:apiBase+new URL(incoming.url()).pathname});await route.fulfill({response});});
  await page.goto(base+'/canal-drive/district-evaluation.html');await page.waitForSelector('.review-note textarea');
  assert.equal(await page.locator('.review-note textarea').count(),30);
  const note=`Regression test ${width}: two doors; preserve curved glazing <script>literal text</script>`;
  const first=page.locator('.case').first();await first.locator('textarea').fill(note);await first.locator('select').selectOption('needs-work');await first.locator('input[value="doors"]').check();
  await first.locator('button').click();await page.waitForFunction(()=>document.querySelector('.case .note-save-status')?.textContent==='Saved to project');
  const disk=JSON.parse(await fs.readFile(path.join(temporary,`${manifest.releaseId}.json`),'utf8'));assert.equal(disk.notes['case-01'].text,note);assert.equal(disk.regressionCases[0].source.buildingId,'0363100012167878');
  await page.reload();await page.waitForSelector('.review-note textarea');assert.equal(await first.locator('textarea').inputValue(),note);assert.equal(await page.locator('.case').nth(1).locator('textarea').inputValue(),'');
  await page.locator('#review-filter').selectOption('noted');assert.equal(await page.locator('.case:visible').count(),1);
  await page.locator('#review-ready').click();await page.waitForFunction(()=>document.querySelector('#review-summary')?.textContent?.includes('Ready for fixes.'));
  const final=JSON.parse(await fs.readFile(path.join(temporary,`${manifest.releaseId}.json`),'utf8'));assert.equal(final.readyForFixes,true);assert.equal(final.regressionCases.length,1);assert.equal(final.regressionCases[0].quantitativeAssertions,null);assert.ok(final.excludedEvaluationBuildingIds.includes('0363100012167878'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(temporary,`review-${width}.png`),fullPage:false});await page.close();
 }
 const conflict=await post({caseId:'case-01',text:'stale overwrite',status:'needs-work',issues:[],expectedRevision:0});assert.equal(conflict.status,409);
 assert.equal((await post({packetSha256:'0'.repeat(64),action:'ready'})).status,409);
 console.log(`District notes passed: real disk persistence/reload, 30 independent forms, source-bound regression queue, XSS-safe text, conflict/stale/token rejection, desktop and phone. Test artifacts: ${temporary}`);
}finally{if(browser)await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
