/**
 * Lane H7 (#354): the Nassaukade demo bundle for the judgement session's explainer page.
 *
 *   node --import tsx scripts/house-specs/pilot-20261110/demo-bundle.ts [--out artifacts/house-line/demo-nassaukade]
 *
 * Reads what the pilot already produced (nothing is rendered here): per pand the before preview
 * (artifacts/house-line/pilot/<pand>/before), the after preview (artifacts/house-preview/<pand>, the house:stage receipt,
 * or artifacts/house-line/pilot/<pand>/after for the chunk route), the hand spec and readings, and the staged extract
 * record; writes per pand photo.png, before.png, after.png, compare-before.png, compare-after.png, triptych.jpg,
 * measure-before.json, measure-after.json, spec.json (hand spec + resolved staged record with its winning sources),
 * fields.json; plus index.json for the row.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const out = path.resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(ROOT, 'artifacts/house-line/demo-nassaukade'));
const PILOT = path.join(ROOT, 'scripts/house-specs/pilot-20261110');
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readings = readJson(path.join(PILOT, 'readings.json'));
const ROW: { pand: string; address: string; route: 'recipe' | 'chunk' | 'none'; afterDir?: string; note?: string }[] = [
  { pand: '0363100012116526', address: 'Nassaukade 151-152 (corner)', route: 'chunk', afterDir: 'artifacts/house-line/pilot/0363100012116526/after', note: 'multi-front pand: the Nassaukade front added to chunk-face-clercq-236681 (block-face route), not a HouseSpec; installs with the clercq chunk' },
  { pand: '0363100012164843', address: 'Nassaukade 150', route: 'recipe' },
  { pand: '0363100012161422', address: 'Nassaukade 149', route: 'recipe' },
  { pand: '0363100012157426', address: 'Nassaukade 148', route: 'recipe' },
  { pand: '0363100012160273', address: 'Nassaukade 147', route: 'recipe' },
  { pand: '0363100012160704', address: 'Nassaukade 146', route: 'none', note: 'not staged: its resolved spec fails the recipe compile ("Opening escapes its wall": BAG draws the erker into the footprint, a 1.61 m front; only the block-face route has the bay-outline chord), so a staged spec would stop the publish batch' },
  { pand: '0363100012159694', address: 'Nassaukade 145', route: 'recipe' },
];

// What a design field changes on the render, in one line (the fields the recipe route reads).
const WHAT: Record<string, string> = {
  gable: 'the crown: stepped, neck, bell or a cornice line', crownSteps: 'steps per side of the stepped crown', crownRise: 'height of the crown above the eaves',
  storeys: 'number of full street storeys', bays: 'window axes per storey', doorBay: 'which axis holds the door', basement: 'souterrain/stoop treatment of the base',
  souterrain: 'half-sunk storey under the bel-etage', tallGround: 'taller ground storey', cornice: 'cornice style at the eaves', windows: 'window kind (T-window, sash, cross...)',
  windowSurround: 'surrounds round each window (keystone, eared...)', windowSills: 'sill style (consoles...)', storeyHeights: 'storey heights in metres', windowHeights: 'window height as a share of each storey',
  headLines: 'window head line per storey', balconies: 'balconies: which storeys/axes, timber-bracketed, turned rails', hoist: 'hoist beam in the crown', windowHead: 'arched/relieving heads with arch ring, springers, keystone',
  surroundStoreys: 'storeys that carry window surrounds', atticWindows: 'windows in the crown', dormers: 'dormer count', dormerStyle: 'dormer form (pediment...)', dormerAt: 'dormer positions along the front',
  bands: 'white painted bands (speklagen) at lintel and sill lines', bandLines: 'band heights', bandHeights: 'band depths', bandTransomAt: 'band at the transom line', bayWidths: 'per-axis widths', bayWindows: 'bay window (erker) on the front',
  shopfront: 'shop front: glazing, fascia, stallriser', partyClip: 'clip the front at the party walls', styleStoreys: 'storeys that take the type style', storeyBays: 'axes per storey', courseStoreys: 'brick coursing per storey', mirrorFront: 'mirror the layout',
  brick: 'wall colour', wallMaterial: 'wall finish (painted brick keeps the measured tint, no lightness clamp)', frame: 'window frame colour', door: 'door colour', stone: 'stone/dressing colour', material: 'roof material', stoneMaterial: 'dressing material',
};
const what = (field: string) => WHAT[field.split('/').pop()!] ?? 'design field read by the recipe compiler';

function stagedRecord(pand: string) {
  const dir = path.join(ROOT, 'public/data/extracts/amsterdam/staging/house-specs/14');
  for (const x of fs.readdirSync(dir)) for (const y of fs.readdirSync(path.join(dir, x))) {
    const t = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, x, y))).toString());
    const r = t.buildings[`NL.IMBAG.Pand.${pand}`];
    if (r) return { tile: `${x}/${y.replace('.json.gz', '')}`, ...r };
  }
  return null;
}
const refOf = (source: string, field: string, hand: any, pand: string) =>
  source === 'author' || source === 'reviewed' ? hand?.provenance?.[field]?.ref ?? 'scripts/house-specs/pilot-20261110/readings.json'
    : source === 'streetlevel-measured' ? `scripts/block-face/faces/nassau-145-152/intent.json house ${pand} (kit lane 2026-10-14; strip 2024-11-21, 80 px/m crops)`
      : source === 'monument-text' ? 'public/data/extracts/amsterdam/monument-facts.json' : source;

async function triptych(files: { file: string; label: string }[], to: string, H = 900) {
  const parts = await Promise.all(files.filter(f => fs.existsSync(f.file)).map(async f => {
    const b = await sharp(f.file).resize({ height: H - 40 }).png().toBuffer(), m = await sharp(b).metadata();
    const label = Buffer.from(`<svg width="${m.width}" height="40"><text x="6" y="27" font-family="Helvetica" font-size="22" fill="#222">${f.label}</text></svg>`);
    return { b, label, w: m.width! };
  }));
  const W = parts.reduce((s, p) => s + p.w + 12, 12);
  let x = 12; const comp: sharp.OverlayOptions[] = [];
  for (const p of parts) { comp.push({ input: p.label, left: x, top: 0 }, { input: p.b, left: x, top: 40 }); x += p.w + 12; }
  const sheet = await sharp({ create: { width: W, height: H, channels: 3, background: '#f4f3ef' } }).composite(comp).png().toBuffer();
  await sharp(sheet).resize({ width: Math.min(W, 1600), withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(to);
}

const index: unknown[] = [];
for (const h of ROW) {
  const d = path.join(out, h.pand); fs.mkdirSync(d, { recursive: true });
  const before = path.join(ROOT, 'artifacts/house-line/pilot', h.pand, 'before');
  const after = h.route === 'none' ? null : path.join(ROOT, h.afterDir ?? path.join('artifacts/house-preview', h.pand));
  const cp = (from: string, to: string) => { if (fs.existsSync(from)) fs.copyFileSync(from, path.join(d, to)); };
  cp(path.join(before, 'photo.png'), 'photo.png'); cp(path.join(before, 'front.png'), 'before.png'); cp(path.join(before, 'compare.png'), 'compare-before.png'); cp(path.join(before, 'measure.json'), 'measure-before.json');
  if (after) { cp(path.join(after, 'front.png'), 'after.png'); cp(path.join(after, 'compare.png'), 'compare-after.png'); cp(path.join(after, 'measure.json'), 'measure-after.json'); cp(path.join(after, 'threeq.png'), 'threeq-after.png'); }
  await triptych([{ file: path.join(d, 'before.png'), label: 'game today' }, { file: path.join(d, 'after.png'), label: h.route === 'chunk' ? 'after (clercq chunk + Nassaukade front)' : 'after (spec, recipe route)' }, { file: path.join(d, 'photo.png'), label: 'photo (strip 2024-11-21)' }], path.join(d, 'triptych.jpg'));
  const handFile = path.join(PILOT, 'specs', `${h.pand}.json`), hand = fs.existsSync(handFile) ? readJson(handFile) : null;
  const rec = h.route === 'recipe' ? stagedRecord(h.pand) : null;
  fs.writeFileSync(path.join(d, 'spec.json'), JSON.stringify({ pandId: h.pand, address: h.address, route: h.route, note: h.note ?? null, handSpec: hand, reading: readings[h.pand] ?? null, resolved: rec }, null, 1) + '\n');
  // fields.json: every resolved design field the after render is drawn from (the generic before draws none of them).
  const fields: unknown[] = [];
  if (rec) {
    const design = rec.d ?? {};
    const push = (field: string, value: unknown) => { const source = rec.s?.[field] ?? rec.s?.[field.split('/').slice(0, 2).join('/')] ?? 'unknown'; fields.push({ field, value, source, evidence: refOf(source, field, hand, h.pand), changed: what(field) }); };
    (design.fronts ?? []).forEach((f: Record<string, unknown>, i: number) => { for (const [k, v] of Object.entries(f)) if (k !== 'id' && k !== 'street') push(`fronts/${i}/${k}`, v); });
    for (const sec of ['roof', 'palette']) for (const [k, v] of Object.entries(design[sec] ?? {})) push(`${sec}/${k}`, v);
  } else if (h.route === 'chunk') {
    const face = readJson(path.join(ROOT, 'scripts/block-face/faces/clercq-236681/intent.json'));
    const f = face.houses.find((x: { pandId: string }) => x.pandId === h.pand).design.fronts.find((x: { id: string }) => x.id === 'nassaukade');
    for (const [k, v] of Object.entries(f)) if (k !== 'id' && k !== 'street') fields.push({ field: `fronts/1/${k}`, value: v, source: 'streetlevel-measured', evidence: 'scripts/block-face/faces/nassau-145-152/intent.json house 0363100012116526 (strip 2024-11-21), copied to clercq-236681 front "nassaukade" by lane H7', changed: what(k) });
  }
  fs.writeFileSync(path.join(d, 'fields.json'), JSON.stringify(fields, null, 1) + '\n');
  const mb = fs.existsSync(path.join(d, 'measure-before.json')) ? readJson(path.join(d, 'measure-before.json')) : null, ma = fs.existsSync(path.join(d, 'measure-after.json')) ? readJson(path.join(d, 'measure-after.json')) : null;
  index.push({ pand: h.pand, address: h.address, route: h.route, note: h.note ?? null, fields: fields.length, verdictBefore: mb?.verdict?.verdict ?? null, verdictAfter: ma?.verdict?.verdict ?? null, wallBefore: mb?.render?.wall ?? null, wallAfter: ma?.render?.wall ?? null, wallPhoto: mb?.photo?.measure?.wall ?? null, reasonsAfter: ma?.verdict?.reasons ?? null, limits: hand?.schemaLimits ?? readings[h.pand]?.limits ?? [] });
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ row: 'Nassaukade 152-145 (face nassau-145-152)', batch: 'pilot-20261110', lane: 'H7 #354', houses: index }, null, 1) + '\n');
await triptych(ROW.filter(h => fs.existsSync(path.join(out, h.pand, 'triptych.jpg'))).map(h => ({ file: path.join(out, h.pand, 'after.png'), label: h.address.replace('Nassaukade ', '') })), path.join(out, 'row-after.jpg'), 700);
await triptych(ROW.map(h => ({ file: path.join(out, h.pand, 'before.png'), label: h.address.replace('Nassaukade ', '') })), path.join(out, 'row-before.jpg'), 700);
await triptych(ROW.map(h => ({ file: path.join(out, h.pand, 'photo.png'), label: h.address.replace('Nassaukade ', '') })), path.join(out, 'row-photo.jpg'), 700);
console.log(`demo bundle: ${path.relative(ROOT, out)} (${ROW.length} houses)`);
