import type {GableType} from '../../src/canalRecall/facade/houseRecord';

/** Shared photographed crown silhouettes, extracted without geometry changes from the recipe vocabulary. */
const finite = (...v: number[]) => { if (!v.every(Number.isFinite)) throw new Error('Non-finite assembly dimension'); };
const positive = (...v: number[]) => { finite(...v); if (v.some(n => n <= 0)) throw new Error('Assembly dimension must be positive'); };
export function canalhouseCrownProfile(type: GableType, widthM: number, eavesM: number, topM: number,
  neckWidthM: number, shoulderM: number, steps: number): [number,number][] {
  positive(widthM, eavesM); finite(topM, neckWidthM, shoulderM, steps);
  if (topM < eavesM || neckWidthM < 0 || neckWidthM > widthM || shoulderM < eavesM || shoulderM > topM) throw new Error('Invalid crown profile dimensions');
  const mid = widthM/2, left = (widthM-neckWidthM)/2, right = widthM-left;
  if (type === 'lijst') return [[0,eavesM],[widthM,eavesM]];
  if (type === 'punt') return [[0,eavesM],[mid,topM],[widthM,eavesM]];
  if (type === 'trap') {
    if (!Number.isInteger(steps) || steps < 1 || steps > 20) throw new Error('Invalid observed step count');
    const out: [number,number][] = [[0,eavesM]];
    for (let i=1;i<=steps;i++) { const x=left*i/steps, y=eavesM+(topM-eavesM)*i/steps; out.push([x,out.at(-1)![1]],[x,y]); }
    out.push([right,topM]);
    for(let i=steps;i>=1;i--) { const x=widthM-left*(i-1)/steps,y=eavesM+(topM-eavesM)*(i-1)/steps; out.push([x,out.at(-1)![1]],[x,y]); } return out;
  }
  if (type === 'klok') {
    const out: [number,number][] = [];
    // Smooth reusable silhouette; width, shoulder and crest remain measured inputs.
    for(let i=0;i<=8;i++){ const f=i/8; out.push([left*f,eavesM+(shoulderM-eavesM)*Math.sin(f*Math.PI/2)]); }
    out.push([left,topM],[right,topM]);
    for(let i=8;i>=0;i--){ const f=i/8; out.push([widthM-left*f,eavesM+(shoulderM-eavesM)*Math.sin(f*Math.PI/2)]); } return out;
  }
  return [[0,eavesM],[left,shoulderM],[left,topM],[right,topM],[right,shoulderM],[widthM,eavesM]];
}
