/** Original small reusable native facade assemblies. No source photo pixels/imported mesh. Units metres.
 * Frame owns placement in the surveyed native edge plane: point(x,y,depth), uv(x,y), outward.
 * Returned quads preserve material grouping so callers can merge into <=3 existing materials.
 */
export function archedTopAt(fraction,{bottom,height,crownRise=0}){return bottom+height-crownRise+crownRise*Math.sqrt(Math.max(0,1-(2*fraction-1)**2));}
export function curvedWindowBay({frame,left,width,bottom,height,protrusion,crownRise=0,segments=12,material,offset=.035}){
 if(![left,width,bottom,height,protrusion,crownRise,segments,offset].every(Number.isFinite)||typeof frame?.point!=='function'||typeof frame?.uv!=='function'||!material||!(width>0&&height>0&&protrusion>=0&&Number.isInteger(segments)&&segments>=3&&crownRise>=0&&crownRise<height))throw Error('Invalid curved bay dimensions');
 const quads=[];for(let k=0;k<segments;k++){const t=k/segments,u=(k+1)/segments,x0=left+width*t,x1=left+width*u,d0=offset+protrusion*Math.sin(t*Math.PI),d1=offset+protrusion*Math.sin(u*Math.PI),a=archedTopAt(t,{bottom,height,crownRise}),b=archedTopAt(u,{bottom,height,crownRise});quads.push({material,points:[frame.point(x0,bottom,d0),frame.point(x1,bottom,d1),frame.point(x1,b,d1),frame.point(x0,a,d0)],uvs:[frame.uv(x0,bottom),frame.uv(x1,bottom),frame.uv(x1,b),frame.uv(x0,a)],outward:frame.outward});}return quads;
}
export function curvedBand({frame,left,width,bottom,height,protrusion,segments=12,material,lip=.06,offset=.035}){
 if(![left,width,bottom,height,protrusion,segments,lip,offset].every(Number.isFinite)||typeof frame?.point!=='function'||!material||!(width>0&&height>0&&protrusion>=0&&Number.isInteger(segments)&&segments>=3))throw Error('Invalid curved band dimensions');
 const quads=[];for(let k=0;k<segments;k++){const t=k/segments,u=(k+1)/segments,x0=left+width*t,x1=left+width*u,d0=offset+protrusion*Math.sin(t*Math.PI),d1=offset+protrusion*Math.sin(u*Math.PI),top=bottom+height;quads.push({material,points:[frame.point(x0,bottom,d0+lip),frame.point(x1,bottom,d1+lip),frame.point(x1,top,d1+lip),frame.point(x0,top,d0+lip)],outward:frame.outward},{material,points:[frame.point(x0,top,.02),frame.point(x1,top,.02),frame.point(x1,top,d1+lip),frame.point(x0,top,d0+lip)],outward:[0,1,0]});}return quads;
}
