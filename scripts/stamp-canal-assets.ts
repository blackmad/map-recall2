// Content-hash cache stamps for the Canal Recall pages.
//
// Hosting serves `/js/**` with a one-hour cache and the pages cache-bust by
// hand (`js/engine.bundle.js?v=20261030-engine`). On 2026-10-31 eighteen tags
// were stale after a day of bundle rebuilds, so a player on the deployed site
// ran yesterday's engine bundle with today's everything else (slow, blurry,
// pop-in on `?engine=own`). This rewrites every local `?v=` stamp in the
// given directory's HTML files to the first 10 hex digits of the referenced
// file's SHA-256, so a changed file always gets a new URL and an unchanged
// one keeps its cache. The deploy workflow runs it on the assembled site;
// `--check` reports what would change without writing (for the gate).
//
//   node --import tsx scripts/stamp-canal-assets.ts <dir> [--check]
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const STAMP_RE = /((?:src|href)=")([^"?#]+)\?v=([^"]*)(")/g;

export function hashStamp(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 10);
}

export type StampResult = { html: string; changed: Array<{ asset: string; from: string; to: string }>; missing: string[] };

/** Rewrite the `?v=` stamps in one page; `read` resolves an asset path relative to the page. */
export function stampHtml(html: string, read: (assetPath: string) => Uint8Array | null): StampResult {
  const changed: StampResult['changed'] = [];
  const missing: string[] = [];
  const out = html.replace(STAMP_RE, (whole, pre: string, asset: string, from: string, post: string) => {
    if (/^(https?:)?\/\//.test(asset) || asset.startsWith('/')) return whole;
    const bytes = read(asset);
    if (!bytes) { missing.push(asset); return whole; }
    const to = hashStamp(bytes);
    if (to !== from) changed.push({ asset, from, to });
    return `${pre}${asset}?v=${to}${post}`;
  });
  return { html: out, changed, missing };
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).filter(f => f.endsWith('.html')).map(f => join(dir, f));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename ?? '')) {
  const [dirArg, ...flags] = process.argv.slice(2);
  if (!dirArg) { console.error('usage: stamp-canal-assets.ts <dir> [--check]'); process.exit(2); }
  const check = flags.includes('--check');
  const dir = resolve(dirArg);
  let total = 0, missingTotal = 0;
  for (const file of htmlFiles(dir)) {
    const html = readFileSync(file, 'utf8');
    const { html: next, changed, missing } = stampHtml(html, asset => {
      const p = join(dirname(file), asset);
      return existsSync(p) && statSync(p).isFile() ? readFileSync(p) : null;
    });
    total += changed.length; missingTotal += missing.length;
    for (const m of missing) console.warn(`${file}: missing asset ${m}`);
    if (changed.length) console.log(`${file}: ${changed.length} stamp(s)${check ? ' would change' : ' rewritten'}: ${changed.slice(0, 6).map(c => `${c.asset} ${c.from}->${c.to}`).join(', ')}${changed.length > 6 ? ', …' : ''}`);
    if (!check && next !== html) writeFileSync(file, next);
  }
  console.log(`${check ? 'check' : 'stamped'}: ${total} stamp(s) ${check ? 'differ' : 'rewritten'}, ${missingTotal} missing asset(s) in ${dir}`);
  if (missingTotal) process.exit(1);
}
