import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface CachedJsonFetchOptions {
  cacheDirectory?: string;
  headers?: Record<string, string>;
  maxAgeMs?: number;
  attempts?: number;
  pauseMs?: number;
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Cache successful GET responses by their complete URL, including query parameters. */
export async function cachedJsonFetch<T = any>(url: URL, options: CachedJsonFetchOptions = {}): Promise<T> {
  const cacheDirectory = path.resolve(options.cacheDirectory || '.cache/http-json');
  const key = createHash('sha256').update(url.toString()).digest('hex');
  const cacheFile = path.join(cacheDirectory, `${key}.json`);
  const maxAgeMs = options.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000;
  try {
    const metadata = await stat(cacheFile);
    if (Date.now() - metadata.mtimeMs <= maxAgeMs) return JSON.parse(await readFile(cacheFile, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const attempts = options.attempts ?? 4;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, { headers: options.headers });
    if (response.ok) {
      const data = await response.json() as T;
      await mkdir(cacheDirectory, { recursive: true });
      const temporaryFile = `${cacheFile}.${process.pid}.tmp`;
      await writeFile(temporaryFile, JSON.stringify(data));
      await rename(temporaryFile, cacheFile);
      if (options.pauseMs) await wait(options.pauseMs);
      return data;
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === attempts - 1) throw new Error(`${url.hostname}: HTTP ${response.status}`);
    await wait(Number(response.headers.get('retry-after') || 2) * 1000 * (attempt + 1));
  }
  throw new Error(`${url.hostname}: exhausted retries`);
}
