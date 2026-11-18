import { bayLookFor } from '../../src/canalRecall/bayLook.ts';
import { buurtProfileAt } from '../../src/canalRecall/buurtProfiles/data.ts';
import { resetRealLook } from '../../src/canalRecall/look/realLook.ts';
const g = globalThis as any;
const pts = Array.from({length: 5000}, (_, i) => [4.86 + (i % 100) * 0.0008, 52.35 + Math.floor(i / 100) * 0.0008] as const);
const prof = pts.map(p => buurtProfileAt(p[0], p[1]));
for (const mode of ['0', '1', '0', '1']) { g.__canalRecallRealLook = mode; resetRealLook();
  const t = performance.now(); for (let i = 0; i < pts.length; i++) bayLookFor(`id${i}`, 1900, 14, 'photo', 'quiet', undefined, undefined, prof[i], undefined, undefined, pts[i]);
  console.log(mode, ((performance.now() - t) / pts.length * 1000).toFixed(1), 'us/building'); }
