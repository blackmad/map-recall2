// Crown share: foliage pixels in the top 60 % of the frame (grass and verges sit below), and the crowns' mean OKLab L/C.
import sharp from 'sharp';
import { isFoliage } from '../../src/canalRecall/trees/silhouetteMeasure.ts';
const lin=(v:number)=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4};
function ok(r:number,g:number,b:number){const R=lin(r),G=lin(g),B=lin(b);const l=Math.cbrt(0.4122214708*R+0.5363325363*G+0.0514459929*B),m=Math.cbrt(0.2119034982*R+0.6806995451*G+0.1073969566*B),s=Math.cbrt(0.0883024619*R+0.2817188376*G+0.6299787005*B);return [0.2104542553*l+0.793617785*m-0.0040720468*s,1.9779984951*l-2.428592205*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.808675766*s];}
for (const f of process.argv.slice(2)) {
  const {data,info}=await sharp(f).resize(480).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const H=Math.floor(info.height*0.6); let n=0,fol=0,L=0,a=0,b=0;
  for(let y=0;y<H;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*3; n++; if(isFoliage(data[i],data[i+1],data[i+2])){fol++;const o=ok(data[i],data[i+1],data[i+2]);L+=o[0];a+=o[1];b+=o[2];}}
  console.log(f.replace(/.*r2\//,'').padEnd(44), 'crown', (fol/n).toFixed(3), 'L', fol?(L/fol).toFixed(3):'-', 'C', fol?(Math.hypot(a,b)/fol).toFixed(3):'-');
}
