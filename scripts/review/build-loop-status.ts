/** Build a self-contained loop-status demo page from the run directory.
 *
 * Copies the before/after captures the loop produced into public and writes
 * public/canal-drive/loop-status.html. Reporting only; it certifies nothing.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const RUN = '.cache/reconstruction-loop-20260921';
const OUT_DIR = 'public/canal-drive/loop-status';
const OUT_HTML = 'public/canal-drive/loop-status.html';

const read = async (file: string, fallback: any = null) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } };
const esc = (v: unknown) => String(v).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));

const state = await read(`${RUN}/state.json`, {});
const parked = await read(`${RUN}/parked.json`, { items: [] });

// Curated delivered components, each with the loop's own before/after captures.
const DELIVERED = [
  { id: 'case-12', title: 'Rozengracht 160 — missing upper-floor row reconciled from the observed rhythm', before: 'case12-captures/case-12-shapes-full.png', after: 'pass16-floorrows-after/case-12-shapes-full.png' },
  { id: 'case-02', title: 'De Clercqstraat 20/22 — short declared frontage recovered (missing shop window)', before: 'pass13-before/case-02-shapes-full.png', after: 'pass13-after/case-02-shapes-full.png' },
  { id: 'case-30', title: 'Rozengracht 212 — recovered from its registered frontage (blank monolith → full facade)', before: 'pass12-captures/case-30-shapes-full.png', after: 'framing-captures/case-30-shapes-full.png' },
  { id: 'case-27', title: 'De Clercqstraat 79 — source-bound roof coverage added', before: 'pass13-before/case-27-shapes-full.png', after: 'case27-captures2/case-27-shapes-full.png' },
  { id: 'case-18', title: 'Near-white window glazing recoloured instead of blank white panes', before: 'pass15-before/case-18-shapes-full.png', after: 'pass15-after/case-18-shapes-full.png' },
];

await fs.mkdir(OUT_DIR, { recursive: true });
const cards: string[] = [];
for (const item of DELIVERED) {
  const images: string[] = [];
  for (const [label, rel] of [['before', item.before], ['after', item.after]] as const) {
    const src = path.join(RUN, rel);
    try {
      await fs.access(src);
      const name = `${item.id}-${label}.png`;
      await fs.copyFile(src, path.join(OUT_DIR, name));
      images.push(`<figure><img src="./loop-status/${name}" alt="${esc(item.id)} ${label}"><figcaption>${label}</figcaption></figure>`);
    } catch { /* capture absent */ }
  }
  cards.push(`<section class="card"><h3><code>${esc(item.id)}</code> ${esc(item.title)}</h3><div class="pair">${images.join('')}</div></section>`);
}

const parkedRows = (parked.items ?? []).map((entry: any) => {
  const first = String(entry.reason ?? '').split(/(?<=\.)\s/)[0] ?? '';
  return `<tr><td><code>${esc(entry.queue ?? entry.id ?? '')}</code></td><td>${esc(entry.title ?? '')}</td><td>${esc(first.slice(0, 220))}</td></tr>`;
}).join('');

// District renders: the zero-activation path reads compiled tiles directly.
const DISTRICTS = [
  { id: 'apollobuurt-v1', label: 'Zuid perimeter (Apollobuurt)', run: 'overview-oblique' },
];
const districtCards: string[] = [];
for (const d of DISTRICTS) {
  const src = `.cache/reconstruction-loop-20260921/district-renders/${d.id}/${d.run}.png`;
  try {
    await fs.access(src);
    const name = `district-${d.id}.png`;
    await fs.copyFile(src, path.join(OUT_DIR, name));
    districtCards.push(`<section class="card"><h3>${esc(d.label)}</h3><figure style="margin:0"><img class="wide" src="./loop-status/${name}" alt="${esc(d.label)}"><figcaption>compiled massing render · zero activation</figcaption></figure></section>`);
  } catch { /* not rendered yet */ }
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loop status · Map Recall</title>
<style>
:root{--bg:#0f1419;--panel:#161c22;--line:#2a333c;--ink:#e8ecef;--dim:#93a4b1;--good:#7fd4a0;--warn:#f0b46b;--acc:#78c8ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1180px;margin:0 auto;padding:26px 20px 64px}
h1{margin:0 0 4px;font-size:24px}h2{margin:30px 0 12px;font-size:17px;color:var(--acc)}h3{margin:0 0 10px;font-size:15px;font-weight:600}
.sub{color:var(--dim);margin:0 0 16px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:14px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.card .n{font-size:26px;font-weight:700}.card .l{color:var(--dim);font-size:13px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pair figure{margin:0;background:#0b0f12;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.pair img{display:block;width:100%;height:300px;object-fit:contain;background:#000}
.pair figcaption{padding:5px 8px;font-size:12px;color:var(--dim)}
img.wide{display:block;width:100%;height:360px;object-fit:contain;background:#000}
figcaption{padding:5px 8px;font-size:12px;color:var(--dim)}
section.card{margin:14px 0}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);font-size:13.5px;vertical-align:top}
th{color:var(--dim)}tr:last-child td{border-bottom:none}
code{background:#1c242b;border:1px solid var(--line);border-radius:4px;padding:1px 5px;font-size:12.5px}
a.btn{display:inline-block;background:#1d6f4a;border:1px solid #2a8f61;color:#fff;text-decoration:none;padding:9px 15px;border-radius:8px;font-weight:600;margin:4px 8px 4px 0}
a.btn.alt{background:#22303a;border-color:#37474f}
.ok{color:var(--good)}.warn{color:var(--warn)}
</style></head><body><main>
<h1>Reconstruction loop — status</h1>
<p class="sub">Autonomous all-day loop over the 25-case review and three new districts. Measured components only; nothing here certifies fidelity.</p>
<a class="btn" href="./reconstruction-status.html">Calibration + crop dashboard</a>
<a class="btn alt" href="./pano-anchor.html?task=expanded">Anchor tool</a>
<a class="btn alt" href="./reconstruction-workbench.html">Workbench</a>

<div class="cards">
  <div class="card"><div class="n">${esc(state.iteration ?? '—')}</div><div class="l">passes run</div></div>
  <div class="card"><div class="n">${esc((DELIVERED).length)}</div><div class="l">reviewed components delivered</div></div>
  <div class="card"><div class="n">${esc((parked.items ?? []).length)}</div><div class="l">parked with evidence</div></div>
  <div class="card"><div class="n">${esc(state.status ?? '—')}</div><div class="l">loop status</div></div>
  <div class="card"><div class="n" style="font-size:15px">${esc(String(state.deadline ?? '').slice(0, 16))}</div><div class="l">deadline</div></div>
</div>

<h2>Delivered (before → after)</h2>
${cards.join('\n') || '<p class="sub">No captures yet.</p>'}

<h2>Parked with evidence (blockers, not failures)</h2>
<table><thead><tr><th>Queue</th><th>Item</th><th>Reason (first line)</th></tr></thead><tbody>${parkedRows || '<tr><td colspan="3">none</td></tr>'}</tbody></table>

<h2>Districts</h2>
<p class="sub">Zuid perimeter (Apollobuurt), Nieuw-West (Slotervaart), Noord (Tuindorp Nieuwendam).
Apollobuurt and Tuindorp compiled geometry (2,343 buildings for Apollobuurt); evidence/inference was blocked by the $5 spend ceiling, now raised to $25.
Slotervaart needs a network retry. Rendered below with the new zero-activation path (<code>npm run render:district -- --area=&lt;id&gt;</code>),
which reads the compiled tiles directly and never touches <code>current.json</code> or a release.</p>
${districtCards.join('\n') || '<p class="sub">No district renders yet.</p>'}
</main></body></html>`;

await fs.writeFile(OUT_HTML, html);
console.log(JSON.stringify({ output: OUT_HTML, delivered: DELIVERED.length, parked: (parked.items ?? []).length }));
