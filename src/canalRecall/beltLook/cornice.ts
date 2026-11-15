/**
 * The belt look's timber cornices (lane D 2026-11-15, on lane R's RowCorniceDress, d6a094ae5): an 1800s cornice front in the
 * canal belt draws a painted timber cornice. Each part is drawn by its own hash of the series' first front at the rates of
 * the eight cornice fronts lane R read from the photos (Herengracht 158, 159, 164, 174, 209, 248, 250, 252):
 *   paint   cream 3, white 3, grey 1, buff (#cfcabd) 1
 *   frieze  attic lights 5, plain 2, panels 1
 *   under   modillions 3, dentils 2, consoles 2, none 1
 *   centre  none 5, balustrade 2, pediment 1 (a centre only on a front of three bays or more)
 * A stated cornice dress or a reviewed one is never touched. Deterministic per series, row-coherent. Pure.
 */
import type { RowCorniceDress, RowRecord } from '../houseSpec/row/types.ts';
import { hash32 } from './donors.ts';

type Weighted<T> = ReadonlyArray<readonly [T, number]>;
export const BELT_CORNICE_RATES = {
  paint: [['cream', 3], ['white', 3], ['grey', 1], ['#cfcabd', 1]] as Weighted<string>,
  frieze: [['attic-lights', 5], ['plain', 2], ['panels', 1]] as Weighted<NonNullable<RowCorniceDress['frieze']>>,
  supports: [['modillions', 3], ['dentils', 2], ['consoles', 2], ['none', 1]] as Weighted<NonNullable<RowCorniceDress['supports']>>,
  centre: [[null, 5], ['balustrade', 2], ['pediment', 1]] as Weighted<RowCorniceDress['centre'] | null>,
} as const;
/** The years the rates describe (the facade year when the register states one, else BAG's). */
export const BELT_CORNICE_YEARS = { from: 1800, to: 1899 } as const;

const pick = <T>(w: Weighted<T>, key: string, salt: string): T => {
  const tot = w.reduce((s, [, n]) => s + n, 0);
  let u = (hash32(`${key}|${salt}`) / 0x1_0000_0000) * tot;
  for (const [v, n] of w) { if (u < n) return v; u -= n; }
  return w[w.length - 1][0];
};

/** The cornice dress a cornice series of this build year and bay count draws (null outside the period). */
export function beltCornice(key: string, year: number | null, bays: number): RowCorniceDress | null {
  if (year === null || year < BELT_CORNICE_YEARS.from || year > BELT_CORNICE_YEARS.to) return null;
  const r = BELT_CORNICE_RATES, centre = bays >= 3 ? pick(r.centre, key, 'centre') : null;
  return { paint: pick(r.paint, key, 'paint'), frieze: pick(r.frieze, key, 'frieze'), supports: pick(r.supports, key, 'supports'), ...(centre ? { centre } : {}) };
}

/** Dress each generated cornice series without a stated cornice dress (`ref` names the look). */
export function dressBeltCornice(row: RowRecord, ref: string): RowRecord {
  const built = new Map(row.members.map(m => [m.pandId, m.built ?? null]));
  for (const s of row.series) {
    if (s.design.crown?.value !== 'cornice' || s.design.corniceDress) continue;
    const ids = s.fronts.map(f => f.split('#')[0]), years = ids.map(id => built.get(id)).filter((y): y is number => typeof y === 'number').sort((a, b) => a - b);
    const dress = beltCornice([...ids].sort()[0], years.length ? years[years.length >> 1] : null, Number(s.design.bays?.value ?? 0));
    if (dress) s.design.corniceDress = { value: dress, source: 'period-default', ref: `${ref}: 1800s timber cornice at the rates of lane R's eight read cornices` };
  }
  return row;
}
