import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {rawWall} from './big-kit';
import source from './asterweg-23-footprints.json';

/**
 * Asterweg 23 (BAG 0363100012064810, 1923; Buiksloterham): a 6,000 m2 industrial block. The only street-facing wall is the 20.7 m east gable
 * (wall 1) of the low brick hall, a yellow-brown brick elevation under a shallow bow-string parapet with a 4.8 m roller door, glazed side strip,
 * red pedestrian doors and two small steel windows (ref-w1.jpg, rectified municipal panorama recording_2025-06-30_12-53-56_00256, 20 px/m,
 * t = px / 20 from the north end). Everything else is the 3DBAG LoD2.2 massing: the taller white-clad sawtooth block behind (walls > 9.5 m, seen
 * only over the gate in ref-t-se.jpg) and the brick west wing are INFERRED, no panorama sees them. Not modelled: signage lettering, gates, forklifts.
 */
export function buildAsterweg23(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const tallWall = (s: {type: string; rings: number[][][]}) => s.type === 'WallSurface' && Math.max(...s.rings[0].map(p => p[1])) > 9.5;
  // Low walls and every roof: brick / zinc. Tall walls: white cladding, added as a second pass so no surface is doubled.
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: s => tallWall(s)});
  addShell(b, source as never, {wall: 'concrete', roof: 'slate', skip: s => s.type !== 'WallSurface' || !tallWall(s)});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const w = rawWall(source as never, 1), f = w.f;
  // Parapet cap along the gable top.
  slab(b, f, w.len / 2, w.top - 0.05, w.len + 0.1, 0.22, 0.28, 'concrete');
  // Roller door opening (t 7.35-12.15, 4.6 m high), dark interior behind a steel canopy.
  slab(b, f, 9.75, 0, 4.8, 4.6, 0.12, 'dark');
  slab(b, f, 10.3, 4.6, 12.4, 0.5, 0.45, 'concrete');
  // Glazed side strip and the pedestrian door beside the roller door.
  slab(b, f, 12.75, 2.2, 0.9, 2.4, 0.12, 'glass');
  slab(b, f, 12.75, 0, 0.9, 2.2, 0.14, 'red');
  // Second red door and the red hose cabinet.
  slab(b, f, 16.85, 0, 0.9, 2.3, 0.14, 'red');
  slab(b, f, 14.95, 0.6, 1.1, 1.1, 0.16, 'red');
  // Steel-framed windows left and right of the door.
  for (const t of [1.9, 18.35]) {
    slab(b, f, t, 2.4, 1.5, 1.9, 0.1, 'frame');
    slab(b, f, t, 2.5, 1.3, 1.7, 0.14, 'glass');
  }
  // Company sign board above the door: white panel with a red band (lettering not reproduced).
  slab(b, f, 10.25, 5.4, 7.5, 1.6, 0.12, 'white');
  slab(b, f, 9.2, 6.0, 4.6, 0.55, 0.16, 'red');
  // Blue directional sign at left.
  slab(b, f, 4.0, 2.0, 3.3, 1.9, 0.12, 'blue');
  setSink(0);
}
