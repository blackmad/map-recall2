import assert from 'node:assert/strict';
import {
  compileRetail,
  type RetailCompileOptions,
  type RetailPatch,
} from './retailCompiler.ts';
import type {
  FacadeFeature,
  StorefrontAssembly,
} from './storefrontAssembly.ts';

type FeatureFields = Partial<FacadeFeature> & Record<string, unknown>;

const feature = (
  id: string,
  kind: FacadeFeature['kind'],
  bounds: [number, number, number, number],
  extra: FeatureFields = {},
): FacadeFeature => ({ id, kind, bounds, ...extra });

const near = (actual: number, expected: number, message: string): void =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, got ${actual}`,
  );

const rectNear = (
  actual: RetailPatch['rect'],
  expected: RetailPatch['rect'],
  message: string,
): void => {
  near(actual.xM, expected.xM, `${message} xM`);
  near(actual.yM, expected.yM, `${message} yM`);
  near(actual.widthM, expected.widthM, `${message} widthM`);
  near(actual.heightM, expected.heightM, `${message} heightM`);
};

const options = (overrides: Partial<RetailCompileOptions> = {}): RetailCompileOptions => ({
  wallWidthM: 10,
  wallHeightM: 5,
  sourceWidthPx: 1000,
  sourceHeightPx: 1000,
  ...overrides,
});

const assembly = (overrides: Partial<StorefrontAssembly> = {}): StorefrontAssembly => ({
  entrance: null,
  displayWindows: [],
  fascia: null,
  awnings: [],
  awningState: 'unknown',
  signText: null,
  groundBand: [0, 1000],
  confidence: 'low',
  ...overrides,
});

// 1. A full storefront emits entrance, two display windows, one textual fascia
//    and an extended canopy, in that deterministic order, with the hand-checked
//    pixel-to-metre conversion.
{
  const full = assembly({
    entrance: feature('door-1', 'door', [400, 700, 500, 1000], { colour: '#101010' }),
    displayWindows: [
      feature('win-left', 'window', [100, 760, 360, 900]),
      feature('win-right', 'window', [540, 760, 900, 900]),
    ],
    fascia: feature('fascia-1', 'fascia', [80, 640, 920, 700]),
    awnings: [feature('awn-1', 'awning', [60, 600, 940, 650], { colour: '#202020' })],
    awningState: 'extended',
    signText: 'Café De Waag',
    confidence: 'high',
  });
  const patches = compileRetail(full, options({
    glassColour: '#334455',
    frameColour: '#aabbcc',
    fasciaColour: '#ddeeff',
  }));

  assert.deepEqual(
    patches.map((patch) => patch.kind),
    ['entrance', 'display-glass', 'display-glass', 'fascia', 'awning-canopy'],
  );
  assert.deepEqual(
    patches.map((patch) => patch.role),
    ['door', 'shop-window', 'shop-window', 'sign', 'awning'],
  );
  assert.equal(patches[0].colour, '#101010', 'the door colour is used when present');
  assert.equal(patches[1].colour, '#334455');
  assert.equal(patches[3].colour, '#ddeeff');
  assert.equal(patches[3].text, 'Café De Waag');
  assert.equal(patches[4].colour, '#202020');

  // entrance [400,700,500,1000]: x=4, width=1, height=1.5, base y=0.
  rectNear(patches[0].rect, { xM: 4, yM: 0, widthM: 1, heightM: 1.5 }, 'entrance');
  // win-left [100,760,360,900]: x=1, width=2.6, height=0.7, y=0.5.
  rectNear(patches[1].rect, { xM: 1, yM: 0.5, widthM: 2.6, heightM: 0.7 }, 'win-left');
  // fascia [80,640,920,700]: x=0.8, width=8.4, height=0.3, y=1.5.
  rectNear(patches[3].rect, { xM: 0.8, yM: 1.5, widthM: 8.4, heightM: 0.3 }, 'fascia');
  // awning [60,600,940,650]: x=0.6, width=8.8, height=0.25, y=1.75.
  rectNear(patches[4].rect, { xM: 0.6, yM: 1.75, widthM: 8.8, heightM: 0.25 }, 'canopy');
}

// 2. A retracted awning emits housing only, never a canopy.
{
  const retracted = assembly({
    entrance: feature('door-1', 'door', [400, 700, 500, 1000]),
    displayWindows: [feature('win', 'window', [100, 760, 360, 900])],
    awnings: [feature('awn-1', 'awning', [60, 600, 940, 650], { colour: '#303030' })],
    awningState: 'retracted',
  });
  const patches = compileRetail(retracted, options());
  assert.deepEqual(
    patches.map((patch) => patch.kind),
    ['entrance', 'display-glass', 'awning-housing'],
  );
  assert.equal(patches.some((patch) => patch.kind === 'awning-canopy'), false);
  assert.equal(patches[2].colour, '#303030');
}

// 3. Absent or unknown awning states never invent an awning patch, even when an
//    awning feature is present in the assembly.
{
  const awningFeature = feature('awn-1', 'awning', [60, 600, 940, 650], { state: 'absent' });
  for (const state of ['absent', 'unknown'] as const) {
    const patches = compileRetail(
      assembly({
        displayWindows: [feature('win', 'window', [100, 760, 360, 900])],
        awnings: [awningFeature],
        awningState: state,
      }),
      options(),
    );
    assert.equal(
      patches.some((patch) => patch.kind.startsWith('awning-')),
      false,
      `no awning patch for ${state}`,
    );
  }
}

// 4. A fascia without literal sign text emits no fascia patch.
{
  const noText = assembly({
    displayWindows: [feature('win', 'window', [100, 760, 360, 900])],
    fascia: feature('fascia-1', 'fascia', [80, 640, 920, 700]),
    signText: null,
  });
  const patches = compileRetail(noText, options({ fasciaColour: '#ddeeff' }));
  assert.equal(patches.some((patch) => patch.kind === 'fascia'), false);

  const whitespace = assembly({
    displayWindows: [feature('win', 'window', [100, 760, 360, 900])],
    fascia: feature('fascia-1', 'fascia', [80, 640, 920, 700]),
    signText: '   ',
  });
  assert.equal(
    compileRetail(whitespace, options()).some((patch) => patch.kind === 'fascia'),
    false,
  );
}

// 5. Rects are clamped to the wall, and degenerate slivers are dropped.
{
  const patches = compileRetail(
    assembly({
      entrance: feature('door-big', 'door', [900, 0, 1100, 1200]),
      displayWindows: [
        feature('win-zero', 'window', [500, 760, 500, 900]),
        feature('win-sliver', 'window', [500, 760, 501, 900]),
        feature('win-ok', 'window', [200, 760, 300, 900]),
      ],
    }),
    options(),
  );
  assert.deepEqual(
    patches.map((patch) => patch.kind),
    ['entrance', 'display-glass'],
    'zero-width and sub-2cm windows are dropped',
  );
  // [900,0,1100,1200] raw x 9..11 -> 9..10; y raw -1..5 -> 0..5.
  rectNear(patches[0].rect, { xM: 9, yM: 0, widthM: 1, heightM: 5 }, 'clamped entrance');
  rectNear(patches[1].rect, { xM: 2, yM: 0.5, widthM: 1, heightM: 0.7 }, 'kept window');
}

// 6. Invalid wall/source dimensions abstain rather than dividing by zero.
{
  const base = assembly({ displayWindows: [feature('win', 'window', [100, 760, 360, 900])] });
  assert.deepEqual(compileRetail(base, options({ sourceWidthPx: 0 })), []);
  assert.deepEqual(compileRetail(base, options({ wallHeightM: 0 })), []);
}

console.log('Retail compiler: metric conversion, patch set, clamping and awning states passed.');
