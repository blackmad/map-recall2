/**
 * Compile the Hoofdbureau builder and print what the hooks drew, what failed to cut, the block-kit gates and the triangle
 * count per material slot (before the exporter's clipping and quantization).
 *
 *   node --import tsx scripts/landmarks/hoofdbureau-elandsgracht-stats.ts
 */
import * as T from 'three';
import {compileHoofdbureau} from './hoofdbureau-elandsgracht-builder';

const {built, stats} = compileHoofdbureau();
const bySlot: Record<string, number> = {};
let tris = 0;
built.group.traverse(o => {
  if (!(o instanceof T.Mesh)) return;
  const n = (o.geometry as T.BufferGeometry).getAttribute('position').count / 3;
  tris += n; bySlot[o.name] = (bySlot[o.name] ?? 0) + n;
});
console.log(`triangles ${tris}; openings ${stats.openings}; hoods ${stats.hoods}; chequers ${stats.chequers}; basements ${stats.basements}`);
console.log(`drawn: ${stats.drawn.join('; ')}`);
console.log(`failed (${stats.failed.length}):${stats.failed.map(f => `\n  ${f}`).join('')}`);
console.log(`slots ${JSON.stringify(bySlot)}`);
console.log(`compose ${JSON.stringify(built.stats)}`);
for (const g of built.blockGates.gates ?? []) if (!g.pass) console.log(`block gate FAIL ${g.id} ${JSON.stringify(g.value).slice(0, 400)}`);
