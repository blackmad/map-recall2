/** Independent semantic/browser audit. Review POSTs are intercepted, never sent. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {assessRoofEvidence} from '../public/canal-drive/da-costa-block/roof-assessment.js';
const base=process.env.NEIGHBOURHOOD_URL||'http://127.0.0.1:5195';
const before=await(await fetch(base+'/api/neighbourhood/export')).text();
const data=await(await fetch(base+'/api/neighbourhood')).json();
const failures=[],checks=[],captured=[];
const check=(name,actual,expected)=>{try{assert.deepEqual(actual,expected);checks.push(name);}catch{failures.push({name,actual,expected});}};
// Publisher-shaped secondary candidates must not resurrect a full-model abstention.
const hidden={id:'fixture',effectiveProposal:null,images:{aerial:{coverageComplete:true}},roofEvidence:{shape:'flat'},roofOracleProposal:{sourceId:'same-roof-run',roofShape:'hipped',roofVisible:'no'},roofOracleCandidates:[{sourceId:'same-roof-run',shape:'hipped'}]};
check('roofVisible=no is not resurrected by a duplicate candidate',assessRoofEvidence(hidden).candidates.length,0);
const unknownReview={id:'fixture',effectiveProposal:{roofShape:'unknown'},images:{aerial:{coverageComplete:true}},review:{placement:'accepted',roofShape:'unknown'}};
check('accepted placement plus unknown roof is not roof verification',assessRoofEvidence(unknownReview).humanReviewed,false);
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    if(route.request().method()!=='POST')return route.continue();
    captured.push({url:route.request().url(),body:route.request().postDataJSON()});
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Audit intercepted this request; no review was saved.'})});
  });
  await page.route('**/canal-drive/da-costa-block.html?*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Audit preview fixture</title>'}));
  const source=data.records.find(r=>r.address==='Da Costakade 4');assert.ok(source);
  let visit=0;
  const open=async(assisted=true)=>{await page.goto(base+'/canal-drive/neighbourhood-review.html?audit='+visit+++'#'+source.id);await page.waitForFunction(()=>window.neighbourhoodReview?.state().ready);if(assisted)await page.locator('#hide-suggestions').uncheck();};
  await open(false);await page.locator('#confirm').click();await page.locator('#save').click();await page.waitForFunction(()=>!window.neighbourhoodReview.state().busy);
  check('unexposed hidden-suggestion decision remains unassisted',captured.at(-1)?.body.suggestionShown,false);
  await open();const details=page.locator('.roof-comparison');await details.locator('summary').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.roof-comparison').open);
  check('geometry SUMMARY Enter does not accept placement',await page.evaluate(()=>window.neighbourhoodReview.state().stage),'placement');
  const priorPosts=captured.length;await page.keyboard.press('r');await page.keyboard.press('c');await page.keyboard.press('s');
  check('focused geometry SUMMARY hotkeys do not save or navigate',{posts:captured.length,id:await page.evaluate(()=>window.neighbourhoodReview.state().id)},{posts:priorPosts,id:source.id});
  await page.locator('#hide-suggestions').check();await page.locator('#confirm').click();await page.locator('#save').click();await page.waitForFunction(()=>!window.neighbourhoodReview.state().busy);
  check('geometry opened before acceptance survives hide as exposure',captured.at(-1)?.body.suggestionShown,true);
  await open();await page.locator('#confirm').click();await page.locator('#suggestions summary').focus();const beforeSummary=captured.length;await page.keyboard.press('Enter');
  check('appearance source SUMMARY Enter does not save',{posts:captured.length,stage:await page.evaluate(()=>window.neighbourhoodReview.state().stage)},{posts:beforeSummary,stage:'appearance'});
  await open();await page.locator('.roof-comparison summary').click();
  let selected=source;
  for(let i=0;i<data.records.length&&selected.buildingId===source.buildingId;i++){await page.locator('#wall-right').click();const id=await page.evaluate(()=>window.neighbourhoodReview.state().targetId);selected=data.records.find(r=>r.id===id);}
  assert.notEqual(selected.buildingId,source.buildingId,'Need nearby alternative building for attribution check');
  const text=await page.locator('.roof-comparison').textContent();
  const explicitMismatch=/(original|photo|source).{0,100}(differs|different|not the selected|not updated|unchanged|correction)/is.test(text)||text.includes(source.id)&&text.includes(selected.id);
  check('cross-building selection has explicit roof source/selection warning',explicitMismatch,true);
  const diagramWall=await page.locator('.roof-source-wall').evaluate(l=>[l.getAttribute('x1'),l.getAttribute('y1'),l.getAttribute('x2'),l.getAttribute('y2')].map(Number));
  check('diagnostic remains truthfully bound to its original source wall',diagramWall,[...source.localStart,...source.localEnd]);
  check('browser page errors',errors,[]);
  check('real review export unchanged',await(await fetch(base+'/api/neighbourhood/export')).text(),before);
  console.log(JSON.stringify({passed:failures.length===0,checks,failures,interceptedReviewPosts:captured.length,forwardedPosts:0,crossBuildingCase:{sourceId:source.id,selectedId:selected.id}},null,2));
  if(failures.length)process.exitCode=1;
}finally{await browser.close();}
