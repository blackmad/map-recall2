/** Source-selected shop glazing and a genuinely recessed residential portico.
 * The caller replaces the entire stock ground surface with wallSegments before
 * emitting these quads. Overlaying this plan on an uncut wall is incompatible. */
export interface InterwarGroundFrontageRecipe {
  entranceSide: 'left' | 'right';
  entranceWidthM: number;
  recessDepthM: number;
  edgePierM: number;
  separatorPierM: number;
  shopSillM: number;
  /** Height above the ground datum, independent of the building/roof height. */
  openingHeadM: number;
  shopPanes: number;
  /** Explicit source-selected customer entrance; absent never invents a shop door. */
  shopDoorPane?: number;
  frameWidthM: number;
  shopTransomFraction: number;
  frameHex?: string;
}
export type InterwarGroundPoint = [along: number, outward: number, elevation: number];
export type InterwarGroundRole = 'wall' | 'frame' | 'shopGlass' | 'shopDoor' | 'door';
export interface InterwarGroundRect {left:number;bottom:number;width:number;height:number}
export interface InterwarGroundCut extends InterwarGroundRect {kind:'shop'|'entrance'|'shopDoorThreshold'}
export interface InterwarGroundQuad {
  role: InterwarGroundRole;
  points: [InterwarGroundPoint,InterwarGroundPoint,InterwarGroundPoint,InterwarGroundPoint];
  normal: InterwarGroundPoint;
  /** Opening-local coordinates. Caller crops glass/door atlas fields, not a full stock facade cell. */
  uv: [[number,number],[number,number],[number,number],[number,number]];
  part: 'shop-pane'|'shop-door'|'shop-frame'|'portico-reveal'|'portico-soffit'|'portico-floor'|'door-back'|'door-frame';
}
export interface InterwarGroundFrontagePlan {
  /** World-elevation rectangles to subtract from the original ground wall. */
  cutRects: InterwarGroundCut[];
  /** Exact complementary wall rectangles; no wall surface covers any cut. */
  wallSegments: InterwarGroundRect[];
  quads: InterwarGroundQuad[];
  entrance: InterwarGroundCut;
  shop: InterwarGroundCut;
  doorBack: InterwarGroundRect & {out:number};
  shopDoor?: {paneIndex:number;threshold:InterwarGroundCut;opening:InterwarGroundRect};
}
const FRONT=.04;
export function validateInterwarGroundFrontageRecipe(value:unknown):value is InterwarGroundFrontageRecipe {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const r=value as InterwarGroundFrontageRecipe;
  if(![r.entranceWidthM,r.recessDepthM,r.edgePierM,r.separatorPierM,r.shopSillM,r.openingHeadM,r.shopPanes,r.frameWidthM,r.shopTransomFraction].every(Number.isFinite))return false;
  return ['left','right'].includes(r.entranceSide)
    &&r.entranceWidthM>=.75&&r.entranceWidthM<=1.8&&r.recessDepthM>=.25&&r.recessDepthM<=1.2
    &&r.edgePierM>=.08&&r.edgePierM<=.6&&r.separatorPierM>=.12&&r.separatorPierM<=.8
    &&r.shopSillM>=.03&&r.shopSillM<=.45&&r.openingHeadM>=2.1&&r.openingHeadM<=3.6
    &&Number.isInteger(r.shopPanes)&&r.shopPanes>=2&&r.shopPanes<=5
    &&(r.shopDoorPane===undefined||Number.isInteger(r.shopDoorPane)&&r.shopDoorPane>=0&&r.shopDoorPane<r.shopPanes)
    &&r.frameWidthM>=.035&&r.frameWidthM<=.12&&r.shopTransomFraction>=.65&&r.shopTransomFraction<=.9
    &&(r.frameHex===undefined||typeof r.frameHex==='string'&&/^#[a-f0-9]{6}$/i.test(r.frameHex));
}

/** Complete, bounded assembly or undefined; never truncate a doorway/glazing group. */
export function planInterwarGroundFrontage(input:{lengthM:number;baseM:number;groundM:number;recipe:InterwarGroundFrontageRecipe}):InterwarGroundFrontagePlan|undefined {
  const {lengthM:L,baseM:base,groundM,recipe:r}=input;
  if(![L,base,groundM].every(Number.isFinite)||!validateInterwarGroundFrontageRecipe(r))return;
  if(L<3.5||L>18||groundM<r.openingHeadM+.15||groundM>5)return;
  const shopWidth=L-2*r.edgePierM-r.separatorPierM-r.entranceWidthM;
  const fw=r.frameWidthM,paneWidth=(shopWidth-fw*(r.shopPanes+1))/r.shopPanes;
  if(shopWidth<2||paneWidth<.55||r.entranceWidthM-2*fw<.6)return;
  const entranceLeft=r.entranceSide==='left'?r.edgePierM:L-r.edgePierM-r.entranceWidthM;
  const shopLeft=r.entranceSide==='left'?entranceLeft+r.entranceWidthM+r.separatorPierM:r.edgePierM;
  const entrance:InterwarGroundCut={kind:'entrance',left:entranceLeft,bottom:base,width:r.entranceWidthM,height:r.openingHeadM};
  const shop:InterwarGroundCut={kind:'shop',left:shopLeft,bottom:base+r.shopSillM,width:shopWidth,height:r.openingHeadM-r.shopSillM};
  const shopDoor=r.shopDoorPane===undefined?undefined:{paneIndex:r.shopDoorPane,threshold:{kind:'shopDoorThreshold' as const,left:shop.left+r.shopDoorPane*(paneWidth+fw),bottom:base,width:paneWidth+2*fw,height:r.shopSillM},opening:{left:shop.left+r.shopDoorPane*(paneWidth+fw),bottom:base,width:paneWidth+2*fw,height:r.openingHeadM}};
  const cutRects=[entrance,shop,...(shopDoor?[shopDoor.threshold]:[])],wallSegments:InterwarGroundRect[]=[],quads:InterwarGroundQuad[]=[];
  // X slabs keep the exact complement, including shop plinth and common top wall.
  const boundaries=[0,L,...cutRects.flatMap(c=>[c.left,c.left+c.width])].sort((a,b)=>a-b);
  for(let i=0;i<boundaries.length-1;i++){
    const left=boundaries[i],width=boundaries[i+1]-left;if(width<=1e-8)continue;
    // Subtract the union of all holes in this slab, including the lowered
    // customer-door threshold touching the shared shop opening above it.
    const intervals=cutRects.filter(c=>left>=c.left-1e-8&&left+width<=c.left+c.width+1e-8)
      .map(c=>[c.bottom,c.bottom+c.height]).sort((a,b)=>a[0]-b[0]);
    let cursor=base;
    for(const [bottom,top] of intervals){
      if(bottom>cursor+1e-8)wallSegments.push({left,bottom:cursor,width,height:bottom-cursor});
      cursor=Math.max(cursor,top);
    }
    if(cursor<base+groundM-1e-8)wallSegments.push({left,bottom:cursor,width,height:base+groundM-cursor});
  }
  const quad=(role:InterwarGroundRole,part:InterwarGroundQuad['part'],points:InterwarGroundQuad['points'],normal:InterwarGroundPoint)=>{
    const uv:InterwarGroundQuad['uv']=[[0,0],[1,0],[1,1],[0,1]],a=points[0],b=points[1],c=points[2];
    const u=b.map((v,i)=>v-a[i]),v=c.map((w,i)=>w-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(cross.reduce((s,n,i)=>s+n*normal[i],0)<0){[points[1],points[3]]=[points[3],points[1]];[uv[1],uv[3]]=[uv[3],uv[1]];}
    quads.push({role,part,points,normal,uv});
  };
  const front=(role:InterwarGroundRole,part:InterwarGroundQuad['part'],l:number,h:number,z0:number,z1:number,out:number)=>quad(role,part,[[l,out,z0],[h,out,z0],[h,out,z1],[l,out,z1]],[0,1,0]);
  const framed=(role:'shopGlass'|'shopDoor'|'door',l:number,h:number,z0:number,z1:number,out:number,transom?:number)=>{
    const part=role==='door'?'door-frame':'shop-frame';
    front('frame',part,l,l+fw,z0,z1,out);front('frame',part,h-fw,h,z0,z1,out);
    front('frame',part,l+fw,h-fw,z0,z0+fw,out);front('frame',part,l+fw,h-fw,z1-fw,z1,out);
    front(role,role==='door'?'door-back':role==='shopDoor'?'shop-door':'shop-pane',l+fw,h-fw,z0+fw,z1-fw,out-.012);
    if(transom!==undefined)front('frame',part,l+fw,h-fw,transom-fw/2,transom+fw/2,out+.005);
  };
  // Separate broad panes share the same structural head/sill and pale mullions.
  const shopHead=shop.bottom+shop.height;
  for(let i=0;i<r.shopPanes;i++){
    const l=shop.left+i*(paneWidth+fw),h=l+paneWidth+2*fw;
    const isDoor=i===r.shopDoorPane;
    framed(isDoor?'shopDoor':'shopGlass',l,h,isDoor?base:shop.bottom,shopHead,FRONT,shop.bottom+shop.height*r.shopTransomFraction);
  }
  const el=entrance.left,er=el+entrance.width,head=base+entrance.height,back=-r.recessDepthM;
  // The true hole owns four inward facing reveals, not a facade-plane black panel.
  quad('wall','portico-reveal',[[el,0,base],[el,back,base],[el,back,head],[el,0,head]],[1,0,0]);
  quad('wall','portico-reveal',[[er,back,base],[er,0,base],[er,0,head],[er,back,head]],[-1,0,0]);
  quad('wall','portico-soffit',[[el,0,head],[er,0,head],[er,back,head],[el,back,head]],[0,0,-1]);
  quad('wall','portico-floor',[[el,back,base],[er,back,base],[er,0,base],[el,0,base]],[0,0,1]);
  // Closed textured back avoids invented interior rooms. Door framing sits inside the recess.
  framed('door',el,er,base,head,back+.02);
  return {cutRects,wallSegments,quads,entrance,shop,...(shopDoor?{shopDoor}:{}),doorBack:{left:el+fw,bottom:base+fw,width:r.entranceWidthM-2*fw,height:r.openingHeadM-2*fw,out:back+.008}};
}
