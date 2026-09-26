/**
 * Minimal streaming CSV reader for GTFS `.txt` files (UTF-8 with optional BOM).
 * Assumes no embedded newlines inside quoted fields — true of OVapi GTFS.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

/** Yield row objects for a GTFS CSV path. */
export async function* readGtfsCsv(filePath: string): AsyncGenerator<Record<string, string>> {
  const input = createReadStream(filePath, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let headers: string[] | null = null;
  for await (const raw of lines) {
    const line = headers === null ? raw.replace(/^\uFEFF/, '') : raw;
    if (!line) continue;
    const fields = parseCsvLine(line);
    if (!headers) {
      headers = fields;
      continue;
    }
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]!] = fields[i] ?? '';
    }
    yield row;
  }
}
