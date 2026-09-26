import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import express from 'express';
import {chromium} from 'playwright';
import {facadePreviewNotesRouter} from './district-notes.ts';
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'repair-notes-test-')),app=express();app.use(express.json());app.use('/api/facade-repair/notes',facadePreviewNotesRouter(process.cwd(),temporary));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
const api=`http://127.0.0.1:${(server.address() as any).port}`;
const bytes=await fs.readFile('public/data/facade-repair-preview/cases.json'),id=createHash('sha256').update(bytes).digest('hex');
const originalPath='.cache/city-appearance/review-notes/c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d.json',original=await fs.readFile(originalPath);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/facade-repair/notes/**',async route=>{const response=await route.fetch({url:api+new URL(route.request().url()).pathname});await route.fulfill({response});});
 await page.goto('http://127.0.0.1:5195/canal-drive/facade-repair-preview.html?case=case-04');await page.waitForFunction(()=>!(document.querySelector('#repair-note') as HTMLTextAreaElement)?.disabled);
 await page.locator('#repair-note').fill('Curve still too tall <script>literal</script>');
 await page.locator('[data-role=case-select]').selectOption('9'); // case11, leave before autosave timer fires
 await page.locator('#repair-note').fill('Rounded top corners, not a full arch.');await page.locator('#repair-note-save').click();
 await page.waitForFunction(()=>document.querySelector('#repair-note-message')?.textContent==='Saved to project');
 let disk=JSON.parse(await fs.readFile(path.join(temporary,`${id}.json`),'utf8'));assert.equal(disk.notes['case-04'].text,'Curve still too tall <script>literal</script>');assert.equal(disk.notes['case-11'].text,'Rounded top corners, not a full arch.');
 await page.reload();await page.waitForFunction(()=>!(document.querySelector('#repair-note') as HTMLTextAreaElement)?.disabled);assert.equal(new URL(page.url()).searchParams.get('case'),'case-11');assert.equal(await page.locator('#repair-note').inputValue(),'Rounded top corners, not a full arch.');await page.locator('[data-role=case-select]').selectOption('3');assert.equal(await page.locator('#repair-note').inputValue(),'Curve still too tall <script>literal</script>');
 await page.locator('#repair-notes-ready').click();await page.waitForFunction(()=>document.querySelector('#repair-note-message')?.textContent?.includes('Ready for the next'));
 disk=JSON.parse(await fs.readFile(path.join(temporary,`${id}.json`),'utf8'));assert.equal(disk.readyForFixes,true);assert.equal(disk.regressionCases.length,2);assert.equal(disk.regressionCases[0].source.previewSha256,id);
 const state=await (await fetch(`${api}/api/facade-repair/notes/${id}`)).json();
 assert.equal((await fetch(`${api}/api/facade-repair/notes/${id}`,{method:'POST',headers:{'content-type':'application/json','x-review-token':state.token},body:JSON.stringify({packetSha256:id,caseId:'case-04',text:'overwrite',status:'needs-work',issues:[],expectedRevision:0})})).status,409);
 assert.equal((await fetch(`${api}/api/facade-repair/notes/${'0'.repeat(64)}`)).status,409);
 assert.deepEqual(await fs.readFile(originalPath),original);assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('Preview notes: per-case persistence, rapid navigation, reload, literal text, revision conflicts, candidate binding, ready queue, phone layout, and original notes preserved.');
}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
