/**
 * Belt review pixel profile (2026-11-21, bar-fixes lane). The self-check's photo measures are one-shot fractions the judge
 * eyeballs; read against a pixel grid they run low on the ground storey (Herengracht 58: judge 0.36, grid 0.43; 10: 0.35
 * against 0.42; 54's ground windows 0.95 of an upper one against 1.6), so the drawing kept a squat ground storey the same
 * judge then failed. These are landmarks read off the crop with a y grid (pixels down from the crop's top), turned into
 * the read's storey shares, ground window ratio and the cornice zone's depth.
 *
 * Pure. scripts/belt-review/self-check.ts --apply-pixels writes them onto photo-read.json with a note.
 */

/** Landmarks on one picked crop (y in crop pixels, down from the top). */
export interface PixelLandmarks {
  /** The pavement (or the quay's top) in front of the house. */
  pavement: number;
  /** The floor lines between storeys, ground storey's top first, upward (each between a row's heads and the next sills). */
  floors: number[];
  /** The top of the top storey: the cornice zone's foot (frieze, attic band or the cornice itself), or a gable's eaves line. */
  corniceBottom: number;
  /** The cornice's top (its corona) on a cornice front; absent on a gable front or where the crop cuts it off. */
  corniceTop?: number;
  /** A ground window's and a first-upper window's [top, bottom], frames included. */
  groundWindow?: [number, number];
  upperWindow?: [number, number];
  /** Read corrections the grid settles (each with a note on the entry). */
  storeys?: number;
  bays?: number;
  note?: string;
}

/** What the landmarks say, in the read's terms. */
export interface PixelProfile {
  /** Each storey's share of the wall from the pavement to the cornice zone's foot, ground first. */
  storeyShares: number[];
  groundWindowRatio?: number;
  /** The cornice zone (its foot to its top) as a share of the pavement-to-cornice-top height. */
  corniceRatio?: number;
}

const r3 = (x: number) => +x.toFixed(3);

/** The profile of a landmark set; null when the lines are not ordered (pavement under the floors, under the cornice). */
export function pixelProfile(m: PixelLandmarks): PixelProfile | null {
  const lines = [m.pavement, ...m.floors, m.corniceBottom];
  for (let i = 1; i < lines.length; i++) if (!(lines[i] < lines[i - 1])) return null;
  const wall = m.pavement - m.corniceBottom;
  const storeyShares = lines.slice(1).map((y, i) => r3((lines[i] - y) / wall));
  const out: PixelProfile = { storeyShares };
  const g = m.groundWindow, u = m.upperWindow;
  if (g && u && g[1] > g[0] && u[1] > u[0]) out.groundWindowRatio = +((g[1] - g[0]) / (u[1] - u[0])).toFixed(2);
  if (typeof m.corniceTop === 'number' && m.corniceTop < m.corniceBottom) out.corniceRatio = r3((m.corniceBottom - m.corniceTop) / (m.pavement - m.corniceTop));
  return out;
}

/**
 * The profile onto a read answer (mutated): the storey shares when they count the read's storeys (after a stated storey
 * correction), the ground window ratio in range, the cornice zone's depth on a cornice front, the bays correction.
 * Returns the fields written.
 */
export function applyPixelProfile(a: Record<string, unknown>, m: PixelLandmarks): string[] {
  const p = pixelProfile(m);
  if (!p) return [];
  const out: string[] = [];
  if (Number.isInteger(m.storeys) && m.storeys! >= 1 && m.storeys !== a.storeys) { a.storeys = m.storeys; out.push('storeys'); }
  if (Number.isInteger(m.bays) && m.bays! >= 1 && m.bays !== a.bays) { a.bays = m.bays; out.push('bays'); }
  if (p.storeyShares.length === a.storeys) { a.storeyShares = p.storeyShares; out.push('storeyShares'); }
  if (p.groundWindowRatio !== undefined && p.groundWindowRatio > 0.3 && p.groundWindowRatio < 3) { a.groundWindowRatio = p.groundWindowRatio; out.push('groundWindowRatio'); }
  if (p.corniceRatio !== undefined && p.corniceRatio >= CORNICE_RATIO.min && p.corniceRatio <= CORNICE_RATIO.max) { a.corniceRatio = p.corniceRatio; out.push('corniceRatio'); }
  return out;
}
/** A measured cornice zone outside this share of the front is a misread (a balustrade or a roof storey taken in). */
export const CORNICE_RATIO = { min: 0.03, max: 0.3 } as const;
