import assert from 'node:assert/strict';
import {
  retailPatchesFromSource,
  type RetailSource,
} from './retailPatches.ts';
import type { FacadeFeature } from './storefrontAssembly.ts';

type FeatureFields = Partial<FacadeFeature> & Record<string, unknown>;

const feature = (
  id: string,
  kind: FacadeFeature['kind'],
  bounds: [number, number, number, number],
  extra: FeatureFields = {},
): FacadeFeature => ({ id, kind, bounds, ...extra });

const source = (
  features: FacadeFeature[],
  width = 1000,
  height = 1000,
): RetailSource => ({ features, imageDimensions: { width, height } });

const wall = { widthM: 10, heightM: 5 };

// 1. A full shopfront produces an entrance patch, display-glass patches, a
//    textual fascia patch, and an awning patch matching the extended state.
{
  const result = retailPatchesFromSource(
    source([
      feature('door-1', 'door', [400, 700, 500, 1000]),
      feature('win-left', 'window', [100, 760, 360, 900]),
      feature('win-right', 'window', [540, 760, 900, 900]),
      feature('fascia-1', 'fascia', [80, 640, 920, 700], { text: 'Café De Waag' }),
      feature('awn-1', 'awning', [60, 600, 940, 650], {
        state: 'extended',
        colour: '#202020',
      }),
    ]),
    wall,
  );

  assert.ok(result, 'a full shopfront is not null');
  assert.deepEqual(
    result.patches.map((patch) => patch.kind),
    ['entrance', 'display-glass', 'display-glass', 'fascia', 'awning-canopy'],
  );
  assert.equal(result.hasEntrance, true);
  assert.equal(result.hasDisplayWindow, true);
  assert.equal(result.confidence, 'high');
  assert.equal(result.signText, 'Café De Waag', 'sign text is propagated literally');
  assert.equal(result.assembly.signText, 'Café De Waag');

  const entrance = result.patches.find((patch) => patch.kind === 'entrance');
  assert.ok(entrance, 'entrance patch exists');
  assert.equal(entrance.role, 'door');

  const glass = result.patches.filter((patch) => patch.kind === 'display-glass');
  assert.equal(glass.length, 2, 'each display window becomes a glass patch');

  const fascia = result.patches.find((patch) => patch.kind === 'fascia');
  assert.ok(fascia, 'fascia patch exists');
  assert.equal(fascia.text, 'Café De Waag', 'fascia carries the literal sign text');

  const awning = result.patches.find((patch) => patch.kind.startsWith('awning-'));
  assert.ok(awning, 'awning patch exists');
  assert.equal(awning.kind, 'awning-canopy', 'extended state emits a canopy');
  assert.equal(awning.colour, '#202020', 'awning keeps its own colour');
}

// 2. A residential facade (door and portrait windows, no display glazing) is
//    not retail and returns null without throwing.
{
  const result = retailPatchesFromSource(
    source([
      feature('res-door', 'door', [400, 700, 460, 1000]),
      feature('res-win-1', 'window', [150, 720, 230, 920]),
      feature('res-win-2', 'window', [600, 720, 680, 920]),
    ]),
    wall,
  );
  assert.equal(result, null, 'no display window means not a storefront');
}

// 3. A dimension mismatch is handled by abstaining, not crashing. Chosen
//    behaviour: `assembleStorefront` succeeds and the summary is still returned,
//    but `compileRetail` refuses to divide by zero, so `patches` is empty. Callers
//    can therefore render the assembly summary or fall back to a generic window
//    grid. The same source with a valid wall yields patches.
{
  const features = [
    feature('door-1', 'door', [400, 700, 500, 1000]),
    feature('win-1', 'window', [100, 760, 360, 900]),
  ];

  const zeroWidth = retailPatchesFromSource(source(features), { widthM: 0, heightM: 5 });
  assert.ok(zeroWidth, 'assembly still resolves despite a zero wall width');
  assert.deepEqual(zeroWidth.patches, [], 'zero wall width yields empty patches, no crash');

  const zeroSource = retailPatchesFromSource(source(features, 0, 1000), wall);
  assert.ok(zeroSource, 'assembly still resolves despite zero source width');
  assert.deepEqual(zeroSource.patches, [], 'zero source width yields empty patches, no crash');

  const valid = retailPatchesFromSource(source(features), wall);
  assert.ok(valid, 'a valid wall compiles');
  assert.ok(valid.patches.length > 0, 'valid dimensions produce patches');
}

// 4. Colour options flow through to the patch colours, including the entrance
//    fallback to the frame colour when the door carries no colour of its own.
{
  const result = retailPatchesFromSource(
    source([
      feature('door-1', 'door', [400, 700, 500, 1000]),
      feature('win-1', 'window', [100, 760, 360, 900]),
      feature('fascia-1', 'fascia', [80, 640, 920, 700], { text: 'Bloemen' }),
    ]),
    wall,
    {
      glassColour: '#112233',
      frameColour: '#778899',
      fasciaColour: '#445566',
    },
  );

  assert.ok(result, 'the coloured shopfront compiles');
  const entrance = result.patches.find((patch) => patch.kind === 'entrance');
  const glass = result.patches.find((patch) => patch.kind === 'display-glass');
  const fascia = result.patches.find((patch) => patch.kind === 'fascia');
  assert.equal(entrance?.colour, '#778899', 'entrance falls back to frame colour');
  assert.equal(glass?.colour, '#112233', 'display glass uses the glass colour');
  assert.equal(fascia?.colour, '#445566', 'fascia uses the fascia colour');

  // A door with its own colour wins over the frame fallback.
  const ownDoor = retailPatchesFromSource(
    source([
      feature('door-1', 'door', [400, 700, 500, 1000], { colour: '#101010' }),
      feature('win-1', 'window', [100, 760, 360, 900]),
    ]),
    wall,
    { frameColour: '#778899' },
  );
  assert.ok(ownDoor, 'the own-colour shopfront compiles');
  assert.equal(
    ownDoor.patches.find((patch) => patch.kind === 'entrance')?.colour,
    '#101010',
    'explicit door colour is preserved',
  );
}

console.log('Retail patches: assembly, patch set, dimension abstention and colour flow passed.');
