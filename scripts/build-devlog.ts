// Dev log (GitHub #84): the progress comments on the pinned issue #68 to
// public/canal-drive/data/devlog.json, newest first, for devlog.html.
//
//   node --import tsx scripts/build-devlog.ts           # fetch with `gh` (needs network and gh auth) and write
//   node --import tsx scripts/build-devlog.ts --check   # validate the committed JSON's shape only (no network)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEVLOG_ISSUE, DEVLOG_ISSUE_URL, DEVLOG_REPO, toEntries, validateDevlog, type DevlogFile, type GithubComment } from '../src/canalRecall/devlog/data';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/canal-drive/data/devlog.json');

if (process.argv.includes('--check')) {
  if (!existsSync(OUT)) { console.error(`missing ${path.relative(ROOT, OUT)}; run: node --import tsx scripts/build-devlog.ts`); process.exit(1); }
  const errs = validateDevlog(JSON.parse(readFileSync(OUT, 'utf8')));
  if (errs.length) { console.error(`devlog.json is malformed:\n  ${errs.slice(0, 12).join('\n  ')}`); process.exit(1); }
  console.log('devlog.json ok');
  process.exit(0);
}

const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
// --paginate concatenates one JSON array per page; --jq '.[]' flattens them to one object per line.
const comments = gh(['api', `repos/${DEVLOG_REPO}/issues/${DEVLOG_ISSUE}/comments`, '--paginate', '--jq', '.[] | {created_at, updated_at, body, html_url, user: {login: .user.login}}'])
  .split('\n').filter(Boolean).map(l => JSON.parse(l) as GithubComment);
const title = JSON.parse(gh(['api', `repos/${DEVLOG_REPO}/issues/${DEVLOG_ISSUE}`, '--jq', '{title}'])).title as string;
const owner = DEVLOG_REPO.split('/')[0];
const file: DevlogFile = { issue: DEVLOG_ISSUE_URL, title, entries: toEntries(comments, new Set([owner])) };
const errs = validateDevlog(file);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
writeFileSync(OUT, `${JSON.stringify(file, null, 1)}\n`);
console.log(`wrote ${file.entries.length} entries to ${path.relative(ROOT, OUT)} (${comments.length - file.entries.length} skipped)`);
