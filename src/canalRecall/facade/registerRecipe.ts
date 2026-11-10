// Register facts -> recipe reads (lane register-recipes, 2026-11-10, follow-up to #316). Pure and typed.
//
// The monuments register states a pand's gable, facade date, finish and a few facade elements
// (registerFacts.ts parses them). This turns those facts into feature properties the generic chain already honours,
// in four reads, each bounded and explainable:
//   gable    -> `monumentGable` (the roof planner's measured gable), only when nothing else set it
//   date     -> `constructionYear` (the period palette, window/sash layout, roof era odds all key on it), only when the
//               register's facade date falls in another era than the BAG year, or the BAG year is missing
//   finish   -> `registerFinish` 'light' | 'brick' (genericFacades.decorateFacade picks the wall colour family)
//   elements -> `registerForce`: wall-extra component ids whose dice are set to 1 (facadeExtras.dressWall);
//               a named dakkapel/dakvenster sets `roofDormer`
// A pand without facts, a measured appearance and a landmark/kit are returned unchanged (same object), so the chain is
// byte-identical for them. The register outranks 3DBAG for the crown kind and the era; measured photo fronts outrank
// the register (appearanceStyleSource measured, kits and recipes never reach this decorator).
import type { GableShape } from '../roofMesh.js';
import { GABLE_SHAPES } from '../roofMesh.js';
import { PERIOD_FROM } from '../look/palette.js';
import type { RegisterDate, RegisterFacts } from './registerFacts.js';

/** The published form: the staging record without `sourceText`/`sourceNr`. */
export type PublishedFacts = Partial<Omit<RegisterFacts, 'sourceNr' | 'sourceText' | 'elements'>> & { nr?: string | string[]; elements?: RegisterFacts['elements']; sourceText?: string };
export type RegisterFactsMap = ReadonlyMap<string, PublishedFacts>;

/** The integrator decides this default. In the lane it is on; `?registerFacts=0` (or REGISTER_FACTS=0 in Node) turns it off. */
export const REGISTER_FACTS_DEFAULT = true;
export function registerFactsEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]registerFacts=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? REGISTER_FACTS_DEFAULT : v === '1';
}

const PRIOR_SOURCE = 'citywide-identity-palette-v3-not-measured';
export type EraName = 'canal' | 'c19' | 'school' | 'modern';
export const eraOfYear = (y: number): EraName => y < PERIOD_FROM.c19 ? 'canal' : y < PERIOD_FROM.school ? 'c19' : y < PERIOD_FROM.modern ? 'school' : 'modern';
const mid = (d: RegisterDate) => Math.round((d.from + d.to) / 2);

/** The year the register dates the street front to, or null: the facade date; else the core date when nothing was altered. */
export function registerYear(f: PublishedFacts): number | null {
  if (f.facadeDate) return mid(f.facadeDate);
  if (f.coreDate && !f.altered) return mid(f.coreDate);
  return null;
}

/** Register element key -> the wall-extra component ids it sets to certain (facadeExtras/facadeOrnaments registry ids). */
export const ELEMENT_COMPONENTS: Readonly<Record<string, readonly string[]>> = {
  hoistBeam: ['hoist-beam'], stoop: ['stoop'], crownCornice: ['kroonlijst'], corniceConsoles: ['console-cornice'],
  doorSurround: ['door-surround'], balcony: ['iron-balconies'], shutters: ['shutters-3d'], anchors: ['wall-anchors'],
  gablestone: ['gable-stone'], bayWindow: ['bay-window'], cellarEntrance: ['basement-well'], pilasters: ['corner-pilasters'],
};
/** Stone bands (speklagen) draw as string courses. */
const STONE_BANDS_COMPONENT = 'string-courses';

/** Wall-extra component ids the register's elements force on, in a stable order. */
export function registerForce(f: PublishedFacts): string[] {
  const out = new Set<string>();
  for (const e of f.elements ?? []) for (const id of ELEMENT_COMPONENTS[e.key] ?? []) out.add(id);
  if (f.stoneBands) out.add(STONE_BANDS_COMPONENT);
  return [...out].sort();
}

type Props = Record<string, unknown>;
/** The property patch the register's facts make on a feature's properties; empty when nothing applies. */
export function registerPatch(f: PublishedFacts, p: Props): Props {
  const measured = p.appearanceStyleSource !== undefined && p.appearanceStyleSource !== PRIOR_SOURCE;
  if (measured || p.kitWall || p.largeTier) return {};
  const patch: Props = {};
  if (f.gable && (GABLE_SHAPES as readonly string[]).includes(f.gable) && p.monumentGable === undefined) patch.monumentGable = f.gable as GableShape;
  const ry = registerYear(f);
  if (ry !== null) {
    const bag = p.constructionYear === null || p.constructionYear === undefined ? NaN : Number(p.constructionYear);
    if (!Number.isFinite(bag) || eraOfYear(ry) !== eraOfYear(bag)) { patch.constructionYear = ry; patch.bagConstructionYear = Number.isFinite(bag) ? bag : null; }
  }
  if (f.finish) patch.registerFinish = f.finish === 'brick' || f.finish === 'ornamentalBrick' ? 'brick' : 'light';
  // A dakkapel or dakvenster the register names: the roof planner's dormer flag (3DBAG's roof parts otherwise decide).
  if (f.elements?.some(e => e.key === 'dormer') && p.roofDormer !== true) patch.roofDormer = true;
  const force = registerForce(f);
  if (force.length) patch.registerForce = force;
  return patch;
}

/** The decorator step: register facts for this feature's pand, or the same feature object when there are none. */
export function withRegisterFacts<T extends { properties: Props }>(feature: T, facts: RegisterFactsMap): T {
  const f = facts.get(String(feature.properties.id ?? ''));
  if (!f) return feature;
  const patch = registerPatch(f, feature.properties);
  return Object.keys(patch).length ? { ...feature, properties: { ...feature.properties, ...patch } } : feature;
}
export const decorateWithRegisterFacts = <T extends { properties: Props }>(feature: T, f: PublishedFacts): T => withRegisterFacts(feature, new Map([[String(feature.properties.id ?? ''), f]]));

/** The published extract's shape (monument-facts.json) as a map. */
export function registerFactsFromExtract(data: { buildings?: Record<string, PublishedFacts> } | null | undefined): RegisterFactsMap {
  return new Map(Object.entries(data?.buildings ?? {}));
}
