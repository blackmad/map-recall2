/** Score frozen broad-family references and emit a portable local evidence gallery. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateLabel} from '../city-appearance/benchmark-local-materials.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const flag=(args,n)=>args.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function scorePilot(selection,report,crops=null) {
  if(!report.experimentHash || hash(JSON.stringify(report.experiment))!==report.experimentHash)throw Error('Changed experiment');
  const selected=crops?selection.entries.filter(e=>crops.entries.some(c=>c.buildingId===e.buildingId)):selection.entries;
  const receipts=new Map();
  for(const r of report.receipts){if(receipts.has(r.buildingId))throw Error('Duplicate receipt owner');receipts.set(r.buildingId,r);}
  const rows=selected.map(e=>{
    const r=receipts.get(e.buildingId),source=crops?.entries.find(c=>c.buildingId===e.buildingId)??e;
    if(r&&(r.sourceSha256!==source.sourceSha256 || r.elevationId!==e.observationId))throw Error('Receipt source mismatch');
    const valid=r?.status==='ok'&&r.schema?.valid===true&&validateLabel(r.label).valid;
    const prediction=valid?r.label:null,known=!e.reference.requiresAbstention;
    return {index:e.index,buildingId:e.buildingId,split:e.split,reference:e.reference,
      status:!r?'missing':!valid?'invalid-or-error':prediction.abstain?'abstain':'predicted',prediction,
      materialCorrect:known&&prediction&&!prediction.abstain?prediction.materialFamily===e.reference.materialFamily:false,
      colourCompatible:known&&prediction&&!prediction.abstain?e.reference.colourFamilies.includes(prediction.colourFamily):false,
      answersOnUnresolvedReferences:!known&&!!prediction&&!prediction.abstain};
  });
  const summarize=items=>{
    const known=items.filter(e=>!e.reference.requiresAbstention),answered=known.filter(e=>e.status==='predicted');
    const correct=answered.filter(e=>e.materialCorrect).length,unknown=items.length-known.length;
    const precision=answered.length?correct/answered.length:null,coverage=known.length?answered.length/known.length:null;
    const answersOnUnresolvedReferences=items.filter(e=>e.answersOnUnresolvedReferences).length;
    const missingOrInvalid=items.filter(e=>['missing','invalid-or-error'].includes(e.status)).length;
    const perMaterial=Object.fromEntries([...new Set(known.map(e=>e.reference.materialFamily))].sort().map(material=>{const subset=known.filter(e=>e.reference.materialFamily===material);return [material,{total:subset.length,correct:subset.filter(e=>e.materialCorrect).length}];}));
    return {total:items.length,known:known.length,unknown,answeredKnown:answered.length,correctMaterial:correct,
      alwaysBrickBaselineCorrect:known.filter(e=>e.reference.materialFamily==='brick').length,perMaterial,
      materialAgreement:precision,knownCoverage:coverage,colourCompatible:answered.filter(e=>e.colourCompatible).length,
      answersOnUnresolvedReferences,abstentions:items.filter(e=>e.status==='abstain').length,missingOrInvalid,
      gate:precision!==null&&precision>=selection.acceptance.materialAgreementOnKnown&&coverage>=selection.acceptance.minimumKnownCoverage&&
        unknown>0&&answersOnUnresolvedReferences<=selection.acceptance.falseAcceptOnUnknown&&!missingOrInvalid?'pass-diagnostic-only':'fail'};
  };
  return {experimentHash:report.experimentHash,model:report.experiment.model,modelDigest:report.experiment.modelDigest,
    rows,summary:summarize(rows),development:summarize(rows.filter(e=>e.split==='development')),evaluation:summarize(rows.filter(e=>e.split==='evaluation'))};
}
export async function evaluate(args=process.argv.slice(2)) {
  const root=flag(args,'evidence-root')??'../amsterdam-facade-rebuild';
  const dir='review-data/material-pilot/v1',selectionBytes=await fs.readFile(`${dir}/selection.json`),selection=JSON.parse(selectionBytes);
  const crops=JSON.parse(await fs.readFile(`${dir}/target-crops.json`,'utf8'));
  if(crops.selectionSha256!==hash(selectionBytes))throw Error('Stale crop manifest');
  const reports={};
  const cropBytes=await fs.readFile(`${dir}/target-crops.json`);
  await fs.mkdir(`${dir}/benchmarks`,{recursive:true});
  for(const kind of ['full','target']){
    const bytes=await fs.readFile(`.cache/material-pilot/${kind}/report.json`);
    const report=JSON.parse(bytes),expectedSourceHash=kind==='full'?hash(selectionBytes):hash(cropBytes);
    if(report.receipts.some(r=>r.sourceManifestSha256!==expectedSourceHash))throw Error('Changed benchmark selection');
    await fs.writeFile(`${dir}/benchmarks/${kind}.json`,bytes);
    reports[kind]={reportSha256:hash(bytes),...scorePilot(selection,report,kind==='target'?crops:null)};
  }
  const comparisons=crops.entries.map(c=>({index:c.index,
    full:reports.full.rows.find(e=>e.index===c.index),target:reports.target.rows.find(e=>e.index===c.index)}));
  const paired={known:comparisons.filter(c=>!c.full.reference.requiresAbstention).length,
    fullMaterialCorrect:comparisons.filter(c=>c.full.materialCorrect).length,targetMaterialCorrect:comparisons.filter(c=>c.target.materialCorrect).length,
    fullColourCompatible:comparisons.filter(c=>c.full.colourCompatible).length,targetColourCompatible:comparisons.filter(c=>c.target.colourCompatible).length};
  const result={version:1,selectionSha256:hash(selectionBytes),scope:'Agreement with frozen model-reviewed material references, not physical accuracy or game acceptance',
    cost:{paidApiUsd:0,paidCalls:0,authorizedApiCeilingUsd:25,localCompute:'not monetized'},
    decision:'Do not train or expand publication: reference/identity/renderer gates remain incomplete.',
    interpretation:'Answers on unresolved references are disagreements with a review policy, not proven model mistakes. Unknown labels need native-source adjudication.',
    hostedTeacher:{status:'not-run',reason:'OPENROUTER_API_KEY unavailable in environment and root dotenv files; existing model reviews used only as diagnostic references'},
    reports,paired,comparisons};
  await fs.writeFile(`${dir}/results.json`,JSON.stringify(result,null,2)+'\n');
  const gallery='.cache/material-pilot/gallery';await fs.mkdir(gallery,{recursive:true});
  const renderer=JSON.parse(await fs.readFile(`${root}/public/data/wall-materials/report.json`,'utf8'));
  const image=async (file,expected)=>{const bytes=await fs.readFile(file);if(hash(bytes)!==expected)throw Error(`Changed evidence ${file}`);const name=expected+path.extname(file);await fs.writeFile(`${gallery}/${name}`,bytes);return name;};
  const audit=JSON.parse(await fs.readFile(`${dir}/visual-audit.json`,'utf8'));
  if(audit.selectionSha256!==hash(selectionBytes))throw Error('Stale visual audit');
  let cards='';const diagnostics=[];
  for(const row of selection.entries){
    const source=await image(`public${row.crop}`,row.sourceSha256),crop=crops.entries.find(e=>e.index===row.index);
    const receipt=reports.full.rows.find(e=>e.index===row.index);let visuals=`<figure><img src="${source}"><figcaption>Source ${row.index}</figcaption></figure>`;
    if(crop){const name=await image(`public${crop.crop}`,crop.sourceSha256);visuals+=`<figure><img src="${name}"><figcaption>Selected upper-wall input</figcaption></figure>`;}
    const old=renderer.cases.find(e=>e.index===row.index);
    if(old){const manifestFile=`${root}/.cache/wall-material-demo/${old.run}/captures.json`,manifestBytes=await fs.readFile(manifestFile);
      if(hash(manifestBytes)!==old.captureManifestSha256)throw Error('Changed historical capture manifest');
      const manifest=JSON.parse(manifestBytes),capture=manifest.results.find(c=>c.index===row.index);
      if(capture.buildingId!==row.buildingId||capture.sourceSha256!==row.sourceSha256)throw Error('Historical owner mismatch');
      const focus=old.focused;
      if(focus.normalSha256!==capture.captures['preview-front'].sha256||focus.identitySha256!==capture.captures.identity.sha256)throw Error('Historical focus mismatch');
      const name=await image(`${root}/.cache/wall-material-demo/${old.run}/${focus.focusedFile}`,focus.focusedSha256);
      const oblique=capture.captures['preview-oblique'];const obliqueName=await image(`${root}/.cache/wall-material-demo/${old.run}/${oblique.file}`,oblique.sha256);
      visuals+=`<figure><img src="${name}"><figcaption>Historical front ${escape(old.run)}: ${escape(old.verdict)}</figcaption></figure><figure><img src="${obliqueName}"><figcaption>Historical oblique; contextual view</figcaption></figure>`;
      diagnostics.push({index:row.index,buildingId:row.buildingId,sourceSha256:row.sourceSha256,run:old.run,verdict:old.verdict,
        captureManifestSha256:hash(manifestBytes),focusedSha256:focus.focusedSha256,obliqueSha256:oblique.sha256,
        exactColourAccepted:false,newRenderAcceptance:false});
    }
    cards+=`<article><h2>${row.index}. ${escape(row.address)} — ${row.split}</h2><div class="images">${visuals}</div><p>Reference: ${escape(row.reference.materialFamily)}; colour bins: ${escape(row.reference.colourFamilies.join('/'))}. Local full-image prediction: ${escape(JSON.stringify(receipt.prediction))}.</p>${crop?`<p>Target crop prediction: ${escape(JSON.stringify(reports.target.rows.find(e=>e.index===row.index).prediction))}</p>`:''}<p>${escape(row.reference.correction??'')}</p><p>${escape(audit.gateCases.find(e=>e.index===row.index)?.finding??'')}</p></article>`;
  }
  await fs.writeFile(`${dir}/render-evidence.json`,JSON.stringify({version:1,scope:'Rechecked saved capture hashes; historical evidence, no new render acceptance',entries:diagnostics},null,2)+'\n');
  await fs.writeFile(`${gallery}/index.html`,`<!doctype html><meta charset="utf-8"><title>Facade material pilot</title><style>body{font:16px system-ui;margin:24px;background:#f4f1eb;color:#232523}article{background:white;padding:20px;margin:20px 0;border-radius:8px}.images{display:flex;gap:12px;flex-wrap:wrap}figure{margin:0;flex:1;min-width:160px;max-width:350px}img{height:340px;width:100%;object-fit:contain;background:#eee}figcaption{font-size:13px}pre{white-space:pre-wrap}table{border-collapse:collapse;background:white;width:100%;margin:20px 0}td,th{padding:10px;text-align:left;border-bottom:1px solid #ddd}details{margin:12px 0}</style><h1>Facade material pilot</h1><p>60 source-bound cases; $0 paid inference. Reference labels are model reviews. Selected target crops are development-only interventions. Historical game images are explicitly dated by run; this is not a new game release.</p><p>${escape(result.decision)}</p><p>${escape(audit.conclusion)}</p><p>Held-out distribution: 16 brick, 1 render, 3 unresolved. Always predicting brick also matches 16/17 known labels. Do not treat the 94% aggregate as evidence of general material competence. All 13 answers on unresolved references need adjudication; these are not 13 proven model errors.</p><table><tr><th>Comparison</th><th>Material agreement</th><th>Colour compatibility</th></tr><tr><td>60 full images (47 known references)</td><td>${reports.full.summary.correctMaterial} / ${reports.full.summary.known}</td><td>${reports.full.summary.colourCompatible} / ${reports.full.summary.known}</td></tr><tr><td>Evaluation street (17 known references)</td><td>${reports.full.evaluation.correctMaterial} / ${reports.full.evaluation.known}; always-brick baseline ${reports.full.evaluation.alwaysBrickBaselineCorrect} / ${reports.full.evaluation.known}</td><td>${reports.full.evaluation.colourCompatible} / ${reports.full.evaluation.known}</td></tr><tr><td>Ten development cases: full images</td><td>${paired.fullMaterialCorrect} / ${paired.known}</td><td>${paired.fullColourCompatible} / ${paired.known}</td></tr><tr><td>Same cases: selected upper-wall crops</td><td>${paired.targetMaterialCorrect} / ${paired.known}</td><td>${paired.targetColourCompatible} / ${paired.known}</td></tr></table><details><summary>Full diagnostic counts</summary><pre>${escape(JSON.stringify({full:reports.full.summary,evaluation:reports.full.evaluation,target:reports.target.summary,paired},null,2))}</pre></details>${cards}`);
  return {full:reports.full.summary,evaluation:reports.full.evaluation,target:reports.target.summary,paired,gallery:`${gallery}/index.html`};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(await evaluate(),null,2));
