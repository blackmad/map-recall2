/**
 * The typed stoop on the generic streamed path (K-stoep #360): a pand whose HouseSpec says stoop (register `stoep`,
 * Jev, or a hand/measured `stoop` field; decorate.ts `specStoop`) draws buildingRecipe/stoop.ts's plan through the
 * facade extras, so the canal belt gets stoops without a GLB. The 'stoop' wall component (facadeExtras.ts) calls
 * `specStoopExtra` when the context carries `stoop`; without it the three-slab dice stoop is unchanged.
 *
 * The painted door of the generic wall stands on the pavement, so the landing is laid at a bel-etage sill (the spec's
 * steps x rise when given, else GENERIC_STOOP.sillM) in front of its lower part. The planner's pavement check uses the
 * street in front of the wall: `stoopReachM` = wall-to-centreline distance less half the BGT median carriageway of a
 * one-lane residential way (own-ground-osm-v1/bgt-width-by-class.json residential p10: 3 m). A stated flight that does not fit there falls
 * back to a front flight, then a side flight towards the longer free side, then the other side; else nothing is drawn.
 */
import { BOX_TRIS, type ExtraContext, type ExtraSink, type V3, type WallFrame } from './facadeExtraCore.js';
import { doorSpan } from './facadeOrnaments.js';
import { emitStoop, planStoop, STOOP, type StoopIntent, type StoopPlan } from './buildingRecipe/stoop.ts';
import type { RailSink } from './buildingRecipe/ironRailing.ts';

export const GENERIC_STOOP = {
  /** Landing height when the spec gives no steps: five 0.18 m risers. */
  sillM: 0.9,
  /** Never above this share of the ground storey (the painted door must still show above the landing). */
  maxSillShare: 0.42,
  /** Half the carriageway of a one-lane canal quay: the BGT wegdeel p10 width of a residential way (3 m). The median
   *  (5 m) left 0.5 m of pavement on Herengracht quays whose stoops are 1.2-2 m deep. */
  carriageHalfM: 1.5,
  stone: '#cfc6b4', painted: '#efece4',
} as const;

/** The plan for this wall, or null (no door, no room on the pavement or along the wall). */
export function genericStoopPlan(c: ExtraContext): { plan: StoopPlan; x0: number } | null {
  const s = c.stoop, d = doorSpan(c);
  if (!s || !d || c.shopfront) return null;
  const rise = s.riseM ?? STOOP.riseM;
  const sill = Math.min(s.steps ? s.steps * rise : GENERIC_STOOP.sillM, GENERIC_STOOP.maxSillShare * c.layout.groundM);
  const ctx = { doorLeftM: d.x - d.hw, doorWidthM: 2 * d.hw, sillM: sill, frontWidthM: c.f.len, zoneM: c.stoopReachM };
  // The generic sill is not the measured one: steps follow it (a stated `steps` already set it).
  // Nor is its souterrain: under a landing too low for the stated door, the opening becomes a window (or closes).
  const under = s.under === 'door' && sill < STOOP.underDoor.minSillM ? (sill >= STOOP.underWindow.minSillM ? 'window' : 'closed') : s.under === 'window' && sill < STOOP.underWindow.minSillM ? 'closed' : s.under;
  const want: StoopIntent = { ...s, riseM: undefined, steps: s.steps ?? Math.max(2, Math.round(sill / rise)), ...(under ? { under } : {}) };
  // The generic door is not the measured door, so a stated flight that does not fit there falls back: the front flight,
  // then along the wall towards the longer free side, then the other side.
  const leftRoom = d.x - d.hw, rightRoom = c.f.len - d.x - d.hw, toward = leftRoom >= rightRoom ? 'side-left' : 'side-right';
  const order = [want.flight ?? 'front', 'front', toward, toward === 'side-left' ? 'side-right' : 'side-left'] as const;
  const tries: StoopIntent[] = [...new Set(order)].map((flight, i) => i === 0 ? want : { ...want, flight, widthM: undefined, landing: undefined });
  for (const t of tries) { const p = planStoop(t, ctx); if (p.plan) return { plan: p.plan, x0: 0 }; }
  return null;
}

/** An ExtraSink as a stoop RailSink: facade frame (x along, y up, z out) to the wall frame (a along, o out, z up). */
function wallSink(c: ExtraContext, s: ExtraSink, hex: string): RailSink {
  const f: WallFrame = c.f, base = c.base;
  const P = (p: V3): V3 => [f.x0 + f.ux * p[0] + f.nx * p[2], f.y0 + f.uy * p[0] + f.ny * p[2], base + p[1]];
  const N = (n: V3): V3 => [f.ux * n[0] + f.nx * n[2], f.uy * n[0] + f.ny * n[2], n[1]];
  return {
    // ExtraSink boxes leave out the back (against the wall) and the bottom unless asked: a stoop never needs either.
    box: (x0, x1, y0, y1, z0, z1) => { s.box(f, x0, x1, z0, z1, base + y0, base + y1, hex); },
    quad: (a, b, cc, d, n) => { s.quad(P(a), P(b), P(cc), P(d), N(n), hex); },
  };
}

/** Counters for scripts (kit-stoep/cell-cost.ts): typed stoops drawn, and walls where the slabs stood in. */
export const stoopExtraStats = { drawn: 0, noRoom: 0, noBudget: 0, simplified: 0 };

/** Triangles `plan` costs on the streamed path (an ExtraSink box is BOX_TRIS, a quad two). */
export function streamStoopTris(plan: StoopPlan): number {
  let n = 0;
  const count: RailSink = { box: () => { n += BOX_TRIS; }, quad: () => { n += 2; } };
  emitStoop(plan, { body: count, iron: count, under: count }, { stream: true });
  return n;
}

/** The stated railing, then cheaper ones, until the stoop fits the wall's free triangles: an ornate side flight with
 *  its landing guard is ~216 triangles, over a 180-triangle street wall; bars ~130, plain ~90. The iron stays black. */
const RAIL_LADDER = ['ornate', 'bars', 'plain'] as const;

/** Draw the spec's stoop on this wall (atomic). True when drawn. */
export function specStoopExtra(c: ExtraContext, s: ExtraSink): boolean {
  const got = genericStoopPlan(c);
  if (!got) { stoopExtraStats.noRoom++; return false; }
  const stated = got.plan, room = s.room();
  const ladder = RAIL_LADDER.slice(Math.max(0, RAIL_LADDER.indexOf(stated.railStyle as typeof RAIL_LADDER[number])));
  const plan = ladder.map(railStyle => ({ ...stated, railStyle })).find(p => streamStoopTris(p) <= room) ?? stated;
  if (plan.railStyle !== stated.railStyle) stoopExtraStats.simplified++;
  const body = plan.material === 'brick' ? c.wallHex : plan.material === 'painted' ? GENERIC_STOOP.painted : GENERIC_STOOP.stone;
  s.begin();
  emitStoop(plan, { body: wallSink(c, s, body), iron: wallSink(c, s, STOOP.ironHex), under: wallSink(c, s, STOOP.underHex) }, { stream: true });
  const kept = s.commit();
  if (kept) stoopExtraStats.drawn++; else stoopExtraStats.noBudget++;
  return kept;
}
