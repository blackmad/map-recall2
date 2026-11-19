// Shop interiors as real geometry (lane retail-pass-20261119 round 2, `?shopInteriors=1`; David 2026-11-19: "possible
// insides for things like hair salons"). The mesher cuts the ground-storey wall behind each shop window (retailFront.ts
// retailWindowBays, threeBuildingMesh.ts retailFrontOn) and the front draws a shallow room in the hole: back wall,
// floor, side walls and a ceiling, pendant lamps, and the template's props (shopProps/layout.ts) at their real depth
// instead of pressed into the 2 cm relief. Flat-colour triangles in the sign layer, as every prop: no texture, no draw
// call, no shader change. Pure (no DOM): runs in the mesh worker and in Node tests.
//
// Through glass by day the photos (artifacts/retail-pass/hair-photos, ten centre salons) show a dim room with lit
// lamps and mirrors and the street's reflection over the top of the pane; the room's surfaces are pulled toward the
// glass's dark (ROOM_PULL), lamps and mirrors (lit props) keep their light.
import { hash01, Mesh, type PropTri, type V3 } from './kit.js';

/** Templates that draw a room behind their glass (those whose props stand inside). */
export const INTERIOR_TEMPLATES: ReadonlySet<string> = new Set(['hairdresser', 'florist', 'bike', 'greengrocer']);

/** The room: depth behind the wall (m), how far the props stand clear of its back wall. */
export const ROOM = { depthM: 2.4, backClearM: 0.04, lampPitchM: 1.2 } as const;

/** Per template: walls, floor, ceiling and lamp colours (salons pale with dark floors; shops pale on concrete). */
const ROOM_LOOKS: Record<string, { wall: string; floor: string; ceiling: string; lamp: string; accent?: string }> = {
  hairdresser: { wall: '#ebe6dd', floor: '#3b3530', ceiling: '#e2ddd4', lamp: '#ffe6b0', accent: '#2a2826' },
  florist: { wall: '#e6dfd2', floor: '#6f6152', ceiling: '#ddd6c9', lamp: '#fff1cf' },
  bike: { wall: '#d9d6cf', floor: '#6d6b67', ceiling: '#d2cfc8', lamp: '#f4f6ff' },
  greengrocer: { wall: '#efebe2', floor: '#8a857e', ceiling: '#e3dfd6', lamp: '#fff4d6' },
};

/**
 * The room behind one window bay [c0, c1] (slot frame: x along the wall, y out of it so the room is y < 0, z up), its
 * floor at `floor`, its ceiling at `ceil` (the window head: the transom lights hide anything above). Back wall, floor,
 * the two side walls, a ceiling, a skirting band and lamps hanging over the room about every ROOM.lampPitchM, lit.
 * 12 + 2 per lamp tris (and 2 for a salon's dark wainscot).
 */
export function roomTris(template: string, c0: number, c1: number, floor: number, ceil: number, seed: string, depthM: number = ROOM.depthM): PropTri[] {
  const look = ROOM_LOOKS[template] ?? ROOM_LOOKS.florist, m = new Mesh(), D = depthM;
  const P = (x: number, y: number, z: number): V3 => [x, y, z];
  m.quad(P(c0, -D, floor), P(c1, -D, floor), P(c1, -D, ceil), P(c0, -D, ceil), look.wall, [0, 1, 0]);
  m.quad(P(c0, -D, floor), P(c1, -D, floor), P(c1, 0, floor), P(c0, 0, floor), look.floor, [0, 0, 1]);
  m.quad(P(c0, -D, ceil), P(c1, -D, ceil), P(c1, 0, ceil), P(c0, 0, ceil), look.ceiling, [0, 0, -1]);
  m.quad(P(c0, -D, floor), P(c0, 0, floor), P(c0, 0, ceil), P(c0, -D, ceil), shadeOf(look.wall, 0.9), [1, 0, 0]);
  m.quad(P(c1, -D, floor), P(c1, 0, floor), P(c1, 0, ceil), P(c1, -D, ceil), shadeOf(look.wall, 0.86), [-1, 0, 0]);
  // A salon's dark wainscot on the back wall (the mirror wall's lower half in most of the photos).
  if (look.accent) m.quad(P(c0, -D + 0.005, floor), P(c1, -D + 0.005, floor), P(c1, -D + 0.005, floor + 0.75), P(c0, -D + 0.005, floor + 0.75), look.accent, [0, 1, 0]);
  else m.quad(P(c0, -D + 0.005, floor), P(c1, -D + 0.005, floor), P(c1, -D + 0.005, floor + 0.1), P(c0, -D + 0.005, floor + 0.1), shadeOf(look.wall, 0.6), [0, 1, 0]);
  // Pendant lamps, each a lit shade facing the street, hung 0.3 m under the ceiling, at seeded depths.
  const lamps = Math.max(1, Math.round((c1 - c0) / ROOM.lampPitchM)), r = (k: string) => hash01(`${seed}:${k}:lamp`);
  for (let k = 0; k < lamps; k++) {
    const x = c0 + (c1 - c0) * (k + 0.5) / lamps, y = -0.7 - r(`${k}`) * (D - 1.2), z = ceil - 0.3;
    m.quad(P(x - 0.12, y, z - 0.08), P(x + 0.12, y, z - 0.08), P(x + 0.08, y, z + 0.04), P(x - 0.08, y, z + 0.04), look.lamp, [0, 1, 0], true);
  }
  return m.tris;
}

/** A prop placed `depth` into the room, moved forward so nothing passes the back wall. */
export function intoRoom(tris: readonly PropTri[], depth: number, floor: number, depthM: number = ROOM.depthM): PropTri[] {
  const minY = Math.min(...tris.flatMap(t => t.p.map(p => p[1])));
  const dy = Math.max(-depth, -depthM + ROOM.backClearM - minY);
  return tris.map(t => ({ ...t, p: t.p.map(p => [p[0], p[1] + dy, p[2] + floor]) as [V3, V3, V3] }));
}

function shadeOf(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * k).toString(16).padStart(2, '0')).join('');
}
