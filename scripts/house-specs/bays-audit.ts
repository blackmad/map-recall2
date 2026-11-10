// The H1c source-bay audit (#350, docs/house-line.md §1 "Which sources over-count bays"): every source's stated bays
// against the photo's window columns on the H4 crop archive (map-recall2-source-data pand-crops/, eba1f2132).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import jpeg from 'jpeg-js';
import { validateBlockFace } from '../../src/canalRecall/blockFace/intent.ts';
import { fromBlockFace, fromRecipeIntent, jevBays, registerBays, type BaySource } from '../../src/canalRecall/houseSpec/adapters.ts';
import { frontBays } from '../../src/canalRecall/houseSpec/spec.ts';
import { measureFacade, MEASURE_PROFILES } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { blurRgb, storeyLines, PRE_BLUR_PX } from '../../src/canalRecall/houseSpec/previewVerdict.ts';

export const HELP = `bays-audit: each bay source's stated bays vs the photo's window columns (H1c, #350).

  npx tsx scripts/house-specs/bays-audit.ts [--archive <source-data checkout>] [--jev <jev-cache dir>] [--json <out>]
                                            [--rows] [--old-adapters]

Photo columns: the hand grid in scripts/house-specs/bays-audit-photo.json (archive crops) and bays-gate-photo.json
(staging/pand-reference crops) where a pand has one, else measureFacade (houseLine profile, pre-blur ${PRE_BLUR_PX} px)
on <archive>/pand-crops/<pand>/front.jpg ("meter"). The meter is validated against the hand grid first and its
agreement is printed. Sources: block-face intents, recipe intents (canal-house), hand specs, house records (facade-twin,
staging only), the register text (RCE descriptions, "drie vensterassen"/"vier traveeën", registerBays) and Jev
(the H5 cache, jevBays). Per source: n, exact, over, under, mean signed error (stated - photo).
--old-adapters reports the sources as they were before H1c's adapter fixes (bays as stated, no width check).
--rows prints one line per pand and source.`;
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ARCHIVE = arg('archive', process.env.HOUSE_CROPS_ARCHIVE ?? path.resolve(ROOT, '../../map-recall2-source-data-h4'))!;
const JEV = arg('jev', path.resolve(ROOT, '../../map-recall2-source-data-h5/jev-cache'))!;
const old = process.argv.includes('--old-adapters');
const json = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

// --- photo truth ---------------------------------------------------------------------------------------------------
const hand: Record<string, number | null> = {
  ...json(path.join(ROOT, 'scripts/house-specs/bays-gate-photo.json')).photo,
  ...(fs.existsSync(path.join(ROOT, 'scripts/house-specs/bays-audit-photo.json')) ? json(path.join(ROOT, 'scripts/house-specs/bays-audit-photo.json')).photo : {}),
};
const crops = new Map<string, { file: string; w: number; h: number; ppm: number }>();
const cropDir = path.join(ARCHIVE, 'pand-crops');
for (const id of fs.existsSync(cropDir) ? fs.readdirSync(cropDir) : []) {
  const meta = path.join(cropDir, id, 'front.json');
  if (!fs.existsSync(meta)) continue;
  const m = json(meta);
  if (!m.usable || !m.crop) continue;
  crops.set(id, { file: path.join(cropDir, id, 'front.jpg'), w: m.crop.wallWidthM, h: m.crop.wallHeightM, ppm: m.crop.pixelsPerMetre });
}
for (const id of Object.keys(hand)) {
  const ref = path.join(ROOT, 'staging/pand-reference', id);
  if (crops.has(id) || !fs.existsSync(path.join(ref, 'reference.json'))) continue;
  const c = json(path.join(ref, 'reference.json')).primary?.crop;
  if (c) crops.set(id, { file: path.join(ref, 'front.jpg'), w: c.wallWidthM, h: c.wallHeightM, ppm: c.pixelsPerMetre });
}
const meterCache = new Map<string, number | null>();
function meter(id: string): number | null {
  if (meterCache.has(id)) return meterCache.get(id)!;
  const c = crops.get(id);
  let v: number | null = null;
  if (c && fs.existsSync(c.file)) {
    const d = jpeg.decode(fs.readFileSync(c.file), { useTArray: true });
    const rgb = new Uint8Array(d.width * d.height * 3);
    for (let i = 0; i < d.width * d.height; i++) { rgb[i * 3] = d.data[i * 4]; rgb[i * 3 + 1] = d.data[i * 4 + 1]; rgb[i * 3 + 2] = d.data[i * 4 + 2]; }
    const topM = d.height / c.ppm, wM = d.width / c.ppm, edge = Math.min(0.2, wM / 4);
    const m = measureFacade({ image: { width: d.width, height: d.height, rgb: blurRgb(rgb, d.width, d.height, PRE_BLUR_PX), ppm: c.ppm, topM }, box: { u0: edge, u1: wM - edge, v0: 0, v1: topM }, lines: storeyLines(topM), openingSplit: MEASURE_PROFILES.houseLine });
    v = (process.argv.includes("--meter-windows") ? m.windowColumns : m.columns) ?? null;
  }
  meterCache.set(id, v);
  return v;
}
const photoOf = (id: string): { v: number; how: 'hand' | 'meter' } | null => {
  if (id in hand) return hand[id] === null ? null : { v: hand[id]!, how: 'hand' };
  const m = meter(id);
  return m === null ? null : { v: m, how: 'meter' };
};

// --- sources -------------------------------------------------------------------------------------------------------
type Row = { pand: string; source: BaySource; stated: number; raw?: unknown; ref: string; widthM?: number };
const rows: Row[] = [];
const wanted = new Set([...crops.keys()]);
const FACES = path.join(ROOT, 'scripts/block-face/faces');
for (const dir of fs.readdirSync(FACES).sort()) {
  const file = path.join(FACES, dir, 'intent.json');
  if (!fs.existsSync(file)) continue;
  let face; try { face = validateBlockFace(json(file)); } catch { continue; }
  for (const h of face.houses) {
    if (!wanted.has(h.pandId)) continue;
    const s = fromBlockFace(face, h.pandId);
    const f = s?.design.fronts?.[0], b = old ? rawBays(f) : frontBays(f);
    const auto = /^auto-place/.test(face.authoring?.author ?? ''), origin = h.design ? 'design' : h.type ? (h.type.overrides && 'bays' in h.type.overrides ? 'type+bays' : 'type') : 'sameAs';
    const cols = /columns (\d(?:\.\d+)?)/.exec(String((h as { rhythm?: { citation?: string } }).rhythm?.citation ?? ''))?.[1];
    const typeDefault = !old && (s?.provenance['fronts/0/axisGrid'] ?? s?.provenance['fronts/0/bays'])?.source === 'default';
    if (b) rows.push({ pand: h.pandId, source: typeDefault ? 'type-default' : 'block-face', stated: b, raw: f?.axisGrid ?? f?.bays, ref: `${dir} ${auto ? 'auto' : 'authored'}/${origin}${cols ? ` columns ${cols}` : ''} src=${s?.provenance['fronts/0/bays']?.source ?? s?.provenance['']?.source}` });
  }
}
const HOUSES = path.join(ROOT, 'scripts/building-recipes/houses');
for (const dir of fs.readdirSync(HOUSES).sort()) {
  const file = path.join(HOUSES, dir, 'intent.json');
  if (!fs.existsSync(file)) continue;
  const intent = json(file);
  if (!wanted.has(intent.pandId)) continue;
  const s = fromRecipeIntent(intent, path.relative(ROOT, file));
  const f = s?.design.fronts?.[0], b = old ? rawBays(f) : frontBays(f);
  if (b) rows.push({ pand: intent.pandId, source: 'recipe', stated: b, raw: f?.axisGrid ?? f?.bays, ref: dir });
}
const HAND_SPECS = path.join(ROOT, 'scripts/house-specs/specs');
for (const f of fs.existsSync(HAND_SPECS) ? fs.readdirSync(HAND_SPECS) : []) {
  const s = json(path.join(HAND_SPECS, f));
  const b = frontBays(s.design?.fronts?.[0]);
  if (b && wanted.has(s.pandId)) rows.push({ pand: s.pandId, source: 'author', stated: b, ref: f });
}
const twin = path.join(ROOT, 'public/data/extracts/amsterdam/staging/facade-twin');
let houseRecords = 0;
for (const area of fs.existsSync(twin) ? fs.readdirSync(twin) : []) {
  const file = path.join(twin, area, 'house-records.json');
  if (!fs.existsSync(file)) continue;
  for (const r of json(file).houses ?? []) { houseRecords++; const id = String(r.pandId).slice(-16); if (wanted.has(id) && Number.isInteger(r.bays?.value)) rows.push({ pand: id, source: 'house-record', stated: r.bays.value, ref: area }); }
}
const register = json(path.join(ROOT, 'public/data/extracts/amsterdam/monument-facts.json')).buildings as Record<string, unknown>;
const records = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'scripts/data/amsterdam-monument-register/records.json.gz'))).toString('utf8'));
let registerMentions = 0;
for (const r of records.rce as Array<{ monumentNumber: string; bagPandIds?: string[]; descriptions?: { text?: string }[] }>) {
  const text = (r.descriptions ?? []).map(d => d.text ?? '').join(' ');
  const b = registerBays(text);
  if (b) registerMentions++;
  for (const id of r.bagPandIds ?? []) if (b && wanted.has(id) && (r.bagPandIds!.length === 1 || old)) rows.push({ pand: id, source: 'register-text', stated: b.value, raw: b.phrase, ref: `rce:${r.monumentNumber}` });
}
void register;
let jevN = 0;
for (const f of fs.existsSync(JEV) ? fs.readdirSync(JEV).filter(f => f.endsWith('.json')) : []) {
  const j = json(path.join(JEV, f));
  const b = jevBays(j.answers?.bays);
  jevN++;
  if (b && j.pandId && wanted.has(j.pandId)) rows.push({ pand: j.pandId, source: 'vision-judge', stated: b.value, raw: b.p, ref: `jev-cache/${f}` });
}
function rawBays(f: Record<string, unknown> | undefined): number | undefined {
  if (!f) return undefined;
  if (Number.isInteger(f.axisGrid)) return f.axisGrid as number;
  const b = f.bays as number | number[] | undefined;
  return Array.isArray(b) ? Math.max(...b) : (b as number | undefined);
}

// --- meter validation, then the table ------------------------------------------------------------------------------
const both = Object.entries(hand).filter(([id, v]) => v !== null && crops.has(id)).map(([id, v]) => ({ id, hand: v!, meter: meter(id) }));
const mv = both.filter(r => r.meter !== null);
console.log(`meter vs hand grid: ${mv.length} of ${both.length} hand-counted crops measured, exact ${mv.filter(r => r.meter === r.hand).length}, mean |err| ${(mv.reduce((s, r) => s + Math.abs(r.meter! - r.hand), 0) / Math.max(1, mv.length)).toFixed(2)}`);
console.log(`crops ${crops.size}; house records on disk ${houseRecords}; register descriptions stating an axis count ${registerMentions}; jev answers ${jevN}`);
const out: Record<string, unknown>[] = [];
const sources: BaySource[] = ['block-face', 'type-default', 'recipe', 'author', 'house-record', 'register-text', 'vision-judge'];
console.log(['source', 'truth', 'n', 'exact', 'over', 'under', 'meanSigned', 'meanAbs'].join('\t'));
for (const truth of ['hand', 'any'] as const) for (const src of sources) {
  const rs = rows.filter(r => r.source === src).map(r => ({ ...r, photo: photoOf(r.pand) })).filter(r => r.photo && (truth === 'any' || r.photo.how === 'hand'));
  const e = rs.map(r => r.stated - r.photo!.v);
  const line = { source: src, truth, n: rs.length, exact: e.filter(x => x === 0).length, over: e.filter(x => x > 0).length, under: e.filter(x => x < 0).length, meanSigned: rs.length ? +(e.reduce((a, b) => a + b, 0) / rs.length).toFixed(2) : null, meanAbs: rs.length ? +(e.reduce((a, b) => a + Math.abs(b), 0) / rs.length).toFixed(2) : null };
  out.push(line);
  console.log(Object.values(line).join('\t'));
}
if (process.argv.includes('--rows')) for (const r of rows.sort((a, b) => a.pand.localeCompare(b.pand))) { const p = photoOf(r.pand); console.log([r.pand, r.source, r.stated, JSON.stringify(r.raw ?? null), p ? `${p.v} (${p.how})` : 'n/s', r.ref].join('\t')); }
const outFile = arg('json');
if (outFile) fs.writeFileSync(outFile, JSON.stringify({ table: out, rows: rows.map(r => ({ ...r, photo: photoOf(r.pand) })) }, null, 1));
