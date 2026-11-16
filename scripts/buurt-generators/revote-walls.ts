/**
 * Re-vote the measured walls under the round 11 hue guard (measure.ts HUE_GUARD) from the reads already stored in
 * src/canalRecall/buurtGenerator/districts/measured/<district>.json: each balanced read's hex is guarded against its raw
 * hex and the row re-voted (voteWall). Nothing is fetched. A row whose guarded reads no longer agree keeps no wall (the
 * pool stands) and is listed in wallSkipped with the reason.
 *
 *   node --import tsx scripts/buurt-generators/revote-walls.ts rivierenbuurt apollo-stadion [--write]
 */
import fs from 'node:fs';
import { hueGuard, labOf, voteWall, type WallRead } from '../../src/canalRecall/buurtGenerator/measure.ts';
import { labHex, type Lab } from '../../src/canalRecall/retailPuiPaint.ts';

const lab = (h: string): Lab => labOf(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16));
const hue = (l: Lab) => ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360;
const pink = (h: string) => { const x = hue(lab(h)); return x < 36 || x > 300; };
const write = process.argv.includes('--write');
for (const d of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const file = `src/canalRecall/buurtGenerator/districts/measured/${d}.json`;
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  let guarded = 0, changed = 0, lost = 0, pinkBefore = 0, pinkAfter = 0;
  for (const [id, v] of Object.entries<any>(m.walls)) {
    if (pink(v.hex)) pinkBefore++;
    if (!v.balanced) { if (pink(v.hex)) pinkAfter++; continue; }
    const reads: WallRead[] = v.reads.map((r: any) => {
      const g = r.raw ? hueGuard(lab(r.hex), lab(r.raw)) : { lab: lab(r.hex), guard: null };
      if (g.guard) guarded++;
      return { pano: r.pano, date: r.date, verdict: { hex: labHex(g.lab), lab: g.lab, share: 1, kind: 'brick', balanced: true, raw: r.raw, ...(g.guard ? { hueGuard: g.guard } : {}) } };
    });
    const vote = voteWall(reads);
    if ('skip' in vote) { lost++; delete m.walls[id]; (m.wallSkipped ??= {})[id] = `hue guard: ${vote.skip}`; continue; }
    // Keep the stored read list's raw values, with the guarded hex.
    const next = { ...vote, reads: vote.reads.map(r => ({ ...r, ...(v.reads.find((q: any) => q.pano === r.pano)?.raw ? { raw: v.reads.find((q: any) => q.pano === r.pano).raw } : {}) })) };
    if (next.hex !== v.hex) changed++;
    if (pink(next.hex)) pinkAfter++;
    m.walls[id] = next;
  }
  console.log(`${d}: ${Object.keys(m.walls).length + lost} measured rows; ${guarded} reads guarded; ${changed} rows recoloured; ${lost} rows back on the pool; pink-mauve (hue < 36 or > 300) ${pinkBefore} -> ${pinkAfter}`);
  if (write) { m.wallSource = `${m.wallSource ?? ''}; round 11 hue guard (revote-walls.ts)`.replace(/^; /, ''); fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n'); }
}
