/** Source-bound development roof repairs; never edits metric source geometry. */
export function prepareRoofStudy(input:any,review:any){
 if(review.sources.full.sha256!==input.cropSha256||review.sources.full.captureDate!==input.captureDate)throw Error('Stale roof source review');
 const result=structuredClone(input),roof=review.roofStudy;
 if(review.caseId==='case-20'){
  result.features=result.features.map((f:any)=>f.kind==='material'&&f.material==='brick'?{...f,colour:'#4d4840',disposition:'agent-inspected'}:f);
  result.features.push({id:'full:review:dormer',kind:'window',bounds:roof.dormerOpeningBoundsPxApprox,head:'rectangular',mullions:[.5],colour:'#c4c3b9',frameColour:'#d6d5c9',disposition:'agent-inspected'},
   {id:'full:review:roof-slate',kind:'material',material:'paint',region:'upper-wall',bounds:roof.mainRoofLowerFillPxApprox,colour:'#414940',disposition:'agent-inspected'});
 }
 if(review.caseId==='case-22'){
  result.features=result.features.filter((f:any)=>!['door','window'].includes(f.kind));
  result.features.push({id:'full:review:gable-window',kind:'window',bounds:roof.topWindowBoundsPxApprox,head:'rectangular',frameColour:'#c9c6b9',mullions:[.5],disposition:'agent-inspected'});
  const rows=[[300,410],[452,558],[603,713],[748,851]];
  for(let row=0;row<rows.length;row++){
   const [top,bottom]=rows[row];
   for(const [bay,left,right] of [[0,35,60],[1,67,130],[2,139,169]])result.features.push({id:`full:review:row-${row}-bay-${bay}`,kind:'window',bounds:[left,top,right,bottom],head:'rectangular',frameColour:'#c9c6b9',transom:.22,disposition:'agent-inspected',classificationNote:bay===1&&row<3?'balcony obscures opening function; geometry is a visible glazed opening':'source-pixel approximation'});
   result.features.push({id:`full:review:row-${row}-right`,kind:row===3?'door':'window',bounds:[204,top+3,253,row===3?869:bottom],head:'rectangular',lintelHead:'segmental',lintelRise:.08,frameColour:'#c9c6b9',transom:.22,...(row===3?{paired:true}:{}),disposition:'agent-inspected'});
  }
 }
 const outline=roof.frontSilhouettePxApprox??roof.stepOutlinePxApprox;
 return {input:result,polygon:[...outline,[outline.at(-1)[0],input.height],[outline[0][0],input.height]]};
}
