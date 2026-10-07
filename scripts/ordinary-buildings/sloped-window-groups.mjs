/** Original source-owned roof openings aligned to an actual measured plane.
 * Positions use metres on the roof; no BAG indices or source-image pixels. */
export function slopedWindowGroups(plane,alongXZ,groups){
 const norm=v=>{const m=Math.hypot(...v);return v.map(q=>q/m);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],n=norm([-plane[0],1,-plane[1]]),u=norm([alongXZ[0],plane[0]*alongXZ[0]+plane[1]*alongXZ[1],alongXZ[1]]);let v=norm(cross(n,u));if(v[1]<0)v=v.map(q=>-q);const windows=[];
 for(const group of groups){const [x,z]=group.lowerCenterXZ,base=[x,plane[0]*x+plane[1]*z+plane[2],z],at=(along,up,off)=>base.map((q,i)=>q+u[i]*along+v[i]*up+n[i]*off);
  for(let row=0;row<group.rows;row++){const bottom=row*(group.windowHeightMetres+group.rowGapMetres),top=bottom+group.windowHeightMetres,half=group.widthMetres/2,points=[at(-half,bottom,group.normalOffsetMetres),at(half,bottom,group.normalOffsetMetres),at(half,top,group.normalOffsetMetres),at(-half,top,group.normalOffsetMetres)];windows.push({group:group.group,row,points,normal:n,u,v,widthMetres:group.widthMetres,heightMetres:group.windowHeightMetres,paneCount:group.paneCount,atlasSlot:group.atlasSlot,frameWidthMetres:group.frameWidthMetres,normalOffsetMetres:group.normalOffsetMetres,center:at(0,bottom+group.windowHeightMetres/2,group.normalOffsetMetres)});}
 }
 return windows;
}
