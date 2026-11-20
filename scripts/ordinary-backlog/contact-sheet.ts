/**
 * Contact sheet for the ordinary backlog's top 20 (core ring): today's render beside the panorama.
 *
 *   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference \
 *   node --import tsx scripts/ordinary-backlog/contact-sheet.ts [--top 20] [--skip-preview]
 *
 * Reads artifacts/ordinary-backlog/top20.json (written by build.ts). Per pand:
 *   - today: `npm run house:preview -- <pand> --wall <bearing>deg` (Node, the route the game draws: generic chunk or installed
 *     GLB), front.png of the street wall build.ts judged;
 *   - photo: the aimed panorama thumbnail (pand-reference/rectify.ts aimedThumbnail) from the panorama build.ts picked
 *     for the street wall (Gemeente Amsterdam, CC BY 4.0).
 * Writes artifacts/ordinary-backlog/sheet-01.jpg, sheet-02.jpg (10 rows each) and sheet/<pand>/{front.png,pano.jpg}.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

process.env.PAND_REFERENCE_CACHE ??= path.join(os.homedir(), 'Code/map-recall2/.cache/pand-reference');
const core = await import('../pand-reference/core.ts');
const select = await import('../pand-reference/select.ts');
const { aimedThumbnail } = await import('../pand-reference/rectify.ts');
core.http.userAgent = 'MapRecall-OrdinaryBacklog/1.0 (+https://github.com/blackmad/map-recall2)';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/ordinary-backlog');
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const TOP = Number(arg('top', '20'));
const rows = (JSON.parse(fs.readFileSync(path.join(OUT, 'top20.json'), 'utf8')) as any[]).slice(0, TOP);
const W = 520, H = 420, LABEL = 300;
const tiles: Buffer[] = [];
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

async function fitted(file: string | null, note: string): Promise<Buffer> {
  if (file && fs.existsSync(file)) return sharp(file).resize(W, H, { fit: 'contain', background: '#202020' }).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: '#303030' } })
    .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><text x="20" y="${H / 2}" font-family="Helvetica" font-size="22" fill="#ccc">${esc(note)}</text></svg>`) }]).png().toBuffer();
}

for (const r of rows) {
  const dir = path.join(OUT, 'sheet', r.id);
  fs.mkdirSync(dir, { recursive: true });
  let front: string | null = path.join(dir, 'front.png');
  if (!process.argv.includes('--skip-preview') || !fs.existsSync(front)) {
    try {
      execFileSync('node', ['--max-old-space-size=8192', '--import', 'tsx', 'scripts/house-preview/preview.ts', r.id, '--out', dir, ...(r.evidence?.bearingDeg !== undefined ? ['--wall', `${r.evidence.bearingDeg}deg`] : [])], { cwd: ROOT, stdio: 'pipe', timeout: 240_000 });
    } catch (e) { console.warn(`${r.id}: preview failed: ${String((e as Error).message).split('\n')[0]}`); }
  }
  if (!fs.existsSync(front)) front = null;
  let pano: string | null = null, panoNote = 'no panorama';
  if (r.evidence?.panoId) {
    const fp = (await core.findPands([r.id])).get(core.normId(r.id));
    if (fp) {
      const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
      const picked = await select.pickWall(fp, await core.neighbourhood(centre));
      // the same wall build.ts judged: the longest road-facing one
      const wall = [picked.wall, ...(picked.others ?? [])].filter((w): w is NonNullable<typeof w> => !!w && w.facing > 0.5 && w.roadDistM < 45).sort((p, q) => q.len - p.len)[0] ?? picked.wall;
      const pick = wall ? select.rankPanos(wall, await select.listPanos(wall.mid)).find(p => p.panoId === r.evidence.panoId) : null;
      if (wall && pick) {
        const thumb = await aimedThumbnail(pick, wall, r.heightM, 40);
        if (thumb) { pano = path.join(dir, 'pano.jpg'); fs.writeFileSync(pano, thumb.jpeg); panoNote = `${pick.panoId} ${pick.timestamp?.slice(0, 10)}`; }
      }
    }
  }
  const label = [`#${r.rank} ${r.address ?? r.name ?? ''}`.slice(0, 34), `pand ${r.id}`, `${r.year ?? '?'} · ${r.footprintM2} m² · ${r.heightM} m`,
    `today: ${r.today.kind} (bad ${r.today.badness})`, `street wall ${r.streetWallM} m`, `ride ${(r.rideVisibility.score / 1e6).toFixed(2)} M · routes ${r.rideVisibility.routes}`,
    `payoff ${r.payoff}`, `route: ${r.route}`, `photo: ${r.evidence.class} ${r.evidence.obliquityDeg ?? ''}°`, panoNote.slice(0, 40)];
  const svg = `<svg width="${LABEL}" height="${H}"><rect width="100%" height="100%" fill="#111"/>${label.map((l, i) => `<text x="12" y="${32 + i * 36}" font-family="Helvetica" font-size="${i === 0 ? 19 : 16}" fill="${i === 0 ? '#fff' : '#bbb'}">${esc(l)}</text>`).join('')}</svg>`;
  const row = await sharp({ create: { width: LABEL + 2 * W + 20, height: H, channels: 3, background: '#111' } })
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }, { input: await fitted(front, 'no preview'), left: LABEL + 5, top: 0 }, { input: await fitted(pano, panoNote), left: LABEL + W + 15, top: 0 }]).png().toBuffer();
  tiles.push(row);
  console.log(`${r.rank} ${r.id} front ${front ? 'ok' : '-'} pano ${pano ? 'ok' : '-'}`);
}
const header = (n: number) => Buffer.from(`<svg width="${LABEL + 2 * W + 20}" height="40"><rect width="100%" height="100%" fill="#000"/><text x="12" y="27" font-family="Helvetica" font-size="20" fill="#fff">Ordinary backlog top ${TOP}, sheet ${n}: label · today (house:preview, game route) · panorama (Gemeente Amsterdam, CC BY 4.0)</text></svg>`);
for (let s = 0; s * 10 < tiles.length; s++) {
  const part = tiles.slice(s * 10, s * 10 + 10);
  const sheet = sharp({ create: { width: LABEL + 2 * W + 20, height: 40 + part.length * (H + 6), channels: 3, background: '#000' } })
    .composite([{ input: header(s + 1), left: 0, top: 0 }, ...part.map((t, i) => ({ input: t, left: 0, top: 40 + i * (H + 6) }))]);
  const file = path.join(OUT, `sheet-${String(s + 1).padStart(2, '0')}.jpg`);
  await sheet.jpeg({ quality: 82 }).toFile(file);
  console.log(`wrote ${path.relative(ROOT, file)}`);
}
