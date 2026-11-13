/**
 * Route C completer (lane C-completer, 2026-11-13; docs/house-line.md §15): a described house (a D1 `vision-judge` part,
 * possibly merged with other sources) completed into a canal-house intent the recipe compiler takes.
 *
 * Route A (the generic path) is the consumer of every described house; C is a capped quality tier on top of it, for fronts
 * where A still ignores two or more reliably-read fields (`cOnlyFields`). The completer never invents detail. A field the
 * part states is kept; a field it does not state is filled from, in order:
 *   1. a twin: the neighbour both answers name as the same design (mutual `sameAs`, PR1 `similar`), its stated fields only;
 *   2. a read class corroborated by geometry: the describer's crown when it is a raised gable and 3DBAG shows a crown over
 *      the eaves (D1 staged only crown classes with precision >= 0.8, which left 168094's point gable to a default);
 *   3. the street template (streetTemplate.ts): the dressings of the nearest reviewed house of the same band on the street
 *      or the adjoining block within 150 m, never structure, picked by a hash of the pand id when several are in reach;
 *   4. PR1's structure prior (storeys, window columns: structurePrior.ts);
 *   5. the build-year family default: the measured mode/median of that field over the published photo-sourced specs of the
 *      family (family-defaults.json, scripts/house-line/route-c/family-defaults.ts); a crown is a raised gable only when
 *      3DBAG shows one.
 * Every fill is recorded with its source. Then the gates: a part the geometry cannot hold (a storey pitch or a bay outside the
 * kit's range, a raised gable with no crown in 3DBAG, a whole-wall band pattern read at low confidence) is clamped or dropped
 * and logged, and the rest compiles. `validateIntent` problems drop the optional part they name (or refill a required one
 * from the family) until the intent validates.
 *
 * Pure: no files, no network. The CLI (scripts/house-line/route-c/complete.ts) supplies geometry, answers and twins, compiles
 * and renders.
 */
import { validateIntent, type CanalHouseIntent } from '../buildingRecipe/intent.ts';
import { drawableDesign, type HouseSpec, type SpecIgnored, type SpecLimit } from './spec.ts';
import { intentSources } from './toRecipe.ts';
import { structureGuess, STRUCTURE_PRIOR_TABLE, type StructurePriorTable } from './structurePrior.ts';
import { familyOf, RAISED_GABLES, type FamilyId } from './families.ts';
import FAMILY_TABLE from './family-defaults.json' with { type: 'json' };
import { streetTemplateFor, DRESSING_FIELDS, type TemplateTable } from './streetTemplate.ts';

export { familyOf, RAISED_GABLES, FAMILIES } from './families.ts';

export type FillSource = 'stated' | 'twin' | 'reading+geometry' | 'template' | 'prior' | 'family' | 'derived';
export interface Fill { path: string; value: unknown; source: FillSource; ref: string }
export interface Drop { path: string; value: unknown; gate: string; why: string; to?: unknown }
type FamilyEntry = { value: unknown; n: number; share: number | null };
export type FamilyTable = { table: Record<string, Record<string, FamilyEntry>> };

/** The few answer fields the completer reads beside the staged part (a D1 answer, `describer.ts`). */
export interface AnswerHints { crown?: string; bands?: string; low?: string[]; gaps?: SpecLimit[] }
export interface Geometry {
  year: number | null;
  lng: number; lat: number;
  /** The front's eaves above the ground (3DBAG via the recipe facts, else the mesher's exposed height). */
  eavesM: number;
  /** The street front's width. */
  widthM: number;
  /** Crown over the eaves along the front (3DBAG top - eaves); null when unknown. */
  crownRiseM: number | null;
  /** Whether the front's 3DBAG top profile peaks inside the front (a gable) rather than running level (a mansard, dormers);
   *  null when unknown. */
  crownPeaked?: boolean | null;
}
export interface CompleteInput {
  spec: HouseSpec;
  street: string;
  geometry: Geometry;
  answer?: AnswerHints | null;
  twin?: { pandId: string; spec: HouseSpec; mirrored: boolean } | null;
  prior?: StructurePriorTable;
  /** Street-template table (default: street-templates.json); `null` turns the rung off. */
  templates?: TemplateTable | null;
  families?: FamilyTable;
  /** Intent id (default `rc-<pandId>`). */
  id?: string;
}
export interface Completion {
  pandId: string;
  intent: CanalHouseIntent | null;
  candidate: Record<string, unknown>;
  family: FamilyId;
  fills: Fill[];
  drops: Drop[];
  ignored: SpecIgnored[];
  limits: SpecLimit[];
  cOnly: string[];
  error: string | null;
}

/** 3DBAG crown over the eaves at which a raised gable stands (m); below CROWN_ROOM_M a stated raised gable has no room. */
export const RAISED_RISE_M = 2;
/** Crown words the describer uses for a crown that does not rise as a gable. */
export const LEVEL_CROWNS: readonly string[] = ['cornice', 'flat', 'mansard', 'pitched-eaves'];
export const CROWN_ROOM_M = 1;
/** Storey pitch (eaves / storeys, a souterrain counted as SOUTERRAIN_SHARE of a storey) the kit draws as a house front. */
export const STOREY_PITCH_M: readonly [number, number] = [2.3, 5.2];
export const SOUTERRAIN_SHARE = 0.6;
/** Bay pitch (front width / window axes). */
export const BAY_PITCH_M: readonly [number, number] = [1.1, 4.8];
/** A family entry with fewer observations than this falls back to all years. */
export const FAMILY_MIN_N = 10;
/** Whole-wall band patterns (every course or stripe across the front) read below this confidence are dropped (171218). */
export const PATTERN_MIN_CONFIDENCE = 0.5;

/**
 * The fields of a front that A (the generic path) ignores and C draws, when stated by a reliable source: arched storeys
 * (segmental/round heads; H11 window look held), bands of any kind (held), a souterrain (A has no souterrain row), a shop
 * (H11 shop held), and the bay windows and balconies A has no part for. A front is C-eligible with two or more.
 */
export function cOnlyFields(spec: HouseSpec): string[] {
  const f = spec.design.fronts?.[0] ?? {}, out: string[] = [];
  // Reliably read: a receipt at or above PATTERN_MIN_CONFIDENCE (the reader did not mark the field low), or no receipt to judge.
  const sure = (p: string) => (spec.provenance[p]?.confidence ?? 1) >= PATTERN_MIN_CONFIDENCE;
  const head = f.windowHead?.kind;
  if (((head === 'segmental' || head === 'round') && sure('fronts/0/windowHead')) || (f.archedStoreys?.length ?? 0) > 0) out.push('arched storeys');
  if (f.bands && f.bands !== 'none' && sure('fronts/0/bands')) out.push('bands');
  if (f.souterrain && sure('fronts/0/souterrain')) out.push('souterrain');
  if ((spec.facts?.pui === 'shop' && sure('facts/pui')) || f.shopfront) out.push('shop');
  if (f.bayWindows) out.push('bay window');
  if (f.balconies) out.push('balcony');
  return out;
}
export const cEligible = (spec: HouseSpec): boolean => cOnlyFields(spec).length >= 2;

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function completeSpec(input: CompleteInput): Completion {
  const { spec, street, geometry: g } = input;
  const families = (input.families ?? FAMILY_TABLE) as unknown as FamilyTable;
  const family = familyOf(g.year);
  const fills: Fill[] = [], drops: Drop[] = [];
  const { design, ignored } = drawableDesign(structuredClone(spec.design ?? {}) as Record<string, any>);
  const f0: Record<string, any> = { ...(design.fronts?.[0] ?? {}) };
  const palette: Record<string, any> = { ...(design.palette ?? {}) };
  const roof: Record<string, any> = { ...(design.roof ?? {}) };
  const limits: SpecLimit[] = [...(spec.schemaLimits ?? [])];

  // What the part states (with its receipt).
  const provRef = (p: string) => { const pr = spec.provenance[p] ?? spec.provenance['']; return pr ? `${pr.source}:${pr.ref}` : 'spec'; };
  for (const [k, v] of Object.entries(f0)) fills.push({ path: `fronts/0/${k}`, value: v, source: 'stated', ref: provRef(`fronts/0/${k}`) });
  for (const [k, v] of Object.entries(palette)) fills.push({ path: `palette/${k}`, value: v, source: 'stated', ref: provRef(`palette/${k}`) });
  for (const [k, v] of Object.entries(roof)) fills.push({ path: `roof/${k}`, value: v, source: 'stated', ref: provRef(`roof/${k}`) });

  const target = (path: string): [Record<string, any>, string] => {
    const [a, b, c] = path.split('/');
    return a === 'fronts' ? [f0, c] : a === 'palette' ? [palette, b] : [roof, b];
  };
  const has = (path: string) => { const [o, k] = target(path); return o[k] !== undefined; };
  const set = (path: string, value: unknown, source: FillSource, ref: string) => {
    const [o, k] = target(path);
    o[k] = value;
    fills.push({ path, value, source, ref });
  };
  // A band's default is measured from that band's houses. All years stand in only for a field the intent requires and the
  // band has too few observations of (a dressing never: it stays the intent default).
  const fam = (field: string, required = true): { value: unknown; ref: string } | null => {
    const own = families.table[family]?.[field];
    if (own && own.n >= FAMILY_MIN_N) return { value: own.value, ref: `family ${family} (n ${own.n}${own.share !== null ? `, share ${own.share}` : ''})` };
    if (!required) return null;
    const all = families.table.all?.[field];
    return all ? { value: all.value, ref: `family all years (n ${all.n}${all.share !== null ? `, share ${all.share}` : ''}; ${family} n ${own?.n ?? 0})` } : null;
  };
  const fillFamily = (path: string, field: string) => { if (has(path)) return; const v = fam(field); if (v) set(path, v.value, 'family', v.ref); };

  // 1. Twin: the neighbour's stated fields (never its own fills or its twin copies).
  if (input.twin) {
    const t = input.twin, tf = (drawableDesign(structuredClone(t.spec.design ?? {}) as Record<string, any>).design.fronts?.[0] ?? {}) as Record<string, any>;
    const stated = (p: string) => { const pr = t.spec.provenance[p]; return pr && !pr.ref?.startsWith('twin:'); };
    for (const k of ['storeys', 'bays', 'gable', 'cornice', 'windowHead', 'bands', 'speklagen', 'souterrain', 'basement', 'windows']) {
      const p = `fronts/0/${k}`;
      if (!has(p) && tf[k] !== undefined && stated(p)) set(p, structuredClone(tf[k]), 'twin', `twin:${t.pandId}${t.mirrored ? ' (mirrored)' : ''}`);
    }
    if (!has('fronts/0/doorBay') && Number.isInteger(tf.doorBay) && stated('fronts/0/doorBay')) {
      const bays = Number(tf.bays);
      set('fronts/0/doorBay', t.mirrored && Number.isInteger(bays) ? bays - 1 - tf.doorBay : tf.doorBay, 'twin', `twin:${t.pandId}${t.mirrored ? ' (mirrored)' : ''}`);
    }
    for (const k of ['brick', 'wallMaterial']) {
      const p = `palette/${k}`, v = t.spec.design.palette?.[k as 'brick'];
      if (!has(p) && v !== undefined && stated(p)) set(p, v, 'twin', `twin:${t.pandId}`);
    }
  }

  // 2. The read crown, corroborated by geometry.
  const crown = input.answer?.crown;
  const raisedInGeometry = g.crownRiseM !== null && g.crownRiseM >= RAISED_RISE_M;
  if (!has('fronts/0/gable') && crown && RAISED_GABLES.includes(crown) && raisedInGeometry) {
    set('fronts/0/gable', crown, 'reading+geometry', `describer crown ${crown} (not staged: class precision < 0.8) + 3DBAG crown ${g.crownRiseM!.toFixed(1)} m over the eaves`);
  }

  // 3. The street template (streetTemplate.ts): dressings only, never structure, each fill naming the template house.
  if (input.templates !== null) {
    const pick = streetTemplateFor({ pandId: spec.pandId, lng: g.lng, lat: g.lat, year: g.year, street }, input.templates ?? undefined);
    if (pick) {
      const ref = `template:${pick.pandId} (${pick.street}, ${pick.distM} m, ${pick.sameStreet ? 'same street' : 'adjoining block'}, pick 1 of ${pick.pool}, ${pick.src})`;
      // A band word the reader read as `none` is a reading: no band from the template.
      const bandsRead = input.answer?.bands === 'none';
      if (!has('fronts/0/bands') && !bandsRead && pick.fields['fronts/0/bands'] !== undefined) set('fronts/0/bands', structuredClone(pick.fields['fronts/0/bands']), 'template', ref);
      // Band parameters only with the template's own band kind.
      const bandParams = new Set(['fronts/0/speklagen', 'fronts/0/bandLines', 'fronts/0/bandStoreys', 'fronts/0/bandHeights', 'palette/band']);
      for (const p of DRESSING_FIELDS) {
        if (p === 'fronts/0/bands' || has(p) || pick.fields[p] === undefined) continue;
        if (bandParams.has(p) && f0.bands !== pick.fields['fronts/0/bands']) continue;
        set(p, structuredClone(pick.fields[p]), 'template', ref);
      }
    }
  }

  // 4. The structure prior: storeys and window columns.
  if (!has('fronts/0/storeys') || !has('fronts/0/bays')) {
    const guess = structureGuess({ lng: g.lng, lat: g.lat, year: g.year, exposedM: g.eavesM, widthM: g.widthM }, input.prior ?? STRUCTURE_PRIOR_TABLE);
    const ref = `structure prior (year ${g.year}, eaves ${g.eavesM.toFixed(1)} m, width ${g.widthM.toFixed(1)} m)`;
    if (!has('fronts/0/storeys') && guess?.storeys) set('fronts/0/storeys', guess.storeys, 'prior', ref);
    if (!has('fronts/0/bays') && guess?.columns) set('fronts/0/bays', guess.columns, 'prior', ref);
  }

  // 5. Family defaults for what the intent needs.
  if (!has('fronts/0/storeys')) set('fronts/0/storeys', Math.max(1, Math.round(g.eavesM / 3.2)), 'derived', `eaves ${g.eavesM.toFixed(1)} m / 3.2 m (no prior row within reach)`);
  if (!has('fronts/0/bays')) set('fronts/0/bays', Math.max(1, Math.min(8, Math.round(g.widthM / 2.2))), 'derived', `width ${g.widthM.toFixed(1)} m / 2.2 m (no prior row within reach)`);
  if (!has('fronts/0/gable')) {
    // A raised gable only when no level crown was read and 3DBAG shows a peaked crown (a mansard or dormers also rise
    // over the eaves: 171218's mansard drew a family step gable before this rule).
    const levelRead = !!crown && LEVEL_CROWNS.includes(crown);
    const raised = raisedInGeometry && !levelRead && g.crownPeaked !== false;
    const v = fam(raised ? 'raisedGable' : 'levelGable');
    const why = levelRead ? `crown read ${crown} (a level crown)` : `3DBAG crown ${g.crownRiseM === null ? 'unknown' : `${g.crownRiseM.toFixed(1)} m`}${g.crownPeaked === false ? ', level profile' : ''}`;
    if (v) set('fronts/0/gable', v.value, 'family', `${v.ref}; ${why}`);
  }
  if (crown === 'mansard') limits.push({ component: 'roof', what: 'mansard crown read (class precision 0.33, not staged): drawn as the cornice crown over the 3DBAG roof' });
  fillFamily('fronts/0/cornice', 'cornice');
  // Dressings the band's measured mode states (a `none` mode is the plain intent default: no fill).
  for (const [path, field] of [['fronts/0/windowSurround', 'windowSurround'], ['fronts/0/windowSills', 'windowSills']] as const) {
    if (has(path)) continue;
    const v = fam(field, false);
    if (v && v.value !== 'none') set(path, v.value, 'family', v.ref);
  }
  fillFamily('fronts/0/windows', 'windows');
  fillFamily('fronts/0/hoist', 'hoist');
  if (!has('fronts/0/basement')) {
    if (f0.souterrain) fillFamily('fronts/0/basement', 'souterrainBasement');
    else fillFamily('fronts/0/basement', 'basement');
  }
  if (!has('fronts/0/doorBay')) {
    const side = fam('doorSide'), bays = Array.isArray(f0.bays) ? f0.bays[0] : f0.bays;
    const idx = side?.value === 'right' && Number.isInteger(bays) ? bays - 1 : 0;
    set('fronts/0/doorBay', idx, 'family', `door ${side?.value ?? 'left'}: ${side?.ref ?? 'none'}`);
  }
  if (!has('fronts/0/id')) set('fronts/0/id', 'front0', 'derived', 'intent identity');
  if (!has('fronts/0/street')) set('fronts/0/street', street, 'derived', 'the street the front faces (row list)');
  fillFamily('roof/material', 'roofMaterial');
  fillFamily('palette/frame', 'frame');
  fillFamily('palette/door', 'door');
  if (!isHex(palette.brick) && !(typeof palette.brick === 'string' && palette.brick)) fillFamily('palette/brick', 'brick');
  // Parameters the stated band words need (the describer reads the word, never the spacing or the band brick).
  if (f0.bands === 'speklagen' && !f0.speklagen) {
    const sp = fam('speklagenSpacing'), co = fam('speklagenCourses');
    set('fronts/0/speklagen', { spacing: sp?.value ?? 14, courses: co?.value ?? 2 }, 'family', `spacing ${sp?.ref}; courses ${co?.ref}`);
    if (palette.band === undefined) fillFamily('palette/band', 'speklagenBand');
  }
  if (f0.bands === 'courses' && palette.band === undefined) fillFamily('palette/band', 'coursesBand');
  // The shopfront the part states in facts.pui (toRecipe wraps design only; the prototype dropped it).
  if (spec.facts?.pui === 'shop' && !f0.shopfront) {
    const c = fam('shopColour'), fa = fam('shopFascia');
    set('fronts/0/shopfront', { colour: c?.value ?? '#423d38', fascia: fa?.value ?? true }, 'family', `facts/pui shop (${provRef('facts/pui')}); colour ${c?.ref}; fascia ${fa?.ref}`);
  } else if (spec.facts?.pui === 'warehouse') limits.push({ component: 'ground storey', what: 'warehouse ground storey (facts.pui) drawn as the house ground storey' });

  // Gates: clamp or drop what the geometry cannot hold.
  const drop = (path: string, gate: string, why: string, to?: unknown) => {
    const [o, k] = target(path), value = o[k];
    if (to === undefined) delete o[k]; else o[k] = to;
    drops.push({ path, value, gate, why, ...(to !== undefined ? { to } : {}) });
  };
  if (Number.isInteger(f0.storeys) && g.eavesM > 0) {
    const units = (n: number) => n + (f0.souterrain ? SOUTERRAIN_SHARE : 0);
    const pitch = g.eavesM / units(f0.storeys);
    if (pitch < STOREY_PITCH_M[0] || pitch > STOREY_PITCH_M[1]) {
      let best = f0.storeys, bestD = Infinity;
      for (let n = 1; n <= 12; n++) {
        const p = g.eavesM / units(n), d = p < STOREY_PITCH_M[0] ? STOREY_PITCH_M[0] - p : p > STOREY_PITCH_M[1] ? p - STOREY_PITCH_M[1] : 0;
        if (d < bestD - 1e-9 || (d === bestD && Math.abs(n - f0.storeys) < Math.abs(best - f0.storeys))) { best = n; bestD = d; }
      }
      drop('fronts/0/storeys', 'storey-pitch', `${f0.storeys} storeys${f0.souterrain ? ' + souterrain' : ''} on ${g.eavesM.toFixed(1)} m eaves = ${pitch.toFixed(2)} m pitch, outside ${STOREY_PITCH_M.join('..')} m`, best);
    }
  }
  const bayCount = Array.isArray(f0.bays) ? Math.max(...f0.bays) : f0.bays;
  if (Number.isInteger(bayCount) && g.widthM > 0) {
    const pitch = g.widthM / bayCount;
    if (pitch < BAY_PITCH_M[0] || pitch > BAY_PITCH_M[1]) {
      const to = Math.max(1, Math.min(Math.floor(g.widthM / BAY_PITCH_M[0]), Math.max(Math.ceil(g.widthM / BAY_PITCH_M[1]), bayCount)));
      drop('fronts/0/bays', 'bay-pitch', `${bayCount} bays on a ${g.widthM.toFixed(1)} m front = ${pitch.toFixed(2)} m, outside ${BAY_PITCH_M.join('..')} m`, to);
    }
  }
  if (RAISED_GABLES.includes(f0.gable) && g.crownRiseM !== null && g.crownRiseM < CROWN_ROOM_M) {
    drop('fronts/0/gable', 'crown-room', `a ${f0.gable} gable with ${g.crownRiseM.toFixed(1)} m of crown over the eaves in 3DBAG`, 'cornice');
    if (f0.cornice === undefined) set('fronts/0/cornice', fam('cornice')?.value ?? 'simple', 'family', 'cornice for the clamped crown');
  }
  if (f0.bands === 'speklagen' || f0.bands === 'courses') {
    const pr = spec.provenance['fronts/0/bands'];
    const fromStated = fills.some(x => x.path === 'fronts/0/bands' && x.source === 'stated');
    if (fromStated && pr && pr.confidence < PATTERN_MIN_CONFIDENCE) {
      drop('fronts/0/bands', 'pattern-confidence', `a whole-wall ${f0.bands} pattern read at confidence ${pr.confidence} (< ${PATTERN_MIN_CONFIDENCE}: the reader marked bands low)`);
      delete f0.speklagen; if (fills.some(x => x.path === 'palette/band' && x.source === 'family')) delete palette.band;
    }
  }
  if (Number.isInteger(f0.doorBay)) {
    const n = Array.isArray(f0.bays) ? f0.bays[0] : f0.bays;
    if (Number.isInteger(n) && f0.doorBay > n - 1) drop('fronts/0/doorBay', 'door-in-front', `door bay ${f0.doorBay} past the last of ${n} bays`, n - 1);
  }

  // Validate; a problem drops the optional part it names (a required one is refilled from the family) and the rest compiles.
  const id = input.id ?? `rc-${spec.pandId}`;
  const build = () => ({
    schemaVersion: 1, kind: 'canal-house', id, pandId: spec.pandId, address: spec.address ?? spec.pandId,
    sources: intentSources(spec), fronts: [f0, ...((design.fronts ?? []).slice(1))], roof, palette,
    ...(design.notes ? { notes: design.notes } : {}),
  });
  const REQUIRED: Record<string, string> = { gable: 'levelGable', cornice: 'cornice', windows: 'windows', hoist: 'hoist', basement: 'basement' };
  let intent: CanalHouseIntent | null = null, error: string | null = null;
  for (let round = 0; round < 8 && !intent; round++) {
    try { intent = validateIntent(build()); error = null; } catch (e) {
      error = (e as Error).message;
      const named = [...error.matchAll(/front front0\.([a-zA-Z]+)|palette\.([a-zA-Z]+)|roof\.([a-zA-Z]+)/g)].map(m => m[1] ? `fronts/0/${m[1]}` : m[2] ? `palette/${m[2]}` : `roof/${m[3]}`);
      const path = named.find(p => has(p));
      if (!path) break;
      const key = path.split('/').pop()!, line = error.split('\n').find(l => l.includes(`.${key}`))?.trim() ?? error.split('\n')[1];
      if (REQUIRED[key] && path.startsWith('fronts/0/')) {
        const v = fam(REQUIRED[key]);
        if (!v || JSON.stringify(v.value) === JSON.stringify(f0[key])) { drops.push({ path, value: f0[key], gate: 'validate', why: line }); break; }
        drop(path, 'validate', line, v.value);
      } else drop(path, 'validate', line);
    }
  }
  for (const gap of input.answer?.gaps ?? []) if (!limits.some(l => l.component === gap.component && l.what === gap.what)) limits.push(gap);
  for (const ig of ignored) limits.push({ component: ig.path.split('/').pop()!, what: `read ${JSON.stringify(ig.value)}, drawn ${JSON.stringify(ig.drawnAs)}` });
  return { pandId: spec.pandId, intent, candidate: build(), family, fills, drops, ignored, limits, cOnly: cOnlyFields(spec), error: intent ? null : error };
}
