import { ExtraSink, type ExtraContext, type WallFrame } from './facadeExtraCore.js';
import { proceduralOpenings } from './facadeOpenings.js';

/** Merge only truly collinear adjacent facets, preserving surveyed bends and gaps. */
export function mergeCanopyFrames(frames: readonly WallFrame[]): WallFrame[] {
  const merged:WallFrame[]=[];
  for(const frame of frames){
    const previous=merged[merged.length-1];
    if(previous && Math.hypot(previous.x0+previous.ux*previous.len-frame.x0,previous.y0+previous.uy*previous.len-frame.y0)<1e-6
      && Math.hypot(previous.ux-frame.ux,previous.uy-frame.uy,previous.nx-frame.nx,previous.ny-frame.ny)<1e-6)previous.len+=frame.len;
    else merged.push({...frame});
  }
  return merged;
}

/** A rigid slab with a rounded dark nose above a pale fascia, across the full frontage. */
export function continuousShopCanopy(c: ExtraContext, sink: ExtraSink): void {
  const canopy=c.recipe?.shopCanopy;
  if(!canopy || c.streetSide!==true || !c.groundLevel || c.canopyOwner===false)return;
  const frames=mergeCanopyFrames(c.canopyFrames??[c.f]);
  if(!frames.length||frames.reduce((sum,f)=>sum+f.len,0)<2.5)return;
  const z=c.base+c.layout.groundM+(canopy.datumOffsetM??0);
  if(z+ .06>c.top||z-canopy.fasciaHeightM<c.base+2)return;
  const band=canopy.glassBlockBand,bandBottom=z+.08;
  if(band){
    const openings=c.openings??proceduralOpenings(c.style);
    // A full source assembly must fit between shop doors and residential windows.
    // Never shorten the glass band or paint it over an existing opening to make it fit.
    if(z-canopy.fasciaHeightM<c.base+c.layout.groundM*openings.door.top+.03
      ||bandBottom+band.heightM>Math.min(c.top,c.base+c.layout.groundM+c.layout.storeyM*openings.upper.sill)-.03)return;
  }
  const p=canopy.projectionM;
  sink.begin();
  let alongM=0;
  for(const [i,f] of frames.entries()){
    const previous=frames[i-1],next=frames[i+1];
    const adjacent=(a:WallFrame,b:WallFrame)=>Math.hypot(a.x0+a.ux*a.len-b.x0,a.y0+a.uy*a.len-b.y0)<1e-6&&a.ux*b.ux+a.uy*b.uy>.85;
    const joinedStart=previous&&adjacent(previous,f),joinedEnd=next&&adjacent(f,next);
    // Offset-line intersections close supported small surveyed bends. Interior caps are
    // omitted: both slabs/fascias meet on exactly the same miter plane.
    const join={startCap:!joinedStart,endCap:!joinedEnd,
      startSkew:joinedStart?(previous.nx*f.ux+previous.ny*f.uy)/(1+previous.ux*f.ux+previous.uy*f.uy):0,
      endSkew:joinedEnd?(next.nx*f.ux+next.ny*f.uy)/(1+next.ux*f.ux+next.uy*f.uy):0};
    // Six centimetre nose radius; three curve chords keep its rounded silhouette cheap.
    sink.wallProfile(f,[[.025,z-.06],[p-.06,z-.06],[p-.018,z-.042],[p,z],[p-.018,z+.042],[p-.06,z+.06],[.025,z+.06]],canopy.edgeHex,join);
    // Pale fascia sits below and behind the nose so both remain visible at street height.
    sink.wallProfile(f,[[p-.14,z-canopy.fasciaHeightM],[p-.06,z-canopy.fasciaHeightM],[p-.06,z-.06],[p-.14,z-.06]],canopy.fasciaHex,join);
    if(band){
      const out=.04,a=out*join.startSkew,b=f.len+out*join.endSkew;
      sink.glassBlockQuad(f,[[a,bandBottom],[b,bandBottom],[b,bandBottom+band.heightM],[a,bandBottom+band.heightM]],out,band.cellM,alongM,bandBottom);
    }
    alongM+=f.len;
  }
  sink.commit();
}
