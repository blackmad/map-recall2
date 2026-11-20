/**
 * Belt review page, stages 2–4 (plan "The loop"):
 *   2  the description beside the chosen photo and its live render; correct a field by choosing a kit value
 *   3  the row with design units and sameAs / basedOn links: join, split, identical to, based on
 *   4  photo and render at one scale (Q photo, W render, E side by side, R row, B blink), kit gaps, pins
 * faceView.ts owns the page shell, stage 1 and the saves; these render into `ctx.main` and handle their stage's keys.
 */
import { h, replace } from './dom.ts';
import { DESC_FIELDS, FIELD_SPECS, isKitValue, same, showValue, type DescField } from './fields.ts';
import {
  PIN_TAGS, PIN_TAG_LABELS, type DescFieldValue, type FaceBundle, type GroupingFile, type GroupingLinkKind, type Pin, type PinTag,
  type PinTarget, type Stage,
} from './types.ts';

export interface DerivedPand {
  pandId: string;
  fields: Record<string, { value: unknown; source: string; ref?: string; edited?: boolean; via?: string }>;
  chain: string[];
  notes: string[];
  cannotDraw: Array<{ field: string; value?: unknown; drawnAs?: unknown; why: string; gapId?: string }>;
  hash: string;
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
  saveGrouping(value: Pick<GroupingFile, 'units' | 'links'>): Promise<void>;
  savePin(pin: Partial<Pin> & { id: string }): Promise<void>;
  renderInfo(pandId: string): Promise<RenderInfo>;
  rowInfo(): Promise<RowInfo>;
}

/** Description field -> kit catalogue enum (lane C kit-catalogue.json). */
const CATALOGUE_ENUM: Partial<Record<DescField, string>> = { crown: 'gable', cornice: 'cornice', heads: 'windowHead', windowSurround: 'windowSurround', windows: 'windows', stoop: 'basement', wallFinish: 'wallMaterial' };
const SOURCE_CLASS = (s: string) => s === 'edit' ? 'edit' : /^(reviewed|face-intent)/.test(s) ? 'strong' : /^(own-read|register|survey|based-on|sameAs|basedOn)/.test(s) ? 'mid' : 'weak';

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
export function renderStage2(ctx: FaceCtx) {
  const p = ctx.b.face.pands[ctx.current];
  if (!p) { replace(ctx.main, h('p', { class: 'empty' }, 'This face has no houses.')); return; }
  const desc = ctx.b.description?.pands.find(x => x.pandId === p.pandId);
  const der = ctx.derived?.pands[p.pandId];
  const edits = ctx.b.edits.edits[p.pandId]?.fields ?? {};
  const can = ctx.editable(2);
  const photo = ctx.photoUrl(p.pandId);
  const meta = h('div', { class: 'muted small' }, 'rendering…');
  const rows = DESC_FIELDS.map(f => {
    const spec = FIELD_SPECS[f], d = desc?.fields?.[f] as DescFieldValue | undefined, drawn = der?.fields[f], edited = !!edits[f];
    let value = edited ? edits[f].value : drawn?.value ?? d?.value;
    // A bare door bay (a number) is the kit's {bay} without a doorcase.
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
        // Choosing the described value again drops the edit.
        if (d && same(d.value, next[f].value)) delete next[f];
        void ctx.saveEdits(p.pandId, next);
      });
      control = sel;
    } else control = h('span', { class: 'val' }, showValue(f, value));
    const src = edited ? h('span', { class: 'src edit', title: 'Your edit (edits.json)' }, 'edited')
      : drawn?.via ? h('span', { class: 'src mid', title: drawn.ref ?? '' }, `via ${drawn.source.split(':')[0]} ${drawn.via.slice(-6)}`)
      : d ? h('span', { class: `src ${SOURCE_CLASS(d.source)}`, title: d.ref }, `${d.source} ${Math.round(d.confidence * 100)}%`)
      : h('span', { class: 'src weak' }, 'missing');
    const others = !edited && d?.others?.length ? h('div', { class: 'others' }, ...d.others.map(o => h('span', { title: o.ref }, `${o.source}: ${showValue(f, o.value)}`))) : null;
    const agree = !edited && d?.agree?.length ? h('span', { class: 'muted small' }, ` + ${d.agree.join(', ')}`) : null;
    return h('tr', { class: edited ? 'edited' : '' },
      h('th', {}, spec.label),
      h('td', {}, control, f === 'wallColour' && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? h('span', { class: 'swatch', style: `background:${value}`, title: value }) : null, edited && can ? h('button', { class: 'mini', title: 'Back to the description', onclick: () => { const next = { ...edits }; delete next[f]; void ctx.saveEdits(p.pandId, next); } }, 'reset') : null),
      h('td', {}, src, agree, others));
  });
  const notes = [...(der?.chain.length ? [`drawn through ${der.chain.join(' → ')}`] : []), ...(der?.notes ?? [])];
  const scaleImgs: HTMLImageElement[] = [];
  const ph = photo ? h('img', { class: 'photo', src: photo, alt: 'chosen photo' }) as HTMLImageElement : null;
  if (ph) scaleImgs.push(ph);
  const rimg = renderImage(ctx, p.pandId, meta, () => alignScale(scaleImgs, ctx, p.pandId));
  scaleImgs.push(rimg);
  ph?.addEventListener('load', () => alignScale(scaleImgs, ctx, p.pandId));
  replace(ctx.main, ctx.pandStrip(),
    can ? null : h('p', { class: 'locked' }, ctx.b.state.stage > 2 ? 'Stage 2 is confirmed; fields are read-only.' : 'Stage 2 opens after stage 1.'),
    header(ctx),
    h('div', { class: 's2' },
      h('div', { class: 'pair' },
        h('figure', {}, ph ?? h('div', { class: 'nophoto' }, 'no usable photo'), h('figcaption', { class: 'muted small' }, 'photo')),
        h('figure', {}, rimg, h('figcaption', {}, meta))),
      h('div', { class: 'fields' },
        h('table', {}, h('tbody', {}, ...rows)),
        notes.length ? h('p', { class: 'muted small' }, notes.join(' · ')) : null,
        desc ? null : h('p', { class: 'muted' }, 'No description.json entry for this house yet (lane C writes it).'))),
    h('p', { id: 'keys', class: 'muted small' }, 'J/K next/previous house · choose a value to correct a field (saved at once, re-rendered) · Enter confirm stage'));
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
  const box = imgs[0].closest('.pair, .stage4') as HTMLElement | null;
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
    const id = u?.id ?? `pand:${p.pandId}`;
    if (!by.has(id)) by.set(id, { id: id.replace(/[^A-Za-z0-9._-]/g, '_'), pandIds: [], source: u ? u.source : 'none', ...(u ? { ordekaartId: u.id } : {}) });
    by.get(id)!.pandIds.push(p.pandId);
  }
  return [...by.values()];
}

export function renderStage3(ctx: FaceCtx) {
  const b = ctx.b, can = ctx.editable(3);
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
    if (k === 'g') join(); else if (k === 's') split(); else if (k === 'i') startLink('sameAs'); else if (k === 'b') startLink('basedOn'); else if (k === 'x') unlink();
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

// ============================================================================================================ stage 4
type Layer = 'photo' | 'render' | 'pair' | 'row';
let layer: Layer = 'pair', blink: ReturnType<typeof setInterval> | null = null;
let draft: { target: PinTarget; x: number; y: number; pandId: string | null } | null = null;
const LAYER_KEYS: Record<string, Layer> = { q: 'photo', w: 'render', e: 'pair', r: 'row' };
const STATUS_TEXT: Record<Pin['status'], string> = { open: 'open', fixed: 'fixed: check it', resolved: 'resolved', reopened: 'reopened' };

export function renderStage4(ctx: FaceCtx) {
  const b = ctx.b, p = b.face.pands[ctx.current];
  if (!p) return;
  const der = ctx.derived?.pands[p.pandId];
  const meta = h('span', { class: 'muted small' }, '');
  const pins = Object.values(b.pins.pins).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const num = new Map(pins.map((x, i) => [x.id, i + 1]));
  const can = ctx.b.state.status !== 'accepted' && ctx.b.state.stage === 4;

  /** A pinnable image: click drops a draft pin; existing pins of this target (and pand) are drawn on it. */
  const pinnable = (img: HTMLImageElement, target: PinTarget, pandOf: (x: number) => string | null) => {
    const box = h('div', { class: 'pinbox' }, img);
    for (const pin of pins.filter(x => x.target === target && (target.startsWith('row') || x.pandId === p.pandId))) {
      box.append(h('span', { class: `pin ${pin.status}`, style: `left:${pin.x * 100}%;top:${pin.y * 100}%`, title: `${PIN_TAG_LABELS[pin.tag]}: ${pin.note}` }, String(num.get(pin.id))));
    }
    if (draft && draft.target === target) box.append(h('span', { class: 'pin draft', style: `left:${draft.x * 100}%;top:${draft.y * 100}%` }, '+'));
    img.addEventListener('click', e => {
      if (!can) { ctx.say('Pins open at stage 4', 'err'); return; }
      const r = img.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      draft = { target, x: +x.toFixed(4), y: +y.toFixed(4), pandId: pandOf(x) }; ctx.render();
      setTimeout(() => (document.getElementById('pin-note') as HTMLInputElement | null)?.focus(), 0);
    });
    return box;
  };

  let view: Node;
  const photo = ctx.photoUrl(p.pandId);
  if (layer === 'row') {
    const box = h('div', { class: 'rowimgs4' }, h('p', { class: 'muted' }, 'Loading the row…'));
    ctx.rowInfo().then(info => {
      const at = (x: number) => { const px = x * info.layout.width; return info.layout.pands.find(l => px >= l.x && px < l.x + l.w)?.pandId ?? null; };
      replace(box, pinnable(h('img', { src: info.photo, alt: 'photo row' }) as HTMLImageElement, 'row-photo', at), pinnable(h('img', { src: info.render, alt: 'render row' }) as HTMLImageElement, 'row-render', at));
    }).catch(e => replace(box, h('p', { class: 'locked' }, (e as Error).message)));
    view = box;
  } else {
    const imgs: HTMLImageElement[] = [];
    const ph = photo ? h('img', { class: 'photo', src: photo, alt: 'photo' }) as HTMLImageElement : null;
    const rimg = renderImage(ctx, p.pandId, meta, r => { notDrawn(r); alignScale(imgs, ctx, p.pandId); });
    if (ph) { imgs.push(ph); ph.addEventListener('load', () => alignScale(imgs, ctx, p.pandId)); }
    imgs.push(rimg);
    const own = () => p.pandId;
    const parts = layer === 'photo' ? [ph ? pinnable(ph, 'photo', own) : h('div', { class: 'nophoto' }, 'no usable photo')]
      : layer === 'render' ? [pinnable(rimg, 'render', own)]
      : [ph ? pinnable(ph, 'photo', own) : h('div', { class: 'nophoto' }, 'no usable photo'), pinnable(rimg, 'render', own)];
    if (layer === 'photo') rimg.hidden = true;
    view = h('div', { class: `stage4 ${layer}` }, ...parts, layer === 'photo' ? rimg : null);
  }

  // Kit gaps: description fields the kit cannot draw (lane C), and design fields the renderer did not apply.
  const gapList = h('ul', { class: 'gaps' }, ...(der?.cannotDraw ?? []).map(g => h('li', {}, h('strong', {}, g.field), `: ${g.why}`, g.gapId ? h('span', { class: 'tag' }, g.gapId) : null)));
  const notApplied = h('div', { class: 'muted small' });
  function notDrawn(r: RenderInfo) {
    const na = r.overrides?.notApplied ?? [];
    replace(notApplied, na.length ? `Renderer did not apply: ${na.join(', ')}` : 'The renderer applied every stated field.');
  }

  const pinForm = draft ? (() => {
    const note = h('input', { id: 'pin-note', type: 'text', placeholder: 'Note (optional), then a tag key 1–9 or click a tag', 'aria-label': 'Pin note' }) as HTMLInputElement;
    const make = (tag: PinTag) => { const d = draft!; draft = null; void ctx.savePin({ id: `pin-${Date.now().toString(36)}`, pandId: d.pandId, target: d.target, x: d.x, y: d.y, tag, note: note.value.trim(), status: 'open' }); };
    // An empty note box takes a tag key (1–9) straight away; once there is text, Enter files it under `other`
    // unless a tag button is clicked.
    note.addEventListener('keydown', e => {
      const i = Number(e.key) - 1;
      if (e.key === 'Escape') { draft = null; ctx.render(); }
      else if (note.value === '' && Number.isInteger(i) && i >= 0 && i < PIN_TAGS.length) { e.preventDefault(); make(PIN_TAGS[i]); }
      else if (e.key === 'Enter') make('other');
    });
    return h('div', { class: 'pinform' }, h('strong', {}, `New pin on ${draft!.target}${draft!.pandId ? ` · ${b.face.pands.find(x => x.pandId === draft!.pandId)?.address ?? ''}` : ''}`), note,
      h('div', { class: 'tagbtns' }, ...PIN_TAGS.map((t, i) => h('button', { onclick: () => make(t) }, h('span', { class: 'key' }, String(i + 1)), ' ', PIN_TAG_LABELS[t]))),
      h('button', { class: 'ghost', onclick: () => { draft = null; ctx.render(); } }, 'Cancel (Esc)'));
  })() : null;

  const shown = pins.filter(x => x.pandId === p.pandId || x.target.startsWith('row'));
  const pinList = h('ol', { class: 'pins' }, ...shown.map(pin => {
    const reply = h('input', { type: 'text', placeholder: 'Reply…', 'aria-label': 'Reply' }) as HTMLInputElement;
    reply.addEventListener('keydown', e => { if (e.key === 'Enter' && reply.value.trim()) void ctx.savePin({ ...pin, thread: [...pin.thread, { at: new Date().toISOString(), by: 'david', text: reply.value.trim() }] }); });
    return h('li', { class: `pinrow ${pin.status}` },
      h('div', {}, h('span', { class: `pin ${pin.status} inline` }, String(num.get(pin.id))), ' ', h('strong', {}, PIN_TAG_LABELS[pin.tag]), ` · ${pin.target}`, pin.kind ? h('span', { class: 'tag' }, pin.kind) : null, h('span', { class: `tag st-${pin.status}` }, STATUS_TEXT[pin.status])),
      pin.note ? h('div', {}, pin.note) : null,
      ...pin.thread.map(m => h('div', { class: `msg ${m.by}` }, h('b', {}, m.by === 'claude' ? 'Claude' : 'You'), ` ${m.text}`)),
      h('div', { class: 'pinacts' },
        pin.status !== 'resolved' ? h('button', { onclick: () => ctx.savePin({ ...pin, status: 'resolved' }) }, 'Resolve') : h('button', { onclick: () => ctx.savePin({ ...pin, status: 'reopened' }) }, 'Reopen'),
        reply));
  }));

  const layerBar = h('div', { class: 'layers' }, ...(['q', 'w', 'e', 'r'] as const).map(k => h('button', { class: layer === LAYER_KEYS[k] ? 'on' : '', onclick: () => setLayer(ctx, LAYER_KEYS[k]) }, h('span', { class: 'key' }, k.toUpperCase()), ' ', LAYER_KEYS[k] === 'pair' ? 'side by side' : LAYER_KEYS[k])),
    h('button', { class: blink ? 'on' : '', onclick: () => toggleBlink(ctx), title: 'Blink photo and render (B)' }, h('span', { class: 'key' }, 'B'), ' blink'), meta);
  replace(ctx.main, ctx.pandStrip(), header(ctx), layerBar,
    h('div', { class: 's4' }, h('div', { class: 's4-view' }, view),
      h('aside', {}, pinForm, h('h3', {}, `Pins (${shown.length})`), shown.length ? pinList : h('p', { class: 'muted small' }, can ? 'Click the photo or the render to drop a pin.' : 'Pins open at stage 4.'),
        h('h3', {}, 'Kit gaps'), (der?.cannotDraw.length ? gapList : h('p', { class: 'muted small' }, 'Nothing listed for this house.')), notApplied,
        h('button', { class: 'ghost', disabled: true, title: 'Opens this house in the game at a first-person pose (wired by the integrator, plan R8)' }, 'Open in game'))),
    h('p', { id: 'keys', class: 'muted small' }, 'Q photo · W render · E side by side · R row · B blink · click to pin, then 1–9 tag · J/K next/previous house · Enter accept the block'));
}

function setLayer(ctx: FaceCtx, l: Layer) { if (blink) { clearInterval(blink); blink = null; } layer = l; draft = null; ctx.render(); }
function toggleBlink(ctx: FaceCtx) {
  if (blink) { clearInterval(blink); blink = null; ctx.render(); return; }
  layer = 'photo'; ctx.render();
  blink = setInterval(() => {
    const s = ctx.main.querySelector('.stage4'); if (!s) return;
    const [ph, r] = [s.querySelector<HTMLImageElement>('img.photo'), s.querySelector<HTMLImageElement>('img.render')];
    if (ph && r) { ph.hidden = !ph.hidden; r.hidden = !ph.hidden; (ph.closest('.pinbox') as HTMLElement | null)?.toggleAttribute('hidden', ph.hidden); }
  }, 500);
}
export function keys4(ctx: FaceCtx, k: string): boolean {
  if (draft) {
    const i = Number(k) - 1;
    if (i >= 0 && i < PIN_TAGS.length) { (ctx.main.querySelectorAll<HTMLButtonElement>('.tagbtns button'))[i]?.click(); return true; }
    if (k === 'Escape') { draft = null; ctx.render(); return true; }
  }
  if (LAYER_KEYS[k]) { setLayer(ctx, LAYER_KEYS[k]); return true; }
  if (k === 'b') { toggleBlink(ctx); return true; }
  return false;
}
