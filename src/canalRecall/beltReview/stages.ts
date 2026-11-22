/**
 * Belt review page, stages 2–4 (plan "The loop"):
 *   2  likeness at a glance: the whole face as two registered rows (picked photos over renders), one mark per house —
 *      G good, W wrong (+ note), ? can't tell — worst first. A wrong house opens the focus view: photo and render large,
 *      click to pin what is wrong with a tag, the kit gaps, and the fields folded away (weak ones unless "all").
 *      Send to Claude hands the W marks and pins over; a house Claude re-renders comes back "changed, recheck".
 *   3  the row with design units and sameAs / basedOn links: join, split, identical to, based on
 *   4  open in game (stub), the pins to resolve, accept the block
 * faceView.ts owns the page shell, stage 1 and the saves; these render into `ctx.main` and handle their stage's keys.
 */
import { h, replace } from './dom.ts';
import { basePand } from './houses.ts';
import { DESC_FIELDS, FIELD_SPECS, isKitValue, same, showValue, type DescField } from './fields.ts';
import {
  FOCUS_PIN_TAGS, PIN_TAG_LABELS, type DescFieldValue, type FaceBundle, type GroupingFile, type GroupingLinkKind, type MarkValue, type Pin,
  type PairAnswer, type PinTag, type PinTarget, type Stage,
} from './types.ts';

export interface DerivedPand {
  pandId: string;
  fields: Record<string, { value: unknown; source: string; ref?: string; edited?: boolean; via?: string }>;
  chain: string[];
  notes: string[];
  cannotDraw: Array<{ field: string; value?: unknown; drawnAs?: unknown; why: string; gapId?: string }>;
  hash: string;
  weak?: string[];
  likeness?: number | null;
}
export interface Derived { ppm: number; pands: Record<string, DerivedPand> }
export interface RenderInfo { hash: string; ms: number; cached: boolean; widthPx: number; heightPx: number; url: string; overrides?: { applied: string[]; notApplied: string[] } | null }
export interface RowInfo { key: string; ppm: number; ms: number; layout: { width: number; height: number; pands: Array<{ pandId: string; x: number; w: number; h: number }> }; render: string; photo: string }
type CatalogueEnum = { values: Record<string, { houses: number; examples: Array<{ pandId: string; source: string }> }> };
export interface Catalogue { enums: Record<string, CatalogueEnum> }

export interface FaceCtx {
  readonly faceId: string;
  readonly b: FaceBundle;
  readonly derived: Derived | null;
  readonly catalogue: Catalogue | null;
  current: number;
  readonly main: HTMLElement;
  editable(stage: Stage): boolean;
  say(text: string, kind?: 'ok' | 'err' | ''): void;
  render(): void;
  pandStrip(): HTMLElement;
  /** The chosen (or auto) photo URL of a pand, null when none usable. */
  photoUrl(pandId: string): string | null;
  photoPxPerM(pandId: string): number;
  saveEdits(pandId: string, fields: Record<string, { value: unknown; note?: string }>): Promise<void>;
  saveGrouping(value: Pick<GroupingFile, 'units' | 'links' | 'pairs'>): Promise<void>;
  savePin(pin: Partial<Pin> & { id: string }): Promise<void>;
  saveMark(houseId: string, value: { mark: MarkValue; note?: string; tags?: string[]; hash: string | null }): Promise<void>;
  renderInfo(pandId: string): Promise<RenderInfo>;
  rowInfo(): Promise<RowInfo>;
}

/** Description field -> kit catalogue enum (lane C kit-catalogue.json). */
const CATALOGUE_ENUM: Partial<Record<DescField, string>> = { crown: 'gable', cornice: 'cornice', heads: 'windowHead', windowSurround: 'windowSurround', windows: 'windows', stoop: 'basement', wallFinish: 'wallMaterial' };
const SOURCE_CLASS = (s: string) => s === 'edit' ? 'edit' : /^(reviewed|face-intent)/.test(s) ? 'strong' : /^(photo-read|own-read|register|survey|based-on|sameAs|basedOn)/.test(s) ? 'mid' : 'weak';

function header(ctx: FaceCtx, extra: (Node | null)[] = []) {
  const p = ctx.b.face.pands[ctx.current], n = ctx.b.face.pands.length;
  return h('div', { class: 'pand-head' },
    h('button', { class: 'nav', onclick: () => go(ctx, -1), disabled: ctx.current === 0, title: 'Previous house (K)' }, '‹'),
    h('h2', {}, p.address, h('small', {}, ` ${ctx.current + 1} of ${n} · pand ${p.pandId}`)),
    h('button', { class: 'nav', onclick: () => go(ctx, 1), disabled: ctx.current === n - 1, title: 'Next house (J)' }, '›'),
    ...extra);
}
export function go(ctx: FaceCtx, d: number) { ctx.current = Math.max(0, Math.min(ctx.b.face.pands.length - 1, ctx.current + d)); ctx.render(); }

/** An <img> of the pand's live render; fills `meta` with the timing once it arrives. */
function renderImage(ctx: FaceCtx, pandId: string, meta?: HTMLElement, onInfo?: (r: RenderInfo) => void): HTMLImageElement {
  const img = h('img', { class: 'render', alt: 'render (house preview)' }) as HTMLImageElement;
  const t0 = performance.now();
  ctx.renderInfo(pandId).then(r => {
    img.src = r.url;
    img.dataset.h = String(r.heightPx); img.dataset.w = String(r.widthPx);
    if (meta) meta.textContent = r.cached ? `render cached (${r.hash.slice(0, 8)})` : `rendered in ${r.ms} ms (round trip ${Math.round(performance.now() - t0)} ms)`;
    onInfo?.(r);
  }).catch(e => { if (meta) meta.textContent = `render failed: ${(e as Error).message}`; });
  return img;
}

// ============================================================================================================ stage 2
let focus: string | null = null;
let order: 'worst' | 'street' = 'worst';
/** One house at a time (default), or the whole row with marks under it (R). */
let view: 'one' | 'row' = 'one';
let allFields = false;
const MARK_KEYS: Record<string, MarkValue> = { g: 'good', w: 'wrong', '?': 'unsure' };
const MARK_TEXT: Record<MarkValue, string> = { good: 'G', wrong: 'W', unsure: '?' };

/** The houses in review order: worst first (lane C likeness when it has one, else the most weak fields), or street order. */
export function reviewOrder(b: FaceBundle, derived: Derived | null, how: 'worst' | 'street'): string[] {
  const street = b.face.pands.map(p => p.pandId);
  if (how === 'street') return street;
  const score = (id: string) => { const d = derived?.pands[id]; return d?.likeness ?? 1 - (d?.weak?.length ?? 0) / 100; };
  return [...street].sort((x, y) => score(x) - score(y) || street.indexOf(x) - street.indexOf(y));
}
/** A house's mark state: none, its mark, or "changed" when the render moved on since the mark. */
export function markState(b: FaceBundle, derived: Derived | null, id: string): MarkValue | 'changed' | null {
  const m = b.marks.marks[id];
  if (!m) return null;
  const now = derived?.pands[id]?.hash;
  return m.hash && now && m.hash !== now ? 'changed' : m.mark;
}

export function renderStage2(ctx: FaceCtx) {
  const b = ctx.b, can = ctx.editable(2), houses = b.face.pands;
  if (!houses.length) { replace(ctx.main, h('p', { class: 'empty' }, 'This face has no houses.')); return; }
  const cur = houses[Math.min(ctx.current, houses.length - 1)];
  if (view === 'one') { renderOne(ctx, cur, can); return; }
  const state = (id: string) => markState(b, ctx.derived, id);
  const counts = { marked: 0, wrong: 0, changed: 0 };
  for (const p of houses) { const st = state(p.pandId); if (st && st !== 'changed') counts.marked++; if (st === 'wrong') counts.wrong++; if (st === 'changed') counts.changed++; }

  const row = h('div', { class: 'row-imgs' }, h('p', { class: 'muted' }, 'Loading the row (renders every house once, then cached)…'));
  ctx.rowInfo().then(info => {
    const W = info.layout.width, pos = (lp: { x: number; w: number }) => `left:${(100 * lp.x / W).toFixed(3)}%;width:${(100 * lp.w / W).toFixed(3)}%`;
    const addr = (id: string) => houses.find(p => p.pandId === id)?.address ?? id;
    const cells = info.layout.pands.map(lp => {
      const st = state(lp.pandId), weak = ctx.derived?.pands[lp.pandId]?.weak?.length ?? 0;
      return h('button', { class: `cell${lp.pandId === cur.pandId ? ' sel' : ''}${st ? ` m-${st}` : ''}`, style: pos(lp), title: `${addr(lp.pandId)}${weak ? ` · ${weak} weak fields` : ''}`, 'data-house': lp.pandId,
        onclick: () => { ctx.current = houses.findIndex(p => p.pandId === lp.pandId); ctx.render(); } },
        h('span', { class: 'a' }, addr(lp.pandId).replace(/^\D+/, '')), st ? h('span', { class: `mk m-${st}` }, st === 'changed' ? 'changed, recheck' : MARK_TEXT[st]) : null);
    });
    const bar = info.layout.pands.map(lp => h('div', { class: 'markcell', style: pos(lp) },
      ...(['g', 'w', '?'] as const).map(k => h('button', { class: `mb ${MARK_KEYS[k]}${b.marks.marks[lp.pandId]?.mark === MARK_KEYS[k] && state(lp.pandId) !== 'changed' ? ' on' : ''}`, disabled: !can, title: `${MARK_KEYS[k]} (${k.toUpperCase()})`,
        onclick: () => { ctx.current = houses.findIndex(p => p.pandId === lp.pandId); mark(ctx, lp.pandId, MARK_KEYS[k]); } }, k.toUpperCase()))));
    replace(row, h('div', { class: 'rowscroll' },
      h('div', { class: 'rowbox', style: `aspect-ratio:${W}/${info.layout.height * 2}` }, h('img', { src: info.photo, alt: 'photo row' }), h('img', { src: info.render, alt: 'render row' }), h('div', { class: 'cells' }, ...cells)),
      h('div', { class: 'markbar', style: `width:${ctx.main.querySelector('.rowbox')?.clientWidth ?? 0}px` }, ...bar)),
      h('p', { class: 'muted small' }, `Top: picked photos; bottom: renders; both at ${info.ppm} px/m, registered on each house's BAG front.`));
    // The mark bar takes the row's drawn width (the row scrolls sideways on a narrow screen).
    const rb = row.querySelector<HTMLElement>('.rowbox'), mb = row.querySelector<HTMLElement>('.markbar');
    const fit = () => { if (rb && mb) mb.style.width = `${rb.clientWidth}px`; };
    row.querySelectorAll('img').forEach(i => i.addEventListener('load', fit)); fit();
    row.querySelector(`[data-house="${CSS.escape(cur.pandId)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }).catch(e => replace(row, h('p', { class: 'locked' }, `Row failed: ${(e as Error).message}`)));

  const seq = reviewOrder(b, ctx.derived, order), pos = seq.indexOf(cur.pandId);
  const head = h('div', { class: 'pand-head' },
    h('h2', {}, cur.address, h('small', {}, ` ${pos + 1} of ${seq.length} ${order === 'worst' ? 'worst first' : 'in street order'}`)),
    h('button', { class: 'ghost', onclick: () => { order = order === 'worst' ? 'street' : 'worst'; ctx.render(); }, title: 'Review order (O)' }, h('span', { class: 'key' }, 'O'), order === 'worst' ? ' worst first' : ' street order'),
    h('span', { class: 'muted small' }, `${counts.marked}/${houses.length} marked · ${counts.wrong} wrong${counts.changed ? ` · ${counts.changed} changed, recheck` : ''}`),
    focus ? h('button', { class: 'ghost', onclick: () => { focus = null; ctx.render(); } }, 'Close focus (Esc)') : h('button', { class: 'ghost', onclick: () => { focus = cur.pandId; ctx.render(); } }, h('span', { class: 'key' }, 'F'), ' Focus'),
    h('button', { class: 'ghost', onclick: () => { view = 'one'; focus = null; ctx.render(); }, title: 'One house at a time (R)' }, h('span', { class: 'key' }, 'R'), ' One house'));
  replace(ctx.main,
    can ? null : h('p', { class: 'locked' }, ctx.b.state.status === 'accepted' ? 'The block is accepted.' : ctx.b.state.stage > 2 ? 'Stage 2 is confirmed; marks are read-only (pins can still be resolved).' : 'Stage 2 opens after stage 1.'),
    head, row,
    focus ? focusView(ctx, houses.find(p => p.pandId === focus) ?? cur) : null,
    h('p', { id: 'keys', class: 'muted small' }, 'G good · W wrong (opens the focus view) · ? can\'t tell · ←/→ next/previous house (J/K too) · F focus · O order · in focus: click the photo or render to pin, then 1–8 tag · Esc close · Enter confirm stage'));
}

function mark(ctx: FaceCtx, id: string, m: MarkValue, note?: string) {
  if (!ctx.editable(2)) { ctx.say('Marks open once stage 1 is confirmed', 'err'); return; }
  const hash = ctx.derived?.pands[id]?.hash ?? null;
  const prior = ctx.b.marks.marks[id];
  if (m === 'wrong' && view === 'row') focus = id;
  else if (focus === id) focus = null;
  void ctx.saveMark(id, { mark: m, note: note ?? (m === 'wrong' ? prior?.note : undefined), tags: m === 'wrong' ? prior?.tags : undefined, hash }).then(() => {
    // Good / can't tell move on to the next house still to mark (unmarked or changed) in review order, wrapping; wrong
    // stays for pins.
    if (m === 'wrong') return;
    const seq = reviewOrder(ctx.b, ctx.derived, order), at = seq.indexOf(id);
    const todo = [...seq.slice(at + 1), ...seq.slice(0, at)].find(x => { const st = markState(ctx.b, ctx.derived, x); return st === null || st === 'changed'; });
    if (todo) { ctx.current = ctx.b.face.pands.findIndex(p => p.pandId === todo); ctx.render(); }
  });
}
function step(ctx: FaceCtx, d: number) {
  const seq = reviewOrder(ctx.b, ctx.derived, order), houses = ctx.b.face.pands;
  const i = seq.indexOf(houses[ctx.current]?.pandId);
  const next = seq[Math.max(0, Math.min(seq.length - 1, i + d))];
  ctx.current = houses.findIndex(p => p.pandId === next);
  if (focus) focus = ctx.b.marks.marks[next]?.mark === 'wrong' ? next : null;
  ctx.render();
}
export function keys2(ctx: FaceCtx, k: string): boolean {
  if (draft) {
    const i = Number(k) - 1;
    if (i >= 0 && i < FOCUS_PIN_TAGS.length) { ctx.main.querySelectorAll<HTMLButtonElement>('.tagbtns button')[i]?.click(); return true; }
    if (k === 'Escape') { draft = null; ctx.render(); return true; }
  }
  const id = ctx.b.face.pands[ctx.current]?.pandId;
  if (k === 'r') { view = view === 'one' ? 'row' : 'one'; focus = null; ctx.render(); return true; }
  if (view === 'one' && id && ctx.b.marks.marks[id]?.mark === 'wrong') {
    const i = Number(k) - 1;
    if (Number.isInteger(i) && i >= 0 && i < FOCUS_PIN_TAGS.length) { toggleTag(ctx, id, FOCUS_PIN_TAGS[i]); return true; }
    if (k === 'Enter' || k === ' ') { next(ctx, id); return true; }
  }
  if (MARK_KEYS[k] && id) { mark(ctx, id, MARK_KEYS[k]); return true; }
  if (k === 'ArrowRight' || k === 'j') { step(ctx, 1); return true; }
  if (k === 'ArrowLeft' || k === 'k') { step(ctx, -1); return true; }
  if (k === 'f' && id) { focus = focus === id ? null : id; ctx.render(); return true; }
  if (k === 'o') { order = order === 'worst' ? 'street' : 'worst'; ctx.render(); return true; }
  if (k === 'Escape' && focus) { focus = null; draft = null; ctx.render(); return true; }
  return false;
}

// ------------------------------------------------------------------------------------------- one house at a time
/** Move on to the next house still to mark (unmarked or changed) in review order, wrapping. */
function next(ctx: FaceCtx, id: string) {
  const seq = reviewOrder(ctx.b, ctx.derived, order), at = seq.indexOf(id);
  const todo = [...seq.slice(at + 1), ...seq.slice(0, at)].find(x => { const st = markState(ctx.b, ctx.derived, x); return st === null || st === 'changed'; });
  ctx.current = ctx.b.face.pands.findIndex(p => p.pandId === (todo ?? seq[Math.min(seq.length - 1, at + 1)]));
  ctx.render();
}
function toggleTag(ctx: FaceCtx, id: string, tag: string) {
  const m = ctx.b.marks.marks[id]; if (!m || !ctx.editable(2)) return;
  const tags = new Set(m.tags ?? []); if (tags.has(tag)) tags.delete(tag); else tags.add(tag);
  void ctx.saveMark(id, { mark: 'wrong', note: m.note, tags: [...tags], hash: ctx.derived?.pands[id]?.hash ?? null });
}

/** Stage 2, one house: photo and render big at one scale, three buttons; a wrong house asks what is most wrong. */
function renderOne(ctx: FaceCtx, p: FaceBundle['face']['pands'][number], can: boolean) {
  const b = ctx.b, houses = b.face.pands, der = ctx.derived?.pands[p.pandId];
  const seq = reviewOrder(b, ctx.derived, order), pos = seq.indexOf(p.pandId);
  let done = 0; for (const x of houses) { const st = markState(b, ctx.derived, x.pandId); if (st && st !== 'changed') done++; }
  const st = markState(b, ctx.derived, p.pandId), m = b.marks.marks[p.pandId];
  const imgs: HTMLImageElement[] = [];
  const photo = ctx.photoUrl(p.pandId);
  const ph = photo ? h('img', { class: 'photo', src: photo, alt: 'photo' }) as HTMLImageElement : null;
  const rimg = renderImage(ctx, p.pandId, undefined, () => alignScale(imgs, ctx, p.pandId));
  if (ph) { imgs.push(ph); ph.addEventListener('load', () => alignScale(imgs, ctx, p.pandId)); }
  imgs.push(rimg);
  const btn = (k: 'g' | 'w' | '?', label: string) => h('button', { class: `big ${MARK_KEYS[k]}${st === MARK_KEYS[k] ? ' on' : ''}`, disabled: !can, onclick: () => mark(ctx, p.pandId, MARK_KEYS[k]) }, label, h('span', { class: 'key' }, k.toUpperCase()));
  let wrongBox: HTMLElement | null = null;
  if (m?.mark === 'wrong' && st !== 'changed') {
    const on = new Set(m.tags ?? []);
    const note = h('input', { type: 'text', placeholder: 'Anything to add? (optional)', value: m.note ?? '', disabled: !can, 'aria-label': 'Note' }) as HTMLInputElement;
    note.addEventListener('change', () => { void ctx.saveMark(p.pandId, { mark: 'wrong', note: note.value.trim(), tags: m.tags, hash: der?.hash ?? null }); });
    note.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') note.blur(); });
    wrongBox = h('div', { class: 'wrongbox' },
      h('strong', {}, 'What is most wrong? '), h('span', { class: 'muted small' }, 'pick one or more, then Next'),
      h('div', { class: 'chips' }, ...FOCUS_PIN_TAGS.map((t, i) => h('button', { class: `chip${on.has(t) ? ' on' : ''}`, disabled: !can, onclick: () => toggleTag(ctx, p.pandId, t) }, h('span', { class: 'key' }, String(i + 1)), ' ', PIN_TAG_LABELS[t]))),
      h('div', { class: 'chips' }, note, h('button', { class: 'big next', onclick: () => next(ctx, p.pandId) }, 'Next house', h('span', { class: 'key' }, '↵'))));
  }
  replace(ctx.main,
    can ? null : h('p', { class: 'locked' }, b.state.status === 'accepted' ? 'The block is accepted.' : 'Stage 2 opens after stage 1.'),
    h('div', { class: 'pand-head one' },
      h('button', { class: 'nav', onclick: () => step(ctx, -1), disabled: pos <= 0, title: 'Previous (←)' }, '‹'),
      h('h2', {}, p.address),
      h('button', { class: 'nav', onclick: () => step(ctx, 1), disabled: pos >= seq.length - 1, title: 'Next (→)' }, '›'),
      h('div', { class: 'progress', title: `${done} of ${houses.length} marked` }, h('div', { style: `width:${(100 * done / houses.length).toFixed(1)}%` })),
      h('span', { class: 'muted small' }, `${done} of ${houses.length} done`),
      h('button', { class: 'ghost', onclick: () => { view = 'row'; ctx.render(); }, title: 'Whole row (R)' }, h('span', { class: 'key' }, 'R'), ' Whole row')),
    h('div', { class: 'onepair' },
      h('figure', {}, ph ?? h('div', { class: 'nophoto' }, 'no usable photo'), h('figcaption', {}, 'Photo')),
      h('figure', {}, rimg, h('figcaption', {}, 'Our drawing'))),
    h('p', { class: 'ask' }, 'Does the drawing look like the photo?'),
    h('div', { class: 'marks3' }, btn('g', 'Looks right'), btn('w', 'Wrong'), btn('?', "Can't tell")),
    st === 'changed' ? h('p', { class: 'muted small center' }, 'The drawing changed since you marked it: mark it again.') : null,
    wrongBox);
}

/** The focus view of one house: photo and render large (pinnable), the W note, its pins, kit gaps, and the fields folded. */
function focusView(ctx: FaceCtx, p: FaceBundle['face']['pands'][number]): HTMLElement {
  const b = ctx.b, der = ctx.derived?.pands[p.pandId], can = b.state.status !== 'accepted' && b.state.stage >= 2;
  const meta = h('span', { class: 'muted small' }, '');
  const imgs: HTMLImageElement[] = [];
  const photo = ctx.photoUrl(p.pandId);
  const ph = photo ? h('img', { class: 'photo', src: photo, alt: 'photo' }) as HTMLImageElement : null;
  const notApplied = h('div', { class: 'muted small' });
  const rimg = renderImage(ctx, p.pandId, meta, r => {
    const na = r.overrides?.notApplied ?? [];
    replace(notApplied, na.length ? `Renderer did not apply: ${na.join(', ')}` : 'The renderer applied every stated field.');
    alignScale(imgs, ctx, p.pandId);
  });
  if (ph) { imgs.push(ph); ph.addEventListener('load', () => alignScale(imgs, ctx, p.pandId)); }
  imgs.push(rimg);
  const own = () => p.pandId;
  const m = b.marks.marks[p.pandId];
  const note = h('input', { type: 'text', placeholder: 'What is wrong, in a few words (optional)', value: m?.note ?? '', disabled: !ctx.editable(2), 'aria-label': 'Note for the wrong mark' }) as HTMLInputElement;
  note.addEventListener('change', () => { void ctx.saveMark(p.pandId, { mark: 'wrong', note: note.value.trim(), hash: der?.hash ?? null }); });
  note.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') note.blur(); });
  const gapList = der?.cannotDraw.length ? h('ul', { class: 'gaps' }, ...der.cannotDraw.map(g => h('li', {}, h('strong', {}, g.field), `: ${g.why}`, g.gapId ? h('span', { class: 'tag' }, g.gapId) : null))) : h('p', { class: 'muted small' }, 'No kit gaps listed for this house.');
  const fields = h('details', { class: 'fieldsbox' }, h('summary', {}, `Fields (${der?.weak?.length ?? 0} weak)`), fieldTable(ctx, p.pandId));
  return h('section', { class: 'focus' },
    h('div', { class: 's4' },
      h('div', { class: 's4-view' }, h('div', { class: 'stage4 pair' }, ph ? pinnable(ctx, ph, 'photo', own, p.pandId, can) : h('div', { class: 'nophoto' }, 'no usable photo'), pinnable(ctx, rimg, 'render', own, p.pandId, can)), meta),
      h('aside', {},
        m?.mark === 'wrong' ? h('label', { class: 'wrongnote' }, h('strong', {}, 'Wrong: '), note) : null,
        pinForm(ctx, FOCUS_PIN_TAGS),
        pinList(ctx, p.pandId, can),
        h('h3', {}, 'Kit gaps'), gapList, notApplied,
        fields)));
}

/** The description fields of one house, weak ones only unless "all": kit values in a select, the source beside each. */
function fieldTable(ctx: FaceCtx, houseId: string): HTMLElement {
  const desc = ctx.b.description?.pands.find(x => x.pandId === houseId);
  const der = ctx.derived?.pands[houseId];
  const edits = ctx.b.edits.edits[houseId]?.fields ?? {};
  const can = ctx.b.state.status !== 'accepted' && ctx.b.state.stage >= 2;
  const weak = new Set(der?.weak ?? []);
  const shown = DESC_FIELDS.filter(f => allFields || weak.has(f) || !!edits[f]);
  const rows = shown.map(f => {
    const spec = FIELD_SPECS[f], d = desc?.fields?.[f] as DescFieldValue | undefined, drawn = der?.fields[f], edited = !!edits[f];
    let value = edited ? edits[f].value : drawn?.value ?? d?.value;
    if (f === 'door' && typeof value === 'number') value = { bay: value };
    let control: Node;
    if (spec.options && can) {
      const sel = h('select', { 'aria-label': spec.label, 'data-field': f }) as HTMLSelectElement;
      const cat = CATALOGUE_ENUM[f] ? ctx.catalogue?.enums[CATALOGUE_ENUM[f]!]?.values : undefined;
      if (value === undefined) sel.append(h('option', { value: '' }, '– not stated –'));
      if (value !== undefined && !isKitValue(f, value)) {
        const measured = f === 'wallColour' && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
        sel.append(h('option', { value: JSON.stringify(value) }, `${showValue(f, value)} (${measured ? 'measured colour' : 'read; not a kit value'})`));
      }
      for (const o of spec.options) {
        const n = cat?.[String(o.value)]?.houses;
        sel.append(h('option', { value: JSON.stringify(o.value) }, `${o.label}${n !== undefined ? `  · ${n} belt houses` : ''}`));
      }
      sel.value = value === undefined ? '' : JSON.stringify(value);
      sel.addEventListener('change', () => {
        if (!sel.value) return;
        const next = { ...edits, [f]: { value: JSON.parse(sel.value) } };
        if (d && same(d.value, next[f].value)) delete next[f];
        void ctx.saveEdits(houseId, next);
      });
      control = sel;
    } else control = h('span', { class: 'val' }, showValue(f, value));
    const src = edited ? h('span', { class: 'src edit', title: 'Your edit (edits.json)' }, 'edited')
      : drawn?.via ? h('span', { class: 'src mid', title: drawn.ref ?? '' }, `via ${drawn.source.split(':')[0]} ${drawn.via.slice(-6)}`)
      : d ? h('span', { class: `src ${SOURCE_CLASS(d.source)}`, title: d.ref }, `${d.source} ${Math.round(d.confidence * 100)}%`)
      : h('span', { class: 'src weak' }, 'missing');
    return h('tr', { class: edited ? 'edited' : '' }, h('th', {}, spec.label),
      h('td', {}, control, f === 'wallColour' && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? h('span', { class: 'swatch', style: `background:${value}`, title: value }) : null,
        edited && can ? h('button', { class: 'mini', title: 'Back to the description', onclick: () => { const next = { ...edits }; delete next[f]; void ctx.saveEdits(houseId, next); } }, 'reset') : null),
      h('td', {}, src));
  });
  const toggle = h('label', { class: 'muted small' }, h('input', { type: 'checkbox', checked: allFields, onchange: () => { allFields = !allFields; ctx.render(); } }), ' all fields');
  const notes = [...(der?.chain.length ? [`drawn through ${der.chain.join(' → ')}`] : []), ...(der?.notes ?? [])];
  return h('div', { class: 'fields' }, toggle,
    rows.length ? h('table', {}, h('tbody', {}, ...rows)) : h('p', { class: 'muted small' }, 'No weak fields: every field has a strong source.'),
    notes.length ? h('p', { class: 'muted small' }, notes.join(' · ')) : null,
    desc ? null : h('p', { class: 'muted' }, 'No description.json entry for this house yet (lane C writes it).'));
}

/** Show photo and render at one scale: both are px/m images (render at the face ppm, photo at its crop ppm). */
function alignScale(imgs: HTMLImageElement[], ctx: FaceCtx, pandId: string) {
  const ppm = ctx.derived?.ppm ?? 50;
  const metres = imgs.map(i => {
    const natH = Number(i.dataset.h) || i.naturalHeight;
    if (!natH) return 0;
    return natH / (i.classList.contains('photo') ? ctx.photoPxPerM(pandId) : ppm);
  });
  const tallest = Math.max(...metres);
  if (!tallest) return;
  const box = imgs[0].closest('.pair, .stage4, .onepair') as HTMLElement | null;
  const avail = Math.max(200, (box?.clientHeight || innerHeight * 0.6) - 30);
  imgs.forEach((i, k) => { if (metres[k]) i.style.height = `${Math.round(avail * metres[k] / tallest)}px`; });
}

// ============================================================================================================ stage 3
let selected = new Set<string>();
let linking: { pandId: string; kind: GroupingLinkKind } | null = null;
let rowCache: { key: string; info: RowInfo } | null = null;

/** The units in force: grouping.json's when it has any, else the description's ordekaart units, else one per pand. */
export function effectiveUnits(b: FaceBundle): GroupingFile['units'] {
  if (b.grouping.units.length) return b.grouping.units;
  const by = new Map<string, GroupingFile['units'][number]>();
  for (const p of b.face.pands) {
    const u = b.description?.pands.find(d => d.pandId === p.pandId)?.group?.unit;
    const id = u?.id ?? `pand:${basePand(p.pandId)}`;
    if (!by.has(id)) by.set(id, { id: id.replace(/[^A-Za-z0-9._-]/g, '_'), pandIds: [], source: u ? u.source : 'none', ...(u ? { ordekaartId: u.id } : {}) });
    by.get(id)!.pandIds.push(p.pandId);
  }
  return [...by.values()];
}

// ------------------------------------------------------------------------------------------- stage 3, one pair at a time
/** One pair of neighbours at a time (default), or the whole row with join/split tools (R). */
let view3: 'pairs' | 'row' = 'pairs';
let pairAt = 0;
const PAIR_KEYS: Record<string, PairAnswer> = { s: 'separate', d: 'twin', j: 'one', '?': 'unsure' };
const pairKey = (a: string, z: string) => `${a}|${z}`;

/** The neighbour pairs worth asking about: the city's ordekaart puts both in one object. Houses David split out in the
 *  row view (a one-house `david` unit) are not asked again. Every other pair is separate houses by default (#397). */
export function pairQueue(b: FaceBundle): Array<[string, string]> {
  const order = b.face.pands.map(p => p.pandId);
  const unit = (id: string) => b.description?.pands.find(d => d.pandId === id)?.group?.unit?.id;
  const splitOut = new Set(b.grouping.units.filter(u => u.id.startsWith('david-') && u.pandIds.length === 1).map(u => u.pandIds[0]));
  const out: Array<[string, string]> = [];
  for (let i = 0; i + 1 < order.length; i++) {
    const a = order[i], z = order[i + 1], ua = unit(a);
    if (ua && ua === unit(z) && !splitOut.has(a) && !splitOut.has(z)) out.push([a, z]);
  }
  return out;
}
/** Units and links from the pair answers: "one building" joins neighbours, "same design" links the right house to the left
 *  one (sameAs), everything else stays its own house. */
export function groupingFromPairs(b: FaceBundle, pairs: NonNullable<GroupingFile['pairs']>): Pick<GroupingFile, 'units' | 'links' | 'pairs'> {
  const order = b.face.pands.map(p => p.pandId), units: GroupingFile['units'] = [], links: GroupingFile['links'] = [];
  // Houses split out by hand in the row view keep their unit.
  const hand = new Map(b.grouping.units.filter(u => u.id.startsWith('david-') && u.pandIds.length === 1).map(u => [u.pandIds[0], { ...u, pandIds: [...u.pandIds] }]));
  for (let i = 0; i < order.length; i++) {
    const prev = i ? pairs[pairKey(order[i - 1], order[i])]?.answer : undefined;
    if (prev === 'one') units[units.length - 1].pandIds.push(order[i]);
    else units.push(hand.get(order[i]) ?? { id: `house-${order[i].replace(/[^A-Za-z0-9._-]/g, '_')}`, pandIds: [order[i]], source: 'pairs' });
    const pa = pairs[pairKey(order[i - 1] ?? '', order[i])];
    if (prev === 'twin') links.push({ pandId: order[i], kind: 'sameAs', target: order[i - 1], by: pa.by, at: pa.at });
  }
  return { units, links, pairs };
}

function renderPairs(ctx: FaceCtx, can: boolean) {
  const b = ctx.b, q = pairQueue(b), pairs = b.grouping.pairs ?? {};
  const addr = (id: string) => b.face.pands.find(p => p.pandId === id)?.address ?? id.slice(-6);
  const mine = (k: string) => pairs[k] && pairs[k].by !== 'claude';
  const done = q.filter(([a, z]) => mine(pairKey(a, z))).length;
  const head = h('div', { class: 'pand-head one' },
    h('h2', {}, 'Built as one building?'),
    h('div', { class: 'progress', title: `${done} of ${q.length} answered` }, h('div', { style: `width:${q.length ? (100 * done / q.length).toFixed(1) : 100}%` })),
    h('span', { class: 'muted small' }, `${done} of ${q.length} pairs`),
    h('button', { class: 'ghost', onclick: () => { view3 = 'row'; ctx.render(); }, title: 'Whole row with join/split tools (R)' }, h('span', { class: 'key' }, 'R'), ' Whole row'));
  if (!q.length) { replace(ctx.main, head, h('p', { class: 'ask' }, 'Nothing to ask: no neighbours here are grouped by the city map. Every house is its own building.')); return; }
  pairAt = Math.max(0, Math.min(q.length - 1, pairAt));
  const [a, z] = q[pairAt], entry = pairs[pairKey(a, z)], cur = entry?.answer, byClaude = entry?.by === 'claude';
  const imgs: HTMLImageElement[] = [];
  const fig = (id: string) => {
    const url = ctx.photoUrl(id);
    if (!url) return h('figure', {}, h('div', { class: 'nophoto' }, 'no photo'), h('figcaption', {}, addr(id)));
    const img = h('img', { class: 'photo', src: url, alt: addr(id), 'data-pand': id }) as HTMLImageElement;
    imgs.push(img);
    img.addEventListener('load', () => scaleTogether(imgs, ctx));
    return h('figure', {}, img, h('figcaption', {}, addr(id)));
  };
  const answer = (v: PairAnswer) => {
    if (!can) { ctx.say('Grouping is open while stage 3 is', 'err'); return; }
    const next = { ...pairs, [pairKey(a, z)]: { answer: v, by: 'david' as const, at: new Date().toISOString() } };
    const todo = q.findIndex(([x, y], i) => i > pairAt && !(next[pairKey(x, y)] && next[pairKey(x, y)].by !== 'claude'));
    pairAt = todo >= 0 ? todo : Math.min(q.length - 1, pairAt + 1);
    void ctx.saveGrouping(groupingFromPairs(b, next));
  };
  const btn = (k: string, label: string, sub: string) => h('button', { class: `big pairbtn${cur === PAIR_KEYS[k] ? (byClaude ? ' claude' : ' on') : ''}`, disabled: !can, onclick: () => answer(PAIR_KEYS[k]) },
    h('span', {}, label, h('small', {}, sub)), h('span', { class: 'key' }, k.toUpperCase()));
  pairKeys = (k: string) => {
    if (PAIR_KEYS[k]) { answer(PAIR_KEYS[k]); return true; }
    if (k === 'Enter' && byClaude && cur) { answer(cur); return true; }
    if (k === 'ArrowRight') { pairAt++; ctx.render(); return true; }
    if (k === 'ArrowLeft') { pairAt--; ctx.render(); return true; }
    return false;
  };
  replace(ctx.main,
    can ? null : h('p', { class: 'locked' }, b.state.stage > 3 ? 'Stage 3 is confirmed; grouping is read-only.' : 'Stage 3 opens after stage 2.'),
    head,
    h('div', { class: 'pand-head one' },
      h('button', { class: 'nav', onclick: () => { pairAt--; ctx.render(); }, disabled: pairAt === 0, title: 'Previous pair (←)' }, '‹'),
      h('span', {}, `Pair ${pairAt + 1} of ${q.length}: `, h('strong', {}, `${addr(a)} and ${addr(z)}`)),
      h('button', { class: 'nav', onclick: () => { pairAt++; ctx.render(); }, disabled: pairAt >= q.length - 1, title: 'Next pair (→)' }, '›')),
    h('div', { class: 'onepair twopair' }, fig(a), fig(z)),
    h('p', { class: 'ask' }, byClaude ? 'Claude\'s guess is outlined. Enter agrees, or press another answer.' : 'The city map lists these two together. What are they?'),
    byClaude && entry?.why ? h('p', { class: 'muted center' }, `Claude: ${entry.why}`) : null,
    h('div', { class: 'marks3' },
      btn('s', 'Two separate houses', 'different fronts'),
      btn('d', 'Same design', 'two houses, built alike'),
      btn('j', 'One building', 'one front across both'),
      btn('?', "Can't tell", '')),
    h('p', { class: 'muted small center' }, 'Pairs the city map does not group are separate houses already. You only see the ones it groups.'));
}
let pairKeys: (k: string) => boolean = () => false;
/** Photos side by side at one px/m: each image's height in metres sets its drawn height. */
function scaleTogether(imgs: HTMLImageElement[], ctx: FaceCtx) {
  const metres = imgs.map(i => i.naturalHeight / ctx.photoPxPerM(i.dataset.pand ?? ''));
  const tallest = Math.max(...metres); if (!tallest || !isFinite(tallest)) return;
  const box = imgs[0]?.closest('.onepair') as HTMLElement | null;
  const avail = Math.max(200, (box?.clientHeight || innerHeight * 0.6) - 30);
  imgs.forEach((i, k) => { if (metres[k]) i.style.height = `${Math.round(avail * metres[k] / tallest)}px`; });
}

export function renderStage3(ctx: FaceCtx) {
  const b = ctx.b, can = ctx.editable(3);
  if (view3 === 'pairs') { keys3 = (k: string) => { if (k === 'r') { view3 = 'row'; ctx.render(); return true; } return pairKeys(k); }; renderPairs(ctx, can); return; }
  const units = effectiveUnits(b);
  const unitOf = new Map<string, number>();
  units.forEach((u, i) => u.pandIds.forEach(p => unitOf.set(p, i)));
  const linkOf = new Map(b.grouping.links.map(l => [l.pandId, l]));
  const addr = (id: string) => b.face.pands.find(p => p.pandId === id)?.address ?? id.slice(-6);
  const save = (u: GroupingFile['units'], l: GroupingFile['links']) => { selected = new Set(); linking = null; void ctx.saveGrouping({ units: u, links: l }); };

  const imgs = h('div', { class: 'row-imgs' }, h('p', { class: 'muted' }, 'Loading the row (renders every house once, then cached)…'));
  ctx.rowInfo().then(info => {
    rowCache = { key: info.key, info };
    const W = info.layout.width;
    const cells = info.layout.pands.map(lp => {
      const ui = unitOf.get(lp.pandId) ?? 0, link = linkOf.get(lp.pandId), sel = selected.has(lp.pandId);
      return h('button', {
        class: `cell u${ui % 6}${sel ? ' sel' : ''}${linking?.pandId === lp.pandId ? ' linking' : ''}`, style: `left:${(100 * lp.x / W).toFixed(3)}%;width:${(100 * lp.w / W).toFixed(3)}%`,
        title: `${addr(lp.pandId)} · unit ${units[ui]?.ordekaartId ?? units[ui]?.id}`,
        onclick: (e: Event) => cellClick(lp.pandId, (e as MouseEvent).shiftKey),
      }, h('span', { class: 'a' }, addr(lp.pandId).replace(/^\D+/, '')), link ? h('span', { class: 'l' }, `${link.kind === 'sameAs' ? '=' : '≈'} ${addr(link.target).replace(/^\D+/, '')}`) : null);
    });
    replace(imgs, h('div', { class: 'rowscroll' }, h('div', { class: 'rowbox', style: `aspect-ratio:${W}/${info.layout.height * 2 + 0}` },
      h('img', { src: info.photo, alt: 'photo row' }), h('img', { src: info.render, alt: 'render row' }), h('div', { class: 'cells' }, ...cells))),
    h('p', { class: 'muted small' }, `Top: chosen photos; bottom: renders; both at ${info.ppm} px/m. ${info.ms} ms.`));
  }).catch(e => replace(imgs, h('p', { class: 'locked' }, `Row failed: ${(e as Error).message}`)));

  function cellClick(pandId: string, shift: boolean) {
    if (!can) return;
    if (linking) {
      if (linking.pandId !== pandId) {
        const links = b.grouping.links.filter(l => l.pandId !== linking!.pandId);
        links.push({ pandId: linking.pandId, kind: linking.kind, target: pandId, by: 'david', at: new Date().toISOString() });
        save(units, links);
      } else { linking = null; ctx.render(); }
      return;
    }
    if (shift && selected.size) {
      const order = b.face.pands.map(p => p.pandId), last = [...selected].pop()!;
      const [a, z] = [order.indexOf(last), order.indexOf(pandId)].sort((x, y) => x - y);
      for (const id of order.slice(a, z + 1)) selected.add(id);
    } else if (selected.has(pandId)) selected.delete(pandId); else selected.add(pandId);
    ctx.render();
  }
  const join = () => {
    if (selected.size < 2) { ctx.say('Select two or more houses to join (click, shift-click for a range)', 'err'); return; }
    const next = units.map(u => ({ ...u, pandIds: u.pandIds.filter(p => !selected.has(p)) })).filter(u => u.pandIds.length);
    const order = b.face.pands.map(p => p.pandId);
    next.push({ id: `david-${Date.now().toString(36)}`, pandIds: [...selected].sort((x, y) => order.indexOf(x) - order.indexOf(y)), source: 'david' });
    save(next, b.grouping.links);
  };
  const split = () => {
    if (!selected.size) { ctx.say('Select houses to split out of their unit', 'err'); return; }
    const next = units.map(u => ({ ...u, pandIds: u.pandIds.filter(p => !selected.has(p)) })).filter(u => u.pandIds.length);
    for (const p of selected) next.push({ id: `david-${p.slice(-6)}-${Date.now().toString(36)}`, pandIds: [p], source: 'david' });
    save(next, b.grouping.links);
  };
  const startLink = (kind: GroupingLinkKind) => {
    if (selected.size !== 1) { ctx.say('Select one house, then press I (identical to) or B (based on) and click the other house', 'err'); return; }
    linking = { pandId: [...selected][0], kind }; ctx.say(`Click the house ${addr(linking.pandId)} is ${kind === 'sameAs' ? 'identical to' : 'based on'} (Esc cancels)`); ctx.render();
  };
  const unlink = () => { if (!selected.size) return; save(units, b.grouping.links.filter(l => !selected.has(l.pandId))); };
  keys3 = (k: string) => {
    if (k === 'r') { view3 = 'pairs'; ctx.render(); } else if (k === 'g') join(); else if (k === 's') split(); else if (k === 'i') startLink('sameAs'); else if (k === 'b') startLink('basedOn'); else if (k === 'x') unlink();
    else if (k === 'Escape') { linking = null; selected = new Set(); ctx.render(); } else return false;
    return true;
  };

  const tools = h('div', { class: 'tools' },
    h('button', { onclick: join, disabled: !can }, h('span', { class: 'key' }, 'G'), ' Join'),
    h('button', { onclick: split, disabled: !can }, h('span', { class: 'key' }, 'S'), ' Split'),
    h('button', { onclick: () => startLink('sameAs'), disabled: !can }, h('span', { class: 'key' }, 'I'), ' Identical to…'),
    h('button', { onclick: () => startLink('basedOn'), disabled: !can }, h('span', { class: 'key' }, 'B'), ' Based on…'),
    h('button', { onclick: unlink, disabled: !can }, h('span', { class: 'key' }, 'X'), ' Remove link'),
    h('span', { class: 'muted small' }, `${selected.size} selected${linking ? ` · linking ${addr(linking.pandId)}` : ''}`));
  const list = h('ol', { class: 'units' }, ...units.map((u, i) => h('li', { class: `u${i % 6}` },
    h('strong', {}, u.ordekaartId ?? (u.source === 'david' ? 'your unit' : u.id)), h('span', { class: 'muted small' }, ` ${u.source}`), ': ',
    u.pandIds.map(addr).join(', '))));
  const links = b.grouping.links.length ? h('ul', { class: 'links' }, ...b.grouping.links.map(l => h('li', {}, `${addr(l.pandId)} ${l.kind === 'sameAs' ? 'is identical to' : 'is based on'} ${addr(l.target)}`, l.overrides && Object.keys(l.overrides).length ? ` (overrides ${Object.keys(l.overrides).join(', ')})` : '', ` · ${l.by}`))) : h('p', { class: 'muted small' }, 'No sameAs / based-on links yet.');
  replace(ctx.main, can ? null : h('p', { class: 'locked' }, ctx.b.state.stage > 3 ? 'Stage 3 is confirmed; grouping is read-only.' : 'Stage 3 opens after stage 2.'),
    tools, imgs, h('div', { class: 's3' }, h('section', {}, h('h3', {}, 'Design units'), list), h('section', {}, h('h3', {}, 'Links'), links)),
    h('p', { id: 'keys', class: 'muted small' }, 'Click a house to select (shift-click a range) · G join · S split · I identical to · B based on · X remove link · Esc clear · Enter confirm stage'));
}
export let keys3: (k: string) => boolean = () => false;

// ============================================================================================ pins (focus view, stage 4)
let draft: { target: PinTarget; x: number; y: number; pandId: string | null } | null = null;
const STATUS_TEXT: Record<Pin['status'], string> = { open: 'open', fixed: 'fixed: check it', resolved: 'resolved', reopened: 'reopened' };
const pinsSorted = (b: FaceBundle) => Object.values(b.pins.pins).sort((x, y) => x.createdAt.localeCompare(y.createdAt));

/** A pinnable image: click drops a draft pin; this house's pins on this target are drawn on it. */
function pinnable(ctx: FaceCtx, img: HTMLImageElement, target: PinTarget, pandOf: (x: number) => string | null, houseId: string, can: boolean) {
  const pins = pinsSorted(ctx.b), num = new Map(pins.map((x, i) => [x.id, i + 1]));
  const box = h('div', { class: 'pinbox' }, img);
  for (const pin of pins.filter(x => x.target === target && x.pandId === houseId)) {
    box.append(h('span', { class: `pin ${pin.status}`, style: `left:${pin.x * 100}%;top:${pin.y * 100}%`, title: `${PIN_TAG_LABELS[pin.tag]}: ${pin.note}` }, String(num.get(pin.id))));
  }
  if (draft && draft.target === target && draft.pandId === houseId) box.append(h('span', { class: 'pin draft', style: `left:${draft.x * 100}%;top:${draft.y * 100}%` }, '+'));
  img.addEventListener('click', e => {
    if (!can) { ctx.say('The block is accepted', 'err'); return; }
    const r = img.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    draft = { target, x: +x.toFixed(4), y: +y.toFixed(4), pandId: pandOf(x) }; ctx.render();
    setTimeout(() => (document.getElementById('pin-note') as HTMLInputElement | null)?.focus(), 0);
  });
  return box;
}

function pinForm(ctx: FaceCtx, tags: readonly PinTag[]): HTMLElement | null {
  if (!draft) return null;
  const note = h('input', { id: 'pin-note', type: 'text', placeholder: `Note (optional), then a tag key 1–${tags.length} or click a tag`, 'aria-label': 'Pin note' }) as HTMLInputElement;
  const make = (tag: PinTag) => { const d = draft!; draft = null; void ctx.savePin({ id: `pin-${Date.now().toString(36)}`, pandId: d.pandId, target: d.target, x: d.x, y: d.y, tag, note: note.value.trim(), status: 'open' }); };
  // An empty note box takes a tag key straight away; once there is text, Enter files it under `other`.
  note.addEventListener('keydown', e => {
    const i = Number(e.key) - 1;
    if (e.key === 'Escape') { draft = null; ctx.render(); }
    else if (note.value === '' && Number.isInteger(i) && i >= 0 && i < tags.length) { e.preventDefault(); make(tags[i]); }
    else if (e.key === 'Enter') make('other');
  });
  return h('div', { class: 'pinform' }, h('strong', {}, `New pin on the ${draft.target}`), note,
    h('div', { class: 'tagbtns' }, ...tags.map((t, i) => h('button', { onclick: () => make(t) }, h('span', { class: 'key' }, String(i + 1)), ' ', PIN_TAG_LABELS[t]))),
    h('button', { class: 'ghost', onclick: () => { draft = null; ctx.render(); } }, 'Cancel (Esc)'));
}

/** Pins with resolve / reopen and a reply box; `houseId` null lists every pin with its house. */
function pinList(ctx: FaceCtx, houseId: string | null, can: boolean): HTMLElement {
  const b = ctx.b, all = pinsSorted(b), num = new Map(all.map((x, i) => [x.id, i + 1]));
  const shown = all.filter(x => houseId === null || x.pandId === houseId);
  const addr = (id: string | null) => b.face.pands.find(p => p.pandId === id)?.address ?? '';
  const list = h('ol', { class: 'pins' }, ...shown.map(pin => {
    const reply = h('input', { type: 'text', placeholder: 'Reply…', 'aria-label': 'Reply', disabled: !can }) as HTMLInputElement;
    reply.addEventListener('keydown', e => { if (e.key === 'Enter' && reply.value.trim()) void ctx.savePin({ ...pin, thread: [...pin.thread, { at: new Date().toISOString(), by: 'david', text: reply.value.trim() }] }); });
    return h('li', { class: `pinrow ${pin.status}` },
      h('div', {}, h('span', { class: `pin ${pin.status} inline` }, String(num.get(pin.id))), ' ', h('strong', {}, PIN_TAG_LABELS[pin.tag]), houseId === null ? ` · ${addr(pin.pandId)}` : '', ` · ${pin.target}`, pin.kind ? h('span', { class: 'tag' }, pin.kind) : null, h('span', { class: `tag st-${pin.status}` }, STATUS_TEXT[pin.status])),
      pin.note ? h('div', {}, pin.note) : null,
      ...pin.thread.map(m => h('div', { class: `msg ${m.by}` }, h('b', {}, m.by === 'claude' ? 'Claude' : 'You'), ` ${m.text}`)),
      can ? h('div', { class: 'pinacts' },
        pin.status !== 'resolved' ? h('button', { onclick: () => ctx.savePin({ ...pin, status: 'resolved' }) }, 'Resolve') : h('button', { onclick: () => ctx.savePin({ ...pin, status: 'reopened' }) }, 'Reopen'),
        reply) : null);
  }));
  return h('div', {}, h('h3', {}, `Pins (${shown.length})`), shown.length ? list : h('p', { class: 'muted small' }, can ? 'Click the photo or the render to pin what is wrong.' : 'No pins.'));
}

// ============================================================================================================ stage 4
/** Stage 4: the block in the game (stub until the integrator wires R8), the pins left to resolve, accept. */
export function renderStage4(ctx: FaceCtx) {
  const b = ctx.b, can = b.state.status !== 'accepted';
  const open = Object.values(b.pins.pins).filter(p => p.status !== 'resolved').length;
  replace(ctx.main,
    h('div', { class: 'pand-head' }, h('h2', {}, 'Open in game'), h('button', { class: 'ghost', disabled: true, title: 'Opens the block in the game at a first-person pose (wired by the integrator, plan R8)' }, 'Open in game')),
    h('p', { class: 'muted' }, `Likeness was judged in stage 2; here the block is ridden in the game, the last pins resolved (${open} open), and the block accepted (Enter).`),
    pinList(ctx, null, can),
    h('p', { id: 'keys', class: 'muted small' }, 'Enter accept the block'));
}
export function keys4(_ctx: FaceCtx, _k: string): boolean { return false; }
