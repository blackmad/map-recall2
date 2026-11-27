// Writes <dir>/index.html (before|after review page) from the pairs.json that farlod-frames.mjs wrote; notes.json holds the
// written read per pair. Usage: node scripts/perf/farlod-page.mjs artifacts/landmark-farlod [artifacts/landmark-farlod/notes.json]
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const { results, pairs } = JSON.parse(fs.readFileSync(path.join(dir, 'pairs.json'), 'utf8'));
const notes = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : {};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n == null ? '–' : n.toLocaleString('en-GB');
const kept = pairs.filter(p => p.beyondNoisePx > 0);
const dropped = pairs.filter(p => !(p.beyondNoisePx > 0));
const rows = kept.map(p => `<tr><td>${esc(p.label)}</td><td>${p.tag.replace('far', '')} m</td><td>${fmt(p.trisOff)}</td><td>${fmt(p.trisOn)}</td><td><b>${fmt(p.saved)}</b> (${(100 * p.saved / p.trisOff).toFixed(1)} %)</td><td>${p.drawsOff} / ${p.drawsOn}</td><td>${fmt(p.beyondNoisePx)}</td><td>${fmt(p.noisePx)}</td></tr>`).join('\n');
const sections = kept.map(p => {
  const sw = p.swapped.map(s => `<li>${esc(s)}</li>`).join('');
  const note = notes[`${p.pose}/${p.tag}`] ? `<p class="read"><b>Read:</b> ${esc(notes[`${p.pose}/${p.tag}`])}</p>` : '';
  return `<section id="${p.pose}-${p.tag}">
<h2>${esc(p.label)} — far-lod ${p.tag.replace('far', '')} m</h2>
<p class="meta">Triangles drawn per frame: off <b>${fmt(p.trisOff)}</b> → on <b>${fmt(p.trisOn)}</b>, saved <b>${fmt(p.saved)}</b>. Draws ${p.drawsOff} → ${p.drawsOn}. Changed pixels ${fmt(p.changedPx)} (${fmt(p.beyondNoisePx)} beyond the noise floor of ${fmt(p.noisePx)} between two off frames).</p>
${note}
<h3>Crop, 2× (480×300 device px at ${p.cropAt.join(', ')})</h3>
<div class="pair crop"><figure><img src="${p.cropBefore}" loading="lazy"><figcaption>before (off)</figcaption></figure><figure><img src="${p.cropAfter}" loading="lazy"><figcaption>after (far-lod ${p.tag.replace('far', '')} m)</figcaption></figure></div>
<h3>Full frame, 1512×900 dpr 2</h3>
<div class="pair"><figure><a href="${p.before}"><img src="${p.before}" loading="lazy"></a><figcaption>before (off)</figcaption></figure><figure><a href="${p.after}"><img src="${p.after}" loading="lazy"></a><figcaption>after (far-lod ${p.tag.replace('far', '')} m)</figcaption></figure></div>
<details><summary>${p.swapped.length} landmarks moved to lod1 (eye distance; many are off screen)</summary><ul class="sw">${sw}</ul></details>
</section>`;
}).join('\n');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Landmark far-lod frames</title>
<style>
:root{--bg:#f6f4ef;--fg:#1d1b18;--mut:#6b655c;--line:#d8d2c6;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#171614;--fg:#ece8e1;--mut:#a39c90;--line:#38342e;--card:#211f1c}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1800px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:40px 0 6px;border-top:1px solid var(--line);padding-top:24px}h3{font-size:14px;color:var(--mut);margin:16px 0 6px;font-weight:600}
.meta,.lede{color:var(--mut)}.read{background:var(--card);border:1px solid var(--line);padding:10px 14px;border-radius:6px}
table{border-collapse:collapse;width:100%;background:var(--card);font-variant-numeric:tabular-nums}td,th{border-bottom:1px solid var(--line);padding:6px 10px;text-align:right}td:first-child,th:first-child{text-align:left}
.tw{overflow-x:auto}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pair figure{margin:0}.pair img{width:100%;display:block;border:1px solid var(--line);image-rendering:pixelated}
figcaption{font-size:13px;color:var(--mut);padding:2px 0}
@media (max-width:900px){.pair.crop{grid-template-columns:1fr}}
.sw{columns:3;font-size:13px}@media (max-width:700px){.sw{columns:1}}
</style></head><body><main>
<h1>Landmark far-lod: before | after</h1>
<p class="lede">Switch <code>?landmarkFarLod=&lt;m&gt;</code> (off by default). At street level it puts bespoke landmarks farther than &lt;m&gt; from the rider (eye distance per model) on their lod1. Each pair is the same page and pose with <code>?engine=own</code>, world settled, the rule flipped in place, 1512×900 at dpr 2. No photos: this compares the game with itself. Triangles are every GL draw over 20 forced frames, per frame. The noise floor is a second off frame 5 s later.</p>
${notes._summary ? `<p class="read">${esc(notes._summary)}</p>` : ''}
<div class="tw"><table><tr><th>Pose</th><th>Threshold</th><th>Tris off</th><th>Tris on</th><th>Saved</th><th>Draws off / on</th><th>Px changed beyond noise</th><th>Noise px</th></tr>
${rows}</table></div>
${dropped.length ? `<p class="meta">Dropped (pair did not differ beyond noise): ${dropped.map(p => esc(`${p.label} ${p.tag}`)).join('; ')}.</p>` : ''}
${sections}
<p class="meta">Generated by scripts/perf/farlod-frames.mjs on lane/landmark-residency-20261127, ${new Date().toISOString().slice(0, 10)}.</p>
</main></body></html>`;
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(`kept ${kept.length}, dropped ${dropped.length}`);
