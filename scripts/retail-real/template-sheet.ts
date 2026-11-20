/**
 * Template sheet that shows what the game draws (lane retail-real-20261115). retail-ground/front-preview.ts drew every
 * textured triangle (logos, lettering, pane interiors) as a white quad, and the sheet David reviewed on 2026-11-15 came
 * from its round-3 copy with the 5 x 7 block letters the game had already dropped. This one draws the same
 * retailFrontTris triangles with the game's inputs (the logo pages, the lettering cell and faces, the goods layers) and
 * samples the published atlas pages exactly as paintLookAtlas loads them, lettering through the mask (letters in the
 * tint, the board in the accent). The light is a simple sun term; the game's own frames are house:frames.
 *
 *   node --import tsx scripts/retail-real/template-sheet.ts [--out=artifacts/retail-real/templates.png] [--only=ah,hema]
 *     [--real=0] (round n's look: no goods, no faces, no chain pages) [--cols=4]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage, type Image, type Canvas } from '@napi-rs/canvas';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const REAL = arg('real') !== '0';
(globalThis as { __canalRecallRetailReal?: boolean }).__canalRecallRetailReal = REAL;
const { retailFrontTris } = await import('../../src/canalRecall/retailFront.ts');
const { RETAIL_TEMPLATES } = await import('../../src/canalRecall/retailTemplates.ts');
const { logoFor, glyphCellBox } = await import('../../src/canalRecall/retailLogos.ts');
const { GOODS_LAYERS, paintGoodsLayer } = await import('../../src/canalRecall/retailGoods.ts');
const { GOODS_BASE, TYPE_BASE, CHAIN_LOGO_BASE, VARIETY_BASE } = await import('../../src/canalRecall/retailPages.ts');
// Lane shop-variety: the pane fillers (retailPaneFillers.ts) as the game draws them (default on; SHOP_VARIETY=0 off).
const { FILLER_LAYERS, paintFillerLayer } = await import('../../src/canalRecall/retailPaneFillers.ts');
const VARIETY = (await import('../../src/canalRecall/shopVariety.ts')).shopVarietyOn();
const { TYPE_FACES } = await import('../../src/canalRecall/retailTypeFaces.ts');
const { CHAIN_LOGO_PAGES, chainLogo, TEMPLATE_CHAIN_LOGO } = await import('../../src/canalRecall/retailChainLogos.ts');
const chains = await import('../../src/canalRecall/retailChains.ts').catch(() => null);
type FrontTri = import('../../src/canalRecall/retailFront.ts').FrontTri;
type RetailTemplate = import('../../src/canalRecall/retailTemplates.ts').RetailTemplate;

const OUT = arg('out') ?? 'artifacts/retail-real/templates.png';
const only = arg('only')?.split(',');
const extra = (arg('chains') ?? '').split(',').filter(Boolean);
type Entry = { t: RetailTemplate; word: string; label: string; chain?: string };
const WORDS: Partial<Record<RetailTemplate, string>> = { brownBar: 'PAPENEILAND', bakery: 'VERHAGEN', doner: 'KEBAB HOUSE', books: 'KOOKBOEKHANDEL', greengrocer: 'SENER', bike: 'DAMSKO', coffeeshop: 'BLUEBIRD', toko: 'TOKO JOYCE', turkishBakery: 'FIRIN', nuts: 'NOTENBAR', waffle: 'WAFFLE', pancake: 'PANCAKES', smartshop: 'MAGIC', florist: 'FLEURMONDE', hairdresser: 'KINKI', apotheek: 'APOTHEEK' };
const entries: Entry[] = (only ?? [...RETAIL_TEMPLATES]).map(t => ({ t: t as RetailTemplate, word: WORDS[t as RetailTemplate] ?? 'WINKEL', label: t }));
for (const c of extra) { const ch = chains?.RETAIL_CHAINS?.[c]; if (ch) entries.push({ t: ch.template, word: '', label: `${c} (${ch.template})`, chain: c }); }
const CHAIN_TYPES = new Set(['supermarket', 'chemist', 'fastFood', 'pizza', 'restaurant', 'cafe', 'clothes', 'shoes', 'optician', 'telecom', 'cosmetics', 'liquor', 'variety']);
for (let i = entries.length - 1; i >= 0; i--) if (!entries[i].chain && CHAIN_TYPES.has(entries[i].t)) entries.splice(i, 1);
const COLS = Number(arg('cols') ?? 4), CW = 760, CH = 470, SPAN = 7, GROUND = 3.6, LOGO = 207;

// The pages as the game loads them (layer -> image), at the 512 px publish.
const SIZE = 512, pages = new Map<number, Image | Canvas>();
const dir = 'public/canal-drive/materials/retail-logos';
pages.set(LOGO, await loadImage(path.join(dir, 'atlas.png'))); pages.set(LOGO + 1, await loadImage(path.join(dir, 'atlas-2.png')));
if (REAL) {
  for (let k = 0; k < GOODS_LAYERS; k++) { const c = createCanvas(SIZE, SIZE); paintGoodsLayer(c.getContext('2d') as never, k, SIZE); pages.set(LOGO + GOODS_BASE + k, c); }
  for (const [k, f] of TYPE_FACES.entries()) if (fs.existsSync(path.join(dir, `type-${f}.png`))) pages.set(LOGO + TYPE_BASE + k, await loadImage(path.join(dir, `type-${f}.png`)));
  for (let k = 0; k < CHAIN_LOGO_PAGES; k++) pages.set(LOGO + CHAIN_LOGO_BASE + k, await loadImage(path.join(dir, `chains-${k + 1}.png`)));
  if (VARIETY) for (let k = 0; k < FILLER_LAYERS; k++) { const c = createCanvas(SIZE, SIZE); paintFillerLayer(c.getContext('2d') as never, k, SIZE); pages.set(LOGO + VARIETY_BASE + k, c); }
}
const isLettering = (layer: number, uv: [number, number][]) => {
  if (REAL && layer >= LOGO + TYPE_BASE && layer < LOGO + TYPE_BASE + TYPE_FACES.length) return true;
  if (layer !== LOGO) return false;
  const g = glyphCellBox(), u = uv[0][0], v = 1 - uv[0][1];
  return u >= g.x - 1e-6 && u <= g.x + g.w + 1e-6 && v >= g.y - 1e-6 && v <= g.y + g.h + 1e-6;
};
// A lettering page coloured for (letters, board): coverage mixes them.
const tinted = new Map<string, Canvas>();
function lettering(layer: number, ink: string, board: string): Canvas {
  const key = `${layer}|${ink}|${board}`, hit = tinted.get(key); if (hit) return hit;
  const c = createCanvas(SIZE, SIZE), x = c.getContext('2d'); x.drawImage(pages.get(layer) as Image, 0, 0, SIZE, SIZE);
  const d = x.getImageData(0, 0, SIZE, SIZE), a = hexRgb(ink), b = hexRgb(board);
  for (let i = 0; i < d.data.length; i += 4) { const k = d.data[i] / 255; for (let j = 0; j < 3; j++) d.data[i + j] = Math.round(a[j] * k + b[j] * (1 - k)); }
  x.putImageData(d, 0, 0); tinted.set(key, c); return c;
}
function hexRgb(h: string): number[] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

const canvas = createCanvas(CW * COLS, CH * Math.ceil(entries.length / COLS)), ctx = canvas.getContext('2d');
ctx.fillStyle = '#20242a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
const yaw = 18 * Math.PI / 180, f = 95;
function project(p: number[], ox: number, oy: number): [number, number] {
  const dx = p[0] - (SPAN / 2 + 2.6), dy = p[1] - 9, dz = p[2] - 1.7;
  const rx = dx * Math.cos(yaw) - dy * Math.sin(yaw), ry = dx * Math.sin(yaw) + dy * Math.cos(yaw), depth = -ry;
  return [ox + CW / 2 + (rx / depth) * f * 9, oy + CH * 0.62 - (dz / depth) * f * 9];
}
const lightK = (n: number[], lit?: boolean) => { const L = [0.35, 0.75, 0.55], ln = Math.hypot(...L); return lit ? 1 : 0.55 + 0.5 * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ln); };
const shade = (hex: string, k: number) => `rgb(${hexRgb(hex).map(v => Math.min(255, Math.round(v * k))).join(',')})`;
let totalTris = 0;
entries.forEach((en, i) => {
  const ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CH, e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: 1 };
  const look = logoFor(en.t), cl = en.chain ? chainLogo(en.chain) : REAL && TEMPLATE_CHAIN_LOGO[en.t] ? chainLogo(TEMPLATE_CHAIN_LOGO[en.t]) : null;
  const logo = cl ? { layer: LOGO + CHAIN_LOGO_BASE + cl.page, rect: cl.rect, aspect: cl.aspect } : look ? { layer: LOGO + look.page, rect: look.rect, aspect: look.aspect } : undefined;
  const tris: FrontTri[] = retailFrontTris({ template: en.t, word: en.word, seed: `preview-${en.label}`, door: { a0: SPAN - 1.9, a1: SPAN - 0.9, depthM: 0.5 }, letters: LOGO,
    // Lane retail-pass round 2: SHOP_INTERIORS=1 draws both bays as rooms (the game's mesher cuts the wall behind them).
    ...(process.env.SHOP_INTERIORS === '1' ? { rooms: [0, 1] } : {}),
    ...(logo ? { logo } : {}), ...(REAL ? { goods: LOGO + GOODS_BASE, faces: LOGO + TYPE_BASE, ...(VARIETY ? { variety: LOGO + VARIETY_BASE } : {}) } : {}), ...(en.chain && chains ? { chain: { fascia: chains.RETAIL_CHAINS[en.chain].fascia, letters: chains.RETAIL_CHAINS[en.chain].letters, word: chains.RETAIL_CHAINS[en.chain].word } } : {}) } as never, e, 0, SPAN, 0, GROUND);
  totalTris += tris.length;
  const wall: FrontTri[] = [], quad = (a: number[][], hex: string, n: [number, number, number]) => { wall.push({ p: [a[0], a[1], a[2]] as never, hex, n }, { p: [a[0], a[2], a[3]] as never, hex, n }); };
  quad([[-1.5, 0, 0], [SPAN + 1.5, 0, 0], [SPAN + 1.5, 0, 7], [-1.5, 0, 7]], '#7a3a2a', [0, 1, 0]);
  quad([[-1.5, 0, 0], [SPAN + 1.5, 0, 0], [SPAN + 1.5, 4, 0], [-1.5, 4, 0]], '#9a958c', [0, 0, 1]);
  const all = [...wall.map((tr, k) => ({ tr, k, d: -99 })), ...tris.map((tr, k) => ({ tr, k: k + 1000, d: (tr.p[0][1] + tr.p[1][1] + tr.p[2][1]) / 3 }))].sort((a, b) => a.d - b.d || a.k - b.k);
  ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, CW, CH); ctx.clip(); ctx.fillStyle = '#9db7cc'; ctx.fillRect(ox, oy, CW, CH);
  for (const { tr } of all) {
    const q = tr.p.map(p => project(p, ox, oy)), k = lightK(tr.n, tr.lit);
    if (tr.layer !== undefined && tr.uv && pages.has(tr.layer)) {
      const img = isLettering(tr.layer, tr.uv) ? lettering(tr.layer, tr.hex, tr.accentHex ?? tr.hex) : pages.get(tr.layer)!;
      const t = tr.uv.map(([u, v]) => [u * SIZE, (1 - v) * SIZE]);
      // Affine map image -> screen for the triangle.
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
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText(`${en.label}  (${tris.length} tris)`, ox + 10, oy + 24);
  ctx.restore();
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, OUT.endsWith('.jpg') ? canvas.toBuffer('image/jpeg', 88) : canvas.toBuffer('image/png'));
console.log(`wrote ${OUT} (${entries.length} fronts, ${totalTris} tris)`);
