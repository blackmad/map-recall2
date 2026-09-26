import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import express from 'express';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {facadePreviewNotesRouter} from './district-notes.ts';

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'repair-notes-retry-'));
const fixtureRoot=path.join(temporary,'fixture-root'),casesPath=path.join(fixtureRoot,'public/data/facade-repair-preview/cases.json');
const bytes=Buffer.from(JSON.stringify({cases:[{caseId:'case-04',owner:{id:'fixture-04'},source:{}},{caseId:'case-11',owner:{id:'fixture-11'},source:{}}]})),id=createHash('sha256').update(bytes).digest('hex');
await fs.mkdir(path.dirname(casesPath),{recursive:true});await fs.writeFile(casesPath,bytes);
await build({entryPoints:['scripts/review/preview-notes.ts'],bundle:true,format:'esm',platform:'browser',outfile:path.join(temporary,'notes.js')});
await fs.writeFile(path.join(temporary,'index.html'),`<section id="repair-feedback"><h2 id="repair-note-label"></h2><select id="repair-note-status" disabled><option value="unreviewed">Unreviewed</option><option value="needs-work">Needs work</option></select><textarea id="repair-note" disabled></textarea><button id="repair-note-save" disabled>Save</button><button id="repair-notes-ready" disabled>Ready</button><p id="repair-note-message"></p></section><script type="module">import {mountPreviewNotesForCandidate} from '/notes.js'; window.notes=await mountPreviewNotesForCandidate('${id}');window.notes.show('case-04');window.ready=true;</script>`);
let posts=0,delay=false,always503=false;
const app=express();app.use(express.json());app.use(express.static(temporary));app.post('/api/facade-repair/notes/:id',async(req,res,next)=>{posts++;if(always503||posts===1){res.status(503).json({error:'Temporary outage'});return;}if(delay)await new Promise(resolve=>setTimeout(resolve,120));next();});app.use('/api/facade-repair/notes',facadePreviewNotesRouter(fixtureRoot,path.join(temporary,'notes')));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.on('listening',resolve));
const base=`http://127.0.0.1:${(server.address() as any).port}`,browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.goto(base);await page.waitForFunction(()=>window.ready===true);
 assert.equal(await page.locator('#repair-note-save').isDisabled(),false,'actions enable only after mount succeeds');
 await page.locator('#repair-note').fill('retry survives outage');await page.locator('#repair-note-save').click();await page.waitForFunction(()=>document.querySelector('#repair-note-message')?.textContent?.includes('retry'));
 assert.equal(await page.locator('#repair-note-save').isDisabled(),false,'transient failure leaves explicit retry available');
 assert.match(await page.evaluate(k=>localStorage.getItem(k),`repair-note:${id}:case-04`),/retry survives outage/);
 assert.equal(await page.evaluate(async()=>await (window as any).notes.saveCurrent()),true,'saveCurrent explicitly flushes the current draft');await page.waitForFunction(()=>document.querySelector('#repair-note-message')?.textContent==='Saved to project');

 // A newer draft made while the first request is in flight is queued after it.
 delay=true;await page.evaluate(()=>window.notes.show('case-11'));await page.locator('#repair-note').fill('older draft');await page.locator('#repair-note-save').click();await page.waitForTimeout(20);await page.locator('#repair-note').fill('newest draft');await page.locator('#repair-note-save').click();await page.waitForFunction(k=>localStorage.getItem(k)===null,`repair-note:${id}:case-11`);
 let disk=JSON.parse(await fs.readFile(path.join(temporary,'notes',`${id}.json`),'utf8'));assert.equal(disk.notes['case-11'].text,'newest draft');
 await page.locator('#repair-note').fill('ready waits for newest save');await page.locator('#repair-notes-ready').click();assert.equal(await page.locator('#repair-note').isDisabled(),true,'Ready freezes editing through its save and request');await page.waitForFunction(()=>document.querySelector('#repair-note-message')?.textContent==='Ready for the next repair pass.');assert.equal(await page.locator('#repair-note').isDisabled(),false,'controls restore after Ready completes');

 // A remote revision is never overwritten: the local draft stays recoverable
 // and Ready refuses to run while that comparison is unresolved.
 const state=await (await fetch(`${base}/api/facade-repair/notes/${id}`)).json();
 await fetch(`${base}/api/facade-repair/notes/${id}`,{method:'POST',headers:{'content-type':'application/json','x-review-token':state.token},body:JSON.stringify({packetSha256:id,caseId:'case-04',text:'remote newer note',status:'needs-work',issues:[],expectedRevision:1})});
 await page.evaluate(()=>window.notes.show('case-04'));await page.locator('#repair-note').fill('local conflicting note');await page.locator('#repair-note-save').click();await page.waitForFunction(()=>document.querySelector('#repair-note-message')?.textContent?.includes('reload and compare'));
 assert.match(await page.evaluate(k=>localStorage.getItem(k),`repair-note:${id}:case-04`),/local conflicting note/);
 const conflictPosts=posts;await page.locator('#repair-note').fill('still local after conflict');await page.locator('#repair-note-save').click();await page.waitForTimeout(30);assert.equal(posts,conflictPosts,'typing does not clear a conflict block or resend stale revisions');
 assert.equal(await page.evaluate(async()=>await (window as any).notes.saveCurrent()),false,'saveCurrent reports a conflict');
 assert.match(await page.evaluate(k=>localStorage.getItem(k),`repair-note:${id}:case-04`),/still local after conflict/);
 await page.locator('#repair-notes-ready').click();await page.waitForFunction(()=>document.querySelector('#repair-note-message')?.textContent?.includes('Reload and compare'));
 disk=JSON.parse(await fs.readFile(path.join(temporary,'notes',`${id}.json`),'utf8'));assert.equal(disk.readyForFixes,false);
 always503=true;await page.evaluate(()=>window.notes.show('case-11'));await page.locator('#repair-note').fill('persistent outage');const before503=posts;assert.equal(await page.evaluate(async()=>await (window as any).notes.saveCurrent()),false,'persistent failure returns false');assert.equal(posts,before503+1,'one saveCurrent makes one failed request');
 console.log('Preview notes retry: transient retry, queued newest drafts, conflict preservation, and ready ordering passed.');
}finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
