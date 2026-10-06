import { CELL_PX } from './facadeCells.js';

/** One original painted glass block; one repeat represents recipe.cellM metres.
 * Bottom-first RGBA matches the runtime cell array. Alpha zero means fixed colour,
 * not transparency: no window mask, photographic pixels or per-cell mesh geometry.
 */
export function paintGlassBlockCell(): Uint8ClampedArray {
  const data=new Uint8ClampedArray(CELL_PX*CELL_PX*4);
  for(let y=0;y<CELL_PX;y++)for(let x=0;x<CELL_PX;x++){
    const u=(x+.5)/CELL_PX,v=(y+.5)/CELL_PX;
    const edge=Math.min(u,1-u,v,1-v),mortar=edge<.035;
    const bevel=edge<.105;
    const light=.5+.5*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
    const ridge=bevel?(u+v<1?15:-12):0;
    const base=mortar?[181,184,173]:[104+23*light+ridge,125+20*light+ridge,121+22*light+ridge];
    const at=(y*CELL_PX+x)*4;
    for(let i=0;i<3;i++)data[at+i]=Math.round(base[i]);
    data[at+3]=0;
  }
  return data;
}
