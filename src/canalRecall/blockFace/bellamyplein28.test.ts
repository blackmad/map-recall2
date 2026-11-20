/**
 * Feedback 47d096 (2026-11-13, "why is this building cutoff? only showing like 2/3rds of its horizontal frontage"):
 * Bellamyplein 28 (BAG pand 0363100012162005) was held out of the Bellamyplein 18-38 face at the likeness gate, so it
 * fell to the generic renderer between the two installed runs, whose front and roof did not agree with its footprint.
 * It is now placed in the one run 20-38 with its two-axis wide-balcony front stated by a reviewer override pin
 * (scripts/block-face/buurten/bellamybuurt-zuid-review-overrides.json). Pinned here so a re-run cannot drop it again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateBlockFace} from './intent.ts';
import {fileTypeLoader} from './typeLibrary.ts';

const PAND = '0363100012162005', FACE = 'bellamyplein-18-38-r1';
const json = (f: string) => JSON.parse(readFileSync(f, 'utf8'));

test('Bellamyplein 28 is placed in its row run, between 30 and 26, with its two-axis front', () => {
  const dir = `scripts/block-face/faces/${FACE}`, intent = json(`${dir}/intent.json`);
  const ids: string[] = intent.houses.map((h: {pandId: string}) => h.pandId);
  const at = ids.indexOf(PAND);
  assert.ok(at > 0, `${PAND} in ${FACE}`);
  assert.equal(ids[at - 1], '0363100012166965', 'Bellamyplein 30 on its left');
  assert.equal(ids[at + 1], '0363100012159962', 'Bellamyplein 26 on its right');
  const house = intent.houses[at];
  assert.equal(house.type.overrides.bays, 2);
  assert.equal(house.type.overrides.axisWindows['1'], 'casement-sidelights-toplight');
  assert.doesNotThrow(() => validateBlockFace(intent, json(`${dir}/discovery.json`).members, fileTypeLoader()));
  const placed = json('scripts/block-face/faces/bellamyplein-18-38/auto-place.json').pands.find((p: {pandId: string}) => p.pandId === PAND);
  assert.equal(placed.status, 'placed');
});

test('the installed chunk draws Bellamyplein 28 and suppresses its generic building', () => {
  const chunks = json('public/canal-drive/ordinary-buildings-data/chunks.json').chunks as {id: string; suppress: string[]; pands: {pandId: string; frontage: {widthM: number}}[]}[];
  const own = chunks.filter(c => c.pands.some(p => p.pandId === PAND));
  assert.deepEqual(own.map(c => c.id), [`chunk-face-${FACE}`]);
  assert.ok(own[0].suppress.includes(`NL.IMBAG.Pand.${PAND}`));
  // The BAG frontage is 5.56 m: the whole of it is drawn.
  assert.ok(Math.abs(own[0].pands.find(p => p.pandId === PAND)!.frontage.widthM - 5.56) < 0.15);
  assert.equal(chunks.some(c => c.id === 'chunk-face-bellamyplein-18-38-r2'), false, 'the old r2 run is gone (merged into r1)');
});
