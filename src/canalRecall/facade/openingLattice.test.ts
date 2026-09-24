import assert from 'node:assert/strict';
import { fillOpeningLattice, type LatticeResult } from './openingLattice.ts';
import type { MergedBox, OpeningKind } from './openingMerge.ts';

let checks = 0;
const check = (condition: boolean, label: string) => { checks += 1; assert.ok(condition, label); };

const box = (along: number, up: number, width = 1.4, height = 1.8, kind: OpeningKind = 'window'): MergedBox =>
  ({ along, up, width, height, kind, sources: ['fixture'] });

const centreOf = (opening: { along: number; up: number; width: number; height: number }) =>
  ({ along: opening.along + opening.width / 2, up: opening.up + opening.height / 2 });

const near = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

/** Detected boxes must come back first, in order, byte-for-byte identical. */
const assertDetectedPreserved = (input: readonly MergedBox[], result: LatticeResult) => {
  const detected = result.boxes.filter((opening) => opening.origin === 'detected');
  check(detected.length === input.length, `detected count preserved (${detected.length}/${input.length})`);
  input.forEach((original, index) => {
    const out = detected[index];
    check(out !== undefined
      && out.along === original.along
      && out.up === original.up
      && out.width === original.width
      && out.height === original.height
      && out.kind === original.kind
      && out.sources === original.sources,
      `detected box ${index} unchanged`);
  });
};

const facade = (): MergedBox[] => {
  const openings: MergedBox[] = [];
  for (const up of [0.5, 3.3, 6.1]) for (const along of [2, 4, 6, 8]) openings.push(box(along, up));
  return openings;
};

// A clean 3-row x 4-column facade with one window removed from each of the two
// upper rows: both are restored at the missing bay.
{
  const input = facade().filter((opening) =>
    !((near(opening.up, 3.3) && near(opening.along, 4)) || (near(opening.up, 6.1) && near(opening.along, 6))));
  const result = fillOpeningLattice(input, 10, 9);

  check(result.rows === 3, `clean facade finds 3 rows, got ${result.rows}`);
  check(result.imputed === 2, `clean facade restores both holes, got ${result.imputed}`);
  const restored = result.boxes.filter((opening) => opening.origin === 'imputed');
  check(restored.every((opening) => opening.kind === 'window' && near(opening.width, 1.4) && near(opening.height, 1.8)),
    'imputed boxes take the row median size');
  check(restored.some((opening) => near(centreOf(opening).along, 4.7) && near(centreOf(opening).up, 4.2)),
    'the missing middle-row bay is at its interpolated centre');
  check(restored.some((opening) => near(centreOf(opening).along, 6.7) && near(centreOf(opening).up, 7)),
    'the missing top-row bay is at its interpolated centre');
  check(restored.every((opening) => opening.rowSupport === 2), 'both restored bays are supported by the other two rows');
  check(result.rowDiagnostics[0].abstained !== null, 'the ground row is reported as untouched by default');
  assertDetectedPreserved(input, result);
}

// An irregular facade: the gaps fit no single pitch, so the row is left alone.
{
  const input = [
    ...facade().filter((opening) => near(opening.up, 0.5)),
    box(1, 3.3, 1, 1.8), box(2, 3.3, 1, 1.8), box(3.5, 3.3, 1, 1.8), box(5.5, 3.3, 1, 1.8),
  ];
  const result = fillOpeningLattice(input, 10, 9);
  check(result.imputed === 0, `irregular facade imputes nothing, got ${result.imputed}`);
  check(result.rowDiagnostics[1].abstained !== null && result.rowDiagnostics[1].abstained!.includes('pitch'),
    `irregular row explains the abstention, got ${result.rowDiagnostics[1].abstained}`);
  assertDetectedPreserved(input, result);
}

// A row with only two detected windows is below the minimum and abstains.
{
  const input = [...facade().filter((opening) => near(opening.up, 0.5)), box(2, 3.3), box(6, 3.3)];
  const result = fillOpeningLattice(input, 10, 9);
  check(result.imputed === 0, `a two-window row imputes nothing, got ${result.imputed}`);
  check(result.rowDiagnostics[1].abstained !== null && result.rowDiagnostics[1].abstained!.includes('fewer than'),
    `the two-window row explains the abstention, got ${result.rowDiagnostics[1].abstained}`);
  assertDetectedPreserved(input, result);
}

// A ground row with a door: off by default, and even when enabled the door's
// gap is not bridged.
{
  const input = [box(1, 0.5, 1.4, 1.6), box(3, 0.5, 1.4, 1.6), box(7, 0.5, 1.4, 1.6), box(5, 0, 1.4, 2.2, 'door')];
  const byDefault = fillOpeningLattice(input, 10, 9);
  check(byDefault.imputed === 0, `ground row is not filled by default, got ${byDefault.imputed}`);
  check(byDefault.rowDiagnostics[0].abstained !== null, 'the skipped ground row is explained');

  const enabled = fillOpeningLattice(input, 10, 9, { fillGroundRow: true });
  check(enabled.imputed === 0, `a door in the gap blocks the fill even when enabled, got ${enabled.imputed}`);
  assertDetectedPreserved(input, enabled);
}

// Small positional jitter must not change the rows or the imputed centres.
{
  const alongJitter = [0.08, -0.05, 0.11, -0.09, 0.07, -0.06, 0.1, -0.12, 0.05, -0.07, 0.09, -0.11];
  const upJitter = [0.1, -0.12, 0.06, -0.08, 0.11, -0.09, 0.07, -0.1, 0.12, -0.06, 0.08, -0.11];
  const input = facade()
    .map((opening, index) => ({ ...opening, along: opening.along + alongJitter[index], up: opening.up + upJitter[index], index }))
    .filter((opening) => opening.index !== 5 && opening.index !== 10)
    .map(({ index, ...opening }) => opening);
  const result = fillOpeningLattice(input, 10, 9);
  check(result.rows === 3, `jittered facade still finds 3 rows, got ${result.rows}`);
  check(result.imputed === 2, `jittered facade still restores both holes, got ${result.imputed}`);
  const restored = result.boxes.filter((opening) => opening.origin === 'imputed');
  check(restored.some((opening) => near(centreOf(opening).along, 4.7, 0.35) && near(centreOf(opening).up, 4.2, 0.35)),
    'the middle-row restoration survives jitter');
  check(restored.some((opening) => near(centreOf(opening).along, 6.7, 0.35) && near(centreOf(opening).up, 7, 0.35)),
    'the top-row restoration survives jitter');
  assertDetectedPreserved(input, result);
}

// An imputation whose row sits too close to the wall top is not placed.
{
  const input = [
    box(1, 0.4, 1.4, 2.6), box(3, 0.4, 1.4, 2.6), box(5, 0.4, 1.4, 2.6), box(7, 0.4, 1.4, 2.6),
    box(1, 2, 1.4, 2.6), box(3, 2, 1.4, 2.6), box(7, 3.9, 1.4, 1),
  ];
  const result = fillOpeningLattice(input, 9, 4.95);
  check(result.rows === 2, `the tight facade still clusters into 2 rows, got ${result.rows}`);
  check(result.imputed === 0, `an out-of-wall imputation is not placed, got ${result.imputed}`);
  check(result.rowDiagnostics[1].rejected >= 1, 'the rejected candidate is counted in the diagnostic');
  assertDetectedPreserved(input, result);
}

// No boxes at all is a no-op, not a crash.
{
  const result = fillOpeningLattice([], 10, 9);
  check(result.boxes.length === 0 && result.imputed === 0 && result.rows === 0, 'an empty wall returns empty');
}

process.stdout.write(`opening lattice checks passed (${checks} assertions).\n`);
