import assert from 'node:assert/strict';
import {
  assembleStorefront,
  type FacadeFeature,
} from './storefrontAssembly.ts';

// Extra fields (doorStyle, installation) are deliberately accepted so a fixture
// can prove the assembly never infers from them.
type FeatureFields = Partial<FacadeFeature> & Record<string, unknown>;

const feature = (
  id: string,
  kind: FacadeFeature['kind'],
  bounds: [number, number, number, number],
  extra: FeatureFields = {},
): FacadeFeature => ({ id, kind, bounds, ...extra });

// 1. A full shopfront groups entrance + two wide display windows + fascia +
//    retracted awning, and grades high confidence.
{
  const assembly = assembleStorefront([
    feature('door-1', 'door', [400, 700, 500, 1000], { doorStyle: 'glazed' }),
    feature('win-left', 'window', [100, 760, 360, 900]),
    feature('win-right', 'window', [540, 760, 900, 900]),
    feature('fascia-1', 'fascia', [80, 640, 920, 700], {
      text: 'Café De Waag',
      physicalSignId: 'sign-1',
    }),
    feature('awn-1', 'awning', [60, 600, 940, 650], {
      state: 'retracted',
      installation: 'folding',
    }),
  ]);
  assert.ok(assembly, 'a full shopfront is assembled');
  assert.equal(assembly.entrance?.id, 'door-1');
  assert.deepEqual(assembly.displayWindows.map((w) => w.id), ['win-left', 'win-right']);
  assert.equal(assembly.fascia?.id, 'fascia-1');
  assert.equal(assembly.signText, 'Café De Waag');
  assert.deepEqual(assembly.awnings.map((a) => a.id), ['awn-1']);
  assert.equal(assembly.awningState, 'retracted');
  assert.deepEqual(assembly.groundBand, [600, 1000]);
  assert.equal(assembly.confidence, 'high');
}

// 2. A residential front (one narrow door, portrait windows, no fascia) has no
//    display glazing and is therefore not a storefront.
{
  const assembly = assembleStorefront([
    feature('res-door', 'door', [400, 700, 460, 1000], { doorStyle: 'panelled' }),
    feature('res-win-1', 'window', [150, 720, 230, 920]),
    feature('res-win-2', 'window', [600, 720, 680, 920]),
  ]);
  assert.equal(assembly, null);
}

// 3. A door on the upper floor is never the ground entrance.
{
  const assembly = assembleStorefront([
    feature('upper-door', 'door', [300, 150, 400, 480], { doorStyle: 'glazed' }),
    feature('shop-win', 'window', [100, 760, 500, 900]),
  ]);
  assert.ok(assembly, 'display glazing keeps the frontage a storefront');
  assert.equal(assembly.entrance, null);
  assert.deepEqual(assembly.displayWindows.map((w) => w.id), ['shop-win']);
  assert.equal(assembly.confidence, 'low');
}

// 4. Awning state is observed, never inferred from installation; absent and
//    unknown stay distinct.
{
  const base: FacadeFeature[] = [
    feature('shop-door', 'door', [600, 700, 700, 1000]),
    feature('shop-win', 'window', [100, 760, 500, 900]),
  ];
  const absent = assembleStorefront([
    ...base,
    feature('awn-absent', 'awning', [80, 620, 920, 660], { state: 'absent' }),
  ]);
  assert.equal(absent?.awningState, 'absent');

  const none = assembleStorefront(base);
  assert.equal(none?.awningState, 'unknown');

  // A folding installation with no stated deployment is unknown, not extended.
  const installed = assembleStorefront([
    ...base,
    feature('awn-folding', 'awning', [80, 620, 920, 660], { installation: 'folding' }),
  ]);
  assert.equal(installed?.awningState, 'unknown');
}

// 5. Sign text is only ever the literal fascia text; a bare fascia yields null.
{
  const noText = assembleStorefront([
    feature('shop-door', 'door', [600, 700, 700, 1000]),
    feature('shop-win', 'window', [100, 760, 500, 900]),
    feature('fascia-plain', 'fascia', [80, 640, 920, 700]),
  ]);
  assert.ok(noText);
  assert.equal(noText.signText, null);

  const emptyText = assembleStorefront([
    feature('shop-win', 'window', [100, 760, 500, 900]),
    feature('fascia-empty', 'fascia', [80, 640, 920, 700], { text: '   ' }),
  ]);
  assert.equal(emptyText?.signText, null);
}

// 6. A paired door is a single entrance, and windows transom above it are not
//    counted as display glazing.
{
  const assembly = assembleStorefront([
    feature('door-paired', 'door', [380, 700, 500, 1000], { paired: true }),
    feature('door-twin', 'door', [510, 700, 630, 1000], { paired: true }),
    feature('transom', 'window', [400, 660, 490, 700]),
    feature('shop-win', 'window', [100, 760, 340, 900]),
  ]);
  assert.ok(assembly);
  assert.equal(assembly.entrance?.id, 'door-paired');
  assert.deepEqual(
    assembly.displayWindows.map((w) => w.id),
    ['shop-win'],
    'the transom above the entrance is excluded',
  );
  assert.equal(assembly.confidence, 'low');
}

// 7. A real ground crop frames a tall opening so that its centre sits above the
//    band cut; reaching the band is enough. This is the 21 Sep review's
//    missing-door / missing-storefront group: the reviewed ground crops put a
//    tall door centre near 42% of the crop, which the old centre test dropped.
//    A fascia is a shopfront component and is not band-filtered even when the
//    crop frames it above the cut.
{
  const assembly = assembleStorefront([
    feature('tall-door', 'door', [400, 100, 500, 700]),
    feature('tall-shop-win', 'window', [100, 200, 700, 700]),
    feature('high-fascia', 'fascia', [80, 60, 920, 160], { text: 'Sunny Bites' }),
    feature('crop-fill', 'material', [0, 0, 1000, 1000]),
  ]);
  assert.ok(assembly, 'a tall ground opening still assembles');
  assert.equal(assembly.entrance?.id, 'tall-door');
  assert.deepEqual(assembly.displayWindows.map((w) => w.id), ['tall-shop-win']);
  assert.equal(assembly.fascia?.id, 'high-fascia');
  assert.equal(assembly.signText, 'Sunny Bites');
  assert.equal(assembly.confidence, 'high');
}

console.log('Storefront assembly: grouping, ground band, awning state and sign text passed.');
