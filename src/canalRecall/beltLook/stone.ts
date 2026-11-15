/**
 * The belt look's gable stone (lane D 2026-11-15, on lane R's RowGableStone): the 1700s neck and bell gables of the canal
 * belt carry carved claw pieces, a dark painted hood over the cap and, on some necks, a cartouche. The rates are the
 * measured belt necks and bells of Herengracht 25-73 that lane R audited against their photos (31, 55, 57, 59, 61, 63, 168213;
 * R's 569360013): carved claws 5 of 7, a dark hood 4 of 7, carving in the neck 4 of 7 (a cartouche on 61 and 63, a small
 * oculus on 31 and 57). A generated series draws them by a hash of its first
 * front, so a row is coherent and the same pand always draws the same stone; a stated gable stone is never touched.
 * Pure: no fs, no DOM.
 */
import type { RowGable, RowGableStone, RowRecord } from '../houseSpec/row/types.ts';
import { hash32 } from './donors.ts';

/** Measured rates (of 7 audited 1700s necks and bells). */
export const BELT_STONE_RATES = { carvedClaws: 5 / 7, darkHood: 4 / 7, neckCartouche: 2 / 7, neckOculus: 2 / 7 } as const;
/** The build years the rates describe. */
export const BELT_STONE_YEARS = { from: 1700, to: 1799 } as const;
const STONE_CROWNS = new Set(['neck', 'raised-neck', 'bell']);

/** A uniform draw in [0, 1) per key and salt: deterministic, independent per feature. */
const draw = (key: string, salt: string) => hash32(`${key}|${salt}`) / 0x1_0000_0000;

/** The stone a series of this crown and build year draws (null: none of the period's carving applies). */
export function beltStone(key: string, crown: string, year: number | null): RowGableStone | null {
  if (!STONE_CROWNS.has(crown) || year === null || year < BELT_STONE_YEARS.from || year > BELT_STONE_YEARS.to) return null;
  const r = BELT_STONE_RATES, s: RowGableStone = {};
  if (draw(key, 'claws') < r.carvedClaws) s.claws = 'carved';
  if (draw(key, 'hood') < r.darkHood) s.hood = 'dark';
  if (crown !== 'bell') { const n = draw(key, 'neck'); if (n < r.neckCartouche) s.neck = 'cartouche'; else if (n < r.neckCartouche + r.neckOculus) s.neck = 'oculus'; }
  return Object.keys(s).length ? s : null;
}

/** Dress each generated series' unstated gable with the period's stone (`ref` names the look). */
export function dressBeltStone(row: RowRecord, ref: string): RowRecord {
  const built = new Map(row.members.map(m => [m.pandId, m.built ?? null]));
  for (const s of row.series) {
    const g = s.design.gable;
    if (!g?.value || g.source === 'reviewed' || (g.value as RowGable).stone) continue;
    const ids = s.fronts.map(f => f.split('#')[0]), years = ids.map(id => built.get(id)).filter((y): y is number => typeof y === 'number').sort((a, b) => a - b);
    const year = years.length ? years[years.length >> 1] : null;
    const stone = beltStone([...ids].sort()[0], String(s.design.crown?.value ?? ''), year);
    if (!stone) continue;
    s.design.gable = { ...g, value: { ...(g.value as RowGable), stone }, ref: `${g.ref ?? ''}; stone: ${ref} (1700s neck and bell rates of lane R's audit)` };
  }
  return row;
}
