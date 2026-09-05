/**
 * One pand, several panoramas, two camera models, side by side.
 *
 * The presentation that makes the fault visible without trusting anybody's
 * judgement about what a canal house looks like. Each row is one camera model;
 * each cell in the row is the same BAG footprint projected into a *different*
 * panorama — different day, different standpoint, different weather.
 *
 * A correct camera model produces a row showing the same house several times.
 * A wrong one produces a row of different houses. That comparison needs no
 * ground truth, no detector and no opinion, and it is the test this project
 * spent two days not having: in Amsterdam every individual crop looks like a
 * plausible canal façade, so only agreement between independent views can say
 * whether the correspondence holds.
 *
 * Writes a self-contained HTML page with the images embedded, because the
 * imagery is CC BY 4.0 and a review page that needs a server running beside it
 * does not get looked at.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/model-compare.ts --ids=<pandId>,... [--views=3]
 *   npx tsx scripts/facade-twin/model-compare.ts --limit=6
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { bodyAlignedFrame, type CameraModel, type CameraPose } from '../../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_CAMERA, GEOID_SEPARATION_M, hasUsablePose } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.join(CACHE, 'model-compare');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);

/** What the pipeline used to do: rotate the projection by the van's heading. */
const PREVIOUS: CameraModel = bodyAlignedFrame('previous-heading-applied-edge', 0);
const MODELS: Array<{ model: CameraModel; title: string; note: string }> = [
  { model: PREVIOUS, title: 'Rotated by the van’s heading',
    note: 'what the pipeline did — right only where heading happens to be near 180°' },
  { model: AMSTERDAM_CAMERA, title: 'World-aligned frame',
    note: 'north at the frame centre, vehicle attitude ignored' },
];

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = new Map<string, PanoramaView>(
  (JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[])
    .map(v => [v.panoramaId, v]));
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')).facades as Record<string, any>;
let multi: Record<string, Array<{ panoramaId: string }>> = {};
try { multi = JSON.parse(await readFile(path.join(STAGING, 'multi-view.json'), 'utf8')).facades; } catch { /* optional */ }
let addresses: Record<string, any> = {};
try { addresses = JSON.parse(await readFile(path.join(CACHE, 'addresses.json'), 'utf8')).addresses; } catch { /* optional */ }

const footprints = new Map<string, ProjectedPoint[]>();
for (const e of registry) if (!footprints.has(e.buildingId)) {
  footprints.set(e.buildingId, e.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
}

const MAX_WIDTH = 560;

/** Crop the panorama around the wall as this model projects it, and outline it. */
function render(image: any, view: PanoramaView, ring: ProjectedPoint[], wall: number[],
                ground: number, eaves: number, model: CameraModel) {
  const cam = RD_NEW.fromLngLat(view.lngLat);
  const pose: CameraPose = { x: cam.x, y: cam.y, z: view.cameraHeight - GEOID_SEPARATION_M,
    headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg };
  const project = (p: ProjectedPoint, z: number) =>
    model.project([p.x - pose.x, p.y - pose.y, z - pose.z], pose, image);

  const [wx0, wy0, wx1, wy1] = wall;
  const a = { x: wx0, y: wy0 }, b = { x: wx1, y: wy1 };
  const corners = [project(a, ground), project(b, ground), project(a, eaves), project(b, eaves)];
  const anchor = corners[0][0];
  const unwrap = (u: number) => {
    let d = u - anchor;
    while (d > image.width / 2) d -= image.width;
    while (d < -image.width / 2) d += image.width;
    return anchor + d;
  };
  const us = corners.map(c => unwrap(c[0])), vs = corners.map(c => c[1]);
  const minU = Math.min(...us), maxU = Math.max(...us), minV = Math.min(...vs), maxV = Math.max(...vs);
  // Two thirds of a frontage of context either side: enough to see the
  // neighbours, which is how a person tells one canal house from the next.
  const padU = Math.max(90, (maxU - minU) * 0.65), padV = Math.max(70, (maxV - minV) * 0.3);
  const x0 = Math.round(minU - padU), x1 = Math.round(maxU + padU);
  const y0 = Math.max(0, Math.round(minV - padV)), y1 = Math.min(image.height, Math.round(maxV + padV));
  const cw = x1 - x0, ch = y1 - y0;
  if (cw < 16 || ch < 16 || cw > 7000 || ch > 4000) return null;

  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = ((x + x0) % image.width + image.width) % image.width;
    const sy = Math.max(0, Math.min(image.height - 1, y + y0));
    const s = (sy * image.width + sx) * 4, d = (y * cw + x) * 4;
    out[d] = image.data[s]; out[d + 1] = image.data[s + 1]; out[d + 2] = image.data[s + 2]; out[d + 3] = 255;
  }
  const line = (p: number[], q: number[], colour: number[], thick: number) => {
    const ax = unwrap(p[0]) - x0, ay = p[1] - y0, bx = unwrap(q[0]) - x0, by = q[1] - y0;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const px = Math.round(ax + ((bx - ax) * i) / n), py = Math.round(ay + ((by - ay) * i) / n);
      for (let ox = -thick; ox <= thick; ox++) for (let oy = -thick; oy <= thick; oy++) {
        const qx = px + ox, qy = py + oy;
        if (qx < 0 || qy < 0 || qx >= cw || qy >= ch) continue;
        const d = (qy * cw + qx) * 4;
        out[d] = colour[0]; out[d + 1] = colour[1]; out[d + 2] = colour[2];
      }
    }
  };
  /**
   * An edge drawn as the curve it is. In an equirectangular frame the image of
   * a straight 3-D line is an arc, and over the 20–30° a canal house subtends
   * the bow is tens of pixels — enough to make an exact projection look wrong.
   */
  const edge = (pa: ProjectedPoint, za: number, pb: ProjectedPoint, zb: number, colour: number[], thick: number) => {
    let prev: number[] | null = null;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const here = project({ x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t }, za + (zb - za) * t);
      if (prev) line(prev, here, colour, thick);
      prev = here;
    }
  };
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    edge(ring[i], ground, ring[j], ground, [70, 150, 255], 1);
    edge(ring[i], eaves, ring[j], eaves, [70, 150, 255], 1);
    edge(ring[i], ground, ring[i], eaves, [70, 150, 255], 1);
  }
  edge(a, ground, b, ground, [40, 235, 120], 3);
  edge(a, eaves, b, eaves, [40, 235, 120], 3);
  edge(a, ground, a, eaves, [40, 235, 120], 3);
  edge(b, ground, b, eaves, [40, 235, 120], 3);

  let ow = cw, oh = ch, data = out;
  if (cw > MAX_WIDTH) {
    const k = MAX_WIDTH / cw; ow = MAX_WIDTH; oh = Math.max(1, Math.round(ch * k));
    data = new Uint8ClampedArray(ow * oh * 4);
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const sx = Math.min(cw - 1, Math.floor(x / k)), sy = Math.min(ch - 1, Math.floor(y / k));
      const s = (sy * cw + sx) * 4, d = (y * ow + x) * 4;
      data[d] = out[s]; data[d + 1] = out[s + 1]; data[d + 2] = out[s + 2]; data[d + 3] = 255;
    }
  }
  return jpeg.encode({ width: ow, height: oh, data: Buffer.from(data) }, 78).data.toString('base64');
}

const perPand = Number(arg('views') ?? 3);
const ids = (arg('ids') ?? '').split(',').filter(Boolean);
const limit = Number(arg('limit') ?? 6);
const candidates = ids.length ? ids : Object.keys(store).sort();

const decoded = new Map<string, any>();
async function panorama(id: string) {
  if (decoded.has(id)) return decoded.get(id);
  if (decoded.size > 4) decoded.clear();
  const im = jpeg.decode(await readFile(path.join(CACHE, 'panoramas', `${id}.jpg`)), { useTArray: true, formatAsRGBA: true });
  decoded.set(id, im);
  return im;
}

// Optional exhibits: independently sourced evidence dropped into exhibits/,
// with captions alongside. Kept out of the generator so the corroboration can
// grow without the code changing.
const exhibits: string[] = [];
try {
  const dir = path.join(OUT, 'exhibits');
  const captions = JSON.parse(await readFile(path.join(dir, 'captions.json'), 'utf8')) as Record<string, string>;
  for (const name of Object.keys(captions).sort()) {
    const b64 = (await readFile(path.join(dir, name))).toString('base64');
    exhibits.push(`<figure class="exhibit"><img src="data:image/jpeg;base64,${b64}" alt="">`
      + `<figcaption>${captions[name]}</figcaption></figure>`);
  }
} catch { /* exhibits are optional */ }

const sections: string[] = [];
let done = 0;
for (const pandId of candidates) {
  if (done >= (ids.length ? ids.length : limit)) break;
  const record = store[pandId], ring = footprints.get(pandId), mass = massing.get(pandId);
  if (!record || !ring || !Number.isFinite(mass?.groundLevel)) continue;

  const chosen: PanoramaView[] = [];
  for (const id of [record.panoramaId, ...(multi[pandId] ?? []).map(m => m.panoramaId)]) {
    const v = views.get(id);
    if (v && hasUsablePose(v) && !chosen.some(c => c.panoramaId === id)) chosen.push(v);
  }
  if (chosen.length < 2) continue;
  // Prefer views whose headings disagree: that is where a heading-dependent
  // error is visible at all, and where the old model fails loudest.
  chosen.sort((p, q) => q.headingDeg - p.headingDeg);
  const spread = [chosen[0], ...chosen.slice(1).sort((p, q) =>
    Math.abs(((q.headingDeg - chosen[0].headingDeg) % 360 + 540) % 360 - 180)
    - Math.abs(((p.headingDeg - chosen[0].headingDeg) % 360 + 540) % 360 - 180))].slice(0, perPand);

  const ground = mass.groundLevel, eaves = mass.eavesHeight ?? ground + 12;
  const rows: string[] = [];
  let rendered = 0;
  for (const { model, title, note } of MODELS) {
    const cells: string[] = [];
    for (const view of spread) {
      let image;
      try { image = await panorama(view.panoramaId); } catch { continue; }
      const b64 = render(image, view, ring, record.wall, ground, eaves, model);
      if (!b64) continue;
      rendered++;
      cells.push(`<figure><img src="data:image/jpeg;base64,${b64}" alt="">`
        + `<figcaption>${view.capturedAt.slice(0, 10)} · heading ${view.headingDeg.toFixed(1)}°</figcaption></figure>`);
    }
    if (cells.length) rows.push(`<div class="model ${model === AMSTERDAM_CAMERA ? 'now' : 'was'}">`
      + `<h3>${title}</h3><p class="note">${note}</p><div class="strip">${cells.join('')}</div></div>`);
  }
  if (rendered < 2) continue;
  const label = addresses[pandId]?.label ?? pandId;
  sections.push(`<section><div class="head"><h2>${label}</h2><p class="meta">BAG pand ${pandId}`
    + ` · wall ${record.wallWidthM} m · ${spread.length} independent panoramas</p></div>${rows.join('')}</section>`);
  done++;
  process.stdout.write(`\r  ${done} pand(en)`);
}
process.stdout.write('\r');

const page = `<title>North at the Centre</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;600&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root {
    --paper:#f5f4ef; --panel:#fbfaf7; --ink:#191c19; --muted:#6c716b; --rule:#dedbd2;
    --was:#9c3b26; --now:#1f6b45; --plan:#2f6fd0;
    --display:"Zilla Slab",Georgia,serif;
    --body:"Source Sans 3",ui-sans-serif,system-ui,-apple-system,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper:#141614; --panel:#1c1f1c; --ink:#eceae3; --muted:#979d96; --rule:#2d312d;
    --was:#d9775e; --now:#5fb98a; --plan:#7aa8e8; } }
  :root[data-theme="dark"] {
    --paper:#141614; --panel:#1c1f1c; --ink:#eceae3; --muted:#979d96; --rule:#2d312d;
    --was:#d9775e; --now:#5fb98a; --plan:#7aa8e8; }

  * { box-sizing:border-box; }
  body { background:var(--paper); color:var(--ink); font-family:var(--body);
         font-size:16px; line-height:1.6; margin:0; padding:3rem 1.5rem 6rem; }
  .wrap { max-width:1160px; margin:0 auto; display:flex; flex-direction:column; gap:2.75rem; }

  .eyebrow { font-family:var(--mono); font-size:.72rem; letter-spacing:.14em;
             text-transform:uppercase; color:var(--muted); margin:0 0 .7rem; }
  h1 { font-family:var(--display); font-weight:600; font-size:2.35rem; line-height:1.12;
       letter-spacing:-.015em; margin:0 0 .8rem; text-wrap:balance; max-width:20ch; }
  .lede { font-size:1.06rem; color:var(--ink); max-width:64ch; margin:0; }
  .lede + .lede { margin-top:.9rem; color:var(--muted); }

  .evidence { display:grid; gap:1px; background:var(--rule); border:1px solid var(--rule);
              border-radius:3px; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); }
  .ev { background:var(--panel); padding:1.15rem 1.25rem; display:flex; flex-direction:column; gap:.45rem; }
  .ev h3 { font-family:var(--body); font-weight:600; font-size:.95rem; margin:0; }
  .ev p { margin:0; font-size:.88rem; color:var(--muted); }
  .ev .figure { font-family:var(--mono); font-size:.82rem; color:var(--ink);
                font-variant-numeric:tabular-nums; border-top:1px solid var(--rule); padding-top:.5rem; margin-top:auto; }

  .legend { display:flex; flex-wrap:wrap; gap:1.4rem; font-size:.85rem; color:var(--muted);
            font-family:var(--mono); border-top:1px solid var(--rule); padding-top:1rem; }
  .swatch { display:inline-block; width:.75rem; height:.75rem; border-radius:2px; margin-right:.45rem;
            vertical-align:-1px; }

  section { border-top:1px solid var(--rule); padding-top:1.6rem;
            display:flex; flex-direction:column; gap:1.5rem; }
  h2 { font-family:var(--display); font-weight:600; font-size:1.3rem; margin:0; letter-spacing:-.01em; }
  .meta { font-family:var(--mono); font-size:.78rem; color:var(--muted);
          font-variant-numeric:tabular-nums; margin:.15rem 0 0; }
  .head { display:flex; flex-direction:column; gap:0; }

  .model { display:flex; flex-direction:column; gap:.65rem; }
  .model h3 { font-family:var(--body); font-size:.92rem; font-weight:600; margin:0;
              display:flex; align-items:baseline; gap:.55rem; }
  .model h3::before { content:""; width:3px; align-self:stretch; border-radius:2px; }
  .model.was h3 { color:var(--was); } .model.was h3::before { background:var(--was); }
  .model.now h3 { color:var(--now); } .model.now h3::before { background:var(--now); }
  .note { font-family:var(--mono); font-size:.76rem; color:var(--muted); margin:-.35rem 0 0; }
  .strip { display:flex; gap:.7rem; overflow-x:auto; padding-bottom:.5rem; }
  figure { margin:0; flex:0 0 auto; display:flex; flex-direction:column; gap:.4rem; }
  img { display:block; border-radius:3px; max-width:100%; background:var(--panel); }
  figcaption { font-family:var(--mono); font-size:.73rem; color:var(--muted);
               font-variant-numeric:tabular-nums; }

  .verify { border-top:1px solid var(--rule); }
  .exhibits { display:flex; gap:1rem; overflow-x:auto; padding-bottom:.5rem; align-items:flex-start; }
  .exhibit { flex:0 0 300px; display:flex; flex-direction:column; gap:.5rem; }
  .exhibit img { width:100%; border-radius:3px; }
  .exhibit figcaption { font-family:var(--body); font-size:.8rem; line-height:1.45;
                        color:var(--muted); font-variant-numeric:normal; }
  footer { border-top:1px solid var(--rule); padding-top:1.2rem; color:var(--muted);
           font-size:.82rem; max-width:70ch; }
  code { font-family:var(--mono); font-size:.9em; }
  a { color:inherit; }
  @media (max-width:620px) { body { padding:2rem 1rem 4rem; } h1 { font-size:1.8rem; } }
</style>
<div class="wrap">

<header>
  <p class="eyebrow">Façade twin · camera model</p>
  <h1>North at the centre</h1>
  <p class="lede">Amsterdam publishes a <code>heading</code> with every panorama, and this pipeline
  rotated every projection by it. It should not have. The equirectangular frames are already
  world-aligned — north at the horizontal centre, horizon level — and <code>heading</code>, <code>pitch</code>
  and <code>roll</code> describe the survey van, not the picture.</p>
  <p class="lede">That single mistake is every symptom of the last two days: two panoramas of one
  building landing on two different houses, zero of 120 buildings locking under cross-view
  correlation, and a <em>centre</em>-versus-<em>edge</em> argument that could not be won because both
  answers were wrong by the van's heading. The rows further down are the fix, shown as the same
  footprint projected into several independent panoramas.</p>
  <p class="lede"><strong>Agreement between views is necessary but not sufficient.</strong> Where every
  panorama of a building happens to share a heading, the old model is wrong by the same amount in
  each and agrees with itself. Identity needs a source outside the geometry, so this page carries
  four.</p>
</header>

<section class="verify">
  <div class="head"><h2>Checked against sources outside this pipeline</h2>
  <p class="meta">the part cross-view agreement cannot supply</p></div>

  <div class="evidence">
    <div class="ev">
      <h3>The publisher documents it</h3>
      <p>Amsterdam's Open Panorama pipeline, stage two: <em>“images are edited to face northwards and
      have a straight horizon.”</em> Both findings at once — north-aligned, and levelled.</p>
      <p class="figure">which is why adding pitch and roll<br>makes the residual worse, 0.95 → 1.15 m</p>
    </div>
    <div class="ev">
      <h3>The monument register describes it</h3>
      <p>Herengracht 270: a double house, sandstone façade five windows wide, straight triglyph
      cornice with balustrade, sculptured window surrounds in two bays, a 17th-century door and two
      façade lanterns.</p>
      <p class="figure">every one of those is in the strip<br>Rijksmonument 1789</p>
    </div>
    <div class="ev">
      <h3>The building states its own address</h3>
      <p>At 4 m standoff the number carved on the stone right of the door is legible in our own
      rectified strip. It is a semantic check on identity, not a metric anchor — the geometry could
      still be a metre out and it would read the same.</p>
      <p class="figure">reads 270 · BAG labels the pand<br>Herengracht 270G</p>
    </div>
  </div>

  <div class="exhibits">${exhibits.join('')}</div>
</section>

<div class="evidence">
  <div class="ev">
    <h3>Opposed pairs</h3>
    <p>Two cameras 9–14 cm apart with headings 180° opposed — the same spot, driven the other way on
    another day. If the frame turned with the van their pictures would differ by half a frame.</p>
    <p class="figure">agree at 0.0° ± 0.5°<br>peaks 0.42–0.74 · n = 6 of 25,031</p>
  </div>
  <div class="ev">
    <h3>Optical flow</h3>
    <p>Between consecutive frames of one track the horizontal flow is a sinusoid whose ascending zero
    is the direction of travel — and travel is known exactly from the two published positions.</p>
    <p class="figure">travel lands at bearing + 180°<br>R = 0.84 vs 0.05 anticlockwise · n = 21</p>
  </div>
  <div class="ev">
    <h3>Cross-view residual</h3>
    <p>One wall rectified from two panoramas, correlated over the upper façade only — everything below
    the first floor is tree, car and lamp post, none of it in the wall plane.</p>
    <p class="figure">median 2.05 m → 0.95 m<br>within 1 m: 23% → 50% · n = 60</p>
  </div>
</div>

<p class="legend">
  <span><span class="swatch" style="background:#28eb78"></span>the wall being measured</span>
  <span><span class="swatch" style="background:#4696ff"></span>the rest of the BAG footprint</span>
  <span>edges drawn as arcs — a straight 3-D line is not straight in an equirectangular frame</span>
</p>

${sections.join('\n')}

<footer>Street imagery © Gemeente Amsterdam, <em>Kernregistratie Panoramabeelden</em>, CC BY 4.0.
Footprints from BAG; ground and eaves heights from 3DBAG and AHN. Generated by
<code>scripts/facade-twin/model-compare.ts</code>; the camera model is pinned by
<code>scripts/check-facade-camera.ts</code>.</footer>

</div>`;

await mkdir(OUT, { recursive: true });
const file = path.join(OUT, 'index.html');
await writeFile(file, page);
console.log(`${done} pand(en), ${MODELS.length} models → ${path.relative(process.cwd(), file)} (${(page.length / 1e6).toFixed(1)} MB)`);
