/**
 * House rows, lane R (issue #387): the round-1 row-front records, hand-built until lane D's `house:rows` lands.
 *
 *   node --import tsx scripts/house-line/row-front/round1-records.ts   -> src/canalRecall/houseLine/fixtures/rows-round1.json
 *
 * Kinkerstraat 86-110 from its face intent (scripts/block-face/faces/kinker-86-110/intent.json: type, crown, head
 * variants, modules, continuity.measuredEaves 14.2 m) and the strip's window rows (strip.jpg at 40 px/m, read by lane R:
 * sills 5.3/8.0/10.7 m, heads 7.3/10.0/12.7 m, ground top 5.0 m, street datum). Weteringschans 168096-171218 from the D1
 * answers (answers-ah07: crown, cornice, roof storey, dormer, bands, heads, souterrain) and the cornice line (3DBAG eaves
 * where no measurement exists; 171218 lane WG's 13.4 m). Each record names the source of every field in `sources`.
 *
 * The records are lane R's RowFrontRecord (houseLine/rowFront.ts) with `series`: install them with ROW_FRONT=1
 * ROW_FRONT_RECORDS=<this file>. Lane D's RowRecord -> RowFrontRecord adapter replaces this script.
 */
import fs from 'node:fs';
import path from 'node:path';
import { oklabToHex } from '../../../src/canalRecall/houseSpec/wallColour.ts';
import type { RowFrontRecord, RowHeadsDraw, RowSeriesDraw } from '../../../src/canalRecall/houseLine/rowFront.ts';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const FACE = path.join(REPO, 'scripts/block-face/faces/kinker-86-110');
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
/** judgedColour.ts JUDGED_PALETTE 'red-brown-brick' (lane d1-colour-judged): L 0.45, C 0.075, h 36 degrees. */
const tone = (L: number, C: number, hDeg: number) => oklabToHex([L, C * Math.cos(hDeg * Math.PI / 180), C * Math.sin(hDeg * Math.PI / 180)]);
const RED_BROWN = tone(0.45, 0.075, 36);
const r2 = (v: number) => Math.round(v * 100) / 100;

// --- Kinkerstraat 86-110 ------------------------------------------------------------------------------------------------
const intent = read(path.join(FACE, 'intent.json')), strip = read(path.join(FACE, 'strip.json'));
const streetNAP = strip.groundNAP as number;
const groundOffset = (pandId: string): number => {
  const f = path.join(FACE, 'pands', pandId, '3dbag.json');
  if (!fs.existsSync(f)) return 0;
  const m = /"b3_h_maaiveld":([0-9.]+)/.exec(fs.readFileSync(f, 'utf8'));
  return m ? r2(+m[1] - streetNAP) : 0;
};
const KINKER_ROWS = [{ sillM: 5.3, headM: 7.3 }, { sillM: 8.0, headM: 10.0 }, { sillM: 10.7, headM: 12.7 }];
const KINKER_GROUND_TOP = 5.0;
const headsOf = (o: any, a0: number, a1: number): RowHeadsDraw[] => {
  const wh = o?.windowHead;
  if (o?.bands === 'painted' && o?.bandLines?.includes('head')) return [{ a0, a1, shape: 'flat', dressing: 'block-course' }];
  if (wh?.kind === 'flat' && wh.archRing?.keystone) return [{ a0, a1, shape: 'flat', dressing: 'keystone' }];
  if (wh?.kind === 'segmental') return [{ a0, a1, shape: 'segmental', dressing: 'segmental-tympanum', storeys: wh.storeys }];
  return [];
};
const kinker: RowFrontRecord[] = [];
for (const h of intent.houses) {
  const span = strip.spans.find((s: any) => s.pandId.endsWith(h.pandId));
  const widthM = r2(span.x1M - span.x0M), off = groundOffset(h.pandId);
  const corner = h.type.crown === 'none';
  const mods: any[] = h.type.modules ?? [{}];
  const n = mods.length;
  const at = (v: number) => r2(v - off);
  const heads = mods.flatMap((m, i) => headsOf(m.overrides ?? h.type.overrides, i / n, (i + 1) / n));
  const series: RowSeriesDraw = corner
    ? { id: 'kinker-86-110:corner', cornice: 'bracketed', roofStorey: { kind: 'none', riseM: 0, dormers: [] }, heads }
    : { id: 'kinker-86-110:kinker-1890-plain-brick', cornice: 'heavy', roofStorey: { kind: 'mansard', riseM: 3.0, material: 'slate',
      dormers: mods.map((_, i) => ({ a: (i + 0.5) / n, kind: 'pediment' as const })) }, heads };
  const top = corner ? 13.6 : 14.2;
  const rec: RowFrontRecord = {
    pandId: h.pandId, face: 'kinker-86-110', topM: at(top), eavesM: at(top), crown: { family: 'cornice' }, confidence: 0.9,
    storeys: 4, bays: 3 * n, rows: KINKER_ROWS.map(r => ({ sillM: at(r.sillM), headM: at(r.headM) })), groundTopM: at(KINKER_GROUND_TOP), spanM: widthM,
    wall: { hex: RED_BROWN, source: 'reviewed', finish: 'brick' }, series,
    ...(n > 1 ? { subFronts: mods.map((_, i) => ({ a0: r2(i / n), a1: r2((i + 1) / n), wallHex: RED_BROWN })) } : {}),
    sources: {
      record: 'lane R round-1 fixture (scripts/house-line/row-front/round1-records.ts)',
      eaves: corner ? 'strip.jpg read by lane R: corner cornice top at strip rows 290-305 (13.6 m)' : 'kinker-86-110 intent.json continuity.measuredEaves (consoled cornice 14.1-14.4 m)',
      datum: `street ground ${streetNAP} NAP, pand ground offset ${off} m (3DBAG b3_h_maaiveld)`,
      rows: 'strip.jpg read by lane R at 40 px/m: sills 5.3/8.0/10.7, heads 7.3/10.0/12.7, ground top 5.0 (street datum)',
      series: corner ? 'intent crown none: flat top, no roof storey (the low roof box is read, not drawn)' : 'intent type kinker-1890-plain-brick, crown pediment-dormer (one per module); 3DBAG 16.9-17.1 m reads the mansard (rise 3.0 m)',
      heads: 'intent overrides (bands painted head line = block course; windowHead flat + keystone; segmental + tympanum storeys 1-2)',
      wall: "intent palette red-brown -> judgedColour.ts 'red-brown-brick' tone (one per series, no sampled hex)",
    },
  };
  kinker.push(rec);
}

// --- Weteringschans 168096-171218 --------------------------------------------------------------------------------------
type W = { id: string; top: number; topSrc: string; storeys: number; souterrain?: boolean; cornice: RowSeriesDraw['cornice']; mansard?: { rise: number; kind: 'pediment' | 'gabled' | 'plain'; hoist?: boolean };
  heads: RowHeadsDraw[]; extras: string[]; notDrawn: string[] };
const wet: W[] = [
  { id: '0363100012168096', top: 14.31, topSrc: '3DBAG eaves (no measured cornice)', storeys: 3, cornice: 'frieze', heads: [{ a0: 0, a1: 1, shape: 'flat', dressing: 'jack-blocks', storeys: [1] }], extras: ['floor-cornices'],
    notDrawn: ['frieze of small white panels under the cornice (kit gap)', 'basement windows'] },
  { id: '0363100012168042', top: 14.17, topSrc: '3DBAG eaves (no measured cornice)', storeys: 3, cornice: 'frieze', heads: [{ a0: 0, a1: 1, shape: 'flat', dressing: 'jack-blocks', storeys: [1] }], extras: [],
    notDrawn: ['frieze of small white panels under the cornice (kit gap)'] },
  { id: '0363100012169016', top: 14.3, topSrc: 'house spec eavesM 14.3', storeys: 3, souterrain: true, cornice: 'bracketed', mansard: { rise: 2.7, kind: 'pediment', hoist: true },
    heads: [{ a0: 0, a1: 1, shape: 'flat', dressing: 'jack-blocks', storeys: [1] }], extras: ['floor-cornices', 'string-courses'],
    notDrawn: ['white stone balustrade balcony on the centre first-storey axis (kit gap: no balustrade)', 'door surround with a pointed pediment (kit gap)'] },
  { id: '0363100012171218', top: 13.4, topSrc: 'lane WG measured eaves 13.4 (house-line.md storey plan)', storeys: 3, souterrain: true, cornice: 'bracketed', mansard: { rise: 3.25, kind: 'pediment' },
    heads: [{ a0: 0, a1: 1, shape: 'flat', dressing: 'stone-lintel', storeys: [1, 2] }], extras: ['speklagen'],
    notDrawn: ['top storey round-arched windows under raised white arch rings (kit gap: round heads on the row path)', 'ornate scrolled dormer drawn as a pediment dormer', 'stone aedicule over the door', 'balustraded balcony with urns', 'rough-stone souterrain with barred arched windows'] },
];
const weteringschans: RowFrontRecord[] = wet.map(w => ({
  pandId: w.id, face: 'weteringschans-168096-171218', topM: w.top, eavesM: w.top, crown: { family: 'cornice' }, confidence: 0.7, storeys: w.storeys,
  bays: 3, wall: { hex: RED_BROWN, source: 'reviewed', finish: 'brick' },
  series: { id: `weteringschans:${w.id}`, cornice: w.cornice, heads: w.heads, extras: w.extras, ...(w.souterrain ? { souterrain: true } : {}),
    roofStorey: w.mansard ? { kind: 'mansard', riseM: w.mansard.rise, material: 'slate', dormers: [{ a: 0.5, kind: w.mansard.kind, ...(w.mansard.hoist ? { hoist: true } : {}) }] } : { kind: 'none', riseM: 0, dormers: [] } },
  sources: {
    record: 'lane R round-1 fixture (scripts/house-line/row-front/round1-records.ts); a series of one: the four fronts are not one design',
    eaves: w.topSrc, read: 'D1 answers-ah07 (opus v4 cut)', wall: "finish brick, wallFamily not-visible -> judgedColour.ts 'red-brown-brick' (era default, one per series)",
    readNotDrawn: w.notDrawn.join('; '),
  },
}));

const out = path.join(REPO, 'src/canalRecall/houseLine/fixtures/rows-round1.json');
fs.writeFileSync(out, JSON.stringify({ note: 'House rows lane R round-1 row-front records (RowFrontRecord with series); generated by scripts/house-line/row-front/round1-records.ts', records: [...kinker, ...weteringschans] }, null, 1) + '\n');
console.log(`${kinker.length + weteringschans.length} records -> ${path.relative(REPO, out)} (wall ${RED_BROWN})`);
