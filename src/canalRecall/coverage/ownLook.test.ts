import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { ContentItems } from './contents.js';
import { LOOK_LEGEND, chunkRide, lookBin, noLook, ownLookOf, pandRide, rideHref, type OwnLook } from './ownLook.js';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PAGE = path.join(ROOT, 'public/canal-drive');
/** `COVERAGE_EXTRACT=artifacts/coverage/out` checks a staged build before it is published. */
const EXTRACT = path.resolve(ROOT, process.env.COVERAGE_EXTRACT ?? 'public/data/extracts/amsterdam/coverage-v1');

test('ownLookOf: drawn pands are chunk + building-type pands; districts ordered by pands; authored-only says so', () => {
  const look = ownLookOf({
    pands: 200, chunk: 30, buildingType: 10,
    types: new Map([['kinker-1890-plain-brick', 12], ['nassau-a-banded', 4], ['bellamy-1904-balcony-axis', 14]]),
    designs: new Map([['nw-portiek-brick-pitched', 10]]), faces: new Map([['wallen-oza-41-57', 0]]),
    typeDistrict: id => ({ 'kinker-1890-plain-brick': 'oud-west', 'bellamy-1904-balcony-axis': 'bellamy' } as Record<string, string>)[id],
    authored: true,
  });
  assert.equal(look.status, 'drawn');
  assert.equal(look.pands, 40);
  assert.equal(look.share, 0.2);
  assert.deepEqual(look.types.map(([id]) => id), ['bellamy-1904-balcony-axis', 'kinker-1890-plain-brick', 'nassau-a-banded']);
  assert.deepEqual(look.faces, [], 'a face drawing nothing is dropped');
  // A type outside the libraries (a face's own type) counts as a measured face.
  assert.deepEqual(look.districts, ['Bellamybuurt house types', 'Oud-West house types', 'Nieuw-West building types', 'measured street faces']);
  const authored = ownLookOf({ pands: 50, chunk: 0, buildingType: 0, types: new Map(), designs: new Map(), faces: new Map(), typeDistrict: () => undefined, authored: true });
  assert.equal(authored.status, 'authored');
  assert.equal(lookBin(authored), 1);
  assert.equal(lookBin(noLook()), 0);
});

test('lookBin: drawn shares fall in the legend bands', () => {
  const at = (share: number) => lookBin({ status: 'drawn', share });
  assert.deepEqual([0.001, 0.02, 0.049, 0.05, 0.15, 0.3, 0.9].map(at), [2, 3, 3, 4, 5, 6, 6]);
  assert.equal(LOOK_LEGEND.length, 7);
});

test('rides: a chunk ride matches street-chunks.html gameLink; a pand ride runs along the footprint and passes it', () => {
  // street-chunks.html gameLink for chunk-face-evertsen-59-89 (anchor, northOffset 164.3611, x −46.983…53.238).
  const r = chunkRide([4.8546144605886745, 52.370644261432155], 164.3611, -46.983, 53.238);
  const [lat, lng] = [52.370644261432155, 4.8546144605886745];
  const b = (90 + 164.3611) * Math.PI / 180, half = (53.238 + 46.983) / 2 + 45;
  const east = Math.sin(b) * -half + Math.cos(b) * 8, north = Math.cos(b) * -half - Math.sin(b) * 8;
  assert.ok(Math.abs(r[2] - (lat + north / 111320)) < 2e-6 && Math.abs(r[3] - (lng + east / (111320 * Math.cos(lat * Math.PI / 180)))) < 2e-6);
  assert.match(rideHref(r), /^\.\/index\.html\?travel=car#race=52\.370644,4\.854614,(-?\d+\.\d{6},){3}-?\d+\.\d{6}$/);
  // A 60 × 10 m slab running east–west: start and finish lie west and east of it, 140 m apart.
  const k = 111320 * Math.cos(52.36 * Math.PI / 180);
  const ring: [number, number][] = [[4.8, 52.36], [4.8 + 60 / k, 52.36], [4.8 + 60 / k, 52.36 + 10 / 111320], [4.8, 52.36 + 10 / 111320], [4.8, 52.36]];
  const p = pandRide([4.8 + 30 / k, 52.36 + 5 / 111320], ring);
  assert.ok(p[3] < p[1] && p[5] > p[1], 'start west, finish east');
  assert.ok(Math.abs((p[5] - p[3]) * k - 140) < 0.5);
});

// ---- the extract ------------------------------------------------------------------------------------------
type Props = { code: string; name: string; pands: number; tiers: Record<string, number>; look?: OwnLook };
const hasLook = fs.existsSync(path.join(EXTRACT, 'contents.json')) && !!(JSON.parse(fs.readFileSync(path.join(EXTRACT, 'contents.json'), 'utf8')).items as ContentItems).look;
const load = () => ({
  feats: (JSON.parse(fs.readFileSync(path.join(EXTRACT, 'buurten.json'), 'utf8')).features as { properties: Props }[]).map(f => f.properties),
  items: (JSON.parse(fs.readFileSync(path.join(EXTRACT, 'contents.json'), 'utf8')).items as ContentItems),
});

test('extract own look: counts agree with the tiers; every thumbnail ships with the extract; rides and links resolve', { skip: !hasLook && 'extract predates the own-look tier' }, () => {
  const { feats, items } = load();
  for (const p of feats) {
    const l = p.look!;
    assert.ok(l, `${p.code} has a look`);
    assert.equal(l.pands, p.tiers.chunk + p.tiers.buildingType, `${p.code} own pands = chunk + buildingType`);
    const listed = [...l.types, ...l.designs, ...l.faces].reduce((a, [, n]) => a + n, 0);
    assert.equal(listed, l.pands, `${p.code}: every own pand is attributed to a type, design family or face`);
    for (const [key] of [...l.types.map(([id]) => [`type:${id}`]), ...l.designs.map(([f]) => [`design:${f}`]), ...l.faces.map(([f]) => [`face:${f}`])]) {
      assert.ok(l.rides[key], `${p.code} ride for ${key}`);
      assert.ok(l.rides[key].every(Number.isFinite));
    }
  }
  const look = items.look!;
  const thumbs = [...Object.values(look.types).flatMap(t => [t.render, t.photo]), ...Object.values(look.designs).map(d => d.render), ...Object.values(look.families).map(f => f.photo)].filter(Boolean);
  assert.ok(thumbs.length > 60);
  let bytes = 0;
  for (const t of thumbs) {
    const file = path.join(EXTRACT, 'look', path.basename(t!.src));
    assert.ok(t!.src.startsWith('../data/extracts/amsterdam/coverage-v1/look/') && fs.existsSync(file), `thumbnail ${t!.src}`);
    bytes += fs.statSync(file).size;
    if (/photo/i.test(t!.label)) assert.match(t!.credit ?? '', /CC BY 4\.0/, `${t!.src} names its licence`);
  }
  assert.ok(bytes / thumbs.length < 40_000, `thumbnails average ${Math.round(bytes / thumbs.length)} bytes`);
  for (const t of Object.values(look.types)) for (const l of t.links) assert.ok(fs.existsSync(path.join(PAGE, l.href.split(/[?#]/)[0])), l.href);
});

test('extract own look regressions: Nieuw-West and Bellamy buurten have their own look, Cornelis Schuytbuurt (KD02) does not', { skip: !hasLook && 'extract predates the own-look tier' }, () => {
  const { feats, items } = load();
  const by = (code: string) => feats.find(f => f.code === code)!;
  const osdorp = by('FK05').look!;
  assert.equal(osdorp.status, 'drawn');
  assert.ok(osdorp.designs.length >= 2 && osdorp.share > 0.3, 'Osdorp-Zuidoost is mostly building types');
  assert.ok(osdorp.designs.every(([f]) => Object.keys(items.look!.designs).some(k => k.startsWith(`${f}__`))), 'every family has a render');
  const bellamy = feats.filter(f => f.look?.types.some(([id]) => id.startsWith('bellamy-')));
  assert.ok(bellamy.length >= 1, 'a buurt drawn by Bellamy house types');
  const kd02 = by('KD02');
  assert.equal(kd02.name, 'Cornelis Schuytbuurt');
  assert.equal(kd02.look!.status, 'none');
});
