// Landmark gallery: every hand-modelled kit (HAND_KITS) in live 3D, built with the game's own
// kit geometry, decoration chain, chunk builders and facade shader (galleryKits.ts / galleryGl.ts),
// over grey context buildings. One shared WebGL context draws into each card's 2D canvas, cards
// build as they scroll into view, and the least recently used scenes give their GPU buffers back.
// Page: `landmark-gallery.html`, not linked from the app. Deep link: `?kit=Westerkerk` opens one
// kit large (`&look=cartoon`, `&az=120`, `&el=20` also work).

import { HAND_KITS, type Kit } from './landmarkKits.js';
import { setShopfronts } from './shopfronts.js';
import { buildKitScene, kitPartIds, type KitScene } from './galleryKits.js';
import { gameDecorator, loadGameData, loadTile, tilesAround, type Feature } from './galleryPipeline.js';
import { GalleryGL, LOOKS, LOOK_LABEL, disposeGroup } from './galleryGl.js';
import { attachOrbit, type Orbit } from './galleryOrbit.js';
import type { BuildingLook } from './threeBuildingFeatures.js';

const MAX_BUILT = 10;
const q = new URLSearchParams(location.search);
let look: BuildingLook = (LOOKS as readonly string[]).includes(q.get('look') ?? '') ? q.get('look') as BuildingLook : 'photo';

type Card = {
  kit: Kit; el: HTMLElement; canvas: HTMLCanvasElement; msg: HTMLElement; trisEl: HTMLElement; infoEl: HTMLElement;
  orbit: Orbit | null; group: any; scene: any; data: KitScene | null; building: Promise<void> | null; visible: boolean; used: number; dirty: boolean; detach?: () => void; wheel: boolean;
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
const fmt = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n >= 1000 ? `${(n / 1000).toFixed(2)}k` : String(n));

async function main() {
  const root = document.querySelector('main')!;
  const status = document.getElementById('status')!;
  const gl = new GalleryGL();
  const THREE = gl.THREE;
  const [locations, game] = await Promise.all([
    fetch('../data/extracts/amsterdam/kit-locations.json').then(r => r.ok ? r.json() : { ids: {} }).catch(() => ({ ids: {} })),
    loadGameData(),
  ]);
  setShopfronts(game.shopfronts);
  const decorate = gameDecorator({ gables: game.gables, landmarkIds: game.landmarkIds, listed: game.listed });
  const ids: Record<string, string> = locations.ids ?? {};

  // --- Controls
  const lookSelect = document.getElementById('look') as HTMLSelectElement;
  for (const l of LOOKS) lookSelect.append(new Option(LOOK_LABEL[l], l, false, l === look));
  const filter = document.getElementById('filter') as HTMLInputElement;
  const measureBtn = document.getElementById('measure') as HTMLButtonElement;

  const cards: Card[] = [];
  const grid = el('div', 'kits'); root.append(grid);
  for (const kit of [...HAND_KITS].sort((a, b) => a.name.localeCompare(b.name))) {
    const card = el('article', 'card'); card.dataset.kit = kit.name;
    const view = el('div', 'view'), canvas = el('canvas'), msg = el('div', 'msg', 'Waiting to scroll into view');
    const expand = el('button', 'expand', 'Expand'); expand.type = 'button'; expand.setAttribute('aria-label', `Expand ${kit.name}`);
    const close = el('button', 'close', 'Close'); close.type = 'button';
    view.append(canvas, msg, expand, close);
    const meta = el('div', 'meta'), name = el('b', '', kit.name), trisEl = el('span', 'tris', 'not built yet'), infoEl = el('div', 'info');
    meta.append(name, trisEl); card.append(view, meta, infoEl);
    grid.append(card);
    const c: Card = { kit, el: card, canvas, msg, trisEl, infoEl, orbit: null, group: null, scene: null, data: null, building: null, visible: false, used: 0, dirty: false, wheel: false };
    cards.push(c);
    expand.addEventListener('click', () => setExpanded(c, true));
    close.addEventListener('click', () => setExpanded(c, false));
  }

  // --- Build / dispose
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (job: () => Promise<void>) => (queue = queue.then(job, job));

  async function loadFeatures(card: Card): Promise<Feature[]> {
    const tiles = new Set<string>();
    for (const id of kitPartIds(card.kit)) if (ids[id]) tiles.add(ids[id]);
    if (!tiles.size) return [];
    let features = (await Promise.all([...tiles].map(t => loadTile(t)))).flat();
    // Context: any further tile the kit's surroundings reach into.
    const scene0 = buildKitScene(card.kit, features, look, decorate);
    if (scene0) {
      const more = tilesAround(scene0.frame.cx, scene0.frame.cy, scene0.frame.halfDiag + 90).filter(t => !tiles.has(t));
      if (more.length) features = [...features, ...(await Promise.all(more.map(t => loadTile(t)))).flat()];
    }
    return features;
  }

  async function build(card: Card, draw: boolean): Promise<void> {
    card.msg.textContent = 'Building...'; card.msg.hidden = false;
    const features = await loadFeatures(card);
    const data = buildKitScene(card.kit, features, look, decorate);
    if (!data) { card.msg.textContent = 'Footprints not found in the building tiles (run scripts/build-kit-locations.ts)'; card.trisEl.textContent = 'no footprints'; return; }
    card.data = data;
    const [mat, flat] = await Promise.all([gl.material(look), gl.material(look, true)]);
    const group = new THREE.Group(), scene = new THREE.Scene();
    const { cx, cy, halfDiag, top, dist } = data.frame;
    group.position.set(-cx, -cy, 0);
    gl.mesh(data.context!, flat, group); gl.mesh(data.hosts!, mat, group); gl.mesh(data.extras!, mat, group); gl.mesh(data.kit!, mat, group);
    const size = 2 * (halfDiag + 260), ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: '#d9d3c1' }));
    ground.position.set(cx, cy, -0.12); group.add(ground);
    scene.add(group);
    card.group = group; card.scene = scene;
    if (!card.orbit) {
      card.orbit = { yaw: Number(q.get('az') ?? 35), pitch: Number(q.get('el') ?? 22), dist, target: [0, 0, top * 0.45], minDist: 8, maxDist: Math.max(600, dist * 4) };
      card.detach = attachOrbit(card.canvas, card.orbit, () => { card.wheel = true; requestDraw(card); }, () => { card.wheel = true; ensureBuilt(card); }, () => card.wheel || card.el.classList.contains('big'));
    }
    card.used = performance.now();
    const { kit: k, hosts: h, extras: x, context } = data.tris;
    card.trisEl.textContent = `${fmt(k + h + x)} tris`;
    card.trisEl.title = `kit ${k}, hosts ${h}, facade extras ${x}; context ${context} (grey, not counted)`;
    card.infoEl.textContent = `kit ${fmt(k)} + hosts ${fmt(h)} + extras ${fmt(x)} tris; ${data.found.length} footprints${data.missing.length ? `, ${data.missing.length} missing` : ''}`;
    card.msg.hidden = true;
    if (draw) draw1(card);
  }

  function dispose(card: Card) {
    if (card.group) disposeGroup(card.group);
    card.group = null; card.scene = null; // the card's canvas keeps its last picture
  }

  function ensureBuilt(card: Card): Promise<void> {
    card.used = performance.now();
    if (card.scene) return Promise.resolve();
    if (!card.building) {
      card.building = enqueue(async () => { try { await build(card, true); } catch (e) { card.msg.textContent = `Failed: ${(e as Error).message}`; card.msg.hidden = false; console.error(card.kit.name, e); } card.building = null; trim(); });
    }
    return card.building;
  }

  function trim() {
    const live = cards.filter(c => c.scene);
    if (live.length <= MAX_BUILT) return;
    for (const c of live.sort((a, b) => a.used - b.used)) { if (live.length <= MAX_BUILT) break; if (c.visible || c.el.classList.contains('big')) continue; dispose(c); live.splice(live.indexOf(c), 1); }
  }

  function draw1(card: Card) {
    if (!card.scene || !card.orbit) return;
    card.dirty = false;
    gl.draw(card.scene, card.orbit, card.canvas);
  }
  function requestDraw(card: Card) {
    if (card.dirty) return;
    card.dirty = true;
    requestAnimationFrame(() => draw1(card));
  }

  // --- Visibility
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const card = cards.find(c => c.el === e.target)!;
      card.visible = e.isIntersecting;
      if (e.isIntersecting) ensureBuilt(card).then(() => requestDraw(card));
    }
  }, { rootMargin: '250px' });
  for (const c of cards) io.observe(c.el);
  const ro = new ResizeObserver(entries => { for (const e of entries) { const card = cards.find(c => c.canvas === e.target); if (card?.scene) requestDraw(card); } });
  for (const c of cards) ro.observe(c.canvas);

  // --- Expand / deep link
  function setExpanded(card: Card, on: boolean) {
    for (const c of cards) if (c !== card) c.el.classList.remove('big');
    card.el.classList.toggle('big', on);
    document.body.classList.toggle('lock', on);
    const url = new URL(location.href);
    if (on) { url.searchParams.set('kit', card.kit.name); ensureBuilt(card).then(() => requestDraw(card)); } else url.searchParams.delete('kit');
    history.replaceState(null, '', url);
    if (on) card.el.scrollIntoView({ block: 'center' });
    requestAnimationFrame(() => requestDraw(card));
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') { const big = cards.find(c => c.el.classList.contains('big')); if (big) setExpanded(big, false); } });
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const wanted = q.get('kit');
  if (wanted) { const hit = cards.find(c => norm(c.kit.name) === norm(wanted)); if (hit) setExpanded(hit, true); else status.textContent = `No hand kit called "${wanted}".`; }

  // --- Controls: look, filter, measure
  lookSelect.addEventListener('change', () => {
    look = lookSelect.value as BuildingLook;
    const url = new URL(location.href); url.searchParams.set('look', look); history.replaceState(null, '', url);
    for (const c of cards) { const had = !!c.scene; dispose(c); c.data = null; if (had && (c.visible || c.el.classList.contains('big'))) ensureBuilt(c).then(() => requestDraw(c)); }
  });
  filter.addEventListener('input', () => { const t = norm(filter.value); for (const c of cards) c.el.hidden = !!t && !norm(c.kit.name).includes(t); });
  measureBtn.addEventListener('click', async () => {
    measureBtn.disabled = true;
    let total = 0, n = 0;
    for (const c of cards) {
      status.textContent = `Measuring ${++n} of ${cards.length}: ${c.kit.name}`;
      if (!c.data) await enqueue(async () => { try { await build(c, c.visible); if (!c.visible) dispose(c); } catch (e) { console.error(c.kit.name, e); } });
      if (c.data) total += c.data.tris.kit + c.data.tris.hosts + c.data.tris.extras;
    }
    status.textContent = `${cards.length} hand kits, ${total.toLocaleString('en')} triangles in total (kit + hosts + extras, grey context not counted).`;
    measureBtn.disabled = false;
  });
  status.textContent = `${cards.length} hand kits. Drag to orbit, wheel or pinch to zoom, Expand for a large view.`;
  (window as any).__landmarkGallery = { cards: () => cards.map(c => ({ name: c.kit.name, tris: c.data?.tris ?? null })), look: () => look };
}

main().catch(e => { console.error(e); document.getElementById('status')!.textContent = `Could not start: ${e?.message ?? e}`; });
