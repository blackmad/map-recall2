import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {faceWall, punchedFacade, wallAwayFrom} from './modern-kit';
import {setSink} from './nearbar-kit';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import source from './symphony-footprints.json';

/**
 * Symphony (Gustav Mahlerplein, Zuidas, one BAG pand with seven 3DBAG parts; Pi de Bruijn / De Architekten
 * Cie with INBO, AWG architecten for the base; 2009-10). Native east/south metres from the anchor.
 * The two towers and the office wing are rebuilt as clean volumes on the planes fitted to the merged LoD2.2
 * walls (the AHN-derived LoD2 walls of these stepped brick blocks are too noisy to hang windows on):
 *  - A: the slender tower, a 58.8 m south block (x 15.9..42, z -51.2..-41.3) under a 102.7 m shaft;
 *  - B: the wide tower, a 102.8 m core (x 52.2..75, z -93.2..-58.8), a 74 m stage and the 23.7 m office wing.
 * Facade (read off the plaza panoramas): tan brick, one orange stripe per floor, dark-brown stripes over the
 * lowest floors, 29 floors on one grid (5.0 m ground storey, 3.5 m pitch), tall windows on 3.25 m axes (8 axes
 * across the slender tower's south face), crenellated shoulders. Apartment blocks (parts 0, 3) and the hotel
 * (part 1) keep the 3DBAG shell with their brick colours.
 */
type Part = Surface & {part: number};
const TOWER_PARTS = new Set([2, 4]);
const isTowerPart = (s: Surface) => TOWER_PARTS.has((s as Part).part);

export function buildSymphony(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const src = source as unknown as {surfaces: Part[]; nativeRing: number[][]};
  addShell(b, src as never, {wall: 'slate', roof: 'slate', skip: s => (s as Part).part === 1 || isTowerPart(s) || (s as Part).part >= 5});
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: s => (s as Part).part !== 1});

  // Massing as stacked, non-overlapping walls-only prisms per height band with roofs only where a band is uncovered
  // (2026-11-06, lane #237): the old overlapping boxes left their buried faces coplanar with the neighbouring box's walls
  // and caps 2 cm over the tops, about 320 m2 of ochre/ochre coplanar overlap. Plan points are native (x, z).
  const shape = (pts: [number, number][]) => { const sh = new T.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z))); sh.closePath(); return sh; };
  const walls = (pts: [number, number][], y0: number, y1: number) => {
    const g = openTopPrism(shape(pts), y0, y1), p = g.getAttribute('position'), n = g.getAttribute('normal'), keep: number[] = [];
    for (let i = 0; i < p.count; i += 3) {
      if ([0, 1, 2].every(j => Math.abs(n.getY(i + j)) > 0.9)) continue;
      for (let j = 0; j < 3; j++) keep.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j));
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); out.computeVertexNormals(); g.dispose();
    b.add(out, 'ochre' as never);
  };
  const roof = (pts: [number, number][], y: number, colour = 'slate') => b.add(upwardRoofPlane(shape(pts), y), colour as never);
  const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, wall = 'slate') =>
    b.add(new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), wall as never, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  // Tower A: the 58.8 m south block wrapped round the foot of the 102.7 m shaft
  const aLow: [number, number][] = [[18.8, -60.6], [42, -60.6], [42, -41.3], [15.9, -41.3], [15.9, -51.2], [18.8, -51.2]];
  const aShaft: [number, number][] = [[18.8, -60.6], [42, -60.6], [42, -43.0], [18.8, -43.0]];
  walls(aLow, 0, 58.8);
  walls(aShaft, 58.8, 102.7);
  roof([[42, -43.0], [42, -41.3], [15.9, -41.3], [15.9, -51.2], [18.8, -51.2], [18.8, -43.0]], 58.8);
  roof(aShaft, 102.7);
  box(25.0, 35.5, -56.2, -46.2, 102.0, 105.0);
  // Tower B: the office wing (its south wall 5.3 degrees off the grid) round the core and the 74 m stage
  const bLow: [number, number][] = [[52.2, -93.8], [120, -93.8], [120.1, -38.8], [56.9, -44.67], [55.55, -58.8], [52.2, -58.8]];
  const bMid: [number, number][] = [[52.2, -93.2], [75, -93.2], [75, -79.8], [79, -79.8], [79, -47.5], [56.9, -47.5], [56.9, -58.8], [52.2, -58.8]];
  const bCore: [number, number][] = [[52.2, -93.2], [75, -93.2], [75, -58.8], [52.2, -58.8]];
  walls(bLow, 0, 23.7);
  walls(bMid, 23.7, 74.0);
  walls(bCore, 74.0, 102.8);
  roof([[52.2, -93.8], [120, -93.8], [120.1, -38.8], [56.9, -44.67], [55.55, -58.8], [56.9, -58.8], [56.9, -47.5], [79, -47.5], [79, -79.8], [75, -79.8], [75, -93.2], [52.2, -93.2]], 23.7);
  roof([[75, -79.8], [79, -79.8], [79, -47.5], [56.9, -47.5], [56.9, -58.8], [75, -58.8]], 74.0);
  roof(bCore, 102.8);
  box(59.0, 69.0, -80.5, -66.0, 102.0, 105.1);
  b.mark?.('shell');

  setSink(1.2);
  // Piers (2026-11-06, lane #237, Commons "Amsterdam Symphony Towers" 2021-11-22): both towers read as deep tan brick
  // fins with the glazing set back between them, every fin rising as a merlon above the flat crown (about 1.0 m on the
  // residential tower, 0.7 m on the office tower); the windows are tall slots, about 42 % of each axis and two thirds of the storey. The old flat punched front had
  // no fins and no crown above 100 m.
  const tower = {y0: 5.0, pitch: 3.5, colPitch: 3.25, winW: 1.35, winBottom: 0.6, winH: 2.35, band: 'ochre', stripe: 'red', darkStripe: 'greyBrick', darkFloors: 5, glass: 'glass', ground: 'dark',
    pier: {colour: 'ochre', depth: 0.45, crenelH: 1.0}};
  // [origin at t = 0, outward bearing, length, y from, y to]
  const faces: [[number, number], number, number, number, number][] = [
    // A
    [[15.9, -41.3], 180, 26.1, 0, 58.8],
    [[15.9, -51.2], 270, 9.9, 0, 58.8],
    [[18.8, -43.0], 180, 23.2, 58.8, 102.7],
    [[42.0, -41.3], 90, 19.3, 0, 102.7],
    [[42.0, -60.6], 0, 23.2, 0, 102.7],
    [[18.8, -60.6], 270, 9.4, 0, 102.7],
    [[18.8, -51.2], 270, 8.2, 58.8, 102.7],
    // B
    [[75.0, -93.2], 0, 22.8, 0, 102.8],
    [[52.2, -93.2], 270, 34.4, 0, 102.8],
    [[52.2, -58.8], 180, 4.7, 23.7, 102.8],  // below 23.7 the wing's slanted west wall takes over at x 55.55
    [[56.9, -58.8], 180, 18.1, 74.0, 102.8],
    [[75.0, -80.0], 90, 13.2, 23.7, 102.8],
    [[75.0, -58.8], 90, 21.2, 74.0, 102.8],
    [[79.0, -47.5], 90, 32.3, 23.7, 74.0],
    [[56.9, -47.5], 180, 22.1, 23.7, 74.0],
    [[56.9, -58.8], 270, 11.3, 23.7, 74.0],
  ];
  // Tower B is the office tower: same brick and grid, finer axes (2.0 m) and narrower windows than the residential tower A.
  const office = {...tower, colPitch: 2.0, winW: 0.9, pier: {colour: 'ochre', depth: 0.4, crenelH: 0.7}};
  faces.forEach(([origin, bearing, len, y0, y1], k) => punchedFacade(b, faceWall(origin, bearing, len, y0, y1), k >= 7 ? office : tower));
  const wing = {y0: 5.0, pitch: 3.5, colPitch: 2.2, winW: 1.6, winBottom: 0.9, winH: 1.9, band: 'ochre', stripe: 'red', glass: 'glass', ground: 'dark', crenel: 'ochre'};
  for (const [origin, bearing, len] of [[[56.9, -44.67], 185.3, 63.4], [[120.1, -38.8], 90, 55.0], [[120.0, -93.8], 0, 67.8]] as [[number, number], number, number][])
    punchedFacade(b, faceWall(origin, bearing, len, 0, 23.7), wing);
  setSink(0.9);
  // Hotel (part 1, red brick) and the two dark apartment blocks (parts 0 and 3): windows on the 3DBAG walls.
  const hotel = {y0: 5.0, pitch: 3.3, colPitch: 3.0, winW: 0.95, winBottom: 0.9, winH: 1.9, band: 'brick', glass: 'glass'};
  const flats = {y0: 4.6, pitch: 3.1, colPitch: 2.9, winW: 1.6, winBottom: 0.2, winH: 2.4, band: 'slate', glass: 'glass'};
  const centres: Record<number, [number, number]> = {0: [-22, 1], 1: [97, -2], 3: [-22, -63]};
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || !(s.part in centres)) return;
    const w = wallAwayFrom(s, i, centres[s.part]);
    if (!w || w.length < 5 || w.poly.every(p => p[1] < 8) || Math.max(...w.poly.map(p => p[1])) - w.base < 6) return;
    punchedFacade(b, w, s.part === 1 ? hotel : flats);
  });
  setSink(0);
}
