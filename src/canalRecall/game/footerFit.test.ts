import assert from 'node:assert/strict';
import test from 'node:test';
import { fitFooterItems, type FooterItem } from './footerFit.ts';

const width = (text: string): number => text.length * 6;
const nl: FooterItem[] = [
  { text: '★ Nieuw persoonlijk record', rank: 9 },
  { text: 'Gemiddeld', rank: 1 },
  { text: 'Fiets', rank: 3 },
  { text: 'Volgcam', rank: 0 },
  { text: 'Beste reeks 2', rank: 2 },
];

test('everything stays when it fits', () => {
  assert.equal(fitFooterItems(nl, 1000, width), '★ Nieuw persoonlijk record · Gemiddeld · Fiets · Volgcam · Beste reeks 2');
});

test('the view goes first, then the difficulty, never mid-item', () => {
  const full = fitFooterItems(nl, 1000, width);
  const noView = fitFooterItems(nl, width(full) - 1, width);
  assert.equal(noView, '★ Nieuw persoonlijk record · Gemiddeld · Fiets · Beste reeks 2');
  const noDifficulty = fitFooterItems(nl, width(noView) - 1, width);
  assert.equal(noDifficulty, '★ Nieuw persoonlijk record · Fiets · Beste reeks 2');
  assert.equal(fitFooterItems(nl, 0, width), '★ Nieuw persoonlijk record');
});

test('empty items are skipped', () => {
  assert.equal(fitFooterItems([{ text: '', rank: 1 }, { text: 'Bike', rank: 2 }], 100, width), 'Bike');
});
