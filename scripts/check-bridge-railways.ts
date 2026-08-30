/**
 * A railway line is not a bridge a player can name.
 *
 * "Gooilijn", "Oude Lijn" and "Westelijke Ringspoorbaan" are railway lines
 * whose viaducts were asked about one span at a time — 54 crossings between
 * them, 17 for the Westelijke Ringspoorbaan alone, none with an answer anyone
 * could learn. They are tagged in the extract now and the runtime drops them.
 *
 * The risk in tagging is the opposite error: silencing a real bridge. OSM has
 * railway bridges named "Keizersgracht" and "Prinsengracht" after the water
 * they cross, so this pins that the canal-ring and Amstel bridges are all
 * still asked, and that nothing rail-only is offered as an answer either.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extractDir = resolve(root, 'public/data/extracts/amsterdam');

interface BridgeFeature {
  id: string; name: string; distractors?: string[];
  carriesRailway?: boolean; carriesRoad?: boolean;
}
const bridges = JSON.parse(readFileSync(resolve(extractDir, 'bridges.json'), 'utf8')) as BridgeFeature[];
const railwayOnly = (b: BridgeFeature) => !!b.carriesRailway && !b.carriesRoad;

// The named offenders must be tagged, or the questions come back.
for (const name of ['Gooilijn', 'Oude Lijn', 'Westelijke Ringspoorbaan', 'Zuidelijke Ringspoorbaan']) {
  const bridge = bridges.find((b) => b.name === name);
  assert.ok(bridge, `${name} is missing from the extract`);
  assert.ok(railwayOnly(bridge), `${name} is a railway line and must not be asked about`);
}

// The opposite error: a real bridge silenced. These must all stay askable.
for (const name of ['Magere Brug', 'Blauwbrug', 'Hoge Sluis', 'Berlagebrug', 'Torensluis', 'Nesciobrug']) {
  const bridge = bridges.find((b) => b.name === name);
  assert.ok(bridge, `${name} is missing from the extract`);
  assert.equal(railwayOnly(bridge), false, `${name} is a real bridge and must still be asked about`);
}

// A bridge nobody is asked about must not be offered as somebody else's answer.
const silencedNames = new Set(bridges.filter(railwayOnly).map((b) => b.name));
for (const bridge of bridges) {
  for (const option of bridge.distractors ?? []) {
    assert.ok(!silencedNames.has(option),
      `${bridge.name} offers "${option}", which is a railway line the game never asks about`);
  }
}

const silenced = bridges.filter(railwayOnly);
assert.ok(silenced.length > 0 && silenced.length < 25,
  `${silenced.length} bridges tagged rail-only; that is outside the expected range`);

process.stdout.write(
  `Bridge railway checks passed (${silenced.length} railway lines silenced, `
  + `${bridges.length - silenced.length} bridges still asked).\n`);
