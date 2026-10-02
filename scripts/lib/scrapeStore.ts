/**
 * A durable store of every response a data script scrapes, so a rerun, a new
 * session or a later pipeline can rebuild from what we already fetched instead
 * of asking the source again.
 *
 * Records are keyed by the complete request URL (never by credentials) and
 * written one file per response under `<root>/<host>/<aa>/<sha1>.json` as
 * `{ url, fetchedAt, body }`, so concurrent writers never touch the same file.
 *
 * Root, first that applies:
 *   1. `SCRAPE_STORE_DIR`
 *   2. `/mnt/project-files/scrape-store` (the project's shared folder, which
 *      outlives cloud containers)
 *   3. `.cache/scrape-store` in the checkout (git-ignored)
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ScrapeRecord<T = unknown> { url: string; fetchedAt: string; body: T }

export function scrapeStoreRoot(): string {
  if (process.env.SCRAPE_STORE_DIR) return path.resolve(process.env.SCRAPE_STORE_DIR);
  if (existsSync('/mnt/project-files')) return '/mnt/project-files/scrape-store';
  return path.resolve('.cache/scrape-store');
}

export function scrapeRecordPath(url: URL, root = scrapeStoreRoot()): string {
  const key = createHash('sha1').update(url.toString()).digest('hex');
  return path.join(root, url.hostname, key.slice(0, 2), `${key}.json`);
}

/** The stored record for this exact URL, or undefined when it was never fetched. */
export async function readScrape<T = unknown>(url: URL, root?: string): Promise<ScrapeRecord<T> | undefined> {
  try {
    const record = JSON.parse(await readFile(scrapeRecordPath(url, root), 'utf8')) as ScrapeRecord<T>;
    return record.url === url.toString() ? record : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/** Store a response body; written to a temporary file first so a crash never leaves half a record. */
export async function writeScrape<T>(url: URL, body: T, root?: string): Promise<void> {
  const file = scrapeRecordPath(url, root);
  await mkdir(path.dirname(file), { recursive: true });
  const record: ScrapeRecord<T> = { url: url.toString(), fetchedAt: new Date().toISOString(), body };
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(record));
  await rename(temporary, file);
}
