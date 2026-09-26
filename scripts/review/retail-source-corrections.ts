/** Source-inspected development repairs, restricted to the exact dated ground crop.
 * Deliberately does not copy tenant appearance into another capture date. */
export function applyRetailSourceCorrections(caseId:string,tier:string,input:any,review:any){
 const entry=review.cases.find((c:any)=>c.caseId===caseId);
 if(!entry||tier!=='ground')return input;
 const source=entry.source.ground;
 if(source.sha256!==input.cropSha256||source.captureDate!==input.captureDate||source.width!==input.width||source.height!==input.height)throw Error('Stale retail source review');
 const out=structuredClone(input);
 const replace=(id:string,update:any)=>{const f=out.features.find((f:any)=>f.id===id);if(!f)throw Error(`Missing retail feature ${id}`);Object.assign(f,update,{disposition:'agent-inspected'});};
 const add=(f:any)=>{out.features=out.features.filter((old:any)=>old.id!==f.id);out.features.push({...f,disposition:'agent-inspected'});};
 if(caseId==='case-03'){
  add({id:'ground:retail:sign-board',kind:'material',material:'paint',region:'band',bounds:[0,0,405,123],colour:'#33434e'});
  replace('ground:fascia_01',{bounds:[0,0,405,45],text:'key-color | het Fotolab',physicalSignId:'elandsgracht-96:key-color:upper-board',colour:'#33434e',textColour:'#e4b3cc',signFont:'bold 62px sans-serif'});
  add({id:'ground:retail:tagline',kind:'fascia',bounds:[0,47,350,79],text:'voor al uw fotowerk',physicalSignId:'elandsgracht-96:key-color:upper-board:tagline',colour:'#33434e',textColour:'#eeeedd',signFont:'38px sans-serif'});
  // The source canopy runs from y143 to the scalloped hem at y280.
  replace('ground:awning_01',{bounds:[0,143,460,280],text:'key-color | het Fotolab     FUJIFILM',physicalSignId:'elandsgracht-96:key-color:canopy',textColour:'#eeeeeb',signFont:'bold 54px sans-serif',colour:'#3c4a53',awningProfile:'sloped',valance:'scalloped'});
  replace('ground:window_01',{bounds:[3,282,437,480],colour:'#304340',frameColour:'#3b4039'});
 }
 if(caseId==='case-21'){
  replace('ground:fascia-sign',{bounds:[205,113,348,144],text:'DE FIETSENMAKER',physicalSignId:'lauriergracht-50:fietsenmaker:hanging-board',colour:'#d2c8a5',textColour:'#9c875b',signFont:'48px sans-serif'});
  add({id:'ground:retail:open-sign',kind:'fascia',bounds:[253,196,321,220],text:'OPEN',physicalSignId:'lauriergracht-50:fietsenmaker:open-plaque',colour:'#b9a054',textColour:'#514923',signFont:'bold 62px sans-serif'});
 }
 if(caseId==='case-29'){
  out.features=out.features.filter((f:any)=>f.id!=='ground:fascia-main'); // No DORUS lettering on the brown housing above the canopy.
  replace('ground:awning-main',{bounds:[0,110,704,231],text:'DORUS',physicalSignId:'de-clercqstraat-27:dorus:awning-valance',textColour:'#267caa',signFont:'900 90px sans-serif',colour:'#bca56e',frameColour:'#c6d2c5',stripeColour:'#d9ddd0',stripeCount:38,awningProfile:'curved',valance:'straight'});
  replace('ground:door-main',{bounds:[56,233,153,462],colour:'#654d34',frameColour:'#463e33',doorStyle:'panelled',doorFurniture:'pull'});
  replace('ground:window-display',{bounds:[212,237,503,416],colour:'#334947',frameColour:'#594434'});
  add({id:'ground:retail:right-entrance',kind:'door',bounds:[539,235,627,460],head:'rectangular',colour:'#25302b',frameColour:'#4c3c2d',doorStyle:'glazed',doorFurniture:'pull'});
  add({id:'ground:retail:window-sign',kind:'fascia',bounds:[306,354,407,382],text:'DORUS',physicalSignId:'de-clercqstraat-27:dorus:display-lettering',signMount:'glazing',colour:'#334947',textColour:'#dedfd7',signFont:'900 90px sans-serif'});
 }
 return out;
}
