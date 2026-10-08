import type {InterwarLocalPoint,InterwarMaterialRole} from './interwarFrontageLayout.js';

/** Source-selected metre positions relative to the native wall base. They never
 * rescale to a factual height or inherit the neighboring zone's floor axes. */
export interface CompoundMainRow {bottomM:number;heightM:number;transomFraction?:number}
export interface CompoundShaftRow extends CompoundMainRow {
  principalWidthM:number;sideLightWidthM:number;sideLightGapM:number;
  sideLightBottomOffsetM:number;sideLightHeightM:number;projectionM:number;
}
export interface CompoundFrontageRecipe {
  mainFraction:number;mainColumns:3;mainInsetM:number;mainWindowWidthM:number;mainFrameWidthM:number;
  mainRows:CompoundMainRow[];
  shaft:{
    axisFraction:number;frameWidthM:number;rows:CompoundShaftRow[];
    /** With a body, row/light projections are relative to its front face. */
    body?:{widthM:number;bottomM:number;topM:number;projectionM:number};
    /** The three tall narrow ground lights are not another principal/sidelight row. */
    groundLights:{bottomM:number;heightM:number;lightWidthM:number;gapM:number;projectionM:number};
    access:{bottomM:number;heightM:number;widthM:number;recessDepthM:number;frameWidthM:number};
    canopy:{bottomM:number;thicknessM:number;widthM:number;projectionM:number;
      /** Explicit layers beneath each end of the canopy; no guessed layer count. */
      corbels?:{widthM:number;layers:{heightM:number;projectionM:number}[]}};
  };
  groundSurround:{bottomM:number;heightM:number;openingBottomM:number;openingHeightM:number;
    openingWidthM:number;frameWidthM:number;projectionM:number;transomFraction?:number};
  basement?:{bottomM:number;heightM:number;widthM:number;frameWidthM:number;transomFraction?:number};
  /** Cornice top is the supplied wall top; it cannot infer or alter a roof. */
  cornice?:{heightM:number;projectionM:number;blockCount:number;blockWidthM:number;blockHeightM:number;blockProjectionM:number};
}
export type CompoundPart='main-window'|'shaft-principal'|'shaft-sidelight'|'shaft-ground-light'
  |'main-ground-window'|'ground-surround'|'access-door'|'access-frame'|'access-reveal'
  |'access-floor'|'access-head'|'access-canopy'|'access-corbel'|'basement-window'
  |'shaft-body'|'shaft-body-return'|'shaft-body-cap'|'cornice'|'cornice-block';
export interface CompoundRect {left:number;bottom:number;width:number;height:number}
export interface CompoundQuad {
  role:InterwarMaterialRole;part:CompoundPart;zone:'main'|'shaft';
  points:[InterwarLocalPoint,InterwarLocalPoint,InterwarLocalPoint,InterwarLocalPoint];
  normal:InterwarLocalPoint;uv:[[number,number],[number,number],[number,number],[number,number]];
  rowIndex?:number;axisIndex?:number;
}
export interface CompoundWindow extends CompoundRect {
  out:number;part:CompoundPart;zone:'main'|'shaft';rowIndex:number;axisIndex:number;
}
export interface CompoundFrontagePlan {
  mainZone:CompoundRect;shaftZone:CompoundRect;mainAxes:[number,number,number];shaftAxis:number;
  windows:CompoundWindow[];quads:CompoundQuad[];
  /** Caller must subtract all cuts from the ordinary parent wall, not overlay
   * these quads on an uncut wall. The returned complement makes that explicit. */
  cutRects:CompoundRect[];wallSegments:CompoundRect[];
  access:CompoundRect&{axis:number;out:number};canopy:CompoundRect&{axis:number;projectionM:number};
}
const FRONT=.045,GLASS_RECESS=.012;
const finite=(...v:number[])=>v.every(Number.isFinite);
const between=(v:number,lo:number,hi:number)=>Number.isFinite(v)&&v>=lo&&v<=hi;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const transom=(v:number|undefined)=>v===undefined||between(v,.55,.9);
const row=(r:CompoundMainRow)=>object(r)&&between(r.bottomM,0,60)&&between(r.heightM,.4,4)&&transom(r.transomFraction);
export function validateCompoundFrontageRecipe(value:unknown):value is CompoundFrontageRecipe {
  if(!object(value))return false;const r=value as unknown as CompoundFrontageRecipe;
  if(!between(r.mainFraction,.55,.85)||r.mainColumns!==3||!between(r.mainInsetM,.08,1.5)
    ||!between(r.mainWindowWidthM,.6,2.8)||!between(r.mainFrameWidthM,.035,.16)
    ||!Array.isArray(r.mainRows)||r.mainRows.length<1||r.mainRows.length>6||!r.mainRows.every(row)
    ||!object(r.shaft)||!object(r.groundSurround))return false;
  const s=r.shaft,g=r.groundSurround;
  if(!between(s.axisFraction,.2,.8)||!between(s.frameWidthM,.025,.12)
    ||!Array.isArray(s.rows)||s.rows.length<1||s.rows.length>6||!s.rows.every(v=>row(v)
      &&between(v.principalWidthM,.45,1.8)&&between(v.sideLightWidthM,.07,.4)&&between(v.sideLightGapM,.02,.5)
      &&between(v.sideLightBottomOffsetM,0,.7)&&between(v.sideLightHeightM,.3,4)&&between(v.projectionM,0,.7))
    ||!object(s.groundLights)||!object(s.access)||!object(s.canopy))return false;
  const l=s.groundLights,a=s.access,c=s.canopy;
  if(!between(l.bottomM,0,60)||!between(l.heightM,.4,3)||!between(l.lightWidthM,.09,.5)
    ||!between(l.gapM,.04,.7)||!between(l.projectionM,0,.7)
    ||!between(a.bottomM,0,2)||!between(a.heightM,1.8,3.5)||!between(a.widthM,.7,1.8)
    ||!between(a.recessDepthM,0,1.2)||!between(a.frameWidthM,.035,.2)
    ||!between(c.bottomM,0,60)||!between(c.thicknessM,.08,.5)||!between(c.widthM,1,3.5)||!between(c.projectionM,.2,1.3))return false;
  if(c.corbels!==undefined&&(!object(c.corbels)||!between(c.corbels.widthM,.08,.5)
    ||!Array.isArray(c.corbels.layers)||c.corbels.layers.length<1||c.corbels.layers.length>6
    ||!c.corbels.layers.every(v=>object(v)&&between(v.heightM,.05,.4)&&between(v.projectionM,.08,c.projectionM))))return false;
  if(s.body!==undefined&&(!object(s.body)||!between(s.body.widthM,1,5)||!between(s.body.bottomM,0,60)
    ||!between(s.body.topM,.5,60)||s.body.topM<=s.body.bottomM||!between(s.body.projectionM,.03,.6)))return false;
  if(r.basement!==undefined&&(!object(r.basement)||!between(r.basement.bottomM,0,3)||!between(r.basement.heightM,.3,1.8)
    ||!between(r.basement.widthM,.6,2.8)||!between(r.basement.frameWidthM,.035,.16)||!transom(r.basement.transomFraction)))return false;
  if(r.cornice!==undefined&&(!object(r.cornice)||!between(r.cornice.heightM,.1,.8)||!between(r.cornice.projectionM,.08,.8)
    ||!Number.isInteger(r.cornice.blockCount)||!between(r.cornice.blockCount,3,40)||!between(r.cornice.blockWidthM,.08,.6)
    ||!between(r.cornice.blockHeightM,.08,.5)||!between(r.cornice.blockProjectionM,.05,r.cornice.projectionM)))return false;
  return between(g.bottomM,0,10)&&between(g.heightM,1,5)&&between(g.openingBottomM,0,10)
    &&between(g.openingHeightM,.6,4)&&between(g.openingWidthM,.6,2.8)
    &&between(g.frameWidthM,.12,.55)&&between(g.projectionM,.04,.6)&&transom(g.transomFraction);
}
function overlap(a:CompoundRect,b:CompoundRect){return Math.min(a.left+a.width,b.left+b.width)>Math.max(a.left,b.left)+1e-8
  &&Math.min(a.bottom+a.height,b.bottom+b.height)>Math.max(a.bottom,b.bottom)+1e-8;}
function complement(L:number,base:number,top:number,cuts:CompoundRect[]):CompoundRect[]{
  const segments:CompoundRect[]=[],xs=[0,L,...cuts.flatMap(c=>[c.left,c.left+c.width])].sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++){const left=xs[i],width=xs[i+1]-left;if(width<=1e-8)continue;
    const intervals=cuts.filter(c=>left>=c.left-1e-8&&left+width<=c.left+c.width+1e-8)
      .map(c=>[c.bottom,c.bottom+c.height]).sort((a,b)=>a[0]-b[0]);let z=base;
    for(const[lo,hi]of intervals){if(lo>z+1e-8)segments.push({left,bottom:z,width,height:lo-z});z=Math.max(z,hi);}
    if(z<top-1e-8)segments.push({left,bottom:z,width,height:top-z});
  }return segments;
}
/** One complete compound facade. Native envelope is a fit constraint, never a
 * recipe inference input. Incompatible zones/rows/access return undefined. */
export function planCompoundFrontage(input:{lengthM:number;baseM:number;topM:number;recipe:CompoundFrontageRecipe;direction?:1|-1}):CompoundFrontagePlan|undefined {
  const{lengthM:L,baseM:base,topM:top,recipe:r}=input;
  if((input.direction!==undefined&&input.direction!==1&&input.direction!==-1)
    ||!finite(L,base,top)||L<6||L>30||top<=base||!validateCompoundFrontageRecipe(r))return;
  const split=L*r.mainFraction,H=top-base,s=r.shaft,g=r.groundSurround;
  const span=split-2*r.mainInsetM,pitch=span/3;
  if(pitch-r.mainWindowWidthM<.18||pitch-g.openingWidthM<g.frameWidthM)return;
  const axes:[number,number,number]=[r.mainInsetM+pitch*.5,r.mainInsetM+pitch*1.5,r.mainInsetM+pitch*2.5];
  const shaftAxis=split+(L-split)*s.axisFraction;
  const access:CompoundFrontagePlan['access']={left:shaftAxis-s.access.widthM/2,bottom:base+s.access.bottomM,width:s.access.widthM,height:s.access.heightM,axis:shaftAxis,out:-s.access.recessDepthM+.008};
  const canopy:CompoundFrontagePlan['canopy']={left:shaftAxis-s.canopy.widthM/2,bottom:base+s.canopy.bottomM,width:s.canopy.widthM,height:s.canopy.thicknessM,axis:shaftAxis,projectionM:s.canopy.projectionM};
  const plan:CompoundFrontagePlan={mainZone:{left:0,bottom:base,width:split,height:H},shaftZone:{left:split,bottom:base,width:L-split,height:H},mainAxes:axes,shaftAxis,windows:[],quads:[],cutRects:[],wallSegments:[],access,canopy};
  const fits=(a:CompoundRect,zone:'main'|'shaft')=>a.left>=(zone==='main'?0:split)+.025&&a.left+a.width<=(zone==='main'?split:L)-.025&&a.bottom>=base&&a.bottom+a.height<=top-.10;
  if(!fits(access,'shaft')||!fits(canopy,'shaft')||canopy.width<access.width+.12||s.access.heightM<=2*s.access.frameWidthM+.5
    ||s.access.widthM<=2*s.access.frameWidthM+.4
    ||canopy.bottom<access.bottom+access.height+.06||s.groundLights.bottomM<s.canopy.bottomM+s.canopy.thicknessM+.08)return;
  if(g.openingBottomM<g.bottomM+g.frameWidthM||g.openingBottomM+g.openingHeightM>g.bottomM+g.heightM-g.frameWidthM)return;
  // The pale surround is a connected field, with its own sill/header/piers.
  const surround:CompoundRect={left:axes[0]-g.openingWidthM/2-g.frameWidthM,bottom:base+g.bottomM,width:axes[2]-axes[0]+g.openingWidthM+2*g.frameWidthM,height:g.heightM};
  if(!fits(surround,'main')||r.mainRows.some(v=>v.bottomM<g.bottomM+g.heightM+.10)
    ||s.rows.some(v=>v.bottomM<s.groundLights.bottomM+s.groundLights.heightM+.10))return;
  const quad=(role:InterwarMaterialRole,part:CompoundPart,zone:'main'|'shaft',points:CompoundQuad['points'],normal:InterwarLocalPoint,rowIndex?:number,axisIndex?:number)=>{
    const uv:CompoundQuad['uv']=[[0,0],[1,0],[1,1],[0,1]],a=points[0],b=points[1],c=points[2],u=b.map((v,i)=>v-a[i]),v=c.map((w,i)=>w-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(cross.reduce((sum,n,i)=>sum+n*normal[i],0)<0){[points[1],points[3]]=[points[3],points[1]];[uv[1],uv[3]]=[uv[3],uv[1]];}
    plan.quads.push({role,part,zone,points,normal,uv,rowIndex,axisIndex});
  };
  const front=(role:InterwarMaterialRole,part:CompoundPart,zone:'main'|'shaft',a:CompoundRect,out:number,rowIndex?:number,axisIndex?:number)=>
    quad(role,part,zone,[[a.left,out,a.bottom],[a.left+a.width,out,a.bottom],[a.left+a.width,out,a.bottom+a.height],[a.left,out,a.bottom+a.height]],[0,1,0],rowIndex,axisIndex);
  let failed=false;
  const body=s.body?{left:shaftAxis-s.body.widthM/2,bottom:base+s.body.bottomM,width:s.body.widthM,height:s.body.topM-s.body.bottomM}:undefined;
  const bodyOut=s.body?FRONT+s.body.projectionM:0;
  if(body&&(!fits(body,'shaft')||body.bottom<canopy.bottom+canopy.height+.04))return;
  const shaftCuts:CompoundRect[]=[];
  const opening=(part:CompoundPart,zone:'main'|'shaft',a:CompoundRect,fw:number,projection:number,transomFraction:number|undefined,rowIndex:number,axisIndex:number)=>{
    if(!fits(a,zone)||a.width<2*fw+.045||a.height<2*fw+.1){failed=true;return;}
    const startOut=zone==='shaft'&&body?bodyOut:0,out=(startOut||FRONT)+projection,glass:CompoundWindow={left:a.left+fw,bottom:a.bottom+fw,width:a.width-2*fw,height:a.height-2*fw,out:out-GLASS_RECESS,part,zone,rowIndex,axisIndex};
    plan.cutRects.push({...a});if(zone==='shaft')shaftCuts.push({...a});plan.windows.push(glass);front('glass',part,zone,glass,glass.out,rowIndex,axisIndex);
    for(const f of [{left:a.left,bottom:a.bottom,width:fw,height:a.height},{left:a.left+a.width-fw,bottom:a.bottom,width:fw,height:a.height},{left:a.left+fw,bottom:a.bottom,width:a.width-2*fw,height:fw},{left:a.left+fw,bottom:a.bottom+a.height-fw,width:a.width-2*fw,height:fw}])front('frame',part,zone,f,out,rowIndex,axisIndex);
    if(transomFraction!==undefined)front('frame',part,zone,{left:glass.left,bottom:a.bottom+a.height*transomFraction-fw/2,width:glass.width,height:fw},out+.004,rowIndex,axisIndex);
    if(projection>0){const l=a.left,h=l+a.width,z=a.bottom,t=z+a.height;
      quad('frame',part,zone,[[l,startOut,z],[l,out,z],[l,out,t],[l,startOut,t]],[-1,0,0],rowIndex,axisIndex);
      quad('frame',part,zone,[[h,out,z],[h,startOut,z],[h,startOut,t],[h,out,t]],[1,0,0],rowIndex,axisIndex);
      quad('frame',part,zone,[[l,startOut,z],[h,startOut,z],[h,out,z],[l,out,z]],[0,0,-1],rowIndex,axisIndex);
      quad('frame',part,zone,[[l,out,t],[h,out,t],[h,startOut,t],[l,startOut,t]],[0,0,1],rowIndex,axisIndex);
    }
  };
  r.mainRows.forEach((v,rowIndex)=>axes.forEach((x,axisIndex)=>opening('main-window','main',{left:x-r.mainWindowWidthM/2,bottom:base+v.bottomM,width:r.mainWindowWidthM,height:v.heightM},r.mainFrameWidthM,0,v.transomFraction,rowIndex,axisIndex)));
  s.rows.forEach((v,rowIndex)=>{
    opening('shaft-principal','shaft',{left:shaftAxis-v.principalWidthM/2,bottom:base+v.bottomM,width:v.principalWidthM,height:v.heightM},s.frameWidthM,v.projectionM,v.transomFraction,rowIndex,0);
    const centerOffset=v.principalWidthM/2+v.sideLightGapM+v.sideLightWidthM/2;
    for(const[axisIndex,sign]of[[-1,-1],[1,1]])opening('shaft-sidelight','shaft',{left:shaftAxis+sign*centerOffset-v.sideLightWidthM/2,bottom:base+v.bottomM+v.sideLightBottomOffsetM,width:v.sideLightWidthM,height:v.sideLightHeightM},s.frameWidthM,v.projectionM,undefined,rowIndex,axisIndex);
  });
  const l=s.groundLights;for(let axisIndex=0;axisIndex<3;axisIndex++)opening('shaft-ground-light','shaft',{left:shaftAxis+(axisIndex-1)*(l.lightWidthM+l.gapM)-l.lightWidthM/2,bottom:base+l.bottomM,width:l.lightWidthM,height:l.heightM},s.frameWidthM,l.projectionM,undefined,-1,axisIndex);
  // Connected head/sill plus full-height pale piers; apertures remain free.
  const groundOpenings=axes.map(x=>({left:x-g.openingWidthM/2,bottom:base+g.openingBottomM,width:g.openingWidthM,height:g.openingHeightM}));
  const groundBottom=base+g.openingBottomM,groundTop=groundBottom+g.openingHeightM;
  front('frame','ground-surround','main',{left:surround.left,bottom:surround.bottom,width:surround.width,height:groundBottom-surround.bottom},FRONT+g.projectionM);
  front('frame','ground-surround','main',{left:surround.left,bottom:groundTop,width:surround.width,height:surround.bottom+surround.height-groundTop},FRONT+g.projectionM);
  let pierStart=surround.left;
  for(const a of groundOpenings){front('frame','ground-surround','main',{left:pierStart,bottom:groundBottom,width:a.left-pierStart,height:g.openingHeightM},FRONT+g.projectionM);pierStart=a.left+a.width;}
  front('frame','ground-surround','main',{left:pierStart,bottom:groundBottom,width:surround.left+surround.width-pierStart,height:g.openingHeightM},FRONT+g.projectionM);
  const sl=surround.left,sr=sl+surround.width,sb=surround.bottom,st=sb+surround.height,so=FRONT+g.projectionM;
  quad('frame','ground-surround','main',[[sl,0,sb],[sl,so,sb],[sl,so,st],[sl,0,st]],[-1,0,0]);
  quad('frame','ground-surround','main',[[sr,so,sb],[sr,0,sb],[sr,0,st],[sr,so,st]],[1,0,0]);
  quad('frame','ground-surround','main',[[sl,0,sb],[sr,0,sb],[sr,so,sb],[sl,so,sb]],[0,0,-1]);
  quad('frame','ground-surround','main',[[sl,so,st],[sr,so,st],[sr,0,st],[sl,0,st]],[0,0,1]);
  groundOpenings.forEach((a,axisIndex)=>opening('main-ground-window','main',a,Math.min(r.mainFrameWidthM,g.frameWidthM),g.projectionM,g.transomFraction,-1,axisIndex));
  if(r.basement){const b=r.basement;if(b.bottomM+b.heightM>g.bottomM-.08)return;
    axes.forEach((x,axisIndex)=>opening('basement-window','main',{left:x-b.widthM/2,bottom:base+b.bottomM,width:b.widthM,height:b.heightM},b.frameWidthM,0,b.transomFraction,-2,axisIndex));
  }
  plan.cutRects.push({left:access.left,bottom:access.bottom,width:access.width,height:access.height});
  const a=access,fw=s.access.frameWidthM,back=access.out,al=a.left,ar=a.left+a.width,az=a.bottom,at=az+a.height;
  // Dark back leaf uses cap material; semantic access-door permits atlas choice.
  front('cap','access-door','shaft',{left:al+fw,bottom:az+fw,width:a.width-2*fw,height:a.height-2*fw},back);
  for(const f of [{left:al,bottom:az,width:fw,height:a.height},{left:ar-fw,bottom:az,width:fw,height:a.height},{left:al+fw,bottom:az,width:a.width-2*fw,height:fw},{left:al+fw,bottom:at-fw,width:a.width-2*fw,height:fw}])front('frame','access-frame','shaft',f,back+.012);
  if(s.access.recessDepthM>0){const rear=-s.access.recessDepthM;
    quad('wall','access-reveal','shaft',[[al,0,az],[al,rear,az],[al,rear,at],[al,0,at]],[1,0,0]);quad('wall','access-reveal','shaft',[[ar,rear,az],[ar,0,az],[ar,0,at],[ar,rear,at]],[-1,0,0]);
    quad('wall','access-head','shaft',[[al,0,at],[ar,0,at],[ar,rear,at],[al,rear,at]],[0,0,-1]);quad('wall','access-floor','shaft',[[al,rear,az],[ar,rear,az],[ar,0,az],[al,0,az]],[0,0,1]);
  }
  const box=(part:CompoundPart,left:number,width:number,bottom:number,height:number,projection:number)=>{
    const right=left+width,head=bottom+height,out=FRONT+projection;front('frame',part,'shaft',{left,bottom,width,height},out);
    quad('frame',part,'shaft',[[left,0,bottom],[left,out,bottom],[left,out,head],[left,0,head]],[-1,0,0]);quad('frame',part,'shaft',[[right,out,bottom],[right,0,bottom],[right,0,head],[right,out,head]],[1,0,0]);
    quad('frame',part,'shaft',[[left,0,bottom],[right,0,bottom],[right,out,bottom],[left,out,bottom]],[0,0,-1]);quad('frame',part,'shaft',[[left,out,head],[right,out,head],[right,0,head],[left,0,head]],[0,0,1]);
  };
  box('access-canopy',canopy.left,canopy.width,canopy.bottom,canopy.height,canopy.projectionM);
  if(s.canopy.corbels){const c=s.canopy.corbels,total=c.layers.reduce((sum,v)=>sum+v.heightM,0);if(canopy.bottom-total<access.bottom||(canopy.width-access.width)/2<c.widthM+.03)failed=true;
    let bottom=canopy.bottom-total;for(const v of c.layers){for(const left of [canopy.left,canopy.left+canopy.width-c.widthM])box('access-corbel',left,c.widthM,bottom,v.heightM,v.projectionM);bottom+=v.heightM;}
  }
  if(body){
    if(shaftCuts.some(a=>a.left<body.left+.04||a.left+a.width>body.left+body.width-.04||a.bottom<body.bottom+.04||a.bottom+a.height>body.bottom+body.height-.04))return;
    const ownSegments=complement(body.width,body.bottom,body.bottom+body.height,shaftCuts.map(a=>({...a,left:a.left-body.left})));
    for(const a of ownSegments)front('wall','shaft-body','shaft',{...a,left:a.left+body.left},bodyOut);
    const l=body.left,h=l+body.width,z=body.bottom,t=z+body.height;
    quad('wall','shaft-body-return','shaft',[[l,0,z],[l,bodyOut,z],[l,bodyOut,t],[l,0,t]],[-1,0,0]);
    quad('wall','shaft-body-return','shaft',[[h,bodyOut,z],[h,0,z],[h,0,t],[h,bodyOut,t]],[1,0,0]);
    quad('wall','shaft-body-cap','shaft',[[l,0,z],[h,0,z],[h,bodyOut,z],[l,bodyOut,z]],[0,0,-1]);
    quad('wall','shaft-body-cap','shaft',[[l,bodyOut,t],[h,bodyOut,t],[h,0,t],[l,0,t]],[0,0,1]);
  }
  if(r.cornice){const c=r.cornice,bottom=top-c.heightM;
    if(c.blockWidthM>=L/c.blockCount-.04||plan.quads.some(q=>q.points.some(p=>p[2]>bottom-c.blockHeightM-.04)))return;
    const crownBox=(part:'cornice'|'cornice-block',l:number,w:number,z:number,h:number,projection:number)=>{
      const r=l+w,t=z+h,out=FRONT+projection;front('frame',part,'main',{left:l,bottom:z,width:w,height:h},out);
      quad('frame',part,'main',[[l,0,z],[l,out,z],[l,out,t],[l,0,t]],[-1,0,0]);quad('frame',part,'main',[[r,out,z],[r,0,z],[r,0,t],[r,out,t]],[1,0,0]);
      quad('frame',part,'main',[[l,0,z],[r,0,z],[r,out,z],[l,out,z]],[0,0,-1]);quad('frame',part,'main',[[l,out,t],[r,out,t],[r,0,t],[l,0,t]],[0,0,1]);
    };
    crownBox('cornice',0,L,bottom,c.heightM,c.projectionM);
    for(let k=0;k<c.blockCount;k++)crownBox('cornice-block',(k+.5)*L/c.blockCount-c.blockWidthM/2,c.blockWidthM,bottom-c.blockHeightM,c.blockHeightM,c.blockProjectionM);
  }
  if(failed||plan.cutRects.some((a,i)=>plan.cutRects.slice(i+1).some(b=>overlap(a,b))))return;
  // Validate the complete emitted surface envelope, including sidelight rows,
  // corbel layers and projection returns, instead of silently clipping pieces.
  if(plan.quads.some(q=>q.points.some(([x,out,z])=>!finite(x,out,z)||x<0||x>L||z<base||z>(r.cornice?top:top-.1)||out< -s.access.recessDepthM||out>1.5)))return;
  if(body){plan.cutRects=plan.cutRects.filter(a=>!shaftCuts.some(b=>a.left===b.left&&a.bottom===b.bottom&&a.width===b.width&&a.height===b.height));plan.cutRects.push({...body});
    if(plan.cutRects.some((a,i)=>plan.cutRects.slice(i+1).some(b=>overlap(a,b))))return;
  }
  plan.wallSegments=complement(L,base,top,plan.cutRects);
  if(input.direction===-1){
    const mirrorRect=(a:CompoundRect)=>{a.left=L-a.left-a.width;};
    for(const a of [plan.mainZone,plan.shaftZone,...plan.windows,...plan.cutRects,...plan.wallSegments,plan.access,plan.canopy])mirrorRect(a);
    plan.mainAxes=plan.mainAxes.map(x=>L-x) as [number,number,number];
    plan.shaftAxis=L-plan.shaftAxis;plan.access.axis=L-plan.access.axis;plan.canopy.axis=L-plan.canopy.axis;
    for(const q of plan.quads){
      for(const p of q.points)p[0]=L-p[0];
      q.normal[0]=q.normal[0]===0?0:-q.normal[0];
      // Reflection reverses handedness. Reverse the vertex order together with
      // its UV associations, preserving source-directed texture coordinates.
      [q.points[1],q.points[3]]=[q.points[3],q.points[1]];
      [q.uv[1],q.uv[3]]=[q.uv[3],q.uv[1]];
    }
  }
  return plan;
}
