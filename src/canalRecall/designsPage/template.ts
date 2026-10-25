// HTML for designs.html (GitHub #84). Static, in the neighbourhood pages' look
// (buurtPages/template.ts STYLE), with one small inline script for the filter.
// The page sits in canal-drive/, so its links have no ../ prefix.

import { STYLE } from '../buurtPages/template';
import type { Design, DesignTotals } from './data';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fmt = (n: number) => n.toLocaleString('en');
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;
const ROOF: Record<string, string> = { flat: 'flat roof', gable: 'pitched roof', hip: 'hipped roof', mono: 'single-slope roof', pairGable: 'paired gables', mansard: 'mansard roof' };
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DESIGN_STYLE = `
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:24px;max-width:560px}
.stat{background:var(--raised);border:1px solid var(--line);border-radius:8px;padding:10px 14px}
.stat b{display:block;font:800 clamp(1.7rem,4.4vw,2.4rem)/1 var(--display);letter-spacing:.02em}
.stat span{font-size:13px;color:var(--muted)}
.filter select{font:inherit;font-size:16px;min-height:46px;padding:10px 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--raised);color:var(--ink);max-width:100%}
.designs{display:grid;gap:22px;list-style:none;margin:0;padding:0}
.design{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:18px 26px;background:var(--raised);border:1px solid var(--line);border-radius:10px;padding:16px;scroll-margin-top:16px;min-width:0}
.design:target{border-color:var(--copper);box-shadow:0 0 0 2px var(--copper)}
.side{display:flex;flex-direction:column;gap:12px;min-width:0}
.pics{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start;min-width:0}
.pics figure{margin:0;min-width:0}
.pics .frame{aspect-ratio:4/3;background:var(--sunk);border-radius:6px;overflow:hidden;position:relative}
.pics img{width:100%;height:100%;object-fit:cover}
.pics .none{position:absolute;inset:0;display:grid;place-items:center;padding:10px;text-align:center;color:var(--muted);font:700 13px/1.2 var(--display);letter-spacing:.1em;text-transform:uppercase}
.pics figcaption{margin-top:5px;font-size:12px;line-height:1.35}
.info{display:flex;flex-direction:column;gap:10px;min-width:0}
.info h2{font-size:clamp(1.35rem,2.4vw,1.75rem);line-height:1}
.info .id{font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);overflow-wrap:anywhere}
.info .meta{margin:0;font-size:14.5px;color:var(--muted)}
.info .meta b{color:var(--ink);font-weight:700}
.info .full{margin:0;font-size:14px;line-height:1.45;overflow-wrap:anywhere}
.info h3{font-size:.95rem;letter-spacing:.06em;margin:4px 0 -4px;color:var(--copper-ink)}
.where{margin:0;font-size:14.5px;line-height:1.5;overflow-wrap:anywhere}
.where .n{color:var(--muted);font-variant-numeric:tabular-nums}
.vars{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0;padding:0;list-style:none;font-size:13.5px}
.vars li{display:flex;align-items:center;gap:6px;min-width:0}
.vars i{flex:none;width:16px;height:16px;border-radius:3px;border:1px solid rgba(0,0,0,.25)}
.vars .n{color:var(--muted)}
.map{display:block;width:100%;max-width:420px;height:auto;aspect-ratio:4/3;background:var(--sunk);border:1px solid var(--line);border-radius:6px}
.map path{fill:none;stroke:var(--line-strong);stroke-width:.8}
.map path.dots{stroke:var(--copper);stroke-linecap:round}
.map text{font:600 10px var(--body);fill:var(--muted)}
.map .bar{stroke:var(--ink);stroke-width:2}
.go{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin-top:auto;padding-top:4px}
.go .stamp{min-height:44px;padding:11px 20px 10px;font-size:16px}
.go a:not(.stamp){font-size:14.5px}
.credit{color:var(--muted)}
@media (max-width:860px){.design{grid-template-columns:minmax(0,1fr)}}
@media (max-width:760px){.stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.stat{padding:8px 10px}.stat span{font-size:12px}.design{padding:12px}.pics{gap:6px}}
`;

function mapSvg(d: Design): string {
  const m = d.map;
  if (!m) return '';
  const r = d.count > 300 ? 1.6 : d.count > 60 ? 2 : 2.6;
  // One path of zero-length round-capped strokes: a dot per house at a tenth of the bytes of <circle>s.
  const dots = `<path class="dots" style="stroke-width:${r * 2}px" d="${m.dots.map(([x, y]) => `M${x} ${y}h0`).join('')}"/>`;
  const label = m.scaleM >= 1000 ? `${m.scaleM / 1000} km` : `${m.scaleM} m`;
  return `<svg class="map" viewBox="0 0 ${m.width} ${m.height}" role="img" aria-label="${esc(`Map: where the ${plural(d.count, 'house')} of this design stand`)}"><path d="${m.outlines.join('')}"/>${dots}<line class="bar" x1="10" y1="${m.height - 10}" x2="${10 + m.scalePx}" y2="${m.height - 10}"/><text x="10" y="${m.height - 15}">${label}</text></svg>`;
}

function pics(d: Design): string {
  const img = (src: string | undefined, alt: string) => src
    ? `<img src="${esc(src)}" alt="${esc(alt)}" width="640" height="480" loading="lazy" decoding="async">`
    : `<div class="none">No picture yet</div>`;
  return `<div class="pics">
<figure><div class="frame">${img(d.images.photo, `Street photo of a ${d.title} house`)}</div><figcaption class="credit">${d.images.photo ? 'The street, as photographed. Panorama © City of Amsterdam, CC BY 4.0' : 'No street photo on file'}</figcaption></figure>
<figure><div class="frame">${img(d.images.render, `The game's model of ${d.title}`)}</div><figcaption class="credit">${d.images.render ? 'The design, as the game draws it' : 'Not rendered yet'}</figcaption></figure>
</div>`;
}

export function designCard(d: Design): string {
  const years = d.years ? (d.years[0] === d.years[1] ? `${d.years[0]}` : `${d.years[0]}–${d.years[1]}`) : '';
  const meta = [years && `built <b>${years}</b>`, d.storeys && `${d.storeys} storeys`, d.roof && (ROOF[d.roof] ?? `${d.roof} roof`)].filter(Boolean).join(' · ');
  const SHOW = 6;
  const where = d.buurten.slice(0, SHOW).map(b => `${esc(b.name)} <span class="n">${fmt(b.count)}</span>`).join(', ');
  const more = d.buurten.length > SHOW ? `, and ${plural(d.buurten.length - SHOW, 'more buurt', 'more buurten')}` : '';
  const wijken = [...new Set(d.buurten.map(b => b.wijk).filter(Boolean))].slice(0, 4).join(', ');
  const vars = d.variants.length > 1 || (d.variants[0] && d.variants[0].label)
    ? `<h3>${plural(d.variants.length, 'variant')}</h3><ul class="vars">${d.variants.map(v => `<li>${v.wall ? `<i style="background:${esc(v.wall)}" aria-hidden="true"></i>` : ''}<span>${esc(v.label)}${v.count ? ` <span class="n">${fmt(v.count)}</span>` : ''}</span></li>`).join('')}</ul>` : '';
  const pages = d.pages.slice(0, 3).map(p => `<a href="buurt/${esc(p.slug)}.html">${esc(p.name)}</a>`).join(' · ');
  const q = fold([d.title, d.id, d.label, ...d.buurten.map(b => `${b.name} ${b.wijk ?? ''}`), ...d.stadsdelen, ...d.pages.map(p => p.name)].join(' '));
  return `<li class="design" id="${esc(d.id)}" data-st="${esc(d.stadsdelen.join('|'))}" data-q="${esc(q)}">
<div class="side">${pics(d)}${mapSvg(d)}</div>
<div class="info">
<div>${d.place ? `<p class="kicker" style="margin:0 0 6px;font-size:14px">${esc(d.place)}</p>` : ''}<h2>${esc(d.title)}</h2><span class="id">${esc(d.id)}</span></div>
<p class="meta"><b>${plural(d.count, 'house')}</b> in the game${meta ? ` · ${meta}` : ''}</p>
<p class="full">${esc(d.label)}</p>
${d.buurten.length ? `<h3>Where</h3><p class="where">${d.stadsdelen.length ? `<b>${esc(d.stadsdelen.join(', '))}</b>${wijken ? ` (${esc(wijken)})` : ''}: ` : ''}${where}${more}</p>` : '<p class="where">Not placed in the game yet.</p>'}
${vars}
<div class="go">${d.ride ? `<a class="stamp" href="${esc(d.ride.href)}">See it in the game</a>` : ''}${pages ? `<span>${pages}</span>` : ''}</div>
</div>
</li>`;
}

export function renderDesignsPage(designs: readonly Design[], t: DesignTotals): string {
  const options = t.stadsdelen.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const body = `
<div class="wrap" style="padding-top:clamp(20px,5vw,56px);padding-bottom:clamp(24px,4vw,40px)">
  <p class="kicker">Amsterdam, house by house</p>
  <h1>Building designs</h1>
  <p class="lede">Whole streets of Amsterdam were built to one design. The game measures each design once from street photos, then places it on every real footprint where it was built. Here is every design, the street it was measured on, and where its houses stand.</p>
  <div class="stats">
    <div class="stat"><b>${fmt(t.designs)}</b><span>designs</span></div>
    <div class="stat"><b>${fmt(t.houses)}</b><span>houses placed</span></div>
    <div class="stat"><b>${fmt(t.buurten)}</b><span>buurten</span></div>
  </div>
  <div class="filter">
    <label for="q" style="position:absolute;left:-9999px">Find a design or neighbourhood</label><input id="q" type="search" placeholder="Find a design or neighbourhood" autocomplete="off">
    <label for="st" style="position:absolute;left:-9999px">District</label><select id="st"><option value="">All districts</option>${options}</select>
    <span id="count" role="status">${plural(designs.length, 'design')}</span>
  </div>
</div>
<section style="padding-top:clamp(20px,3vw,32px)"><div class="wrap">
<ul class="designs" id="designs">
${designs.map(designCard).join('\n')}
</ul>
<p class="empty" id="none" hidden>No design matches.</p>
</div></section>`;
  const script = `(function(){var q=document.getElementById('q'),st=document.getElementById('st'),items=[].slice.call(document.querySelectorAll('#designs > li')),count=document.getElementById('count'),none=document.getElementById('none');function f(s){return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()}function run(){var v=f(q.value.trim()),d=st.value,n=0;items.forEach(function(li){var hit=(!v||li.dataset.q.indexOf(v)>=0)&&(!d||li.dataset.st.split('|').indexOf(d)>=0);li.hidden=!hit;if(hit)n++});count.textContent=n+(n===1?' design':' designs');none.hidden=n>0}q.addEventListener('input',run);st.addEventListener('change',run);})();`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Building designs — Ride Amsterdam</title>
<meta name="description" content="Every repeated building design in Ride Amsterdam: the street photo it was measured from, the model, and the ${fmt(t.houses)} houses it draws across ${fmt(t.buurten)} Amsterdam buurten.">
<meta name="theme-color" content="#f4efe5">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ride Amsterdam">
<meta property="og:title" content="Building designs — Ride Amsterdam">
<link rel="canonical" href="https://rideamsterdam.nl/designs.html">
<link rel="icon" type="image/svg+xml" href="assets/brand/icon.svg">
<link rel="apple-touch-icon" href="assets/brand/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&display=swap" rel="stylesheet">
<link href="css/enamel.css" rel="stylesheet">
<style>${STYLE}${DESIGN_STYLE}</style>
</head>
<body>
<header class="wrap top">
  <a class="wordmark enamel-plaque enamel-framed" href="landing.html" aria-label="Ride Amsterdam home">Ride Amsterdam</a>
  <nav aria-label="Site">
    <a href="buurt/index.html">Neighbourhoods</a>
    <a class="hide-sm" href="explore.html">Buildings</a>
    <a href="index.html">Ride</a>
  </nav>
</header>
<main>
${body}
</main>
<footer>
  <div class="wrap">
    <p>Street photos: City of Amsterdam panorama images (<a href="https://data.amsterdam.nl">data.amsterdam.nl</a>), CC BY 4.0. Buurt outlines: City of Amsterdam, CC0. Building years: BAG. Models and renders: Ride Amsterdam. <a href="credits.html">All credits</a>.</p>
    <p><a href="buurt/index.html">All neighbourhoods</a> · <a href="devlog.html">Dev log</a></p>
  </div>
</footer>
<script>
// Load-time fixes only: the public site serves the landing page at / and the ride at /ride (scripts/assemble-canalrecall-site.mjs).
(function(){if(location.pathname.indexOf('/canal-drive/')>=0)return;document.querySelectorAll('a[href="landing.html"]').forEach(function(a){a.setAttribute('href','/')});document.querySelectorAll('a[href^="index.html"]').forEach(function(a){a.setAttribute('href',a.getAttribute('href').replace('index.html','/ride'))});})();
${script}
</script>
</body>
</html>
`;
}
