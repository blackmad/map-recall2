/**
 * House rows: the one adapter from lane D's RowRecord to lane P's `RowCheckRow` (houseSpec/rowChecks.ts), written by
 * `house:rows` as `<row>.row-check.json` next to the record. Pure.
 *
 * Per front: the series design flattened to comparable fields (plus the per-house ground fields), the cornice line in
 * the street datum, the roof from the series, the extras, and the fate of every field the D1 reader stated: `drawn`
 * (the drawn value is the read one), `settled` (the series overruled it), `reported` (read, not drawn, with the reason).
 * A held front (scaffold) reports every read field as held.
 */
import type { DescriberAnswer } from '../describer.ts';
import type { FieldFate, RowCheckMember, RowCheckRow } from '../rowChecks.ts';
import { frontDesign, type RowRecord } from './types.ts';
import { ROW_EXTRAS_DEFAULT } from './solve.ts';

/** The reader's fields P accounts for (check-rows.ts READ_FIELDS) and the row fields (overruled / not-drawn keys) each maps to. */
export const READ_FIELD_MAP: Readonly<Record<string, string[]>> = {
  storeyParts: ['storeys', 'roofKind'], bays: ['bays'], windows: ['windows'], heads: ['heads'], bands: ['bands'], windowSurround: ['heads'],
  sills: ['sills'], crown: ['crown', 'roofKind'], cornice: ['cornice'], finish: ['wall'], whiteFrames: ['whiteFrames'], dormers: ['dormers'],
  balconies: ['balconies'], bayWindow: ['bayWindow'], doorSurround: ['doorSurround'], wallFamily: ['wall'],
};
const isRead = (v: unknown) => v != null && v !== 'not-visible' && v !== 'none' && v !== false && !(Array.isArray(v) && !v.length)
  && !(typeof v === 'object' && !Array.isArray(v) && (v as { count?: number }).count === 0);

export function toRowCheck(row: RowRecord, answers: Readonly<Record<string, DescriberAnswer | null | undefined>>, staged: ReadonlySet<string>): RowCheckRow {
  const members: RowCheckMember[] = row.fronts.map(f => {
    const d = frontDesign(row, f);
    const rs = d.roofStorey.value;
    const fields: RowCheckMember['fields'] = {};
    const a = answers[f.pandId];
    if (a) for (const [k, rowKeys] of Object.entries(READ_FIELD_MAP)) {
      const v = (a as unknown as Record<string, unknown>)[k];
      if (!isRead(v)) continue;
      if (f.readHeld) { fields[k] = { fate: 'reported', reason: `held: ${f.readHeld}` }; continue; }
      const over = row.overruled.find(o => (o.front === f.id || o.front === f.pandId) && rowKeys.includes(String(o.field)));
      const nd = row.readNotDrawn.find(r => r.front === f.pandId && (rowKeys.includes(r.field) || r.field === k));
      let fate: FieldFate = 'drawn', reason: string | undefined;
      if (over) { fate = 'settled'; reason = `${over.field} read ${JSON.stringify(over.read)}, drawn ${JSON.stringify(over.drawn)}: ${over.by}, ${over.why}`; }
      else if (nd) { fate = 'reported'; reason = nd.reason; }
      else if (k === 'wallFamily' || k === 'finish') { fate = 'settled'; reason = `wall: one judged family per series (${d.wall.value.family}, ${d.wall.source})`; }
      fields[k] = { fate, ...(reason ? { reason } : {}) };
    }
    const line = d.corniceTopM.value;
    return {
      key: f.id, pandId: f.pandId, numbers: f.numbers.map(String), series: f.seriesId,
      design: {
        crown: d.crown.value, cornice: d.cornice.value, storeys: d.storeys.value, bays: d.bays.value, windows: d.windows.value,
        head: `${d.heads.value.shape}/${d.heads.value.dressing}${d.heads.value.storeys ? `@${d.heads.value.storeys.join(',')}` : ''}`,
        whiteFrames: d.whiteFrames.value, sills: d.sills.value, wallMaterial: d.wall.value.material, wallFamily: d.wall.value.family, wall: d.wall.value.hex,
        roofStorey: rs.kind, dormers: rs.dormersPerFront, dormerKind: rs.dormerKind ?? null,
        // Per-house fields (ground use, door side, shop paint, basement) are not the design: they stay on the RowRecord front
        // (`ground`). P's kinker-100-104-identical regression compares `design` whole, so they are left out here.
      },
      corniceM: line,
      roof: { kind: rs.kind === 'none' ? 'lid' : rs.kind, source: 'series', dormers: rs.dormersPerFront, ...(rs.dormerKind ? { dormerKind: rs.dormerKind } : {}), gable: d.crown.value === 'cornice' ? null : d.crown.value },
      extras: [...d.extras.value],
      // Extras the reading states (bands): allowed beside ROW_FRONT_EXTRAS.
      statedExtras: d.extras.value.filter(x => !ROW_EXTRAS_DEFAULT.includes(x)),
      fields,
      staged: staged.has(f.pandId),
      ...(f.readHeld ? { scaffold: true } : {}),
    };
  });
  return { row: row.id, members };
}
