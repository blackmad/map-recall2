/**
 * Belt review page, a compare round: per block the layers (photo row, today, r1, r2…) at one scale and left edge, a
 * photo strip, and a better/same/worse verdict with a note.
 *
 * Modes: stack (default; every layer one above the other, scaled together to fit the viewport height, a cursor line
 * follows the mouse down all bands; click a band to enlarge it with the photo directly above, again to restore),
 * pair (photo row over the selected drawing, half the height each), single (one layer, flipped).
 *
 * Keys: S stack / single, P pair, Q W E R T Y U I O select layer 1–9 (flip in single, enlarge in stack, the drawing in
 * pair), B blink between the last two layers (single), hold Space for the previous layer, 1 better / 2 same / 3 worse
 * (again to clear), N edit the note, J / ↓ next block, K / ↑ previous block.
 */
import { ApiError, getJson, post } from './api.ts';
import { h, replace, typing } from './dom.ts';
import { VERDICTS, type RoundBundle, type Verdict, type VerdictsFile } from './types.ts';

const LAYER_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'];
type Mode = 'stack' | 'pair' | 'single';

export async function mountRound(root: HTMLElement, roundId: string): Promise<void> {
  let b = await getJson<RoundBundle>(`/rounds/${encodeURIComponent(roundId)}`);
  const params = new URLSearchParams(location.search);
  let current = Math.max(0, b.blocks.findIndex(x => x.key === params.get('block')));
  let layer = 0, previous = 0, blink: ReturnType<typeof setInterval> | null = null, held = false;
  let mode: Mode = (['stack', 'pair', 'single'] as const).find(m => m === params.get('mode')) ?? 'stack';
  let enlarged: number | null = null, cursorF: number | null = null;
  const status = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const say = (t: string, kind: 'ok' | 'err' | '' = '') => { status.textContent = t; status.className = `status ${kind}`; };

  const header = h('header', { class: 'bar' });
  const side = h('nav', { class: 'blocks', 'aria-label': 'Blocks' });
  const main = h('main', { class: 'round' });
  replace(root, header, h('div', { class: 'round-wrap' }, side, main));

  const block = () => b.blocks[current];
  const verdictOf = (key: string) => b.verdicts.verdicts[key];

  async function saveVerdict(key: string, value: { verdict: Verdict | null; note: string }) {
    try {
      const r = await post<{ doc: VerdictsFile }>(`/rounds/${roundId}/verdicts/${encodeURIComponent(key)}`, b.token, () => ({ expectedRevision: verdictOf(key)?.revision ?? 0, value }));
      b.verdicts = r.doc; say('Saved', 'ok'); renderSide(); renderVerdict();
    } catch (e) {
      const err = e as ApiError;
      say(err.status === 409 ? `${err.message} (Shift+R reloads; your note stays in the box)` : `Save failed: ${err.message}`, 'err');
    }
  }

  function renderHeader() {
    const done = b.blocks.filter(x => verdictOf(x.key)?.verdict).length;
    replace(header, h('a', { href: '?', class: 'home' }, 'Belt review'),
      h('div', { class: 'title' }, h('strong', {}, b.title), ` · ${done}/${b.blocks.length} judged`),
      h('span', { class: 'muted small', title: b.root }, b.exists ? '' : 'round folder not found yet'));
  }
  function renderSide() {
    replace(side, h('ol', {}, ...b.blocks.map((x, i) => {
      const v = verdictOf(x.key)?.verdict;
      return h('li', {}, h('button', { class: `blk${i === current ? ' cur' : ''} ${v ?? ''}`, onclick: () => select(i) }, h('span', { class: 'v' }, v ? v[0].toUpperCase() : '·'), ' ', x.title));
    })));
  }

  const stage = h('div', { class: 'stage' });
  const layerBar = h('div', { class: 'layers', role: 'tablist' });
  const verdictBox = h('div', { class: 'verdict' });
  const photos = h('div', { class: 'photos' });
  let noteTimer: ReturnType<typeof setTimeout> | undefined;

  const photoIndex = () => Math.max(0, block()?.layers.findIndex(l => l.name === 'photo') ?? 0);
  /** The drawing paired with the photo: the selected layer, or the first non-photo one. */
  const drawing = () => { const x = block(), pi = photoIndex(); return layer !== pi ? layer : x.layers.findIndex((_, i) => i !== pi); };

  function showLayer(i: number) {
    const x = block(); if (!x || !x.layers[i]) return;
    if (i !== layer) previous = layer;
    layer = i;
    if (mode === 'single') {
      for (const img of stage.querySelectorAll('img')) img.toggleAttribute('hidden', img.dataset.i !== String(i));
      for (const btn of layerBar.querySelectorAll('button[data-i]')) btn.classList.toggle('on', (btn as HTMLElement).dataset.i === String(i));
    } else {
      if (mode === 'stack') enlarged = enlarged === i ? null : i;
      renderStage(); renderLayerBar();
    }
  }
  function setMode(m: Mode) {
    if (blink) { clearInterval(blink); blink = null; }
    mode = m; enlarged = null;
    const u = new URL(location.href); u.searchParams.set('mode', m); history.replaceState(null, '', u);
    renderStage(); renderLayerBar();
  }
  function toggleBlink() {
    if (mode !== 'single') setMode('single');
    if (blink) { clearInterval(blink); blink = null; }
    else { blink = setInterval(() => showLayer(previous), 500); }
    renderLayerBar();
  }
  function renderLayerBar() {
    const x = block();
    const on = (i: number) => mode === 'single' ? i === layer : mode === 'pair' ? i === drawing() || i === photoIndex() : i === enlarged;
    replace(layerBar,
      ...(['stack', 'pair', 'single'] as const).map(m => h('button', { class: `mode${mode === m ? ' on' : ''}`, onclick: () => setMode(m), title: m === 'stack' ? 'All layers stacked (S)' : m === 'pair' ? 'Photo over one drawing (P)' : 'One layer, flipped with Q/W/E/R (S)' }, h('span', { class: 'key' }, m === 'pair' ? 'P' : 'S'), ' ', m)),
      h('span', { class: 'sep' }),
      ...x.layers.map((l, i) => h('button', { 'data-i': i, role: 'tab', class: on(i) ? 'on' : '', onclick: () => showLayer(i) }, h('span', { class: 'key' }, (LAYER_KEYS[i] ?? '').toUpperCase()), ' ', l.name)),
      h('button', { class: blink ? 'on' : '', onclick: toggleBlink, title: 'Blink between the last two layers (B); hold Space to peek at the previous one' }, h('span', { class: 'key' }, 'B'), ' blink'));
  }

  /** Lay the bands out at shared scales once every image knows its natural size. */
  const phone = () => matchMedia('(max-width: 760px)').matches;
  function layout() {
    const x = block(); if (!x || mode === 'single') return;
    const imgs = [...stage.querySelectorAll<HTMLImageElement>('.band img')];
    if (!imgs.length || imgs.some(i => !i.naturalWidth)) return;
    // The stack hugs its bands; the height it may use is the viewport below the stage's top (as laid out unscrolled).
    const top = stage.getBoundingClientRect().top + scrollY;
    const W = stage.clientWidth - 2, H = Math.max(240, innerHeight - top - 12) - 4 * imgs.length;
    const nat = (i: HTMLImageElement) => ({ w: i.naturalWidth, h: i.naturalHeight });
    const maxW = Math.max(...imgs.map(i => i.naturalWidth));
    const scaleOf = new Map<HTMLImageElement, number>();
    if (phone()) for (const i of imgs) scaleOf.set(i, W / maxW);
    else if (mode === 'pair' || enlarged !== null) {
      // The big pair (photo + the enlarged or paired drawing) takes about half the height each; the rest share what is left.
      const big = imgs.filter(i => i.dataset.big === '1'), rest = imgs.filter(i => i.dataset.big !== '1');
      const bigH = rest.length ? H * (big.length > 1 ? 0.8 : 0.5) : H;
      const kb = Math.min(bigH / big.reduce((n, i) => n + nat(i).h, 0), W / maxW);
      big.forEach(i => scaleOf.set(i, kb));
      if (rest.length) { const kr = Math.min((H - kb * big.reduce((n, i) => n + nat(i).h, 0)) / rest.reduce((n, i) => n + nat(i).h, 0), W / maxW); rest.forEach(i => scaleOf.set(i, Math.max(0.02, kr))); }
    } else {
      const k = Math.min(H / imgs.reduce((n, i) => n + nat(i).h, 0), W / maxW);
      imgs.forEach(i => scaleOf.set(i, k));
    }
    for (const i of imgs) { const k = scaleOf.get(i)!; i.style.width = `${Math.round(i.naturalWidth * k)}px`; i.style.height = `${Math.round(i.naturalHeight * k)}px`; }
    // House boundaries are photo-row pixels; every layer shares the photo row's px/m and left edge, so each band scales
    // them by its own display scale.
    for (const band of stage.querySelectorAll<HTMLElement>('.band')) {
      const img = band.querySelector('img'), k = img ? scaleOf.get(img) ?? 0 : 0;
      for (const el of band.querySelectorAll<HTMLElement>('.house')) {
        el.style.left = `${Number(el.dataset.x0) * k}px`; el.style.width = `${(Number(el.dataset.x1) - Number(el.dataset.x0)) * k}px`;
      }
    }
    placeCursor();
  }
  function placeCursor() {
    for (const band of stage.querySelectorAll<HTMLElement>('.band')) {
      const img = band.querySelector('img'), line = band.querySelector<HTMLElement>('.cursor');
      if (!img || !line) continue;
      line.hidden = cursorF === null || cursorF < 0 || cursorF > 1;
      if (cursorF !== null) line.style.left = `${img.offsetLeft + cursorF * img.offsetWidth}px`;
    }
  }
  stage.addEventListener('mousemove', e => {
    const band = (e.target as HTMLElement).closest('.band'), img = band?.querySelector('img');
    if (!img) return;
    const r = img.getBoundingClientRect();
    cursorF = (e.clientX - r.left) / r.width; placeCursor();
  });
  stage.addEventListener('mouseleave', () => { cursorF = null; placeCursor(); });
  addEventListener('resize', () => layout());

  function renderStage() {
    const x = block(); if (!x) return;
    stage.className = `stage ${mode}`;
    if (mode === 'single') {
      replace(stage, ...x.layers.map((l, i) => h('img', { src: l.url, alt: l.name, 'data-i': i, hidden: i !== layer })));
      return;
    }
    const pi = photoIndex();
    let order: number[], big: Set<number>;
    if (mode === 'pair') { order = [pi, drawing()].filter(i => i >= 0); big = new Set(order); }
    else if (enlarged === null) { order = x.layers.map((_, i) => i); big = new Set(); }
    else { order = [pi, ...(enlarged === pi ? [] : [enlarged]), ...x.layers.map((_, i) => i).filter(i => i !== pi && i !== enlarged)]; big = new Set([pi, enlarged]); }
    replace(stage, ...order.map(i => {
      const l = x.layers[i];
      const img = h('img', { src: l.url, alt: l.name, 'data-i': i, 'data-big': big.has(i) ? '1' : '0', draggable: 'false' }) as HTMLImageElement;
      img.addEventListener('load', () => layout());
      return h('div', { class: `band${big.has(i) ? ' big' : ''}${i === pi ? ' photo' : ''}`, title: mode === 'stack' ? (enlarged === i ? 'Click to restore the stack' : 'Click to enlarge, with the photo above') : '', onclick: () => { if (mode === 'stack') { layer = i; enlarged = enlarged === i ? null : i; renderStage(); renderLayerBar(); } } },
        img, ...(x.boundaries ?? []).map(bd => h('div', { class: 'house', 'data-x0': bd.x0, 'data-x1': bd.x1, title: bd.address ?? (bd.pandId ? `pand ${bd.pandId}` : '') })),
        h('span', { class: 'band-label' }, l.name), h('div', { class: 'cursor', hidden: true }));
    }));
    requestAnimationFrame(() => layout());
  }
  function renderVerdict() {
    const x = block(), v = verdictOf(x.key);
    const note = h('textarea', { id: 'verdict-note', rows: 3, placeholder: 'What changed, what still looks wrong (N to focus)…', 'aria-label': 'Note' }) as HTMLTextAreaElement;
    note.value = v?.note ?? '';
    note.addEventListener('input', () => { clearTimeout(noteTimer); say('Unsaved note…'); noteTimer = setTimeout(() => saveVerdict(x.key, { verdict: verdictOf(x.key)?.verdict ?? null, note: note.value }), 700); });
    note.addEventListener('keydown', e => { if (e.key === 'Escape') note.blur(); });
    replace(verdictBox,
      h('div', { class: 'vbtns' }, ...VERDICTS.map((name, i) => h('button', { class: `vb ${name}${v?.verdict === name ? ' on' : ''}`, onclick: () => saveVerdict(x.key, { verdict: v?.verdict === name ? null : name, note: note.value }) }, h('span', { class: 'key' }, String(i + 1)), ' ', name))),
      note, status);
  }
  function renderBlock() {
    const x = block();
    if (!x) { replace(main, h('p', { class: 'empty' }, b.exists ? 'This round has no blocks yet.' : `The round folder does not exist yet: ${b.root}. It loads when the overseer writes it.`)); return; }
    if (blink) { clearInterval(blink); blink = null; }
    if (layer >= x.layers.length) layer = 0;
    previous = Math.min(previous, x.layers.length - 1);
    enlarged = null;
    renderStage();
    renderLayerBar();
    renderVerdict();
    // Per-house photos, whole (contain) on one fixed-height row, left to right; click opens full size.
    replace(photos, ...x.photos.map(p => h('figure', {}, h('a', { href: p.url, target: '_blank', rel: 'noopener', title: 'Open full size' }, h('img', { src: p.url, alt: p.caption ?? p.name, loading: 'lazy' })), h('figcaption', {}, p.caption ? h('strong', {}, p.caption) : h('strong', {}, p.name), p.caption ? h('span', { class: 'muted' }, ` ${p.name}`) : null))));
    replace(main, h('div', { class: 'round-head' }, h('h2', {}, x.title), h('span', { class: 'muted' }, `${current + 1} of ${b.blocks.length}`), x.note ? h('span', { class: 'muted small' }, x.note) : null), layerBar, stage, x.photos.length ? h('h3', {}, 'Photos') : null, photos, verdictBox);
    requestAnimationFrame(() => layout());
    const u = new URL(location.href); u.searchParams.set('block', x.key); history.replaceState(null, '', u);
  }
  function select(i: number) { current = Math.max(0, Math.min(b.blocks.length - 1, i)); renderSide(); renderBlock(); }

  addEventListener('keydown', e => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), x = block();
    if (e.key === 'R' && e.shiftKey) { void getJson<RoundBundle>(`/rounds/${roundId}`).then(n => { b = n; renderHeader(); renderSide(); renderBlock(); say('Reloaded', 'ok'); }); return; }
    if (!x) return;
    const li = LAYER_KEYS.indexOf(k);
    if (li >= 0 && !e.shiftKey) { showLayer(li); return; }
    if (k === 's') setMode(mode === 'single' ? 'stack' : 'single');
    else if (k === 'p') setMode(mode === 'pair' ? 'stack' : 'pair');
    else if (k === 'escape' && enlarged !== null) { enlarged = null; renderStage(); renderLayerBar(); }
    else if (k === 'b') toggleBlink();
    else if (k === ' ' && !held && mode === 'single') { e.preventDefault(); held = true; const back = layer; showLayer(previous); previous = back; }
    else if (k === 'j' || e.key === 'ArrowDown') { e.preventDefault(); select(current + 1); }
    else if (k === 'k' || e.key === 'ArrowUp') { e.preventDefault(); select(current - 1); }
    else if (k === 'n') { e.preventDefault(); (document.getElementById('verdict-note') as HTMLTextAreaElement | null)?.focus(); }
    else if (['1', '2', '3'].includes(k)) {
      const name = VERDICTS[Number(k) - 1], v = verdictOf(x.key);
      void saveVerdict(x.key, { verdict: v?.verdict === name ? null : name, note: (document.getElementById('verdict-note') as HTMLTextAreaElement | null)?.value ?? v?.note ?? '' });
    }
  });
  addEventListener('keyup', e => { if (e.key === ' ' && held) { held = false; const back = layer; showLayer(previous); previous = back; } });

  renderHeader(); renderSide(); renderBlock();
}
