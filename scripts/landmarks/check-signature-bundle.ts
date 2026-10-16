/**
 * The game reads every manual landmark's spec (suppressOsmIds, materialOverrides) from the minified
 * public/canal-drive/js/signature-placement.bundle.js (`npm run build:canal-signature-landmarks`), not from manualModels.ts.
 * A stale bundle hides the wrong buildings: on 2026-10-16 Centraal's 13 east-wing ways were in manualModels.ts and in
 * covers.json but not in the bundle, so the OSM parts under the new east wing drew their terracotta roofs through it.
 * This check fails when any model's suppression ids or override colours are missing from the bundle.
 *
 *   node --import tsx scripts/landmarks/check-signature-bundle.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MANUAL_LANDMARKS} from '../../src/canalRecall/landmarks/manualModels';

const BUNDLE = 'public/canal-drive/js/signature-placement.bundle.js';
const text = fs.readFileSync(BUNDLE, 'utf8');
const stale: string[] = [];
for (const spec of MANUAL_LANDMARKS) {
  // BAG ids are often assembled from their number in the source (`NL.IMBAG.Pand.${n}`): look for the number then.
  const ids = spec.suppressOsmIds.filter(id => !text.includes(id.startsWith('NL.IMBAG.') ? id.split('.').pop()! : `"${id}"`));
  const hexes = Object.values(spec.materialOverrides ?? {}).filter(hex => typeof hex === 'string' && !text.toLowerCase().includes(hex.toLowerCase()));
  if (ids.length || hexes.length) stale.push(`${spec.id}: ${ids.length ? `suppressOsmIds ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ` (+${ids.length - 6})` : ''}` : ''}${ids.length && hexes.length ? '; ' : ''}${hexes.length ? `materialOverrides ${hexes.slice(0, 4).join(', ')}` : ''}`);
}
assert.deepEqual(stale, [], `${BUNDLE} is older than manualModels.ts; run npm run build:canal-signature-landmarks:\n${stale.join('\n')}`);
console.log(`${BUNDLE}: ${MANUAL_LANDMARKS.length} manual landmark specs present (suppression ids and override colours).`);
