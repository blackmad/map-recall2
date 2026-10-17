import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  asksForLook, findLook, groupKitKeys, inGeometry, kitKeyLabel, lookReportOptions, looksIn, nearestLook, paletteSwatch, slugify, typeRun,
  type ExplorerLooks, type LookBuurt,
} from './looks';

const buurt = (o: Partial<LookBuurt>): LookBuurt => ({
  slug: 'x', code: 'XX01', name: 'X', lngLat: [4.9, 52.37], bbox: [4.89, 52.36, 4.91, 52.38], outline: [], status: 'drawn',
  pands: 100, lookPands: 10, share: 0.1, districts: [], uses: [], models: [], ...o,
});
const looks: Pick<ExplorerLooks, 'buurten' | 'none'> = {
  buurten: [
    buurt({ slug: 'rijnbuurt-oost', code: 'KM04', name: 'Rijnbuurt-Oost', explorerBuurt: 'Rijnbuurt', lngLat: [4.911, 52.3415], lookPands: 103 }),
    buurt({ slug: 'zaagpoortbuurt', code: 'AB04', name: 'Zaagpoortbuurt', explorerBuurt: 'Jordaan', lngLat: [4.884, 52.387], lookPands: 17 }),
    buurt({ slug: 'lootsbuurt', code: 'ES01', name: 'Lootsbuurt', explorerBuurt: 'Van Lennepbuurt', lngLat: [4.870, 52.364], status: 'authored', lookPands: 0 }),
    buurt({ slug: 'bellamybuurt-zuid', code: 'EP02', name: 'Bellamybuurt-Zuid', explorerBuurt: 'Kinkerbuurt', lngLat: [4.868, 52.367], lookPands: 69 }),
  ],
  none: [['cornelis-schuytbuurt', 'Cornelis Schuytbuurt', 'KD02']],
};

test('slugs are lowercase, accent-free and hyphenated', () => {
  assert.equal(slugify('Rijnbuurt-Oost'), 'rijnbuurt-oost');
  assert.equal(slugify('Balboaplein e.o.'), 'balboaplein-e-o');
  assert.equal(slugify('Chassébuurt'), 'chassebuurt');
});

test('a ?buurt= value finds a look by slug, code or name, and a buurt without one', () => {
  for (const v of ['rijnbuurt-oost', 'KM04', 'km04', 'Rijnbuurt-Oost']) assert.equal((findLook(looks, v) as { look: LookBuurt }).look.code, 'KM04', v);
  assert.deepEqual(findLook(looks, 'Cornelis Schuytbuurt'), { none: { slug: 'cornelis-schuytbuurt', name: 'Cornelis Schuytbuurt', code: 'KD02' } });
  assert.equal(findLook(looks, 'Atlantis'), undefined);
  assert.equal(findLook(looks, ''), undefined);
});

test('the neighbourhood filter keeps its names; slugs and codes ask for a look', () => {
  const names = ['Jordaan', 'Rijnbuurt', 'Zaagpoortbuurt'];
  assert.equal(asksForLook('Jordaan', names, looks), false);
  assert.equal(asksForLook('rijnbuurt-oost', names, looks), true);
  assert.equal(asksForLook('KM04', names, looks), true);
  // A display name that is also an explorer neighbourhood stays the filter; its slug opens the look.
  assert.equal(asksForLook('Zaagpoortbuurt', names, looks), false);
  assert.equal(asksForLook('zaagpoortbuurt', names, looks), true);
  assert.equal(asksForLook('Rijnbuurt-Oost', names, looks), true);
  assert.equal(asksForLook('cornelis-schuytbuurt', names, looks), true);
});

test('looks in a neighbourhood: drawn first, by own-look pands; the nearest drawn one to compare', () => {
  assert.deepEqual(looksIn(looks.buurten, 'Rijnbuurt').map(b => b.slug), ['rijnbuurt-oost']);
  assert.deepEqual(looksIn(looks.buurten, 'Nowhere'), []);
  assert.deepEqual(looksIn(looks.buurten, undefined).map(b => b.slug), ['rijnbuurt-oost', 'bellamybuurt-zuid', 'zaagpoortbuurt', 'lootsbuurt']);
  assert.equal(nearestLook(looks.buurten, looks.buurten[2])!.slug, 'bellamybuurt-zuid');
  assert.equal(nearestLook([looks.buurten[0]], looks.buurten[0]), undefined);
});

test('kit keys read as words and split into kinds and components', () => {
  assert.equal(kitKeyLabel('windows:casement-toplight'), 'Windows: casement toplight');
  assert.equal(kitKeyLabel('eavesOverhang'), 'Eaves overhang');
  assert.deepEqual(groupKitKeys(['gable:flat', 'eavesOverhang', 'roof:bitumen', 'windows:t-window', 'lisenes']),
    { kinds: ['gable:flat', 'roof:bitumen', 'windows:t-window'], components: ['eavesOverhang', 'lisenes'] });
});

test('a look report is a building report on the buurt centre (no new subject kind)', () => {
  assert.deepEqual(lookReportOptions(looks.buurten[0]), {
    category: 'building', subject: { kind: 'point', id: 'buurt:KM04', lngLat: [4.911, 52.3415] }, label: 'Look of Rijnbuurt-Oost (KM04)', id: 'explore:look:KM04',
  });
  const rules = readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /subject\.kind == 'point'/);
  assert.match(rules, /category == 'building'/);
});

test('a type run frames neighbouring houses of the type, up to the frontage cap', () => {
  const house = (id: string, x0: number, x1: number, h = 12) => ({ pandId: id, frontage: { x0, x1 }, bounds: { min: [x0, 0, -10], max: [x1, h, 0.5] } });
  const pands = [house('a', 0, 6), house('b', 6, 12, 13), house('c', 12, 18), house('d', 18, 24), house('e', 24, 30)];
  const isType = (p: string) => ['b', 'c', 'd', 'e'].includes(p);
  assert.deepEqual(typeRun(pands, isType, 15), { focus: { min: [6, 0, -10], max: [18, 13, 0.5] }, houses: 2 });
  assert.deepEqual(typeRun(pands, isType, 30, 'd')?.houses, 2);
  assert.equal(typeRun(pands, () => false), null);
});

test('design palettes flatten slot tints and named colours into hex swatches', () => {
  assert.deepEqual(paletteSwatch('grey', { wall: { slot: 'stucco', tint: '#7C7A6D' }, frame: '#b4b8b2', door: 'dark-green', glass: 'not-a-colour' }, { 'dark-green': '#26392f' }),
    { name: 'grey', colors: [['wall', '#7c7a6d'], ['frame', '#b4b8b2'], ['door', '#26392f']] });
  assert.equal(paletteSwatch('empty', {}), null);
});

test('point in a GeoJSON polygon with a hole', () => {
  const g = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
  assert.equal(inGeometry([2, 2], g), true);
  assert.equal(inGeometry([5, 5], g), false);
  assert.equal(inGeometry([12, 2], g), false);
});

const PUBLISHED = 'public/data/extracts/amsterdam/explorer-looks.json';
test('the published looks: every slug unique, every GLB on disk, focus boxes sane', { skip: !existsSync(PUBLISHED) }, () => {
  const data = JSON.parse(readFileSync(PUBLISHED, 'utf8')) as ExplorerLooks;
  const slugs = [...data.buurten.map(b => b.slug), ...data.none.map(n => n[0])];
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(data.buurten.length >= 40, `${data.buurten.length} looks`);
  for (const b of data.buurten) {
    if (b.status === 'drawn') assert.ok(b.uses.some(u => u.pands > 0), b.slug);
    for (const u of b.uses) {
      assert.ok(data.recipes[u.key], `${b.slug}: ${u.key}`);
      const glb = u.glbUrl ?? data.recipes[u.key].glbUrl;
      if (glb) assert.ok(existsSync(`public/canal-drive/${glb}`), glb);
      if (u.focus) for (let k = 0; k < 3; k++) assert.ok(u.focus.max[k] >= u.focus.min[k], `${b.slug} ${u.key}`);
    }
  }
});
