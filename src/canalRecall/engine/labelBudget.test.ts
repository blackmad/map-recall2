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

test('clipped tries (default) place exactly what every try along the run places, also when a run projects far off screen', () => {
  let seed = 7;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  // Points past y = 1000 m run toward the eye's foot: they project up to ~10^6 px below the screen (the aerial case).
  const far = (p: readonly number[]) => ({ x: 400 + p[0], y: p[1] < 1000 ? 300 - p[1] / 4 : 300 + 1e6 / Math.max(1, 2000 - p[1]), depth: 10 });
  let placed = 0;
  for (let trial = 0; trial < 20; trial++) {
    const list: LabelCandidate[] = Array.from({ length: 50 }, (_, i) => {
      const x0 = -500 + rand() * 1000, y0 = -800 + rand() * 1600, dx = (rand() - 0.5) * 200, dy = 40 + rand() * 120;
      return { id: `r${i}`, text: `Street ${i % 9}${'x'.repeat(i % 5)}`, kind: 'street', priority: Math.floor(rand() * 100), path: Array.from({ length: 6 + (i % 30) }, (_, k) => [x0 + dx * k * 0.1 + Math.sin(k) * 20, y0 + dy * k] as [number, number]) };
    });
    const o = { ...options, project: far };
    const clipped = placeLabels(list, o), every = placeLabels(list, { ...o, clipTries: false });
    assert.deepEqual(clipped, every, `trial ${trial}`);
    placed += clipped.length;
  }
  assert.ok(placed > 40, `placed ${placed}`);
  assert.deepEqual(placeLabels(candidates(), options), placeLabels(candidates(), { ...options, clipTries: false }));
});

test('from the air only signature-landmark POIs keep their names; streets, hoods and game points stay (aerialPoisOnly)', () => {
  const pois = Array.from({ length: 12 }, (_, i) => ({ id: `poi${i}`, text: `Cafe ${i}`, kind: 'poi' as const, priority: i < 2 ? 5200 : 300, lngLat: [0, 0] as [number, number], aerial: i < 2 }));
  // Spread the POIs over the view (local metres = px under `project`): lngLat is unused once `at` is set by setPois.
  const make = (only: boolean) => {
    const l = layer(null);
    l.setPois(pois.map((p, i) => ({ ...p, lngLat: [4.9 + (i % 4) * 0.002 - 0.003, 52.37 + Math.floor(i / 4) * 0.0015 - 0.0015] as [number, number] })));
    l.setPoints('game', [{ id: 'dest', text: 'Destination', kind: 'poi', priority: 1, lngLat: [4.9, 52.37] }]);
    l.aerialPoisOnly = only;
    l.draw(frame, view, 17, 1, project, [0, 0, 17, 0, 0]);
    return l.placed.reduce((o: Record<string, string[]>, p) => { (o[p.kind] ??= []).push(p.id); return o; }, {});
  };
  const all = make(false), air = make(true);
  assert.ok((all.poi ?? []).filter(id => id.startsWith('poi')).length > 4, JSON.stringify(all));
  assert.deepEqual((air.poi ?? []).filter(id => id.startsWith('poi')).sort(), (all.poi ?? []).filter(id => id === 'poi0' || id === 'poi1').sort());
  assert.ok(air.poi?.includes('dest'), 'the game point stays');
  assert.deepEqual(air.street?.length, all.street?.length);
  assert.deepEqual(air.hood, all.hood);
});
