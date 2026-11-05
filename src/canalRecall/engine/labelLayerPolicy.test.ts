// The label layer's lazy policy (lane E5, #218): a policy change no longer re-tests every named street in one frame;
// each candidate is tested when a draw first meets it in view. These pin that the lazy path draws exactly what the
// eager rebuild drew, never the name under question, and tests only what is in view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LabelLayer } from './overlays/labelLayer';
import type { LabelContext } from '../ownMap/labelPolicy';
import type { OverviewData } from '../ownMap/overviewFormat';
import type { CameraFrame } from '../ownMap/mapCamera';

function fakeContainer(): HTMLElement {
  const ctx = new Proxy({ measureText: (t: string) => ({ width: t.length * 6 }) } as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k as string] : () => undefined), set: () => true,
  });
  const el = () => ({ style: {} as Record<string, string>, className: '', width: 0, height: 0, appendChild() {}, getContext: () => ctx });
  const doc = { createElement: el };
  return { ownerDocument: doc, appendChild() {} } as unknown as HTMLElement;
}

// A 3 x 3 km city of named streets every 100 m (east-west), local metres around the origin.
function overview(): OverviewData {
  const streets = [];
  for (let i = 0; i < 30; i++) {
    const y = -1500 + i * 100;
    for (let x = -1500; x < 1500; x += 250) streets.push({ name: `Street ${i}`, cls: 'tertiary', points: [[x, y], [x + 120, y], [x + 240, y]] });
  }
  return { bounds: [-1500, -1500, 1500, 1500], water: [], parks: [], streets, waterLines: [{ name: 'Canal A', points: [[-200, 50], [0, 50], [200, 50]] }], hoods: [{ name: 'Centrum', at: [0, 0] }], landuse: [], rail: [], piers: [], pierLines: [], hoodRings: [] } as unknown as OverviewData;
}

const frame = { viewport: { width: 800, height: 600 }, distance: 500 } as unknown as CameraFrame;
// Top-down: 1 local metre = 1 px around the centre.
const project = (p: readonly number[]) => ({ x: 400 + p[0], y: 300 - p[1], depth: 100 });
const view: [number, number, number, number] = [-400, -300, 400, 300];

// `revision` is what ownWorldView's labelPolicy keys the context by: a new one is a policy change.
let revision = 0;
function policy(known: Set<string>, hiddenName = '', calls?: { n: number }): LabelContext {
  return { isLabelled: t => { if (calls) calls.n++; return known.has(t); }, hiddenName, spoilerIndex: null, quizQuiet: false, revision: `r${++revision}` } as LabelContext;
}

function drawWith(lazy: boolean, policies: LabelContext[]): string[][] {
  let current = policies[0];
  const layer = new LabelLayer(fakeContainer(), () => current, { lazyPolicy: lazy });
  layer.setOverview(overview());
  const out: string[][] = [];
  for (const p of policies) {
    current = p;
    layer.draw(frame, view, 16, 1, project);
    out.push(layer.placed.map(l => `${l.id}:${l.text}`).sort());
  }
  return out;
}

test('lazy policy draws what the eager rebuild drew, across policy changes', () => {
  const all = new Set(Array.from({ length: 30 }, (_, i) => `Street ${i}`).concat('Canal A'));
  const some = new Set(['Street 14', 'Street 15', 'Street 16', 'Canal A']);
  const policies = [policy(some), policy(all), policy(all, 'Street 15'), policy(new Set()), policy(some)];
  const eager = drawWith(false, policies), lazy = drawWith(true, policies);
  assert.deepEqual(lazy, eager);
  assert.ok(eager[1].length > eager[0].length, 'the wider policy places more names');
  assert.ok(eager[0].some(l => l.endsWith(':Street 15')), 'an earned name in view is drawn');
});

test('lazy policy never draws the name under question, even when it was drawn the frame before', () => {
  const all = new Set(Array.from({ length: 30 }, (_, i) => `Street ${i}`).concat('Canal A'));
  const [before, during] = drawWith(true, [policy(all), policy(all, 'Street 15')]);
  assert.ok(before.some(l => l.endsWith(':Street 15')));
  assert.ok(!during.some(l => l.endsWith(':Street 15')), 'the asked street is withheld at once');
});

test('a policy change tests only the candidates in view, once per revision', () => {
  const all = new Set(Array.from({ length: 30 }, (_, i) => `Street ${i}`).concat('Canal A'));
  const lazyCalls = { n: 0 }, eagerCalls = { n: 0 };
  drawWith(true, [policy(all, '', lazyCalls)]);
  drawWith(false, [policy(all, '', eagerCalls)]);
  // 360 street pieces + 1 canal in the city; the 800 x 600 view's 500 m buckets hold a fraction.
  assert.equal(eagerCalls.n, 361);
  assert.ok(lazyCalls.n > 0 && lazyCalls.n < eagerCalls.n / 2, `lazy tested ${lazyCalls.n}`);
  // A second draw under the same policy re-tests nothing.
  const calls = { n: 0 };
  const p = policy(all, '', calls);
  const layer = new LabelLayer(fakeContainer(), () => p, { lazyPolicy: true });
  layer.setOverview(overview());
  layer.draw(frame, view, 16, 1, project);
  const first = calls.n;
  layer.draw(frame, [-390, -300, 410, 300], 16, 1, project, [10, 0, 16, 0, 0]);
  assert.equal(calls.n, first);
});

test('lazy policy builds the overview structure in idle slices, and a draw before they finish drains them', () => {
  const queued: (() => void)[] = [];
  const all = new Set(Array.from({ length: 30 }, (_, i) => `Street ${i}`).concat('Canal A'));
  const p = policy(all);
  const layer = new LabelLayer(fakeContainer(), () => p, { lazyPolicy: true, schedule: step => queued.push(step) });
  layer.setOverview(overview());
  assert.equal(layer.structureReady, false, 'nothing is built in the setOverview call');
  assert.equal(queued.length, 1);
  while (queued.length) queued.shift()!();
  assert.equal(layer.structureReady, true);
  layer.draw(frame, view, 16, 1, project);
  const idle = layer.placed.map(l => l.id).sort();
  const early = new LabelLayer(fakeContainer(), () => p, { lazyPolicy: true, schedule: () => {} });
  early.setOverview(overview());
  early.draw(frame, view, 16, 1, project);
  assert.deepEqual(early.placed.map(l => l.id).sort(), idle, 'a draw before the slices ran draws the same');
});

test('POIs loading mid-ride rebuild only their own buckets, screened like the rest', () => {
  const all = new Set(Array.from({ length: 30 }, (_, i) => `Street ${i}`));
  const p = { ...policy(all, 'Street 3'), spoilerIndex: null };
  const layer = new LabelLayer(fakeContainer(), () => p, { lazyPolicy: true });
  layer.setOverview(overview());
  layer.draw(frame, view, 17, 1, project);
  layer.setPois([
    { id: 'poi:cafe', text: 'Cafe Noord', kind: 'poi', priority: 10, lngLat: [4.9, 52.37] as const },
    { id: 'poi:spoil', text: 'Street 3 Bakery', kind: 'poi', priority: 10, lngLat: [4.9, 52.37] as const },
  ]);
  assert.equal(layer.structureReady, true, 'the overview structure is kept');
  layer.draw(frame, view, 17, 1, project);
  assert.ok(!layer.placed.some(l => l.text.includes('Street 3')), 'a POI that says the asked name is not drawn');
});
