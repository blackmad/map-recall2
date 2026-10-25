// HTML for the neighbourhood pages (data.ts decides the content). Static, no
// script beyond the index filter and an image fallback; one shared stylesheet
// inlined per page so a page works on its own. Pages live in canal-drive/buurt/.

import { rideUrl, type BuildingInput, type BuurtPage, type PageFact, type PageName, type PostcardPhoto } from './data';

export interface Shot { file: string; label: string; view: 'chase' | 'aerial'; lng: number; lat: number; bearing: number; width: number; height: number; thumb?: string }
export interface ShotManifest { generatedAt?: string; shots: Record<string, Shot[]> }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fmt = (n: number) => n.toLocaleString('en');
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;
const KIND: Record<string, string> = { neighbourhood: 'Neighbourhood', quarter: 'Quarter' };
const BUILDING_KIND: Record<BuildingInput['kind'], string> = {
  landmark: 'Landmark model', 'landmark-kit': 'Hand-built landmark', 'block-face': 'Surveyed street front', building: 'Modelled building',
};

function link(href: string | undefined, text: string): string {
  return href ? `<a href="${esc(href)}" rel="noopener">${esc(text)}</a>` : esc(text);
}

function source(f: PageFact): string {
  if (!f.sourceUrl) return '';
  let label = f.sourceLabel;
  if (!label) { try { label = new URL(f.sourceUrl).hostname.replace(/^www\./, ''); } catch { label = 'source'; } }
  return ` <a class="src" href="${esc(f.sourceUrl)}" rel="noopener">${esc(label)}</a>`;
}

const STYLE = `
:root{--page:var(--day-paper);--raised:var(--day-paper-raised);--sunk:var(--day-paper-sunk);--ink:var(--day-ink);--muted:var(--day-ink-muted);--line:var(--day-line);--line-strong:var(--day-line-strong);--copper:var(--day-accent);--copper-ink:var(--day-accent-ink);--gutter:clamp(16px,4.5vw,56px);--body:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;--display:var(--font-plaque);color-scheme:light}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--page);color:var(--ink);font:400 17px/1.55 var(--body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{display:block;max-width:100%;height:auto}
a{color:var(--copper-ink);text-underline-offset:.2em;text-decoration-thickness:1px}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:2px solid var(--copper-ink);outline-offset:3px;border-radius:4px}
.wrap{width:min(1180px,100%);margin:0 auto;padding:0 var(--gutter)}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:max(16px,env(safe-area-inset-top));padding-bottom:8px}
.wordmark{display:inline-flex;align-items:center;padding:10px 16px 11px;font:800 18px/1 var(--display);letter-spacing:.08em;text-transform:uppercase;color:#fff;text-decoration:none;white-space:nowrap}
.top nav{display:flex;gap:clamp(10px,2.4vw,24px)}
.top nav a{font:700 15px/1 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--ink);text-decoration:none;padding:10px 2px}
.top nav a:hover{color:var(--copper-ink)}
h1,h2,h3{font-family:var(--display);text-transform:uppercase;margin:0;text-wrap:balance;overflow-wrap:anywhere}
h1{font-weight:800;font-size:clamp(2.6rem,7vw,5rem);line-height:.92;letter-spacing:-.01em}
h2{font-weight:800;font-size:clamp(1.8rem,3.6vw,2.6rem);line-height:.95}
h3{font-weight:700;font-size:1.25rem;line-height:1.05;letter-spacing:.01em}
.kicker{font:700 15px/1.2 var(--display);letter-spacing:.1em;text-transform:uppercase;color:var(--copper-ink);margin:0 0 12px}
.kicker a{color:inherit}
.lede{margin:18px 0 0;max-width:36rem;color:var(--muted);font-size:clamp(17px,1.5vw,19px);text-wrap:pretty}
.stamp{position:relative;display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:13px 26px 12px;border-radius:6px;font:800 18px/1 var(--display);letter-spacing:.08em;text-transform:uppercase;text-decoration:none;color:#2a1606;background:linear-gradient(180deg,var(--enamel-copper-hi) 0%,var(--enamel-copper) 48%,var(--enamel-copper-deep) 100%);box-shadow:0 1px 0 rgba(255,255,255,.35) inset,0 8px 20px rgba(138,85,36,.3)}
.stamp::before{content:'';position:absolute;inset:5px;border:1px solid rgba(255,244,222,.8);border-radius:3px;pointer-events:none}
.stamp:hover{text-decoration:none;transform:translateY(-1px)}
.ctas{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;margin-top:26px}
.facts-line{font-size:15px;color:var(--muted)}
.hero{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:clamp(28px,5vw,64px);align-items:center;padding-top:clamp(20px,5vw,56px);padding-bottom:clamp(36px,6vw,72px)}
.postcard{margin:0;background:#fffdf8;padding:10px 10px 0;border-radius:4px;box-shadow:0 1px 2px rgba(31,28,23,.12),0 18px 44px rgba(31,28,23,.2);transform:rotate(.8deg)}
.postcard .img{aspect-ratio:3/2;background:var(--sunk);overflow:hidden;border-radius:2px;position:relative}
.postcard img{width:100%;height:100%;object-fit:cover}
.postcard figcaption{padding:8px 2px 10px;font-size:12.5px;line-height:1.35;color:var(--muted);overflow-wrap:anywhere}
.postcard .blank{position:absolute;inset:0;display:grid;place-items:center;padding:20px;text-align:center;font:800 clamp(1.6rem,4vw,2.6rem)/1 var(--display);text-transform:uppercase;color:var(--enamel-ink);background:var(--enamel);overflow-wrap:anywhere}
section{padding:clamp(36px,6vw,72px) 0;border-top:1px solid var(--line)}
.sec-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 20px;margin-bottom:22px}
.sec-head p{margin:0;color:var(--muted);font-size:15px;max-width:40rem}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px}
.shots figure{margin:0}
.shots .frame{aspect-ratio:16/10;overflow:hidden;border-radius:8px;background:var(--sunk);border:1px solid var(--line-strong)}
.shots img{width:100%;height:100%;object-fit:cover}
figcaption{margin-top:8px;font-size:14px;color:var(--muted);overflow-wrap:anywhere}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:14px;list-style:none;margin:0;padding:0}
.card{display:flex;flex-direction:column;background:var(--raised);border:1px solid var(--line);border-radius:8px;overflow:hidden;min-width:0}
.card .thumb{aspect-ratio:4/3;background:var(--sunk);overflow:hidden}
.card .thumb img{width:100%;height:100%;object-fit:cover}
.card .thumb.none{display:grid;place-items:center;color:var(--muted);font:700 13px/1 var(--display);letter-spacing:.1em;text-transform:uppercase}
.card .body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:4px;flex:1}
.card h3{font-size:1.1rem}
.card .meta{margin:0;font-size:13.5px;color:var(--muted)}
.card .desc{margin:2px 0 0;font-size:13.5px;line-height:1.4;color:var(--ink);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card .credit{margin:0;font-size:11.5px;color:var(--muted);overflow-wrap:anywhere}
.card .links{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:auto;padding-top:6px;font-size:14.5px}
.compact{columns:2 280px;column-gap:32px;margin:0;padding:0;list-style:none}
.compact li{break-inside:avoid;padding:6px 0;border-bottom:1px solid var(--line);font-size:15px}
.compact li b{font-weight:600}
.compact .n{color:var(--muted);float:right;margin-left:10px}
.empty{color:var(--muted);font-size:15.5px;max-width:40rem;margin:0}
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:14px 28px;margin:0;padding:0;list-style:none}
.facts li{padding-left:16px;border-left:3px solid var(--copper);font-size:16px;text-wrap:pretty}
.facts li .who{display:block;font:700 13px/1.3 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--copper-ink);margin-bottom:2px}
.src{font-size:12.5px;color:var(--muted);white-space:nowrap}
.names{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:16px 28px;margin:0;padding:0;list-style:none}
.names li{font-size:15.5px;text-wrap:pretty;min-width:0}
.names li b{display:block;font:700 16px/1.25 var(--display);letter-spacing:.04em;text-transform:uppercase;overflow-wrap:anywhere}
.names .reg{display:block;color:var(--muted);font-size:14px}
details{margin-top:22px}
details summary{cursor:pointer;font:700 15px/1.3 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--copper-ink)}
details[open] summary{margin-bottom:14px}
.plain{color:var(--muted);font-size:14.5px;line-height:1.6;margin:0;overflow-wrap:anywhere}
.around{display:flex;flex-wrap:wrap;gap:10px}
.chip{display:inline-flex;align-items:center;min-height:40px;padding:8px 14px;border:1px solid var(--line-strong);border-radius:999px;background:var(--raised);color:var(--ink);text-decoration:none;font-size:15px;overflow-wrap:anywhere}
.chip:hover{border-color:var(--copper)}
footer{padding:30px 0 max(30px,env(safe-area-inset-bottom));border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
footer .wrap{display:flex;flex-wrap:wrap;gap:10px 26px;justify-content:space-between}
footer p{margin:0;max-width:46rem}
footer p a{color:var(--muted)}
.filter{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin:26px 0 0}
.filter input{font:inherit;font-size:16px;min-height:46px;padding:10px 14px;border:1px solid var(--line-strong);border-radius:6px;background:var(--raised);color:var(--ink);width:min(100%,360px)}
.filter span{color:var(--muted);font-size:15px}
.hoods{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:16px;list-style:none;margin:0;padding:0}
.hoods a{display:flex;flex-direction:column;height:100%;text-decoration:none;color:inherit;background:var(--raised);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.hoods a:hover{border-color:var(--copper)}
.hoods .thumb{aspect-ratio:16/10;background:var(--sunk);overflow:hidden;position:relative}
.hoods .thumb img{width:100%;height:100%;object-fit:cover}
.hoods .thumb .blank{position:absolute;inset:0;display:grid;place-items:center;padding:12px;text-align:center;font:800 1.5rem/1 var(--display);text-transform:uppercase;color:var(--enamel-ink);background:var(--enamel);overflow-wrap:anywhere}
.hoods .body{padding:12px 14px 14px}
.hoods h2{font-size:1.45rem;line-height:1}
.hoods p{margin:6px 0 0;font-size:13.5px;color:var(--muted)}
@media (max-width:760px){
 .hero{grid-template-columns:minmax(0,1fr)}
 .postcard{transform:none}
 .top nav .hide-sm{display:none}
 .compact{columns:1}
 .hoods{grid-template-columns:1fr 1fr;gap:10px}
 .hoods h2{font-size:1.1rem}
 .hoods .body{padding:9px 10px 11px}
 .hoods p{font-size:12.5px}
 .hoods .thumb .blank{font-size:1.1rem}
}
`;

function shell(opts: { title: string; description: string; body: string; script?: string; canonical: string; image?: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<meta name="theme-color" content="#f4efe5">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ride Amsterdam">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="https://rideamsterdam.nl/buurt/${esc(opts.canonical)}">
${opts.image ? `<meta property="og:image" content="https://rideamsterdam.nl/buurt/${esc(opts.image)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<link rel="canonical" href="https://rideamsterdam.nl/buurt/${esc(opts.canonical)}">
<link rel="icon" type="image/svg+xml" href="../assets/brand/icon.svg">
<link rel="apple-touch-icon" href="../assets/brand/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&display=swap" rel="stylesheet">
<link href="../css/enamel.css" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body>
<header class="wrap top">
  <a class="wordmark enamel-plaque enamel-framed" href="../landing.html" aria-label="Ride Amsterdam home">Ride Amsterdam</a>
  <nav aria-label="Site">
    <a href="index.html">Neighbourhoods</a>
    <a class="hide-sm" href="../explore.html">Buildings</a>
    <a href="../index.html">Ride</a>
  </nav>
</header>
<main>
${opts.body}
</main>
<footer>
  <div class="wrap">
    <p>Text from Wikipedia (CC BY-SA) and the Amsterdam street-name register (BAG); photos from Wikimedia Commons, credited under each one; bridge facts from the city's bridge register. Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors. In-game frames are from Ride Amsterdam. <a href="../credits.html">All credits</a>.</p>
    <p><a href="index.html">All neighbourhoods</a></p>
  </div>
</footer>
<script>
// Load-time fixes only: the dev server serves this tree under /canal-drive/, where the
// ride is index.html and the landing page landing.html; the public site serves the
// landing page at / and the ride at /ride (scripts/assemble-canalrecall-site.mjs).
(function(){if(location.pathname.indexOf('/canal-drive/')>=0)return;document.querySelectorAll('a[href="../landing.html"]').forEach(function(a){a.setAttribute('href','/')});document.querySelectorAll('a[href^="../index.html"]').forEach(function(a){a.setAttribute('href',a.getAttribute('href').replace('../index.html','/ride'))});})();
${opts.script ?? ''}
</script>
</body>
</html>
`;
}

function photoCredit(p: PostcardPhoto): string {
  const credit = esc(p.credit.replace(/^Wikimedia Commons:\s*/, ''));
  const borrowed = p.borrowedFrom ? `Photo of ${esc(p.borrowedFrom)}, which includes this area. ` : '';
  return `${borrowed}${p.sourceUrl ? `<a href="${esc(p.sourceUrl)}" rel="noopener">${credit}</a>` : credit}, via Wikimedia Commons`;
}

function heroFigure(p: BuurtPage, shots: Shot[]): string {
  const fallback = shots.find(s => s.view === 'aerial') ?? shots[0];
  if (p.postcard) {
    const onerror = fallback
      ? `this.onerror=null;this.src='${esc(fallback.file)}';this.closest('figure').querySelector('figcaption').textContent='In the game: ${esc(fallback.label.replace(/'/g, ''))}'`
      : `this.remove()`;
    return `<figure class="postcard"><div class="img"><div class="blank" aria-hidden="true">${esc(p.name)}</div><img src="${esc(p.postcard.url)}" alt="${esc(p.postcard.borrowedFrom ? `${p.postcard.borrowedFrom}, Amsterdam` : `${p.name}, Amsterdam`)}" referrerpolicy="no-referrer" onerror="${onerror}" style="position:relative"></div><figcaption>${photoCredit(p.postcard)}</figcaption></figure>`;
  }
  if (fallback) {
    return `<figure class="postcard"><div class="img"><img src="${esc(fallback.file)}" alt="${esc(`${p.name} in Ride Amsterdam`)}" width="${fallback.width}" height="${fallback.height}"></div><figcaption>In the game: ${esc(fallback.label)}. No photo on file for this area yet.</figcaption></figure>`;
  }
  return `<figure class="postcard"><div class="img"><div class="blank">${esc(p.name)}</div></div><figcaption>No photo on file for this area yet.</figcaption></figure>`;
}

function buildingCard(b: BuildingInput, shot: Shot | undefined): string {
  let thumb = `<div class="thumb none">No picture yet</div>`, credit = '';
  if (b.photo) thumb = `<div class="thumb"><img src="../${esc(b.photo)}" alt="${esc(`Model of ${b.name}`)}" loading="lazy" decoding="async"></div>`;
  else if (shot) thumb = `<div class="thumb"><img src="${esc(shot.thumb ?? shot.file)}" alt="${esc(`${b.name} in Ride Amsterdam`)}" loading="lazy" decoding="async"></div>`;
  else if (b.remotePhoto) {
    thumb = `<div class="thumb"><img src="${esc(b.remotePhoto.url)}" alt="${esc(b.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.className='thumb none';this.parentNode.textContent='No picture yet'"></div>`;
    credit = `<p class="credit">Photo: ${b.remotePhoto.sourceUrl ? `<a href="${esc(b.remotePhoto.sourceUrl)}" rel="noopener">${esc(b.remotePhoto.credit.replace(/^Wikimedia Commons:\s*/, ''))}</a>` : esc(b.remotePhoto.credit)}</p>`;
  }
  const meta = [BUILDING_KIND[b.kind], b.triangles ? `${fmt(b.triangles)} triangles` : ''].filter(Boolean).join(' · ');
  return `<li class="card">${thumb}<div class="body"><h3>${esc(b.name)}</h3><p class="meta">${esc(meta)}</p>${b.description ? `<p class="desc">${esc(b.description)}</p>` : ''}${credit}<div class="links"><a href="${esc(rideUrl(b.lng, b.lat))}">Ride there</a>${b.gallery ? `<a href="${esc(b.gallery)}">See the model</a>` : ''}</div></div></li>`;
}

function nameList(list: PageName[], what: string): string {
  const told = list.filter(n => n.origin || n.register);
  const rest = list.filter(n => !n.origin && !n.register);
  const items = told.map(n => `<li><b>${esc(n.name)}</b>${n.origin ? esc(n.origin) : ''}${n.register ? `<span class="reg">${esc(n.register)}</span>` : ''}</li>`);
  const shown = items.slice(0, 12), more = items.slice(12);
  let html = shown.length ? `<ul class="names">${shown.join('')}</ul>` : '';
  if (more.length) html += `<details><summary>${plural(more.length, `more ${what}`, `more ${what}s`)} with a story</summary><ul class="names">${more.join('')}</ul></details>`;
  if (rest.length) html += `<details><summary>${plural(rest.length, `other ${what}`, `other ${what}s`)} without a recorded story</summary><p class="plain">${rest.map(n => esc(n.name)).join(' · ')}</p></details>`;
  return html;
}

export function renderBuurtPage(p: BuurtPage, shots: Shot[], all: readonly BuurtPage[]): string {
  const kind = KIND[p.kind] ?? 'Area';
  const ride = rideUrl(p.centre[1], p.centre[0]);
  const kitTotal = p.kits.reduce((s, k) => s + k.count, 0);
  const factTotal = p.stories.length + p.subjects.reduce((s, x) => s + x.facts.length, 0);
  const origins = [...p.streets, ...p.waters, ...p.bridges].filter(n => n.origin).length;
  const tally = [p.buildings.length && plural(p.buildings.length, 'modelled building'), kitTotal && plural(kitTotal, 'kit building'),
    factTotal && plural(factTotal, 'fact'), origins && plural(origins, 'name story', 'name stories')].filter(Boolean).join(' · ');
  const kicker = p.parent ? `${kind} in <a href="${esc(p.parent.slug)}.html">${esc(p.parent.name)}</a>` : `${kind} · Amsterdam`;
  const lede = p.intro ? `<p class="lede">${esc(p.intro.text)}${source(p.intro)}</p>` : `<p class="lede">One of the ${all.length} neighbourhoods whose postcard you can collect on a ride through Amsterdam.</p>`;
  const origin = p.nameOrigin ? `<p class="lede"><strong>The name.</strong> ${esc(p.nameOrigin.text)}${source(p.nameOrigin)}</p>` : '';

  const chase = shots.filter(s => s.view === 'chase'), aerial = shots.filter(s => s.view === 'aerial');
  const ordered = [...aerial, ...chase];
  const shotsHtml = ordered.length
    ? `<div class="shots">${ordered.map(s => `<figure><div class="frame"><img src="${esc(s.file)}" alt="${esc(`Ride Amsterdam: ${s.label}`)}" width="${s.width}" height="${s.height}" loading="lazy" decoding="async"></div><figcaption>${esc(s.label)} · <a href="${esc(rideUrl(s.lng, s.lat))}">ride from here</a></figcaption></figure>`).join('')}</div>`
    : `<p class="empty">No frames captured here yet. <a href="${esc(ride)}">Ride there</a> and see it for yourself.</p>`;

  const shotFor = (b: BuildingInput) => chase.find(s => s.label === b.name);
  const LIST_CAP = 24;
  const cards = p.buildings.slice(0, LIST_CAP).map(b => buildingCard(b, shotFor(b))).join('');
  const extraBuildings = p.buildings.slice(LIST_CAP);
  let buildingsHtml = p.buildings.length ? `<ul class="cards">${cards}</ul>` : '';
  if (extraBuildings.length) buildingsHtml += `<details><summary>${plural(extraBuildings.length, 'more modelled building')}</summary><ul class="compact">${extraBuildings.map(b => `<li><a href="${esc(rideUrl(b.lng, b.lat))}">${esc(b.name)}</a> <span class="n">${esc(BUILDING_KIND[b.kind])}</span></li>`).join('')}</ul></details>`;
  if (p.kits.length) buildingsHtml += `<h3 style="margin:${p.buildings.length ? '30px' : '0'} 0 10px">Drawn from the building kit</h3><p class="empty" style="margin-bottom:12px">${plural(kitTotal, 'building')} here use one of the game's reusable post-war building designs, fitted to their real footprint.</p><ul class="compact">${p.kits.map(k => `<li><b>${esc(k.label)}</b> <span class="n">${fmt(k.count)}</span></li>`).join('')}</ul>`;
  if (!p.buildings.length && !p.kits.length) buildingsHtml = `<p class="empty">Nothing here is individually modelled yet: the ride draws ${esc(p.name)} from the city's 3D building register (3DBAG), with real heights and roofs.</p>`;

  const facts: string[] = [];
  for (const f of p.stories) facts.push(`<li>${esc(f.text)}${source(f)}</li>`);
  for (const s of p.subjects) for (const f of s.facts) facts.push(`<li><span class="who">${esc(s.name)}</span>${esc(f.text)}${source(f)}</li>`);
  const FACT_CAP = 14;
  let factsHtml = facts.length ? `<ul class="facts">${facts.slice(0, FACT_CAP).join('')}</ul>` : `<p class="empty">No trivia on file for ${esc(p.name)} yet.</p>`;
  if (facts.length > FACT_CAP) factsHtml += `<details><summary>${plural(facts.length - FACT_CAP, 'more fact')}</summary><ul class="facts">${facts.slice(FACT_CAP).join('')}</ul></details>`;

  const namesBlocks = [
    p.waters.length && `<h3 style="margin:0 0 14px">Canals and water</h3>${nameList(p.waters, 'canal') || '<p class="empty">No stories on file.</p>'}`,
    p.bridges.length && `<h3 style="margin:30px 0 14px">Bridges</h3>${nameList(p.bridges, 'bridge') || '<p class="empty">No stories on file.</p>'}`,
    p.streets.length && `<h3 style="margin:30px 0 14px">Streets</h3>${nameList(p.streets, 'street') || '<p class="empty">No stories on file.</p>'}`,
  ].filter(Boolean).join('');

  const around = [
    p.parent && `<a class="chip" href="${esc(p.parent.slug)}.html">Part of ${esc(p.parent.name)}</a>`,
    ...p.children.map(c => `<a class="chip" href="${esc(c.slug)}.html">${esc(c.name)}</a>`),
  ].filter(Boolean).join('');

  const photosHtml = p.photos.length ? `<details><summary>${plural(p.photos.length, 'more photo')} of ${esc(p.name)}</summary><div class="shots">${p.photos.map(ph => `<figure><div class="frame"><img src="${esc(ph.url)}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()"></div><figcaption>${photoCredit(ph)}</figcaption></figure>`).join('')}</div></details>` : '';

  const body = `
<div class="wrap hero">
  <div>
    <p class="kicker">${kicker}</p>
    <h1>${esc(p.name)}</h1>
    ${lede}
    ${origin}
    <div class="ctas"><a class="stamp" href="${esc(ride)}">Ride ${esc(p.name)}</a>${tally ? `<span class="facts-line">${esc(tally)}</span>` : ''}</div>
  </div>
  ${heroFigure(p, shots)}
</div>
<section aria-labelledby="shots-title"><div class="wrap">
  <div class="sec-head"><h2 id="shots-title">In the game</h2><p>Frames from a ride through ${esc(p.name)}.</p></div>
  ${shotsHtml}
  ${photosHtml}
</div></section>
<section aria-labelledby="built-title"><div class="wrap">
  <div class="sec-head"><h2 id="built-title">Built here</h2><p>Buildings modelled one by one for the ride.</p></div>
  ${buildingsHtml}
</div></section>
<section aria-labelledby="facts-title"><div class="wrap">
  <div class="sec-head"><h2 id="facts-title">Did you know</h2><p>Trivia the ride can show you here.</p></div>
  ${factsHtml}
</div></section>
${namesBlocks ? `<section aria-labelledby="names-title"><div class="wrap">
  <div class="sec-head"><h2 id="names-title">Names on the map</h2><p>Where the canal, bridge and street names come from.</p></div>
  ${namesBlocks}
</div></section>` : ''}
${around ? `<section aria-labelledby="around-title"><div class="wrap">
  <div class="sec-head"><h2 id="around-title">Around ${esc(p.name)}</h2></div>
  <div class="around">${around}</div>
</div></section>` : ''}`;
  const description = p.intro?.text.slice(0, 180) ?? `${p.name}, Amsterdam: its buildings, trivia and street names in Ride Amsterdam.`;
  const og = ordered[0]?.file;
  return shell({ title: `${p.name} — Ride Amsterdam`, description, body, canonical: `${p.slug}.html`, image: og });
}

export function renderBuurtIndex(pages: readonly BuurtPage[], manifest: ShotManifest): string {
  const items = pages.map(p => {
    const shots = manifest.shots[p.slug] ?? [];
    const shot = shots.find(s => s.view === 'aerial') ?? shots[0];
    const img = shot
      ? `<img src="${esc(shot.thumb ?? shot.file)}" alt="" loading="lazy" decoding="async">`
      : p.postcard ? `<img src="${esc(p.postcard.url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
    const kitTotal = p.kits.reduce((s, k) => s + k.count, 0);
    const bits = [p.buildings.length && plural(p.buildings.length, 'model'), kitTotal && plural(kitTotal, 'kit building'),
      (p.stories.length + p.subjects.length) && plural(p.stories.length + p.subjects.reduce((s, x) => s + x.facts.length, 0), 'fact')].filter(Boolean).join(' · ');
    const where = p.parent ? `${KIND[p.kind] ?? 'Area'} in ${p.parent.name}` : KIND[p.kind] ?? 'Area';
    return `<li data-name="${esc(`${p.name} ${p.parent?.name ?? ''}`.toLowerCase())}"><a href="${esc(p.slug)}.html"><div class="thumb"><div class="blank" aria-hidden="true">${esc(p.name)}</div>${img.replace('<img ', '<img style="position:relative" ')}</div><div class="body"><h2>${esc(p.name)}</h2><p>${esc(where)}${bits ? ` · ${esc(bits)}` : ''}</p></div></a></li>`;
  }).join('\n');
  const body = `
<div class="wrap" style="padding-top:clamp(20px,5vw,56px);padding-bottom:clamp(28px,5vw,56px)">
  <p class="kicker">Amsterdam, area by area</p>
  <h1>Neighbourhoods</h1>
  <p class="lede">Every neighbourhood and quarter whose postcard you can collect on a ride: what the game has modelled there, the stories behind its canal and street names, and frames from the ride itself.</p>
  <div class="filter"><label for="q" class="visually-hidden" style="position:absolute;left:-9999px">Find a neighbourhood</label><input id="q" type="search" placeholder="Find a neighbourhood" autocomplete="off"><span id="count">${plural(pages.length, 'neighbourhood')}</span></div>
</div>
<section style="padding-top:clamp(24px,4vw,40px)"><div class="wrap">
<ul class="hoods" id="hoods">
${items}
</ul>
<p class="empty" id="none" hidden>No neighbourhood matches.</p>
</div></section>`;
  const script = `(function(){var q=document.getElementById('q'),items=[].slice.call(document.querySelectorAll('#hoods li')),count=document.getElementById('count'),none=document.getElementById('none');q.addEventListener('input',function(){var v=q.value.trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,''),n=0;items.forEach(function(li){var hit=!v||li.dataset.name.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').indexOf(v)>=0;li.hidden=!hit;if(hit)n++});count.textContent=n+(n===1?' neighbourhood':' neighbourhoods');none.hidden=n>0});})();`;
  return shell({ title: 'Neighbourhoods — Ride Amsterdam', description: 'Amsterdam neighbourhood by neighbourhood: modelled buildings, trivia, street-name stories and frames from Ride Amsterdam.', body, script, canonical: 'index.html' });
}
