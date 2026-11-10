// #288: the own engine's labels ease in and out over 300 ms (ownMap/labelFade.ts) instead of popping, so a name the
// landmark approach withholds leaves like any other label, and the label ledger counts a fading-out label as drawn
// until its alpha is 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OwnLabelFade, OWN_LABEL_FADE_MS, easeLabelAlpha } from '../ownMap/labelFade';
import type { PlacedLabel } from '../ownMap/labels';
import { LabelLayer } from './overlays/labelLayer';
import { createLedger, lastLabelDrawn, sharedLedger } from '../game/labelDrawLedger';
import type { LabelContext } from '../ownMap/labelPolicy';
import type { CameraFrame } from '../ownMap/mapCamera';

const poi = (id: string, text: string, x: number, y: number): PlacedLabel => ({ id, text, kind: 'poi', size: 12, x, y });
const flat = (p: readonly number[]) => ({ x: 400 + p[0], y: 300 - p[1], depth: 100 });

test('easing is monotone and pinned at the ends', () => {
  assert.equal(easeLabelAlpha(0), 0);
  assert.equal(easeLabelAlpha(1), 1);
  assert.equal(easeLabelAlpha(-1), 0);
  assert.equal(easeLabelAlpha(2), 1);
  let prev = 0;
  for (let i = 1; i <= 100; i++) { const a = easeLabelAlpha(i / 100); assert.ok(a >= prev); prev = a; }
});

test('a label eases in and out over ~300 ms: a monotone ramp over many frames each way', () => {
  const fade = new OwnLabelFade();
  const a = poi('a', 'Westerkerk', 400, 300);
  const anchor = (): [number, number] => [0, 0];
  let t = 1000;
  const ins: number[] = [];
  for (let f = 0; f < 30; f++, t += 16) ins.push(fade.update([a], t, anchor, flat)[0].alpha);
  assert.ok(ins[0] > 0 && ins[0] < 0.05, `first frame ${ins[0]}`);
  for (let i = 1; i < ins.length; i++) assert.ok(ins[i] >= ins[i - 1]);
  const full = ins.findIndex(v => v === 1);
  assert.ok(full >= 16 && full <= 20, `full strength after ${full} frames of 16 ms`);
  assert.equal(fade.active, false, 'settled');
  // Lost its place (withheld, culled, occluded: the fade does not know which): eases out.
  const outs: number[] = [];
  for (let f = 0; f < 30; f++, t += 16) { const d = fade.update([], t, anchor, flat); outs.push(d[0]?.alpha ?? 0); }
  for (let i = 1; i < outs.length; i++) assert.ok(outs[i] <= outs[i - 1]);
  const gone = outs.findIndex(v => v === 0);
  assert.ok(gone >= 16 && gone <= 20, `gone after ${gone} frames`);
  assert.ok(outs.filter(v => v > 0.05 && v < 0.95).length >= 3, 'at least 3 frames mid-ramp');
  assert.equal(fade.size, 0);
  assert.equal(fade.active, false);
});

test('a long frame gap advances a fade by 100 ms at most', () => {
  const fade = new OwnLabelFade();
  const a = poi('a', 'A', 0, 0);
  fade.update([a], 1000, () => null, flat);
  const after = fade.update([a], 6000, () => null, flat)[0].alpha;
  assert.ok(after < 1, `${after}`);
  assert.ok(OWN_LABEL_FADE_MS === 300);
});

test('a fading-out label follows its anchor on screen', () => {
  const fade = new OwnLabelFade();
  const a = poi('a', 'A', 410, 290);
  for (let t = 0; t < 400; t += 16) fade.update([a], 1000 + t, () => [10, 10], flat);
  // The camera pans 30 px: the anchor projects 30 px further right.
  const panned = (p: readonly number[]) => ({ x: 430 + p[0], y: 300 - p[1], depth: 100 });
  const d = fade.update([], 1416, () => [10, 10], panned);
  assert.equal(d.length, 1);
  assert.equal(d[0].x, 440);
  assert.equal(d[0].y, 290);
  // Behind the eye: dropped.
  assert.equal(fade.update([], 1432, () => null, () => ({ x: 0, y: 0, depth: -1 })).length, 0);
});

test('re-placed mid fade-out, a label rises from where it was', () => {
  const fade = new OwnLabelFade();
  const a = poi('a', 'A', 0, 0);
  let t = 0;
  for (; t < 400; t += 16) fade.update([a], t, () => null, flat);
  let last = 1;
  for (let k = 0; k < 5; k++, t += 16) last = fade.update([], t, () => null, flat)[0].alpha;
  const back = fade.update([a], t, () => null, flat)[0].alpha;
  assert.ok(back > last && back < 1);
});

test('dropWhere forgets at once', () => {
  const fade = new OwnLabelFade();
  for (let t = 0; t < 100; t += 16) fade.update([poi('a', 'Asked', 0, 0), poi('b', 'Other', 50, 0)], t, () => null, flat);
  fade.dropWhere(l => l.text === 'Asked');
  const d = fade.update([], 116, () => null, flat);
  assert.deepEqual(d.map(l => l.text), ['Other']);
});

// The layer: the ledger records the fading-out name until it is gone; the asked name leaves at once.
function fakeContainer(): HTMLElement {
  const ctx = new Proxy({ measureText: (t: string) => ({ width: t.length * 6 }) } as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k as string] : () => undefined), set: () => true,
  });
  const el = () => ({ style: {} as Record<string, string>, className: '', width: 0, height: 0, appendChild() {}, getContext: () => ctx });
  return { ownerDocument: { createElement: el }, appendChild() {} } as unknown as HTMLElement;
}
const frame = { viewport: { width: 800, height: 600 }, distance: 500 } as unknown as CameraFrame;
const view: [number, number, number, number] = [-400, -300, 400, 300];
let revision = 0;
const policyOf = (hiddenName = '', hiddenNames: string[] = []) => ({ isLabelled: () => true, hiddenName, hiddenNames, spoilerIndex: null, quizQuiet: false, revision: `r${++revision}` } as unknown as LabelContext);

function withClock<T>(run: (advance: (ms: number) => void) => T): T {
  const perf = globalThis.performance as { now: () => number };
  const real = perf.now;
  let t = 10_000;
  perf.now = () => t;
  const g = globalThis as { __canalRecallLabelLedger?: unknown };
  const priorLedger = g.__canalRecallLabelLedger;
  g.__canalRecallLabelLedger = createLedger();
  try { return run(ms => { t += ms; }); } finally { perf.now = real; g.__canalRecallLabelLedger = priorLedger; }
}

test('layer: a withheld POI fades out over several frames and stays in the ledger until its alpha is 0', () => withClock(advance => {
  let policy = policyOf();
  let repaints = 0;
  const layer = new LabelLayer(fakeContainer(), () => policy, { lazyPolicy: true, repaint: () => repaints++ });
  layer.setPois([{ id: 'p1', text: 'Westerkerk', kind: 'poi', lngLat: [4.9, 52.37], priority: 10, minZoom: 0 }]);
  // Put the POI at the view centre whatever toLocal gives.
  const at = () => (layer as unknown as { poiBuckets: Map<string, { c: { at: [number, number] } }[]> }).poiBuckets.values().next().value![0].c.at;
  const project = (p: readonly number[]) => ({ x: 400 + p[0] - at()[0], y: 300 - (p[1] - at()[1]), depth: 100 });
  const bounds: [number, number, number, number] = [at()[0] - 400, at()[1] - 300, at()[0] + 400, at()[1] + 300];
  const pose = [at()[0], at()[1], 17, 0, 0] as const;
  for (let f = 0; f < 25; f++) { layer.draw(frame, bounds, 17, 1, project, pose); advance(16); }
  assert.deepEqual(layer.drawn.map(l => [l.text, l.alpha]), [['Westerkerk', 1]]);
  // The approach withholds it (#281): not a winner any more, still drawn while it fades.
  policy = policyOf('', ['Westerkerk']);
  const alphas: number[] = [];
  for (let f = 0; f < 25; f++) {
    layer.draw(frame, bounds, 17, 1, project, pose);
    assert.equal(layer.placed.length, 0, 'never a winner once withheld');
    const a = layer.drawn.find(l => l.text === 'Westerkerk')?.alpha ?? 0;
    alphas.push(a);
    // On screen at all: the ledger says "drawn now"; gone: it says when it left.
    const now = performance.now();
    // (The frame it leaves, the ledger stamps it with that frame's time: drawn until then.)
    const leftNow = a === 0 && (alphas[alphas.length - 2] ?? 1) > 0;
    assert.equal(lastLabelDrawn(sharedLedger(globalThis as never), 'Westerkerk', now) === now, a > 0 || leftNow, `frame ${f}, alpha ${a}`);
    advance(16);
  }
  for (let i = 1; i < alphas.length; i++) assert.ok(alphas[i] <= alphas[i - 1]);
  assert.ok(alphas.filter(a => a > 0.05 && a < 0.95).length >= 3, JSON.stringify(alphas));
  assert.equal(alphas[alphas.length - 1], 0);
  assert.ok(repaints > 0, 'a fade under a still camera asks for frames');
}));

test('layer: the asked name leaves at once (no lingering answer under an open question)', () => withClock(advance => {
  let policy = policyOf();
  const layer = new LabelLayer(fakeContainer(), () => policy, { lazyPolicy: true });
  layer.setPois([{ id: 'p1', text: 'Westerkerk', kind: 'poi', lngLat: [4.9, 52.37], priority: 10, minZoom: 0 }]);
  const at = () => (layer as unknown as { poiBuckets: Map<string, { c: { at: [number, number] } }[]> }).poiBuckets.values().next().value![0].c.at;
  const project = (p: readonly number[]) => ({ x: 400 + p[0] - at()[0], y: 300 - (p[1] - at()[1]), depth: 100 });
  const bounds: [number, number, number, number] = [at()[0] - 400, at()[1] - 300, at()[0] + 400, at()[1] + 300];
  for (let f = 0; f < 25; f++) { layer.draw(frame, bounds, 17, 1, project); advance(16); }
  assert.equal(layer.drawn.length, 1);
  policy = policyOf('Westerkerk');
  layer.draw(frame, bounds, 17, 1, project);
  assert.deepEqual(layer.drawn, []);
}));

test('layer: `fade: false` draws the winners at full strength, as before', () => withClock(advance => {
  const layer = new LabelLayer(fakeContainer(), () => policyOf(), { lazyPolicy: true, fade: false });
  layer.setPois([{ id: 'p1', text: 'Westerkerk', kind: 'poi', lngLat: [4.9, 52.37], priority: 10, minZoom: 0 }]);
  const at = (layer as unknown as { poiBuckets: Map<string, { c: { at: [number, number] } }[]> }).poiBuckets.values().next().value![0].c.at;
  const project = (p: readonly number[]) => ({ x: 400 + p[0] - at[0], y: 300 - (p[1] - at[1]), depth: 100 });
  layer.draw(frame, [at[0] - 400, at[1] - 300, at[0] + 400, at[1] + 300], 17, 1, project);
  assert.deepEqual(layer.drawn.map(l => l.alpha), [1]);
  advance(16);
}));
void view;
