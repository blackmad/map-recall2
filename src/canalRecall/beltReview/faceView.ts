/**
 * Belt review page, one block face: the four checks in order. Stage 1 (photo pick) is live; stages 2–4 open after it and
 * are filled in by milestone M2 (description fields, grouping, render + pins).
 *
 * Keys (stage 1): 1–6 pick a candidate, 0 or X none usable, J / → next house, K / ← previous house, Z zoom the selected
 * photo, Enter confirm the stage once every house has a pick, ? help. Space flips photo/pick in the zoom.
 */
import { ApiError, getJson, post } from './api.ts';
import { $, h, replace, typing } from './dom.ts';
import { stageBlockers } from './logic.ts';
import {
  STAGES, STAGE_SHORT, STAGE_TITLES, type FaceBundle, type LedgerFile, type PandCandidates, type PhotoCandidate, type PicksFile,
  type Stage, type StateAction, type StateFile,
} from './types.ts';

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
  const timer = h('span', { class: 'timer', title: 'Your active minutes on this block (ledger)' });
  for (const ev of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'scroll']) addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true });
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastInput < 60_000) { pending += 1; shown += 1; timer.textContent = `${fmtMin(shown)} active`; }
  }, 1000);
  const flushActivity = (keepalive = false) => {
    if (pending < 1) return;
    const seconds = Math.min(pending, 120); pending -= seconds;
    post<{ ledger: LedgerFile }>(`/faces/${faceId}/activity`, b.token, { seconds, stage: b.state.stage }, { keepalive })
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

  async function reload() {
    b = await getJson<FaceBundle>(`/faces/${encodeURIComponent(faceId)}`);
    say('Reloaded from disk', 'ok'); render();
  }
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

  function candidateCard(pandId: string, c: PhotoCandidate, i: number, entry: PandCandidates) {
    const chosen = b.picks.picks[pandId]?.candidateId === c.id, auto = entry.autoPick === c.id;
    const date = c.month ? `${c.year}-${String(c.month).padStart(2, '0')}` : String(c.year);
    return h('figure', { class: `cand${chosen ? ' chosen' : ''}${c.source === 'strip' ? ' strip' : ''}`, 'data-cand': c.id },
      h('button', { class: 'cand-img', title: `Pick ${KEYS[i]} (double-click or Z to zoom)`, onclick: () => pick(pandId, c.id), ondblclick: () => { zoom = { pandId, candidateId: c.id }; renderZoom(); } },
        h('img', { src: imgUrl(pandId, c), alt: `${date} ${c.source}`, loading: 'eager', decoding: 'async' }),
        h('span', { class: 'key' }, KEYS[i]),
        auto ? h('span', { class: 'auto' }, 'auto pick') : null,
        chosen ? h('span', { class: 'chosen-mark' }, 'chosen') : null),
      h('figcaption', {},
        h('div', { class: 'meta-1' }, h('strong', {}, date), ' ', c.source === 'strip' ? h('span', { class: 'tag warn', title: 'Slice of the block-face strip: weaker evidence' }, 'strip') : h('span', { class: 'tag' }, 'wall'),
          c.judge ? h('span', { class: 'tag', title: `judge ${c.judge.by ?? ''}` }, `judge ${c.judge.score.toFixed(2)}${c.judge.verdict ? ` ${c.judge.verdict}` : ''}`) : null),
        h('div', { class: 'meta-2' }, [c.distM !== null ? `${c.distM.toFixed(0)} m away` : null, c.obliquityDeg !== null ? `${c.obliquityDeg.toFixed(0)}° off square` : null, c.pxPerM ? `${c.pxPerM} px/m` : null, `pano ${c.pano.date}`].filter(Boolean).join(' · ')),
        c.flags.length ? h('div', { class: 'flags' }, ...c.flags.map(f => h('span', { class: 'tag bad' }, f))) : h('div', { class: 'flags clean' }, 'no flags'),
        c.note ? h('div', { class: 'meta-2' }, c.note) : null));
  }

  function pandStrip() {
    return h('ol', { class: 'pands', 'aria-label': 'Houses on this block' }, ...pands().map((p, i) => {
      const pk = b.picks.picks[p.pandId];
      const mark = !pk ? 'open' : pk.candidateId === null ? 'none' : pk.candidateId === pk.autoPick ? 'agree' : 'override';
      return h('li', {}, h('button', { class: `pand ${mark}${i === current ? ' cur' : ''}`, onclick: () => { current = i; render(); }, title: mark === 'open' ? 'No pick yet' : mark === 'none' ? 'None usable' : mark === 'agree' ? 'Agreed with the auto pick' : 'Picked another photo' },
        h('span', { class: 'addr' }, p.address), h('span', { class: 'mk' }, mark === 'open' ? '·' : mark === 'none' ? 'none' : mark === 'agree' ? 'auto' : 'own')));
    }));
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
      h('button', { class: `none${pk && pk.candidateId === null ? ' chosen' : ''}`, onclick: () => pick(p.pandId, null), title: 'None of these photos is usable (0 or X)' }, h('span', { class: 'key' }, '0'), ' None usable'));
    const grid = !entry || !entry.candidates.length
      ? h('p', { class: 'empty' }, b.candidates ? 'No photo candidates for this house. Mark it none usable (0).' : 'No candidates.json for this face yet (lane B writes it).')
      : h('div', { class: 'cands', style: `--n:${entry.candidates.length}` }, ...entry.candidates.slice(0, 6).map((c, i) => candidateCard(p.pandId, c, i, entry)));
    const keys = h('p', { id: 'keys', class: 'muted small' }, '1–6 pick · 0 none usable · J/K next/previous house · Z or double-click zoom · Enter confirm stage · Shift+R reload · ? hide keys');
    replace(main, pandStrip(), lockedNote, head, grid, keys);
  }

  function renderLater(stage: Stage) {
    replace(main, h('section', { class: 'later' },
      h('h2', {}, `Stage ${stage}: ${STAGE_TITLES[stage]}`),
      h('p', {}, stage === 2 ? 'Description fields beside the chosen photo, each with its source; edit by choosing a kit value.' : stage === 3 ? 'The block as a row with design units and sameAs / based-on links: split, join, identical to, based on.' : 'The spec render beside the photo at one scale (Q/W/E/R flip, blink), kit gaps, and pins.'),
      h('p', { class: 'muted' }, 'This stage arrives in milestone M2. You can still confirm it to move the block along, or send it to Claude.')));
  }

  function renderFooter() {
    const st = b.state, blockers = stageBlockers(view, { face: b.face, picks: b.picks, pins: b.pins });
    const l = b.ledger;
    const ledger = h('span', { class: 'ledger' },
      `Picks ${l.photos.picked}/${l.photos.pands} · agreed with auto ${pct(l.photos.agreedWithAuto, l.photos.picked)} · none usable ${l.photos.noneUsable} · passes ${l.passes}`);
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
    if (view === 1) renderStage1(); else renderLater(view);
    renderFooter();
    renderZoom();
  }
  const go = (d: number) => { current = Math.max(0, Math.min(pands().length - 1, current + d)); render(); };

  addEventListener('keydown', e => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape' && zoom) { zoom = null; renderZoom(); return; }
    if (k === 'R' && e.shiftKey) { e.preventDefault(); void reload(); return; }
    if (k === '?') { $('#keys')?.toggleAttribute('hidden'); return; }
    if (k === 'Enter' && !zoom) {
      if (view === 4) void stateAction('accept'); else void stateAction('confirm-stage', view);
      return;
    }
    if (view !== 1) return;
    const p = pands()[current], entry = p && cands(p.pandId);
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
