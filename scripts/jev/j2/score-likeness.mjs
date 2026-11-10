/** J2 family 7 scorer: what Jev picks (today / spec / decoy), decoy rejection, mean 1-5 score per kind, run agreement; --labels=<json {tNN: "today"|"spec"|"tie"}> adds agreement with the judgement session. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {CACHE, arg} from './lib.mjs';
const T = JSON.parse(await fs.readFile(path.join(CACHE, 'triples.json'), 'utf8'));
const labels = arg('labels') ? JSON.parse(await fs.readFile(arg('labels'), 'utf8')) : null;
const rd = async (run, id) => JSON.parse(await fs.readFile(path.join(CACHE, 'runs/likeness', run, `${id}.json`), 'utf8')).response.answers;
const pickCount = {today: 0, spec: 0, decoy: 0}, sums = {today: [0, 0], spec: [0, 0], decoy: [0, 0]}; let agree = 0, labelled = 0, labelHit = 0; const rows = [];
for (const t of T) {
  const a1 = await rd('r1', t.id), a2 = await rd('r2', t.id), k1 = t.key[+a1.best.choice[1] - 1], k2 = t.key[+a2.best.choice[1] - 1];
  pickCount[k1]++; agree += k1 === k2;
  for (const [i, kind] of t.key.entries()) { sums[kind][0] += +a1[`score_r${i + 1}`].choice; sums[kind][1]++; }
  const lab = labels?.[t.id]; if (lab && lab !== 'tie') { labelled++; labelHit += k1 === lab; }
  rows.push({id: t.id, pick: k1, p: +a1.best.confidence.toFixed(2)});
}
console.log({n: T.length, pickCount, decoyRejected: `${T.length - pickCount.decoy}/${T.length}`, runAgreement: `${agree}/${T.length}`, meanScore: Object.fromEntries(Object.entries(sums).map(([k, [s, n]]) => [k, +(s / n).toFixed(2)])), vsLabels: labels ? `${labelHit}/${labelled}` : 'no labels yet'});
await fs.writeFile(path.join(CACHE, 'likeness-picks.json'), JSON.stringify(rows, null, 1));
