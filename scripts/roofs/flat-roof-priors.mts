/**
 * Lane R5-E (#265) step 2: the period priors for unmeasured flat roofs, measured. Over every roof-facts reading
 * (PDOK orthophoto, Beeldmateriaal Nederland, CC BY 4.0) whose slot is a flat one, joined to its build year from the
 * bag-tiles, per build-year band: the count, the slot shares, the per-channel median of the measured colour (cast
 * removed) and of the display colour the runtime draws (`roofSlotHex`). The bands' display medians are the priors in
 * `look/palette.ts` FLAT_ROOF_PERIOD_PRIORS.
 *
 *   npx tsx scripts/roofs/flat-roof-priors.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { decodeRoofFactTile, roofSlotHex, type RoofFactTile } from '../../src/canalRecall/roofs/roofSlots.ts';
import { ROOF_SLOT_TONES, hexToRgb, lumaOf, rgbToHex, type RGB } from '../../src/canalRecall/look/palette.ts';
import { FLAT_ROOF_BANDS, flatRoofBand } from '../../src/canalRecall/roofs/flatRoofTone.ts';

const FACTS = path.resolve('public/data/extracts/amsterdam/roof-facts/14');
const TILES = path.resolve('public/data/extracts/amsterdam/bag-tiles/14');
type Acc = { n: number; slots: Record<string, number>; measured: RGB[]; display: RGB[] };
const acc = new Map<string, Acc>();
let flatTotal = 0, lowConf = 0;
for (const x of fs.readdirSync(FACTS).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(FACTS, x)).filter(n => n.endsWith('.json.gz'))) {
  const facts = decodeRoofFactTile(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(FACTS, x, file))).toString('utf8')) as RoofFactTile);
  const tile = path.join(TILES, x, file.replace('.json.gz', '.geojson.gz'));
  const years = new Map<string, number | null>();
  if (fs.existsSync(tile)) for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(tile)).toString('utf8')).features) years.set(String(f.properties.id).replace('NL.IMBAG.Pand.', ''), f.properties.year ?? null);
  for (const [id, fact] of facts) {
    if (ROOF_SLOT_TONES[fact.slot].cell !== 'flat' || fact.slot === 'glass' || fact.slot === 'solar' || fact.slot === 'terrace') continue;
    flatTotal++;
    const band = flatRoofBand(years.get(id) ?? null);
    const a = acc.get(band) ?? { n: 0, slots: {}, measured: [], display: [] };
    a.n++; a.slots[fact.slot] = (a.slots[fact.slot] ?? 0) + 1; a.measured.push(fact.rgb); a.display.push(hexToRgb(roofSlotHex(fact.slot, fact.rgb)));
    acc.set(band, a);
    if (fact.confidence < 0.35) lowConf++;
  }
}
const med = (cs: RGB[]): RGB => [0, 1, 2].map(k => { const v = cs.map(c => c[k]).sort((a, b) => a - b); return v[v.length >> 1]; }) as RGB;
const out: Record<string, unknown> = {};
for (const name of [...FLAT_ROOF_BANDS.map(b => b.name), 'unknown']) {
  const a = acc.get(name); if (!a) continue;
  const m = med(a.measured), d = med(a.display);
  const ys = a.measured.map(c => lumaOf(c)).sort((p, q) => p - q), q = (f: number) => Math.round(ys[Math.floor(f * (ys.length - 1))]);
  const shares = Object.fromEntries(Object.entries(a.slots).sort((p, q) => q[1] - p[1]).map(([k, v]) => [k, +(v / a.n).toFixed(3)]));
  out[name] = { n: a.n, measured: rgbToHex(m), measuredLuma: Math.round(lumaOf(m)), display: rgbToHex(d), displayLuma: Math.round(lumaOf(d)), lumaP25: q(0.25), lumaP50: q(0.5), lumaP75: q(0.75), shares };
}
console.log(JSON.stringify({ flatReadings: flatTotal, belowMinConfidence: lowConf, bands: out }, null, 1));
