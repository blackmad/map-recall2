import jpeg from 'jpeg-js';
import { directionToPixel } from '../../src/canalRecall/facade/rectify.ts';
/** Ray-sampled perspective from the existing world-aligned municipal camera convention. */
export function perspectiveCrop(bytes:Buffer, headingDeg:number,width=1200,height=750,fovDeg=90,pitchDeg=8):Buffer {
 const input=jpeg.decode(bytes,{useTArray:true});const data=new Uint8Array(width*height*4);
 const yaw=headingDeg*Math.PI/180,pitch=pitchDeg*Math.PI/180,scale=Math.tan(fovDeg*Math.PI/360);
 const right=[Math.cos(yaw),-Math.sin(yaw),0],forward=[Math.sin(yaw)*Math.cos(pitch),Math.cos(yaw)*Math.cos(pitch),Math.sin(pitch)],up=[-Math.sin(yaw)*Math.sin(pitch),-Math.cos(yaw)*Math.sin(pitch),Math.cos(pitch)];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=((x+.5)/width*2-1)*scale,v=(1-(y+.5)/height*2)*scale*height/width;
  const direction=forward.map((f,i)=>f+u*right[i]+v*up[i]) as [number,number,number];
  const [sx,sy]=directionToPixel(direction,input,'centre');const ix=(Math.floor(sx)+input.width)%input.width,iy=Math.max(0,Math.min(input.height-1,Math.floor(sy)));
  const source=(iy*input.width+ix)*4,target=(y*width+x)*4;data[target]=input.data[source];data[target+1]=input.data[source+1];data[target+2]=input.data[source+2];data[target+3]=255;
 }
 return jpeg.encode({data,width,height},88).data;
}
