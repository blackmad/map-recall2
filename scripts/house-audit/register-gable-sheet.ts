// Before/after sheet for the register gable gate (lane H5h round 4, #351): per house the archived street crop (when there is
// one), the generic front with the register gable drawn (REGISTER_GABLE=drawn) and gated (the default), from house:preview
// renders made with HOUSE_SPECS_DIR=staging/house-specs.
//
//   node --import tsx scripts/house-audit/register-gable-sheet.ts --renders <dir with <id6>-drawn/front.png, <id6>-gated/front.png>
//        --pands id6,id6,... --out <dir> [--per-sheet 6]
//        [--before drawn --after gated]   render dir suffixes, and the audit modes their labels read
//        [--before-audit <json> --after-audit <json>]   audits the labels read (default artifacts/house-audit/register-gable-gate.json)
// Round 5 (ridge orientation): --before r4 --after r5 with the round-4 and round-5 audits, both labelled by their gated crown.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ARCHIVE = process.env.HOUSE_CROPS_ARCHIVE ?? path.join(os.homedir(), 'Code/map-recall2-source-data-h5h');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function cell(file: string | null, label: string, W = 300, H = 380) {
  const img = file && fs.existsSync(file) ? await sharp(file).resize({ width: W, height: H - 40, fit: 'contain', background: '#111' }).toBuffer() : null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="40"><rect width="${W}" height="40" fill="#1d1d1d"/><text x="6" y="26" font-size="16" font-family="Helvetica" fill="#fff">${esc(label)}</text></svg>`;
  const parts = [{ input: Buffer.from(svg), left: 0, top: H - 40 }, ...(img ? [{ input: img, left: 0, top: 0 }] : [])];
  if (!img) parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H - 40}"><text x="${W / 2}" y="${(H - 40) / 2}" text-anchor="middle" font-size="16" font-family="Helvetica" fill="#888">no archived photo</text></svg>`), left: 0, top: 0 });
  return sharp({ create: { width: W, height: H, channels: 3, background: '#111' } }).composite(parts).png().toBuffer();
}

async function main() {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const renders = opt('renders')!, ids = opt('pands')!.split(','), out = opt('out')!, per = Number(opt('per-sheet') ?? 6);
  const before = opt('before') ?? 'drawn', after = opt('after') ?? 'gated';
  const audit = (f?: string) => new Map<string, any>(JSON.parse(fs.readFileSync(f ?? path.join(ROOT, 'artifacts/house-audit/register-gable-gate.json'), 'utf8')).rows.map((r: any) => [r.id.slice(-6), r]));
  const byId = audit(opt('before-audit')), afterById = opt('after-audit') ? audit(opt('after-audit')) : byId;
  const crown = (r: any, m: string) => r?.crown?.[m] ?? r?.crown?.gated;
  fs.mkdirSync(out, { recursive: true });
  for (let s = 0; s * per < ids.length; s++) {
    const rows: Buffer[] = [];
    for (const id of ids.slice(s * per, (s + 1) * per)) {
      const r = byId.get(id); const full = r.id.slice(-16);
      const photo = path.join(ARCHIVE, 'pand-crops', full, 'front.jpg');
      const cells = [await cell(fs.existsSync(photo) ? photo : null, `${id} photo${r.hand ? ` (read: ${r.hand})` : ''}`), await cell(path.join(renders, `${id}-${before}/front.png`), `before: ${crown(r, before)} (register ${r.register})`), await cell(path.join(renders, `${id}-${after}/front.png`), `after: ${crown(afterById.get(id), after)}`)];
      rows.push(await sharp({ create: { width: 3 * 300 + 2 * 6, height: 380, channels: 3, background: '#000' } }).composite(cells.map((c, i) => ({ input: c, left: i * 306, top: 0 }))).png().toBuffer());
    }
    const sheet = await sharp({ create: { width: 2 * (912) + 12, height: Math.ceil(rows.length / 2) * 386, channels: 3, background: '#000' } }).composite(rows.map((r, i) => ({ input: r, left: (i % 2) * 924, top: Math.floor(i / 2) * 386 }))).jpeg({ quality: 78 }).toBuffer();
    const f = path.join(out, `before-after-${s + 1}.jpg`); fs.writeFileSync(f, sheet); console.log(`${f} ${(sheet.length / 1024).toFixed(0)} kB`);
  }
}
await main();
