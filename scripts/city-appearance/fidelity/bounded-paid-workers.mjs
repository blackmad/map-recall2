/** Run paid work with bounded concurrency. A failure stops new starts, while
 * already-started requests are awaited so their responses can be persisted and
 * settled before the caller receives the error. */
export async function runBoundedPaidWorkers(items,{concurrency=1,handle}={}){
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>3)throw Error('Paid extraction concurrency must be an integer from 1 to 3');
  if(typeof handle!=='function')throw Error('Paid extraction worker requires a handler');
  for(let offset=0;offset<items.length;offset+=concurrency){
    let stop=false;const wave=items.slice(offset,offset+concurrency),outcomes=await Promise.allSettled(wave.map((item,index)=>handle(item,offset+index,()=>{stop=true;})));
    const failure=outcomes.find(outcome=>outcome.status==='rejected');
    if(failure)throw failure.reason;
    if(stop)throw Error('Paid extraction launch gate stopped without a propagated failure');
  }
}
