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

/**
 * The stone the monument register names on a pand's front (monument-facts `elements`): klauwstukken (`claws`) carved, a
 * festoon (`festoons`) across a neck, an oeil-de-boeuf (`oeilDeBoeuf`) in the neck. Stated, it draws at any build year and
 * outranks the period's rates. Null: the register names none of them, or the crown carries no neck or bell stone.
 */
export function registerStone(crown: string, elements: readonly string[] | undefined): RowGableStone | null {
  if (!STONE_CROWNS.has(crown) || !elements?.length) return null;
  const e = new Set(elements), s: RowGableStone = {};
  if (e.has('claws')) s.claws = 'carved';
  if (crown !== 'bell' && e.has('festoons')) s.festoon = true;
  else if (crown !== 'bell' && e.has('oeilDeBoeuf')) s.neck = 'oculus';
  return Object.keys(s).length ? s : null;
}

/** Dress each generated series' unstated gable with the period's stone (`ref` names the look); the register's stated
 *  stone (`elements`, per pand) on top of it. */
export function dressBeltStone(row: RowRecord, ref: string, elements: ReadonlyMap<string, readonly string[]> = new Map()): RowRecord {
  const built = new Map(row.members.map(m => [m.pandId, m.built ?? null]));
  for (const s of row.series) {
    const g = s.design.gable;
    if (!g?.value || g.source === 'reviewed' || (g.value as RowGable).stone) continue;
    const ids = s.fronts.map(f => f.split('#')[0]), years = ids.map(id => built.get(id)).filter((y): y is number => typeof y === 'number').sort((a, b) => a - b);
    const year = years.length ? years[years.length >> 1] : null;
    const crown = String(s.design.crown?.value ?? '');
    const period = beltStone([...ids].sort()[0], crown, year);
    // The register's elements of the series' pands (a series is one design: any pand's statement dresses it).
    const named = registerStone(crown, [...new Set(ids.flatMap(id => elements.get(id) ?? []))]);
    if (!period && !named) continue;
    const stone: RowGableStone = { ...(period ?? {}), ...(named ?? {}) };
    if (stone.festoon) delete stone.neck;
    const why = [period ? `${ref} (1700s neck and bell rates of lane R's audit)` : null, named ? `the monument register names ${Object.keys(named).join(', ')} (monument-facts elements of ${ids.filter(id => elements.get(id)?.length).join(', ')})` : null].filter(Boolean).join('; ');
    s.design.gable = { ...g, value: { ...(g.value as RowGable), stone }, ref: `${g.ref ?? ''}; stone: ${why}` };
  }
  return row;
}
