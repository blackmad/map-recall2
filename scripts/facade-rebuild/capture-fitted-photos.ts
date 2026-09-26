import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output=path.resolve('.cache/facade-rebuild/reports',`fitted-photos-${new Date().toISOString().replaceAll(':','-')}`);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1150},deviceScaleFactor:1});
const base=process.env.FACADE_BASE_URL || 'http://127.0.0.1:5187';
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
const renders:unknown[]=[];
const cases=[
  {address:'Keizersgracht 136',before:'dino-base-pilot-fit-01',after:'dino-base-pilot-day2-03',opening:'dino-9'},
  {address:'Bloemstraat 3',before:'dino-base-expansion-fit-02',after:'dino-base-expansion-day2-03',opening:'dino-19'},
  {address:'Herengracht 219',before:'dino-base-pilot-fit-01',after:'dino-base-pilot-day2-03',opening:'dino-1'},
  {address:'Herengracht 242',before:'dino-base-pilot-fit-01',after:'dino-base-pilot-day2-03',opening:'dino-1'},
];
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
try {
  for(const item of cases){
    for(const phase of ['before','after'] as const){
      const run=item[phase];
      await page.goto(`${base}/canal-drive/facade-photo-lab.html?run=${run}`);
      await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
      const option=page.locator('#source option').filter({hasText:item.address});
      if(await option.count()!==1)throw Error(`${item.address} is not unique in ${run}`);
      await page.locator('#source').selectOption(await option.getAttribute('value') ?? '');
      await page.waitForFunction(address=>(window as any).canalRecallPhotoLab.status().ready
        && (window as any).canalRecallPhotoLab.record().source.address===address,item.address);
      await page.locator('#show-raw').check();
      const data=await page.evaluate(()=>{
        const api=(window as any).canalRecallPhotoLab;
        return {status:api.status(),record:api.record(),asset:api.asset(),recipe:api.recipe()};
      });
      if(data.status.error)throw Error(data.status.error);
      const slug=item.address.toLowerCase().replaceAll(' ','-');
      const file=`${slug}-${phase}.png`;
      await page.locator('.views').screenshot({path:path.join(output,file)});
      let evidenceFile:string|null=null;
      if(phase==='after'){
        await page.locator('#opening').selectOption(item.opening);
        evidenceFile=`${slug}-after-evidence.png`;
        await page.locator('section.panel').filter({hasText:'Detection → fit → feature evidence'}).screenshot({path:path.join(output,evidenceFile)});
      }
      const manifestBytes=await readFile(path.resolve(`public/canal-drive/facade-photo-review/local/${run}/manifest.json`));
      renders.push({address:item.address,phase,run,file,evidenceFile,runManifestSha256:digest(manifestBytes),...data});
    }
  }
  const evaluation=path.resolve('.cache/facade-rebuild/reports/day2-four-case-evaluation-02.json');
  const coverage=path.resolve('.cache/facade-rebuild/reports/source-coverage-day2-02/report.json');
  const [evaluationBytes,coverageBytes]=await Promise.all([readFile(evaluation),readFile(coverage)]);
  await writeFile(path.join(output,'manifest.json'),JSON.stringify({base,cases,renders,errors,
    reports:{evaluation:{path:evaluation,sha256:digest(evaluationBytes)},coverage:{path:coverage,sha256:digest(coverageBytes)}},
    note:'Four named source-overlay/render comparisons. Raw, fitted, inferred and omitted geometry remain visible. No building/registration acceptance.'},null,2)+'\n');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(output);
} finally {await browser.close();}
