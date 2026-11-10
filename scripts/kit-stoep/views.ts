/**
 * Stoop evidence views (K-stoep #360): for each pand, its street wall (pand-reference/select.ts) and up to two oblique
 * city panoramas, one from each side of the wall, cropped in perspective onto the ground storey, so a flight's
 * direction, its step count and the railing read. A rectified front cannot show them: the flight projects from the
 * wall plane.
 *
 *   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference \
 *   node --import tsx scripts/kit-stoep/views.ts --pands=0363100012175702,... [--out=artifacts/kit-stoep/views] [--sheet=contact.jpg]
 *   ... --maxd=30   panoramas up to 30 m off (wide quays such as Nassaukade; default 18)
 *   ... --register-stoops --streets=Herengracht,Keizersgracht [--limit=40]   candidates: register `stoep` pands on those streets
 *
 * Writes <out>/<pand>-<l|r>.jpg (640x480) and <out>/views.json (wall, panoramas, street, angle); --sheet tiles the first
 * view of every pand with its id for picking the validation set.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {AMSTERDAM_WORLD_ALIGNED, worldToEquirectangularPixel, sampleEquirectangular} from '../../src/canalRecall/facade/rectify.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {selectPands, listPanos} from '../pand-reference/select.ts';
import {FALLBACK_GROUND_NAP, loadPano} from '../pand-reference/rectify.ts';
import {http} from '../pand-reference/core.ts';
import {lensFor} from '../da-costa-block/neighbourhood-core.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = arg('out') ?? 'artifacts/kit-stoep/views', W = 640, H = 480;
http.minGapMs = 500;

type Img = {width: number; height: number; data: Uint8Array};
function perspective(img: Img, pose: {x: number; y: number; z: number}, target: {x: number; y: number; z: number}, fovDeg: number) {
  const f = [target.x - pose.x, target.y - pose.y, target.z - pose.z], fl = Math.hypot(...f), fw = f.map(v => v / fl);
  const r0 = [fw[1], -fw[0], 0], rl = Math.hypot(...r0), right = r0.map(v => v / rl);
  const up = [right[1] * fw[2] - right[2] * fw[1], right[2] * fw[0] - right[0] * fw[2], right[0] * fw[1] - right[1] * fw[0]];
  const t = Math.tan(fovDeg * Math.PI / 360), out = Buffer.alloc(W * H * 3), px = [0, 0, 0, 0];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const sx = (2 * (i + 0.5) / W - 1) * t * W / H, sy = (1 - 2 * (j + 0.5) / H) * t;
    const d = [0, 1, 2].map(k => fw[k] + right[k] * sx + up[k] * sy);
    const [u, v] = worldToEquirectangularPixel({x: pose.x + d[0], y: pose.y + d[1], z: pose.z + d[2]}, {...pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0}, img, AMSTERDAM_WORLD_ALIGNED);
    sampleEquirectangular(img as any, u, v, px);
    out.set([px[0], px[1], px[2]], (j * W + i) * 3);
  }
  return sharp(out, {raw: {width: W, height: H, channels: 3}});
}

/** Named streets as RD segments (streets-routing.json), for the address line. */
async function streetNamer() {
  const streets = JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as {name: string; path?: number[][]; paths?: number[][][]}[];
  const segs: {name: string; a: {x: number; y: number}; b: {x: number; y: number}}[] = [];
  for (const s of streets) for (const p of s.paths ?? (s.path ? [s.path] : [])) {
    const pts = p.map(q => lngLatToRd([q[1], q[0]]));
    for (let i = 0; i + 1 < pts.length; i++) segs.push({name: s.name, a: pts[i], b: pts[i + 1]});
  }
  return (p: {x: number; y: number}) => {
    let best = '', bd = Infinity;
    for (const s of segs) {
      const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / l)) : 0;
      const d = Math.hypot(p.x - s.a.x - t * dx, p.y - s.a.y - t * dy);
      if (d < bd) { bd = d; best = s.name; }
    }
    return best;
  };
}

async function main() {
  let ids = (arg('pands') ?? '').split(',').filter(Boolean);
  if (process.argv.includes('--register-stoops')) {
    const facts = JSON.parse(await fs.readFile('public/data/extracts/amsterdam/monument-facts.json', 'utf8')).buildings as Record<string, {elements?: {key: string}[]}>;
    ids = Object.entries(facts).filter(([, f]) => f.elements?.some(e => e.key === 'stoop')).map(([id]) => id.replace('NL.IMBAG.Pand.', ''));
  }
  const want = arg('streets')?.split(',');
  const name = await streetNamer();
  await fs.mkdir(OUT, {recursive: true});
  const out: any[] = [], limit = Number(arg('limit') ?? 1e9);
  for (const id of ids) {
    if (out.length >= limit) break;
    const [sel] = await selectPands([id]);
    if (!sel.wall) { console.log(`${sel.pandId}: ${sel.wallNote}`); continue; }
    const street = name(sel.wall.mid);
    if (want && !want.includes(street)) continue;
    const w = sel.wall, ux = (w.b.x - w.a.x) / w.len, uy = (w.b.y - w.a.y) / w.len;
    // Oblique views from either side: 6-18 m off, 20-55 degrees from the wall normal.
    const maxD = Number(arg('maxd') ?? 18);
    const views = (await listPanos(w.mid, maxD + 4)).map((p: any) => {
      const c = lngLatToRd(p.geometry.coordinates), along = (c.x - w.mid.x) * ux + (c.y - w.mid.y) * uy, o = (c.x - w.mid.x) * w.nx + (c.y - w.mid.y) * w.ny;
      return {p, along, o, d: Math.hypot(along, o), deg: Math.atan2(along, o) * 180 / Math.PI, year: Number(String(p.timestamp).slice(0, 4))};
    }).filter(v => v.o > 2.5 && v.d >= 6 && v.d <= maxD && Math.abs(v.deg) >= 20 && Math.abs(v.deg) <= 55)
      .sort((a, b) => b.year - a.year || Math.abs(Math.abs(a.deg) - 35) - Math.abs(Math.abs(b.deg) - 35));
    const rec: any = {pandId: sel.pandId.replace('NL.IMBAG.Pand.', ''), street, wallM: Math.round(w.len * 100) / 100, views: []};
    for (const v of [views.find(x => x.deg < 0), views.find(x => x.deg > 0)]) {
      if (!v) continue;
      const lens = lensFor(v.p, undefined) ?? lensFor(v.p, FALLBACK_GROUND_NAP);
      const pano = lens && await loadPano({panoId: v.p.pano_id, record: v.p} as any);
      if (!lens || !pano) continue;
      const ground = lens.pose.z - 2.45, fov = Math.min(75, 2 * Math.atan((w.len / 2 + 2.5) / v.d) * 180 / Math.PI);
      const side = v.deg < 0 ? 'l' : 'r', file = path.join(OUT, `${rec.pandId}-${side}.jpg`);
      await (await perspective(pano.img, lens.pose, {x: w.mid.x, y: w.mid.y, z: ground + 2.2}, fov)).jpeg({quality: 82}).toFile(file);
      rec.views.push({side, file, panoId: v.p.pano_id, date: String(v.p.timestamp).slice(0, 10), deg: Math.round(v.deg), distM: Math.round(v.d * 10) / 10});
    }
    out.push(rec);
    console.log(`${rec.pandId} ${street} ${rec.views.map((v: any) => `${v.side} ${v.deg}deg ${v.date}`).join(', ')}`);
  }
  await fs.writeFile(path.join(OUT, 'views.json'), JSON.stringify(out, null, 1));
  const sheet = arg('sheet');
  if (sheet && out.some(r => r.views.length)) {
    const tiles = out.filter(r => r.views.length), cols = 5, tw = 320, th = 264;
    const parts = await Promise.all(tiles.map(async r => {
      const img = await sharp(r.views[0].file).resize(tw, 240).toBuffer();
      const label = Buffer.from(`<svg width="${tw}" height="24"><rect width="100%" height="100%" fill="#1f2328"/><text x="5" y="17" font-family="Helvetica" font-size="13" fill="#fff">${r.pandId.slice(-6)} ${r.street} ${r.views[0].side}</text></svg>`);
      return sharp({create: {width: tw, height: th, channels: 3, background: '#fff'}}).composite([{input: label, left: 0, top: 0}, {input: img, left: 0, top: 24}]).png().toBuffer();
    }));
    const rows = Math.ceil(parts.length / cols);
    await sharp({create: {width: cols * tw, height: rows * th, channels: 3, background: '#fff'}}).composite(parts.map((input, i) => ({input, left: (i % cols) * tw, top: Math.floor(i / cols) * th}))).jpeg({quality: 80}).toFile(sheet);
    console.log(`sheet ${sheet}: ${parts.length}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
