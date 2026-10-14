import {insidePanel, pt, type Panel} from '../../src/canalRecall/blockBuilding/panels';
import type {Cell} from '../../src/canalRecall/blockBuilding/compose';

/**
 * Window cells that no rider or gallery camera can see: the light courts and re-entrant angles between the museum's wings. A cell is hidden
 * when a horizontal ray straight out of its centre meets another wall panel (facing back at it) within `reachM`, i.e. the cell looks into a
 * court no wider than that. Roofs are ignored (a lower roof does not hide a high window), so the test only ever drops cells that face a wall.
 * The kit then leaves those cells as plain brick; the audit's blank-wall test already ignores walls a horizontal ray cannot leave through.
 */
export const HIDDEN_REACH_M = 24;

export type CellsByPanel = Map<number, Cell[]>;

export function hiddenCells(panels: Panel[], cells: CellsByPanel, reachM = HIDDEN_REACH_M): Set<string> {
  const hidden = new Set<string>();
  for (const [pi, list] of cells) {
    const p = panels[pi];
    if (!p) continue;
    for (const cell of list) {
      const u = (cell.u0 + cell.u1) / 2, v = (cell.v0 + cell.v1) / 2;
      const c = pt(p, u, v, 0.05);
      let blocked = false;
      for (const q of panels) {
        if (q === p) continue;
        const facing = q.n[0] * p.n[0] + q.n[2] * p.n[2];
        if (facing > -0.5) continue; // only walls looking back at this one
        const along = (q.o[0] - c[0]) * q.n[0] + (q.o[2] - c[2]) * q.n[2];       // (q.o - c) . q.n: ray parameter t = along / (dir . q.n)
        const t = along / (p.n[0] * q.n[0] + p.n[2] * q.n[2]);
        if (t < 0.05 || t > reachM) continue;
        const hx = c[0] + p.n[0] * t, hz = c[2] + p.n[2] * t;
        const uq = (hx - q.o[0]) * q.r[0] + (hz - q.o[2]) * q.r[2];
        if (uq < q.uMin || uq > q.uMax || v < q.vMin || v > q.vMax) continue;
        if (insidePanel(q, [uq, v])) { blocked = true; break; }
      }
      if (blocked) hidden.add(`${pi}:${cell.floor}:${cell.bay}`);
    }
  }
  return hidden;
}
