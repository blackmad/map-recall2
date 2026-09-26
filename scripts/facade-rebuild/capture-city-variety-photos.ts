import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output=path.resolve('.cache/facade-rebuild/reports',`city-variety-demos-${new Date().toISOString().replaceAll(':','-')}`);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1150},deviceScaleFactor:1});
const base=process.env.FACADE_BASE_URL || 'http://127.0.0.1:5187';
const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
const captures:unknown[]=[];
const cases=[
  {pandId:'0363100012180292',label:'corner-shopfront'},
  {pandId:'0363100012168782',label:'wide-garage'},
  {pandId:'0363100012176665',label:'canal-balconies'},
  {pandId:'0363100012171819',label:'stepped-gable-shop'},
];
const phases=[
  {name:'raw',run:'dino-base-city-variety-raw-01'},
  {name:'fitted',run:'dino-base-city-variety-fit-01'},
] as const;
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
try{
  for(const item of cases)for(const phase of phases){
    await page.goto(`${base}/canal-drive/facade-photo-lab.html?run=${phase.run}`);
    await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
    const index=await page.locator('#source option').evaluateAll((options,pandId)=>options.findIndex(option=>option.textContent?.includes(pandId)),item.pandId);
    if(index<0)throw Error(`${item.pandId} missing from ${phase.run}`);
    await page.locator('#source').selectOption(String(index));
    await page.waitForFunction(pandId=>(window as any).canalRecallPhotoLab.status().ready && (window as any).canalRecallPhotoLab.record().source.pandId===pandId,item.pandId);
    await page.locator('#show-raw').check();
    const data=await page.evaluate(()=>{const api=(window as any).canalRecallPhotoLab;return{status:api.status(),record:api.record(),asset:api.asset(),recipe:api.recipe()};});
    if(data.status.error)throw Error(data.status.error);
    const file=`${item.label}-${phase.name}.png`;
    await page.locator('.views').screenshot({path:path.join(output,file)});
    let evidenceFile:string|null=null;
    if(phase.name==='fitted'){
      const opening=data.record.openings.find((candidate:any)=>candidate.fit?.applied) ?? data.record.openings.find((candidate:any)=>candidate.state==='proposed');
      if(opening){
        await page.locator('#opening').selectOption(opening.id);
        evidenceFile=`${item.label}-fitted-evidence.png`;
        await page.locator('section.panel').filter({hasText:'Detection → fit → feature evidence'}).screenshot({path:path.join(output,evidenceFile)});
      }
    }
    const manifestBytes=await readFile(path.resolve(`public/canal-drive/facade-photo-review/local/${phase.run}/manifest.json`));
    captures.push({pandId:item.pandId,label:item.label,phase:phase.name,run:phase.run,file,evidenceFile,runManifestSha256:digest(manifestBytes),status:data.status,recipe:data.recipe,asset:data.asset});
  }
  await writeFile(path.join(output,'manifest.json'),JSON.stringify({base,cases,phases,captures,errors,note:'Four registered municipal-panorama wall demos. Raw and bounded-family fits remain unlabelled development proposals.'},null,2)+'\n');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(output);
}finally{await browser.close();}
