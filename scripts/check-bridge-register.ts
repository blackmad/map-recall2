/**
 * The bridge register on bridge cards: reading register rows, choosing which
 * register bridge a named game bridge is, the card sentence, and named
 * bridges in the published extract.
 *
 * Usage: npm run test:bridge-register
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  bridgeNumber, chooseRegisterBridge, sameBridgeName, describeRegisteredBridge, registerFact,
  type BridgeRegisterFile, type BridgeRegisterRow,
} from '../src/canalRecall/bridgeRegister';
import { buildRouteKnowledgeIndex, routeKnowledgeFor, streetCardText, STREET_CARD_LONG_CHARS } from '../src/canalRecall/game/routeKnowledge';

let failures = 0;
function check(name: string, run: () => void) {
  try { run(); process.stdout.write(`  ✓ ${name}\n`); } catch (error) { failures++; process.stdout.write(`  ✗ ${name}\n    ${(error as Error).message}\n`); }
}

const ring: Array<[number, number]> = [[4.9, 52.36], [4.9001, 52.36], [4.9001, 52.3601], [4.9, 52.36]];
const row = (number: string, name: string, type = 'Vaste brug', material = 'Staal', year = 0, modality = ''): BridgeRegisterRow =>
  [number, name, type, material, year, modality, '', ring];

check('the painted number comes from BRU object numbers only', () => {
  assert.equal(bridgeNumber('BRU0242'), 242);
  assert.equal(bridgeNumber('BRU2189'), 2189);
  assert.equal(bridgeNumber('VIA0012'), undefined);
});

check('register rows read as English facts (Magere Brug is "Beweegbare brug")', () => {
  const magere = registerFact(row('BRU0242', 'Magere Brug', 'Beweegbare brug', 'Hout'));
  assert.deepEqual(magere, { movable: true, nr: 242, material: 'wooden' });
  const blauw = registerFact(row('BRU0236', 'Blauwbrug', 'Vaste brug', 'Staal', 1884, 'Licht wegverkeer'));
  assert.deepEqual(blauw, { movable: false, nr: 236, material: 'steel', year: 1884, carries: 'road traffic' });
  assert.equal(registerFact(row('BRU0001', '', 'Vaste brug', 'Onbekend', 1005)).year, undefined, 'a placeholder year is not taught');
  assert.equal(registerFact(row('BRU0001', '', 'Vaste brug', '', 2999)).material, undefined);
});

check('spelling variants of one bridge match; neighbouring bridges named from one theme do not', () => {
  assert.ok(sameBridgeName('Ryckerbrug', 'Rijckerbrug'), 'ij and y');
  assert.ok(sameBridgeName('Bullebaksluis', 'Bullebakssluis'));
  assert.ok(sameBridgeName('Gustav Leonhardtbrug', 'Gustav Leonardbrug'));
  assert.ok(sameBridgeName('Kattenrugbrug', 'Katterug'));
  assert.ok(!sameBridgeName('Goudvinkbrug', 'Goudhaanbrug'), 'Gierzwaluwbrug\'s outline neighbour');
  assert.ok(!sameBridgeName('Gierzwaluwbrug', 'Goudvinkbrug'));
  assert.ok(!sameBridgeName('Groene spechtbrug', 'Grote Zilverreigerbrug'));
  assert.ok(!sameBridgeName('Oostbrug', 'Westbrug'), 'short names must match exactly');
});

check('the card sentence attributes the year and reads naturally', () => {
  assert.equal(describeRegisteredBridge({ movable: false, nr: 236, material: 'steel', year: 1884, carries: 'road traffic' }),
    "Bridge 236: a steel bridge for road traffic, dated 1884 in the city's bridge register.");
  assert.equal(describeRegisteredBridge({ movable: true, nr: 242, material: 'wooden' }), 'Bridge 242: a movable wooden bridge.');
  assert.equal(describeRegisteredBridge({ movable: false, material: 'Oak' as string }), 'An Oak bridge.', 'an/a follows the first word');
  assert.equal(describeRegisteredBridge({ movable: false }), '', 'nothing known, nothing said');
});

check('choosing the register bridge: by name, by painted number, by a lone outline; never a guess', () => {
  const magere = row('BRU0242', 'Magere Brug');
  const other = row('BRU0243', '');
  assert.equal(chooseRegisterBridge('Magere Brug', [other, magere]), magere, 'a register name that matches wins');
  assert.equal(chooseRegisterBridge('Brug 243', [magere, other]), other, 'OSM "Brug N" is register bridge N');
  assert.equal(chooseRegisterBridge('Brug 999', [magere, other]), null);
  assert.equal(chooseRegisterBridge('Nieuwe Brug', [other]), other, 'one unnamed outline is the bridge');
  assert.equal(chooseRegisterBridge('Nieuwe Brug', [other, row('BRU0244', '')]), null,
    'a road over several bridges (IJburglaan) is ambiguous, and a wrong year would teach something false');
  assert.equal(chooseRegisterBridge('Nieuwe Brug', [magere]), null, 'a lone outline named otherwise is another bridge');
});

check('bridge cards: the register sentence stands alone or follows the origin, never cut', () => {
  const normalise = (name: string) => name.toLowerCase();
  const register = {
    'Blauwbrug': { movable: false, nr: 236, material: 'steel', year: 1884, carries: 'road traffic' },
    'Magere Brug': { movable: true, nr: 242, material: 'wooden' },
  };
  const origin = 'Around 1670, a drawbridge was built over the Amstel, so narrow it only suited pedestrians. '.repeat(4).trim();
  const index = buildRouteKnowledgeIndex([], [], [], normalise, [{ name: 'Magere Brug', kind: 'bridge', en: origin }], register);
  const blauw = routeKnowledgeFor(index, 'Blauwbrug', 'bridge', normalise)!;
  assert.ok(blauw, 'a bridge with no origin gets a card from the register');
  assert.equal(routeKnowledgeFor(index, 'Blauwbrug', 'street', normalise), undefined, 'never a street card');
  const alone = streetCardText(blauw);
  assert.equal(alone.detail, "Bridge 236: a steel bridge for road traffic, dated 1884 in the city's bridge register.");
  const magere = streetCardText(routeKnowledgeFor(index, 'Magere Brug', 'bridge', normalise)!);
  assert.ok(magere.detail.startsWith('Around 1670'), 'the origin leads the short text');
  assert.ok(magere.longDetail.endsWith('Bridge 242: a movable wooden bridge.'), `the register closes the long text: …${magere.longDetail.slice(-50)}`);
  assert.ok(magere.longDetail.length <= STREET_CARD_LONG_CHARS);
});

const extract = path.resolve('public/data/extracts/amsterdam');
const published = JSON.parse(readFileSync(path.join(extract, 'bridge-register.json'), 'utf8')) as BridgeRegisterFile;
check('published: named bridges carry their register entries', () => {
  assert.deepEqual(published.bridges['Magere Brug'], { movable: true, nr: 242, material: 'wooden' });
  assert.equal(published.bridges.Blauwbrug?.nr, 236);
  assert.equal(published.bridges.Blauwbrug?.year, 1884);
  assert.equal(published.bridges.Torensluis?.nr, 9);
  assert.equal(published.bridges.Torensluis?.year, 1648, 'the oldest bridge in the canal ring');
  assert.equal(published.bridges['Brug 68']?.nr, 68, 'an OSM "Brug N" joins by number');
  assert.equal(published.bridges.Berlagebrug?.movable, true);
  assert.equal(published.bridges['Oosterdokse Spoorbrug'], undefined, 'railway bridges are not the city\'s and stay undescribed');
  assert.equal(published.bridges.Ryckerbrug?.nr, 167, 'a spelling variant joins');
  assert.equal(published.bridges.Gierzwaluwbrug, undefined, 'a lone outline of the neighbouring Goudvinkbrug does not');
  assert.ok(Object.keys(published.bridges).length >= 240, `coverage: ${Object.keys(published.bridges).length}`);
});

if (failures) { process.stdout.write(`${failures} failed\n`); process.exit(1); }
process.stdout.write('bridge register ok\n');
