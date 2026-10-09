import type { BridgeSurface, BridgePoint } from './bridgeSurface.ts';
import type { BridgeBatch } from './bridgeGeometry.ts';
/** Illustrative quay lines come from transverse end caps, never longitudinal rail edges. */
export function bridgeReviewBanks(bridge:BridgeSurface):BridgePoint[][] {
  const axis=bridge.deckAxis;
  const ring=bridge.outline.map(p=>[24+p[0]*axis[0]+p[1]*axis[1],-p[0]*axis[1]+p[1]*axis[0]]);
  const middle=(bridge.deckRangeM[0]+bridge.deckRangeM[1])/2;
  const caps=ring.flatMap((a,i)=>{const b=ring[(i+1)%ring.length],ds=b[0]-a[0],dt=b[1]-a[1];
    return Math.abs(dt)>Math.abs(ds)?[{a,b,extent:Math.abs(dt),station:(a[0]+b[0])/2}]:[];});
  const line=(before:boolean)=>{
    const cap=caps.filter(c=>before?c.station<=middle:c.station>=middle).sort((a,b)=>b.extent-a.extent)[0];
    return(t:number)=>cap?cap.a[0]+(cap.b[0]-cap.a[0])*(t-cap.a[1])/(cap.b[1]-cap.a[1]):bridge.deckRangeM[before?0:1];
  };
  const first=line(true),last=line(false),width=100;
  // Parallel illustrative banks keep the canal open beyond the footprint.
  // The register describes the deck, not the distant shoreline.
  const crossCenter=(bridge.deckAcrossM[0]+bridge.deckAcrossM[1])/2;
  const slope=((first(1)-first(0))+(last(1)-last(0)))/2;
  const before=(t:number)=>first(crossCenter)+(t-crossCenter)*slope;
  const after=(t:number)=>last(crossCenter)+(t-crossCenter)*slope;
  const point=(s:number,t:number):BridgePoint=>[axis[0]*(s-24)-axis[1]*t,axis[1]*(s-24)+axis[0]*t];
  return[[point(-150,-width),point(before(-width),-width),point(before(width),width),point(-150,width)],
    [point(after(-width),-width),point(200,-width),point(200,width),point(after(width),width)]];
}
export function buildBridgeReviewContext(bridge:BridgeSurface):BridgeBatch[] {
  const ground:BridgeBatch={kind:'review-ground',colour:'#c8d1bc',positions:[],indices:[]};
  const quay:BridgeBatch={kind:'review-quay',colour:'#827f70',positions:[],indices:[]};
  const quad=(batch:BridgeBatch,points:number[][])=>{
    const start=batch.positions.length/3;
    batch.positions.push(...points.flat());batch.indices.push(start,start+1,start+2,start,start+2,start+3);
  };
  for(const [i,bank]of bridgeReviewBanks(bridge).entries()){
    quad(ground,bank.map(p=>[...p,0]));
    const a=bank[i===0?1:3],b=bank[i===0?2:0];
    quad(quay,[[...a,0],[...b,0],[...b,-1.1],[...a,-1.1]]);
  }
  return[ground,quay];
}
