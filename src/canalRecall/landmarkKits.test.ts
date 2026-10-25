// Kit review 1 fixes (2026-10-24, docs/handoffs/kit-gaps.md "Landmark kits (review 1)"): every kit draws geometry,
// school walls come from a measurement or the BAG year's period palette (never one fixed beige), and pre-1940 schools
// the 3DBAG says are roofed get a hipped roof round their footprint.
//   node --import tsx --test src/canalRecall/landmarkKits.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { CLADDING_PITCH, HIP_MAX_PITCH_DEG, KITS, claddingZones, hipAround, kitGeometry, kitIds, shadeHex, simplifyRing, type Kit, type KitCladding, type KitCladdingKind, type KitWindowRow, type PartInput } from './landmarkKits.js';
import { KIT_FACADES, applyKitFacade } from './kitFacades.js';
import { PANORAMA_BRICK, PUBLIC_WALL, SCHOOL_RIBBON_FRAME, panoramaBrickHue, planPublic, publicKit, schoolHipRoof, schoolRoof, schoolWall, schoolWallDisplay, SCHOOL_HIP_MIN_EAVES_M, type SchoolFacts } from './publicBuildings.js';
import { FRAME_LIGHT, MAX_LEAF_PIXEL_SHARE, WINDOW_ROWS, glassVisible, glazingProfile, isOliveShade, lch, leafDominated, masonryFamily, mergeSpans } from './facade/cropWallColour.js';
import { roofPitch, type RoofPlane } from './facade/roofPitch.js';
import { LOW_PITCH_DEG, measuredRows, measuredWallDisplay, pitchedHip, schoolFacts } from './kitFacts.js';
import { PUBLIC_BUILDINGS } from './publicBuildingData.js';
import { WORSHIP_BUILDINGS } from './worshipBuildingData.js';
import { worshipKit } from './worshipBuildings.js';
import { PUBLIC_FACTS, SCHOOL_PERIOD_WALLS } from './publicBuildingFacts.js';
import { PERIOD_WALLS, cityWallTint, hexToRgb } from './look/palette.js';
import fs from 'node:fs';
import { NOT_PUBLIC_FORM, NOT_WORSHIP_FORM, PUBLIC_RETYPE } from './kitTypeOverrides.js';
import { measuredPandFor, pickKitPand, planesOverPart, towerPart } from './kitPands.js';

type V2 = [number, number];
const rect = (w: number, d: number, x = 0, y = 0): V2[] => [[x, y], [x + w, y], [x + w, y + d], [x, y + d], [x, y]];
const L: V2[] = [[0, 0], [40, 0], [40, 12], [12, 12], [12, 30], [0, 30], [0, 0]];
const NO_FACTS: SchoolFacts = { year: null, roof: 0, eavesM: null, ridgeM: null, wallHex: null, roofFits: true };
const facts = (over: Partial<SchoolFacts>): SchoolFacts => ({ year: 1931, roof: 3, eavesM: 5.6, ridgeM: 14.9, wallHex: null, roofFits: true, ...over });

test('every kit in KITS draws triangles of its own once its parts load', () => {
  for (const ring of [rect(30, 18), L]) {
    for (const kit of KITS) {
      const parts = new Map<string, PartInput>(kitIds(kit).map(id => [id, { id, ring, minHeightM: 0, heightM: 14 }]));
      const tris = kitGeometry(kit, parts).reduce((n, g) => n + g.tris.length, 0);
      assert.ok(tris > 0, `${kit.name}: ${tris} triangles`);
    }
  }
});

test('a plain cinema or worship body draws its coping and plinth on the host walls', () => {
  // Unmeasured (round 3 gives measured cinemas and churches walls, windows and roofs of their own).
  const cinema = publicKit(PUBLIC_BUILDINGS.find(e => e[0] === 'NL.IMBAG.Pand.0363100012092742')!, NO_FACTS);
  assert.ok(cinema.trim?.coping && cinema.trim.plinth, 'pre-1960 body: stone coping and plinth');
  const ring = rect(30, 18), id = cinema.body![0];
  const tris = kitGeometry(cinema, new Map([[id, { id, ring, minHeightM: 0, heightM: 11.2 }]]))[0].tris;
  const zs = tris.flatMap(t => t.p.map(p => p[2]));
  assert.equal(Math.max(...zs), 11.2, 'the coping tops the wall');
  assert.equal(Math.min(...zs), 0, 'the plinth stands on the ground');
  assert.ok(tris.every(t => Math.abs(t.n[2]) < 1e-9), 'bands are vertical');
  const modern = worshipKit(WORSHIP_BUILDINGS.find(e => e[0] === 'NL.IMBAG.Pand.0363100012123194')!, NO_FACTS);
  assert.ok(modern.trim?.coping && !modern.trim.plinth, 'a 1967 body gets a fascia only');
});

test('school walls: measured colour, else the BAG year period palette, never the old fixed beige', () => {
  const measured = schoolWall('x', 'm', facts({ year: 1980, wallHex: '#5c504a' }));
  assert.deepEqual(measured, { hex: cityWallTint(panoramaBrickHue('#5c504a')), source: 'measured' });
  const white = schoolWall('x', 'm', facts({ year: 1980, wallHex: '#e8e6df' }));
  assert.equal(white.source, 'measured');
  assert.notEqual(white.hex, cityWallTint('#e8e6df'), 'a pale wall is not pulled into the brick range');
  const period = schoolWall('NL.IMBAG.Pand.1', 'm', facts({ year: 1975 }));
  assert.equal(period.source, 'period');
  assert.ok(SCHOOL_PERIOD_WALLS.modern!.map(schoolWallDisplay).includes(period.hex), 'an unmeasured school takes a measured wall of its period');
  assert.ok(SCHOOL_PERIOD_WALLS.school!.map(schoolWallDisplay).includes(schoolWall('NL.IMBAG.Pand.1', 'e', facts({ year: 1931 })).hex));
  assert.ok(PERIOD_WALLS.photo.canal!.includes(schoolWall('NL.IMBAG.Pand.1', 'o', facts({ year: 1800 })).hex), 'a period with no measured schools keeps the city prior');
  assert.deepEqual(schoolWall('w1', 'm', undefined), { hex: PUBLIC_WALL.s.m, source: 'era' }, 'only a school with no facts at all keeps the era brick');
  // The published list: every school has facts, so none is left on the fixed era colour, and the walls vary.
  const schools = PUBLIC_BUILDINGS.filter(e => e[1] === 's');
  const factIds = new Set(PUBLIC_FACTS.map(f => f[0]));
  assert.ok(schools.every(e => factIds.has(e[0])), 'every school has a facts row');
  const walls = schools.map(e => publicKit(e).wall!.hex);
  assert.equal(walls.filter(h => h === PUBLIC_WALL.s.m).length, 0, 'no school wears the fixed beige');
  assert.ok(new Set(walls).size > 60, `walls vary (${new Set(walls).size} distinct)`);
  assert.ok(PUBLIC_FACTS.filter(f => f[5]).length > 120, 'most schools are measured from their own crops');
});

test('pre-1940 schools under a 3DBAG ridge get a hipped roof; others keep theirs', () => {
  const hip = schoolHipRoof(facts({}), 12.6)!;
  assert.ok(hip, 'De Weidevogel (1931, eaves 5.6, ridge 14.9)');
  assert.ok(Math.abs(hip.eavesM - 7.2) < 0.11, `main eaves from the 70th percentile: ${hip.eavesM}`);
  assert.ok(Math.abs(hip.eavesM + hip.riseM - 14.9) < 0.11, 'up to the 3DBAG ridge');
  assert.equal(schoolHipRoof(facts({ eavesM: 3.5, ridgeM: 16.9 }), 12.7)!.eavesM, SCHOOL_HIP_MIN_EAVES_M, 'a porch eaves is raised to two storeys');
  assert.equal(schoolHipRoof(facts({ year: 1955 }), 12.6), null, 'post-war: no hip');
  assert.equal(schoolHipRoof(facts({ ridgeM: null }), 12.6), null, 'no 3DBAG ridge: flat');
  assert.equal(schoolHipRoof(facts({ eavesM: 13.6, ridgeM: 14.5 }), 13.7), null, 'a parapet bump is no roof');
  // The published kits: rows 14 and 19 of the review sheet are hipped, the flat Amsterdam School pair (37, 38) is not.
  const kit = (id: string) => KITS.find(k => k.name === `Generic school NL.IMBAG.Pand.${id}`)!;
  for (const id of ['0363100012086684', '0363100012064693', '0363100012068625']) assert.equal(kit(id).halls![0].hip, true, `${id} hipped`);
  for (const id of ['0363100012088641', '0363100012118525', '0363100012072950']) assert.equal(kit(id).halls![0].hip, undefined, `${id} flat`);
  const pre = kit('0363100012086684').halls![0];
  assert.ok(pre.windows!.rows.every(r => r.z1 <= pre.eavesM), 'windows stay under the lowered eaves');
});

test('hipAround roofs an L plan wing by wing, within the eaves and ridge, and lowers a narrow wing', () => {
  const tris = hipAround(L, 7, 5)!;
  assert.ok(tris.length > 0);
  const zs = tris.flatMap(t => t.p.map(p => p[2]));
  assert.equal(Math.min(...zs), 7);
  assert.ok(Math.max(...zs) <= 12 + 1e-9);
  assert.ok(tris.every(t => t.n[2] > 0 && Math.abs(Math.hypot(...t.n) - 1) < 1e-9), 'every face looks up, unit normals');
  // A 6 m wide strip cannot take a 10 m rise at 50 degrees: the rise is lowered to the steepest pitch that fits.
  const narrow = hipAround(rect(40, 6), 6, 10)!;
  const top = Math.max(...narrow.flatMap(t => t.p.map(p => p[2])));
  assert.ok(top < 16 && top - 6 <= 3 * Math.tan((HIP_MAX_PITCH_DEG * Math.PI) / 180) + 1e-6, `narrow wing ridge ${top}`);
  // A 0.8 m jog in a BAG outline is smoothed away before the ring is set in.
  const jog: V2[] = [[0, 0], [20, 0], [20, 0.8], [40, 0.8], [40, 14], [0, 14], [0, 0]];
  assert.equal(simplifyRing(jog, 1).length, 4);
  assert.ok(hipAround(jog, 6, 5));
});

// Kit colour round 2 (GitHub #34): the colour rules for school walls read off panorama crops.
test('crop colour rules: leaf shade is masked, walls outside every masonry family are dropped', () => {
  // Row 32's trees in front of the brick (pixel boxes on the crop) are leaf shade; its brick piers are not.
  assert.ok(isOliveShade(74, 68, 37) && isOliveShade(85, 78, 53), 'dark olive leaves');
  assert.ok(!isOliveShade(120, 94, 66), 'red-brown brick as the panorama reads it (h 72)');
  assert.ok(!isOliveShade(184, 145, 110) && !isOliveShade(120, 100, 70), 'yellow brick, also in shade');
  assert.ok(!isOliveShade(226, 213, 186) && !isOliveShade(160, 158, 150), 'cream render and concrete');
  assert.equal(masonryFamily([176, 90, 64]), 'brick');
  assert.equal(masonryFamily([120, 94, 66]), 'brick');
  assert.equal(masonryFamily([66, 55, 50]), 'render', 'a dark brown brick with no chroma left is a neutral wall');
  assert.equal(masonryFamily([211, 177, 132]), 'buff');
  assert.equal(masonryFamily([226, 213, 186]), 'render');
  assert.equal(masonryFamily([230, 230, 226]), 'render');
  assert.equal(masonryFamily([0xf7, 0xc3, 0x86]), null, 'row 35: the mural');
  assert.equal(masonryFamily([79, 72, 53]), null, 'row 3: shaded olive under blue cladding');
  assert.equal(masonryFamily([87, 77, 52]), null, 'row 23: olive');
  assert.equal(masonryFamily([0x3d, 0x6b, 0x90]), null, 'blue cladding');
});

test('panorama brick hue: khaki brick is pulled toward red, buff and grey are left alone', () => {
  for (const khaki of ['#4f4a3f', '#514530', '#534b38', '#5e4b36']) {
    const n = parseInt(khaki.slice(1), 16), before = lch([n >> 16, (n >> 8) & 255, n & 255]);
    const m = parseInt(panoramaBrickHue(khaki).slice(1), 16), after = lch([m >> 16, (m >> 8) & 255, m & 255]);
    assert.ok(after.h < before.h - 10 && after.h < 70, `${khaki}: h ${before.h.toFixed(0)} -> ${after.h.toFixed(0)}`);
    assert.ok(Math.abs(after.L - before.L) < 1.5 && Math.abs(after.C - before.C) < 1.5, 'lightness and chroma kept');
  }
  assert.equal(panoramaBrickHue('#784e42'), '#784e42', 'a red brick under the threshold hue is untouched');
  assert.equal(panoramaBrickHue('#b99072'), '#b99072', 'light yellow brick keeps its hue');
  assert.equal(panoramaBrickHue('#413938'), '#413938', 'near-neutral dark brick');
  assert.ok(PANORAMA_BRICK.keep > 0 && PANORAMA_BRICK.keep < 1);
});

test('school glazing: measured ribbon windows and a white top band, opt in', () => {
  const entry = PUBLIC_BUILDINGS.find(e => e[1] === 's' && e[2] === 'f' && e[5] === 'm')!;
  const plain = publicKit(entry, facts({ year: 1975, glazing: null, topBandHex: null }));
  const strip = publicKit(entry, facts({ year: 1975, glazing: 'ribbon', topBandHex: '#f0f0ee' }));
  const w0 = plain.halls![0].windows!, w1 = strip.halls![0].windows!;
  assert.ok(w0.rows.every(r => !r.ribbon) && !w0.topBand, 'no measurement: the era windows');
  assert.ok(w1.rows.length && w1.rows.every(r => r.ribbon), 'ribbon rows');
  assert.equal(w1.frameHex, SCHOOL_RIBBON_FRAME);
  assert.ok(w1.topBand && w1.topBand.m > 0);
  assert.ok(w1.rows.every(r => r.z1 <= strip.halls![0].eavesM - w1.topBand!.m), 'no window runs into the band');
  const ring = rect(30, 12), id = entry[0], parts = new Map([[id, { id, ring, minHeightM: 0, heightM: entry[3] }]]);
  const geo = (k: typeof plain) => kitGeometry(k, parts)[0].tris;
  const t1 = geo(strip);
  assert.ok(t1.some(t => t.hex === w1.topBand!.hex && Math.max(...t.p.map(p => p[2])) === strip.halls![0].eavesM), 'the band tops the wall');
  // A ribbon is continuous: on the 30 m wall the glass spans almost the whole edge in one piece.
  const glass = t1.filter(t => t.hex === w1.glassHex && Math.abs(t.p[0][1]) < 0.2 && Math.abs(t.p[1][1]) < 0.2 && Math.abs(t.p[2][1]) < 0.2);
  const xs = glass.flatMap(t => t.p.map(p => p[0]));
  assert.ok(Math.max(...xs) - Math.min(...xs) > 27, 'glass runs the wall');
  assert.ok(geo(plain).every(t => t.hex !== SCHOOL_RIBBON_FRAME));
  const ribbons = PUBLIC_FACTS.filter(f => f[7] === 2).length, punched = PUBLIC_FACTS.filter(f => f[7] === 1).length;
  assert.ok(ribbons > 20 && punched > 20, `the crops read both (${ribbons} ribbon, ${punched} punched)`);
});

// Kit review round 3 (GitHub #36): roof form from the LoD2.2 planes, window rows and frames from the crops, measured
// cinema and worship walls. Every rule is opt in on a measurement.
test('roof pitch: flat, pitched, mono-pitch from LoD2.2 planes; the main roof sets eaves and ridge', () => {
  const plane = (planM2: number, slopeDeg: number, azimuthDeg: number, zMin: number, zMax: number): RoofPlane => ({ planM2, slopeDeg, azimuthDeg, zMin, zMax });
  assert.equal(roofPitch([plane(400, 2, 0, 15, 15.2), plane(20, 40, 90, 15, 17)])!.form, 'flat', 'a flat roof with a stair-house slope');
  const gable = roofPitch([plane(200, 45, 90, 8, 14), plane(200, 45, 270, 8, 14), plane(10, 70, 0, 14, 40)])!;
  assert.equal(gable.form, 'pitched'); assert.equal(gable.mono, false);
  assert.equal(gable.eavesM, 8); assert.equal(gable.ridgeM, 14, 'a spire does not lift the ridge');
  assert.ok(roofPitch([plane(300, 30, 180, 4, 12), plane(20, 3, 0, 4, 4)])!.mono, 'one facing: mono-pitch');
  assert.equal(roofPitch([plane(100, 45, 0, 5, 9), plane(100, 3, 0, 9, 9)])!.form, 'mixed');
  assert.equal(roofPitch([]), null);
});

test('crop window rows and frames: windows with pale frames on brick, a blank wall reads none', () => {
  const W = 200, H = 100, ppm = 20, wall = [120, 60, 45];
  const img = (windows: boolean) => {
    const data = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const z = (H - y) / ppm, inRow = windows && z > 1.5 && z < 3.5, bay = x % 40;
      const c = inRow && bay >= 8 && bay < 32 ? (bay < 11 || bay >= 29 || z < 1.65 || z > 3.35 ? [235, 235, 230] : [40, 48, 56]) : wall;
      data.set(c, (y * W + x) * 3);
    }
    return glazingProfile({ data, width: W, height: H, channels: 3, ppm, topM: H / ppm, eavesM: H / ppm, wall, norm: c => [c[0], c[1], c[2]] });
  };
  const win = img(true), blank = img(false);
  // Round 4: a window row needs glass, so the all-frame head rows (3.35-3.5 m) end the band at 3.3 m.
  assert.ok(win.windowBands!.length === 1 && win.windowBands![0][0] <= 1.6 && win.windowBands![0][1] >= 3.3, JSON.stringify(win.windowBands));
  assert.ok(win.frameHex, 'pale frames read');
  assert.equal(blank.windowBands!.length, 0); assert.equal(blank.frameHex, null);
  assert.ok(FRAME_LIGHT.dL > 0 && WINDOW_ROWS.framePale > 0);
});

test('school roof: the LoD2.2 form decides flat or hipped; unknown keeps the review 1 rule', () => {
  const pre = facts({ year: 1921, eavesM: 5.2, ridgeM: 16.1 });
  assert.ok(schoolRoof(pre, 15.1), 'no LoD2.2 form: the tile ridge hips a pre-war school');
  assert.equal(schoolRoof({ ...pre, pitch: 'flat', pitchEavesM: 13.5, pitchRidgeM: 16.1 }, 15.1), null, 'flat planes: flat (row 301)');
  assert.equal(schoolRoof({ ...pre, pitch: 'mixed', pitchEavesM: 10.8, pitchRidgeM: 14.3 }, 12.2), null, 'half pitched: flat (row 304)');
  const late = schoolRoof(facts({ year: 1979, pitch: 'pitched', pitchEavesM: 3.8, pitchRidgeM: 6.5 }), 5.7)!;
  assert.deepEqual(late, { eavesM: 3.8, riseM: 2.7 }, 'a pitched 1979 pavilion is roofed (row 520)');
  assert.equal(schoolRoof(facts({ year: 1979, pitch: 'pitched', pitchEavesM: 3.8, pitchRidgeM: 5 }), 5.7), null, 'too low a rise: flat');
});

test('cinema and worship kits: measured wall, window rows, frames and roof; unmeasured stays the plain body', () => {
  const cinemaEntry = PUBLIC_BUILDINGS.find(e => e[1] === 'c' && e[5] === 'm')!;
  assert.ok(publicKit(cinemaEntry, NO_FACTS).body, 'no facts: plain body');
  assert.ok(publicKit(cinemaEntry, { ...NO_FACTS, blank: true }).body, 'a blank wall: plain body');
  const punched = publicKit(cinemaEntry, { ...NO_FACTS, wallHex: '#d7cdb0', glazing: 'punched', frameHex: '#e8ecec' });
  const hall = punched.halls![0];
  assert.ok(!punched.body && hall.windows!.rows.length && hall.windows!.sash, 'punched rows with sash bars');
  assert.equal(punched.wall!.hex, measuredWallDisplay('#d7cdb0'));
  assert.equal(hall.riseM, 0, 'a modern cinema keeps its flat lid');
  const ribbon = publicKit(cinemaEntry, { ...NO_FACTS, glazing: 'ribbon' }).halls![0].windows!;
  assert.ok(ribbon.rows.every(r => r.ribbon) && !ribbon.sash);
  const white = measuredWallDisplay('#e8e6df');
  assert.ok(lch(hexToRgb(white)).L > 85, `white render stays white (${white})`);
  // Worship: a body under pitched planes is hipped at their eaves and ridge, tinted where measured (rows 299, 309).
  const body = WORSHIP_BUILDINGS.find(e => e[2] === 'b' && e[3] > 8)!;
  assert.ok(worshipKit(body, NO_FACTS).body);
  const roofed = worshipKit(body, { ...NO_FACTS, pitch: 'pitched', pitchEavesM: 5, pitchRidgeM: 12, roofHex: '#55595e' }).halls![0];
  assert.ok(roofed.hip && roofed.eavesM === 5 && roofed.riseM === 7 && roofed.roofHex === '#55595e');
  assert.equal(worshipKit(body, { ...NO_FACTS, pitch: 'flat', pitchEavesM: 5, pitchRidgeM: 12 }).body?.[0], body[0], 'flat planes: no roof');
  // Sash bars draw on the glass: frame colour triangles in front of the glass plane.
  const ring = rect(30, 12), id = cinemaEntry[0], parts = new Map([[id, { id, ring, minHeightM: 0, heightM: cinemaEntry[3] }]]);
  const tris = kitGeometry(punched, parts)[0].tris;
  assert.ok(tris.filter(t => t.hex === hall.windows!.sash!.hex).length > tris.filter(t => t.hex === hall.windows!.glassHex).length, 'bars outnumber panes');
});

// Kit review round 3 (2026-10-24, GitHub #37): wrong kit types fixed at the source (kitTypeOverrides.ts), and the OSM-only
// kit parts joined to their BAG pand (kitPands.ts, public/data/extracts/amsterdam/kit-pands.json).
test('round 3: OSM worship/school tags on houses and housing blocks take no kit; Zonnehuis is a hipped school', () => {
  const names = new Set(KITS.map(k => k.name));
  for (const [kind, pand] of [
    ['mosque', '0363100012237810'], ['church', '0363100012148521'], ['temple', '0363100012083695'], ['mosque', '0363100012130941'],
    ['mosque', '0363100012108972'], ['church', '0363100012233557'], ['church', '0363100012246231'], ['mosque', '0363100012142532'],
    ['mosque', '0363100012237290'], ['school', '0363100012090063'],
  ]) {
    assert.ok(!names.has(`Generic ${kind} NL.IMBAG.Pand.${pand}`), `${pand} keeps no ${kind} kit`);
    assert.ok(NOT_WORSHIP_FORM[`NL.IMBAG.Pand.${pand}`] || NOT_PUBLIC_FORM[`NL.IMBAG.Pand.${pand}`], `${pand} listed with a reason`);
  }
  // Real churches the review flagged keep their kit: BAG gives meeting use only (or a pastorie beside it).
  for (const pand of ['0363100012062993', '0363100012089044', '0362100001054286', '0362100001055799']) assert.ok(names.has(`Generic church NL.IMBAG.Pand.${pand}`), pand);
  assert.ok(!names.has('Generic cinema NL.IMBAG.Pand.0363100012092742'), 'Zonnehuis is no windowless theatre box');
  const zonnehuis = KITS.find(k => k.name === 'Generic school NL.IMBAG.Pand.0363100012092742')!;
  assert.ok(zonnehuis, 'Zonnehuis is drawn as a school');
  const hall = zonnehuis.halls![0];
  assert.equal(hall.hip, true, 'under its hipped roof');
  assert.equal(hall.eavesM, 6); assert.equal(hall.riseM, 9.9);
  const retype = PUBLIC_RETYPE['NL.IMBAG.Pand.0363100012092742'];
  assert.deepEqual(planPublic({ kind: 's', heightM: 11.2, year: 1932, areaM2: 972, rect: null }), { mode: retype.entry[2], eavesM: retype.entry[3], riseM: retype.entry[4], era: retype.entry[5] });
  for (const id of Object.keys({ ...NOT_WORSHIP_FORM, ...NOT_PUBLIC_FORM, ...PUBLIC_RETYPE })) {
    assert.ok([...WORSHIP_BUILDINGS, ...PUBLIC_BUILDINGS].some(e => e[0] === id), `${id} is still in a generated list (else drop the override)`);
  }
});

test('round 3: an OSM part takes the pand it stands in, else the pand inside it', () => {
  const part = [rect(10, 10)], inPand = { pand: 'A', rings: [rect(20, 20, -5, -5)] }, beside = { pand: 'B', rings: [rect(10, 10, 9, 0)] };
  assert.deepEqual(pickKitPand(part, [beside, inPand]), { pand: 'A', share: 1, pandShare: 0.25, others: [] });
  const big = [rect(40, 10)], small = { pand: 'S', rings: [rect(8, 8, 1, 1)] }, sliver = { pand: 'T', rings: [rect(3, 10, 38, 0)] };
  assert.equal(pickKitPand(big, [small, sliver])?.pand, 'S', 'a part over several small pands takes the one fully inside it');
  assert.equal(pickKitPand(part, [{ pand: 'F', rings: [rect(5, 5, 30, 30)] }]), null);
});

test('round 3: kit-pands.json joins the named OSM-only landmark kits to their catalogue pands', () => {
  const ids = JSON.parse(fs.readFileSync(new URL('../../public/data/extracts/amsterdam/kit-pands.json', import.meta.url), 'utf8')).ids as Record<string, { pand: string | null }>;
  const mainPand = (name: string) => {
    const counts = new Map<string, number>();
    for (const id of kitIds(KITS.find(k => k.name === name)!)) { const p = ids[id]?.pand; if (p) counts.set(p, (counts.get(p) ?? 0) + 1); }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  // Pands as the bespoke builders' footprint files and the landmark catalogue give them.
  const expected: Record<string, string> = {
    Centraal: '0363100012185598', Stedelijk: '0363100012077791', Krijtberg: '0363100012185920', Munttoren: '0363100012168045',
    NEMO: '0363100012164988', 'NEMO deck': '0363100012164988', 'Royal Palace': '0363100012167579', Scheepvaartmuseum: '0363100012170236',
    'Sint-Nicolaas': '0363100012165691', Waag: '0363100012171850',
  };
  for (const [name, pand] of Object.entries(expected)) assert.equal(mainPand(name), pand, name);
  // Generic parts: Bijlmerbios (ten cinema parts, one pand), a Zaanstad school outside the 3DBAG cache (BAG WFS).
  assert.equal(ids.w1488019247.pand, '0363100012079990');
  assert.equal(ids.w1362284226.pand, '0479100000000161');
  assert.equal(ids.w276686506.pand, null, 'Avontuur is a church ship: no pand');
});

// Round 4 (GitHub #41): an OSM-keyed kit reads the measurements of the pand kit-pands.json joins it to.
test('round 4: an OSM-keyed kit is measured on its joined pand; a pand id on itself', () => {
  const joins = { w1: { pand: '0363100012079990' }, w2: { pand: null } };
  assert.equal(measuredPandFor('w1', joins), 'NL.IMBAG.Pand.0363100012079990');
  assert.equal(measuredPandFor('w2', joins), null, 'joined to no pand');
  assert.equal(measuredPandFor('r9', joins), null, 'not in the join');
  assert.equal(measuredPandFor('NL.IMBAG.Pand.0363100012098124', joins), 'NL.IMBAG.Pand.0363100012098124', 'a pand id is its own');
  const ids = JSON.parse(fs.readFileSync(new URL('../../public/data/extracts/amsterdam/kit-pands.json', import.meta.url), 'utf8')).ids;
  const row = (id: string) => PUBLIC_FACTS.find(e => e[0] === id)!;
  // Bijlmerbios (ten cinema parts on pand 0363100012079990): wall, ribbon glazing and roof form now measured.
  assert.equal(measuredPandFor('w1488019247', ids), 'NL.IMBAG.Pand.0363100012079990');
  assert.ok(row('w1488019247')[5], 'measured wall colour'); assert.equal(row('w1488019247')[7], 2, 'ribbon windows'); assert.ok(row('w1488019247')[9], 'roof form');
  // A cinema the BAG tiles draw only as its OSM part takes the LoD2.2 roof form of the pand under it.
  assert.ok(row('r3699016')[9], 'r3699016 roof form from pand 0363100012237325');
});

test('round 4: an OSM part takes the roof form of its pand\'s planes over the part only; a tower takes no crop windows', () => {
  const plane = (x: number, y: number, slopeDeg: number) => ({ centroid: [x, y] as const, planM2: 10, slopeDeg, azimuthDeg: 0, zMin: 5, zMax: 9 });
  const nave = [plane(5, 5, 40), plane(15, 5, 40)], tower = plane(25, 5, 0);
  const part = rect(10, 10, 20, 0);
  assert.deepEqual(planesOverPart([...nave, tower], part), [tower], 'the tower part sees only the plane over it');
  assert.deepEqual(planesOverPart(nave, part), []);
  // Vredeskerk: the 49 m tower part (2% of its pand) keeps the pand's wall colour but not the nave's window rows.
  const vrede = PUBLIC_FACTS.find(e => e[0] === 'w995323510')!;
  assert.ok(vrede[5], 'wall colour from the pand'); assert.equal(vrede[7], 0, 'no window rows from the nave crops'); assert.equal(vrede[9], 0, 'no roof form: it rises over its planes');
});

test('round 4: a crop that is mostly leaves gives no wall colour (Generic church 0363100012098124 was very dark khaki)', () => {
  assert.ok(leafDominated(61, 100), `over ${MAX_LEAF_PIXEL_SHARE} leaves`);
  assert.equal(leafDominated(40, 100), false);
  assert.equal(leafDominated(0, 0), false);
  assert.equal(PUBLIC_FACTS.find(e => e[0] === 'NL.IMBAG.Pand.0363100012098124')![5], null, 'falls back to the period palette');
});

// Kit review round 4 (2026-10-24, GitHub #43): regressions from the measured windows and the LoD2.2 roof form.
test('round 4: a blank hall before a pale backdrop and blue sky reads no window rows; real glazing still does', () => {
  const W = 300, H = 200, ppm = 20, wall = [97, 77, 70];
  // A 9.5 m brick hall in the middle third over 5 m wings: blue sky above the left wing, a grey block behind the right.
  const img = (windows: boolean) => {
    const data = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const z = (H - y) / ppm, hall = x >= 100 && x < 200;
      let c = wall;
      if (z > 9.5 || (x < 100 && z > 5)) c = [110, 160, 225];
      else if (!hall && z > 5) c = [150, 150, 150];
      if (windows && z > 1.5 && z < 3.5 && x % 40 >= 8 && x % 40 < 32) c = [40, 48, 56];
      data.set(c, (y * W + x) * 3);
    }
    return glazingProfile({ data, width: W, height: H, channels: 3, ppm, topM: H / ppm, eavesM: 9.5, wall, norm: c => [c[0], c[1], c[2]] });
  };
  const blank = img(false), win = img(true);
  assert.deepEqual(blank.windowBands, [], `backdrop is not windows (rows 220, 279, 356, 421): ${JSON.stringify(blank.windowBands)}`);
  assert.deepEqual(blank.ribbons, []);
  assert.ok(win.windowBands!.some(([a, b]) => a <= 1.7 && b >= 3.3), JSON.stringify(win.windowBands));
  assert.ok(WINDOW_ROWS.glass > 0 && glassVisible([149, 134, 129]) && !glassVisible([89, 77, 70]));
});

test('round 4: storey rows only where light-walled crops saw windows; none on a blank wall; all without a reading', () => {
  assert.deepEqual(mergeSpans([[6.2, 7.3], [1, 5], [4.9, 5.2]]), [[1, 5.2], [6.2, 7.3]]);
  const rows = [{ z0: 0.8, z1: 2.5 }, { z0: 4.6, z1: 6.3 }, { z0: 8.3, z1: 10 }];
  assert.deepEqual(measuredRows(rows, facts({ windowSpans: [[1, 5], [6.2, 7.3]] })), [rows[0]], 'row 127: the glazed ground floor alone');
  assert.deepEqual(measuredRows(rows, facts({ windowSpans: [[8, 9.9]] })), [rows[2]], 'row 125: the clerestory alone');
  assert.deepEqual(measuredRows(rows, facts({ windowSpans: [] })), []);
  assert.deepEqual(measuredRows(rows, facts({})), rows);
  const parsed = schoolFacts(['x', 1986, 3, 76, 0, null, 1, 2, null, 1, 0, 0, null, null, '80-99,110-130', 17.4]);
  assert.deepEqual(parsed.windowSpans, [[8, 9.9], [11, 13]]);
  assert.equal(parsed.pitchSlopeDeg, 17.4);
  const school = PUBLIC_BUILDINGS.find(e => e[1] === 's' && e[2] === 'f' && e[3] > 9)!;
  const blank = publicKit(school, facts({ year: 1986, windowSpans: [] }));
  assert.ok(blank.body && blank.trim, 'a blank light wall: the plain body with its trim');
});

test('round 4: a low LoD2.2 roof keeps its measured pitch; steep roofs keep the kit hip', () => {
  const low = pitchedHip(facts({ pitch: 'pitched', pitchEavesM: 5.8, pitchRidgeM: 8.3, pitchSlopeDeg: 17.8 }), 8.2, 3)!;
  assert.equal(low.pitchDeg, 17.8, 'row 178');
  assert.equal(pitchedHip(facts({ pitch: 'pitched', pitchEavesM: 7.3, pitchRidgeM: 14.9, pitchSlopeDeg: 53.2 }), 12, 3)!.pitchDeg, undefined, 'row 13 keeps its look');
  assert.ok(LOW_PITCH_DEG < 28);
  const top = (t: { p: number[][] }[]) => Math.max(...t.flatMap(x => x.p.map(q => q[2])));
  const wing = rect(60, 10);
  assert.ok(top(hipAround(wing, 5.8, 2.5)!) - 5.8 > 2.4, 'the kit hip reaches its rise on a 10 m wing');
  const measured = hipAround(wing, 5.8, 2.5, 17.8)!, rise = top(measured) - 5.8;
  assert.ok(rise < 5 * Math.tan((17.8 * Math.PI) / 180) + 0.05 && rise > 1, `17.8 degrees over a 5 m half-width: ${rise.toFixed(2)} m`);
});

test('round 4: an early school planned hipped is flat where its LoD2.2 planes are flat or mixed', () => {
  const entry = PUBLIC_BUILDINGS.find(e => e[0] === 'NL.IMBAG.Pand.0363100012109215')!;
  assert.equal(entry[2], 'h');
  const kit = publicKit(entry, facts({ year: 1924, pitch: 'flat', pitchEavesM: 2.2, pitchRidgeM: 3.8 }));
  const hall = kit.halls![0];
  assert.ok(!hall.fit && !hall.hip && hall.riseM === 0 && hall.eavesM === 14.3, `row 161: ${JSON.stringify({ fit: hall.fit, eaves: hall.eavesM })}`);
  assert.ok(publicKit(entry, facts({ year: 1924, pitch: 'pitched', pitchEavesM: 10.8, pitchRidgeM: 15.8 })).halls![0].fit, 'pitched planes keep the fitted roof');
});

test('round 4: data defects behind a pillar and a windowless hall', () => {
  // Row 316: a 20 m2, 30 m cinema-tagged part is no film house.
  assert.equal(planPublic({ kind: 'c', heightM: 30, year: 1987, areaM2: 20, rect: null }), null);
  assert.ok(planPublic({ kind: 'c', heightM: 21, year: 1987, areaM2: 200, rect: null }));
  assert.ok(NOT_PUBLIC_FORM.w1488019256 && !KITS.some(k => k.name === 'Generic cinema w1488019256'));
  // Row 54: De Nieuwe Stad's 592 m2, 9 m hall over 3 m wings is no tower; a slender spire is.
  assert.equal(towerPart(9, 4, 0.46, 592), false);
  assert.equal(towerPart(40, 12, 0.05, 36), true);
  // Row 356: white panels read #fdfadf stay white, not wallFamily's brick lifted to yellow.
  const white = lch(hexToRgb(measuredWallDisplay('#fdfadf')));
  assert.ok(white.L > 90 && white.C < 10, JSON.stringify(white));
});

// GitHub #49: cladding and curtain-wall facades (kitFacades.ts, landmarkKits.ts KitCladding).
test('#49: cladding zones stop short of window rows and drop slivers', () => {
  assert.deepEqual(claddingZones(0, 10, []), [[0, 10]]);
  assert.deepEqual(claddingZones(0, 10, [[4, 6]]), [[0, 3.85], [6.15, 10]]);
  assert.deepEqual(claddingZones(0, 10, [[0.1, 9.8]]), [], 'a 0.05 m sliver is not drawn');
});

test('#49: every cladding kind draws a sheet and lines, clear of the plinth and the rows', () => {
  const hall = (cladding: KitCladding[], rows: KitWindowRow[] = []): Kit => ({ name: 'clad', tiers: [], stacks: [], roofs: [], wall: { plain: true, hex: '#888888' },
    halls: [{ id: 'h', widthM: 0, anchor: [0, 0], eavesM: 10, riseM: 0, mat: 'slate', windows: { rows, plinth: { z1: 0.6, hex: '#8c877d' }, cladding } }] });
  const parts = new Map<string, PartInput>([['h', { id: 'h', ring: rect(30, 18), minHeightM: 0, heightM: 10 }]]);
  const base = kitGeometry(hall([]), parts)[0].tris.length;
  for (const kind of Object.keys(CLADDING_PITCH) as KitCladdingKind[]) {
    const tris = kitGeometry(hall([{ kind, hex: '#a4a19a', z0: 0 }]), parts)[0].tris;
    const clad = tris.length - base;
    assert.ok(clad > 4 * 2 * 3, `${kind}: ${clad} cladding triangles (a sheet and lines on four walls)`);
    const sheet = tris.filter(t => t.hex === (kind === 'louvres' ? shadeHex('#a4a19a', 0.45) : kind === 'curtain' ? '#a4a19a' : '#a4a19a'));
    assert.ok(sheet.every(t => t.p.every(p => p[2] >= 0.6 - 1e-9 && p[2] <= 10 + 1e-9)), `${kind}: sheet between the plinth top and the eaves`);
  }
  // a ribbon row through a ribbed wall keeps its band: no rib crosses 6-8 m (0.15 m clear)
  const ribbed = kitGeometry(hall([{ kind: 'ribs', hex: '#a4a19a', z0: 0 }], [{ z0: 6, z1: 8, widthM: 1, bayM: 1.5, ribbon: true }]), parts)[0].tris;
  const ribs = ribbed.filter(t => t.hex === '#a4a19a' || t.hex === shadeHex('#a4a19a', 0.78));
  assert.ok(ribs.every(t => t.p.every(p => p[2] <= 5.85 + 1e-9 || p[2] >= 8.15 - 1e-9)), 'cladding clear of the ribbon');
});

test('#49: a kit without a facade entry is the same object; every entry is a listed kit drawn with cladding', () => {
  const plain = KITS.find(k => k.name.startsWith('Generic school') && !Object.keys(KIT_FACADES).some(id => k.name.endsWith(id)))!;
  assert.equal(applyKitFacade(plain, 'no-such-id', 10), plain);
  for (const id of Object.keys(KIT_FACADES)) {
    const kit = KITS.find(k => k.name.endsWith(` ${id}`));
    assert.ok(kit, `${id}: a generic kit`);
    const hall = kit!.halls?.find(h => h.id === id);
    assert.ok(hall?.windows?.cladding?.length, `${id}: cladding on its hall`);
    assert.equal(kit!.body, undefined, `${id}: no plain body left`);
    const parts = new Map<string, PartInput>([[id, { id, ring: rect(40, 25), minHeightM: 0, heightM: hall!.eavesM }]]);
    assert.ok(kitGeometry(kit!, parts)[0].tris.length > 100, `${id}: draws its cladding`);
  }
});
