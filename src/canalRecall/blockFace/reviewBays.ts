/**
 * Reviewer axis-count pins for auto-placement (Haarlemmerbuurt, 2026-11-10).
 *
 * Auto-place gives a pand the type's axis count for its width (`match.baysByWidth`). On Haarlemmerstraat the 18th-c.
 * fronts of one width carry two or three axes (46 and 48B at 4.6-4.7 m have two, 50, 52 and 54 at 4.6-4.8 m three),
 * so the width cannot decide. A reviewer who has counted the window axes on the strip pins them in the `bays` list of
 * `scripts/block-face/buurten/<buurt>-review-types.json` ({pandId, type, bays, reason}). A pin for a pand placed with
 * another type is left alone; no pins = the decisions as they came (byte-identical). Pure.
 */
import type {Decision} from './autoPlace.ts';

export interface BaysPin {
  pandId: string;
  /** The type the pin is for: a pand placed with another type is left alone. */
  type: string;
  /** Window axes over the upper storeys, 1..6; or one count per storey from the ground up (Haarlemmerdijk 20: three windows under the gable over a row of two). */
  bays: number | number[];
  /**
   * Window head lines per storey (shares of the storey height, as the type body's `headLines`, 0.3..0.98), where the
   * strip's rows stand lower or higher than the type's (Haarlemmerdijk 16: the first upper row 0.5 m lower). Absent = the type's.
   */
  headLines?: number[];
  /** What on the strip shows the count. */
  reason: string;
}

export function baysPinProblems(pins: BaysPin[], types: {id: string}[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `bays pin ${k}`;
    if (!/^\d{16}$/.test(pin.pandId ?? '')) p.push(`${at}: pandId must be a 16-digit BAG pand id`);
    const counts = Array.isArray(pin.bays) ? pin.bays : [pin.bays];
    if (!counts.length || !counts.every(b => Number.isInteger(b) && b >= 1 && b <= 6)) p.push(`${at}: bays must be an integer 1..6, or a list of them per storey`);
    if (pin.headLines !== undefined && !(Array.isArray(pin.headLines) && pin.headLines.length && pin.headLines.every(h => typeof h === 'number' && h >= 0.3 && h <= 0.98))) p.push(`${at}: headLines must be shares 0.3..0.98 per storey`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows the axes)`);
    if (!types.some(t => t.id === pin.type)) p.push(`${at}: unknown type ${pin.type}`);
    if (pins.findIndex(x => x.pandId === pin.pandId) !== k) p.push(`${at}: pand ${pin.pandId} pinned twice`);
  });
  return p;
}

/**
 * Apply the pins (in place): the placement's `overrides.bays` becomes the pinned count, or is dropped when the pin equals
 * the type body's own count. Returns the pands pinned.
 */
export function applyBaysPins(decisions: Decision[], pins: BaysPin[], bodyBays: (typeId: string) => number | undefined): string[] {
  const changed: string[] = [];
  for (const d of decisions) {
    if (d.kind !== 'placed' || !d.house.type) continue;
    const pin = pins.find(x => x.pandId === d.pandId && x.type === d.typeId);
    if (!pin) continue;
    const t = d.house.type, overrides = {...(t.overrides ?? {})};
    if (pin.bays === bodyBays(d.typeId)) delete overrides.bays; else overrides.bays = pin.bays;
    if (pin.headLines) overrides.headLines = pin.headLines;
    if (Object.keys(overrides).length) t.overrides = overrides; else delete t.overrides;
    d.notes = [...d.notes, `bays ${Array.isArray(pin.bays) ? pin.bays.join('/') : pin.bays}${pin.headLines ? `, heads ${pin.headLines.join('/')}` : ''}: reviewer pin (${pin.reason})`];
    changed.push(d.pandId);
  }
  return changed;
}
