/** Separate, candidate-bound second-pass feedback; original notes are untouched. */
export async function mountPreviewNotes(bytes:ArrayBuffer){
 const digest=await crypto.subtle.digest('SHA-256',bytes),id=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 const url=`/api/facade-repair/notes/${id}`,response=await fetch(url),initial=await response.json();if(!response.ok)throw Error(initial.error);
 const history=document.createElement('div');history.id='repair-note-history';history.style.whiteSpace='pre-wrap';document.querySelector('#repair-feedback')!.append(history);
 let state=initial,current='',timer:ReturnType<typeof setTimeout>|undefined,queue=Promise.resolve(),failed=false;
 const box=document.querySelector<HTMLTextAreaElement>('#repair-note')!,status=document.querySelector<HTMLSelectElement>('#repair-note-status')!,message=document.querySelector('#repair-note-message')!,label=document.querySelector('#repair-note-label')!;
 const drafts=new Map<string,any>();const key=(caseId:string)=>`repair-note:${id}:${caseId}`;
 const info=(text:string)=>{message.textContent=text;};
 const draft=(caseId:string)=>{if(drafts.has(caseId))return drafts.get(caseId);let local;try{local=JSON.parse(localStorage.getItem(key(caseId))??'null');}catch{}const value=local??{text:state.notes[caseId]?.text??'',status:state.notes[caseId]?.status??'unreviewed',expectedRevision:state.notes[caseId]?.revision??0};drafts.set(caseId,value);return value;};
 const save=(caseId:string)=>{if(!caseId)return queue;const value={...draft(caseId)};queue=queue.then(async()=>{if(failed)return;const prior=state.notes[caseId];if(value.text===(prior?.text??'')&&value.status===(prior?.status??'unreviewed'))return;try{
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-review-token':initial.token},body:JSON.stringify({packetSha256:id,caseId,...value,expectedRevision:draft(caseId).expectedRevision,issues:[]})}),result=await r.json();if(!r.ok)throw Error(result.error);state=result;
  const latest=draft(caseId);latest.expectedRevision=state.notes[caseId].revision;
  if(latest.text===value.text&&latest.status===value.status)localStorage.removeItem(key(caseId));else localStorage.setItem(key(caseId),JSON.stringify(latest));
  if(current===caseId)info('Saved to project');
 }catch(e){failed=true;info(`${String(e)} Your draft is kept in this browser.`);}});return queue;};
 const changed=()=>{const d=draft(current);d.text=box.value;d.status=status.value;localStorage.setItem(key(current),JSON.stringify(d));info('Unsaved draft…');clearTimeout(timer);const caseId=current;timer=setTimeout(()=>save(caseId),650);};
 box.addEventListener('input',changed);status.addEventListener('change',changed);
 document.querySelector('#repair-note-save')!.addEventListener('click',()=>{clearTimeout(timer);save(current);});
 document.querySelector('#repair-notes-ready')!.addEventListener('click',async()=>{clearTimeout(timer);await save(current);if(failed)return;const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-review-token':initial.token},body:JSON.stringify({packetSha256:id,action:'ready'})});const result=await r.json();info(r.ok?'Ready for the next repair pass.':result.error);});
 box.disabled=false;status.disabled=false;
 return {show(caseId:string){if(current===caseId)return;clearTimeout(timer);save(current);current=caseId;const d=draft(caseId);label.textContent=`Notes on this repair — ${caseId}`;history.textContent=(initial.previousReviews??[]).flatMap((r:any)=>r.notes[caseId]?[`Previous preview feedback (${r.notes[caseId].status}): ${r.notes[caseId].text||'No written note'}`]:[]).join('\n');box.value=d.text;status.value=d.status;info(localStorage.getItem(key(caseId))?'Restored unsaved draft':state.notes[caseId]?'Saved to project':'New feedback; your original note is preserved above.');}};
}
