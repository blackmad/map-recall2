import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  GARDEN_ROOM_TRI_BUDGET, LID_RAISE_M, ccwRing, gardenRoomDesign, gardenRoomRule, gardenRoomTriangles, glassEdge, mainHouse, overhangRing, partyWalls,
  type GardenRoomDesign, type Neighbour, type Pt,
} from './gardenRooms.ts';
import { GARDEN_ROOM_TONES, LOOK_VARIANTS, hexToRgb, type BuildingLook } from './look/palette.ts';
import { SegmentGrid } from './streetFronts.ts';
import { ORIGIN, buildFeatureChunk, type Feature } from './threeBuildingFeatures.ts';

const KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const rect = (x: number, y: number, w: number, d: number): Pt[] => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
const lngLat = (r: Pt[]) => [...r, r[0]].map(([a, b]) => [ORIGIN.lng + a / KX, ORIGIN.lat + b / KY]);
const feature = (id: string, r: Pt[], properties: Record<string, unknown> = {}): Feature => ({ type: 'Feature', properties: { id, height: 2.6, minHeight: 0, ...properties }, geometry: { type: 'Polygon', coordinates: [lngLat(r)] } }) as Feature;
const area = (r: Pt[]) => Math.abs(r.reduce((s, a, i) => { const b = r[(i + 1) % r.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);
const nb = (r: Pt[]): Neighbour => ({ ring: ccwRing(r), areaM2: area(r) });
/** A street east-west at y = 0. */
const STREET = Float32Array.from([-100, 0, 100, 0]);
const streets = new SegmentGrid(STREET, 25);

test('classifier: at least 6 m2, and built from 2005 or an older roof that reads as a new membrane or glass at confidence >= 0.6', () => {
  assert.equal(gardenRoomRule({ constructionYear: 2018 }, 3.2), null, 'a 3 m2 box is a bike shed, not a room');
  assert.equal(gardenRoomRule({ constructionYear: 2018 }, 6), 'year');
  assert.equal(gardenRoomRule({ constructionYear: 2005 }, 12), 'year');
  assert.equal(gardenRoomRule({ constructionYear: 2019, roofSlot: 'bitumen-dark', roofConfidence: 0.9 }, 12), 'year');
  assert.equal(gardenRoomRule({ constructionYear: 2004 }, 12), null);
  assert.equal(gardenRoomRule({ constructionYear: 1930, roofSlot: 'white-membrane', roofConfidence: 0.6 }, 12), 'roof');
  assert.equal(gardenRoomRule({ constructionYear: 1930, roofSlot: 'sedum', roofConfidence: 0.8 }, 12), null, 'sedum on an old shed is tree canopy in the orthophoto');
  assert.equal(gardenRoomRule({ constructionYear: 1930, roofSlot: 'glass', roofConfidence: 0.7 }, 12), 'roof');
  assert.equal(gardenRoomRule({ roofSlot: 'white-membrane', roofConfidence: 0.8 }, 12), 'roof', 'undated with a new roof');
  assert.equal(gardenRoomRule({ constructionYear: 1930, roofSlot: 'white-membrane', roofConfidence: 0.5 }, 12), null, 'below confidence');
  assert.equal(gardenRoomRule({ constructionYear: 1930, roofSlot: 'white-membrane' }, 12), null, 'no confidence stamped');
  assert.equal(gardenRoomRule({ constructionYear: 1930, roofSlot: 'bitumen-dark', roofConfidence: 0.9 }, 12), null, 'tarred roof: still a shed');
  assert.equal(gardenRoomRule({}, 12), null);
});

test('design: deterministic per id, 60/40 slat/black, colours inside the photo bands', () => {
  let slat = 0, black = 0, accent = 0;
  const lum = (hex: string) => { const [r, g, b] = hexToRgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (let i = 0; i < 4000; i++) {
    const d = gardenRoomDesign(`NL.IMBAG.Pand.${i}`, 2010 + (i % 15));
    assert.deepEqual(d, gardenRoomDesign(`NL.IMBAG.Pand.${i}`, 2010 + (i % 15)));
    if (d.family === 'slat') {
      slat++;
      const [r, g, b] = hexToRgb(d.wallHex);
      assert.ok(r >= g && g >= b, `slat ${d.wallHex} is warm`);
      assert.ok(lum(d.wallHex) >= lum(GARDEN_ROOM_TONES.slatWeathered) - 6 && lum(d.wallHex) <= lum(GARDEN_ROOM_TONES.slatFresh[1]) + 1, `slat ${d.wallHex} luma in band`);
    } else {
      black++;
      assert.ok(lum(d.wallHex) >= lum(GARDEN_ROOM_TONES.black[0]) - 1 && lum(d.wallHex) <= lum(GARDEN_ROOM_TONES.black[1]) + 1, `black ${d.wallHex} in band`);
      if (d.accent) accent++;
    }
  }
  assert.ok(Math.abs(slat / 4000 - 0.6) < 0.03, `slat share ${slat / 4000}`);
  assert.ok(accent / black > 0.4 && accent / black < 0.6, `accent share ${accent / black}`);
  const fresh = gardenRoomDesign('NL.IMBAG.Pand.1', 2025), old = gardenRoomDesign('NL.IMBAG.Pand.1', 2006);
  if (fresh.family === 'slat') assert.ok(lum(fresh.wallHex) !== lum(old.wallHex), 'weathering follows age');
});

test('orientation: glass faces the main house on the street side, never a party wall', () => {
  // House 8 x 10 m on the street (y 0..10 m back from it... the house is y 2..12), garden behind, shed at the
  // back against the rear neighbour's shed (party wall on the north edge).
  const shed = ccwRing(rect(1, 24, 4, 3));
  const house = nb(rect(0, 2, 8, 10)), rearShed = nb(rect(1, 27, 4, 3)), sideHouse = nb(rect(9, 2, 8, 10));
  const party = partyWalls(shed, [house, rearShed, sideHouse]);
  // Edges: 0 south (y=24), 1 east, 2 north (y=27, shared with rear shed), 3 west.
  assert.deepEqual(party, [false, false, true, false]);
  const main = mainHouse(shed, area(shed), [house, rearShed, sideHouse], streets);
  assert.equal(main, house, 'the nearest larger pand nearer the street');
  assert.equal(glassEdge(shed, party, main), 0, 'glass on the south wall, toward the house');
  // The south wall touches a neighbour: glass must move off it.
  const blocked = partyWalls(shed, [house, rearShed, nb(rect(1, 21.8, 4, 2))]);
  assert.equal(blocked[0], true);
  assert.notEqual(glassEdge(shed, blocked, main), 0);
  assert.equal(glassEdge(shed, [true, true, true, true], main), -1, 'enclosed on all sides: no glass');
});

test('orientation: no house found -> the longest free edge', () => {
  const shed = ccwRing(rect(0, 30, 5, 2.5));
  const party = partyWalls(shed, []);
  assert.equal(mainHouse(shed, area(shed), [], streets), null);
  const i = glassEdge(shed, party, null), a = shed[i], b = shed[(i + 1) % 4];
  assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - 5) < 1e-9, 'a 5 m edge');
  // A bigger pand farther from the street than the shed is not its house.
  assert.equal(mainHouse(ccwRing(rect(0, 10, 3, 3)), 9, [nb(rect(0, 16, 10, 10))], streets), null);
});

test('overhang: 0.25 m past free walls, flush (0.02 m) past party walls', () => {
  const r = ccwRing(rect(0, 0, 4, 3)), lid = overhangRing(r, [false, false, true, false]);
  const xs = lid.map(p => p[0]), ys = lid.map(p => p[1]);
  assert.ok(Math.abs(Math.min(...xs) + 0.25) < 1e-9 && Math.abs(Math.max(...xs) - 4.25) < 1e-9);
  assert.ok(Math.abs(Math.min(...ys) + 0.25) < 1e-9 && Math.abs(Math.max(...ys) - 3.02) < 1e-9);
});

test('mesh budget: at most 60 triangles beyond the plain box, for every family and shape', () => {
  const designs: GardenRoomDesign[] = [
    { family: 'slat', horizontal: false, wallHex: '#c0995f', jointHex: '#775f3b', accent: null },
    { family: 'slat', horizontal: true, wallHex: '#c0995f', jointHex: '#775f3b', accent: null },
    { family: 'black', horizontal: false, wallHex: '#303030', jointHex: '#4a4844', accent: { wallHex: '#c0995f', jointHex: '#775f3b' } },
    { family: 'black', horizontal: false, wallHex: '#303030', jointHex: '#4a4844', accent: null },
  ];
  const shapes: Pt[][] = [rect(0, 0, 4, 3), rect(0, 0, 1.6, 1.6), rect(0, 0, 9, 4), [[0, 0], [6, 0], [6, 2], [3, 2], [3, 4], [0, 4]], Array.from({ length: 14 }, (_, k) => [3 * Math.cos(k / 14 * 2 * Math.PI), 3 * Math.sin(k / 14 * 2 * Math.PI)] as Pt)];
  for (const d of designs) for (const s of shapes) {
    const ring = ccwRing(s), party = ring.map((_, i) => i === 2);
    const tris = gardenRoomTriangles({ ring, heightM: 2.6, glass: glassEdge(ring, party, null), party, design: d, lidHex: '#3c3e40', frameHex: '#2b2d2f', fasciaHex: '#26282a', glassHex: '#35464f' });
    assert.ok(tris.length <= GARDEN_ROOM_TRI_BUDGET, `${d.family} ${s.length}-gon: ${tris.length} tris`);
    assert.ok(tris.length >= 10, `${d.family} ${s.length}-gon draws something (${tris.length})`);
    for (const t of tris) for (const p of t.p) assert.ok(p.every(Number.isFinite) && p[2] >= 0 && p[2] <= 2.6 + LID_RAISE_M + 1e-9);
    if (s.length === 4 && s === shapes[0]) {
      assert.ok(tris.some(t => t.hex === '#35464f'), 'glass drawn');
      assert.ok(tris.filter(t => t.hex === d.jointHex).length >= 10, 'joints drawn');
    }
  }
});

const hashChunk = (c: ReturnType<typeof buildFeatureChunk>) => createHash('sha256').update(c.positions).update(c.uvs).update(c.layers).update(c.tints).update(c.accents).update(c.indices).update(JSON.stringify(c.ranges)).digest('hex').slice(0, 16);

/** A canal-house plot: two houses on the street, gardens behind, sheds of every kind. */
const plot = (shed: Record<string, unknown>) => [
  feature('NL.IMBAG.Pand.0363100012000001', rect(0, 2, 8, 10), { height: 12, constructionYear: 1880 }),
  feature('NL.IMBAG.Pand.0363100012000002', rect(8, 2, 8, 10), { height: 12, constructionYear: 1880 }),
  feature('NL.IMBAG.Pand.0363100012000003', rect(1, 24, 4, 3), shed),
  feature('NL.IMBAG.Pand.0363100012000004', rect(9, 26, 3, 2.5), { height: 2.3, constructionYear: 1975 }),
];

test('byte-identical for every pand that is not a garden room (hashes pinned from the pre-kit code, 90ecb29bf)', () => {
  // Sheds that stay sheds: an old year, a tarred roof, a membrane roof below confidence. The `roofConfidence`
  // stamp alone changes nothing.
  const pinned: Record<string, string> = PRE_KIT_HASHES;
  const cases: Record<string, Record<string, unknown>> = {
    old: { height: 2.4, constructionYear: 1962 },
    tarred: { height: 2.4, constructionYear: 1930, roofSlot: 'bitumen-dark', roofMeasured: '#55575c', roofConfidence: 0.9 },
    weak: { height: 2.4, constructionYear: 1930, roofSlot: 'white-membrane', roofMeasured: '#dcdcd6', roofConfidence: 0.5 },
  };
  for (const look of Object.keys(LOOK_VARIANTS) as BuildingLook[]) for (const [name, shed] of Object.entries(cases)) for (const mode of ['walls', 'extras', 'coarse', 'shell'] as const) {
    const key = `${look}:${name}:${mode}`;
    assert.equal(hashChunk(buildFeatureChunk(plot(shed), look, mode, STREET)), pinned[key], key);
  }
});

test('a garden room in the chunk: its own range carries the kit, the neighbours keep their bytes, nothing beyond the near tier', () => {
  const room = { height: 2.7, constructionYear: 2016 };
  for (const look of Object.keys(LOOK_VARIANTS) as BuildingLook[]) {
    const withRoom = buildFeatureChunk(plot(room), look, 'walls', STREET), asShed = buildFeatureChunk(plot({ height: 2.7, constructionYear: 1962 }), look, 'walls', STREET);
    const id = 'NL.IMBAG.Pand.0363100012000003';
    const kit = withRoom.kinds?.['garden-room'] ?? 0;
    assert.ok(kit > 0 && kit <= GARDEN_ROOM_TRI_BUDGET, `${look}: ${kit} garden-room tris`);
    // Every other pand's vertices are identical (same order before the room; shifted after it).
    for (const r of asShed.ranges.filter(r => r.id !== id)) {
      const s = withRoom.ranges.find(x => x.id === r.id)!;
      assert.equal(s.count, r.count, `${look} ${r.id} vertex count`);
      assert.deepEqual(withRoom.positions.slice(s.start * 3, (s.start + s.count) * 3), asShed.positions.slice(r.start * 3, (r.start + r.count) * 3));
      assert.deepEqual(withRoom.tints.slice(s.start * 4, (s.start + s.count) * 4), asShed.tints.slice(r.start * 4, (r.start + r.count) * 4));
    }
    // Every vertex of the room is on the flat layer (one layer index valid in every look).
    const r = withRoom.ranges.find(x => x.id === id)!;
    const layers = new Set(withRoom.layers.slice(r.start, r.start + r.count));
    assert.equal(layers.size, 1, `${look}: one flat layer, got ${[...layers]}`);
    assert.equal(buildFeatureChunk(plot(room), look, 'coarse', STREET).ranges.some(x => x.id === id), false, 'not drawn beyond the near tier');
    assert.equal(buildFeatureChunk(plot(room), look, 'shell', STREET).kinds?.['garden-room'] ?? 0, 0, 'no kit in the shell LOD');
    assert.equal(buildFeatureChunk(plot(room), look, 'extras', STREET).ranges.some(x => x.id === id), false, 'no extras');
  }
});

// Pinned by running this file's `plot` cases through buildFeatureChunk at 90ecb29bf (before the kit).
const PRE_KIT_HASHES: Record<string, string> = {
  'photo:old:walls': '5b2bbbc51b5818e5',
  'photo:old:extras': '4f53cda18c2baa0c',
  'photo:old:coarse': 'ad52dfcfc4b5dc53',
  'photo:old:shell': '5db49f684033c985',
  'photo:tarred:walls': '6e2776f2263b3117',
  'photo:tarred:extras': '4f53cda18c2baa0c',
  'photo:tarred:coarse': 'ad52dfcfc4b5dc53',
  'photo:tarred:shell': '3dda1ad2cbee64ac',
  'photo:weak:walls': '6e2776f2263b3117',
  'photo:weak:extras': '4f53cda18c2baa0c',
  'photo:weak:coarse': 'ad52dfcfc4b5dc53',
  'photo:weak:shell': '3dda1ad2cbee64ac',
  'procedural:old:walls': 'edbe4578b0e219f5',
  'procedural:old:extras': '4f53cda18c2baa0c',
  'procedural:old:coarse': '82e6315dc6bd42fd',
  'procedural:old:shell': '124aff92d7bdc653',
  'procedural:tarred:walls': 'edbe4578b0e219f5',
  'procedural:tarred:extras': '4f53cda18c2baa0c',
  'procedural:tarred:coarse': '82e6315dc6bd42fd',
  'procedural:tarred:shell': '124aff92d7bdc653',
  'procedural:weak:walls': 'edbe4578b0e219f5',
  'procedural:weak:extras': '4f53cda18c2baa0c',
  'procedural:weak:coarse': '82e6315dc6bd42fd',
  'procedural:weak:shell': '124aff92d7bdc653',
  'untextured:old:walls': '6716e7f87a7846ea',
  'untextured:old:extras': '4f53cda18c2baa0c',
  'untextured:old:coarse': '9a0521d732a7529c',
  'untextured:old:shell': '7e1a7c36da7f84ee',
  'untextured:tarred:walls': '6716e7f87a7846ea',
  'untextured:tarred:extras': '4f53cda18c2baa0c',
  'untextured:tarred:coarse': '9a0521d732a7529c',
  'untextured:tarred:shell': '7e1a7c36da7f84ee',
  'untextured:weak:walls': '6716e7f87a7846ea',
  'untextured:weak:extras': '4f53cda18c2baa0c',
  'untextured:weak:coarse': '9a0521d732a7529c',
  'untextured:weak:shell': '7e1a7c36da7f84ee',
  'storybook:old:walls': '46c2bde5ba92fc8a',
  'storybook:old:extras': '4f53cda18c2baa0c',
  'storybook:old:coarse': 'b8612601dbff0900',
  'storybook:old:shell': '66323731d68daa7b',
  'storybook:tarred:walls': '8f18490f469a9bdf',
  'storybook:tarred:extras': '4f53cda18c2baa0c',
  'storybook:tarred:coarse': 'b8612601dbff0900',
  'storybook:tarred:shell': '5c690ada354315cd',
  'storybook:weak:walls': '8f18490f469a9bdf',
  'storybook:weak:extras': '4f53cda18c2baa0c',
  'storybook:weak:coarse': 'b8612601dbff0900',
  'storybook:weak:shell': '5c690ada354315cd',
  'cartoon:old:walls': '46c2bde5ba92fc8a',
  'cartoon:old:extras': '4f53cda18c2baa0c',
  'cartoon:old:coarse': 'b8612601dbff0900',
  'cartoon:old:shell': '66323731d68daa7b',
  'cartoon:tarred:walls': '8f18490f469a9bdf',
  'cartoon:tarred:extras': '4f53cda18c2baa0c',
  'cartoon:tarred:coarse': 'b8612601dbff0900',
  'cartoon:tarred:shell': '5c690ada354315cd',
  'cartoon:weak:walls': '8f18490f469a9bdf',
  'cartoon:weak:extras': '4f53cda18c2baa0c',
  'cartoon:weak:coarse': 'b8612601dbff0900',
  'cartoon:weak:shell': '5c690ada354315cd',
};
