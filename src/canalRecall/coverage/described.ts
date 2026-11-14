/**
 * "Described": a pand that has a HouseSpec (photo-described by the D1 describer, traced front record, monument register,
 * author spec) whose drawable fields the generic mesher actually draws, and that the generic tier draws (no model, chunk,
 * type or kit claims it). A tier below own look: the houses are still the city-wide extrusion, but they carry measured
 * storeys, bays, crown, wall colour or ground storey. Pure; scripts/coverage/build-coverage.ts reads the extract and the
 * staged sets and calls these.
 *
 * "Drawable fields" are read off the spec's runtime view (houseSpec/view.ts specView, the extract's `v`), which is what
 * decorate.ts hands the generic path:
 *   storeys  v.storeys           the drawn storey count (specStoreyFit)
 *   bays     v.bays              window bays across the front (frontageLayoutScale)
 *   crown    v.gable | v.corniceCrown   a crown the roof planner or the cornice rule draws
 *   colour   v.wallHex           a measured wall colour (wallColour.ts)
 *   ground   v.groundM | v.shop | v.stoop   ground storey height, shop or quiet ground, stoop
 * A view with none of them (for example a register entry that states only a wall finish, or a gable the register gate
 * holds back) describes nothing the generic route draws and does not count.
 */
import type { TierId } from './coverage';

export const DESCRIBED_FIELDS = ['storeys', 'bays', 'crown', 'colour', 'ground'] as const;
export type DescribedField = typeof DESCRIBED_FIELDS[number];

/** The keys of a spec view this module reads (a subset of decorate.ts HouseSpecView, kept structural so it stays pure). */
export interface ViewLike {
  storeys?: number; bays?: number; gable?: string; corniceCrown?: boolean; wallHex?: string;
  groundM?: number; shop?: boolean; stoop?: unknown;
  src?: Record<string, string>;
}

export const DESCRIBED_LABEL: Record<DescribedField, string> = { storeys: 'storeys', bays: 'bays', crown: 'crown', colour: 'wall colour', ground: 'ground storey' };

/** The drawable fields a view states. Empty = nothing the generic route draws. */
export function describedFields(v: ViewLike | null | undefined): DescribedField[] {
  if (!v) return [];
  const out: DescribedField[] = [];
  if (Number.isInteger(v.storeys) && v.storeys! >= 2) out.push('storeys');
  if (Number.isFinite(v.bays) && v.bays! > 0) out.push('bays');
  if (v.gable || v.corniceCrown) out.push('crown');
  if (typeof v.wallHex === 'string' && /^#[0-9a-f]{6}$/i.test(v.wallHex)) out.push('colour');
  if (Number.isFinite(v.groundM) || typeof v.shop === 'boolean' || v.stoop !== undefined) out.push('ground');
  return out;
}

/** Sources that read the street front itself (view.ts PHOTO_SOURCES). A described pand with none of them is register text only. */
export const PHOTO_SRC: ReadonlySet<string> = new Set(['vision-judge', 'streetlevel-measured', 'reviewed', 'author']);
export const fromPhoto = (v: ViewLike | null | undefined): boolean => !!v?.src && Object.values(v.src).some(s => PHOTO_SRC.has(s));

export type DescribedTally = { pands: number; share: number; /** pands with at least one field read from the front (photo, traced record, author) rather than register text only */ photo: number; fields: Record<DescribedField, number> };
export const emptyDescribed = (): DescribedTally => ({ pands: 0, share: 0, photo: 0, fields: { storeys: 0, bays: 0, crown: 0, colour: 0, ground: 0 } });
export type BuurtDescribed = { live: DescribedTally; staged?: DescribedTally };

/** Tiers that mean the game draws something other than the generic extrusion for the pand. */
const isGeneric = (tier: TierId | undefined) => tier === undefined || tier === 'generic';

export type DescribedInput = {
  /** Pand ids of the buurt (BAG ids as in the base tiles; synthetic units never carry a spec). */
  pands: readonly string[];
  tierOf: ReadonlyMap<string, TierId>;
  /** Published views by pand id. */
  live: ReadonlyMap<string, ViewLike>;
  /** Staged views by pand id (a publish preview); counted only for pands not already described live. */
  staged?: ReadonlyMap<string, ViewLike>;
};

const share = (n: number, d: number) => d ? Math.round(1e4 * n / d) / 1e4 : 0;

/** Per-buurt tallies. `staged` is present only when a staged set was given; staged pands are "not live" and disjoint from `live`. */
export function describeBuurt(i: DescribedInput): BuurtDescribed {
  const live = emptyDescribed(), staged = emptyDescribed();
  for (const id of i.pands) {
    if (!isGeneric(i.tierOf.get(id))) continue;
    const liveFields = describedFields(i.live.get(id));
    const target = liveFields.length ? live : i.staged && describedFields(i.staged.get(id)).length ? staged : null;
    if (!target) continue;
    const view = liveFields.length ? i.live.get(id) : i.staged!.get(id);
    target.pands++;
    if (fromPhoto(view)) target.photo++;
    for (const f of liveFields.length ? liveFields : describedFields(view)) target.fields[f]++;
  }
  live.share = share(live.pands, i.pands.length);
  staged.share = share(staged.pands, i.pands.length);
  return i.staged ? { live, staged } : { live };
}

/** City-wide sum of the per-buurt tallies. */
export function sumDescribed(rows: readonly (BuurtDescribed | undefined)[]): { live: DescribedTally; staged: DescribedTally; buurtenLive: number; buurtenStaged: number } {
  const live = emptyDescribed(), staged = emptyDescribed();
  let buurtenLive = 0, buurtenStaged = 0;
  for (const r of rows) {
    if (!r) continue;
    if (r.live.pands) buurtenLive++;
    if (r.staged?.pands) buurtenStaged++;
    for (const [t, from] of [[live, r.live], [staged, r.staged]] as const) {
      if (!from) continue;
      t.pands += from.pands; t.photo += from.photo;
      for (const f of DESCRIBED_FIELDS) t.fields[f] += from.fields[f];
    }
  }
  return { live, staged, buurtenLive, buurtenStaged };
}

/** Map colour bin for the described metric: 0 none, 1-6 share bands. */
export const DESCRIBED_BINS = [0, 0.02, 0.05, 0.15, 0.3, 0.6] as const;
export function describedBin(share: number): number {
  if (!(share > 0)) return 0;
  let b = 1;
  for (let i = 1; i < DESCRIBED_BINS.length; i++) if (share >= DESCRIBED_BINS[i]) b = i + 1;
  return Math.min(b, 6);
}
export const DESCRIBED_LEGEND = ['not described', '< 2%', '2–5%', '5–15%', '15–30%', '30–60%', '≥ 60%'];

/** Share the page shows for a buurt: live, plus the staged preview when asked for. */
export const describedShown = (d: BuurtDescribed | undefined, includeStaged: boolean): number =>
  d ? d.live.share + (includeStaged && d.staged ? d.staged.share : 0) : 0;
