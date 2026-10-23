/**
 * Draft a `kind: large` intent from the 3DBAG shell alone (landmark factory, stage "draft", 2026-10-23).
 *
 * One wall group per exposed panel that faces a named street (plus the wide unnamed exposed panels), every group
 * `brick-bay-grid` with placeholder colours, an entrance on the widest street panel, every other surface blank.
 * `measure.ts --write` then puts the photographed wall colour, glass, window shape, bay count and front class into
 * each group, so nothing here is counted by a person or a model: the shell decides the groups, the photo decides the
 * rest. The factory never calls this when a hand-authored intent exists.
 */
import {buildHost, pt, type Panel} from '../blockBuilding/panels.ts';
import {MeshBuilder} from '../blockBuilding/mesh.ts';
import {bearingOfNormal, largeSurfaceSet} from './fitLarge.ts';
import type {BuildingFacts} from './facts.ts';
import type {IntentSource, LargeBuildingIntent, LargeWallIntent} from './intent.ts';
import {validateLargeIntent} from './largeIntent.ts';

/** One archived crop row (`all-walls.ts --archive`, walls.json) the draft cites as a source. */
export interface DraftCrop { tag: string; panoId: string; capturedAt: string; crop?: boolean }
export interface DraftOptions {
  id: string; pandId: string; address?: string; crops?: DraftCrop[];
  /** at most this many wall groups (the 12k budget runs out at about eight fronts) */
  maxGroups?: number;
  /** a street-facing panel narrower than this is left blank (default 5 m) */
  minStreetWidthM?: number;
  /** an exposed panel on no named street narrower than this is left blank (default 8 m) */
  minOtherWidthM?: number;
}
export interface DraftGroup { group: number; panel: number; bearing: number; widthM: number; heightM: number; street: string | null }
export interface DraftSkip { panel: number; widthM: number; reason: string }
export interface DraftResult { intent: LargeBuildingIntent; groups: DraftGroup[]; skipped: DraftSkip[] }

/** shell-survey.ts's placeholders; `measure.ts --write` replaces `brick` per group from the crop */
export const DRAFT_PALETTE = {brick: '#8a5a44', frame: '#efece4', door: '#2a2a2a'} as const;
export const DRAFT_NOTE = 'Drafted by draftLarge.ts from the 3DBAG panels: systems, colours, window shapes and bays are placeholders until measure.ts --write.';
/** a panel faces a front when its bearing is within this of the front's outward normal */
export const FRONT_BEARING_TOLERANCE_DEG = 35;
/** ... and its midpoint lies within this of the front's line, inside the front's span (±3 m) */
export const FRONT_DISTANCE_M = 6;

const angleDiff = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

/** The named front (facts.fronts) a panel stands on, or null. RD → the recipe's local frame: x = east, z = south. */
export function frontOfPanel(p: Panel, fronts: BuildingFacts['fronts'], anchorRD: [number, number]): string | null {
  const b = bearingOfNormal(p.n), mid = pt(p, (p.uMin + p.uMax) / 2, 0);
  let best: {street: string; d: number} | null = null;
  for (const f of fronts) {
    const n = f.outwardNormalRD;
    if (angleDiff(b, bearingOfNormal([n[0], 0, -n[1]])) > FRONT_BEARING_TOLERANCE_DEG) continue;
    const a = [f.endpointsRD[0][0] - anchorRD[0], anchorRD[1] - f.endpointsRD[0][1]], c = [f.endpointsRD[1][0] - anchorRD[0], anchorRD[1] - f.endpointsRD[1][1]];
    const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz) || 1;
    // the frontage finder often keeps only a short piece of a long front (Van Leijenberghlaan: 4 m of a 51 m wall), so
    // the test is: the panel's midpoint within FRONT_DISTANCE_M of the front's line, and the two spans touching (3 m slack)
    const perp = Math.abs((mid[0] - a[0]) * dz - (mid[2] - a[1]) * dx) / len;
    const e0 = pt(p, p.uMin, 0), e1 = pt(p, p.uMax, 0);
    const t0 = ((e0[0] - a[0]) * dx + (e0[2] - a[1]) * dz) / len, t1 = ((e1[0] - a[0]) * dx + (e1[2] - a[1]) * dz) / len;
    if (perp > FRONT_DISTANCE_M || Math.max(t0, t1) < -3 || Math.min(t0, t1) > len + 3) continue;
    if (!best || perp < best.d) best = {street: f.street, d: perp};
  }
  return best?.street ?? null;
}

export function draftLargeIntent(facts: BuildingFacts, opts: DraftOptions): DraftResult {
  const {set, anchorRD} = largeSurfaceSet(facts);
  const {panels} = buildHost(set, new MeshBuilder(), 'roof', 'wall', {deferWalls: true});
  const minStreet = opts.minStreetWidthM ?? 5, minOther = opts.minOtherWidthM ?? 8, maxGroups = opts.maxGroups ?? 8;
  const rows = panels.map(p => ({p, w: p.uMax - p.uMin, h: p.vMax - p.vMin, street: frontOfPanel(p, facts.fronts, anchorRD), party: p.partyH > 0.5}))
    // street panels first, then by wall area, so the budget goes to what a rider sees
    .sort((x, y) => (y.street ? 1 : 0) - (x.street ? 1 : 0) || y.w * y.h - x.w * x.h);
  const chosen: typeof rows = [], skipped: DraftSkip[] = [];
  for (const r of rows) {
    const reason = r.party ? 'party wall' : r.h < 3 ? 'under 3 m tall'
      : r.street ? (r.w < minStreet ? `street panel under ${minStreet} m` : null) : (r.w < minOther ? `unnamed panel under ${minOther} m` : null);
    if (reason) { if (r.w >= 2) skipped.push({panel: r.p.index, widthM: +r.w.toFixed(1), reason}); continue; }
    if (chosen.length >= maxGroups) { skipped.push({panel: r.p.index, widthM: +r.w.toFixed(1), reason: `over ${maxGroups} groups`}); continue; }
    chosen.push(r);
  }
  if (!chosen.length) throw Error(`${opts.id}: no exposed panel at least ${minStreet} m wide faces a street, and none at least ${minOther} m wide is free`);
  const walls: LargeWallIntent[] = chosen.map((r, i) => ({
    wallSurfaces: [...new Set(r.p.walls.map(wi => set.walls[wi].surface!))].sort((a, b) => a - b),
    ...(r.street ? {street: r.street} : {}),
    system: 'brick-bay-grid',
    ...(i === 0 ? {entrance: true} : {}),
  }));
  const seen = new Set<string>();
  const sources: IntentSource[] = (opts.crops ?? []).filter(c => c.crop !== false && /^\d{4}-\d{2}-\d{2}$/.test(c.capturedAt) && c.panoId).flatMap(c => {
    const id = `pano-${c.capturedAt}-${c.tag}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{id, kind: 'street-panorama' as const, capturedAt: c.capturedAt, url: `https://api.data.amsterdam.nl/panorama/panoramas/${c.panoId}/`, license: 'Gemeente Amsterdam panorama, CC BY 4.0'}];
  });
  const notes = [DRAFT_NOTE];
  if (!sources.length) {
    // no crop yet: the shell is the only evidence, and the factory marks the item no-evidence until crops exist
    sources.push({id: '3dbag-shell', kind: 'orthophoto', capturedAt: /^\d{4}-\d{2}-\d{2}/.test(facts.source.fetchedAt) ? facts.source.fetchedAt.slice(0, 10) : '2025-09-03', url: facts.source.threeDBag});
    notes.push('No archived panorama crop when drafted: the 3DBAG shell is the only source (all-walls.ts --archive, then measure.ts --write).');
  }
  if (skipped.length) notes.push(`Panels left blank by the draft: ${skipped.map(s => `${s.panel} (${s.widthM} m, ${s.reason})`).join('; ')}.`);
  const intent: LargeBuildingIntent = {
    schemaVersion: 1, kind: 'large', id: opts.id, pandId: opts.pandId, address: opts.address ?? `BAG pand ${opts.pandId}`,
    sources, walls, otherWalls: 'blank', palette: {...DRAFT_PALETTE}, notes,
  };
  return {
    intent: validateLargeIntent(intent),
    groups: chosen.map((r, i) => ({group: i, panel: r.p.index, bearing: Math.round(bearingOfNormal(r.p.n)), widthM: +r.w.toFixed(1), heightM: +r.h.toFixed(1), street: r.street})),
    skipped,
  };
}
