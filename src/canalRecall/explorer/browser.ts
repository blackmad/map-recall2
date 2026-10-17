/**
 * The neighbourhood explorer page (canal-drive/explore.html): a MapLibre map
 * with a pin for every modelled building, a neighbourhood picker, name search,
 * and a panel with a live 3D view, the BAG pand, a GLB download and feedback.
 *
 * three.js (js/three.bundle.js) and the feedback form (js/feedback/browser.js)
 * load only when first needed; the page itself is this bundle plus MapLibre.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { canalPageLinks } from '../../siteLinks';
import { FootprintLookup } from './pandLookup';
import {
  deepLinkSearch, formatBytes, KIND_LABEL, modelsIn, pandIndex, panelView, parseDeepLink, reportOptions, requestOptions, searchModels,
  type ClickTarget, type FeedbackOptions,
} from './panel';
import {
  asksForLook, findLook, groupKitKeys, kitKeyLabel, lookReportOptions, looksIn, lookSummary, nearestLook, slugify,
  type ExplorerLooks, type LookBuurt, type LookRecipe, type LookUse, type Swatch,
} from './looks';
import { ELSEWHERE, type ExplorerIndex, type ExplorerKind, type ExplorerModel, type LngLat } from './types';
import type { ModelViewer } from './viewer';

declare const maplibregl: any;
const w = window as any;

const EXTRACT = '../data/extracts/amsterdam';
const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const AMSTERDAM: [number, number, number, number] = [4.80, 52.33, 4.97, 52.41];
const LIST_PAGE = 60;
export const PIN_COLOUR: Readonly<Record<ExplorerKind, string>> = { landmark: '#0b3a8c', ordinary: '#b4682c', block: '#6f6657', house: '#6f6657' };

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]) => {
  const node = document.createElement(tag);
  const { class: cls, ...rest } = props as any;
  if (cls) node.className = cls;
  Object.assign(node, rest);
  node.append(...children);
  return node;
};

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  let p = scripts.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scripts.delete(src); reject(new Error(`Could not load ${src}`)); };
      document.head.appendChild(s);
    });
    scripts.set(src, p);
  }
  return p;
}

/** Opens the shared feedback form, loading it on first use. A page (or test) that already has CanalFeedback keeps it. */
async function openFeedback(options: FeedbackOptions): Promise<void> {
  try {
    if (!w.CanalFeedback?.open) await loadScript('js/feedback/browser.js');
    w.CanalFeedback.open(options);
  } catch {
    alert('The feedback form could not load. Please try again in a moment.');
  }
}

const isPhone = () => window.matchMedia('(max-width: 759px)').matches;

class Explorer {
  private index!: ExplorerIndex;
  private byId = new Map<string, ExplorerModel>();
  private byPand = new Map<string, ExplorerModel>();
  private map: any;
  private buurt: string | undefined;
  private selected: ExplorerModel | undefined;
  private viewer: ModelViewer | undefined;
  private viewerLoading: Promise<ModelViewer> | undefined;
  private popup: any;
  private footprints = new FootprintLookup(EXTRACT);
  private outlines: Promise<any[]> | undefined;
  private listShown = LIST_PAGE;
  /** explorer-looks.json, fetched on first use (a picked neighbourhood, the look entry, a `?buurt=<slug>` link). */
  private looks: Promise<ExplorerLooks> | undefined;
  /** The open look view: a buurt with its own look, one without, or the list of those that have one. */
  private look: { kind: 'buurt'; buurt: LookBuurt; use: number } | { kind: 'none'; slug?: string; name: string } | { kind: 'index' } | undefined;

  async start(): Promise<void> {
    this.links();
    const res = await fetch(`${EXTRACT}/explorer-index.json`);
    if (!res.ok) throw new Error(`explorer-index.json: ${res.status}`);
    this.index = await res.json();
    for (const m of this.index.models) this.byId.set(m.id, m);
    this.byPand = pandIndex(this.index.models);
    $('#count').textContent = this.index.models.length.toLocaleString('en-GB');
    this.fillPicker();
    this.bindRail();
    const link = parseDeepLink(location.search, this.index);
    const raw = new URLSearchParams(location.search).get('buurt')?.trim();
    // `?buurt=<slug>` (or a CBS code, or a buurt name the filter does not know) opens that buurt's own look.
    let look: ReturnType<typeof findLook>;
    if (raw && (!link.buurt || raw === slugify(raw) || /^[A-Z]{2}\d{2}$/.test(raw))) {
      const looks = await this.loadLooks().catch(() => undefined);
      if (looks && asksForLook(raw, this.index.buurten.map(b => b.name), looks)) look = findLook(looks, raw);
    }
    this.buurt = look && 'look' in look ? look.look.explorerBuurt : link.buurt;
    ($('#buurt') as HTMLSelectElement).value = this.buurt ?? '';
    this.renderList();
    this.initMap(link, look && 'look' in look ? look.look.bbox : undefined);
    if (look) {
      if ('look' in look) void this.openLook(look.look, { fit: false });
      else this.openNoLook(look.none.name, look.none.slug);
    } else if (link.model) void this.open(link.model, { fly: !link.buurt });
    void this.renderLookEntry();
    document.body.dataset.ready = '1';
  }

  private links(): void {
    const l = canalPageLinks(location.pathname);
    for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-link]')) {
      const key = a.dataset.link as keyof typeof l;
      if (l[key]) a.href = l[key];
    }
  }

  // ---------- rail: picker, search, list ----------

  private fillPicker(): void {
    const select = $('#buurt') as HTMLSelectElement;
    select.append(el('option', { value: '', textContent: `All of Amsterdam (${this.index.models.length})` }));
    for (const b of this.index.buurten) select.append(el('option', { value: b.name, textContent: b.name }));
  }

  private bindRail(): void {
    ($('#buurt') as HTMLSelectElement).addEventListener('change', e => this.pickBuurt((e.target as HTMLSelectElement).value || undefined));
    const search = $('#search') as HTMLInputElement;
    search.addEventListener('input', () => this.renderSearch(search.value));
    search.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const first = $('#results button') as HTMLButtonElement | null; first?.click(); }
      if (e.key === 'Escape') { search.value = ''; this.renderSearch(''); }
    });
    $('#more').addEventListener('click', () => { this.listShown += LIST_PAGE * 2; this.renderList(); });
    $('#sheet-handle').addEventListener('click', () => this.toggleSheet());
    $('#close').addEventListener('click', () => this.close());
    $('#report').addEventListener('click', () => { if (this.selected) void openFeedback(reportOptions(this.selected)); });
    $('#l-report').addEventListener('click', () => { if (this.look?.kind === 'buurt') void openFeedback(lookReportOptions(this.look.buurt)); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && (this.selected || this.look) && !document.querySelector('dialog[open]')) this.close(); });
  }

  private toggleSheet(force?: boolean): void {
    const rail = $('#rail');
    const open = force ?? rail.dataset.sheet !== 'open';
    rail.dataset.sheet = open ? 'open' : 'peek';
    $('#sheet-handle').setAttribute('aria-expanded', String(open));
  }

  private pickBuurt(name: string | undefined, fit = true): void {
    this.buurt = name;
    this.listShown = LIST_PAGE;
    ($('#buurt') as HTMLSelectElement).value = name ?? '';
    this.renderList();
    this.syncUrl();
    if (fit) this.fitBuurt();
    void this.showOutline();
    void this.renderLookEntry();
  }

  private row(m: ExplorerModel): HTMLLIElement {
    const button = el('button', { type: 'button', class: 'row' },
      el('span', { class: `dot dot-${m.kind}`, ariaHidden: 'true' } as any),
      el('span', { class: 'row-text' },
        el('span', { class: 'row-name', textContent: m.name }),
        el('span', { class: 'row-meta', textContent: `${KIND_LABEL[m.kind]}${this.buurt ? '' : ` · ${m.buurt}`}` })));
    button.dataset.model = m.id;
    if (this.selected?.id === m.id) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => void this.open(m.id, { fly: true }));
    return el('li', {}, button);
  }

  private renderList(): void {
    const models = modelsIn(this.index.models, this.buurt);
    const list = $('#list');
    list.replaceChildren(...models.slice(0, this.listShown).map(m => this.row(m)));
    const more = $('#more') as HTMLButtonElement;
    more.hidden = models.length <= this.listShown;
    more.textContent = `Show ${Math.min(LIST_PAGE * 2, models.length - this.listShown)} more`;
    $('#list-title').textContent = this.buurt
      ? `${models.length} in ${this.buurt === ELSEWHERE ? 'the rest of the city' : this.buurt}`
      : `${models.length} across the city`;
  }

  private renderSearch(query: string): void {
    const results = $('#results');
    const hits = searchModels(this.index.models, query);
    results.hidden = !query.trim();
    $('#browse').hidden = !!query.trim();
    results.replaceChildren(...(hits.length ? hits.map(m => this.row(m)) : [el('li', { class: 'empty', textContent: `No modelled building matches “${query.trim()}”.` })]));
  }

  // ---------- map ----------

  private initMap(link: { buurt?: string; model?: string }, lookBbox?: [number, number, number, number]): void {
    if (typeof maplibregl === 'undefined') { $('#map').classList.add('map-failed'); return; }
    this.map = new maplibregl.Map({
      container: 'map', style: STYLE, bounds: lookBbox ?? this.buurtBounds(this.buurt ?? link.buurt) ?? AMSTERDAM, fitBoundsOptions: { padding: this.padding() },
      attributionControl: { compact: true }, maxBounds: [[4.6, 52.22], [5.15, 52.5]], minZoom: 10, maxPitch: 60,
    });
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    w.__explorerMap = this.map;
    this.map.on('load', () => {
      this.map.addSource('models', { type: 'geojson', data: this.pinData() });
      this.map.addSource('outline', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      this.map.addLayer({ id: 'outline-fill', type: 'fill', source: 'outline', paint: { 'fill-color': '#b4682c', 'fill-opacity': 0.06 } });
      this.map.addLayer({ id: 'outline-line', type: 'line', source: 'outline', paint: { 'line-color': '#8a4a18', 'line-width': 2, 'line-dasharray': [2, 1.5] } });
      const radius = ['interpolate', ['linear'], ['zoom'], 11, ['match', ['get', 'kind'], 'landmark', 3.5, 2.5], 15, ['match', ['get', 'kind'], 'landmark', 7, 5.5], 18, ['match', ['get', 'kind'], 'landmark', 11, 9]];
      this.map.addLayer({ id: 'pins', type: 'circle', source: 'models', paint: {
        'circle-color': ['match', ['get', 'kind'], 'landmark', PIN_COLOUR.landmark, 'ordinary', PIN_COLOUR.ordinary, PIN_COLOUR.block],
        'circle-radius': radius, 'circle-stroke-color': '#fbf8f2', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 2],
      } });
      this.map.addLayer({ id: 'pin-selected', type: 'circle', source: 'models', filter: ['==', ['get', 'id'], ''], paint: {
        'circle-color': 'rgba(0,0,0,0)', 'circle-radius': ['+', 6, radius] as any, 'circle-stroke-color': '#b4682c', 'circle-stroke-width': 3,
      } });
      this.map.on('mouseenter', 'pins', () => { this.map.getCanvas().style.cursor = 'pointer'; });
      this.map.on('mouseleave', 'pins', () => { this.map.getCanvas().style.cursor = ''; });
      this.map.on('click', (e: any) => this.mapClick(e));
      if (this.selected) this.highlight(this.selected.id);
      void this.showOutline();
      document.body.dataset.mapReady = '1';
    });
  }

  private pinData() {
    return { type: 'FeatureCollection', features: this.index.models.map(m => ({ type: 'Feature', properties: { id: m.id, kind: m.kind }, geometry: { type: 'Point', coordinates: m.lngLat } })) };
  }

  private padding() {
    if (isPhone()) return { top: 70, bottom: Math.round(window.innerHeight * 0.45), left: 24, right: 24 };
    return { top: 48, bottom: 48, left: 48, right: this.selected || this.look ? 480 : 56 };
  }

  private buurtBounds(name?: string) {
    const b = name && this.index.buurten.find(x => x.name === name);
    return b ? b.bbox : undefined;
  }

  private fitBuurt(): void {
    if (!this.map) return;
    this.map.fitBounds(this.buurtBounds(this.buurt) ?? AMSTERDAM, { padding: this.padding(), maxZoom: 17, duration: 700 });
  }

  /** Draws the picked neighbourhood's outline from boundaries.json, fetched on first use. */
  private async showOutline(): Promise<void> {
    const source = this.map?.getSource?.('outline');
    if (!source) return;
    if (this.look?.kind === 'buurt') {
      source.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: this.look.buurt.outline.map(ring => [ring]) } }] });
      return;
    }
    if (!this.buurt || this.buurt === ELSEWHERE) { source.setData({ type: 'FeatureCollection', features: [] }); return; }
    this.outlines ??= fetch(`${EXTRACT}/boundaries.json`).then(r => r.json()).catch(() => { this.outlines = undefined; return []; });
    const name = this.buurt;
    const rows = (await this.outlines).filter((b: any) => b.name === name && b.kind !== 'municipality');
    if (name !== this.buurt) return;
    source.setData({ type: 'FeatureCollection', features: rows.map((b: any) => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: b.geometry.map((poly: number[][][]) => poly.map(ring => ring.map(([lat, lng]) => [lng, lat]))) } })) });
  }

  private highlight(id: string): void {
    this.map?.getLayer?.('pin-selected') && this.map.setFilter('pin-selected', ['==', ['get', 'id'], id]);
  }

  private mapClick(e: any): void {
    const hit = this.map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ['pins'] })[0];
    if (hit) { void this.open(hit.properties.id, { fly: false }); return; }
    void this.offerRequest([e.lngLat.lng, e.lngLat.lat]);
  }

  /** A click off the pins: a modelled footprint opens its model; anything else offers a request. */
  private async offerRequest(lngLat: LngLat): Promise<void> {
    this.popup?.remove();
    const body = el('div', { class: 'req' },
      el('p', { class: 'req-title', textContent: 'Not modelled yet' }),
      el('p', { class: 'req-meta', textContent: 'Looking up the building…' }));
    const button = el('button', { type: 'button', class: 'quiet small', id: 'request-building', textContent: 'Request this building' });
    let target: ClickTarget = { kind: 'point' };
    button.addEventListener('click', () => { this.popup?.remove(); void openFeedback(requestOptions(lngLat, target)); });
    body.append(button);
    this.popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', className: 'explore-popup', focusAfterOpen: false }).setLngLat(lngLat).setDOMContent(body).addTo(this.map);
    const popup = this.popup;
    target = await this.footprints.at(lngLat);
    if (popup !== this.popup) return;
    const modelled = target.kind === 'pand' ? this.byPand.get(target.id) : undefined;
    if (modelled) { popup.remove(); void this.open(modelled.id, { fly: false }); return; }
    (body.querySelector('.req-meta') as HTMLElement).textContent =
      target.kind === 'pand' ? `BAG pand ${target.id}` : target.kind === 'osm' ? `OpenStreetMap ${target.id}` : 'No building footprint here: the request will carry this map point.';
  }

  // ---------- buurt looks ----------

  private loadLooks(): Promise<ExplorerLooks> {
    this.looks ??= fetch(`${EXTRACT}/explorer-looks.json`).then(r => {
      if (!r.ok) throw new Error(`explorer-looks.json: ${r.status}`);
      return r.json();
    });
    this.looks.catch(() => { this.looks = undefined; });
    return this.looks;
  }

  /** The rail's "View this neighbourhood's look" entry for the picked neighbourhood (or the city). */
  private async renderLookEntry(): Promise<void> {
    const box = $('#look-entry');
    const all = el('button', { type: 'button', class: 'look-link', textContent: 'Buurten with their own building look' });
    all.addEventListener('click', () => void this.openLookIndex());
    if (!this.buurt || this.buurt === ELSEWHERE) {
      box.replaceChildren(el('p', { class: 'look-entry-text' }, 'Some buurten are drawn from recipes measured for that district. ', all));
      box.hidden = false;
      return;
    }
    const name = this.buurt;
    let looks: ExplorerLooks;
    try { looks = await this.loadLooks(); } catch { box.hidden = true; return; }
    if (name !== this.buurt) return;
    const here = looksIn(looks.buurten, name);
    if (!here.length) {
      box.replaceChildren(el('p', { class: 'look-entry-text' }, `No buurt in ${name} has its own look yet: its buildings use the city default. `, all));
    } else {
      const SHOWN = 4;
      const buttons = here.slice(0, SHOWN).map(b => {
        const button = el('button', { type: 'button', class: 'quiet small look-button' },
          el('span', { textContent: here.length === 1 ? 'View this neighbourhood’s look' : `View ${b.name}’s look` }),
          el('span', { class: 'look-button-meta', textContent: b.status === 'drawn' ? `${b.lookPands} pands` : 'authored' }));
        button.dataset.look = b.slug;
        button.addEventListener('click', () => void this.openLook(b));
        return button;
      });
      box.replaceChildren(
        el('p', { class: 'look-entry-text' }, here.length === 1 ? `${here[0].name} has its own building look.` : `${here.length} buurten here have their own building look.`),
        el('div', { class: 'look-buttons' }, ...buttons));
      if (here.length > SHOWN) {
        const more = el('button', { type: 'button', class: 'look-link', textContent: `${here.length - SHOWN} more, and every buurt with a look` });
        more.addEventListener('click', () => void this.openLookIndex());
        box.append(el('p', { class: 'look-entry-text' }, more));
      }
    }
    box.hidden = false;
  }

  private showPanel(mode: 'model' | 'look'): void {
    $('#panel').hidden = false;
    document.body.dataset.panel = 'open';
    $('#panel').dataset.mode = mode;
    $('#model-details').hidden = mode !== 'model';
    $('#look-details').hidden = mode !== 'look';
    $('#panel').setAttribute('aria-labelledby', mode === 'look' ? 'l-title' : 'p-title');
    if (isPhone()) this.toggleSheet(false);
  }

  private leaveLook(): void {
    this.look = undefined;
    delete $('#panel').dataset.mode;
    delete $('#stage').dataset.compact;
    $('#model-details').hidden = false;
    $('#look-details').hidden = true;
    $('#panel').setAttribute('aria-labelledby', 'p-title');
  }

  private closeModel(): void {
    if (!this.selected) return;
    this.selected = undefined;
    this.highlight('');
    for (const b of document.querySelectorAll('.row[aria-current]')) b.removeAttribute('aria-current');
  }

  /** The look view for one buurt: its recipes in 3D (reusing the model viewer), swatches against the city default, kit keys, models. */
  async openLook(b: LookBuurt, { fit = true, use = 0 }: { fit?: boolean; use?: number } = {}): Promise<void> {
    const looks = await this.loadLooks();
    this.popup?.remove();
    this.closeModel();
    this.look = { kind: 'buurt', buurt: b, use };
    if (b.explorerBuurt && b.explorerBuurt !== this.buurt) {
      this.buurt = b.explorerBuurt;
      ($('#buurt') as HTMLSelectElement).value = this.buurt;
      this.listShown = LIST_PAGE;
      this.renderList();
      void this.renderLookEntry();
    }
    this.showPanel('look');
    delete $('#stage').dataset.compact;
    $('#l-recipe').hidden = false;
    $('#l-models-wrap').hidden = false;
    ($('#l-all-wrap') as HTMLDetailsElement).open = false;
    $('#p-kind').textContent = b.status === 'drawn' ? 'Own look' : 'Own look · authored';
    $('#p-kind').className = 'chip chip-look';
    $('#l-title').textContent = b.name;
    $('#l-where').textContent = [b.wijk && b.wijk !== b.name ? `${b.wijk}` : '', `buurt ${b.code}`, b.explorerBuurt && b.explorerBuurt !== b.name && b.explorerBuurt !== b.wijk ? `in ${b.explorerBuurt}` : ''].filter(Boolean).join(' · ');
    $('#l-summary').textContent = lookSummary(b);
    const tabs = $('#l-uses');
    tabs.replaceChildren(...b.uses.map((u, i) => {
      const r = looks.recipes[u.key];
      const button = el('button', { type: 'button', class: 'use', role: 'tab' } as any,
        el('span', { class: 'use-kind', textContent: r?.kind === 'design' ? 'Design' : r?.kind === 'face' ? 'Face' : 'Type' }),
        el('span', { class: 'use-name', textContent: r?.title ?? u.key }),
        el('span', { class: 'use-meta', textContent: u.pands ? `${u.pands} pands` : 'not drawn here' }));
      button.dataset.use = u.key;
      button.addEventListener('click', () => this.showUse(i));
      return button;
    }));
    $('#l-uses-wrap').hidden = !b.uses.length;
    this.renderLookModels(b);
    const near = nearestLook(looks.buurten, b);
    const compare = $('#l-compare');
    compare.replaceChildren(...(near ? [el('span', { textContent: 'Compare with the nearest buurt that has one: ' }), this.lookLink(near)] : []));
    compare.hidden = !near;
    this.renderLookList($('#l-all'), looks, b.slug);
    ($('#l-all-wrap') as HTMLDetailsElement).hidden = false;
    $('#l-report').hidden = false;
    this.syncUrl();
    void this.showOutline();
    if (fit && this.map) this.map.fitBounds(b.bbox, { padding: this.padding(), maxZoom: 16.5, duration: 700 });
    ($('#close') as HTMLButtonElement).focus({ preventScroll: true });
    if (b.uses.length) this.showUse(Math.min(use, b.uses.length - 1));
    else this.stageEmpty('No recipe is installed or authored here yet: only street photo strips have been surveyed.');
  }

  private lookLink(b: LookBuurt): HTMLAnchorElement {
    const a = el('a', { href: `?buurt=${encodeURIComponent(b.slug)}`, textContent: b.name });
    a.addEventListener('click', e => { e.preventDefault(); void this.openLook(b); });
    return a;
  }

  private renderLookModels(b: LookBuurt): void {
    const models = b.models.map(id => this.byId.get(id)).filter((m): m is ExplorerModel => !!m);
    const list = $('#l-models');
    list.replaceChildren(...models.slice(0, 24).map(m => this.row(m)));
    $('#l-models-title').textContent = models.length ? `Modelled buildings in ${b.name} (${models.length})` : `No individually modelled buildings in ${b.name}`;
  }

  private renderLookList(list: HTMLElement, looks: ExplorerLooks, current?: string): void {
    list.replaceChildren(...looks.buurten.map(x => {
      const li = el('li', {}, this.lookLink(x), el('span', { class: 'mut', textContent: ` · ${x.status === 'drawn' ? `${x.lookPands} pands` : 'authored only'}` }));
      if (x.slug === current) li.setAttribute('aria-current', 'true');
      return li;
    }));
    $('#l-all-count').textContent = String(looks.buurten.length);
  }

  private stageEmpty(message: string): void {
    this.viewer?.clear();
    $('#stage').dataset.state = 'empty';
    $('#stage-status').textContent = message;
  }

  /** Shows one recipe of the open look: its GLB framed on a run of its houses, and its parameters. */
  private async showUse(i: number): Promise<void> {
    if (this.look?.kind !== 'buurt') return;
    const looks = await this.loadLooks();
    const b = this.look.buurt, u: LookUse | undefined = b.uses[i];
    if (!u) return;
    this.look.use = i;
    const r: LookRecipe | undefined = looks.recipes[u.key];
    for (const t of document.querySelectorAll('#l-uses .use')) t.setAttribute('aria-selected', String((t as HTMLElement).dataset.use === u.key));
    const glb = u.glbUrl ?? r?.glbUrl, modelId = u.modelId ?? r?.modelId, bytes = u.glbUrl ? u.bytes : r?.bytes;
    $('#l-r-title').textContent = r?.title ?? u.key;
    $('#l-r-meta').textContent = [r?.source, r?.era ? (r.era[0] === r.era[1] ? `built ${r.era[0]}` : `built ${r.era[0]}–${r.era[1]}`) : '',
      u.pands ? `${u.pands} pands drawn here` : 'not drawn in this buurt yet', u.houses ? `framed on ${u.houses} ${u.houses === 1 ? 'house' : 'houses'}` : ''].filter(Boolean).join(' · ');
    $('#l-r-desc').textContent = r?.description ?? '';
    $('#l-r-desc').hidden = !r?.description;
    this.renderSwatches(r?.swatches ?? [], looks.defaultLook);
    const kit = groupKitKeys(r?.kitKeys ?? []);
    const tags = (keys: string[]) => keys.map(k => el('li', { textContent: kitKeyLabel(k) }));
    $('#l-kinds').replaceChildren(...tags(kit.kinds));
    $('#l-components').replaceChildren(...tags(kit.components));
    $('#l-kit').hidden = !kit.kinds.length && !kit.components.length;
    $('#l-components-wrap').hidden = !kit.components.length;
    const fig = (t: LookRecipe['render'], caption: string) => t
      ? el('figure', {}, Object.assign(el('img', { src: t.src, alt: `${caption}: ${t.label}`, loading: 'lazy', decoding: 'async' } as any), { title: t.label }),
        el('figcaption', { textContent: t.credit ? `${caption} · ${t.credit}` : caption }))
      : null;
    const figs = [fig(r?.render, 'Kit render'), fig(r?.photo, 'Photo')].filter((x): x is HTMLElement => !!x);
    $('#l-thumbs').replaceChildren(...figs);
    $('#l-thumbs').hidden = !figs.length;
    const open = $('#l-open') as HTMLButtonElement;
    open.hidden = !modelId || !this.byId.has(modelId);
    open.onclick = () => { if (modelId) void this.open(modelId, { fly: true }); };
    const dl = $('#l-download') as HTMLAnchorElement;
    dl.hidden = !glb;
    if (glb) {
      dl.href = glb;
      dl.download = `canal-recall-${(glb.split('/').pop() ?? 'look.glb').replace(/[^a-z0-9._-]+/gi, '-')}`;
      $('#l-download-label').textContent = `Download GLB${bytes ? ` · ${formatBytes(bytes)}` : ''}`;
    }
    $('#l-licence-line').hidden = !glb;
    if (!glb) { this.stageEmpty(u.pands ? 'This recipe has no published GLB.' : 'Authored, not drawn in 3D yet: no installed chunk uses this recipe.'); return; }
    $('#stage').dataset.state = 'loading';
    $('#stage-status').textContent = 'Loading recipe…';
    const look = this.look;
    try {
      const viewer = await this.ensureViewer();
      if (this.look !== look || look.use !== i) return;
      const result = await viewer.open(glb, u.focus ? { focus: u.focus } : {});
      if (this.look !== look || look.use !== i) return;
      $('#stage').dataset.state = 'ready';
      $('#stage-status').textContent = '';
      $('#l-r-facts').textContent = [result.heightMetres > 1 ? `${Math.round(result.heightMetres)} m tall` : '', `${result.triangles.toLocaleString('en-GB')} triangles in this GLB`].filter(Boolean).join(' · ');
    } catch (e) {
      if ((e as Error).message === 'superseded' || this.look !== look) return;
      $('#stage').dataset.state = 'error';
      $('#stage-status').textContent = 'The 3D recipe could not load. The download link still works.';
    }
  }

  private renderSwatches(own: Swatch[], city: ExplorerLooks['defaultLook']): void {
    const row = (s: Swatch) => el('div', { class: 'sw-row' },
      el('span', { class: 'sw-name', textContent: s.name }),
      el('span', { class: 'sw-chips' }, ...s.colors.map(([role, hex]) => {
        const chip = el('span', { class: 'sw', title: `${role} ${hex}` });
        chip.style.background = hex;
        return el('span', { class: 'sw-item' }, chip, el('span', { class: 'sw-role', textContent: role }));
      })));
    $('#l-sw-own').replaceChildren(...(own.length ? own.slice(0, 4).map(row) : [el('p', { class: 'mut', textContent: 'No measured palette recorded.' })]));
    $('#l-sw-city').replaceChildren(...city.swatches.map(s => el('div', { class: 'sw-row' },
      el('span', { class: 'sw-name', textContent: s.name }),
      el('span', { class: 'sw-chips compact' }, ...s.colors.map(([role, hex]) => { const c = el('span', { class: 'sw', title: `${role} ${hex}` }); c.style.background = hex; return c; })))));
    $('#l-sw-city-desc').textContent = city.description;
  }

  /** A neighbourhood or buurt with no look of its own, with the list of those that have one. */
  async openNoLook(name: string, slug?: string): Promise<void> {
    const looks = await this.loadLooks();
    this.popup?.remove();
    this.closeModel();
    this.look = { kind: 'none', slug, name };
    this.showLookList(looks, name, `${name} has no building look of its own: the game draws it with the city default (generic extrusions with the era facade grammar), plus any landmarks and modelled buildings.`);
  }

  async openLookIndex(): Promise<void> {
    const looks = await this.loadLooks();
    this.popup?.remove();
    this.closeModel();
    this.look = { kind: 'index' };
    const drawn = looks.buurten.filter(b => b.status === 'drawn').length;
    this.showLookList(looks, 'Buurten with their own look', `${drawn} buurten are drawn partly from recipes measured for their district (house types, Nieuw-West designs, measured street faces); ${looks.buurten.length - drawn} more have recipes authored but not drawn yet. The other ${looks.none.length} use the city default.`);
  }

  private showLookList(looks: ExplorerLooks, title: string, summary: string): void {
    this.viewer?.clear();
    this.showPanel('look');
    $('#stage').dataset.compact = '1';
    $('#stage').dataset.state = 'empty';
    $('#stage-status').textContent = '';
    $('#p-kind').textContent = 'Buurt looks';
    $('#p-kind').className = 'chip chip-look';
    $('#l-title').textContent = title;
    $('#l-where').textContent = '';
    $('#l-summary').textContent = summary;
    $('#l-uses-wrap').hidden = true;
    $('#l-recipe').hidden = true;
    $('#l-models-wrap').hidden = true;
    $('#l-compare').hidden = true;
    $('#l-report').hidden = true;
    this.renderLookList($('#l-all'), looks);
    const all = $('#l-all-wrap') as HTMLDetailsElement;
    all.hidden = false;
    all.open = true;
    this.syncUrl();
    void this.showOutline();
    ($('#close') as HTMLButtonElement).focus({ preventScroll: true });
  }

  // ---------- panel ----------

  private async ensureViewer(): Promise<ModelViewer> {
    if (this.viewer) return this.viewer;
    this.viewerLoading ??= (async () => {
      const [{ ModelViewer: Viewer }] = await Promise.all([import('./viewer'), loadScript('js/three.bundle.js')]);
      this.viewer = new Viewer($('#stage'), w.CanalRecallThree);
      return this.viewer;
    })();
    this.viewerLoading.catch(() => { this.viewerLoading = undefined; });
    return this.viewerLoading;
  }

  async open(id: string, { fly }: { fly: boolean }): Promise<void> {
    const model = this.byId.get(id);
    if (!model) return;
    this.popup?.remove();
    if (this.look) this.leaveLook();
    this.selected = model;
    const view = panelView(model);
    const panel = $('#panel');
    panel.hidden = false;
    document.body.dataset.panel = 'open';
    $('#p-kind').textContent = view.kindLabel;
    $('#p-kind').className = `chip chip-${model.kind}`;
    $('#p-title').textContent = view.title;
    $('#p-buurt').textContent = view.buurt;
    const pands = $('#p-pands');
    pands.replaceChildren(...view.pandLines.map(line => el('li', { textContent: line })));
    pands.hidden = !view.pandLines.length;
    $('#p-nopand').hidden = !!view.pandLines.length;
    const wiki = $('#p-wiki') as HTMLAnchorElement;
    wiki.hidden = !view.wiki;
    if (view.wiki) wiki.href = view.wiki;
    const dl = $('#download') as HTMLAnchorElement;
    dl.hidden = !view.download;
    if (view.download) { dl.href = view.download.href; dl.download = view.download.filename; $('#download-label').textContent = view.download.label; }
    $('#p-licence').textContent = view.licence;
    $('#p-facts').textContent = view.facts.join(' · ');
    $('#stage-status').textContent = 'Loading model…';
    $('#stage').dataset.state = 'loading';
    for (const b of document.querySelectorAll('.row[aria-current]')) b.removeAttribute('aria-current');
    for (const b of document.querySelectorAll(`.row[data-model="${CSS.escape(id)}"]`)) b.setAttribute('aria-current', 'true');
    this.highlight(id);
    this.syncUrl();
    if (isPhone()) this.toggleSheet(false);
    if (fly && this.map) this.map.easeTo({ center: model.lngLat, zoom: Math.max(this.map.getZoom(), 16), padding: this.padding(), duration: 700 });
    ($('#close') as HTMLButtonElement).focus({ preventScroll: true });
    try {
      const viewer = await this.ensureViewer();
      if (this.selected !== model) return;
      const result = await viewer.open(model.glbUrl);
      if (this.selected !== model) return;
      $('#stage').dataset.state = 'ready';
      $('#stage-status').textContent = '';
      const facts = [...view.facts];
      if (!model.triangles) facts.push(`${result.triangles.toLocaleString('en-GB')} triangles`);
      if (result.heightMetres > 1) facts.unshift(`${Math.round(result.heightMetres)} m tall`);
      $('#p-facts').textContent = facts.join(' · ');
    } catch (e) {
      if ((e as Error).message === 'superseded' || this.selected !== model) return;
      $('#stage').dataset.state = 'error';
      $('#stage-status').textContent = 'The 3D model could not load. The download link still works.';
    }
  }

  close(): void {
    if (this.look) {
      this.leaveLook();
      this.viewer?.clear();
      $('#panel').hidden = true;
      delete document.body.dataset.panel;
      this.syncUrl();
      void this.showOutline();
      ($('#look-entry button') as HTMLElement | null)?.focus({ preventScroll: true });
      return;
    }
    if (!this.selected) return;
    const id = this.selected.id;
    this.selected = undefined;
    this.viewer?.clear();
    $('#panel').hidden = true;
    delete document.body.dataset.panel;
    this.highlight('');
    for (const b of document.querySelectorAll('.row[aria-current]')) b.removeAttribute('aria-current');
    this.syncUrl();
    (document.querySelector(`.row[data-model="${CSS.escape(id)}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private syncUrl(): void {
    const look = this.look?.kind === 'buurt' ? this.look.buurt.slug : this.look?.kind === 'none' ? this.look.slug : undefined;
    const search = deepLinkSearch(location.search, look ? { buurt: look } : { buurt: this.buurt, model: this.selected?.id });
    history.replaceState(null, '', location.pathname + search + location.hash);
  }
}

const explorer = new Explorer();
w.CanalRecallExplorer = explorer;
explorer.start().catch(error => {
  console.error(error);
  const list = document.getElementById('list');
  if (list) list.replaceChildren(el('li', { class: 'empty', textContent: 'The building list could not load. Reload the page to try again.' }));
});
