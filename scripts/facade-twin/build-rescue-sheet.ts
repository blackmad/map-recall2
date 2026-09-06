/**
 * The eleven bands the leaf-on rescue changed, before and after.
 *
 * §33 readmitted leaf-on views when nothing leaf-off reaches the legibility floor,
 * and it moved these eleven from a median 81 px/m at 15.3 m to 258 px/m at 4.4 m.
 * The trade it makes is honest in one direction only: a 63 px/m frame is illegible
 * with certainty, while a May frame at 4.5 m *may* have a tree across the door.
 *
 * No statistic settles that. A person looking at the two strips settles it in a
 * second, which is what this page is for: the old view above, the new one below,
 * at the same scale, with the projected wall bracketed on both.
 *
 * Usage: npx tsx scripts/facade-twin/build-rescue-sheet.ts
 *        [--before=number-bands-minppm150] [--after=number-bands-leafon]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';

const CACHE = path.resolve('.cache/facade-twin');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const BEFORE = arg('before') ?? 'number-bands-minppm150';
const AFTER = arg('after') ?? 'number-bands-leafon';
const OUT = path.join(CACHE, 'rescue-sheet');

type Tile = { file: string; startM: number; lengthM: number; width: number; height: number; nativePixelsPerMetre: number };
type Band = {
  pandId: string; panoramaId: string; capturedAt: string; standoffM: number; obliquityDeg: number;
  spanM: number; wallStartM: number; wallEndM: number; tiles: Tile[];
};

const load = async (dir: string) => {
  const m = JSON.parse(await readFile(path.join(CACHE, dir, 'manifest.json'), 'utf8')).bands as Band[];
  return new Map(m.map(b => [b.pandId, b]));
};
const before = await load(BEFORE);
const after = await load(AFTER);
const ppm = (b: Band) => Math.max(...b.tiles.map(t => t.nativePixelsPerMetre), 0);

const changed = [...after.keys()]
  .filter(id => before.has(id) && before.get(id)!.panoramaId !== after.get(id)!.panoramaId)
  .sort((a, b) => ppm(after.get(b)!) - ppm(after.get(a)!));

const addresses = JSON.parse(await readFile(path.join(CACHE, 'address-points.json'), 'utf8')).addresses as
  Array<{ pandId: string | null; street: string; houseNumber: number }>;
const nameOf = new Map<string, string>();
for (const a of addresses) if (a.pandId && !nameOf.has(a.pandId)) nameOf.set(a.pandId, `${a.street} ${a.houseNumber}`);

/** One band drawn as a single strip, so the two are directly comparable. */
const strip = async (dir: string, band: Band, ppmOut: number) => {
  const width = Math.round(band.spanM * ppmOut);
  const height = Math.round(2.2 * ppmOut);
  const out = Buffer.alloc(width * height * 4, 0x11);
  for (const t of band.tiles) {
    let raw;
    try { raw = jpeg.decode(await readFile(path.join(CACHE, dir, t.file)), { useTArray: true, formatAsRGBA: true }); }
    catch { continue; }
    const x0 = Math.round(t.startM * ppmOut);
    for (let y = 0; y < height; y++) {
      const sy = Math.min(raw.height - 1, Math.round((y / height) * raw.height));
      for (let x = 0; x < Math.round(t.lengthM * ppmOut); x++) {
        const dx = x0 + x;
        if (dx < 0 || dx >= width) continue;
        const sx = Math.min(raw.width - 1, Math.round((x / (t.lengthM * ppmOut)) * raw.width));
        const s = (sy * raw.width + sx) * 4, d = (y * width + dx) * 4;
        out[d] = raw.data[s]; out[d + 1] = raw.data[s + 1]; out[d + 2] = raw.data[s + 2]; out[d + 3] = 255;
      }
    }
  }
  return { data: jpeg.encode({ width, height, data: out }, 88).data, width, height };
};

const rows: string[] = [];
for (const id of changed) {
  const b = before.get(id)!, a = after.get(id)!;
  const PPM = 34;
  const [sb, sa] = [await strip(BEFORE, b, PPM), await strip(AFTER, a, PPM)];
  const bracket = (band: Band) =>
    `<div class="wall" style="left:${(100 * band.wallStartM) / band.spanM}%;width:${(100 * (band.wallEndM - band.wallStartM)) / band.spanM}%"></div>`;
  const pane = (band: Band, s: { data: Buffer; width: number; height: number }, label: string, cls: string) => `
  <figure class="${cls}">
    <figcaption>${label} — <b>${ppm(band).toFixed(0)} px/m</b>, ${band.standoffM} m away, ${band.obliquityDeg}° off square, ${band.capturedAt.slice(0, 10)}</figcaption>
    <div class="band" style="aspect-ratio:${s.width} / ${s.height}">
      <img src="data:image/jpeg;base64,${s.data.toString('base64')}" alt="">
      ${bracket(band)}
    </div>
  </figure>`;
  rows.push(`
<section>
  <h2>${nameOf.get(id) ?? id} <span class="id">${id.slice(-6)}</span></h2>
  ${pane(b, sb, 'was', 'was')}
  ${pane(a, sa, 'now', 'now')}
</section>`);
}

const page = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Eleven Rescued Facades</title>
<style>
  :root { --paper:#f7f5f0; --ink:#1a1a1e; --dim:#4d4d55; --faint:#8a857d; --rule:#dcd6c9;
          --well:#141418; --wall:#2f7d4f; --wall-fill:rgba(47,125,79,.14); --warm:#b4531f; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper:#131318; --ink:#eceaf1; --dim:#a6a3b1; --faint:#736f7c; --rule:#2b2b34;
    --well:#0b0b0e; --wall:#4fbf7d; --wall-fill:rgba(79,191,125,.16); --warm:#e0834a; } }
  :root[data-theme="dark"] { --paper:#131318; --ink:#eceaf1; --dim:#a6a3b1; --faint:#736f7c;
    --rule:#2b2b34; --well:#0b0b0e; --wall:#4fbf7d; --wall-fill:rgba(79,191,125,.16); --warm:#e0834a; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font:15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:1120px; margin:0 auto; padding:34px 20px 72px; }
  h1 { font-size:27px; margin:0 0 6px; letter-spacing:-.01em; }
  .lede { max-width:62ch; color:var(--dim); margin:0 0 10px; }
  .ask { max-width:62ch; margin:0 0 30px; padding:12px 14px; border-left:3px solid var(--warm);
         background:color-mix(in srgb, var(--warm) 8%, transparent); border-radius:0 3px 3px 0; }
  section { border-top:1px solid var(--rule); padding:20px 0 6px; }
  h2 { font-size:17px; margin:0 0 12px; font-weight:650; }
  .id { color:var(--faint); font-weight:400; font-size:13px; font-variant-numeric:tabular-nums; }
  figure { margin:0 0 12px; }
  figcaption { color:var(--dim); font-size:13px; margin:0 0 5px; font-variant-numeric:tabular-nums; }
  .was figcaption b { color:var(--faint); }
  .now figcaption b { color:var(--wall); }
  .band { position:relative; width:100%; background:var(--well); border-radius:3px; overflow:hidden; }
  .band img { display:block; width:100%; height:100%; object-fit:fill; }
  .wall { position:absolute; top:0; bottom:0; border-left:2px solid var(--wall);
          border-right:2px solid var(--wall); background:var(--wall-fill); box-sizing:border-box; }
</style>
<main>
  <h1>Eleven Rescued Facades</h1>
  <p class="lede">The leaf-off filter was an absolute veto: if one winter frame existed at any
  distance, every summer frame was discarded. That sent these eleven bands to a camera a median
  15.3 m away resolving 81 px/m — inside the dead zone, where 161 bands decided nothing at all.
  Readmitting leaf-on views when nothing leaf-off is legible moves them to 4.4 m and 258 px/m.</p>
  <p class="ask"><b>The question a statistic cannot answer.</b> A 63 px/m frame is illegible with
  certainty. A May frame at 4.5 m <i>may</i> have a tree across the door. Are the lower strips
  actually usable, or has one certain failure been traded for another? The green bracket is the
  wall we projected for that house.</p>
  ${rows.join('\n')}
</main>`;

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'index.html'), page);
console.log(`${changed.length} rescued bands → ${path.relative(process.cwd(), path.join(OUT, 'index.html'))}`);
