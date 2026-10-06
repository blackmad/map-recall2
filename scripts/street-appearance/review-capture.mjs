/** Capture fixed production cameras, renderer provenance and steady-state frame timings.
 * node scripts/street-appearance/review-capture.mjs --phase=baseline --base-url=http://127.0.0.1:5196
 * Run again with --phase=after after rebuilding browser AND worker bundles.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
const option = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length+3) ?? fallback;
const phase=option('phase','after'), base=option('base-url','http://127.0.0.1:5196');
const looks=option('looks','photo,storybook,cartoon,procedural').split(',');
if(looks.some(l=>!['photo','storybook','cartoon','procedural'].includes(l)))throw Error('Unsupported detailed look');
const append=process.argv.includes('--append'),emptyProfiles=process.argv.includes('--empty-profiles');
if (!/^[a-z0-9-]+$/.test(phase)) throw Error('Invalid phase');
const output=option('output',`artifacts/street-appearance/${phase}`);
await fs.mkdir(output,{recursive:true});
const mainTargets=[
 {id:'overtoom',center:[4.8687372,52.3608814],bearing:55},
 {id:'de-wallen',center:[4.8979412,52.3713544],bearing:70},
 {id:'modern-control',center:[4.86853,52.37534],bearing:-25},
];
const holdoutTargets=[{id:'overtoom-holdout',center:[4.87047,52.361485],bearing:55},{id:'de-wallen-holdout',center:[4.898569,52.37164],bearing:70}];
const frontTargets=[{id:'overtoom-front',center:[4.8687372,52.3608814],bearing:157},{id:'de-wallen-front',center:[4.8979412,52.3713544],bearing:116},{id:'modern-control-front',center:[4.86853,52.37534],bearing:187}];
const targetSet=option('targets','main');
if(!['main','holdout','all','front'].includes(targetSet))throw Error('Invalid target selection');
let targets=targetSet==='all'?[...mainTargets,...holdoutTargets]:targetSet==='holdout'?holdoutTargets:targetSet==='front'?frontTargets:mainTargets;
const onlyTarget=option('only-target',null);if(onlyTarget)targets=targets.filter(t=>t.id===onlyTarget);if(!targets.length)throw Error('No review target');
const customCentre=option('center',null);if(customCentre){const point=customCentre.split(',').map(Number);if(point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)throw Error('Invalid center');targets=targets.map(t=>({...t,center:point,bearing:Number(option('bearing',String(t.bearing)))}));}
const views=option('views','gameplay,street').split(',');if(views.some(v=>!['gameplay','street'].includes(v)))throw Error('Invalid view');
const bundleNames=['three-buildings.bundle.js','three-buildings-worker.bundle.js','vector-map.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(bundleNames.map(async n=>[n,crypto.createHash('sha256').update(await fs.readFile(`public/canal-drive/js/${n}`)).digest('hex')])));
const bundlePhase=option('bundle-phase',null);
let catalogBytes=bundlePhase?null:await fs.readFile('public/data/street-appearance/profiles.json');
const excludeProfile=option('exclude-profile',null);
if(catalogBytes&&excludeProfile){const filtered=JSON.parse(catalogBytes);filtered.profiles=filtered.profiles.filter(p=>p.id!==excludeProfile);filtered.revision+='-without-'+excludeProfile;catalogBytes=Buffer.from(JSON.stringify(filtered));}
const catalog=catalogBytes?JSON.parse(catalogBytes):null;
const catalogSha256=catalogBytes?crypto.createHash('sha256').update(catalogBytes).digest('hex'):null;
if(catalogBytes)await fs.writeFile(path.join(output,'profiles.json'),catalogBytes);
const bundles=bundlePhase?Object.fromEntries(await Promise.all(bundleNames.map(async n=>[n,crypto.createHash('sha256').update(await fs.readFile(`artifacts/street-appearance/${bundlePhase}/bundles/${n}`)).digest('hex')]))):await hashes();
const frozenBundleRoot=bundlePhase?`artifacts/street-appearance/${bundlePhase}/bundles`:path.join(output,'bundles');
if(!bundlePhase){await fs.mkdir(frozenBundleRoot,{recursive:true});for(const name of bundleNames)await fs.copyFile(`public/canal-drive/js/${name}`,path.join(frozenBundleRoot,name));}
const executablePath=process.env.PW_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,executablePath});
const errors=[],results=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));
 for(const name of bundleNames)await page.route(`**/canal-drive/js/${name}*`,async route=>route.fulfill({status:200,contentType:'application/javascript',body:await fs.readFile(path.join(frozenBundleRoot,name))}));
 if(catalogBytes)await page.route('**/data/street-appearance/profiles.json*',route=>route.fulfill({status:200,contentType:'application/json',body:catalogBytes}));
 await page.goto(`${base}/canal-drive/`,{waitUntil:'load',timeout:90000});
 await page.waitForFunction(()=>Boolean(window.canalRecallGame?.ctx),null,{timeout:90000});
 await page.locator('#route-card').waitFor({state:'visible'});
 await page.evaluate(()=>{const g=window.canalRecallGame;const nearest=(lng,lat)=>g.routePois.slice().sort((a,b)=>Math.hypot((a.lng-lng)*.61,a.lat-lat)-Math.hypot((b.lng-lng)*.61,b.lat-lat))[0];g._pickReviewRide=()=>({from:nearest(4.8687372,52.3608814),to:nearest(4.8979412,52.3713544),dueNear:[],alternatives:[]});});
 await page.locator('#route-card').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>window.canalRecallGame?.vectorMap?.ready===true,null,{timeout:120000});
 await page.waitForTimeout(750);
 if(!bundlePhase)await page.waitForFunction(()=>Boolean(window.canalRecallGame.vectorMap._threeBuildings?.appearanceRevision),null,{timeout:60000});
 await page.evaluate(emptyProfiles=>{const v=window.canalRecallGame.vectorMap;v.sync=()=>{};if(emptyProfiles)v._threeBuildings?.setStreetAppearance?.({schemaVersion:1,revision:'review-empty-profiles',profiles:[]});},emptyProfiles);
 if(targetSet==='front')await page.evaluate(()=>window.canalRecallGame.vectorMap.map.setMaxPitch(85));
 for(const target of targets){
  for(const look of looks){
   for(const view of views){
    const front=target.id.endsWith('-front');
    const camera={center:target.center,bearing:target.bearing,pitch:view==='street'?(front?80:75):(front?65:58),zoom:view==='street'?(front?20.5:19.8):(front?19:18.3)};
    await page.evaluate(async({camera,look})=>{
     const v=window.canalRecallGame.vectorMap; v.setBuildingLook(look);
     await v.setBuildingsLook(look); v.map.jumpTo(camera);
     v._threeBuildings?.setDetailCentre(...camera.center);v._completeCity?.followCamera();v.map.triggerRepaint();
    },{camera,look});
    await page.waitForFunction(()=>{const v=window.canalRecallGame.vectorMap,t=v._threeBuildings,city=v._completeCity?.status?.();return t?.ready&&t.chunks?.size>0&&!t.pending?.length&&!t.inflight?.size&&!t.pumping&&!city?.inFlight&&!city?.queued;},null,{timeout:120000});
    await page.waitForTimeout(1500);
    const diagnostics=await page.evaluate(async()=>{
     const v=window.canalRecallGame.vectorMap,t=v._threeBuildings;
     const renderTimes=[],originalRender=t.renderer.render.bind(t.renderer);t.renderer.render=(...args)=>{const start=performance.now();const result=originalRender(...args);renderTimes.push(performance.now()-start);return result;};
     const times=[];let last=performance.now();await new Promise(resolve=>{const frame=now=>{times.push(now-last);last=now;if(times.length<121){v.map.triggerRepaint();requestAnimationFrame(frame);}else resolve();};requestAnimationFrame(frame);});
     t.renderer.render=originalRender;
     const gpuTimes=[],gl=t.renderer.getContext();
     for(let i=0;i<45;i++){gl.finish();const start=performance.now();t.renderer.resetState();t.renderer.render(t.scene,t.camera);gl.finish();if(i>=5)gpuTimes.push(performance.now()-start);}
     gpuTimes.sort((a,b)=>a-b);v.map.triggerRepaint();
     const renderOrdered=renderTimes.slice(1).sort((a,b)=>a-b);
     const ordered=times.slice(1).sort((a,b)=>a-b);
     return {appearanceRevision:t.appearanceRevision??t.streetAppearanceRevision??null,appearanceProfileCount:t.appearanceProfiles?.length??t.streetAppearance?.profiles?.length??null,renderCompletedMedianMs:gpuTimes[Math.floor(gpuTimes.length*.5)],renderCompletedP95Ms:gpuTimes[Math.floor(gpuTimes.length*.95)],stats:t.stats(),renderCpuMedianMs:renderOrdered[Math.floor(renderOrdered.length*.5)]??null,renderCpuP95Ms:renderOrdered[Math.floor(renderOrdered.length*.95)]??null,look:t.look,requestedLook:t.requestedLook,chunks:t.chunks.size,pending:t.pending.length,inflight:t.inflight.size,lastBuildMs:t.lastBuildMs,triangles:[...t.chunks.values()].reduce((s,c)=>s+(c.mesh.geometry.index?.count??c.mesh.geometry.attributes.position?.count??0)/3,0),featureCount:v._tileFeatures.length,frameMedianMs:ordered[Math.floor(ordered.length*.5)],frameP95Ms:ordered[Math.floor(ordered.length*.95)],city:v._completeCity?.status?.(),camera:{center:v.map.getCenter().toArray(),bearing:v.map.getBearing(),pitch:v.map.getPitch(),zoom:v.map.getZoom()}};
    });
    if(target.id.startsWith('de-wallen')&&look==='photo'&&view==='gameplay'){
     const auditInput=await page.evaluate(()=>{const t=window.canalRecallGame.vectorMap._threeBuildings;for(const [key,source]of t.sourceGroups){if(!key.startsWith('extras:')&&!key.startsWith('coarse:')&&source.some(f=>f.properties.id==='NL.IMBAG.Pand.0363100012178210')){const entry=t.chunks.get(key);return {key,source,streets:Array.from(entry?.mesh?.userData?.installedStreets??[]),profiles:t.appearanceProfiles,revision:t.appearanceRevision};}}return null;});
     if(auditInput)await fs.writeFile(path.join(output,'applied-audit-input.json'),JSON.stringify(auditInput)+'\n');
    }
    if(diagnostics.look!==look||diagnostics.requestedLook!==look)throw Error('Mode switch failed');
    if(catalog&&!emptyProfiles&&diagnostics.appearanceRevision!==catalog.revision)throw Error('Runtime profile revision mismatch');
    if(emptyProfiles&&(diagnostics.appearanceRevision!=='review-empty-profiles'||diagnostics.appearanceProfileCount!==0))throw Error('Empty profile ablation failed');
    const image=`${target.id}-${look}-${view}.png`;
    await page.locator('#vector-map').screenshot({path:path.join(output,image),animations:'disabled',timeout:90000});
    results.push({target:target.id,look,view,image,camera,diagnostics});
    console.log(`${phase} ${target.id} ${look} ${view}: ${diagnostics.chunks} chunks; ${diagnostics.frameMedianMs.toFixed(1)}ms median`);
   }
  }
 }
 // Last-request-wins while tiles/geometry are queued, then return to the first target.
 await page.evaluate(async camera=>{const v=window.canalRecallGame.vectorMap;v.map.jumpTo(camera);v._completeCity?.followCamera();v.setBuildingLook('cartoon');v.setBuildingLook('storybook');v.setBuildingLook('photo');await v.setBuildingsLook('photo');return {look:v._threeBuildings.look,requested:v._threeBuildings.requestedLook};},{center:targets[0].center,zoom:19.8,pitch:75,bearing:targets[0].bearing});
 await page.waitForFunction(()=>{const t=window.canalRecallGame.vectorMap._threeBuildings;return t?.look==='photo'&&!t.pending.length&&!t.inflight.size&&!t.pumping;},null,{timeout:120000});
 const race=await page.evaluate(()=>{const t=window.canalRecallGame.vectorMap._threeBuildings;return {look:t.look,requested:t.requestedLook,appearanceRevision:t.appearanceRevision??null,mismatches:[...t.chunks.entries()].filter(([,c])=>c.mesh.userData.appearanceRevision!==undefined&&(c.mesh.userData.installedLook!==t.look||c.mesh.userData.appearanceRevision!==t.appearanceRevision)).map(([key,c])=>({key,...c.mesh.userData}))};});
 if(race.look!=='photo'||race.requested!=='photo'||race.mismatches.length)throw Error('Last-request-wins failed');
 const sourceFilesChangedDuringCapture=!bundlePhase&&JSON.stringify(await hashes())!==JSON.stringify(bundles);
 if(append){const prior=JSON.parse(await fs.readFile(path.join(output,'report.json'),'utf8'));const existing=prior.results.filter(p=>!results.some(n=>n.target===p.target&&n.look===p.look&&n.view===p.view));results.unshift(...existing);}
 const report={version:1,phase,emptyProfiles,immutableBundleSnapshot:true,sourceFilesChangedDuringCapture,catalogSha256,catalogRevision:catalog?.revision??null,createdAt:new Date().toISOString(),baseUrl:base,bundles,results,race,errors,limits:'Frame timing includes compositor vsync. Completed render timing waits for GL finish and measures the Three layer only; compare repeated runs on identical hardware. Street cameras are oblique map views, not panorama registration.'};
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 const cells=results.map(r=>`<figure><img src="${r.image}"/><figcaption>${r.target} · ${r.look} · ${r.view} · ${r.diagnostics.frameMedianMs.toFixed(1)}ms</figcaption></figure>`).join('');
 await fs.writeFile(path.join(output,'index.html'),`<!doctype html><meta charset="utf-8"><title>Street appearance ${phase}</title><style>body{background:#eee;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}figure{margin:0}img{width:100%}</style><h1>${phase} — fixed cameras</h1><main>${cells}</main>`);
}finally{await browser.close();}
