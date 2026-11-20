import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrateByNeighbours, classifyDarkWall, litWallTone, lstar, neighbourWall } from './darkWallRule.ts';
import { modernPandWall } from './modernPandWalls.ts';
import CORRECTIONS from './modern-pand-wall-corrections.json';

test('a near-black reading with a much brighter lit re-read is an artefact; a dark box stays dark; a sky box is exposure-limited', () => {
  assert.equal(classifyDarkWall([30, 30, 30], [60, 60, 58], 0.2), 'artefact');
  assert.equal(classifyDarkWall([30, 30, 30], [60, 60, 58], 0.8), 'dark', 'the dark pixels are the facade');
  assert.equal(classifyDarkWall([40, 40, 40], [45, 45, 45], 0.2), 'dark', 'no real lift');
  assert.equal(classifyDarkWall([30, 30, 30], [45, 45, 45], 0.8, 0.9), 'exposure');
  assert.equal(classifyDarkWall([30, 30, 30], null, 0.8, 0.1), 'unread');
});

test('the lit tone ignores the warm-only filter: a grey wall with a few warm reveals reads grey', () => {
  const px: number[] = [];
  for (let i = 0; i < 900; i++) px.push(120, 122, 125);
  for (let i = 0; i < 100; i++) px.push(60, 40, 30);
  assert.deepEqual(litWallTone(px)!.map(Math.round), [120, 122, 125]);
  assert.equal(litWallTone([1, 2, 3]), null);
});

test('calibration takes the nearest population readings; the neighbour wall leans dark and prefers the decade', () => {
  const pop = [{ raw: [50, 50, 50] as const, published: [100, 100, 100] as const }, { raw: [52, 52, 52] as const, published: [110, 110, 110] as const }, { raw: [200, 200, 200] as const, published: [240, 240, 240] as const }];
  assert.deepEqual(calibrateByNeighbours([51, 51, 51], pop, 2), [110, 110, 110]);
  const others = [1990, 1991, 1992, 1993, 1994].map((year, i) => ({ year, published: [60 + i * 30, 50 + i * 30, 40 + i * 30] as const }));
  assert.deepEqual(neighbourWall(1995, [...others, { year: 1960, published: [250, 250, 250] }]), [90, 80, 70]);
  assert.equal(neighbourWall(1995, []), null);
});

test('every near-black correction row is sourced, lighter than what it replaces, and is what modernPandWall returns', () => {
  const rows = Object.entries((CORRECTIONS as { walls: Record<string, { wall: string; measured?: string; why: string; source: string }> }).walls).filter(([, r]) => r.why.startsWith('Near-black artefact'));
  assert.ok(rows.length >= 100, `${rows.length} rows`);
  for (const [id, r] of rows) {
    assert.match(r.source, /api\.data\.amsterdam\.nl\/panorama\/thumbnail/);
    assert.ok(lstar(r.wall.slice(1)) > lstar(r.measured!.slice(1)), id);
    assert.equal(modernPandWall(id)!.hex.replace('#', ''), r.wall.slice(1), id);
  }
});
