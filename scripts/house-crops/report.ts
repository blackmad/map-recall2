/** Coverage table and contact sheet of 48 random crops for one buurt's manifest (house line station 4a). */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { manifestPath, type Manifest } from './manifest.ts';

export type Table = { pands: number; wallsFound: number; cropsMade: number; usable: number; usableShare: number; rejectedByReason: Record<string, number>; rejectedPrimary: Record<string, number>; noWall: number; noPano: number; errors: number; byMethod: Record<string, { made: number; usable: number }>;
  requests: number; bytes: number; retries: number; status429: number; status5xx: number; wallSeconds: number; sessions: number };

export function coverage(m: Manifest): Table {
  const es = Object.values(m.pands), made = es.filter(e => e.status === 'ok');
  const t: Table = { pands: es.length, wallsFound: es.filter(e => e.status !== 'no-wall').length, cropsMade: made.length, usable: made.filter(e => e.usable).length, usableShare: 0, rejectedByReason: {}, rejectedPrimary: {}, noWall: es.filter(e => e.status === 'no-wall').length, noPano: es.filter(e => e.status === 'no-pano').length, errors: es.filter(e => e.status === 'error').length, byMethod: {},
    requests: 0, bytes: 0, retries: 0, status429: 0, status5xx: 0, wallSeconds: 0, sessions: m.sessions.length };
  for (const e of made) {
    const k = (t.byMethod[e.method!] ??= { made: 0, usable: 0 }); k.made++; if (e.usable) k.usable++;
    if (!e.usable) { for (const r of e.reasons!) t.rejectedByReason[r] = (t.rejectedByReason[r] ?? 0) + 1; t.rejectedPrimary[e.reasons![0]] = (t.rejectedPrimary[e.reasons![0]] ?? 0) + 1; }
  }
  t.usableShare = es.length ? +(t.usable / Math.max(1, t.wallsFound) * 100).toFixed(1) : 0;
  for (const s of m.sessions) { t.requests += s.requests; t.bytes += s.bytes; t.retries += s.retries; t.status429 += s.status429; t.status5xx += s.status5xx; t.wallSeconds += s.wallSeconds; }
  return t;
}

export function markdown(m: Manifest, t: Table): string {
  const row = (k: string, v: string | number) => `| ${k} | ${v} |`;
  return [`### ${m.buurt.code} ${m.buurt.name} (${m.buurt.gebied})`, '', '| | |', '|---|---|',
    row('pands in buurt (processed)', t.pands), row('street-facing wall found', t.wallsFound), row('no exposed wall', t.noWall), row('no panorama', t.noPano), row('errors', t.errors),
    row('crops made', t.cropsMade), row('usable', `${t.usable} (${t.usableShare} % of pands with a wall)`),
    row('rejected, primary reason', Object.entries(t.rejectedPrimary).map(([k, v]) => `${k} ${v}`).join(', ') || '-'),
    row('rejected, every broken cap', Object.entries(t.rejectedByReason).map(([k, v]) => `${k} ${v}`).join(', ') || '-'),
    row('by route', Object.entries(t.byMethod).map(([k, v]) => `${k}: ${v.usable}/${v.made} usable`).join(', ') || '-'),
    row('API requests', `${t.requests} (${(t.bytes / 1e6).toFixed(0)} MB, ${t.retries} retries, ${t.status429} x 429, ${t.status5xx} x 5xx)`),
    row('wall time', `${(t.wallSeconds / 60).toFixed(1)} min over ${t.sessions} session(s)`)].join('\n');
}

/** Deterministic pseudo-random order (mulberry32), so a rerun draws the same 48. */
function shuffled<T>(xs: T[], seed = 7): T[] {
  const a = [...xs]; let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export async function contactSheet(m: Manifest, archiveRoot: string, out: string, n = 48) {
  const pick = shuffled(Object.entries(m.pands).filter(([, e]) => e.status === 'ok'), 11).slice(0, n);
  const cols = 8, T = 300, L = 34, tiles: OverlayOptions[] = [];
  for (const [i, [id, e]] of pick.entries()) {
    const x = (i % cols) * T, y = Math.floor(i / cols) * (T + L);
    const img = await sharp(path.join(archiveRoot, e.archive!, 'front.jpg')).resize(T - 4, T - 4, { fit: 'contain', background: '#1f2328' }).extend({ top: 2, bottom: 2, left: 2, right: 2, background: e.usable ? '#2e9d57' : '#d94141' }).png().toBuffer();
    const label = `${id.slice(-8)} ${e.method} ${e.usable ? 'usable' : e.reasons!.join('+')}`;
    const svg = `<svg width="${T}" height="${L}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="14" font-family="Helvetica" font-size="12" fill="#fff">${label}</text><text x="4" y="28" font-family="Helvetica" font-size="11" fill="#bbb">f${e.flags!.foliage} v${e.flags!.voidShare} w${e.flags!.washedOut} o${e.flags!.occluderShare} ${e.date}</text></svg>`;
    tiles.push({ input: img, left: x, top: y }, { input: Buffer.from(svg), left: x, top: y + T });
  }
  await fs.mkdir(path.dirname(out), { recursive: true });
  const rows = Math.ceil(pick.length / cols);
  await sharp({ create: { width: cols * T, height: rows * (T + L), channels: 3, background: '#1f2328' } }).composite(tiles).png().toFile(out);
  return pick.length;
}

export async function report(code: string, archiveRoot?: string) {
  const m: Manifest = JSON.parse(await fs.readFile(manifestPath(code), 'utf8'));
  const t = coverage(m), md = markdown(m, t);
  console.log('\n' + md);
  await fs.mkdir('artifacts/house-crops', { recursive: true });
  await fs.writeFile(`artifacts/house-crops/${code}-report.md`, md + '\n');
  if (archiveRoot) { const n = await contactSheet(m, path.resolve(archiveRoot), `artifacts/house-crops/${code}-sheet.png`); console.log(`contact sheet of ${n} crops: artifacts/house-crops/${code}-sheet.png`); }
  else console.log('no --archive: contact sheet skipped');
}

if (process.argv[1]?.endsWith('house-crops/report.ts')) {
  const code = process.argv[2]; if (!code) throw new Error('usage: report.ts <buurt code> [archive root]');
  await report(code, process.argv[3] ?? process.env.HOUSE_CROPS_ARCHIVE);
}
