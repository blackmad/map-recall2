/**
 * What's New, once per new build, as a one-line toast on the landing page
 * (G7, #277). Never inside the ride: only landing.html loads this bundle.
 *
 * "New build" means a build that carries a new What's New note: the toast
 * keys on the newest note (date + title), so a deploy with no new note stays
 * quiet instead of repeating last week's line. The key it showed (and the
 * deployment it came from, when deployment.json exists) is remembered in
 * localStorage; dismissing or following the link both count as seen. A first
 * visit records the current note without showing it: a newcomer has nothing
 * to compare against.
 */

export const WHATS_NEW_SEEN_KEY = 'canalRecall.whatsNewSeen.v1';
/** The ride sets this on load (siteLinks.ts RETURNING_PLAYER_KEY). */
export const RETURNING_KEY = 'canalRecall.returningPlayer.v1';

export interface WhatsNewNote { date: string; title: string }

export interface SeenRecord { note: string; build?: string | null }

export const noteKey = (note: WhatsNewNote): string => `${note.date}|${note.title}`;

export type ToastDecision = { show: false; record: SeenRecord | null } | { show: true; record: SeenRecord; note: WhatsNewNote };

/** Newest by date; notes are written newest first, ties keep file order. */
export function newestNote(notes: readonly WhatsNewNote[] | null | undefined): WhatsNewNote | null {
  let best: WhatsNewNote | null = null;
  for (const note of notes ?? []) {
    if (!note || typeof note.date !== 'string' || typeof note.title !== 'string' || !note.title.trim()) continue;
    if (!best || note.date > best.date) best = note;
  }
  return best;
}

export function decideToast(input: {
  notes: readonly WhatsNewNote[] | null | undefined;
  seen: SeenRecord | null;
  returning: boolean;
  build?: string | null;
}): ToastDecision {
  const note = newestNote(input.notes);
  if (!note) return { show: false, record: null };
  const record = { note: noteKey(note), build: input.build ?? null };
  if (input.seen?.note === record.note) return { show: false, record: null };
  if (!input.returning) return { show: false, record };
  return { show: true, record, note };
}

export function parseSeen(raw: string | null): SeenRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SeenRecord>;
    return typeof value?.note === 'string' ? { note: value.note, build: typeof value.build === 'string' ? value.build : null } : null;
  } catch {
    return null;
  }
}

const TOAST_CSS = `
.whats-new-toast { position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 50;
  display: flex; align-items: center; gap: 10px; max-width: min(640px, calc(100vw - 32px)); box-sizing: border-box; padding: 8px 8px 8px 14px;
  border-radius: 999px; background: #0b3a8c; color: #fff; font: 600 14px/1.3 system-ui, sans-serif; box-shadow: 0 6px 22px rgba(10,20,40,.28); }
.whats-new-toast-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.whats-new-toast-text b { font-weight: 800; letter-spacing: .04em; margin-right: 6px; }
.whats-new-toast a { flex: none; color: #fff; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
.whats-new-toast button { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 50%; background: rgba(255,255,255,.14); color: #fff; font: 700 18px/1 system-ui, sans-serif; cursor: pointer; }
.whats-new-toast button:hover, .whats-new-toast button:focus-visible { background: rgba(255,255,255,.28); }
`;

function store(storage: Storage | undefined, record: SeenRecord): void {
  try { storage?.setItem(WHATS_NEW_SEEN_KEY, JSON.stringify(record)); } catch { /* private mode: it may show again */ }
}

function read(storage: Storage | undefined, key: string): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

/** Fetch the notes (and the build id when deployed), decide, and show the toast. */
export async function mountWhatsNewToast(doc: Document = document, win: Window = window): Promise<HTMLElement | null> {
  const storage = (() => { try { return win.localStorage; } catch { return undefined; } })();
  const getJson = (url: string) => win.fetch(new URL(url, win.location.href), { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [notesFile, deployment] = await Promise.all([getJson('whats-new-notes.json'), getJson('deployment.json')]);
  const decision = decideToast({
    notes: notesFile?.notes,
    seen: parseSeen(read(storage, WHATS_NEW_SEEN_KEY)),
    returning: read(storage, RETURNING_KEY) === '1',
    build: typeof deployment?.short === 'string' ? deployment.short : null,
  });
  if (!decision.show) {
    if (decision.record) store(storage, decision.record);
    return null;
  }
  if (!doc.getElementById('whats-new-toast-styles')) {
    const style = doc.createElement('style');
    style.id = 'whats-new-toast-styles';
    style.textContent = TOAST_CSS;
    doc.head.append(style);
  }
  const toast = doc.createElement('aside');
  toast.className = 'whats-new-toast';
  toast.id = 'whats-new-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-label', "What's New");
  const text = doc.createElement('span');
  text.className = 'whats-new-toast-text';
  const label = doc.createElement('b');
  label.textContent = 'New';
  text.append(label, doc.createTextNode(decision.note.title));
  text.title = decision.note.title;
  const link = doc.createElement('a');
  link.href = 'whats-new.html';
  link.textContent = "What's New";
  const close = doc.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  const seen = () => store(storage, decision.record);
  link.addEventListener('click', seen);
  close.addEventListener('click', () => { seen(); toast.remove(); });
  toast.append(text, link, close);
  doc.body.append(toast);
  // Shown counts as seen: the toast appears once per new note, not until clicked.
  seen();
  return toast;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && !(window as { __whatsNewToastNoAuto?: boolean }).__whatsNewToastNoAuto) {
  const start = () => { void mountWhatsNewToast(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
