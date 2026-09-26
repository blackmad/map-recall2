/** Publish release-pinned evaluation artifacts; optional local-browser captures never write review decisions. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const args=process.argv.slice(2),flag=name=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const current=JSON.parse(await fs.readFile('public/data/city-expansion/current.json')),releaseId=flag('release-id')??current.releaseId;
const source=flag('report')??`.cache/city-appearance/districts/${current.areaId}/${releaseId}/evaluation.json`,reportBytes=await fs.readFile(source),report=JSON.parse(reportBytes),packet=structuredClone(report.packet);
assert.equal(report.releaseId,releaseId);assert.ok(packet.cases.length<=30);if(args.includes('--capture')){assert.equal(packet.cases.length,30);assert.equal(packet.summary.synchronized,30);}
const root=`public/data/city-expansion/evaluations/${releaseId}`,base=flag('base-url')??'http://127.0.0.1:5196';await fs.mkdir(root,{recursive:true});
const bundleHash=hash(await fs.readFile('public/canal-drive/js/city-appearance-viewer.bundle.js')),captureFile=path.join(root,'captures.json');
let captures={version:1,releaseId,bundleHash,cases:[]};try{const previous=JSON.parse(await fs.readFile(captureFile));if(previous.bundleHash===bundleHash&&previous.releaseId===releaseId)captures=previous;}catch(e){if(e.code!=='ENOENT')throw e;}
if(args.includes('--capture')){
  const browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage({viewport:{width:1180,height:820},reducedMotion:'reduce'});page.setDefaultTimeout(60000);
    for(const item of packet.cases){const file=`${item.caseId}.png`,prior=captures.cases.find(c=>c.caseId===item.caseId);if(prior)try{if(hash(await fs.readFile(path.join(root,file)))===prior.sha256)continue;}catch{}
      const errors=[];page.removeAllListeners('pageerror');page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+item.renderUrl);await page.waitForFunction(()=>window.cityAppearanceDemo?.status().ready);await page.evaluate(()=>window.cityAppearanceDemo.whenIdle());
      const status=await page.evaluate(()=>window.cityAppearanceDemo.status());assert.equal(status.releaseId,releaseId);assert.equal(status.selectedId,item.comparison.source.observationId);assert.deepEqual(errors,[]);assert.deepEqual(status.stream.failed,[]);assert.ok(status.stream.resident<=12&&status.contextStream.resident<=16);
      await page.waitForFunction(()=>{const image=document.querySelector('#evidence-image');return image?.complete&&image.naturalWidth>0;});
      await page.locator('#inspector').evaluate(element=>{element.hidden=true;});
      const bytes=await page.locator('#stage').screenshot();await fs.writeFile(path.join(root,file),bytes);
      captures.cases=captures.cases.filter(c=>c.caseId!==item.caseId);captures.cases.push({caseId:item.caseId,sha256:hash(bytes),observationId:status.selectedId,view:status.view,cameraPosition:status.cameraPosition,cameraTarget:status.cameraTarget,machineSigns:status.machineSigns,residentTiles:status.stream.resident,contextTiles:status.contextStream.resident,renderUrl:item.renderUrl,visuallyReviewed:false});
      await fs.writeFile(captureFile,JSON.stringify(captures,null,2)+'\n');console.log(JSON.stringify({captured:item.caseId,view:status.view,signs:status.machineSigns}));
    }
  }finally{await browser.close();}
}
for(const item of packet.cases){const capture=captures.cases.find(c=>c.caseId===item.caseId);if(capture){item.screenshotUrl=`/data/city-expansion/evaluations/${releaseId}/${item.caseId}.png`;item.screenshotSha256=capture.sha256;item.cameraOmission=capture.view==='frontage'?null:'No clear source-wall initial camera; comparison shows selected building from fallback camera';}}
for(const [file,value] of [['evaluation.json',{...report,packet}],['comparison-packet.json',packet],['cost-ledger.json',report.cost],['amsterdam-forecast.json',report.forecast]])await fs.writeFile(path.join(root,file),JSON.stringify(value,null,2)+'\n');
const proofFiles=[];for(const file of ['jordaan-source-recheck.json','oosterpark-extensibility-proof.json','coordinator-resume-proof.json']){try{const bytes=await fs.readFile(path.join('.cache/city-appearance',file)),value=JSON.parse(bytes,(key,value)=>typeof value==='string'&&value.startsWith(process.cwd()+'/')?value.slice(process.cwd().length+1):value);await fs.writeFile(path.join(root,file),JSON.stringify({...value,sourceProofSha256:hash(bytes)},null,2)+'\n');proofFiles.push(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
// Game evidence is release-bound; never attach an earlier run to a newer release.
try{
  const game=JSON.parse(await fs.readFile('.cache/city-appearance/game-evaluation-final.json'));
  if(game.releaseId===releaseId){
    game.captures=game.captures??[...(game.artifacts?.captures??[]),...(game.artifacts?.signCaptures??[]),...(game.artifacts?.desktopContactSheet?[game.artifacts.desktopContactSheet]:[])];
    assert.ok(game.captures.length>=28,'completed game proof contains the frozen matrix');
    for(const capture of game.captures){
      assert.equal(path.basename(capture.file),capture.file,'capture names stay inside the evaluation directory');
      const bytes=await fs.readFile(path.join('.cache/city-appearance',capture.file));
      if(capture.sha256)assert.equal(hash(bytes),capture.sha256);
      await fs.writeFile(path.join(root,capture.file),bytes);proofFiles.push(capture.file);
      capture.sha256=hash(bytes);capture.screenshotUrl=`/data/city-expansion/evaluations/${releaseId}/${capture.file}`;
    }
    for(const metric of game.artifacts?.projectMetrics??[]){const file=path.basename(metric),bytes=await fs.readFile(path.join('.cache/city-appearance',file));assert.equal(JSON.parse(bytes).releaseId,releaseId);await fs.writeFile(path.join(root,file),bytes);proofFiles.push(file);}
    await fs.writeFile(path.join(root,'game-evaluation-final.json'),JSON.stringify(game,null,2)+'\n');proofFiles.push('game-evaluation-final.json');
  }
}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.writeFile(path.join(root,'artifacts.json'),JSON.stringify({version:1,releaseId,reportSourceSha256:hash(reportBytes),viewerBundleSha256:bundleHash,artifacts:await Promise.all(['evaluation.json','comparison-packet.json','cost-ledger.json','amsterdam-forecast.json',...proofFiles,...captures.cases.map(c=>`${c.caseId}.png`)].map(async file=>({file,sha256:hash(await fs.readFile(path.join(root,file)))})))},null,2)+'\n');
console.log(JSON.stringify({root,releaseId,cases:packet.cases.length,captures:captures.cases.length,humanReview:'unmeasured'}));
