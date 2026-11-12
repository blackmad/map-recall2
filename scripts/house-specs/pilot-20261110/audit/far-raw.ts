// Lane H7 r3: raw tight / coplanar area of a GLB regardless of material (a lod2 drops material names), per x band.
import {loadMaterialSoup} from '../../../../scripts/landmarks/material-soup';
import {auditZFight} from '../../../../src/canalRecall/landmarks/geometryAudit.ts';
for (const f of process.argv.slice(2)) {
  const z = auditZFight(await loadMaterialSoup(f));
  const bands = new Map<string, {copl: number; tight: number}>();
  for (const p of z.patches) if (!p.near || p.tight) {
    const k = p.min[0] > 31 && p.max[0] < 34.5 ? 'corner-nassaukade' : 'rest';
    const b = bands.get(k) ?? {copl: 0, tight: 0}; if (p.tight) b.tight += p.area; else b.copl += p.area; bands.set(k, b);
  }
  console.log(f, JSON.stringify(Object.fromEntries([...bands].map(([k, v]) => [k, {copl: +v.copl.toFixed(2), tight: +v.tight.toFixed(2)}]))));
}
