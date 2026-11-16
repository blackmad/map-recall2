/**
 * Shopfront gallery (lane shopfront-browser-20261116, David 2026-11-16 "a browser for chains and generic shopfronts").
 * One thumbnail per generic template and per chain, drawn from retailFrontTris with the inputs the game builds
 * (threeBuildingFeatures.ts: chain colours and logo, lettering cell, goods and faces layers, brand style) on a plain 6 m
 * brick wall with a 3.2 m ground storey, the painter of scripts/retail-real/template-sheet.ts (Node, no browser).
 * Thumbnails go to the screenshots repository (ui/shopfronts/); only the index is generated data in this repo.
 *
 *   node --import tsx scripts/retail-ground/shopfront-gallery.ts [--thumbs=<dir>] [--only=ah,lidl] [--width=480] [--index=public/canal-drive/shopfronts-data/index.json]
 *   npm script: "shopfronts:gallery": "tsx scripts/retail-ground/shopfront-gallery.ts --thumbs=$HOME/Code/map-recall2-screenshots/ui/shopfronts"
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createCanvas, loadImage, type Image, type Canvas } from '@napi-rs/canvas';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const G = globalThis as { __canalRecallRetailReal?: boolean; __canalRecallRetailBrand?: boolean };
G.__canalRecallRetailReal = true; G.__canalRecallRetailBrand = true;
const { retailFrontTris } = await import('../../src/canalRecall/retailFront.ts');
const { RETAIL_TEMPLATES, CHAIN_TEMPLATES, CHAIN_TYPE_TEMPLATES, REAL_ONLY_TEMPLATES, realAccepted, TEMPLATE_LOOKS } = await import('../../src/canalRecall/retailTemplates.ts');
const { logoFor, glyphCellBox } = await import('../../src/canalRecall/retailLogos.ts');
const { GOODS_LAYERS, paintGoodsLayer } = await import('../../src/canalRecall/retailGoods.ts');
const { GOODS_BASE, TYPE_BASE, CHAIN_LOGO_BASE } = await import('../../src/canalRecall/retailPages.ts');
const { TYPE_FACES } = await import('../../src/canalRecall/retailTypeFaces.ts');
const { CHAIN_LOGO_PAGES, chainLogo, TEMPLATE_CHAIN_LOGO, TEMPLATE_WORDMARK, templateLogoKey } = await import('../../src/canalRecall/retailChainLogos.ts');
const { RETAIL_CHAINS, chainOwnFront } = await import('../../src/canalRecall/retailChains.ts');
const { BRAND_STYLES, ACCEPTED_BRANDS } = await import('../../src/canalRecall/retailBrandStyles.ts');
const { buildShopfrontIndex, thumbFile } = await import('../../src/canalRecall/shopfrontIndex.ts');
type FrontTri = import('../../src/canalRecall/retailFront.ts').FrontTri;
type RetailTemplate = import('../../src/canalRecall/retailTemplates.ts').RetailTemplate;

const THUMBS = arg('thumbs') ?? 'artifacts/shopfronts/thumbs';
const INDEX = arg('index') ?? 'public/canal-drive/shopfronts-data/index.json';
const only = arg('only')?.split(',');
const RAW = 'https://raw.githubusercontent.com/blackmad/map-recall2-screenshots/main/ui/shopfronts/';
const WORDS: Partial<Record<RetailTemplate, string>> = { brownBar: 'PAPENEILAND', bakery: 'VERHAGEN', doner: 'KEBAB HOUSE', books: 'KOOKBOEKHANDEL', greengrocer: 'SENER', bike: 'DAMSKO', coffeeshop: 'BLUEBIRD', toko: 'TOKO JOYCE', turkishBakery: 'FIRIN', nuts: 'NOTENBAR', waffle: 'WAFFLE', pancake: 'PANCAKES', smartshop: 'MAGIC', frites: 'FRITES', cheese: 'KAASHUIS', souvenir: 'SOUVENIRS', tobacco: 'TABAK', phone: 'GSM SHOP', gelato: 'GELATO', butcher: 'SLAGERIJ', exchange: 'EXCHANGE', tattoo: 'INK', snackbar: 'SNACKBAR' };
const NAMES: Record<string, string> = { ah: 'Albert Heijn', hema: 'HEMA', febo: 'FEBO', sla: 'SLA', stach: 'Stach', moneyTransfer: 'Money transfer', gallgall: 'Gall & Gall', mcdonalds: "McDonald's", brownBar: 'Brown cafe', redLight: 'Red-light window', toko: 'Toko', turkishBakery: 'Turkish bakery', smartshop: 'Smartshop', coffeeshop: 'Coffeeshop' };

// The pages as the game loads them (layer -> image), at the 512 px publish.
const SIZE = 512, LOGO = 207, SPAN = 6, GROUND = 3.2, CW = 760, CH = 470, W = Number(arg('width') ?? 480), H = Math.round(W * CH / CW);
const pages = new Map<number, Image | Canvas>();
const dir = 'public/canal-drive/materials/retail-logos';
pages.set(LOGO, await loadImage(path.join(dir, 'atlas.png'))); pages.set(LOGO + 1, await loadImage(path.join(dir, 'atlas-2.png')));
for (let k = 0; k < GOODS_LAYERS; k++) { const c = createCanvas(SIZE, SIZE); paintGoodsLayer(c.getContext('2d') as never, k, SIZE); pages.set(LOGO + GOODS_BASE + k, c); }
for (const [k, f] of TYPE_FACES.entries()) if (fs.existsSync(path.join(dir, `type-${f}.png`))) pages.set(LOGO + TYPE_BASE + k, await loadImage(path.join(dir, `type-${f}.png`)));
for (let k = 0; k < CHAIN_LOGO_PAGES; k++) pages.set(LOGO + CHAIN_LOGO_BASE + k, await loadImage(path.join(dir, `chains-${k + 1}.png`)));
const isLettering = (layer: number, uv: [number, number][]) => {
  if (layer >= LOGO + TYPE_BASE && layer < LOGO + TYPE_BASE + TYPE_FACES.length) return true;
  if (layer !== LOGO) return false;
  const g = glyphCellBox(), u = uv[0][0], v = 1 - uv[0][1];
  return u >= g.x - 1e-6 && u <= g.x + g.w + 1e-6 && v >= g.y - 1e-6 && v <= g.y + g.h + 1e-6;
};
const tinted = new Map<string, Canvas>();
function lettering(layer: number, ink: string, board: string): Canvas {
  const key = `${layer}|${ink}|${board}`, hit = tinted.get(key); if (hit) return hit;
  const c = createCanvas(SIZE, SIZE), x = c.getContext('2d'); x.drawImage(pages.get(layer) as Image, 0, 0, SIZE, SIZE);
  const d = x.getImageData(0, 0, SIZE, SIZE), a = hexRgb(ink), b = hexRgb(board);
  for (let i = 0; i < d.data.length; i += 4) { const k = d.data[i] / 255; for (let j = 0; j < 3; j++) d.data[i + j] = Math.round(a[j] * k + b[j] * (1 - k)); }
  x.putImageData(d, 0, 0); tinted.set(key, c); return c;
}
function hexRgb(h: string): number[] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

const yaw = 18 * Math.PI / 180, f = 95;
function project(p: number[]): [number, number] {
  const dx = p[0] - (SPAN / 2 + 2.6), dy = p[1] - 9, dz = p[2] - 1.7;
  const rx = dx * Math.cos(yaw) - dy * Math.sin(yaw), ry = dx * Math.sin(yaw) + dy * Math.cos(yaw), depth = -ry;
  return [CW / 2 + (rx / depth) * f * 9, CH * 0.62 - (dz / depth) * f * 9];
}
const lightK = (n: number[], lit?: boolean) => { const L = [0.35, 0.75, 0.55], ln = Math.hypot(...L); return lit ? 1 : 0.55 + 0.5 * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ln); };
const shade = (hex: string, k: number) => `rgb(${hexRgb(hex).map(v => Math.min(255, Math.round(v * k))).join(',')})`;
const WALL = '#8a4a36';

/** The input the game builds for a pand with this template / chain (threeBuildingFeatures.ts, retailReal and retailBrand on). */
function inputFor(template: RetailTemplate, chainKey: string | null, seed: string) {
  const chainRow = chainKey ? RETAIL_CHAINS[chainKey] : undefined;
  const real = realAccepted(template), retailChain = chainRow && (real || chainOwnFront(chainKey!)) ? chainRow : undefined, chainWord = chainRow && !retailChain ? chainRow.word : undefined;
  const tk = templateLogoKey(template, true, real), cl = retailChain && chainKey ? chainLogo(chainKey) : tk ? chainLogo(tk) : null;
  const own = logoFor(template);
  const logo = cl ? { layer: LOGO + CHAIN_LOGO_BASE + cl.page, rect: cl.rect, aspect: cl.aspect } : own ? { layer: LOGO + own.page, rect: own.rect, aspect: own.aspect } : undefined;
  const word = chainKey ? chainWord : WORDS[template] ?? 'WINKEL';
  const brandKey = chainKey ?? template;
  return {
    template, seed, door: { a0: SPAN - 1.9, a1: SPAN - 0.9, depthM: 0.5 }, letters: LOGO, ...(word ? { word } : {}), ...(logo ? { logo } : {}),
    ...(real ? { goods: LOGO + GOODS_BASE, faces: LOGO + TYPE_BASE } : {}),
    ...(retailChain ? { chain: { fascia: retailChain.fascia, letters: retailChain.letters, word: retailChain.word } } : {}),
    ...(brandKey in BRAND_STYLES ? { brand: brandKey, wallHex: WALL } : {}),
  };
}

function drawFront(tris: FrontTri[]): Canvas {
  const canvas = createCanvas(CW, CH), ctx = canvas.getContext('2d');
  const wall: FrontTri[] = [], quad = (a: number[][], hex: string, n: [number, number, number]) => { wall.push({ p: [a[0], a[1], a[2]] as never, hex, n }, { p: [a[0], a[2], a[3]] as never, hex, n }); };
  quad([[-5, 0, 0], [SPAN + 1.5, 0, 0], [SPAN + 1.5, 0, 7], [-5, 0, 7]], WALL, [0, 1, 0]);
  quad([[-5, 0, 0], [SPAN + 1.5, 0, 0], [SPAN + 1.5, 4, 0], [-5, 4, 0]], '#9a958c', [0, 0, 1]);
  const all = [...wall.map((tr, k) => ({ tr, k, d: -99 })), ...tris.map((tr, k) => ({ tr, k: k + 1000, d: (tr.p[0][1] + tr.p[1][1] + tr.p[2][1]) / 3 }))].sort((a, b) => a.d - b.d || a.k - b.k);
  ctx.fillStyle = '#9db7cc'; ctx.fillRect(0, 0, CW, CH);
  for (const { tr } of all) {
    const q = tr.p.map(p => project(p)), k = lightK(tr.n, tr.lit);
    if (tr.layer !== undefined && tr.uv && pages.has(tr.layer)) {
      const img = isLettering(tr.layer, tr.uv) ? lettering(tr.layer, tr.hex, (tr as { accentHex?: string }).accentHex ?? tr.hex) : pages.get(tr.layer)!;
      const t = tr.uv.map(([u, v]) => [u * SIZE, (1 - v) * SIZE]);
      const [[u0, v0], [u1, v1], [u2, v2]] = t, [[x0, y0], [x1, y1], [x2, y2]] = q;
      const den = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0); if (Math.abs(den) < 1e-9) continue;
      const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / den, c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / den;
      const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / den, d = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / den;
      ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.clip();
      ctx.setTransform(a, b, c, d, x0 - a * u0 - c * v0, y0 - b * u0 - d * v0); ctx.drawImage(img as Image, 0, 0, SIZE, SIZE);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (k < 1) { ctx.fillStyle = `rgba(0,0,0,${(1 - k).toFixed(3)})`; ctx.fill(); }
      ctx.restore();
      continue;
    }
    ctx.fillStyle = tr.layer !== undefined ? '#2a2622' : shade(tr.hex, k);
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6; ctx.stroke();
  }
  return canvas;
}

async function thumb(input: ReturnType<typeof inputFor>, file: string): Promise<number> {
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: 1 };
  const tris: FrontTri[] = retailFrontTris(input as never, e, 0, SPAN, 0, GROUND);
  const png = drawFront(tris).toBuffer('image/png');
  let q = 82, buf = await sharp(png).resize(W, H).webp({ quality: q }).toBuffer();
  while (buf.length > 40_000 && q > 40) { q -= 8; buf = await sharp(png).resize(W, H).webp({ quality: q }).toBuffer(); }
  fs.writeFileSync(file, buf);
  return buf.length;
}

// The index first (it decides which thumbnails exist), then the thumbnails.
const extract = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/shop-templates.json', 'utf8'));
const chainProv = JSON.parse(fs.readFileSync(path.join(dir, 'chain-provenance.json'), 'utf8')) as Record<string, { wikidata?: string; source?: string }>;
const tplProv = (JSON.parse(fs.readFileSync(path.join(dir, 'provenance.json'), 'utf8')) as { logos: Record<string, { page?: string }> }).logos;
const provByWikidata = new Map(Object.values(chainProv).filter(p => p.wikidata && p.source).map(p => [p.wikidata!, p.source!]));
const logoSource = (key: string, kind: 'chain' | 'template'): string | undefined => {
  if (kind === 'template') return (TEMPLATE_WORDMARK[key] ? chainProv[TEMPLATE_WORDMARK[key]]?.source : undefined) ?? tplProv[key]?.page ?? (chainLogo(TEMPLATE_CHAIN_LOGO[key] ?? '') ? chainProv[TEMPLATE_CHAIN_LOGO[key]]?.source : undefined);
  const c = RETAIL_CHAINS[key];
  return chainProv[key]?.source ?? (c?.wikidata ? provByWikidata.get(c.wikidata) : undefined);
};
const index = buildShopfrontIndex({
  extract, chainTemplates: CHAIN_TEMPLATES, chainTypeTemplates: CHAIN_TYPE_TEMPLATES, chains: RETAIL_CHAINS, names: NAMES,
  brandAccepted: k => ACCEPTED_BRANDS.includes(k), logoSource, thumbBase: RAW,
});
fs.mkdirSync(THUMBS, { recursive: true });
let n = 0, bytes = 0, biggest = 0;
const drawn = new Set<string>();
for (const en of index) {
  if (only && !only.includes(en.id)) continue;
  const tpl = en.template as RetailTemplate;
  if (!(RETAIL_TEMPLATES as readonly string[]).includes(tpl) || !TEMPLATE_LOOKS[tpl]) { console.warn(`skip ${en.id}: no template ${tpl}`); continue; }
  if ((REAL_ONLY_TEMPLATES as readonly string[]).includes(tpl) && !realAccepted(tpl)) { console.warn(`skip ${en.id}: ${tpl} not accepted`); continue; }
  const chainKey = en.kind === 'chain' && RETAIL_CHAINS[en.id] ? en.id : null;
  const size = await thumb(inputFor(tpl, chainKey, `gallery-${en.id}`), path.join(THUMBS, thumbFile(en.kind, en.id)));
  drawn.add(`${en.kind}:${en.id}`); n++; bytes += size; biggest = Math.max(biggest, size);
}
fs.mkdirSync(path.dirname(INDEX), { recursive: true });
fs.writeFileSync(INDEX, JSON.stringify({ version: 1, source: extract.source, entries: only ? index : index.map(e => (drawn.has(`${e.kind}:${e.id}`) ? { ...e, drawn: true } : { ...e, drawn: false, thumb: null })) }, null, 1) + '\n');
console.log(`wrote ${n} thumbnails to ${THUMBS} (${(bytes / 1024).toFixed(0)} KB total, largest ${(biggest / 1024).toFixed(1)} KB) and ${index.length} index entries to ${INDEX}`);
