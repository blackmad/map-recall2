/**
 * Review strips for a factory batch: each house's contact sheet (photo | front | 3/4, as `large.ts` renders it) under a
 * header line (house, pand, name, triangles, gates, likeness per group), four houses per page so a page stays legible
 * when a reviewing model downsamples it, plus `strip.json` with the same rows for the verdict table.
 *
 *   node --import tsx scripts/building-recipes/strip.ts --houses=a,b,c --out=artifacts/strips/batch-1   [--per-page=4] [--width=1600]
 *   node --import tsx scripts/building-recipes/strip.ts --queue=public/canal-drive/landmark-factory-queue.json [--status=compiled] [--limit=20] --out=artifacts/strips/batch-1
 *
 * Writes <out>-1.png, <out>-2.png, ... and <out>.json. No browser: it composes the PNGs `large.ts` already wrote.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const HOUSES = 'scripts/building-recipes/houses', ARTIFACTS = 'artifacts/building-recipes';
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

interface Row { house: string; pand: string; name: string | null; triangles: number | null; gates: string; likeness: string; sheet: string | null; sheets: string[]; page: number }

function rowFor(house: string, pand?: string, name?: string | null): Row {
  const dir = path.join(ARTIFACTS, house), reportFile = path.join(dir, 'report.json');
  const report = fs.existsSync(reportFile) ? read(reportFile) : null;
  const intent = fs.existsSync(path.join(HOUSES, house, 'intent.json')) ? read(path.join(HOUSES, house, 'intent.json')) : null;
  // wall sheets first (fronts beside their photo), the aerial pair last
  const sheets = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^contact.*\.png$/.test(f)).sort((a, b) => Number(a.includes('aerial')) - Number(b.includes('aerial')) || a.localeCompare(b)) : [];
  const failing = (report?.gates ?? []).filter((g: any) => !g.pass && !g.advisory).map((g: any) => g.id);
  const likeness = (report?.likeness ?? []).map((g: any) => `g${g.group}${intent?.walls?.[g.group]?.street ? '*' : ''}:${g.verdict ?? g.likeness?.verdict ?? (g.status === 'no-photo' ? 'NO PHOTO' : '-')}`).join('  ');
  return {house, pand: pand ?? intent?.pandId ?? '', name: name ?? (intent?.address ?? null), triangles: report?.triangles ?? null, gates: report ? (failing.length ? `FAIL ${failing.join(',')}` : 'pass') : 'no report', likeness: likeness || 'no likeness', sheet: sheets.length ? path.join(dir, sheets[0]) : null, sheets: sheets.filter(f => !f.includes('aerial')).map(f => path.join(dir, f)), page: 0};
}

async function main() {
  const out = arg('out'); if (!out) throw Error('Use --out=<path without extension>');
  const perPage = Number(arg('per-page', '4')), width = Number(arg('width', '1600'));
  let rows: Row[];
  if (arg('queue')) {
    const status = arg('status', 'compiled'), limit = Number(arg('limit', '20'));
    rows = read(arg('queue')).items.filter((i: any) => i.house && i.status === status).slice(0, limit).map((i: any) => rowFor(i.house, i.pand, i.name));
  } else rows = arg('houses').split(',').filter(Boolean).map(h => rowFor(h));
  if (!rows.length) throw Error('no houses to strip');
  fs.mkdirSync(path.dirname(out), {recursive: true});
  const pages: string[] = [];
  for (let p = 0; p * perPage < rows.length; p++) {
    const slice = rows.slice(p * perPage, (p + 1) * perPage);
    const parts: {input: Buffer; top: number; left: number}[] = [];
    let y = 0;
    for (const r of slice) {
      r.page = p + 1;
      const header = `<svg width="${width}" height="44"><rect width="100%" height="100%" fill="#1f2328"/><text x="10" y="29" font-family="Helvetica, Arial" font-size="20" fill="#fff">${esc(`${r.house}  ·  ${r.pand}  ·  ${(r.name ?? '').slice(0, 48)}  ·  ${r.triangles ?? '?'} tris  ·  gates ${r.gates}  ·  ${r.likeness}`)}</text></svg>`;
      parts.push({input: Buffer.from(header), top: y, left: 0}); y += 44;
      // every wall sheet of the house (each front beside its photo); a placeholder when nothing was rendered
      const files = r.sheets.length ? r.sheets : r.sheet ? [r.sheet] : [];
      if (!files.length) {
        const img = await sharp({create: {width, height: 120, channels: 3, background: '#e8e4dc'}}).composite([{input: Buffer.from(`<svg width="${width}" height="120"><text x="20" y="70" font-family="Helvetica" font-size="26" fill="#7a2e2e">no contact sheet (compile with renders: large.ts --house=${esc(r.house)})</text></svg>`), top: 0, left: 0}]).png().toBuffer();
        parts.push({input: img, top: y, left: 0}); y += 126;
      }
      for (const f of files) {
        const img = await sharp(f).resize({width}).png().toBuffer(), m = await sharp(img).metadata();
        parts.push({input: img, top: y, left: 0}); y += m.height! + 6;
      }
      y += 6;
    }
    const file = `${out}-${p + 1}.png`;
    await sharp({create: {width, height: y, channels: 3, background: '#f4f4f2'}}).composite(parts).png().toFile(file);
    pages.push(file);
  }
  fs.writeFileSync(`${out}.json`, JSON.stringify({generatedAt: new Date().toISOString(), pages, rows, verdictTemplate: rows.map(r => ({house: r.house, pand: r.pand, outcome: 'pass | fix | hold | no-evidence', note: '', fix: {}}))}, null, 1) + '\n');
  console.log(`strip: ${rows.length} houses on ${pages.length} page(s): ${pages.join(', ')}; rows ${out}.json`);
}

await main();
