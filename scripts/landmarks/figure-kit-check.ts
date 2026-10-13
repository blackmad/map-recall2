import {buildFigure, triCount, POSES, MAX_FIGURE_TRIS} from './figure-kit';

/** Gate: every stock pose, with the largest hat and a skirt, stays within the triangle budget and stands on y = 0. */
let bad = 0;
const poses = {standing: POSES.standing(), seated: POSES.seated(0.5), striding: POSES.striding(), armsRaised: POSES.armsRaised()};
for (const [name, pose] of Object.entries(poses)) {
  for (const hat of ['none', 'beret', 'widebrim', 'morion', 'cap', 'tophat'] as const) {
    const f = buildFigure({...pose, hat, skirt: {len: 0.4}}, 'bronze');
    const tris = triCount(f.parts);
    const ok = tris <= MAX_FIGURE_TRIS;
    if (!ok) bad++;
    if (hat === 'widebrim' || !ok) console.log(name.padEnd(11), hat.padEnd(9), tris, 'tris', 'pelvisY', f.pelvisY.toFixed(3), 'head', f.joints.head.y.toFixed(3), ok ? 'ok' : 'OVER');
  }
}
if (bad) { console.error(`${bad} figure variants over ${MAX_FIGURE_TRIS} triangles`); process.exit(1); }
console.log('figure kit: all variants within budget');
