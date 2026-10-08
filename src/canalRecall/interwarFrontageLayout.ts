/** Shared, source-selected broad window groups. Dimensions are bounded drawing
 * inputs, not surveyed measurements. No neighborhood or BAG identities live here. */
export type InterwarProjection = 'flat' | 'left' | 'right';
export interface InterwarFrontageRecipe {
  residentialRows: number;
  /** Repeat pitch chooses whole groups; the wall ends retain masonry piers. */
  groupPitchM: number;
  groupWidthM: number;
  windowHeightM: number;
  /** First sill above the shop/ground datum; row pitch is independent of roof height. */
  firstSillM: number;
  rowPitchM: number;
  /** Explicit observed sequence; a projection moves one complete leaf and its frame. */
  projectionSequence: readonly InterwarProjection[];
  projectionM: number;
  frameWidthM: number;
  centralMullionM: number;
  /** Height fraction of the transom, measured from the sill. */
  transomFraction: number;
  frameHex?: string;
  capHex?: string;
}
export type InterwarLocalPoint = [along: number, outward: number, z: number];
export type InterwarMaterialRole = 'frame' | 'wall' | 'glass' | 'cap';
export interface InterwarFrontageQuad {
  role: InterwarMaterialRole;
  points: [InterwarLocalPoint, InterwarLocalPoint, InterwarLocalPoint, InterwarLocalPoint];
  normal: InterwarLocalPoint;
  /** Normalized opening-field coordinates; callers crop their active window atlas. */
  uv: [[number, number], [number, number], [number, number], [number, number]];
  groupIndex: number;
  rowIndex: number;
  leafIndex?: number;
}
export interface InterwarWindowSurface {
  groupIndex: number; rowIndex: number; leafIndex: number;
  left: number; bottom: number; width: number; height: number; out: number;
}
export interface InterwarFrontagePlan {
  groups: number;
  pitchM: number;
  windows: InterwarWindowSurface[];
  quads: InterwarFrontageQuad[];
}

const FRONT_OUT = .045;
const GLASS_RECESS = .012;

export function validateInterwarFrontageRecipe(value: unknown): value is InterwarFrontageRecipe {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as InterwarFrontageRecipe;
  if (![r.residentialRows,r.groupPitchM,r.groupWidthM,r.windowHeightM,r.firstSillM,r.rowPitchM,
    r.projectionM,r.frameWidthM,r.centralMullionM,r.transomFraction].every(Number.isFinite)) return false;
  return Number.isInteger(r.residentialRows) && r.residentialRows >= 1 && r.residentialRows <= 6
    && r.groupPitchM >= 2 && r.groupPitchM <= 8 && r.groupWidthM >= 1.4 && r.groupWidthM <= 4
    && r.windowHeightM >= 1 && r.windowHeightM <= 3 && r.firstSillM >= .15 && r.firstSillM <= 2
    && r.rowPitchM >= r.windowHeightM + .25 && r.rowPitchM <= 5
    && r.projectionM >= 0 && r.projectionM <= .8 && r.frameWidthM >= .035 && r.frameWidthM <= .15
    && r.centralMullionM >= r.frameWidthM && r.centralMullionM <= .35
    && r.transomFraction >= .5 && r.transomFraction <= .85
    && Array.isArray(r.projectionSequence) && r.projectionSequence.length > 0 && r.projectionSequence.length <= 16
    && r.projectionSequence.every(p => ['flat','left','right'].includes(p))
    && [r.frameHex,r.capHex].every(hex => hex === undefined || typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex));
}

/** All or nothing: incompatible height/width/input returns undefined so callers
 * preserve their ordinary textured facade. Defining windows do not use ornament
 * budgets. Local coordinates follow WallFrame: along, outward, world elevation. */
export function planInterwarFrontage(input: {
  lengthM: number; baseM: number; topM: number; groundM: number;
  recipe: InterwarFrontageRecipe;
  /** Row-relative group phase supplied by the admitted street frame, never polygon index. */
  projectionPhase?: number;
  projectionStep?: 1 | -1;
}): InterwarFrontagePlan | undefined {
  const { lengthM, baseM, topM, groundM, recipe: r } = input;
  if(input.projectionStep!=null&&input.projectionStep!==1&&input.projectionStep!==-1)return;
  if(input.projectionPhase!=null&&!Number.isInteger(input.projectionPhase))return;
  if (![lengthM,baseM,topM,groundM].every(Number.isFinite) || !validateInterwarFrontageRecipe(r)) return;
  if (lengthM < 2 || lengthM > 120 || groundM <= 0 || topM <= baseM + groundM
  ) return;
  const groups = Math.max(1, Math.round(lengthM / r.groupPitchM)), pitchM = lengthM / groups;
  // Do not squeeze broad groups into narrow strips or invent a fractional group.
  if (groups > 24 || pitchM - r.groupWidthM < .35) return;
  const lastHead = baseM + groundM + r.firstSillM + (r.residentialRows - 1) * r.rowPitchM + r.windowHeightM;
  if (lastHead + .2 > topM) return;
  const leafWidth = (r.groupWidthM - r.centralMullionM) / 2;
  if (leafWidth <= r.frameWidthM * 2 + .3) return;
  const plan: InterwarFrontagePlan = { groups, pitchM, windows: [], quads: [] };
  let groupIndex = 0, rowIndex = 0, leafIndex: number | undefined;
  const quad = (role: InterwarMaterialRole, points: InterwarFrontageQuad['points'], normal: InterwarLocalPoint) => {
    const uv: InterwarFrontageQuad['uv'] = [[0,0],[1,0],[1,1],[0,1]];
    const a = points[0], b = points[1], c = points[2];
    const u = b.map((v,i) => v-a[i]), v = c.map((w,i) => w-a[i]);
    const cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if (cross.reduce((sum,n,i) => sum+n*normal[i],0) < 0) {
      [points[1],points[3]] = [points[3],points[1]];
      [uv[1],uv[3]] = [uv[3],uv[1]];
    }
    plan.quads.push({role,points,normal,uv,groupIndex,rowIndex,leafIndex});
  };
  const front = (role: InterwarMaterialRole, left: number, right: number, bottom: number, top: number, out: number) =>
    quad(role,[[left,out,bottom],[right,out,bottom],[right,out,top],[left,out,top]],[0,1,0]);
  for (rowIndex=0;rowIndex<r.residentialRows;rowIndex++) for(groupIndex=0;groupIndex<groups;groupIndex++) {
    const left = groupIndex*pitchM + (pitchM-r.groupWidthM)/2;
    const bottom = baseM+groundM+r.firstSillM+rowIndex*r.rowPitchM, top = bottom+r.windowHeightM;
    const selectedProjection = r.projectionSequence[((groupIndex*(input.projectionStep??1)+(input.projectionPhase??0))%r.projectionSequence.length+r.projectionSequence.length)%r.projectionSequence.length];
    const projection=input.projectionStep===-1?(selectedProjection==='left'?'right':selectedProjection==='right'?'left':'flat'):selectedProjection;
    leafIndex = undefined;
    front('frame',left+leafWidth,left+leafWidth+r.centralMullionM,bottom,top,FRONT_OUT);
    for (leafIndex=0;leafIndex<2;leafIndex++) {
      const l = left+leafIndex*(leafWidth+r.centralMullionM), h = l+leafWidth;
      const projected = projection === (leafIndex === 0 ? 'left' : 'right');
      const out = FRONT_OUT + (projected ? r.projectionM : 0), fw = r.frameWidthM;
      const glass = {groupIndex,rowIndex,leafIndex,left:l+fw,bottom:bottom+fw,width:leafWidth-2*fw,height:r.windowHeightM-2*fw,out:out-GLASS_RECESS};
      plan.windows.push(glass);
      front('glass',glass.left,glass.left+glass.width,glass.bottom,glass.bottom+glass.height,glass.out);
      front('frame',l,l+fw,bottom,top,out);
      front('frame',h-fw,h,bottom,top,out);
      front('frame',l+fw,h-fw,bottom,bottom+fw,out);
      front('frame',l+fw,h-fw,top-fw,top,out);
      const transom = bottom+r.windowHeightM*r.transomFraction;
      front('frame',l+fw,h-fw,transom-fw/2,transom+fw/2,out);
      if (projected && r.projectionM > 0) {
        // The entire opening/frame projects; closed pale returns and underside
        // keep the parent wall from hiding it at oblique gameplay angles.
        quad('frame',[[l,FRONT_OUT,bottom],[l,out,bottom],[l,out,top],[l,FRONT_OUT,top]],[-1,0,0]);
        quad('frame',[[h,FRONT_OUT,bottom],[h,out,bottom],[h,out,top],[h,FRONT_OUT,top]],[1,0,0]);
        quad('frame',[[l,FRONT_OUT,bottom],[h,FRONT_OUT,bottom],[h,out,bottom],[l,out,bottom]],[0,0,-1]);
        // A shallow dark hood, rather than an invented balcony or continuous bay.
        front('cap',l-.04,h+.04,top,top+.06,out+.04);
        quad('cap',[[l-.04,FRONT_OUT,top+.06],[h+.04,FRONT_OUT,top+.06],[h+.04,out+.04,top+.06],[l-.04,out+.04,top+.06]],[0,0,1]);
      }
    }
  }
  return plan;
}

/** Sample the first group centre, so reversing a surveyed edge preserves its physical phase. */
export function interwarStreetPhase(startAlongM:number,endAlongM:number,lengthM:number,nominalPitchM:number):{projectionPhase:number;projectionStep:1|-1} {
  const projectionStep=endAlongM>=startAlongM?1:-1;
  const groups=Math.max(1,Math.round(lengthM/nominalPitchM));
  return {projectionPhase:Math.floor((startAlongM+projectionStep*lengthM/groups/2)/nominalPitchM),projectionStep};
}
