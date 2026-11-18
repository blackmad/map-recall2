// Frame statistics for photo | game likeness pairs: non-sky pixels only.
import sharp from 'sharp';
import { isFoliage } from '../../src/canalRecall/trees/silhouetteMeasure.ts';
const lin=(v:number)=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4};
function oklab(r:number,g:number,b:number){const R=lin(r),G=lin(g),B=lin(b);const l=Math.cbrt(0.4122214708*R+0.5363325363*G+0.0514459929*B),m=Math.cbrt(0.2119034982*R+0.6806995451*G+0.1073969566*B),s=Math.cbrt(0.0883024619*R+0.2817188376*G+0.6299787005*B);return [0.2104542553*l+0.793617785*m-0.0040720468*s,1.9779984951*l-2.428592205*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.808675766*s];}
export async function stats(file:string){
  const {data,info}=await sharp(file).resize(480).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const n=info.width*info.height; let k=0,sumC=0,sat=0,pale=0,fol=0; const Cs:number[]=[],Ls:number[]=[]; const fc=[0,0,0];
  for(let i=0;i<n;i++){const r=data[i*3],g=data[i*3+1],b=data[i*3+2]; const [L,a,bb]=oklab(r,g,b); const C=Math.hypot(a,bb), h=Math.atan2(bb,a)*180/Math.PI;
    const y=Math.floor(i/info.width); const sky = (h>-130&&h<-60&&C>0.04&&L>0.7) || (y<info.height*0.5 && L>0.8 && C<0.02 && file.includes('photo'));
    if(sky) continue; k++; Cs.push(C); Ls.push(L); if(C>0.08) sat++; if(L>0.85&&C<0.035) pale++;
    if(isFoliage(r,g,b)){fol++; fc[0]+=L; fc[1]+=a; fc[2]+=bb;}}
  const q=(a:number[],p:number)=>{a.sort((x,y)=>x-y);return a[Math.floor(p*(a.length-1))]};
  return {px:k, Cmed:+q(Cs,.5).toFixed(3), Cp90:+q(Cs,.9).toFixed(3), Lmed:+q(Ls,.5).toFixed(3), sat:+(sat/k).toFixed(3), pale:+(pale/k).toFixed(3), foliage:+(fol/k).toFixed(3), folL: fol? +(fc[0]/fol).toFixed(3):null, folC: fol? +(Math.hypot(fc[1],fc[2])/fol).toFixed(3):null};
}
if (process.argv[1].endsWith('measure.ts')) { const out:any={}; for (const f of process.argv.slice(2)) out[f]=await stats(f); console.log(JSON.stringify(out,null,0).replace(/},/g,'},\n')); }
