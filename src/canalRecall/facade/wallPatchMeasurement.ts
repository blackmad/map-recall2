/** Photo-space diagnostics for explicitly reviewed wall/negative-control patches.
 * RGB is illumination-dependent evidence, never calibrated material albedo. */
export type PatchBounds = readonly [number, number, number, number];
export interface PatchImage { width:number; height:number; data:ArrayLike<number> }
export function measureWallPatch(image:PatchImage,bounds:PatchBounds,masks:Record<string,ArrayLike<number>>={}) {
  const {width,height,data}=image;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length!==width*height*3)
    throw Error('Expected tightly packed RGB source');
  const [x0,y0,x1,y1]=bounds;
  if(!bounds.every(Number.isInteger)||x0<0||y0<0||x1>width||y1>height||x1<=x0||y1<=y0)
    throw Error('Patch lies outside source or is empty');
  for(const mask of Object.values(masks))if(mask.length!==width*height)throw Error('Mask dimensions differ from source');
  const channels:number[][]=[[],[],[]],luma:number[]=[],included:Record<string,number>={};
  for(const name of Object.keys(masks))included[name]=0;
  let clipped=0,dark=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const pixel=y*width+x,i=pixel*3,r=data[i],g=data[i+1],b=data[i+2];
    if(![r,g,b].every(v=>Number.isFinite(v)&&v>=0&&v<=255))throw Error('Invalid RGB sample');
    channels[0].push(r);channels[1].push(g);channels[2].push(b);
    const lum=.2126*r+.7152*g+.0722*b;luma.push(lum);
    if(Math.max(r,g,b)>=250)clipped++;
    if(lum<40)dark++;
    for(const [name,mask] of Object.entries(masks))if(mask[pixel]===1)included[name]++;
  }
  const n=luma.length;
  const quantile=(values:number[],q:number)=>{const a=values.slice().sort((a,b)=>a-b),index=(a.length-1)*q,lo=Math.floor(index),hi=Math.ceil(index);return a[lo]+(a[hi]-a[lo])*(index-lo);};
  return {bounds,pixels:n,medianRGB:channels.map(c=>quantile(c,.5)),p10RGB:channels.map(c=>quantile(c,.1)),p90RGB:channels.map(c=>quantile(c,.9)),
    medianLuma:quantile(luma,.5),lumaSpread:quantile(luma,.9)-quantile(luma,.1),clippedChannelFraction:clipped/n,darkPixelFraction:dark/n,
    maskCoverage:Object.fromEntries(Object.entries(included).map(([name,count])=>[name,count/n])),basis:'reviewed-source-photo-patch' as const};
}
