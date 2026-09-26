/** Direct source/street comparison captures for staged native-crop candidates. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from 'playwright';
const releaseId=process.argv.find(arg=>arg.startsWith('--release='))?.slice(10)??'34cbce2d44d8350d912e3614049c06762c7fee85525aca6143fd9eea854ffe39';
const suffix=(process.argv.find(arg=>arg.startsWith('--suffix='))?.slice(9)??'').replace(/[^a-z0-9-]/gi,'');
const galleryId=`${releaseId}${suffix?`-${suffix}`:''}`;
const base=process.env.NEIGHBOURHOOD_BASE_URL??'http://127.0.0.1:5195';
const root=`public/data/city-expansion/releases/${releaseId}`,output=`.cache/city-appearance/thousand-building-frontage-gallery/${galleryId}`,publicOutput=`public/data/facade-review-galleries/${galleryId}`,reportPath=`scripts/review/thousand-building-frontage-gallery${suffix?`-${suffix}`:''}.json`; 
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await fs.readFile(`${root}/manifest.json`));const candidates=[];
for(const tile of manifest.tiles){const payload=JSON.parse(gunzipSync(await fs.readFile('public'+tile.url)));for(const owner of payload.owners??[])for(const observation of owner.observations??[]){const record=observation.payload;if(record?.candidateRegistrationPreview&&record.facadeDescription?.sources)candidates.push({record,buildingId:owner.id,tile:tile.key});}}
const featureKinds=candidate=>Object.values(candidate.record.facadeDescription.sources).flatMap(source=>source.features??[]).map(feature=>feature.kind);
const retail=candidates.filter(candidate=>featureKinds(candidate).some(kind=>kind==='fascia'||kind==='awning')).sort((a,b)=>a.record.id.localeCompare(b.record.id));
const residential=candidates.filter(candidate=>!featureKinds(candidate).some(kind=>kind==='fascia'||kind==='awning')).sort((a,b)=>a.record.id.localeCompare(b.record.id));
const forced=candidates.find(candidate=>candidate.record.id==='0363100012168431_e_1tp2fiv');
// Deliberately keep the review set mixed: the required retail case, one further
// shopfront, and three non-retail frontages.  A retail-first fill would hide
// residential placement failures in this small visual sample.
const selected=[];for(const candidate of [forced,...retail.filter(candidate=>candidate.record.id!==forced?.record.id).slice(0,1),...residential])if(candidate&&!selected.some(item=>item.record.id===candidate.record.id)&&selected.length<5)selected.push(candidate);
if(selected.length!==5)throw Error(`Expected five mixed candidates, found ${selected.length}`);
await fs.mkdir(output,{recursive:true});await fs.mkdir(publicOutput,{recursive:true});
const compilerBundle=await fs.readFile('public/canal-drive/js/city-appearance-viewer.bundle.js');const compilerBundleSha256=hash(compilerBundle);
const browser=await chromium.launch({headless:true});const captures=[];const errors=[];
try{const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
 for(let index=0;index<selected.length;index++){
  const candidate=selected[index],record=candidate.record,source=record.images.ground??record.images.full;
  if(!source?.file||!/^[a-f0-9]{64}$/.test(source.sha256))throw Error(`${record.id}: missing source image`);
  const sourceOutput=`${String(index+1).padStart(2,'0')}-${record.id}-source.jpg`,streetOutput=`${String(index+1).padStart(2,'0')}-${record.id}-street.png`;
  await fs.copyFile(source.file,path.join(output,sourceOutput));
  await fs.copyFile(source.file,path.join(publicOutput,sourceOutput));
  await page.goto(`${base}/canal-drive/city-appearance.html?area=expansion&release=${releaseId}&frontage=${encodeURIComponent(record.id)}`,{waitUntil:'networkidle',timeout:90000});
  await page.waitForFunction(()=>window.cityAppearanceDemo?.status?.().ready===true,null,{timeout:90000});
  await page.evaluate(id=>window.cityAppearanceDemo.frontage(id),record.id);await page.evaluate(()=>window.cityAppearanceDemo.whenIdle());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const status=await page.evaluate(()=>window.cityAppearanceDemo.status());
  if(status.releaseId!==releaseId||status.selectedId!==record.id)throw Error(`${record.id}: viewer did not select staged frontage`);
  await page.locator('#labels').evaluate(element=>{element.checked=false;});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('#inspector').evaluate(element=>{element.hidden=true;});
  await page.locator('#stage').screenshot({path:path.join(output,streetOutput),animations:'disabled',timeout:90000});
  await fs.copyFile(path.join(output,streetOutput),path.join(publicOutput,streetOutput));
  const [sourceBytes,streetBytes]=await Promise.all([fs.readFile(path.join(output,sourceOutput)),fs.readFile(path.join(output,streetOutput))]);
  let fullSource=null;
  if(record.images.full?.file){const full=record.images.full,filename=`${String(index+1).padStart(2,'0')}-${record.id}-full-source.jpg`,bytes=await fs.readFile(full.file);if(hash(bytes)!==full.sha256)throw Error(`${record.id}: full source hash mismatch`);await fs.writeFile(path.join(output,filename),bytes);await fs.writeFile(path.join(publicOutput,filename),bytes);fullSource={tier:'full',sha256:full.sha256,captureDate:full.date,publicPath:`/data/facade-review-galleries/${galleryId}/${filename}`};}
  if(hash(sourceBytes)!==source.sha256)throw Error(`${record.id}: source hash mismatch`);
  captures.push({fullSource,index:index+1,observationId:record.id,buildingId:candidate.buildingId,street:record.street??null,tile:candidate.tile,role:featureKinds(candidate).some(kind=>kind==='fascia'||kind==='awning')?'retail-or-mixed':'residential',source:{tier:record.images.ground?'ground':'full',sha256:source.sha256,captureDate:source.date,width:source.width,height:source.height,originalPath:source.file,galleryPath:path.join(output,sourceOutput),publicPath:`/data/facade-review-galleries/${galleryId}/${sourceOutput}`,sha256Copied:hash(sourceBytes)},streetCapture:{galleryPath:path.join(output,streetOutput),publicPath:`/data/facade-review-galleries/${galleryId}/${streetOutput}`,sha256:hash(streetBytes),cameraPosition:status.cameraPosition,cameraTarget:status.cameraTarget,view:status.view,facadeWindows:status.facadeWindows,facadeDoors:status.facadeDoors,intervalPaintedWalls:status.intervalPaintedWalls},features:Object.values(record.facadeDescription.sources).flatMap(source=>source.features??[]).map(feature=>({id:feature.id,kind:feature.kind,head:feature.head??null,state:feature.state??null})),inspectorVisible:false});
 }
}finally{await browser.close();}
if(hash(await fs.readFile('public/canal-drive/js/city-appearance-viewer.bundle.js'))!==compilerBundleSha256)throw Error('Viewer bundle changed during capture');
if(errors.length)throw Error(`Viewer errors: ${errors.join('; ')}`);
const gallery={version:2,scope:'direct staged candidate frontage/source captures; ambiguous registration preview only',galleryId,releaseId,compilerBundleSha256,baseUrl:base,createdAt:new Date().toISOString(),captures,visualReview:'pending agent visual inspection',sourceHashesBound:true,metricRegistrationAccepted:0};
await fs.writeFile(path.join(output,'gallery.json'),JSON.stringify(gallery,null,2)+'\n');await fs.writeFile(path.join(publicOutput,'gallery.json'),JSON.stringify(gallery,null,2)+'\n');await fs.writeFile(reportPath,JSON.stringify(gallery,null,2)+'\n');console.log(JSON.stringify({releaseId,captures:captures.map(c=>({id:c.observationId,role:c.role,source:c.source.galleryPath,street:c.streetCapture.galleryPath,windows:c.streetCapture.facadeWindows,doors:c.streetCapture.facadeDoors,view:c.streetCapture.view}))},null,2));
