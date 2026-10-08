/** Measured longitudinal deck profile, shared by mesh generation and vehicle pose. */
export type BridgePoint = [number, number];
export interface BridgeSample { s: number; point: BridgePoint; heightM: number; surfaceNAP: number; rawNAP: number | null; validPixels: number }
export interface BridgeSurface {
  id: string; name: string; roadId: string; origin: BridgePoint; outline: BridgePoint[];
  samples: BridgeSample[]; deckRangeM: BridgePoint; roadwayRangeM: BridgePoint;
  deckAxis: BridgePoint; deckAcrossM: BridgePoint; widthM: number; approachHalfWidthM: number;
  family: 'masonry-arch' | 'steel-deck' | 'wooden-deck' | 'concrete-deck'; provenance: any;
}
export interface BridgeSurfaceFile { version: 2; renderHeightDatum: 'NAP'; bridges: BridgeSurface[] }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smoothstep = (v: number) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const surfaceBounds=new WeakMap<BridgeSurface,number[]>();
const roadSections=new WeakMap<BridgeSurface,Array<{left:BridgePoint;right:BridgePoint}>>();
const apronBanks=new WeakMap<BridgeSurface,BridgePoint[][]>();
export function bridgeApronContains(bridge:BridgeSurface,p:BridgePoint) {
  return bridgeApronBanks(bridge).some(bank=>insideBridgeOutline(p,bank));
}
/** Extend each surveyed bank cap outward; never extend its side into the canal. */
export function bridgeApronBanks(bridge:BridgeSurface) {
  let banks=apronBanks.get(bridge);if(banks)return banks;
  const axis=bridge.deckAxis,project=(p:BridgePoint):BridgePoint=>[24+p[0]*axis[0]+p[1]*axis[1],-p[0]*axis[1]+p[1]*axis[0]];
  const ring=bridge.outline.map(project),cross=[-150,...new Set(ring.map(p=>p[1])),150].sort((a,b)=>a-b);
  const point=(s:number,t:number):BridgePoint=>[axis[0]*(s-24)-axis[1]*t,axis[1]*(s-24)+axis[0]*t];
  banks=[];
  for(let i=1;i<cross.length;i++){
    const lo=cross[i-1],hi=cross[i],mid=(lo+hi)/2;
    const edges=ring.flatMap((a,j)=>{const b=ring[(j+1)%ring.length];if(mid<=Math.min(a[1],b[1])||mid>=Math.max(a[1],b[1]))return[];
      return[(t:number)=>a[0]+(b[0]-a[0])*(t-a[1])/(b[1]-a[1])];}).sort((a,b)=>a(mid)-b(mid));
    const first=edges[0]||(()=>bridge.deckRangeM[0]),last=edges.at(-1)||(()=>bridge.deckRangeM[1]);
    banks.push([point(-150,lo),point(first(lo),lo),point(first(hi),hi),point(-150,hi)],
      [point(last(lo),lo),point(200,lo),point(200,hi),point(last(hi),hi)]);
  }
  apronBanks.set(bridge,banks);return banks;
}
/** Widen the last eight metres of each approach to meet the surveyed deck cap. */
export function bridgeRoadSections(bridge:BridgeSurface) {
  let sections=roadSections.get(bridge);if(sections)return sections;
  sections=bridge.samples.map((sample,i)=>{
    const p=sample.point,previous=bridge.samples[Math.max(0,i-1)].point,next=bridge.samples[Math.min(bridge.samples.length-1,i+1)].point;
    const direction=(a:BridgePoint,b:BridgePoint):BridgePoint=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);return l?[(b[0]-a[0])/l,(b[1]-a[1])/l]:[0,0];};
    const incoming=direction(previous,p),outgoing=direction(p,next),dx=incoming[0]+outgoing[0],dy=incoming[1]+outgoing[1],l=Math.hypot(dx,dy)||1;
    const normal:BridgePoint=[-dy/l,dx/l],reference=i===0?outgoing:incoming;
    const miter=Math.min(2,1/Math.max(.5,normal[0]*-reference[1]+normal[1]*reference[0]));
    const across=-p[0]*bridge.deckAxis[1]+p[1]*bridge.deckAxis[0];
    // Use distance along the route. A quay turning back beside the bridge must
    // not inherit the full deck width merely because its axis projection overlaps.
    const blend=smoothstep(Math.min(sample.s-bridge.deckRangeM[0]+8,bridge.deckRangeM[1]-sample.s+8)/8);
    const axisNormal:BridgePoint=[-bridge.deckAxis[1],bridge.deckAxis[0]];
    const offset=(sign:number,bound:number):BridgePoint=>{
      const road=sign*bridge.approachHalfWidthM*miter,deck=sign<0?Math.min(0,bound-across):Math.max(0,bound-across);
      return[p[0]+normal[0]*road*(1-blend)+axisNormal[0]*deck*blend,p[1]+normal[1]*road*(1-blend)+axisNormal[1]*deck*blend];};
    return{left:offset(-1,bridge.deckAcrossM[0]),right:offset(1,bridge.deckAcrossM[1])};
  });roadSections.set(bridge,sections);return sections;
}

export function bridgeLocalPoint(bridge: BridgeSurface, lngLat: BridgePoint): BridgePoint {
  return [(lngLat[0] - bridge.origin[0]) * 111320 * Math.cos(bridge.origin[1] * Math.PI / 180),
    (lngLat[1] - bridge.origin[1]) * 111320];
}
export function bridgeLngLat(bridge: BridgeSurface, point: BridgePoint): BridgePoint {
  return [bridge.origin[0] + point[0] / (111320 * Math.cos(bridge.origin[1] * Math.PI / 180)),
    bridge.origin[1] + point[1] / 111320];
}

export function insideBridgeOutline(point: BridgePoint, ring: BridgePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    const dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
    const t=length2?clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length2,0,1):0;
    if(Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)<.01)return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function bridgeLongSides(bridge: BridgeSurface) {
  const ring=bridge.outline;
  const sign=Math.sign(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0));
  return ring.flatMap((a,i)=>{
    const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    return Math.abs(dx*bridge.deckAxis[0]+dy*bridge.deckAxis[1])/length>.55?[{a,b,sign}]:[];
  });
}

/** Monotone Hermite interpolation: no false bumps/overshoot between measured stations. */
export function bridgeProfileAt(bridge: BridgeSurface, station: number): { heightM: number; grade: number } {
  const points = bridge.samples;
  if (station <= points[0].s) return {heightM:points[0].heightM,grade:0};
  if (station >= points.at(-1)!.s) return {heightM:points.at(-1)!.heightM,grade:0};
  const i = Math.max(0, points.findIndex(p => p.s > station) - 1);
  const a = points[i], b = points[i + 1], length = b.s - a.s, t = (station - a.s) / length;
  const slope = (k: number) => (points[k + 1].heightM - points[k].heightM) / (points[k + 1].s - points[k].s);
  const tangent = (k: number) => {
    if (k === 0 || k === points.length - 1) return 0;
    const left = slope(k - 1), right = slope(k);
    return left * right <= 0 ? 0 : 2 * left * right / (left + right);
  };
  const m0 = tangent(i), m1 = tangent(i + 1);
  return {
    heightM: (2*t*t*t-3*t*t+1)*a.heightM + (t*t*t-2*t*t+t)*length*m0 +
      (-2*t*t*t+3*t*t)*b.heightM + (t*t*t-t*t)*length*m1,
    grade: ((6*t*t-6*t)*a.heightM + (-6*t*t+6*t)*b.heightM) / length +
      (3*t*t-4*t+1)*m0 + (3*t*t-2*t)*m1,
  };
}

export function bridgeStationAt(bridge: BridgeSurface, point: BridgePoint) {
  let best = { station: 0, distance: Infinity, tangent: [1, 0] as BridgePoint, segment: 0, fraction: 0 };
  for (let i = 0; i < bridge.samples.length - 1; i++) {
    const a = bridge.samples[i], b = bridge.samples[i + 1];
    const dx = b.point[0] - a.point[0], dy = b.point[1] - a.point[1], length = Math.hypot(dx, dy);
    const fraction = clamp(((point[0]-a.point[0])*dx + (point[1]-a.point[1])*dy) / (length*length), 0, 1);
    const distance = Math.hypot(point[0]-a.point[0]-dx*fraction, point[1]-a.point[1]-dy*fraction);
    if (distance < best.distance) best = { station: a.s + (b.s-a.s)*fraction, distance,
      tangent: [dx/length, dy/length], segment: i, fraction };
  }
  return best;
}

export function bridgeHeightAtLocal(bridge: BridgeSurface, point: BridgePoint): number | null {
  let bounds=surfaceBounds.get(bridge);
  if(!bounds){const points=[...bridge.outline,...bridge.samples.map(p=>p.point)],margin=bridge.approachHalfWidthM*2+2;
    bounds=[Math.min(...points.map(p=>p[0]))-margin,Math.min(...points.map(p=>p[1]))-margin,Math.max(...points.map(p=>p[0]))+margin,Math.max(...points.map(p=>p[1]))+margin];surfaceBounds.set(bridge,bounds);}
  if(point[0]<bounds[0]||point[1]<bounds[1]||point[0]>bounds[2]||point[1]>bounds[3])return null;
  const hit = bridgeStationAt(bridge, point);
  const along=24+point[0]*bridge.deckAxis[0]+point[1]*bridge.deckAxis[1];
  if (insideBridgeOutline(point, bridge.outline)) return bridgeProfileAt(bridge, along).heightM;
  if(!bridgeApronContains(bridge,point))return null;
  const sections=bridgeRoadSections(bridge);
  for(let i=1;i<sections.length;i++)if(insideBridgeOutline(point,[sections[i-1].left,sections[i].left,sections[i].right,sections[i-1].right]))
    {
      let edgeDistance=Infinity;
      for(let j=0;j<bridge.outline.length;j++){const a=bridge.outline[j],b=bridge.outline[(j+1)%bridge.outline.length],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dy)/l,0,1):0;
        edgeDistance=Math.min(edgeDistance,Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dy*t));}
      const blend=smoothstep(1-edgeDistance/8);
      return bridgeProfileAt(bridge,hit.station).heightM*(1-blend)+bridgeProfileAt(bridge,along).heightM*blend;
    }
  return null;
}

export function validateBridgeSurfaceFile(value: any): asserts value is BridgeSurfaceFile {
  if (value?.version !== 2 || value.renderHeightDatum !== 'NAP' || !Array.isArray(value.bridges))
    throw Error('Unsupported bridge surface file');
  const ids = new Set<string>();
  const point = (p: any) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  for (const b of value.bridges) {
    if (!b.id || ids.has(b.id) || !point(b.origin) || !Array.isArray(b.outline) || b.outline.length < 3 ||
      !b.outline.every(point) || !point(b.deckRangeM) || b.deckRangeM[0] >= b.deckRangeM[1] ||
      !point(b.roadwayRangeM) || !point(b.deckAxis) || !point(b.deckAcrossM) ||
      !Number.isFinite(b.widthM) || b.widthM <= 0 || !Number.isFinite(b.approachHalfWidthM) || b.approachHalfWidthM <= 1 ||
      !['masonry-arch','steel-deck','wooden-deck','concrete-deck'].includes(b.family) || !Array.isArray(b.samples) || b.samples.length < 3 ||
      b.samples.some((p: any, i: number) => !point(p.point) || !Number.isFinite(p.s) || !Number.isFinite(p.heightM) ||
        p.heightM < -8 || p.heightM > 15 || (i && p.s <= b.samples[i-1].s)))
      throw Error('Invalid bridge profile: ' + b.id);
    ids.add(b.id);
  }
}
