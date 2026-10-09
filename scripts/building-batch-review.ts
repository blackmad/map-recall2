/** Offline photo/model review sheets and POI detail-priority suggestions. */
import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';import crypto from 'node:crypto';
import {windowDivision,WINDOW_DIVISIONS} from './buildingWindowDivisions';
import {facadeCoverage} from './buildingFacadeCoverage';
import {lngLatToRd} from '../src/canalRecall/facade/rdNew';
const i=process.argv.indexOf('--root');if(i<0||!process.argv[i+1])throw Error('Missing --root');
const publishIndex=process.argv.indexOf('--publish-root');
const pageIndex=process.argv.indexOf('--page-name'),pageName=pageIndex>=0?process.argv[pageIndex+1]:'building-library-progress';
const shellQuote=(value:string)=>"'"+value.replaceAll("'","'\"'\"'")+"'";
const publishArgs=publishIndex>=0?' --publish-root '+shellQuote(path.resolve(process.argv[publishIndex+1]))+' --page-name '+shellQuote(pageName):'';
const root=path.resolve(process.argv[i+1]);if(!root.startsWith(path.resolve('artifacts')+path.sep))throw Error('Review must stay under artifacts');
const batch=JSON.parse(fs.readFileSync(root+'/batch.json','utf8'));
const warningPath=root+'/recipe-review-warnings.json';
const recipeWarnings=new Map<string,any[]>(fs.existsSync(warningPath)?JSON.parse(fs.readFileSync(warningPath,'utf8')).entries.map((e:any)=>[e.id,e.warnings]):[]);
const buildReport=JSON.parse(fs.readFileSync(root+'/build-report.json','utf8'));
const valid=new Set(buildReport.entries.filter((e:any)=>['built','cached'].includes(e.status)).map((e:any)=>e.id));
const currentPreview=(e:any)=>{
 const checks=root+'/build/'+e.id+'/assets/export-checks.json';
 return valid.has(e.id)&&fs.existsSync(checks)&&JSON.parse(fs.readFileSync(checks,'utf8')).recipeSHA256===crypto.createHash('sha256').update(fs.readFileSync(root+'/'+e.recipe)).digest('hex')
  &&fs.existsSync(root+'/preview/projections/'+e.id+'-front-detail.png');
};
const poiFile=JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/orientation-pois.json','utf8'));
const pois=poiFile.pois.map((p:any)=>({name:p[0],point:lngLatToRd([p[1],p[2]]),category:poiFile.categories[p[3]],rank:p[4]}));
const contains=(ring:number[][],point:number[])=>{let inside=false;for(let a=0,b=ring.length-1;a<ring.length;b=a++){
 const p=ring[a],q=ring[b];if((p[1]>point[1])!==(q[1]>point[1])&&point[0]<(q[0]-p[0])*(point[1]-p[1])/(q[1]-p[1])+p[0])inside=!inside;}return inside;};
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const review=root+'/review';fs.mkdirSync(review,{recursive:true});let cards='',sheets=0;const quickContexts:Record<string,any>={},coverageReports:any[]=[];
const select=(name:string,label:string,value:string,options:string[])=>`<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}"${o===value?' selected':''}>${o}</option>`).join('')}</select></label>`;
const number=(name:string,label:string,value:number,min:number,max:number,step:string)=>`<label>${label}<input name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="${step==='1'?'1':'any'}"></label>`;
for(let offset=0;offset<batch.entries.length;offset+=10){
 const entries=batch.entries.slice(offset,offset+10),cells:any[]=[];
 for(let n=0;n<entries.length;n++){
  const e=entries[n],seed=JSON.parse(fs.readFileSync(root+'/seeds/'+e.ownerId+'.json','utf8'));
  const origin=seed.building.coordinateFrame.originRD,ring=seed.building.footprint.coordinates[0][0];
  const matched=pois.filter((p:any)=>contains(ring,[p.point.x-origin.x,origin.y-p.point.y]));
  e.detailPriority={tier:matched.length?'extra':'ordinary',signals:matched.map((p:any)=>({source:'cached POI point inside owner footprint',name:p.name,category:p.category,rank:p.rank})),
   suggestedRecipePacks:[...new Set(matched.map((p:any)=>p.category==='food'?'cafe-front':p.category==='shop'||p.category==='bike'?'shop-front':'distinctive-entrance'))],
   policy:'Priority suggestion only. POI ownership and date-sensitive store appearance need a quick photo confirmation. Ordinary buildings get one likeness pass.'};
  if(e.manualDetailPriority&&e.manualDetailPriority!=='automatic')e.detailPriority.tier=e.manualDetailPriority;
  const recipe=JSON.parse(fs.readFileSync(root+'/'+e.recipe,'utf8')),front=recipe.frontages[0],row=(front.openingRows||[]).find((r:any)=>(r.storey||r.storeys?.[0]||'').startsWith('upper_'));
  const coverage=facadeCoverage(recipe);coverageReports.push({id:e.id,...coverage});
  const wider=coverage.status==='partial-frontage-suspected'?seed.selectedFacade.images.find((p:any)=>p.tier==='context'):undefined;
  let displayPhoto=wider||e.photos.full;
  const repairDir=root+'/frontage-repairs/'+e.id,repairPath=repairDir+'/extraction-repair.json';
  let repairEvidence='';
  if(fs.existsSync(repairPath)){
   const repair=JSON.parse(fs.readFileSync(repairPath,'utf8'));
   if(repair.ownerId===recipe.buildingId&&repair.geometryRevision===recipe.geometryRevision){
    const views=repair.derived.map((part:any)=>{
     if(path.basename(part.file)!==part.file)throw Error('Invalid repair image path');
     const bytes=fs.readFileSync(repairDir+'/'+part.file);
     if(crypto.createHash('sha256').update(bytes).digest('hex')!==part.sha256)throw Error('Stale repair evidence image');
     const scope=part.scope?` · ${part.scope}${part.heightRange?` (${part.heightRange.map((z:number)=>z.toFixed(2)).join('–')}m source bounds)`:''}`:'';
     const identity=part.identityReview?.status==='rejected'?` · rejected for authoring: ${part.identityReview.reason}`:'';
     return `<figure><img loading="lazy" src="data:image/jpeg;base64,${bytes.toString('base64')}" alt="Separate frontage-plane photo"/><figcaption>${esc(part.id)} · ${esc(part.captureDate)}${esc(scope)} · alignment unregistered${esc(identity)}</figcaption></figure>`;
    }).join('');
    const alternate=repair.kind==='alternate-capture-diagnostic';
    if(alternate&&repair.identityReview?.status!=='rejected'){const selected=repair.derived.find((p:any)=>p.id==='selected-front'&&p.identityReview?.status!=='rejected');if(selected)displayPhoto={...selected,path:repairDir+'/'+selected.file};}
    repairEvidence=`<details><summary>${alternate?'Alternate capture: extraction diagnosis':'Repaired extraction: separate frontage planes'}</summary><p>${alternate?'An alternate dated panorama is shown for comparison. Original evidence is retained; identity/alignment and occluded roof remain unresolved.':'Cached panorama reprojected onto each BAG wall plane. Model correction and feature alignment remain pending.'}</p><div class="evidence-pair">${views}</div></details>`;
   }
  }
  const coverageNote=coverage.status==='partial-frontage-suspected'?`Possible partial frontage: selected width is ${Math.round(coverage.projectedWidthRatio*100)}% of the owner’s projected width, with another nearby street wall outside it. ${wider?'Wider context photo shown. ':''}Check extraction before extending the recipe.`:'';
  const rowCount=recipe.storeys?recipe.storeys.filter((f:any)=>f.id.startsWith('upper_')).length:recipe.storeyLayout.upperCount;
  const groundTop=front.storefront.height,eaves=recipe.roof.eaves,span=(eaves-groundTop)/rowCount;
  const storeys=recipe.storeys||[{id:'ground',bottom:0,top:groundTop},...Array.from({length:rowCount},(_,i)=>({id:'upper_'+(i+1),bottom:groundTop+i*span,top:groundTop+(i+1)*span}))];
  const bays=row?.centresFraction?.length??row?.centres?.length??2;
  const centres=row?.centresFraction||row?.centres?.map((x:number)=>x/front.width);
  const inferredBayLayout=row?.widthFractions||centres?.some((x:number,i:number)=>Math.abs(x-(i+.5)/bays)>1e-8)?'custom':'even';
  const appearanceRoof=recipe.massing?.appearanceRoof;
  const warehousePattern=front.openingPatterns?.find((p:any)=>p.preset==='warehouse-stack');
  if(warehousePattern){
   e.detailPriority.signals.push({source:'recipe morphology',name:'Warehouse loading stacks',category:'architecture'});
   e.detailPriority.suggestedRecipePacks.push('warehouse-front','hoist-and-masonry-accents');
   if(!e.manualDetailPriority||e.manualDetailPriority==='automatic')e.detailPriority.tier='extra';
  }
  const settings={openingAssembly:warehousePattern?(warehousePattern.segments===2?'warehouse-paired':'warehouse-single'):'residential',shutterTreatment:'preserve',doorStyle:'preserve',coping:'preserve',roofShape:appearanceRoof?.kind||'retained',roofPeak:appearanceRoof?.peak??recipe.height,dormer:recipe.details?.appearanceDormers?.some((d:any)=>d.assembly==='roof-box')?'roof-box':recipe.details?.appearanceDormers?.length===2?'paired':recipe.details?.appearanceDormers?.length?'central':'none',cornice:front.components?.find((p:any)=>p.id==='roof-cornice')?.profile||'none',rows:rowCount,bays,groundTop,eaves,bayLayout:row?.bayLayout||inferredBayLayout,widthRatio:row?.widthFractions?row.widthFractions.reduce((a:number,b:number)=>a+b,0):row?.widthFraction?row.widthFraction*bays:row?.width?row.width/front.width*bays:.67,
   heightRatio:row?.heightFraction??(row?.height?row.height/span:.67),wallColour:recipe.materials.wallColour,
   groundColour:front.storefront.finishColour,form:front.profileLayout?.preset||front.profileLayout?.family||'native',
   groundPattern:front.openingPatterns?.find((p:any)=>p.preset!=='attic-lights'&&p.preset!=='warehouse-stack'&&(p.storey||'ground')==='ground')?.preset||'custom',atticWindow:(front.openingRows||[]).some((r:any)=>r.storey==='attic'||r.storeys?.includes('attic'))||(front.openings||[]).some((o:any)=>o.storey==='attic')||(front.openingPatterns||[]).some((p:any)=>p.preset==='attic-lights'||p.preset==='warehouse-stack'&&p.storeys.includes('attic')),atticLayout:front.openingPatterns?.find((p:any)=>p.preset==='attic-lights')?.layout||'single',priority:e.manualDetailPriority||'automatic',notes:e.photoPassNotes||'',windowDivision:windowDivision(row?.template?.mullions),head:row?.template?.head||'rectangular',balconyLayout:front.componentPatterns?.find((p:any)=>p.preset==='balcony-stack')?.layout||'none'};
  const selected=front.sourceWallSelection?.surfaceIndices||[];
  quickContexts[e.id]={settings,context:{id:e.id,width:front.width,eaves,peak:recipe.height,primaryTop:Math.max(...front.profile.map((p:any)=>p[1])),
   ownedTop:Math.max(...selected.flatMap((i:number)=>recipe.sourceShell.surfaces[i].rings.flat().map((p:any)=>p[2]))),
   front,storeys,rowCount,geometryRevision:recipe.geometryRevision,appearanceRoof,details:recipe.details,provenance:{status:'inferred',sourcePath:e.photos.full.path,sourceHash:e.photos.full.sha256,captureDate:e.photos.full.captureDate,basis:'Quick photo authoring; library forms and dimensions inferred.'}}};
  const controls=(recipe.frontages.length>1||recipe.frontages.some((f:any)=>f.openingPatterns?.some((p:any)=>'startFraction' in p||'endFraction' in p))||(front.openingRows||[]).filter((r:any)=>(r.storey||r.storeys?.[0]||'').startsWith('upper_')).length>1)?`<p>Independent frontage or floor layouts: use the Recipe JSON to edit each part. Uniform controls are unavailable for this draft.</p>`:`<details><summary>Quick recipe choices</summary><form data-owner="${e.id}"><div class="choices">${number('rows','Upper rows',rowCount,1,7,'1')}${select('openingAssembly','Opening assembly',settings.openingAssembly,['residential','warehouse-single','warehouse-paired'])}${select('shutterTreatment','Warehouse shutters',settings.shutterTreatment,['preserve','none','pale-folded','dark-folded'])}${select('doorStyle','Residential door leaf',settings.doorStyle,['preserve','glazed','plain','panelled'])}${number('bays','Bays',bays,1,7,'1')}${select('bayLayout','Bay spacing',settings.bayLayout,[...(settings.bayLayout==='custom'?['custom']:[]),'even','wide-centre','wide-left','wide-right'])}${number('groundTop','Ground height (m)',groundTop,.5,eaves-.5,'.05')}${number('eaves','Facade eaves (m)',eaves,groundTop+.5,40,'.05')}${select('roofShape','Roof massing',settings.roofShape,['retained','flat','behind-gable','behind-parapet','mansard','flat-with-dormers'])}${number('roofPeak','Appearance peak (m)',settings.roofPeak,.5,40,'.05')}${select('dormer','Roof dormer',settings.dormer,['none','central','paired','roof-box'])}${select('cornice','Roof cornice',settings.cornice,['none','flat','stepped'])}${select('coping','Gable coping',settings.coping,['preserve','none','pale','dark'])}${number('widthRatio','Window width within bay',settings.widthRatio,.2,.9,'.01')}${number('heightRatio','Window height per floor',settings.heightRatio,.2,.9,'.01')}${select('windowDivision','Window divisions',settings.windowDivision,[...(settings.windowDivision==='custom'?['custom']:[]),'automatic',...Object.keys(WINDOW_DIVISIONS)])}${select('head','Window head',settings.head,['rectangular','segmental','rounded'])}${select('form','Front form',settings.form,['native','straight','triangular','stepped','spout','neck','bell','gambrel','paired-triangular','paired-neck','paired-bell','central-tower'])}${select('groundPattern','Ground layout',settings.groundPattern,[...(settings.groundPattern==='custom'?['custom']:[]),'shop','left-entry','right-entry','center-entry','two-entries','double-entry-display','display-double-entry','three-entries','four-doors','garage-right-entry'])}${select('atticLayout','Attic lights',settings.atticLayout,['single','wide','stacked'])}${select('balconyLayout','Balcony layout',settings.balconyLayout,['none','center-stack','left-stack','right-stack','wide-stack'])}${select('priority','Detail attention',settings.priority,['automatic','ordinary','extra'])}<label>Wall colour<input name="wallColour" type="color" value="${settings.wallColour}"></label><label>Ground colour<input name="groundColour" type="color" value="${settings.groundColour}"></label><label><input name="atticWindow" type="checkbox"${settings.atticWindow?' checked':''}> Attic light</label></div><label>Photo notes<input name="notes" value="${esc(settings.notes)}"></label><button type="submit">Queue recipe edit</button><p class="edit-message" aria-live="polite"></p></form></details>`;
  const column=n%5,gridRow=Math.floor(n/5),x=column*400,y=gridRow*800;
  const status=e.status==='photo-pass-draft'?'layout edited · fidelity pending':'starter · photo pass pending';
  const label=Buffer.from(`<svg width="400" height="64"><rect width="400" height="64" fill="#eee"/><text x="8" y="22" font-family="Arial" font-size="14">${esc(e.address.slice(0,48))}</text><text x="8" y="45" font-family="Arial" font-size="12">${e.ownerId} · ${e.detailPriority.tier} · ${status}</text></svg>`);
  cells.push({input:label,left:x,top:y});
  const rendered=root+'/preview/projections/'+e.id+'-front-detail.png';
  const source=path.resolve(displayPhoto.path);
  const photo=await sharp(source).resize({width:195,height:680,fit:'contain',background:'#eee'}).png().toBuffer();
  cells.push({input:photo,left:x,top:y+64});
  if(currentPreview(e))cells.push({input:await sharp(rendered).resize({width:195,height:680,fit:'contain',background:'#eee'}).png().toBuffer(),left:x+200,top:y+64});
  const photoData='data:image/jpeg;base64,'+(await sharp(source).resize({height:700,withoutEnlargement:true}).jpeg({quality:84}).toBuffer()).toString('base64');
  const evidenceViews=(await Promise.all((wider?['full','roof','ground']:['roof','ground']).map(async tier=>{
   const capture=e.photos[tier];
   const data='data:image/jpeg;base64,'+(await sharp(path.resolve(capture.path)).resize({height:600,withoutEnlargement:true}).jpeg({quality:80}).toBuffer()).toString('base64');
   return `<figure><figcaption>${esc(tier)} · ${esc(capture.captureDate)}</figcaption><img loading="lazy" src="${data}" alt="${esc(tier)} evidence crop"/></figure>`;
  }))).join('');
  const renderSrc=currentPreview(e)?'data:image/png;base64,'+fs.readFileSync(rendered).toString('base64'):'';
  cards+=`<article data-stage="${e.reviewHold?'held':e.status==='photo-pass-draft'?'edited':'starter'}"><h2>${esc(e.address)}</h2><p>${esc(e.ownerId)} · ${status} · ${e.detailPriority.tier}${e.reviewHold?' · evidence hold':''}${matched.length?' · '+esc(matched.map((p:any)=>p.name).join(', ')):''}</p>${coverageNote?`<p><b>Coverage check:</b> ${esc(coverageNote)}</p>`:''}<div class="pair"><img loading="lazy" src="${photoData}" alt="Dated facade photo"/>${renderSrc?`<img loading="lazy" src="${renderSrc}" alt="Generated recipe preview"/>`:'<p>Build failed or stale; inspect build-report.json</p>'}</div><details><summary>Roof and ground photo evidence</summary><div class="evidence-pair">${evidenceViews}</div></details><p><a href="../${esc(e.recipe)}">Recipe JSON</a>${renderSrc?` · <a href="../build/${e.id}/assets/${e.id}.glb">GLB</a>`:''} · ${esc(displayPhoto.captureDate)}</p>${e.reviewHold?`<p><b>Evidence hold:</b> ${esc(e.reviewHold)}</p>`:''}<p>${esc(e.photoPassNotes||'Quick photo pass pending.')}</p>${repairEvidence}${recipeWarnings.get(e.id)?.length?`<details><summary>Recipe checks to revisit</summary><ul>${recipeWarnings.get(e.id)!.map((w:any)=>`<li>${esc(w.reason)}</li>`).join('')}</ul></details>`:''}${controls}</article>`;
 }
 await sharp({create:{width:2000,height:1600,channels:3,background:'#eee'}}).composite(cells).png().toFile(review+'/photo-model-'+String(++sheets).padStart(2,'0')+'.png');
}
fs.writeFileSync(root+'/facade-coverage-report.json',JSON.stringify(coverageReports,null,2)+'\n');
fs.writeFileSync(root+'/batch.json',JSON.stringify(batch,null,2)+'\n');
const held=batch.entries.filter((e:any)=>e.reviewHold).length;
const built=batch.entries.filter(currentPreview).length,edited=batch.entries.filter((e:any)=>e.status==='photo-pass-draft').length;
const bundle=await(await import('esbuild')).build({entryPoints:['scripts/buildingBatchQuickEditor.ts'],bundle:true,write:false,format:'iife',minify:true,target:'es2020'});
const editorScript=bundle.outputFiles[0].text.replaceAll('</script','<\\/script'),contextJson=JSON.stringify(quickContexts).replaceAll('<','\\u003c');
fs.writeFileSync(review+'/quick-contexts.json',JSON.stringify(quickContexts,null,2)+'\n');
fs.writeFileSync(review+'/index.html',`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Building recipe progress</title><style>body{font:16px system-ui;background:#eee;padding:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:20px}article{background:white;padding:16px}h2{font-size:20px}.pair{display:flex;height:500px}.pair img{width:50%;object-fit:contain}p{color:#444}input{padding:12px;width:min(450px,90%);font:inherit;margin:12px 0}</style><h1>Building recipe progress</h1><p><b>${batch.entries.length} recipes · ${built} generated previews · ${edited} photo edited · ${batch.entries.length-built} failed or stale · ${held} evidence holds</b></p><p>Dated photo on the left; generated recipe on the right. Starters need a quick photo pass. Layout-edited drafts have some corrections; they have not passed full likeness review. Generic starters have inferred colours, windows and entrance positions. The previously reviewed library remains at 45 models.</p><input type="search" id="search" placeholder="Search street, address or owner" aria-label="Search buildings"><label>Show <select id="stage"><option value="all">All drafts</option><option value="edited">Layout edited — fidelity pending</option><option value="starter">Untouched starters</option><option value="held">Held for correction/evidence</option></select></label><main>${cards}</main><script>const filter=()=>{const q=document.querySelector('#search').value.toLowerCase(),stage=document.querySelector('#stage').value;document.querySelectorAll('article').forEach(a=>a.hidden=!a.textContent.toLowerCase().includes(q)||(stage!=='all'&&a.dataset.stage!==stage))};document.querySelector('#search').addEventListener('input',filter);document.querySelector('#stage').addEventListener('change',filter);</script></html>`);
let html=fs.readFileSync(review+'/index.html','utf8');
html=html.replace('</style>','.evidence-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.evidence-pair figure{margin:8px 0}.evidence-pair img{width:100%;height:400px;object-fit:contain}.evidence-pair figcaption{font-size:12px}details{border-top:1px solid #ddd;padding-top:12px}summary{cursor:pointer}.choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}.choices label{font-size:13px}.choices input,.choices select{box-sizing:border-box;width:100%;padding:6px;font:inherit;margin:4px 0}input[type=checkbox]{width:auto}.choices input[type=color]{height:36px}button{padding:10px 14px;font:inherit;cursor:pointer}.edit-toolbar{background:#fff;padding:14px;margin:16px 0}.edit-message{font-size:13px}</style>')
 .replace('<main>',`<div class="edit-toolbar"><button id="download-edits">Download queued recipe edits</button> <span id="edit-queue">No edits queued</span><p>Choose a few corrections, queue them, then download one JSON batch. Previews refresh after applying and rebuilding.</p><details><summary>Apply the downloaded edits</summary><pre>cd ${esc(shellQuote(process.cwd()))} &amp;&amp;
PYTHONPATH=scripts/blender python3 scripts/blender/expansion/batch_pipeline.py run --output ${esc(shellQuote(path.relative(process.cwd(),root)))} --edits ~/Downloads/quick-photo-edits.json --include-starters${esc(publishArgs)}</pre></details></div><main>`)
 .replace('</html>',`<script id="quick-contexts" type="application/json">${contextJson}</script><script>${editorScript}</script></html>`);
fs.writeFileSync(review+'/index.html',html);
if(publishIndex>=0){
 if(!/^[a-z0-9-]+$/.test(pageName))throw Error('Invalid review page name');
 const dataName=pageName+'-data',checkout=path.resolve(process.argv[publishIndex+1]),publicDir=checkout+'/public/canal-drive',link=publicDir+'/'+dataName;
 if(!fs.existsSync(checkout+'/package.json'))throw Error('Publish root must be a repository checkout');
 if(fs.existsSync(link)){if(!fs.lstatSync(link).isSymbolicLink()||fs.realpathSync(link)!==root)throw Error('Unexpected progress data target');}
 else fs.symlinkSync(root,link,'dir');
 const navigation='<nav><a href="building-library-progress.html">40-recipe photo pass</a> · <a href="building-library-scale-100.html">100-owner scale batch</a> · <a href="building-library-scale-200.html">200-owner expansion</a></nav>';
 fs.writeFileSync(publicDir+'/'+pageName+'.html',fs.readFileSync(review+'/index.html','utf8').replaceAll('href="../','href="'+dataName+'/').replace('<h1>',navigation+'<h1>'));
}
console.log(JSON.stringify({owners:batch.entries.length,sheets,extraDetail:batch.entries.filter((e:any)=>e.detailPriority.tier==='extra').length,review:review+'/index.html'}));
