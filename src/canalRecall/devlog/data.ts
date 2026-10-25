// Dev log data (GitHub #84): the progress comments on the pinned public issue
// blackmad/map-recall2#68, newest first. scripts/build-devlog.ts fetches them with
// `gh` and writes public/canal-drive/data/devlog.json; devlog.html renders it.

export const DEVLOG_REPO = 'blackmad/map-recall2';
export const DEVLOG_ISSUE = 68;
export const DEVLOG_ISSUE_URL = `https://github.com/${DEVLOG_REPO}/issues/${DEVLOG_ISSUE}`;
export const issueUrl = (n: number): string => `https://github.com/${DEVLOG_REPO}/issues/${n}`;

export interface DevlogEntry {
  /** ISO 8601 creation time of the comment. */
  date: string;
  /** ISO 8601 time of the last edit, when it differs from `date`. */
  updated?: string;
  /** The comment's Markdown, as written. */
  body: string;
  /** Permalink to the comment on GitHub. */
  url: string;
}
export interface DevlogFile { issue: string; title: string; entries: DevlogEntry[] }

/** The fields of a GitHub issue comment the log keeps (author, reactions and ids are left out). */
export interface GithubComment { created_at: string; updated_at?: string; body?: string | null; html_url: string; user?: { login?: string } | null }

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Comments to entries, newest first; empty comments are dropped. `authors` keeps only the maintainers' posts. */
export function toEntries(comments: readonly GithubComment[], authors?: ReadonlySet<string>): DevlogEntry[] {
  return comments
    .filter(c => (c.body ?? '').trim() && (!authors || authors.has(c.user?.login ?? '')))
    .map(c => {
      const e: DevlogEntry = { date: c.created_at, body: (c.body ?? '').replace(/\r\n?/g, '\n').trim(), url: c.html_url };
      if (c.updated_at && c.updated_at !== c.created_at) e.updated = c.updated_at;
      return e;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Problems with a devlog.json, [] when it is well-formed (used by `build-devlog --check`, without network). */
export function validateDevlog(file: unknown): string[] {
  const errs: string[] = [];
  const f = file as Partial<DevlogFile> | null;
  if (!f || typeof f !== 'object') return ['not an object'];
  if (typeof f.issue !== 'string' || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(f.issue)) errs.push('issue: expected a GitHub issue URL');
  if (typeof f.title !== 'string') errs.push('title: expected a string');
  if (!Array.isArray(f.entries)) return [...errs, 'entries: expected an array'];
  f.entries.forEach((e, i) => {
    if (!e || typeof e !== 'object') { errs.push(`entries[${i}]: not an object`); return; }
    if (typeof e.date !== 'string' || !ISO.test(e.date)) errs.push(`entries[${i}].date: expected an ISO UTC time`);
    if (e.updated !== undefined && (typeof e.updated !== 'string' || !ISO.test(e.updated))) errs.push(`entries[${i}].updated: expected an ISO UTC time`);
    if (typeof e.body !== 'string' || !e.body.trim()) errs.push(`entries[${i}].body: expected Markdown text`);
    if (typeof e.url !== 'string' || !/^https:\/\/github\.com\/.+#issuecomment-\d+$/.test(e.url)) errs.push(`entries[${i}].url: expected a comment permalink`);
    const keys = Object.keys(e).filter(k => !['date', 'updated', 'body', 'url'].includes(k));
    if (keys.length) errs.push(`entries[${i}]: unexpected ${keys.join(', ')}`);
    if (i > 0 && typeof e.date === 'string' && typeof f.entries![i - 1]?.date === 'string' && e.date > f.entries![i - 1].date) errs.push(`entries[${i}]: not newest first`);
  });
  return errs;
}

/** The entry's first heading or bold lead line, as a plain title; '' when it opens with prose. */
export function entryTitle(body: string): string {
  const first = body.split('\n').find(l => l.trim())?.trim() ?? '';
  const m = /^#{1,6}\s+(.*)$/.exec(first) ?? /^\*\*(.+?)\*\*\s*$/.exec(first);
  return m ? m[1].replace(/[*_`]/g, '').trim() : '';
}

/** The body without the title line that `entryTitle` lifted out. */
export function entryRest(body: string): string {
  const lines = body.split('\n');
  const i = lines.findIndex(l => l.trim());
  return entryTitle(body) ? lines.slice(i + 1).join('\n').trim() : body;
}
