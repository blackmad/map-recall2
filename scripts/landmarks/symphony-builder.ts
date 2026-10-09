import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {faceWall, punchedFacade, wallAwayFrom} from './modern-kit';
import {setSink} from './nearbar-kit';
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

  const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, wall = 'ochre') => {
    b.add(new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), wall as never, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    if (wall === 'ochre') b.add(new T.BoxGeometry(x1 - x0 - 0.04, 0.1, z1 - z0 - 0.04), 'slate' as never, (x0 + x1) / 2, y1 + 0.03, (z0 + z1) / 2);
  };
  // Tower A
  box(15.9, 42.0, -51.2, -41.3, 0, 58.8);
  box(18.8, 42.0, -60.6, -43.0, 0, 102.7);
  box(25.0, 35.5, -56.2, -46.2, 102.6, 105.0, 'slate');
  // Tower B
  box(52.2, 75.0, -93.2, -58.8, 0, 102.8);
  box(59.0, 69.0, -80.5, -66.0, 102.7, 105.1, 'slate');
  box(56.9, 79.0, -79.8, -47.5, 0, 74.0);
  // Office wing (trapezoid in plan: its south wall runs 5.3 degrees off the grid). Shape y = -native z so that
  // rotateX(-90 deg) maps (x, -z, depth) to (x, depth, z): extrusion goes up, top face looks up.
  {
    const sh = new T.Shape();
    const pts: [number, number][] = [[56.9, -44.67], [120.1, -38.8], [120.0, -93.8], [52.2, -93.9]];
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
    sh.closePath();
    const g = new T.ExtrudeGeometry(sh, {depth: 23.7, bevelEnabled: false});
    g.rotateX(-Math.PI / 2);
    b.add(g, 'ochre' as never);
    const cap = new T.ShapeGeometry(sh);
    cap.rotateX(-Math.PI / 2);
    b.add(cap, 'slate' as never, 0, 23.76, 0);
  }
  b.mark?.('shell');

  setSink(1.2);
  const tower = {y0: 5.0, pitch: 3.5, colPitch: 3.25, winW: 1.15, winBottom: 0.85, winH: 1.95, band: 'ochre', stripe: 'red', darkStripe: 'greyBrick', darkFloors: 5, glass: 'glass', ground: 'dark', crenel: 'ochre'};
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
    [[52.2, -58.8], 180, 4.7, 0, 102.8],
    [[56.9, -58.8], 180, 18.1, 74.0, 102.8],
    [[75.0, -80.0], 90, 13.2, 23.7, 102.8],
    [[75.0, -58.8], 90, 21.2, 74.0, 102.8],
    [[79.0, -47.5], 90, 32.3, 23.7, 74.0],
    [[56.9, -47.5], 180, 22.1, 23.7, 74.0],
    [[56.9, -58.8], 270, 11.3, 23.7, 74.0],
  ];
  // Tower B is the office tower: same brick and grid, finer axes (2.0 m) and narrower windows than the residential tower A.
  const office = {...tower, colPitch: 2.0, winW: 1.1};
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
