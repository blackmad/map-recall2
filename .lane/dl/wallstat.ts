import { bayLookFor } from '../../src/canalRecall/bayLook.ts';
import { buurtProfileAt } from '../../src/canalRecall/buurtProfiles/data.ts';
import { hexToOklab } from '../../src/canalRecall/houseSpec/wallColour.ts';
import { resetRealLook } from '../../src/canalRecall/look/realLook.ts';
import { measuredPoolDraw } from '../../src/canalRecall/look/measuredWallPool.ts';
const g = globalThis as any;
const q=(a:number[],p:number)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(p*(s.length-1))].toFixed(3)};
// grid over ride area; pands only where pool is null (the lever's domain) and all.
for (const mode of ['0','walls']) { g.__canalRecallRealLook = mode; resetRealLook();
  const L:number[]=[],C:number[]=[]; let n=0,uncovered=0,pale=0;
  for (let x=4.85;x<=4.94;x+=0.006) for (let y=52.345;y<=52.388;y+=0.004) for (const yr of [1650,1890,1925]) {
    const arch = yr<1860?'canal':yr<1915?'c19':'school';
    if (measuredPoolDraw(x,y,arch,1)) continue; uncovered++;
    const b = bayLookFor(`p${x.toFixed(4)}${y.toFixed(4)}${yr}`, yr, 14, 'photo', 'quiet', undefined, undefined, buurtProfileAt(x,y), undefined, undefined, [x,y]);
    const o=hexToOklab(b.wallHex); L.push(o[0]); C.push(Math.hypot(o[1],o[2])); if(o[0]>0.75) pale++; n++; }
  console.log(mode, 'n', n, 'L p10/50/90', q(L,.1),q(L,.5),q(L,.9), 'C p10/50/90', q(C,.1),q(C,.5),q(C,.9), 'pale(L>.75)', (pale/n).toFixed(3)); }
