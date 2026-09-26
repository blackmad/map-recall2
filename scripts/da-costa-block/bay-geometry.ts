/** Non-overlapping diagnostic subdivisions; no claim that boundaries match tenants. */
export function wallBayIntervals(lengthM:number,targetWidthM=10){
  if(!Number.isFinite(lengthM)||lengthM<=0||!Number.isFinite(targetWidthM)||targetWidthM<=0)throw Error('Positive finite wall and bay lengths required');
  const count=Math.max(1,Math.round(lengthM/targetWidthM));
  return Array.from({length:count},(_,i)=>({index:i,startM:lengthM*i/count,endM:lengthM*(i+1)/count}));
}
