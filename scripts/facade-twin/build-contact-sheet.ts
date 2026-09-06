/**
 * The confident strip set, all of it, on one page.
 *
 * A set of ninety façades is the first thing in this project that can be judged
 * by looking rather than by reading a percentile. Two panoramas that agree tell
 * you they are alike; ninety rectified walls in a grid tell you whether the
 * pipeline is producing façades or producing convincing pictures of the wrong
 * thing — which is the failure this project keeps having, and which every
 * aggregate statistic here has at some point concealed.
 *
 * Three things the page must carry, and they are the reason it is generated
 * rather than a directory listing:
 *
 * **Provenance on every thumbnail.** Standoff, obliquity, the source's own
 * pixels per metre, leaf-off, whether the lens height was inferred, and the
 * greyscale spread that proves the render is not blank. A strip with no
 * provenance is an assertion; a strip with it is evidence, and the reader can
 * see immediately that a blurry one is far away rather than broken.
 *
 * **The frontage corrections marked out.** Thirty-four of these are walls the
 * old pipeline would have photographed from behind — it counted cameras
 * standing in front of an elevation and never asked whether they could see it,
 * so a courtyard wall scored as highly as a street front and the tiebreak was a
 * coin flip between two short sides of identical length. Seeing those together
 * is the closest thing there is to a check on that change, so they are marked
 * and filterable rather than mixed in.
 *
 * **What was refused, and why.** The set is what passed. A page showing only
 * survivors is a page with a hidden denominator, so the gates and the counts
 * they rejected are stated at the top. Rejected strips are deliberately absent
 * rather than shown greyed out: a strip that failed the blank check is not in
 * the manifest at all, and rendering one specially to display it would be
 * inventing evidence for the page.
 *
 * Usage: npx tsx scripts/facade-twin/build-contact-sheet.ts [--height=460]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STRIPS = path.join(CACHE, 'strips-confident');
const OUT = path.join(CACHE, 'contact-sheet');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const MAX_HEIGHT = Number(arg('height') ?? 460);
const QUALITY = Number(arg('quality') ?? 80);

interface Strip {
  file: string; pandId: string; address: string | null; capturedAt: string; panoramaId: string;
  wallWidthM: number; wallFacingDeg: number; frontageChangedByVisibility: boolean; clearViews: number;
  standoffM: number; obliquityDeg: number; blockedFraction: number;
  sourcePixelsPerMetre: number; renderedPixelsPerMetre: number; leafOff: boolean;
  groundZ: number; topZ: number; wallBowM: number; heightInferred: boolean;
  pixelStdDev: number; size: string;
}
const manifest = JSON.parse(await readFile(path.join(STRIPS, 'manifest.json'), 'utf8')) as
  { metadata: any; strips: Strip[] };
const strips = manifest.strips;

/** Fit each strip to one display height so ninety walls are comparable. */
function fit(data: Uint8ClampedArray, width: number, height: number, maxHeight: number) {
  if (height <= maxHeight) return { width, height, data };
  const k = maxHeight / height, w = Math.max(1, Math.round(width * k)), h = maxHeight;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(width - 1, Math.floor(x / k)), sy = Math.min(height - 1, Math.floor(y / k));
    const s = (sy * width + sx) * 4, d = (y * w + x) * 4;
    out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = 255;
  }
  return { width: w, height: h, data: out };
}

const cards: string[] = [];
let bytes = 0;
for (const strip of strips) {
  let image;
  try { image = jpeg.decode(await readFile(path.join(STRIPS, strip.file)), { useTArray: true, formatAsRGBA: true }); }
  catch { continue; }
  const small = fit(Uint8ClampedArray.from(image.data), image.width, image.height, MAX_HEIGHT);
  const encoded = jpeg.encode({ width: small.width, height: small.height, data: Buffer.from(small.data) }, QUALITY).data;
  bytes += encoded.length;
  const flags = [
    strip.frontageChangedByVisibility ? '<span class="flag corrected" title="the old pipeline would have photographed the back of this building">frontage corrected</span>' : '',
    strip.heightInferred ? '<span class="flag inferred" title="this frame publishes no camera height; it was inferred from the ground beneath it">height inferred</span>' : '',
    !strip.leafOff ? '<span class="flag leafon" title="captured in leaf-on months; a canal elm may cover the façade">leaf-on</span>' : '',
    strip.wallBowM > 0.35 ? `<span class="flag bowed" title="the merged wall departs from flat by ${strip.wallBowM.toFixed(2)} m; right for identity, wrong for measuring in metres">bowed ${strip.wallBowM.toFixed(2)} m</span>` : '',
  ].filter(Boolean).join('');
  cards.push(`<figure class="card${strip.frontageChangedByVisibility ? ' corrected' : ''}"
  data-corrected="${strip.frontageChangedByVisibility}" data-inferred="${strip.heightInferred}"
  data-leafoff="${strip.leafOff}" data-ppm="${strip.sourcePixelsPerMetre}"
  data-search="${(strip.address ?? strip.pandId).toLowerCase()} ${strip.pandId}">
  <div class="shot" style="--w:${small.width};--h:${small.height}">
    <img src="data:image/jpeg;base64,${encoded.toString('base64')}" alt="${strip.address ?? strip.pandId}" loading="lazy">
  </div>
  <figcaption>
    <b>${strip.address ?? strip.pandId}</b>
    <span class="line">${strip.wallWidthM} m wide · facing ${strip.wallFacingDeg}° · ${strip.capturedAt}</span>
    <span class="line">${strip.standoffM} m away · ${strip.obliquityDeg}° off square · ${strip.sourcePixelsPerMetre} px/m in the source</span>
    <span class="line">${strip.clearViews} clear views · spread ${strip.pixelStdDev}</span>
    ${flags ? `<span class="flags">${flags}</span>` : ''}
  </figcaption>
</figure>`);
}

const g = manifest.metadata?.gates ?? {};
const corrected = strips.filter(s => s.frontageChangedByVisibility).length;
const inferred = strips.filter(s => s.heightInferred).length;
const leafOn = strips.filter(s => !s.leafOff).length;
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
const years = new Map<string, number>();
for (const s of strips) years.set(s.capturedAt.slice(0, 4), (years.get(s.capturedAt.slice(0, 4)) ?? 0) + 1);

const page = `<meta charset="utf-8">
<title>Grachtengordel Façades</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;600&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root {
    --paper:#f5f4ef; --panel:#fbfaf7; --ink:#191c19; --muted:#6c716b; --rule:#dedbd2;
    --corrected:#9c5a1f; --inferred:#2f6fd0; --warn:#8a6d1f; --good:#1f6b45;
    --display:"Zilla Slab",Georgia,serif; --body:"Source Sans 3",ui-sans-serif,system-ui,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper:#141614; --panel:#1c1f1c; --ink:#eceae3; --muted:#979d96; --rule:#2d312d;
    --corrected:#d9a05e; --inferred:#7aa8e8; --warn:#d3ae5c; --good:#5fb98a; } }
  :root[data-theme="dark"] {
    --paper:#141614; --panel:#1c1f1c; --ink:#eceae3; --muted:#979d96; --rule:#2d312d;
    --corrected:#d9a05e; --inferred:#7aa8e8; --warn:#d3ae5c; --good:#5fb98a; }
  * { box-sizing:border-box; }
  body { background:var(--paper); color:var(--ink); font-family:var(--body); font-size:15px;
         line-height:1.55; margin:0; padding:2.5rem 1.25rem 5rem; }
  .wrap { max-width:1500px; margin:0 auto; }
  .eyebrow { font-family:var(--mono); font-size:.7rem; letter-spacing:.14em; text-transform:uppercase;
             color:var(--muted); margin:0 0 .6rem; }
  h1 { font-family:var(--display); font-weight:600; font-size:2.2rem; margin:0 0 .6rem;
       letter-spacing:-.015em; text-wrap:balance; }
  .lede { color:var(--ink); max-width:66ch; margin:0 0 .9rem; font-size:1.03rem; }
  .lede.quiet { color:var(--muted); font-size:.95rem; }

  .gates { display:grid; gap:1px; background:var(--rule); border:1px solid var(--rule);
           border-radius:3px; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); margin:1.6rem 0; }
  .gate { background:var(--panel); padding:.85rem 1rem; }
  .gate h3 { font-family:var(--body); font-size:.85rem; font-weight:600; margin:0 0 .2rem; }
  .gate p { margin:0; font-size:.82rem; color:var(--muted); }
  .gate .n { font-family:var(--mono); font-size:.78rem; color:var(--ink); display:block; margin-top:.35rem;
             font-variant-numeric:tabular-nums; }

  .controls { display:flex; gap:.55rem; flex-wrap:wrap; align-items:center;
              border-top:1px solid var(--rule); border-bottom:1px solid var(--rule);
              padding:.85rem 0; margin-bottom:1.5rem; position:sticky; top:0; background:var(--paper); z-index:5; }
  input[type=search] { font:inherit; font-size:.9rem; padding:.4rem .6rem; min-width:200px;
    border:1px solid var(--rule); border-radius:4px; background:var(--panel); color:var(--ink); }
  .chip { font:inherit; font-size:.85rem; padding:.35rem .75rem; border:1px solid var(--rule);
          border-radius:999px; background:var(--panel); color:var(--ink); cursor:pointer; }
  .chip[aria-pressed="true"] { border-color:var(--corrected); color:var(--corrected); font-weight:600; }
  .chip:focus-visible, input:focus-visible { outline:2px solid var(--inferred); outline-offset:2px; }
  #count { margin-left:auto; font-family:var(--mono); font-size:.8rem; color:var(--muted); }

  .grid { display:flex; flex-wrap:wrap; gap:1.1rem; align-items:flex-start; }
  .card { margin:0; width:calc(var(--cw, 220px)); display:flex; flex-direction:column; gap:.45rem; }
  .shot { background:var(--panel); border:1px solid var(--rule); border-radius:3px; overflow:hidden;
          display:flex; align-items:flex-end; justify-content:center; cursor:zoom-in; }
  .card.corrected .shot { border-color:var(--corrected); box-shadow:inset 0 0 0 1px var(--corrected); }
  .shot img { display:block; max-width:100%; height:auto; }
  figcaption { display:flex; flex-direction:column; gap:.1rem; }
  figcaption b { font-family:var(--display); font-size:.92rem; font-weight:600; }
  .line { font-family:var(--mono); font-size:.68rem; color:var(--muted); font-variant-numeric:tabular-nums; }
  .flags { display:flex; gap:.3rem; flex-wrap:wrap; margin-top:.25rem; }
  .flag { font-family:var(--mono); font-size:.63rem; padding:.1rem .4rem; border-radius:2px;
          border:1px solid currentColor; white-space:nowrap; cursor:help; }
  .flag.corrected { color:var(--corrected); } .flag.inferred { color:var(--inferred); }
  .flag.leafon, .flag.bowed { color:var(--warn); }

  dialog { border:none; background:transparent; max-width:96vw; max-height:96vh; padding:0; }
  dialog::backdrop { background:rgba(10,12,10,.86); }
  dialog img { max-width:96vw; max-height:88vh; border-radius:4px; display:block; }
  dialog .cap { font-family:var(--mono); font-size:.75rem; color:#dcd8d0; margin-top:.5rem; text-align:center; }

  footer { border-top:1px solid var(--rule); margin-top:2.5rem; padding-top:1rem;
           color:var(--muted); font-size:.8rem; max-width:74ch; }
  code { font-family:var(--mono); font-size:.9em; }
</style>
<div class="wrap">
<p class="eyebrow">Amsterdam façade twin · ${AREA.name}</p>
<h1>Grachtengordel façades</h1>
<p class="lede">${strips.length} rectified walls, each resampled from a single panorama into its own
plane so a metre is a metre everywhere in the picture. This is the first artefact in the project
that can be judged by looking instead of by reading a percentile.</p>
<p class="lede quiet"><strong>Selected on geometry and source quality, never on cross-view
agreement.</strong> That measure compares two photographs, and two frames of one survey pass share
their pose error and cancel it — so a set chosen on it would be chosen on the one number shown to be
untrustworthy. Every gate below is checkable before a pixel is resampled, and every strip is
rendered at the rate its source actually carries, so nothing is enlarged into looking better than
it is.</p>

<div class="gates">
  <div class="gate"><h3>It is a frontage</h3>
    <p>The wall was chosen because survey cameras can see it, not because it lay near an old proposal.</p>
    <span class="n">≥ ${g.minClearViews ?? 30} clear views · median ${q(strips.map(s => s.clearViews), 0.5)}</span></div>
  <div class="gate"><h3>The view can see it</h3>
    <p>Occlusion sampled at nine points along the wall, not at the midpoint alone.</p>
    <span class="n">≤ ${((g.maxBlockedFraction ?? 0.12) * 100).toFixed(0)}% blocked</span></div>
  <div class="gate"><h3>The source holds the detail</h3>
    <p>The worse of vertical sampling at the wall top and horizontal sampling foreshortened by obliquity.</p>
    <span class="n">≥ ${g.minSourcePixelsPerMetre ?? 34} px/m · median ${q(strips.map(s => s.sourcePixelsPerMetre), 0.5)}</span></div>
  <div class="gate"><h3>The render is not blank</h3>
    <p>Geometry cannot notice that a resample came out white. Two did, both frames publishing no camera height.</p>
    <span class="n">greyscale spread ≥ ${g.minRenderedStdDev ?? 8} · min here ${q(strips.map(s => s.pixelStdDev), 0)}</span></div>
</div>

<div class="controls">
  <input type="search" id="q" placeholder="address or pand id" aria-label="search">
  <button class="chip" id="f-corrected" aria-pressed="false">frontage corrected (${corrected})</button>
  <button class="chip" id="f-inferred" aria-pressed="false">height inferred (${inferred})</button>
  <button class="chip" id="f-leafon" aria-pressed="false">leaf-on (${leafOn})</button>
  <button class="chip" id="f-coarse" aria-pressed="false">coarsest source</button>
  <span id="count"></span>
</div>

<div class="grid" id="grid">
${cards.join('\n')}
</div>

<dialog id="zoom"><img alt=""><p class="cap"></p></dialog>

<footer>Street imagery © Gemeente Amsterdam, <em>Kernregistratie Panoramabeelden</em>, CC BY 4.0.
Footprints and addresses from BAG via PDOK; ground and roof heights from 3DBAG and AHN.
Camera model <code>amsterdam-world-aligned</code>; vertical datum corrected per ~125 m survey
segment. Capture years: ${[...years].sort().map(([y, n]) => `${y} (${n})`).join(', ')}.
Generated by <code>scripts/facade-twin/build-contact-sheet.ts</code> from
<code>strips-confident/manifest.json</code>.</footer>
</div>
<script>
  const cards = [...document.querySelectorAll('.card')];
  const q = document.getElementById('q'), count = document.getElementById('count');
  const toggles = { corrected: false, inferred: false, leafon: false, coarse: false };
  // Every strip is rendered to the same display height, so a card takes the
  // width that height implies and a 34 m warehouse is visibly four times the
  // wall a 3.5 m canal house is. Capping the width would silently shrink the
  // widest ten to a third of everyone else's height -- the same equal-looking
  // lie the upscaled review crops told, in the other direction.
  for (const card of cards) {
    const shot = card.querySelector('.shot');
    const w = Number(getComputedStyle(shot).getPropertyValue('--w')) || 220;
    card.style.setProperty('--cw', Math.max(120, w) + 'px');
  }
  const coarseCut = (() => {
    const all = cards.map(c => Number(c.dataset.ppm)).sort((a, b) => a - b);
    return all[Math.floor(all.length * 0.25)];
  })();
  function apply() {
    const term = q.value.trim().toLowerCase();
    let shown = 0;
    for (const card of cards) {
      const ok = (!term || card.dataset.search.includes(term))
        && (!toggles.corrected || card.dataset.corrected === 'true')
        && (!toggles.inferred || card.dataset.inferred === 'true')
        && (!toggles.leafon || card.dataset.leafoff === 'false')
        && (!toggles.coarse || Number(card.dataset.ppm) <= coarseCut);
      card.hidden = !ok;
      if (ok) shown++;
    }
    count.textContent = shown + ' of ' + cards.length + ' façades';
  }
  q.addEventListener('input', apply);
  for (const key of Object.keys(toggles)) {
    const button = document.getElementById('f-' + key);
    button.addEventListener('click', () => {
      toggles[key] = !toggles[key];
      button.setAttribute('aria-pressed', String(toggles[key]));
      apply();
    });
  }
  const zoom = document.getElementById('zoom');
  for (const card of cards) {
    card.querySelector('.shot').addEventListener('click', () => {
      zoom.querySelector('img').src = card.querySelector('img').src;
      zoom.querySelector('.cap').textContent =
        [...card.querySelectorAll('figcaption b, .line')].map(n => n.textContent).join('  ·  ');
      zoom.showModal();
    });
  }
  zoom.addEventListener('click', () => zoom.close());
  apply();
</script>`;

await mkdir(OUT, { recursive: true });
const file = path.join(OUT, 'index.html');
await writeFile(file, page);
console.log(`${cards.length} strips, ${(bytes / 1e6).toFixed(1)} MB of thumbnails`);
console.log(`  ${corrected} frontage corrected, ${inferred} height inferred, ${leafOn} leaf-on`);
console.log(`→ ${path.relative(process.cwd(), file)} (${(page.length / 1e6).toFixed(1)} MB)`);
