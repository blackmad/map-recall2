import assert from 'node:assert/strict';
import { mergeOpenings, type MergeBox } from './openingMerge.ts';

let checks = 0;
const check = (condition: boolean, label: string) => { checks += 1; assert.ok(condition, label); };

const box = (along: number, up: number, kind: MergeBox['kind'], score = 0.9, width = 1, height = 2): MergeBox => ({ along, up, width, height, kind, score });

// Two models agree on one window: one box survives, both sources recorded.
const agreed = mergeOpenings([
  { name: 'rfdetr', boxes: [box(1, 3, 'window', 0.8)] },
  { name: 'rsjek', boxes: [box(1.05, 3, 'window', 0.9)] },
]);
check(agreed.length === 1, `agreement de-duplicates to one box, got ${agreed.length}`);
check(agreed[0].score === 0.9, 'the higher-scoring box survives');
check(agreed[0].sources.length === 2, 'both sources recorded');

// Different windows from each model are both kept.
const union = mergeOpenings([
  { name: 'rfdetr', boxes: [box(1, 3, 'window')] },
  { name: 'rsjek', boxes: [box(6, 3, 'window')] },
]);
check(union.length === 2, `union keeps both windows, got ${union.length}`);

// A window overlapping a door is dropped; the door wins.
const doorWins = mergeOpenings([
  { name: 'rfdetr', boxes: [box(1, 0, 'window')] },
  { name: 'rsjek', boxes: [box(1.05, 0, 'door')] },
]);
check(doorWins.length === 1 && doorWins[0].kind === 'door', 'overlapping window dropped in favour of the door');

// A window fully inside a door is dropped even with little IoU (door is larger).
const insideDoor = mergeOpenings([
  { name: 'rfdetr', boxes: [box(1.2, 0.4, 'window', 0.9, 0.5, 0.6)] },
  { name: 'rsjek', boxes: [box(1, 0, 'door', 0.9, 1, 2)] },
]);
check(insideDoor.length === 1 && insideDoor[0].kind === 'door', 'window inside a door is not a separate opening');

// A window elsewhere on the wall is untouched by a door.
const farWindow = mergeOpenings([
  { name: 'rfdetr', boxes: [box(6, 0, 'window')] },
  { name: 'rsjek', boxes: [box(1, 0, 'door')] },
]);
check(farWindow.length === 2, 'a distant window survives the door');
check(farWindow.filter((b) => b.kind === 'door').length === 1, 'the door is kept');

// Doors from two lanes de-duplicate, and other boxes pass through.
const mixed = mergeOpenings([
  { name: 'a', boxes: [box(1, 0, 'door'), box(1, 8, 'other')] },
  { name: 'b', boxes: [box(1.1, 0, 'door')] },
]);
check(mixed.filter((b) => b.kind === 'door').length === 1, 'duplicate doors collapse');
check(mixed.filter((b) => b.kind === 'other').length === 1, 'other boxes pass through');

// Determinism: same input, same output.
const a = mergeOpenings([{ name: 'x', boxes: [box(1, 3, 'window', 0.5), box(1.05, 3, 'window', 0.9)] }]);
const b = mergeOpenings([{ name: 'x', boxes: [box(1.05, 3, 'window', 0.9), box(1, 3, 'window', 0.5)] }]);
check(JSON.stringify(a) === JSON.stringify(b), 'merge is order-independent');

process.stdout.write(`opening merge checks passed (${checks} assertions).\n`);
