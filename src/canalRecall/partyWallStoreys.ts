/**
 * Windows cut by a neighbour's box (feedback 18a9d3 Slotervaart, e058c8 / 1a223c Jacob van Lennepkade; verify report
 * 2026-11-19 §3: "drop or clip openings which intersect ... a neighbouring building's box").
 *
 * A party wall shared with a lower neighbour is cut over the neighbour's height (coplanarSurfaces.ts sharedWallCuts);
 * what is left above it kept the window cells' grid, so the row of windows at the neighbour's roofline showed its upper
 * half standing on the neighbour's roof. Here a piece whose bottom was raised by a cut to part-way up a cell row is
 * split at the next whole row: the part-row strip is drawn as plain wall (the building's plain layer), the whole rows
 * above keep their windows. A piece that was not raised, or that starts on a row line, comes back unchanged
 * (byte-identical where no neighbour box cuts a window).
 */

/** The wall pieces whose v runs in window cells (one v unit = one storey / the ground storey). */
export const CELL_KINDS: ReadonlySet<string> = new Set(['upper', 'ground', 'door']);
/** A bottom within this share of a row of its line counts as on the line. */
export const ROW_EPS = 0.02;

/** Counts the part rows turned plain (scripts/check-projection-windows.ts reports them). */
export const partyWallProbe = { strips: 0 };

export interface CellPiece { kind: string; layer: number; z0: number; z1: number; v0?: number; v1: number; u0: number; u1: number; along0: number; along1: number }

/**
 * `q` the wall quad before cutting, `pieces` what the cuts left of it, `tops` the neighbours' cut tops on this wall (a
 * piece raised to another height, a shop door's recess, is left alone). Plain strips use the plain wall's UVs (metres / 5
 * along, metres / 3 up, as the mesher's other plain pieces).
 */
export function wholeCellPieces<Q extends CellPiece>(q: Q, pieces: Q[], plainLayer: number | undefined, edgeLenM: number, tops: readonly number[]): Q[] {
  if (plainLayer === undefined || !tops.length || !CELL_KINDS.has(q.kind) || q.z1 - q.z0 < 1e-6) return pieces;
  const qv0 = q.v0 ?? 0, perZ = (q.v1 - qv0) / (q.z1 - q.z0);
  const out: Q[] = [];
  for (const p of pieces) {
    if (p.z0 <= q.z0 + 1e-6 || !tops.some(t => Math.abs(t - p.z0) < 1e-6)) { out.push(p); continue; }
    const v = qv0 + (p.z0 - q.z0) * perZ, f = v - Math.floor(v);
    if (f < ROW_EPS || f > 1 - ROW_EPS) { out.push(p); continue; }
    partyWallProbe.strips++;
    const vc = Math.ceil(v), zc = Math.min(p.z1, q.z0 + (vc - qv0) / perZ);
    out.push({ ...p, kind: 'upper-wall', layer: plainLayer, z1: zc, u0: p.along0 * edgeLenM / 5, u1: p.along1 * edgeLenM / 5, v0: p.z0 / 3, v1: zc / 3 });
    if (p.z1 - zc > 1e-6) out.push({ ...p, z0: zc, v0: vc });
  }
  return out;
}
