/**
 * One street, every wall cut in order, laid end to end.
 *
 * Every other view in this pipeline shows one pand at a time, which is exactly the
 * wrong shape for the question "are the cuts in the right places?". A cut half a
 * door out looks fine alone and obvious beside its neighbours; a wall projected
 * onto the back of the building looks like a building until you see it sitting
 * between two façades.
 *
 * So: crop each band to its own bracket, drop the crops side by side in street
 * order at one scale, and let the street itself say whether the cuts land on the
 * party walls. A correct run reads as a continuous terrace of whole houses. A bad
 * cut shows as a sliver of the neighbour, a doubled window bay, or a building that
 * does not belong to the street at all.
 *
 * Usage: npx tsx scripts/facade-twin/build-street-cuts.ts [--street=Singel]
 *        [--manifest=manifest.wide1013-2026-09-06.json] [--ppm=26] [--per-row=9]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';

const CACHE = path.resolve('.cache/facade-twin');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const STREET = arg('street') ?? 'Singel';
const BANDS = path.join(CACHE, arg('bands') ?? 'number-bands');
const MANIFEST = arg('manifest') ?? 'manifest.wide1013-2026-09-06.json';
const PPM = Number(arg('ppm') ?? 26);
const PER_ROW = Number(arg('per-row') ?? 9);
const OUT = path.join(CACHE, 'street-cuts');

type Tile = { file: string; startM: number; lengthM: number };
type Band = {
  pandId: string; capturedAt: string; standoffM: number; obliquityDeg: number; spanM: number;
  wallStartM: number; wallEndM: number; origin: { x: number; y: number };
  direction: { x: number; y: number }; tiles: Tile[];
};
type Addr = { pandId: string | null; street: string; houseNumber: number; display?: string; rd: { x: number; y: number } };

const manifest = JSON.parse(await readFile(path.join(BANDS, MANIFEST), 'utf8')).bands as Band[];
const addresses = JSON.parse(await readFile(path.join(CACHE, 'address-points.json'), 'utf8')).addresses as Addr[];
const anchors = (JSON.parse(await readFile(path.join(BANDS, 'anchors.json'), 'utf8')).panden ?? []) as
  Array<{ pandId: string; verdict: string }>;
const verdictOf = new Map(anchors.map(a => [a.pandId, a.verdict]));

const own = new Map<string, Addr[]>();
for (const a of addresses) if (a.pandId) (own.get(a.pandId) ?? own.set(a.pandId, []).get(a.pandId)!).push(a);

/** How far the pand's own nearest address point sits behind the wall we projected. */
const depthOf = (b: Band) => {
  const mine = own.get(b.pandId);
  if (!mine?.length) return null;
  const { x: ox, y: oy } = b.origin, { x: dx, y: dy } = b.direction;
  return mine
    .map(a => -((a.rd.x - ox) * -dy + (a.rd.y - oy) * dx))
    .reduce((best, v) => (Math.abs(v) < Math.abs(best) ? v : best));
};

const onStreet = manifest
  .map(b => {
    const mine = (own.get(b.pandId) ?? []).filter(a => a.street === STREET);
    if (!mine.length) return null;
    const number = Math.min(...mine.map(a => a.houseNumber));
    return { b, number, parity: number % 2 === 0 ? 'even' : 'odd', depth: depthOf(b) };
  })
  .filter((v): v is NonNullable<typeof v> => v != null)
  .sort((a, b) => a.number - b.number);

/** The band cropped to its own bracket, at a common scale. */
const cut = async (b: Band) => {
  const from = b.wallStartM, to = b.wallEndM;
  const width = Math.max(1, Math.round((to - from) * PPM));
  const height = Math.round(3.6 * PPM);
  const out = Buffer.alloc(width * height * 4, 0x14);
  for (const t of b.tiles) {
    if (t.startM + t.lengthM < from || t.startM > to) continue;
    let raw;
    try { raw = jpeg.decode(await readFile(path.join(BANDS, t.file)), { useTArray: true, formatAsRGBA: true }); }
    catch { continue; }
    for (let x = 0; x < width; x++) {
      const m = from + (x / width) * (to - from);
      if (m < t.startM || m > t.startM + t.lengthM) continue;
      const sx = Math.min(raw.width - 1, Math.round(((m - t.startM) / t.lengthM) * raw.width));
      for (let y = 0; y < height; y++) {
        const sy = Math.min(raw.height - 1, Math.round((y / height) * raw.height));
        const s = (sy * raw.width + sx) * 4, d = (y * width + x) * 4;
        out[d] = raw.data[s]; out[d + 1] = raw.data[s + 1]; out[d + 2] = raw.data[s + 2]; out[d + 3] = 255;
      }
    }
  }
  return { data: jpeg.encode({ width, height, data: out }, 86).data, width, height };
};

const side = async (rows: typeof onStreet, label: string) => {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += PER_ROW) {
    const run = rows.slice(i, i + PER_ROW);
    const cells: string[] = [];
    for (const r of run) {
      const img = await cut(r.b);
      const wide = r.b.wallEndM - r.b.wallStartM;
      const depth = r.depth;
      const flag = depth == null ? '' : Math.abs(depth) >= 12 ? 'wrong' : Math.abs(depth) >= 6 ? 'doubt' : '';
      cells.push(`<figure class="cell ${flag}" style="flex:${wide.toFixed(2)} 0 auto">
        <img src="data:image/jpeg;base64,${img.data.toString('base64')}" alt="">
        <figcaption><b>${r.number}</b><span>${wide.toFixed(1)} m</span>${
          flag ? `<em title="the pand's own address sits ${Math.abs(depth!).toFixed(0)} m from this wall">${
            flag === 'wrong' ? `${Math.abs(depth!).toFixed(0)} m off` : 'doubtful'}</em>` : ''}</figcaption>
      </figure>`);
    }
    out.push(`<div class="run">${cells.join('')}</div>`);
  }
  return `<h2>${label} <span class="n">${rows.length} cuts</span></h2>${out.join('\n')}`;
};

const odd = onStreet.filter(r => r.parity === 'odd');
const even = onStreet.filter(r => r.parity === 'even');
const suspect = onStreet.filter(r => r.depth != null && Math.abs(r.depth) >= 6).length;

const page = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${STREET} Wall Cuts</title>
<style>
  :root { --paper:#f7f5f0; --ink:#191920; --dim:#4d4d57; --faint:#8b867e; --rule:#ded8cb;
          --well:#141418; --good:#2f7d4f; --doubt:#c98a1e; --wrong:#b83a2b; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper:#121217; --ink:#eceaf1; --dim:#a7a4b2; --faint:#75717e; --rule:#2a2a33;
    --well:#0a0a0d; --good:#4fbf7d; --doubt:#e0ad4a; --wrong:#f0705c; } }
  :root[data-theme="dark"] { --paper:#121217; --ink:#eceaf1; --dim:#a7a4b2; --faint:#75717e;
    --rule:#2a2a33; --well:#0a0a0d; --good:#4fbf7d; --doubt:#e0ad4a; --wrong:#f0705c; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font:15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:1400px; margin:0 auto; padding:34px 20px 80px; }
  h1 { font-size:28px; margin:0 0 8px; letter-spacing:-.01em; }
  .lede { max-width:66ch; color:var(--dim); margin:0 0 8px; }
  .look { max-width:66ch; margin:0 0 26px; padding:13px 15px; border-left:3px solid var(--good);
          background:color-mix(in srgb, var(--good) 9%, transparent); border-radius:0 3px 3px 0; }
  .look ul { margin:7px 0 0; padding-left:19px; } .look li { margin:3px 0; }
  h2 { font-size:17px; margin:30px 0 10px; font-weight:650; border-top:1px solid var(--rule); padding-top:18px; }
  .n { color:var(--faint); font-weight:400; font-size:13px; }
  .run { display:flex; align-items:flex-end; gap:3px; margin:0 0 14px; overflow-x:auto; padding-bottom:2px; }
  .cell { margin:0; min-width:0; }
  .cell img { display:block; width:100%; height:auto; background:var(--well); border-radius:2px 2px 0 0; }
  figcaption { display:flex; gap:6px; align-items:baseline; flex-wrap:wrap;
               font-size:11.5px; padding:3px 4px 0; border-top:2px solid var(--good);
               font-variant-numeric:tabular-nums; }
  figcaption b { font-size:13px; } figcaption span { color:var(--faint); }
  figcaption em { font-style:normal; color:var(--doubt); font-weight:600; }
  .cell.doubt figcaption { border-top-color:var(--doubt); }
  .cell.wrong figcaption { border-top-color:var(--wrong); }
  .cell.wrong figcaption em { color:var(--wrong); }
</style>
<main>
  <h1>${STREET} Wall Cuts</h1>
  <p class="lede">Every band on ${STREET}, cropped to <i>exactly</i> the wall we projected for that
  house, dropped side by side in number order at one scale. Widths are true: a 6 m frontage is
  drawn twice as wide as a 3 m one. Nothing here is stitched — each crop is an independent cut,
  and they only line up if the cuts are right.</p>
  <div class="look"><b>What a correct run looks like:</b> a continuous terrace of whole houses,
  each crop starting and ending on a party wall.
  <ul>
    <li><b>A cut half a bay out</b> shows as a sliver of the neighbour at one edge — and the same
    sliver repeated on the next crop.</li>
    <li><b>A wall on the wrong side of the building</b> shows as brick with no door, or a façade
    that plainly belongs to another street. Those are marked in red with how far the house's own
    address sits from the wall we drew.</li>
    <li><b>Numbers jumping</b> between neighbours means the ordering or the cut is wrong.</li>
  </ul></div>
  ${await side(odd, `${STREET} — odd side`)}
  ${await side(even, `${STREET} — even side`)}
  <h2>How many are doubtful <span class="n">${suspect} of ${onStreet.length}</span></h2>
  <p class="lede">A wall projected for a house should have that house's own address point a few
  metres behind it — the depth from façade to the middle of the flat. Amber marks 6–12 m, red 12 m
  or more, which is a different building. This needs no image at all, so it is checkable everywhere,
  and it is the test that caught Singel 279 sitting on its own back wall on Spuistraat.</p>
</main>`;

await mkdir(OUT, { recursive: true });
const file = path.join(OUT, `${STREET.toLowerCase()}.html`);
await writeFile(file, page);
console.log(`${onStreet.length} cuts on ${STREET} (${odd.length} odd, ${even.length} even), ${suspect} doubtful`);
console.log(`→ ${path.relative(process.cwd(), file)}`);
