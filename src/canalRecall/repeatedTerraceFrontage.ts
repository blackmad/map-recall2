import type {InterwarLocalPoint} from './interwarFrontageLayout.js';
import type {RegularCanalRect,RegularCanalQuad,RegularCanalRole,RegularCanalPart} from './regularCanalFrontage.js';

/** Explicit observed tiers. The envelope never supplies floors or scales heights. */
export interface RepeatedTerraceRow {bottomM:number;heightM:number;widthM:number;axisWidthsM?:number[];paneColumns?:1|2;transomFraction?:number|false}
export interface RepeatedTerraceFrontageRecipe {
  columns:2|3;insetM:number;frameWidthM:number;sashWidthM?:number;recessDepthM:number;
  upperRows:RepeatedTerraceRow[];ground:RepeatedTerraceRow;
  entrance:{axisIndex:number;leafHeightM:number};
  /** Omit to glaze every other ground axis; [] leaves only the entrance. */
  groundWindowAxes?:number[];
  groundWindowRow?:RepeatedTerraceRow;
  /** Small pier/toilet lights have explicit source axes, not extra broad bays. */
  boundaryWindows?:{axisM:number;row:RepeatedTerraceRow}[];
  stringCourses?:{bottomM:number;heightM:number;projectionM:number}[];
  segmentalLintel?:{riseM:number;bandM:number;projectionM:number};
}
export type RepeatedTerraceRole=RegularCanalRole|'sash';
export type RepeatedTerracePart=RegularCanalPart|'sill'|'string-course'|'segmental-lintel';
export interface RepeatedTerraceQuad extends Omit<RegularCanalQuad,'role'|'part'> {role:RepeatedTerraceRole;part:RepeatedTerracePart}
export interface RepeatedTerraceWindow extends RegularCanalRect {out:number;part:RepeatedTerracePart;rowIndex:number;axisIndex:number}
export interface RepeatedTerraceFrontagePlan {
  axes:number[];windows:RepeatedTerraceWindow[];quads:RepeatedTerraceQuad[];
  cutRects:RegularCanalRect[];wallSegments:RegularCanalRect[];
  access:RegularCanalRect&{axis:number;out:number};
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const between=(v:number,lo:number,hi:number)=>Number.isFinite(v)&&v>=lo&&v<=hi;
const row=(v:RepeatedTerraceRow)=>object(v)&&between(v.bottomM,0,40)&&between(v.heightM,.6,4.5)&&between(v.widthM,.55,2.5)
  &&(v.axisWidthsM===undefined||Array.isArray(v.axisWidthsM)&&v.axisWidthsM.every(w=>between(w,.55,2.5)))
  &&(v.paneColumns===undefined||v.paneColumns===1||v.paneColumns===2)
  &&(v.transomFraction===undefined||v.transomFraction===false||between(v.transomFraction,.35,.85));
export function validateRepeatedTerraceFrontageRecipe(value:unknown):value is RepeatedTerraceFrontageRecipe {
  if(!object(value))return false;const r=value as unknown as RepeatedTerraceFrontageRecipe;
  if(![2,3].includes(r.columns)||!between(r.insetM,.12,1.2)||!between(r.frameWidthM,.035,.16)
    ||r.sashWidthM!==undefined&&!between(r.sashWidthM,.025,.09)||!between(r.recessDepthM,.06,.5)
    ||!Array.isArray(r.upperRows)||!between(r.upperRows.length,1,4)||!r.upperRows.every(row)||!row(r.ground)
    ||!object(r.entrance)||!Number.isInteger(r.entrance.axisIndex)||!between(r.entrance.axisIndex,0,r.columns-1)
    ||!between(r.entrance.leafHeightM,1.7,3.4)||r.entrance.leafHeightM>r.ground.heightM-.25)return false;
  if(r.groundWindowAxes!==undefined&&(!Array.isArray(r.groundWindowAxes)||new Set(r.groundWindowAxes).size!==r.groundWindowAxes.length
    ||r.groundWindowAxes.some(a=>!Number.isInteger(a)||!between(a,0,r.columns-1)||a===r.entrance.axisIndex)))return false;
  if(r.groundWindowRow!==undefined&&!row(r.groundWindowRow))return false;
  if([...r.upperRows,r.ground,...(r.groundWindowRow?[r.groundWindowRow]:[])].some(v=>v.axisWidthsM!==undefined&&v.axisWidthsM.length!==r.columns))return false;
  if(r.boundaryWindows!==undefined&&(!Array.isArray(r.boundaryWindows)||r.boundaryWindows.length>12||r.boundaryWindows.some(b=>!object(b)
    ||!between(b.axisM,.2,21.8)||!object(b.row)||!row({...b.row,widthM:.55})||!between(b.row.widthM,.28,.5))))return false;
  if(r.stringCourses!==undefined&&(!Array.isArray(r.stringCourses)||r.stringCourses.length>5||r.stringCourses.some(c=>!object(c)
    ||!between(c.bottomM,0,40)||!between(c.heightM,.04,.22)||!between(c.projectionM,.025,.18))))return false;
  const l=r.segmentalLintel;
  return l===undefined||object(l)&&between(l.riseM,.06,.3)&&between(l.bandM,.035,.16)&&between(l.projectionM,.025,.15);
}
const overlap=(a:RegularCanalRect,b:RegularCanalRect)=>Math.min(a.left+a.width,b.left+b.width)>Math.max(a.left,b.left)+1e-8
  &&Math.min(a.bottom+a.height,b.bottom+b.height)>Math.max(a.bottom,b.bottom)+1e-8;
function complement(width:number,base:number,top:number,cuts:RegularCanalRect[]):RegularCanalRect[]{
  const result:RegularCanalRect[]=[],xs=[0,width,...cuts.flatMap(c=>[c.left,c.left+c.width])].sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++){const x=xs[i],w=xs[i+1]-x;if(w<1e-8)continue;let z=base;
    const intervals=cuts.filter(c=>x>=c.left-1e-8&&x+w<=c.left+c.width+1e-8).map(c=>[c.bottom,c.bottom+c.height]).sort((a,b)=>a[0]-b[0]);
    for(const [lo,hi]of intervals){if(lo>z+1e-8)result.push({left:x,width:w,bottom:z,height:lo-z});z=Math.max(z,hi);}
    if(z<top-1e-8)result.push({left:x,width:w,bottom:z,height:top-z});
  }return result;
}

/** Atomic wall replacement only. Caller owns the surveyed envelope and any
 * source-selected shaped gable above its eave. No stoop, basement or crown. */
export function planRepeatedTerraceFrontage(input:{lengthM:number;baseM:number;topM:number;recipe:RepeatedTerraceFrontageRecipe;direction?:1|-1}):RepeatedTerraceFrontagePlan|undefined {
  const {lengthM:L,baseM:base,topM:top,recipe:r}=input;
  if(!between(L,3.4,22)||!Number.isFinite(base)||!Number.isFinite(top)||top<=base||!validateRepeatedTerraceFrontageRecipe(r)
    ||input.direction!==undefined&&input.direction!==1&&input.direction!==-1)return;
  const pitch=(L-2*r.insetM)/r.columns,axes=Array.from({length:r.columns},(_,i)=>r.insetM+pitch*(i+.5));
  const fw=r.frameWidthM,sw=r.sashWidthM??.04,back=-r.recessDepthM,sashOut=back+.025;
  const rect=(axis:number,v:RepeatedTerraceRow,ai?:number):RegularCanalRect=>{const width=ai===undefined?v.widthM:v.axisWidthsM?.[ai]??v.widthM;return {left:axis-width/2,bottom:base+v.bottomM,width,height:v.heightM};};
  const doorRect=rect(axes[r.entrance.axisIndex],r.ground,r.entrance.axisIndex);
  const plan:RepeatedTerraceFrontagePlan={axes,windows:[],quads:[],cutRects:[],wallSegments:[],access:{...doorRect,height:r.entrance.leafHeightM,axis:axes[r.entrance.axisIndex],out:back+.005}};
  const fits=(a:RegularCanalRect)=>a.left>=.05-1e-8&&a.left+a.width<=L-.05+1e-8&&a.bottom>=base-1e-8&&a.bottom+a.height<=top-.1+1e-8;
  const quad=(role:RepeatedTerraceRole,part:RepeatedTerracePart,points:RepeatedTerraceQuad['points'],normal:InterwarLocalPoint,rowIndex?:number,axisIndex?:number)=>{
    const uv:RepeatedTerraceQuad['uv']=[[0,0],[1,0],[1,1],[0,1]],a=points[0],b=points[1],c=points[2],u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(cross.reduce((s,n,i)=>s+n*normal[i],0)<0){[points[1],points[3]]=[points[3],points[1]];[uv[1],uv[3]]=[uv[3],uv[1]];}
    plan.quads.push({role,part,points,normal,uv,rowIndex,axisIndex});
  };
  const front=(role:RepeatedTerraceRole,part:RepeatedTerracePart,a:RegularCanalRect,out:number,ri?:number,ai?:number)=>
    quad(role,part,[[a.left,out,a.bottom],[a.left+a.width,out,a.bottom],[a.left+a.width,out,a.bottom+a.height],[a.left,out,a.bottom+a.height]],[0,1,0],ri,ai);
  const box=(part:RepeatedTerracePart,a:RegularCanalRect,out:number,depth:number)=>{
    const l=a.left,h=l+a.width,z=a.bottom,t=z+a.height,d=out-depth;front('stone',part,a,out);
    quad('stone',part,[[l,d,z],[h,d,z],[h,d,t],[l,d,t]],[0,-1,0]);
    quad('stone',part,[[l,d,z],[l,out,z],[l,out,t],[l,d,t]],[-1,0,0]);quad('stone',part,[[h,out,z],[h,d,z],[h,d,t],[h,out,t]],[1,0,0]);
    quad('stone',part,[[l,d,t],[h,d,t],[h,out,t],[l,out,t]],[0,0,1]);quad('stone',part,[[l,out,z],[h,out,z],[h,d,z],[l,d,z]],[0,0,-1]);
  };
  const ring=(role:'frame'|'sash',part:RepeatedTerracePart,a:RegularCanalRect,w:number,out:number,rear:number,ri:number,ai:number):RegularCanalRect=>{
    const l=a.left,h=l+a.width,z=a.bottom,t=z+a.height;
    for(const f of [{left:l,bottom:z,width:w,height:a.height},{left:h-w,bottom:z,width:w,height:a.height},{left:l+w,bottom:z,width:a.width-2*w,height:w},{left:l+w,bottom:t-w,width:a.width-2*w,height:w}])front(role,part,f,out,ri,ai);
    quad(role,'opening-reveal',[[l+w,out,z+w],[l+w,rear,z+w],[l+w,rear,t-w],[l+w,out,t-w]],[1,0,0],ri,ai);
    quad(role,'opening-reveal',[[h-w,rear,z+w],[h-w,out,z+w],[h-w,out,t-w],[h-w,rear,t-w]],[-1,0,0],ri,ai);
    quad(role,'opening-reveal',[[l+w,rear,z+w],[h-w,rear,z+w],[h-w,out,z+w],[l+w,out,z+w]],[0,0,1],ri,ai);
    quad(role,'opening-reveal',[[l+w,out,t-w],[h-w,out,t-w],[h-w,rear,t-w],[l+w,rear,t-w]],[0,0,-1],ri,ai);
    return {left:l+w,bottom:z+w,width:a.width-2*w,height:a.height-2*w};
  };
  let failed=false;
  const opening=(v:RepeatedTerraceRow,ai:number,ri:number,isDoor=false,boundaryAxis?:number)=>{
    const a=rect(boundaryAxis??axes[ai],v,boundaryAxis===undefined?ai:undefined),part=isDoor?'entrance-door':ri<0?'ground-window':'upper-window';
    const narrow=boundaryAxis!==undefined,outerWidth=narrow?Math.min(fw,.035):fw,innerWidth=narrow?Math.min(sw,.025):sw;
    if(!fits(a)||a.width>pitch-.18||a.width<=2*(outerWidth+innerWidth)+(narrow?.12:.3)||a.height<=2*(outerWidth+innerWidth)+.3){failed=true;return;}
    plan.cutRects.push(a);const outer=ring('frame',part,a,outerWidth,.035,sashOut,ri,ai),inner=ring('sash',part,outer,innerWidth,sashOut,back,ri,ai);
    const glass:RepeatedTerraceWindow={...inner,out:back+.005,part,rowIndex:ri,axisIndex:ai};
    if(isDoor){const split=base+v.bottomM+r.entrance.leafHeightM;
      if(split<=inner.bottom+.5||split>=inner.bottom+inner.height-.16){failed=true;return;}
      front('door',part,{...inner,height:split-inner.bottom-sw/2},back+.005,ri,ai);
      front('sash','entrance-transom',{left:inner.left,bottom:split-sw/2,width:inner.width,height:sw},sashOut,ri,ai);
      glass.bottom=split+sw/2;glass.height=inner.bottom+inner.height-glass.bottom;glass.part='entrance-transom';
    }else {
      if(v.transomFraction!==false)front('sash',part,{left:inner.left,bottom:inner.bottom+inner.height*(v.transomFraction??.7)-sw/2,width:inner.width,height:sw},sashOut,ri,ai);
      // Paired broad casements share a pale central mullion aligned with their
      // outer frame. Small explicit pier lights default to one glazed field.
      if((v.paneColumns??(narrow?1:2))===2){const mullionWidth=outerWidth*.7;
        front('frame',part,{left:inner.left+inner.width/2-mullionWidth/2,bottom:inner.bottom,width:mullionWidth,height:inner.height},.035,ri,ai);
      }
    }
    plan.windows.push(glass);front('glass',glass.part,glass,glass.out,ri,ai);
    if(!isDoor){const sill={left:a.left-.035,bottom:a.bottom-.075,width:a.width+.07,height:.075};
      if(!fits(sill)){failed=true;return;}box('sill',sill,.1,.13);
    }
    if(r.segmentalLintel){const c=r.segmentalLintel,t=a.bottom+a.height,n=8;
      if(t+c.riseM+c.bandM>top-.1){failed=true;return;}
      // A restrained segmented band follows a shallow observed arch; aperture
      // remains rectangular and no unsupported arch crown closes the wall.
      for(let k=0;k<n;k++){const x0=a.left+a.width*k/n,x1=a.left+a.width*(k+1)/n;
        const z0=t+c.riseM*Math.sin(Math.PI*k/n),z1=t+c.riseM*Math.sin(Math.PI*(k+1)/n);
        quad('stone','segmental-lintel',[[x0,c.projectionM,z0],[x1,c.projectionM,z1],[x1,c.projectionM,z1+c.bandM],[x0,c.projectionM,z0+c.bandM]],[0,1,0],ri,ai);
      }
    }
  };
  r.upperRows.forEach((v,ri)=>axes.forEach((_,ai)=>opening(v,ai,ri)));
  opening(r.ground,r.entrance.axisIndex,-1,true);
  for(const ai of r.groundWindowAxes??axes.map((_,i)=>i).filter(i=>i!==r.entrance.axisIndex))opening(r.groundWindowRow??r.ground,ai,-1);
  for(const [i,b]of (r.boundaryWindows??[]).entries())opening(b.row,r.columns+i,i,false,b.axisM);
  if(failed||plan.cutRects.some((a,i)=>plan.cutRects.slice(i+1).some(b=>overlap(a,b))))return;
  // Accessories must also fit as complete assemblies; never hide apertures.
  const trimRects:RegularCanalRect[]=[],courseBands:RegularCanalRect[]=[];
  for(const c of r.stringCourses??[]){const a={left:.05,width:L-.1,bottom:base+c.bottomM,height:c.heightM};
    if(!fits(a)||courseBands.some(b=>overlap(a,b)))return;courseBands.push(a);
    // Courses belong to masonry: continue through each wall pier, but stop at
    // every real door/window aperture rather than painting across the opening.
    const clippedCuts=plan.cutRects.filter(b=>overlap(a,b)).map(b=>{
      const bottom=Math.max(a.bottom,b.bottom),head=Math.min(a.bottom+a.height,b.bottom+b.height);
      return {...b,bottom,height:head-bottom};
    });
    for(const segment of complement(L,a.bottom,a.bottom+a.height,clippedCuts)){
      const left=Math.max(a.left,segment.left),right=Math.min(a.left+a.width,segment.left+segment.width);
      if(right-left<1e-8)continue;const piece={...segment,left,width:right-left};
      trimRects.push(piece);box('string-course',piece,c.projectionM,c.projectionM);
    }
  }
  // Reject lintels/sills colliding with another opening or course as a whole.
  for(const q of plan.quads.filter(q=>q.part==='sill'||q.part==='segmental-lintel')){
    const xs=q.points.map(p=>p[0]),zs=q.points.map(p=>p[2]);
    const a={left:Math.min(...xs),width:Math.max(...xs)-Math.min(...xs),bottom:Math.min(...zs),height:Math.max(...zs)-Math.min(...zs)};
    if(plan.cutRects.some(b=>overlap(a,b))||trimRects.some(b=>overlap(a,b)))return;
  }
  plan.wallSegments=complement(L,base,top,plan.cutRects);
  if(input.direction===-1){
    for(const a of [...plan.windows,...plan.cutRects,...plan.wallSegments,plan.access])a.left=L-a.left-a.width;
    plan.axes=axes.map(x=>L-x);plan.access.axis=L-plan.access.axis;
    for(const q of plan.quads){for(const p of q.points)p[0]=L-p[0];q.normal[0]=q.normal[0]===0?0:-q.normal[0];[q.points[1],q.points[3]]=[q.points[3],q.points[1]];[q.uv[1],q.uv[3]]=[q.uv[3],q.uv[1]];}
  }return plan;
}
