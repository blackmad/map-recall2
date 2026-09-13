import type { Bounds } from '../../../src/canalRecall/facadeDescription.js';
export type OpeningAssertion = {id:string;kind:'door'|'window';head:string;bounds:Bounds;visible:boolean};
export function intersectionOverUnion(a:Bounds,b:Bounds):number {
  const area=(r:Bounds)=>Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);
  const intersection=area([Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])]);
  return intersection/(area(a)+area(b)-intersection)||0;
}
/** Maximum cardinality matching prevents duplicate predictions from increasing
 * recall, and avoids greedy matching undercounting adjacent/paired openings. */
export function openingAccuracy(reference:OpeningAssertion[],predicted:OpeningAssertion[]) {
  const visible=reference.filter(r=>r.visible),matches=new Map<number,number>();
  const edges=predicted.map(p=>visible.flatMap((r,i)=>p.kind===r.kind&&p.head===r.head&&intersectionOverUnion(p.bounds,r.bounds)>=.7?[i]:[]));
  const visit=(p:number,seen:Set<number>):boolean=>{for(const r of edges[p]){if(seen.has(r))continue;seen.add(r);const old=matches.get(r);if(old===undefined||visit(old,seen)){matches.set(r,p);return true;}}return false;};
  predicted.forEach((_,p)=>visit(p,new Set()));
  const tp=matches.size,fp=predicted.length-tp,fn=visible.length-tp;
  return {tp,fp,fn,precision:predicted.length?tp/predicted.length:null,recall:visible.length?tp/visible.length:null};
}
export function fidelityGate(input:{developmentResolved:boolean;unseenExclusionsResolved:boolean;referenceCount:number;accuracy:ReturnType<typeof openingAccuracy>;developmentFailures:string[];awningFailures:string[];materialFailures:string[];contacts:{gapM:number;exception?:{sourceSha256:string;reason:string}}[];registrationFailures:number;abstentions:number;visualInspectionComplete:boolean;resourceChecksPassed:boolean}) {
  const failures:string[]=[];
  if(!input.developmentResolved)failures.push('missing-development-source-identities');
  if(!input.unseenExclusionsResolved||input.referenceCount!==30)failures.push('unseen-set-not-established');
  if(input.accuracy.precision===null||input.accuracy.precision<.9||input.accuracy.recall===null||input.accuracy.recall<.9)failures.push('opening-accuracy');
  failures.push(...input.developmentFailures,...input.awningFailures,...input.materialFailures);
  if(!input.contacts.length||input.contacts.some(c=>!Number.isFinite(c.gapM)||(c.gapM>.05&&(!/^[a-f0-9]{64}$/i.test(c.exception?.sourceSha256??'')||!c.exception?.reason))))failures.push('ground-contact');
  if(!input.visualInspectionComplete)failures.push('visual-inspection-incomplete');
  if(!input.resourceChecksPassed)failures.push('resource-checks');
  return {pass:failures.length===0,failures,registrationFailures:input.registrationFailures,abstentions:input.abstentions,accuracy:input.accuracy};
}
