/** Recipe look: palette mapping into the city range and the city's fixed-light shade. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cityFrameTint, cityRoofTint, cityShade, cityTint, cityWallTint, CITY_BRICK_LIGHTNESS, CITY_ROOF, hexToRgb, rgbToHsl, RECIPE_SLOTS} from './recipeLook.ts';
import {wallShade} from '../threeBuildingMesh.ts';
import {paneUvs} from '../../../scripts/canalhouse-recipes/export-glb.ts';

const hsl = (hex: string) => rgbToHsl(hexToRgb(hex));

test('photo-sampled brick lifts into the city brick range, keeping hue and order', () => {
  // Bilderdijkstraat samples: 087959 dark 1909 brick, 'red-brown', 'yellow-brick', near-black.
  const samples = ['#2a1c18', '#5e4033', '#7a3e2c', '#b39468'];
  const lifted = samples.map(cityWallTint);
  for (const [i, hex] of lifted.entries()) {
    const [h, , l] = hsl(hex), [h0] = hsl(samples[i]);
    assert.ok(l >= CITY_BRICK_LIGHTNESS[0] - 0.005 && l <= CITY_BRICK_LIGHTNESS[1] + 0.005, `${samples[i]} -> ${hex} lightness ${l}`);
    assert.ok(Math.abs(h - h0) < 3 || Math.abs(Math.abs(h - h0) - 360) < 3, `${samples[i]} hue drift`);
  }
  for (let i = 1; i < lifted.length; i++) assert.ok(hsl(lifted[i])[2] >= hsl(lifted[i - 1])[2], 'darker brick stays darker');
  // The near-black regression (087959 rendered #1d0d08-dark before the look).
  assert.ok(hsl(cityWallTint('#5e4033'))[2] > 0.35);
});

test('frames, roofs and glass map onto the city palette', () => {
  assert.ok(hsl(cityFrameTint('#d9ccaa'))[2] > 0.85, 'cream frames read as the city white-cream');
  assert.ok(hsl(cityFrameTint('#1f2121'))[2] < 0.3, 'black painted frames stay dark');
  for (const hex of ['#3b4047', '#4b5056', '#2f2e2f']) assert.ok((CITY_ROOF.slate as readonly string[]).includes(cityRoofTint('slate', hex)));
  assert.ok((CITY_ROOF.flat as readonly string[]).includes(cityRoofTint('bitumen', '#6a6c6c')));
  const tile = hsl(cityRoofTint('roofTile', '#8a4632'));
  assert.ok(tile[2] >= 0.38 && tile[1] >= 0.35, 'red tile reads as the city pantile');
  assert.equal(cityTint('glass', '#2a3a42'), '#ffffff', 'glass colour comes from the pane texture');
  for (const slot of RECIPE_SLOTS) assert.match(cityTint(slot, '#7a3e2c'), /^#[0-9a-f]{6}$/);
});

test('shade equals the city layer: wallShade for walls, the roof formula for up faces', () => {
  for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const r = deg * Math.PI / 180, e = Math.sin(r), n = Math.cos(r);
    assert.ok(Math.abs(cityShade([e, n, 0]) - wallShade(e, n)) < 1e-9, `wall facing ${deg}`);
  }
  assert.ok(Math.abs(cityShade([0, 0, 1]) - (0.58 + 0.42 * 0.8)) < 1e-9, 'flat roof = LID_SHADE');
  assert.equal(cityShade([0, 0, -1]), 0.5);
  const slope = [-Math.sin(0.7), 0, Math.cos(0.7)] as [number, number, number];
  assert.ok(Math.abs(cityShade(slope) - Math.max(0.5, Math.min(1, 0.58 + 0.42 * (slope[0] * -0.35 + slope[2] * 0.8)))) < 1e-9);
});

test('pane UVs span 0..1 across each window, v up', () => {
  // A 1.2 x 1.8 m pane in a facade running along z.
  const p = [5, 2, 0, 5, 2, 1.2, 5, 3.8, 1.2, 5, 2, 0, 5, 3.8, 1.2, 5, 3.8, 0];
  const uv = paneUvs(p);
  const us = uv.filter((_, i) => i % 2 === 0), vs = uv.filter((_, i) => i % 2 === 1);
  assert.deepEqual([Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)], [0, 1, 0, 1]);
  assert.equal(vs[2], 1, 'top vertex has v = 1');
});
