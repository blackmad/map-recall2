// Cloudflare Pages output for rideamsterdam.nl, derived from the Firebase build.
//   node scripts/hosting/build-pages-site.mjs [--src=dist-canalrecall] [--out=dist-pages]
// Clones the assembled Firebase site (copy-on-write where the filesystem allows), drops
// the files firebase.json's `ignore` keeps off Hosting, and writes `_redirects` and
// `_headers` translated from the canalrecall target's redirects, rewrites and headers,
// so firebase.json stays the single source of routing truth while both hosts exist.
//
// Pages differences handled here:
// - Pages serves `/ride` from `ride.html` by itself and 308s `/ride.html` to `/ride`, so a
//   rewrite onto an `.html` file is written as the extensionless path.
// - Pages 308s `/quiz/index.html` to `/quiz/`, so rewrites onto an index file target the
//   directory instead.
// - Firebase `**` globs become a trailing `*` splat; Pages allows one splat per rule.
// - Pages has no ignore list: ignored files are deleted from the output instead.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const src = arg('src', 'dist-canalrecall');
const out = arg('out', 'dist-pages');
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const target = JSON.parse(fs.readFileSync('firebase.json', 'utf8')).hosting.find((h) => h.target === 'canalrecall');
if (!target) throw new Error('firebase.json has no canalrecall hosting target');
if (!fs.existsSync(path.join(src, 'index.html'))) throw new Error(`${src}/index.html missing: run the site build and assemble-canalrecall-site first`);

fs.rmSync(out, { recursive: true, force: true });
// macOS: clonefile; Linux CI: reflink when available, else a plain copy.
const cpArgs = process.platform === 'darwin' ? ['-cR'] : ['-R', '--reflink=auto'];
execFileSync('cp', [...cpArgs, src, out]);

// Firebase ignore globs → RegExp over the output-relative path.
const globToRegExp = (glob) => {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else re += /[.+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${re}$`);
};
const ignore = (target.ignore ?? []).map(globToRegExp);
const files = [];
let removed = 0;
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(out, full);
    if (entry.isDirectory()) {
      if (ignore.some((re) => re.test(rel) || re.test(`${rel}/x`))) {
        fs.rmSync(full, { recursive: true, force: true });
        removed++;
      } else walk(full);
    } else if (ignore.some((re) => re.test(rel))) {
      fs.rmSync(full);
      removed++;
    } else files.push(rel);
  }
};
walk(out);

const splat = (source) => source.replace(/\/\*\*$/, '/*');
const pagesDestination = (destination) =>
  destination.replace(/\/index\.html$/, '/').replace(/^(\/.+)\.html$/, '$1');

const redirects = [];
for (const r of target.redirects ?? []) redirects.push(`${splat(r.source)} ${r.destination} ${r.type ?? 301}`);
for (const r of target.rewrites ?? []) {
  const destination = pagesDestination(r.destination);
  // `/ride` → `ride.html` is Pages' own behaviour; a rule onto itself would loop.
  if (destination === r.source) continue;
  const source = splat(r.source);
  // Pages applies `_redirects` before static files, so a catch-all like `/quiz/*` would
  // also swallow `/quiz/assets/x.js`. Firebase serves existing files first; restore that
  // by passing every real entry of the catch-all's directory through to itself first.
  const dir = source.endsWith('/*') ? source.slice(1, -2) : null;
  if (dir && fs.existsSync(path.join(out, dir))) {
    for (const entry of fs.readdirSync(path.join(out, dir), { withFileTypes: true })) {
      if (entry.name === 'index.html') continue;
      const p = `/${dir}/${entry.name}`;
      redirects.push(entry.isDirectory() ? `${p}/* ${p}/:splat 200` : `${p} ${p} 200`);
    }
  }
  redirects.push(`${source} ${destination} 200`);
}
fs.writeFileSync(path.join(out, '_redirects'), `${redirects.join('\n')}\n`);

// Without a top-level 404.html Pages treats the site as a single-page app and answers every
// missing path with the landing page and a 200; Firebase answers 404, and the game relies on
// that for optional data files.
if (!fs.existsSync(path.join(out, '404.html'))) {
  fs.writeFileSync(path.join(out, '404.html'), '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found · Ride Amsterdam</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>Not found</h1><p>That page is not here. <a href="/">Ride Amsterdam home</a></p></body>\n');
}

// Pages serves `x.html` at `/x` (and `/quiz/index.html` at `/quiz/`), so an `.html` source also
// gets a block for the path the browser actually requests.
const headerSources = (source) => {
  const served = pagesDestination(source);
  return served === source ? [splat(source)] : [source, served];
};
const headerBlocks = (target.headers ?? []).flatMap((h) => headerSources(h.source).map((source) =>
  [source, ...h.headers.map(({ key, value }) => `  ${key}: ${value}`)].join('\n')));
fs.writeFileSync(path.join(out, '_headers'), `${headerBlocks.join('\n')}\n`);

const tooBig = files.filter((rel) => fs.statSync(path.join(out, rel)).size > MAX_FILE_BYTES);
console.log(`${out}: ${files.length} files (${removed} ignored paths removed), ${redirects.length} redirect rules, ${headerBlocks.length} header rules`);
if (files.length > MAX_FILES) throw new Error(`Pages allows ${MAX_FILES} files per deployment; ${files.length} would be uploaded`);
if (tooBig.length) throw new Error(`Pages caps files at 25 MiB: ${tooBig.join(', ')}`);
