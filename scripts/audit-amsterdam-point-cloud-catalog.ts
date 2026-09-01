/** Snapshot the official Amsterdam RGB point-cloud catalog without guessing file URLs. */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve(process.argv.find((value) => value.startsWith('--output='))?.slice(9) || '.cache/building-enrichment/point-cloud-catalog-audit.json');
const base = 'https://api.data.amsterdam.nl/v1/puntenwolk/v2';
const years = [2024, 2025];
const tables = [];
for (const year of years) {
  const endpoint = `${base}/metadata_${year}?_pageSize=1000`;
  const response = await fetch(endpoint, { headers: { Accept: 'application/hal+json' }, signal: AbortSignal.timeout(30_000) });
  const body = response.ok ? await response.json() : null;
  const records = body?._embedded?.[`metadata_${year}`] || [];
  tables.push({ year, endpoint, httpStatus: response.status, recordCount: records.length, records });
}
const tileJsonEndpoint = 'https://api.data.amsterdam.nl/v1/mvt/puntenwolk/v2/tilejson.json';
const tileResponse = await fetch(tileJsonEndpoint, { signal: AbortSignal.timeout(30_000) });
const tileJson = tileResponse.ok ? await tileResponse.json() : null;
const report = {
  schemaVersion: 1,
  auditedAt: new Date().toISOString(),
  source: { name: 'Gemeente Amsterdam Puntenwolk v2', documentation: 'https://api.data.amsterdam.nl/v1/docs/datasets/puntenwolk%40v2.html', access: 'public' },
  tables,
  tileJson: { endpoint: tileJsonEndpoint, httpStatus: tileResponse.status, advertisedTiles: tileJson?.tiles || [], bounds: tileJson?.bounds || null },
  conclusion: tables.some((table) => table.recordCount > 0) ? 'download-records-available' : 'schema-advertised-but-no-download-records-returned',
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
await rename(`${output}.tmp`, output);
process.stdout.write(`${report.conclusion}; ${tables.map((table) => `${table.year}=${table.recordCount}`).join(', ')}.\n`);
