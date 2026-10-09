import {quickEdit,type QuickContext,type QuickSettings} from './buildingBatchQuickEdits';
const data=JSON.parse(document.querySelector('#quick-contexts')!.textContent!) as Record<string,{context:QuickContext;settings:QuickSettings}>;
const pending=new Map<string,any>();const queue=document.querySelector('#edit-queue')!;
const defaults=new Map<string,string>();
for(const control of document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('form[data-owner] [name]')){
 defaults.set(control.closest('form')!.dataset.owner!+'/'+control.name,control instanceof HTMLInputElement&&control.type==='checkbox'?String(control.checked):control.value);
}
for(const form of document.querySelectorAll<HTMLFormElement>('form[data-owner]')){
 const assembly=form.querySelector<HTMLSelectElement>('[name=openingAssembly]');
 const configureAssembly=()=>{
  const warehouse=assembly?.value!=='residential';
  for(const name of ['bays','bayLayout','widthRatio','heightRatio','windowDivision','head','groundPattern','atticLayout','balconyLayout']){
   const control=form.querySelector<HTMLInputElement|HTMLSelectElement>('[name='+name+']');if(control)control.disabled=warehouse;
  }
  const shutters=form.querySelector<HTMLSelectElement>('[name=shutterTreatment]');if(shutters)shutters.disabled=!warehouse;
 };
 assembly?.addEventListener('change',configureAssembly);configureAssembly();
 const roof=form.querySelector<HTMLSelectElement>('[name=roofShape]'),peak=form.querySelector<HTMLInputElement>('[name=roofPeak]'),eaves=form.querySelector<HTMLInputElement>('[name=eaves]');
 roof?.addEventListener('change',()=>{
  const item=data[form.dataset.owner!],body=Number(eaves!.value),width=item.context.width;
  if(roof.value==='flat'||roof.value==='mansard'){
   form.querySelector<HTMLSelectElement>('[name=form]')!.value='straight';
   form.querySelector<HTMLInputElement>('[name=atticWindow]')!.checked=false;
  }
  if(roof.value==='flat'){peak!.value=String(body);form.querySelector<HTMLSelectElement>('[name=dormer]')!.value='none';}
  if(roof.value==='mansard')peak!.value=String(Math.round((body+Math.min(2.4,Math.max(1.2,width*.4)))*100)/100);
  if(roof.value==='behind-gable'){
   form.querySelector<HTMLSelectElement>('[name=dormer]')!.value='none';
   const front=form.querySelector<HTMLSelectElement>('[name=form]')!;
   if(front.value==='native'||front.value==='straight')front.value='bell';
   peak!.value=String(Math.round((body+Math.min(4.5,Math.max(1.5,width*(front.value.startsWith('paired-')?.325:.65))))*100)/100);
  }
 });
 eaves?.addEventListener('input',()=>{if(roof?.value==='flat')peak!.value=eaves.value;});
 form.addEventListener('submit',event=>{
  event.preventDefault();const id=form.dataset.owner!,item=data[id],settings={...item.settings},changed=new Set<string>();
  for(const control of form.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[name]')){
   const value=control instanceof HTMLInputElement&&control.type==='checkbox'?String(control.checked):control.value;
   if(value!==defaults.get(id+'/'+control.name)){
    changed.add(control.name);
    (settings as any)[control.name]=control instanceof HTMLInputElement&&control.type==='checkbox'?control.checked:control.type==='number'?Number(value):value;
   }
  }
  try{pending.set(id,quickEdit(item.context,settings,changed));form.querySelector('.edit-message')!.textContent='Edit queued. Download the batch and rebuild to refresh the 3D preview.';
   queue.textContent=pending.size+' recipe edit'+(pending.size===1?'':'s')+' queued';
  }catch(error){form.querySelector('.edit-message')!.textContent=(error as Error).message;}
 });
}
document.querySelector('#download-edits')!.addEventListener('click',()=>{
 if(!pending.size){queue.textContent='Queue an edit first.';return;}
 const blob=new Blob([JSON.stringify({edits:[...pending.values()]},null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='quick-photo-edits.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
