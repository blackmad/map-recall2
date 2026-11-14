/**
 * House rows: the solved row as the renderer's records and as HouseSpecs (lane D, #386). Pure.
 *
 *  - `rowFrontRecords`: one `RowFrontRecord` (houseLine/rowFront.ts, lane R's type) per pand: the wall top at the series
 *    cornice line in the pand's datum, a cornice crown, storeys and bays, and `subFronts` for a two-front pand. The
 *    wall colour is NOT carried there (RowFrontRecord.wall takes a reviewed or strip-measured hex; the row's colour is a
 *    judged family): the renderer reads it from the row record's series (`series[].design.wall`).
 *  - `rowSpec`: the HouseSpec of a pand: the face spec (houseSpec/fromFace.ts, one receipt per field) or an empty spec,
 *    with the series design written over it field by field, each with its row source as the receipt. A held front's
 *    reading contributes nothing.
 */
import type { RowFrontRecord } from '../../houseLine/rowFront.ts';
import { BASEMENTS } from '../../buildingRecipe/intent.ts';
import { emptySpec, setSpecField, type HouseSpec, type Prov, type SpecSource } from '../spec.ts';
import { JUDGED_PALETTE, JUDGED_RULING, type WallJudgedFact } from '../judgedColour.ts';
import { headsList } from './solve.ts';
import { frontDesign, type RowDesign, type RowField, type RowFieldSource, type RowRecord } from './types.ts';

/** Row source -> the spec receipt's source and confidence. */
export const ROW_PROV: Readonly<Record<RowFieldSource, { source: SpecSource; confidence: number }>> = {
  reviewed: { source: 'reviewed', confidence: 0.9 },
  'face-intent': { source: 'streetlevel-measured', confidence: 0.85 },
  'series-consensus': { source: 'vision-judge', confidence: 0.75 },
  'single-read': { source: 'vision-judge', confidence: 0.6 },
  'period-default': { source: 'default', confidence: 0.3 },
};
const CONF: Record<RowFieldSource, number> = { reviewed: 0.9, 'face-intent': 0.9, 'series-consensus': 0.7, 'single-read': 0.5, 'period-default': 0.3 };

export function rowFrontRecords(row: RowRecord): RowFrontRecord[] {
  return row.members.map(m => {
    const fronts = m.fronts.map(id => row.fronts.find(f => f.id === id)!);
    const designs = fronts.map(f => frontDesign(row, f));
    const d = designs[0], f0 = fronts[0];
    const sources: Record<string, string> = { record: `house-rows ${row.id} ${f0.seriesId}`, eaves: `${d.corniceTopM.source}: ${d.corniceTopM.ref}` };
    const rec: RowFrontRecord = {
      pandId: m.pandId, ...(row.face ? { face: row.face } : {}),
      topM: f0.topM, eavesM: f0.topM, crown: { family: d.crown.value === 'cornice' ? 'cornice' : d.crown.value },
      storeys: d.storeys.value, bays: designs.reduce((n, x) => n + x.bays.value, 0),
      confidence: Math.min(CONF[d.corniceTopM.source], CONF[d.storeys.source]), sources,
    };
    if (fronts.length > 1) rec.subFronts = fronts.map((f, i) => ({ a0: f.sub!.a0, a1: f.sub!.a1, eavesM: f.topM, topM: f.topM, crown: { family: designs[i].crown.value === 'cornice' ? 'cornice' : designs[i].crown.value } }));
    return rec;
  });
}

const prov = (fl: RowField<unknown>, at: string): Prov => ({ ...ROW_PROV[fl.source], ref: `house-rows: ${fl.ref}`, at });
const WINDOWS_DRAWN: Record<string, string> = { 'tall-upper': 't-window' };

/** The pand's HouseSpec from its row. `base` is the face spec (specFromFace) or undefined. */
export function rowSpec(row: RowRecord, pandId: string, base: HouseSpec | undefined, at: string): HouseSpec | null {
  const m = row.members.find(x => x.pandId === pandId);
  if (!m) return null;
  const fronts = m.fronts.map(id => row.fronts.find(f => f.id === id)!);
  const spec: HouseSpec = base ? structuredClone(base) : emptySpec(pandId);
  if (!spec.address) spec.address = m.label;
  const put = (p: string, v: unknown, fl: RowField<unknown>) => { setSpecField(spec, p, v); spec.provenance[p] = prov(fl, at); };
  fronts.forEach((f, i) => {
    const d: RowDesign = frontDesign(row, f);
    const P = `fronts/${i}/`;
    put(P + 'storeys', d.storeys.value, d.storeys);
    put(P + 'bays', d.bays.value, d.bays);
    put(P + 'gable', d.crown.value, d.crown);
    if (d.cornice.value !== 'none' || d.crown.value === 'cornice') put(P + 'cornice', d.cornice.value === 'none' ? 'simple' : d.cornice.value, d.cornice);
    put(P + 'windows', WINDOWS_DRAWN[d.windows.value] ?? d.windows.value, d.windows);
    const [h, ...more] = headsList(d.heads.value);
    for (const x of more) {
      // A second head group: round heads under arch rings on their storeys (windowHead), a lintel dressing (windowSurround).
      if (x.dressing === 'arch-ring' || x.shape === 'round') put(P + 'windowHead', { kind: 'round', ...(x.storeys ? { storeys: x.storeys } : {}), ...(x.dressing === 'arch-ring' ? { archRing: { colour: 'stone', style: 'solid', keystone: true } } : {}) }, d.heads);
    }
    if (h.dressing === 'segmental-tympanum') put(P + 'windowHead', { kind: 'segmental', tympanum: 'stone', ...(h.storeys ? { storeys: h.storeys } : {}) }, d.heads);
    else if (h.dressing === 'keystone') put(P + 'windowHead', { kind: h.shape === 'relieving' ? 'flat' : h.shape, archRing: { colour: 'stone', style: 'none', keystone: true } }, d.heads);
    else if (h.dressing === 'block-course') { put(P + 'bands', 'painted', d.heads); put(P + 'bandLines', ['head'], d.heads); put(P + 'bandHeights', { head: 0.3 }, d.heads); }
    else if (h.dressing === 'jack-blocks' || h.dressing === 'dentil-lintel' || h.dressing === 'stone-lintel') put(P + 'windowSurround', h.dressing, d.heads);
    if (d.sills.value && h.dressing === 'none') put(P + 'windowSurround', 'sill', d.sills);
    // Per-house ground the read states and the face does not (a souterrain with a stoop, Weteringschans).
    // Per-house ground the read states (no face spec): the door's opening index, the ground kind.
    if (!base && f.ground.doorIndex !== undefined) put(P + 'doorBay', f.ground.doorIndex, { value: f.ground.doorIndex, source: 'single-read', ref: `${f.pandId} reading: doorIndex ${f.ground.doorIndex} (door ${f.ground.doorSide ?? '?'})` });
    if (!base && i === 0 && f.ground.use !== 'other') {
      const g: RowField<unknown> = { value: f.ground.use, source: 'single-read', ref: `${f.pandId} reading: ground ${f.ground.use}` };
      put('facts/pui', f.ground.use === 'dwelling' || f.ground.use === 'door-only' ? 'residential' : f.ground.use === 'warehouse' ? 'warehouse' : 'shop', g);
      put('facts/groundKind', f.ground.use === 'dwelling' ? 'dwelling' : f.ground.use === 'door-only' ? 'door-only' : f.ground.use === 'warehouse' ? 'warehouse' : 'shop', g);
    }
    const bm = f.ground.basement;
    if (!base && bm && bm !== 'none') {
      const g: RowField<unknown> = { value: bm, source: 'single-read', ref: `${f.pandId} reading: basement ${bm}` };
      if ((BASEMENTS as readonly string[]).includes(bm)) put(P + 'basement', bm, g);
      put(P + 'souterrain', true, g);
    }
    const rs = d.roofStorey.value;
    put(P + 'roofStorey', rs.kind, d.roofStorey);
    if (rs.dormersPerFront > 0) {
      put(P + 'dormers', rs.dormersPerFront, d.roofStorey);
      put(P + 'dormerStyle', rs.dormerKind === 'pediment' ? 'pediment' : 'plain', d.roofStorey);
      put(P + 'readDormers', { count: rs.dormersPerFront, kind: rs.dormerKind === 'plain' ? 'plain' : 'gabled' }, d.roofStorey);
      if (rs.hoist) put(P + 'hoist', true, d.roofStorey);
    } else if (base) {
      const fr = (spec.design.fronts?.[i] ?? {}) as Record<string, unknown>;
      for (const k of ['dormers', 'dormerStyle', 'dormerBody', 'dormerSize']) if (k in fr) { delete fr[k]; delete spec.provenance[P + k]; }
    }
  });
  // Wall: the series' judged family and its one tone; any sampled hex in the base is replaced.
  const d0 = frontDesign(row, fronts[0]);
  const w = d0.wall.value;
  put('palette/wallMaterial', w.material, d0.wall);
  put('palette/brick', w.hex, d0.wall);
  put('facts/wallFamily', JUDGED_PALETTE[w.family].wallFamily, d0.wall);
  const fact: WallJudgedFact = { v: 1, source: 'judged', family: w.family, hex: w.hex, by: d0.wall.source === 'face-intent' ? 'words' : d0.wall.source === 'period-default' ? 'era' : 'neighbours',
    why: `house-rows series ${fronts[0].seriesId}: ${d0.wall.source} (${d0.wall.ref})`, ruling: JUDGED_RULING, ...(m.built ? { year: m.built } : {}) };
  put('facts/wallJudged', fact, d0.wall);
  for (const k of ['facts/wallSample', 'facts/wallExposure']) {
    const [, key] = k.split('/');
    if (spec.facts && key in spec.facts) { delete (spec.facts as Record<string, unknown>)[key]; delete spec.provenance[k]; }
  }
  const notes = ((spec.design as { notes?: string[] }).notes ?? []).filter(n => !n.startsWith('house-rows'));
  if (!spec.provenance['notes'] && !spec.provenance['']) spec.provenance['notes'] = { source: 'default', confidence: 0.3, ref: `house-rows ${row.id}`, at };
  (spec.design as { notes?: string[] }).notes = [...notes, `house-rows ${row.id}: series ${[...new Set(fronts.map(f => f.seriesId))].join(', ')}`];
  return spec;
}
