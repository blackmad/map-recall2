/** Compact authoring choices → editable existing-IR patch, never source geometry. */
import {divisionMullions} from './buildingWindowDivisions';
export interface QuickContext {
 id:string; width:number; eaves:number; peak:number; primaryTop:number; ownedTop:number;
 front:any; storeys:any[]; rowCount:number; provenance:any; geometryRevision?:string; appearanceRoof?:any; details?:any;
}
export interface QuickSettings {
 rows:number; bays:number; groundTop:number; widthRatio:number; heightRatio:number;
 wallColour:string; groundColour:string; form:string; groundPattern:string;
 atticWindow:boolean; priority:string; notes:string;
 head?:string; eaves?:number; balconyLayout?:string; atticLayout?:string; windowDivision?:string; bayLayout?:string;
 roofShape?:string; roofPeak?:number; dormer?:string; cornice?:string; coping?:string;
 openingAssembly?:string; shutterTreatment?:string; doorStyle?:string;
}
export function quickEdit(context:QuickContext,settings:QuickSettings,changed:Set<string>) {
 const c=context,s=settings,recipe:any={},front:any={id:c.front.id},edit:any={id:c.id,notes:s.notes||'Quick photo pass from the recipe editor.'};
 const warehousePattern=c.front.openingPatterns?.find((p:any)=>p.preset==='warehouse-stack');
 const openingAssembly=s.openingAssembly??(warehousePattern?(warehousePattern.segments===2?'warehouse-paired':'warehouse-single'):'residential');
 if(!['residential','warehouse-single','warehouse-paired'].includes(openingAssembly))throw Error('Choose a supported opening assembly.');
 if(changed.has('shutterTreatment')&&openingAssembly==='residential')throw Error('Choose a warehouse assembly before changing shutters.');
 const eaves=s.eaves??c.eaves;
 const roofShape=s.roofShape??c.appearanceRoof?.kind??'retained';
 const appearanceChanged=['roofShape','roofPeak','dormer'].some(key=>changed.has(key))||(!!c.appearanceRoof&&changed.has('eaves'))||(['behind-gable','behind-parapet'].includes(c.appearanceRoof?.kind)&&changed.has('form'));
 const peak=roofShape==='flat'?eaves:roofShape==='retained'?c.peak:s.roofPeak??c.peak;
 if(roofShape==='behind-parapet'&&appearanceChanged&&(['native','straight'].includes(s.form)||peak<=eaves))throw Error('Choose a raised decorative front and a peak above its eaves for the roof behind a parapet.');
 if(roofShape==='behind-gable'&&appearanceChanged&&s.form==='native')throw Error('Choose a decorative front form for the roof behind a gable.');
 if(['flat','mansard','flat-with-dormers'].includes(roofShape)&&changed.has('form')&&!['straight','native'].includes(s.form))throw Error('Choose roof massing behind-gable before adding a raised decorative front.');
 const atticEnabled=(roofShape==='retained'||roofShape==='behind-gable'||roofShape==='behind-parapet')&&(s.atticWindow||(changed.has('atticLayout')&&!changed.has('atticWindow')));
 if(!Number.isFinite(eaves)||!Number.isFinite(peak)||eaves<=0||eaves>peak)throw Error('Facade eaves must fit below the selected roof peak.');
 if(appearanceChanged&&c.appearanceRoof?.parts?.some((p:any)=>p.eaves!==undefined||p.peak!==undefined))throw Error('Edit independently scoped roof heights in the Recipe JSON to preserve each part.');
 if(appearanceChanged&&c.front.warehouseHoists?.some((h:any)=>h.supportAttachmentId))throw Error('Edit roof attachments and their hoist supports together in Recipe JSON.');
 if(appearanceChanged&&!changed.has('dormer')&&c.details?.appearanceDormers?.some((d:any)=>d.capStyle==='pitched'))throw Error('Edit pitched dormer heights in Recipe JSON to preserve the cap, or explicitly choose a replacement dormer.');
 if(appearanceChanged){
  if(roofShape==='retained')throw Error('Restore the saved original recipe to recover native massing.');
  if(!['flat','behind-gable','behind-parapet','mansard','flat-with-dormers'].includes(roofShape))throw Error('Choose a supported appearance roof.');
  const appearance:any={kind:roofShape,eaves,peak,geometryRevision:c.geometryRevision,provenance:c.provenance};
  if(roofShape==='behind-gable'&&s.form.startsWith('paired-'))appearance.parts=[{fraction:.5},{fraction:.5}];
  if(roofShape==='mansard'){
   if(peak-eaves<.8)throw Error('Mansard rise must leave room for its two pitches.');
   appearance.kneeInset=Math.min(.6,c.width*.15);appearance.topInset=c.width*.34;appearance.kneeHeight=eaves+(peak-eaves)*.77;
  }
  recipe.massing={appearanceRoof:appearance};recipe.height=peak;
  recipe.heightChoice={value:peak,eavesM:eaves,roofPeakM:peak,reason:'Photo-selected inferred appearance height; original sourceShell and heightEvidence unchanged.'};
  recipe.roof={kind:roofShape==='mansard'?'mansard':'flat',eaves,top:peak,status:'inferred appearance'};
  recipe.details={appearanceDormers:[],sourceDormers:[]};
  if((s.dormer??'none')!=='none'){
   if(!['mansard','flat-with-dormers'].includes(roofShape))throw Error('Choose mansard or flat-with-dormers for a roof dormer.');
   if(!['central','paired','roof-box'].includes(s.dormer!))throw Error('Choose central, paired or roof-box.');
   if(roofShape==='mansard'&&s.dormer!=='central')throw Error('Paired dormers and roof boxes require a flat roof.');
   const rise=peak-eaves;
   recipe.details.appearanceDormers=roofShape==='flat-with-dormers'?(s.dormer==='paired'?[.245,.755]:[.5]).map((fraction,i)=>({id:'roof-dormer-'+i,supportMode:'inferred-appearance-roof',x:c.width*fraction,y:.32,width:Math.min(1.4,c.width*(s.dormer==='paired'?.12:.22)),depth:1.15,height:rise-.09,capRise:0,wallColour:s.wallColour,frameColour:'#c5c8b6',provenance:c.provenance})):[{id:'central-dormer',supportMode:'inferred-appearance-roof',x:c.width/2,y:.14,width:Math.min(1.4,c.width*.28),depth:Math.min(.4,appearance.kneeInset*.65),height:rise*.73,capRise:0,wallColour:'#dedbce',frameColour:'#e6e2d6',provenance:c.provenance}];
  }
  if(roofShape==='flat-with-dormers'&&s.dormer==='roof-box'){
   const previous=c.details?.appearanceDormers?.find((d:any)=>d.assembly==='roof-box');
   recipe.details.appearanceDormers=[{...previous,id:previous?.id||'two-level-roof-box',assembly:'roof-box',supportMode:'inferred-appearance-roof',x:previous?.x??c.width/2,y:previous?.y??.32,width:previous?.width??Math.min(2.4,c.width*.30),depth:previous?.depth??1.4,height:peak-eaves-.09,baseZ:eaves+(previous?.baseZ!==undefined?previous.baseZ-c.eaves:-.35),frontProjection:previous?.frontProjection??.56,capRise:0,wallColour:previous?.wallColour??'#bbbcae',frameColour:previous?.frameColour??'#c2c4b4',glassColour:previous?.glassColour??'#858d80',frontWindows:previous?.frontWindows??[{xFraction:.5,zFraction:.24,widthFraction:.79,heightFraction:.40,template:{head:'rectangular',mullions:[.5],transom:.5}},{xFraction:.5,zFraction:.75,widthFraction:.79,heightFraction:.40,template:{head:'rectangular',mullions:[.5],transom:null}}],provenance:c.provenance}];
  }
  if(roofShape==='flat-with-dormers'&&!recipe.details.appearanceDormers.length)throw Error('Choose a dormer for the raised roof peak.');
  if(['flat','mansard','flat-with-dormers'].includes(roofShape)){
   front.profileLayout=null;front.profile=[[0,eaves],[c.width,eaves]];
   front.openings=(c.front.openings||[]).filter((o:any)=>o.storey!=='attic');
   front.openingPatterns=(c.front.openingPatterns||[]).filter((p:any)=>p.preset!=='attic-lights'&&p.storey!=='attic');
   front.openingRows=(c.front.openingRows||[]).filter((r:any)=>r.storey!=='attic'&&!r.storeys?.includes('attic'));
   if(roofShape==='flat-with-dormers')front.coping=null;
  }
 }
 if(changed.has('eaves'))recipe.roof={...recipe.roof,eaves};
 if(!changed.size)throw Error('Change a choice before adding an edit.');
 if(changed.has('coping')){
  if(!['preserve','none','pale','dark'].includes(s.coping!))throw Error('Choose a supported gable coping.');
  if(s.coping==='none')front.coping=null;
  else if(s.coping!=='preserve')front.coping={width:.14,depth:.32,colour:s.coping==='pale'?'#cbd0bb':'#55594b',provenance:c.provenance};
 }
 if(!Number.isInteger(s.rows)||s.rows<1||s.rows>7||!Number.isInteger(s.bays)||s.bays<1||s.bays>7)throw Error('Rows and bays must be whole numbers from 1 to 7.');
 if(!Number.isFinite(s.groundTop)||s.groundTop<=0||s.groundTop>=eaves)throw Error('Ground-floor height must fit below the facade eaves.');
 if(![s.widthRatio,s.heightRatio].every(v=>Number.isFinite(v)&&v>=.2&&v<=.9))throw Error('Window ratios must be between 0.2 and 0.9.');
 if(![s.wallColour,s.groundColour].every(v=>/^#[0-9a-f]{6}$/i.test(v)))throw Error('Choose valid wall and ground colours.');
 const patternedRows=['rows','bays','widthRatio','heightRatio','groundTop','head','eaves','windowDivision','bayLayout'].some(key=>changed.has(key))||(changed.has('openingAssembly')&&openingAssembly==='residential');
 const openings=c.front.openings||[],rows=c.front.openingRows||[];
 if(patternedRows){
  const template=structuredClone(rows.find((r:any)=>(r.storey||r.storeys?.[0]||'').startsWith('upper_'))?.template||{});
  if(changed.has('windowDivision')){
   if(s.windowDivision==='automatic')delete template.mullions;
   else template.mullions=divisionMullions(s.windowDivision!);
  }
  if(changed.has('head')){
   if(!['rectangular','segmental','rounded'].includes(s.head!))throw Error('Unknown window head.');
   template.head=s.head;
   if(s.head==='segmental'){template.archRise=.13;template.archSegments=6;}
   else {delete template.archRise;template.archSegments=6;}
  }
  front.openingRows=rows.filter((r:any)=>!(r.storey||r.storeys?.[0]||'').startsWith('upper_'));
  const bayLayout=s.bayLayout??'even';
  if(!['even','wide-centre','wide-left','wide-right','custom'].includes(bayLayout))throw Error('Unknown bay layout.');
  const prior=rows.find((r:any)=>(r.storey||r.storeys?.[0]||'').startsWith('upper_'));
  let horizontal:any;
  if(bayLayout==='custom'){
   if(changed.has('bays')||changed.has('widthRatio')||changed.has('bayLayout'))throw Error('Select a library bay layout before changing custom spacing.');
   horizontal=Object.fromEntries(['centres','centresFraction','width','widthFraction','widthFractions'].filter(k=>prior?.[k]!==undefined).map(k=>[k,structuredClone(prior[k])]));
  }else{
   const weights=Array.from({length:s.bays},(_,i)=>bayLayout==='wide-left'&&i===0||bayLayout==='wide-right'&&i===s.bays-1||bayLayout==='wide-centre'&&Math.abs(i-(s.bays-1)/2)<=.5?2:1);
   const total=weights.reduce((a,b)=>a+b,0);let cursor=0;
   const centresFraction=weights.map(weight=>{const centre=(cursor+weight/2)/total;cursor+=weight;return centre;});
   horizontal=bayLayout==='even'?{centresFraction,widthFraction:s.widthRatio/s.bays}:{centresFraction,widthFractions:weights.map(w=>s.widthRatio*w/total)};
  }
  front.openingRows.push({id:'upper',storeys:Array.from({length:s.rows},(_,i)=>'upper_'+(i+1)),...horizontal,
   bayLayout,heightFraction:s.heightRatio,sillFraction:(1-s.heightRatio)/2,template,provenance:c.provenance});
  front.openings=(front.openings||openings).filter((o:any)=>!o.storey.startsWith('upper_'));
 }
 if(changed.has('rows')||changed.has('groundTop')||changed.has('atticWindow')||changed.has('atticLayout')||changed.has('eaves')||appearanceChanged){
  const ground=s.groundTop,span=(eaves-ground)/s.rows;
  recipe.storeys=[{id:'ground',bottom:0,top:ground},...Array.from({length:s.rows},(_,i)=>({id:'upper_'+(i+1),bottom:ground+i*span,top:ground+(i+1)*span}))];
  if(atticEnabled&&peak>eaves)recipe.storeys.push({id:'attic',bottom:eaves,top:peak});
 }
 if(changed.has('groundTop')){
  front.storefront={height:s.groundTop};
  const scale=s.groundTop/c.front.storefront.height;
  front.openings=(front.openings||openings).map((o:any)=>o.storey==='ground'?{...o,z:o.z*scale,height:o.height*scale}:o);
  front.components=(c.front.components||[]).map((component:any)=>Math.abs(component.z-c.front.storefront.height)<.35
   ?{...component,z:component.z+s.groundTop-c.front.storefront.height}:component);
 }
 if(changed.has('eaves'))front.components=(front.components||c.front.components||[]).map((component:any)=>Math.abs(component.z-c.eaves)<.35?{...component,z:component.z+eaves-c.eaves}:component);
 if(changed.has('wallColour'))recipe.materials={wallColour:s.wallColour};
 if(changed.has('groundColour'))front.storefront={...front.storefront,finishColour:s.groundColour};
 if(changed.has('groundPattern')){
  if(!['shop','left-entry','right-entry','center-entry','two-entries','double-entry-display','display-double-entry','three-entries','four-doors','garage-right-entry'].includes(s.groundPattern))throw Error('Choose a library ground-floor pattern.');
  front.openings=(front.openings||openings).filter((o:any)=>o.storey!=='ground');
  front.openingRows=(front.openingRows||rows).filter((r:any)=>r.storey!=='ground');
  front.openingPatterns=[...(c.front.openingPatterns||[]).filter((p:any)=>p.preset==='attic-lights'||p.storey==='attic'),{...Object.fromEntries(['template','doorTemplate','windowTemplate'].filter(k=>c.front.openingPatterns?.find((p:any)=>(p.storey||'ground')==='ground')?.[k]!==undefined).map(k=>[k,structuredClone(c.front.openingPatterns.find((p:any)=>(p.storey||'ground')==='ground')[k])])),preset:s.groundPattern,id:'ground',storey:'ground',provenance:c.provenance}];
 }
 let formTop=c.front.profileLayout?.top??c.primaryTop;
 if(appearanceChanged||formTop-eaves<1&&s.form!=='straight')formTop=peak;
 if(changed.has('form')||changed.has('eaves')||(appearanceChanged&&['behind-gable','behind-parapet'].includes(roofShape))){
  if(!['native','straight','triangular','stepped','spout','neck','bell','gambrel','paired-triangular','paired-neck','paired-bell','central-tower'].includes(s.form))throw Error('Unknown library form.');
  front.profileLayout=s.form==='native'?null:{family:s.form,eaves,top:s.form==='straight'?eaves:formTop,provenance:c.provenance};
  if(s.form.startsWith('paired-'))front.profileLayout={family:'compound',preset:s.form,eaves,top:formTop,
   parts:[0,1].map(()=>({fraction:.5,family:s.form.slice(7),eaves,top:formTop})),provenance:c.provenance};
  if(s.form==='central-tower')front.profileLayout={family:'compound',preset:s.form,eaves,top:formTop,
   parts:[{fraction:.3,family:'straight',eaves,top:eaves},
    {fraction:.4,family:'straight',eaves:formTop,top:formTop},
    {fraction:.3,family:'straight',eaves,top:eaves}],provenance:c.provenance};
  if(s.form!=='native')front.sourceWallSelection={ownershipProfile:[[0,c.ownedTop],[c.width,c.ownedTop]]};
 }
 if(appearanceChanged&&(['flat','mansard','flat-with-dormers'].includes(roofShape))){front.profileLayout=null;front.profile=[[0,eaves],[c.width,eaves]];}
 if(changed.has('cornice')){
  if(!['none','flat','stepped'].includes(s.cornice!))throw Error('Choose a supported cornice.');
  front.components=(front.components||c.front.components||[]).filter((p:any)=>p.id!=='roof-cornice');
  if(s.cornice!=='none')front.components.push({id:'roof-cornice',kind:'cornice',z:eaves-.18,height:.36,profile:s.cornice,colour:'#dedbce',provenance:c.provenance});
 }
 if(changed.has('atticWindow')||changed.has('atticLayout')||changed.has('openingAssembly')||appearanceChanged||((changed.has('form')||changed.has('eaves'))&&atticEnabled)){
  front.openings=(front.openings||openings).filter((o:any)=>o.storey!=='attic');
  front.openingPatterns=(front.openingPatterns||c.front.openingPatterns||[]).filter((p:any)=>p.preset!=='attic-lights');
  if(atticEnabled){
   if(s.form==='straight'||formTop-eaves<.7)throw Error('Attic lights need a raised gable.');
   front.openingPatterns.push({id:'attic-lights',preset:'attic-lights',storey:'attic',layout:s.atticLayout??'single',
    segments:s.form.startsWith('paired-')?2:1,provenance:c.provenance});
  }
 }
 const balconyLayout=s.balconyLayout??'none';
 if(changed.has('balconyLayout')||(balconyLayout!=='none'&&['rows','bays','groundTop','eaves','heightRatio'].some(k=>changed.has(k)))){
  if(!['none','center-stack','left-stack','right-stack','wide-stack'].includes(balconyLayout))throw Error('Unknown balcony layout.');
  front.componentPatterns=(c.front.componentPatterns||[]).filter((p:any)=>p.preset!=='balcony-stack');
  if(balconyLayout!=='none'){
   const centre=balconyLayout==='left-stack'?.5/s.bays:balconyLayout==='right-stack'?1-.5/s.bays:.5;
   front.componentPatterns.push({id:'balcony-stack',preset:'balcony-stack',layout:balconyLayout,
    storeys:Array.from({length:s.rows},(_,i)=>'upper_'+(i+1)),centresFraction:[centre],
    widthFraction:balconyLayout==='wide-stack'?.9:.85/s.bays,bottomFraction:(1-s.heightRatio)/2,
    template:{depth:.45,height:.85,railThickness:.025,balusterSpacing:.22,colour:'#aaa497',frameColour:'#343b37'},provenance:c.provenance});
  }
 }
 if(changed.has('openingAssembly')&&openingAssembly==='residential'){
  front.openingPatterns=(front.openingPatterns||c.front.openingPatterns||[]).filter((p:any)=>p.preset!=='warehouse-stack');front.warehouseHoists=[];
  front.openingPatterns.push({preset:s.groundPattern==='custom'||s.groundPattern==='warehouse-stack'?'right-entry':s.groundPattern,id:'ground',storey:'ground',provenance:c.provenance});
 }
 if(openingAssembly!=='residential'&&(changed.has('openingAssembly')||changed.has('shutterTreatment')||patternedRows||appearanceChanged||['groundPattern','atticWindow','atticLayout','form'].some(k=>changed.has(k)))){
  const segments=openingAssembly==='warehouse-paired'?2:1;
  let templates=warehousePattern?.segments===segments?structuredClone(warehousePattern.segmentTemplates||Array.from({length:segments},()=>({}))):Array.from({length:segments},(_,i)=>i===0?{shutters:{angle:180,style:'plank',colour:'#d9d8ce'}}:{});
  if(changed.has('shutterTreatment')){
   if(!['preserve','none','pale-folded','dark-folded'].includes(s.shutterTreatment!))throw Error('Choose a supported shutter treatment.');
   if(s.shutterTreatment!=='preserve')templates=Array.from({length:segments},()=>s.shutterTreatment==='none'?{}:{shutters:{angle:180,style:'plank',colour:s.shutterTreatment==='pale-folded'?'#d9d8ce':'#37413e'}});
  }
  front.openingRows=[];front.openings=[];front.openingPatterns=[{id:'warehouse-stack',preset:'warehouse-stack',storeys:['ground',...Array.from({length:s.rows},(_,i)=>'upper_'+(i+1)),...(atticEnabled?['attic']:[])],segments,segmentTemplates:templates,provenance:c.provenance}];
  front.componentPatterns=(front.componentPatterns||c.front.componentPatterns||[]).filter((p:any)=>p.preset!=='balcony-stack');
  if(c.front.warehouseHoists?.length){
   const sample=c.front.warehouseHoists[0],margin=c.peak-sample.z;
   front.warehouseHoists=Array.from({length:segments},(_,i)=>({...structuredClone(sample),id:'warehouse-hoist-'+(i+1),x:c.width*(i+.5)/segments,z:peak-margin,provenance:c.provenance}));
  }
  // Opening assemblies describe joinery, not the surrounding wall finish.
  // Preserve an authored ground finish unless its colour control was changed.
 }
 if(changed.has('doorStyle')&&s.doorStyle!=='preserve'){
  if(openingAssembly!=='residential')throw Error('Residential door leaves require a residential ground assembly.');
  if(!['glazed','plain','panelled'].includes(s.doorStyle!))throw Error('Choose a supported door leaf.');
  front.openingPatterns=structuredClone(front.openingPatterns||c.front.openingPatterns||[]);
  const grounds=front.openingPatterns.filter((p:any)=>(p.storey||'ground')==='ground'&&!['attic-lights','industrial-grid','warehouse-stack'].includes(p.preset));
  if(!grounds.length)throw Error('Edit explicit ground doors in Recipe JSON or choose a ground pattern first.');
  for(const pattern of grounds){
   pattern.doorTemplate={...pattern.doorTemplate};
   if(s.doorStyle==='glazed')delete pattern.doorTemplate.doorLeaf;
   else pattern.doorTemplate.doorLeaf={...pattern.doorTemplate.doorLeaf,style:s.doorStyle,rows:pattern.doorTemplate.doorLeaf?.rows??2,columns:pattern.doorTemplate.doorLeaf?.columns??1,colour:pattern.doorTemplate.doorLeaf?.colour??'#303c33'};
  }
 }
 if(Object.keys(front).length>1)recipe.frontages=[front];
 if(changed.has('priority'))edit.detailPriority=s.priority;
 edit.recipe=recipe;return edit;
}
