/** Coverage warnings are evidence tasks, never automatic frontage expansion. */
export function facadeCoverage(recipe:any){
 const front=recipe.frontages[0],width=front.width;
 const xs=recipe.footprint.map((p:number[])=>p[0]);
 const ownerSpan=Math.max(...xs)-Math.min(...xs);
 const uncoveredStreetWalls=recipe.sourceShell.surfaces.flatMap((s:any,index:number)=>{
  if(s.type!=='wall')return [];
  const points=s.rings.flat(),lo=Math.min(...points.map((p:number[])=>p[0])),hi=Math.max(...points.map((p:number[])=>p[0]));
  // Ignore rear widening and perpendicular party walls. A nearby parallel
  // street wall outside the selected interval warrants wider photo evidence.
  const depths=points.map((p:number[])=>p[1]),zs=points.map((p:number[])=>p[2]);
  const depthSpan=Math.max(...depths)-Math.min(...depths),alongSpan=hi-lo;
  const angleDegrees=Math.atan2(depthSpan,alongSpan)*180/Math.PI;
  const uncovered=Math.max(0,Math.min(hi,0)-lo)+Math.max(0,hi-Math.max(lo,width));
  return alongSpan>0&&angleDegrees<=15&&Math.max(...depths)<2&&Math.min(...depths)>-2&&uncovered>.5
   ?[{surfaceIndex:index,xRange:[lo,hi],depthRange:[Math.min(...depths),Math.max(...depths)],
      heightRange:[Math.min(...zs),Math.max(...zs)],angleDegrees,
      scope:Math.max(...zs)<=3?'low-extension':Math.min(...zs)>1.5?'upper-wall':'full-height-wall',
      uncoveredWidthM:uncovered}]:[];
 });
 return {frontageWidthM:width,ownerProjectedWidthM:ownerSpan,projectedWidthRatio:width/ownerSpan,
  status:width/ownerSpan<.8&&uncoveredStreetWalls.length?'partial-frontage-suspected':'no-partial-frontage-signal',
  uncoveredStreetWalls,policy:'Projected width is a warning, not measured photo coverage. Inspect wider evidence and split/repair frontage extraction before extending appearance.'};
}
