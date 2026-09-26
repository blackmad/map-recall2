const labels={doors:'Doors',windows:'Windows',curves:'Curves',awnings:'Awnings',materials:'Colours / brickwork','ground-contact':'Ground contact',signs:'Shops / signs'};
const issueKinds=Object.entries(labels);
const isTypingTarget=()=>{const a=document.activeElement;return!!a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT'||(a instanceof HTMLElement&&a.isContentEditable));};

function create(elName,props={}){const el=document.createElement(elName);Object.entries(props).forEach(([k,v])=>{if(v==null)return;k==='text'?(el.textContent=v):el.setAttribute(k,`${v}`);});return el;}
function safeParseJson(raw){if(!raw) return null;try{return JSON.parse(raw);}catch{return null;}}

export async function mountReviewNotes(releaseId){
 const api=`/api/district-evaluation/notes/${releaseId}`;
 const bar=document.getElementById('review-toolbar');
 const summary=document.getElementById('review-summary');
 const ready=document.getElementById('review-ready');
 const download=document.getElementById('review-download');
 const filter=document.getElementById('review-filter');
 if(!bar||!summary||!ready||!download||!filter) return {state:null,token:'',forms:[],caseIndex:0,sourceView:'ground',cameraPreset:'ground',toolbar:bar};

 const key=(form,sha)=>`district-note:${releaseId}:${sha}:${form.caseId}`;
 let state=null,token='';
 let caseIndex=0;
 let sourceView='ground';
 let cameraPreset='ground';
 let forms=[];
 let streamVersion=0;

 async function request(body){
  const headers=body?{'content-type':'application/json','x-review-token':token}:{};
  const response=await fetch(api,{method:body?'POST':'GET',cache:'no-store',headers,body:body?JSON.stringify(body):undefined});
  const value=await response.json().catch(()=>({error:'non-json body'}));
  if(!response.ok) throw new Error(value.error||`Request failed (${response.status})`);
  return value;
 }

 try{
  state=await request();
  token=state.token;
 }catch(error){
  summary.textContent=`Notes unavailable: ${error.message}. Reload once the local server is running.`;
  ready.disabled=true;
  download.disabled=true;
  return {state:{},token:'',forms:[],caseIndex:0,sourceView,cameraPreset,toolbar:bar};
 }

 bar.hidden=false;
 const toolbar=bar;

 const progress=create('span',{id:'review-progress','aria-live':'polite'});
 const spacer=create('span');
 const nav=create('span');
 const prev=create('button',{type:'button',id:'review-prev',text:'← previous (J)'});
 const next=create('button',{type:'button',id:'review-next',text:'next (K) →'});
 const focus=create('button',{type:'button',id:'review-focus-notes',text:'focus notes (N)'});
 const help=create('button',{type:'button',id:'review-help',text:'shortcuts (?)'});
 nav.append(prev,next,focus,help);

 const source=document.createElement('span');
 const camera=document.createElement('span');
 const sourceTitle=create('span',{text:'Source:'});
 const cameraTitle=create('span',{text:'Camera:'});
 function mkToggle(container,label,id,value,group,active){
  const btn=create('button',{type:'button',id,text:label});
  btn.id=id;
  btn.dataset.toggleFor=group;
  btn.dataset.value=value;
  btn.setAttribute('aria-pressed',active===value?'true':'false');
  container.append(btn);
 }
 mkToggle(source,'ground','review-source-ground','ground','source-view',sourceView);
 mkToggle(source,'full','review-source-full','full','source-view',sourceView);
 mkToggle(camera,'ground','review-camera-ground','ground','camera-preset',cameraPreset);
 mkToggle(camera,'front','review-camera-front','front','camera-preset',cameraPreset);
 mkToggle(camera,'oblique','review-camera-oblique','oblique','camera-preset',cameraPreset);

 toolbar.append(progress,spacer,nav,sourceTitle,source,cameraTitle,camera);
 spacer.style.flex='1';

 function setPressed(group,value){
  toolbar.querySelectorAll(`button[data-toggle-for="${group}"]`).forEach((button)=>{
   button.setAttribute('aria-pressed',String(button.dataset.value===value));
  });
 }

 function hasFeedback(form){
  if(form.select.value!=='unreviewed') return true;
  if(form.textarea.value.trim()) return true;
  return form.tags.some(item=>item.checked);
 }

 function visibleForms(){
  if(filter.value==='noted') return forms.filter(hasFeedback);
  if(filter.value==='unreviewed') return forms.filter(f=>!hasFeedback(f));
  return forms;
 }

 function applySourceAndCamera(){
  for(const form of forms){
   const sourceImage=form.article.querySelector('img[data-role="source-image"]');
   if(sourceImage){
    const preferred=sourceView==='ground' ? 'ground' : 'full';
    const target = sourceImage.dataset[`source${preferred[0].toUpperCase()+preferred.slice(1)}`] || sourceImage.src;
    sourceImage.src=target;
   }
   const reviewLinks=form.article.querySelectorAll('a[href*="city-appearance.html"]');
   for(const link of reviewLinks){
    const current=new URL(link.href,location.href);
    current.searchParams.delete('sourceTier');
    current.searchParams.delete('cameraPreset');
    current.searchParams.set('sourceTier',sourceView);
    current.searchParams.set('cameraPreset',cameraPreset);
    link.href=current.href;
   }
  }
 }

 function syncVisibility(){
  const visible=visibleForms();
  const total=forms.length;
  if(total===0){
   summary.textContent='No cases loaded.';
   progress.textContent='';
   return;
  }
  if(!visible.length){
   for(const form of forms) form.article.hidden=true;
   summary.textContent='No matching cases for this filter.';
   progress.textContent=`Filtered ${total} cases.`;
   return;
  }
  caseIndex=Math.max(0,Math.min(caseIndex,visible.length-1));
  const activeForm=visible[caseIndex];
  for(const form of forms) form.article.hidden=form!==activeForm;
  const indexInAll=forms.indexOf(activeForm);
  progress.textContent=`Case ${indexInAll+1} / ${forms.length} · source ${sourceView} · camera ${cameraPreset}`;
  summary.textContent=`${forms.filter(hasFeedback).length}/${forms.length} cases have feedback.`;
  if(formHasDraft(activeForm)) activeForm.status.textContent='Unsaved browser draft restored.';
 }

 function nextCase(){const visible=visibleForms();if(!visible.length)return;caseIndex=(caseIndex+1)%visible.length;syncVisibility();}
 function prevCase(){const visible=visibleForms();if(!visible.length)return;caseIndex=(caseIndex-1+visible.length)%visible.length;syncVisibility();}
 function focusCurrent(){const visible=visibleForms();const target=visible[caseIndex];if(!target)return;target.textarea.focus();target.textarea.setSelectionRange(target.textarea.value.length,target.textarea.value.length);}

 function formHasDraft(form){return form.dirty || form.pendingSave;}
 function makeDraftKey(form){return key(form,state.packetSha256||'unknown');}
 function draftPayload(form){return {caseId:form.caseId,text:form.textarea.value,status:form.select.value,issues:form.tags.filter(item=>item.checked).map(item=>item.value),expectedRevision:form.revision};}

 async function post(form){
  if(form.pendingSave||!form.dirty) return;
  form.pendingSave=true;
  form.status.textContent='Saving…';
  form.save.disabled=true;
  try{
   const next=await request({...draftPayload(form),packetSha256:state.packetSha256});
   state=next;
   form.revision=next.notes[form.caseId]?.revision || form.revision;
   form.dirty=false;
   form.status.textContent='Saved';
   localStorage.removeItem(makeDraftKey(form));
   syncVisibility();
   if(form.autoFlushQueued) {form.autoFlushQueued=false;queueSave(form);}
  }catch(error){
   form.dirty=true;
   form.status.textContent=`Not saved to project: ${error.message}`;
   localStorage.setItem(makeDraftKey(form),JSON.stringify({...draftPayload(form),expectedRevision:form.revision}));
  }finally{
   form.pendingSave=false;
   form.save.disabled=false;
  }
 }

 function queueSave(form){
  if(form.timer){clearTimeout(form.timer);}
  if(!form.dirty) return;
  form.timer=window.setTimeout(()=>{void post(form).catch(()=>{});},700);
 }

 const articles=[...document.querySelectorAll('.case')];
 const stream=++streamVersion;
 for(const article of articles){
  const caseId=article.dataset.caseId;
  if(!caseId) continue;
  const evidence=article.querySelector('.evidence img[data-role="source-image"]');
  if(evidence){
   const sourceGround=article.querySelector('img[data-source-tier="ground"]')?.src||evidence.src;
   const sourceFull=article.querySelector('img[data-source-tier="full"]')?.src||sourceGround;
   evidence.dataset.sourceGround=sourceGround;
   evidence.dataset.sourceFull=sourceFull;
  }
  const saved=state.notes?.[caseId] || {text:'',status:'unreviewed',issues:[],revision:0};
  const draftRaw=localStorage.getItem(makeDraftKey({caseId,revision:saved.revision}));
  const draft=safeParseJson(draftRaw);
  const note=document.createElement('section');
  note.className='review-note';
  const head=document.createElement('div');
  head.className='review-note-head';
  const tag=document.createElement('label');
  const textarea=document.createElement('textarea');
  const footer=document.createElement('div');
  footer.className='review-note-footer';
  tag.htmlFor=`note-${caseId}`;
  tag.textContent='Your notes';
  const select=document.createElement('select');
  select.setAttribute('aria-label',`Review status for ${caseId}`);
  for(const [value,name] of [['unreviewed','Not reviewed'],['needs-work','Needs work'],['looks-good','Looks good']]){
    const option=document.createElement('option');
    option.value=value;option.textContent=name;select.append(option);
  }
  head.append(tag,select);
  textarea.id=`note-${caseId}`;
  textarea.rows=3;
  textarea.maxLength=12000;
  textarea.placeholder='What should change? For example: two doors on the right, arched window tops, pale ground floor…';
  const tags=document.createElement('div');
  tags.className='issue-tags';
  const controls=issueKinds.map(([value,name])=>{
    const label=document.createElement('label');
    const input=document.createElement('input');
    input.type='checkbox';
    input.value=value;
    label.append(input,document.createTextNode(name));
    tags.append(label);
    return input;
  });
  const status=create('span',{class:'note-save-status'});
  const save=document.createElement('button');
  save.type='button';save.textContent='Save note';
  const form={article,caseId,textarea,select,tags:controls,status,save,revision:saved.revision,dirty:false,pendingSave:false,timer:null,autoFlushQueued:false};
  const value=(draft&&draft.expectedRevision===saved.revision)?draft:saved;
  textarea.value=value.text||'';
  select.value=value.status||'unreviewed';
  for(const input of controls) input.checked=(value.issues||[]).includes(input.value);
  status.textContent=draft?draft.expectedRevision!==saved.revision?'Draft restored; check against newer server revision.':'Unsaved draft restored.':'No notes yet.';
  note.append(head,textarea,tags,footer);
  footer.append(status,save);
  article.append(note);

  form.markDirty=()=>{
    form.dirty=true;
    state.readyForFixes=false;
    status.textContent='Unsaved changes…';
    localStorage.setItem(makeDraftKey(form),JSON.stringify({...draftPayload(form),expectedRevision:form.revision}));
    queueSave(form);
    syncVisibility();
  };
  form.flush=async()=>post(form);
  form.payload=()=>draftPayload(form);

  textarea.addEventListener('input',form.markDirty);
  select.addEventListener('change',form.markDirty);
  for(const box of controls) box.addEventListener('change',form.markDirty);
  save.addEventListener('click',()=>{void post(form).catch(()=>{});});
  forms.push(form);
 }

 function bindToggles(){
  toolbar.addEventListener('click',(event)=>{
   const target=event.target instanceof HTMLButtonElement ? event.target : null;
   if(!target||target.disabled) return;
   if(target.id==='review-prev'){prevCase();return;}
   if(target.id==='review-next'){nextCase();return;}
   if(target.id==='review-focus-notes'){focusCurrent();return;}
   if(target.id==='review-help'){summary.textContent='J/K previous-next, 1/2 source-tier, 3/4/5 camera presets, N focus notes, Ctrl/Cmd+Enter save current, ? help.';return;}
   const group=target.dataset.toggleFor;
   if(!group) return;
   const value=target.dataset.value;
   if(group==='source-view'){sourceView=value;setPressed('source-view',value);applySourceAndCamera();}
   if(group==='camera-preset'){cameraPreset=value;setPressed('camera-preset',value);applySourceAndCamera();}
   syncVisibility();
  });
 }

 function onKeydown(event){
  if(isTypingTarget()) return;
  const key=event.key.toLowerCase();
  if(key==='?'){event.preventDefault();summary.textContent='J/K previous-next, N focus notes, 1/2 source tier, 3/4/5 camera preset, Ctrl/Cmd+Enter save.';return;}
  if(key==='j'){event.preventDefault();prevCase();return;}
  if(key==='k'){event.preventDefault();nextCase();return;}
  if(key==='n'){event.preventDefault();focusCurrent();return;}
  if(key==='1'){event.preventDefault();sourceView='ground';setPressed('source-view','ground');applySourceAndCamera();syncVisibility();return;}
  if(key==='2'){event.preventDefault();sourceView='full';setPressed('source-view','full');applySourceAndCamera();syncVisibility();return;}
  if(key==='3'){event.preventDefault();cameraPreset='ground';setPressed('camera-preset','ground');applySourceAndCamera();syncVisibility();return;}
  if(key==='4'){event.preventDefault();cameraPreset='front';setPressed('camera-preset','front');applySourceAndCamera();syncVisibility();return;}
  if(key==='5'){event.preventDefault();cameraPreset='oblique';setPressed('camera-preset','oblique');applySourceAndCamera();syncVisibility();return;}
  if((event.ctrlKey||event.metaKey)&&event.key==='enter'){event.preventDefault();const visible=visibleForms();const current=visible[caseIndex];if(current){void current.flush();}}
 }

 bindToggles();
 document.addEventListener('keydown',onKeydown);
 filter.addEventListener('change',()=>{caseIndex=0;syncVisibility();});

 ready.addEventListener('click',async()=>{
  ready.disabled=true;
  try{
   for(const form of forms) await form.flush();
   state=await request({action:'ready'});
   syncVisibility();
  }catch(error){summary.textContent=`Review is not ready: ${error.message}`;}
  ready.disabled=false;
 });
 download.addEventListener('click',()=>{
  const downloadState={...state,notes:{},drafts:[]};
  const noteMap=downloadState.notes||{};
  for(const form of forms){
    noteMap[form.caseId]=form.payload();
    if(form.dirty) downloadState.drafts.push(form.payload());
  }
  delete downloadState.token;
  const blob=new Blob([JSON.stringify(downloadState,null,2)],{type:'application/json'});
  const href=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=href;
  link.download=`facade-review-${releaseId.slice(0,12)}.json`;
  link.click();
  window.setTimeout(()=>URL.revokeObjectURL(href),1000);
 });

 window.addEventListener('beforeunload',(event)=>{
  if(forms.some(form=>form.dirty||form.pendingSave)){event.preventDefault();event.returnValue='';}
 });

 if(formFilterHasValue()){
   filter.dispatchEvent(new Event('change',{bubbles:true}));
 }
 applySourceAndCamera();
 syncVisibility();
 for(const article of articles) article.hidden=true;
 syncVisibility();

 return {state,token,forms,caseIndex,sourceView,cameraPreset,toolbar};
}

function formFilterHasValue(){const filter=document.getElementById('review-filter');return !!filter?.value;}
