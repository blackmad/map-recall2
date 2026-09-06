/**
 * The whole boundary on one page, and every building one click from its evidence.
 *
 * `build-explorer.ts` answers "what do we know about this pand" in depth, but it
 * renders a few dozen buildings into one file, so it cannot be the way anybody
 * finds a building worth looking at. Nothing in this project has ever shown the
 * 3,025 at once, which means the questions that need a map -- do the failures
 * cluster on one canal, is that whole terrace unmeasured, where are the anchors
 * that contradict us -- have all been answered by grepping JSON.
 *
 * So: every footprint drawn, coloured by what is known about it, click for the
 * numbers, the 3DBAG massing at each published height, and a link into the
 * explorer's deep view. Vector only, because 3,025 photographs is a different
 * kind of artefact -- the imagery lives in the explorer and the contact sheet,
 * and this page links to them rather than embedding them.
 *
 * Usage: npx tsx scripts/facade-twin/build-city-map.ts
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.join(CACHE, 'city-map');

const readJson = async (p: string, fallback: unknown = null) => {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
};

interface LodBuilding {
  id: string; ring: number[]; ground: number; eaves: number | null; ridge: number | null;
  roof: string; year?: number; reason?: string;
  gable?: { type: string; stated: boolean };
  facade?: { wall: number[]; wallMaterial?: string; openings?: number[][] };
}

const lod = await readJson(path.join(STAGING, 'lod22.json'));
if (!lod) { console.error('lod22.json missing — run build-lod22-extract.ts first'); process.exit(1); }
const buildings = lod.buildings as LodBuilding[];
const origin = lod.metadata.localOrigin as { x: number; y: number };

const measured = ((await readJson(path.join(STAGING, 'measured-facades.json'), { facades: {} })) as any).facades as Record<string, any>;
const attrs = ((await readJson(path.join(CACHE, '3dbag-attributes.json'), { attributes: {} })) as any).attributes as Record<string, any>;
const anchors = ((await readJson(path.join(CACHE, 'number-bands/anchors.json'), { panden: [] })) as any).panden as any[];
const addressPoints = ((await readJson(path.join(CACHE, 'address-points.json'), { addresses: [] })) as any).addresses as
  Array<{ street: string; display: string; pandId: string | null }>;

// Which panden already have a deep view built. A link to a page that is not
// there is worse than the command that builds it, so the panel offers whichever
// is true.
const deep = new Set<string>();
try {
  for (const f of await readdir(path.join(CACHE, 'explorer'))) {
    if (f.endsWith('.html') && f !== 'index.html') deep.add(f.slice(0, -5));
  }
} catch { /* no explorer pages built yet */ }

const verdictOf = new Map<string, string>();
for (const a of anchors) verdictOf.set(a.pandId, a.verdict);
const addressOf = new Map<string, string>();
for (const a of addressPoints) {
  if (!a.pandId || addressOf.has(a.pandId)) continue;
  addressOf.set(a.pandId, `${a.street} ${a.display}`);
}

/**
 * One row per building, small enough that 3,025 of them fit in a page.
 *
 * Rings are the bulk of it, so they are rounded to a decimetre — finer than any
 * question this map answers, and it halves the file.
 */
const rows = buildings.map(b => {
  const m = measured[b.id];
  const a = attrs[b.id] ?? {};
  const round = (v: number | null | undefined, dp = 1) =>
    (typeof v === 'number' && Number.isFinite(v)) ? Number(v.toFixed(dp)) : null;
  return {
    i: b.id,
    r: b.ring.map(v => Number(v.toFixed(1))),
    g: round(b.ground), e: round(b.eaves), k: round(b.ridge),
    rf: b.roof ?? null, y: b.year ?? null,
    ad: addressOf.get(b.id) ?? null,
    // 3DBAG's own numbers, which are the independent check on everything we measure.
    bl: a.b3_bouwlagen ?? null,
    h50: round(a.b3_h_dak_50p), h70: round(a.b3_h_dak_70p),
    hmax: round(a.b3_h_dak_max), hmin: round(a.b3_h_dak_min),
    mv: round(a.b3_h_maaiveld, 2), nok: round(a.b3_h_nok),
    dt: a.b3_dak_type ?? null,
    // What we measured off a photograph, and how much of it to believe.
    ms: m ? { sb: m.storeyBands, by: m.bays, op: m.openings.length, pl: m.plausibility,
      so: m.standoffM, ob: m.obliquityDeg, pn: m.panoramaId, w: m.wallWidthM,
      wall: m.wall.map((v: number) => Number(v.toFixed(1))) } : null,
    v: verdictOf.get(b.id) ?? null,
    dp: deep.has(b.id) ? 1 : 0,
  };
});

const nMeasured = rows.filter(r => r.ms).length;
const nAnchored = rows.filter(r => r.v && r.v !== 'unread').length;

await mkdir(OUT, { recursive: true });
const page = `<title>Grachtengordel West</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;600&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root { --paper:#f5f4ef; --panel:#fbfaf7; --sunk:#efeee7; --ink:#191c19; --muted:#6c716b;
    --rule:#dedbd2; --good:#1f6b45; --ask:#8a4a1f; --stop:#8c3a2b; --plan:#2f6fd0; --water:#c9d8dd;
    --display:"Zilla Slab",Georgia,serif; --body:"Source Sans 3",system-ui,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,Menlo,monospace; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper:#141614; --panel:#1c1f1c; --sunk:#232722; --ink:#eceae3; --muted:#979d96;
    --rule:#2d312d; --good:#5fb98a; --ask:#d9a05e; --stop:#d2735e; --plan:#7aa8e8; --water:#243036; } }
  :root[data-theme="dark"] { --paper:#141614; --panel:#1c1f1c; --sunk:#232722; --ink:#eceae3;
    --muted:#979d96; --rule:#2d312d; --good:#5fb98a; --ask:#d9a05e; --stop:#d2735e; --plan:#7aa8e8; --water:#243036; }
  * { box-sizing:border-box; }
  html,body { height:100%; }
  body { background:var(--paper); color:var(--ink); font-family:var(--body); font-size:14px;
         margin:0; display:flex; flex-direction:column; }
  header { padding:.8rem 1.1rem .7rem; border-bottom:1px solid var(--rule); display:flex;
           gap:1.2rem; align-items:baseline; flex-wrap:wrap; }
  h1 { font-family:var(--display); font-size:1.15rem; margin:0; font-weight:600; }
  .stats { font-family:var(--mono); font-size:.72rem; color:var(--muted); font-variant-numeric:tabular-nums; }
  .legend { display:flex; gap:.8rem; font-size:.72rem; color:var(--muted); margin-left:auto; flex-wrap:wrap; }
  .legend span { display:flex; align-items:center; gap:.3rem; }
  .sw { width:10px; height:10px; border-radius:2px; display:inline-block; }
  main { flex:1; display:flex; min-height:0; }
  #map { flex:1; min-width:0; position:relative; background:var(--sunk); }
  #map svg { width:100%; height:100%; display:block; cursor:grab; }
  #map svg:active { cursor:grabbing; }
  aside { width:370px; flex:0 0 370px; border-left:1px solid var(--rule); background:var(--panel);
          overflow-y:auto; padding:1rem 1.1rem 2rem; }
  aside h2 { font-family:var(--display); font-size:1.05rem; margin:0 0 .1rem; }
  .addr { color:var(--muted); font-size:.85rem; margin-bottom:.9rem; }
  .grp { border-top:1px solid var(--rule); padding-top:.7rem; margin-top:.9rem; }
  .grp h3 { font-family:var(--mono); font-size:.65rem; letter-spacing:.12em; text-transform:uppercase;
            color:var(--muted); margin:0 0 .5rem; font-weight:500; }
  table.kv { width:100%; border-collapse:collapse; font-size:.82rem; }
  table.kv td { padding:.13rem 0; vertical-align:top; }
  table.kv td:first-child { color:var(--muted); padding-right:.7rem; white-space:nowrap; }
  table.kv td:last-child { font-family:var(--mono); font-variant-numeric:tabular-nums; text-align:right; }
  .pill { font-family:var(--mono); font-size:.66rem; letter-spacing:.05em; text-transform:uppercase;
          padding:.1rem .4rem; border-radius:2px; border:1px solid currentColor; }
  .hint { color:var(--muted); font-size:.85rem; line-height:1.5; }
  footer { border-top:1px solid var(--rule); padding:.55rem 1.1rem; color:var(--muted); font-size:.72rem; }
  a { color:var(--plan); }
  path.bld { stroke:var(--rule); stroke-width:.15; cursor:pointer; }
  path.bld:hover { stroke:var(--ink); stroke-width:.5; }
  path.sel { stroke:var(--ink) !important; stroke-width:.7 !important; }
</style>
<header>
  <h1>Grachtengordel West</h1>
  <span class="stats">${rows.length} panden · ${nMeasured} measured · ${nAnchored} with a house number read</span>
  <span class="legend">
    <span><i class="sw" style="background:var(--good)"></i>anchor confirms</span>
    <span><i class="sw" style="background:var(--stop)"></i>anchor contradicts</span>
    <span><i class="sw" style="background:var(--ask)"></i>party wall / neighbour</span>
    <span><i class="sw" style="background:var(--plan)"></i>measured, no number read</span>
    <span><i class="sw" style="background:var(--muted)"></i>not measured</span>
  </span>
</header>
<main>
  <div id="map"><svg id="svg" role="img" aria-label="Building footprints of Grachtengordel West"></svg></div>
  <aside id="side">
    <p class="hint">Click any footprint. Scroll to zoom, drag to pan.<br><br>
    Colour is what the house-number anchor said about that pand — the only measurement here that
    identifies a building rather than describing one.</p>
  </aside>
</main>
<footer>
  BAG footprints, Kadaster (CC0) · 3DBAG LoD2.2 heights, TU Delft (CC BY 4.0), from AHN ·
  generated by <code>scripts/facade-twin/build-city-map.ts</code>
</footer>
<script>
const B = ${JSON.stringify(rows)};
const svg = document.getElementById('svg');
const side = document.getElementById('side');
const NS = 'http://www.w3.org/2000/svg';

// Bounds in local metres, then a viewBox with north up (y is negated).
let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
for (const b of B) for (let i=0;i<b.r.length;i+=2){
  const x=b.r[i], y=-b.r[i+1];
  if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
}
const pad = 20;
const view = { x:x0-pad, y:y0-pad, w:(x1-x0)+pad*2, h:(y1-y0)+pad*2 };
const home = { ...view };
const setView = () => svg.setAttribute('viewBox', view.x+' '+view.y+' '+view.w+' '+view.h);
setView();

const fillFor = b => {
  if (b.v === 'confirmed') return 'var(--good)';
  if (b.v === 'conflict') return 'var(--stop)';
  if (b.v === 'party-wall' || b.v === 'neighbour-only') return 'var(--ask)';
  if (b.ms) return 'var(--plan)';
  return 'var(--muted)';
};

const frag = document.createDocumentFragment();
const nodes = new Map();
for (const b of B) {
  const p = document.createElementNS(NS, 'path');
  let d = '';
  for (let i=0;i<b.r.length;i+=2) d += (i?'L':'M') + b.r[i] + ' ' + (-b.r[i+1]);
  p.setAttribute('d', d + 'Z');
  p.setAttribute('fill', fillFor(b));
  p.setAttribute('fill-opacity', b.ms || b.v ? '0.72' : '0.3');
  p.setAttribute('class', 'bld');
  p.addEventListener('click', e => { e.stopPropagation(); select(b); });
  frag.appendChild(p);
  nodes.set(b.i, p);
}
svg.appendChild(frag);

let selected = null;
const num = (v, unit='') => v === null || v === undefined ? '—' : v + unit;

/**
 * The building on its own, extruded to each height 3DBAG publishes.
 *
 * These are our extrusions of 3DBAG's height percentiles, not 3DBAG's own LoD2.2
 * mesh — that is not cached here. Drawn side by side because the spread between
 * them is the thing worth seeing: a building whose 50th and maximum roof heights
 * are seven metres apart has a roof our flat massing cannot describe.
 */
function massing(b) {
  const levels = [
    ['ground', b.mv, 'var(--muted)'],
    ['h 50%', b.h50, 'var(--plan)'],
    ['h 70%', b.h70, 'var(--ask)'],
    ['h max', b.hmax, 'var(--stop)'],
    ['ridge', b.nok, 'var(--good)'],
  ].filter(l => typeof l[1] === 'number');
  if (levels.length < 2) return '<p class="hint">No 3DBAG heights for this pand.</p>';
  const top = Math.max(...levels.map(l => l[1]));
  const W = 330, H = 130, base = H - 14, scale = (base - 12) / (top || 1);
  let s = '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto">';
  s += '<line x1="8" y1="'+base+'" x2="'+(W-8)+'" y2="'+base+'" stroke="var(--rule)" stroke-width="1"/>';
  const step = (W - 30) / levels.length;
  levels.forEach((l, i) => {
    const [label, h, colour] = l;
    const y = base - h * scale, x = 16 + i * step;
    s += '<rect x="'+x+'" y="'+y+'" width="'+(step*0.62)+'" height="'+(base-y)+'" fill="'+colour+'" fill-opacity="0.35" stroke="'+colour+'" stroke-width="1"/>';
    s += '<text x="'+(x+step*0.31)+'" y="'+(y-3)+'" font-size="8" fill="var(--muted)" text-anchor="middle" font-family="var(--mono)">'+h.toFixed(1)+'</text>';
    s += '<text x="'+(x+step*0.31)+'" y="'+(base+10)+'" font-size="7.5" fill="var(--muted)" text-anchor="middle" font-family="var(--mono)">'+label+'</text>';
  });
  s += '</svg>';
  return s;
}

function select(b) {
  if (selected) selected.classList.remove('sel');
  selected = nodes.get(b.i);
  if (selected) selected.classList.add('sel');
  const v = b.v;
  const pill = v
    ? '<span class="pill" style="color:'+(v==='confirmed'?'var(--good)':v==='conflict'?'var(--stop)':'var(--ask)')+'">'+v+'</span>'
    : '<span class="pill" style="color:var(--muted)">no band</span>';
  side.innerHTML =
    '<h2>' + (b.ad ?? 'Pand ' + b.i.slice(-6)) + '</h2>' +
    '<p class="addr">' + b.i + ' &middot; ' + pill + '</p>' +

    '<div class="grp"><h3>3DBAG says</h3><table class="kv">' +
    '<tr><td>storeys (bouwlagen)</td><td>' + num(b.bl) + '</td></tr>' +
    '<tr><td>roof type</td><td>' + num(b.dt) + '</td></tr>' +
    '<tr><td>ground (maaiveld)</td><td>' + num(b.mv, ' m') + '</td></tr>' +
    '<tr><td>roof 50th / 70th</td><td>' + num(b.h50, ' m') + ' / ' + num(b.h70, ' m') + '</td></tr>' +
    '<tr><td>roof min / max</td><td>' + num(b.hmin, ' m') + ' / ' + num(b.hmax, ' m') + '</td></tr>' +
    '<tr><td>ridge (nok)</td><td>' + num(b.nok, ' m') + '</td></tr>' +
    '<tr><td>built</td><td>' + num(b.y) + '</td></tr>' +
    '</table></div>' +

    '<div class="grp"><h3>Massing at each published height</h3>' + massing(b) + '</div>' +

    '<div class="grp"><h3>Measured off a photograph</h3>' + (b.ms
      ? '<table class="kv">' +
        '<tr><td>storey bands</td><td>' + b.ms.sb + (b.bl ? ' <span style="color:var(--muted)">vs ' + b.bl + '</span>' : '') + '</td></tr>' +
        '<tr><td>bays</td><td>' + b.ms.by + '</td></tr>' +
        '<tr><td>openings</td><td>' + b.ms.op + '</td></tr>' +
        '<tr><td>plausibility</td><td>' + b.ms.pl + '</td></tr>' +
        '<tr><td>wall width</td><td>' + b.ms.w + ' m</td></tr>' +
        '<tr><td>standoff / obliquity</td><td>' + b.ms.so + ' m / ' + b.ms.ob + '&deg;</td></tr>' +
        '<tr><td>panorama</td><td style="font-size:.68rem;word-break:break-all;text-align:left">' + b.ms.pn + '</td></tr>' +
        '</table>' +
        (b.ms.sb === 0 ? '<p class="hint" style="margin-top:.5rem;color:var(--stop)">No opening was confirmed anywhere on this façade, so this row carries no measurement.</p>' : '')
      : '<p class="hint">Not measured. Either no plot-width frontage was found, or no square-on leaf-off view reaches it.</p>') +
    '</div>' +

    '<div class="grp"><h3>Deep view</h3>' + (b.dp
      ? '<p class="hint"><a href="../explorer/' + b.i + '.html">Photographs, rectified strips, the ' +
        'projection into the raw panorama, and the door band &rarr;</a></p>'
      : '<p class="hint">Not built for this pand yet:<br>' +
        '<code style="font-size:.72rem">npx tsx scripts/facade-twin/build-explorer.ts --split --ids=' + b.i + '</code></p>') +
    '</div>';
  side.scrollTop = 0;
}

// Pan and zoom. Wheel zooms about the cursor; drag pans.
let drag = null;
const at = e => {
  const r = svg.getBoundingClientRect();
  return { x: view.x + (e.clientX - r.left) / r.width * view.w,
           y: view.y + (e.clientY - r.top) / r.height * view.h };
};
svg.addEventListener('wheel', e => {
  e.preventDefault();
  const p = at(e), k = Math.exp(e.deltaY * 0.0014);
  const w = Math.min(home.w * 1.4, Math.max(12, view.w * k));
  const s = w / view.w;
  view.x = p.x - (p.x - view.x) * s; view.y = p.y - (p.y - view.y) * s;
  view.w = w; view.h *= s;
  setView();
}, { passive: false });
svg.addEventListener('pointerdown', e => { drag = at(e); svg.setPointerCapture(e.pointerId); });
svg.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = at(e);
  view.x -= p.x - drag.x; view.y -= p.y - drag.y;
  setView();
});
svg.addEventListener('pointerup', e => { drag = null; svg.releasePointerCapture(e.pointerId); });
</script>`;

await writeFile(path.join(OUT, 'index.html'), page);
const kb = (page.length / 1024).toFixed(0);
console.log(`${rows.length} panden — ${nMeasured} measured, ${nAnchored} with a house number read`);
console.log(`  ${deep.size} have a deep view built; the rest show the command that builds one`);
console.log(`wrote ${path.relative(process.cwd(), path.join(OUT, 'index.html'))} (${kb} KB)`);
