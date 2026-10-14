// Probe: rectified water-side crops and the classifier's reading for a few bridges (development aid).
//   npx tsx scripts/bridge-reference/probe.ts BRU0009 BRU0236
import { mkdirSync, writeFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
import { bridgeFace } from './geometry.ts';
import { bridgeViews, rectifyBridgeFace } from './select.ts';
import { annotate, readFace } from './classify.ts';

for (const id of process.argv.slice(2)) {
  const face = bridgeFace(id);
  if (!face) { console.log(id, 'no face'); continue; }
  const views = await bridgeViews(face, { land: true });
  console.log(id, face.name, `deck ${face.deck.map(v => v.toFixed(1))} water ${face.water?.map(v => v.toFixed(1))} hw ${face.halfWidth.toFixed(1)} crown ${face.crownNAP.toFixed(2)}`);
  mkdirSync(`artifacts/bridges/${id}`, { recursive: true });
  for (const v of views) {
    const c = await rectifyBridgeFace(face, v, 20);
    if (!c) continue;
    const r = readFace(face, c), tag = v.side > 0 ? 'p' : 'm';
    writeFileSync(`artifacts/bridges/${id}/probe-${tag}.jpg`, jpeg.encode({ data: Buffer.from(annotate(face, c, r).buffer), width: c.width, height: c.height }, 85).data);
    console.log(` ${tag} ${v.surface} ${v.pick.panoId} ${v.pick.distM.toFixed(0)}m ${v.pick.obliquityDeg.toFixed(0)}deg ${v.pick.missionYear} camZ ${c.cameraZ.toFixed(2)} | dz ${r.dz} thr ${r.darkThreshold.toFixed(0)} | ${r.openings.length} ${r.shape} ${r.family} ${r.solid} ${r.parapet} ${JSON.stringify(r.parapetStats, (k, x) => (typeof x === 'number' ? +x.toFixed(2) : x))}`);
    console.log('    ' + r.openings.map(o => `[${o.a0.toFixed(1)},${o.a1.toFixed(1)}] ${o.shape} ${o.riseRatio.toFixed(2)}`).join('  '));
  }
}
