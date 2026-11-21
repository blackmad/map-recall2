/**
 * Belt review page, one block face: the four checks in order, each confirmed before the next opens. Stage 1 (photo pick)
 * lives here; stages 2–4 are in stages.ts (description, grouping, render + pins).
 *
 * Keys (stage 1): 1–6 pick a candidate, 0 or X none usable, J / → next house, K / ← previous house, Z zoom the selected
 * photo, Enter confirm the stage once every house has a pick, ? help. Space flips photo/pick in the zoom.
 */
import { ApiError, getJson, post } from './api.ts';
import { $, h, replace, typing } from './dom.ts';
import { stageBlockers } from './logic.ts';
import {
  STAGES, STAGE_SHORT, STAGE_TITLES, type FaceBundle, type LedgerFile, type PandCandidates, type PhotoCandidate, type PicksFile,
  type EditsFile, type GroupingFile, type MarksFile, type Pin, type PinsFile, type Stage, type StateAction, type StateFile,
} from './types.ts';
import { basePand, dividerFits, dividersOf, expandDescription, expandFace, houseLabels, housesFromDividers } from './houses.ts';
import { go as goStage, keys2, keys3, keys4, renderStage2, renderStage3, renderStage4, type Catalogue, type Derived, type FaceCtx, type RenderInfo, type RowInfo } from './stages.ts';

const KEYS = ['1', '2', '3', '4', '5', '6'];
const pct = (n: number, d: number) => d ? `${Math.round(100 * n / d)}%` : '–';
const fmtMin = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export async function mountFace(root: HTMLElement, faceId: string): Promise<void> {
  let b = await getJson<FaceBundle>(`/faces/${encodeURIComponent(faceId)}`);
  // `?stage=N` reopens the page on a confirmed earlier stage (read-only); the URL follows the stage on view.
  const asked = Number(new URLSearchParams(location.search).get('stage'));
  let view: Stage = (STAGES as readonly number[]).includes(asked) && asked <= b.state.stage ? asked as Stage : b.state.stage;
  let current = 0;
  let zoom: { pandId: string; candidateId: string } | null = null;
  const status = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const say = (text: string, kind: 'ok' | 'err' | '' = '') => { status.textContent = text; status.className = `status ${kind}`; };
  const fail = (e: unknown) => {
    const err = e as ApiError;
    say(err.status === 409 ? `${err.message} (press Shift+R to reload)` : err.status === 403 ? err.message : `Save failed: ${err.message}`, 'err');
  };

  // ------------------------------------------------------------------------------------------------- activity timer
  // Active = the tab is visible and there was input in the last 60 s. Posted every 30 s and on leaving.
  let lastInput = Date.now(), pending = 0, shown = b.ledger.david.activeSeconds;
  // Seconds per house in view (stages 2–4), posted with the activity for the ledger's minutes per house.
  let pendingByHouse: Record<string, number> = {};
  let houseInView: () => string | null = () => null;
  const timer = h('span', { class: 'timer', title: 'Your active minutes on this block (ledger)' });
  for (const ev of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'scroll']) addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true });
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastInput < 60_000) {
      pending += 1; shown += 1; timer.textContent = `${fmtMin(shown)} active`;
      const hid = houseInView(); if (hid) pendingByHouse[hid] = (pendingByHouse[hid] ?? 0) + 1;
    }
  }, 1000);
  const flushActivity = (keepalive = false) => {
    if (pending < 1) return;
    const seconds = Math.min(pending, 120); pending -= seconds;
    const byHouse = pendingByHouse; pendingByHouse = {};
    post<{ ledger: LedgerFile }>(`/faces/${faceId}/activity`, b.token, { seconds, stage: b.state.stage, byHouse }, { keepalive })
      .then(r => { b.ledger = r.ledger; }).catch(() => { pending += seconds; });
  };
  setInterval(flushActivity, 30_000);
  addEventListener('pagehide', () => flushActivity(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushActivity(true); });

  // ------------------------------------------------------------------------------------------------------- helpers
  const pands = () => b.face.pands;
  const cands = (pandId: string): PandCandidates | undefined => b.candidates?.pands.find(p => p.pandId === pandId);
  const imgUrl = (pandId: string, c: PhotoCandidate) => `/api/belt-review/faces/${faceId}/image/${pandId}/${encodeURIComponent(c.id)}`;
  const editable = (stage: Stage) => b.state.status !== 'accepted' && stage === b.state.stage;

  let derived: Derived | null = null, catalogue: Catalogue | null = null;
  const renders = new Map<string, Promise<RenderInfo>>();
  let row: { key: string; p: Promise<RowInfo> } | null = null;
  const refreshDerived = async () => { derived = await getJson<Derived>(`/faces/${encodeURIComponent(faceId)}/derived`); };
  await Promise.all([refreshDerived().catch(() => {}), getJson<Catalogue>('/kit-catalogue').then(c => { catalogue = c; }).catch(() => {})]);

  async function reload() {
    b = await getJson<FaceBundle>(`/faces/${encodeURIComponent(faceId)}`);
    await refreshDerived();
    say('Reloaded from disk', 'ok'); render();
  }
  /** Save a doc write, take the new doc and ledger, re-derive the drawn fields, re-render the stage. */
  async function saveAnd<T>(path: string, body: () => unknown, apply: (doc: T) => void, ok: string) {
    try {
      const r = await post<{ doc: T; ledger: LedgerFile }>(path, b.token, body);
      apply(r.doc); b.ledger = r.ledger;
      await refreshDerived();
      say(ok, 'ok'); render();
    } catch (e) { fail(e); }
  }
  const pandPhoto = (houseId: string): PhotoCandidate | null => {
    const pandId = basePand(houseId), entry = cands(pandId), id = b.picks.picks[pandId] ? b.picks.picks[pandId].candidateId : entry?.autoPick;
    return id ? entry?.candidates.find(c => c.id === id) ?? null : null;
  };
  /** Stages 2–4 review houses: the bundle with split pands expanded (houses.ts), recomputed when the picks change. */
  let houses: { key: unknown; b: FaceBundle } | null = null;
  const houseBundle = (): FaceBundle => {
    if (houses?.key !== b.picks || houses.b.edits !== b.edits || houses.b.grouping !== b.grouping || houses.b.pins !== b.pins || houses.b.marks !== b.marks || houses.b.state !== b.state || houses.b.ledger !== b.ledger) {
      const face = expandFace(b.face, b.picks);
      houses = { key: b.picks, b: { ...b, face: face as FaceBundle['face'], description: expandDescription(b.description, face) } };
    }
    return houses.b;
  };
  const ctx: FaceCtx = {
    faceId, main: null as unknown as HTMLElement,
    get b() { return view === 1 ? b : houseBundle(); }, get derived() { return derived; }, get catalogue() { return catalogue; },
    get current() { return current; }, set current(i: number) { current = i; },
    editable, say, render: () => render(), pandStrip: () => pandStrip(),
    // The server crops the picked photo to the house (facade span, split slice, else the BAG span) at its own px/m.
    photoUrl: (houseId: string) => pandPhoto(houseId) ? `/api/belt-review/faces/${faceId}/photo/${encodeURIComponent(houseId)}.jpg?r=${b.picks.revision}` : null,
    photoPxPerM: (pandId: string) => pandPhoto(pandId)?.pxPerM ?? 50,
    saveEdits: (pandId, fields) => saveAnd<EditsFile>(`/faces/${faceId}/edits/${pandId}`, () => ({ expectedRevision: b.edits.edits[pandId]?.revision ?? 0, value: { fields } }), d => { b.edits = d; }, 'Saved; re-rendering'),
    saveGrouping: value => saveAnd<GroupingFile>(`/faces/${faceId}/grouping`, () => ({ expectedRevision: b.grouping.revision, value }), d => { b.grouping = d; }, 'Grouping saved'),
    saveMark: (houseId, value) => saveAnd<MarksFile>(`/faces/${faceId}/marks/${encodeURIComponent(houseId)}`, () => ({ expectedRevision: b.marks.marks[houseId]?.revision ?? 0, value }), d => { b.marks = d; }, value.mark === 'wrong' ? 'Marked wrong: pick what is most wrong (1–8)' : `Marked ${value.mark === 'good' ? 'good' : "can't tell"}`),
    savePin: (pin: Partial<Pin> & { id: string }) => saveAnd<PinsFile>(`/faces/${faceId}/pins/${encodeURIComponent(pin.id)}`, () => ({ expectedRevision: b.pins.pins[pin.id]?.revision ?? 0, value: pin }), d => { b.pins = d; }, 'Pin saved'),
    renderInfo: (pandId: string) => {
      const key = `${pandId}:${derived?.pands[pandId]?.hash ?? ''}`;
      if (!renders.has(key)) renders.set(key, getJson<RenderInfo>(`/faces/${faceId}/render/${pandId}.json`));
      return renders.get(key)!;
    },
    rowInfo: () => {
      const key = JSON.stringify([Object.values(derived?.pands ?? {}).map(p => p.hash), b.picks.revision]);
      if (row?.key !== key) row = { key, p: getJson<RowInfo>(`/faces/${faceId}/row.json`) };
      return row.p;
    },
  };
  async function stateAction(action: StateAction, stage?: Stage) {
    try {
      const r = await post<{ doc: StateFile; ledger: LedgerFile }>(`/faces/${faceId}/state`, b.token, () => ({ expectedRevision: b.state.revision, action, stage }));
      b.state = r.doc; b.ledger = r.ledger; view = b.state.stage;
      say(action === 'send-to-claude' ? 'Sent to Claude. The integrator picks it up from state.json.' : action === 'confirm-stage' ? `Stage ${r.doc.stage - 1} confirmed` : 'Saved', 'ok');
      render();
    } catch (e) { fail(e); }
  }
  async function pick(pandId: string, candidateId: string | null) {
    if (!editable(1)) { say(b.state.stage > 1 ? 'Stage 1 is confirmed. Reopen it to change a pick.' : 'The block is accepted.', 'err'); return; }
    try {
      const r = await post<{ doc: PicksFile; ledger: LedgerFile }>(`/faces/${faceId}/picks/${pandId}`, b.token, () => ({ expectedRevision: b.picks.picks[pandId]?.revision ?? 0, value: { candidateId } }));
      b.picks = r.doc; b.ledger = r.ledger;
      say(candidateId === null ? 'Marked none usable' : 'Saved', 'ok');
      const next = pands().findIndex((p, i) => i > current && !b.picks.picks[p.pandId]);
      if (next >= 0) current = next; else if (current < pands().length - 1 && !pands().some(p => !b.picks.picks[p.pandId])) current += 1;
      render();
    } catch (e) { fail(e); }
  }

  // ------------------------------------------------------------------------------------------------------- render
  const header = h('header', { class: 'bar' });
  const main = h('main', { class: 'face' });
  const footer = h('footer', { class: 'bar foot' });
  const overlay = h('div', { class: 'zoom', hidden: true });
  replace(root, header, main, footer, overlay);
  (ctx as { main: HTMLElement }).main = main;
  houseInView = () => view === 2 ? houseBundle().face.pands[current]?.pandId ?? null : null;

  function renderHeader() {
    const st = b.state;
    const steps = STAGES.map(s => {
      const done = !!st.confirmed[String(s)], open = s === st.stage && st.status !== 'accepted', locked = s > st.stage;
      return h('button', { class: `step${s === view ? ' on' : ''}${done ? ' done' : ''}${open ? ' open' : ''}`, disabled: locked, title: STAGE_TITLES[s], onclick: () => { view = s; render(); } },
        h('b', {}, String(s)), ' ', h('span', { class: 'step-t' }, STAGE_SHORT[s]));
    });
    timer.textContent = `${fmtMin(shown)} active`;
    replace(header,
      h('a', { href: '?', class: 'home', title: 'All blocks' }, 'Belt review'),
      h('div', { class: 'title' }, h('strong', {}, `${b.face.street}`), ` ${b.face.side} · ${b.face.pands.length} houses`, b.face.fixture ? h('span', { class: 'tag warn' }, 'fixture') : null),
      h('nav', { class: 'steps', 'aria-label': 'Stages' }, ...steps),
      h('span', { class: `pill ${st.status}` }, st.status === 'with-claude' ? 'With Claude' : st.status === 'accepted' ? 'Accepted' : 'With you'),
      timer,
      h('button', { class: 'ghost', disabled: true, title: 'Opens the block in the game at a first-person pose (wired by the integrator, plan R8)' }, 'Open in game'),
      h('button', { class: 'primary', disabled: st.status !== 'with-david', onclick: () => stateAction('send-to-claude'), title: 'Hand the block to Claude (writes state.json status with-claude)' }, 'Send to Claude'),
    );
  }

  // ------------------------------------------------------------------------------------------- facade span + split
  // On a candidate with `pandSpanPx` (lane B crops a margin each side of the BAG front), dashed amber lines mark the BAG
  // span and the margin is dimmed. On the picked one David drags the facade edges to where the facade really starts and
  // ends, and D adds a divider at the cursor to split a pand BAG lumps together into separate houses.
  type Sel = 'L' | 'R' | number;
  let spanDraft: { pandId: string; candId: string; px: [number, number]; dividersPx: number[]; labels: Array<string | undefined> } | null = null;
  let selEdge: Sel = 'L', cursorPx: number | null = null, suppressClick = false, spanTimer: ReturnType<typeof setTimeout> | undefined;

  const ppmOf = (c: PhotoCandidate) => c.pxPerM ?? 50;
  const toM = (c: PhotoCandidate, x: number) => (x - c.pandSpanPx![0]) / ppmOf(c);
  const toPx = (c: PhotoCandidate, m: number) => c.pandSpanPx![0] + m * ppmOf(c);
  /** The draft for the picked candidate of `pandId`, from its pick (facade span and houses in metres, so it survives a re-crop). */
  function draftFor(pandId: string, c: PhotoCandidate) {
    if (spanDraft?.pandId === pandId && spanDraft.candId === c.id) return spanDraft;
    const pk = b.picks.picks[pandId];
    const px: [number, number] = pk?.facadeSpanM ? [toPx(c, pk.facadeSpanM[0]), toPx(c, pk.facadeSpanM[1])] : [...c.pandSpanPx!];
    spanDraft = { pandId, candId: c.id, px, dividersPx: dividersOf(pk?.houses).map(m => toPx(c, m)), labels: (pk?.houses ?? []).map(x => x.label) };
    return spanDraft;
  }
  async function saveSpan(pandId: string, c: PhotoCandidate) {
    if (!editable(1) || !spanDraft) return;
    const d = spanDraft, atBag = Math.abs(d.px[0] - c.pandSpanPx![0]) < 0.5 && Math.abs(d.px[1] - c.pandSpanPx![1]) < 0.5;
    const spanM: [number, number] = [toM(c, d.px[0]), toM(c, d.px[1])];
    const hs = d.dividersPx.length ? housesFromDividers(spanM, d.dividersPx.map(x => toM(c, x)), d.labels) : null;
    try {
      const r = await post<{ doc: PicksFile; ledger: LedgerFile }>(`/faces/${faceId}/picks/${pandId}`, b.token, () => ({ expectedRevision: b.picks.picks[pandId]?.revision ?? 0, value: { candidateId: c.id, facadeSpanPx: atBag ? null : d.px.map(v => Math.round(v * 100) / 100), houses: hs } }));
      b.picks = r.doc; b.ledger = r.ledger;
      say(hs ? `Saved: ${hs.length} houses` : atBag ? 'Saved: BAG span' : `Saved: facade ${spanM[0].toFixed(2)} to ${spanM[1].toFixed(2)} m`, 'ok');
      renderFooter(); renderStripOnly();
    } catch (e) { fail(e); spanDraft = null; render(); }
  }
  const saveSpanSoon = (pandId: string, c: PhotoCandidate) => { clearTimeout(spanTimer); spanTimer = setTimeout(() => void saveSpan(pandId, c), 400); };

  /** Fit the overlay layer onto the image's contained (object-fit) box. */
  function fitLayer(img: HTMLImageElement, layer: HTMLElement) {
    const bw = img.clientWidth, bh = img.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh || !bw) return;
    const k = Math.min(bw / nw, bh / nh), w = nw * k, hh = nh * k;
    Object.assign(layer.style, { left: `${img.offsetLeft + (bw - w) / 2}px`, top: `${img.offsetTop + (bh - hh) / 2}px`, width: `${w}px`, height: `${hh}px` });
  }
  const fits = new ResizeObserver(entries => { for (const e of entries) { const img = e.target as HTMLImageElement, layer = img.parentElement?.querySelector<HTMLElement>('.spanlayer'); if (layer) fitLayer(img, layer); } });

  function spanLayer(pandId: string, c: PhotoCandidate, chosen: boolean, img: HTMLImageElement): HTMLElement | null {
    if (!c.pandSpanPx) return null;
    const layer = h('div', { class: `spanlayer${chosen && editable(1) ? ' live' : ''}` });
    const W = () => c.widthPx ?? img.naturalWidth ?? 1;
    const pctX = (x: number) => `${(100 * x / W()).toFixed(3)}%`;
    function draw() {
      const d = chosen ? draftFor(pandId, c) : null, span = d?.px ?? b.picks.picks[pandId]?.facadeSpanPx ?? c.pandSpanPx!;
      const kids: HTMLElement[] = [
        h('div', { class: 'dim', style: `left:0;width:${pctX(Math.max(0, span[0]))}` }),
        h('div', { class: 'dim', style: `left:${pctX(span[1])};right:0` }),
        h('div', { class: 'bagline', style: `left:${pctX(c.pandSpanPx![0])}`, title: 'BAG front starts' }),
        h('div', { class: 'bagline', style: `left:${pctX(c.pandSpanPx![1])}`, title: 'BAG front ends' }),
      ];
      if (d) {
        const edge = (sel: Sel, x: number, title: string, cls: string) => {
          const el = h('div', { class: `${cls}${selEdge === sel ? ' sel' : ''}`, style: `left:${pctX(x)}`, title, 'data-sel': String(sel) });
          el.addEventListener('pointerdown', e => startDrag(e as PointerEvent, sel));
          return el;
        };
        kids.push(edge('L', d.px[0], 'Facade starts: drag, or select and [ / ] by 0.25 m', 'edge'), edge('R', d.px[1], 'Facade ends: drag, or select and [ / ] by 0.25 m', 'edge'));
        d.dividersPx.forEach((x, i) => kids.push(edge(i, x, 'House divider: drag, [ / ] nudge, Delete removes', 'divider')));
        if (d.dividersPx.length) {
          const cuts = [d.px[0], ...[...d.dividersPx].sort((a, z) => a - z), d.px[1]];
          cuts.slice(1).forEach((x1, i) => kids.push(h('span', { class: 'houselabel', style: `left:${pctX(cuts[i])};width:${pctX(x1 - cuts[i])}` }, d.labels[i] ?? `house ${i + 1}`)));
        }
      }
      replace(layer, ...kids);
    }
    function startDrag(e: PointerEvent, sel: Sel) {
      e.preventDefault(); e.stopPropagation(); suppressClick = true;
      selEdge = sel; draw();
      // Window listeners: draw() replaces the handle elements while dragging, so the pressed one leaves the DOM.
      const d = draftFor(pandId, c), r = layer.getBoundingClientRect();
      const move = (ev: PointerEvent) => {
        const x = Math.max(0, Math.min(W(), (ev.clientX - r.left) / r.width * W()));
        if (sel === 'L') d.px[0] = Math.min(x, d.px[1] - ppmOf(c)); else if (sel === 'R') d.px[1] = Math.max(x, d.px[0] + ppmOf(c)); else d.dividersPx[sel] = x;
        draw();
      };
      const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); void saveSpan(pandId, c); };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    }
    layer.addEventListener('pointermove', e => { const r = layer.getBoundingClientRect(); cursorPx = (e.clientX - r.left) / r.width * W(); });
    layer.addEventListener('pointerleave', () => { cursorPx = null; });
    (layer as HTMLElement & { redraw?: () => void }).redraw = draw;
    draw();
    return layer;
  }

  /** Stage 1 keys on the picked candidate: D divider at the cursor, Delete removes the selected divider, [ ] nudge 0.25 m. */
  function spanKey(k: string): boolean {
    const p = pands()[current], pk = p && b.picks.picks[p.pandId];
    const c = pk?.candidateId ? cands(p.pandId)?.candidates.find(x => x.id === pk.candidateId) : undefined;
    if (!p || !c || !['d', 'D', '[', ']', 'Delete', 'Backspace'].includes(k)) return false;
    if (!c.pandSpanPx) { say('This photo has no BAG span to correct (older candidates)', 'err'); return true; }
    if (!editable(1)) { say('Stage 1 is confirmed. Reopen it to change the facade.', 'err'); return true; }
    const d = draftFor(p.pandId, c), ppm = ppmOf(c);
    if (k === 'd' || k === 'D') {
      const at = cursorPx ?? (d.px[0] + d.px[1]) / 2, spanM: [number, number] = [toM(c, d.px[0]), toM(c, d.px[1])];
      if (!dividerFits(spanM, d.dividersPx.map(x => toM(c, x)), toM(c, at))) { say('A divider needs 1 m to the facade edges and to other dividers', 'err'); return true; }
      const defaults = houseLabels(p, d.dividersPx.length + 1);
      d.dividersPx.push(at);
      // Labels: the pand's numbers in order when the house count matches them; typed labels are kept.
      const fresh = houseLabels(p, d.dividersPx.length + 1);
      d.labels = d.labels.every((l, i) => l === undefined || l === defaults[i]) ? fresh : [...d.labels, undefined];
      d.dividersPx.sort((a, z) => a - z);
      selEdge = d.dividersPx.indexOf(at);
    } else if (k === 'Delete' || k === 'Backspace') {
      if (typeof selEdge !== 'number') return false;
      d.dividersPx.splice(selEdge, 1); d.labels.splice(selEdge + 1, 1);
      if (d.labels.every(l => l === undefined) || d.dividersPx.length === 0) d.labels = houseLabels(p, d.dividersPx.length + 1);
      selEdge = 'L';
    } else {
      const step = (k === '[' ? -0.25 : 0.25) * ppm;
      if (selEdge === 'L') d.px[0] = Math.min(d.px[0] + step, d.px[1] - ppm);
      else if (selEdge === 'R') d.px[1] = Math.max(d.px[1] + step, d.px[0] + ppm);
      else d.dividersPx[selEdge] += step;
    }
    for (const l of main.querySelectorAll<HTMLElement & { redraw?: () => void }>('.cand.chosen .spanlayer')) l.redraw?.();
    renderLabels();
    if (k === '[' || k === ']') saveSpanSoon(p.pandId, c); else void saveSpan(p.pandId, c);
    return true;
  }
  /** Label boxes under the picked photo when the pand is split (blank when the numbers do not match the house count). */
  const labelBox = h('div', { class: 'houselabels' });
  function renderLabels() {
    const p = pands()[current], d = spanDraft;
    if (!p || !d || d.pandId !== p.pandId || !d.dividersPx.length) { replace(labelBox); return; }
    const c = cands(p.pandId)?.candidates.find(x => x.id === d.candId);
    replace(labelBox, h('span', { class: 'muted small' }, 'Split into houses:'), ...Array.from({ length: d.dividersPx.length + 1 }, (_, i) => {
      const input = h('input', { value: d.labels[i] ?? '', placeholder: `house ${i + 1} number`, 'aria-label': `House ${i + 1} number`, size: 8, disabled: !editable(1) }) as HTMLInputElement;
      input.addEventListener('change', () => { d.labels[i] = input.value.trim() || undefined; if (c) void saveSpan(p.pandId, c); });
      input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') input.blur(); });
      return input;
    }));
  }
  async function openPanorama() {
    const p = pands()[current];
    if (!p) return;
    const w = open('about:blank', '_blank');
    try {
      const link = await getJson<{ url: string; from: string }>(`/faces/${faceId}/pano-link/${p.pandId}`);
      if (w) w.location.href = link.url; else open(link.url, '_blank', 'noopener');
      say(link.from === 'camera' ? 'Opened the city panorama at the photo\'s camera' : 'Opened the city panorama in front of the house', 'ok');
    } catch (e) { w?.close(); say(`No panorama link: ${(e as Error).message}`, 'err'); }
  }

  function candidateCard(pandId: string, c: PhotoCandidate, i: number, entry: PandCandidates) {
    const chosen = b.picks.picks[pandId]?.candidateId === c.id, auto = entry.autoPick === c.id;
    const date = c.month ? `${c.year}-${String(c.month).padStart(2, '0')}` : String(c.year);
    const img = h('img', { src: imgUrl(pandId, c), alt: `${date} ${c.source}`, loading: 'eager', decoding: 'async', draggable: 'false' }) as HTMLImageElement;
    const layer = spanLayer(pandId, c, chosen, img);
    if (layer) { img.addEventListener('load', () => { fitLayer(img, layer); (layer as HTMLElement & { redraw?: () => void }).redraw?.(); }); fits.observe(img); }
    const span = b.picks.picks[pandId];
    const spanNote = chosen && c.pandSpanPx && (span?.facadeSpanM || span?.houses) ? h('div', { class: 'meta-2 spanmeta' },
      span.facadeSpanM ? `facade ${span.facadeSpanM[0].toFixed(2)} to ${span.facadeSpanM[1].toFixed(2)} m from the BAG start` : null,
      span.houses ? ` · ${span.houses.length} houses` : null) : null;
    return h('figure', { class: `cand${chosen ? ' chosen' : ''}${c.source === 'strip' ? ' strip' : ''}`, 'data-cand': c.id },
      // A div, not a button: the facade edges inside it are dragged, and a button's content is not a reliable drag target.
      h('div', { class: 'cand-img', role: 'button', tabindex: 0, title: `Pick ${KEYS[i]} (double-click or Z to zoom)`, onclick: () => { if (suppressClick) { suppressClick = false; return; } if (chosen && c.pandSpanPx && editable(1)) return; void pick(pandId, c.id); }, onkeydown: (e: Event) => { if ((e as KeyboardEvent).key === ' ') { e.preventDefault(); void pick(pandId, c.id); } }, ondblclick: () => { zoom = { pandId, candidateId: c.id }; renderZoom(); } },
        img, layer,
        h('span', { class: 'key' }, KEYS[i]),
        auto ? h('span', { class: 'auto' }, 'auto pick') : null,
        chosen ? h('span', { class: 'chosen-mark' }, 'chosen') : null),
      h('figcaption', {},
        h('div', { class: 'meta-1' }, h('strong', {}, date), ' ', c.source === 'strip' ? h('span', { class: 'tag warn', title: 'Slice of the block-face strip: weaker evidence' }, 'strip') : h('span', { class: 'tag' }, 'wall'),
          c.judge ? h('span', { class: 'tag', title: `judge ${c.judge.by ?? ''}` }, `judge ${c.judge.score.toFixed(2)}${c.judge.verdict ? ` ${c.judge.verdict}` : ''}`) : null),
        h('div', { class: 'meta-2' }, [c.distM !== null ? `${c.distM.toFixed(0)} m away` : null, c.obliquityDeg !== null ? `${c.obliquityDeg.toFixed(0)}° off square` : null, c.pxPerM ? `${c.pxPerM} px/m` : null, c.marginM ? `margin ${c.marginM} m` : null, `pano ${c.pano.date}`].filter(Boolean).join(' · ')),
        spanNote,
        c.flags.length ? h('div', { class: 'flags' }, ...c.flags.map(f => h('span', { class: 'tag bad' }, f))) : h('div', { class: 'flags clean' }, 'no flags'),
        c.note ? h('div', { class: 'meta-2' }, c.note) : null));
  }

  let stripEl: HTMLElement | null = null;
  function renderStripOnly() { if (stripEl?.isConnected) { const n = pandStrip(); stripEl.replaceWith(n); } }
  function pandStrip() {
    if (view !== 1) {
      const hb = houseBundle();
      return h('ol', { class: 'pands', 'aria-label': 'Houses on this block' }, ...hb.face.pands.map((p, i) =>
        h('li', {}, h('button', { class: `pand agree${i === current ? ' cur' : ''}${p.pandId.includes('#') ? ' split' : ''}`, onclick: () => { current = i; render(); }, title: p.pandId.includes('#') ? `Split from pand ${basePand(p.pandId)} in stage 1` : `pand ${p.pandId}` },
          h('span', { class: 'addr' }, p.address), h('span', { class: 'mk' }, p.pandId.includes('#') ? 'split' : '')))));
    }
    stripEl = h('ol', { class: 'pands', 'aria-label': 'Houses on this block' }, ...pands().map((p, i) => {
      const pk = b.picks.picks[p.pandId], multi = (p.numbers?.length ?? 0) > 1;
      const mark = !pk ? 'open' : pk.candidateId === null ? 'none' : pk.candidateId === pk.autoPick ? 'agree' : 'override';
      return h('li', {}, h('button', { class: `pand ${mark}${i === current ? ' cur' : ''}`, onclick: () => { current = i; render(); }, title: mark === 'open' ? 'No pick yet' : mark === 'none' ? 'None usable' : mark === 'agree' ? 'Agreed with the auto pick' : 'Picked another photo' },
        h('span', { class: 'addr' }, p.address, multi ? h('span', { class: 'addrs', title: `BAG lists ${p.numbers!.join(', ')} on one pand: check whether these are separate houses (D splits)` }, `${p.numbers!.length} addresses`) : null),
        h('span', { class: 'mk' }, mark === 'open' ? '·' : mark === 'none' ? 'none' : mark === 'agree' ? 'auto' : 'own', pk?.houses ? ` · ${pk.houses.length} houses` : '', pk?.facadeSpanM ? ' · span' : '')));
    }));
    return stripEl;
  }

  function renderStage1() {
    const p = pands()[current];
    if (!p) { replace(main, h('p', { class: 'empty' }, 'This face has no houses.')); return; }
    const entry = cands(p.pandId);
    const pk = b.picks.picks[p.pandId];
    const lockedNote = !editable(1) ? h('p', { class: 'locked' }, b.state.status === 'accepted' ? 'The block is accepted; picks are read-only.' : 'Stage 1 is confirmed; picks are read-only. ', b.state.status !== 'accepted' ? h('button', { onclick: () => stateAction('reopen-stage', 1) }, 'Reopen stage 1') : null) : null;
    const head = h('div', { class: 'pand-head' },
      h('button', { class: 'nav', onclick: () => go(-1), disabled: current === 0, title: 'Previous house (K or ←)' }, '‹'),
      h('h2', {}, p.address, h('small', {}, ` ${current + 1} of ${pands().length} · pand ${p.pandId}`)),
      h('button', { class: 'nav', onclick: () => go(1), disabled: current === pands().length - 1, title: 'Next house (J or →)' }, '›'),
      h('button', { class: `none${pk && pk.candidateId === null ? ' chosen' : ''}`, onclick: () => pick(p.pandId, null), title: 'None of these photos is usable (0 or X)' }, h('span', { class: 'key' }, '0'), ' None usable'),
      h('button', { class: 'ghost', onclick: () => void openPanorama(), title: 'Open the city panorama viewer at this house in a new tab (O)' }, h('span', { class: 'key' }, 'O'), ' City panorama'));
    const grid = !entry || !entry.candidates.length
      ? h('p', { class: 'empty' }, b.candidates ? 'No photo candidates for this house. Mark it none usable (0).' : 'No candidates.json for this face yet (lane B writes it).')
      : h('div', { class: 'cands', style: `--n:${entry.candidates.length}` }, ...entry.candidates.slice(0, 6).map((c, i) => candidateCard(p.pandId, c, i, entry)));
    const keys = h('p', { id: 'keys', class: 'muted small' }, '1–6 pick · 0 none usable · on the picked photo: drag the facade edges, D split at the cursor, [ ] nudge the selected line 0.25 m, Delete removes a divider · O city panorama · J/K next/previous house · Z or double-click zoom · Enter confirm stage · Shift+R reload · ? hide keys');
    if (spanDraft && spanDraft.pandId !== p.pandId) spanDraft = null;
    replace(main, pandStrip(), lockedNote, head, grid, labelBox, keys);
    renderLabels();
  }

  function renderFooter() {
    const hashes = derived ? Object.fromEntries(Object.entries(derived.pands).map(([k, v]) => [k, v.hash])) : undefined;
    const st = b.state, blockers = stageBlockers(view, { face: b.face, picks: b.picks, pins: b.pins, marks: b.marks, houses: houseBundle().face.pands.map(p => p.pandId), hashes });
    const l = b.ledger;
    const ledger = h('span', { class: 'ledger', title: `Fields from the library ${l.fields.fromLibrary}, needing a new read ${l.fields.fromNewRead}, edited ${l.fields.edited}; failures per stage ${JSON.stringify(l.stageFailures)}` },
      view === 1 ? `Picks ${l.photos.picked}/${l.photos.pands} · agreed with auto ${pct(l.photos.agreedWithAuto, l.photos.picked)} · none usable ${l.photos.noneUsable} · facade span corrected ${l.photos.spanCorrected ?? 0} · BAG pand split ${l.photos.pandSplits ?? 0} · passes ${l.passes}`
      : view === 2 ? `Marks G ${l.marks?.now.good ?? 0} · W ${l.marks?.now.wrong ?? 0} · ? ${l.marks?.now.unsure ?? 0} · pins ${l.pins.total} · ${fmtMin(Object.values(l.david.byHouse ?? {}).reduce((n, v) => n + v, 0))} on houses · passes ${l.passes}`
      : view === 3 ? `Grouping changes ${l.stageFailures['3'] ?? 0} · passes ${l.passes}`
      : `Pins ${l.pins.total} (${l.pins.open} open) · passes ${l.passes}`);
    const confirm = view === 4
      ? h('button', { class: 'primary', disabled: !editable(4) || blockers.length > 0, onclick: () => stateAction('accept') }, 'Accept block')
      : h('button', { class: 'primary', disabled: !editable(view) || blockers.length > 0, onclick: () => stateAction('confirm-stage', view), title: 'Enter' }, `Confirm stage ${view}`);
    replace(footer, ledger, status, blockers.length && editable(view) ? h('span', { class: 'blockers' }, blockers.join('; ')) : null,
      st.status === 'accepted' ? h('button', { onclick: () => stateAction('reopen-block') }, 'Reopen block') : null,
      st.status === 'with-claude' ? h('button', { onclick: () => stateAction('return-to-david'), title: 'Take the block back without waiting for Claude' }, 'Take back') : null,
      confirm);
  }

  function renderZoom() {
    if (!zoom) { overlay.hidden = true; replace(overlay); return; }
    const c = cands(zoom.pandId)?.candidates.find(k => k.id === zoom!.candidateId);
    if (!c) { zoom = null; renderZoom(); return; }
    overlay.hidden = false;
    replace(overlay, h('button', { class: 'zoom-close', onclick: () => { zoom = null; renderZoom(); }, title: 'Close (Esc or Z)' }, 'Close'),
      h('img', { src: imgUrl(zoom.pandId, c), alt: 'zoomed candidate' }));
  }

  function render() {
    const u = new URL(location.href);
    if (u.searchParams.get('stage') !== String(view)) { u.searchParams.set('stage', String(view)); history.replaceState(null, '', u); }
    renderHeader();
    main.className = `face stage-${view}`;
    if (view === 1) renderStage1(); else if (view === 2) renderStage2(ctx); else if (view === 3) renderStage3(ctx); else renderStage4(ctx);
    renderFooter();
    renderZoom();
  }
  const go = (d: number) => { current = Math.max(0, Math.min(pands().length - 1, current + d)); render(); };

  addEventListener('keydown', e => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape' && zoom) { zoom = null; renderZoom(); return; }
    if (k === 'Escape' && view === 3) { keys3(k); return; }
    if (k === 'R' && e.shiftKey) { e.preventDefault(); void reload(); return; }
    if (view === 2 && keys2(ctx, k)) { e.preventDefault(); return; }
    if (view === 3 && k !== 'Enter' && keys3(k)) { e.preventDefault(); return; }
    if (k === '?') { $('#keys')?.toggleAttribute('hidden'); return; }
    if (k === 'Enter' && !zoom) {
      if (view === 4) void stateAction('accept'); else void stateAction('confirm-stage', view);
      return;
    }
    if (view === 3 && keys3(k)) { e.preventDefault(); return; }
    if (view === 4 && keys4(ctx, k)) { e.preventDefault(); return; }
    if (view !== 1) {
      if (view !== 3 && (k === 'j' || k === 'ArrowRight')) { e.preventDefault(); goStage(ctx, 1); }
      else if (view !== 3 && (k === 'k' || k === 'ArrowLeft')) { e.preventDefault(); goStage(ctx, -1); }
      return;
    }
    if (spanKey(k)) { e.preventDefault(); return; }
    const p = pands()[current], entry = p && cands(p.pandId);
    if (k === 'o') { e.preventDefault(); void openPanorama(); return; }
    if (k === 'j' || k === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (k === 'k' || k === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if ((k === '0' || k === 'x') && p) void pick(p.pandId, null);
    else if (KEYS.includes(k) && entry) { const c = entry.candidates[Number(k) - 1]; if (c) void pick(p.pandId, c.id); }
    else if (k === 'z' && p && entry) {
      if (zoom) zoom = null;
      else { const id = b.picks.picks[p.pandId]?.candidateId ?? entry.autoPick ?? entry.candidates[0]?.id; if (id) zoom = { pandId: p.pandId, candidateId: id }; }
      renderZoom();
    }
  });

  // Start at the first house without a pick.
  const firstOpen = pands().findIndex(p => !b.picks.picks[p.pandId]);
  current = firstOpen >= 0 ? firstOpen : 0;
  render();
}
