// devlog.html (GitHub #84): renders data/devlog.json, the progress comments of
// issue #68, newest first. Bundled to js/devlog.bundle.js by esbuild.
import { DEVLOG_ISSUE_URL, entryRest, entryTitle, issueUrl, validateDevlog, type DevlogEntry, type DevlogFile } from './data';
import { esc, renderMarkdown } from './markdown';

const PAGE = 20;

function when(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }),
  };
}

export function entryHtml(e: DevlogEntry): string {
  const { day, time } = when(e.date);
  const title = entryTitle(e.body);
  const body = renderMarkdown(title ? entryRest(e.body) : e.body, { issueUrl, headingShift: 1 });
  const edited = e.updated && e.updated.slice(0, 16) !== e.date.slice(0, 16) ? ' · edited' : '';
  return `<article class="entry">
<p class="when"><time datetime="${esc(e.date)}">${esc(day)} · ${esc(time)}</time>${edited}</p>
${title ? `<h2>${esc(title)}</h2>` : ''}
<div class="md">${body}</div>
<p class="links"><a href="${esc(e.url)}" rel="noopener">Read or reply on GitHub</a></p>
</article>`;
}

async function main() {
  const feed = document.getElementById('feed')!;
  const more = document.getElementById('more') as HTMLButtonElement;
  const count = document.getElementById('count')!;
  const state = { shown: PAGE, entries: [] as DevlogEntry[] };
  const w = window as unknown as { devlog: { ready: boolean; entries: number; error?: string } };
  w.devlog = { ready: false, entries: 0 };
  try {
    const r = await fetch('./data/devlog.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`devlog.json ${r.status}`);
    const file = await r.json() as DevlogFile;
    const errs = validateDevlog(file);
    if (errs.length) throw new Error(errs[0]);
    state.entries = file.entries;
  } catch (err) {
    feed.innerHTML = `<p class="empty">The log could not be loaded. Read it on <a href="${esc(DEVLOG_ISSUE_URL)}">GitHub</a>.</p>`;
    w.devlog.error = String(err);
    w.devlog.ready = true;
    return;
  }
  const draw = () => {
    const list = state.entries.slice(0, state.shown);
    feed.innerHTML = list.length ? list.map(entryHtml).join('\n') : '<p class="empty">No updates yet.</p>';
    more.hidden = state.entries.length <= state.shown;
    const latest = state.entries[0] ? when(state.entries[0].date).day : '';
    count.textContent = `${state.entries.length} ${state.entries.length === 1 ? 'update' : 'updates'}${latest ? ` · latest ${latest}` : ''}`;
    w.devlog.entries = list.length;
  };
  more.addEventListener('click', () => { state.shown += PAGE; draw(); });
  draw();
  w.devlog.ready = true;
}

if (typeof document !== 'undefined') void main();
