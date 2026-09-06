/**
 * The conflicts, as pictures, with every claim marked in place.
 *
 * Identity is 85% and the seven failures are all displaced by roughly one canal
 * frontage. Three explanations have been tested and closed — a block-wide shift
 * (§25), the choice of front wall (§26b), and the per-frame pose, which cannot be
 * tested at all because 400 bands use 397 distinct panoramas (§26c). What is left
 * is a question a person answers faster than a statistic: *is this the house next
 * door, or is it the right house with the wrong plate on it?*
 *
 * So each conflict is drawn as one continuous band at a common scale, with the
 * things that disagree marked where they actually are:
 *
 *   - a green bracket for the wall we projected, from `wallStartM` to `wallEndM`;
 *   - a red mark where the plate was read, labelled with what it said;
 *   - a blue mark where BAG puts the number that was read;
 *   - a grey mark where BAG puts the number we believe this building carries.
 *
 * The band deliberately carries about 0.7 of a frontage of context on each side,
 * so a neighbour's door is *expected* to be in shot. That is the whole reason a
 * plate near a party wall settles nothing (§21), and it is why the bracket
 * matters more than the picture: the question is never "is there a door" but
 * "whose door is inside our span".
 *
 * Self-contained HTML with the imagery embedded, because a review page that needs
 * a server running beside it does not get looked at, and because the panoramas
 * are CC BY 4.0.
 *
 * Usage: npx tsx scripts/facade-twin/build-conflict-sheet.ts [--verdict=conflict] [--limit=12]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';

const CACHE = path.resolve('.cache/facade-twin');
const BANDS = path.join(CACHE, 'number-bands');
const OUT = path.join(CACHE, 'conflict-sheet');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const WANT = arg('verdict') ?? 'conflict';
const LIMIT = Number(arg('limit') ?? 12);

// One scale for every band, so a metre is the same width on every row and the
// displacements can be compared by eye across buildings.
const PPM = 40;

type Tile = { file: string; startM: number; lengthM: number; width: number; height: number; pixelsPerMetre: number };
type Band = {
  pandId: string; panoramaId: string; capturedAt: string; standoffM: number; obliquityDeg: number;
  origin: { x: number; y: number }; direction: { x: number; y: number };
  spanM: number; wallStartM: number; wallEndM: number; baseZ: number; topZ: number; tiles: Tile[];
};
type Address = { street: string; houseNumber: number; display: string; pandId: string | null; rd: { x: number; y: number } };

/**
 * The bands are drawn from a manifest and annotated from anchors, so the sheet is
 * only honest if both came from one render. `check-number-anchors` stamps the pair
 * it used into anchors.json; this refuses when the manifest it is given is not that
 * one, because the failure is a picture of one photograph marked up from another
 * and nothing on the page would show it.
 */
const manifestFile = arg('manifest') ?? 'manifest.json';
const manifest = JSON.parse(await readFile(path.join(BANDS, manifestFile), 'utf8')).bands as Band[];
const anchorFile = JSON.parse(await readFile(path.join(BANDS, 'anchors.json'), 'utf8'));
const stamped = anchorFile.metadata?.source?.manifest as string | undefined;
if (stamped && stamped !== manifestFile) {
  console.error(`anchors.json was built against ${stamped}, not ${manifestFile}.`
    + ` Drawing one render's bands with another's marks would look fine and be wrong.`
    + ` Re-run check-number-anchors, or pass --manifest=${stamped}.`);
  process.exit(2);
}
const PROVENANCE = `${manifestFile}${stamped ? '' : ' (anchors.json predates provenance stamping)'}`;
const anchors = anchorFile.panden as Array<{
  pandId: string; verdict: string; ownNumbers: number[]; wallSpanM: [number, number];
  readings: Array<{ text: string; confidence: number; alongM: number; heightM: number; glyph: string; offsetM: number; isOwn: boolean; insideWall: boolean; address: string }>;
}>;
const addresses = JSON.parse(await readFile(path.join(CACHE, 'address-points.json'), 'utf8')).addresses as Address[];
const recon = JSON.parse(await readFile(path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId, 'recon.json'), 'utf8'));
const shape = new Map<string, { w: number; d: number; year: number }>(
  recon.buildings.map((b: any) => [b.buildingId, { w: b.plotWidthM, d: b.plotDepthM, year: b.constructionYear }]));

const bandOf = new Map(manifest.map(b => [b.pandId, b]));
const streetOf = new Map<string, string>();
const numbersOf = new Map<string, Address[]>();
for (const a of addresses) {
  if (!a.pandId) continue;
  (numbersOf.get(a.pandId) ?? numbersOf.set(a.pandId, []).get(a.pandId)!).push(a);
  if (!streetOf.has(a.pandId)) streetOf.set(a.pandId, a.street);
}

/** Draw the band's tiles into one strip at a common scale, nearest-neighbour. */
async function strip(band: Band) {
  const width = Math.round(band.spanM * PPM);
  const height = Math.round((band.topZ - band.baseZ) * PPM);
  const out = new Uint8ClampedArray(width * height * 4).fill(28);
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  for (const t of band.tiles) {
    let raw;
    try { raw = jpeg.decode(await readFile(path.join(BANDS, t.file)), { useTArray: true }); }
    catch { continue; }
    for (let y = 0; y < height; y++) {
      const sy = Math.round((y / height) * raw.height);
      if (sy < 0 || sy >= raw.height) continue;
      for (let x = 0; x < t.lengthM * PPM; x++) {
        const dx = Math.round(t.startM * PPM) + x;
        if (dx < 0 || dx >= width) continue;
        const sx = Math.round((x / (t.lengthM * PPM)) * raw.width);
        if (sx < 0 || sx >= raw.width) continue;
        const s = (sy * raw.width + sx) * 4, d = (y * width + dx) * 4;
        out[d] = raw.data[s]; out[d + 1] = raw.data[s + 1]; out[d + 2] = raw.data[s + 2]; out[d + 3] = 255;
      }
    }
  }
  return { data: Buffer.from(jpeg.encode({ width, height, data: Buffer.from(out) }, 86).data), width, height };
}

const alongOf = (band: Band, a: Address) =>
  (a.rd.x - band.origin.x) * band.direction.x + (a.rd.y - band.origin.y) * band.direction.y;

await mkdir(OUT, { recursive: true });
const rows: string[] = [];
const chosen = anchors.filter(a => a.verdict === WANT).slice(0, LIMIT);

for (const rec of chosen) {
  const band = bandOf.get(rec.pandId);
  if (!band) continue;
  const img = await strip(band);
  const street = streetOf.get(rec.pandId) ?? '';
  const own = numbersOf.get(rec.pandId) ?? [];
  const read = rec.readings.filter(r => Number.isFinite(Number(r.text)));

  // Every address point that lands in this band's span, so the reader can see
  // the whole numbering context rather than only the two numbers in dispute.
  const nearby = addresses
    .map(a => ({ a, along: alongOf(band, a) }))
    .filter(p => p.along > -2 && p.along < band.spanM + 2)
    // 20 m behind the wall, matching check-number-anchors. Drawn at 40 m this
    // page pinned eight Spuistraat addresses onto a Singel facade.
    .filter(p => Math.abs((p.a.rd.x - band.origin.x) * -band.direction.y + (p.a.rd.y - band.origin.y) * band.direction.x) <= 20)
    .sort((p, q) => p.along - q.along);

  const pct = (m: number) => `${(100 * m / band.spanM).toFixed(3)}%`;
  const marks: string[] = [];
  marks.push(`<div class="wall" style="left:${pct(band.wallStartM)};width:${pct(band.wallEndM - band.wallStartM)}"><span>our wall — ${street} ${rec.ownNumbers.join('/')}</span></div>`);
  for (const p of nearby) {
    const mine = p.a.pandId === rec.pandId;
    const wasRead = read.some(r => Number(r.text) === p.a.houseNumber);
    const cls = wasRead ? 'read' : mine ? 'mine' : 'other';
    marks.push(`<div class="pin ${cls}" style="left:${pct(p.along)}" title="${p.a.street} ${p.a.display}"><i></i><b>${p.a.display}</b></div>`);
  }
  // A doorplate and a painted shop sign are different instruments (§21): a
  // half-metre character is signage, and a business sign can name an address that
  // is not the building it hangs on. Drawn differently so they cannot be confused.
  for (const r of read) {
    const cls = r.glyph === 'doorplate' ? 'plate' : 'plate sign';
    marks.push(`<div class="${cls}" style="left:${pct(r.alongM)}"><i></i><b>${r.glyph === 'doorplate' ? '' : 'sign '}“${r.text}” ${(100 * r.confidence).toFixed(0)}%</b></div>`);
  }

  const sh = shape.get(rec.pandId);
  const disp = read.map(r => r.offsetM).filter(v => v != null);
  rows.push(`
<section>
  <h2>${street} ${rec.ownNumbers.join('/')} <span class="id">${rec.pandId.slice(-6)}</span></h2>
  <p class="meta">${sh ? `${sh.w?.toFixed(1)} m wide, ${sh.d?.toFixed(1)} m deep, built ${sh.year}. ` : ''}Standoff ${band.standoffM} m, obliquity ${band.obliquityDeg}°, ${band.capturedAt.slice(0, 10)}.
  ${read.length ? `Read ${read.map(r => `<b>“${r.text}”</b> (${r.glyph}, ${(100 * r.confidence).toFixed(0)}% confident) &rarr; ${r.address}, ${r.offsetM > 0 ? '+' : ''}${r.offsetM.toFixed(2)} m from where BAG puts it${r.insideWall ? ', <b>inside our wall</b>' : ', outside our wall'}`).join('; ')}.` : 'No matched reading.'}</p>
  <div class="band" style="aspect-ratio:${img.width} / ${img.height}">
    <img src="data:image/jpeg;base64,${img.data.toString('base64')}" alt="">
    ${marks.join('\n    ')}
  </div>
  <p class="scale">${band.spanM.toFixed(1)} m of frontage, ${band.baseZ.toFixed(1)}–${band.topZ.toFixed(1)} m NAP. A canal frontage is 5.7 m at the median.</p>
</section>`);
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const TITLE = WANT === 'conflict'
  ? `The ${WORDS[rows.length] ?? rows.length} Conflicts`
  : `${WORDS[rows.length] ?? rows.length} ${WANT} bands`;
const confirmed = anchors.filter(a => a.verdict === 'confirmed').length;
const conflicts = anchors.filter(a => a.verdict === 'conflict').length;
const IDENTITY = `${Math.round((100 * confirmed) / (confirmed + conflicts))}%`;

const html = `<!doctype html>
<meta charset="utf-8">
<title>${TITLE}</title>
<style>
  :root { --ink:#1b1b1f; --paper:#f6f4ef; --rule:#d8d2c6; --wall:#2f7d4f; --read:#c0392b; --mine:#6b6f76; }
  body { margin:0; background:var(--paper); color:var(--ink); font:15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:1180px; margin:0 auto; padding:32px 20px 64px; }
  h1 { font-size:28px; margin:0 0 6px; letter-spacing:-0.01em; }
  .lede { max-width:64ch; color:#4a4a52; margin:0 0 28px; }
  section { border-top:1px solid var(--rule); padding:22px 0 8px; }
  h2 { font-size:18px; margin:0 0 4px; font-weight:650; }
  .id { color:#9a958c; font-weight:400; font-size:14px; font-variant-numeric:tabular-nums; }
  .meta { margin:0 0 12px; color:#4a4a52; font-size:13.5px; }
  .scale { margin:6px 0 0; color:#8a857c; font-size:12.5px; }
  .band { position:relative; width:100%; background:#1c1c1e; border-radius:3px; overflow:hidden; }
  .band img { display:block; width:100%; height:100%; object-fit:fill; }
  .wall { position:absolute; top:0; bottom:0; border-left:2px solid var(--wall); border-right:2px solid var(--wall);
          background:rgba(47,125,79,.16); box-sizing:border-box; }
  .wall span { position:absolute; top:4px; left:4px; font-size:11px; color:#eafbf0; background:rgba(20,60,36,.85);
               padding:1px 5px; border-radius:2px; white-space:nowrap; }
  .pin, .plate { position:absolute; top:0; bottom:0; width:0; }
  .pin i, .plate i { position:absolute; top:0; bottom:0; left:-1px; width:2px; }
  .pin b, .plate b { position:absolute; font-size:10.5px; padding:1px 4px; border-radius:2px; white-space:nowrap;
                     transform:translateX(-50%); font-variant-numeric:tabular-nums; }
  .pin.other i { background:rgba(255,255,255,.35); } .pin.other b { bottom:2px; color:#e8e6e2; background:rgba(0,0,0,.55); }
  .pin.mine  i { background:#c9cdd4; } .pin.mine  b { bottom:2px; color:#12131a; background:#c9cdd4; }
  .pin.read  i { background:#5aa9ff; } .pin.read  b { bottom:18px; color:#04223f; background:#5aa9ff; }
  .plate i { background:var(--read); } .plate b { top:26px; color:#fff; background:var(--read); }
  .plate.sign i { background:#e08a2e; } .plate.sign b { top:44px; background:#e08a2e; color:#2b1a04; }
  .key { display:flex; gap:18px; flex-wrap:wrap; font-size:13px; color:#4a4a52; margin:0 0 26px; }
  .key i { display:inline-block; width:11px; height:11px; border-radius:2px; margin-right:6px; vertical-align:-1px; }
</style>
<main>
  <h1>${TITLE}</h1>
  <p class="lede">Identity is ${IDENTITY}. These are the panden where a legible house number named
  a building other than the one whose wall we projected. A block-wide shift, the choice of
  front wall, and the camera pose have each been tested and closed, so what is left is a
  question worth a person's eye: <b>is this the house next door, or the right house with a
  neighbour's plate in shot?</b> The band deliberately carries about 0.7 of a frontage of
  context on each side, so a neighbour's door being visible is expected — the question is
  whose door falls <i>inside the green bracket</i>.</p>
  <p class="key">
    <span><i style="background:rgba(47,125,79,.5);border:1px solid #2f7d4f"></i>the wall we projected</span>
    <span><i style="background:#c0392b"></i>a doorplate reading, with the recogniser's confidence</span>
    <span><i style="background:#e08a2e"></i>painted signage — a different instrument, and it may name another building</span>
    <span><i style="background:#5aa9ff"></i>where BAG puts the number that was read</span>
    <span><i style="background:#c9cdd4"></i>where BAG puts a number we believe this pand carries</span>
    <span><i style="background:rgba(255,255,255,.5);border:1px solid #999"></i>any other address in shot</span>
  </p>
  <p class="prov">Bands drawn from <code>${PROVENANCE}</code>, marks from the anchor pass over it.</p>
  ${rows.join('\n')}
</main>`;

const file = path.join(OUT, 'index.html');
await writeFile(file, html);
console.log(`\n  ${chosen.length} ${WANT} bands drawn`);
console.log(`  → ${path.relative(process.cwd(), file)}  (${(html.length / 1e6).toFixed(1)} MB)\n`);
