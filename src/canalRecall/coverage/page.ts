/**
 * coverage.html: the buurt coverage map inside the app. Click a buurt to see what we have for it: block-face type
 * libraries, block faces, building-type designs, placed models, landmark kits and street surveys, with thumbnails and
 * links to the existing viewers; a buurt with nothing says so and names its top uncovered repeat cluster.
 * Data: ../data/extracts/amsterdam/coverage-v1/buurten.json (map + per-buurt id lists) and contents.json (catalogue,
 * loaded on first selection), both from scripts/coverage/build-coverage.ts.
 * Bundle: npm run build:coverage-page → js/coverage.bundle.js.
 * Test contract: window.coveragePage = {ready, errors, selected, select(code)}.
 */
import { CONTENT_KINDS, TIERS, parseClusterKey, type BuurtContent, type BuurtCoverage, type TierId } from './coverage';
import type { ContentItems, Link, Thumb } from './contents';

type Props = BuurtCoverage & { content: BuurtContent };
type Feature = { properties: Props; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }; polys: [number, number][][][] };
type Extract = { features: Feature[]; generatedAt: string; method: string };

const DATA = '../data/extracts/amsterdam/coverage-v1/';
const state = { ready: false, errors: [] as string[], selected: null as string | null, select: (code: string) => { void code; } };
(window as unknown as { coveragePage: typeof state }).coveragePage = state;

type Kid = Node | string | null | undefined | false;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Kid | Kid[])[]): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) n.append(k);
  return n;
};
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => n.toLocaleString('en-GB');
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 2 : 1)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;
const TIER_LABEL = Object.fromEntries(TIERS.map(t => [t.id, t.label])) as Record<TierId, string>;

// ---- map ------------------------------------------------------------------------------------------------
const merc = ([lng, lat]: number[]): [number, number] => [lng, Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI];
const kitTypeBespoke = (p: Props) => p.pands ? (p.tiers.bespoke + p.tiers.chunk + p.tiers.buildingType) / p.pands : 0;
const kinds = (p: Props) => CONTENT_KINDS.filter(k => p.content[k].length).length;
const METRICS: Record<string, { label: string; value: (p: Props) => number; bins: number[]; unit?: boolean; legend?: string[] }> = {
  content: { label: 'What we have (kinds of kit content)', value: kinds, bins: [0, 1, 2, 3, 4, 5], legend: ['nothing', '1 kind', '2 kinds', '3 kinds', '4 kinds', '5 kinds'] },
  share: { label: 'Modelled share (all tiers, flags on)', value: p => p.share, bins: [0, 0.005, 0.02, 0.05, 0.15, 0.4] },
  shareDefault: { label: 'Modelled share (default game)', value: p => p.shareDefault, bins: [0, 0.005, 0.02, 0.05, 0.15, 0.4] },
  kitTypeBespoke: { label: 'Kit + type + bespoke share', value: kitTypeBespoke, bins: [0, 0.005, 0.02, 0.05, 0.15, 0.4] },
  repetition: { label: 'Repetition score', value: p => p.repetition, bins: [0, 0.2, 0.35, 0.5, 0.65, 0.8], unit: true },
  priority: { label: 'Generator priority', value: p => p.priority, bins: [0, 0.2, 0.35, 0.5, 0.65, 0.8], unit: true },
};
function binOf(v: number, bins: number[], exact: boolean): number {
  if (exact) return Math.max(0, Math.min(6, Math.round(v)));
  if (!(v > 0)) return 0;
  let b = 1; for (let i = 1; i < bins.length; i++) if (v >= bins[i]) b = i + 1;
  return Math.min(b, 6);
}

async function main() {
  const res = await fetch(`${DATA}buurten.json`);
  if (!res.ok) throw new Error(`buurten.json: ${res.status}`);
  const data = await res.json() as Extract;
  const feats = data.features;
  for (const f of feats) {
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    f.polys = polys.map(poly => poly.map(ring => ring.map(merc)));
  }
  let contents: Promise<ContentItems> | null = null;
  const loadContents = () => contents ??= fetch(`${DATA}contents.json`).then(r => { if (!r.ok) throw new Error(`contents.json: ${r.status}`); return r.json(); }).then(j => j.items as ContentItems);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of feats) for (const poly of f.polys) for (const [x, y] of poly[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }

  // ---- totals ----
  const withContent = feats.filter(f => kinds(f.properties) > 0);
  $('summary').textContent = `${feats.length} buurten · ${withContent.length} with some kit content · ` +
    `${feats.filter(f => f.properties.content.faces.length || f.properties.content.types.length).length} with block-face work · ` +
    `${feats.filter(f => f.properties.content.designs.length).length} with building-type designs. Generated ${data.generatedAt.slice(0, 10)}.`;

  // ---- controls ----
  const metric = $<HTMLSelectElement>('metric');
  for (const [k, m] of Object.entries(METRICS)) metric.append(new Option(m.label, k));
  const params = new URLSearchParams(location.search);
  metric.value = params.get('colour') && METRICS[params.get('colour')!] ? params.get('colour')! : 'share';
  const search = $<HTMLInputElement>('search'), names = $('names');
  for (const f of [...feats].sort((a, b) => a.properties.name.localeCompare(b.properties.name))) names.append(h('option', { value: `${f.properties.name} (${f.properties.code})` }));

  // ---- canvas ----
  const canvas = $<HTMLCanvasElement>('map'), ctx = canvas.getContext('2d')!;
  const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  let base = { s: 1, ox: 0, oy: 0 }, zoom = 1, panX = 0, panY = 0, hovered: Feature | null = null, selected: Feature | null = null;
  const view = () => ({ s: base.s * zoom, ox: base.ox * zoom + panX - (zoom - 1) * canvas.clientWidth / 2, oy: base.oy * zoom + panY - (zoom - 1) * canvas.clientHeight / 2 });
  function fit() {
    const w = canvas.clientWidth, hgt = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 10, s = Math.min((w - 2 * pad) / (maxX - minX), (hgt - 2 * pad) / (maxY - minY));
    base = { s, ox: (w - s * (maxX - minX)) / 2, oy: (hgt - s * (maxY - minY)) / 2 };
  }
  const toPx = ([x, y]: [number, number], v = view()) => [v.ox + (x - minX) * v.s, v.oy + (maxY - y) * v.s];
  function trace(f: Feature, v = view()) { ctx.beginPath(); for (const poly of f.polys) for (const ring of poly) ring.forEach((pt, i) => { const [x, y] = toPx(pt, v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); }
  function draw() {
    const v = view();
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const m = METRICS[metric.value], fills = [0, 1, 2, 3, 4, 5, 6].map(i => css(`--s${i}`)), empty = css('--empty'), stroke = css('--stroke');
    for (const f of feats) {
      trace(f, v);
      ctx.fillStyle = f.properties.pands ? fills[binOf(m.value(f.properties), m.bins, !!m.legend)] : empty;
      ctx.fill('evenodd');
      ctx.strokeStyle = stroke; ctx.lineWidth = 0.75; ctx.stroke();
    }
    for (const [f, w] of [[hovered, 2], [selected, 3]] as const) if (f) { trace(f, v); ctx.strokeStyle = css('--hi'); ctx.lineWidth = w; ctx.stroke(); }
  }
  function legend() {
    const m = METRICS[metric.value], b = m.bins;
    const lab = (i: number) => m.legend ? m.legend[i] : i === 0 ? (m.unit ? '0' : 'none') : i === 6 ? `≥ ${m.unit ? b[5] : pct(b[5])}` : `${m.unit ? b[i - 1] : pct(b[i - 1])}–${m.unit ? b[i] : pct(b[i])}`;
    const n = m.legend ? m.legend.length : 7;
    $('legend').replaceChildren(...Array.from({ length: n }, (_, i) => h('span', {}, h('span', { class: 'sw', style: `background:var(--s${i})` }), lab(i))),
      h('span', {}, h('span', { class: 'sw', style: 'background:var(--empty);outline:1px dashed var(--mut)' }), 'no pands'));
  }
  function inRing(x: number, y: number, ring: [number, number][]) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function hit(cx: number, cy: number): Feature | null {
    const v = view(), x = minX + (cx - v.ox) / v.s, y = maxY - (cy - v.oy) / v.s;
    for (const f of feats) for (const poly of f.polys) { let c = false; for (const ring of poly) if (inRing(x, y, ring)) c = !c; if (c) return f; }
    return null;
  }
  const tip = $('tip');
  function showTip(f: Feature | null, cx = 0, cy = 0) {
    if (!f) { tip.hidden = true; return; }
    const p = f.properties, k = kinds(p);
    tip.replaceChildren(h('b', {}, p.name), h('span', {}, ` ${p.code} · ${k ? `${k} kind${k === 1 ? '' : 's'} of kit content` : 'nothing yet'}`));
    tip.hidden = false;
    tip.style.left = `${Math.min(canvas.clientWidth - tip.offsetWidth - 6, cx + 12)}px`;
    tip.style.top = `${Math.max(6, cy - tip.offsetHeight - 8)}px`;
  }

  // pan / zoom / click
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; px: number; py: number; moved: boolean; pinch?: number; zoom0?: number } | null = null;
  const clampZoom = (z: number) => Math.max(1, Math.min(40, z));
  function zoomAt(z: number, cx: number, cy: number) {
    const v0 = view(), wx = (cx - v0.ox) / v0.s, wy = (cy - v0.oy) / v0.s;
    zoom = clampZoom(z);
    const v1 = view();
    panX += cx - (v1.ox + wx * v1.s); panY += cy - (v1.oy + wy * v1.s);
    if (zoom === 1) panX = panY = 0;
    draw();
  }
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(zoom * Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; drag = { x: 0, y: 0, px: panX, py: panY, moved: true, pinch: Math.hypot(a.x - b.x, a.y - b.y), zoom0: zoom }; }
    else drag = { x: e.offsetX, y: e.offsetY, px: panX, py: panY, moved: false };
  });
  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (drag?.pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      zoomAt(drag.zoom0! * Math.hypot(a.x - b.x, a.y - b.y) / drag.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (drag && pointers.size === 1) {
      const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved && zoom > 1) { panX = drag.px + dx; panY = drag.py + dy; draw(); }
      return;
    }
    if (e.pointerType === 'touch') return;
    const f = hit(e.offsetX, e.offsetY);
    if (f !== hovered) { hovered = f; draw(); }
    showTip(f, e.offsetX, e.offsetY);
  });
  const end = (e: PointerEvent) => {
    const wasClick = drag && !drag.moved && pointers.size === 1;
    pointers.delete(e.pointerId);
    if (wasClick && e.type === 'pointerup') { const f = hit(e.offsetX, e.offsetY); if (f) select(f.properties.code, true); }
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (hovered) { hovered = null; draw(); } showTip(null); });
  $('zin').addEventListener('click', () => zoomAt(zoom * 1.6, canvas.clientWidth / 2, canvas.clientHeight / 2));
  $('zout').addEventListener('click', () => zoomAt(zoom / 1.6, canvas.clientWidth / 2, canvas.clientHeight / 2));
  $('zreset').addEventListener('click', () => { zoom = 1; panX = panY = 0; draw(); });

  // ---- selection ----
  const panel = $('panel');
  let token = 0;
  async function select(code: string, fromMap = false) {
    const f = feats.find(x => x.properties.code === code);
    if (!f) return;
    selected = f; state.selected = code; draw();
    search.value = `${f.properties.name} (${code})`;
    const url = new URL(location.href); url.searchParams.set('buurt', code); history.replaceState(null, '', url);
    const mine = ++token;
    panel.replaceChildren(head(f.properties), h('p', { class: 'mut' }, 'Loading the catalogue…'));
    let items: ContentItems;
    try { items = await loadContents(); } catch (err) { state.errors.push(String(err)); panel.append(h('p', { class: 'err' }, `Could not load contents.json: ${err}`)); return; }
    if (mine !== token) return;
    panel.replaceChildren(...render(f.properties, items));
    panel.scrollTop = 0;
    if (fromMap && matchMedia('(max-width: 899px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  state.select = code => { void select(code); };
  search.addEventListener('change', () => {
    const m = /\(([A-Z0-9]+)\)\s*$/.exec(search.value) ?? [null, feats.find(f => f.properties.name.toLowerCase() === search.value.trim().toLowerCase())?.properties.code];
    if (m[1]) void select(m[1]);
  });
  metric.addEventListener('input', () => { legend(); draw(); const u = new URL(location.href); u.searchParams.set('colour', metric.value); history.replaceState(null, '', u); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
  new ResizeObserver(() => { fit(); draw(); }).observe(canvas);
  fit(); legend(); draw();
  const initial = params.get('buurt');
  if (initial && feats.some(f => f.properties.code === initial)) await select(initial);
  else panel.replaceChildren(h('p', { class: 'hint' }, 'Click a buurt on the map, or search for one by name, to see the type libraries, block faces, building-type designs, models and kits we have for it.'));
  state.ready = true;
}

// ---- panel rendering ------------------------------------------------------------------------------------
function head(p: Props): HTMLElement {
  return h('header', { class: 'phead' },
    h('h2', {}, p.name),
    h('p', { class: 'mut' }, [p.code, p.wijk, p.gebied, p.stadsdeel].filter(Boolean).join(' · ')));
}

const linkEls = (links: Link[]) => links.length ? h('p', { class: 'links' }, ...links.map(l => h('a', { href: l.href, ...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {}) }, l.label))) : null;
function img(t: Thumb, cls = 'thumb'): HTMLElement {
  const el = h('img', { src: t.src, alt: t.label, title: t.label, loading: 'lazy', decoding: 'async', class: cls });
  el.addEventListener('error', () => el.remove());
  return el;
}
const section = (id: string, title: string, count: number | string, ...kids: Kid[]) => h('section', { class: 'sec', id: `sec-${id}` }, h('h3', {}, title, h('span', { class: 'count' }, String(count))), ...kids);
const chip = (text: string, cls = 'chip') => h('span', { class: cls }, text);
const STATUS_TEXT: Record<string, string> = { installed: 'Installed', held: 'Held', staged: 'Staged', authored: 'Authored', discovery: 'Discovery only' };

function render(p: Props, items: ContentItems): HTMLElement[] {
  const c = p.content;
  const out: HTMLElement[] = [head(p)];
  // numbers
  const max = Math.max(1, ...TIERS.map(t => p.tiers[t.id]));
  out.push(h('div', { class: 'nums' },
    h('dl', {},
      h('dt', {}, 'Pands'), h('dd', {}, `${fmt(p.pands)} `, h('span', { class: 'mut' }, `(${fmt(p.minor)} sheds/annexes)`)),
      h('dt', {}, 'Modelled'), h('dd', {}, `${pct(p.share)} `, h('span', { class: 'mut' }, `· ${pct(p.shareDefault)} in the default game`)),
      h('dt', {}, 'Repetition'), h('dd', {}, p.repetition.toFixed(2), h('span', { class: 'mut' }, ` · priority ${p.priority.toFixed(2)}`)),
      h('dt', {}, 'Uncovered repeats'), h('dd', {}, `${fmt(p.repetitiveGeneric)} generic pands in the top clusters`),
      h('dt', {}, 'Top clusters'), h('dd', {}, p.clusters.map(k => `${k.key} (${k.n})`).join(', ') || '–'),
      h('dt', {}, 'Decade'), h('dd', {}, p.decade ? `${p.decade}s ` : '–', p.decade ? h('span', { class: 'mut' }, pct(p.decadeShare)) : null)),
    h('table', { class: 'tiers' }, h('tbody', {}, ...TIERS.map(t => h('tr', { class: t.defaultOn ? '' : 'off' },
      h('td', {}, t.label, t.defaultOn ? '' : ' (flag)'), h('td', { class: 'n' }, fmt(p.tiers[t.id])),
      h('td', { class: 'bar' }, h('i', { style: `width:${p.tiers[t.id] ? Math.max(2, 100 * p.tiers[t.id] / max) : 0}%` }))))))));

  const facesHere = new Set(c.faces.map(([id]) => id));
  const models = c.models.filter(([id]) => { const m = items.models[id]; return !(m?.tier === 'chunk' && facesHere.has(id.replace(/^chunk-face-/, ''))); });
  const anything = CONTENT_KINDS.some(k => c[k].length) || p.survey.streets.length;
  const cand = p.clusters[0] && parseClusterKey(p.clusters[0].key);
  const candidate = cand ? h('p', { class: 'cand' }, h('b', {}, 'Next generator candidate: '),
    `${cand.widthM}–${cand.widthM + 1} m wide × ${cand.heightM}–${cand.heightM + 3} m high, built ${cand.year}–${cand.year + 4}: ${plural(p.clusters[0].n, 'pand')} in this buurt's largest repeat cluster`,
    p.repetitiveGeneric ? ` (${fmt(p.repetitiveGeneric)} generic pands across its top three clusters).` : '.') : null;

  if (!anything) {
    out.push(h('div', { class: 'empty' },
      h('p', {}, h('b', {}, 'Nothing yet. '), p.pands ? `Every one of the ${fmt(p.pands)} pands here is drawn as a generic extrusion: no type library, block face, building-type design, model or landmark kit reaches this buurt.` : 'This buurt has no BAG pands in the base tiles.'),
      candidate ?? (p.pands ? h('p', { class: 'mut' }, 'No repeat cluster: the pands here lack heights or build years.') : null)));
    return out;
  }
  out.push(h('nav', { class: 'jump' }, ...[
    ['types', 'Type libraries', c.types.length], ['faces', 'Block faces', c.faces.length], ['designs', 'Building types', c.designs.length],
    ['models', 'Models', models.length], ['kits', 'Landmark kits', c.kits.length], ['surveys', 'Surveys', p.survey.streets.length],
  ].filter(([, , n]) => n).map(([id, label, n]) => h('a', { href: `#sec-${id}` }, `${label} ${n}`))));

  if (c.types.length) out.push(section('types', 'Block-face type libraries', c.types.length,
    h('p', { class: 'note' }, 'House types measured from photo strips; a type is listed when one of its evidence pands stands in this buurt.'),
    ...c.types.map(([id, n]) => {
      const t = items.types[id];
      if (!t) return null;
      const here = t.exemplars.filter(e => e.buurt === p.code);
      const shown = (here.length ? here : t.exemplars).slice(0, 6);
      return h('article', { class: 'card' },
        h('header', {}, h('h4', {}, id), h('span', { class: 'mut' }, `${t.district}${t.era ? ` · ${t.era[0] === t.era[1] ? t.era[0] : `${t.era[0]}–${t.era[1]}`}` : ''} · ${plural(n, 'evidence pand')} here`)),
        h('p', { class: 'desc' }, t.description),
        t.swatches.length ? h('div', { class: 'swatches' }, ...t.swatches.map(s => h('div', { class: 'pal', title: s.name }, h('span', { class: 'pname' }, s.name),
          ...s.colors.map(([role, col]) => h('span', { class: 'sw', style: `background:${col}`, title: `${role} ${col}` }))))) : null,
        t.kitKeys.length ? h('div', { class: 'chips' }, ...t.kitKeys.map(k => chip(k))) : null,
        h('div', { class: 'ex' }, h('span', { class: 'lbl' }, here.length ? 'Exemplars here' : 'Exemplars (elsewhere)'),
          ...shown.map(e => e.thumb ? h('figure', {}, img(e.thumb), h('figcaption', {}, `…${e.pand.slice(-6)}`)) : chip(`pand …${e.pand.slice(-6)}`, 'chip pand')),
          shown.some(e => e.thumb) ? null : h('span', { class: 'mut small' }, 'No photo crop shipped for these pands yet.')),
        t.faces.length ? h('p', { class: 'small' }, 'From faces: ', ...t.faces.map((fid, i) => [i ? ', ' : '', facesHere.has(fid) ? h('a', { href: `#face-${fid}` }, fid) : fid]).flat()) : null);
    })));

  if (c.faces.length) out.push(section('faces', 'Block faces', c.faces.length,
    ...c.faces.map(([id, n]) => {
      const f = items.faces[id];
      if (!f) return null;
      return h('article', { class: 'card', id: `face-${id}` },
        h('header', {}, h('h4', {}, f.title), h('span', { class: `badge ${f.status}` }, STATUS_TEXT[f.status] ?? f.status)),
        h('p', { class: 'mut small' }, `${id} · ${n} of ${plural(f.pands, 'pand')} here`),
        h('p', { class: 'small' }, f.note),
        f.thumbs.length ? h('div', { class: 'strip' }, ...f.thumbs.map(t => h('figure', {}, img(t, 'wide'), h('figcaption', {}, t.label)))) : null,
        linkEls(f.links));
    })));

  if (c.designs.length) out.push(section('designs', 'Building-type designs', c.designs.length,
    h('p', { class: 'note' }, 'Parametric post-war types instanced on BAG pands (drawn by default since 2026-10-16).'),
    h('div', { class: 'rows' }, ...c.designs.map(([unit, n]) => {
      const d = items.designs[unit];
      if (!d) return null;
      const row = h('article', { class: 'row' },
        h('div', {}, h('b', {}, d.family), h('span', { class: 'mut small' }, ` · ${d.variant}${d.storeys ? ` · ${d.storeys} storeys` : ''}${d.roof ? ` · ${d.roof} roof` : ''}${unit.split('__').slice(4).map(x => ` · ${x}`).join('')}`),
          h('p', { class: 'small' }, d.label)),
        h('div', { class: 'cnt' }, h('b', {}, fmt(n)), h('span', { class: 'mut small' }, ` here / ${fmt(d.instances)}`)));
      if (d.preview) {
        const btn = h('button', { type: 'button', class: 'prev' }, 'Preview 3D');
        btn.addEventListener('click', () => {
          const open = row.querySelector('iframe');
          if (open) { open.remove(); btn.textContent = 'Preview 3D'; return; }
          row.append(h('iframe', { src: d.preview!, title: `3D preview of ${unit}`, loading: 'lazy' })); btn.textContent = 'Close preview';
        });
        row.append(h('p', { class: 'links' }, btn, ...d.links.map(l => h('a', { href: l.href }, l.label))));
      }
      return row;
    }))));

  if (models.length) {
    const byTier = new Map<string, [string, number][]>();
    for (const m of models) { const t = items.models[m[0]]?.tier ?? 'bespoke'; byTier.set(t, [...(byTier.get(t) ?? []), m]); }
    out.push(section('models', 'Placed models', models.length,
      ...TIERS.filter(t => byTier.has(t.id)).map(t => h('div', { class: 'grp' }, h('h5', {}, t.label, t.defaultOn ? '' : ' (behind a flag)'),
        h('div', { class: 'tiles' }, ...byTier.get(t.id)!.map(([id]) => {
          const m = items.models[id];
          return h('article', { class: 'tile' }, m.thumb ? img(m.thumb) : h('div', { class: 'ph' }, 'no photo'),
            h('div', {}, h('b', { title: m.name }, m.name), h('p', { class: 'mut small' }, id), linkEls(m.links)));
        }))))));
  }

  if (c.kits.length) out.push(section('kits', 'Landmark kits', c.kits.length,
    h('ul', { class: 'plain' }, ...c.kits.map(([name, n]) => {
      const k = items.kits[name];
      return h('li', {}, h('b', {}, name), h('span', { class: 'mut small' }, ` · ${plural(n, 'pand')} · ${k?.hand ? 'hand-modelled kit' : 'generic kit (no gallery page)'}`), ' ', ...(k?.links ?? []).map(l => h('a', { href: l.href }, l.label)));
    }))));

  if (p.survey.streets.length) out.push(section('surveys', 'Street surveys', p.survey.streets.length,
    h('p', { class: 'small' }, `${plural(p.survey.pands, 'pand')} here appear in a street survey; ${plural(p.types.pands, 'pand')} are type evidence; ${plural(p.faces, 'pand')} sit on a block face.`),
    h('ul', { class: 'plain' }, ...p.survey.streets.map(s => {
      const links = items.surveys[s]?.links ?? [];
      return h('li', {}, links.length ? h('a', { href: links[0].href }, s) : s, links.length ? '' : h('span', { class: 'mut small' }, ' (survey data only; not on the street-surveys page yet)'));
    }))));

  if (candidate) out.push(section('next', 'Next generator candidate', '', candidate));
  return out;
}

main().catch(err => {
  state.errors.push(String(err));
  const el = document.getElementById('panel');
  if (el) el.replaceChildren(h('p', { class: 'err' }, `Could not load the coverage map: ${err}`));
});
