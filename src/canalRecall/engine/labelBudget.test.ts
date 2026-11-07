// Budgeted full label placements from the air (lane R3-F #241, `?labelBudget=0` off): the placement walk is resumable
// (ownMap/labels.ts LabelPlacement), a full placement over its per-frame budget finishes on later frames with the
// same winners, and while panning from the air full placements come at most every `movingCadenceMs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LabelPlacement, placeLabels, type LabelCandidate, type PlaceOptions } from '../ownMap/labels';
import { LabelLayer, type LabelPose } from './overlays/labelLayer';
import type { LabelContext } from '../ownMap/labelPolicy';
import type { OverviewData } from '../ownMap/overviewFormat';
import type { CameraFrame } from '../ownMap/mapCamera';

const project = (p: readonly number[]) => ({ x: 400 + p[0], y: 300 - p[1], depth: 100 });
const options: PlaceOptions = { project, width: 800, height: 600, zoom: 16, advance: () => 6, fontSize: () => 12, repeatDistance: 260 };

function candidates(): LabelCandidate[] {
  const out: LabelCandidate[] = [];
  for (let i = 0; i < 40; i++) {
    const y = -290 + i * 15;
    out.push({ id: `s${i}`, text: `Street ${i % 7}`, kind: 'street', priority: 1000 + (i * 37) % 101, path: [[-380, y], [-100, y + 4], [200, y], [380, y - 3]] });
    out.push({ id: `p${i}`, text: `Place ${i}`, kind: 'poi', priority: 500 + (i * 53) % 97, at: [-350 + (i * 83) % 700, -280 + (i * 47) % 560] });
  }
  return out;
}

test('LabelPlacement run to the end is placeLabels, byte for byte', () => {
  const p = new LabelPlacement(candidates(), options);
  assert.equal(p.step(), true);
  assert.deepEqual(p.out, placeLabels(candidates(), options));
  assert.ok(p.out.length > 10, `placed ${p.out.length}`);
});

test('LabelPlacement in slices: resumes where it stopped and ends with the same labels', () => {
  let t = 0;
  const clock = () => t;
  const sliced = new LabelPlacement(candidates(), { ...options, project: q => { t += 1; return project(q); } });
  let steps = 0;
  while (!sliced.step(t + 6, clock)) { steps++; assert.ok(sliced.walked > 0 && sliced.walked < sliced.total); }
  assert.ok(steps >= 3, `steps ${steps}`);
  assert.deepEqual(sliced.out, placeLabels(candidates(), options));
});

function fakeContainer(): HTMLElement {
  const ctx = new Proxy({ measureText: (t: string) => ({ width: t.length * 6 }) } as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k as string] : () => undefined), set: () => true,
  });
  const el = () => ({ style: {} as Record<string, string>, className: '', width: 0, height: 0, appendChild() {}, getContext: () => ctx });
  return { ownerDocument: { createElement: el }, appendChild() {} } as unknown as HTMLElement;
}
function overview(): OverviewData {
  const streets = [];
  for (let i = 0; i < 30; i++) {
    const y = -1500 + i * 100;
    for (let x = -1500; x < 1500; x += 250) streets.push({ name: `Street ${i}`, cls: 'tertiary', points: [[x, y], [x + 120, y], [x + 240, y]] });
  }
  return { bounds: [-1500, -1500, 1500, 1500], water: [], parks: [], streets, waterLines: [], hoods: [{ name: 'Centrum', at: [0, 0] }], landuse: [], rail: [], piers: [], pierLines: [], hoodRings: [] } as unknown as OverviewData;
}
const frame = { viewport: { width: 800, height: 600 }, distance: 500 } as unknown as CameraFrame;
const view: [number, number, number, number] = [-400, -300, 400, 300];
const policy = { isLabelled: () => true, hiddenName: '', spoilerIndex: null, quizQuiet: false, revision: 'r' } as unknown as LabelContext;
const layer = (budget: number | null, cadence: number | null = null) => {
  const l = new LabelLayer(fakeContainer(), () => policy, { lazyPolicy: true });
  l.setOverview(overview());
  l.placeBudgetMs = budget; l.movingCadenceMs = cadence;
  return l;
};
const ids = (l: LabelLayer) => l.placed.map(p => `${p.id}:${p.text}`).sort();

test('a budgeted full placement over its budget finishes on later frames with the unbudgeted winners', () => {
  const plain = layer(null), budgeted = layer(1e-6);
  const pose = (k: number): LabelPose => [k * 0.02, 0, 16, 0, 0]; // a creeping camera: drawn every frame, never "moved enough"
  plain.draw(frame, view, 16, 1, project, pose(0));
  let frames = 0;
  for (; frames < 200; frames++) { budgeted.draw(frame, view, 16, 1, project, pose(frames)); if (budgeted.stats.full) break; }
  assert.ok(budgeted.stats.slicedFrames >= 2, `sliced over ${budgeted.stats.slicedFrames} frames`);
  assert.equal(budgeted.stats.full, 1);
  assert.deepEqual(ids(budgeted), ids(plain));
  assert.ok(plain.placed.length > 5);
  // The next frame re-places those winners (between full placements).
  budgeted.draw(frame, view, 16, 1, project, pose(frames + 1));
  assert.deepEqual(ids(budgeted), ids(plain));
});

test('off (null budget) and within budget: the placement is the unbudgeted one', () => {
  const plain = layer(null), roomy = layer(1e9);
  plain.draw(frame, view, 16, 1, project, [0, 0, 16, 0, 0]);
  roomy.draw(frame, view, 16, 1, project, [0, 0, 16, 0, 0]);
  assert.deepEqual(roomy.placed, plain.placed);
  assert.equal(roomy.stats.slicedFrames, 0);
});

test('panning from the air: full placements wait for the cadence, not ~24 px of travel', () => {
  const ride = layer(null), aerial = layer(1e9, 60_000);
  for (let k = 0; k < 5; k++) for (const l of [ride, aerial]) l.draw(frame, view, 16, 1, project, [k * 200, 0, 16, 0, 0]);
  assert.equal(ride.stats.full, 5);
  assert.equal(aerial.stats.full, 1);
  assert.equal(aerial.stats.winnersOnly, 4);
});
