#!/usr/bin/env node
// Add <meta name="robots" content="noindex"> to every Canal Drive lab/review
// page so it stays public but is not indexed. The game itself
// (public/canal-drive/index.html) is deliberately left alone.
//
// Idempotent: a page that already carries a robots meta is skipped, and
// re-running the script changes nothing.
//
// Usage:
//   node scripts/add-noindex.mjs            # write changes
//   node scripts/add-noindex.mjs --dry-run  # report only

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const META = '<meta name="robots" content="noindex">';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = path.join(root, 'public', 'canal-drive');

// The playable game is served from the site root and must stay indexable.
const EXCLUDED = new Set([path.join(siteDir, 'index.html')]);

// A page counts as already handled if it has any robots meta tag; we never
// rewrite a page that declares its own crawler policy.
const HAS_ROBOTS = /<meta\b[^>]*\bname\s*=\s*["']?robots\b/i;

const HEAD_OPEN = /<head\b[^>]*>/i;
const HTML_OPEN = /<html\b[^>]*>/i;
const DOCTYPE = /<!doctype\b[^>]*>/i;

async function collectHtmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectHtmlFiles(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      out.push(full);
    }
  }
  return out.sort();
}

/**
 * Insert the robots meta into the page's head. Pages without an explicit
 * <head> (several lab pages omit it) get the tag after <html>, or after the
 * doctype, where the HTML parser puts it into the implied head.
 */
function insertMeta(html) {
  for (const re of [HEAD_OPEN, HTML_OPEN, DOCTYPE]) {
    const match = re.exec(html);
    if (match) {
      const at = match.index + match[0].length;
      return html.slice(0, at) + '\n' + META + html.slice(at);
    }
  }
  // Last resort: before anything else, after a leading BOM if present.
  const bom = html.startsWith('\uFEFF') ? 1 : 0;
  return html.slice(0, bom) + META + '\n' + html.slice(bom);
}

const dryRun = process.argv.includes('--dry-run');
const files = await collectHtmlFiles(siteDir);

let added = 0;
let skipped = 0;

for (const file of files) {
  const rel = path.relative(root, file);
  if (EXCLUDED.has(file)) {
    skipped += 1;
    console.log(`- ${rel} (game page, left indexable)`);
    continue;
  }

  const html = await readFile(file, 'utf8');
  if (HAS_ROBOTS.test(html)) {
    skipped += 1;
    console.log(`- ${rel} (already has a robots meta)`);
    continue;
  }

  const updated = insertMeta(html);
  if (!dryRun) await writeFile(file, updated, 'utf8');
  added += 1;
  console.log(`${dryRun ? '?' : '+'} ${rel}`);
}

console.log(`\n${dryRun ? 'would add' : 'added'} noindex to ${added} page(s), skipped ${skipped}.`);
