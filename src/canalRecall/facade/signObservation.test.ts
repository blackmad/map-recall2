import assert from 'node:assert/strict';
import {
  horizontalOverlapFraction,
  mainSignLine,
  mergeLinesIntoSigns,
  normaliseSignText,
  quadToWallMetres,
  type ImageQuad,
  type WallRect,
} from './signObservation.ts';

let checks = 0;
const check = (condition: boolean, label: string) => { checks += 1; assert.ok(condition, label); };
const close = (a: number, b: number, label: string, tolerance = 1e-6) =>
  check(Math.abs(a - b) < tolerance, `${label}: expected ${b}, got ${a}`);

// A full-frame quad is the whole wall.
const full: ImageQuad = {
  topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 }, bottomRight: { x: 1, y: 1 }, bottomLeft: { x: 0, y: 1 },
};
const whole = quadToWallMetres(full, 6, 5);
close(whole.boxWallM.along, 0, 'full quad along');
close(whole.boxWallM.up, 0, 'full quad up');
close(whole.boxWallM.width, 6, 'full quad width');
close(whole.boxWallM.height, 5, 'full quad height');

// A quad in the upper-left quarter, y is top-down: up must come out high, not low.
const upperLeft: ImageQuad = {
  topLeft: { x: 0, y: 0 }, topRight: { x: 0.5, y: 0 }, bottomRight: { x: 0.5, y: 0.4 }, bottomLeft: { x: 0, y: 0.4 },
};
const box = quadToWallMetres(upperLeft, 6, 5);
close(box.boxWallM.along, 0, 'upper-left along');
close(box.boxWallM.width, 3, 'upper-left width');
close(box.boxWallM.height, 2, 'upper-left height');
close(box.boxWallM.up, 3, 'upper-left sits high (y-down converted)');

// Out-of-range coordinates clamp rather than escape the wall.
const wild = quadToWallMetres({ ...full, bottomRight: { x: 1.4, y: 1.9 } }, 6, 5);
check(wild.boxWallM.along + wild.boxWallM.width <= 6 + 1e-9, 'clamped to wall width');
check(wild.boxWallM.up + wild.boxWallM.height <= 5 + 1e-9, 'clamped to wall height');

// A tilted quad keeps four corners rather than being squared off.
const tilted = quadToWallMetres({
  topLeft: { x: 0.1, y: 0.2 }, topRight: { x: 0.5, y: 0.1 }, bottomRight: { x: 0.52, y: 0.3 }, bottomLeft: { x: 0.12, y: 0.4 },
}, 10, 10);
check(tilted.quadWallM?.length === 4, 'tilted quad keeps four corners');
check((tilted.quadWallM?.[0][1] ?? 0) > (tilted.quadWallM?.[2][1] ?? 0), 'tilted quad top is higher than bottom');

// Overlap helper.
close(horizontalOverlapFraction({ along: 0, up: 0, width: 4, height: 1 }, { along: 2, up: 0, width: 4, height: 1 }), 0.5, 'half overlap');
close(horizontalOverlapFraction({ along: 0, up: 0, width: 2, height: 1 }, { along: 5, up: 0, width: 2, height: 1 }), 0, 'no overlap');

// The real case: three stacked lines of one fascia become one sign.
const line = (along: number, up: number, width: number, height: number): { boxWallM: WallRect; text: string } =>
  ({ boxWallM: { along, up, width, height }, text: `${along}` });
const fascia = mergeLinesIntoSigns([
  line(1.0, 3.4, 2.2, 0.30),   // NINA'S
  line(1.05, 3.05, 2.3, 0.25), // Exclusieve
  line(1.05, 2.75, 2.4, 0.25), // Handwork Boutique
]);
check(fascia.length === 1, `stacked fascia lines merge into one sign, got ${fascia.length}`);
close(fascia[0].boxWallM.up, 2.75, 'merged sign bottom');
close(fascia[0].boxWallM.up + fascia[0].boxWallM.height, 3.70, 'merged sign top');
check(fascia[0].lines.length === 3, 'all three lines kept');

// A separate sign below, outside the gap, is not merged.
const twoSigns = mergeLinesIntoSigns([
  line(1.0, 3.4, 2.2, 0.30),
  line(1.0, 1.0, 2.2, 0.30),
]);
check(twoSigns.length === 2, `a distant sign stays separate, got ${twoSigns.length}`);

// Side-by-side signs on the same row are not merged (no horizontal overlap).
const sideBySide = mergeLinesIntoSigns([
  line(0.5, 3.0, 1.5, 0.3),
  line(4.0, 3.0, 1.5, 0.3),
]);
check(sideBySide.length === 2, `side-by-side signs stay separate, got ${sideBySide.length}`);

// Regression: De Clercqstraat 70 letters the same fascia on two window panes, so
// Apple Vision returns `NINA'S / Exclusieve / Handwork Boutique` twice (once per
// pane, the far one truncated by scaffolding). They are one business and must
// collapse, or every per-sign count — including the invention rate — doubles.
const named = (along: number, up: number, width: number, height: number, text: string): { boxWallM: WallRect; text: string } =>
  ({ boxWallM: { along, up, width, height }, text });
const panes = mergeLinesIntoSigns([
  named(1.00, 3.40, 2.20, 0.30, 'NINAS'),
  named(1.05, 3.05, 2.30, 0.25, 'Exclusieve'),
  named(1.05, 2.75, 2.40, 0.25, 'Handwork Boutiqur'),
  named(3.00, 3.40, 1.60, 0.30, "NINA'S"),
  named(3.00, 3.05, 1.60, 0.25, 'Exclusive'),
  named(2.90, 2.75, 1.70, 0.25, 'Handwork Bo'),
]);
check(panes.length === 1, `two panes of one name collapse to one sign, got ${panes.length}`);
check(panes[0]?.lines.some((entry) => entry.text === 'Handwork Boutiqur'), 'the more complete reading of the repeated sign wins');

// The same name genuinely far apart is a second sign, not a repeat.
const branches = mergeLinesIntoSigns([
  named(0.5, 3.4, 1.5, 0.3, "NINA'S"),
  named(9.0, 3.4, 1.5, 0.3, "NINA'S"),
]);
check(branches.length === 2, `repeated name beyond the repeat gap stays separate, got ${branches.length}`);

// Reading order is top-to-bottom then left-to-right.
const order = mergeLinesIntoSigns([line(4.0, 1.0, 1.0, 0.3), line(0.5, 3.0, 1.0, 0.3), line(3.0, 3.0, 1.0, 0.3)]);
close(order[0].boxWallM.along, 0.5, 'top row left first');
close(order[1].boxWallM.along, 3.0, 'top row right second');
close(order[2].boxWallM.up, 1.0, 'bottom row last');

// Text normalisation: case and punctuation collapse; diacritics and letters stay.
check(normaliseSignText("  nina's  ") === "NINA'S", 'case and space collapse, apostrophe kept');
check(normaliseSignText('Handwork Boutique') === 'HANDWORK BOUTIQUE', 'plain uppercase');
check(normaliseSignText('IJscuypje; ICE CREAM') === 'IJSCUYPJE ICE CREAM', 'punctuation becomes space');
check(normaliseSignText('Bakkerij') === 'BAKKERIJ', 'Dutch word preserved');
check(normaliseSignText('Café') === 'CAFÉ', 'diacritics preserved');
check(normaliseSignText('  ') === '', 'empty after normalisation');

// The main line is the longest, which is the name on a fascia.
check(mainSignLine([{ text: 'Exclusieve' }, { text: "NINA'S" }, { text: 'Handwork Boutique' }]) === 'HANDWORK BOUTIQUE', 'longest line is the main line');
check(mainSignLine([{ text: '  ' }]) === null, 'no usable line');

process.stdout.write(`sign observation checks passed (${checks} assertions).\n`);
