/** Original, approximate source traces. Coarse drawing divisions may represent
 * steps, but never establish a measured/current photographed tread count.
 * x is facade fraction; y is rise fraction relative to the main-door threshold.
 * y=0 is threshold and y=-1 is pavement. z is metres outward from the facade.
 */
export type StoepPoint = readonly [number, number];
export interface StoepProfileInput {
  id: string;
  topProfile: readonly StoepPoint[] | null;
  railProfile: readonly StoepPoint[];
  posts: readonly { x: number; bottom: number; top: number }[];
  projectionDepthM: number;
  exactCurrentTreadCount: null;
}
export interface NativeStoepFrame {
  frontageWidthM: number;
  thresholdM: number;
  /** Measured authored main-door threshold minus the accepted pavement datum. */
  riseM: number;
  /** Optional drawing offset; default front plane is z=0. */
  facadeDepthM?: number;
  /** Dated-photo x -> current authored facade x. Strictly increasing anchors;
   * register flight join and landing end separately, never mutate source traces. */
  sourceToCurrentX?: readonly (readonly [number, number])[];
  /** Optional drawing clearance above the traced approach/landing, in metres.
   * This replaces historical photo rail ordinates, not its observed x extent.
   * It is NOT a measured or current-source-supported railing height. */
  drawingRailClearanceM?: number;
}
export function mapStoepProfile(input: StoepProfileInput, frame: NativeStoepFrame) {
  if (!(frame.frontageWidthM > 0 && frame.riseM > 0 && input.projectionDepthM > 0)
      || ![frame.frontageWidthM, frame.riseM, frame.thresholdM, frame.facadeDepthM ?? 0, input.projectionDepthM].every(Number.isFinite)) {
    throw Error('Stoep requires finite native frontage, positive threshold rise and drawing depth');
  }
  const anchors=frame.sourceToCurrentX;
  if (anchors && (anchors.length<2 || anchors.some((a,i)=>!a.every(Number.isFinite) || (i>0 && (a[0]<=anchors[i-1][0] || a[1]<=anchors[i-1][1]))))) throw Error('Invalid historical/current x registration');
  if (frame.drawingRailClearanceM!==undefined && (!Number.isFinite(frame.drawingRailClearanceM) || frame.drawingRailClearanceM<=0 || !input.topProfile)) throw Error('Drawing rail clearance requires a known approach contour and positive clearance');
  const registerX=(x:number)=>{
    if (!anchors) return x;
    const i=Math.min(anchors.length-2,Math.max(0,anchors.findIndex((a,j)=>j>0 && x<=a[0])-1));
    const segment=x>anchors.at(-1)![0] ? anchors.length-2 : i;
    const a=anchors[segment],b=anchors[segment+1];
    return a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]);
  };
  const point = ([x,y]: StoepPoint): [number,number] => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Non-finite source stoep point');
    return [registerX(x) * frame.frontageWidthM, frame.thresholdM + y * frame.riseM];
  };
  const topProfile = input.topProfile?.map(point) ?? null;
  if (topProfile && (topProfile.length < 2 || topProfile.some((p,i) => i > 0 && p[0] < topProfile[i-1][0]))) {
    throw Error('Stoep top profile must run left to right without backtracking');
  }
  const groundM = frame.thresholdM - frame.riseM;
  const approachY=(x:number)=>{
    const p=input.topProfile!;
    if (x<=p[0][0]) return p[0][1];
    if (x>=p.at(-1)![0]) return p.at(-1)![1];
    for (let i=1;i<p.length;i++) if(x<=p[i][0] && p[i][0]>p[i-1][0]) {
      const a=p[i-1],b=p[i];return a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]);
    }
    return 0;
  };
  const railPoint=(p:StoepPoint):[number,number]=>frame.drawingRailClearanceM===undefined ? point(p) : [point(p)[0],frame.thresholdM+approachY(p[0])*frame.riseM+frame.drawingRailClearanceM];
  // Closed extrusion outline; compiler owns triangulation and front normal.
  const sideOutline = topProfile ? [...topProfile,
    [topProfile.at(-1)![0], groundM] as [number,number],
    [topProfile[0][0], groundM] as [number,number]] : null;
  return {
    id: input.id, topProfile, sideOutline, groundM,
    railProfile: input.railProfile.map(railPoint),
    posts: input.posts.map(p => ({ xM: point([p.x,0])[0], bottomM: point([p.x,p.bottom])[1], topM: railPoint([p.x,p.top])[1] })),
    depth: { backM: frame.facadeDepthM ?? 0, frontM: (frame.facadeDepthM ?? 0) + input.projectionDepthM },
    exactCurrentTreadCount: null,
    maxContourVerticalJumpM: topProfile ? Math.max(...topProfile.slice(1).map((p,i)=>Math.abs(p[1]-topProfile[i][1]))) : null,
    geometryInterpretation: 'dated coarse side contour; segment count is not current tread count',
    railHeightAdmission: frame.drawingRailClearanceM===undefined ? 'historical trace scaled with rise; review metric clearance' : 'bounded drawing clearance; current height unknown',
  };
}

/** Flag projected overlap, never automatically delete an aperture. A stair in
 * front of a real basement window can be legitimate; source review decides.
 * Rectangles and polygon must share native x/y units. Rail overlap is excluded.
 */
export function stoepApertureOverlap(sideOutline: readonly StoepPoint[] | null,
  apertures: readonly { id: string; left: number; bottom: number; width: number; height: number }[]) {
  if (!sideOutline) return [];
  const clip = (poly: StoepPoint[], axis: 0|1, bound: number, above: boolean): StoepPoint[] => {
    const result: StoepPoint[] = [];
    for (let i=0;i<poly.length;i++) {
      const a=poly[i], b=poly[(i+1)%poly.length];
      const ai=above ? a[axis]>=bound : a[axis]<=bound;
      const bi=above ? b[axis]>=bound : b[axis]<=bound;
      if (ai) result.push(a);
      if (ai!==bi) {
        const t=(bound-a[axis])/(b[axis]-a[axis]);
        result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
      }
    }
    return result;
  };
  return apertures.flatMap(a => {
    if (!(a.width>0 && a.height>0)) throw Error('Invalid basement aperture bounds');
    let p=[...sideOutline];
    p=clip(p,0,a.left,true); p=clip(p,0,a.left+a.width,false);
    p=clip(p,1,a.bottom,true); p=clip(p,1,a.bottom+a.height,false);
    const area=Math.abs(p.reduce((sum,v,i)=>{const n=p[(i+1)%p.length];return sum+v[0]*n[1]-n[0]*v[1];},0))/2;
    return area>1e-8 ? [{ id:a.id, projectedAreaM2:area, apertureFraction:area/(a.width*a.height), classification:'requires-source-occlusion-review' as const }] : [];
  });
}
