/**
 * Belt review page, a compare round: per block, layers flipped with Q/W/E/R/T…, a photo grid, and a better/same/worse
 * verdict with a note.
 *
 * Keys: Q W E R T Y U I O P show layer 1–10, B blink between the last two layers, hold Space for the previous layer,
 * 1 better / 2 same / 3 worse (again to clear), N edit the note, J / ↓ next block, K / ↑ previous block.
 */
import { ApiError, getJson, post } from './api.ts';
import { h, replace, typing } from './dom.ts';
import { VERDICTS, type RoundBundle, type Verdict, type VerdictsFile } from './types.ts';

const LAYER_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];

export async function mountRound(root: HTMLElement, roundId: string): Promise<void> {
  let b = await getJson<RoundBundle>(`/rounds/${encodeURIComponent(roundId)}`);
  const params = new URLSearchParams(location.search);
  let current = Math.max(0, b.blocks.findIndex(x => x.key === params.get('block')));
  let layer = 0, previous = 0, blink: ReturnType<typeof setInterval> | null = null, held = false;
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

  function showLayer(i: number) {
    const x = block(); if (!x || !x.layers[i]) return;
    if (i !== layer) previous = layer;
    layer = i;
    for (const img of stage.querySelectorAll('img')) img.toggleAttribute('hidden', img.dataset.i !== String(i));
    for (const btn of layerBar.querySelectorAll('button[data-i]')) btn.classList.toggle('on', (btn as HTMLElement).dataset.i === String(i));
  }
  function toggleBlink() {
    if (blink) { clearInterval(blink); blink = null; }
    else { blink = setInterval(() => showLayer(previous), 500); }
    renderLayerBar();
  }
  function renderLayerBar() {
    const x = block();
    replace(layerBar, ...x.layers.map((l, i) => h('button', { 'data-i': i, role: 'tab', class: i === layer ? 'on' : '', onclick: () => showLayer(i) }, h('span', { class: 'key' }, (LAYER_KEYS[i] ?? '').toUpperCase()), ' ', l.name)),
      h('button', { class: blink ? 'on' : '', onclick: toggleBlink, title: 'Blink between the last two layers (B); hold Space to peek at the previous one' }, h('span', { class: 'key' }, 'B'), ' blink'));
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
    replace(stage, ...x.layers.map((l, i) => h('img', { src: l.url, alt: l.name, 'data-i': i, hidden: i !== layer })));
    renderLayerBar();
    renderVerdict();
    replace(photos, ...x.photos.map(p => h('figure', {}, h('a', { href: p.url, target: '_blank', rel: 'noopener' }, h('img', { src: p.url, alt: p.name, loading: 'lazy' })), h('figcaption', {}, h('strong', {}, p.name), p.caption ? ` · ${p.caption}` : ''))));
    replace(main, h('div', { class: 'round-head' }, h('h2', {}, x.title), h('span', { class: 'muted' }, `${current + 1} of ${b.blocks.length}`), x.note ? h('span', { class: 'muted small' }, x.note) : null), layerBar, stage, verdictBox, x.photos.length ? h('h3', {}, 'Photos') : null, photos);
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
    if (k === 'b') toggleBlink();
    else if (k === ' ' && !held) { e.preventDefault(); held = true; const back = layer; showLayer(previous); previous = back; }
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
