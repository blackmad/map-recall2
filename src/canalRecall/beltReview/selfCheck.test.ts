/**
 * Belt review self-check and the wiring it drove (2026-11-21, Herengracht 2-90): the answer validation and tally, the
 * measures written onto a read, the read's storey profile / ground openings / attic frieze / gable reaching the plot
 * facts and the solo draw, the profiled storey heights, the measured ground boxes, and the photo's front line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMeasures, fieldOf, selfCheckProblems, tally, type SelfCheckDiff } from './selfCheck.ts';
import { beltDesignUnit, beltPlotFacts } from './plotRead.ts';
import { frontLineArg } from './frontLine.ts';
import { withDesignUnitRoof, SOLO_FRAME_HEX } from '../designUnits/draw.ts';
import { profiledStoreys, storeyHeightM, storeyOffsetM } from '../facadeLayout.ts';
import { soloGroundBoxes } from '../threeBuildingMesh.ts';
import type { Openings } from '../facadeOpenings.ts';

test('selfCheckProblems / fieldOf / tally', () => {
  const ok = { photo: { fractions: [0.3, 0.7], groundWindowRatio: 1.2, doorRatio: 0.8 }, drawing: { fractions: [0.5, 0.5], groundWindowRatio: null, doorRatio: null }, good: false,
    differences: [{ class: 'wiring', field: 'storeys', expected: '4', seen: '3', severity: 'major' }] } as const;
  assert.deepEqual(selfCheckProblems(ok as never), []);
  assert.deepEqual(selfCheckProblems({ ...ok, photo: { fractions: [1.2] } } as never), ['photo']);
  assert.deepEqual(selfCheckProblems({ ...ok, differences: [{ class: 'nope' }] } as never), ['differences[0]']);
  assert.equal(fieldOf('roofStorey'), 'roofStorey');
  assert.equal(fieldOf('chimney'), 'other');
  const d: SelfCheckDiff[] = [{ class: 'wiring', field: 'storeys', expected: '', seen: '', severity: 'major' }, { class: 'kit', field: 'ornaments', expected: '', seen: '', severity: 'minor' }, { class: 'wiring', field: 'storeys', expected: '', seen: '', severity: 'minor' }];
  assert.deepEqual(tally(d), { byClass: { wiring: 2, kit: 1 }, byField: { 'wiring:storeys': 2, 'kit:ornaments': 1 }, major: { wiring: 1 } });
});

test('applyMeasures: shares only when they count the read storeys; ratios in range; a gable rise in metres; a basement band', () => {
  const a: Record<string, unknown> = { storeys: 4, crown: 'neck' };
  assert.deepEqual(applyMeasures(a, { fractions: [0.3, 0.24, 0.23, 0.23], groundWindowRatio: 1.5, doorRatio: 0.8, crownRiseRatio: 0.25, basementRatio: 0.3 }, 14),
    ['storeyShares', 'groundWindowRatio', 'doorRatio', 'basementRatio', 'crownRiseM']);
  assert.deepEqual(a.storeyShares, [0.3, 0.24, 0.23, 0.23]);
  assert.equal(a.crownRiseM, 3.5);
  const b: Record<string, unknown> = { storeys: 3, crown: 'cornice' };
  assert.deepEqual(applyMeasures(b, { fractions: [0.3, 0.24, 0.23, 0.23], groundWindowRatio: 9, doorRatio: 0.2, crownRiseRatio: 0.2, basementRatio: null }, 14), []);
});

/** Herengracht 66 as read: 4 storeys, attic frieze on consoles, white frames, a tall dwelling ground, a fanlight door. */
const H66 = {
  fields: { storeys: 4, bays: 3, crown: 'cornice', cornice: 'attic-frieze', roofStorey: 'attic', dormers: { count: 0 }, heads: 'flat', whiteFrames: true, ground: 'dwelling', door: { bay: 0, surround: true }, eavesM: 15.55, facadeYear: 1800 },
  read: { wallHex: '#4a4645', dormerStyle: 'plain', roofMaterial: 'not-visible', whiteHeads: 'none', stringCourses: false, speklagen: 'none', stoopFlight: 'none', ornaments: ['oval fanlight with ornamental grille over door'], kitCannotSay: [],
    storeyShares: [0.3, 0.24, 0.23, 0.23], groundWindowRatio: 1.5, doorRatio: 0.8 },
};
const feature = (props: Record<string, unknown>) => ({ type: 'Feature', properties: { id: 'NL.IMBAG.Pand.0363100012168544', height: 15.55, facade: 'canal-priorBrickDark', facadeStyle: 'canal', ...props },
  geometry: { type: 'Polygon', coordinates: [[[4.8915, 52.3770], [4.89159, 52.3770], [4.89159, 52.37715], [4.8915, 52.37715], [4.8915, 52.3770]]] } });

test('the read\'s profile, ground openings, attic and fanlight reach the plot facts; none without the measures', () => {
  const p = beltPlotFacts(H66.fields, H66.read, { widthM: 6 })!;
  assert.deepEqual(p.facts.storeyShares, [0.3, 0.24, 0.23, 0.23]);
  assert.deepEqual(p.facts.groundOpenings, { windowRatio: 1.5, doorRatio: 0.8 });
  assert.equal(p.facts.attic, true);
  assert.equal(p.facts.door?.fanlight, true);
  const bare = beltPlotFacts(H66.fields, { ...H66.read, storeyShares: undefined, groundWindowRatio: undefined, doorRatio: undefined }, { widthM: 6 })!;
  assert.equal(bare.facts.storeyShares, undefined);
  assert.equal(bare.facts.groundOpenings, undefined);
  assert.equal(beltPlotFacts({ ...H66.fields, storeys: 3 }, H66.read)!.facts.storeyShares, undefined, 'shares that miscount the storeys are dropped');
});

test('the solo draw dresses the read: shares, white frames, measured ground, black-leaf doorcase, the attic frieze cornice', () => {
  const p = withDesignUnitRoof(feature({ designUnit: beltDesignUnit('0363100012168544', beltPlotFacts(H66.fields, H66.read, { widthM: 6 })!) })).properties as Record<string, any>;
  assert.equal(p.designSolo, true);
  assert.deepEqual(p.designStoreys.shares, [0.3, 0.24, 0.23, 0.23]);
  assert.equal(p.designFrameHex, SOLO_FRAME_HEX.white);
  assert.deepEqual(p.designGround, { windowRatio: 1.5, doorRatio: 0.8 });
  assert.equal(p.designDoorcase.door, 'black');
  assert.deepEqual(p.designCorniceDress, { supports: 'consoles', frieze: 'attic-lights', scale: 1.25 });
  assert.ok(p.registerForce.includes('row-cornice') && p.registerForce.includes('row-doorcase') && !p.registerForce.includes('kroonlijst'));
  const unread = withDesignUnitRoof(feature({})).properties as Record<string, any>;
  assert.equal(unread.designSolo, undefined, 'no stamp, no solo dress');
});

test('profiled storeys: shares split the upper wall; offsets add up; no profile keeps the even storey', () => {
  assert.deepEqual(profiledStoreys([0.24, 0.23, 0.23], 3, 9.3), [3.189, 3.056, 3.056]);
  assert.equal(profiledStoreys([0.5, 0.5], 3, 9), null);
  const l = { storeyM: 3, storeyHeightsM: [3.4, 3, 2.6] };
  assert.equal(storeyOffsetM(l, 2), 6.4);
  assert.equal(storeyHeightM(l, 2), 2.6);
  assert.equal(storeyOffsetM({ storeyM: 3 }, 2), 6);
});

const OPEN = { upper: { axes: [0.5], width: 0.4, sill: 0.25, head: 0.8 }, door: { axis: 0.5, width: 0.3, bottom: 0, top: 0.8 } } as unknown as Openings;

test('soloGroundBoxes: one opening per upper axis, the door the read bay, windows taller than the uppers, heads on the upper lintel line', () => {
  const layout = { bays: 3, bayWidthM: 2, groundM: 4.5, storeyM: 3.2, lengthM: 6 };
  const b = soloGroundBoxes(layout, OPEN, { windowRatio: 1.5, doorRatio: 0.8 }, 0, true)!;
  assert.equal(b.length, 3);
  assert.deepEqual(b.map(x => x.kind), ['door', 'window', 'window']);
  assert.equal(b[0].sillM, 0);
  assert.equal(b[0].headM, 3.6, 'the door at doorRatio of the ground');
  assert.equal(b[1].headM, 3.86, 'window heads keep the upper lintel gap (0.2 x 3.2 m) under the first floor');
  assert.ok(b[1].headM - b[1].sillM > 1.5 * 0.55 * 3.2 - 0.01, 'ground window 1.5x the upper one');
  const rtl = soloGroundBoxes(layout, OPEN, { windowRatio: 1.5, doorRatio: 0.8 }, 0, false)!;
  assert.equal(rtl[0].kind, 'door', 'the door is counted as seen');
  const base = soloGroundBoxes(layout, OPEN, { windowRatio: 1.2, doorRatio: 0.8, basementRatio: 0.3, raisedDoor: true }, 2, true)!;
  assert.deepEqual(base.map(x => x.kind), ['window', 'window', 'window', 'window', 'door'], 'a basement window under each ground window');
  assert.ok(base[4].sillM > 1, 'the door up the stoop');
  assert.equal(soloGroundBoxes({ ...layout, groundM: 1 }, OPEN, { windowRatio: 1.5, doorRatio: 0.8 }, 0, true), undefined);
});

test('frontLineArg: the photo\'s wall whole, or cut to David\'s facade edges; none without a wall', () => {
  const wall = { a: [4.89, 52.37] as [number, number], b: [4.8901, 52.37] as [number, number], lengthM: 5.33 };
  assert.equal(frontLineArg(undefined), null);
  assert.equal(frontLineArg(wall), 'line:4.89000000,52.37000000,4.89010000,52.37000000');
  const cut = frontLineArg(wall, { facadeSpanPx: [135, 375], pandSpanPx: [135, 615], ppm: 90 })!;
  assert.match(cut, /^line:4\.89000000,52\.37000000,4\.8900500\d,52\.37000000$/);
});

test('scaledTimberCornice: absent or 1 is the kit\'s own object (byte-identical); a scale grows heights and projections', async () => {
  const { scaledTimberCornice, ROW_TIMBER_CORNICE } = await import('../facadeOrnaments.ts');
  assert.equal(scaledTimberCornice(undefined), ROW_TIMBER_CORNICE);
  assert.equal(scaledTimberCornice(1), ROW_TIMBER_CORNICE);
  const k = scaledTimberCornice(1.6);
  assert.ok(Math.abs(k.corona - 0.32) < 1e-9 && Math.abs(k.console.h - 0.992) < 1e-9 && k.modillion.pitch === ROW_TIMBER_CORNICE.modillion.pitch);
});
