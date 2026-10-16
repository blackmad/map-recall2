import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { CONTENT_KINDS, emptyContent, hasContent, parseClusterKey, tallyByBuurt, type BuurtContent } from './coverage.js';
import { eraOf, paletteSwatches, parseDesignUnit, shortLabel, typeKitKeys, type ContentItems } from './contents.js';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PAGE = path.join(ROOT, 'public/canal-drive');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam/coverage-v1');

test('tallyByBuurt: an item lands in every buurt holding one of its units, counted per buurt; unplaced units drop', () => {
  const where: Record<string, string> = { a: 'W01', b: 'W01', c: 'E01', d: 'E01' };
  const out = tallyByBuurt([
    { id: 'face-1', units: ['a', 'b', 'c', 'b'] }, // duplicate unit counts once
    { id: 'face-2', units: ['d'] },
    { id: 'type-x', units: ['nowhere'] },
  ], u => where[u]);
  assert.deepEqual(out.get('W01'), [['face-1', 2]]);
  assert.deepEqual(out.get('E01'), [['face-1', 1], ['face-2', 1]]);
  assert.equal(out.size, 2);
});

test('content helpers: empty content says so; cluster keys parse to the next generator candidate', () => {
  assert.equal(hasContent(emptyContent()), false);
  assert.equal(hasContent({ ...emptyContent(), kits: [['Westerkerk', 1]] }), true);
  assert.deepEqual(parseClusterKey('6m×15m×1900'), { widthM: 6, heightM: 15, year: 1900 });
  assert.equal(parseClusterKey('garbage'), null);
});

test('type libraries: kit keys name components, not measurements; palettes keep only colours', () => {
  const keys = typeKitKeys({
    body: { storeys: 4, bays: 3, cornice: 'none', windows: 'casement-toplight', bayWidths: [1, 2], balconies: { storeys: [1], style: 'slab-hood' }, lisenes: { count: 2 } },
    crowns: { parapet: { gable: 'flat', cornice: 'none' }, end: { gable: 'flat', tower: { rise: 1 } } },
    roof: { material: 'bitumen' },
  });
  assert.deepEqual(keys, ['balconies:slab-hood', 'gable:flat', 'lisenes', 'roof:bitumen', 'tower', 'windows:casement-toplight']);
  assert.deepEqual(paletteSwatches({ brown: { brick: '#54402A', door: 'black', note: 'not a colour' }, empty: { note: 'x' } }), [{ name: 'brown', colors: [['brick', '#54402a'], ['door', 'black']] }]);
  assert.deepEqual(eraOf([1890, undefined, 1885, 0]), [1885, 1890]);
  assert.deepEqual(parseDesignUnit('nw-portiek__brick-cream__5__gable__long__solid'), { family: 'nw-portiek', variant: 'brick-cream', storeys: 5, roof: 'gable' });
  assert.equal(shortLabel('Nieuw-West type 1: brick portiekflat, pitched roof (14.4 x 10.5 m)'), 'brick portiekflat, pitched roof');
});

// ---- the published extract -------------------------------------------------------------------
type Feature = { properties: { code: string; name: string; stadsdeel?: string; content: BuurtContent } };
const published = fs.existsSync(path.join(EXTRACT, 'contents.json'));
const load = () => ({
  feats: (JSON.parse(fs.readFileSync(path.join(EXTRACT, 'buurten.json'), 'utf8')).features as Feature[]),
  items: (JSON.parse(fs.readFileSync(path.join(EXTRACT, 'contents.json'), 'utf8')).items as ContentItems),
});

test('published per-buurt lists: every id resolves in the catalogue', { skip: !published }, () => {
  const { feats, items } = load();
  for (const f of feats) for (const kind of CONTENT_KINDS) for (const [id, n] of f.properties.content[kind]) {
    assert.ok(items[kind][id], `${f.properties.code} ${kind} ${id} missing from contents.json`);
    assert.ok(n > 0);
  }
});

test('published catalogue: every thumbnail ships under public/ and every link names an existing page', { skip: !published }, () => {
  const { items } = load();
  const thumbs: string[] = [], links: string[] = [];
  for (const t of Object.values(items.types)) for (const e of t.exemplars) if (e.thumb) thumbs.push(e.thumb.src);
  for (const f of Object.values(items.faces)) { thumbs.push(...f.thumbs.map(t => t.src)); links.push(...f.links.map(l => l.href)); }
  for (const kind of ['designs', 'models', 'kits', 'surveys'] as const) for (const it of Object.values(items[kind]) as { links: { href: string }[]; thumb?: { src: string } }[]) {
    links.push(...it.links.map(l => l.href));
    if (it.thumb) thumbs.push(it.thumb.src);
  }
  assert.ok(thumbs.length > 10 && links.length > 100);
  for (const src of thumbs) assert.ok(fs.existsSync(path.resolve(PAGE, src.split('?')[0])), `thumbnail ${src}`);
  for (const href of links) {
    if (href.startsWith('https://github.com/blackmad/map-recall2/blob/main/')) { assert.ok(fs.existsSync(path.join(ROOT, href.slice('https://github.com/blackmad/map-recall2/blob/main/'.length))), href); continue; }
    assert.ok(!/^[a-z]+:/i.test(href), `unexpected external link ${href}`);
    assert.ok(fs.existsSync(path.join(PAGE, href.split(/[?#]/)[0])), `link ${href}`);
    const glb = /model-compare\.html\?[^=]+=([^&]+)/.exec(href);
    if (glb) assert.ok(fs.existsSync(path.resolve(PAGE, decodeURIComponent(glb[1]))), `glb ${href}`);
  }
});

test('published regressions: Da Costabuurt-Noord has faces and types, a Nieuw-West buurt has designs, Terrasdorp has nothing', { skip: !published }, () => {
  const { feats, items } = load();
  const by = (code: string) => feats.find(f => f.properties.code === code)!.properties;
  const daCosta = by('EQ01');
  assert.equal(daCosta.name, 'Da Costabuurt-Noord');
  assert.ok(daCosta.content.faces.some(([id]) => items.faces[id].status === 'installed'), 'an installed face');
  assert.ok(daCosta.content.types.length >= 5, 'type libraries');
  const nw = by('FK05');
  assert.equal(nw.stadsdeel, 'Nieuw-West');
  assert.ok(nw.content.designs.length >= 3 && nw.content.designs.every(([id]) => items.designs[id].links.length));
  assert.equal(by('NC03').name, 'Terrasdorp');
  assert.equal(hasContent(by('NC03').content), false);
});
