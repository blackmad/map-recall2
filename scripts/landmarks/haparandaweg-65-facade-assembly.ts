import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

type Colour = Parameters<BuildingTools['add']>[1];
type XY = [number, number];
export interface ObservedOpening {
  /** Coordinates in metres within the calibrated wall, bottom-left origin. */
  x: number; y: number; width: number; height: number;
  /** Actual observed subdivisions, never a generated residential grid. */
  horizontalBars?: number[]; verticalBars?: number[];
}
export interface CalibratedWall {
  origin: [number, number, number]; angle: number;
  width: number; height: number; thickness: number;
  openings: ObservedOpening[];
  /** Panel module remains explicit until source-plane calibration is available. */
  panelWidth: number; panelHeight: number;
}

export interface CalibratedBalcony {
  /** Front-left lower corner; local +Z points toward the street. */
  origin: [number, number, number]; angle: number;
  width: number; recessDepth: number;
  parapetHeight: number; parapetThickness: number;
  soffitHeight: number; soffitThickness: number;
  /** Explicit observed rail layout, relative to the lower corner. */
  railHeights: number[]; postPositions: number[];
  postTop: number; railThickness: number; railSetback: number;
}

/** Photo-supported balcony components only. The source shows a solid pink
 * parapet, exposed rail above it and yellow underside of the overhanging front.
 * Back-wall apertures and supporting volumes belong to the calibrated builder;
 * this assembly deliberately leaves the recess open rather than filling it.
 */
export function addHaparandaweg65RecessedBalcony(b:BuildingTools, p:CalibratedBalcony){
  const {origin,angle,width:w,recessDepth:d}=p;
  const values=[...origin,angle,w,d,p.parapetHeight,p.parapetThickness,p.soffitHeight,
    p.soffitThickness,p.postTop,p.railThickness,p.railSetback,...p.railHeights,...p.postPositions];
  if(!values.every(Number.isFinite)||Math.min(w,d,p.parapetHeight,p.parapetThickness,
    p.soffitThickness,p.railThickness)<=0||p.postTop<=p.parapetHeight
    ||p.soffitHeight-p.soffitThickness<=p.postTop||p.railSetback<0||p.railSetback>=d
    ||p.railHeights.some(y=>y<=p.parapetHeight||y>p.postTop)
    ||p.postPositions.some(x=>x<0||x>w))throw Error('Balcony needs calibrated open recess and rail dimensions');
  const box=(x:number,y:number,z:number,bw:number,bh:number,bd:number,c:Colour)=>{
    const g=new T.BoxGeometry(bw,bh,bd);g.translate(x,y,z);g.rotateY(angle);b.add(g,c,...origin);
  };
  box(w/2,p.parapetHeight/2,-p.parapetThickness/2,w,p.parapetHeight,p.parapetThickness,'pink');
  // Entire slab lies above the open recess; its downward face is the soffit.
  box(w/2,p.soffitHeight-p.soffitThickness/2,-d/2,w,p.soffitThickness,d,'gold');
  for(const y of p.railHeights)box(w/2,y,-p.railSetback,w,p.railThickness,p.railThickness,'frame');
  for(const x of p.postPositions)box(x,(p.parapetHeight+p.postTop)/2,-p.railSetback,
    p.railThickness,p.postTop-p.parapetHeight,p.railThickness,'frame');
}

/** SOURCE-ONLY assembly, not a registered whole-building builder.
 * Dimensions, native frontage and placement must come from future calibration.
 * No roof or rear volume is generated. See research.json HOLD conditions.
 */
export function addHaparandaweg65ObservedWall(b: BuildingTools, wall: CalibratedWall) {
  const {width:w,height:h,thickness:d,origin,angle}=wall;
  if (![...origin,angle,w,h,d,wall.panelWidth,wall.panelHeight].every(Number.isFinite)
      || Math.min(w,h,d,wall.panelWidth,wall.panelHeight)<=0) throw Error('Wall needs positive calibrated dimensions');
  const shape=new T.Shape([new T.Vector2(0,0),new T.Vector2(w,0),new T.Vector2(w,h),new T.Vector2(0,h)]);
  for (const p of wall.openings) {
    if (![p.x,p.y,p.width,p.height].every(Number.isFinite)||Math.min(p.width,p.height)<=0
        ||p.x<=0||p.y<=0||p.x+p.width>=w||p.y+p.height>=h) throw Error('Opening must lie inside its calibrated wall');
    shape.holes.push(new T.Path([new T.Vector2(p.x,p.y),new T.Vector2(p.x,p.y+p.height),
      new T.Vector2(p.x+p.width,p.y+p.height),new T.Vector2(p.x+p.width,p.y)]));
  }
  const add=(geometry:T.BufferGeometry,colour:Colour,x=0,y=0,z=0)=>{
    geometry.translate(x,y,z);geometry.rotateY(angle);
    b.add(geometry,colour,...origin);
  };
  const body=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});body.translate(0,0,-d);add(body,'pink');
  const box=(x:number,y:number,z:number,bw:number,bh:number,bd:number,c:Colour)=>add(new T.BoxGeometry(bw,bh,bd),c,x,y,z);
  // Physical apertures keep glazing visible: no opaque parent behind this wall.
  for(const p of wall.openings){
    add(new T.PlaneGeometry(p.width,p.height),'glass',p.x+p.width/2,p.y+p.height/2,-d*.25);
    const t=.055;
    for(const x of [p.x,p.x+p.width])box(x,p.y+p.height/2,.012,t,p.height+t,.04,'frame');
    for(const y of [p.y,p.y+p.height])box(p.x+p.width/2,y,.012,p.width+t,t,.04,'frame');
    for(const y of p.horizontalBars??[])if(y>0&&y<p.height)box(p.x+p.width/2,p.y+y,.017,p.width,t,.045,'frame');
    for(const x of p.verticalBars??[])if(x>0&&x<p.width)box(p.x+x,p.y+p.height/2,.017,t,p.height,.045,'frame');
  }
  // Trim each panel seam around openings instead of laying dark bars over glass.
  function segments(axis:'x'|'y',value:number,max:number){
    const blocked=wall.openings.filter(p=>axis==='x'?value>p.x&&value<p.x+p.width:value>p.y&&value<p.y+p.height)
      .map(p=>axis==='x'?[p.y,p.y+p.height]:[p.x,p.x+p.width]).sort((a,c)=>a[0]-c[0]);
    let start=0;const out:number[][]=[];
    for(const [a,c]of blocked){if(a>start)out.push([start,a]);start=Math.max(start,c);}
    if(start<max)out.push([start,max]);return out;
  }
  for(let x=wall.panelWidth;x<w;x+=wall.panelWidth)for(const [a,c]of segments('x',x,h))box(x,(a+c)/2,.005,.012,c-a,.01,'red');
  for(let y=wall.panelHeight;y<h;y+=wall.panelHeight)for(const [a,c]of segments('y',y,w))box((a+c)/2,y,.005,c-a,.012,.01,'red');
}

/** Native outline interpretation of the actual architectural numerals, from
 * unchanged 2021/2025 source photographs: square 6 with real lower counter,
 * open upper counter, and heavy diagonal 7. No font or pixel-letter substitute.
 * Stroke proportions are photo-guided approximations, not measured fabrication.
 * Caller supplies actual dimensions and facade-plane placement after calibration.
 */
export function addHaparandaweg65Numerals(b:BuildingTools,origin:[number,number,number],
  width:number,height:number,depth:number,angle:number){
  if(![...origin,width,height,depth,angle].every(Number.isFinite)||Math.min(width,height,depth)<=0)throw Error('67 needs calibrated dimensions');
  // Preserve the actual dark separation at the feet as well as at the heads.
  // The 7's diagonal foot reaches left of its head: offset the complete glyph,
  // then normalize the pair to the caller's overall calibrated sign width.
  const sevenOffset=.13, pairExtent=1+sevenOffset;
  function glyph(outline:XY[],holes:XY[][]=[],offset=0){
    const point=([x,y]:XY)=>new T.Vector2((x+offset)*width/pairExtent,y*height);
    const shape=new T.Shape(outline.map(point));
    for(const ring of holes)shape.holes.push(new T.Path(ring.map(point)));
    const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});g.rotateY(angle);b.add(g,'white',...origin);
  }
  glyph([[0,0],[.50,0],[.50,.55],[.20,.55],[.20,.79],[.50,.79],[.50,1],[0,1]],
    [[[.20,.20],[.20,.40],[.35,.40],[.35,.20]]]);
  glyph([[.55,1],[1,1],[.80,.55],[.91,.55],[.87,.39],[.73,.39],[.58,0],[.40,0],[.76,.79],[.55,.79]],[],sevenOffset);
}
