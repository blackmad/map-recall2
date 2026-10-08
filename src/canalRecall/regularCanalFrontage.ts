import type {InterwarLocalPoint} from './interwarFrontageLayout.js';

/** A source-selected regular front, independent of surveyed identity/year and
 * of the envelope's crown owner. All vertical dimensions are metres above base;
 * the native wall is only a fit constraint, never a floor-count inference. */
export interface RegularCanalRow {
  bottomM:number;heightM:number;widthM:number;
  paneColumns:1|2|3;paneRows:1|2|3|4;
  transomFraction?:number;
}
export interface RegularCanalFrontageRecipe {
  columns:3;insetM:number;frameWidthM:number;recessDepthM:number;
  /** Generic relief panels from observed leaf structure, not exact carving. */
  doorPanels?:{columns:1|2;rows:2|3};
  /** Source-supported frontage trim below the existing envelope top. */
  cornice?:{heightM:number;projectionM:number;blockCount:number;blockWidthM:number;blockHeightM:number;blockProjectionM:number;
    hoist?:{widthM:number;heightM:number;projectionM:number}};
  upperRows:RegularCanalRow[];
  ground:RegularCanalRow;
  /** The left ground field contains a dark leaf below its glazed transom. */
  entrance:{leafHeightM:number;stepCount:number;treadM:number;landingDepthM:number;stairWidthM:number;railHeightM:number};
  basement:{heightM:number;access:{axisIndex:1|2;bottomM:number;heightM:number;widthM:number};window?:RegularCanalRow&{axisIndex:1|2}};
}
export interface RegularCanalRect {left:number;bottom:number;width:number;height:number}
export type RegularCanalRole='wall'|'glass'|'frame'|'door'|'door-panel'|'door-hardware'|'stone'|'rail';
export type RegularCanalPart='upper-window'|'ground-window'|'entrance-transom'|'entrance-door'|'lower-door'|'basement-window'|'opening-reveal'|'basement'|'stair'|'landing'|'rail'|'cornice'|'cornice-block'|'hoist';
export interface RegularCanalQuad {
  role:RegularCanalRole;part:RegularCanalPart;
  points:[InterwarLocalPoint,InterwarLocalPoint,InterwarLocalPoint,InterwarLocalPoint];
  normal:InterwarLocalPoint;uv:[[number,number],[number,number],[number,number],[number,number]];
  rowIndex?:number;axisIndex?:number;
}
export interface RegularCanalWindow extends RegularCanalRect {out:number;part:RegularCanalPart;rowIndex:number;axisIndex:number}
export interface RegularCanalFrontagePlan {
  axes:[number,number,number];windows:RegularCanalWindow[];quads:RegularCanalQuad[];
  /** Replace the native front with this complement before emitting quads. */
  cutRects:RegularCanalRect[];wallSegments:RegularCanalRect[];
  access:RegularCanalRect&{axis:number;out:number};lowerAccess:RegularCanalRect&{axis:number;out:number};
}
const finite=(...v:number[])=>v.every(Number.isFinite);
const between=(v:number,lo:number,hi:number)=>Number.isFinite(v)&&v>=lo&&v<=hi;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const validRow=(r:RegularCanalRow)=>object(r)&&between(r.bottomM,0,40)&&between(r.heightM,.35,5.8)&&between(r.widthM,.55,2.6)
  &&Number.isInteger(r.paneColumns)&&between(r.paneColumns,1,3)&&Number.isInteger(r.paneRows)&&between(r.paneRows,1,4)
  &&(r.transomFraction===undefined||between(r.transomFraction,.2,.85));
export function validateRegularCanalFrontageRecipe(value:unknown):value is RegularCanalFrontageRecipe {
  if(!object(value))return false;const r=value as unknown as RegularCanalFrontageRecipe;
  if(r.columns!==3||!between(r.insetM,.15,1.2)||!between(r.frameWidthM,.035,.16)||!between(r.recessDepthM,.04,.6)
    ||!Array.isArray(r.upperRows)||!between(r.upperRows.length,3,4)||!r.upperRows.every(validRow)||!validRow(r.ground)
    ||!object(r.entrance)||!object(r.basement)||!object(r.basement.access))return false;
  const e=r.entrance,b=r.basement,a=b.access;
  if(r.doorPanels!==undefined&&(!object(r.doorPanels)||![1,2].includes(r.doorPanels.columns)||![2,3].includes(r.doorPanels.rows)))return false;
  if(r.cornice!==undefined){const c=r.cornice;
    if(!object(c)||!between(c.heightM,.12,.6)||!between(c.projectionM,.15,.7)||!Number.isInteger(c.blockCount)||!between(c.blockCount,4,24)
      ||!between(c.blockWidthM,.08,.4)||!between(c.blockHeightM,.08,.4)||!between(c.blockProjectionM,.08,c.projectionM)
      ||c.hoist!==undefined&&(!object(c.hoist)||!between(c.hoist.widthM,.08,.25)||!between(c.hoist.heightM,.08,.25)||!between(c.hoist.projectionM,.4,1.5)))return false;
  }
  return between(e.leafHeightM,1.8,3.8)&&Number.isInteger(e.stepCount)&&between(e.stepCount,2,12)
    &&between(e.treadM,.18,.4)&&between(e.landingDepthM,.25,1.2)&&between(e.stairWidthM,.8,2.8)&&between(e.railHeightM,.7,1.2)
    &&between(b.heightM,.8,2.5)&&(a.axisIndex===1||a.axisIndex===2)&&between(a.bottomM,0,.3)&&between(a.heightM,1.2,2.5)&&between(a.widthM,.6,1.8)
    &&(b.window===undefined||(validRow(b.window)&&(b.window.axisIndex===1||b.window.axisIndex===2)));
}
const overlap=(a:RegularCanalRect,b:RegularCanalRect)=>Math.min(a.left+a.width,b.left+b.width)>Math.max(a.left,b.left)+1e-8
  &&Math.min(a.bottom+a.height,b.bottom+b.height)>Math.max(a.bottom,b.bottom)+1e-8;
function complement(left:number,width:number,bottom:number,top:number,cuts:RegularCanalRect[]):RegularCanalRect[]{
  const out:RegularCanalRect[]=[],xs=[left,left+width,...cuts.flatMap(c=>[c.left,c.left+c.width])].sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++){const x=xs[i],w=xs[i+1]-x;if(w<1e-8)continue;
    const intervals=cuts.filter(c=>x>=c.left-1e-8&&x+w<=c.left+c.width+1e-8).map(c=>[c.bottom,c.bottom+c.height]).sort((a,b)=>a[0]-b[0]);let z=bottom;
    for(const[lo,hi]of intervals){if(lo>z+1e-8)out.push({left:x,width:w,bottom:z,height:lo-z});z=Math.max(z,hi);}
    if(z<top-1e-8)out.push({left:x,width:w,bottom:z,height:top-z});
  }return out;
}

/** Atomic fit: no partial assembly, height scaling, roof plate or copied shaft.
 * Raised access is an approximate shared assembly, not a photogrammetric stair
 * reconstruction (source ground views can be occluded). */
export function planRegularCanalFrontage(input:{lengthM:number;baseM:number;topM:number;recipe:RegularCanalFrontageRecipe;direction?:1|-1}):RegularCanalFrontagePlan|undefined {
  const{lengthM:L,baseM:base,topM:top,recipe:r}=input;
  if(!finite(L,base,top)||!between(L,4,10)||top<=base||(input.direction!==undefined&&input.direction!==1&&input.direction!==-1)||!validateRegularCanalFrontageRecipe(r))return;
  const pitch=(L-2*r.insetM)/3,axes:[number,number,number]=[r.insetM+pitch*.5,r.insetM+pitch*1.5,r.insetM+pitch*2.5],fw=r.frameWidthM,back=-r.recessDepthM;
  const rect=(axis:number,row:{bottomM:number;heightM:number;widthM:number}):RegularCanalRect=>({left:axis-row.widthM/2,bottom:base+row.bottomM,width:row.widthM,height:row.heightM});
  const access={...rect(axes[0],{...r.ground,heightM:r.entrance.leafHeightM}),axis:axes[0],out:back};
  const lowerAccess={...rect(axes[r.basement.access.axisIndex],r.basement.access),axis:axes[r.basement.access.axisIndex],out:back};
  const plan:RegularCanalFrontagePlan={axes,windows:[],quads:[],cutRects:[],wallSegments:[],access,lowerAccess};
  const fits=(a:RegularCanalRect)=>a.left>=.05&&a.left+a.width<=L-.05&&a.bottom>=base&&a.bottom+a.height<=top-.1;
  // Taller ground and progressively shortening source tiers are a relationship,
  // not a uniformly repeated floor grid. Missing attic/crown is not synthesized.
  if(r.ground.heightM<=r.upperRows[0].heightM||r.ground.bottomM<r.basement.heightM
    ||r.entrance.leafHeightM>r.ground.heightM-.4||r.entrance.stairWidthM<r.ground.widthM+.10
    ||axes[0]-r.entrance.stairWidthM/2<.04||axes[0]+r.entrance.stairWidthM/2>L-.04
    ||r.upperRows.some((v,i)=>i>0&&(v.heightM>r.upperRows[i-1].heightM+.02||v.bottomM<r.upperRows[i-1].bottomM+r.upperRows[i-1].heightM+.12))
    ||r.upperRows[0].bottomM<r.ground.bottomM+r.ground.heightM+.15
    ||r.basement.access.bottomM+r.basement.access.heightM>r.basement.heightM-.04
    ||r.basement.window&&r.basement.window.bottomM+r.basement.window.heightM>r.basement.heightM-.04)return;
  const rise=r.ground.bottomM/r.entrance.stepCount;if(!between(rise,.12,.30))return;
  const quad=(role:RegularCanalRole,part:RegularCanalPart,points:RegularCanalQuad['points'],normal:InterwarLocalPoint,rowIndex?:number,axisIndex?:number)=>{
    const uv:RegularCanalQuad['uv']=[[0,0],[1,0],[1,1],[0,1]],a=points[0],b=points[1],c=points[2],u=b.map((v,i)=>v-a[i]),v=c.map((w,i)=>w-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(cross.reduce((sum,n,i)=>sum+n*normal[i],0)<0){[points[1],points[3]]=[points[3],points[1]];[uv[1],uv[3]]=[uv[3],uv[1]];}
    plan.quads.push({role,part,points,normal,uv,rowIndex,axisIndex});
  };
  const front=(role:RegularCanalRole,part:RegularCanalPart,a:RegularCanalRect,out:number,rowIndex?:number,axisIndex?:number)=>quad(role,part,[[a.left,out,a.bottom],[a.left+a.width,out,a.bottom],[a.left+a.width,out,a.bottom+a.height],[a.left,out,a.bottom+a.height]],[0,1,0],rowIndex,axisIndex);
  const box=(role:RegularCanalRole,part:RegularCanalPart,x:number,w:number,d:number,depth:number,z:number,h:number)=>{
    const right=x+w,far=d+depth,head=z+h;front(role,part,{left:x,width:w,bottom:z,height:h},far);
    quad(role,part,[[x,d,z],[right,d,z],[right,d,head],[x,d,head]],[0,-1,0]);
    quad(role,part,[[x,d,z],[x,far,z],[x,far,head],[x,d,head]],[-1,0,0]);quad(role,part,[[right,far,z],[right,d,z],[right,d,head],[right,far,head]],[1,0,0]);
    quad(role,part,[[x,d,head],[right,d,head],[right,far,head],[x,far,head]],[0,0,1]);quad(role,part,[[x,far,z],[right,far,z],[right,d,z],[x,d,z]],[0,0,-1]);
  };
  let failed=false;
  const opening=(a:RegularCanalRect,part:RegularCanalPart,axisIndex:number,rowIndex:number,row?:RegularCanalRow,doorHeight?:number)=>{
    if(!fits(a)||a.width>=pitch-.12||a.width<=2*fw+.25||a.height<=2*fw+.2){failed=true;return;}
    plan.cutRects.push({...a});const l=a.left,h=l+a.width,z=a.bottom,t=z+a.height;
    for(const f of [{left:l,bottom:z,width:fw,height:a.height},{left:h-fw,bottom:z,width:fw,height:a.height},{left:l+fw,bottom:z,width:a.width-2*fw,height:fw},{left:l+fw,bottom:t-fw,width:a.width-2*fw,height:fw}])front('frame',part,f,.035,rowIndex,axisIndex);
    // Four continuous reveals connect the cut support plane to the rear field.
    quad('frame','opening-reveal',[[l+fw,.035,z+fw],[l+fw,back,z+fw],[l+fw,back,t-fw],[l+fw,.035,t-fw]],[1,0,0]);
    quad('frame','opening-reveal',[[h-fw,back,z+fw],[h-fw,.035,z+fw],[h-fw,.035,t-fw],[h-fw,back,t-fw]],[-1,0,0]);
    quad('frame','opening-reveal',[[l+fw,back,z+fw],[h-fw,back,z+fw],[h-fw,.035,z+fw],[l+fw,.035,z+fw]],[0,0,1]);
    quad('frame','opening-reveal',[[l+fw,.035,t-fw],[h-fw,.035,t-fw],[h-fw,back,t-fw],[l+fw,back,t-fw]],[0,0,-1]);
    const glass={left:l+fw,bottom:z+fw,width:a.width-2*fw,height:a.height-2*fw,out:back+.008,part,rowIndex,axisIndex};
    if(doorHeight!==undefined){
      const leaf={...glass,height:doorHeight<a.height-fw?doorHeight-1.5*fw:doorHeight-2*fw};
      front('door',part,leaf,back+.008,rowIndex,axisIndex);
      if(r.doorPanels){
        const margin=fw*1.25,gap=fw*.8,cols=r.doorPanels.columns,rows=r.doorPanels.rows;
        const width=(leaf.width-2*margin-gap*(cols-1))/cols,height=(leaf.height-2*margin-gap*(rows-1))/rows;
        if(width<.12||height<.2){failed=true;return;}
        for(let c=0;c<cols;c++)for(let k=0;k<rows;k++)
          box('door-panel',part,leaf.left+margin+c*(width+gap),width,back+.008,.012,leaf.bottom+margin+k*(height+gap),height);
        // One handle per physical leaf, rather than a repeated atlas glyph in
        // every panel. Two leaves meet at the central stile.
        for(let c=0;c<cols;c++){
          const x=cols===1?leaf.left+leaf.width-margin*.6:leaf.left+leaf.width/2+(c===0?-fw*.65:fw*.30);
          box('door-hardware',part,x,fw*.35,back+.020,.014,leaf.bottom+leaf.height*.48,.16);
        }
      }
      if(doorHeight<a.height-fw){front('frame','entrance-transom',{left:glass.left,bottom:z+doorHeight-fw/2,width:glass.width,height:fw},back+.02);
        glass.bottom=z+doorHeight+fw/2;glass.height=t-fw-glass.bottom;glass.part='entrance-transom';
      }else return;
    }
    plan.windows.push(glass);front('glass',glass.part,glass,glass.out,rowIndex,axisIndex);
    const cols=row?.paneColumns??2,rows=row?.paneRows??1;
    for(let c=1;c<cols;c++)front('frame',glass.part,{left:glass.left+glass.width*c/cols-fw*.3,bottom:glass.bottom,width:fw*.6,height:glass.height},back+.02,rowIndex,axisIndex);
    const fractions=row?.transomFraction===undefined?Array.from({length:rows-1},(_,i)=>(i+1)/rows):[row.transomFraction];
    for(const fraction of fractions)front('frame',glass.part,{left:glass.left,bottom:glass.bottom+glass.height*fraction-fw*.3,width:glass.width,height:fw*.6},back+.02,rowIndex,axisIndex);
  };
  r.upperRows.forEach((row,rowIndex)=>axes.forEach((axis,axisIndex)=>opening(rect(axis,row),'upper-window',axisIndex,rowIndex,row)));
  axes.forEach((axis,axisIndex)=>opening(rect(axis,r.ground),axisIndex===0?'entrance-door':'ground-window',axisIndex,-1,axisIndex===0?undefined:r.ground,axisIndex===0?r.entrance.leafHeightM:undefined));
  opening(lowerAccess,'lower-door',r.basement.access.axisIndex,-2,undefined,r.basement.access.heightM);
  if(r.basement.window){const row=r.basement.window;opening(rect(axes[row.axisIndex],row),'basement-window',row.axisIndex,-2,row);}
  if(failed||plan.cutRects.some((a,i)=>plan.cutRects.slice(i+1).some(b=>overlap(a,b))))return;
  // Pale basement is a perforated connected field, not an overlay hiding access.
  for(const a of complement(0,L,base,base+r.basement.heightM,plan.cutRects.filter(c=>c.bottom<base+r.basement.heightM)))front('stone','basement',a,.008);
  const e=r.entrance,left=axes[0]-e.stairWidthM/2,landingY=base+r.ground.bottomM;
  box('stone','landing',left,e.stairWidthM,0,e.landingDepthM,base,r.ground.bottomM);
  for(let k=0;k<e.stepCount;k++){
    const d=e.landingDepthM+e.treadM*k,y=landingY-rise*k;
    box('stone','stair',left,e.stairWidthM,d,e.treadM,base,y-base);
  }
  // Open rails: thin connected posts and rails, no opaque parapet. Each flight
  // segment follows the tread axis; vertical joints connect successive levels.
  const rail=.045;
  for(const x of [left+rail/2,left+e.stairWidthM-rail*1.5]){
    box('rail','rail',x,rail,.04,rail,landingY,e.railHeightM);
    box('rail','rail',x,rail,.04,e.landingDepthM-.04,landingY+e.railHeightM-rail,rail);
    for(let k=0;k<e.stepCount;k++){
      const d=e.landingDepthM+e.treadM*k,y=landingY-rise*k;
      box('rail','rail',x,rail,d,rail,y,e.railHeightM);
      box('rail','rail',x,rail,d,e.treadM,y+e.railHeightM-rail,rail);
      if(k>0)box('rail','rail',x,rail,d,rail,y+e.railHeightM-rail,rise+rail);
    }
    const far=e.landingDepthM+e.treadM*e.stepCount;
    box('rail','rail',x,rail,far-rail,rail,base,e.railHeightM+rise);
  }
  const maxOut=Math.max(e.landingDepthM+e.treadM*e.stepCount,.025+(r.cornice?.projectionM??0),.025+(r.cornice?.hoist?.projectionM??0));
  if(r.cornice){
    const c=r.cornice,head=top-.1,bottom=head-c.heightM,pitch=L/c.blockCount;
    if(pitch<c.blockWidthM+.08||r.upperRows.some(row=>base+row.bottomM+row.heightM>bottom-c.blockHeightM-.1))return;
    box('stone','cornice',.025,L-.05,.025,c.projectionM,bottom,c.heightM);
    for(let k=0;k<c.blockCount;k++)box('stone','cornice-block',pitch*(k+.5)-c.blockWidthM/2,c.blockWidthM,.025,c.blockProjectionM,bottom-c.blockHeightM,c.blockHeightM);
    if(c.hoist)box('frame','hoist',L/2-c.hoist.widthM/2,c.hoist.widthM,.025,c.hoist.projectionM,head-c.hoist.heightM,c.hoist.heightM);
  }
  if(plan.quads.some(q=>q.points.some(([x,out,z])=>!finite(x,out,z)||x<0||x>L||out<back||out>maxOut+.01||z<base||z>top-.1)))return;
  plan.wallSegments=complement(0,L,base,top,plan.cutRects);
  if(input.direction===-1){
    for(const a of [...plan.windows,...plan.cutRects,...plan.wallSegments,plan.access,plan.lowerAccess])a.left=L-a.left-a.width;
    plan.axes=plan.axes.map(x=>L-x) as [number,number,number];plan.access.axis=L-plan.access.axis;plan.lowerAccess.axis=L-plan.lowerAccess.axis;
    for(const q of plan.quads){for(const p of q.points)p[0]=L-p[0];q.normal[0]=q.normal[0]===0?0:-q.normal[0];[q.points[1],q.points[3]]=[q.points[3],q.points[1]];[q.uv[1],q.uv[3]]=[q.uv[3],q.uv[1]];}
  }return plan;
}
