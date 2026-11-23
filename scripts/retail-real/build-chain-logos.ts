/**
 * Chain table and logo pages (lane retail-real-20261115). From data/retail-ground/chains-counted.json and the logos
 * fetch-chain-logos.ts saved (data/retail-ground/chain-logos/<key>.png, provenance.json):
 *   - every counted chain that round 6 does not already template (Albert Heijn, Etos, ... keep theirs) and that has a
 *     logo or a type template, with its type template (templateForTags's type, else its OSM kind's), board and letter
 *     colours (data/retail-ground/chain-overrides.json first, else read off the logo), into retailChains.gen.ts;
 *   - the logos trimmed, each on a cell of its board colour, shelf-packed by size onto 512 px pages
 *     (data/retail-ground/chains-<n>.png; --publish copies them to public/canal-drive/materials/retail-logos/ with
 *     the provenance) and their rects into retailChainLogos.gen.ts.
 *   node --import tsx scripts/retail-real/build-chain-logos.ts [--publish] [--incremental]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { CHAIN_TEMPLATES, TEMPLATE_LOOKS, templateForTags, type RetailTemplate } from '../../src/canalRecall/retailTemplates.ts';
import { TEMPLATE_WORDMARK } from '../../src/canalRecall/retailChainLogos.ts';
import { CHAIN_LOGO_PACK } from '../../src/canalRecall/retailChainLogos.gen.ts';

type Counted = { key: string; name: string; n: number; wikidata: string; kinds: Record<string, number>; names: Record<string, number> };
type Override = { fascia?: string; letters?: string; template?: RetailTemplate; skip?: boolean; word?: string; noLogo?: boolean; logoInk?: string; frame?: string; awning?: string; minAspect?: number; goods?: string };
const counted = JSON.parse(fs.readFileSync('data/retail-ground/chains-counted.json', 'utf8')) as Counted[];
const prov = JSON.parse(fs.readFileSync('data/retail-ground/chain-logos/provenance.json', 'utf8')) as Record<string, Record<string, unknown>>;
const overrides = (fs.existsSync('data/retail-ground/chain-overrides.json') ? JSON.parse(fs.readFileSync('data/retail-ground/chain-overrides.json', 'utf8')) : {}) as Record<string, Override>;
const KIND: Record<string, RetailTemplate> = {
  supermarket: 'supermarket', convenience: 'supermarket', chemist: 'chemist', health_food: 'chemist', nutrition_supplements: 'chemist', pharmacy: 'apotheek',
  fast_food: 'fastFood', restaurant: 'restaurant', cafe: 'cafe', coffee: 'cafe', tea: 'cafe', clothes: 'clothes', fashion: 'clothes', boutique: 'clothes',
  shoes: 'shoes', optician: 'optician', hearing_aids: 'optician', telecommunication: 'telecom', mobile_phone: 'telecom', electronics: 'telecom', computer: 'telecom',
  cosmetics: 'cosmetics', perfumery: 'cosmetics', beauty: 'cosmetics', jewelry: 'cosmetics', bag: 'clothes', alcohol: 'liquor', wine: 'liquor',
  department_store: 'variety', variety_store: 'variety', houseware: 'variety', furniture: 'variety', doityourself: 'variety', hardware: 'variety', kitchen: 'variety',
  bed: 'variety', toys: 'variety', pet: 'variety', sports: 'clothes', outdoor: 'clothes', craft: 'variety', stationery: 'variety', gift: 'variety', second_hand: 'variety',
  chocolate: 'nuts', confectionery: 'nuts', pastry: 'bakery', ice_cream: 'gelato', bureau_de_change: 'exchange', money_transfer: 'moneyTransfer', cannabis: 'coffeeshop',
  bathroom_furnishing: 'variety', interior_decoration: 'variety', laundry: 'variety', dry_cleaning: 'variety', copyshop: 'variety', garden_centre: 'florist',
};
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const luma = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** The logo's alpha coverage, its edge colour when opaque, and its dominant non-white ink. */
async function readLogo(file: string) {
  const buf = await sharp(file).ensureAlpha().trim({ threshold: 10 }).png().toBuffer();
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let cover = 0, edge = [0, 0, 0, 0], ink = new Map<string, number>();
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4, a = data[i + 3];
    if (a > 128) cover++;
    if ((x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) && a > 128) { edge[0] += data[i]; edge[1] += data[i + 1]; edge[2] += data[i + 2]; edge[3]++; }
    if (a > 200) { const r = data[i], g = data[i + 1], b = data[i + 2]; if (r + g + b < 720) { const k = hex(r & 0xf0, g & 0xf0, b & 0xf0); ink.set(k, (ink.get(k) ?? 0) + 1); } }
  }
  const px = info.width * info.height, perim = 2 * (info.width + info.height);
  const inkHex = [...ink].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#1d1d1b';
  return { buf, w: info.width, h: info.height, cover: cover / px, edgeFull: edge[3] / perim > 0.85, edge: edge[3] ? hex(edge[0] / edge[3], edge[1] / edge[3], edge[2] / edge[3]) : '#ffffff', ink: inkHex };
}

const chains: Record<string, unknown> = {}, logos: Array<{ key: string; buf: Buffer; w: number; h: number; board: string }> = [];
let skippedRound6 = 0, noLogoNoType = 0;
for (const c of counted) {
  const o = overrides[c.key] ?? {};
  if (o.skip) continue;
  const kind = Object.entries(c.kinds).sort((a, b) => b[1] - a[1])[0][0];
  const tags: Record<string, string> = { name: c.name, brand: c.name, ...(kind in { fast_food: 1, restaurant: 1, cafe: 1, pharmacy: 1, ice_cream: 1, bureau_de_change: 1, money_transfer: 1, bar: 1, pub: 1 } ? { amenity: kind } : { shop: kind }) };
  const typed = templateForTags(tags);
  if (typed && CHAIN_TEMPLATES.includes(typed)) { skippedRound6++; continue; }
  const file = path.join('data/retail-ground/chain-logos', `${c.key}.png`), hasLogo = fs.existsSync(file) && !!prov[c.key];
  const template = o.template ?? typed ?? KIND[kind];
  if (!template || (!hasLogo && !typed && !c.wikidata)) { noLogoNoType++; continue; }
  let fascia = o.fascia, letters = o.letters;
  if (hasLogo) {
    const l = await readLogo(file);
    // A boxed logo (opaque to its edges) is the sign: the board takes its edge colour. A transparent mark sits on white
    // when its ink is dark or saturated, else on a near-black board.
    fascia ??= l.edgeFull && l.cover > 0.9 ? l.edge : (() => { const n = parseInt(l.ink.slice(1), 16), L = luma((n >> 16) & 255, (n >> 8) & 255, n & 255); return L > 0.75 ? '#1d1d1b' : '#ffffff'; })();
    letters ??= l.ink;
    // The logo cell's height share of the fascia: a short wordmark fills the width, a square mark the height.
    // Lane chain-logos2 (Lidl, "make sign fit"): `minAspect` widens a square mark's cell with transparent margins (the
    // board colour once packed), so the front draws it inside the board as a wordmark, not as a lightbox over it.
    if (o.minAspect && l.w / l.h < o.minAspect) {
      const W = Math.round(l.h * o.minAspect);
      l.buf = await sharp({ create: { width: W, height: l.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: l.buf, left: Math.round((W - l.w) / 2), top: 0 }]).png().toBuffer();
      l.w = W;
    }
    const buf = o.logoInk ? await sharp(l.buf).ensureAlpha().composite([{ input: { create: { width: l.w, height: l.h, channels: 4, background: o.logoInk } }, blend: 'in' }]).png().toBuffer() : l.buf;
    logos.push({ key: c.key, buf, w: l.w, h: l.h, board: fascia });
  }
  fascia ??= '#1d1d1b'; letters ??= '#ffffff';
  const names = Object.keys(c.names).filter(n => n.trim().toLowerCase() === c.name.trim().toLowerCase() || c.names[n] >= 2);
  chains[c.key] = { name: c.name, word: o.word ?? c.name, ...(c.wikidata ? { wikidata: c.wikidata } : {}), names: [...new Set([c.name, ...names])], template, fascia, letters, ...(o.frame ? { frame: o.frame } : {}), ...(o.awning ? { awning: o.awning } : {}), ...(o.goods ? { goods: o.goods } : {}), pois: c.n };
}

// Round-6 templates' better logos (retailChainLogos.ts TEMPLATE_CHAIN_LOGO, TEMPLATE_WORDMARK): the wordmarks
// build-chain-wordmarks.ts makes (Albert Heijn's lockup, plain JUMBO, Dirk van den Broek, the Gall & Gall word, Bruna's
// own logo; lane chain-logos-20261116), each on its template's board, and any of FEBO, Stach, SLA the sources gave.
{
  for (const [template, key] of Object.entries(TEMPLATE_WORDMARK)) {
    const l = await readLogo(path.join('data/retail-ground/chain-logos', `${key}.png`));
    logos.push({ key, buf: l.buf, w: l.w, h: l.h, board: TEMPLATE_LOOKS[template as RetailTemplate].fascia });
  }
  for (const [key, board] of [['febo', '#f6d300'], ['stach', '#f3efe6'], ['sla', '#ffffff']] as const) {
    const f = path.join('data/retail-ground/chain-logos', `${key}.png`);
    if (fs.existsSync(f) && prov[key] && !overrides[key]?.noLogo) { const l = await readLogo(f); logos.push({ key, buf: l.buf, w: l.w, h: l.h, board }); }
  }
}
// Shelf-pack the logos: each at an area budget (a wide wordmark short, a square mark taller), padded on its board.
const P = 512, PAD = 3, AREA = 14000;
// Lane chain-logos-20261116: a wordmark (provenance `wordmark`, build-chain-wordmarks.ts) is lettering, at least
// WORD_H px tall where its width allows, so a long name keeps legible strokes.
const WORD_H = 48, isWordmark = (k: string) => !!prov[k]?.wordmark;
const sized = logos.map(l => { const a = l.w / l.h; let h = Math.sqrt(AREA / a); if (isWordmark(l.key)) h = Math.max(h, WORD_H); let w = h * a; if (w > P - 2 * PAD - 4) { w = P - 2 * PAD - 4; h = w / a; } if (h > 140) { h = 140; w = h * a; } return { ...l, dw: Math.round(w), dh: Math.round(h) }; })
  .sort((a, b) => b.dh - a.dh);
const pages: Array<{ comps: sharp.OverlayOptions[]; rects: string[] }> = [];
const pack: Record<string, [number, number, number, number, number]> = {};
const cellOf = async (l: (typeof sized)[number]) => sharp({ create: { width: l.dw + 2 * PAD, height: l.dh + 2 * PAD, channels: 4, background: l.board } })
  .composite([{ input: await sharp(l.buf).resize(l.dw, l.dh, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: PAD, top: PAD }]).raw().toBuffer();
// `--incremental` (lane chain-logos-20261116): the published pages stay as they are, every logo whose cell there is
// unchanged keeps its rect, and only new or changed logos are packed onto pages appended after them. Neighbours then
// mip-bleed exactly as before, so every other chain's front stays byte-identical; a full run repacks from scratch.
const incremental = process.argv.includes('--incremental'), kept = incremental ? CHAIN_LOGO_PACK.pages : 0;
let fresh = sized;
if (incremental) {
  fresh = [];
  const old = await Promise.all(Array.from({ length: kept }, (_, k) => sharp(`data/retail-ground/chains-${k + 1}.png`).ensureAlpha().raw().toBuffer()));
  for (const l of sized) {
    const o = CHAIN_LOGO_PACK.logos[l.key];
    if (o && o[3] === l.dw && o[4] === l.dh) {
      const now = await cellOf(l), cw = l.dw + 2 * PAD, x0 = o[1] - PAD, y0 = o[2] - PAD;
      let same = true;
      for (let yy = 0; yy < l.dh + 2 * PAD && same; yy++) for (let xx = 0; xx < cw; xx++) {
        const i = ((y0 + yy) * P + x0 + xx) * 4, j = (yy * cw + xx) * 4;
        if (Math.abs(old[o[0]][i] - now[j]) > 1 || Math.abs(old[o[0]][i + 1] - now[j + 1]) > 1 || Math.abs(old[o[0]][i + 2] - now[j + 2]) > 1) { same = false; break; }
      }
      if (same) { pack[l.key] = o; continue; }
    }
    fresh.push(l);
  }
  console.log(`incremental: ${sized.length - fresh.length} logos kept on pages 1-${kept}, ${fresh.length} packed after them (${fresh.map(l => l.key).join(', ')})`);
}
let page = kept - 1, x = 0, y = 0, rowH = 0;
const newPage = () => { pages.push({ comps: [], rects: [] }); page++; x = 0; y = 0; rowH = 0; };
if (fresh.length) newPage();
for (const l of fresh) {
  const cw = l.dw + 2 * PAD, ch = l.dh + 2 * PAD;
  if (x + cw > P) { x = 0; y += rowH; rowH = 0; }
  if (y + ch > P) newPage();
  pages[page - kept].rects.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${l.board}"/>`);
  pages[page - kept].comps.push({ input: await sharp(l.buf).resize(l.dw, l.dh, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: x + PAD, top: y + PAD });
  pack[l.key] = [page, x + PAD, y + PAD, l.dw, l.dh];
  x += cw; rowH = Math.max(rowH, ch);
}
for (const [k0, pg] of pages.entries()) {
  const k = k0 + kept;
  const board = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}"><rect width="${P}" height="${P}" fill="#ffffff"/>${pg.rects.join('')}</svg>`);
  const out = `data/retail-ground/chains-${k + 1}.png`;
  await sharp(board).composite(pg.comps).png({ compressionLevel: 9, palette: false }).toFile(out);
  if (process.argv.includes('--publish')) fs.copyFileSync(out, `public/canal-drive/materials/retail-logos/chains-${k + 1}.png`);
}
if (process.argv.includes('--publish')) fs.copyFileSync('data/retail-ground/chain-logos/provenance.json', 'public/canal-drive/materials/retail-logos/chain-provenance.json');
fs.writeFileSync('src/canalRecall/retailChainLogos.gen.ts', `// Generated by scripts/retail-real/build-chain-logos.ts: logo [page, x, y, w, h] px on its page.\nexport const CHAIN_LOGO_PACK: { size: number; pages: number; logos: Record<string, [number, number, number, number, number]> } = ${JSON.stringify({ size: P, pages: kept + pages.length, logos: pack })};\n`);
fs.writeFileSync('src/canalRecall/retailChains.gen.ts', `// Generated by scripts/retail-real/build-chain-logos.ts.\nexport const RETAIL_CHAINS_GEN: Record<string, unknown> = ${JSON.stringify(chains)};\n`);
const covered = Object.values(chains) as Array<{ pois: number }>;
console.log(`${Object.keys(chains).length} chains tabled (${covered.reduce((t, c) => t + c.pois, 0)} POIs), ${logos.length} logos on ${kept + pages.length} pages; ${skippedRound6} round-6 chains kept; ${noLogoNoType} without logo or type`);
