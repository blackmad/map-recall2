import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output=path.resolve('.cache/facade-rebuild/reports',`expansion-inference-demos-${new Date().toISOString().replaceAll(':','-')}`);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
const base=process.env.FACADE_BASE_URL || 'http://127.0.0.1:3000';
const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
const cases=[
  {pandId:'0363100012164995',address:'Bloemstraat 3',label:'bloemstraat-grid-cell',focus:'grid-1'},
  {pandId:'0363100012167704',address:'Herenstraat 40',label:'herenstraat-dormer',focus:'dino-7'},
] as const;
const phases=[
  {name:'before',run:'dino-base-expansion-day2-03'},
  {name:'after',run:'dino-base-expansion-grid-03'},
] as const;
const captures:any[]=[];const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
try{
  for(const item of cases)for(const phase of phases){
    await page.goto(`${base}/canal-drive/facade-photo-lab.html?run=${phase.run}`);
    await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
    const index=await page.locator('#source option').evaluateAll((options,address)=>options.findIndex(option=>option.textContent?.includes(address)),item.address);
    if(index<0)throw Error(`${item.pandId} missing from ${phase.run}`);
    await page.locator('#source').selectOption(String(index));
    await page.waitForFunction(pandId=>(window as any).canalRecallPhotoLab.status().ready && (window as any).canalRecallPhotoLab.record().source.pandId===pandId,item.pandId);
    await page.locator('#show-raw').check();
    const data=await page.evaluate(()=>{const api=(window as any).canalRecallPhotoLab;return{status:api.status(),record:api.record(),asset:api.asset(),recipe:api.recipe()};});
    if(data.status.error)throw Error(data.status.error);
    const file=`${item.label}-${phase.name}.png`;await page.locator('.views').screenshot({path:path.join(output,file)});
    let evidenceFile:string|null=null;
    const focus=data.record.openings.find((opening:any)=>opening.id===item.focus);
    if(phase.name==='after'){
      if(!focus||focus.state!=='proposed')throw Error(`${item.focus} was not recovered for ${item.label}`);
      await page.locator('#opening').selectOption(item.focus);
      evidenceFile=`${item.label}-after-evidence.png`;
      await page.locator('section.panel').filter({hasText:'Detection → fit → feature evidence'}).screenshot({path:path.join(output,evidenceFile)});
    }
    const manifestBytes=await readFile(path.resolve(`public/canal-drive/facade-photo-review/local/${phase.run}/manifest.json`));
    captures.push({pandId:item.pandId,label:item.label,focus:item.focus,phase:phase.name,run:phase.run,file,evidenceFile,
      runManifestSha256:digest(manifestBytes),openingCounts:{rendered:data.record.openings.filter((opening:any)=>opening.state==='proposed').length,review:data.record.openings.filter((opening:any)=>opening.state!=='proposed').length},
      focusedOpening:focus??null,status:data.status,recipe:data.recipe,asset:data.asset});
  }
  for(const item of cases){
    const before=captures.find(c=>c.label===item.label&&c.phase==='before');const after=captures.find(c=>c.label===item.label&&c.phase==='after');
    if(after.openingCounts.rendered<=before.openingCounts.rendered)throw Error(`${item.label} did not gain a rendered opening`);
  }
  await writeFile(path.join(output,'manifest.json'),JSON.stringify({base,cases,phases,captures,errors,
    note:'Before/after evidence for detector-ensemble, dense-grid and roof-context inference. Geometry remains a reviewable development proposal.'},null,2)+'\n');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(output);
}finally{await browser.close();}
