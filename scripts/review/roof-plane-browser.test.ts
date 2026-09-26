/** Browser pixel check for the source crop overlay and the provisional eave. */
import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import path from 'node:path';

const root=process.cwd();
const bundle=await build({entryPoints:[path.join(root,'scripts/review/preview-browser.ts')],bundle:true,format:'esm',write:false});
const app=express();
app.get('/canal-drive/js/facade-repair-preview.bundle.js',(_req,res)=>res.type('js').send(bundle.outputFiles[0].text));
app.use(express.static(path.join(root,'public')));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.on('listening',resolve));
const base=`http://127.0.0.1:${(server.address() as any).port}`;
const launch:any={headless:true};
try{await import('node:fs/promises').then(fs=>fs.access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));launch.executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';}catch{}
const browser=await chromium.launch(launch);
try{
  const page=await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:1});
  const captures:Uint8Array[]=[];let width=0,height=0;
  for(const photoPercent of [0,50,100]){
    await page.goto(`${base}/canal-drive/facade-repair-preview.html?embed=1&case=case-20&focus=roof&candidateVariant=roof-planes&comparisonMode=source-aligned&overlayOpacity=${photoPercent}`);
    await page.locator('canvas[data-case-id="case-20"][data-candidate-variant="roof-planes"][data-comparison-mode="source-aligned"]').waitFor();
    await page.locator('.candidate-stage img').evaluate(async (image:HTMLImageElement)=>image.decode());
    const photo=await page.locator('.candidate-stage img').evaluate((image:HTMLImageElement)=>({source:image.currentSrc,width:image.naturalWidth,height:image.naturalHeight}));
    assert.ok(photo.source.endsWith('c85f193a00e009915f48bc506ec9c589cdaefdaa3351e3a0cc5a5c5f72b672c0.jpg'));
    assert.deepEqual([photo.width,photo.height],[283,811]);
    const image=sharp(await page.locator('.candidate-stage').screenshot()).removeAlpha();
    const pixels=await image.raw().toBuffer({resolveWithObject:true});
    width=pixels.info.width;height=pixels.info.height;
    captures.push(pixels.data);
    assert.equal(await page.locator('canvas').getAttribute('data-overlay-opacity'),String(photoPercent/100));
  }
  const [model,blend,photo]=captures;
  let compared=0,error=0,photoVariation=0;
  for(let i=0;i<model.length;i+=48){
    const difference=Math.abs(model[i]-photo[i])+Math.abs(model[i+1]-photo[i+1])+Math.abs(model[i+2]-photo[i+2]);
    if(difference<60)continue;
    compared++;
    error+=Math.abs(blend[i]-(model[i]+photo[i])/2)+Math.abs(blend[i+1]-(model[i+1]+photo[i+1])/2)+Math.abs(blend[i+2]-(model[i+2]+photo[i+2])/2);
    photoVariation+=photo[i]+photo[i+1]+photo[i+2];
  }
  assert.ok(compared>100,`Expected real image/model disagreement pixels, saw ${compared}`);
  assert.ok(error/(compared*3)<6,`Half-blend must average rendered photo and geometry; mean error ${error/(compared*3)}`);
  assert.ok(photoVariation>0);
  const skyIndex=(20*width+Math.floor(width/2))*3;
  const skyDifference=Math.abs(model[skyIndex]-photo[skyIndex])+Math.abs(model[skyIndex+1]-photo[skyIndex+1])+Math.abs(model[skyIndex+2]-photo[skyIndex+2]);
  assert.ok(skyDifference>25,`At 0% photo, empty model sky must cover the source photo; difference ${skyDifference}`);
  // In the source-coordinate camera, the row-184 eave projects from crop
  // pixels to the same screen row as the source image (with contain scaling).
  const stageAspect=width/height,visibleHeight=Math.max(811*.42,283/stageAspect);
  const scale=height/visibleHeight,left=(width-283*scale)/2;
  const x=Math.round(left+80*scale),eave=Math.round(184*scale);
  const rgb=(px:Uint8Array,y:number)=>[...px.slice((y*width+x)*3,(y*width+x)*3+3)];
  const above=rgb(model,eave-9),below=rgb(model,eave+9);
  const brightness=(c:number[])=>c.reduce((a,b)=>a+b,0);
  assert.ok(brightness(above)>brightness(below)+45,`Dormer front should end at projected row 184: ${above} / ${below}`);
  await page.close();
}finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
