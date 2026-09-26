import {roofPlanSvg,roofComponentSummary} from '../da-costa-block/roof-diagram.js';
import {awningEvidenceSummary} from '../da-costa-block/awning-evidence.js';
import {TONIGHT_CALIBRATION,calibrationSourceReady,calibrationQueue} from './review-calibration.js';
import {explainReviewQuestions} from './review-language.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('#filter').add(new Option('Tomorrow · 20 priorities','priority'));
$('#filter').add(new Option('Tonight · 12 calibration cases','calibration'));
$('#filter').add(new Option('Crop repairs','crop-repair'));
$('#filter').add(new Option('Roof evidence gaps','roof-gap'));
const qualityNote=document.createElement('p');qualityNote.id='quality-note';qualityNote.className='hint';$('#note').after(qualityNote);
const calibrationNote=document.createElement('p');calibrationNote.id='calibration-note';calibrationNote.className='hint';calibrationNote.hidden=true;$('#address').after(calibrationNote);
$('#hide-suggestions').checked=true;
$('#hide-suggestions').nextSibling.textContent=' Photo-first blind review (hide model text, geometry and preview)';
$('#awning').previousSibling.textContent='Projecting fabric awning ';
for(const [id,label,options]of [['awningKind','Canopy construction',['unknown','fabric','rigid','mixed','none']],['awningDeployment','Fabric deployment',['unknown','deployed','retracted','mixed','not-applicable']]]){
  const row=document.createElement('label');row.className='task';row.append(label+' ');const select=document.createElement('select');select.id=id;for(const value of options)select.add(new Option(value,value));row.append(select);$('#'+(id==='awningKind'?'awning':'awningKind')).closest('label').after(row);
}
const notesLabel=document.createElement('label');notesLabel.className='task';notesLabel.textContent='Evidence notes ';const notes=document.createElement('textarea');notes.id='review-notes';notes.maxLength=2000;notes.rows=3;notesLabel.append(notes);$('#save').before(notesLabel);
const mapLegend=document.createElement('p');mapLegend.id='map-legend';mapLegend.innerHTML='<span class="wall-key">━ Selected wall</span><span class="camera-key">● Full-photo camera</span><span>▱ Building footprint</span><span>North ↑</span>';$('#map').after(mapLegend);$('#map').setAttribute('role','img');
const repairButton=document.createElement('button');repairButton.id='crop-repair';repairButton.textContent='Right building, bad crop · C';repairButton.title='Confirm the selected building, not the wall crop; queue new evidence without appearance labels.';$('#uncertain').before(repairButton);
$('#roofShape').add(new Option('flat-with-front-pitch','flat-with-front-pitch'));
explainReviewQuestions(document);
let data,records=[],index=0,wallIndex=0,candidates=[],stage='placement',busy=false,ready=false,lastSaved=null,showVersion=0,suggestionShown=false,exposures=[];
const appearanceFields=['shopfront','awning','roofShape','facadeTop','awningKind','awningDeployment'];
const exposureStorageKey='neighbourhood-review-exposure-v2';
let exposureHistory={};try{const saved=JSON.parse(localStorage.getItem(exposureStorageKey)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))exposureHistory=saved;}catch{/* Private browsing may disable persistence; retain in-session exposure. */}
const exposureKey=r=>`${r.id}:${r.evidenceKey}`;
function expose(kind){suggestionShown=true;if(!exposures.some(e=>e.kind===kind))exposures.push({kind,at:new Date().toISOString()});if(current()){exposureHistory[exposureKey(current())]=exposures;try{localStorage.setItem(exposureStorageKey,JSON.stringify(exposureHistory));}catch{/* In-memory history still prevents navigation from resetting exposure. */}}}
function assistance(){
  const hidden=$('#hide-suggestions').checked||!current();
  $('#preview').hidden=hidden;
  if(hidden)$('#preview').removeAttribute('src');
  else{const src=`./da-costa-block.html?neighbourhood=1&embed=1&frontage=${encodeURIComponent(target().id)}&review=${data.events.length}`;if($('#preview').getAttribute('src')!==src)$('#preview').src=src;expose('styled-preview');}
  const comparison=$('.roof-comparison');if(comparison){comparison.hidden=hidden;if(!hidden&&comparison.open)expose('roof-geometry');}
  $('#suggestions').hidden=hidden;
}
const current=()=>records[index],target=()=>candidates[wallIndex];
const roofContextMessage=(r,t)=>r.id===t.id?`Source wall: ${r.address} · ${r.wallWidthM.toFixed(1)} m. This diagram follows the photographed source wall.`:`This roof diagram still belongs to the photographed source wall: ${r.address} (${r.id}), not your selected correction ${t.address} (${t.id}). Do not transfer its roof components to the other wall or building.`;
const status=(s,error=false)=>{$('#status').textContent=s;$('#status').classList.toggle('error',error);};
function controls(){
  const has=!!current();
  document.querySelectorAll('button').forEach(b=>b.disabled=busy);
  for(const id of ['confirm','wall-left','wall-right','uncertain','reject','crop-repair'])$('#'+id).disabled=busy||!has||!ready;
  $('#save').disabled=busy||!has||!ready||stage!=='appearance';
  for(const id of ['skip','previous','next'])$('#'+id).disabled=busy||!has;
  $('#undo').disabled=busy||(!lastSaved&&!current()?.review);
  $('#neighbours').querySelectorAll('button').forEach(b=>b.disabled=busy||!records.some(r=>r.id===b.dataset.id));
  for(const id of ['filter','import','hide-suggestions',...appearanceFields,'review-notes'])$('#'+id).disabled=busy;
}
async function load(){const r=await fetch('/api/neighbourhood');if(!r.ok)throw Error('Start the local neighbourhood review service');data=await r.json();}
function filtered(){const f=$('#filter').value;if(f==='calibration')return calibrationQueue(data.records);const rows=data.records.filter(r=>f==='all'||f==='priority'&&r.priorityRank&&!r.review||f==='crop-repair'&&(r.review?.placement==='crop-repair'||r.visualReview?.appearanceEligible===false)||f==='storefront'&&(r.effectiveProposal?.shopfront==='yes'||r.effectiveProposal?.visibleSignText)||f==='roof'&&r.roofConflict||f==='roof-gap'&&r.roofAssessment?.needsReview&&!r.roofConflict||f==='unreviewed'&&!r.review);return f==='priority'?rows.sort((a,b)=>a.priorityRank-b.priorityRank):rows;}
function map(){const r=current(),t=target(),svg=$('#map');
  // Local map coordinates are east / south; recover the RD origin from this
  // source wall, not whichever unrelated record happens to lead the queue.
  const camera=[r.images.full.pose.x-r.wall.start.x+r.localStart[0],r.wall.start.y+r.localStart[1]-r.images.full.pose.y];
  const footprint=t.mapFootprint,polygons=footprint?.type==='MultiPolygon'?footprint.coordinates:footprint?.type==='Polygon'?[footprint.coordinates]:[];
  const points=[camera,...polygons.flat(2),...candidates.flatMap(c=>[c.localStart,c.localEnd])].filter(p=>p?.length>=2&&p.every(Number.isFinite));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const span=Math.max(12,maxX-minX,maxY-minY),pad=Math.max(3,span*.1),dot=span*.018;
  svg.setAttribute('viewBox',`${minX-pad} ${minY-pad} ${Math.max(1,maxX-minX)+2*pad} ${Math.max(1,maxY-minY)+2*pad}`);
  svg.innerHTML=`<title>North-up placement map: orange selected wall, blue full-photo camera, shaded selected building footprint.</title>`+
    polygons.map(rings=>`<path class="building-outline" d="${rings.map(ring=>ring.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ')+' Z').join(' ')}" fill="#d1d8c8" fill-rule="evenodd" stroke="#576a51" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`).join('')+
    `<line class="camera-sightline" x1="${camera[0]}" y1="${camera[1]}" x2="${t.mid[0]}" y2="${t.mid[1]}" stroke="#315e8c" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>`+
    candidates.map(c=>`<line class="${c.id===t.id?'selected-wall':'nearby-wall'}" x1="${c.localStart[0]}" y1="${c.localStart[1]}" x2="${c.localEnd[0]}" y2="${c.localEnd[1]}" stroke="${c.id===t.id?'#c25a2c':'#859480'}" stroke-width="${c.id===t.id?4:1.3}" vector-effect="non-scaling-stroke"/>`).join('')+
    `<circle class="photo-camera" cx="${camera[0]}" cy="${camera[1]}" r="${dot}" fill="#315e8c" stroke="white" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  $('#note').textContent=`Selected placement: ${t.address} · ${t.wallWidthM.toFixed(1)} m wall. ${r.review?.placement==='crop-repair'?'Building confirmed; crop needs repair (wall and appearance not accepted)':r.review?.placement||'Unreviewed'} · photo evidence is approximate.`;
  $('#quality-note').textContent=!$('#hide-suggestions').checked&&r.visualReview?.appearanceEligible===false?`Automated image review flagged this crop for repair. The building can be correct while this wall crop is wrong. ${r.review?.placement==='accepted'?'Your explicit appearance choices override the machine abstention.':'Appearance is withheld; this is not a human decision.'}`:'These are individual wall crops, not necessarily the whole building. Original opens the source panorama. Use C when the building is right but the crop needs repair.';
  assistance();
  if($('.roof-source-note'))$('.roof-source-note').textContent=roofContextMessage(r,t);
}
async function show(){
  const version=++showVersion,r=current();ready=false;stage='placement';exposures=r&&Array.isArray(exposureHistory[exposureKey(r)])?exposureHistory[exposureKey(r)].filter(e=>['styled-preview','machine-text','roof-geometry','prior-answer'].includes(e.kind)&&Number.isFinite(Date.parse(e.at))).slice(0,4):[];suggestionShown=exposures.length>0;$('#appearance').hidden=true;controls();status('');
  $('#evidence').hidden=!r;$('#map').hidden=!r;$('#map-legend').hidden=!r;$('#preview').hidden=!r;
  if(!r){candidates=[];wallIndex=0;const missing=$('#filter').value==='calibration'?TONIGHT_CALIBRATION.filter(([id])=>!calibrationSourceReady(data.records.find(r=>r.id===id))).length:0;$('#address').textContent=missing?'No currently reviewable calibration cases':'This queue is complete';$('#progress').textContent=`0 remaining · ${data.records.filter(r=>r.review).length} reviewed`;$('#note').textContent='Choose another queue, or undo the last decision.';$('#calibration-note').hidden=!missing;$('#calibration-note').textContent=`${missing} calibration cases are unavailable or have stale source metadata; this is not proof of completed review.`;$('#quality-note').textContent='';$('#map').innerHTML='';$('#preview').removeAttribute('src');$('#neighbours').replaceChildren();return;}
  location.hash=r.id;$('#address').textContent=r.address;
  $('#progress').textContent=`${index+1} / ${records.length} · ${data.records.filter(r=>r.review).length} reviewed`;
  const calibration=$('#filter').value==='calibration',missing=TONIGHT_CALIBRATION.filter(([id])=>!calibrationSourceReady(data.records.find(r=>r.id===id))).length;
  $('#calibration-note').hidden=!calibration;$('#calibration-note').textContent=calibration?`20-minute calibration, not an accuracy benchmark. ${TONIGHT_CALIBRATION.find(([id])=>id===r.id)?.[1]||''}${missing?` ${missing} cases unavailable or missing source metadata; withheld from this queue.`:''}`:'';
  $('#summary').textContent=`${data.stats.effectiveStorefronts??data.stats.storefronts} active storefront suggestions · ${data.stats.roofConflicts} image roof disagreements · ${data.stats.visualReviewed??0} source-image reviews`;
  candidates=data.records.filter(c=>Math.hypot(c.mid[0]-r.mid[0],c.mid[1]-r.mid[1])<24).sort((a,b)=>a.street.localeCompare(b.street)||a.mid[1]-b.mid[1]||a.mid[0]-b.mid[0]);
  wallIndex=Math.max(0,candidates.findIndex(c=>c.id===(r.review?.targetId||r.id)));map();
  const imageReady=[];
  for(const kind of ['full','ground','roof','context']){
    const m=r.images[kind],el=$('#'+kind);el.src='/evidence/'+encodeURIComponent(m.file);imageReady.push(el.decode());
    const caption=$('#'+kind+'-caption');if(caption){
      caption.innerHTML=`${esc(kind==='full'?'wall crop':kind==='roof'?'upper-wall crop':kind)} · ${esc(m.date.slice(0,10))} · ${m.heightInferred?'inferred lens height':'published height'} · <a href="${esc(m.url)}" target="_blank" rel="noopener" aria-haspopup="dialog">Original ⤢</a>`;
      caption.querySelector('a').onclick=e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();zoom(m.url,`Original panorama · ${m.date.slice(0,10)}`);};
    }
  }
  $('.aerial-photo')?.remove();
  $('.roof-comparison')?.remove();
  if(r.images.aerial){
    const figure=document.createElement('figure');figure.className='aerial-photo';
    const photo=new Image();photo.alt='Aerial roof evidence; yellow footprint marks the target';photo.src='/evidence/'+encodeURIComponent(r.images.aerial.context?.file||r.images.aerial.file);photo.onclick=()=>zoom(photo.src);
    const caption=document.createElement('figcaption');caption.textContent=`PDOK ${r.images.aerial.date} · yellow footprint = target. Compare roof surfaces with the street-facing top; neighbouring roofs are outside the outline.${r.images.aerial.coverageComplete===false?' Warning: this aerial source clips part of the target footprint; do not infer unseen roof surfaces.':''}`;
    figure.append(photo,caption);$('.photos').after(figure);imageReady.push(photo.decode());
    if(r.roofPlan){
      const comparison=document.createElement('details'),heading=document.createElement('summary'),diagram=document.createElement('div'),legend=document.createElement('p'),explanation=document.createElement('p'),sourceNote=document.createElement('p');
      comparison.className='roof-comparison';comparison.hidden=$('#hide-suggestions').checked;heading.textContent='Compare simplified roof geometry';
      sourceNote.className='roof-source-note hint';sourceNote.textContent=roofContextMessage(r,target());
      diagram.innerHTML=roofPlanSvg(r.roofPlan,r.roofComponents);
      legend.className='roof-plan-legend';legend.innerHTML='<span class="deck">Blue: reference flat deck</span><span class="flat">Grey: other flat faces</span><span class="front-pitch">Orange: street-linked pitch</span><span class="other-pitch">Violet: other pitch</span><span>Dashed line: source wall · North ↑</span>';
      explanation.className='roof-component-explanation';explanation.textContent=(r.roofAssessment?.summary||'')+'\n\n'+roofComponentSummary(r.roofComponents);
      comparison.append(heading,sourceNote,diagram,legend,explanation);figure.after(comparison);
      comparison.ontoggle=()=>{if(comparison.open&&!comparison.hidden&&current()?.id===r.id)expose('roof-geometry');};
    }
  }
  const neighbours=data.records.filter(c=>c.street===r.street&&c.id!==r.id).sort((a,b)=>Math.hypot(a.mid[0]-r.mid[0],a.mid[1]-r.mid[1])-Math.hypot(b.mid[0]-r.mid[0],b.mid[1]-r.mid[1])).slice(0,4);
  $('#neighbours').innerHTML=neighbours.map(c=>`<button data-id="${esc(c.id)}"><img src="/evidence/${esc(c.images.full.file)}" alt="${esc(c.address)}">${esc(c.address)}</button>`).join('');
  $('#neighbours').querySelectorAll('button').forEach(b=>{b.disabled=!records.some(r=>r.id===b.dataset.id);b.onclick=()=>{if(busy)return;const i=records.findIndex(r=>r.id===b.dataset.id);if(i>=0){index=i;show();}};});
  try{await Promise.all(imageReady);if(showVersion===version){ready=r.reviewSourceCurrent!==false;if(!ready)status('Published evidence is stale relative to the source manifest. Refresh publication before reviewing; no decision saved.',true);controls();}}catch{if(showVersion===version)status('An image failed to load; no decision saved.',true);}
}
function appearance(){if(!current()||!ready||busy)return;stage='appearance';$('#appearance').hidden=false;const r=current(),hidden=$('#hide-suggestions').checked,p=hidden?{}:r.effectiveProposal||{};
  $('#suggestions').hidden=hidden;if(!hidden)expose('machine-text');
  const explanations=[
    r.roofAssessment?.summary||null,
    awningEvidenceSummary(r),
    `Model suggestion: ${p.family||'unknown family'}, ${p.wallColour||'unknown'} wall. Sign reading: ${p.visibleSignText||'none'}. Facade top: ${p.facadeTop||'unknown'}.`,
    `Roof geometry: ${r.roofEvidence.shape}; street photo: ${p.roofShape||'unknown'}; with aerial: ${r.roofAerialProposal?.shape||'not yet inferred'}. Focused roof reviewer: ${r.roofOracleProposal?.roofShape||'not yet inferred'}${r.roofOracleProposal?.evidence?' — '+r.roofOracleProposal.evidence:''}.${r.roofOracleConflict?' Warning: the Gemini roof reviewer disagrees across wall views of this building.':''}`,
    r.roofGptProposal?`GPT roof candidate (${r.roofGptProposal.model}): ${r.roofGptProposal.roofShape}; material: ${r.roofGptProposal.roofMaterial||'unknown'}; facade top: ${r.roofGptProposal.facadeTop||'unknown'}.${r.roofGptProposal.sourceId!==r.id?' Roof evidence comes from another wall of this building.':''}${r.roofGptProposal.evidence?' '+r.roofGptProposal.evidence:''}`:null,
    r.agentReview?.evidence?`Agent image critique (not a human label): ${r.agentReview.evidence}`:null,
    r.visualReview?`Source-image agent review (${r.visualReview.cropQuality} crop): ${r.visualReview.evidence}. Agent-extracted fields: ${Object.keys(r.proposalSources||{}).join(', ')||'none; baseline suggestions retained'}. These are machine proposals, not human labels.`:null,
    r.roofSourceWarning||null,
    'These suggestions are not reviewed facts.',
  ].filter(Boolean).join('\n\n');
  const brief=document.createElement('p');brief.textContent=`Current machine proposal: shopfront ${p.shopfront||'unknown'} · awning ${p.awning||'unknown'} · facade top ${p.facadeTop||'unknown'} · roof ${p.roofShape||'unknown'}.`;
  const details=document.createElement('details'),heading=document.createElement('summary'),body=document.createElement('div');heading.textContent='Sources, alternatives and uncertainty';body.textContent=explanations;details.append(heading,body);$('#suggestions').replaceChildren(brief,details);
  for(const k of appearanceFields)$('#'+k).value=r.review?(r.review[k]||'unknown'):(p[k]||'unknown');
  $('#review-notes').value=r.review?.notes||'';if(r.review)expose('prior-answer');
  status(hidden?`Photo-first review: model text, roof geometry and styled preview are hidden. Unknown is a valid answer.${suggestionShown?' Previous exposure to this evidence is retained; this answer will not be marked blind.':''}`:'Placement selected locally. Assistance exposure is recorded; check the visible choices, then save.');controls();
}
async function post(action,value){
  if(busy)return;const wasReady=ready;busy=true;ready=false;controls();
  try{
    const request=()=>fetch('/api/neighbourhood/'+action,{method:'POST',headers:{'content-type':'application/json','x-review-token':data.token},body:JSON.stringify(value)});
    let response=await request();
    // A service restart rotates the local token. Refresh only that token—not
    // the form/data—then retry this exact draft once through normal validation.
    if(response.status===403){const fresh=await fetch('/api/neighbourhood');if(fresh.ok){const latest=await fresh.json();data.token=latest.token;response=await request();}}
    const result=await response.json();if(!response.ok)throw Error(result.error);await load();status('Saved to disk.');return true;
  }catch(e){status(e.message,true);ready=wasReady;return false;}finally{busy=false;controls();}
}
async function decide(placement){if(!current()||!target()||!ready||busy||placement==='accepted'&&stage!=='appearance')return;const r=current(),d={placement,targetId:target().id},previousIndex=index;for(const k of appearanceFields)d[k]=placement==='accepted'?$('#'+k).value:'unknown';d.notes=placement==='accepted'?$('#review-notes').value.trim():'';
  const reviewContext={version:2,mode:suggestionShown?'assisted':'blind',queue:$('#filter').value,exposures};
  if(await post('review',{id:r.id,derivationKey:r.derivationKey,evidenceKey:r.evidenceKey,decision:d,suggestionShown,reviewContext})){lastSaved={id:r.id,derivationKey:r.derivationKey,evidenceKey:r.evidenceKey};records=filtered();const retained=records.findIndex(c=>c.id===r.id);index=Math.max(0,Math.min(retained<0?previousIndex:retained+1,records.length-1));await show();}
}
function move(n){if(busy||!records.length)return;index=(index+n+records.length)%records.length;show();}
$('#confirm').onclick=appearance;$('#save').onclick=()=>decide('accepted');$('#uncertain').onclick=()=>decide('uncertain');$('#reject').onclick=()=>decide('rejected');$('#skip').onclick=()=>move(1);$('#previous').onclick=()=>move(-1);$('#next').onclick=()=>move(1);
$('#crop-repair').onclick=()=>decide('crop-repair');
for(const [id,d]of [['wall-left',-1],['wall-right',1]])$('#'+id).onclick=()=>{if(busy||!ready||!current()||!candidates.length)return;wallIndex=(wallIndex+d+candidates.length)%candidates.length;stage='placement';$('#appearance').hidden=true;map();controls();};
$('#undo').onclick=async()=>{const r=lastSaved||current();if(r&&await post('undo',{id:r.id,derivationKey:r.derivationKey,evidenceKey:r.evidenceKey})){records=filtered();index=Math.max(0,records.findIndex(c=>c.id===r.id));lastSaved=null;show();}};
$('#export').onclick=async()=>{const r=await fetch('/api/neighbourhood/export');const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='da-costakade-reviews.json';a.click();URL.revokeObjectURL(url);};
$('#import').onchange=async e=>{try{const f=e.target.files[0];if(f&&await post('import',JSON.parse(await f.text()))){records=filtered();index=0;show();}}catch(err){status(err.message,true);}};
$('#filter').onchange=()=>{if(busy)return;records=filtered();index=0;show();};
$('#hide-suggestions').onchange=()=>{if(!current())return;map();if(!busy&&stage==='appearance'){const values=Object.fromEntries(appearanceFields.map(k=>[k,$('#'+k).value])),notes=$('#review-notes').value;appearance();for(const k of appearanceFields)$('#'+k).value=values[k];$('#review-notes').value=notes;}};
function decodeImage(img,url){
  return new Promise((resolve,reject)=>{
    const onLoad=()=>{cleanup();resolve();};
    const onError=(error)=>{cleanup();reject(error);};
    const cleanup=()=>{img.onload=img.onerror=null;};
    img.onload=onLoad;
    img.onerror=onError;
    img.src=url;
  });
}
async function zoom(src,title='Enlarged evidence'){
  const img=$('#zoom-image')||new Image(),dialog=$('#zoom');
  img.id='zoom-image';if(!img.isConnected)$('#zoom-viewport').append(img);
  $('#zoom-title').textContent=title;$('#zoom-status').textContent='Loading image…';
  img.hidden=true;img.alt=title;$('#zoom-viewport').classList.remove('actual-size');
  $('#zoom-size').textContent='Actual size';$('#zoom-size').setAttribute('aria-pressed','false');$('#zoom-size').disabled=true;
  if(img.dataset.objectUrl){URL.revokeObjectURL(img.dataset.objectUrl);img.dataset.objectUrl='';}
  img.hidden=true;
  const setReady=()=>{
    img.hidden=false;
    $('#zoom-status').textContent=`${img.naturalWidth} × ${img.naturalHeight} pixels. Use Actual size and scroll to inspect details.`;
    $('#zoom-size').disabled=false;
  };
  const showError=()=>{$('#zoom-status').textContent='Could not load this image. Close and try again; no review was saved.';};
  const loadNative=()=>decodeImage(img,src);
  const loadBlob=async()=>{
    const response=await fetch(src,{cache:'no-store'});
    if(!response.ok) throw new Error(`Image request failed (${response.status})`);
    const blob=await response.blob();
    if(!blob.size) throw new Error('Empty panorama response');
    const objectUrl=URL.createObjectURL(blob);
    img.dataset.objectUrl=objectUrl;
    await decodeImage(img,objectUrl);
  };
  let loaded=false;
  try{await loadNative();loaded=true;}catch(e){try{$('#zoom-status').textContent='Retrying image load…';await loadBlob();loaded=true;}catch(error){console.error(error);showError();}}
  if(loaded)setReady();
  if(!dialog.open)dialog.showModal();
  $('#zoom-viewport').scrollTo(0,0);
}
for(const k of ['full','ground','roof','context'])$('#'+k).onclick=()=>zoom($('#'+k).src);
$('#zoom-size').onclick=()=>{const actual=$('#zoom-viewport').classList.toggle('actual-size');$('#zoom-size').textContent=actual?'Fit image':'Actual size';$('#zoom-size').setAttribute('aria-pressed',String(actual));};
$('#close').onclick=()=>$('#zoom').close();
document.addEventListener('keydown',e=>{
  if(e.repeat||busy||e.ctrlKey||e.metaKey||e.altKey||$('#zoom').open||e.target.isContentEditable||['INPUT','SELECT','TEXTAREA','BUTTON','A','SUMMARY'].includes(e.target.tagName))return;
  const actions={ArrowLeft:()=>$('#wall-left').click(),ArrowRight:()=>$('#wall-right').click(),Enter:()=>stage==='placement'?appearance():decide('accepted'),' ':()=>{if(current()&&ready)zoom($('#full').src);},s:()=>move(1),c:()=>decide('crop-repair'),u:()=>decide('uncertain'),r:()=>decide('rejected'),z:()=>$('#undo').click()};
  if(actions[e.key]){e.preventDefault();actions[e.key]();}
});
try{await load();const queue=new URLSearchParams(location.search).get('queue');if([...$('#filter').options].some(o=>o.value===queue))$('#filter').value=queue;records=filtered();index=Math.max(0,records.findIndex(r=>r.id===decodeURIComponent(location.hash.slice(1))));await show();window.neighbourhoodReview={state:()=>({id:current()?.id,targetId:target()?.id,stage,ready,busy,index,suggestionShown,exposures})};}catch(e){status(e.message,true);}
