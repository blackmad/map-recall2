import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { reviewEvidenceKey } from './review-dependencies.mjs';
import { loadOrCreateReviewSession } from './review-session-token.mjs';
const exec=promisify(execFile),root=path.resolve(process.env.NEIGHBOURHOOD_ROOT||'.cache/da-costa-neighbourhood');
const publicRoot=path.resolve('public'),port=Number(process.env.NEIGHBOURHOOD_PORT||5195);
const panoramaAuditRoot=path.resolve('.cache/city-appearance/areas/da-costa-tranche-400m-v1/panorama-audit');
const {token}=await loadOrCreateReviewSession(root),file=path.join(root,'reviews.json');
const read=async p=>JSON.parse(await fs.readFile(p));
let history={version:1,events:[]};try{history=await read(file);}catch(e){if(e.code!=='ENOENT')throw e;}
let queue=Promise.resolve();
const json=(res,code,data)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
const save=async()=>{await fs.writeFile(file+'.tmp',JSON.stringify(history,null,2));await fs.rename(file+'.tmp',file);};
const compile=async()=>{if(!process.env.NEIGHBOURHOOD_TEST)await exec(process.execPath,['scripts/da-costa-block/publish-neighbourhood.mjs']);};
async function currentPanoramaAudit(){
  const candidates=[];for(const name of await fs.readdir(panoramaAuditRoot)){
    if(!/^[0-9a-f]{64}$/.test(name))continue;const directory=path.join(panoramaAuditRoot,name);
    try{const [selection,manifest,audit]=await Promise.all([read(path.join(directory,'selection.json')),read(path.join(directory,'evidence/manifest.json')),read(path.join(directory,'agent-visual-audit.json'))]);candidates.push({directory,selection,manifest,audit});}
    catch(e){if(e.code!=='ENOENT')throw e;}
  }
  if(!candidates.length)throw Object.assign(Error('Panorama audit has not been materialized'),{code:'ENOENT'});
  candidates.sort((a,b)=>a.selection.selectionHash.localeCompare(b.selection.selectionHash));return candidates.at(-1);
}
async function currentRoutingResults(directory){
  const root=path.join(directory,'routing-inputs'),candidates=[];
  try{for(const name of await fs.readdir(root)){
    if(!/^[0-9a-f]{64}$/.test(name))continue;
    try{const report=await read(path.join(root,name,'machine-routing/results.json'));candidates.push(report);}catch(e){if(e.code!=='ENOENT')throw e;}
  }}catch(e){if(e.code!=='ENOENT')throw e;}
  candidates.sort((a,b)=>String(a.inputSetHash).localeCompare(String(b.inputSetHash)));
  return candidates.at(-1)??null;
}
async function validate(row,manifest){
  const source=manifest.records.find(r=>r.id===row.id);
  if(!source||source.derivationKey!==row.derivationKey)throw Error('Stale source: reload evidence');
  let aerial;try{aerial=(await read(path.join(root,'aerial.json'))).records.find(a=>a.buildingId===source.buildingId);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(row.evidenceKey!==reviewEvidenceKey(source,aerial))throw Error('Stale review evidence: reload images');
  for(const m of [...Object.values(source.images),...(aerial?[aerial,...(aerial.context?[aerial.context]:[])]:[])]){
    const bytes=await fs.readFile(path.join(root,'images',m.file));
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw Error('Source pixels changed');
  }
  const d=row.decision;
  if(d!==null){
    if(!['accepted','uncertain','rejected','crop-repair'].includes(d.placement)||!manifest.records.some(r=>r.id===d.targetId))throw Error('Invalid placement');
    if(d.placement!=='accepted'&&['shopfront','awning','roofShape','facadeTop','awningKind','awningDeployment'].some(k=>d[k]!==undefined&&d[k]!=='unknown'))throw Error('Unaccepted placement cannot accept appearance');
    for(const k of ['shopfront','awning'])if(!['yes','no','unknown'].includes(d[k]))throw Error('Invalid appearance');
    if(!['flat','flat-with-front-pitch','pitched-gable','hipped','mansard','complex','unknown'].includes(d.roofShape))throw Error('Invalid roof shape');
    if(d.facadeTop!==undefined&&!['unknown','straight','stepped','bell','neck','pointed'].includes(d.facadeTop))throw Error('Invalid facade top');
    if(d.awningKind!==undefined&&!['unknown','fabric','rigid','mixed','none'].includes(d.awningKind))throw Error('Invalid canopy construction');
    if(d.awningDeployment!==undefined&&!['unknown','deployed','retracted','mixed','not-applicable'].includes(d.awningDeployment))throw Error('Invalid fabric deployment');
    if(['rigid','none'].includes(d.awningKind)&&(['deployed','retracted','mixed'].includes(d.awningDeployment)||d.awning==='yes'))throw Error('Rigid-only or absent canopy cannot establish a fabric awning');
    if(d.notes!==undefined&&(typeof d.notes!=='string'||d.notes.length>2000))throw Error('Invalid evidence notes');
  }
  const context=row.reviewContext;
  if(context!==undefined){
    if(context.version!==2||!['blind','assisted'].includes(context.mode)||typeof context.queue!=='string'||context.queue.length>40||!Array.isArray(context.exposures)||context.exposures.length>4)throw Error('Invalid review exposure context');
    if(context.exposures.some(e=>!['styled-preview','machine-text','roof-geometry','prior-answer'].includes(e.kind)||!Number.isFinite(Date.parse(e.at))))throw Error('Invalid review exposure');
    if(context.mode==='blind'&&(context.exposures.length||row.suggestionShown===true)||context.mode==='assisted'&&(!context.exposures.length||row.suggestionShown!==true))throw Error('Contradictory review exposure');
  }
  return {id:source.id,derivationKey:source.derivationKey,evidenceKey:row.evidenceKey,decision:d===null?null:{...d,facadeTop:d.facadeTop??'unknown',awningKind:d.awningKind??'unknown',awningDeployment:d.awningDeployment??'unknown',notes:d.notes??''},...(context?{reviewContext:context}:{})};
}
const server=http.createServer(async(req,res)=>{
  try{
    if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host))return json(res,403,{error:'Local host required'});
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    if(req.method==='GET'&&url.pathname==='/api/city-appearance/status'){
      const result=await exec(process.execPath,['--import','tsx','scripts/city-appearance/publish-demo.ts','--status',`--root=${root}`]);
      return json(res,200,{...JSON.parse(result.stdout),token});
    }
    if(req.method==='POST'&&url.pathname==='/api/city-appearance/refresh'){
      if(req.headers['x-review-token']!==token)return json(res,403,{error:'Open the demo status first'});
      if(process.env.NEIGHBOURHOOD_TEST)return json(res,403,{error:'Live demo publication is disabled in isolated review tests'});
      // Share the review queue so a release cannot race a save/undo/import.
      const operation=queue.then(async()=>{
        const result=await exec(process.execPath,['--import','tsx','scripts/city-appearance/publish-demo.ts',`--root=${root}`],{maxBuffer:4*1024*1024});
        return JSON.parse(result.stdout);
      });queue=operation.catch(()=>{});
      return json(res,200,await operation);
    }
    if(req.method==='GET'&&url.pathname==='/api/neighbourhood'){
      const data=await read(path.join(publicRoot,'data/da-costa-block/neighbourhood.json'));
      const manifest=await read(path.join(root,'manifest.json'));
      let aerial=[];try{aerial=(await read(path.join(root,'aerial.json'))).records;}catch(e){if(e.code!=='ENOENT')throw e;}
      if(process.env.NEIGHBOURHOOD_TEST){
        data.records=data.records.filter(r=>manifest.records.some(m=>m.id===r.id));
      }
      for(const r of data.records){
        const source=manifest.records.find(m=>m.id===r.id);
        r.reviewSourceCurrent=!!source&&source.derivationKey===r.derivationKey&&reviewEvidenceKey(source,aerial.find(a=>a.buildingId===source.buildingId))===r.evidenceKey&&Object.entries(source.images).every(([kind,image])=>r.images[kind]?.file===image.file&&r.images[kind]?.sha256===image.sha256);
        r.review=history.events.filter(e=>e.id===r.id&&e.derivationKey===r.derivationKey&&e.evidenceKey===r.evidenceKey).at(-1)?.decision??null;
      }
      return json(res,200,{...data,events:history.events,token});
    }
    if(req.method==='GET'&&url.pathname==='/api/neighbourhood/export')return json(res,200,history);
    if(req.method==='GET'&&url.pathname==='/api/panorama-audit'){
      const current=await currentPanoramaAudit(),routing=await currentRoutingResults(current.directory),byId=new Map(current.audit.assessments.map(item=>[item.id,item])),proposals=new Map((routing?.results??[]).filter(item=>item.status==='ok').map(item=>[item.id,item.proposal]));
      return json(res,200,{selectionHash:current.selection.selectionHash,summary:current.audit.summary,costForecast:current.audit.costForecast,
        humanReferenceData:current.audit.humanReferenceData,routing:routing?{inputSetHash:routing.inputSetHash,model:routing.model,completed:routing.results.filter(item=>item.status==='ok').length,observedUsd:routing.results.reduce((sum,item)=>sum+(item.usage?.cost??0),0)}:null,
        records:current.manifest.records.map(record=>({id:record.id,address:record.address,street:record.street,wallWidthM:record.wallWidthM,
          images:Object.fromEntries(Object.entries(record.images).map(([kind,image])=>[kind,{file:image.file,date:image.date,panoramaId:image.panoramaId}])),assessment:byId.get(record.id),proposal:proposals.get(record.id)??null}))});
    }
    if(req.method==='POST'&&url.pathname.startsWith('/api/neighbourhood/')){
      if(req.headers['x-review-token']!==token)return json(res,403,{error:'Open the review page first'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>2e6)throw Error('Body too large');}
      const input=JSON.parse(body),manifest=await read(path.join(root,'manifest.json'));
      const operation=queue.then(async()=>{
        const eventId=()=>crypto.randomUUID();
        if(url.pathname==='/api/neighbourhood/review'){
          const row=await validate(input,manifest);
          if(row.decision===null)throw Error('Use undo for a cleared decision');
          history.events.push({...row,eventId:eventId(),at:new Date().toISOString(),origin:'human-review',reviewer:'local-reviewer',suggestionShown:input.suggestionShown===true});
        }else if(url.pathname==='/api/neighbourhood/undo'){
          const row=await validate({...input,decision:null},manifest);
          const prior=[];
          for(const e of history.events.filter(e=>e.id===row.id&&e.derivationKey===row.derivationKey&&e.evidenceKey===row.evidenceKey)){
            if(e.undoOf)prior.pop();else prior.push(e);
          }
          if(!prior.length)throw Error('Nothing to undo');
          history.events.push({...row,decision:prior.at(-2)?.decision??null,eventId:eventId(),at:new Date().toISOString(),origin:'human-review',reviewer:'local-reviewer',undoOf:prior.at(-1).eventId});
        }else if(url.pathname==='/api/neighbourhood/import'){
          if(input.version!==1||!Array.isArray(input.events))throw Error('Invalid review export');
          const rows=[];
          for(const e of input.events){if(e.origin!=='human-review'||typeof e.eventId!=='string'||!e.reviewer||!Number.isFinite(Date.parse(e.at)))throw Error('Only dated human decisions may be imported');const normalized=await validate(e,manifest);rows.push({...e,...normalized});}
          for(const e of rows)if(!history.events.some(p=>p.eventId===e.eventId))history.events.push(e);
          history.events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
        }else throw Error('Unknown action');
        await save();await compile();
      });queue=operation.catch(()=>{});await operation;
      return json(res,200,{events:history.events});
    }
    if(req.method!=='GET')return json(res,405,{error:'GET required'});
    let target;
    if(url.pathname.startsWith('/panorama-audit/evidence/')){
      const name=decodeURIComponent(url.pathname.slice('/panorama-audit/evidence/'.length)),current=await currentPanoramaAudit();
      if(path.basename(name)!==name||!current.manifest.records.some(r=>Object.values(r.images).some(image=>image.file===name)))return json(res,404,{error:'Unknown audit evidence'});
      target=path.join(current.directory,'evidence/images',name);
    }else if(url.pathname.startsWith('/evidence/')){
      const name=decodeURIComponent(url.pathname.slice('/evidence/'.length));
      const manifest=await read(path.join(root,'manifest.json'));
      let aerial=[];try{aerial=(await read(path.join(root,'aerial.json'))).records;}catch(e){if(e.code!=='ENOENT')throw e;}
      if(path.basename(name)!==name||!manifest.records.some(r=>Object.values(r.images).some(m=>m.file===name))&&!aerial.some(r=>r.file===name||r.context?.file===name))return json(res,404,{error:'Unknown evidence'});
      target=path.join(root,'images',name);
    }else{
      const pathname=url.pathname==='/'?'/canal-drive/da-costa-block.html':decodeURIComponent(url.pathname);
      target=path.resolve(publicRoot,'.'+pathname);
      if(!target.startsWith(publicRoot+path.sep))return json(res,403,{error:'Outside public directory'});
    }
    const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.md':'text/plain'};
    const bytes=await fs.readFile(target);
    res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
  }catch(e){if(!res.headersSent)json(res,e.code==='ENOENT'?404:400,{error:e.message});else res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`Demo http://127.0.0.1:${port}/canal-drive/da-costa-block.html?neighbourhood=1\nReview http://127.0.0.1:${port}/canal-drive/neighbourhood-review.html\nExpansion audit http://127.0.0.1:${port}/canal-drive/panorama-audit.html`));
let closing=false;
async function shutdown(){
  if(closing)return;closing=true;
  // Stop accepting new work, then allow in-flight request bodies and all queued
  // saves/publications to finish before the process naturally exits.
  const closed=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  server.closeIdleConnections();
  try{await closed;await queue;console.log('Review service closed after pending work finished.');}
  catch(error){console.error('Review service shutdown failed: '+error.message);process.exitCode=1;}
}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
