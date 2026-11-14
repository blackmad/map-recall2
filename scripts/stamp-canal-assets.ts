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
// Immutable names (lane LS, 2026-11-14). Hosting matches header rules on the
// path only, never the query, so a `?v=` stamp cannot earn a long cache: every
// warm load revalidated 100+ scripts. With `--rename` (the deploy), a stamped
// js/ or css/ asset is also written beside itself as `<name>-h<hash>.bundle.js`
// (`-h<hash>.js`, `-h<hash>.css`) and the page points there, still with its
// `?v=<hash>` (lookAtlas.ts keys its stored atlas on it). firebase.json serves
// those names `immutable`; every other /js/ file keeps `no-cache`. The name
// keeps its directory and its `.bundle.js` ending, so the bundles that find a
// sibling from their own src (engine/workerPool.ts poolWorkerUrl) still do; the
// sibling is the plain, revalidated name. Under --rename a js/ or css/ reference with no stamp at all gets one too
// (40 of the ride's 76 scripts had none: every warm load revalidated them).
//
// Scripts built into JS (lane LS, 2026-11-14). A quoted page-relative
// `'js/<file>.js?v=<anything>'` inside a js/ file (the own-ground bundles in
// ownWorldView.ts and vector-map.js) is stamped the same way, until nothing
// changes, before the files that hold them are hashed for the pages.
//
//   node --import tsx scripts/stamp-canal-assets.ts <dir> [--check] [--rename]
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const STAMP_RE = /((?:src|href)=")([^"?#]+)\?v=([^"]*)(")/g;
/** A js/ or css/ page reference with no stamp at all: --rename gives it one and an immutable name too. */
const UNSTAMPED_RE = /((?:src|href)=")((?:js|css)\/[^"?#/]+\.(?:m?js|css))(")/g;
/** A quoted page-relative script URL with a stamp, inside a script. */
const SCRIPT_REF_RE = /(["'`])(js\/[\w./-]+?\.m?js)\?v=([\w.-]*)\1/g;
const HASHED_RE = /-h[0-9a-f]{10}((?:\.bundle)?\.(?:m?js|css))$/;
/** Assets in these page-relative directories get an immutable name under --rename. */
const RENAMED_DIR_RE = /^(js|css)\/[^/]+$/;

export function hashStamp(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 10);
}

/** `js/engine.bundle.js` → `js/engine-h<hash>.bundle.js`; `css/a.css` → `css/a-h<hash>.css`. */
export function hashedName(asset: string, hash: string): string {
  return asset.replace(/((?:\.bundle)?\.(?:m?js|css))$/, `-h${hash}$1`);
}

/** The plain name of an asset that already carries an immutable name (a re-run is a no-op). */
export function plainName(asset: string): string {
  return asset.replace(HASHED_RE, '$1');
}

export type Copy = { from: string; to: string };
export type StampResult = { html: string; changed: Array<{ asset: string; from: string; to: string }>; missing: string[]; copies: Copy[] };
export type StampOptions = { rename?: boolean };

function stampRef(asset: string, from: string, read: (assetPath: string) => Uint8Array | null, options: StampOptions, out: StampResult): string | null {
  const plain = plainName(asset);
  const bytes = read(plain);
  if (!bytes) { out.missing.push(plain); return null; }
  const to = hashStamp(bytes);
  const name = options.rename && RENAMED_DIR_RE.test(plain) ? hashedName(plain, to) : plain;
  if (to !== from || name !== asset) out.changed.push({ asset: plain, from, to });
  if (name !== plain) out.copies.push({ from: plain, to: name });
  return `${name}?v=${to}`;
}

/** Rewrite the `?v=` stamps in one page; `read` resolves an asset path relative to the page. */
export function stampHtml(html: string, read: (assetPath: string) => Uint8Array | null, options: StampOptions = {}): StampResult {
  const result: StampResult = { html, changed: [], missing: [], copies: [] };
  result.html = html.replace(STAMP_RE, (whole, pre: string, asset: string, from: string, post: string) => {
    if (/^(https?:)?\/\//.test(asset) || asset.startsWith('/')) return whole;
    const ref = stampRef(asset, from, read, options, result);
    return ref ? `${pre}${ref}${post}` : whole;
  });
  if (options.rename) {
    result.html = result.html.replace(UNSTAMPED_RE, (whole, pre: string, asset: string, post: string) => {
      // An unstamped tag never failed the deploy before; a missing file there is left alone, not reported.
      if (!read(plainName(asset))) return whole;
      const ref = stampRef(asset, '', read, options, result);
      return ref ? `${pre}${ref}${post}` : whole;
    });
  }
  return result;
}

/** Rewrite the quoted `'js/<file>.js?v=…'` stamps inside one script; `read` resolves page-relative paths. */
export function stampScript(js: string, read: (assetPath: string) => Uint8Array | null, options: StampOptions = {}): StampResult {
  const result: StampResult = { html: js, changed: [], missing: [], copies: [] };
  result.html = js.replace(SCRIPT_REF_RE, (whole, quote: string, asset: string, from: string) => {
    const ref = stampRef(asset, from, read, options, result);
    return ref ? `${quote}${ref}${quote}` : whole;
  });
  return result;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).filter(f => f.endsWith('.html')).map(f => join(dir, f));
}

function scriptFiles(dir: string): string[] {
  const js = join(dir, 'js');
  if (!existsSync(js)) return [];
  return readdirSync(js).filter(f => /\.m?js$/.test(f) && !HASHED_RE.test(f)).map(f => join(js, f));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename ?? '')) {
  const [dirArg, ...flags] = process.argv.slice(2);
  if (!dirArg) { console.error('usage: stamp-canal-assets.ts <dir> [--check] [--rename]'); process.exit(2); }
  const check = flags.includes('--check');
  const options: StampOptions = { rename: flags.includes('--rename') };
  const dir = resolve(dirArg);
  const readFrom = (base: string) => (asset: string) => {
    const p = join(base, asset);
    return existsSync(p) && statSync(p).isFile() ? readFileSync(p) : null;
  };
  let total = 0, missingTotal = 0;
  const copies = new Map<string, string>();
  const report = (file: string, r: StampResult) => {
    total += r.changed.length; missingTotal += r.missing.length;
    for (const m of r.missing) console.warn(`${file}: missing asset ${m}`);
    for (const c of r.copies) copies.set(c.to, c.from);
    if (r.changed.length) console.log(`${file}: ${r.changed.length} stamp(s)${check ? ' would change' : ' rewritten'}: ${r.changed.slice(0, 6).map(c => `${c.asset} ${c.from}->${c.to}`).join(', ')}${r.changed.length > 6 ? ', …' : ''}`);
  };
  // Scripts first, until no stamp moves (a script's own hash covers the stamps inside it), then one
  // reporting pass over the settled files. --check cannot write, so it reports the first pass only.
  const scripts = scriptFiles(dir).filter(f => readFileSync(f, 'utf8').includes('?v='));
  for (let pass = 0; pass < 8 && !check; pass++) {
    let moved = false;
    for (const file of scripts) {
      const js = readFileSync(file, 'utf8');
      const next = stampScript(js, readFrom(dir), options).html;
      if (next !== js) { moved = true; writeFileSync(file, next); }
    }
    if (!moved) break;
  }
  for (const file of scripts) report(file, stampScript(readFileSync(file, 'utf8'), readFrom(dir), options));
  for (const file of htmlFiles(dir)) {
    const html = readFileSync(file, 'utf8');
    const r = stampHtml(html, readFrom(dirname(file)), options);
    report(file, r);
    if (!check && r.html !== html) writeFileSync(file, r.html);
  }
  if (!check) for (const [to, from] of copies) writeFileSync(join(dir, to), readFileSync(join(dir, from)));
  console.log(`${check ? 'check' : 'stamped'}: ${total} stamp(s) ${check ? 'differ' : 'rewritten'}, ${copies.size} immutable cop${copies.size === 1 ? 'y' : 'ies'}, ${missingTotal} missing asset(s) in ${dir}`);
  if (missingTotal) process.exit(1);
}
