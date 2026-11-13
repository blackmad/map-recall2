/**
 * Lane C-completer (2026-11-13): the build-year family defaults route C fills a field from when no reading, twin or
 * structure prior states it (src/canalRecall/houseSpec/complete.ts, the last rung of its ladder).
 *
 * The table is measured, not chosen: per build-year family (PR1's families, scripts/house-line/structure/paired.ts), the
 * most common value (categorical) or the median (numeric) of each field over the published HouseSpecs whose field comes
 * from a photo source (`author`, `reviewed`, `streetlevel-measured`: hand specs, block faces, belt builders). Build years
 * are BAG's (bag-facts mid descriptor). Each entry keeps its n and the winner's share, so a reviewer sees how settled it is.
 *
 *   node --import tsx scripts/house-line/route-c/family-defaults.ts [--write]
 *
 * --write: src/canalRecall/houseSpec/family-defaults.json (else prints the table).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { FAMILIES, familyOf, RAISED_GABLES } from '../../../src/canalRecall/houseSpec/families.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const PHOTO = new Set(['author', 'reviewed', 'streetlevel-measured']);
const readGz = (f: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());

type Bag = Record<string, number[]>;
const bagCache = new Map<string, Bag>();
const bagOf = (tile: string): Bag => {
  if (!bagCache.has(tile)) {
    const f = path.join(EXTRACT, 'bag-facts/14', `${tile}.json.gz`);
    bagCache.set(tile, fs.existsSync(f) ? readGz(f).pands : {});
  }
  return bagCache.get(tile)!;
};

/** Per family, per field: the observed values. */
const obs = new Map<string, Map<string, unknown[]>>();
const push = (fam: string, field: string, v: unknown) => {
  if (v === undefined || v === null) return;
  if (!obs.has(fam)) obs.set(fam, new Map());
  const m = obs.get(fam)!;
  if (!m.has(field)) m.set(field, []);
  m.get(field)!.push(v);
};

let houses = 0;
for (const x of fs.readdirSync(path.join(EXTRACT, 'house-specs/14'))) {
  for (const yf of fs.readdirSync(path.join(EXTRACT, 'house-specs/14', x))) {
    const tile = `${x}/${yf.replace('.json.gz', '')}`;
    const t = readGz(path.join(EXTRACT, 'house-specs/14', x, yf));
    for (const [id, b] of Object.entries<any>(t.buildings)) {
      const s: Record<string, string> = b.s ?? {}, d = b.d ?? {}, f0 = d.fronts?.[0] ?? {};
      const photo = (p: string) => PHOTO.has(s[p]);
      if (!photo('fronts/0/gable') && !photo('fronts/0/storeys')) continue;
      const year = bagOf(tile)[id.replace('NL.IMBAG.Pand.', '')]?.[5] || null;
      const fams = ['all', familyOf(year)];
      houses++;
      for (const fam of fams) {
        if (photo('fronts/0/gable')) {
          push(fam, 'gable', f0.gable);
          if (RAISED_GABLES.includes(f0.gable)) push(fam, 'raisedGable', f0.gable); else push(fam, 'levelGable', f0.gable);
        }
        for (const k of ['cornice', 'windows', 'hoist', 'basement']) if (photo(`fronts/0/${k}`)) push(fam, k, f0[k]);
        if (photo('fronts/0/doorBay') && Number.isInteger(f0.doorBay) && (Number.isInteger(f0.bays) || Array.isArray(f0.bays))) {
          const bays = Array.isArray(f0.bays) ? f0.bays[0] : f0.bays;
          push(fam, 'doorSide', bays <= 1 ? 'only' : f0.doorBay === 0 ? 'left' : f0.doorBay === bays - 1 ? 'right' : 'inner');
        }
        if (photo('roof/material')) push(fam, 'roofMaterial', d.roof?.material);
        if (photo('palette/frame')) push(fam, 'frame', d.palette?.frame);
        if (photo('palette/door')) push(fam, 'door', d.palette?.door);
        if (photo('palette/brick') && /^#[0-9a-f]{6}$/i.test(d.palette?.brick ?? '')) push(fam, 'brick', d.palette.brick.toLowerCase());
        if (photo('fronts/0/speklagen') && f0.speklagen) {
          push(fam, 'speklagenSpacing', f0.speklagen.spacing);
          push(fam, 'speklagenCourses', f0.speklagen.courses ?? 2);
          if (photo('palette/band') && d.palette?.band) push(fam, 'speklagenBand', d.palette.band.toLowerCase());
        }
        if (photo('fronts/0/bands') && f0.bands === 'courses' && photo('palette/band') && d.palette?.band) push(fam, 'coursesBand', d.palette.band.toLowerCase());
        if (photo('fronts/0/shopfront') && f0.shopfront) {
          push(fam, 'shopColour', f0.shopfront.colour?.toLowerCase());
          push(fam, 'shopFascia', f0.shopfront.fascia);
        }
        if (photo('fronts/0/souterrain') && f0.souterrain) push(fam, 'souterrainBasement', f0.basement);
      }
    }
  }
}

const mode = (vs: unknown[]) => {
  const c = new Map<string, number>();
  for (const v of vs) c.set(JSON.stringify(v), (c.get(JSON.stringify(v)) ?? 0) + 1);
  const [k, n] = [...c].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  return { value: JSON.parse(k), n: vs.length, share: +(n / vs.length).toFixed(3) };
};
const median = (vs: number[]) => { const s = [...vs].sort((a, b) => a - b); return { value: s[Math.floor(s.length / 2)], n: s.length, share: null }; };
/** The medoid of the hex colours (the observed colour nearest all the others in RGB): a real colour, never a muddled mean. */
const medoidHex = (vs: string[]) => {
  const hex = vs.filter(v => /^#[0-9a-f]{6}$/i.test(v));
  if (!hex.length) return mode(vs);
  const rgb = (v: string) => [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
  const pts = hex.map(rgb), uniq = [...new Set(hex)];
  let best = uniq[0], bestD = Infinity;
  for (const u of uniq) {
    const q = rgb(u); let d = 0;
    for (const p of pts) d += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (d < bestD) { bestD = d; best = u; }
  }
  return { value: best, n: hex.length, share: null };
};
const NUMERIC = new Set(['speklagenSpacing']), HEX = new Set(['brick', 'door', 'speklagenBand', 'coursesBand', 'shopColour']);

const table: Record<string, Record<string, { value: unknown; n: number; share: number | null }>> = {};
for (const fam of ['all', ...FAMILIES.map(f => f.id)]) {
  const m = obs.get(fam);
  if (!m) continue;
  table[fam] = {};
  for (const [field, vs] of [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    table[fam][field] = NUMERIC.has(field) ? median(vs as number[]) : HEX.has(field) ? medoidHex(vs as string[]) : mode(vs);
  }
}
const out = { v: 1, generated: 'scripts/house-line/route-c/family-defaults.ts', from: `${EXTRACT}/house-specs/14 (photo sources) x bag-facts years`, houses, families: FAMILIES.map(f => ({ id: f.id, from: f.from, to: f.to })), table };
if (process.argv.includes('--write')) {
  fs.writeFileSync('src/canalRecall/houseSpec/family-defaults.json', JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote src/canalRecall/houseSpec/family-defaults.json (${houses} houses)`);
} else console.log(JSON.stringify(out, null, 1));
